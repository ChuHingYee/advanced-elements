/**
 * <zh/> virtual 渲染器的行固定 + 滚动协调域
 * <en/> Virtual-renderer row-pinning & scroll-reconcile domain
 *
 * @remarks
 * <zh/> 职责单一：把「用户固定行」与「虚拟滚动失步自愈」收敛到一处。
 * <zh/> - 固定行：未启用行固定时恒为空数组，下游（Grand Total 条带合并）无需再判空；
 * <zh/> - 协调：拖拽结束 SortableJS 会临时打乱 body 行 DOM 顺序并把 scrollTop 置 0，
 *   <zh/> 且若拖拽被拒绝则数据未变、`watch(data)` 不触发——故拖拽结束强制调度一次自愈；
 * <zh/> - 条带同步：固定条带不跟随横向滚动，需按 `scrollLeft` 平移内容行。
 * <en/> Single responsibility: converge "user-pinned rows" and "virtual-scroll desync self-healing".
 * <en/> - Pinned rows: always empty when pinning is off, so downstream (grand-total strip merge) needs no null check;
 * <en/> - Reconcile: at drag end SortableJS temporarily shuffles body-row DOM order and zeroes scrollTop,
 * <en/>   and a rejected drag leaves data unchanged so `watch(data)` never fires — hence a forced self-heal;
 * <en/> - Strip sync: pinned strips do not follow horizontal scrolling, so content rows are translated by `scrollLeft`.
 */
import type { ComputedRef, Ref } from 'vue'
import type { ScrollReconcileHost, UseScrollReconcileOptions } from './use-scroll-reconcile'
import { computed, nextTick, watch } from 'vue'
import { useScrollReconcile } from './use-scroll-reconcile'

/** <zh/> 行固定上下文的最小契约 | <en/> Minimal contract of the row-pinning context */
export interface V2PinContextLike {
  /** <zh/> 是否启用行固定 | <en/> whether row pinning is enabled */
  pinEnabled: ComputedRef<boolean>
  /** <zh/> 顶部固定行 | <en/> top pinned rows */
  topPinnedRows: ComputedRef<any[]>
  /** <zh/> 底部固定行 | <en/> bottom pinned rows */
  bottomPinnedRows: ComputedRef<any[]>
}

/** <zh/> 行固定域依赖 | <en/> Row-pinning domain deps */
export interface UseV2PinningDeps {
  /** <zh/> 行固定上下文（未启用时为 undefined） | <en/> row-pinning context (undefined when disabled) */
  rowPinCtx?: V2PinContextLike
  /** <zh/> 是否处于行拖拽中 | <en/> whether a row drag is in progress */
  isRowDragging: ComputedRef<boolean>
  /** <zh/> 是否处于低性能档 | <en/> whether the low-performance tier is active */
  lowPerformance: ComputedRef<boolean>
  /** <zh/> ElTableV2 实例（协调宿主） | <en/> ElTableV2 instance (reconcile host) */
  host: () => ScrollReconcileHost | null
  /** <zh/> 行高（px） | <en/> row height (px) */
  rowHeight: () => number
  /** <zh/> 容器实测宽度 | <en/> measured container width */
  measuredWidth: Ref<number>
  /** <zh/> 容器实测高度 | <en/> measured container height */
  measuredHeight: Ref<number>
  /** <zh/> 渲染数据 | <en/> render data */
  data: () => any[]
  /**
   * <zh/> 当前模式 DOM 适配器——透传至 useScrollReconcile | <en/> Current-mode DOM adapter — forwarded to useScrollReconcile
   */
  dom?: UseScrollReconcileOptions['dom']
}

/** <zh/> 行固定域返回 | <en/> Row-pinning domain return */
export interface UseV2PinningReturn {
  /** <zh/> 顶部固定行（未启用时为空） | <en/> top pinned rows (empty when pinning is off) */
  topPinnedRows: ComputedRef<any[]>
  /** <zh/> 底部固定行（未启用时为空） | <en/> bottom pinned rows (empty when pinning is off) */
  bottomPinnedRows: ComputedRef<any[]>
  /** <zh/> 当前纵向滚动位置 | <en/> current vertical scroll position */
  currentScrollTop: Ref<number>
  /** <zh/> 当前横向滚动位置 | <en/> current horizontal scroll position */
  currentScrollLeft: Ref<number>
  /** <zh/> 手动触发一次滚动自愈 | <en/> manually trigger one scroll self-heal */
  reconcileScroll: () => void
  /** <zh/> 固定条带内容行的横向平移样式 | <en/> horizontal translate style for pinned-strip content rows */
  stripInnerStyle: ComputedRef<Record<string, string>>
}

/**
 * <zh/> 创建行固定 + 滚动协调域
 * <en/> Create the row-pinning & scroll-reconcile domain
 */
export function useV2Pinning(deps: UseV2PinningDeps): UseV2PinningReturn {
  const {
    rowPinCtx,
    isRowDragging,
    lowPerformance,
    host,
    rowHeight,
    measuredWidth,
    measuredHeight,
    data,
    dom,
  } = deps

  const pinEnabledC = computed(() => rowPinCtx?.pinEnabled.value ?? false)
  const topPinnedRows = computed<any[]>(() => (pinEnabledC.value ? rowPinCtx!.topPinnedRows.value : []))
  const bottomPinnedRows = computed<any[]>(() => (pinEnabledC.value ? rowPinCtx!.bottomPinnedRows.value : []))

  const scrollReconcile = useScrollReconcile({
    host,
    rowHeight,
    measuredWidth,
    measuredHeight,
    data,
    dom,
    // <zh/> 低性能档：跳过 500ms rAF 看门狗，仅保留事件驱动的单次 reconcile
    // <en/> Low performance tier: skip the 500ms rAF watchdog; event-driven single-shot reconcile remains
    // <zh/> 行拖拽中同样暂停：SortableJS 临时打乱 body 行 DOM 顺序，rows[0] 读数为假象；
    // <zh/> 拖拽结束的 reorder 会触发 watch(data) 重建基线
    // <en/> Also pauses while row-dragging: SortableJS temporarily shuffles body-row DOM order, so rows[0] readings are artifacts;
    // <en/> the post-drag reorder triggers watch(data) to rebuild the baseline
    skipWatchdog: () => lowPerformance.value || isRowDragging.value,
  })
  const currentScrollTop = scrollReconcile.scrollTop
  const currentScrollLeft = scrollReconcile.scrollLeft

  // ── 拖拽结束强制 scheduleReconcile（见 use-row-drag）──
  // <zh/> SortableJS 拖拽结束会临时打乱 DOM 顺序并将 body.scrollTop 置 0，
  // <zh/> isRowDragging=false 后若 beforeDrag 拒绝/抑止移动，仅 DOM 回滚但数据未变，
  // <zh/> watch(data) 不会触发，需强制调度一次自愈，避免失步残留至下次滚动前空白。
  // <en/> Force scheduleReconcile after drag ends
  watch(isRowDragging, (dragging) => {
    if (!dragging) {
      nextTick(() => scrollReconcile.scheduleReconcile())
    }
  })

  /**
   * <zh/> 条带横向滚动同步——跟随主网格 scrollLeft 平移内容行，表意与主区一致。
   * <zh/> prev 复用——scrollLeft 未变时返回同一引用，避免条带不必要的 style patch。
   * <en/> Horizontal sync for strips — shifts content rows following the main grid scrollLeft.
   * <en/> prev reuse — returns the identical reference when scrollLeft is unchanged,
   * <en/> avoiding needless strip style patches.
   */
  const stripInnerStyle = computed<Record<string, string>>((prev) => {
    const next = { transform: `translateX(${-currentScrollLeft.value}px)` }
    if (prev && (prev as Record<string, string>).transform === next.transform)
      return prev as Record<string, string>
    return next
  })

  return {
    topPinnedRows,
    bottomPinnedRows,
    currentScrollTop,
    currentScrollLeft,
    reconcileScroll: scrollReconcile.scheduleReconcile,
    stripInnerStyle,
  }
}
