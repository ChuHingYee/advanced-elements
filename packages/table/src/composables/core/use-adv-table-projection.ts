/**
 * @file use-adv-table-projection.ts
 * @description
 * <zh/> 主编排器返回值投影域（抽离）——原 `useAdvTable` 尾部 260+ 行投影字面量，
 * <zh/> 纯搬移零行为变更。依赖经显式窄接口传入，不再闭包读取装配期局部变量。
 * <en/> Main-orchestrator return projection (extraction) — the 260+ line projection literal
 * <en/> from the tail of `useAdvTable`, moved verbatim Dependencies arrive
 * <en/> via an explicit narrow interface instead of assembly-time closure locals.
 */
import type { Slots } from 'vue'
import type { UseTableApiReturn } from '../api/use-table-api'
import type { UseInteractionOrchestratorReturn } from '../interaction/use-interaction-orchestrator'
import type { UseSelectionOrchestratorReturn } from '../selection/use-selection-orchestrator'
import type { UseAdvTableCoreReturn } from './use-adv-table-core'
import type { UseAdvTableDataColumnsReturn } from './use-adv-table-data-columns'
import type { UseAdvTableFeaturesReturn } from './use-adv-table-features'
import type { UseAdvTableSharedEditingReturn } from './use-adv-table-shared-editing'
import type { UseRendererIntegrationReturn } from './use-renderer-integration'

/**
 * <zh/> 投影依赖——显式窄接口：各域返回对象 + 渲染集成 + 快筛 API + 插槽 + 实例 API。
 * <en/> Projection deps — explicit narrow interface: domain returns plus renderer integration, quick-filter API, slots and instance API.
 */
export interface BuildAdvTableProjectionDeps<T = any> {
  core: UseAdvTableCoreReturn<T>
  dataColumns: UseAdvTableDataColumnsReturn<T>
  selection: UseSelectionOrchestratorReturn
  interaction: UseInteractionOrchestratorReturn
  sharedEditing: UseAdvTableSharedEditingReturn
  features: UseAdvTableFeaturesReturn
  rendererIntegration: UseRendererIntegrationReturn<T>
  quickFilter: {
    setQuickFilter: (text: string) => void
    getQuickFilter: () => string
  }
  slots: Slots
  api: UseTableApiReturn<T>
}

/**
 * <zh/> 组装主编排器返回值——直接暴露各域返回值，消除 buildXxxDomain 样板。
 * <en/> Assemble the main-orchestrator return — exposes domain returns directly, no buildXxxDomain boilerplate.
 */
export function buildAdvTableProjection<T>(deps: BuildAdvTableProjectionDeps<T>) {
  const { core, dataColumns, selection, interaction, sharedEditing, features, rendererIntegration, quickFilter, slots, api } = deps
  return {
    // ── 配置域：从 core + dataColumns 投影（模式经 caps 查询，不再透传 isVirtual 布尔量） ──
    config: {
      tableId: core.tableId,
      mode: core.mode,
      caps: core.rendererAdapter.caps,
      isManual: core.isManual,
      toolbar: core.toolbar,
      elementSize: core.elementSize,
      namespace: core.namespace,
      mergedLoading: dataColumns.mergedLoading,
      mergedPagination: core.mergedPagination,
      mergedSearch: core.mergedSearch,
      mergedRowConfig: core.mergedRowConfig,
      mergedColumnConfig: core.mergedColumnConfig,
      mergedFilterConfig: core.mergedFilterConfig,
      mergedBorder: core.mergedBorder,
      mergedResizable: core.mergedResizable,
      mergedEmptyText: core.mergedEmptyText,
      mergedContainerLayout: core.mergedContainerLayout,
      mergedSizeConfig: core.mergedSizeConfig,
      mergedUiConfig: core.mergedUiConfig,
      sizeCssVars: core.sizeCssVars,
      paginationRef: core.paginationRef,
    },

    // ── 搜索域：从 core + features 投影 ──
    search: {
      searchParams: core.searchParams,
      hasSearch: features.hasSearch,
      tableSearchRef: features.tableSearchRef,
      mergedSearchFields: features.mergedSearchFields,
      handleSearch: features.handleSearch,
      handleReset: features.handleReset,
    },

    // ── 列域：从 dataColumns 投影 ──
    columns: {
      localColumns: dataColumns.localColumns,
      originColumns: dataColumns.originColumns,
      headerFormatMap: dataColumns.headerFormatMap,
      hasColumns: dataColumns.hasColumns,
      resetColumns: dataColumns.resetColumns,
      setColumns: dataColumns.setColumns,
      effectiveColumns: dataColumns.effectiveColumns,
      canCollapse: dataColumns.canCollapse,
      isCollapsed: dataColumns.isCollapsed,
      collapsedState: dataColumns.collapsedState,
      collapsedVersion: dataColumns.collapsedVersion,
      columnClassification: dataColumns.columnClassification,
      columnKeepAlive: dataColumns.columnKeepAlive,
    },

    // ── 数据域：从 core + dataColumns + sharedEditing 投影 ──
    data: {
      tableData: dataColumns.tableData,
      visibleData: dataColumns.visibleData,
      selectableData: dataColumns.selectableData,
      selectableFn: core.selectableFn,
      finalDisplayData: dataColumns.finalDisplayData,
      prePaginationExpandedData: dataColumns.prePaginationExpandedData,
      renderRows: sharedEditing.renderRows,
      rowKeyFn: core.rowKeyFn,
      rowKeyField: core.rowKeyField,
      hasSource: dataColumns.hasSource,
      isPolling: dataColumns.isPolling,
      total: dataColumns.total,
      pagination: dataColumns.pagination,
      refresh: dataColumns.refresh,
      fetchData: dataColumns.fetchData,
      setLoading: dataColumns.setLoading,
      setIsPolling: dataColumns.setIsPolling,
      handleCurrentPageChange: dataColumns.handleCurrentPageChange,
      handlePageSizeChange: dataColumns.handlePageSizeChange,
      handleLoadMore: dataColumns.handleLoadMore,
      getPagination: dataColumns.getPagination,
      setCurrentPageAndRefetch: dataColumns.setCurrentPageAndRefetch,
      setPageSizeAndRefetch: dataColumns.setPageSizeAndRefetch,
      getFullData: dataColumns.getFullData,
    },

    // ── 选择域：从 selection 投影 ──
    selection: {
      selectionState: selection.selectionState,
      checkStatus: selection.checkStatus,
      toggleAllSelection: selection.toggleAllSelection,
      selectAll: selection.selectAll,
      selectAllFiltered: selection.selectAllFiltered,
      deselectAllFiltered: selection.deselectAllFiltered,
      selectAllOnCurrentPage: selection.selectAllOnCurrentPage,
      deselectAllOnCurrentPage: selection.deselectAllOnCurrentPage,
      getSelectedIndices: selection.getSelectedIndices,
      getCurrentPageData: selection.getCurrentPageData,
      refreshSelection: selection.refreshSelection,
      setCurrentRow: selection.setCurrentRow,
      getCurrentRow: selection.getCurrentRow,
    },

    // ── 筛选排序域：从 dataColumns + quickFilter 投影 ──
    filterSort: {
      filterState: dataColumns.filterState,
      sortState: dataColumns.sortState,
      hasActiveFilter: dataColumns.hasActiveFilter,
      hasActiveQuickFilter: dataColumns.hasActiveQuickFilter,
      setFilter: dataColumns.setFilter,
      resetColumnFilter: dataColumns.resetColumnFilter,
      resetAllFilters: dataColumns.resetAllFilters,
      getFilterValue: dataColumns.getFilterValue,
      isColumnFiltered: dataColumns.isColumnFiltered,
      getEnumOptions: dataColumns.getEnumOptions,
      toggleSort: dataColumns.toggleSort,
      setSort: dataColumns.setSort,
      setSorts: dataColumns.setSorts,
      clearSort: dataColumns.clearSort,
      getSortOrder: dataColumns.getSortOrder,
      getSortIndex: dataColumns.getSortIndex,
      setQuickFilter: quickFilter.setQuickFilter,
      getQuickFilter: quickFilter.getQuickFilter,
    },

    // ── 合并域：从 dataColumns 投影 ──
    span: {
      mergedSpanMethod: dataColumns.mergedSpanMethod,
      getSpanInfo: dataColumns.getSpanInfo,
      spanEnabled: dataColumns.spanEnabled,
    },

    // ── 层级域：从 dataColumns 投影 ──
    hierarchy: {
      treeApi: dataColumns.treeApi,
      rowGroupApi: dataColumns.rowGroupApi,
      rowExpandApi: dataColumns.rowExpandApi,
      rowPinApi: dataColumns.rowPinApi,
    },

    // ── 编辑域：从 sharedEditing.editApi 展开 + 非 editApi 字段 ──
    editing: {
      ...sharedEditing.editApi,
      commitEditing: sharedEditing.commitEditing,
      cancelEditing: sharedEditing.cancelEditing,
      submitEdit: sharedEditing.submitEdit,
      discardEdit: sharedEditing.discardEdit,
      hasUnsavedChanges: sharedEditing.hasUnsavedChanges,
      hasPendingChanges: sharedEditing.hasPendingChanges,
      batchHasPending: sharedEditing.batchHasPending,
      batchPendingChanges: sharedEditing.batchPendingChanges,
      batchCommitCells: sharedEditing.batchCommitCells,
      commitBatchEdit: sharedEditing.commitBatchEdit,
      cancelBatchEdit: sharedEditing.cancelBatchEdit,
      undo: sharedEditing.editUndo,
      redo: sharedEditing.editRedo,
      canUndo: sharedEditing.canUndo,
      canRedo: sharedEditing.canRedo,
    },

    // ── IO 域：从 features 投影 ──
    io: {
      exporting: features.exporting,
      exportExcel: features.exportExcel,
      exportingCsv: features.exportingCsv,
      exportCsv: features.exportCsv,
      printing: features.printing,
      doPrint: features.doPrint,
      importing: features.importing,
      triggerImport: features.triggerImport,
    },

    // ── 渲染器域：从 rendererIntegration + dataColumns 投影 ──
    renderer: {
      rendererComponent: rendererIntegration.rendererComponent,
      rendererEvents: rendererIntegration.rendererEvents,
      setRendererRef: rendererIntegration.setRendererRef,
      /**
       * <zh/> 分页器属性——仅由 `props.pagination` 注入的分页开关（含 `background`/`hide-on-single-page` 等）
       * <en/> Pagination attributes — pagination switches injected from `props.pagination` only
       * <en/> (`background` / `hide-on-single-page` / …)
       */
      paginationAttrs: rendererIntegration.paginationAttrs,
      /**
       * <zh/> 归属表格根节点（`#tableId` 作用域根）的属性——使用者的全部 `$attrs` 去掉保留键 `id`
       * <en/> Attributes owned by the table root (the `#tableId` scope root) — the user's whole `$attrs`
       * <en/> minus the reserved `id` key
       */
      rootAttrs: rendererIntegration.rootAttrs,
      /**
       * <zh/> 当前模式的 DOM 适配器——渲染器经 `rendererProps.dom` 获取，是 EP 内部结构的唯一出口
       * <en/> DOM adapter for the current mode — renderers get it via `rendererProps.dom`; the only
       * <en/> outlet for EP internals
       */
      dom: core.rendererAdapter.dom,
      hoverOptionColumns: dataColumns.hoverOptionColumns,
      hasHoverOptionColumns: dataColumns.hasHoverOptionColumns,
      hoverOptionTeleport: dataColumns.hoverOptionTeleport,
      displayNormalColumns: dataColumns.displayNormalColumns,
      selectionColumnSyncKey: dataColumns.selectionColumnSyncKey,
    },

    // ── 交互域：从 interaction 投影 ──
    interaction: {
      tableRootRef: interaction.tableRootRef,
      shiftKeyPressed: interaction.shiftKeyPressed,
      noSelectClass: interaction.noSelectClass,
      isRangeSelecting: interaction.isRangeSelecting,
      dragLocator: interaction.dragLocator,
      rendererHasError: interaction.rendererHasError,
      rendererErrorInfo: interaction.rendererErrorInfo,
      rendererErrorText: interaction.rendererErrorText,
      // <zh/> 错误边界重置透出到 `#error` 插槽 `reset` | <en/> error-boundary reset exposed as the `#error` slot `reset`
      resetRendererError: interaction.resetRendererError,
      containerWidth: interaction.containerWidth,
      isContainerVisible: interaction.isContainerVisible,
    },

    // ── 右键菜单域：从 rendererIntegration.menu 投影 ──
    menu: {
      menuVisible: rendererIntegration.menu.menuVisible,
      menuStyle: rendererIntegration.menu.menuStyle,
      currentItems: rendererIntegration.menu.currentItems,
      currentParams: rendererIntegration.menu.currentParams,
      menuToken: rendererIntegration.menu.menuToken,
      setMenuElRef: rendererIntegration.menu.setMenuElRef,
      handleContextMenu: rendererIntegration.menu.handleContextMenu,
      closeMenu: rendererIntegration.menu.closeMenu,
      onMenuItemClick: rendererIntegration.menu.onMenuItemClick,
    },

    // ── 共享域：从 sharedEditing 投影 ──
    shared: {
      sharedTooltip: sharedEditing.sharedTooltip,
      sharedHeaderTooltip: sharedEditing.sharedHeaderTooltip,
      sharedFilterPopover: sharedEditing.sharedFilterPopover,
      sharedFilterFormKey: sharedEditing.sharedFilterFormKey,
      sharedFilterFormType: sharedEditing.sharedFilterFormType,
      sharedFilterFormValue: sharedEditing.sharedFilterFormValue,
      sharedFilterFormEnumOptions: sharedEditing.sharedFilterFormEnumOptions,
      sharedFilterFormActive: sharedEditing.sharedFilterFormActive,
      handleSharedFilterUpdate: sharedEditing.handleSharedFilterUpdate,
    },

    // ── 侧边栏域：从 features 投影 ──
    sidePanel: {
      isSidePanelEnabled: features.isSidePanelEnabled,
      isColumnSidePanelEnabled: features.isColumnSidePanelEnabled,
      isColumnGroupEnabled: features.isColumnGroupEnabled,
      hasActiveFilters: features.hasActiveFilters,
      activePanel: features.activePanel,
      activePanelPosition: features.activePanelPosition,
      // 本域是**显式白名单投影**，漏掉 keepPanelAlive 时模板读到 undefined，
      // `<KeepAlive :include>` 恒取「不缓存」分支，sidePanelDestroyOnClose=false 静默失效。
      // this domain is an explicit allow-list projection — omitting keepPanelAlive leaves the
      // template reading undefined, so `:include` always takes the non-caching branch and
      // sidePanelDestroyOnClose=false silently stops working.
      keepPanelAlive: features.keepPanelAlive,
      sideBarPositionClass: features.sideBarPositionClass,
      sideButtonPositionModifier: features.sideButtonPositionModifier,
      togglePanel: features.togglePanel,
    },

    // ── 国际化域：从 core + slots 投影 ──
    i18n: {
      t: core.t,
      locale: core.locale,
      slots,
    },

    // ── 调试域：从 core 投影 ──
    debug: core.debug,

    // ── API ──
    api,
  }
}
