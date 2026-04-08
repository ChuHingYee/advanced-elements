import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { AdvTableEmitFn, ProcessedColumn } from '../../types'
import type { CellEditEvent, EditConfig } from '../../types/edit'
import type { InterceptorConfig } from '../../types/interceptor'
import type { NotifyFn } from '../../utils/notification'
import type { UseDataUpdateBridgeReturn } from '../data/use-data-update-bridge'
import type { EditUndoEntry } from '../editing/use-edit-undo'
import type { OverflowTooltipApi } from '../shared/use-overflow-tooltip'
import type { CellState, DecorationRangeRect } from '../view-model/use-row-view-model'
import { computed, ref, toValue, watch } from 'vue'
import { registerAllBuiltInEditors } from '../../components/cell-editors'
import { findLeafColumnByProp, flattenLeafColumns } from '../../utils/column-tree'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { createDefaultNotify } from '../../utils/notification'
import { getColumnKey, markRawTyped } from '../../utils/shared'
import { createTableEmitter } from '../../utils/table-emitter'
import { useBufferedEdit } from '../editing/use-buffered-edit'
import { useCellEdit } from '../editing/use-cell-edit'
import { useCellNavigation } from '../editing/use-cell-navigation'
import { useCellValidate } from '../editing/use-cell-validate'
import { useEditUndo } from '../editing/use-edit-undo'
import { useEditorBlur } from '../editing/use-editor-blur'
import { useEditorResolver } from '../editing/use-editor-resolver'
import { useInterceptor } from '../editing/use-interceptor'
import { buildRowViewModelMap } from '../view-model/build-row-view-model-map'
import { useRowViewModel } from '../view-model/use-row-view-model'

/** <zh/> 编辑编排器输入 | <en/> Editing orchestrator input */
export interface UseEditingOrchestratorOptions<T> {
  /**
   * <zh/> 编辑配置——窄切片，替代既往 `props: AdvTableProps` 全量透传（本模块 9 处 props 读取均派生于此，见行内等价注）
   * <en/> Edit config — narrow slice replacing the former `props: AdvTableProps` passthrough (all 9 props reads in this module derive from it, see inline notes)
   */
  editConfig: MaybeRefOrGetter<EditConfig | undefined>
  /**
   * <zh/> 拦截器配置（等价既往 `props.interceptor`，缺省时仍回退全局配置）
   * <en/> Interceptor config (equivalent to the former `props.interceptor`, still falling back to the global config when absent)
   */
  interceptor?: MaybeRefOrGetter<InterceptorConfig | undefined>
  globalTableConfig: ComputedRef<Record<string, any>>
  effectiveColumns: Ref<ProcessedColumn[]>
  /**
   * <zh/> 渲染域数据——必须传入数据管线的 renderData（Row Pinning 启用时已剔除 pinned 行），
   * <zh/> 保证编辑/校验/批量暂存的行索引域与渲染器实际绘制的主体行一致。
   * <en/> Render-domain data — MUST receive the pipeline's renderData (pinned rows already
   * <en/> extracted when Row Pinning is enabled), so the row-index domain of editing/validation/
   * <en/> batch staging stays consistent with the rows the renderer actually draws in the body.
   */
  renderData: ComputedRef<T[]>
  tableData: Ref<T[]>
  rowKeyFn: ComputedRef<(row: T) => string>
  tableId: ComputedRef<string>
  invalidateQuickFilterRowCache: (rowKey: string | number) => void
  /**
   * <zh/> 列筛 cellValue 缓存按**行对象**失效——编辑提交/撤销后调用，防止筛选命中陈旧值。
   * <zh/> 按行对象而非行索引定位：编辑事件的 rowIndex 属渲染域，与列筛缓存的管线域不同源
   * <zh/> （筛选/排序/分页状态下同一索引指向不同行），跨域传索引会失效错误的行。
   * <en/> Invalidate the column-filter cellValue cache **by row object** — call after edit
   * <en/> commit/undo so filtering never matches pre-edit values. Addressed by row object rather
   * <en/> than row index: edit events carry a render-domain rowIndex while the filter cache is in
   * <en/> the pipeline domain (the same index points at different rows under filtering/sorting/
   * <en/> pagination), so a cross-domain index would invalidate the wrong row.
   */
  invalidateColumnFilterRowCache?: (row?: object | null) => void
  sharedTooltipApi: OverflowTooltipApi
  isCellInRangeSelection: (rowIndex: number, colIndex: number) => boolean
  /**
   * <zh/> 范围选择矩形 computed——提供时启用 RowViewModel 稀疏重算（快照依赖对等的选区来源）。
   * <zh/> 缺省时不组装快照，RowViewModel 走稠密路径。
   * <en/> Range-selection rect computed — enables sparse RowViewModel recomputation when provided
   * <en/> (the selection source of the snapshot's dependency parity). When absent, no snapshot is
   * <en/> assembled and the RowViewModel falls back to the dense path (historical behavior).
   */
  rangeSelectionRange?: ComputedRef<DecorationRangeRect | null>
  /**
   * <zh/> 数据更新桥接——由数据层 {@linkcode useDataUpdateBridge} 提供
   * <en/> Data update bridge — provided by the data layer's {@linkcode useDataUpdateBridge}
   */
  dataUpdateBridge: UseDataUpdateBridgeReturn<T>
  /**
   * <zh/> 表格根元素 ref——提供时启用失焦提交（useEditorBlur）
   * <en/> Table root element ref — enables blur commit (useEditorBlur) when provided
   */
  containerRef?: Ref<HTMLElement | null>
  /** <zh/> 通知通道——校验失败时通过此通道通知用户，未传入时使用默认实现 | <en/> Notification channel for validation failures, defaults to default implementation */
  notify?: NotifyFn
  emit: AdvTableEmitFn
}

/**
 * <zh/> 编辑编排——校验桥接、批量编辑、拦截器、撤销/重做、单元格编辑、行视图模型。
 *
 * <en/> Editing orchestration — validation bridge, batch edit, interceptor,
 * <en/> undo/redo, cell editing, row view model.
 */
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

  const validateApi = useCellValidate<T>({
    columns: computed(() => effectiveColumns.value),
    data: renderData,
    crossFieldValidator: () => toValue(editConfigInput)?.crossFieldValidator,
    rowKeyFn: () => rowKeyFn.value,
  })
  // <zh/> provide(advTableValidateErrorsKey, ...) 已移至 createEditingAdapter 统一桥接 |
  // <en/> provide(advTableValidateErrorsKey, ...) moved to createEditingAdapter for unified bridging

  // <zh/> crossFieldValidator 在 batch 模式下静默失效（仅 fullRow 模式生效）——dev 模式 warn
  // <en/> crossFieldValidator silently no-ops in batch mode (only effective in fullRow mode) — dev warn
  /**
   * <zh/> 跨字段校验配置告警回调——editType/crossFieldValidator 变化（含 setup immediate）时检查 batch 下的静默失效
   * <en/> Cross-field validator warning callback — warns about silent no-op in batch mode on config change (incl. setup immediate)
   */
  function onEditConfigChangedWarnCrossField([editType, crossFieldValidator]: readonly [unknown, unknown]): void {
    if (!isDev)
      return
    if (editType === 'batch' && typeof crossFieldValidator === 'function' && typeof console !== 'undefined') {
      devWarn(
        '[AdvTable] editConfig.crossFieldValidator is configured but editType is "batch". '
        + 'crossFieldValidator only takes effect under editType="fullRow" and will be silently ignored in batch mode. '
        + 'If cross-row/cross-field validation is required, switch editType to "fullRow" or validate before commitBatchEdit.',
      )
    }
  }
  watch(
    () => [toValue(editConfigInput)?.editType, toValue(editConfigInput)?.crossFieldValidator] as const,
    onEditConfigChangedWarnCrossField,
    { immediate: true, flush: 'post' },
  )

  async function validateFn(params: {
    mode: 'cell' | 'row'
    rowIndex: number
    columnKey: string
    value: unknown
    values?: Record<string, unknown>
    rowData?: unknown
  }): Promise<boolean> {
    if (params.mode === 'row' && params.values) {
      const row = renderData.value[params.rowIndex]
      validateApi.clearRowErrors(params.rowIndex, row)
      const rowValid = await validateApi.validateRow(params.rowIndex, params.values)
      if (!rowValid)
        return false
      const crossValid = await validateApi.validateCrossField(params.rowIndex, params.values)
      if (!crossValid) {
        const crossErrors = validateApi.errors.value
          .filter(e => e.rowIndex === params.rowIndex && e.prop === '__crossField__')
          .map(e => e.message)
        if (crossErrors.length)
          tableEmit('crossFieldValidateError', { rowIndex: params.rowIndex, errors: crossErrors })
      }
      return crossValid
    }
    // <zh/> 透传 rowData（缺省回退渲染域行）——校验器用 rowKey 作错误键，
    // <zh/> 与 UI 的 rowKey 匹配域一致，保证 Enter 提交的校验错误可见。
    // <en/> Forward rowData (fallback to the render-domain row) — the validator keys errors by
    // <en/> rowKey, matching the UI's rowKey domain so Enter-commit validation errors stay visible.
    return validateApi.validateCell(
      params.rowIndex,
      params.columnKey,
      params.value,
      params.rowData ?? renderData.value[params.rowIndex],
    )
  }

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

  const rendererData = computed(() => batchDisplayData.value)

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

  // <zh/> 无范围选择时也构造最小快照复用稀疏路径——rangeSelection 取 null，
  // <zh/> 编辑/脏域仍参与差分，单格提交由 O(n×m) 降为 O(受影响行×m)；选区矩形为 null 时差分恒等，无卡死风险。
  // <en/> always assemble a minimal snapshot (rangeSelection null when absent) to reuse the
  // <en/> sparse path — single-cell cost drops from O(n×m) to O(affected×m); null rect diffs as identity.
  const sparseSnapshotSource = () => ({
    editingCell: editingCell.value,
    editingRowIndex: editingRowIndex.value,
    isFullRowEdit: isFullRowEdit.value,
    rangeSelection: options.rangeSelectionRange?.value ?? null,
    dirtyRowKeys: dirtyRowKeys.value,
    dirtyTrackingEnabled: !!toValue(editConfigInput)?.showStatus,
  })

  const { rowViewModels: tableRowViewModels } = useRowViewModel<T>({
    visibleData: rendererData,
    rowKeyFn: () => rowKeyFn.value,
    isCellEditing: (rowIndex, colKey) => isCellEditing(rowIndex, colKey),
    isCellDirty: (rowIndex, colKey) => isCellDirty(rowIndex, colKey),
    isCellSelected: (rowIndex, colIndex) => isCellInRangeSelection(rowIndex, colIndex),
    // RowViewModel 必须按叶子列计数：顶层组头会使 cells 按组计数，与渲染器叶子索引错位。
    // 叶子序必须与渲染器同源（flattenLeafColumns 的 DFS 前序）——历史上的手写 BFS 会先输出
    // 第一层叶子再输出深层叶子，分组表下 cells[i] 与渲染器实际绘制顺序错位。
    // RowViewModel must count by leaf columns: top-level group headers would make cells grouped,
    // misaligned with the renderer's leaf indices. The leaf order must share the renderer's source
    // (flattenLeafColumns' DFS pre-order) — the historical hand-written BFS emitted first-level
    // leaves before deeper ones, misaligning cells[i] with the actual draw order under grouped columns.
    columns: computed(() => flattenLeafColumns(effectiveColumns.value).filter(
      c => !(c as unknown as { selection?: unknown }).selection,
    )),
    snapshot: sparseSnapshotSource,
  })

  const rowViewModelMap = computed<Map<string, readonly CellState[]>>(buildRowViewModelMap(tableRowViewModels))

  // <zh/> provide(advTableRowViewModelKey, ...) 已移至 createEditingAdapter 统一桥接 |
  // <en/> provide(advTableRowViewModelKey, ...) moved to createEditingAdapter for unified bridging

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
