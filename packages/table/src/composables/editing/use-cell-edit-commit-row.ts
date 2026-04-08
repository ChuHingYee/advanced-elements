/**
 * <zh/> 整行提交 composable
 * <en/> Full-row commit composable
 *
 * @remarks
 * <zh/> 提交相位的两条路径之一：把「整行编辑缓冲」结算为逐列 CommitResult。
 * <zh/> 相位顺序：行级校验 → 解析 + 差集（零写入）→ 拦截器裁决（整行原子性）→ 写入 → 发射。
 * <zh/> 单格路径见 `use-cell-edit-commit-cell.ts`，模式分派见 `use-cell-edit-commit.ts`。
 * <en/> One of the two commit paths: settles the full-row edit buffer into per-column CommitResult
 * <en/> records. Phase order: row validation → parse + diff (zero writes) → interceptor ruling
 * <en/> (full-row atomicity) → write → emit. The single-cell path lives in
 * <en/> `use-cell-edit-commit-cell.ts`; mode dispatch in `use-cell-edit-commit.ts`.
 *
 * <zh/> 模块级纯函数 `collectFullRowPendingChanges` / `runFullRowCommitInterceptor`
 * <zh/> 原为 `commitEditingAtRow` 的内嵌闭包，提取后可独立单测
 * <zh/>（见 `__tests__/composables/use-cell-edit-commit-pure.test.ts`）。
 * <en/> The module-level pure functions `collectFullRowPendingChanges` / `runFullRowCommitInterceptor`
 * <en/> were inlined closures of `commitEditingAtRow`; extracting them makes them unit-testable
 * <en/> (see `__tests__/composables/use-cell-edit-commit-pure.test.ts`).
 */
import type { ComputedRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type {
  CellChangeRecord,
  CellEditStopReason,
  CommitRejectedRecord,
  CommitResult,
  FullRowEditEvent,
} from '../../types/edit'
import type { InterceptorEditCommitParams } from '../../types/interceptor'
import type { EditRaceProtection } from '../../utils/edit-race-protection'
import type { UseCellEditApplyReturn } from './use-cell-edit-apply'
import type { CellEditEvents } from './use-cell-edit-events'
import type { CellEditSession } from './use-cell-edit-session'
import type { CellEditValidation } from './use-cell-edit-validation'
import type { UseEditDirtyReturn } from './use-edit-dirty'
import type { EditUndoEntry } from './use-edit-undo'
import type { UseInterceptorReturn } from './use-interceptor'
import { flattenLeafColumns } from '../../utils/column-tree'
import { parseCellEditValue, replaceRowInArray } from '../../utils/edit-helpers'
import { shallowEqual } from '../../utils/equality'
import { getColumnKey } from '../../utils/shared'
import { resolveCellValue } from '../../utils/value-pipeline'

/** <zh/> 构造拒绝记录的统一出口 | <en/> Uniform constructor for rejected records */
function toRejectedRecord(record: Omit<CommitRejectedRecord, 'reason'>, reason: CommitRejectedRecord['reason']): CommitRejectedRecord {
  return { ...record, reason }
}

/** <zh/> 整行编辑的挂起变更项——解析 + 差集后的中间产物，尚未写入 | <en/> Pending change of a full-row edit — the parsed + diffed intermediate, not yet written */
export interface FullRowPendingChange {
  /** <zh/> 目标列 | <en/> Target column */
  col: ProcessedColumn
  /** <zh/> 目标字段（无 prop 的列可为 null） | <en/> Target prop (null for columns without prop) */
  prop: string | null
  /** <zh/> 变更前的值 | <en/> Value before the change */
  oldVal: unknown
  /** <zh/> 解析后的新值 | <en/> Parsed new value */
  parsedNewVal: unknown
}

/**
 * <zh/> 相位一（模块级纯函数）：解析 + 差集——对全部可编辑列求值变更集，零写入。
 * <en/> Phase 1 (module-level pure function): parse + diff — evaluates the change set across all
 * <en/> editable columns with zero writes.
 *
 * @remarks
 * <zh/> 原为 `commitEditingAtRow` 的内嵌闭包；提取后不捕获任何组件状态，全部依赖经参数注入。
 * <zh/> 返回值仅为变更集——被拒记录数组由调用方自行创建并累积（setter 拒写），
 * <zh/> 使本函数保持"零副作用、可单测"的纯度。
 * <en/> Formerly an inlined closure of `commitEditingAtRow`; it now captures nothing and takes all
 * <en/> dependencies as parameters. It returns ONLY the change set — the rejected-record array is
 * <en/> created by the caller (which accumulates setter rejections into it), keeping this function
 * <en/> side-effect free and testable.
 *
 * @param params - <zh/> 求值上下文 | <en/> evaluation context
 * @param params.row - <zh/> 目标行 | <en/> target row
 * @param params.rowIndex - <zh/> 目标行索引 | <en/> target row index
 * @param params.columns - <zh/> 列配置 | <en/> column configs
 * @param params.editingValues - <zh/> 整行编辑缓冲值（列 key → 值） | <en/> full-row edit buffer (column key → value)
 * @param params.isColumnEditable - <zh/> 列可编辑判定 | <en/> column-editable predicate
 * @returns <zh/> 有实际变化的列集合（解析后新值与旧值不浅等） | <en/> columns with a real change (parsed value not shallow-equal to the old one)
 */
export function collectFullRowPendingChanges<T = any>(params: {
  row: T
  rowIndex: number
  columns: readonly ProcessedColumn[]
  editingValues: Record<string, any>
  isColumnEditable: (col: ProcessedColumn) => boolean
}): FullRowPendingChange[] {
  const { row, rowIndex, columns, editingValues, isColumnEditable } = params
  const pendingChanges: FullRowPendingChange[] = []
  // 展平分组列树：组头无 prop，顶层遍历会遗漏子列——与渲染器叶子序同源（flattenLeafColumns 单一实现）
  // Flatten the group column tree: group headers carry no prop, so a top-level pass would miss children — same leaf order as the renderer (single flattenLeafColumns implementation)
  const leafCols = flattenLeafColumns(columns)
  for (const col of leafCols) {
    // valueGetter-only 且无 prop/valueSetter 的列不可持久化：纳入 pending 会形成“已应用”假成功
    if (!isColumnEditable(col) || (col.prop == null && !(col as unknown as { valueSetter?: unknown }).valueSetter))
      continue
    const cKey = getColumnKey(col)
    if (!(cKey in editingValues))
      continue
    const rawNewVal = editingValues[cKey]
    const oldVal = resolveCellValue(row, col, rowIndex)

    const parsedNewVal = parseCellEditValue(col, {
      row,
      rowIndex,
      newValue: rawNewVal,
      oldValue: oldVal,
    })

    if (!shallowEqual(parsedNewVal, oldVal)) {
      pendingChanges.push({
        col,
        prop: col.prop as string | null,
        oldVal,
        parsedNewVal,
      })
    }
  }
  return pendingChanges
}

/**
 * <zh/> 相位二（模块级纯函数）：拦截器裁决——零写入前提下进行；任一变更被拒即整体取消（整行原子性），
 * <zh/> 被拒变更逐条计入 rejected。全部放行时返回 null。
 * <en/> Phase 2 (module-level pure function): interceptor ruling — performed with zero writes; any
 * <en/> veto cancels the whole edit (full-row atomicity) and each vetoed change is recorded.
 * <en/> Returns null when every change passes.
 *
 * @remarks
 * <zh/> 原为 `commitEditingAtRow` 的内嵌闭包；依赖全部经参数注入，可独立单测。
 * <zh/> 注意：本函数会调用 `interceptor.trigger`——拦截器的副作用由调用方承担，
 * <zh/> 但本函数自身不写入任何数据，符合"裁决相位"的语义。
 * <en/> Formerly an inlined closure of `commitEditingAtRow`; all dependencies are injected, making
 * <en/> it independently testable. NOTE: it invokes `interceptor.trigger` — the interceptor's side
 * <en/> effects belong to the caller, but this function writes no data itself, honoring the
 * <en/> "ruling phase" semantics.
 */
export function runFullRowCommitInterceptor<T = any>(params: {
  /** <zh/> 目标行索引 | <en/> target row index */
  rowIndex: number
  /** <zh/> 提交原因 | <en/> commit reason */
  reason: CellEditStopReason
  /** <zh/> 目标行 | <en/> target row */
  row: T
  /** <zh/> 相位一产出的变更集 | <en/> change set produced by phase 1 */
  pendingChanges: readonly FullRowPendingChange[]
  /** <zh/> 拦截器（缺省即放行） | <en/> interceptor (absent means pass-through) */
  interceptor?: UseInterceptorReturn
  /** <zh/> 当前编辑行键（拒绝记录用） | <en/> Key of the row being edited (for rejection records) */
  rowKey?: string | null
}): CommitRejectedRecord[] | null {
  const { rowIndex, reason, row, pendingChanges, interceptor, rowKey } = params
  if (pendingChanges.length === 0 || !interceptor)
    return null

  const rejectedRecords: CommitRejectedRecord[] = []
  let vetoed = false
  for (const change of pendingChanges) {
    const commitParams: InterceptorEditCommitParams<T> = {
      row,
      rowIndex,
      prop: change.prop as string,
      column: change.col,
      oldValue: change.oldVal,
      newValue: change.parsedNewVal,
      reason,
    }
    if (interceptor.trigger('edit.commit', commitParams)) {
      rejectedRecords.push(toRejectedRecord({
        rowIndex,
        prop: change.prop as string,
        columnKey: getColumnKey(change.col),
        oldValue: change.oldVal,
        newValue: change.parsedNewVal,
        rowKey: rowKey ?? undefined,
      }, 'interceptor'))
      vetoed = true
    }
  }
  return vetoed ? rejectedRecords : null
}

/** <zh/> 整行提交依赖 | <en/> Full-row commit deps */
export interface UseCellEditCommitRowDeps<T = any> {
  /** <zh/> 可见数据 | <en/> Visible data */
  data: ComputedRef<T[]>
  /** <zh/> 列配置 | <en/> Column configs */
  columns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 会话状态 | <en/> Session state */
  session: CellEditSession<T>
  /** <zh/> 是否只读编辑（仅通知宿主） | <en/> Whether read-only editing (notify host only) */
  isReadOnlyEdit: ComputedRef<boolean>
  /** <zh/> 是否批量编辑（挂起暂存） | <en/> Whether batch editing (staged) */
  isBatchEdit: ComputedRef<boolean>
  /** <zh/> 列可编辑判定 | <en/> Column-editable predicate */
  isColumnEditable: (col: ProcessedColumn) => boolean
  /** <zh/> 校验相位 | <en/> Validation phase */
  validation: CellEditValidation<T>
  /** <zh/> 事件发射相位 | <en/> Event-emit phase */
  events: Pick<CellEditEvents<T>, 'emitCellValueChanged' | 'emitRowCellsStopped'>
  /** <zh/> 值流转管线 | <en/> Value pipeline */
  apply: UseCellEditApplyReturn<T>
  /** <zh/> 脏标记追踪 | <en/> Dirty tracking */
  dirty: Pick<UseEditDirtyReturn, 'clearDirtyCell'>
  /** <zh/> 取消会话（拦截器裁决为拒时） | <en/> Cancel the session (on an interceptor veto) */
  cancelEditing: (reason: CellEditStopReason) => void
  /**
   * <zh/> 索引过期重定位（与单格路径同源；校验 await 后的二次定位用，缺省时跳过重定位） | <en/> Stale-index relocation (same source as the cell path; post-validation-await relocation, skipped when absent)
   */
  resolveStaleIndex?: (currentData: T[], currentIndex: number) => number
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
    values?: Record<string, any>
    rowData?: unknown
  }) => Promise<boolean>
  /** <zh/> 数据更新回调 | <en/> Data update callback */
  onDataUpdate: (newData: T[], source?: 'full' | 'view-slice') => void
  /** <zh/> 整行编辑变更回调 | <en/> Full-row edit changed callback */
  onFullRowEditChanged?: (event: FullRowEditEvent<T>) => void
  /** <zh/> 撤销栈入栈 | <en/> Undo stack push */
  pushUndo?: (entry: EditUndoEntry) => void
}

/** <zh/> 整行提交返回 | <en/> Full-row commit return */
export interface UseCellEditCommitRowReturn {
  /** <zh/> 在指定行索引结算整行编辑 | <en/> settle a full-row edit at the given row index */
  commitEditingAtRow: (rowIndex: number, reason: CellEditStopReason) => Promise<CommitResult>
}

/**
 * <zh/> 创建整行提交路径
 * <en/> Create the full-row commit path
 */
export function useCellEditCommitRow<T = any>(deps: UseCellEditCommitRowDeps<T>): UseCellEditCommitRowReturn {
  const {
    data,
    columns,
    session,
    isReadOnlyEdit,
    isBatchEdit,
    isColumnEditable,
    validation,
    events,
    apply,
    dirty,
    cancelEditing,
    raceProtection,
    resolveStaleIndex,
    interceptor,
    validateFn,
    onDataUpdate,
    onFullRowEditChanged,
    pushUndo,
  } = deps

  const {
    editingValues,
    editingRowKey,
    resetEditingState,
    cancelDueToDataChanged,
  } = session
  const { handleValidationFailure } = validation
  const { emitCellValueChanged, emitRowCellsStopped } = events
  const { applyChange } = apply
  const { clearDirtyCell } = dirty

  /**
   * 在指定行索引提交全行编辑（提取用于处理索引过期）——返回逐列结果对象
   * Submit full-row edit at the specified row index (extracted to handle stale index) — returns per-column results
   */
  async function commitEditingAtRow(rowIndex: number, reason: CellEditStopReason): Promise<CommitResult> {
    const currentData = data.value
    let row = currentData[rowIndex]
    if (!row) {
      resetEditingState()
      return { applied: [], rejected: [] }
    }

    const versionBeforeAwait = raceProtection.version
    const rowCountBeforeAwait = currentData.length
    if (validateFn) {
      const valid = await validateFn({
        mode: 'row',
        rowIndex,
        columnKey: '',
        value: undefined,
        values: editingValues.value,
      })
      /**
       * <zh/> 防御性兜底：同引用原地增删不在支持范围内——数据更新必须换引用。
       * <zh/> 过期判定除「卸载 / 版本 / 数据引用」外还须覆盖**同引用原地增删**：`isStale` 只比引用，
       * <zh/> 原地 splice 后行索引已错位，继续写入会落到错误的行（与 batch 路径的长度守卫同源）。
       * <en/> Defensive fallback: same-reference in-place mutation is unsupported — replace the reference on updates.
       * <en/> Staleness must also cover in-place mutation behind the same reference: `isStale` compares
       * <en/> references only, so after an in-place splice the row index is misaligned and a continued
       * <en/> write would land on the wrong row (same length guard as the batch path).
       */
      if (raceProtection.isStale(versionBeforeAwait, currentData) || data.value.length !== rowCountBeforeAwait)
        return { applied: [], rejected: [] }
      /**
       * <zh/> await 后二次重定位（与单格路径 `use-cell-edit-commit-cell.ts` 二次 `resolveStaleIndex` 对称）：
       * <zh/> 同长度重排（排序/筛选/分页同页重排）长度不变但索引已错位，需按 rowKey/行引用重定位；
       * <zh/> -1（行已不在新数据中）则按数据变更取消会话并通知宿主，避免把整行写到错误行。
       * <en/> Post-await relocation (symmetric with the cell path's second `resolveStaleIndex`):
       * <en/> same-length reorders (sort/filter) keep the length but invalidate the index — relocate by
       * <en/> rowKey/row reference; -1 (row gone from fresh data) cancels the session as a data change
       * <en/> and notifies the host, avoiding writing the whole row to the wrong place.
       */
      if (resolveStaleIndex) {
        const relocatedIndex = resolveStaleIndex(data.value, rowIndex)
        if (relocatedIndex === -1) {
          cancelDueToDataChanged()
          return { applied: [], rejected: [] }
        }
        if (relocatedIndex !== rowIndex) {
          const relocatedRow = data.value[relocatedIndex]
          if (!relocatedRow) {
            cancelDueToDataChanged()
            return { applied: [], rejected: [] }
          }
          rowIndex = relocatedIndex
          row = relocatedRow
        }
      }
      if (!valid && handleValidationFailure({
        rowIndex,
        columnKey: '',
        prop: '',
      }, reason)) {
        return { applied: [], rejected: [] }
      }
    }

    // <zh/> 相位一：解析 + 差集（零写入）——先求值完整变更集，供拦截器在任何写入前一次性裁决。
    // <en/> parse + diff (zero writes) — evaluate the complete change set up front so the
    // <en/> interceptor rules once before any write.
    const pendingChanges = collectFullRowPendingChanges({
      row,
      rowIndex,
      columns: columns.value,
      editingValues: editingValues.value,
      isColumnEditable,
    })
    // <zh/> 被拒记录累积器——相位二的拦截器拒与下方写入循环的 setter 拒共同填充。
    // <en/> Rejected-record accumulator — filled by phase-2 interceptor vetoes and setter
    // <en/> rejections in the write loop below.
    const rejectedRecords: CommitRejectedRecord[] = []

    // <zh/> 相位二：拦截器裁决（实现见 runFullRowCommitInterceptor）。
    // <en/> interceptor ruling (see runFullRowCommitInterceptor).
    const vetoRecords = runFullRowCommitInterceptor({
      rowIndex,
      reason,
      row,
      pendingChanges,
      interceptor,
      rowKey: editingRowKey.value,
    })
    if (vetoRecords) {
      cancelEditing(reason)
      return { applied: [], rejected: vetoRecords }
    }
    // 检查 editVersion 防止竞态 | check editVersion to prevent race conditions
    if (versionBeforeAwait !== raceProtection.version)
      return { applied: [], rejected: [] }

    /**
     * <zh/> 延迟到循环结束后再快照——setter 可能原地 mutation 了 row。
     * <zh/> 循环前的快照会丢失 setter 写入的变更。
     * <zh/> 此处仅初始化为空对象，循环中填充直写值，循环后合并 setter mutation。
     * <en/> Defer snapshot until after the loop —setters may mutate row in place,
     * <en/> a pre-loop snapshot would lose setter-written changes.
     * <en/> Initialize as empty here, fill with direct-write values during the loop,
     * <en/> merge setter mutations after the loop.
     */
    const directUpdateProps: Record<string, unknown> = {}
    let anyDirectUpdate = false

    // <zh/> 执行阶段：写入——仅在拦截器放行后；changes 仅记录实际应用的变更。
    // <en/> perform writes —only after the interceptor passes; changes records only applied ones.
    const changes: FullRowEditEvent['changes'] = []
    for (const pending of pendingChanges) {
      const result = applyChange({
        row,
        rowIndex,
        prop: pending.prop as string,
        column: pending.col,
        oldValue: pending.oldVal,
        newValue: pending.parsedNewVal,
        reason,
      })
      if (result.status === 'unhandled' && pending.prop != null) {
        directUpdateProps[pending.prop] = pending.parsedNewVal
        anyDirectUpdate = true
      }
      /**
       * <zh/> setter 拒写（返回 false）不记录到 changes——避免下游报告未实际应用的变更（假成功防护）。
       * <zh/> 注意直写路径（unhandled）的 applied 恒为 false 但数据随后必然落库，
       * <zh/> 必须计入 changes，否则 onDataUpdate/onCellValueChanged/onFullRowEditChanged/pushUndo 全部静默丢失。
       * <en/> Setter rejections (returned false) are not recorded to changes — prevents downstream
       * <en/> reporting of unapplied changes (false-success guard). NOTE: direct writes (unhandled)
       * <en/> carry applied:false by definition yet their data IS written below — they MUST be counted
       * <en/> into changes or onDataUpdate/onCellValueChanged/onFullRowEditChanged/pushUndo are all lost silently.
       */
      const setterRejected = result.status === 'setter' && !result.applied
      if (!setterRejected && result.status !== 'readOnly') {
        changes.push({
          prop: pending.prop as string,
          column: pending.col,
          oldValue: pending.oldVal,
          newValue: pending.parsedNewVal,
        })
      }
      else if (setterRejected) {
        rejectedRecords.push(toRejectedRecord({
          rowIndex,
          prop: pending.prop as string,
          columnKey: getColumnKey(pending.col),
          oldValue: pending.oldVal,
          newValue: pending.parsedNewVal,
          rowKey: editingRowKey.value ?? undefined,
        }, 'setter-rejected'))
      }
    }

    if (changes.length > 0) {
      if (!isReadOnlyEdit.value && !isBatchEdit.value && anyDirectUpdate) {
        /**
         * <zh/> 基于循环后的最新 row 重建 newRow——setter 可能在循环中原地 mutation 了 row。
         * <zh/> 必须从最新 row 重新浅拷贝再合并直写值，否则 setter 变更会被循环前快照覆盖丢失。
         * <en/> Rebuild newRow from the post-loop row —setters may have mutated row in place during the loop;
         * <en/> must re-spread from the latest row then merge direct-write values,
         * <en/> otherwise setter changes are lost by the pre-loop snapshot.
         */
        const latestRow = currentData[rowIndex] as Record<string, unknown>
        const newRow = { ...latestRow, ...directUpdateProps } as T
        onDataUpdate(replaceRowInArray(currentData, rowIndex, newRow))
      }

      // readOnly 模式仅通知宿主，不发射变更事件也不入 undo 栈（与单单元格编辑 commitCellEditing 的 result.status !== 'readOnly' 分支对称）
      // readOnly mode only notifies the host, emits no change events and pushes no undo (symmetric with commitCellEditing's result.status !== 'readOnly' branch)
      if (!isReadOnlyEdit.value) {
        const finalRow = anyDirectUpdate ? data.value[rowIndex] : row
        for (const change of changes) {
          emitCellValueChanged(finalRow, rowIndex, change.prop, change.column, change.oldValue, change.newValue, reason)
        }

        if (onFullRowEditChanged) {
          onFullRowEditChanged({
            row: finalRow,
            rowIndex,
            changes,
            reason,
          })
        }

        if (pushUndo && !isBatchEdit.value) {
          pushUndo({
            type: 'row',
            rowIndex,
            rowKey: editingRowKey.value ?? undefined,
            changes: changes.map(c => ({ prop: c.prop, oldValue: c.oldValue, newValue: c.newValue })),
            timestamp: Date.now(),
          })
        }
      }
    }

    // <zh/> 清理 fullRow 编辑的脏标记——与单格路径及 batch 路径对齐
    // <en/> Clear dirty marks for fullRow edit —aligned with single-cell and batch paths
    for (const change of changes) {
      // <zh/> change.column 在 push 到 changes 时已确认存在（result.applied 分支），此处防御性检查
      // <en/> change.column is confirmed present when pushed to changes (result.applied branch), defensive check here
      if (change.column) {
        clearDirtyCell(rowIndex, getColumnKey(change.column as Record<string, any>))
      }
    }

    const stoppedRow = anyDirectUpdate ? data.value[rowIndex] : row
    emitRowCellsStopped(rowIndex, stoppedRow, changes, reason)
    resetEditingState()

    const appliedRecords: CellChangeRecord[] = changes.map(c => ({
      rowIndex,
      prop: c.prop,
      columnKey: getColumnKey(c.column as Record<string, any>),
      oldValue: c.oldValue,
      newValue: c.newValue,
      rowKey: editingRowKey.value ?? undefined,
    }))
    return { applied: appliedRecords, rejected: rejectedRecords }
  }

  return { commitEditingAtRow }
}
