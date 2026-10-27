import type { ProcessedColumn } from '../../types'
import type { UseColumnFilterReturn } from '../data/use-column-filter'
import type { UseColumnSortReturn } from '../data/use-column-sort'
import type { UseTableDataPipelineOptions } from './use-table-data-pipeline-types'
import { computed, toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { useCellSpan } from '../data/use-cell-span'
import { useRowPin } from '../data/use-row-pin'
import { usePaginationVisibility } from './use-pagination-visibility'
import { usePipelineClassification } from './use-pipeline-classification'
import { usePipelineFilterSort } from './use-pipeline-filter-sort'
import { refStable, shallowArrayStable } from './use-pipeline-stable'

export type { DataPipelineStage } from '../../types/config-options'

export type { ColumnClassification } from './use-column-classification'

export { DEFAULT_PIPELINE_ORDER, resolvePipelineOrder } from './use-table-data-pipeline-order'
// <zh/> 契约类型与管线顺序解析自子模块 re-export，既有导入路径零变化 | <en/> Contract types and order resolution re-exported from sub-modules; import paths unchanged
export type { UseTableDataPipelineOptions } from './use-table-data-pipeline-types'

/**
 * <zh/> 表格数据管线 Composable | <en/> Table data pipeline composable
 *
 * <zh/> 编排列筛选→全局搜索→外部筛选→排序→分页→合并单元格的数据处理链 | <en/> Orchestrates column filter → global search → external filter → sort → pagination → cell span data processing chain
 *
 * @param options - <zh/> 管线各阶段配置 | <en/> pipeline stage configurations
 * @returns <zh/> 管线结果：列分类、分页数据、筛选/排序 API、合并单元格等 | <en/> pipeline results: column classification, paginated data, filter/sort API, cell span, etc.
 */
export function useTableDataPipeline<T = any>(options: UseTableDataPipelineOptions<T>) {
  const {
    localColumns,
    pipelineData,
    tableData,
    selectableFn,
    isClientPagination,
    currentPage,
    pageSize,
    rowSpanCells,
    colSpanCells,
    ranges,
    userSpanMethod,
    quickFilterText,
    externalFilter,
    treeConfig,
    rowGroupConfig,
    rowExpandConfig,
    rowPinConfig,
    includeSynthetic,
    rowKeyFn,
    groupTotalRow,
    totalValueGetter,
    sumText,
    t,
    suppressStickyTotalRow,
    groupSuppressBlankHeader,
    sortState: injectedSortState,
    filterState: injectedFilterState,
    quickFilterCacheSize,
    maxSortColumns,
    debug: _debugLogger,
  } = options

  // <zh/> 管线阶段计时与日志——debug 关闭时短路无开销 | <en/> Pipeline stage timing & logging — short-circuited when debug disabled
  const dbg = _debugLogger?.scoped('data')

  // <zh/> 列分类 + tree/group 互斥校验自 use-pipeline-classification.ts 拆出（刀法 C）
  // <en/> Column classification + tree/group mutex check split into use-pipeline-classification.ts (knife C)
  const { columnClassification } = usePipelineClassification({
    localColumns,
    treeConfig: () => toValue(treeConfig),
    rowGroupConfig: () => toValue(rowGroupConfig),
    devWarn: options.devWarn,
  })

  // <zh/> 按需注册（noop→真实 composable 懒升级）见 use-pipeline-filter-sort.ts <en/> On-demand registration (noop→real lazy upgrades) lives in use-pipeline-filter-sort.ts

  // <zh/> 筛选/排序懒升级引擎（noop 存根 + apiRef 升级 + 阶段链）自 use-pipeline-filter-sort.ts 拆出（刀法 C）
  // <en/> Lazy filter/sort upgrade engine (noop stubs + apiRef upgrades + stage chain) split into use-pipeline-filter-sort.ts (knife C)
  const {
    finalDisplayData,
    filterApiRef,
    quickFilterApiRef,
    sortApiRef,
    noopFilterApi,
    noopSortApi,
  } = usePipelineFilterSort<T>({
    columnClassification,
    pipelineData,
    tableData,
    pipelineOrder: options.pipelineOrder,
    quickFilterText,
    externalFilter,
    rowKeyFn,
    quickFilterCacheSize,
    maxSortColumns,
    onSortWorkerError: options.onSortWorkerError,
    devWarn: options.devWarn,
    sortState: injectedSortState,
    filterState: injectedFilterState,
  })

  // <zh/> 管线可见性已抽取为 usePaginationVisibility，单点维护双分支语义 | <en/> Pipeline visibility extracted to usePaginationVisibility, single point for dual-branch semantics
  const {
    visibleData,
    prePaginationExpandedData,
    treeApi,
    rowGroupApi,
    rowExpandApi,
  } = usePaginationVisibility<T>({
    finalDisplayData,
    isClientPagination,
    currentPage,
    pageSize,
    treeConfig: () => toValue(treeConfig),
    rowGroupConfig: () => toValue(rowGroupConfig),
    rowExpandConfig: () => toValue(rowExpandConfig),
    rowKeyFn: () => toValue(rowKeyFn) ?? (() => ''),
    includeSynthetic,
    onRowExpandStorageError: options.onRowExpandStorageError,
    onRowExpand: options.onRowExpand,
    onRowCollapse: options.onRowCollapse,
    columns: () => toValue(localColumns) as readonly ProcessedColumn[] | undefined,
    groupTotalRow: () => toValue(groupTotalRow),
    totalValueGetter: () => toValue(totalValueGetter),
    sumText: () => toValue(sumText),
    t: () => toValue(t),
    suppressStickyTotalRow: () => toValue(suppressStickyTotalRow),
    groupSuppressBlankHeader: () => toValue(groupSuppressBlankHeader),
  })

  // <zh/> Row Pinning：在分页后的 visibleData 上提取 pinned 行 <en/> Row Pinning: extract pinned rows from the paginated visibleData
  const rowPinResult = useRowPin<T>({
    rowPinConfig: () => toValue(rowPinConfig),
    visibleData,
    rowKeyFn: () => toValue(rowKeyFn) ?? (() => ''),
    onPinLimitExceeded: options.onPinLimitExceeded,
  })
  const rowPinApi = rowPinResult.rowPinApi

  /**
   * <zh/> 最终渲染数据——Row Pinning 启用时返回 unpinnedData（pinned 行由渲染器独立渲染），
   * <zh/> 未启用时直接透传 visibleData
   * <en/> Final render data — when Row Pinning enabled returns unpinnedData (pinned rows rendered independently),
   * <en/> otherwise passes through visibleData
   */
  const renderData = computed<T[]>((prev) => {
    if (!rowPinResult.pinEnabled.value)
      return refStable(prev, visibleData.value)
    return shallowArrayStable(prev, rowPinResult.unpinnedData.value)
  })

  // <zh/> 管线阶段日志：renderData（含 Row Pinning 状态） | <en/> Pipeline stage log: renderData (including Row Pinning status)
  if (dbg) {
    /**
     * <zh/> 渲染数据日志回调——renderData 引用变化即记录行数与固定行数（debug 通道启用时）
     * <en/> Render-data log callback — logs row/pinned counts on renderData reference change (debug channel only)
     */
    function onRenderDataLogged(val: T[]): void {
      const pinnedCount = rowPinResult.pinEnabled.value ? (rowPinResult.topPinnedRows.value.length + rowPinResult.bottomPinnedRows.value.length) : 0
      dbg!.log(`renderData: ${val.length} rows${pinnedCount ? ` (${pinnedCount} pinned)` : ''}`)
    }
    watch(renderData, onRenderDataLogged)
  }

  // <zh/> 合并单元格 × 行固定已统一索引域：spanMap 建在 unpinned 域，default 渲染器的 composed 域行号
  // <zh/> 经行对象身份换算后查询（见 useCellSpan.spanMethod），pin 条带/grand 行换算落空即不合并；
  // <zh/> virtual 模式 pin 条带本就不走 span 查询。两特性可放心组合。
  // <zh/> 注意：以下守卫声明在 spanApi 之后（watch immediate 同步执行，避免 TDZ）。
  // <en/> Cell-span × row-pin share a unified index domain: spanMap is built on the unpinned domain and
  // <en/> the default renderer's composed-domain row numbers are translated by row identity (see
  // <en/> useCellSpan.spanMethod); pinned strips/grand rows miss the translation and never merge.
  // <en/> Virtual-mode pin strips never consult span in the first place. The two features compose safely.
  // <en/> NOTE: guards below are declared after spanApi — immediate watcher callbacks run synchronously (TDZ hazard).

  const selectableData = computed<T[]>((prev) => {
    const selectablePredicate = toValue(selectableFn)
    const data = renderData.value
    if (!selectablePredicate)
      return refStable(prev, data)
    return shallowArrayStable(prev, data.filter((row, index) => selectablePredicate(row, index)))
  })

  const spanApi = useCellSpan({
    columns: () => columnClassification.value.normal,
    data: renderData,
    rowSpanCells: () => toValue(rowSpanCells),
    colSpanCells: () => toValue(colSpanCells),
    ranges: () => toValue(ranges),
    userSpanMethod: () => toValue(userSpanMethod),
    onSpanLimitExceeded: options.onSpanLimitExceeded,
  })

  // <zh/> 合并 × 固定行无需组合防护——索引域已统一（见上方注释），两特性可放心组合
  // <en/> No span×pin guard needed — index domains are unified (see above); the two features compose safely

  /**
   * <zh/> 固定列×固定行组合防护回调——任一开关变化（含 setup immediate）即检查，dev 下提示层叠预期
   * <en/> Fixed-column×pin guard callback — checks on either toggle change (incl. setup immediate); dev-hints stacking expectation
   */
  function onFixedPinCombinationChanged([hasFixed, pinOn]: readonly [boolean, boolean]): void {
    if (!isDev || !hasFixed || !pinOn)
      return
    const message
      = '[AdvTable] Both fixed columns and rowPinConfig are enabled. '
        + 'Pinned strips are rendered with z-index:2 above fixed columns; '
        + 'ensure fixed column widths are numeric to avoid horizontal misalignment with pinned strips.'
    if (options.devWarn)
      options.devWarn(message)
    else if (typeof console !== 'undefined')
      devWarn(message)
  }
  // <zh/> 固定列 × 行固定 组合防护——pin-strip 置于 z-index:2 已避免遮挡，此处仅 dev 提示固定列与固定行同时启用时的层叠预期 | <en/> Fixed-column × row-pin guard — pin-strip is z-index:2 to avoid covering; dev hint for stacking expectation when both enabled
  watch(
    () => [columnClassification.value.hasFixed, rowPinResult.pinEnabled.value] as const,
    onFixedPinCombinationChanged,
    { immediate: true, flush: 'post' },
  )

  return {
    columnClassification,
    selectableData,
    finalDisplayData,
    prePaginationExpandedData,
    visibleData,
    spanMethod: spanApi.spanMethod,
    getSpanInfo: spanApi.getSpanInfo,
    spanEnabled: spanApi.spanEnabled,
    /**
     * <zh/> 以下筛选/排序 API 通过 getter 代理——始终从 apiRef 读取最新值，
     * <zh/> 确保 noop→真实 composable 升级后，下游拿到的 filterState/setFilter 等也同步更新
     * <en/> The following filter/sort APIs use getter proxies — always read the latest value from apiRef,
     * <en/> ensuring filterState/setFilter etc. update synchronously after noop→real composable upgrade
     */
    get filterState() { return filterApiRef.value.filterState },
    get hasActiveFilter() { return filterApiRef.value.hasActiveFilter },
    get setFilter() { return filterApiRef.value.setFilter },
    get resetColumnFilter() { return filterApiRef.value.resetColumnFilter },
    get resetAllFilters() { return filterApiRef.value.resetAllFilters },
    get getEnumOptions() { return filterApiRef.value.getEnumOptions },
    get getFilterValue() { return filterApiRef.value.getFilterValue },
    get isColumnFiltered() { return filterApiRef.value.isColumnFiltered },
    get invalidateRowCache() { return filterApiRef.value.invalidateRowCache },
    get filteredData() { return filterApiRef.value.filteredData },
    get sortState() { return sortApiRef.value.sortState },
    get toggleSort() { return sortApiRef.value.toggleSort },
    get setSort() { return sortApiRef.value.setSort },
    get setSorts() { return sortApiRef.value.setSorts },
    get clearSort() { return sortApiRef.value.clearSort },
    get getSortOrder() { return sortApiRef.value.getSortOrder },
    get getSortIndex() { return sortApiRef.value.getSortIndex },
    get sortedData() { return sortApiRef.value.sortedData },
    get hasActiveQuickFilter() { return quickFilterApiRef.value.hasActiveQuickFilter },
    get quickFilteredData() { return quickFilterApiRef.value.filteredData },
    /** 按 rowKey 清除快速筛选缓存，用于编辑提交后使缓存失效 */
    get invalidateQuickFilterRowCache() { return quickFilterApiRef.value.invalidateRowCache },
    /** 批量按 rowKey 清除快速筛选缓存，用于批量编辑/导入等场景 */
    get invalidateQuickFilterRowCacheBatch() { return quickFilterApiRef.value.invalidateRowCacheBatch },
    /** 筛选/排序是否已升级为真实实现（替代静默 noop，便于调用方显式分支） */
    get isFilterUpgraded() { return filterApiRef.value !== (noopFilterApi as unknown as UseColumnFilterReturn) },
    get isSortUpgraded() { return sortApiRef.value !== (noopSortApi as unknown as UseColumnSortReturn) },
    treeApi,
    rowGroupApi,
    rowExpandApi,
    rowPinApi,
    /** <zh/> 最终渲染数据（Row Pinning 启用时排除 pinned 行） | <en/> Final render data (pinned rows excluded when Row Pinning enabled) */
    renderData,
  }
}
