import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'

/**
 * <zh/> 无限滚动自动加载守卫（缺陷面收敛点）。
 *
 * <zh/> 将 endReached → loadMore 的自动接线决策集中为纯谓词逻辑：
 * <zh/> 仅在「功能开启 + manual 模式 + 仍有更多数据 + 不在加载中」四个条件同时满足时触发，
 * <zh/> 防止重复入队请求。virtual 渲染器的 endReached 是唯一触发源。
 *
 * <en/> Infinite-scroll auto-load guard (single convergence point for the decision).
 *
 * <en/> Centralizes the endReached → loadMore auto-wiring decision as a pure predicate:
 * <en/> fires only when all four conditions hold — feature enabled, manual mode, more data
 * <en/> available, not already loading — preventing duplicate in-flight requests. The virtual
 * <en/> renderer's endReached is the sole trigger source.
 */
export interface UseInfiniteScrollOptions {
  /** <zh/> 功能开关（pagination.infiniteScroll） | <en/> feature switch (pagination.infiniteScroll) */
  enabled: MaybeRefOrGetter<boolean>
  /** <zh/> 是否 manual 分页模式——page/client 模式有完整分页 UI，不适用 | <en/> whether pagination is in manual mode — page/client modes have full pager UI */
  isManual: MaybeRefOrGetter<boolean>
  /** <zh/> 服务端是否还有更多数据 | <en/> whether the server has more data */
  hasMore: MaybeRefOrGetter<boolean>
  /** <zh/> 请求进行中标志——防重入 | <en/> in-flight request flag — re-entry guard */
  loading: MaybeRefOrGetter<boolean>
  /** <zh/> 触发加载下一页的回调（data.handleLoadMore） | <en/> callback loading the next page (data.handleLoadMore) */
  loadMore: () => void
}

export interface UseInfiniteScrollReturn {
  /**
   * <zh/> endReached(distance) 的内部消费入口——满足全部前置条件时调用一次 loadMore
   * <en/> internal consumer entry for endReached(distance) — calls loadMore once when all preconditions hold
   */
  maybeLoadMore: (_remainDistance: number) => void
}

export function useInfiniteScroll(options: UseInfiniteScrollOptions): UseInfiniteScrollReturn {
  const { loadMore } = options

  function maybeLoadMore(_remainDistance: number): void {
    if (!toValue(options.enabled))
      return
    if (!toValue(options.isManual))
      return
    if (!toValue(options.hasMore))
      return
    if (toValue(options.loading))
      return
    loadMore()
  }

  return { maybeLoadMore }
}
