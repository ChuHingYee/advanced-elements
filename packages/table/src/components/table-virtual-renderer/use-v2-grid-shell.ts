/**
 * <zh/> virtual 渲染器的网格装配壳
 * <en/> Virtual-renderer grid assembly shell
 *
 * @remarks
 * <zh/> 职责单一：把「列 → 汇总 → 合并 → 表头 → 定位」五级装配串成一条流水线，产出模板与
 * <zh/> `defineExpose` 所需的全部绑定。各阶段自身已独立成域（use-v2-grand-total / use-v2-columns /
 * <zh/> use-v2-summary / use-virtual-span / use-v2-scroll-to / v2-header），本壳只负责**依赖次序**——
 * <zh/> 例如 `v2Columns` 必须先于 span 与 scrollTo 就位，`v2KeyToOriginalCol` 必须先于汇总单元格。
 *
 * <zh/> 为什么合在一处：把装配次序散回 SFC 会让「谁先谁后」这一隐式约束再次失去单一归属地，
 * <zh/> 且 SFC 会为中间产物（如 `summaryAllColumns`、`v2KeyToOriginalCol`）承担无谓的解构行数。
 *
 * <en/> Single responsibility: chain the "columns → summary → span → header → positioning" pipeline and
 * <en/> produce every binding the template and `defineExpose` need. Each stage already lives in its own
 * <en/> domain (use-v2-grand-total / use-v2-columns / use-v2-summary / use-virtual-span / use-v2-scroll-to
 * <en/> / v2-header); this shell owns only the **dependency order** — e.g. `v2Columns` must exist before
 * <en/> span and scrollTo, `v2KeyToOriginalCol` before summary cells.
 *
 * <en/> Why together: scattering the order back into the SFC would again leave the implicit "who comes
 * <en/> first" constraint without a single owner, and the SFC would pay destructure lines for pure
 * <en/> intermediates (e.g. `summaryAllColumns`, `v2KeyToOriginalCol`).
 */
import type { ComputedRef, Ref, Slots } from 'vue'
import type { UseSelectionStateReturn } from '../../composables/selection/use-selection-state'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { TableHoverLayerApi } from '../../types/config-api'
import type { UseV2ScrollApiReturn } from './use-v2-scroll-api'
import type { V2RendererProps } from './v2-renderer-props'
import { computed } from 'vue'
import { useV2Columns } from './use-v2-columns'
import { useV2GrandTotal } from './use-v2-grand-total'
import { useV2ScrollTo } from './use-v2-scroll-to'
import { useV2Summary } from './use-v2-summary'
import { useVirtualSpan } from './use-virtual-span'
import { createV2HeaderRenderer } from './v2-header'

/** <zh/> 网格装配壳依赖 | <en/> Grid assembly shell deps */
export interface UseV2GridShellDeps<T = any> {
  /** <zh/> 渲染器 props | <en/> renderer props */
  props: V2RendererProps<T>
  /** <zh/> 组件 emit | <en/> component emit */
  emit: (event: any, ...args: any[]) => void
  /** <zh/> 国际化函数 | <en/> locale function */
  t: () => ((path: string) => string) | undefined
  /** <zh/> 转发插槽 | <en/> forwarded slots */
  slots: () => Slots
  /** <zh/> 是否存在 append 插槽 | <en/> whether the append slot exists */
  hasAppendSlot: ComputedRef<boolean>
  /** <zh/> append 行数据 | <en/> append row data */
  appendRowData: any
  /** <zh/> 顶部固定行 | <en/> top pinned rows */
  topPinnedRows: ComputedRef<any[]>
  /** <zh/> 底部固定行 | <en/> bottom pinned rows */
  bottomPinnedRows: ComputedRef<any[]>
  /** <zh/> 行展开 API | <en/> row expand API */
  rowExpandApi?: any
  /** <zh/> 选择状态 API | <en/> selection state API */
  selectionState?: UseSelectionStateReturn | undefined
  /** <zh/> 树形 API | <en/> tree API */
  treeApi?: any
  /** <zh/> 选择模式 | <en/> selection mode */
  resolvedSelectionMode: ComputedRef<'single' | 'multiple'>
  /** <zh/> 列宽读取 | <en/> column width getter */
  getColumnWidth: (col: LocalColumn) => number
  /** <zh/> 列宽覆盖表 | <en/> column width overrides */
  columnWidths: any
  /** <zh/> 展示用普通列 | <en/> display normal columns */
  displayNormalColumns: ComputedRef<LocalColumn[]>
  /** <zh/> 行键函数 | <en/> row key function */
  rowKeyFn: ComputedRef<(row: T) => string>
  /** <zh/> 悬停层 API | <en/> hover layer API */
  hoverLayerApi: TableHoverLayerApi
  /** <zh/> 是否存在悬停操作列 | <en/> whether hover option columns exist */
  hasHoverOptionColumns: ComputedRef<boolean>
  /** <zh/> 悬停操作列 | <en/> hover option columns */
  hoverOptionColumns: ComputedRef<LocalColumn[]>
  /** <zh/> hover 操作是否走 teleport | <en/> whether hover options use teleport */
  hoverOptionTeleport: any
  /** <zh/> 是否应使用 teleport | <en/> whether teleport should be used */
  shouldUseTeleport: ComputedRef<boolean>
  /** <zh/> 容器宽度 | <en/> container width */
  tableContainerWidth: any
  /** <zh/> 渲染数据域 key → rowIndex | <en/> render-data-domain key → rowIndex */
  virtualKeyToIndex: ComputedRef<Map<string, number>>
  /** <zh/> 当前纵向滚动位置 | <en/> current vertical scroll position */
  currentScrollTop: Ref<number>
  /** <zh/> V2 程序化滚动探针 | <en/> V2 programmatic-scroll probe */
  v2ScrollApi: UseV2ScrollApiReturn
  /** <zh/> 共存策略（特性开关，缺省 warn-only） | <en/> coexistence strategy (flag, default warn-only) */
  spanDynamicMode?: () => import('../../types/renderer-interface').SpanDynamicCoexistence | undefined
  /** <zh/> 是否动态行高（effectiveEstimatedRowHeight!=null） | <en/> whether dynamic row height (effectiveEstimatedRowHeight!=null) */
  isDynamic?: () => boolean
}

/** <zh/> 网格装配壳返回 | <en/> Grid assembly shell return */
export type UseV2GridShellReturn<T = any> = ReturnType<typeof useV2GridShell<T>>

/**
 * <zh/> 创建网格装配壳
 * <en/> Create the grid assembly shell
 */
export function useV2GridShell<T = any>(deps: UseV2GridShellDeps<T>) {
  const {
    props,
    emit,
    t,
    slots,
    hasAppendSlot,
    appendRowData,
    topPinnedRows,
    bottomPinnedRows,
    rowExpandApi,
    selectionState,
    treeApi,
    resolvedSelectionMode,
    getColumnWidth,
    columnWidths,
    displayNormalColumns,
    rowKeyFn,
    hoverLayerApi,
    hasHoverOptionColumns,
    hoverOptionColumns,
    hoverOptionTeleport,
    shouldUseTeleport,
    tableContainerWidth,
    virtualKeyToIndex,
    currentScrollTop,
    v2ScrollApi,
    spanDynamicMode,
    isDynamic,
  } = deps

  const {
    showFooterSummaryV,
    showGrandTopStripV,
    isSummaryCalculatingV,
    grandTopStripHeightV,
    dataWithAppend,
    mergedTopPinnedRowsV,
    mergedBottomPinnedRowsV,
    bottomStripHeight,
    grandRawAggregatesV,
    needSummaryCellsV,
    summaryAllColumns,
    sumTextLocal,
    footerHeightWithPinBottom,
  } = useV2GrandTotal<T>({
    props,
    topPinnedRows,
    bottomPinnedRows,
    hasAppendSlot,
    appendRowData,
    t,
  })

  const {
    preparedColumns,
    leftDepth,
    rightDepth,
    headerMainFilteredTree,
    headerMainLeafWidths,
    headerMainDepth,
    selectionV2Columns,
    normalV2Columns,
    fixedV2Columns,
    v2KeyToOriginalCol,
    v2Columns,
    v2ColumnOffsetCache,
    needsFixedWidth,
    computedHeaderHeight,
  } = useV2Columns<T>({
    props,
    getColumnWidth,
    columnWidths,
    displayNormalColumns,
    rowKeyFn,
    hoverLayerApi,
    slots,
    t,
    hasHoverOptionColumns,
    hoverOptionColumns,
    hoverOptionTeleport,
    shouldUseTeleport,
    tableContainerWidth,
    resolvedSelectionMode,
    selectionState,
    treeApi,
    onHeaderClick: (params: any) => emit('headerClick', params),
    onHeaderContextmenu: (params: any) => emit('headerContextmenu', params),
    onToggleColumnGroupCollapse: (key: string) => emit('toggleColumnGroupCollapse', key),
  })

  const {
    leftSummaryCells,
    mainSummaryCells,
    rightSummaryCells,
    summaryMainWidth,
  } = useV2Summary<T>({
    props,
    summaryAllColumns,
    sumTextLocal,
    needSummaryCellsV,
    grandRawAggregatesV,
    v2KeyToOriginalCol,
    selectionV2Columns,
    normalV2Columns,
    fixedV2Columns,
    needsFixedWidth,
    getColumnWidth,
    t,
  })

  /**
   * <zh/> 合并单元格管理器 — SpanRow 组件和 spanCellProps 由 useVirtualSpan 统一管理
   * <en/> Span manager — SpanRow component and spanCellProps managed by useVirtualSpan
   */
  const { SpanRow, spanCellProps } = useVirtualSpan({
    spanEnabled: () => props.spanEnabled,
    getSpanInfo: () => props.getSpanInfo,
    selectionColumns: () => props.selectionColumns as { prop?: string }[],
    normalColumns: () => props.normalColumns as { prop?: string }[],
    rowHeight: () => props.rowHeight,
    hasAppendSlot,
    rowExpandEnabled: () => rowExpandApi?.expandEnabled.value,
    slots,
    v2Columns,
    spanDynamicMode: spanDynamicMode ?? (() => props.spanDynamicMode),
    isDynamic: isDynamic ?? (() => false),
  })

  const { scrollToRow, scrollToColumn } = useV2ScrollTo<T>({
    virtualKeyToIndex,
    dataWithAppend,
    v2Columns,
    v2ColumnOffsetCache,
    currentScrollTop,
    v2ScrollApi,
  })

  /**
   * <zh/> sortState 运行时归一化：prop 接受 SortState | SortState[]，
   * <zh/> 内部统一为 SortState[] 传给表头工厂，消除类型歧义
   * <en/> Runtime normalization of sortState: prop accepts SortState | SortState[],
   * <en/> internally unified to SortState[] for the header factory, eliminating type ambiguity
   */
  const normalizedSortState = computed(() => {
    const s = props.sortState
    if (!s)
      return undefined
    return Array.isArray(s) ? s : [s]
  })

  /**
   * <zh/> V2 多级表头渲染函数 — 从 v2-header.tsx 工厂创建
   * <en/> V2 multi-level header render function — created from v2-header.tsx factory
   */
  const CustomHeader = createV2HeaderRenderer({
    globalHeaderDepth: computed(() => preparedColumns.value.maxDepth),
    preparedColumns,
    headerMainFilteredTree,
    headerMainLeafWidths,
    headerMainDepth,
    leftDepth,
    rightDepth,
    needsFixedWidth,
    selectionV2Columns,
    headerCellHeight: () => props.headerCellHeight,
    floatingFilter: () => props.floatingFilter,
    floatingFilterHeight: () => props.floatingFilterHeight,
    isCollapsed: props.isCollapsed,
    canCollapse: props.canCollapse,
    originalColumns: () => props.originalColumns ?? [],
    slots,
    displayNormalColumns,
    onToggleColumnGroupCollapse: (key: string) => emit('toggleColumnGroupCollapse', key),
    sortState: normalizedSortState,
  })

  return {
    showFooterSummaryV,
    showGrandTopStripV,
    isSummaryCalculatingV,
    grandTopStripHeightV,
    dataWithAppend,
    mergedTopPinnedRowsV,
    mergedBottomPinnedRowsV,
    bottomStripHeight,
    footerHeightWithPinBottom,
    v2Columns,
    computedHeaderHeight,
    needsFixedWidth,
    leftSummaryCells,
    mainSummaryCells,
    rightSummaryCells,
    summaryMainWidth,
    SpanRow,
    spanCellProps,
    CustomHeader,
    scrollToRow,
    scrollToColumn,
  }
}
