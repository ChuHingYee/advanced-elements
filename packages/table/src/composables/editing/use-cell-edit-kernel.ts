/**
 * <zh/> 单元格编辑提交内核门面——cell / row 提交的唯一统一入口。
 * <en/> Cell-edit commit kernel facade — the single unified entry for cell / row commits.
 *
 * @remarks
 * <zh/> 只收敛不改写：共享前置守卫（排队门控 / 校验 epoch / 长度守卫·同引用）在此
 * <zh/> fail-fast，spread 冲突在此审计，随后下发到既有的 commit-cell / commit-row 实现。
 * <zh/> 提交相位依赖与返回形状（`UseCellEditCommitDeps` / `UseCellEditCommitReturn`）也定义于本文件
 * <zh/> ——原 `use-cell-edit-commit.ts` 为纯转发层，已删除。
 * <en/> converges without rewriting: shared pre-flight guards (queue gate / validation epoch /
 * <en/> length guard · same-reference) fail-fast here, the spread-conflict probe audits here,
 * <en/> then execution dispatches to the existing commit-cell / commit-row implementations.
 * <en/> The commit-phase deps and return shape (`UseCellEditCommitDeps` /
 * <en/> `UseCellEditCommitReturn`) also live here — the original `use-cell-edit-commit.ts`
 * <en/> was a pure forwarding layer and has been deleted.
 */
import type { ComputedRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellEditStopReason, CommitResult, FullRowEditEvent } from '../../types/edit'
import type { EditRaceProtection } from '../../utils/edit-race-protection'
import type { UseCellEditApplyReturn } from './use-cell-edit-apply'
import type { CellEditEvents } from './use-cell-edit-events'
import type { CellEditSession } from './use-cell-edit-session'
import type { CellEditValidation } from './use-cell-edit-validation'
import type { UseEditDirtyReturn } from './use-edit-dirty'
import type { EditUndoEntry } from './use-edit-undo'
import type { UseInterceptorReturn } from './use-interceptor'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { shallowEqual } from '../../utils/equality'
import { useCellEditCommitCell } from './use-cell-edit-commit-cell'
import { collectFullRowPendingChanges, useCellEditCommitRow } from './use-cell-edit-commit-row'

/** <zh/> 提交序列号（模块级单调递增，仅供 dev 日志串联一次提交的守卫/审计/下发） | <en/> Commit sequence (module-level monotonic, dev logs only to correlate guards/audit/dispatch of one commit) */
let commitSeq = 0

/**
 * <zh/> 提交种类——单格提交走 cell 路径，整行提交走 row 路径
 * <en/> Commit kind — single-cell commits take the cell path, full-row commits take the row path
 */
export type CellEditCommitKind = 'cell' | 'row'

/**
 * <zh/> 提交基线——门控等待前捕获的观测点：数据引用 + 长度 + 校验 epoch（版本号）
 * <en/> Commit baseline — observation point captured before the gate await: data reference + length + validation epoch (version)
 */
export interface CommitBaseline<T = any> {
  /** <zh/> 门控等待前的数据引用 | <en/> Data reference before the gate await */
  dataRef: T[]
  /** <zh/> 门控等待前的数据长度（长度守卫 / 同引用） | <en/> Data length before the gate await (length guard / same-reference) */
  length: number
  /** <zh/> 门控等待前的竞态版本号（校验 epoch） | <en/> Race version before the gate await (validation epoch) */
  version: number
}

/**
 * <zh/> 捕获提交基线——纯函数，无副作用 | <en/> Capture the commit baseline — pure, side-effect free
 */
export function captureCommitBaseline<T = any>(currentData: T[], version: number): CommitBaseline<T> {
  return { dataRef: currentData, length: currentData.length, version }
}

/**
 * <zh/> 基线过期原因——'unmounted' 卸载 / 'epoch-stale' 版本号变化 / 'length-mismatch' 同引用原地增删
 * <en/> Baseline-stale reason — 'unmounted' unmounted / 'epoch-stale' version moved / 'length-mismatch' same-reference in-place splice
 */
export type BaselineStaleReason = 'unmounted' | 'epoch-stale' | 'length-mismatch'

/**
 * <zh/> 共享前置守卫（纯函数，fail-fast，无副作用）——依次检查卸载 / 校验 epoch / 长度守卫。
 * <zh/> 长度守卫覆盖同引用原地增删（`isStale` 只比引用，引用不变的 splice 只能靠长度检出）；
 * <zh/> 同长度原地重排不在覆盖内，仍由下游 `resolveStaleIndex` 按行键/行引用重定位。
 * <en/> Shared pre-flight guard (pure, fail-fast, side-effect free) — checks unmount / validation
 * <en/> epoch / length guard in order. The length guard covers same-reference splices (`isStale`
 * <en/> compares references only); same-length in-place reorders stay out of scope and are still
 * <en/> relocated downstream by `resolveStaleIndex`.
 *
 * @returns <zh/> null 放行，否则为过期原因 | <en/> null to proceed, otherwise the stale reason
 */
export function checkCommitBaselineFresh<T = any>(baseline: CommitBaseline<T>, currentData: T[], currentVersion: number, unmounted: boolean): BaselineStaleReason | null {
  if (unmounted)
    return 'unmounted'
  if (currentVersion !== baseline.version)
    return 'epoch-stale'
  if (currentData.length !== baseline.length)
    return 'length-mismatch'
  return null
}

/**
 * <zh/> spread 冲突——基线行快照与当前行在「本次待写字段」上不一致，后续 spread 将 last-writer-wins 静默覆盖其中一方。
 * <en/> Spread conflict — baseline snapshot and current row disagree on a pending prop; a later spread would silently clobber one side (last-writer-wins).
 */
export interface SpreadConflict {
  /** <zh/> 冲突字段 | <en/> Conflicting prop */
  prop: string
  /** <zh/> 基线快照中的值 | <en/> Value in the baseline snapshot */
  baselineValue: unknown
  /** <zh/> 当前行中的值 | <en/> Value in the current row */
  currentValue: unknown
}

/**
 * <zh/> spread 冲突探测（纯函数，可单测）——仅比对待写字段；非待写字段的外部写入按构造安全，不计入冲突。
 * <en/> Spread-conflict probe (pure, testable) — pending props only; writes to other props are safe by construction, never reported.
 */
export function detectSpreadConflicts(params: { baselineRow: Record<string, unknown> | null | undefined, currentRow: Record<string, unknown> | null | undefined, pendingProps: readonly string[] }): SpreadConflict[] {
  const { baselineRow, currentRow, pendingProps } = params
  if (!baselineRow || !currentRow || pendingProps.length === 0)
    return []
  const conflicts: SpreadConflict[] = []
  for (const prop of pendingProps) {
    const baselineValue = baselineRow[prop]
    const currentValue = currentRow[prop]
    if (!shallowEqual(currentValue, baselineValue))
      conflicts.push({ prop, baselineValue, currentValue })
  }
  return conflicts
}

/**
 * <zh/> 提交相位依赖——cell / row 两条路径所需依赖的并集（结构类型保证可同时供给两条路径）。
 * <zh/> 原定义于 `use-cell-edit-commit.ts`（纯转发层，已删除），此处为唯一真相。
 * <en/> Commit-phase deps — the union of what both the cell and row paths need (structural typing lets
 * <en/> one object feed both). Originally defined in `use-cell-edit-commit.ts` (a pure forwarding
 * <en/> layer, now deleted); this is the single source.
 */
export interface UseCellEditCommitDeps<T = any> {
  /** <zh/> 可见数据 | <en/> Visible data */
  data: ComputedRef<T[]>
  /** <zh/> 列配置 | <en/> Column configs */
  columns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 会话状态 | <en/> Session state */
  session: CellEditSession<T>
  /** <zh/> 是否整行编辑 | <en/> Whether full-row editing */
  isFullRowEdit: ComputedRef<boolean>
  /** <zh/> 是否只读编辑（仅通知宿主） | <en/> Whether read-only editing (notify host only) */
  isReadOnlyEdit: ComputedRef<boolean>
  /** <zh/> 是否批量编辑（挂起暂存） | <en/> Whether batch editing (staged) */
  isBatchEdit: ComputedRef<boolean>
  /** <zh/> 列可编辑判定 | <en/> Column-editable predicate */
  isColumnEditable: (col: ProcessedColumn) => boolean
  /** <zh/> 校验相位 | <en/> Validation phase */
  validation: CellEditValidation<T>
  /** <zh/> 事件发射相位 | <en/> Event-emit phase */
  events: Pick<CellEditEvents<T>, 'emitCellValueChanged' | 'emitCellStopped' | 'emitRowCellsStopped'>
  /** <zh/> 值流转管线 | <en/> Value pipeline */
  apply: UseCellEditApplyReturn<T>
  /** <zh/> 脏标记追踪 | <en/> Dirty tracking */
  dirty: Pick<UseEditDirtyReturn, 'clearDirtyCell'>
  /** <zh/> 索引过期重定位 | <en/> Stale-index relocation */
  resolveStaleIndex: (currentData: T[], currentIndex: number) => number
  /** <zh/> 取消会话（拦截器裁决为拒时） | <en/> Cancel the session (on an interceptor veto) */
  cancelEditing: (reason: CellEditStopReason) => void
  /** <zh/> 竞态保护控制器 | <en/> Race protection controller */
  raceProtection: EditRaceProtection<T>
  /** <zh/> 事件拦截器 | <en/> Event interceptor */
  interceptor?: UseInterceptorReturn
  /** <zh/> 异步校验函数 | <en/> Async validation function */
  validateFn?: (params: {
    mode: 'cell' | 'row'
    rowIndex: number
    columnKey: string
    value: any
    values?: Record<string, unknown>
    rowData?: unknown
  }) => Promise<boolean>
  /** <zh/> 数据更新回调 | <en/> Data update callback */
  onDataUpdate: (newData: T[], source?: 'full' | 'view-slice') => void
  /** <zh/> 整行编辑变更回调 | <en/> Full-row edit changed callback */
  onFullRowEditChanged?: (event: FullRowEditEvent<T>) => void
  /** <zh/> 撤销栈入栈 | <en/> Undo stack push */
  pushUndo?: (entry: EditUndoEntry) => void
}

/** <zh/> 提交相位返回 | <en/> Commit-phase return */
export interface UseCellEditCommitReturn {
  /** <zh/> 内部提交入口（带 pendingStart 排队门控开关） | <en/> Internal commit entry (with the pendingStart queue-gate switch) */
  commitEditingInternal: (reason?: CellEditStopReason, skipPendingStartGate?: boolean) => Promise<CommitResult>
  /** <zh/> 公共提交入口——保留 pendingStart 排队门控 | <en/> Public commit entry — keeps the pendingStart queue gate */
  commitEditing: (reason?: CellEditStopReason) => Promise<CommitResult>
}

/**
 * <zh/> 内核门面依赖——与提交相位依赖相同（结构类型直通 cell / row 两条路径），外加可选的冲突回调
 * <en/> Kernel-facade deps — identical to the commit-phase deps (structurally feeds both paths), plus an optional conflict callback
 */
export interface UseCellEditKernelDeps<T = any> extends UseCellEditCommitDeps<T> {
  /**
   * <zh/> spread 冲突通知（仅探测，不阻断写入——安全步进：先观测，后续步骤再收紧语义）
   * <en/> Spread-conflict notification (probe only, never blocks the write — safe step: observe first, tighten semantics later)
   */
  onSpreadConflict?: (conflicts: SpreadConflict[], kind: CellEditCommitKind) => void
}

/**
 * <zh/> 统一提交入口的可选参数 | <en/> Options for the unified commit entry
 */
export interface CommitCellEditOptions {
  /** <zh/> row 提交的目标行索引——缺省取会话中的 editingRowIndex | <en/> Target row index for row commits — defaults to the session editingRowIndex */
  rowIndex?: number
  /** <zh/> 跳过 pendingStart 排队门控（startEditing 内部触发的提交必须跳过，否则循环等待） | <en/> Skip the pendingStart queue gate (commits triggered inside startEditing must skip it, or they deadlock) */
  skipPendingStartGate?: boolean
}

/**
 * <zh/> 内核门面返回 | <en/> Kernel-facade return
 */
export interface UseCellEditKernelReturn {
  /** <zh/> 统一提交入口——按 kind 分派到 cell / row 实现 | <en/> Unified commit entry — dispatches to the cell / row implementation by kind */
  commitCellEdit: (kind: CellEditCommitKind, reason?: CellEditStopReason, opts?: CommitCellEditOptions) => Promise<CommitResult>
  /** <zh/> 内部提交入口（按编辑模式推导 kind，兼容旧形状） | <en/> Internal commit entry (derives kind from edit mode, legacy-compatible shape) */
  commitEditingInternal: (reason?: CellEditStopReason, skipPendingStartGate?: boolean) => Promise<CommitResult>
  /** <zh/> 公共提交入口——保留 pendingStart 排队门控 | <en/> Public commit entry — keeps the pendingStart queue gate */
  commitEditing: (reason?: CellEditStopReason) => Promise<CommitResult>
}

/**
 * <zh/> 创建提交内核门面——共享前置守卫 + spread 冲突审计，下发到既有 cell / row 实现
 * <en/> Create the commit kernel facade — shared pre-flight guards + spread-conflict audit, dispatching to the existing cell / row implementations
 */
export function useCellEditKernel<T = any>(deps: UseCellEditKernelDeps<T>): UseCellEditKernelReturn {
  const {
    data,
    columns,
    session,
    isFullRowEdit,
    isColumnEditable,
    resolveStaleIndex,
    raceProtection,
  } = deps

  const { commitCellEditing } = useCellEditCommitCell<T>(deps)
  const { commitEditingAtRow } = useCellEditCommitRow<T>(deps)

  /**
   * <zh/> 空结果工厂——每次返回新对象，避免调用方持有共享引用后意外互串
   * <en/> Empty-result factory — returns a fresh object every time so callers never share a reference
   */
  function emptyResult(): CommitResult {
    return { applied: [], rejected: [] }
  }

  /**
   * <zh/> spread 冲突审计（仅探测，不阻断）——门控等待期间数据引用未变时 provably 无冲突，直接跳过；
   * <zh/> 否则按 kind 收集待写字段并与基线快照比对，命中时经回调 + dev 警告上报。
   * <en/> Spread-conflict audit (probe only, never blocks) — skips when the data reference survived
   * <en/> the gate await (provably conflict-free); otherwise diffs pending props against the baseline
   * <en/> and reports hits via callback + dev warning.
   */
  function auditSpreadConflicts(kind: CellEditCommitKind, baseline: CommitBaseline<T>, baselineRow: Record<string, unknown> | null, commitId?: number): void {
    if (data.value === baseline.dataRef || !baselineRow)
      return
    let currentRow: T | undefined
    let pendingProps: string[] = []
    if (kind === 'row') {
      const idx = session.editingRowIndex.value
      if (idx == null)
        return
      currentRow = data.value[idx]
      if (!currentRow)
        return
      pendingProps = collectFullRowPendingChanges({ row: currentRow, rowIndex: idx, columns: columns.value, editingValues: session.editingValues.value, isColumnEditable })
        .map(p => p.prop)
        .filter((p): p is string => p != null)
    }
    else {
      const cell = session.editingCell.value
      if (!cell)
        return
      currentRow = data.value[cell.rowIndex]
      if (!currentRow)
        return
      pendingProps = [cell.prop]
    }
    const conflicts = detectSpreadConflicts({
      baselineRow,
      currentRow: currentRow as unknown as Record<string, unknown>,
      pendingProps,
    })
    if (conflicts.length === 0)
      return
    deps.onSpreadConflict?.(conflicts, kind)
    if (isDev) {
      devWarn(
        `提交 #${commitId ?? '-'} 检测到 ${conflicts.length} 个 spread 冲突（${kind}）：门控等待期间并发写入修改了待写字段（${conflicts.map(c => c.prop).join(', ')}），本次提交以 last-writer-wins 落库。`,
        `Detected ${conflicts.length} spread conflict(s) during ${kind} commit #${commitId ?? '-'}: concurrent writes touched pending props (${conflicts.map(c => c.prop).join(', ')}) across the gate await; this commit lands last-writer-wins.`,
      )
    }
  }

  /**
   * <zh/> 统一提交入口——共享守卫 fail-fast 后按 kind 下发（顺序：基线 → 门控 → 卸载/epoch/长度 → 会话/行/索引 → 审计 → 下发）。
   * <en/> Unified commit entry — fail-fasts through shared guards then dispatches by kind (baseline → gate → unmount/epoch/length → session/row/index → audit → dispatch).
   */
  async function commitCellEdit(
    kind: CellEditCommitKind,
    reason: CellEditStopReason = 'api',
    opts: CommitCellEditOptions = {},
  ): Promise<CommitResult> {
    // <zh/> 提交序列号——仅供 dev 日志串联守卫/审计/下发，生产零行为差异
    // <en/> Commit sequence — dev logs only to correlate guards/audit/dispatch, zero prod behavior delta
    const commitId = ++commitSeq
    // <zh/> 门控等待前捕获基线——等待期间的 start/cancel（epoch）与原地增删（长度）在此被观测
    // <en/> Capture the baseline before the gate await — starts/cancels (epoch) and in-place splices (length) during the wait are observed here
    const baseline = captureCommitBaseline(data.value, raceProtection.version)

    // <zh/> 基线行快照（尽力而为）——仅供 spread 审计，不参与写入
    // <en/> Baseline row snapshot (best effort) — feeds the spread audit only, never participates in writes
    const preIndex = kind === 'row'
      ? (opts.rowIndex ?? session.editingRowIndex.value)
      : session.editingCell.value?.rowIndex ?? null
    const preRow = preIndex == null ? undefined : data.value[preIndex]
    const baselineRow = preRow ? { ...(preRow as unknown as Record<string, unknown>) } : null

    // <zh/> 与 prepareStartEditing 等待 pendingCommit 对称；startEditing 内部触发的提交必须跳过该门控，否则循环等待。
    // <en/> Symmetric with prepareStartEditing awaiting pendingCommit; commits from inside startEditing MUST skip this gate or they deadlock.
    if (!opts.skipPendingStartGate && raceProtection.pendingStart)
      await raceProtection.pendingStart

    // <zh/> 共享守卫 fail-fast——门控等待期间会话已过期时返回空结果，不触碰会话状态
    // <en/> Shared guards, fail-fast — session expired across the gate await: return empty without touching session state
    const staleReason = checkCommitBaselineFresh(baseline, data.value, raceProtection.version, raceProtection.unmounted)
    if (staleReason) {
      if (isDev) {
        devWarn(
          `提交 #${commitId}（${kind}/${reason}）被共享守卫丢弃：${staleReason}。`,
          `Commit #${commitId} (${kind}/${reason}) dropped by shared guard: ${staleReason}.`,
        )
      }
      return emptyResult()
    }

    if (kind === 'row') {
      const rowIndex = opts.rowIndex ?? session.editingRowIndex.value
      if (rowIndex == null)
        return emptyResult()

      const currentData = data.value
      const row = currentData[rowIndex]
      if (!row) {
        session.cancelDueToRowDeleted()
        return emptyResult()
      }

      const actualIndex = resolveStaleIndex(currentData, rowIndex)
      if (actualIndex === -1) {
        session.cancelDueToRowDeleted()
        return emptyResult()
      }
      auditSpreadConflicts(kind, baseline, baselineRow, commitId)
      return commitEditingAtRow(actualIndex, reason)
    }
    auditSpreadConflicts(kind, baseline, baselineRow, commitId)
    return commitCellEditing(reason)
  }

  /**
   * <zh/> 内部提交入口——按编辑模式推导 kind（与旧 commit.ts 分派语义一致）
   * <en/> Internal commit entry — derives kind from the edit mode (same dispatch semantics as the legacy commit.ts)
   */
  function commitEditingInternal(
    reason: CellEditStopReason = 'api',
    skipPendingStartGate = false,
  ): Promise<CommitResult> {
    return commitCellEdit(isFullRowEdit.value ? 'row' : 'cell', reason, { skipPendingStartGate })
  }

  /**
   * <zh/> 公共提交入口——保留 pendingStart 排队门控
   * <en/> Public commit entry — keeps the pendingStart queue gate
   */
  function commitEditing(reason: CellEditStopReason = 'api'): Promise<CommitResult> {
    return commitEditingInternal(reason)
  }

  return { commitCellEdit, commitEditingInternal, commitEditing }
}

/** <zh/> useCellEditKernel 返回形状（供类型复用） | <en/> useCellEditKernel return shape (for type reuse) */
export type CellEditKernel = ReturnType<typeof useCellEditKernel>
