/**
 * <zh/> 列排序 Composable
 * <en/> Column sort composable
 *
 * @remarks
 * <zh/> 管理多列排序状态和客户端数据排序。支持单击（单列）和 Shift+单击（多列）排序，以及自定义 sortBy、sortMethod 和服务端排序委托
 * <en/> Manages multi-column sort state and client-side data sorting. Supports single-click (single column) and Shift+click (multi-column) sorting, with custom sortBy, sortMethod, and server-side sort delegation
 *
 * <zh/> 大数据量（>sortWorkerThreshold）时自动使用 Web Worker 后台排序，避免 Array.sort 阻塞主线程。Worker 不可用时回退至主线程同步排序
 * <en/> Automatically uses Web Worker background sorting for large datasets (>sortWorkerThreshold) to avoid blocking the main thread. Falls back to main thread synchronous sorting when Worker is unavailable
 */
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ColumnSortableConfig, ProcessedColumn } from '../../types'
import type { SortOrder, SortState } from '../../types/sort'
import type { SortEntry } from './sort-plan'
import { computed, getCurrentInstance, getCurrentScope, onActivated, onBeforeUnmount, onDeactivated, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import { buildColumnKeyMap, getColumnKey, resolveColumnProp } from '../../utils/shared'
import { compareSortValues } from '../../utils/sort-comparator'
import { getCachedSortAccessor } from './sort-accessor'
import { createSortWorkerScheduler } from './sort-worker-scheduler'

// <zh/> SortEntry / SortPlan 转出自 ./sort-plan，Worker 调度见 ./sort-worker-scheduler
// <en/> SortEntry / SortPlan live in ./sort-plan (pure type motion); worker scheduling in ./sort-worker-scheduler
// <zh/> SortState 唯一真源见 `types/sort.ts`；此处转出以便排序消费者单点导入
// <en/> Single source of truth for SortState in `types/sort.ts`; re-exported here for single-point imports
export type { SortState } from '../../types/sort'

const ASC = 'ascending' as const
const DESC = 'descending' as const

/**
 * useColumnSort 配置选项
 * Options for useColumnSort composable
 */
export interface UseColumnSortOptions<T = any> {
  /**
   * 列定义列表（支持响应式）
   * Column definition list (reactive)
   */
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  /**
   * 待排序数据源（支持响应式）
   * Data source to be sorted (reactive)
   */
  data: MaybeRefOrGetter<T[]>
  /**
   * <zh/> 外部排序状态——提供时复用该 ref 而非内部创建。
   * <zh/> 预创建共享状态切口：调用方预创建后同时注入请求域与管线，排序状态标识全链路稳定。
   * <en/> External sort state — reused when provided instead of creating one internally.
   * <en/> Pre-created shared state seam: callers pre-create it and inject into both the request domain and the pipeline, keeping sort-state identity stable across the chain.
   */
  sortState?: Ref<SortState[]>
  /** <zh/> 数据行数阈值，超过时使用 Web Worker 后台排序 | <en/> Row count threshold for Web Worker background sorting */
  sortWorkerThreshold?: number
  /** <zh/> 总排序键数阈值，低于此值直接主线程排序 | <en/> Total sort key threshold, below which main-thread sorting is used */
  sortWorkerMinEntries?: number
  /** <zh/> Worker 排序超时时间（ms） | <en/> Worker sort timeout in milliseconds */
  sortWorkerTimeout?: number
  /** <zh/> Worker 创建失败或运行出错时的回调 | <en/> Callback for Worker creation failure or runtime error */
  onSortWorkerError?: (error: Error) => void
  /**
   * <zh/> 多列排序最大列数（支持响应式），默认不限；超出时 FIFO 淘汰最早列 | <en/> Max multi-sort columns (reactive), unlimited by default; oldest evicted FIFO when exceeded
   */
  maxSortColumns?: MaybeRefOrGetter<number | undefined>
}

/**
 * useColumnSort 返回值
 * Return value of useColumnSort composable
 */
export interface UseColumnSortReturn<T = any> {
  /**
   * 当前多列排序状态数组
   * Current multi-column sort state array
   */
  sortState: Ref<SortState[]>
  /**
   * <zh/> 切换指定列的排序状态 | <en/> Toggle sort state for the specified column
   * @param prop - <zh/> 列属性名 | <en/> column property name
   * @param event - <zh/> 键盘事件，用于检测 Shift 键 | <en/> keyboard event, used to detect Shift key
   * @param event.shiftKey - <zh/> 是否按住 Shift 键，true 时追加到多列排序 | <en/> whether Shift is held, true to append to multi-column sort
   */
  toggleSort: (prop: string, event?: { shiftKey?: boolean }) => void
  /**
   * <zh/> 直接设置指定列的排序方向 | <en/> Set sort direction for the specified column directly
   * @param prop - <zh/> 列属性名 | <en/> column property name
   * @param order - <zh/> 排序方向（null 表示清除该列排序） | <en/> sort direction (null to clear sort for this column)
   */
  setSort: (prop: string, order: SortOrder) => void
  /**
   * <zh/> 批量设置多列排序状态（覆盖现有排序） | <en/> Batch set multi-column sort state (overwrites existing)
   * @param sorts - <zh/> 排序状态数组 | <en/> sort state array
   */
  setSorts: (sorts: SortState[]) => void
  /**
   * 清除所有列的排序状态
   * Clear sort state of all columns
   */
  clearSort: () => void
  /**
   * <zh/> 获取指定列的当前排序方向 | <en/> Get the current sort direction for the specified column
   * @param columnKey - <zh/> 列标识键 | <en/> column key
   * @returns <zh/> 升序、降序或 null | <en/> ascending, descending, or null
   */
  getSortOrder: (columnKey: string) => SortOrder
  /**
   * <zh/> 获取指定列在多列排序中的索引位置（0-based） | <en/> Get the index position (0-based) of a column in multi-column sort
   * @param columnKey - <zh/> 列标识键 | <en/> column key
   * @returns <zh/> 索引位置，未参与排序时返回 -1 | <en/> index position, -1 if not participating in sort
   */
  getSortIndex: (columnKey: string) => number
  /**
   * 已排序的计算后数据
   * 包含排序后的数据行数组和是否已排序的标志
   * Sorted computed data
   * Contains the sorted data row array and a flag indicating whether sorting was applied
   */
  sortedData: ComputedRef<{ data: T[], isSorted: boolean }>
  /**
   * <zh/> 手动释放排序资源（Worker / 定时器 / 在飞状态），幂等可重复调用。
   * <zh/> 供动态创建场景兜底：当本 composable 在 watch 回调等无组件实例上下文中被创建时，
   * <zh/> 内部的 onBeforeUnmount/onDeactivated 注册会静默失效，调用方必须持有 dispose
   * <zh/> 并在自身作用域销毁时统一回收（参见 use-table-data-pipeline 的升级注册表）。
   * <en/> Manually release sort resources (Worker / timers / in-flight state); idempotent.
   * <en/> Fallback for dynamic creation: when this composable is created without a component
   * <en/> instance context (e.g. inside a watch callback), its internal onBeforeUnmount/
   * <en/> onDeactivated registrations silently no-op — the caller must hold `dispose` and flush
   * <en/> it when its own scope stops (see the upgrade registry in use-table-data-pipeline).
   */
  dispose?: () => void
}

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

  /**
   * <zh/> 缓存的列主键 Map——基于 columns computed 缓存，避免 resolveColumnKey 每次调用都重建 O(n) Map
   * <en/> Cached column-key Map — based on columns computed, avoids rebuilding O(n) Map on every resolveColumnKey call
   */
  const colMap = computed(() => buildColumnKeyMap(toValue(columns)))

  /**
   * <zh/> 将调用方传入的 prop/columnKey 解析为内部主键：优先取列定义的 columnKey，
   * <zh/> 找不到时按原值（本身即 columnKey 或外部手动构造的 prop）兜底。
   * <zh/> 使用缓存的 colMap computed，避免每次调用都重建 Map。
   * <en/> Resolve caller-supplied prop/columnKey into the internal primary key:
   * <en/> prefer the column's columnKey; fall back to the raw value otherwise.
   * <en/> Uses the cached colMap computed to avoid rebuilding Map on every call.
   */
  function resolveColumnKey(input: string): string {
    const col = colMap.value.get(input)
    if (col)
      return getColumnKey(col)
    return input
  }

  function toSortEntry(prop: string, order: SortOrder): SortState {
    const columnKey = resolveColumnKey(prop)
    // <zh/> prop 必须保留数据字段（供 autoParams 发服务端），columnKey 保留列身份；
    // <zh/> key!==prop 时禁止把 canonical key 写进 prop。
    // <en/> `prop` must stay the data field (autoParams sends it to the server) while `columnKey` keeps
    // <en/> the column identity; the canonical key must never be written into `prop`.
    const col = colMap.value.get(prop) ?? colMap.value.get(columnKey)
    const dataProp = col ? (resolveColumnProp(col as unknown as Record<string, any>) ?? columnKey) : prop
    return { prop: dataProp, order, columnKey }
  }

  function toggleSort(prop: string, event?: { shiftKey?: boolean }) {
    const key = resolveColumnKey(prop)
    if (event?.shiftKey) {
      toggleSortMulti(key)
    }
    else {
      toggleSortSingle(key)
    }
  }

  function toggleSortSingle(key: string) {
    const current = sortState.value
    if (current.length > 0 && (current[0].columnKey ?? current[0].prop) === key) {
      if (current[0].order === ASC) {
        sortState.value = [toSortEntry(key, DESC)]
      }
      else if (current[0].order === DESC) {
        sortState.value = []
      }
      else {
        sortState.value = [toSortEntry(key, ASC)]
      }
    }
    else {
      sortState.value = [toSortEntry(key, ASC)]
    }
  }

  function toggleSortMulti(key: string) {
    const current = sortState.value
    const existingIndex = current.findIndex(s => (s.columnKey ?? s.prop) === key)

    if (existingIndex >= 0) {
      if (current[existingIndex].order === ASC) {
        const next = current.map(s => ({ ...s }))
        next[existingIndex] = toSortEntry(key, DESC)
        sortState.value = next
      }
      else {
        sortState.value = current.filter(s => (s.columnKey ?? s.prop) !== key)
      }
    }
    else {
      sortState.value = capMultiSort([...current, toSortEntry(key, ASC)])
    }
  }

  /**
   * <zh/> 多列排序上限裁剪——超出 maxSortColumns 时淘汰最早的排序列（FIFO）；
   * <zh/> 设为 1 等价于关闭多列排序；未配置时不限（向后兼容）。
   * <zh/> 同时按键去重并保留末次声明，保证 sortState 键唯一（比较器按序应用的前提）。
   * <en/> Multi-sort cap — evict the oldest sort columns (FIFO) beyond maxSortColumns;
   * <en/> setting it to 1 effectively disables multi-sort; unlimited when unset.
   * <en/> Also dedupes by key keeping the last declaration, guaranteeing unique keys in
   * <en/> sortState (a precondition for the comparator applying entries in order).
   */
  function capMultiSort(entries: SortState[]): SortState[] {
    const seen = new Set<string>()
    const deduped: SortState[] = []
    for (let i = entries.length - 1; i >= 0; i--) {
      const k = entries[i].columnKey ?? entries[i].prop
      if (seen.has(k))
        continue
      seen.add(k)
      deduped.unshift(entries[i])
    }
    const max = toValue(maxSortColumns)
    return max != null && max >= 1 && deduped.length > max
      ? deduped.slice(deduped.length - max)
      : deduped
  }

  function setSort(prop: string, order: SortOrder) {
    if (order) {
      sortState.value = [toSortEntry(prop, order)]
    }
    else {
      // <zh/> order 为空仅移除该列（与 toggleSortMulti 移除语义一致），禁止清空全部
      // <en/> Null order removes only this column (same as toggleSortMulti removal), never clears all
      const key = resolveColumnKey(prop)
      const current = sortState.value
      const next = current.filter(s => (s.columnKey ?? s.prop) !== key)
      if (next.length !== current.length)
        sortState.value = next
    }
  }

  function setSorts(sorts: SortState[]) {
    // <zh/> 编程式批量设置与点击路径共用同一上限/去重裁剪（点击路径同样受 maxSortColumns 约束）
    // <en/> Programmatic batch set shares the same cap/dedupe as the click path
    // <en/> (historically bypassed maxSortColumns — fixed)
    sortState.value = capMultiSort(
      sorts
        .filter(s => s.prop && s.order)
        .map((s) => {
          // <zh/> 优先用调用方显式 columnKey 定列，避免重派生丢失；prop 仍经 toSortEntry 归一化为数据字段
          // <en/> Prefer the caller-provided columnKey for identity; prop is still normalized to the data field
          const entry = toSortEntry(s.columnKey ?? s.prop, s.order)
          if (s.columnKey)
            entry.columnKey = s.columnKey
          return entry
        }),
    )
  }

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
    computeSortedData,
  })
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
    lastGoodSort = null
    sortState.value = []
  }

  function getSortOrder(columnKey: string): SortOrder {
    const entry = sortState.value.find(s => s.columnKey === columnKey || s.prop === columnKey)
    return entry?.order ?? null
  }

  function getSortIndex(columnKey: string): number {
    return sortState.value.findIndex(s => s.columnKey === columnKey || s.prop === columnKey)
  }

  // <zh/> buildColumnKeyMap 已收编至 utils/shared（与 use-column-filter 共用，首见优先语义），
  // <zh/> 本地副本删除以消除双实现漂移风险。
  // <en/> buildColumnKeyMap consolidated into utils/shared (shared with use-column-filter,
  // <en/> first-match-wins semantics); local copy removed to eliminate dual-implementation drift.

  /**
   * <zh/> 解析列的 sortable 配置对象——统一提取逻辑，消除 buildSortEntries 和 shouldUseWorker 中的重复代码
   * <en/> Resolve column's sortable config object — unifies extraction logic, eliminating duplication between buildSortEntries and shouldUseWorker
   *
   * @param col - <zh/> 列定义（可为 undefined） | <en/> column definition (can be undefined)
   * @returns <zh/> ColumnSortableConfig 或 undefined | <en/> ColumnSortableConfig or undefined
   */
  function resolveSortableConfig(col: ProcessedColumn | undefined): ColumnSortableConfig | undefined {
    if (!col)
      return undefined
    const sortable = col.sortable
    return typeof sortable === 'object' && sortable !== null
      ? (sortable as ColumnSortableConfig)
      : undefined
  }

  /**
   * <zh/> 构建排序条目并检测服务端排序委托
   * <en/> Build sort entries and detect server-side sort delegation
   *
   * @remarks
   * <zh/> 统一 computeSortedData 和 requestWorkerSort 的重复逻辑：
   * <zh/> 1. 过滤有效排序状态 → 2. 检测服务端/custom 排序 → 3. 编译 SortEntry 数组
   * <en/> Unifies duplicated logic between computeSortedData and requestWorkerSort:
   * <en/> 1. Filter valid sort states → 2. Detect server/custom sort → 3. Compile SortEntry array
   *
   * @returns <zh/> `{ sortEntries, isServerSort }` — isServerSort=true 时调用方应跳过本地排序 | <en/> `{ sortEntries, isServerSort }` — caller should skip local sort when isServerSort=true
   */
  function buildSortEntries(
    sorts: SortState[],
    cols: ProcessedColumn[],
    prebuiltColMap?: Map<string, ProcessedColumn>,
  ): { sortEntries: SortEntry<T>[], isServerSort: boolean, hasCustomSortMethod: boolean } {
    const activeSorts = sorts.filter(sort => sort.prop && sort.order)
    if (!activeSorts.length) {
      return { sortEntries: [], isServerSort: false, hasCustomSortMethod: false }
    }

    const map = prebuiltColMap ?? buildColumnKeyMap(cols)

    // <zh/> 检测服务端/custom 排序委托 <en/> Detect server/custom sort delegation
    let hasCustomSortMethod = false
    for (const sort of activeSorts) {
      const col = map.get(sort.columnKey ?? sort.prop)
      const sortable = col?.sortable
      if (sortable === 'custom' || (typeof sortable === 'object' && sortable?.type === 'server')) {
        return { sortEntries: [], isServerSort: true, hasCustomSortMethod: false }
      }
      const sortableConfig = resolveSortableConfig(col)
      if (sortableConfig?.sortMethod)
        hasCustomSortMethod = true
    }

    // <zh/> 预构建列索引 Map，避免在编译条目循环中每次执行 O(n) 的 cols.indexOf(col) | <en/> Pre-build column index map to avoid O(n) cols.indexOf(col) inside the sort entry compile loop
    const indexMap = new Map<ProcessedColumn, number>()
    for (let i = 0; i < cols.length; i++)
      indexMap.set(cols[i], i)

    // <zh/> 编译排序条目——accessor 使用 WeakMap 缓存，避免每次 buildSortEntries 调用时重新编译 <en/> Compile sort entries — accessor cached via WeakMap to avoid recompilation on every buildSortEntries call
    const sortEntries: SortEntry<T>[] = activeSorts.map((sort) => {
      const col = map.get(sort.columnKey ?? sort.prop)
      if (!col || !col.sortable)
        return null
      const sortableConfig = resolveSortableConfig(col)
      const sortByConfig = sortableConfig?.sortBy ?? col.sortBy
      const sortByFormat = sortableConfig?.sortByFormat ?? false
      const sortMethod = sortableConfig?.sortMethod
      const colIndex = indexMap.get(col) ?? -1
      const fallbackProp = col.prop ?? sort.prop
      const accessor = getCachedSortAccessor(col, sortByConfig, fallbackProp, sortByFormat, cols, colIndex)
      const workerProp = typeof sortByConfig === 'string'
        ? (sortByConfig.includes('.') ? undefined : sortByConfig)
        : sortByConfig == null && !(sortByFormat && col.format) && !col.valueGetter
          ? fallbackProp
          : undefined
      const multiplier = sort.order === ASC ? 1 : -1
      return { accessor, multiplier, sortMethod, workerProp: sortMethod ? undefined : workerProp }
    }).filter((e): e is NonNullable<typeof e> => e !== null)

    return { sortEntries, isServerSort: false, hasCustomSortMethod }
  }

  function computeSortedData(): { data: T[], isSorted: boolean } {
    const rows = toValue(data)
    const sorts = sortState.value

    if (!sorts.length) {
      return { data: rows, isSorted: false }
    }

    const { sortEntries, isServerSort } = buildSortEntries(sorts, toValue(columns))

    if (isServerSort) {
      return { data: rows, isSorted: true }
    }

    if (!sortEntries.length) {
      return { data: rows, isSorted: false }
    }

    const len = rows.length
    const indices = Array.from({ length: len }, (_, i) => i)

    const entryCount = sortEntries.length
    // <zh/> 单列同样预取值：每行 accessor 只调用一次（n 次），比较器复用缓存值；
    // <zh/> 否则 format/valueGetter 列退化为每次比较取值（约 n·log n 次，10 万行 ≈ 170 万次调用）。
    // <en/> Single-column also pre-resolves keys: one accessor call per row (n total), comparator reuses cached values;
    // <en/> otherwise format/valueGetter columns degrade to per-comparison access (~n·log n calls, ~1.7M for 100k rows).
    if (entryCount === 1) {
      const entry = sortEntries[0]!
      if (entry.sortMethod) {
        indices.sort((indexA, indexB) => entry.sortMethod!(rows[indexA], rows[indexB]) * entry.multiplier)
      }
      else {
        const keys: unknown[] = Array.from({ length: len })
        for (let i = 0; i < len; i++)
          keys[i] = entry.accessor(rows[i], i)
        indices.sort((indexA, indexB) => {
          return compareSortValues(keys[indexA], keys[indexB], entry.multiplier)
        })
      }
    }
    else {
      // <zh/> 多列按需缓存：仅对参与比较的行分配 keys，降低峰值内存（原 flatKeys 预分配 len*entryCount）
      // <en/> Multi-column on-demand cache: allocate keys only for rows involved in comparisons, reducing peak memory (vs flatKeys len*entryCount pre-allocation)
      const keyCache = new Map<number, unknown[]>()
      const getKeys = (idx: number): unknown[] => {
        let keys = keyCache.get(idx)
        if (!keys) {
          keys = Array.from({ length: entryCount })
          for (let j = 0; j < entryCount; j++) {
            const entry = sortEntries[j]!
            keys[j] = entry.sortMethod ? undefined : entry.accessor(rows[idx]!, idx)
          }
          keyCache.set(idx, keys)
        }
        return keys
      }
      indices.sort((indexA, indexB) => {
        const keysA = getKeys(indexA)
        const keysB = getKeys(indexB)
        for (let i = 0; i < entryCount; i++) {
          const entry = sortEntries[i]!
          if (entry.sortMethod) {
            const result = entry.sortMethod(rows[indexA]!, rows[indexB]!) * entry.multiplier
            if (result !== 0)
              return result
          }
          else {
            const result = compareSortValues(keysA[i], keysB[i], entry.multiplier)
            if (result !== 0)
              return result
          }
        }
        return 0
      })
    }

    return { data: indices.map(i => rows[i]), isSorted: true }
  }

  function buildColumnsSortKey(cols: ProcessedColumn[]): unknown[] {
    return cols.flatMap((c) => {
      const config = resolveSortableConfig(c)
      const sortBy = config?.sortBy ?? c.sortBy
      return [
        getColumnKey(c),
        c.prop,
        typeof c.sortable,
        config?.type ?? c.sortable,
        Array.isArray(sortBy),
        Array.isArray(sortBy) ? JSON.stringify(sortBy) : sortBy,
        config?.sortMethod,
        config?.sortByFormat,
        c.format,
        c.valueGetter,
        // <zh/> format 排序依赖全量列序（resolveCellDisplayValue 需 allCols+colIndex）：仅用列数+本列键作稳定代理，
        // <zh/> 禁止直接塞入 cols 数组引用（新引用必不等，保稳自我击败）
        // <en/> Format-sort depends on column order — use a stable proxy (length), never the cols array ref
        config?.sortByFormat && c.format ? cols.length : undefined,
      ]
    })
  }

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
    dataVersion++
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
    dataVersion++
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
    dataVersion++
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
      next = computeSortedData()
    }

    // <zh/> 记录成功排序快照，供下一次 Worker 在飞窗口维持视图 | <en/> capture snapshot for the next in-flight window
    if (next.isSorted)
      lastGoodSort = { sourceRows: rows, payload: next }

    if (prev && prev.isSorted === next.isSorted && prev.data === next.data)
      return prev
    return next
  })

  return {
    sortState,
    toggleSort,
    setSort,
    setSorts,
    clearSort,
    getSortOrder,
    getSortIndex,
    sortedData,
    dispose: cleanupSortResources,
  }
}

// <zh/> 排序取值函数编译转出自 ./sort-accessor，供调用方单点导入
// <en/> Sort accessor compilation lives in ./sort-accessor (pure code motion); re-exported here for single-point imports
export { compileSortAccessor, getCachedSortAccessor } from './sort-accessor'
