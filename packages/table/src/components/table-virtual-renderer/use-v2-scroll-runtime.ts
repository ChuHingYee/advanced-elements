/**
 * <zh/> virtual 渲染器的滚动运行时
 * <en/> Virtual-renderer scroll runtime
 *
 * @remarks
 * <zh/> 职责单一：一次 ElTableV2 `@scroll` 派发后必须按**固定次序**完成的四件事——
 * <zh/> ① 更新当前滚动位置（条带同步/悬停层/重挂载恢复都读它）→ ② 速度采样（调 cache）
 * <zh/> → ③ 通知悬停层（滚动期抑制并重定位）→ ④ 对外 emit + 表尾/顶部条带横向同步。
 * <zh/> 次序即契约：位置先落盘，后续消费者才读得到一致值；汇总条带不随主网格滚动，
 * <zh/> 必须显式同步其 scrollLeft，否则聚合单元格与表体列错位。
 * <en/> Single responsibility: the four things that must happen in a **fixed order** after each
 * <en/> ElTableV2 `@scroll` dispatch — ① update the current scroll position (read by strip sync /
 * <en/> hover layer / remount restore) → ② sample velocity (cache tuning) → ③ notify the hover layer
 * <en/> (suppress during scroll and reposition) → ④ emit outward + sync the footer/top strip horizontally.
 * <en/> The order IS the contract: the position lands first so later consumers read a consistent value;
 * <en/> summary strips do not scroll with the main grid, so their scrollLeft must be synced explicitly
 * <en/> or the aggregate cells drift out of alignment with the body columns.
 */
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { VirtualSummaryFooterExpose } from './virtual-summary-footer.vue'
import { useScrollVelocity } from './use-scroll-velocity'
import { useVirtualSummarySync } from './use-virtual-summary-sync'

/** <zh/> 滚动运行时依赖 | <en/> Scroll-runtime deps */
export interface UseV2ScrollRuntimeDeps {
  /** <zh/> 基础 cache 大小（低性能档不做动态放大） | <en/> base cache size (no dynamic growth on the low-performance tier) */
  cache: () => number
  /** <zh/> 是否处于低性能档 | <en/> whether the low-performance tier is active */
  lowPerformance: ComputedRef<boolean>
  /** <zh/> 当前纵向滚动位置 | <en/> current vertical scroll position */
  currentScrollTop: Ref<number>
  /** <zh/> 当前横向滚动位置 | <en/> current horizontal scroll position */
  currentScrollLeft: Ref<number>
  /** <zh/> 悬停层包装后的滚动处理 | <en/> wrapped scroll handler from the hover layer */
  wrappedHandleScroll: (params: { scrollLeft: number, scrollTop?: number }) => void
  /** <zh/> 对外 emit('scroll') | <en/> outward emit('scroll') */
  emitScroll: (params: { scrollLeft: number, scrollTop: number }) => void
  /** <zh/> 表尾汇总引用 | <en/> footer summary ref */
  summaryFooterRef: ShallowRef<VirtualSummaryFooterExpose | null>
  /** <zh/> 顶部 Grand 条带引用 | <en/> grand top strip ref */
  topStripRef: ShallowRef<VirtualSummaryFooterExpose | null>
  /** <zh/> ElTableV2 实例 | <en/> ElTableV2 instance */
  tableV2Ref: ShallowRef<any>
  /**
   * <zh/> 清除列宽拖拽的表头 rect 缓存——表头随横向滚动移动，缓存的 DOMRect
   * <zh/> 随之失效；不清理会让 resize cursor/命中区复用另一位置的旧几何。
   * <en/> Clear the column-resize header rect cache — headers move with horizontal
   * <en/> scrolling, so a cached DOMRect goes stale and corrupts the resize cursor/hit zone.
   */
  clearCachedRect?: () => void
}

/**
 * <zh/> 创建滚动运行时
 * <en/> Create the scroll runtime
 */
export function useV2ScrollRuntime(deps: UseV2ScrollRuntimeDeps) {
  const {
    cache,
    lowPerformance,
    currentScrollTop,
    currentScrollLeft,
    wrappedHandleScroll,
    emitScroll,
    summaryFooterRef,
    topStripRef,
    tableV2Ref,
    clearCachedRect,
  } = deps

  /** <zh/> 滚动速度追踪——动态调整 ElTableV2 cache 大小 | <en/> Scroll velocity tracking — dynamically adjusts ElTableV2 cache size */
  const { trackScrollVelocity, dynamicCache } = useScrollVelocity(cache, () => !lowPerformance.value)

  /**
   * <zh/> 汇总表尾滚动同步管理器 — 从 table-virtual-renderer.vue 提取
   * <en/> Summary footer scroll sync manager
   */
  const {
    isUnmounted: summaryIsUnmounted,
    scheduleSummarySync,
    onSummaryScroll,
  } = useVirtualSummarySync({
    summaryFooterRef,
    topStripRef,
    tableV2Ref,
    getCurrentScrollTop: () => currentScrollTop.value,
  })

  /** <zh/> ElTableV2 `@scroll` 派发入口 | <en/> ElTableV2 `@scroll` dispatch entry */
  function onTableScroll(params: { scrollLeft: number, scrollTop: number }): void {
    // 滚动即几何失效——表头 rect 缓存必须先清，再更新位置/派发
    clearCachedRect?.()
    if (summaryIsUnmounted.value)
      return
    currentScrollLeft.value = params.scrollLeft
    currentScrollTop.value = params.scrollTop
    trackScrollVelocity(params.scrollTop)
    wrappedHandleScroll(params)
    emitScroll(params)
    scheduleSummarySync(params.scrollLeft)
  }

  return { dynamicCache, onSummaryScroll, onTableScroll }
}
