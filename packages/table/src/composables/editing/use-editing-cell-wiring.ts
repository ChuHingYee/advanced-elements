import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellEditEvent, EditConfig } from '../../types/edit'
import type { NotifyFn } from '../../utils/notification'
import type { TableEmitter } from '../../utils/table-emitter'
import type { OverflowTooltipApi } from '../shared/use-overflow-tooltip'
import type { UseCellValidateReturn } from './use-cell-validate'
import type { UseEditingBatchReturn } from './use-editing-batch'
import type { UseEditingUndoAssemblyReturn } from './use-editing-undo-assembly'
import { computed, ref, toValue } from 'vue'
import { registerAllBuiltInEditors } from '../../components/cell-editors'
import { markRawTyped } from '../../utils/shared'
import { useCellEdit } from './use-cell-edit'
import { useCellNavigation } from './use-cell-navigation'
import { useEditorBlur } from './use-editor-blur'
import { useEditorResolver } from './use-editor-resolver'
import { useInterceptor } from './use-interceptor'

/**
 * <zh/> 单元格编辑装配依赖 | <en/> Cell-edit wiring deps
 */
export interface UseEditingCellWiringDeps<T> {
  editConfig: MaybeRefOrGetter<EditConfig | undefined>
  effectiveColumns: Ref<ProcessedColumn[]>
  rendererData: ComputedRef<T[]>
  rowKeyFn: ComputedRef<(row: T) => string>
  onDataUpdate: import('../data/use-data-update-bridge').UseDataUpdateBridgeReturn<T>['handleDataUpdate']
  handleCellValueChanged: (event: CellEditEvent<T>) => void
  tableEmit: TableEmitter
  validateFn: import('./use-editing-validation').UseEditingValidationReturn<T>['validateFn']
  validateApi: UseCellValidateReturn<T>
  interceptorInput?: import('../../types/interceptor').InterceptorConfig | import('vue').MaybeRefOrGetter<import('../../types/interceptor').InterceptorConfig | undefined>
  globalTableConfig: ComputedRef<Record<string, any>>
  sharedTooltipApi: OverflowTooltipApi
  containerRef?: Ref<HTMLElement | null>
  notify: NotifyFn
  undoApi: Pick<UseEditingUndoAssemblyReturn<T>, 'pushUndo'>
  batchApi: Pick<UseEditingBatchReturn<T>, 'batchRecordChange' | 'hasPendingChanges' | 'commitBatchEdit' | 'cancelBatchEdit'>
}

/**
 * <zh/> 单元格编辑装配——useCellEdit 大配置（含回滚/开始/停止/通知等全部回调桥接）、
 * <zh/> 失焦提交（useEditorBlur）与 submitEdit/discardEdit/updateEditingValue 门面。
 *
 * <zh/> 自 use-editing-orchestrator.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改。
 * <en/> Cell-edit wiring — the big useCellEdit config (bridging every rollback/start/stop/notify
 * <en/> callback), blur commit (useEditorBlur) and the submitEdit/discardEdit/updateEditingValue
 * <en/> façade.
 *
 * <en/> Migrated verbatim from use-editing-orchestrator.ts (COMPLEXITY-PLAN battle line 3, knife C).
 */
export function useEditingCellWiring<T>(deps: UseEditingCellWiringDeps<T>) {
  const {
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
    batchApi,
  } = deps
  const { batchRecordChange, hasPendingChanges, commitBatchEdit, cancelBatchEdit } = batchApi

  const interceptor = useInterceptor({
    interceptorConfig: () => toValue(interceptorInput) ?? globalTableConfig.value.interceptor,
  })

  const editorResolverApi = useEditorResolver({
    columns: computed(() => effectiveColumns.value),
    // <zh/> 单表覆盖透传：`EditConfig.editors` 仅作用于本表，不污染全局 | <en/> Per-table passthrough: `EditConfig.editors` scoped to this table, never pollutes globals
    editors: computed(() => toValue(editConfigInput)?.editors),
  })

  // <zh/> 编辑器预热：编排器创建即编辑可用，内置编辑器 chunk 后台加载，首次打开已就绪
  // <en/> Editor preload: the orchestrator existing means editing is available; built-in editor chunks load in background, ready before first open
  registerAllBuiltInEditors()

  const cellNavigationApi = useCellNavigation<T>({
    editableColumns: editorResolverApi.editableColumns,
    data: rendererData,
    editConfig: computed(() => toValue(editConfigInput)),
  })

  const {
    editingCell,
    editingValue,
    isEditing: cellEditingActive,
    isCellEditing,
    startEditing,
    stopEditing,
    isColumnEditable,
    editingRowIndex,
    getCellEditingValue,
    updateCellEditingValue,
    commitEditing,
    cancelEditing,
    isCellDirty,
    dirtyRowKeys,
    isFullRowEdit,
    hasUnsavedChanges: hasUnsavedChangesFromEditApi,
    batchCommitCells,
    saveCells,
    validateCurrentValue,
  } = useCellEdit<T>({
    editConfig: computed(() => toValue(editConfigInput)),
    columns: computed(() => effectiveColumns.value),
    data: rendererData,
    rowKeyFn: () => rowKeyFn.value,
    onDataUpdate: handleDataUpdate,
    onCellValueChanged: handleCellValueChanged,
    /**
     * <zh/> saveCells 悲观协议落库失败——派发结构化 TABLE_EDIT_ROLLBACK，
     * <zh/> 数据已由内核自动还原快照，撤销栈不受影响。
     * <en/> saveCells pessimistic persistence failure — dispatches structured TABLE_EDIT_ROLLBACK;
     * <en/> the kernel already restored the data snapshot and the undo stack is untouched.
     */
    onRollback: ({ cause }) => {
      tableEmit('error', {
        code: 'TABLE_EDIT_ROLLBACK',
        severity: 'error',
        cause,
      })
    },
    onCellEditingStarted(event) {
      sharedTooltipApi.forceHide()
      tableEmit('cellEditingStarted', event)
    },
    onCellEditingStopped(event) {
      tableEmit('cellEditingStopped', event)
    },
    onFullRowEditChanged(event) {
      tableEmit('fullRowEdit', event)
    },
    onBatchRecordChange(params) {
      batchRecordChange(params.rowKey, params.prop, params.newValue, params.oldValue)
    },
    onCellEditRequest(event) {
      tableEmit('cellEditingRequest', event)
    },
    /**
     * <zh/> 编辑会话因数据变化被取消（行删除/过滤不可定位）——派发 cellEditingCancelled 事件。
     * <zh/> 该回调已接线，保证消费方可观测会话取消。
     * <en/> Cell editing session cancelled due to data changes (row deleted / not relocatable)
     * <en/> dispatches cellEditingCancelled. The callback stays wired so session cancellations
     * <en/> remain visible to consumers.
     */
    onEditCancelled({ reason }) {
      tableEmit('cellEditingCancelled', { reason })
    },
    validateFn,
    interceptor,
    pushUndo,
    onEditingValueChange({ rowIndex, columnKey, value, rowData }) {
      validateApi.clearCellError(rowIndex, columnKey, rowData)
      validateApi.clearRowCrossFieldErrors(rowIndex, rowData)
      validateApi.validateCell(rowIndex, columnKey, value, rowData)
    },
    onNotifyValidationError({ rowIndex, columnKey, prop }) {
      // <zh/> notify 模式下校验失败——通过注入的通知通道提示用户，
      // <en/> notify mode validation failure — notify user via injected notification channel,
      // <zh/> 同时通过 error 事件通知消费方
      // <en/> and notify consumers via the error event
      const errors = validateApi.errors.value
      const cellError = errors.find(e => e.rowIndex === rowIndex && (columnKey ? e.columnKey === columnKey : true))
      const message = cellError?.message || `${prop || columnKey} validation failed`
      notify('warning', message, 'editing')
      tableEmit('error', {
        code: 'TABLE_EDIT_VALIDATION_FAILED',
        severity: 'warn',
        cause: { rowIndex, columnKey, prop, message, errors },
      })
    },
    editorResolver: editorResolverApi,
  })

  // <zh/> 失焦提交——无条件调用 composable（Vue Rules of Hooks），缺容器时内部空转；
  // <zh/> 容器延迟注入后自动生效，无需重建。 | <en/> Blur commit — called unconditionally per Rules of Hooks;
  // <en/> no-ops without a container and auto-activates once the container is injected.
  const blurContainerRef = containerRef ?? ref<HTMLElement | null>(null)
  useEditorBlur({
    containerRef: blurContainerRef,
    editingCell,
    editingRowIndex,
    editConfig: () => toValue(editConfigInput),
    stopEditing,
  })

  function updateEditingValue(val: unknown) {
    editingValue.value = val
  }

  async function submitEdit(): Promise<void> {
    if (hasPendingChanges.value) {
      await commitBatchEdit()
      return
    }
    // <zh/> CommitResult 仅供 saveCells/batchCommitCells 调用方使用，submitEdit 保持 fire-and-forget 语义
    // <en/> The CommitResult is for saveCells/batchCommitCells callers; submitEdit keeps fire-and-forget semantics
    await commitEditing('api')
  }

  function discardEdit(): void {
    if (hasPendingChanges.value) {
      return cancelBatchEdit()
    }
    return cancelEditing('api')
  }
  const editApi = markRawTyped({
    editingCell,
    editingValue,
    editingRowIndex,
    startEditing,
    stopEditing,
    getEditorComponent: editorResolverApi.getEditorComponent,
    isColumnEditable,
    updateEditingValue,
    isCellEditing,
    getCellEditingValue,
    updateCellEditingValue,
    findNextEditableCell: cellNavigationApi.findNextEditableCell,
    findFirstEditableCell: cellNavigationApi.findFirstEditableCell,
    findLastEditableCell: cellNavigationApi.findLastEditableCell,
    getEditorSelectorParams: editorResolverApi.getEditorSelectorParams,
    isCellDirty,
    validateCurrentValue,
  })

  return {
    editApi,
    interceptor,
    editorResolverApi,
    cellNavigationApi,
    editingCell,
    editingValue,
    cellEditingActive,
    isCellEditing,
    startEditing,
    stopEditing,
    isColumnEditable,
    editingRowIndex,
    getCellEditingValue,
    updateCellEditingValue,
    commitEditing,
    cancelEditing,
    isCellDirty,
    dirtyRowKeys,
    isFullRowEdit,
    hasUnsavedChanges: hasUnsavedChangesFromEditApi,
    batchCommitCells,
    saveCells,
    validateCurrentValue,
    blurContainerRef,
    updateEditingValue,
    submitEdit,
    discardEdit,
  }
}
