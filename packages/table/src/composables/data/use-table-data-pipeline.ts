import type { MaybeRefOrGetter, Ref } from 'vue'
import type { ColSpanCellsConfig, ProcessedColumn, RowSpanCellsConfig, SpanRange } from '../../types'
import type { ExternalFilterConfig, RowExpandConfig, RowGroupConfig, RowPinConfig, TreeConfig } from '../../types/config'
import type { DataPipelineStage, GroupTotalRowOption, SuppressStickyTotalRow, TotalValueGetter } from '../../types/config-options'
import type { SortOrder, SortState } from '../../types/sort'
import type { Translator } from '../../types/translator'
import type { SpanLimitInfo } from '../data/use-cell-span'
import type { UseColumnFilterReturn } from '../data/use-column-filter'
import type { UseColumnSortReturn } from '../data/use-column-sort'
import type { UseQuickFilterReturn } from '../data/use-quick-filter'
import type { RowExpandStorageError } from '../data/use-row-expand'
import type { ColumnClassification } from './use-column-classification'
import { computed, getCurrentScope, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { useCellSpan } from '../data/use-cell-span'
import { useColumnFilter } from '../data/use-column-filter'
import { useColumnSort } from '../data/use-column-sort'
import { useQuickFilter } from '../data/use-quick-filter'
import { useRowPin } from '../data/use-row-pin'
import { classifyColumns, isColumnClassificationEqual } from './use-column-classification'
import { usePaginationVisibility } from './use-pagination-visibility'

export type { DataPipelineStage } from '../../types/config-options'

export type { ColumnClassification } from './use-column-classification'

/** <zh/> 默认管线顺序（历史行为，零破坏） | <en/> Default pipeline order (historical behavior) */
export const DEFAULT_PIPELINE_ORDER: readonly DataPipelineStage[] = ['columnFilter', 'quickFilter', 'externalFilter', 'sort']

/**
 * <zh/> 解析管线顺序：必须恰含 4 段且不重复，否则 devWarn 并回退默认
 * <en/> Resolve the pipeline order: must contain exactly the 4 stages; otherwise warn and fall back
 */
export function resolvePipelineOrder(
  raw: DataPipelineStage[] | undefined,
  warn?: (message: string, ...args: unknown[]) => void,
): DataPipelineStage[] {
  if (raw == null)
    return [...DEFAULT_PIPELINE_ORDER]
  const expected = new Set<string>(DEFAULT_PIPELINE_ORDER)
  const seen = new Set<string>()
  const valid = Array.isArray(raw)
    && raw.length === expected.size
    && raw.every(s => typeof s === 'string' && expected.has(s) && !seen.has(s) && (seen.add(s), true))
  if (!valid) {
    const message = `[AdvTable] Invalid pipelineOrder ${JSON.stringify(raw)} — must contain exactly [${[...expected].join(', ')}]; falling back to default.`
    if (warn)
      warn(message)
    else if (typeof console !== 'undefined')
      devWarn(message)
    return [...DEFAULT_PIPELINE_ORDER]
  }
  return [...raw]
}

export interface UseTableDataPipelineOptions<T = any> {
  localColumns: MaybeRefOrGetter<ProcessedColumn[]>
  pipelineData: MaybeRefOrGetter<T[]>
  tableData: MaybeRefOrGetter<T[]>
  /**
   * <zh/> 管线顺序（**setup 期静态配置**）：如 `['externalFilter','columnFilter','quickFilter','sort']`
   * <zh/> 可将权限类外部筛前置以减少后续计算。缺省为历史固定顺序。
   *
   * <zh/> **运行时变更不生效**：此处只在 setup 求值一次。运行时需要换序请改用 `pipelineOrder` 的
   * <zh/> 静态数组形态（或销毁重建该 composable）。类型保留 `MaybeRefOrGetter` 是为兼容 getter
   * <zh/> 调用点的既有写法，getter 同样只求值一次——不要依赖其响应性。
   * <en/> Pipeline order (**static setup-time config**). Defaults to the historical order.
   *
   * <en/> **Runtime changes take no effect**: evaluated once at setup. To reorder at runtime,
   * <en/> pass a static array (or destroy/recreate this composable). `MaybeRefOrGetter` is kept for
   * <en/> compatibility with existing getter call sites; a getter is likewise evaluated once — do not
   * <en/> rely on its reactivity.
   */
  pipelineOrder?: MaybeRefOrGetter<DataPipelineStage[] | undefined>
  selectableFn?: MaybeRefOrGetter<((row: T, index: number) => boolean) | undefined>
  isClientPagination: MaybeRefOrGetter<boolean>
  currentPage: MaybeRefOrGetter<number>
  pageSize: MaybeRefOrGetter<number>
  rowSpanCells?: MaybeRefOrGetter<RowSpanCellsConfig | undefined>
  colSpanCells?: MaybeRefOrGetter<ColSpanCellsConfig | undefined>
  ranges?: MaybeRefOrGetter<SpanRange[] | undefined>
  /**
   * <zh/> 用户函数式 spanMethod，透传至 useCellSpan，使虚拟模式下 getSpanInfo 也能反映函数式 spanMethod
   * <en/> User function-style spanMethod, passed through to useCellSpan so getSpanInfo in virtual mode also reflects the function-style spanMethod
   */
  userSpanMethod?: MaybeRefOrGetter<import('./use-cell-span').UserSpanMethod | undefined>
  quickFilterText?: MaybeRefOrGetter<string | undefined>
  externalFilter?: MaybeRefOrGetter<ExternalFilterConfig<T> | undefined>
  treeConfig?: MaybeRefOrGetter<TreeConfig | undefined>
  rowGroupConfig?: MaybeRefOrGetter<RowGroupConfig | undefined>
  rowExpandConfig?: MaybeRefOrGetter<RowExpandConfig | undefined>
  rowPinConfig?: MaybeRefOrGetter<RowPinConfig | undefined>
  /**
   * <zh/> 合成行是否计入分页容量，默认 true（计入）；false 时仅数据行分页，合成行在分页后追加
   * <en/> Whether synthetic rows count towards pagination, default true; false paginates data rows only and appends synthetics after
   */
  includeSynthetic?: MaybeRefOrGetter<boolean>
  rowKeyFn?: MaybeRefOrGetter<(row: T) => string>
  /**
   * <zh/> 分组小计行（AG Grid groupTotalRow）——透传至分页可见性/行分组
   * <en/> Group total rows (AG Grid groupTotalRow) — passed to pagination visibility / row grouping
   */
  groupTotalRow?: MaybeRefOrGetter<GroupTotalRowOption | undefined>
  /** <zh/> 合计标签（AG Grid totalValueGetter）| <en/> Total label (AG Grid totalValueGetter) */
  totalValueGetter?: MaybeRefOrGetter<TotalValueGetter | undefined>
  /** <zh/> 合计标签回退文本 | <en/> Label fallback text */
  sumText?: MaybeRefOrGetter<string | undefined>
  /**
   * <zh/> 国际化翻译函数——透传至行分组供合计标签回退（`table.summary`）使用
   * <en/> i18n translator — forwarded to row grouping for the total-label fallback (`table.summary`)
   */
  t?: MaybeRefOrGetter<Translator | undefined>
  /** <zh/> 粘性抑制（AG Grid suppressStickyTotalRow）| <en/> Sticky suppression (AG Grid suppressStickyTotalRow) */
  suppressStickyTotalRow?: MaybeRefOrGetter<SuppressStickyTotalRow | undefined>
  /** <zh/> 保留组头聚合（AG Grid groupSuppressBlankHeader）| <en/> Keep header aggregates (AG Grid groupSuppressBlankHeader) */
  groupSuppressBlankHeader?: MaybeRefOrGetter<boolean | undefined>
  /**
   * <zh/> 预创建的排序/筛选状态——提供时 noop 存根与懒升级的真实 composable 共用同一 ref，
   * <zh/> 状态标识在升级前后保持稳定，调用方可直接持有引用，无需晚绑定回填
   * <en/> Pre-created sort/filter state — shared by noop stubs and lazily-upgraded real composables,
   * <en/> keeping state identity stable across upgrades so callers hold direct references with no late-bound backfill
   */
  sortState?: Ref<SortState[]>
  filterState?: Ref<Record<string, any>>
  /**
   * <zh/> 排序 Worker 创建失败或运行出错时的回调 | <en/> Callback for sort Worker creation failure or runtime error
   */
  onSortWorkerError?: (error: Error) => void
  /**
   * <zh/> 单元格合并计算因数据规模超限被跳过时的回调 | <en/> Callback invoked when cell span computation is skipped due to scale exceeding limit
   */
  onSpanLimitExceeded?: (info: SpanLimitInfo) => void
  /**
   * <zh/> 固定行总数超限被截断时的回调（顶部优先保留，超出部分移回滚动区）
   * <en/> Callback invoked when pinned rows are truncated past the cap (top wins, extras return to the scroll area)
   */
  onPinLimitExceeded?: (info: { total: number, limit: number, truncatedTop: number, truncatedBottom: number }) => void
  /**
   * <zh/> 行展开持久化存储读/写失败时的回调 | <en/> Callback invoked when row expand persistence storage read/write fails
   */
  onRowExpandStorageError?: (info: RowExpandStorageError) => void
  /**
   * <zh/> 行展开时回调（expanded=true） | <en/> Callback when a row is expanded (expanded=true)
   */
  onRowExpand?: (row: T, rowKey: string | number) => void
  /**
   * <zh/> 行折叠时回调（expanded=false） | <en/> Callback when a row is collapsed (expanded=false)
   */
  onRowCollapse?: (row: T, rowKey: string | number) => void
  /** <zh/> 快速搜索行文本缓存上限，默认 5000 | <en/> Quick filter row text cache size limit, default 5000 */
  quickFilterCacheSize?: number
  /** <zh/> 多列排序最大列数（来自 sortConfig.maxSortColumns），默认不限 | <en/> Max multi-sort columns (from sortConfig.maxSortColumns), unlimited by default */
  maxSortColumns?: number
  /**
   * <zh/> dev-only 警告回调，替代直接 console.warn，便于通过统一错误处理器控制输出
   * <en/> dev-only warning callback, replaces direct console.warn, allowing unified control via error handler
   */
  devWarn?: (message: string, ...args: unknown[]) => void
  /**
   * <zh/> 调试日志器——受 `debug` prop 控制，开启后输出管线各阶段诊断信息
   * <en/> Debug logger — controlled by `debug` prop, outputs per-stage pipeline diagnostics when enabled
   */
  debug?: import('../../utils/debug-logger').DebugLogger
}

/**
 * <zh/> 引用相同则返回 prev，否则返回 next——用于管线中“透传/条件选择”型 computed 的 prev 稳定性优化 | <en/> Return prev when same reference, otherwise next — for pipeline 'pass-through / conditional-select' computed prev stability optimization
 */
function refStable<T extends unknown[]>(prev: T | undefined, next: T): T {
  return prev && prev === next ? prev : next
}

/**
 * <zh/> 逐元素引用比较后返回 prev，否则返回 next——用于管线中“filter/flatten”型 computed 的 prev 稳定性优化 | <en/> Return prev when all element references match, otherwise next — for pipeline 'filter/flatten' computed prev stability optimization
 */
function shallowArrayStable<T extends unknown[]>(prev: T | undefined, next: T): T {
  if (prev && prev.length === next.length) {
    let allSame = true
    for (let i = 0; i < next.length; i++) {
      if (prev[i] !== next[i]) {
        allSame = false
        break
      }
    }
    if (allSame)
      return prev
  }
  return next
}

/**
 * <zh/> 穷尽性断言——用于 switch 的 default 分支：新增联合成员未处理时在编译期失败。
 * <en/> Exhaustiveness assertion — used in a switch's default branch: adding an unhandled union
 * <en/> member fails at compile time.
 */
function assertNever(value: never): never {
  throw new Error(`[AdvTable] Unhandled pipeline stage: ${String(value)}`)
}

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

  // <zh/> 列分类 WeakMap 缓存——同一数组引用复用结果，O(m) 仅首次 | <en/> Column classification WeakMap cache — same array ref reuses result, O(m) only first time
  const classifyCache = new WeakMap<ProcessedColumn[], ColumnClassification>()
  const columnClassification = computed<ColumnClassification>((prev) => {
    const cols = toValue(localColumns) as ProcessedColumn[]
    let next = classifyCache.get(cols)
    if (!next) {
      next = classifyColumns(cols)
      classifyCache.set(cols, next)
    }
    if (prev && isColumnClassificationEqual(prev, next))
      return prev
    return next
  })
  // <zh/> treeConfig + rowGroupConfig 同时启用互斥校验（dev 警告 + 运行时阻止）
  // <en/> Mutual exclusion check when treeConfig + rowGroupConfig are both enabled (dev warning + runtime prevention)
  /**
   * <zh/> tree/group 互斥校验回调——任一配置引用变化即触发（含 setup immediate），dev 下告警并运行时忽略 rowGroup
   * <en/> Tree/group exclusivity callback — fires on either config reference change (incl. setup immediate); dev-warns and ignores rowGroup at runtime
   */
  function onTreeGroupConfigChanged([tc, rgc]: readonly [unknown, unknown]): void {
    if (!isDev)
      return
    // treeConfig/rowGroupConfig 为对象即视为启用（接口未提供 enabled 字段，presence 即启用）
    // treeConfig/rowGroupConfig objects are treated as enabled (no enabled field provided, presence means enabled)
    if (tc && rgc) {
      const message
        = '[AdvTable] Both treeConfig and rowGroupConfig are enabled. '
          + 'Row grouping operates on flattened tree data, which may break tree hierarchy '
          + 'and produce unexpected visual results. rowGroupConfig will be ignored at runtime.'
      if (options.devWarn)
        options.devWarn(message)
      else if (typeof console !== 'undefined')
        devWarn(message)
    }
  }
  watch(
    () => [toValue(treeConfig), toValue(rowGroupConfig)] as const,
    onTreeGroupConfigChanged,
    { immediate: true, flush: 'post' },
  )

  // ── 按需注册：列筛选 / 快速筛选 / 排序 ──────────────────────────────
  // <zh/> 仅在存在可筛选列 / 快速搜索文本 / 可排序列时实例化对应 composable，
  // <zh/> 避免未使用功能场景下无谓的 computed/watch 注册开销。
  // <zh/> 列分类变化时（如运行时动态添加 sortable 列）会在下一个 tick 升级为真实 composable。
  // <en/> Only instantiate the corresponding composable when filterable columns / quick filter text / sortable columns exist,
  // <en/> avoiding unnecessary computed/watch registration overhead when the feature is unused.
  // <en/> When column classification changes (e.g. runtime dynamic sortable column addition), upgrade to real composable on the next tick.

  /**
   * <zh/> 列筛选 noop——无线筛选项时替代真实 useColumnFilter，保持接口完整 | <en/> Column filter noop — replaces real useColumnFilter when no filterable columns exist, keeping the interface intact
   */
  const noopFilterData = computed(() => ({ data: [] as T[], isFiltered: false }))
  const noopFilterState = injectedFilterState ?? shallowRef<Record<string, any>>({})
  const noopFilterApi = {
    filterState: noopFilterState,
    hasActiveFilter: computed(() => false),
    /**
     * <zh/> noop 期的写入透传到底层共享 filterState——升级为真实 composable 后状态不丢失，
     * <zh/> 而不是静默丢弃（用户在"无可筛选列"窗口设置后的列筛选会蒸发）。
     * <en/> Writes during the noop phase pass through to the shared filterState so they survive
     * <en/> the upgrade to a real composable instead of being silently dropped.
     */
    setFilter: (prop: string, value: any) => {
      noopFilterState.value = { ...noopFilterState.value, [prop]: value }
    },
    resetColumnFilter: (prop: string) => {
      if (prop in noopFilterState.value) {
        const next = { ...noopFilterState.value }
        delete next[prop]
        noopFilterState.value = next
      }
    },
    resetAllFilters: () => {
      noopFilterState.value = {}
    },
    getEnumOptions: (_prop: string) => [],
    filteredData: noopFilterData,
    getFilterValue: (prop: string) => noopFilterState.value[prop],
    isColumnFiltered: (prop: string) => {
      const v = noopFilterState.value[prop]
      return v != null && v !== false
    },
    invalidateRowCache: (_row?: object | null) => {},
    dispose: () => {},
  } as const

  /**
   * <zh/> 快速筛选 noop——无快速搜索文本时替代真实 useQuickFilter | <en/> Quick filter noop — replaces real useQuickFilter when no quick filter text exists
   */
  const noopQuickFilterData = computed(() => ({ data: [] as T[], isFiltered: false }))
  const noopQuickFilterApi = {
    filteredData: noopQuickFilterData,
    hasActiveQuickFilter: computed(() => false),
    invalidateRowCache: (_rowKey: string | number) => {},
    invalidateRowCacheBatch: (_rowKeys: (string | number)[]) => {},
    dispose: () => {},
  } as const

  /**
   * <zh/> 排序 noop——无可排序列时替代真实 useColumnSort | <en/> Sort noop — replaces real useColumnSort when no sortable columns exist
   */
  const noopSortData = computed(() => ({ data: [] as T[], isSorted: false }))
  const noopSortState = injectedSortState ?? shallowRef<SortState[]>([])
  const noopSortApi = {
    sortState: noopSortState,
    // <zh/> noop 期的写入透传到底层共享 sortState（理由同 noopFilterApi.setFilter） | <en/> Pass noop-phase writes through to the shared sortState (same rationale as noopFilterApi.setFilter)
    toggleSort: (prop: string, _event?: { shiftKey?: boolean }) => {
      const list = noopSortState.value
      const idx = list.findIndex(s => s.prop === prop || s.columnKey === prop)
      if (idx < 0) {
        noopSortState.value = [{ prop, order: 'ascending' } as SortState]
      }
      else if (list[idx].order === 'ascending') {
        noopSortState.value = list.map((s, i) => (i === idx ? { ...s, order: 'descending' } : s) as SortState)
      }
      else {
        noopSortState.value = list.filter((_, i) => i !== idx)
      }
    },
    setSort: (prop: string, order: SortOrder) => {
      noopSortState.value = [{ prop, order } as SortState]
    },
    setSorts: (sorts: SortState[]) => {
      noopSortState.value = [...sorts]
    },
    clearSort: () => {
      noopSortState.value = []
    },
    getSortOrder: (columnKey: string) => {
      const s = noopSortState.value.find(x => x.prop === columnKey || x.columnKey === columnKey)
      return (s?.order ?? null) as SortOrder
    },
    getSortIndex: (columnKey: string) => {
      const idx = noopSortState.value.findIndex(x => x.prop === columnKey || x.columnKey === columnKey)
      return idx >= 0 ? idx : -1
    },
    sortedData: noopSortData,
    dispose: () => {},
  } as const

  // <zh/> 使用 shallowRef 持有当前 api 引用——当功能开关切换时，升级为真实 composable | <en/> Use shallowRef to hold the current api reference — upgrades to real composable when the feature flag switches on
  const filterApiRef = shallowRef<UseColumnFilterReturn>(noopFilterApi as unknown as UseColumnFilterReturn)
  const quickFilterApiRef = shallowRef<UseQuickFilterReturn>(noopQuickFilterApi as unknown as UseQuickFilterReturn)
  const sortApiRef = shallowRef<UseColumnSortReturn>(noopSortApi as unknown as UseColumnSortReturn)

  /**
   * <zh/> 动态升级 composables 的资源释放注册表：动态升级路径约束回收排序 Worker 与内部 watch。
   * <zh/> 约束：在 watch 回调（flush:'post'）中创建的 composable 不处于任何组件实例 / effect scope，
   * <zh/> 其内部的 onBeforeUnmount/onScopeDispose 注册会告警并静默失效，sort Worker 永不 terminate、
   * <zh/> 内部 watch 随数据源存续整个应用生命周期。
   * <zh/> 不变量：各可升级 composable 暴露幂等 dispose；本管线在 setup 阶段用唯一的 onScopeDispose
   * <zh/> 统一回收全部动态升级产物。同步首次升级（实例上下文内）同时具备实例级生命周期与注册表兜底，
   * <zh/> 双路径清理均幂等，重复调用无副作用。卸载后再触发的升级请求会被立即丢弃并就地清理。
   * <en/> Disposal registry for dynamically upgraded composables: the dynamic upgrade path
   * <en/> must reclaim the sort Worker and internal watches.
   * <en/> Constraint: composables created inside a watch callback (flush:'post') run outside any component
   * <en/> instance / effect scope, so their internal onBeforeUnmount/onScopeDispose registrations warn and
   * <en/> silently no-op — the sort Worker is never terminated and internal watches live for the app lifetime.
   * <en/> Invariant: each upgradable composable exposes an idempotent dispose; this pipeline collects them
   * <en/> and flushes via a SINGLE setup-time onScopeDispose. The synchronous first upgrade (inside instance
   * <en/> context) has both instance lifecycles and this registry fallback; both cleanup paths are idempotent.
   * <en/> Upgrade requests after teardown are dropped and disposed immediately.
   */
  const upgradedDisposers: Array<() => void> = []
  let upgradedDisposed = false

  function registerUpgradedDisposer(dispose: () => void): void {
    if (upgradedDisposed) {
      dispose()
      return
    }
    upgradedDisposers.push(dispose)
  }

  // <zh/> 仅在存在活动 effect scope 时注册兜底清理——组件 setup 上下文必有 scope；
  // <zh/> 裸调用场景（单测直接调用本函数）无作用域可绑定，注册会告警且无意义。
  // <en/> Register the fallback flush only when an active effect scope exists — component setup
  // <en/> context always has one; bare invocation (unit tests calling this function directly) has
  // <en/> no scope to bind, where registering would warn pointlessly.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      upgradedDisposed = true
      while (upgradedDisposers.length > 0)
        upgradedDisposers.pop()!()
    })
  }

  /**
   * <zh/> 从当前 apiRef 中读取活跃状态，供管线 computed 使用 | <en/> Read active status from current apiRef for pipeline computed usage
   */
  const filterFilteredData = computed(() => filterApiRef.value.filteredData.value)
  const quickFilterFilteredData = computed(() => quickFilterApiRef.value.filteredData.value)
  const sortSortedData = computed(() => sortApiRef.value.sortedData.value)

  // ── 管线顺序（setup 期静态解析；非法回退默认） ──
  const pipelineOrder = resolvePipelineOrder(
    toValue(options.pipelineOrder as MaybeRefOrGetter<DataPipelineStage[] | undefined>),
    options.devWarn,
  )
  const predecessorOf = new Map<DataPipelineStage, DataPipelineStage | null>()
  pipelineOrder.forEach((stage, index) => {
    predecessorOf.set(stage, index === 0 ? null : pipelineOrder[index - 1]!)
  })

  // <zh/> 各阶段输出（按 predecessor 链取值，顺序变化时自动重组；默认顺序下与历史 afterX 逐一等价）
  // <en/> Per-stage outputs chained by predecessor; identical to the historical afterX chain under the default order
  const columnFilterOutput = computed<T[]>(prev => refStable(prev, filterFilteredData.value.isFiltered
    ? filterFilteredData.value.data
    : predecessorData('columnFilter')))
  const quickFilterOutput = computed<T[]>(prev => refStable(prev, quickFilterFilteredData.value.isFiltered
    ? quickFilterFilteredData.value.data
    : predecessorData('quickFilter')))
  const externalFilterOutput = computed<T[]>((prev) => {
    const externalFilterValue = toValue(externalFilter)
    if (!externalFilterValue || !externalFilterValue.isExternalFilterPresent())
      return refStable(prev, predecessorData('externalFilter'))
    const filtered = predecessorData('externalFilter').filter((row: T) => externalFilterValue.doesExternalFilterPass(row))
    return shallowArrayStable(prev, filtered)
  })
  const sortOutput = computed<T[]>(prev => refStable(prev, sortSortedData.value.isSorted
    ? sortSortedData.value.data
    : predecessorData('sort')))

  function stageOutput(stage: DataPipelineStage): T[] {
    // <zh/> switch + assertNever 穷尽兜底：新增阶段时若漏登记 here 会在编译期失败，
    // <zh/> 而非静默落到 sort 分支（历史 if 链的兜底风险）。
    // <en/> switch + assertNever exhaustive fallback: adding a stage without registering it here
    // <en/> fails at compile time instead of silently falling into the sort branch (the old
    // <en/> if-chain's fallback risk).
    switch (stage) {
      case 'columnFilter':
        return columnFilterOutput.value
      case 'quickFilter':
        return quickFilterOutput.value
      case 'externalFilter':
        return externalFilterOutput.value
      case 'sort':
        return sortOutput.value
      default:
        return assertNever(stage)
    }
  }

  function predecessorData(stage: DataPipelineStage): T[] {
    const pred = predecessorOf.get(stage)
    if (pred == null)
      return toValue(pipelineData)
    return stageOutput(pred)
  }

  const finalDisplayData = computed<T[]>(prev =>
    refStable(prev, stageOutput(pipelineOrder.at(-1)!)))

  /**
   * <zh/> 创建快速筛选实例的工厂函数——避免在两个 watch 中重复代码 | <en/> Factory function for creating quick filter instance — avoids duplicating code in two watches
   */
  function createQuickFilter(): UseQuickFilterReturn {
    return useQuickFilter<T>({
      quickFilterText: () => toValue(quickFilterText),
      // <zh/> 输入为其 predecessor 输出（默认=列筛输出，历史行为不变）
      // <en/> Input is its predecessor output (column-filter output by default)
      data: computed(() => predecessorData('quickFilter')),
      columns: () => columnClassification.value.normal,
      rowKey: (row: T, _index: number) => {
        const rk = toValue(rowKeyFn)
        return rk ? String(rk(row)) : ''
      },
      cacheSize: quickFilterCacheSize,
    })
  }

  /**
   * <zh/> 按列分类同步升级 noop → 真实 composable
   * <zh/> 提取为独立函数，在 watch 之前同步执行一次（覆盖初始已有可筛选/可排序列的场景），
   * <zh/> 并在列分类变化时再次执行（覆盖运行时动态添加列的场景）。
   * <en/> Synchronously upgrade noop → real composable based on column classification
   * <en/> Extracted as a standalone function; executed once before the watch (covering initial sortable/filterable columns),
   * <en/> and again on column classification changes (covering runtime dynamic column additions).
   */
  function upgradeComposables(cls: ColumnClassification): void {
    if (cls.hasFilterableColumns && filterApiRef.value === noopFilterApi) {
      const api = useColumnFilter<T>({
        columns: () => columnClassification.value.normal,
        // <zh/> 输入为其 predecessor 输出（默认=pipelineData，历史行为不变）
        // <en/> Input is its predecessor output (pipelineData by default)
        data: computed(() => predecessorData('columnFilter')),
        allData: tableData,
        // <zh/> 注入外部 ref 或 noop 期写入的同一 ref——保证 noop 阶段的 setFilter 不丢失
        // <en/> Injected external ref or the same ref the noop phase wrote into — noop-phase setFilter survives
        filterState: noopFilterState,
      })
      filterApiRef.value = api
      registerUpgradedDisposer(api.dispose)
    }

    const qfText = toValue(quickFilterText)
    if (qfText != null && qfText !== '' && quickFilterApiRef.value === noopQuickFilterApi) {
      const api = createQuickFilter()
      quickFilterApiRef.value = api
      if (api.dispose)
        registerUpgradedDisposer(api.dispose)
    }

    if (cls.hasSortableColumns && sortApiRef.value === noopSortApi) {
      const api = useColumnSort<T>({
        columns: () => columnClassification.value.normal,
        // <zh/> 输入为其 predecessor 输出（默认=外部筛输出，历史行为不变）
        // <en/> Input is its predecessor output (external-filter output by default)
        data: computed(() => predecessorData('sort')),
        // <zh/> 同 noopFilterState：noop 阶段的 setSort/clearSort 写入同一 ref，升级后保留
        // <en/> Same rationale as noopFilterState: noop-phase setSort/clearSort writes land in one ref kept across upgrade
        sortState: noopSortState,
        onSortWorkerError: options.onSortWorkerError,
        maxSortColumns,
      })
      sortApiRef.value = api
      if (api.dispose)
        registerUpgradedDisposer(api.dispose)
    }
  }

  // <zh/> 同步执行首次升级——确保 setup 阶段已有可筛选/可排序列时，
  // <zh/> 用户在 onMounted 同步调用 setSort/setFilter 能命中真实 composable，不被静默丢弃。
  // <en/> Synchronously perform the first upgrade — ensures that when sortable/filterable columns exist at setup,
  // <en/> user calls to setSort/setFilter during onMounted hit the real composable instead of being silently dropped.
  upgradeComposables(columnClassification.value)

  /**
   * <zh/> 列分类升级回调——分类结果变化（含 setup immediate）时按需升级 noop → 真实 composable
   * <en/> Classification upgrade callback — upgrades noop → real composable on classification change (incl. setup immediate)
   */
  function onColumnClassificationChanged(cls: typeof columnClassification.value): void {
    upgradeComposables(cls)
  }
  // <zh/> 列分类变化时按需升级 noop → 真实 composable | <en/> Upgrade noop → real composable on column classification change
  // <zh/> 点燃链：列分类变化 → upgradeComposables 重建 useColumnFilter → filterState 引用更替 → use-remote-refetch 触发 fetchData（列抖动时整链依次点燃，排查从此处起）
  // <en/> Ignition chain: classification change → upgradeComposables rebuilds useColumnFilter → filterState identity swap → use-remote-refetch fires fetchData
  watch(columnClassification, onColumnClassificationChanged, { flush: 'post', immediate: true })

  /**
   * <zh/> 快速筛选升级回调——quickFilterText 从空变为非空且仍为 noop 时升级为真实 api（一次性）
   * <en/> Quick-filter upgrade callback — upgrades to the real api once when quickFilterText turns non-empty while still noop
   */
  function onQuickFilterTextChanged(text: string | undefined): void {
    if (text != null && text !== '' && quickFilterApiRef.value === noopQuickFilterApi) {
      const api = createQuickFilter()
      quickFilterApiRef.value = api
      if (api.dispose)
        registerUpgradedDisposer(api.dispose)
    }
  }
  // <zh/> quickFilterText 从空变为非空时升级快速筛选 api | <en/> Upgrade quick filter api when quickFilterText changes from empty to non-empty
  watch(() => toValue(quickFilterText), onQuickFilterTextChanged)

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

  // ── Row Pinning：在分页后的 visibleData 上提取 pinned 行 ──
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
