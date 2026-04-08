import type { Ref, ShallowRef } from 'vue'
import type { TableError } from '../../types/error'
import type { TableRequestPayload, TableRequestReason } from '../../types/request'
import type { SortOrder } from '../../types/sort'
import type { UseRequestReturn } from '../data/use-request'
import { devWarn } from '../../utils/dev-warn'

/**
 * <zh/> 请求引擎所需的最小分页形态（结构性依赖） | <en/> Minimal pagination shape for the request engine (structural dep)
 */
export interface RequestEnginePagination {
  currentPage: Ref<number>
  pageSize: Ref<number>
  /** <zh/> 纯状态置页（无副作用扇出） | <en/> pure-state page set (no effect fan-out) */
  setCurrentPage: (page: number) => unknown
}

/**
 * <zh/> 请求引擎依赖——manual 竞态守卫、参数装配、取数/刷新与数据回写路由 | <en/> Request-engine deps — manual race guard, param assembly, fetch/refresh and write-back routing
 */
export interface UseRequestEngineDeps<T> {
  isManual: Ref<boolean>
  /** <zh/> 卸载标志（宿主编排器持有并复位的 shallowRef） | <en/> unmount flag (a shallowRef owned and reset by the host orchestrator) */
  isUnmounted: ShallowRef<boolean>
  searchParams: () => Record<string, any>
  autoParamsConfig?: () => boolean | { sortKey?: string, filterKey?: string } | undefined
  autoSortState?: () => Array<{ prop: string, columnKey?: string, order: SortOrder }>
  autoFilterState?: () => Record<string, any>
  emits: {
    request: (payload: TableRequestPayload) => Promise<T[]>
    refresh: () => void
    onError: (error: TableError) => void
  }
  request: UseRequestReturn<T>['request']
  refreshRequest: UseRequestReturn<T>['refresh']
  setLoading: UseRequestReturn<T>['setLoading']
  pagination: RequestEnginePagination
}

/**
 * <zh/> 请求引擎——useTableRequest 的取数子域：manual AbortController/序号守卫、buildRequestParams、
 * <zh/> fetchData/refresh、守卫式回写、拖拽重排提交与数据源切换响应。
 *
 * <zh/> 自 use-table-request.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C 域内子模块化）；
 * <zh/> 除 `isUnmounted` 由布尔改为 shallowRef（跨模块共享可变标志）外，函数体逐字未改。
 * <en/> Request engine — the fetching sub-domain of useTableRequest: manual AbortController/sequence
 * <en/> guard, buildRequestParams, fetchData/refresh, guarded write-back, drag-reorder commit and
 * <en/> data-source-switch reaction.
 *
 * <en/> Migrated verbatim from use-table-request.ts (COMPLEXITY-PLAN battle line 3, knife C:
 * <en/> in-domain sub-modules); apart from `isUnmounted` changing from a boolean to a shallowRef
 * <en/> (a mutable flag shared across modules), function bodies are unchanged.
 */
export function useRequestEngine<T>(deps: UseRequestEngineDeps<T>) {
  const {
    isManual,
    isUnmounted,
    searchParams,
    autoParamsConfig,
    autoSortState,
    autoFilterState,
    emits,
    request,
    refreshRequest,
    setLoading,
    pagination,
  } = deps

  /**
   * <zh/> manual 模式的独立 AbortController + 请求序号守卫。
   * <zh/> 自动模式由 useRequest 内部维护；manual 模式组件侧自建，快速翻页/筛选时
   * <zh/> abort 上一个请求并递增序号，防止旧响应覆盖新数据。
   * <en/> Manual-mode AbortController + request-id guard.
   * <en/> Auto mode keeps its own inside useRequest; manual mode builds one here so rapid
   * <en/> page/filter changes abort the previous request and stale responses are dropped.
   */
  let manualAbortController: AbortController | null = null
  let manualLatestRequestId = 0

  /** <zh/> 使既有 manual 请求失效（abort + 序号推进）——deactivated / 数据源移除共用 | <en/> Invalidate in-flight manual requests (abort + sequence bump) — shared by deactivated / source removal */
  function invalidateManualRequests(): void {
    manualAbortController?.abort()
    manualAbortController = null
    manualLatestRequestId++
  }

  /**
   * <zh/> 合并基础查询参数与自动注入的排序/筛选状态。
   * <zh/> request.autoParams 关闭（默认）时恒返回 searchParams 原样——零行为变化；
   * <zh/> 开启后附加 sort（[{ prop, order: 'asc'|'desc' }]，空态省略键）与 filter（原样透出，空对象省略键）。
   * <en/> Merge base query params with auto-attached sort/filter state.
   * <en/> When request.autoParams is off (default) returns searchParams as-is — zero behavior change;
   * <en/> when on, attaches `sort` ([{ prop, order: 'asc'|'desc' }], key omitted when empty)
   * <en/> and `filter` (raw state, key omitted when empty).
   */
  function buildRequestParams(): Record<string, unknown> {
    const base = { ...searchParams() }
    const cfg = autoParamsConfig?.()
    if (!cfg)
      return base

    const { sortKey = 'sort', filterKey = 'filter' } = typeof cfg === 'object' ? cfg : {}
    const sorts = (autoSortState?.() ?? [])
      .filter(s => s.order != null)
      .map((s) => {
        if (s.order === 'descending')
          return { prop: s.prop, order: 'desc' as const }
        if (s.order === 'ascending')
          return { prop: s.prop, order: 'asc' as const }
        devWarn(
          `[AdvTable] unknown sort order "${String(s.order)}" for column "${s.prop}" — falling back to 'asc'. | 未知排序方向"${String(s.order)}"，已回退为升序。`,
        )
        return { prop: s.prop, order: 'asc' as const }
      })
    if (sorts.length > 0)
      base[sortKey] = sorts

    const filters = autoFilterState?.()
    if (filters && Object.keys(filters).length > 0)
      base[filterKey] = filters

    return base
  }

  /**
   * <zh/> manual 模式请求：abort 旧请求、递增序号，并返回可等待的完成信号
   * <en/> Manual-mode request: abort previous, bump sequence, return an awaitable completion signal
   */
  function manualRequest(
    opts: { append: boolean, reason: TableRequestReason },
  ): { requestId: number, promise: Promise<T[]> } {
    manualAbortController?.abort()
    manualAbortController = new AbortController()
    const requestId = ++manualLatestRequestId
    const signal = manualAbortController.signal
    // <zh/> manual 下点亮 loading：回写/清空/卸载时复位，父忽略 signal 时仍有视觉反馈
    // <en/> Light up loading in manual mode; it resets on write-back / clear / unmount, so the UI still
    // <en/> reacts even when the parent ignores the abort signal
    setLoading(true)
    const promise = Promise.resolve(emits.request({
      page: pagination.currentPage.value,
      size: pagination.pageSize.value,
      params: buildRequestParams(),
      append: opts.append,
      reason: opts.reason,
      signal,
      requestId,
    }))
    return { requestId, promise }
  }

  /** <zh/> manual 模式请求完成守卫——旧序号响应直接丢弃 | <en/> Manual-mode completion guard — drop stale responses */
  function manualRequestSettled(requestId: number): boolean {
    return !isUnmounted.value && requestId === manualLatestRequestId
  }

  function fetchData(
    opts: {
      append?: boolean
      reason?: TableRequestReason
    } = {},
  ): Promise<T[] | null> {
    const append = opts.append ?? false
    const reason = opts.reason ?? 'refresh'

    if (isManual.value) {
      const { requestId, promise } = manualRequest({ append, reason })
      return promise
        .then((data) => {
          // <zh/> 过期响应返回 null 哨兵（与 useRequest 自动模式协议一致），
          // <zh/> 供调用方区分"被更新请求淘汰"与"服务端返回空页"。
          // <en/> Stale responses resolve with the null sentinel (same protocol as useRequest's auto mode),
          // <en/> letting callers distinguish "superseded by a newer request" from "genuinely empty page".
          if (!manualRequestSettled(requestId))
            return null
          return data
        })
        // <zh/> 失败只 rethrow、不上报——所有调用方（分页/搜索/排序筛选 refetch/初始加载）
        // <zh/> 均已自带 TABLE_REQUEST_FAILED 上报，此处再发即双发（同一错误两个 error 事件）。
        // <zh/> stale（被更新请求取代/停靠后 abort）的失败与成功路径对称，静默为 null 哨兵，
        // <zh/> 避免被取代请求的失败冒给调用方误报。
        // <en/> Failures only rethrow without reporting — every caller (pagination/search/
        // <en/> sort-filter refetch/initial load) already reports TABLE_REQUEST_FAILED itself;
        // <en/> emitting here dispatched the same error twice.
        // <en/> Stale failures (superseded, or aborted on deactivate) resolve to the null
        // <en/> sentinel like the success path, so superseded failures never false-report.
        .catch((err: unknown) => {
          if (!manualRequestSettled(requestId))
            return null
          throw err
        })
    }

    return request(
      pagination.currentPage.value,
      pagination.pageSize.value,
      append,
      buildRequestParams(),
    )
  }

  async function refresh(): Promise<void> {
    emits.refresh()
    if (isManual.value) {
      const { requestId, promise } = manualRequest({ append: false, reason: 'refresh' })
      try {
        await promise
      }
      catch (err) {
        // <zh/> 真实失败：此处统一上报（api.refresh 为 fire-and-forget 契约，调用方无 catch，
        // <zh/> rethrow 会变成 unhandled rejection 且无上报路径）。
        // <en/> Real failure: report here — api.refresh is fire-and-forget (callers don't catch),
        // <en/> rethrowing would produce an unhandled rejection with no reporting path.
        if (manualRequestSettled(requestId)) {
          emits.onError({
            code: 'TABLE_REQUEST_FAILED',
            severity: 'error',
            field: 'refresh',
            cause: err,
          })
        }
        return
      }
      // <zh/> 竞态失败（已被更新请求取代）静默返回——抛 AbortError 会成为 unhandled rejection
      // <en/> Stale (superseded by a newer request) — return silently; throwing AbortError
      // <en/> produces an unhandled rejection
      if (!manualRequestSettled(requestId))
        return
      // <zh/> manual 模式只走 request 事件通知 + 手动回写，不再落到自动 refreshRequest，
      // <zh/> 否则一次 refresh 同时触发父级请求与自动 source 请求（双发）。
      // <en/> Manual mode only emits the request event and waits for write-back; falling through to
      // <en/> refreshRequest would make one refresh fire both the parent request and the source request.
      return
    }
    /**
     * <zh/> 自动模式失败必须在此上报：`api.refresh` 为 fire-and-forget（调用方不 catch），底层
     * <zh/> `request` 在非取消/非被取代分支 rethrow，而本链路未注入 `onError`——不上报即
     * <zh/> 0 个 error 事件 + unhandled rejection（手动分支已在上方对称上报）。
     * <zh/> 无需区分取消：取消与被取代路径（use-request 的 return null 分支）不抛错。
     * <en/> Auto-mode failures must be reported here: `api.refresh` is fire-and-forget (callers do not
     * <en/> catch), the underlying `request` rethrows on non-cancelled / non-superseded failures, and this
     * <en/> chain injects no `onError` — otherwise the failure yields zero events plus an unhandled
     * <en/> rejection (the manual branch above already reports symmetrically).
     * <en/> No cancellation branch is needed: cancelled and superseded paths resolve null instead of throwing.
     */
    try {
      await refreshRequest(pagination.currentPage.value, pagination.pageSize.value, buildRequestParams())
    }
    catch (err) {
      emits.onError({
        code: 'TABLE_REQUEST_FAILED',
        severity: 'error',
        field: 'refresh',
        cause: err,
      })
    }
  }

  return {
    fetchData,
    refresh,
    getManualRequestId: (): number => manualLatestRequestId,
    isManualRequestSettled: manualRequestSettled,
    invalidateManualRequests,
  }
}
