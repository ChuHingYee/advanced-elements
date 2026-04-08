/**
 * <zh/> AdvTable 数据+列域子编排器 — 列编排、数据请求、数据管线、列分类、列状态、列分组、筛选面板
 * <en/> AdvTable data+columns domain sub-orchestrator — column orchestration, data request, data pipeline, column categorization, column state, column group, filter panel
 *
 * @remarks
 * <zh/> 列与数据的循环依赖（管线需 effectiveColumns，列状态/筛选面板需 sortState/filterState）
 * <zh/> 由预创建共享引用 + 显式交接顺序（列基础 → 数据核心 → 列特性）切断；
 * <zh/> 本文件仅保留域接口定义与三段装配，实现见 use-column-domain.ts / use-data-domain.ts。
 * <en/> The columns↔data circular dependency (pipeline needs effectiveColumns, column-state/filter-panel
 * <en/> need sortState/filterState) is cut by pre-created shared refs + explicit handoff order
 * <en/> (column base → data core → column features); this file keeps domain interfaces and 3-stage assembly,
 * <en/> with implementations in use-column-domain.ts / use-data-domain.ts.
 */
import type { ComputedRef, MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
import type { AdvColumn, AdvTableEmitFn, ProcessedColumn } from '../../types'
import type { SpanInfo } from '../../types/column'
import type { ApplyColumnStateOptions, ColumnState } from '../../types/column-state'
import type { RowExpandApi, RowGroupApi } from '../../types/config-tree'
import type { ColumnFilterValue } from '../../types/filter'
import type { TableRequestReason } from '../../types/request'
import type { RowKeyMeta } from '../../types/row-rect'
import type { SortOrder, SortState } from '../../types/sort'
import type { AdvTableProps } from '../../types/table-props'
import type { useColumnGroup } from '../columns/use-column-group'
import type { UseApplyDataTransactionReturn } from '../data/use-apply-data-transaction'
import type { UserSpanMethod } from '../data/use-cell-span'
import type { DataUpdateSource, UseDataUpdateBridgeReturn } from '../data/use-data-update-bridge'
import type { ColumnClassification } from '../data/use-table-data-pipeline'
import type { useTablePagination } from '../data/use-table-pagination'
import type { UseTreeDataReturn } from '../data/use-tree-data'
import type { useFilterPanel } from '../features/use-filter-panel'
import type { UseAdvTableModelRefs } from '../use-adv-table'
import type { UseAdvTableCoreReturn } from './use-adv-table-core'
import { toValue } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { buildColumnBase, buildColumnFeatures } from './use-column-domain'
import { buildDataCore } from './use-data-domain'

/**
 * <zh/> 数据+列域输入——窄切片集合，替代既往 `props: AdvTableProps` 全量透传
 * <zh/> 每个字段均标注其等价的既往 props 读取式；调用方（useAdvTable）在入口处由 props 组装
 * <en/> Data+columns input — narrow slice set replacing the former `props: AdvTableProps` passthrough
 * <en/> Each field documents its equivalent former props read; the caller (useAdvTable) assembles them from props at the entry
 */
export interface UseAdvTableDataColumnsOptions<T> {
  /** <zh/> 列集合（等价 `props.columns`） | <en/> Column list (equivalent to `props.columns`) */
  columns: MaybeRefOrGetter<AdvColumn<T>[] | undefined>
  /** <zh/> URL 状态配置（等价 `props.urlState`） | <en/> URL state config (equivalent to `props.urlState`) */
  urlState: MaybeRefOrGetter<AdvTableProps<T>['urlState']>
  /** <zh/> 兜底数据（等价 `props.data`，models.data 优先逻辑保留在调用方组装的 getter 中） | <en/> Fallback data (equivalent to `props.data`; the models.data-first logic stays in the caller-assembled getter) */
  fallbackData: MaybeRefOrGetter<T[] | undefined>
  /** <zh/> 树形配置（等价 `props.treeConfig`，含 children 键） | <en/> Tree config (equivalent to `props.treeConfig`, including the children key) */
  treeConfig: MaybeRefOrGetter<AdvTableProps<T>['treeConfig']>
  /** <zh/> 加载态（等价 `props.loading`） | <en/> Loading state (equivalent to `props.loading`) */
  propsLoading: MaybeRefOrGetter<AdvTableProps<T>['loading']>
  /** <zh/> 合并配置（等价 `props.spanConfig`） | <en/> Span config (equivalent to `props.spanConfig`) */
  spanConfig: MaybeRefOrGetter<AdvTableProps<T>['spanConfig']>
  /** <zh/> 函数式合并方法（等价 `props.spanMethod`） | <en/> Function-style span method (equivalent to `props.spanMethod`) */
  spanMethod: MaybeRefOrGetter<AdvTableProps<T>['spanMethod']>
  /** <zh/> 外部筛选（等价 `props.externalFilter`） | <en/> External filter (equivalent to `props.externalFilter`) */
  externalFilter: MaybeRefOrGetter<AdvTableProps<T>['externalFilter']>
  /** <zh/> 行分组配置（等价 `props.rowGroupConfig`） | <en/> Row group config (equivalent to `props.rowGroupConfig`) */
  rowGroupConfig: MaybeRefOrGetter<AdvTableProps<T>['rowGroupConfig']>
  /** <zh/> 行展开配置（等价 `props.rowExpandConfig`） | <en/> Row expand config (equivalent to `props.rowExpandConfig`) */
  rowExpandConfig: MaybeRefOrGetter<AdvTableProps<T>['rowExpandConfig']>
  /** <zh/> 行固定配置（等价 `props.rowPinConfig`） | <en/> Row pin config (equivalent to `props.rowPinConfig`) */
  rowPinConfig: MaybeRefOrGetter<AdvTableProps<T>['rowPinConfig']>
  /** <zh/> 分页配置（等价 `props.pagination`，仅读取 includeSynthetic） | <en/> Pagination config (equivalent to `props.pagination`, only includeSynthetic is read) */
  pagination: MaybeRefOrGetter<AdvTableProps<T>['pagination']>
  /** <zh/> 筛选配置（等价 `props.filterConfig`） | <en/> Filter config (equivalent to `props.filterConfig`) */
  filterConfig: MaybeRefOrGetter<AdvTableProps<T>['filterConfig']>
  /** <zh/> 排序配置（等价 `props.sortConfig`） | <en/> Sort config (equivalent to `props.sortConfig`) */
  sortConfig: MaybeRefOrGetter<AdvTableProps<T>['sortConfig']>
  /** <zh/> 管线配置（等价 `props.dataPipeline`） | <en/> Pipeline config (equivalent to `props.dataPipeline`) */
  dataPipeline: MaybeRefOrGetter<AdvTableProps<T>['dataPipeline']>
  /** <zh/> 列状态持久化配置（等价 `props.columnState`） | <en/> Column state persistence config (equivalent to `props.columnState`) */
  columnState: MaybeRefOrGetter<AdvTableProps<T>['columnState']>
  /** <zh/> 渲染模式（等价 `props.mode`，缺省 'virtual' 的回退保留在内部） | <en/> Render mode (equivalent to `props.mode`; the 'virtual' fallback stays inside) */
  mode: MaybeRefOrGetter<AdvTableProps<T>['mode']>
  emit: AdvTableEmitFn
  models: UseAdvTableModelRefs<T>
  core: UseAdvTableCoreReturn<T>
}

/**
 * <zh/> 列域——列编排、列分类、列状态/分组/筛选面板、列 key 映射
 * <zh/> 实现见 use-column-domain.ts（列基础 + 列特性装配器）
 * <en/> Column domain — column orchestration, categorization, state/group/filter-panel, key map
 * <en/> Implemented in use-column-domain.ts (column base + column features assemblers)
 */
export interface DataColumnsColumnDomain {
  // ── 列编排 | Column orchestration ──
  localColumns: ShallowRef<ProcessedColumn[]>
  originColumns: ShallowRef<ProcessedColumn[]>
  headerFormatMap: ComputedRef<Record<string, any>>
  effectiveColumns: Ref<ProcessedColumn[]>
  hasColumns: Ref<boolean>
  resetColumns: () => void
  setColumns: (cols: ProcessedColumn[]) => void
  touchColumns: () => void
  canCollapse: (col: ProcessedColumn) => boolean
  toggleCollapse: (columnKey: string) => void
  isCollapsed: (columnKey: string) => boolean
  collapsedState: Ref<Record<string, boolean>>
  collapsedVersion: Ref<number>

  // ── 列分类 | Column categorization ──
  columnClassification: ComputedRef<ColumnClassification>
  hoverOptionColumns: ComputedRef<ProcessedColumn[]>
  hasHoverOptionColumns: ComputedRef<boolean>
  hoverOptionTeleport: ComputedRef<boolean>
  displayNormalColumns: ComputedRef<ProcessedColumn[]>
  selectionColumnSyncKey: ComputedRef<string>
  columnKeepAlive: ComputedRef<boolean>

  // ── 列状态/分组/筛选面板 | Column state/group/filter panel ──
  getColumnState: () => ColumnState[]
  applyColumnState: (state: ColumnState[] | null | undefined, options?: ApplyColumnStateOptions) => void
  resetColumnState: () => void
  columnGroupApi: ReturnType<typeof useColumnGroup>
  filterPanelApi: ReturnType<typeof useFilterPanel>

  // ── 列 key 映射 | Column key map ──
  columnByKeyMap: ComputedRef<Map<string, ProcessedColumn>>
}

/**
 * <zh/> 请求域——远端/本地数据请求、分页、加载态
 * <en/> Request domain — remote/local data request, pagination, loading state
 */
export interface DataColumnsRequestDomain<T = any> {
  tableData: Ref<T[]>
  total: Ref<number>
  hasSource: Ref<boolean>
  isPolling: Ref<boolean>
  pagination: ReturnType<typeof useTablePagination>
  localLoading: Ref<boolean>
  refresh: () => Promise<void>
  fetchData: (options?: { append?: boolean, reason?: TableRequestReason }) => Promise<T[] | null>
  setLoading: (val: boolean) => void
  /**
   * <zh/> 数据回写——remote/manual 场景由父组件回写数据；携带 requestId 时旧序号写入会被丢弃
   * <en/> Data write-back — parent writes data back in remote/manual scenarios; a carried requestId drops stale writes
   */
  setResponseData: (data: T[], requestId?: number) => void
  setIsPolling: (val: boolean) => void
  reorderData: (rows: T[]) => void
  handleCurrentPageChange: (page: number) => void
  handlePageSizeChange: (size: number) => void
  handleLoadMore: () => void
  getPagination: () => { currentPage: number, pageSize: number, total: number }
  setCurrentPageAndRefetch: (page: number) => void
  setPageSizeAndRefetch: (size: number) => void
  getFullData: () => T[]
  mergedLoading: ComputedRef<boolean>
}

/**
 * <zh/> 管线域——数据处理链输出、单元格合并
 * <en/> Pipeline domain — data-processing chain outputs, cell span
 */
export interface DataColumnsPipelineDomain<T = any> {
  finalDisplayData: ComputedRef<T[]>
  prePaginationExpandedData: ComputedRef<T[]>
  visibleData: ComputedRef<T[]>
  selectableData: ComputedRef<T[]>
  rowKeyMeta: Ref<RowKeyMeta<T>>
  // <zh/> selectableFn / rowKeyFn 不再透传——下游编排器直接从 core 获取，消除“假透传”字段
  // <en/> selectableFn / rowKeyFn are no longer re-exported — downstream orchestrators get them directly from core, eliminating passthrough fields

  // ── 合并 | Span ──
  mergedSpanMethod: ComputedRef<UserSpanMethod | undefined>
  getSpanInfo: (rowIndex: number, colKey: string) => SpanInfo | undefined
  spanEnabled: ComputedRef<boolean>
  spanMethod: ComputedRef<UserSpanMethod | undefined>
}

/**
 * <zh/> 筛选排序域——列筛/排序状态与操作、快筛缓存失效
 * <en/> Filter/sort domain — column filter/sort state and operations, quick-filter cache invalidation
 */
export interface DataColumnsFilterSortDomain {
  filterState: Ref<Record<string, any>>
  sortState: Ref<SortState[]>
  hasActiveFilter: ComputedRef<boolean>
  hasActiveQuickFilter: ComputedRef<boolean>
  setFilter: (prop: string, value: ColumnFilterValue) => void
  resetColumnFilter: (prop: string) => void
  resetAllFilters: () => void
  getFilterValue: (prop: string) => ColumnFilterValue | undefined
  isColumnFiltered: (prop: string) => boolean
  getEnumOptions: (prop: string) => any[] | undefined
  toggleSort: (prop: string, event?: { shiftKey?: boolean }) => void
  setSort: (prop: string, order: SortOrder) => void
  clearSort: (prop?: string) => void
  setSorts: (sorts: SortState[]) => void
  getSortOrder: (prop: string) => SortOrder
  getSortIndex: (prop: string) => number

  // ── 快速筛选 | Quick filter ──
  invalidateQuickFilterRowCache: (rowKey: string | number) => void
  invalidateQuickFilterRowCacheBatch: (rowKeys: (string | number)[]) => void
  /**
   * <zh/> 列筛 cellValue 缓存按**行对象**失效（参数省略时整表清空）——编辑/undo 后调用。
   * <zh/> 不接收行索引：编辑事件的 rowIndex 属渲染域，与列筛缓存的管线域不同源。
   * <en/> Invalidate the column-filter cellValue cache **by row object** (clears all when the
   * <en/> argument is omitted) — call after edits/undo. Takes no row index: the edit event's
   * <en/> rowIndex is in the render domain, a different source from the filter cache's pipeline domain.
   */
  invalidateColumnFilterRowCache: (row?: object | null) => void
}

/**
 * <zh/> 层级域——树/分组/展开/固定、最终渲染数据
 * <en/> Hierarchy domain — tree/group/expand/pin, final render data
 */
export interface DataColumnsHierarchyDomain<T = any> {
  treeApi: UseTreeDataReturn<T>
  rowGroupApi: RowGroupApi
  rowExpandApi: RowExpandApi
  rowPinApi: import('../../types/config-tree').RowPinApi
  /** <zh/> 最终渲染数据（Row Pinning 启用时排除 pinned 行） | <en/> Final render data (pinned rows excluded when Row Pinning enabled) */
  renderData: ComputedRef<T[]>
}

/**
 * <zh/> 写入域——数据更新桥接与增量事务
 * <en/> Write domain — data update bridge and incremental transactions
 */
export interface DataColumnsWriteDomain<T = any> {
  handleDataUpdate: (data: T[], source?: DataUpdateSource) => void
  dataUpdateBridge: UseDataUpdateBridgeReturn<T>
  applyTransaction: UseApplyDataTransactionReturn<T>['applyTransaction']
}

/**
 * <zh/> 数据+列域返回——6 域接口组合，由列基础 → 数据核心 → 列特性显式交接组装；
 * <zh/> 新增字段必须归入对应域接口，不得直接追加至此
 * <en/> Data+columns return — composed of 6 domain interfaces, assembled via explicit handoff
 * <en/> across column base → data core → column features; new fields must go into the owning
 * <en/> domain interface, never appended here directly
 */
export interface UseAdvTableDataColumnsReturn<T = any> extends
  DataColumnsColumnDomain,
  DataColumnsRequestDomain<T>,
  DataColumnsPipelineDomain<T>,
  DataColumnsFilterSortDomain,
  DataColumnsHierarchyDomain<T>,
  DataColumnsWriteDomain<T> {}

/**
 * <zh/> 创建 AdvTable 数据+列域编排器——列基础 → 数据核心 → 列特性显式交接
 * <en/> Create AdvTable data+columns domain orchestrator — explicit handoff across column base → data core → column features
 */
export function useAdvTableDataColumns<T>(options: UseAdvTableDataColumnsOptions<T>): UseAdvTableDataColumnsReturn<T> {
  const columnBase = buildColumnBase(options)
  const dataCore = buildDataCore({ ...options, effectiveColumns: columnBase.effectiveColumns })
  const columnFeatures = buildColumnFeatures({
    localColumns: columnBase.localColumns,
    effectiveColumns: columnBase.effectiveColumns,
    resetColumns: columnBase.resetColumns,
    setColumns: columnBase.setColumns,
    touchColumns: columnBase.touchColumns,
    columnClassification: dataCore.columnClassification,
    sortState: dataCore.sortState,
    filterState: dataCore.filterState,
    setSorts: dataCore.setSorts,
    resetAllFilters: dataCore.resetAllFilters,
    filterConfig: () => toValue(options.filterConfig),
    columnState: () => toValue(options.columnState),
    mode: () => toValue(options.mode) ?? 'virtual',
    mergedColumnConfig: options.core.mergedColumnConfig,
    tableId: () => options.core.tableId.value,
    onResetColumnWidths: () => {
      options.core.tableVirtualRendererRef.value?.resetColumnWidths?.()
    },
  })
  // <zh/> 三段 spread 键冲突探测（dev-only）：后者静默覆盖前者同名键；新增域字段撞名即告警，替代 40+ 行显式字段列表 churn
  // <en/> Dev-only key-collision probe for the 3-stage spread below: later stages silently overwrite same-named keys; warns on collision instead of churning a 40+ line explicit field list
  if (isDev) {
    const owners = new Map<string, string>()
    for (const [domain, obj] of [['columnBase', columnBase], ['dataCore', dataCore], ['columnFeatures', columnFeatures]] as const) {
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        const prev = owners.get(key)
        if (prev !== undefined)
          devWarn(`[AdvTable] Duplicate domain key "${key}" from ${domain} silently overwrites ${prev} — rename one side.`)
        else
          owners.set(key, domain)
      }
    }
  }
  return { ...columnBase, ...dataCore, ...columnFeatures }
}
