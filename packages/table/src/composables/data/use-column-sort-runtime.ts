import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { SortState } from '../../types/sort'
import type { SortWorkerSchedulerReturn } from './sort-worker-scheduler'
import { computed, getCurrentInstance, getCurrentScope, onActivated, onBeforeUnmount, onDeactivated, onScopeDispose, toValue, watch } from 'vue'
import { buildColumnKeyMap } from '../../utils/shared'
import { buildColumnsSortKey, buildSortEntries, computeSortedData } from './use-column-sort-plan'

/**
 * <zh/> 排序运行时依赖 | <en/> Sort runtime deps
 */
export interface UseColumnSortRuntimeDeps<T = any> {
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  data: MaybeRefOrGetter<T[]>
  sortState: Ref<SortState[]>
  /** <zh/> 数据版本递增（版本计数器归宿主，调度器 getDataVersion 同源） | <en/> data-version bump (the counter stays with the host, same source as the scheduler's getDataVersion) */
  bumpDataVersion: () => void
  /** <zh/> Worker 调度器（整体注入，取 shouldUseWorker/requestWorkerSort/isWorkerSorting/abortInFlight/suspend/dispose/getWorkerResult） | <en/> the worker scheduler (injected whole) */
  scheduler: SortWorkerSchedulerReturn<T>
  /** <zh/> 列主键 Map（裁剪 watch 用，来自状态机） | <en/> column-key map (for the prune watch, from the state machine) */
  colMap: ComputedRef<Map<string, ProcessedColumn>>
  /** <zh/> Worker 数据量阈值（预编译判定） | <en/> worker threshold (pre-compile check) */
  sortWorkerThreshold: number
}

/**
 * <zh/> 排序运行时——columnsSortKey 缓存、数据版本失效/列裁剪/Worker 调度三 watch、
 * <zh/> KeepAlive 暂停与最终清理、生命周期注册与 sortedData computed（含 lastGoodSort 防抖快照）。
 *
 * <zh/> 自 use-column-sort.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C）；共享可变状态
 * <zh/> （lastGoodSort/paused/disposed/stop 句柄）随迁归本模块，dataVersion 经 bump 回调注入。
 * <en/> Sort runtime — the columnsSortKey cache, the three watches (data-version invalidation /
 * <en/> column prune / worker scheduling), KeepAlive suspension and final cleanup, lifecycle
 * <en/> registration, and the sortedData computed (with the lastGoodSort anti-flicker snapshot).
 *
 * <en/> Migrated verbatim from use-column-sort.ts (COMPLEXITY-PLAN battle line 3, knife C); the
 * <en/> shared mutable state (lastGoodSort/paused/disposed/stop handles) moves along, while
 * <en/> dataVersion is injected via a bump callback.
 */
export function useColumnSortRuntime<T = any>(deps: UseColumnSortRuntimeDeps<T>) {
  const {
    columns,
    data,
    sortState,
    bumpDataVersion,
    scheduler,
    colMap,
    sortWorkerThreshold,
  } = deps
  const { isWorkerSorting, requestWorkerSort, shouldUseWorker } = scheduler

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
  let lastGoodSort: { sourceRows: T[], payload: { data: T[], isSorted: boolean } } | null = null

  // <zh/> 提取为 computed 缓存 columnsSortKey，避免每次 watch 求值时重复计算
  // <zh/> watch 的 getter 会多次调用 buildColumnsSortKey（依赖追踪 + 触发时各一次），computed 保证同 tick 内只算一次
  // <en/> Extract into computed to cache columnsSortKey, avoiding redundant calculations on each watch evaluation
  // <en/> watch getter calls buildColumnsSortKey multiple times (dep tracking + on trigger), computed ensures single calc per tick
  const columnsSortKey = computed<unknown[]>((previous) => {
    const next = buildColumnsSortKey(toValue(columns))
    return previous && previous.length === next.length && next.every((value, index) => Object.is(value, previous[index]))
      ? previous
      : next
  })
  let disposed = false
  let paused = false
  const sources = [() => toValue(data), sortState, columnsSortKey] as const
  const stopInvalidation = watch(sources, () => {
    bumpDataVersion()
    if (lastGoodSort?.sourceRows !== toValue(data))
      lastGoodSort = null
  }, { flush: 'sync' })

  /**
   * <zh/> 列集合变更时裁剪失效的排序项
   * <en/> Prune stale sort entries when the column set changes
   *
   * @remarks
   * <zh/> 残留项两重危害：① 随 `getColumnState` 持久化，回显时出现幽灵排序；
   * <zh/> ② 经 `use-table-request.buildRequestParams` 以 `sort` 参数发往服务端（该处仅按 `order != null` 过滤，
   * <zh/> 不校验列是否存在）。裁剪口径：`columnKey` 与 `prop` **两者都无法解析才移除**（`buildColumnKeyMap`
   * <zh/> 已双登记规范键 + prop 别名）。`sortState` 无论注入还是自建均为库内状态，无外部受控所有者，裁剪不写第三方状态。
   * <en/> Leftover entries cause two harms: ① persisted via `getColumnState`, resurfacing as phantom sorts;
   * <en/> ② sent as the `sort` param by `use-table-request.buildRequestParams` (filters only on `order != null`,
   * <en/> never validates column existence). Pruning caliber: remove only when **both** `columnKey` and `prop`
   * <en/> fail to resolve (`buildColumnKeyMap` registers canonical key + prop alias). `sortState` is library-owned
   * <en/> whether injected or created locally — no external controlled owner, so pruning never rewrites third-party state.
   */
  const stopSortPrune = watch(
    () => toValue(columns),
    () => {
      if (disposed)
        return
      const list = sortState.value
      if (list.length === 0)
        return
      const map = colMap.value
      const next = list.filter(
        s => (s.columnKey != null && map.has(s.columnKey)) || (s.prop != null && map.has(s.prop)),
      )
      // <zh/> 仅在确有裁剪时写回——保持引用稳定，避免下游（sortedData / 事件监听）无谓重算
      // <en/> Write back only when something was actually pruned — keeps the reference stable so
      // <en/> downstream (sortedData / watchers) does not recompute needlessly
      if (next.length !== list.length)
        sortState.value = next
    },
    { flush: 'sync' },
  )

  const stopScheduling = watch(
    sources,
    () => {
      if (disposed || paused)
        return
      /**
       * <zh/> 构建 colMap 与编译产物一次，透传给 shouldUseWorker 和 requestWorkerSort 复用，
       * <zh/> 避免在单个 watch tick 内重复调用 buildColumnKeyMap + 两次 buildSortEntries
       * <en/> Build colMap and the compile product once, pass through to shouldUseWorker and
       * <en/> requestWorkerSort for reuse, avoiding redundant buildColumnKeyMap + double
       * <en/> buildSortEntries calls within a single watch tick
       */
      const builtColMap = buildColumnKeyMap(toValue(columns))
      const cols = toValue(columns)
      // <zh/> 仅大数据 + Worker 可用时预编译：小数据/无 Worker 路径由 shouldUseWorker 廉价早退，
      // <zh/> 避免为注定走主线程的 tick 支付一次编译。
      // <en/> Pre-compile only for large data with Worker available: small-data/no-Worker ticks
      // <en/> early-exit cheaply inside shouldUseWorker, so don't pay one compile for them.
      const plan = (scheduler.isWorkerAvailable() && toValue(data).length > sortWorkerThreshold)
        ? buildSortEntries(sortState.value, cols, builtColMap)
        : undefined
      if (shouldUseWorker(builtColMap, plan)) {
        isWorkerSorting.value = true
        requestWorkerSort(builtColMap, plan)
      }
      else {
        scheduler.abortInFlight()
      }
    },
    /**
     * <zh/> 使用 flush: 'pre' 确保 isWorkerSorting / workerResult 的修改在 sortedData computed 求值前完成。
     * <zh/> 若使用 flush: 'post'，computed 先以旧状态求值（执行一次 computeSortedData），
     * <zh/> 然后 watch 修改状态触发 computed 二次求值，造成双重排序计算。
     * <en/> Use flush: 'pre' to ensure isWorkerSorting / workerResult are updated before sortedData computed evaluates.
     * <en/> With flush: 'post', the computed first evaluates with stale state (running computeSortedData once),
     * <en/> then the watch modifies state triggering a second evaluation, causing double sort computation.
     */
    { flush: 'pre' },
  )

  /**
   * <zh/> 挂起排序资源（KeepAlive deactivate）：中止在飞 Worker 请求但保留 Worker 实例，
   * <zh/> activated 后可直接复用；最终销毁走 cleanupSortResources（dispose 销毁实例）。
   * <en/> Suspend sort resources (KeepAlive deactivate): abort in-flight work but keep the
   * <en/> Worker instance for reuse on activated; final teardown uses dispose.
   */
  function pauseSortResources() {
    paused = true
    bumpDataVersion()
    scheduler.suspend()
    lastGoodSort = null
  }

  function cleanupSortResources() {
    if (disposed)
      return
    disposed = true
    stopScheduling()
    stopInvalidation()
    stopSortPrune()
    // <zh/> 最终销毁必须 terminate Worker（与 pause 的 suspend 复用语义分离）
    // <en/> Final teardown must terminate the Worker (unlike suspend-on-pause)
    paused = true
    bumpDataVersion()
    scheduler.dispose()
    lastGoodSort = null
  }

  if (getCurrentScope())
    onScopeDispose(cleanupSortResources)

  /**
   * <zh/> 组件实例存在时才注册实例级生命周期——动态升级路径（管线 watch 回调内创建）
   * <zh/> 无活动实例，直接注册会告警且静默失效；该场景由管线通过 dispose 统一回收。
   * <en/> Register instance-level lifecycles only when a component instance exists — the dynamic
   * <en/> upgrade path (created inside a pipeline watch callback) has no active instance, where
   * <en/> direct registration would warn and silently no-op; that scenario is reclaimed by the
   * <en/> pipeline via dispose.
   */
  if (getCurrentInstance()) {
    onBeforeUnmount(cleanupSortResources)

    onDeactivated(pauseSortResources)

    onActivated(() => {
      if (disposed)
        return
      paused = false
      if (sortState.value.length > 0 && shouldUseWorker()) {
        isWorkerSorting.value = true
        requestWorkerSort()
      }
    })
  }

  const sortedData = computed<{ data: T[], isSorted: boolean }>((prev) => {
    const rows = toValue(data)
    const workerResult = scheduler.getWorkerResult()

    // <zh/> Worker 在飞期：优先维持最近已排序视图（引用未变时），消除未序闪烁 <en/> Worker in-flight: prefer the last sorted view (same ref), removing the unsorted flicker
    if (isWorkerSorting.value) {
      if (workerResult)
        return workerResult
      if (lastGoodSort && lastGoodSort.sourceRows === rows)
        return lastGoodSort.payload
      return prev && !prev.isSorted && prev.data === rows ? prev : { data: rows, isSorted: false }
    }

    let next: { data: T[], isSorted: boolean }
    if (workerResult) {
      next = workerResult
    }
    else {
      next = computeSortedData(toValue(data), sortState.value, toValue(columns) as ProcessedColumn[])
    }

    // <zh/> 记录成功排序快照，供下一次 Worker 在飞窗口维持视图 | <en/> capture snapshot for the next in-flight window
    if (next.isSorted)
      lastGoodSort = { sourceRows: rows, payload: next }

    if (prev && prev.isSorted === next.isSorted && prev.data === next.data)
      return prev
    return next
  })

  return {
    sortedData,
    releaseLastGoodSort: () => {
      lastGoodSort = null
    },
    dispose: cleanupSortResources,
  }
}
