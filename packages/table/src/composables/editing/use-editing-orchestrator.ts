import type { CellEditEvent } from '../../types/edit'
/**
 * <zh/> 编辑编排器（装配层）——校验桥接、undo/redo、批量缓冲、单元格编辑、行视图模型的统一装配。
 *
 * <zh/> 子域拆分（COMPLEXITY-PLAN 战线三，刀法 C）：validation 校验桥 / undo-assembly 撤销装配 /
 * <zh/> batch 批量缓冲 / cell-wiring 单元格编辑装配；本文件保留装配次序、历史操作门面
 * <zh/> （settle/editUndo/editRedo）与 RowViewModel 装配。
 * <en/> Editing orchestrator (assembly layer) — unified assembly of the validation bridge,
 * <en/> undo/redo, batch buffer, cell editing and the row view model.
 *
 * <en/> Sub-domain split (COMPLEXITY-PLAN battle line 3, knife C): validation bridge /
 * <en/> undo assembly / batch buffer / cell-edit wiring; this file keeps assembly order,
 * <en/> the history-operation façade (settle/editUndo/editRedo) and the RowViewModel assembly.
 */
import type { UseEditingOrchestratorOptions } from './use-editing-orchestrator-types'
import { computed } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { createDefaultNotify } from '../../utils/notification'
import { createTableEmitter } from '../../utils/table-emitter'
import { useEditingBatch } from './use-editing-batch'
import { useEditingCellWiring } from './use-editing-cell-wiring'
import { useEditingUndo } from './use-editing-undo-assembly'
import { useEditingValidation } from './use-editing-validation'
import { useEditingViewModel } from './use-editing-view-model'

// <zh/> 契约类型自子模块 re-export，既有导入路径零变化 | <en/> Contract re-exported; import paths unchanged
export type { UseEditingOrchestratorOptions } from './use-editing-orchestrator-types'

export function useEditingOrchestrator<T>(options: UseEditingOrchestratorOptions<T>) {
  const {
    editConfig: editConfigInput,
    interceptor: interceptorInput,
    globalTableConfig,
    effectiveColumns,
    renderData,
    tableData,
    rowKeyFn,
    tableId,
    invalidateQuickFilterRowCache,
    invalidateColumnFilterRowCache,
    sharedTooltipApi,
    isCellInRangeSelection,
    dataUpdateBridge,
    containerRef,
    notify = createDefaultNotify(),
    emit,
  } = options

  const { handleDataUpdate } = dataUpdateBridge
  const tableEmit = createTableEmitter(emit, tableId)

  /**
   * <zh/> 统一单元格值变更出口——单格/整行/批量提交共用：
   * <zh/> 派发 cellValueChanged 事件并按行键失效快速筛选缓存
   * <en/> Unified cell value change outlet — shared by single-cell / full-row / batch commit:
   * <en/> emits the cellValueChanged event and invalidates the quick-filter cache by row key
   */
  function handleCellValueChanged(event: CellEditEvent<T>) {
    emit('cellValueChanged', event, tableId.value)
    if (event.row) {
      invalidateQuickFilterRowCache(rowKeyFn.value(event.row))
    }
    // <zh/> 列筛缓存按行失效——与快筛对称，闭合"编辑后筛选命中陈旧值"缺口。
    // <zh/> 必须传行对象：event.rowIndex 是渲染域索引，与列筛缓存的管线域索引不同源。
    // <en/> Per-row column-filter cache invalidation — symmetric with quick filter,
    // <en/> closing the "filter matches pre-edit values" gap. The row OBJECT must be passed:
    // <en/> event.rowIndex is a render-domain index, a different source from the filter cache's
    // <en/> pipeline-domain index.
    // <zh/> 行数据可能是原始值（T 为非对象时）——此时无法按对象定位，退回整表清空。
    // <en/> Row data may be a primitive (when T is not an object) — object addressing is
    // <en/> impossible then, so fall back to a full clear.
    if (event.row != null && typeof event.row === 'object') {
      invalidateColumnFilterRowCache?.(event.row)
    }
  }

  // <zh/> 校验桥（validateApi/validateFn + crossField 静默失效告警）自 use-editing-validation.ts 拆出（刀法 C）
  // <en/> Validation bridge (validateApi/validateFn + the crossField silent-no-op warning) split into use-editing-validation.ts (knife C)
  const { validateApi, validateFn } = useEditingValidation<T>({
    editConfig: editConfigInput,
    effectiveColumns,
    renderData,
    rowKeyFn,
    tableEmit,
  })

  // <zh/> undo/redo 装配（含 emitUndoRedoApplied/clearUndoEntryErrors）自 use-editing-undo-assembly.ts 拆出（刀法 C）
  // <en/> undo/redo assembly (incl. emitUndoRedoApplied/clearUndoEntryErrors) split into use-editing-undo-assembly.ts (knife C)
  const {
    pushUndo,
    rawUndo,
    rawRedo,
    canUndo,
    canRedo,
    emitUndoRedoApplied,
    clearUndoEntryErrors,
  } = useEditingUndo<T>({
    editConfig: editConfigInput,
    effectiveColumns,
    renderData,
    tableData,
    rowKeyFn,
    onDataUpdate: handleDataUpdate,
    handleCellValueChanged,
    invalidateQuickFilterRowCache,
    validateApi,
  })

  // <zh/> 批量缓冲（buffered 装配 + cancelBatchEdit 清错 + batchPendingChange 广播）自 use-editing-batch.ts 拆出（刀法 C）
  // <en/> Batch buffer (the buffered assembly + cancelBatchEdit error clearing + batchPendingChange broadcast) split into use-editing-batch.ts (knife C)
  const {
    hasPendingChanges,
    batchPendingChanges,
    batchRecordChange,
    commitBatchEdit,
    cancelBatchEdit,
    batchDisplayData,
    batchHasPending,
  } = useEditingBatch<T>({
    editConfig: editConfigInput,
    effectiveColumns,
    renderData,
    rowKeyFn,
    tableEmit,
    validateApi,
    onDataUpdate: handleDataUpdate,
    handleCellValueChanged,
    pushUndo,
  })

  const rendererData = computed(() => batchDisplayData.value)

  // <zh/> 拦截器/编辑器解析/导航/预热装配已下沉 use-editing-cell-wiring.ts

  // <zh/> 单元格编辑装配（useCellEdit 大配置 + 失焦提交 + submit/discard 门面）自 use-editing-cell-wiring.ts 拆出（刀法 C）
  // <en/> Cell-edit wiring (the big useCellEdit config + blur commit + submit/discard façade) split into use-editing-cell-wiring.ts (knife C)
  const {
    editApi,
    interceptor,
    editorResolverApi,
    cellNavigationApi,
    editingCell,
    cellEditingActive,
    isCellEditing,
    editingRowIndex,
    commitEditing,
    cancelEditing,
    isCellDirty,
    dirtyRowKeys,
    isFullRowEdit,
    hasUnsavedChanges: hasUnsavedChangesFromEditApi,
    batchCommitCells,
    saveCells,
    submitEdit,
    discardEdit,
  } = useEditingCellWiring<T>({
    editConfig: editConfigInput,
    effectiveColumns,
    rendererData,
    rowKeyFn,
    onDataUpdate: handleDataUpdate,
    handleCellValueChanged,
    tableEmit,
    validateFn,
    validateApi,
    interceptorInput,
    globalTableConfig,
    sharedTooltipApi,
    containerRef,
    notify,
    undoApi: { pushUndo },
    batchApi: { batchRecordChange, hasPendingChanges, commitBatchEdit, cancelBatchEdit },
  })

  /**
   * <zh/> undo/redo 前结算活跃编辑态——直接改写 tableData 而不处理会话，会使活跃会话的
   * <zh/> editingValue/editingRowRef 持有旧快照，随后提交把已撤销的值重新写回（幽灵写回）。
   * <zh/> - 活跃单格/整行会话（未落库的编辑器值）：先取消再执行（表格类常规语义）；
   * <zh/> - 已暂存的批量变更（用户显式 staged 的工作）：拒绝执行并返回 false，避免静默丢弃。
   * <en/> Settle active editing state before undo/redo — rewriting tableData underneath a live
   * <en/> session leaves its editingValue/editingRowRef holding a stale snapshot, which a later
   * <en/> commit writes back over the undone values (ghost write-back).
   * <en/> - Live cell/row session (uncommitted editor value): cancel first (spreadsheet convention);
   * <en/> - Staged batch changes (explicitly staged work): refuse with `false`, never silently discard.
   */
  function settleActiveSessionForHistory(): boolean {
    if (hasPendingChanges.value) {
      if (isDev) {
        devWarn('[AdvTable] editUndo/editRedo refused: staged batch changes exist, submit or discard them first.')
      }
      return false
    }
    if (cellEditingActive.value)
      cancelEditing('api')
    return true
  }

  function editUndo(): boolean {
    if (!settleActiveSessionForHistory())
      return false
    const entry = rawUndo()
    if (!entry)
      return false
    emitUndoRedoApplied(entry, 'undo')
    clearUndoEntryErrors(entry)
    invalidateColumnFilterRowCache?.()
    return true
  }

  function editRedo(): boolean {
    if (!settleActiveSessionForHistory())
      return false
    const entry = rawRedo()
    if (!entry)
      return false
    emitUndoRedoApplied(entry, 'redo')
    clearUndoEntryErrors(entry)
    invalidateColumnFilterRowCache?.()
    return true
  }

  // <zh/> 行视图模型装配（稀疏快照 + useRowViewModel + 映射表）自 use-editing-view-model.ts 拆出（刀法 C）
  // <en/> Row-view-model assembly (sparse snapshot + useRowViewModel + map) split into use-editing-view-model.ts (knife C)
  const { tableRowViewModels, rowViewModelMap } = useEditingViewModel<T>({
    editConfig: editConfigInput,
    effectiveColumns,
    rendererData,
    rowKeyFn,
    isCellInRangeSelection,
    rangeSelectionRange: options.rangeSelectionRange,
    editingCell,
    editingRowIndex,
    isFullRowEdit,
    dirtyRowKeys,
    isCellEditing,
    isCellDirty,
  })

  // <zh/> provide(advTableRowViewModelKey, ...) 已移至 createEditingAdapter 统一桥接 |
  // <en/> provide(advTableRowViewModelKey, ...) moved to createEditingAdapter for unified bridging

  // <zh/> editApi 组装已下沉 use-editing-cell-wiring.ts

  return {
    validateApi,
    interceptor,
    editorResolverApi,
    cellNavigationApi,
    editApi,
    // <zh/> 以下字段不在 editApi 中（editApi 仅含单元格级操作），需独立暴露 | <en/> Fields below are NOT in editApi (which only contains cell-level operations), exposed independently
    commitEditing,
    cancelEditing,
    submitEdit,
    discardEdit,
    /**
     * <zh/> 联合 batch 暂存——覆盖编辑会话 + 脏格 + batch 暂存（pendingChanges），
     * <zh/> 保证"有未保存变更"在 batch 模式下不漏报。
     * <en/> Include batch staging — covers the edit session + dirty cells + batch-staged
     * <en/> (pendingChanges) edits, without under-reporting in batch mode.
     */
    hasUnsavedChanges: (): boolean => hasUnsavedChangesFromEditApi() || hasPendingChanges.value,
    hasPendingChanges,
    batchHasPending,
    batchPendingChanges,
    batchCommitCells,
    saveCells,
    commitBatchEdit,
    cancelBatchEdit,
    rendererData,
    undo: editUndo,
    redo: editRedo,
    canUndo,
    canRedo,
    tableRowViewModels,
    rowViewModelMap,
  }
}
