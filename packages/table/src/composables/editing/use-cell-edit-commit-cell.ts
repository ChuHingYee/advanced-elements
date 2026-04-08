/**
 * <zh/> 单格提交 composable
 * <en/> Single-cell commit composable
 *
 * @remarks
 * <zh/> 提交相位的两条路径之一：把「当前编辑单元格」结算为 0/1 条 CommitResult。
 * <zh/> 相位顺序：索引重定位 → 列存在性校验 → 值解析 → 校验 → 拦截器裁决 → 写入 → 发射。
 * <zh/> 整行路径见 `use-cell-edit-commit-row.ts`，模式分派见 `use-cell-edit-commit.ts`。
 * <en/> One of the two commit paths: settles the "currently edited cell" into 0/1 CommitResult records.
 * <en/> Phase order: index relocation → column existence → value parsing → validation → interceptor
 * <en/> ruling → write → emit. The full-row path lives in `use-cell-edit-commit-row.ts`; mode
 * <en/> dispatch in `use-cell-edit-commit.ts`.
 */
import type { ComputedRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellEditStopReason, CommitRejectedRecord, CommitResult } from '../../types/edit'
import type { InterceptorEditCommitParams } from '../../types/interceptor'
import type { UseCellEditApplyReturn } from './use-cell-edit-apply'
import type { CellEditEvents } from './use-cell-edit-events'
import type { CellEditSession } from './use-cell-edit-session'
import type { CellEditValidation } from './use-cell-edit-validation'
import type { UseEditDirtyReturn } from './use-edit-dirty'
import type { EditUndoEntry } from './use-edit-undo'
import type { UseInterceptorReturn } from './use-interceptor'
import { findColumnByKey } from '../../utils/column-tree'
import { parseCellEditValue } from '../../utils/edit-helpers'
import { shallowEqual } from '../../utils/equality'

/** <zh/> 单格提交依赖 | <en/> Single-cell commit deps */
export interface UseCellEditCommitCellDeps<T = any> {
  /** <zh/> 可见数据 | <en/> Visible data */
  data: ComputedRef<T[]>
  /** <zh/> 列配置 | <en/> Column configs */
  columns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 会话状态 | <en/> Session state */
  session: CellEditSession<T>
  /** <zh/> 校验相位 | <en/> Validation phase */
  validation: CellEditValidation<T>
  /** <zh/> 事件发射相位 | <en/> Event-emit phase */
  events: Pick<CellEditEvents<T>, 'emitCellValueChanged' | 'emitCellStopped'>
  /** <zh/> 值流转管线 | <en/> Value pipeline */
  apply: UseCellEditApplyReturn<T>
  /** <zh/> 脏标记追踪 | <en/> Dirty tracking */
  dirty: Pick<UseEditDirtyReturn, 'clearDirtyCell'>
  /** <zh/> 索引过期重定位 | <en/> Stale-index relocation */
  resolveStaleIndex: (currentData: T[], currentIndex: number) => number
  /** <zh/> 取消会话（拦截器裁决为拒时） | <en/> Cancel the session (on an interceptor veto) */
  cancelEditing: (reason: CellEditStopReason) => void
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
  /** <zh/> 撤销栈入栈 | <en/> Undo stack push */
  pushUndo?: (entry: EditUndoEntry) => void
}

/** <zh/> 单格提交返回 | <en/> Single-cell commit return */
export interface UseCellEditCommitCellReturn {
  /** <zh/> 结算当前编辑单元格 | <en/> settle the currently edited cell */
  commitCellEditing: (reason: CellEditStopReason) => Promise<CommitResult>
}

/**
 * <zh/> 创建单格提交路径
 * <en/> Create the single-cell commit path
 */
export function useCellEditCommitCell<T = any>(deps: UseCellEditCommitCellDeps<T>): UseCellEditCommitCellReturn {
  const {
    data,
    columns,
    session,
    validation,
    events,
    apply,
    dirty,
    resolveStaleIndex,
    cancelEditing,
    interceptor,
    validateFn,
    pushUndo,
  } = deps

  const {
    editingCell,
    editingValue,
    editingRowKey,
    resetEditingState,
    cancelDueToRowDeleted,
    cancelDueToDataChanged,
  } = session
  const { validateCellCommit } = validation
  const { emitCellValueChanged, emitCellStopped } = events
  const { applyChange, applyDirectUpdate } = apply
  const { clearDirtyCell } = dirty

  /**
   * <zh/> 相位（提取）：edit.commit 拦截器裁决——值有变化时触发；被拒则取消会话并返回拒绝记录。
   * <en/> Phase (extracted): edit.commit interceptor ruling — fires on changed values; on veto it
   * <en/> cancels the session and returns the rejection record.
   */
  function runCellCommitInterceptor(
    currentCell: { rowIndex: number, columnKey: string, prop: string },
    col: ProcessedColumn,
    parsedNewValue: unknown,
    oldValue: unknown,
    reason: CellEditStopReason,
    currentData: T[],
  ): CommitRejectedRecord | null {
    if (!interceptor || shallowEqual(parsedNewValue, oldValue))
      return null

    const commitParams: InterceptorEditCommitParams<T> = {
      row: currentData[currentCell.rowIndex],
      rowIndex: currentCell.rowIndex,
      prop: currentCell.prop,
      column: col,
      oldValue,
      newValue: parsedNewValue,
      reason,
    }
    if (interceptor.trigger('edit.commit', commitParams)) {
      cancelEditing(reason)
      return {
        rowIndex: currentCell.rowIndex,
        prop: currentCell.prop,
        columnKey: currentCell.columnKey,
        oldValue,
        newValue: parsedNewValue,
        rowKey: editingRowKey.value ?? undefined,
        reason: 'interceptor',
      }
    }
    return null
  }

  /**
   * <zh/> 单格提交——返回 0/1 条结果；拒绝来源（拦截器/校验/setter 拒写）计入 rejected。
   * <en/> Single-cell commit — returns 0/1 records; rejections (interceptor/validation/setter) land in rejected.
   */
  async function commitCellEditing(reason: CellEditStopReason): Promise<CommitResult> {
    const cell = editingCell.value
    if (!cell)
      return { applied: [], rejected: [] }

    let currentData = data.value
    const actualIndex = resolveStaleIndex(currentData, cell.rowIndex)
    if (actualIndex === -1) {
      cancelDueToRowDeleted()
      return { applied: [], rejected: [] }
    }
    if (actualIndex !== cell.rowIndex) {
      editingCell.value = { ...cell, rowIndex: actualIndex }
    }

    const currentCell = editingCell.value!
    const rawNewValue = editingValue.value
    const oldValue = currentCell.oldValue

    const col = findColumnByKey(columns.value, currentCell.columnKey)
    if (!col) {
      /**
       * <zh/> 列已被移除（动态列场景）——重置编辑状态并通知宿主，避免编辑永久卡死。
       * <zh/> 之前此处静默 return 导致 editingCell 保留旧值，后续 startEditing 被 isEditing 拒绝。
       * <en/> Column has been removed (dynamic column scenario) — reset editing state and notify host,
       * <en/> preventing the edit from being permanently stuck. Previously this silently returned,
       * <en/> leaving editingCell with stale state and causing subsequent startEditing calls to be rejected.
       */
      cancelDueToDataChanged()
      return { applied: [], rejected: [] }
    }

    const parsedNewValue = parseCellEditValue(col, {
      row: currentData[currentCell.rowIndex],
      rowIndex: currentCell.rowIndex,
      newValue: rawNewValue,
      oldValue,
    })

    // <zh/> 相位一：校验（实现见 validateCellCommit）。调用点保留与原实现一致的
    // <zh/> 同步门控——无 editorRules 的列零微任务开销，提交副作用保持原有同步时序。
    // <en/> validation (see validateCellCommit). The call site keeps the original
    // <en/> synchronous gate — rule-less columns pay zero microtask cost and commit
    // <en/> side-effects keep their legacy synchronous ordering.
    if (validateFn && col.editorRules) {
      /**
       * <zh/> 防御性兜底：同引用原地增删不在支持范围内——数据更新必须换引用。
       * <zh/> await 期间同一数组可能被**原地增删**（引用不变）——`isStale` 只比卸载/版本/引用，
       * <zh/> 检不出这种变更，行索引随即失效；此时按数据变更取消会话，避免把值写到错位行
       * <zh/> （与 batch 路径 `use-batch-commit` 的长度守卫同源）。
       * <en/> Defensive fallback: same-reference in-place mutation is unsupported — data updates must replace the reference.
       * <en/> During the await the same array may be mutated in place (reference unchanged) — `isStale`
       * <en/> compares unmount/version/reference only, so it cannot detect this and the row index becomes
       * <en/> invalid; the session is cancelled as a data change instead of writing to a mislocated row
       * <en/> (same length guard as the batch path in `use-batch-commit`).
       */
      const rowCountBeforeAwait = currentData.length
      const validationAbort = await validateCellCommit(currentCell, col, parsedNewValue, currentData, oldValue, reason)
      if (validationAbort)
        return validationAbort
      if (data.value.length !== rowCountBeforeAwait) {
        cancelDueToDataChanged()
        return { applied: [], rejected: [] }
      }
      // <zh/> await 后二次重定位——同长度原地重排（sort/filter 原地改序）长度不变但索引已错位，需按 rowKey/行引用重定位
      // <en/> Post-await relocation — same-length in-place reorder keeps length but invalidates the index; relocate by rowKey/row reference
      const relocatedIndex = resolveStaleIndex(data.value, currentCell.rowIndex)
      if (relocatedIndex === -1) {
        cancelDueToDataChanged()
        return { applied: [], rejected: [] }
      }
      if (relocatedIndex !== currentCell.rowIndex) {
        currentCell.rowIndex = relocatedIndex
        editingCell.value = { ...currentCell }
      }
      // <zh/> 切换到新鲜数据快照——重排可能产生新数组，后续写入/事件必须基于新数组索引域
      // <en/> Switch to the fresh data snapshot — reorder may produce a new array; downstream writes/events must use its index domain
      currentData = data.value
    }

    // <zh/> 相位二：拦截器裁决（见 runCellCommitInterceptor） | <en/> interceptor ruling (see runCellCommitInterceptor)
    const interceptorRejected = runCellCommitInterceptor(currentCell, col, parsedNewValue, oldValue, reason, currentData)
    if (interceptorRejected) {
      return { applied: [], rejected: [interceptorRejected] }
    }

    if (!shallowEqual(parsedNewValue, oldValue)) {
      const result = applyChange({
        row: currentData[currentCell.rowIndex],
        rowIndex: currentCell.rowIndex,
        prop: currentCell.prop,
        column: col,
        oldValue,
        newValue: parsedNewValue,
        reason,
      })
      if (!result.handled) {
        applyDirectUpdate(currentCell.rowIndex, currentCell.prop, parsedNewValue)
      }

      // <zh/> batch 状态时数据尚未写入（挂起于 pendingChanges），不能清脏——
      // <zh/> 否则暂存中的单元格永远不显示脏标，showStatus 在 batch 模式下形同虚设。
      // <zh/> batch 脏标由 commitBatchEdit 写入数据后统一清除（use-batch-commit）。
      // <en/> With status 'batch' the data is not written yet (staged in pendingChanges)
      // <en/> clearing the dirty flag here would hide staged changes from showStatus entirely.
      // <en/> Batch dirty flags are cleared by commitBatchEdit after the data write
      // <en/> (use-batch-commit).
      if (result.status !== 'batch')
        clearDirtyCell(currentCell.rowIndex, currentCell.columnKey)

      /**
       * readOnly（仅通知宿主，数据未变更）与 setter 拒写（假成功防护）不发射事件也不入 undo 栈；
       * 直写（unhandled）数据已经 applyDirectUpdate 落库——必须发射变更并入 undo；
       * setter 拒写计入 CommitResult.rejected 使调用方可感知（假成功防护的完整闭环）。
       *
       * readOnly (host-notify only, data unchanged) and setter rejections (false-success guard)
       * emit no change event and push no undo; direct writes (unhandled) HAVE been applied via
       * applyDirectUpdate — they must emit and push undo. Setter rejections land in
       * CommitResult.rejected so callers can perceive them (completing the false-success guard).
       */
      const setterRejected = result.status === 'setter' && !result.applied
      let commitResult: CommitResult = { applied: [], rejected: [] }
      if (setterRejected) {
        commitResult = {
          applied: [],
          rejected: [{
            rowIndex: currentCell.rowIndex,
            prop: currentCell.prop,
            columnKey: currentCell.columnKey,
            oldValue,
            newValue: parsedNewValue,
            rowKey: editingRowKey.value ?? undefined,
            reason: 'setter-rejected',
          }],
        }
      }
      else if (result.status !== 'readOnly') {
        const baseRow = currentData[currentCell.rowIndex] as Record<string, unknown>
        const rowAlreadyUpdated = result.status === 'setter' && baseRow[currentCell.prop] === parsedNewValue
        const updatedRow = rowAlreadyUpdated
          ? (baseRow as T)
          : { ...baseRow, [currentCell.prop]: parsedNewValue } as T

        emitCellValueChanged(updatedRow, currentCell.rowIndex, currentCell.prop, col, oldValue, parsedNewValue, reason)

        // batch 模式发事件但排除 undo（实际写入发生在 commitBatchEdit），也不计入 applied
        // Batch emits the event but excludes undo (the write lands in commitBatchEdit) and is not counted as applied
        const isBatch = result.status === 'batch'
        if (pushUndo && !isBatch) {
          pushUndo({
            type: 'cell',
            rowIndex: currentCell.rowIndex,
            rowKey: editingRowKey.value ?? undefined,
            changes: [{ prop: currentCell.prop, oldValue, newValue: parsedNewValue }],
            timestamp: Date.now(),
          })
        }
        if (!isBatch) {
          commitResult = {
            applied: [{
              rowIndex: currentCell.rowIndex,
              prop: currentCell.prop,
              columnKey: currentCell.columnKey,
              oldValue,
              newValue: parsedNewValue,
              rowKey: editingRowKey.value ?? undefined,
            }],
            rejected: [],
          }
        }
      }
      // readOnly 与 batch：readOnly 数据未变更不产生结果
      emitCellStopped(currentCell, col, oldValue, parsedNewValue, reason)
      resetEditingState()
      return commitResult
    }

    emitCellStopped(currentCell, col, oldValue, parsedNewValue, reason)
    resetEditingState()
    return { applied: [], rejected: [] }
  }

  return { commitCellEditing }
}
