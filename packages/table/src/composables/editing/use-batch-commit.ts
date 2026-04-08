/**
 * <zh/> 批量提交 composable
 * <en/> Batch commit composable
 *
 * @remarks
 * <zh/> 职责单一：一次性写入多个单元格变更，仅触发一次 onDataUpdate。适用于粘贴等需要批量写入的场景。
 * <zh/> 所有提交路径（batchCommitCells / saveCells）共享同一 resolve→validate→write 内核，
 * <zh/> 差异仅在于终结时机：batchCommitCells 立即发事件压撤销栈；saveCells 在持久化确认后才终结，
 * <zh/> 失败则还原快照并派发 TABLE_EDIT_ROLLBACK——避免两套平行实现漂移。
 * <en/> Single responsibility: writes multiple cell changes at once, triggering onDataUpdate only once.
 * <en/> All commit paths (batchCommitCells / saveCells) share one resolve→validate→write kernel;
 * <en/> they differ only in finalization timing: batchCommitCells emits events and pushes undo
 * <en/> immediately, while saveCells finalizes only after persistence confirms — on failure it
 * <en/> reverts the applied cells and dispatches TABLE_EDIT_ROLLBACK — preventing parallel-implementation drift.
 */
import type { ComputedRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellChangeRecord, CellEditEvent, CellEditStopReason, CommitRejectedRecord, CommitResult, EditPersistPayload } from '../../types/edit'
import type { InterceptorEditCommitParams } from '../../types/interceptor'
import type { ApplyChangeResult } from '../editing/use-cell-edit-apply'
import type { EditUndoEntry } from '../editing/use-edit-undo'
import type { UseInterceptorReturn } from '../editing/use-interceptor'
import { VALIDATE_BATCH_SIZE } from '../../constants'
import { findColumnByKey } from '../../utils/column-tree'
import { parseCellEditValue } from '../../utils/edit-helpers'
import { shallowEqual } from '../../utils/equality'
import { buildKeyToIndexMap } from '../../utils/shared'

export interface UseBatchCommitDeps<T = any> {
  data: ComputedRef<T[]>
  columns: ComputedRef<ProcessedColumn[]>
  interceptor?: UseInterceptorReturn
  validateFn?: (params: {
    mode: 'cell' | 'row'
    rowIndex: number
    columnKey: string
    value: any
    values?: Record<string, any>
  }) => Promise<boolean>
  applyChange: (params: {
    row: T
    rowIndex: number
    prop: string
    column: ProcessedColumn
    oldValue: any
    newValue: any
    reason: CellEditStopReason
  }) => ApplyChangeResult
  clearDirtyCell: (rowIndex: number, columnKey: string) => void
  pushUndo?: (entry: EditUndoEntry) => void
  rowKey: ComputedRef<((row: T) => string) | null>
  onCellValueChanged?: (event: CellEditEvent<T>) => void
  onEditCancelled?: (payload: { reason: 'row-deleted' | 'data-changed' }) => void
  /**
   * <zh/> saveCells 悲观协议落库失败回调——编排器接 tableEmit('error', TABLE_EDIT_ROLLBACK) |
   * <en/> saveCells pessimistic failure callback — the orchestrator wires it to tableEmit('error', TABLE_EDIT_ROLLBACK)
   */
  onRollback?: (info: { cause: unknown }) => void
  isUnmounted: () => boolean
  onDataUpdate: (newData: T[]) => void
  /**
   * <zh/> 编辑配置（提供 saveCells 的 onPersist 兜底钩子）。缺省时退化为"调用级 persist only"。
   * <en/> Edit config (supplies the onPersist fallback for saveCells). Without it, only the per-call persist applies.
   */
  editConfig?: ComputedRef<{ onPersist?: (payload: EditPersistPayload<T>) => Promise<void> | void | boolean } | undefined>
}

export interface UseBatchCommitReturn {
  /**
   * <zh/> 返回 CommitResult 使调用方可感知部分成功；支持可选 rowKey 以在分页/排序后稳定定位 | <en/> Returns CommitResult so callers can perceive partial success; optional rowKey stabilizes location after pagination/sort
   * <zh/> 裸 rowIndex 按调用时刻的当前数据解析：排序/分页后请传 rowKey 或改用 batchCommitByKey | <en/> Bare rowIndex resolves against the current data at call time (not a previously seen array): pass rowKey or use batchCommitByKey after sort/pagination
   */
  batchCommitCells: (cells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any, rowKey?: string | number }>, reason?: CellEditStopReason) => Promise<CommitResult>
  /** <zh/> 按 rowKey 提交——分页/排序后稳定，推荐新代码使用 | <en/> Commit by rowKey — stable after pagination/sort, recommended for new code */
  batchCommitByKey: (cells: Array<{ rowKey: string | number, prop: string, columnKey: string, value: any }>, reason?: CellEditStopReason) => Promise<CommitResult>
  /**
   * <zh/> 共享内核——saveCells 以 persist 参数复用；公开仅为包内组合需要；支持可选 rowKey |
   * <en/> Shared kernel — reused by saveCells via its persist parameter; exposed only for intra-package composition; supports optional rowKey
   */
  commitCellsKernel: (cells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any, rowKey?: string | number }>, reason?: CellEditStopReason, opts?: { persist?: (payload: EditPersistPayload) => Promise<void> | void | boolean }) => Promise<CommitResult>
  /**
   * <zh/> 悲观保存——批量写入并等待宿主持久化确认，失败自动回滚。
   * <zh/> 原为 `use-cell-edit-persist.ts` 的薄包装（22 行无自有状态），已内聚到此处：
   * <zh/> 与 batch-commit 内核同文件，避免"批量写入有两个入口文件"的导航成本。
   *
   * <en/> Pessimistic save — batch-writes cells and awaits host persistence confirmation, reverting on failure.
   * <en/> Previously a 22-line stateless wrapper in `use-cell-edit-persist.ts`, now colocated here so
   * <en/> batch writes no longer span two entry files.
   *
   * @remarks
   * <zh/> 快照 → 本地应用变更（UI 立即生效）→ await 持久化钩子：
   * <zh/> - 成功：变更入撤销栈，返回 { applied }
   * <zh/> - 失败（钩子 reject 或 resolve(false)）：自动还原快照 + onRollback 通知，
   * <zh/>   变更计入 rejected（reason:'persist-failed'），不入撤销栈。
   * <zh/> 持久化钩子优先级：调用级 options.persist > editConfig.onPersist > 无（退化为乐观直通）。
   * <en/> snapshot → apply locally (UI updates immediately) → await the persist hook:
   * <en/> - Success: changes enter the undo stack, returns { applied }.
   * <en/> - Failure (hook rejects or resolves false): auto-restores the snapshot, fires onRollback,
   * <en/>   counts changes into rejected (reason:'persist-failed'), and never enters the undo stack.
   * <en/> Hook priority: per-call options.persist > editConfig.onPersist > none (degrades to optimistic passthrough).
   */
  saveCells: (cells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any }>, options?: { persist?: (payload: EditPersistPayload) => Promise<void> | void | boolean }) => Promise<CommitResult>
}

/** <zh/> 内部应用记录——在 CellChangeRecord 上补充列引用与行键定位信息 | <en/> Internal applied record — extends CellChangeRecord with column ref for emit loop */
interface AppliedRecord extends CellChangeRecord {
  column: ProcessedColumn
  rowIndexAtCommit: number
}

function toRejected(record: CellChangeRecord, reason: CommitRejectedRecord['reason']): CommitRejectedRecord {
  return { ...record, reason }
}

/**
 * <zh/> 创建值流转批量提交管线
 * <en/> Create the batch-commit pipeline
 */
export function useBatchCommit<T = any>(deps: UseBatchCommitDeps<T>): UseBatchCommitReturn {
  const {
    data,
    columns,
    interceptor,
    validateFn,
    applyChange,
    clearDirtyCell,
    pushUndo,
    rowKey,
    onCellValueChanged,
    onEditCancelled,
    onRollback,
    isUnmounted,
    onDataUpdate,
    editConfig,
  } = deps

  function rowKeyOf(rowIndex: number): string | number | undefined {
    const row = data.value[rowIndex]
    return row && rowKey.value ? rowKey.value(row) : undefined
  }

  /**
   * <zh/> 共享提交内核：
   * <zh/> Phase A 解析（定位列/行、解析新值、差集、拦截器裁决）
   * <zh/> Phase B 并行校验（needsValidation 的单元格）
   * <zh/> Phase C 写入（applyChange 分发 + 直写合并为单次 onDataUpdate）
   * <zh/> 终结（emits + clearDirty + undo）——无 persist 时立即执行；
   * <zh/> 有 persist 时本地先行应用、待钩子确认后终结；失败还原快照派发回滚。
   *
   * <en/> Shared commit kernel:
   * <en/> Phase A resolve (locate column/row, parse new values, diff, interceptor ruling)
   * <en/> Phase B parallel validation (cells with editorRules)
   * <en/> Phase C write (applyChange dispatch + direct writes merged into ONE onDataUpdate)
   * <en/> Finalize (emits + clearDirty + undo) — runs immediately without persist;
   * <en/> with persist, changes apply locally first and finalize awaits confirmation;
   * <en/> on failure the applied cells are reverted (per-cell, concurrent-write safe) and a rollback dispatched.
   */
  async function commitCellsKernel(
    cells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any, rowKey?: string | number }>,
    reason: CellEditStopReason = 'paste',
    opts: { persist?: (payload: EditPersistPayload<T>) => Promise<void> | void | boolean } = {},
  ): Promise<CommitResult> {
    if (cells.length === 0)
      return { applied: [], rejected: [] }

    /**
     * <zh/> Phase A 的数据快照——**仅在 await 之前有效**。
     * <zh/> Phase B（校验）是 await 点，之后必须改用 `snapshot = data.value` 重新定位，
     * <zh/> 命名显式表达其时间作用域，避免后续维护者误用。
     * <en/> Phase-A data snapshot — **valid only before the await**.
     * <en/> Phase B (validation) is an await point; afterwards re-location must use
     * <en/> `snapshot = data.value`. The name states its temporal scope explicitly so maintainers
     * <en/> do not reuse it past the await.
     */
    const phaseAData = data.value
    const rejected: CommitRejectedRecord[] = []

    // ── Phase A：解析 + 差集 + 拦截器裁决 ── Phase A: resolve + diff + interceptor ruling
    const committed: Array<{
      rowIndex: number
      prop: string
      columnKey: string
      column: ProcessedColumn
      oldValue: any
      newValue: any
      needsValidation?: boolean
      /**
       * <zh/> Phase A 捕获的行键——Phase B 是 await 点，期间数据可能被刷新/排序/分页替换，
       * <zh/> Phase C 必须用它在**最新**数组上重新定位，否则会把整批数据写回旧状态。
       * <en/> Row key captured in Phase A — Phase B is an await point during which data may be
       * <en/> refreshed / re-sorted / re-paginated, so Phase C MUST re-locate on the **latest** array
       * <en/> using it, otherwise the whole batch is written back as stale state.
       */
      rowKey?: string | number
    }> = []

    // <zh/> 支持 rowKey 直传——外部在分页/排序后可按 key 而非过期索引提交 | <en/> Supports direct rowKey — callers can submit by key instead of stale index after pagination/sort
    // <zh/> 统一走共享 buildKeyToIndexMap（String 归一 + 后赢语义与原手搓循环一致；rowKey 缺席即空表；空行由上游管线剔除）
    // <en/> unified via shared buildKeyToIndexMap (String normalization + last-wins match the hand-rolled loop; empty map when rowKey absent; null rows stripped upstream)
    const keyFnA = rowKey.value
    const phaseAKeyToIndex = keyFnA
      ? buildKeyToIndexMap(phaseAData as T[], row => keyFnA(row))
      : new Map<string, number>()
    for (const cell of cells) {
      const col = findColumnByKey(columns.value, cell.columnKey)
      if (!col)
        continue

      let rowIndex = cell.rowIndex
      const rowKeyVal: string | number | undefined = cell.rowKey
      if (rowKeyVal != null) {
        const idxByKey = phaseAKeyToIndex.get(String(rowKeyVal))
        if (idxByKey != null) {
          rowIndex = idxByKey
        }
      }
      const row = phaseAData[rowIndex]
      if (!row)
        continue

      // Note: dynamic prop access on generic row T
      const oldValue = (row as Record<string, unknown>)[cell.prop]
      const parsedNewValue = parseCellEditValue(col, {
        row,
        rowIndex,
        newValue: cell.value,
        oldValue,
      })

      if (shallowEqual(parsedNewValue, oldValue))
        continue

      if (interceptor) {
        const commitParams: InterceptorEditCommitParams<T> = {
          row,
          rowIndex,
          prop: cell.prop,
          column: col,
          oldValue,
          newValue: parsedNewValue,
          reason,
        }
        if (interceptor.trigger('edit.commit', commitParams)) {
          rejected.push(toRejected({
            rowIndex,
            prop: cell.prop,
            columnKey: cell.columnKey,
            oldValue,
            newValue: parsedNewValue,
            rowKey: rowKeyVal ?? rowKeyOf(rowIndex),
          }, 'interceptor'))
          continue
        }
      }

      committed.push({
        rowIndex,
        prop: cell.prop,
        columnKey: cell.columnKey,
        column: col,
        oldValue,
        newValue: parsedNewValue,
        needsValidation: validateFn != null && col.editorRules != null,
        rowKey: rowKeyVal ?? rowKeyOf(rowIndex),
      })
    }

    // ── Phase B：分批校验所有需要校验的单元格 ──
    // ── Phase B: validate all pending cells in batches
    if (validateFn) {
      const cellsToValidate = committed.filter(c => c.needsValidation)
      if (cellsToValidate.length > 0) {
        // <zh/> 预先快照长度——Phase A 无 await，phaseAData 与此处同值；
        // <zh/> 必须在 await 前取值，否则原地 splice 会同时改变 phaseAData.length 使比较恒成立。
        // <en/> Snapshot the length BEFORE the await — Phase A is synchronous so phaseAData
        // <en/> is still current here; reading it after the await would observe in-place
        // <en/> splices through the same reference and the comparison would never fire.
        const dataLengthBeforeValidate = phaseAData.length
        /**
         * <zh/> 分批并发而非一次性 Promise.all——粘贴 5000 行带 editorRules 时，
         * <zh/> 一次性并发会同时创建 5000 个 async-validator 实例并塞满微任务队列，
         * <zh/> 长时间阻塞主线程（UI 冻结）。与 useCellValidate.validateAll 共用同一批大小。
         * <en/> Batched concurrency instead of one giant Promise.all — pasting 5000 rows with
         * <en/> editorRules would create 5000 async-validator instances at once and flood the
         * <en/> microtask queue, blocking the main thread for a long time (UI freeze). Shares the
         * <en/> same batch size as useCellValidate.validateAll.
         */
        const results: boolean[] = []
        for (let i = 0; i < cellsToValidate.length; i += VALIDATE_BATCH_SIZE) {
          const batch = cellsToValidate.slice(i, i + VALIDATE_BATCH_SIZE)
          results.push(...await Promise.all(
            batch.map(c =>
              validateFn({
                mode: 'cell',
                rowIndex: c.rowIndex,
                columnKey: c.columnKey,
                value: c.newValue,
              }),
            ),
          ))
        }
        if (isUnmounted()) {
          // <zh/> 卸载时不静默丢弃已校验数据，通知宿主编辑被取消 | <en/> Don't silently discard validated data on unmount, notify host that edit was cancelled
          onEditCancelled?.({ reason: 'data-changed' })
          return { applied: [], rejected }
        }
        // <zh/> 防御性兜底：同引用原地增删不在支持范围内——数据更新必须换引用。
        // <zh/> 数据在异步校验期间被整体替换（刷新/排序/分页）或原地增删——校验结论基于 Phase A 旧位置，
        // <zh/> 继续写入会把值落到错误的行（同 key 不同内容）或覆盖后到变更，整批丢弃并通知。
        // <zh/> 与 unmount 分支同协议：空结果 + onEditCancelled，调用方按"取消"而非"成功"处理。
        // <en/> Data was wholesale replaced (refresh/sort/pagination) or spliced in place during
        // <en/> async validation — verdicts were computed against Phase-A positions, so writing on
        // <en/> would land values on wrong rows or clobber later changes. Abort the batch and notify.
        // <en/> Same protocol as the unmount branch: empty result + onEditCancelled.
        if (data.value !== phaseAData || data.value.length !== dataLengthBeforeValidate) {
          onEditCancelled?.({ reason: 'data-changed' })
          return { applied: [], rejected }
        }
        // 使用 rowIndex:columnKey 字符串键作为唯一标识 | Use rowIndex:columnKey string key as unique identifier
        const invalidKeys = new Set<string>()
        for (let i = 0; i < results.length; i++) {
          if (!results[i])
            invalidKeys.add(`${cellsToValidate[i]!.rowIndex}:${cellsToValidate[i]!.columnKey}`)
        }
        // 移除校验失败的单元格并计入 rejected | Remove cells failing validation and count them as rejected
        for (let i = committed.length - 1; i >= 0; i--) {
          if (committed[i]!.needsValidation && invalidKeys.has(`${committed[i]!.rowIndex}:${committed[i]!.columnKey}`)) {
            const c = committed[i]!
            rejected.push(toRejected({
              rowIndex: c.rowIndex,
              prop: c.prop,
              columnKey: c.columnKey,
              oldValue: c.oldValue,
              newValue: c.newValue,
              rowKey: rowKeyOf(c.rowIndex),
            }, 'validation'))
            committed.splice(i, 1)
          }
        }
      }
    }

    if (committed.length === 0)
      return { applied: [], rejected }

    // ── Phase C：写入——applyChange 分发；直写合并为单次 onDataUpdate ──
    // ── Phase C: write — applyChange dispatch; direct writes merged into ONE onDataUpdate
    const snapshot = data.value
    const applied: AppliedRecord[] = []
    const undoEntries: EditUndoEntry[] = []
    const directUpdates = new Map<number, Map<string, any>>()

    /**
     * <zh/> Phase B 是 await 点——期间数据可能已被刷新/排序/分页整体替换。
     * <zh/> 若沿用 Phase A 捕获的 `phaseAData`（旧数组）与旧索引，Phase C 会把
     * <zh/> `[...phaseAData]` 整体写回，静默覆盖后到的全部变更（数据丢失级缺陷）。
     * <zh/> 此处在**最新**数组上用 rowKey 重新定位每一行；无 rowKey 时退化为原索引。
     * <en/> Phase B is an await point — data may have been wholly refreshed / re-sorted /
     * <en/> re-paginated during it. Reusing the Phase-A `phaseAData` (stale array) and stale
     * <en/> indices would make Phase C write `[...phaseAData]` back wholesale, silently
     * <en/> overwriting every later change (data-loss-class defect). Here each row is re-located
     * <en/> on the **latest** array by rowKey, falling back to the original index when absent.
     */
    // <zh/> 同上统一走共享工具 | <en/> same shared-util unification as above
    const keyFnC = rowKey.value
    const freshKeyToIndex = keyFnC
      ? buildKeyToIndexMap(snapshot as T[], row => keyFnC(row))
      : new Map<string, number>()

    /** <zh/> 将 Phase A 索引解析为当前数组中的有效索引，找不到返回 -1 | <en/> Resolve a Phase-A index against the current array; -1 when not found */
    function resolveRowIndex(c: { rowIndex: number, rowKey?: string | number }): number {
      if (c.rowKey != null) {
        const idx = freshKeyToIndex.get(String(c.rowKey))
        return idx ?? -1
      }
      return c.rowIndex
    }

    for (const c of committed) {
      const rowIndex = resolveRowIndex(c)
      if (rowIndex < 0)
        continue
      const row = snapshot[rowIndex]
      if (!row)
        continue

      const result = applyChange({
        row,
        rowIndex,
        prop: c.prop,
        column: c.column,
        oldValue: c.oldValue,
        newValue: c.newValue,
        reason,
      })
      if (!result.handled) {
        if (!directUpdates.has(rowIndex))
          directUpdates.set(rowIndex, new Map())
        directUpdates.get(rowIndex)!.set(c.prop, c.newValue)
      }
      /**
       * <zh/> 仅 setter 拒写计入 rejected——直写（unhandled）applied 恒为 false 但数据已在下方落库，
       * <zh/> 若误标会导致 emit/undo/clearDirty 全部静默跳过。
       * <en/> Only setter rejections count as rejected — direct writes (unhandled) carry applied:false
       * <en/> by definition yet their data IS written above; mis-marking them would silently skip
       * <en/> emit/undo/clearDirty entirely.
       */
      const setterRejected = result.status === 'setter' && !result.applied
      if (setterRejected) {
        rejected.push(toRejected({
          rowIndex,
          prop: c.prop,
          columnKey: c.columnKey,
          oldValue: c.oldValue,
          newValue: c.newValue,
          rowKey: c.rowKey ?? rowKeyOf(rowIndex),
        }, 'setter-rejected'))
        continue
      }
      applied.push({
        rowIndex,
        prop: c.prop,
        columnKey: c.columnKey,
        column: c.column,
        oldValue: c.oldValue,
        newValue: c.newValue,
        rowKey: c.rowKey ?? rowKeyOf(rowIndex),
        // <zh/> 保留 Phase A 的提交时索引，供调用方对照"提交位置 vs 当前位置" |
        // <en/> Keep the Phase-A commit-time index so callers can compare "commit position vs current position"
        rowIndexAtCommit: c.rowIndex,
      })
      undoEntries.push({
        type: 'cell',
        rowIndex,
        rowKey: c.rowKey ?? rowKeyOf(rowIndex),
        changes: [{ prop: c.prop, oldValue: c.oldValue, newValue: c.newValue }],
        timestamp: Date.now(),
      })
    }

    if (directUpdates.size > 0) {
      /**
       * <zh/> 基于**最新**数组克隆——`directUpdates` 的键已是重定位后的索引，与 `snapshot` 对齐，
       * <zh/> 保证 Phase B 期间到达的刷新/排序/分页结果不被覆盖。
       * <en/> Clone from the **latest** array — keys of `directUpdates` are already re-located
       * <en/> indices aligned with `snapshot`, so refresh / sort / pagination results arriving
       * <en/> during Phase B are never overwritten.
       */
      const newData = [...snapshot] as T[]
      for (const [rowIndex, propMap] of directUpdates) {
        newData[rowIndex] = { ...(newData[rowIndex] as Record<string, unknown>), ...Object.fromEntries(propMap) } as T
      }
      onDataUpdate(newData)
    }

    // ── 终结：事件 + 脏清理 + 撤销入栈 ── Finalize: events + dirty clearing + undo push
    const finalize = (): CommitResult => {
      for (const c of applied) {
        if (onCellValueChanged) {
          onCellValueChanged({
            row: data.value[c.rowIndex],
            rowIndex: c.rowIndex,
            prop: c.prop,
            column: c.column,
            oldValue: c.oldValue,
            newValue: c.newValue,
            reason,
          })
        }
        if (c.column?.onCellValueChanged) {
          c.column.onCellValueChanged({
            row: data.value[c.rowIndex],
            rowIndex: c.rowIndex,
            column: c.column,
            oldValue: c.oldValue,
            newValue: c.newValue,
          })
        }
        clearDirtyCell(c.rowIndex, c.columnKey)
      }
      for (const entry of undoEntries)
        pushUndo?.(entry)
      return { applied: applied.map(({ column: _col, rowIndexAtCommit: _idx, ...rec }) => rec), rejected }
    }

    // 无持久化钩子——立即终结（乐观默认）| No persist hook — finalize immediately (optimistic default, historical behavior)
    if (!opts.persist)
      return finalize()

    // ── 悲观协议：宿主确认后才终结；失败自动还原快照 ──
    // ── Pessimistic protocol: finalize only after host confirmation; auto-restore snapshot on failure
    try {
      const ok = await opts.persist({ changes: applied.map(({ column: _col, rowIndexAtCommit: _idx, ...rec }) => rec), newData: data.value })
      if (ok === false)
        throw new Error('[AdvTable] editConfig.onPersist resolved false')
    }
    catch (cause) {
      // <zh/> 逐格还原而非整表快照覆盖——await persist 期间其它并发落库的编辑
      // <zh/> （如用户继续编辑别格）会被整表还原一并吞掉。从当前数据出发，
      // <zh/> 按 rowKey 优先重定位（未配 rowKey 回退提交时索引），仅将被本批
      // <zh/> 应用的格还原为 oldValue，合并为单次 onDataUpdate。
      // <en/> Revert per cell instead of overwriting with the whole-table snapshot — a full
      // <en/> snapshot restore also swallows concurrent writes landed while awaiting persist
      // <en/> (e.g. the user editing other cells). Starting from the CURRENT data, re-locate
      // <en/> each applied cell by rowKey (falling back to its commit-time index when rowKey is
      // <en/> unconfigured), restore only this batch's cells to their oldValues, merged into ONE
      // <en/> onDataUpdate.
      const current = data.value
      const next = [...current] as T[]
      const keptByConcurrentWrite: CommitRejectedRecord[] = []
      for (const rec of applied) {
        let idx = -1
        if (rec.rowKey != null && rowKey.value)
          idx = next.findIndex(row => rowKey.value!(row) === rec.rowKey)
        if (idx < 0 && rec.rowKey == null && rec.rowIndex >= 0 && rec.rowIndex < next.length)
          idx = rec.rowIndex
        if (idx < 0)
          continue
        /**
         * <zh/> 并发写防护：await persist 期间同格若已被并发落库覆盖（当前值已不是本次 newValue），
         * <zh/> 则保留用户新值不还原，并计入 rejected（reason:'concurrent-write'），避免旧快照吞掉新值。
         * <en/> Concurrent-write guard: if the cell was overwritten while awaiting persist
         * <en/> (current value no longer equals this batch's newValue), keep the user's newer
         * <en/> value instead of restoring the stale snapshot, and report it as rejected
         * <en/> (reason:'concurrent-write').
         */
        const currentValue = (next[idx] as Record<string, unknown>)[rec.prop]
        if (!shallowEqual(currentValue, rec.newValue)) {
          const { column: _col, rowIndexAtCommit: _idx, ...rest } = rec
          keptByConcurrentWrite.push(toRejected(rest, 'concurrent-write'))
          continue
        }
        next[idx] = { ...(next[idx] as Record<string, unknown>), [rec.prop]: rec.oldValue } as T
      }
      onDataUpdate(next)
      onRollback?.({ cause })
      return {
        applied: [],
        rejected: [
          ...rejected,
          ...keptByConcurrentWrite,
          ...applied
            .filter(rec => !keptByConcurrentWrite.some(k => k.rowKey === rec.rowKey && k.prop === rec.prop && k.rowIndex === rec.rowIndex))
            .map(({ column: _col, rowIndexAtCommit: _idx, ...rec }) => toRejected(rec, 'persist-failed')),
        ],
      }
    }
    return finalize()
  }

  async function batchCommitCells(
    cells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any, rowKey?: string | number }>,
    reason: CellEditStopReason = 'paste',
  ): Promise<CommitResult> {
    return commitCellsKernel(cells, reason)
  }

  async function batchCommitByKey(
    cells: Array<{ rowKey: string | number, prop: string, columnKey: string, value: any }>,
    reason: CellEditStopReason = 'paste',
  ): Promise<CommitResult> {
    // <zh/> 按 key 直传，rowIndex 置 -1 由内核经 phaseAKeyToIndex 重定位 | <en/> Direct by key, rowIndex -1 re-located via phaseAKeyToIndex in kernel
    const mapped = cells.map(c => ({ rowIndex: -1, ...c }))
    return commitCellsKernel(mapped as unknown as { rowIndex: number, prop: string, columnKey: string, value: any, rowKey?: string | number }[], reason)
  }

  /**
   * <zh/> 悲观保存——批量写入并等待宿主持久化确认，失败自动回滚。
   * <zh/> 快照 → 本地应用（UI 立即生效）→ await 持久化钩子：
   * <zh/> 成功→入撤销栈返回 applied；失败（reject 或 resolve(false)）→ 还原快照 + onRollback +
   * <zh/> 计入 rejected('persist-failed')，不入撤销栈。
   * <zh/> 钩子优先级：调用级 options.persist > editConfig.onPersist > 无（乐观直通）。
   *
   * <en/> Pessimistic save — batch-writes cells and awaits host persistence confirmation:
   * <en/> snapshot → apply locally (UI updates immediately) → await the persist hook.
   * <en/> Success enters the undo stack; failure (reject or resolve false) restores the snapshot,
   * <en/> fires onRollback and counts changes into rejected('persist-failed').
   * <en/> Hook priority: per-call options.persist > editConfig.onPersist > none (optimistic passthrough).
   */
  async function saveCells(
    cells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any }>,
    options?: { persist?: (payload: EditPersistPayload) => Promise<void> | void | boolean },
  ): Promise<CommitResult> {
    const persist = options?.persist ?? editConfig?.value?.onPersist
    return commitCellsKernel(cells, 'api', persist ? { persist } : {})
  }

  return {
    batchCommitCells,
    batchCommitByKey,
    commitCellsKernel,
    saveCells,
  }
}
