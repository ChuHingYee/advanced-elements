import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { EditConfig } from '../../types/edit'
import type { TableEmitter } from '../../utils/table-emitter'
import type { UseDataUpdateBridgeReturn } from '../data/use-data-update-bridge'
import type { UseCellValidateReturn } from './use-cell-validate'
import { computed, toValue, watch } from 'vue'
import { findLeafColumnByProp } from '../../utils/column-tree'
import { getColumnKey } from '../../utils/shared'
import { useBufferedEdit } from './use-buffered-edit'

/**
 * <zh/> 编辑批量缓冲子域依赖 | <en/> Editing batch-buffer sub-domain deps
 */
export interface UseEditingBatchDeps<T> {
  editConfig: MaybeRefOrGetter<EditConfig | undefined>
  effectiveColumns: Ref<ProcessedColumn[]>
  renderData: ComputedRef<T[]>
  rowKeyFn: ComputedRef<(row: T) => string>
  tableEmit: TableEmitter
  validateApi: UseCellValidateReturn<T>
  onDataUpdate: UseDataUpdateBridgeReturn<T>['handleDataUpdate']
  handleCellValueChanged: (event: import('../../types/edit').CellEditEvent<T>) => void
  /** <zh/> 撤销入栈回调（来自 undo 子域） | <en/> undo push callback (from the undo sub-domain) */
  pushUndo: (entry: import('./use-edit-undo').EditUndoEntry) => void
}

/**
 * <zh/> 编辑批量缓冲——useBufferedEdit 装配（含 onBatchCommitted 的逐行撤销入栈）、
 * <zh/> cancelBatchEdit 的按格精确清错与 batchHasPending 广播 watch。
 *
 * <zh/> 自 use-editing-orchestrator.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改。
 * <en/> Editing batch buffer — the useBufferedEdit assembly (with onBatchCommitted pushing per-row
 * <en/> undo entries), cancelBatchEdit's per-cell precise error clearing, and the batchHasPending
 * <en/> broadcast watch.
 *
 * <en/> Migrated verbatim from use-editing-orchestrator.ts (COMPLEXITY-PLAN battle line 3, knife C).
 */
export function useEditingBatch<T>(deps: UseEditingBatchDeps<T>) {
  const {
    editConfig: editConfigInput,
    effectiveColumns,
    renderData,
    rowKeyFn,
    tableEmit,
    validateApi,
    onDataUpdate: handleDataUpdate,
    handleCellValueChanged,
    pushUndo,
  } = deps

  const {
    hasPendingChanges,
    pendingChanges: batchPendingChanges,
    recordChange: batchRecordChange,
    commitBatchEdit,
    cancelBatchEdit: cancelBatchEditRaw,
    displayData: batchDisplayData,
  } = useBufferedEdit<T>({
    data: renderData,
    rowKeyFn: () => rowKeyFn.value,
    editConfig: computed(() => toValue(editConfigInput)),
    validateFn: validateApi.validateAll,
    onDataUpdate: handleDataUpdate,
    // 校验失败时派发结构化错误，让消费方可捕获
    // Dispatch structured errors on validation failure so consumers can catch it
    onValidationError: () => {
      tableEmit('error', {
        code: 'TABLE_EDIT_VALIDATION_FAILED',
        severity: 'warn',
        cause: validateApi.errors.value,
      })
    },
    /**
     * <zh/> 批量提交事件链补全——与单格路径对齐：派发 cellValueChanged、失效快速筛选缓存、按行入撤销栈
     * <en/> Batch commit event chain completion — aligned with the single-cell path: emits cellValueChanged,
     * <en/> invalidates quick-filter cache and pushes one undo entry per row
     */
    onBatchCommitted(changes) {
      const byRow = new Map<string | number, { rowIndex: number, changes: Array<{ prop: string, oldValue: any, newValue: any }> }>()
      for (const change of changes) {
        // 列树（含分组子列）中查找
        const column = findLeafColumnByProp(effectiveColumns.value, change.prop)
        handleCellValueChanged({
          row: change.row,
          rowIndex: change.rowIndex,
          prop: change.prop,
          column,
          oldValue: change.oldValue,
          newValue: change.newValue,
          reason: 'api',
        })
        // 以行键聚合（而非行索引）——撤销时优先通过 rowKey 定位目标行
        // Aggregate by row key (not row index) — undo prefers locating the target row via rowKey
        const rowKey = rowKeyFn.value(change.row)
        const agg = byRow.get(rowKey)
        if (agg) {
          agg.changes.push({ prop: change.prop, oldValue: change.oldValue, newValue: change.newValue })
        }
        else {
          byRow.set(rowKey, {
            rowIndex: change.rowIndex,
            changes: [{ prop: change.prop, oldValue: change.oldValue, newValue: change.newValue }],
          })
        }
      }
      // 撤销粒度为「每行一次批量提交」——该行在此次提交中的全部字段变更聚合为一条记录
      // Undo granularity is "one batch commit per row" — all field changes of a row in this commit aggregate into one entry
      const now = Date.now()
      for (const [rowKey, agg] of byRow) {
        pushUndo({
          type: 'cell',
          rowIndex: agg.rowIndex,
          rowKey,
          changes: agg.changes,
          timestamp: now,
        })
      }
    },
  })

  /**
   * <zh/> cancelBatchEdit 按暂存涉及单元格精确清除校验错误——遍历 pendingChanges
   * <zh/>（rowKey→prop रिकॉर्ड），经 prop→columnKey 逐格 clearCellError + 按行清跨字段残留；
   * <zh/> 不粗粒度清空其他行。清除后调用底层取消清空缓冲。
   * <en/> cancelBatchEdit precisely clears validation errors for staged cells — iterate
   * <en/> pendingChanges (rowKey→prop records), clearCellError per cell + cross-field per row;
   * <en/> other rows untouched. Then delegates to the raw cancel.
   */
  function cancelBatchEdit(): void {
    try {
      const pending = batchPendingChanges.value
      if (pending && pending.size > 0) {
        const render = renderData.value
        const clearedRows = new Set<string | number>()
        for (const [rowKey, record] of pending) {
          const rIndex = render.findIndex((r) => {
            try {
              return rowKeyFn.value(r) === rowKey
            }
            catch {
              return false
            }
          })
          const targetRow = rIndex !== -1 ? render[rIndex] : undefined
          const fallbackIndex = rIndex !== -1 ? rIndex : -1
          for (const prop of Object.keys(record ?? {})) {
            // 列树（含分组子列）中查找
            const col = findLeafColumnByProp(effectiveColumns.value, prop)
            if (!col)
              continue
            const cKey = getColumnKey(col as unknown as Record<string, any>)
            if (!cKey || fallbackIndex < 0)
              continue
            validateApi.clearCellError(fallbackIndex, cKey, targetRow)
          }
          if (fallbackIndex >= 0 && !clearedRows.has(rowKey)) {
            clearedRows.add(rowKey)
            validateApi.clearRowCrossFieldErrors(fallbackIndex, targetRow)
          }
        }
      }
    }
    finally {
      cancelBatchEditRaw()
    }
  }

  /** batchHasPending 作为 computed 派生自 batchPendingChanges，避免 ref+watch 导致的额外渲染周期 */
  const batchHasPending = computed(() => batchPendingChanges.value.size > 0)
  /**
   * <zh/> 批量暂存变更广播回调——batchHasPending 翻转（含 setup immediate）即派发事件
   * <en/> Batch-pending broadcast callback — emits on batchHasPending toggle (incl. setup immediate)
   */
  function onBatchPendingChangedEmit(val: boolean): void {
    tableEmit('batchPendingChange', val)
  }
  watch(
    batchHasPending,
    onBatchPendingChangedEmit,
    { immediate: true },
  )
  return {
    hasPendingChanges,
    batchPendingChanges,
    batchRecordChange,
    commitBatchEdit,
    cancelBatchEdit,
    batchDisplayData,
    batchHasPending,
  }
}

export type UseEditingBatchReturn<T> = ReturnType<typeof useEditingBatch<T>>
