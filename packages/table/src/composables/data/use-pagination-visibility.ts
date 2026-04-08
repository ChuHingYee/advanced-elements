/**
 * <zh/> 分页可见性 — 抽取 use-table-data-pipeline 中 includeSynthetic 双管线可见性逻辑
 * <en/> Pagination visibility — extracts includeSynthetic dual-pipeline visibility logic from use-table-data-pipeline
 *
 * @remarks
 * <zh/> `includeSynthetic:true` 时合成行（group/expand）计入分页容量（`visibleDataBefore`），`false` 时仅数据行分页后追加合成行（`expandedAfter`）
 * <zh/> 双 `useVisibleData` 分支语义不同无法三元合并，双 `useRowGroup/useRowExpand` 亦需对应分支
 * <zh/> 未选中分支惰性化——终选 computed 仅读取选中分支（`visibleDataBefore` 或 `expandedAfter` 之一），
 * <zh/> Vue computed 懒求值使另一分支的派生链（可见/分组/展开结果）不被求值；两分支的 useRowGroup/useRowExpand
 * <zh/> 实例仅在各自配置存在时经 immediate watch 读取一次输入数据（配置初始化），不触发派生 computed 全链。
 * <en/> `includeSynthetic:true` synthetic rows count towards pagination (`visibleDataBefore`), `false` paginates data rows only then appends synthetics (`expandedAfter`)
 * <en/> Dual `useVisibleData` branches have different semantics, cannot be merged into ternary; dual `useRowGroup/useRowExpand` follow
 * <en/> unselected branch is lazy — the final computed reads exactly one branch (`visibleDataBefore` or `expandedAfter`),
 * <en/> so Vue's lazy evaluation leaves the other branch's derived chain (visible/grouped/expanded results) unevaluated;
 * <en/> each branch's useRowGroup/useRowExpand reads its input data once via the immediate watch only when its own config exists.
 */
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { ProcessedColumn } from '../../types/column'
import type { RowExpandConfig, RowGroupConfig, TreeConfig } from '../../types/config'
import type { GroupTotalRowOption, SuppressStickyTotalRow, TotalValueGetter } from '../../types/config-options'
import type { Translator } from '../../types/translator'
import type { RowExpandStorageError } from './use-row-expand'
import { computed, shallowRef, toValue } from 'vue'
import { useRowExpand } from './use-row-expand'
import { useRowGroup } from './use-row-group'
import { useTreeData } from './use-tree-data'
import { useVisibleData } from './use-visible-data'

export interface UsePaginationVisibilityOptions<T> {
  finalDisplayData: MaybeRefOrGetter<T[]>
  isClientPagination: MaybeRefOrGetter<boolean>
  currentPage: MaybeRefOrGetter<number>
  pageSize: MaybeRefOrGetter<number>
  treeConfig?: MaybeRefOrGetter<TreeConfig | undefined>
  rowGroupConfig?: MaybeRefOrGetter<RowGroupConfig | undefined>
  rowExpandConfig?: MaybeRefOrGetter<RowExpandConfig | undefined>
  rowKeyFn?: MaybeRefOrGetter<(row: T) => string>
  includeSynthetic?: MaybeRefOrGetter<boolean>
  onRowExpandStorageError?: (info: RowExpandStorageError) => void
  onRowExpand?: (row: T, rowKey: string | number) => void
  onRowCollapse?: (row: T, rowKey: string | number) => void
  /**
   * <zh/> 聚合列（含 aggFunc），透传至 useRowGroup 供分组小计计算
   * <en/> Aggregate columns (with aggFunc), passed to useRowGroup for group totals
   */
  columns?: MaybeRefOrGetter<readonly ProcessedColumn[] | undefined>
  /** <zh/> 分组小计行（AG Grid groupTotalRow）| <en/> Group total rows (AG Grid groupTotalRow) */
  groupTotalRow?: MaybeRefOrGetter<GroupTotalRowOption | undefined>
  /** <zh/> 合计标签（AG Grid totalValueGetter）| <en/> Total label (AG Grid totalValueGetter) */
  totalValueGetter?: MaybeRefOrGetter<TotalValueGetter | undefined>
  /** <zh/> 合计标签回退文本 | <en/> Label fallback text */
  sumText?: MaybeRefOrGetter<string | undefined>
  /**
   * <zh/> 国际化翻译函数——透传至 useRowGroup 供合计标签回退（`table.summary`）使用
   * <en/> i18n translator — forwarded to useRowGroup for the total-label fallback (`table.summary`)
   */
  t?: MaybeRefOrGetter<Translator | undefined>
  /** <zh/> 粘性抑制（AG Grid suppressStickyTotalRow）| <en/> Sticky suppression (AG Grid suppressStickyTotalRow) */
  suppressStickyTotalRow?: MaybeRefOrGetter<SuppressStickyTotalRow | undefined>
  /** <zh/> 保留组头聚合（AG Grid groupSuppressBlankHeader）| <en/> Keep header aggregates (AG Grid groupSuppressBlankHeader) */
  groupSuppressBlankHeader?: MaybeRefOrGetter<boolean | undefined>
}

/**
 * <zh/> 分页可见性 composable——按 includeSynthetic 构建双管线可见数据，并挂载树形/分组/行展开子 API（详见文件头 @remarks）。
 * <en/> Pagination visibility composable — builds the includeSynthetic dual-pipeline visible data and mounts
 * <en/> tree / row-group / row-expand sub APIs (see the file header @remarks).
 *
 * @param options - <zh/> 数据源、分页与树形/分组/展开配置切片 | <en/> Data source, pagination and tree/group/expand config slices
 * @returns <zh/> 可见数据、分页前展开快照、子域 API 与共享展开状态 | <en/> Visible data, pre-pagination expanded data, sub-domain APIs and shared expansion state
 */
export function usePaginationVisibility<T>(options: UsePaginationVisibilityOptions<T>) {
  const {
    finalDisplayData,
    isClientPagination,
    currentPage,
    pageSize,
    treeConfig,
    rowGroupConfig,
    rowExpandConfig,
    rowKeyFn,
    includeSynthetic,
    onRowExpandStorageError,
    onRowExpand,
    onRowCollapse,
    columns,
    groupTotalRow,
    totalValueGetter,
    sumText,
    t,
    suppressStickyTotalRow,
    groupSuppressBlankHeader,
  } = options

  const includeSyntheticRef = computed(() => toValue(includeSynthetic) ?? true)
  const sharedExpandedGroupValues = shallowRef<Set<string>>(new Set())
  const sharedExpandedRowKeys = shallowRef<Set<string | number>>(new Set())

  const treeApi = useTreeData<T>({
    treeConfig: () => toValue(treeConfig),
    data: finalDisplayData as ComputedRef<T[]>,
    rowKeyFn: () => toValue(rowKeyFn) ?? (() => ''),
  })

  const prePaginationDataWithTree = computed<T[]>(() => {
    if (!treeApi.treeEnabled.value)
      return toValue(finalDisplayData) as T[]
    return treeApi.flattenedData.value
  })

  // <zh/> 分页前合成行分支 | <en/> Pre-pagination synthetic branch
  const rowGroupBefore = useRowGroup<T>({
    rowGroupConfig: () => {
      const tc = toValue(treeConfig)
      const rgc = toValue(rowGroupConfig)
      return tc && rgc ? undefined : rgc
    },
    data: prePaginationDataWithTree as ComputedRef<T[]>,
    expandedGroupValues: sharedExpandedGroupValues as unknown as ComputedRef<Set<string>>,
    columns: () => toValue(columns) as readonly ProcessedColumn[] | undefined,
    groupTotalRow: () => toValue(groupTotalRow),
    totalValueGetter: () => toValue(totalValueGetter),
    sumText: () => toValue(sumText),
    t: () => toValue(t),
    suppressStickyTotalRow: () => toValue(suppressStickyTotalRow),
    groupSuppressBlankHeader: () => toValue(groupSuppressBlankHeader),
  })
  const preGroupedBefore = computed<T[]>(() => {
    if (!rowGroupBefore.rowGroupApi.groupEnabled.value)
      return prePaginationDataWithTree.value
    return rowGroupBefore.groupedData.value
  })
  const rowExpandBefore = useRowExpand<T>({
    rowExpandConfig: () => toValue(rowExpandConfig),
    data: preGroupedBefore as ComputedRef<T[]>,
    rowKeyFn: () => toValue(rowKeyFn) ?? (() => ''),
    onStorageError: onRowExpandStorageError,
    onRowExpand,
    onRowCollapse,
    expandedRowKeys: sharedExpandedRowKeys as unknown as ComputedRef<Set<string | number>>,
  })
  const preExpandedBefore = computed<T[]>(() => {
    if (!rowExpandBefore.rowExpandApi.expandEnabled.value)
      return preGroupedBefore.value
    return rowExpandBefore.expandedData.value
  })
  const { visibleData: visibleDataBefore } = useVisibleData({
    finalDisplayData: preExpandedBefore as ComputedRef<T[]>,
    isClientPagination,
    currentPage,
    pageSize,
  })

  // <zh/> 分页后合成行分支 | <en/> Post-pagination synthetic branch
  const { visibleData: visibleDataPure } = useVisibleData({
    finalDisplayData: prePaginationDataWithTree as ComputedRef<T[]>,
    isClientPagination,
    currentPage,
    pageSize,
  })
  const rowGroupAfter = useRowGroup<T>({
    rowGroupConfig: () => {
      const tc = toValue(treeConfig)
      const rgc = toValue(rowGroupConfig)
      return tc && rgc ? undefined : rgc
    },
    data: computed(() => visibleDataPure.value) as unknown as ComputedRef<T[]>,
    expandedGroupValues: sharedExpandedGroupValues as unknown as ComputedRef<Set<string>>,
    columns: () => toValue(columns) as readonly ProcessedColumn[] | undefined,
    groupTotalRow: () => toValue(groupTotalRow),
    totalValueGetter: () => toValue(totalValueGetter),
    sumText: () => toValue(sumText),
    t: () => toValue(t),
    suppressStickyTotalRow: () => toValue(suppressStickyTotalRow),
    groupSuppressBlankHeader: () => toValue(groupSuppressBlankHeader),
  })
  const groupedAfter = computed<T[]>(() => {
    if (!rowGroupAfter.rowGroupApi.groupEnabled.value)
      return visibleDataPure.value
    return rowGroupAfter.groupedData.value
  })
  const rowExpandAfter = useRowExpand<T>({
    rowExpandConfig: () => toValue(rowExpandConfig),
    data: groupedAfter as ComputedRef<T[]>,
    rowKeyFn: () => toValue(rowKeyFn) ?? (() => ''),
    onStorageError: onRowExpandStorageError,
    onRowExpand,
    onRowCollapse,
    expandedRowKeys: sharedExpandedRowKeys as unknown as ComputedRef<Set<string | number>>,
  })
  const expandedAfter = computed<T[]>(() => {
    if (!rowExpandAfter.rowExpandApi.expandEnabled.value)
      return groupedAfter.value
    return rowExpandAfter.expandedData.value
  })

  const visibleData = computed<T[]>(() => {
    const target = includeSyntheticRef.value ? visibleDataBefore.value : expandedAfter.value
    // <zh/> 直接透传分支引用（不创建新数组），上游分支的引用稳定性即本节点的稳定性
    // <en/> Pass through the branch reference directly (no new array); upstream stability is this node's stability
    return target
  })

  return {
    visibleData,
    prePaginationExpandedData: preExpandedBefore,
    treeApi,
    rowGroupApi: rowGroupBefore.rowGroupApi,
    rowExpandApi: rowExpandBefore.rowExpandApi,
    sharedExpandedGroupValues,
    sharedExpandedRowKeys,
  }
}
