import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellEditEvent, EditConfig } from '../../types/edit'
import type { UseDataUpdateBridgeReturn } from '../data/use-data-update-bridge'
import type { UseCellValidateReturn } from './use-cell-validate'
import type { EditUndoEntry } from './use-edit-undo'
import { computed, toValue } from 'vue'
import { findLeafColumnByProp } from '../../utils/column-tree'
import { getColumnKey } from '../../utils/shared'
import { useEditUndo } from './use-edit-undo'

/**
 * <zh/> 编辑 undo/redo 子域依赖 | <en/> Editing undo/redo sub-domain deps
 */
export interface UseEditingUndoDeps<T> {
  editConfig: MaybeRefOrGetter<EditConfig | undefined>
  effectiveColumns: Ref<ProcessedColumn[]>
  renderData: ComputedRef<T[]>
  tableData: Ref<T[]>
  rowKeyFn: ComputedRef<(row: T) => string>
  onDataUpdate: UseDataUpdateBridgeReturn<T>['handleDataUpdate']
  handleCellValueChanged: (event: CellEditEvent<T>) => void
  invalidateQuickFilterRowCache: (rowKey: string | number) => void
  /** <zh/> 校验 API（clearUndoEntryErrors 按格清错用） | <en/> validation API (for clearUndoEntryErrors' per-cell clearing) */
  validateApi: UseCellValidateReturn<T>
}

/**
 * <zh/> 编辑 undo/redo——useEditUndo 装配与 undo/redo 后的事件派发（emitUndoRedoApplied）、
 * <zh/> 受影响单元格的校验错误精确清除（clearUndoEntryErrors）。
 *
 * <zh/> 自 use-editing-orchestrator.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改。
 * <en/> Editing undo/redo — the useEditUndo assembly plus post-undo/redo event dispatch
 * <en/> (emitUndoRedoApplied) and precise validation-error clearing for affected cells
 * <en/> (clearUndoEntryErrors).
 *
 * <en/> Migrated verbatim from use-editing-orchestrator.ts (COMPLEXITY-PLAN battle line 3, knife C).
 */
export function useEditingUndo<T>(deps: UseEditingUndoDeps<T>) {
  const {
    editConfig: editConfigInput,
    effectiveColumns,
    renderData,
    tableData,
    rowKeyFn,
    onDataUpdate: handleDataUpdate,
    handleCellValueChanged,
    invalidateQuickFilterRowCache,
    validateApi,
  } = deps

  const {
    pushUndo,
    undo: rawUndo,
    redo: rawRedo,
    canUndo,
    canRedo,
  } = useEditUndo<T>({
    data: tableData,
    onDataUpdate: handleDataUpdate,
    rowKeyFn: () => rowKeyFn.value,
    // <zh/> 失败条目策略——默认 'skip' 修复 rowKey 未命中条目永久阻塞栈顶的缺陷；
    // <zh/> 宿主可通过 editConfig.undoFailureStrategy: 'block' 恢复旧行为自行提示。
    // <en/> Failure-entry strategy — defaults to 'skip', fixing the legacy defect where a
    // <en/> rowKey-missed entry blocked the stack top forever; hosts may opt back into the old
    // <en/> prompt-yourself behavior via editConfig.undoFailureStrategy: 'block'.
    failureStrategy: () => toValue(editConfigInput)?.undoFailureStrategy ?? 'skip',
    // <zh/> 栈深暴露为配置——历史版本硬编码 50 不可调（缺陷修复）。
    // <en/> Stack depth exposed as config — previously hardcoded to 50 (fixed defect).
    maxStackSize: () => toValue(editConfigInput)?.undoMaxStackSize,
    columns: computed(() => effectiveColumns.value),
  })

  /**
   * <zh/> undo/redo 后清空列筛 cellValue 缓存——undo 作用于全量 tableData，
   * <zh/> 与列筛缓存（renderData 索引域）不同源，按行失效不可靠，整表清空最安全。
   * <en/> Clear the column-filter cellValue cache after undo/redo — undo writes the FULL
   * <en/> tableData while the cache is keyed by render-data indices (different domain);
   * <en/> per-row invalidation is unreliable here, so a full clear is the safe choice.
   */
  /**
   * <zh/> undo/redo 后派发 cellValueChanged 并失效缓存——与正向编辑路径对齐。
   * <zh/> 覆盖列筛缓存与快速筛选缓存，保证消费方可观测撤销/重做且无陈旧值命中。
   * <zh/> 事件语义：oldValue/newValue 描述本次实际转移（undo 为 entry 的反向）。
   * <en/> Emit cellValueChanged and invalidate caches after undo/redo — aligned with the
   * <en/> forward-edit path. Both column-filter and quick-filter caches are invalidated so
   * <en/> consumers always observe undo/redo without stale values. Event semantics:
   * <en/> oldValue/newValue describe the ACTUAL transition (the reverse of the entry for undo).
   */
  function emitUndoRedoApplied(entry: EditUndoEntry, direction: 'undo' | 'redo'): void {
    const full = tableData.value
    const row = entry.rowKey != null
      ? full.find(r => rowKeyFn.value(r) === entry.rowKey)
      : full[entry.rowIndex]
    if (row === undefined)
      return
    const rowKey = rowKeyFn.value(row)
    if (rowKey != null)
      invalidateQuickFilterRowCache(rowKey)
    const rowIndex = full.indexOf(row)
    for (const change of entry.changes) {
      // 列树（含分组子列）中查找，不得顶层 .find
      const column = findLeafColumnByProp(effectiveColumns.value, change.prop)
      handleCellValueChanged({
        row: row as T,
        rowIndex,
        prop: change.prop,
        column,
        oldValue: direction === 'undo' ? change.newValue : change.oldValue,
        newValue: direction === 'undo' ? change.oldValue : change.newValue,
        reason: 'api',
      })
    }
  }

  /**
   * <zh/> undo/redo 按受影响单元格精确清除校验错误——经 prop→columnKey 定位，
   * <zh/> 逐格 clearCellError + 按行清跨字段残留；不清其他行，不粗粒度清空。
   * <en/> precisely clear validation errors for undo/redo-affected cells — resolve
   * <en/> prop→columnKey, clearCellError per cell + cross-field residue per row; other rows untouched.
   */
  function clearUndoEntryErrors(entry: EditUndoEntry): void {
    const render = renderData.value
    const full = tableData.value
    let renderIndex = -1
    let targetRow: T | undefined
    if (entry.rowKey != null) {
      renderIndex = render.findIndex((r) => {
        try {
          return rowKeyFn.value(r) === entry.rowKey
        }
        catch {
          return false
        }
      })
      if (renderIndex !== -1) {
        targetRow = render[renderIndex]
      }
      else {
        targetRow = full.find((r) => {
          try {
            return rowKeyFn.value(r) === entry.rowKey
          }
          catch {
            return false
          }
        })
      }
    }
    else if (entry.rowIndex >= 0 && entry.rowIndex < render.length) {
      renderIndex = entry.rowIndex
      targetRow = render[renderIndex]
    }
    const fallbackIndex = renderIndex !== -1 ? renderIndex : entry.rowIndex
    const clearedRows = new Set<number>()
    for (const change of entry.changes) {
      // 列树（含分组子列）中查找
      const col = findLeafColumnByProp(effectiveColumns.value, change.prop)
      if (!col)
        continue
      const cKey = getColumnKey(col as unknown as Record<string, any>)
      if (!cKey)
        continue
      validateApi.clearCellError(fallbackIndex, cKey, targetRow)
      if (!clearedRows.has(fallbackIndex)) {
        clearedRows.add(fallbackIndex)
        validateApi.clearRowCrossFieldErrors(fallbackIndex, targetRow)
      }
    }
  }
  return {
    pushUndo,
    rawUndo,
    rawRedo,
    canUndo,
    canRedo,
    emitUndoRedoApplied,
    clearUndoEntryErrors,
  }
}

export type UseEditingUndoAssemblyReturn<T> = ReturnType<typeof useEditingUndo<T>>
