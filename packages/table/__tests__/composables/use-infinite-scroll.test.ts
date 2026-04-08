import type { Ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useInfiniteScroll } from '../../src/composables/data/use-infinite-scroll'

/**
 * <zh/> 无限滚动自动加载守卫真值表测试——endReached → loadMore 的全部前置条件组合。
 * <en/> Truth-table tests for the infinite-scroll auto-load guard — all precondition
 * <en/> combinations of endReached → loadMore.
 */
function build(over: Partial<{ enabled: boolean, isManual: boolean, hasMore: boolean, loading: boolean }> = {}) {
  const loadMore = vi.fn()
  const flags: Record<'enabled' | 'isManual' | 'hasMore' | 'loading', Ref<boolean>> = {
    enabled: ref(over.enabled ?? true),
    isManual: ref(over.isManual ?? true),
    hasMore: ref(over.hasMore ?? true),
    loading: ref(over.loading ?? false),
  }
  const { maybeLoadMore } = useInfiniteScroll({ ...flags, loadMore })
  return { loadMore, flags, maybeLoadMore }
}

describe('useInfiniteScroll', () => {
  it('fires loadMore when every precondition holds', () => {
    const s = build()
    s.maybeLoadMore(120)
    expect(s.loadMore).toHaveBeenCalledTimes(1)
  })

  it('does not fire when any single precondition fails', () => {
    for (const key of ['enabled', 'isManual', 'hasMore'] as const) {
      const s = build({ [key]: false })
      s.maybeLoadMore(0)
      expect(s.loadMore, `fails when ${key}=false`).not.toHaveBeenCalled()
    }
    const loading = build({ loading: true })
    loading.maybeLoadMore(0)
    expect(loading.loadMore).not.toHaveBeenCalled()
  })

  it('re-evaluates reactive flags on each call (re-entry guard releases after loading settles)', () => {
    const s = build({ loading: true })
    s.maybeLoadMore(10)
    expect(s.loadMore).not.toHaveBeenCalled()

    s.flags.loading.value = false
    s.maybeLoadMore(10)
    expect(s.loadMore).toHaveBeenCalledTimes(1)

    // <zh/> 数据耗尽后即使再次触底也不再请求 | <en/> no further requests once data is exhausted
    s.flags.hasMore.value = false
    s.maybeLoadMore(0)
    expect(s.loadMore).toHaveBeenCalledTimes(1)
  })

  it('accepts getter-style options like production wiring', () => {
    const enabled = ref(false)
    const loadMore = vi.fn()
    const { maybeLoadMore } = useInfiniteScroll({
      enabled: () => enabled.value,
      isManual: () => true,
      hasMore: () => true,
      loading: () => false,
      loadMore,
    })
    maybeLoadMore(5)
    expect(loadMore).not.toHaveBeenCalled()
    enabled.value = true
    maybeLoadMore(5)
    expect(loadMore).toHaveBeenCalledOnce()
  })
})
