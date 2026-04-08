/**
 * <zh/> 远程筛选/排序自动 refetch——防抖调度器与状态监听
 * <en/> Remote filter/sort auto-refetch — debounce scheduler and state watchers
 *
 * @remarks
 * <zh/> 约束：禁止跨域读写 dataColumns（状态）与请求域（fetchData）；
 * <zh/> 所有权归属数据域，顶层仅按显式依赖接线。
 * <en/> Invariant: no cross-domain reads/writes of dataColumns (state) and the request
 * <en/> domain (fetchData); ownership stays in the data domain,
 * <en/> with the top level only wiring explicit deps.
 */
import type { Ref } from 'vue'
import type { AdvTableEmitFn, ProcessedColumn } from '../../types'
import type { TableRequestReason } from '../../types/request'
import type { SortState } from '../../types/sort'
import type { TableErrorHandler } from '../../utils/error-handler'
import { onScopeDispose, watch } from 'vue'
import { createTrailingDebounce } from '../../utils/debounce'
import { shallowEqualByValue } from '../../utils/equality'

/**
 * <zh/> 远程筛选/排序自动 refetch 的防抖延迟（毫秒）——合并同一批次的连续变更
 * <en/> Debounce delay (ms) for remote filter/sort auto-refetch — coalesces consecutive changes of the same batch
 */
export const REMOTE_REFETCH_DEBOUNCE_MS = 300

/**
 * <zh/> 远程 refetch 触发器的上下文 | <en/> Context for the remote refetch trigger
 */
export interface RemoteRefetchContext {
  /** <zh/> 是否有远程数据源 | <en/> Whether a remote data source is available */
  hasSource: () => boolean
  /**
   * <zh/> 触发数据获取——返回 null 表示请求被取消/被更新请求取代（fetchData 协议），触发器静默忽略
   * <en/> Trigger data fetch — resolves null when cancelled/superseded (fetchData protocol); the trigger ignores it silently
   */
  fetchData: (opts: { reason: TableRequestReason }) => Promise<unknown[] | null>
  /** <zh/> 错误处理 | <en/> Error handler */
  handleError: TableErrorHandler
}

/**
 * <zh/> 浅比较两个 SortState 数组是否等值——用于 sortChange watcher 跳过冗余触发
 * <en/> Shallow-compare two SortState arrays for equality — used by sortChange watcher to skip redundant emissions
 */
export function isSortStateEqual(a: SortState[], b: SortState[]): boolean {
  if (a === b)
    return true
  if (a.length !== b.length)
    return false
  return a.every((s, i) => s.prop === b[i].prop && s.order === b[i].order)
}

/**
 * <zh/> 远程 refetch 触发器句柄——可在排序/筛选两处 watcher 间**共享**，使同一批次的
 * <zh/> 排序 + 筛选变更合并为一次请求。
 * <en/> Remote-refetch trigger handle — can be **shared** between the sort and filter watchers so that a
 * <en/> batch containing both changes coalesces into a single request (previously each chain held its own
 * <en/> timer, producing one redundant request that was aborted immediately).
 */
export interface RemoteRefetchHandle {
  /**
   * <zh/> 触发一次防抖 refetch；`overrideReason` 覆盖创建时的默认 reason（共享句柄下由调用方给出各自语义）
   * <en/> Trigger a debounced refetch; `overrideReason` overrides the creation-time default reason
   * <en/> (a shared handle lets each caller supply its own semantics)
   */
  trigger: (overrideReason?: TableRequestReason) => void
  /** <zh/> 取消待执行的防抖请求 | <en/> Cancel the pending debounced request */
  dispose: () => void
}

/**
 * <zh/> 创建远程 refetch 防抖调度器——抽取排序/筛选两个 watcher 中的共同逻辑
 * <zh/> （防抖 + onCleanup + fetchData.catch）
 * <en/> Create a debounced remote-refetch scheduler — extracts the shared logic
 * <en/> (debounce + onCleanup + fetchData.catch) from sort/filter watchers
 *
 * @param ctx - <zh/> 触发器上下文（数据源/取数/错误处理）| <en/> trigger context (source/fetch/error handling)
 * @param reason - <zh/> 默认请求原因；调用 trigger 时可逐次覆盖 | <en/> default request reason; per-call overridable
 * @returns <zh/> 触发器句柄（trigger + dispose）| <en/> trigger handle (trigger + dispose)
 *
 * @remarks
 * <zh/> 调用 trigger 时按防抖延迟执行 fetchData，后续调用会重置定时器。
 * <zh/> 组件卸载时需调用 dispose 清理待执行的防抖请求。
 * <en/> Calling trigger schedules fetchData after the debounce delay, resetting the timer on each call.
 * <en/> dispose must be called on unmount to clear the pending debounced request.
 */
export function createRemoteRefetchTrigger(
  ctx: RemoteRefetchContext,
  reason: TableRequestReason,
): RemoteRefetchHandle {
  // <zh/> 尾随防抖经 utils/debounce 唯一出口；hasSource 前置守卫仍在触发时求值 | <en/> trailing debounce via the single utils/debounce outlet; the hasSource pre-guard still evaluates at trigger time
  let pendingReason: TableRequestReason = reason
  const debounced = createTrailingDebounce(() => {
    // <zh/> 发射时复查数据源——防抖窗口内 source 被移除时不再打出后台请求
    // <en/> Re-check the source at fire time — skip the background fetch if the source was removed during the debounce window
    if (!ctx.hasSource())
      return
    ctx.fetchData({ reason: pendingReason })
      .catch((err: unknown) => {
        ctx.handleError('TABLE_REQUEST_FAILED', { cause: err })
      })
  }, REMOTE_REFETCH_DEBOUNCE_MS)
  return {
    trigger: (overrideReason?: TableRequestReason) => {
      if (!ctx.hasSource())
        return
      pendingReason = overrideReason ?? reason
      debounced.call()
    },
    dispose: () => {
      debounced.cancel()
    },
  }
}

/**
 * <zh/> 排序监听依赖——排序状态（管线拥有）+ 远程请求能力（请求域）+ 事件发射
 * <en/> Sort watcher deps — sort state (owned by the pipeline) + remote request ability (request domain) + event emit
 */
export interface SortChangeAndRefetchDeps {
  /** <zh/> 排序状态 | <en/> Sort state */
  sortState: Ref<SortState[]>
  /** <zh/> 列键映射（用于 sortChange 事件的 column/columns 回填） | <en/> Column key map (fills column/columns of the sortChange event) */
  columnByKeyMap: Ref<Map<string, ProcessedColumn>>
  /** <zh/> 是否有远程数据源 | <en/> Whether a remote data source is available */
  hasSource: () => boolean
  /** <zh/> 触发数据获取 | <en/> Trigger data fetch */
  fetchData: (opts: { reason: TableRequestReason }) => Promise<unknown[] | null>
  /** <zh/> 错误处理 | <en/> Error handler */
  handleError: TableErrorHandler
  /** <zh/> 事件发射 | <en/> Event emit */
  emit: AdvTableEmitFn
  /** <zh/> 表格实例标识 | <en/> Table instance identifier */
  tableId: () => string
  /**
   * <zh/> 共享的 refetch 句柄——与筛选 watcher 注入**同一个**实例即可把同批次的排序+筛选合并为一次请求。
   * <zh/> 未注入时本 watcher 自建一个（保持既有调用方行为不变）。
   * <en/> Shared refetch handle — injecting the **same** instance as the filter watcher coalesces a batch
   * <en/> containing both changes into one request. When omitted this watcher creates its own
   * <en/> (existing callers keep their behaviour).
   */
  refetch?: RemoteRefetchHandle
  /**
   * <zh/> 重置到第 1 页（远程分页时排序会改变结果集，停留在原页码可能落到空页）
   * <en/> Reset to page 1 (in remote pagination a sort changes the result set, and staying on the
   * current page may land on an empty page)
   */
  resetPage?: () => void
  /**
   * <zh/> 自动参数是否开启（对应 `request.autoParams`）——关闭时服务端收不到排序参数，
   * <zh/> 本地列排序必然只在当前页生效，此时的 refetch + 回页是纯浪费（请求被服务端忽略，
   * <zh/> 还把用户 yank 回第 1 页），故跳过。缺省（未提供）走历史行为：照常 refetch。
   * <en/> Whether auto-params is on (mirrors `request.autoParams`) — when off the server never sees
   * <en/> sort params, so local-column sorts are page-local by construction and the refetch + page
   * <en/> reset is pure waste (the request is ignored server-side and yanks the user back to page 1).
   * <en/> Absent = legacy behavior: refetch as before.
   */
  autoParamsEnabled?: () => boolean
  /**
   * <zh/> 是否手动分页模式（对应 `pagination.mode === 'manual'`）——manual 下排序走 `request`
   * <zh/> 事件交由宿主处理，跳过 refetch 会吞掉宿主的排序入口，故永不跳过。
   * <zh/> 缺省（未提供）走历史行为：照常 refetch。
   * <en/> Whether manual pagination mode (mirrors `pagination.mode === 'manual'`) — in manual mode
   * <en/> sorts go through the `request` event for the host; skipping the refetch would swallow the
   * <en/> host's sort entry, so it is never skipped. Absent = legacy behavior: refetch as before.
   */
  isManual?: () => boolean
}

/**
 * <zh/> 本地排序是否可跳过远程 refetch（保守门控）——同时满足以下全部时跳过：
 * <zh/> 存在实质本地排序（空数组=清空排序，走历史 refetch 取回基准顺序）、
 * <zh/> 每个活跃排序都命中已知本地列（未知列/不可排序列/服务端委托列一律走历史行为）、
 * <zh/> `autoParamsEnabled` 已提供且为 false（服务端收不到排序参数，请求必被忽略）、
 * <zh/> `isManual` 已提供且为 false（manual 下宿主靠 `request` 事件自行排序，不可吞）。
 * <zh/> 任一依赖缺省即走历史行为，保证直接复用本 composable 的调用方零行为变化。
 * <en/> Whether a local sort may skip the remote refetch (conservative gate) — skips only when
 * <en/> ALL hold: a substantive local sort exists (empty = cleared sort, legacy refetch restores base
 * <en/> order), every active sort hits a known local column (unknown/unsortable/server-delegated columns
 * <en/> keep legacy behavior), `autoParamsEnabled` is provided and false (the server never sees sort
 * <en/> params, so the request would be ignored), and `isManual` is provided and false (in manual mode
 * <en/> the host sorts via the `request` event — never swallow it). Any absent dep keeps legacy behavior,
 * <en/> so direct consumers of this composable see zero behavior change.
 */
export function shouldSkipLocalSortRefetch(
  sorts: SortState[],
  columnByKeyMap: Map<string, ProcessedColumn>,
  opts: { autoParamsEnabled?: () => boolean, isManual?: () => boolean } = {},
): boolean {
  const active = sorts.filter(s => s.prop && s.order)
  if (active.length === 0)
    return false
  if (!opts.autoParamsEnabled || opts.autoParamsEnabled())
    return false
  if (!opts.isManual || opts.isManual())
    return false
  return active.every((s) => {
    const key = s.columnKey ?? s.prop
    const col = key != null ? columnByKeyMap.get(key) : undefined
    if (!col || !col.sortable)
      return false
    const sortable: unknown = col.sortable
    if (sortable === 'custom')
      return false
    if (typeof sortable === 'object' && sortable != null && (sortable as { type?: unknown }).type === 'server')
      return false
    return true
  })
}

/**
 * <zh/> 排序变化时触发 sortChange 事件；远程模式下非首次实质变更自动 refetch（防抖）
 * <zh/> 浅比较前后 sortState，跳过无实质变化的冗余触发（如 setSort 传入等值数组）
 * <en/> Emit sortChange when sort state changes; auto-refetch in remote mode on non-initial substantive changes (debounced)
 * <en/> Shallow-compares prev/next sortState to skip redundant emissions (e.g., setSort with equivalent array)
 */
export function watchSortChangeAndRefetch(deps: SortChangeAndRefetchDeps): void {
  const owned = deps.refetch == null
  const refetch = deps.refetch ?? createRemoteRefetchTrigger(
    { hasSource: deps.hasSource, fetchData: deps.fetchData, handleError: deps.handleError },
    'sort',
  )
  // 共享防抖只有一个生命周期 owner：自建时随 scope 释放；共享时由创建方释放，
  // 不得在每次 watcher 运行的 cleanup 中 dispose，否则等值复写会取消另一链的待请求。
  if (owned)
    onScopeDispose(() => refetch.dispose())
  watch(() => deps.sortState.value, (sorts: SortState[], prevSorts: SortState[] | undefined) => {
    if (prevSorts && isSortStateEqual(prevSorts, sorts))
      return
    const map = deps.columnByKeyMap.value
    const sortColumns = sorts.map((s) => {
      const key = s.columnKey ?? s.prop
      return key != null ? map.get(key) : undefined
    })
    const primary = sorts[0]
    deps.emit('sortChange', {
      sortState: sorts,
      prop: primary?.prop ?? null,
      order: primary?.order ?? null,
      column: sortColumns[0],
      columns: sortColumns,
    }, deps.tableId())

    // 远程排序自动 refetch——仅在有 source 且非首次触发时执行
    // Auto-refetch on remote sort — only when a source exists and this is not the first trigger
    if (deps.hasSource() && prevSorts) {
      // <zh/> 本地列 + autoParams 关闭 + 非 manual 时跳过——服务端忽略本次排序，
      // <zh/> 本地管线已对当前页排序，refetch 只是浪费一次请求并把用户 yank 回第 1 页。
      // <zh/> sortChange 事件照常发射，本地排序不受影响。
      // <en/> skip for local columns with autoParams off outside manual mode — the server
      // <en/> ignores such sorts and the local pipeline already sorted the current page; refetching
      // <en/> only wastes a request and yanks the user back to page 1. sortChange still fires.
      if (shouldSkipLocalSortRefetch(sorts, deps.columnByKeyMap.value, deps))
        return
      // <zh/> 排序改变结果集，先回到第 1 页，避免停留在越界页码拿到空页
      // <en/> A sort changes the result set, so return to page 1 first to avoid an out-of-range empty page
      deps.resetPage?.()
      refetch.trigger('sort')
    }
  })
}

/**
 * <zh/> 筛选监听依赖——筛选状态（管线拥有）+ 远程请求能力（请求域）
 * <en/> Filter watcher deps — filter state (owned by the pipeline) + remote request ability (request domain)
 */
export interface FilterRefetchDeps {
  /** <zh/> 列筛选状态 | <en/> Column filter state */
  filterState: Ref<Record<string, any>>
  /** <zh/> 是否有远程数据源 | <en/> Whether a remote data source is available */
  hasSource: () => boolean
  /** <zh/> 触发数据获取 | <en/> Trigger data fetch */
  fetchData: (opts: { reason: TableRequestReason }) => Promise<unknown[] | null>
  /** <zh/> 错误处理 | <en/> Error handler */
  handleError: TableErrorHandler
  /**
   * <zh/> 共享的 refetch 句柄——与排序 watcher 注入同一个实例以合并同批次请求（见 RemoteRefetchHandle）
   * <en/> Shared refetch handle — inject the same instance as the sort watcher to coalesce a batch
   * <en/> (see RemoteRefetchHandle)
   */
  refetch?: RemoteRefetchHandle
  /**
   * <zh/> 重置到第 1 页（远程分页时筛选会改变结果集）
   * <en/> Reset to page 1 (in remote pagination a filter changes the result set)
   */
  resetPage?: () => void
}

/**
 * <zh/> 远程筛选自动 refetch——远程模式下筛选状态变化时自动触发 fetchData。
 * <zh/> 跳过首次触发（prev 为 undefined 时），避免初始化竞态。
 * <zh/> 内容等值时跳过：noop→真实 composable 升级会更换 filterState 引用（{}→{}），
 * <zh/> setFilter 重复写入等值筛选值也会产生新对象——两者均不应触发远程 refetch。
 * <zh/> 连续调整多个筛选条件时合并为一次请求（防抖），避免远程模式下请求风暴
 * <en/> Auto-refetch on remote filter — automatically triggers fetchData when filter state changes in remote mode.
 * <en/> Skips the first trigger (when prev is undefined) to avoid initialization races.
 * <en/> Skips content-equal states: the noop→real composable upgrade swaps the filterState reference ({}→{}),
 * <en/> and re-applying an identical filter value via setFilter creates a new object — neither should trigger a remote refetch.
 * <en/> Debounces consecutive filter changes into a single request to avoid request storms in remote mode
 */
export function watchFilterRefetch(deps: FilterRefetchDeps): void {
  const owned = deps.refetch == null
  const refetch = deps.refetch ?? createRemoteRefetchTrigger(
    { hasSource: deps.hasSource, fetchData: deps.fetchData, handleError: deps.handleError },
    'filter',
  )
  if (owned)
    onScopeDispose(() => refetch.dispose())
  watch(() => deps.filterState.value, (next, prev) => {
    if (prev === undefined)
      return
    if (shallowEqualByValue(prev, next))
      return
    if (!deps.hasSource())
      return
    // <zh/> 筛选改变结果集，先回到第 1 页，避免停留在越界页码拿到空页
    // <en/> A filter changes the result set, so return to page 1 first to avoid an out-of-range empty page
    deps.resetPage?.()
    // 远程筛选自动 refetch——防抖合并连续筛选条件变更
    // Auto-refetch on remote filter — debounce coalesces consecutive filter changes
    refetch.trigger('filter')
  })
}
