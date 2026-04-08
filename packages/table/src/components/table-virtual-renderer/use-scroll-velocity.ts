import type { MaybeRefOrGetter } from 'vue'
import { computed, onBeforeUnmount, onDeactivated, ref, toValue, watch } from 'vue'

/**
 * <zh/> 滞回区间（Hysteresis）控制 dynamicCache 等级切换，避免滚动速度在阈值附近震荡时频繁切换 cache 大小。
 * <zh/> 升级阈值高于降级阈值：base→medium 需 v>1.5，medium→high 需 v>3；
 * <zh/> 降级：high→medium 需 v≤2，medium→base 需 v≤0.5。
 * <zh/> 震荡场景：触控板惯性滚动结束时速度在 1.0 附近抖动，无滞回时 cache 在 base↔medium 间反复切换，
 * <zh/> 导致 ElTableV2 频繁调整虚拟滚动缓存，引发 DOM 回收/重建抖动。
 *
 * <en/> Hysteresis control for dynamicCache tier switching, preventing frequent cache size changes
 * <en/> when scroll velocity oscillates near thresholds.
 * <en/> Upgrade thresholds are higher than downgrade: base→medium needs v>1.5, medium→high needs v>3;
 * <en/> Downgrade: high→medium needs v≤2, medium→base needs v≤0.5.
 * <en/> Oscillation scenario: trackpad inertial scroll end has velocity jittering around 1.0,
 * <en/> without hysteresis cache flips between base↔medium repeatedly,
 * <en/> causing ElTableV2 to frequently adjust virtual scroll cache, triggering DOM recycle/rebuild jitter.
 */
type VelocityTier = 'base' | 'medium' | 'high'

/**
 * <zh/> 滚动速度追踪 composable — 根据滚动速度动态调整 ElTableV2 的 cache 大小
 *
 * <zh/> 从 table-virtual-renderer.vue 提取，降低组件复杂度。
 * <zh/> 该 composable 自管理计时器与状态清理，组件只需调用 trackScrollVelocity 和读取 dynamicCache。
 *
 * <en/> Scroll velocity tracking composable — dynamically adjusts ElTableV2 cache size based on scroll speed
 *
 * <en/> Extracted from table-virtual-renderer.vue to reduce component complexity.
 * <en/> This composable self-manages timer and state cleanup; the component only needs to call
 * <en/> trackScrollVelocity and read dynamicCache.
 *
 * @param baseCache - <zh/> 基础 cache 大小（通常为 props.cache） | <en/> Base cache size (typically props.cache)
 * @returns <zh/> trackScrollVelocity 函数、dynamicCache 计算属性、resetVelocity 重置函数 | <en/> trackScrollVelocity fn, dynamicCache computed, resetVelocity fn
 */
export function useScrollVelocity(baseCache: MaybeRefOrGetter<number>, enabled: MaybeRefOrGetter<boolean> = () => true) {
  const scrollVelocity = ref(0)
  const velocityTier = ref<VelocityTier>('base')

  let lastScrollTop = 0
  let lastScrollTime = 0
  let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null

  const dynamicCache = computed(() => {
    const base = toValue(baseCache)
    switch (velocityTier.value) {
      // <zh/> 高速滚动时增大 cache 上限以减少 DOM 回收/重建
      // <en/> Increase cache upper bound during fast scroll to reduce DOM recycle/rebuild
      case 'high': return Math.max(16, base + 10)
      case 'medium': return Math.max(10, base + 5)
      default: return base
    }
  })

  watch(scrollVelocity, (velocity) => {
    const current = velocityTier.value
    if (current === 'base') {
      if (velocity > 3)
        velocityTier.value = 'high'
      else if (velocity > 1.5)
        velocityTier.value = 'medium'
    }
    else if (current === 'medium') {
      if (velocity > 3)
        velocityTier.value = 'high'
      else if (velocity <= 0.5)
        velocityTier.value = 'base'
    }
    else { // high
      if (velocity <= 2)
        velocityTier.value = 'medium'
    }
  })

  function trackScrollVelocity(scrollTop: number) {
    if (!toValue(enabled))
      return
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const dt = now - lastScrollTime
    if (dt > 0) {
      const speed = Math.abs(scrollTop - lastScrollTop) / dt
      scrollVelocity.value = Math.max(speed, scrollVelocity.value * 0.6)
    }
    lastScrollTop = scrollTop
    lastScrollTime = now

    if (scrollIdleTimer)
      clearTimeout(scrollIdleTimer)
    scrollIdleTimer = setTimeout(() => {
      scrollVelocity.value = 0
    }, 120)
  }

  function resetVelocity() {
    scrollVelocity.value = 0
    velocityTier.value = 'base'
    lastScrollTop = 0
    lastScrollTime = 0
    if (scrollIdleTimer) {
      clearTimeout(scrollIdleTimer)
      scrollIdleTimer = null
    }
  }

  onBeforeUnmount(() => {
    if (scrollIdleTimer) {
      clearTimeout(scrollIdleTimer)
      scrollIdleTimer = null
    }
  })

  onDeactivated(() => {
    resetVelocity()
  })

  return { trackScrollVelocity, dynamicCache, resetVelocity }
}
