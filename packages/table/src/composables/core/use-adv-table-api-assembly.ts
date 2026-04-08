/**
 * @file use-adv-table-api-assembly.ts
 * @description <zh/> AdvTable 实例 API 装配域。
 * @description <en/> AdvTable instance API assembly.
 *
 * @remarks
 * <zh/> `useScrollToRowColumn` 为纯函数（无生命周期/实例依赖），`useTableApi` 的 `onScopeDispose`
 * <zh/> 注册在当前 setup scope，同步调用下归属不变。调用顺序与原文件一致。
 * <en/> `useScrollToRowColumn` is pure; `useTableApi` scope disposal stays on the current setup scope
 * <en/> under synchronous invocation. Order matches the original.
 */
import type { ProcessedColumn } from '../../types'
import type { AdvTableProps } from '../../types/table-props'
import type { UseTableApiReturn } from '../api/use-table-api'
import type { UseScrollToRowColumnReturn } from '../scrolling/use-scroll-to-row-column'
import type { UseSelectionOrchestratorReturn } from '../selection/use-selection-orchestrator'
import type { UseAdvTableCoreReturn } from './use-adv-table-core'
import type { UseAdvTableDataColumnsReturn } from './use-adv-table-data-columns'
import type { UseAdvTableFeaturesReturn } from './use-adv-table-features'
import type { UseAdvTableSharedEditingReturn } from './use-adv-table-shared-editing'
import type { SetupAdvTableWatchersReturn } from './use-adv-table-watchers'
import type { UseRendererIntegrationReturn } from './use-renderer-integration'
import { computed } from 'vue'
import { flattenLeafColumns } from '../../utils/column-tree'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { useTableApi } from '../api/use-table-api'
import { useScrollToRowColumn } from '../scrolling/use-scroll-to-row-column'

export interface AssembleAdvTableApiDeps<T> {
  props: AdvTableProps<T>
  core: UseAdvTableCoreReturn<T>
  dataColumns: UseAdvTableDataColumnsReturn<T>
  selection: UseSelectionOrchestratorReturn
  features: UseAdvTableFeaturesReturn<T>
  sharedEditing: UseAdvTableSharedEditingReturn
  rendererIntegration: UseRendererIntegrationReturn<T>
  quickFilter: SetupAdvTableWatchersReturn['quickFilter']
  scrollApi?: UseScrollToRowColumnReturn
}

/**
 * <zh/> 收集行校验值——纯函数，可单测；仅取可编辑且有编辑器与 prop 的列。
 * <en/> Collect row validation values — pure and unit-testable; only editable columns with an editor and prop.
 */
export function collectValidateRowValues<T>(
  row: T,
  effectiveColumns: ReadonlyArray<ProcessedColumn>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  // 遍历叶子列——分组子列同样参与校验值收集
  for (const col of flattenLeafColumns(effectiveColumns)) {
    if (col.editable && col.cellEditor && typeof col.prop === 'string') {
      values[col.prop] = (row as Record<string, unknown>)[col.prop]
    }
  }
  return values
}

/**
 * <zh/> 装配实例 API——直接从各编排器投影，不再经过中间 builder 层。
 * <en/> Build API — project directly from orchestrators, no intermediate builder layer (moved from useAdvTable).
 */
export function assembleAdvTableApi<T>(deps: AssembleAdvTableApiDeps<T>): UseTableApiReturn<T> {
  const { props, core, dataColumns, selection, features, sharedEditing, rendererIntegration, quickFilter } = deps

  // <zh/> 统一滚动策略：双渲染器 scrollTo 归一化，定位入参统一为 rowKey/columnKey 字符串。
  // <zh/> 顶层调用 composable（Vue 约定：setup 同步顶层），避免对象字面量内 IIFE 遮蔽调用位置。
  // <en/> Unified scroll strategy: dual-renderer scrollTo convergence with rowKey/columnKey string targeting.
  // <en/> Called at setup top level per Vue convention; avoids hiding the call inside an object-literal IIFE.
  const scrollApi = deps.scrollApi ?? useScrollToRowColumn({
    caps: core.rendererAdapter.caps,
    getScrollApi: () => core.activeRenderer.value as unknown as import('../../utils/table-drag').RendererScrollApi | null,
    tableId: core.tableId,
  })

  /**
   * <zh/> 动态行高重测委托——直达当前活跃渲染器；default 渲染器未实现该方法时返回 false。
   * <zh/> 顶层调用 composable（Vue 约定：setup 同步顶层），避免对象字面量内 IIFE 遮蔽调用位置。
   * <en/> Dynamic row-height reset delegation — straight through to the active renderer;
   * <en/> false when the default renderer (which implements no such method) is active.
   * <en/> Called at setup top level per Vue convention; avoids hiding the call inside an object-literal IIFE.
   */
  const getRowHeightApi = (): import('../../utils/table-drag').RendererRowHeightApi | null =>
    core.activeRenderer.value as unknown as import('../../utils/table-drag').RendererRowHeightApi | null
  const rowHeightApi = {
    resetAfterRowIndex: (index: number = 0, forceUpdate: boolean = false): boolean =>
      getRowHeightApi()?.resetAfterRowIndex?.(index, forceUpdate) ?? false,
    refreshVirtualRowHeight: (index: number = 0): boolean =>
      getRowHeightApi()?.refreshVirtualRowHeight?.(index) ?? false,
  }

  /**
   * <zh/> 构建 API——直接从各编排器投影，不再经过中间 builder 层
   * <en/> Build API — project directly from orchestrators, no intermediate builder layer
   */
  const api = useTableApi<T>({
    tableId: core.tableId,
    // <zh/> 持久化配置透传——列状态与命名视图共享同一适配器注入链
    // <en/> Passthrough persistence config — column-state and named views share the same adapter injection chain
    persistence: computed(() => props.columnState),
    dataColumns: {
      refresh: dataColumns.refresh,
      loading: dataColumns.mergedLoading,
      setLoading: dataColumns.setLoading,
      // <zh/> manual/远程回写通道——随 requestId 回显可丢弃过期响应（见 use-table-request 守卫）
      // <en/> Manual/remote write-back channel — echoing requestId lets stale responses be dropped (see the guard in use-table-request)
      setResponseData: dataColumns.setResponseData,
      getPagination: dataColumns.getPagination,
      setCurrentPageAndRefetch: dataColumns.setCurrentPageAndRefetch,
      setPageSizeAndRefetch: dataColumns.setPageSizeAndRefetch,
      getFullData: dataColumns.getFullData,
      effectiveColumns: () => dataColumns.effectiveColumns.value,
      visibleData: () => dataColumns.visibleData.value,
      applyTransaction: dataColumns.applyTransaction,
      // 公开 rollbackLast
      rollbackLast: () => core.dataTransaction.rollbackLast(),
      setFilter: dataColumns.setFilter,
      resetColumnFilter: dataColumns.resetColumnFilter,
      resetAllFilters: dataColumns.resetAllFilters,
      getFilterValue: dataColumns.getFilterValue,
      isColumnFiltered: dataColumns.isColumnFiltered,
      hasActiveFilter: dataColumns.hasActiveFilter,
      hasActiveQuickFilter: dataColumns.hasActiveQuickFilter,
      toggleSort: dataColumns.toggleSort,
      setSort: dataColumns.setSort,
      setSorts: dataColumns.setSorts,
      clearSort: dataColumns.clearSort,
      getSortOrder: dataColumns.getSortOrder,
      getSortIndex: dataColumns.getSortIndex,
      getColumnState: dataColumns.getColumnState,
      applyColumnState: dataColumns.applyColumnState,
      resetColumnState: dataColumns.resetColumnState,
      treeApi: dataColumns.treeApi,
      rowExpandApi: dataColumns.rowExpandApi,
      rowGroupApi: dataColumns.rowGroupApi,
      rowPinApi: dataColumns.rowPinApi,
      renderData: () => dataColumns.renderData.value,
    },
    selection: {
      selectionState: selection.selectionState,
      toggleAllSelection: selection.toggleAllSelection,
      invertSelection: selection.invertSelection,
      selectAll: selection.selectAll,
      selectAllFiltered: selection.selectAllFiltered,
      deselectAllFiltered: selection.deselectAllFiltered,
      selectAllOnCurrentPage: selection.selectAllOnCurrentPage,
      deselectAllOnCurrentPage: selection.deselectAllOnCurrentPage,
      getSelectedIndices: selection.getSelectedIndices,
      refreshSelection: selection.refreshSelection,
      setCurrentRow: selection.setCurrentRow,
      getCurrentRow: selection.getCurrentRow,
      getCurrentPageData: selection.getCurrentPageData,
    },
    features: {
      getQueryFormModel: features.getQueryFormModel,
      setQueryFormModel: features.setQueryFormModel,
      tableSearchRef: features.tableSearchRef,
      exportExcel: features.exportExcel,
      exportCsv: features.exportCsv,
      print: features.doPrint,
      triggerImport: features.triggerImport,
      importing: features.importing,
    },
    sharedEditing: {
      startEditing: sharedEditing.editApi.startEditing,
      stopEditing: sharedEditing.editApi.stopEditing,
      updateCellEditingValue: sharedEditing.editApi.updateCellEditingValue,
      getCellEditingValue: sharedEditing.editApi.getCellEditingValue,
      commitBatchEdit: sharedEditing.commitBatchEdit,
      cancelBatchEdit: sharedEditing.cancelBatchEdit,
      hasPendingChanges: sharedEditing.hasPendingChanges,
      batchHasPending: sharedEditing.batchHasPending,
      batchPendingChanges: sharedEditing.batchPendingChanges,
      submitEdit: sharedEditing.submitEdit,
      discardEdit: sharedEditing.discardEdit,
      validate: sharedEditing.validateApi.validateAll,
      validateRow: (rowIndex: number): Promise<boolean> => {
        // <zh/> 行索引域与渲染器/编辑链对齐：取唯一渲染源 renderRows（= batch 应用后，
        // <zh/> 无编辑配置时透传 renderData），与 table.vue 渲染/overflowTooltip 同源。
        // <zh/> Row Pinning 启用时 renderData 已剔除 pinned 行——误传 visibleData 域索引会校验到相邻行，
        // <zh/> 此处 dev-only 提示域误用（生产零开销），索引类型保持 number 以兼容公开 API。
        // <en/> Row-index domain aligned with renderer/editing: read the single render source
        // <en/> renderRows (= post-batch, passthrough to renderData without editConfig), same source
        // <en/> as table.vue rendering/overflow tooltip.
        // <en/> With Row Pinning on, renderData excludes pinned rows — passing a visibleData-domain
        // <en/> index validates the neighboring row. Dev-only hint for domain misuse (zero prod cost);
        // <en/> the index type stays number for public API compatibility.
        const renderRows = sharedEditing.renderRows.value
        const row = renderRows[rowIndex]
        if (!row) {
          if (isDev) {
            const visibleLen = dataColumns.visibleData.value.length
            const pinOn = dataColumns.rowPinApi?.pinEnabled.value ?? false
            if (pinOn && rowIndex >= 0 && rowIndex < visibleLen && rowIndex >= renderRows.length) {
              devWarn(
                `validateRow(${rowIndex}) out of renderRows (${renderRows.length}) but inside visibleData (${visibleLen})`
                + ` with rowPin on — you may have passed a visibleData-domain index;`
                + ` validateRow expects the renderData-domain index (pinned rows excluded).`
                + ` Convert via toRenderDataIndex(visibleIndex, topPinnedCount, renderRowCount).`,
              )
            }
          }
          return Promise.resolve(true)
        }
        return sharedEditing.validateApi.validateRow(rowIndex, collectValidateRowValues(row, dataColumns.effectiveColumns.value))
      },
      clearValidate: sharedEditing.validateApi.clearErrors,
      undo: sharedEditing.editUndo,
      redo: sharedEditing.editRedo,
      canUndo: sharedEditing.canUndo,
      canRedo: sharedEditing.canRedo,
      hasUnsavedChanges: sharedEditing.hasUnsavedChanges,
    },
    contextMenu: {
      showContextMenu: rendererIntegration.menu.handleContextMenu,
      hideContextMenu: rendererIntegration.menu.closeMenu,
    },
    scroll: {
      scrollToRow: scrollApi.scrollToRow,
      scrollToColumn: scrollApi.scrollToColumn,
    },
    rowHeight: rowHeightApi,
    getRowKey: (...args: Parameters<typeof core.rowKeyFn.value>) => core.rowKeyFn.value(...args),
    setQuickFilter: quickFilter.setQuickFilter,
    getQuickFilter: quickFilter.getQuickFilter,
  })

  return api
}
