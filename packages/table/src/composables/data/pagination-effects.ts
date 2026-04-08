import type { Ref } from 'vue'
import type { TableRequestReason } from '../../types/request'
import type { PaginationChangeResult, useTablePagination, UseTablePaginationOptions } from './use-table-pagination'
import type { UseTableRequestOptions } from './use-table-request'
import { toValue, watch } from 'vue'

type PaginationApi = ReturnType<typeof useTablePagination>

/**
 * Pagination effects
 * 分页副作用,纯搬移自 use-table-request.ts,零行为变更.
 *
 * Owns the pagination change fan-out (URL log, pageChange emit, server refetch), the
 * total-to-options sync watch, and the server empty-page correction watch. Created once in
 * setup, so the watches keep their original lifecycle.
 * 归集分页变更扇出(URL 记录/pageChange 派发/服务端重取)、total 同步 watch 与服务端空页校正 watch.
 */
export interface PaginationEffectsDeps<T> {
  pagination: PaginationApi
  responseData: Ref<T[]>
  total: Ref<number>
  hasSource: Ref<boolean>
  isManual: Ref<boolean>
  paginationOptions: UseTablePaginationOptions
  setPageLog: (page: number, size: number) => void
  /** Emit 通道整体传入，调用时实时读取，与原闭包语义一致. Whole emits object, read at call time like the original closure. */
  emits: Pick<UseTableRequestOptions<T>['emits'], 'pageChange' | 'onError'>
  stopPolling: () => void
  clearResponseData: () => void
  fetchData: (options?: { append?: boolean, reason?: TableRequestReason }) => Promise<T[] | null>
  /** Corrected-page writer, routes through applyPaginationEffects for a server refetch. 校正页写入,经扇出触发服务端重取. */
  correctPage: (page: number) => void
}

export interface PaginationEffectsReturn {
  applyPaginationEffects: (result: PaginationChangeResult) => void
  handleCurrentPageChange: (val: number) => void
  handlePageSizeChange: (val: number) => void
  handleLoadMore: () => void
  /**
   * <zh/> 释放内部 watch（与 sort/filter/quickFilter 的显式 `dispose` 口径对齐）。
   * <zh/> 当前装配点为 setup 一次性创建（随 scope 自动释放），调用方可忽略本字段；
   * <zh/> 裸调用/单测直调无 scope 时由调用方负责调用。
   * <en/> Release internal watches (aligned with the explicit `dispose` caliber of sort/filter/quickFilter).
   * <en/> The current assembly creates once in setup (auto-released with the scope); callers may ignore
   * <en/> this field; bare/single-test calls without a scope own disposal.
   */
  dispose: () => void
}

/**
 * <zh/> 分页副作用工厂——归集分页变更扇出（URL 记录、pageChange 派发、服务端重取）与关联 watch，仅在 setup 中调用一次。
 * <en/> Pagination effects factory — owns the pagination change fan-out (URL log, pageChange emit, server refetch) and the related watches; created once in setup.
 *
 * @param deps - <zh/> 分页 API、请求链路与 emit 通道依赖 | <en/> Deps on the pagination API, request chain and emit channel
 * @returns <zh/> 分页变更处理与加载更多方法集合 | <en/> Pagination change handlers and the load-more method
 */
export function createPaginationEffects<T>(deps: PaginationEffectsDeps<T>): PaginationEffectsReturn {
  const { pagination } = deps

  // <zh/> 服务端 total 同步：仅非 client 模式（client 口径改读 clientTotal，此处同步会覆盖分页自有长度故跳过）
  // <en/> Server-total sync only: skip client mode (client reads clientTotal instead)
  const stopTotalSync = watch(deps.total, (val) => {
    if (deps.pagination.isClient.value)
      return
    // <zh/> manual 下 response total 恒 0（父驱动），同步会闪断 options.total 为 0，跳过
    // <en/> Skip manual mode — its response total stays 0 (parent-driven), syncing would flash options.total to 0
    if (deps.isManual.value)
      return
    deps.paginationOptions.total.value = val
  })

  function applyPaginationEffects(result: PaginationChangeResult) {
    deps.setPageLog(result.page, result.size)
    deps.emits.pageChange(result.page, result.size)

    if (result.isClient)
      return

    deps.stopPolling()
    if (result.needsReset) {
      deps.clearResponseData()
    }
    deps.fetchData({ append: result.reason === 'loadMore', reason: result.reason })
      .catch((err: unknown) => {
        deps.emits.onError({
          code: 'TABLE_REQUEST_FAILED',
          severity: 'error',
          field: 'pagination',
          cause: err,
        })
      })
  }

  // ── Server 分页空页校正 | Server pagination empty-page correction ──
  /**
   * server/manual 分页模式下服务端数据收缩（total 变小）后，当前页可能已超出 maxPage——
   * 约束：按 total 推导 maxPage 并校正一次，空页不允许停留等待手动翻页
   * （setCurrentPage 走 applyPaginationEffects 触发服务端重取/manual 通知父重取）。
   * 无循环风险：校正后 currentPage <= maxPage，条件不再成立；即使服务端
   * 校正页仍返回空数据，条件同样不成立。
   * 适用范围：服务端分页（hasSource + page 模式）与 manual（total 已知时同口径校正，
   * 经扇出通知父取数）。client（本地切片，use-adv-table 已有 maxPage 校正）不适用。
   *
   * In server/manual pagination mode a server-side data shrink (smaller total) can leave the
   * current page beyond maxPage — invariant: derive maxPage from total and correct once,
   * never leaving an empty page for manual navigation. No loop risk: after the correction
   * currentPage <= maxPage. Applies to server pagination (hasSource + page mode) and manual
   * (same correction when total is known, fanning out to the parent); client (local slicing,
   * already corrected in use-adv-table) is excluded.
   */
  // 空页校正去重守卫——total 与 pageSize 同步变更时 watch 触发 2 次，守卫确保单次校正.
  // Empty-page correction dedup guard — total & pageSize change together triggers watch twice; guard ensures single correction.
  let isCorrectingPage = false
  const stopEmptyPageCorrection = watch(
    [deps.responseData, () => pagination.currentPage.value, () => pagination.pageSize.value, deps.total],
    ([rows]) => {
      if (isCorrectingPage)
        return
      if (!deps.hasSource.value || pagination.isClient.value)
        return
      /**
       * <zh/> total 口径：manual 模式下 `deps.total` 恒为 0（manual 从不调用 useRequest 的 request()，
       * <zh/> 数据回写也不更新 total），必须取父组件声明的 `propsTotal`；
       * <zh/> 其余模式沿用响应侧 total（由服务端响应写入）。
       * <en/> Total caliber: `deps.total` stays 0 in manual mode (manual never calls useRequest.request()
       * <en/> and write-backs do not update total), so the parent-declared `propsTotal` is used instead;
       * <en/> other modes keep the response-side total.
       */
      const propsTotal = deps.paginationOptions.propsTotal != null
        ? toValue(deps.paginationOptions.propsTotal)
        : undefined
      const totalVal = deps.isManual.value && propsTotal !== undefined ? propsTotal : deps.total.value
      if (rows.length > 0 || totalVal <= 0)
        return
      const page = pagination.currentPage.value
      if (page <= 1)
        return
      const maxPage = Math.max(1, Math.ceil(totalVal / pagination.pageSize.value))
      if (page > maxPage) {
        isCorrectingPage = true
        deps.correctPage(maxPage)
        // 下一 tick 重置守卫，允许后续真实空页再次校正.
        // Reset guard next tick to allow future genuine empty-page corrections.
        Promise.resolve().then(() => {
          isCorrectingPage = false
        })
      }
    },
  )

  function handleCurrentPageChange(val: number) {
    const result = pagination.setCurrentPage(val)
    applyPaginationEffects(result)
  }

  function handlePageSizeChange(val: number) {
    const result = pagination.setPageSize(val)
    applyPaginationEffects(result)
  }

  function handleLoadMore() {
    const result = pagination.loadMore()
    if (result) {
      applyPaginationEffects(result)
    }
  }

  return {
    applyPaginationEffects,
    handleCurrentPageChange,
    handlePageSizeChange,
    handleLoadMore,
    dispose: () => {
      stopTotalSync()
      stopEmptyPageCorrection()
    },
  }
}
