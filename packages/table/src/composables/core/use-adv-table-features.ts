/**
 * <zh/> AdvTable 功能域子编排器 — 搜索、导出、侧边栏
 * <en/> AdvTable features domain sub-orchestrator — search, export, side panel
 *
 * @remarks
 * <zh/> 封装 useSearchOrchestrator、useExportOrchestrator、useSidePanelOrchestrator，
 * <zh/> 并构建 tableContext（Export 依赖）。
 * <zh/> 依赖 Core（locale/config/tableId/searchParams 等）、DataColumns（localColumns/tableData 等）、
 * <zh/> Selection（selectionState）、Interaction（containerWidth/isContainerVisible）。
 * <zh/> 右键菜单和渲染器事件依赖 Editing，不在此子编排器中。
 * <en/> Wraps useSearchOrchestrator, useExportOrchestrator, useSidePanelOrchestrator,
 * <en/> and constructs tableContext (needed by Export).
 * <en/> Depends on Core (locale/config/tableId/searchParams etc.), DataColumns (localColumns/tableData etc.),
 * <en/> Selection (selectionState), Interaction (containerWidth/isContainerVisible).
 * <en/> Context menu and renderer events depend on Editing, so they are not included here.
 */
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { AdvTableEmitFn } from '../../types'
import type { AdvColumn } from '../../types/column'
import type { TableContext } from '../../types/config'
import type { AdvTableProps } from '../../types/table-props'
import type { PanelType } from '../features/use-side-panel-orchestrator'
import type { UseTableExportOrchestrationReturn } from '../features/use-table-export'
import type { UseTableImportReturn } from '../features/use-table-import'
import type { UseTablePrintOrchestrationReturn } from '../features/use-table-print'
import type { UseTableSearchReturn } from '../features/use-table-search'
import type { UseInteractionOrchestratorReturn } from '../interaction/use-interaction-orchestrator'
import type { UseSelectionOrchestratorReturn } from '../selection/use-selection-orchestrator'
import type { UseAdvTableModelRefs } from '../use-adv-table'
import type { UseAdvTableCoreReturn } from './use-adv-table-core'
import type { UseAdvTableDataColumnsReturn } from './use-adv-table-data-columns'
import { computed, toValue } from 'vue'
import { createTableEmitter } from '../../utils/table-emitter'
import { useExportOrchestrator } from '../features/use-export-orchestrator'
import { useSearchOrchestrator } from '../features/use-search-orchestrator'
import { useSidePanelOrchestrator } from '../features/use-side-panel-orchestrator'

export interface UseAdvTableFeaturesOptions<T> {
  /** <zh/> 列集合（等价既往 `props.columns`） | <en/> Column list (equivalent to the former `props.columns`) */
  columns: MaybeRefOrGetter<AdvColumn<T>[] | undefined>
  /** <zh/> 搜索配置（等价既往 `props.search`） | <en/> Search config (equivalent to the former `props.search`) */
  search: MaybeRefOrGetter<AdvTableProps<T>['search']>
  /** <zh/> 工具栏配置（等价既往 `props.toolbar`） | <en/> Toolbar config (equivalent to the former `props.toolbar`) */
  toolbar: MaybeRefOrGetter<AdvTableProps<T>['toolbar']>
  emit: AdvTableEmitFn
  models: UseAdvTableModelRefs<T>
  core: UseAdvTableCoreReturn<T>
  dataColumns: UseAdvTableDataColumnsReturn<T>
  selection: UseSelectionOrchestratorReturn
  interaction: UseInteractionOrchestratorReturn
  /**
   * <zh/> 未提交编辑探测——只有一个窄 getter 跨域进入本子编排器（导出守卫用），
   * <zh/> 不为此引入对编辑域的完整依赖。
   * <en/> Uncommitted-edit probe — a single narrow getter crossing into this sub-orchestrator
   * <en/> (for the export guard), avoiding a full dependency on the editing domain.
   */
  hasUnsavedChanges?: () => boolean
}

/**
 * <zh/> 域契约：下游禁读内部字段——仅暴露搜索/导出/打印/导入/侧边栏的最小消费集合与 tableContext；
 * <zh/> 编排器内部的 searchParams 转发、分页引用等中间量不在此列，下游不得绕过契约直读。
 * <en/> Domain contract: downstream must not read internal fields — only the minimal
 * <en/> search/export/print/import/side-panel consumption set plus tableContext is exposed;
 * <en/> orchestrator-internal intermediaries (searchParams forwarding, pagination refs, …) stay out.
 */
export interface UseAdvTableFeaturesReturn<T = any> {
  tableSearchRef: UseTableSearchReturn['tableSearchRef']
  hasSearch: UseTableSearchReturn['hasSearch']
  mergedSearchFields: UseTableSearchReturn['mergedSearchFields']
  handleSearch: UseTableSearchReturn['handleSearch']
  getQueryFormModel: UseTableSearchReturn['getQueryFormModel']
  setQueryFormModel: UseTableSearchReturn['setQueryFormModel']
  handleReset: UseTableSearchReturn['handleReset']
  exporting: UseTableExportOrchestrationReturn<T>['exporting']
  exportExcel: UseTableExportOrchestrationReturn<T>['exportExcel']
  exportingCsv: UseTableExportOrchestrationReturn<T>['exportingCsv']
  exportCsv: UseTableExportOrchestrationReturn<T>['exportCsv']
  printing: UseTablePrintOrchestrationReturn['printing']
  doPrint: UseTablePrintOrchestrationReturn['print']
  importing: UseTableImportReturn['importing']
  triggerImport: UseTableImportReturn['triggerImport']
  isSidePanelEnabled: ComputedRef<boolean>
  isColumnSidePanelEnabled: ComputedRef<boolean>
  isColumnGroupEnabled: ComputedRef<boolean>
  hasActiveFilters: ComputedRef<boolean>
  activePanel: Ref<PanelType | null>
  activePanelPosition: ComputedRef<'left' | 'right'>
  /** <zh/> 面板实例是否需保留（驱动 `<KeepAlive :include>`） | <en/> whether the panel instance is retained (drives `<KeepAlive :include>`) */
  keepPanelAlive: ComputedRef<boolean>
  sideBarPositionClass: ComputedRef<string>
  sideButtonPositionModifier: ComputedRef<string>
  togglePanel: (panel: PanelType) => void
  tableContext: TableContext
}

/**
 * <zh/> AdvTable 功能域子编排器——组合搜索、导出/打印/导入、侧边栏编排器并构建 tableContext。
 * <en/> AdvTable features domain sub-orchestrator — composes the search, export/print/import and
 * <en/> side-panel orchestrators and builds tableContext.
 *
 * @param options - <zh/> 功能域依赖（列/搜索/工具栏配置与各上游编排器返回值） | <en/> Features-domain deps (column/search/toolbar configs and upstream orchestrator returns)
 * @returns <zh/> 搜索、导出、侧边栏状态与方法及 tableContext | <en/> Search, export and side-panel state/methods plus tableContext
 */
export function useAdvTableFeatures<T>(options: UseAdvTableFeaturesOptions<T>): UseAdvTableFeaturesReturn<T> {
  const { columns, search, toolbar, emit: emitFn, models, core, dataColumns, selection, interaction, hasUnsavedChanges } = options
  const tableEmit = createTableEmitter(emitFn, core.tableId)

  const currencyRef = computed(() => core.locale.value.currency ?? { symbol: '¥', locale: 'zh-CN' })
  const tableContext: TableContext = {
    refresh: dataColumns.refresh,
    loading: dataColumns.mergedLoading,
    columnEmptyText: computed(() => core.mergedUiConfig.value.columnEmptyText ?? '-'),
    namespace: core.namespace,
    currency: currencyRef,
    dayjsLocale: core.dayjsLocaleName,
    rowKeyMeta: dataColumns.rowKeyMeta,
    containerWidth: interaction.containerWidth,
    containerVisible: interaction.isContainerVisible,
    getLogicalIndex: row => dataColumns.rowExpandApi.getLogicalIndex?.(row),
  }

  const {
    tableSearchRef,
    hasSearch,
    mergedSearchFields,
    handleSearch,
    getQueryFormModel,
    setQueryFormModel,
    handleReset,
  } = useSearchOrchestrator<T>({
    searchParams: core.searchParams,
    localColumns: dataColumns.localColumns,
    rawColumns: () => toValue(columns) as AdvColumn<T>[],
    searchConfig: () => toValue(search),
    defaultValues: () => toValue(search)?.defaultValues,
    searchEnabled: () => core.mergedSearch.value.enabled,
    hasColumnSearch: () => core.hasColumnSearch.value,
    translation: core.t,
    searchValuesModel: models.searchValues,
    pagination: dataColumns.pagination,
    isUnmounted: () => core.isUnmounted.value,
    fetchData: dataColumns.fetchData,
    emit: emitFn,
    tableId: core.tableId,
  })

  const {
    exporting,
    exportExcel,
    exportingCsv,
    exportCsv,
    printing,
    doPrint,
    importing,
    triggerImport,
  } = useExportOrchestrator<T>({
    columnClassification: dataColumns.columnClassification,
    localColumns: dataColumns.localColumns,
    tableData: dataColumns.tableData,
    visibleData: dataColumns.visibleData,
    filteredData: dataColumns.finalDisplayData,
    selectionState: selection.selectionState,
    tableContext,
    effectiveColumns: dataColumns.effectiveColumns,
    exportOptions: () => toValue(toolbar)?.exportOptions,
    exportCsvOptions: () => toValue(toolbar)?.exportCsvOptions,
    printOptions: () => toValue(toolbar)?.printOptions,
    importOptions: () => toValue(toolbar)?.importOptions,
    t: core.t,
    onDataUpdate: (rows, mode) => {
      if (mode === 'replace') {
        dataColumns.handleDataUpdate(rows)
      }
      else {
        dataColumns.handleDataUpdate([...dataColumns.tableData.value, ...rows])
      }
    },
    onDataImport: (rows, mode) => tableEmit('dataImport', { rows, mode }),
    emit: emitFn,
    handleError: core.handleError,
    notify: core.notify,
    hasUnsavedChanges,
  })

  const {
    isSidePanelEnabled,
    isColumnSidePanelEnabled,
    isColumnGroupEnabled,
    hasActiveFilters,
    activePanel,
    activePanelPosition,
    keepPanelAlive,
    sideBarPositionClass,
    sideButtonPositionModifier,
    togglePanel,
  } = useSidePanelOrchestrator({
    mergedFilterConfig: core.mergedFilterConfig,
    filterPanelApi: dataColumns.filterPanelApi,
    mergedColumnConfig: core.mergedColumnConfig,
    columnGroupApi: dataColumns.columnGroupApi,
  })

  return {
    tableSearchRef,
    hasSearch,
    mergedSearchFields,
    handleSearch,
    getQueryFormModel,
    setQueryFormModel,
    handleReset,
    exporting,
    exportExcel,
    exportingCsv,
    exportCsv,
    printing,
    doPrint,
    importing,
    triggerImport,
    isSidePanelEnabled,
    isColumnSidePanelEnabled,
    isColumnGroupEnabled,
    hasActiveFilters,
    activePanel,
    activePanelPosition,
    keepPanelAlive,
    sideBarPositionClass,
    sideButtonPositionModifier,
    togglePanel,
    tableContext,
  }
}

/** <zh/> 显式域契约已在上定义（替代 ReturnType 推断） | <en/> Explicit domain contract defined above (replaces ReturnType inference) */
