import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { DataPipelineStage } from '../../types/config-options'
import type { SortState } from '../../types/sort'
import type { UseColumnFilterReturn } from '../data/use-column-filter'
import type { UseColumnSortReturn } from '../data/use-column-sort'
import type { UseQuickFilterReturn } from '../data/use-quick-filter'
import type { ColumnClassification } from './use-column-classification'
import { computed, getCurrentScope, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import { useColumnFilter } from '../data/use-column-filter'
import { useColumnSort } from '../data/use-column-sort'
import { useQuickFilter } from '../data/use-quick-filter'
import { createPipelineNoopApis } from './use-pipeline-noop-apis'
import { assertNever, refStable, shallowArrayStable } from './use-pipeline-stable'
import { resolvePipelineOrder } from './use-table-data-pipeline-order'

/**
 * <zh/> 筛选/排序懒升级引擎依赖 | <en/> Lazy filter/sort upgrade-engine deps
 */
export interface PipelineFilterSortDeps<T = any> {
  columnClassification: ComputedRef<ColumnClassification>
  /** <zh/> 管线入口数据 getter | <en/> pipeline entry data getter */
  pipelineData: MaybeRefOrGetter<T[]>
  /** <zh/> 全量数据（列筛 allData 用） | <en/> full data (column-filter allData) */
  tableData: MaybeRefOrGetter<T[]>
  pipelineOrder?: MaybeRefOrGetter<DataPipelineStage[] | undefined>
  quickFilterText?: MaybeRefOrGetter<string | undefined>
  externalFilter?: MaybeRefOrGetter<import('../../types/config').ExternalFilterConfig<T> | undefined>
  /** <zh/> 行键函数 getter（快速筛选 rowKey 用） | <en/> row-key function getter (quick-filter rowKey) */
  rowKeyFn?: MaybeRefOrGetter<(row: T) => string>
  quickFilterCacheSize?: number
  maxSortColumns?: number
  onSortWorkerError?: (error: Error) => void
  devWarn?: (message: string, ...args: unknown[]) => void
  sortState?: Ref<SortState[]>
  filterState?: Ref<Record<string, any>>
}

/**
 * <zh/> 筛选/排序懒升级引擎——noop 存根、apiRef 升级机制（含释放注册表）、
 * <zh/> 管线阶段链（predecessor 串联的各阶段输出与 finalDisplayData）。
 *
 * <zh/> 自 use-table-data-pipeline.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），
 * <zh/> 函数体逐字未改；noop 存根经 use-pipeline-noop-apis 工厂创建。
 * <en/> Lazy filter/sort upgrade engine — noop stubs, the apiRef upgrade machinery (with the
 * <en/> disposal registry), and the pipeline stage chain (predecessor-linked stage outputs and
 * finalDisplayData).
 *
 * <en/> Migrated verbatim from use-table-data-pipeline.ts (COMPLEXITY-PLAN battle line 3, knife C),
 * <en/> function bodies unchanged; noop stubs come from the use-pipeline-noop-apis factory.
 */
export function usePipelineFilterSort<T = any>(deps: PipelineFilterSortDeps<T>) {
  const {
    columnClassification,
    pipelineData,
    tableData,
    pipelineOrder: pipelineOrderOption,
    quickFilterText,
    externalFilter,
    rowKeyFn,
    quickFilterCacheSize,
    maxSortColumns,
    onSortWorkerError,
    devWarn: devWarnOption,
    sortState: injectedSortState,
    filterState: injectedFilterState,
  } = deps

  // <zh/> noop 存根经 use-pipeline-noop-apis 工厂创建（预创建状态注入共享） | <en/> noop stubs via the use-pipeline-noop-apis factory (pre-created states injected and shared)
  const {
    noopFilterApi,
    noopQuickFilterApi,
    noopSortApi,
    noopFilterState,
    noopSortState,
  } = createPipelineNoopApis({ injectedFilterState, injectedSortState })

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

  // <zh/> 管线顺序（setup 期静态解析；非法回退默认） <en/> Pipeline order resolved once at setup; invalid input falls back to the default
  const pipelineOrder = resolvePipelineOrder(
    toValue(pipelineOrderOption as MaybeRefOrGetter<DataPipelineStage[] | undefined>),
    devWarnOption,
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
        onSortWorkerError,
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
  return {
    finalDisplayData,
    filterApiRef,
    quickFilterApiRef,
    sortApiRef,
    noopFilterApi,
    noopQuickFilterApi,
    noopSortApi,
  }
}
