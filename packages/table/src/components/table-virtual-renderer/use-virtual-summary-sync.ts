/**
 * <zh/> 虚拟渲染器汇总表尾滚动同步 composable — 管理表体与表尾之间的双向滚动同步
 *
 * <zh/> 从 table-virtual-renderer.vue 提取，减少主组件文件体积。
 * <zh/> 核心职责：
 * <zh/> 1. 表体 → 表尾：rAF 合并多个 scroll 帧为单次同步
 * <zh/> 2. 表尾 → 表体：经 ElTableV2 scrollTo API 同步（EP 为程序化滚动，DOM scrollLeft 无效）
 * <zh/> 3. syncLevel 递归防护：防止双向同步死循环
 * <zh/> 4. 生命周期清理：onBeforeUnmount / onDeactivated 取消 rAF，onActivated 恢复
 *
 * <en/> Virtual renderer summary footer scroll sync composable — manages bidirectional scroll sync between table body and footer
 *
 * <en/> Extracted from table-virtual-renderer.vue to reduce the main component file size.
 * <en/> Core responsibilities:
 * <en/> 1. Body → Footer: rAF-batches multiple scroll frames into a single sync
 * <en/> 2. Footer → Body: syncs via ElTableV2's scrollTo API (EP scrolls programmatically; DOM scrollLeft is a no-op)
 * <en/> 3. syncLevel recursion guard: prevents infinite sync loops
 * <en/> 4. Lifecycle cleanup: onBeforeUnmount / onDeactivated cancels rAF, onActivated restores
 */
import type { Ref } from 'vue'
import type { VirtualSummaryFooterExpose } from './virtual-summary-footer.vue'
import { onActivated, onBeforeUnmount, onDeactivated, shallowRef } from 'vue'
import { useV2ScrollApi } from './use-v2-scroll-api'

export interface UseVirtualSummarySyncOptions {
  /** <zh/> VirtualSummaryFooter 组件引用 | <en/> VirtualSummaryFooter component ref */
  summaryFooterRef: Ref<VirtualSummaryFooterExpose | null>
  /**
   * <zh/> 顶部 Grand 汇总条带引用（grandTotalRow='top' 时渲染，与表尾结构完全一致以保证像素对齐）
   * <en/> Grand top strip ref (rendered for grandTotalRow='top'; structurally identical to the footer for pixel alignment)
   */
  topStripRef?: Ref<VirtualSummaryFooterExpose | null>
  /** <zh/> ElTableV2 组件引用 | <en/> ElTableV2 component ref */
  tableV2Ref: Ref<any>
  /**
   * <zh/> 当前表体纵向滚动位置 getter——表尾→表体横向同步时保持纵向不动
   * <en/> Current body scrollTop getter — keeps the vertical position stable during footer→body horizontal sync
   */
  getCurrentScrollTop: () => number
}

export interface UseVirtualSummarySyncReturn {
  /** <zh/> 是否已卸载/deactivated | <en/> Whether unmounted/deactivated */
  isUnmounted: Ref<boolean>
  /**
   * <zh/> 调度表尾滚动同步（rAF 合并）
   * <zh/> 在表体 scroll 事件中调用，将表体的 scrollLeft 同步到表尾
   * <en/> Schedule footer scroll sync (rAF batched)
   * <en/> Called in the body scroll event, syncs body scrollLeft to the footer
   */
  scheduleSummarySync: (scrollLeft: number) => void
  /**
   * <zh/> 表尾滚动事件处理器（表尾 → 表体同步）
   * <zh/> 绑定到 VirtualSummaryFooter 的 onScroll 回调
   * <en/> Footer scroll event handler (footer → body sync)
   * <en/> Bound to VirtualSummaryFooter's onScroll callback
   */
  onSummaryScroll: (params: { scrollLeft: number, scrollTop: number }) => void
}

/**
 * <zh/> 创建汇总表尾滚动同步管理器
 * <en/> Create summary footer scroll sync manager
 */
export function useVirtualSummarySync(options: UseVirtualSummarySyncOptions): UseVirtualSummarySyncReturn {
  const { summaryFooterRef, topStripRef, tableV2Ref, getCurrentScrollTop } = options

  // <zh/> 表尾→表体同步经统一 V2 滚动探针（EP 改名单点回归），不再散落 `(v2 as any)` 探测。
  // <en/> footer→body sync goes through the centralized V2 scroll probe
  // <en/> (single regression point on EP renames), no scattered `(v2 as any)` probing.
  const v2ScrollApi = useV2ScrollApi(() => tableV2Ref.value)

  const isUnmounted = shallowRef(false)

  /** <zh/> 递归同步防护计数器 | <en/> Recursion sync guard counter */
  let syncLevel = 0

  /** <zh/> summary 同步 rAF ID——合并多个 scroll 帧为单次同步 | <en/> Summary sync rAF ID — batches multiple scroll frames into a single sync */
  let summaryScrollRafId: number | null = null

  /**
   * <zh/> 将表体水平滚动位置同步到汇总表尾（含顶部 Grand 条带，两者结构完全一致）
   * <zh/> 必须调用 VirtualSummaryFooter 暴露的 scrollTo（内部写入 .adv-table__v2-summary-scrollbar 的 scrollLeft），
   * <zh/> 而非直接在该组件 $el（wrapper，overflow:hidden）上调用 scrollTo——wrapper 不可滚动，直接调用无效。
   * <en/> Sync the table body's horizontal scroll position to the summary footer (and the grand top strip — identical structure)
   * <en/> Must call the scrollTo exposed by VirtualSummaryFooter (writes scrollLeft of .adv-table__v2-summary-scrollbar),
   * <en/> NOT scrollTo directly on the component's $el (wrapper, overflow:hidden) which is not scrollable and would be a no-op.
   */
  function syncSummaryScrollLeft(scrollLeft: number) {
    if (syncLevel > 0)
      return
    const targets = [summaryFooterRef.value, topStripRef?.value].filter(
      (footer): footer is VirtualSummaryFooterExpose => footer != null && typeof footer.scrollTo === 'function',
    )
    if (targets.length === 0)
      return
    syncLevel++
    try {
      for (const footer of targets)
        footer.scrollTo(scrollLeft)
    }
    finally {
      syncLevel--
    }
  }

  function scheduleSummarySync(scrollLeft: number) {
    if ((!summaryFooterRef.value && !topStripRef?.value) || syncLevel > 0)
      return
    // SSR/无 rAF 环境直接同步，避免 ReferenceError
    // Without rAF (SSR), sync directly to avoid ReferenceError
    if (typeof requestAnimationFrame === 'undefined') {
      syncSummaryScrollLeft(scrollLeft)
      return
    }
    /** <zh/> rAF 合并：多个 scroll 帧合并为单次 summary 同步 | <en/> rAF batching: merges multiple scroll frames into a single summary sync */
    if (summaryScrollRafId != null)
      return
    summaryScrollRafId = requestAnimationFrame(() => {
      summaryScrollRafId = null
      if (isUnmounted.value)
        return
      syncSummaryScrollLeft(scrollLeft)
    })
  }

  function onSummaryScroll(params: { scrollLeft: number, scrollTop: number }) {
    if (syncLevel > 0)
      return
    const scrollLeft = params.scrollLeft
    // <zh/> 必须经 ElTableV2 的 scrollTo API 同步——EP 虚拟列表是 overflow:hidden + 程序化滚动
    // <zh/> （wheel 事件由 JS 翻译为内部 states.scrollLeft），`.el-table-v2__body` 落在
    // <zh/> el-vl__wrapper 根 div 上且真实滚动容器无类名，直接写 DOM scrollLeft 既写错元素
    // <zh/> 也无法更新 EP 内部状态（表尾滚动条拖动完全失效的根因）。
    // <zh/> 纵向传当前 scrollTop 保持不动（与 scrollToColumn 先例一致）。
    // <zh/> 经统一探针调用：API 缺失时返回 false 静默降级（EP 改名仅需改探针一处）。
    // <en/> Must sync via ElTableV2's scrollTo API — EP's virtual list scrolls programmatically
    // <en/> (overflow:hidden window; wheel events are translated into internal states.scrollLeft
    // <en/> by JS). `.el-table-v2__body` lands on the el-vl__wrapper root div and the real
    // <en/> scroll container is an unnamed inner div — writing DOM scrollLeft both targets the
    // <en/> wrong element and fails to update EP's internal state (root cause of the dead
    // <en/> footer scrollbar). Pass the current scrollTop to keep the vertical position stable
    // <en/> (same pattern as scrollToColumn). Called via the centralized probe: a missing API
    // <en/> returns false and degrades silently (EP renames only touch the probe).
    if (!v2ScrollApi.hasApi())
      return
    syncLevel++
    try {
      v2ScrollApi.scrollTo({ scrollLeft, scrollTop: getCurrentScrollTop() })
    }
    finally {
      syncLevel--
    }
  }

  onBeforeUnmount(() => {
    isUnmounted.value = true
    if (summaryScrollRafId != null) {
      cancelAnimationFrame(summaryScrollRafId)
      summaryScrollRafId = null
    }
  })

  onDeactivated(() => {
    isUnmounted.value = true
    // <zh/> 取消待执行的 rAF，防止 deactivated 后仍触发 summary 滚动同步 | <en/> Cancel pending rAF to prevent summary scroll sync after deactivation
    if (summaryScrollRafId != null) {
      cancelAnimationFrame(summaryScrollRafId)
      summaryScrollRafId = null
    }
    // <zh/> 重置递归同步防护计数器，防止 KeepAlive 场景下 onActivated/onDeactivated 不配对导致泄漏 | <en/> Reset recursion sync guard counter to prevent leak when onActivated/onDeactivated don't pair in KeepAlive scenarios
    syncLevel = 0
  })

  /** <zh/> KeepAlive 重新激活时重置卸载标志，恢复滚动事件处理 | <en/> Reset unmount flag on KeepAlive reactivation, restoring scroll event handling */
  onActivated(() => {
    isUnmounted.value = false
  })

  return {
    isUnmounted,
    scheduleSummarySync,
    onSummaryScroll,
  }
}
