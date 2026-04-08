import type { ProcessedColumn } from '../../types'
import type { SortState } from '../../types/sort'
/**
 * <zh/> 列排序 Composable（编排器）
 * <en/> Column sort composable (orchestrator)
 *
 * @remarks
 * <zh/> 管理多列排序状态和客户端数据排序。支持单击（单列）和 Shift+单击（多列）排序，以及自定义 sortBy、sortMethod 和服务端排序委托
 * <en/> Manages multi-column sort state and client-side data sorting. Supports single-click (single column) and Shift+click (multi-column) sorting, with custom sortBy, sortMethod, and server-side sort delegation
 *
 * <zh/> 大数据量（>sortWorkerThreshold）时自动使用 Web Worker 后台排序，避免 Array.sort 阻塞主线程。Worker 不可用时回退至主线程同步排序
 * <en/> Automatically uses Web Worker background sorting for large datasets (>sortWorkerThreshold) to avoid blocking the main thread. Falls back to main thread synchronous sorting when Worker is unavailable
 *
 * <zh/> 子域拆分（COMPLEXITY-PLAN 战线三，刀法 A+C）：plan 纯函数层 / state 状态机；本文件保留
 * <zh/> Worker 调度、三 watch（失效/裁剪/调度）、生命周期与 sortedData computed。
 * <en/> Sub-domain split (COMPLEXITY-PLAN battle line 3, knives A+C): the plan pure layer / the
 * <en/> state machine; this file keeps Worker scheduling, the three watches (invalidation/prune/
 * <en/> scheduling), lifecycle and the sortedData computed.
 */
import type { UseColumnSortOptions, UseColumnSortReturn } from './use-column-sort-types'
import { shallowRef, toValue } from 'vue'
import { createSortWorkerScheduler } from './sort-worker-scheduler'
import { buildSortEntries, computeSortedData } from './use-column-sort-plan'
import { useColumnSortRuntime } from './use-column-sort-runtime'
import { useColumnSortState } from './use-column-sort-state'

// <zh/> SortEntry / SortPlan 转出自 ./sort-plan，Worker 调度见 ./sort-worker-scheduler
// <en/> SortEntry / SortPlan live in ./sort-plan (pure type motion); worker scheduling in ./sort-worker-scheduler
// <zh/> SortState 唯一真源见 `types/sort.ts`；此处转出以便排序消费者单点导入
// <en/> Single source of truth for SortState in `types/sort.ts`; re-exported here for single-point imports
export type { SortState } from '../../types/sort'

// <zh/> 排序取值函数编译转出自 ./sort-accessor，供调用方单点导入
// <en/> Sort accessor compilation lives in ./sort-accessor (pure code motion); re-exported here for single-point imports
export { compileSortAccessor, getCachedSortAccessor } from './sort-accessor'

// <zh/> 契约类型自子模块 re-export，既有导入路径零变化 | <en/> Contracts re-exported from sub-modules; import paths unchanged
export type { UseColumnSortOptions, UseColumnSortReturn } from './use-column-sort-types'

/**
 * 列排序组合式函数
 * Composable for column sorting
 *
 * 管理多列排序状态和客户端数据排序。
 * @param options - 排序配置
 * @returns 排序状态和方法
 * @example
 * ```ts
 * const sort = useColumnSort({
 *   columns: effectiveColumns,
 *   data: visibleData,
 * })
 * sort.toggleSort('name')
 * ```
 */
export function useColumnSort<T = any>(
  options: UseColumnSortOptions<T>,
): UseColumnSortReturn<T> {
  const {
    columns,
    data,
    sortState: injectedSortState,
    sortWorkerThreshold = 5000,
    sortWorkerMinEntries = 100_000,
    sortWorkerTimeout = 5000,
    onSortWorkerError,
    maxSortColumns,
  } = options

  const sortState = injectedSortState ?? shallowRef<SortState[]>([])

  // <zh/> 排序状态机（colMap/toSortEntry/toggle/set/cap/getters）自 use-column-sort-state.ts 拆出（刀法 C）
  // <en/> Sort state machine (colMap/toSortEntry/toggle/set/cap/getters) split into use-column-sort-state.ts (knife C)
  const {
    colMap,
    toggleSort,
    setSort,
    setSorts,
    getSortOrder,
    getSortIndex,
  } = useColumnSortState({ columns, sortState, maxSortColumns })

  /**
   * 数据版本号：每次 data 引用变化时递增，用于 Worker 返回时校验数据是否已过期。
   * 版本号比较零内存开销，避免持有数据引用阻止 GC。
   */
  let dataVersion = 0

  // <zh/> Worker 调度器——运行时状态（实例/序号/超时/在飞标志/结果）归调度器所有；
  // <zh/> 数据版本号计数器归本模块所有，调度器仅经 getDataVersion 读取。
  // <zh/> buildSortEntries / computeSortedData 为函数声明（提升），此处引用安全。
  // <en/> Worker scheduler owns runtime state (instance/id/timeout/in-flight/result); the data version
  // <en/> counter stays here and the scheduler only reads it via getDataVersion. buildSortEntries /
  // <en/> computeSortedData are hoisted declarations, so referencing them here is safe.
  const scheduler = createSortWorkerScheduler<T>({
    data,
    columns,
    sortState,
    getDataVersion: () => dataVersion,
    sortWorkerThreshold,
    sortWorkerMinEntries,
    sortWorkerTimeout,
    onSortWorkerError,
    buildSortEntries,
    // <zh/> 纯函数化的 computeSortedData 经零参包装适配调度器契约 | <en/> the purified computeSortedData adapts to the scheduler contract via a zero-arg wrapper
    computeSortedData: () => computeSortedData(toValue(data), sortState.value, toValue(columns) as ProcessedColumn[]),
  })

  /**
   * <zh/> 最近一次成功排序的快照（源数据引用 + 已排序载荷）。
   * <zh/> Worker 在飞期间若源数据引用未变，sortedData 持续返回该快照——
   * <zh/> 消除「点击排序 → 短暂跳回未序 → 再跳到新序」的抖动（报告 §七.2）。
   * <zh/> 数据引用变化时旧序无法映射到新集合，退回原始行。
   * <en/> Snapshot of the last successful sort (source rows ref + sorted payload).
   * <en/> While a Worker sort is in-flight with an unchanged source reference, sortedData keeps
   * <en/> returning this snapshot — removing the "click sort → flicker to unsorted → jump to new
   * <en/> order" jitter (report §VII.2). When the dataset itself changed, the old order cannot map
   * <en/> onto the new collection and raw rows are returned instead.
   */
  // <zh/> 运行时释放钩子的后绑定 holder——clearSort 定义先于运行时装配，运行期才调用
  // <en/> Late-bound holder for the runtime release hook — clearSort is defined before the runtime assembly, invoked only at runtime
  const releaseLastGoodSortHolder: { release: () => void } = { release: () => {} }

  function clearSort() {
    /**
     * <zh/> 终止进行中的 Worker 排序（经调度器 abortInFlight）——clearSort 清空排序状态后，
     * <zh/> 若 Worker 仍在排序旧数据，返回的 sortedIndices 会映射到错误的行。
     * <en/> Terminate in-flight Worker sort via the scheduler — stale results are discarded,
     * <en/> ensuring sortedData computed immediately takes the computeSortedData path (returning unsorted data).
     */
    scheduler.abortInFlight()
    // <zh/> 释放上次成功排序快照：其持有旧源数据引用与排序载荷，清除排序后不再被
    // <zh/> sortedData 消费（isWorkerSorting 已置 false），置空避免大表内存滞留。
    // <en/> Release the last-good-sort snapshot: it pins the old source rows and sorted payload,
    // <en/> no longer consumed by sortedData after clearing (isWorkerSorting is false) — null it
    // <en/> to avoid pinning large datasets.
    releaseLastGoodSortHolder.release()
    sortState.value = []
  }

  // <zh/> buildColumnsSortKey 已迁 use-column-sort-plan.ts | <en/> buildColumnsSortKey moved into use-column-sort-plan.ts

  // <zh/> 排序运行时（columnsSortKey/三 watch/生命周期/sortedData）自 use-column-sort-runtime.ts 拆出（刀法 C）
  // <en/> Sort runtime (columnsSortKey / three watches / lifecycle / sortedData) split into use-column-sort-runtime.ts (knife C)
  const sortRuntime = useColumnSortRuntime<T>({
    columns,
    data,
    sortState,
    bumpDataVersion: () => {
      dataVersion++
    },
    scheduler,
    colMap,
    sortWorkerThreshold,
  })
  const { sortedData, dispose: disposeSortResources } = sortRuntime
  releaseLastGoodSortHolder.release = sortRuntime.releaseLastGoodSort

  return {
    sortState,
    toggleSort,
    setSort,
    setSorts,
    clearSort,
    getSortOrder,
    getSortIndex,
    sortedData,
    dispose: disposeSortResources,
  }
}
