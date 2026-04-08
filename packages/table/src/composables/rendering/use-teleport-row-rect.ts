import type { Ref } from 'vue'
import type { RowRect } from '../../types/row-rect'
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { isBrowser } from '../../utils/env'

/** <zh/> 滚动停顿检测延迟（ms）—— 等待滚动结束后的稳定期再重新定位。150ms 平衡触控板惯性滚动的间隔抖动 | <en/> Scroll settle detection delay (ms) — waits for scroll to stabilize before repositioning. 150ms balances trackpad inertial scroll jitter */
const SCROLL_SETTLE_DELAY = 150

/** <zh/> 窗口 resize 后重新定位延迟（ms）—— 16ms ≈ 1帧@60fps，等待布局稳定 | <en/> Window resize reposition delay (ms) — 16ms ≈ 1 frame@60fps, waits for layout to stabilize */
const RESIZE_REPOSITION_DELAY = 16

/**
 * <zh/> 检测祖先元素是否破坏 fixed 定位参照系
 * <en/> Check if ancestor elements break the fixed positioning reference frame
 *
 * @remarks
 * <zh/> position: fixed 的元素在视口中的位置会受 transform / filter / contain: paint 的祖先影响——这些属性会创建新的「包含块」(containing block)，使 fixed 元素的参照点从视口变为该祖先
 * <en/> Elements with position: fixed are affected by transform / filter / contain: paint ancestors — these properties create new containing blocks, changing the fixed element's reference point from the viewport to that ancestor
 *
 * <zh/> 优化：先收集所有祖先元素，再批量读取 getComputedStyle，减少浏览器强制同步布局（Forced Synchronous Layout）次数
 * <en/> Optimization: collect all ancestors first, then batch-read getComputedStyle to reduce Forced Synchronous Layout occurrences
 *
 * @param el - <zh/> 起始元素 | <en/> starting element
 * @returns <zh/> 祖先链中是否存在破坏 fixed 定位的属性 | <en/> whether there are properties breaking fixed positioning in the ancestor chain
 */
function hasTransformAncestor(el: HTMLElement | null | undefined): boolean {
  // <zh/> SSR 无 DOM，直接返回无破坏 | <en/> No DOM in SSR, return no-break directly
  if (!isBrowser || !el)
    return false
  /** 先收集祖先链，避免在循环中交替读取 DOM 和 getComputedStyle 导致 Layout Thrashing */
  const ancestors: HTMLElement[] = []
  let cur: HTMLElement | null = el.parentElement
  while (cur && cur !== document.body) {
    ancestors.push(cur)
    cur = cur.parentElement
  }
  for (const ancestor of ancestors) {
    const style = getComputedStyle(ancestor)
    if (style.transform !== 'none' || style.filter !== 'none' || style.contain.includes('paint'))
      return true
  }
  return false
}

export interface UseTeleportRowRectOptions {
  hoverOptionTeleport: Ref<boolean | undefined>
  hasHoverOptionColumns: Ref<boolean>
  hoverRowKey: Ref<string | null>
  hoverLayerVisible: Ref<boolean>
  locateHoveredRow: () => { top: number, height: number, containerRight: number, containerLeft: number } | undefined
  handleScroll: (params: { scrollLeft: number, scrollTop?: number }) => void
  /**
   * 可选：祖先容器 ref，用于检测祖先滚动与 transform（Optional container ref for ancestor scroll + transform detection）
   * - 不传则跳过祖先滚动监听与 transform 降级
   */
  containerEl?: Ref<HTMLElement | null | undefined>
  /**
   * <zh/> 表格根元素 getter——供 window 捕获期滚动监听判定滚动来源：表内滚动走 EP 自有通道（跳过），
   * <zh/> 祖先滚动体重定位，无关滚动体跳过；未提供时仅处理页面级（document）滚动。
   * <en/> Table root element getter — lets the window capture-phase scroll listener classify the scroll
   * <en/> source: in-table scrolls are owned by the EP channel (skipped), ancestor scrollers reposition,
   * <en/> unrelated scrollers are skipped; without it only page-level (document) scrolls are handled.
   */
  getRootEl?: () => HTMLElement | null | undefined
  /**
   * <zh/> 滚动状态标志：由调用方创建并传入，本 composable 负责维护其值
   * <en/> Scroll state flag: created by the caller and passed in, this composable is responsible for maintaining its value
   * @remarks
   * <zh/> wrappedHandleScroll 置 true，滚动停顿 SCROLL_SETTLE_DELAY 后置 false。
   * useHoverLayer 读取此标志在滚动期间抑制 handleHoverRowEnter
   * <en/> wrappedHandleScroll sets to true, sets to false after SCROLL_SETTLE_DELAY of scroll pause.
   * useHoverLayer reads this flag to suppress handleHoverRowEnter during scrolling
   */
  isScrolling?: Ref<boolean>
  /**
   * <zh/> 滚动停止后重新发现鼠标下方的行并更新 hover 状态（仅 teleport 模式生效）。
   * <zh/> 滚动期间 isScrolling 守卫阻止了 handleHoverRowEnter 更新 hoverRowKey，
   * <zh/> 滚动停止后需根据鼠标当前位置重新定位到正确的行，避免 RowActionBar 指向滚出视图的旧行或错位。
   * <en/> Re-discover the row under the cursor after scrolling stops and update hover state (only effective in teleport mode).
   * <en/> During scrolling the isScrolling guard prevents handleHoverRowEnter from updating hoverRowKey;
   * <en/> after scrolling stops, re-locate to the correct row based on the current mouse position,
   * <en/> avoiding RowActionBar pointing to a stale row that scrolled out of view or being misaligned.
   */
  rediscoverHover?: () => void
  /**
   * <zh/> locateHoveredRow 返回 undefined 时的回调，用于清理陈旧 hover 状态。
   * <zh/> 虚拟渲染器在行被回收时需要清空 hoverRowKey/hoverRowData 等，避免 RowActionBar 残留。
   * <en/> Callback when locateHoveredRow returns undefined, for clearing stale hover state.
   * <en/> The virtual renderer needs to clear hoverRowKey/hoverRowData etc. when rows are recycled, to avoid RowActionBar residue.
   */
  onRowNotFound?: () => void
}

/**
 * <zh/> Teleport 模式行定位 composable——追踪悬停行矩形，处理滚动/缩放重定位、祖先 transform 检测与强制隐藏。
 * <en/> Teleport-mode row rect composable — tracks the hovered row rectangle with scroll/resize
 * <en/> repositioning, ancestor transform detection and forced-hide handling.
 *
 * @param options - <zh/> 悬停状态、行定位读取器与滚动回调等配置 | <en/> Hover state, row locator, scroll callback and related config
 * @returns <zh/> Teleport 行矩形状态与可见性/滚动处理方法 | <en/> Teleport row rect state with visibility and scroll handlers
 */
export function useTeleportRowRect(options: UseTeleportRowRectOptions) {
  const {
    hoverOptionTeleport,
    hasHoverOptionColumns,
    hoverRowKey,
    hoverLayerVisible,
    locateHoveredRow,
    handleScroll,
    containerEl,
    getRootEl,
    isScrolling,
    rediscoverHover,
    onRowNotFound,
  } = options

  const teleportRowRect = ref<RowRect | undefined>(undefined)

  /**
   * <zh/> 判断 teleport hover 层当前是否应显示 | <en/> Determine whether the teleport hover layer should be shown
   */
  function shouldShow(): boolean {
    return !!(hoverOptionTeleport.value)
      && hasHoverOptionColumns.value
      && hoverLayerVisible.value
      && hoverRowKey.value != null
  }

  function updateTeleportRowRect() {
    if (!shouldShow())
      return
    const result = locateHoveredRow()
    if (result) {
      teleportRowRect.value = result
    }
    else {
      teleportRowRect.value = undefined
      onRowNotFound?.()
    }
  }

  let rafId: number | null = null

  /**
   * <zh/> 标记：rediscoverHover 触发的 hoverRowKey 变化已在 settleTimer 中同步更新 rect，
   * <zh/> watch 回调中的 scheduleUpdate 应跳过此帧，避免重复调用 updateTeleportRowRect。
   * <zh/> 生命周期：settleTimer 中置 true → queueMicrotask 后置 false。
   * <zh/> queueMicrotask 在当前同步代码执行完毕后立即执行，比 nextTick 更可控，
   * <zh/> 避免 KeepAlive deactivated 时 nextTick 回调可能被延迟导致标志残留。
   * <zh/> onActivated 中额外重置，防止 deactivated 期间残留的标志影响重新激活后的逻辑。
   *
   * <en/> Flag: hoverRowKey changes triggered by rediscoverHover have already updated rect synchronously in settleTimer,
   * <en/> watch callback's scheduleUpdate should skip this tick to avoid duplicate updateTeleportRowRect.
   * <en/> Lifecycle: set true in settleTimer → reset false via queueMicrotask.
   * <en/> queueMicrotask executes immediately after the current synchronous code, more predictable than nextTick,
   * <en/> avoiding the case where nextTick callback may be delayed during KeepAlive deactivation leaving the flag stale.
   * <en/> Additionally reset in onActivated to prevent stale flags from affecting logic after reactivation.
   */
  let skipWatchScheduleUpdate = false

  function scheduleUpdate() {
    if (skipWatchScheduleUpdate)
      return
    if (rafId != null)
      return
    rafId = requestAnimationFrame(() => {
      rafId = null
      updateTeleportRowRect()
    })
  }

  let settleTimer: ReturnType<typeof setTimeout> | null = null
  function clearSettleTimer() {
    if (settleTimer != null) {
      clearTimeout(settleTimer)
      settleTimer = null
    }
  }

  /**
   * <zh/> 滚动事件 rAF 批处理变量：将同步 scroll 事件合并为每帧最多一次执行
   * <en/> Scroll event rAF batching variables: coalesce synchronous scroll events into at most one execution per frame
   */
  let scrollRafId: number | null = null
  let pendingScrollParams: { scrollLeft: number, scrollTop?: number } | null = null

  /** <zh/> 祖先滚动重定位 rAF 句柄（声明前置于 cancelPending，保证清理函数引用合法） | <en/> Ancestor-scroll reposition rAF id (declared before cancelPending so the cleanup function references it legally) */
  let ancestorScrollRaf: number | null = null

  function cancelPending() {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (scrollRafId != null) {
      cancelAnimationFrame(scrollRafId)
      scrollRafId = null
    }
    if (ancestorScrollRaf != null) {
      cancelAnimationFrame(ancestorScrollRaf)
      ancestorScrollRaf = null
    }
    pendingScrollParams = null
    clearSettleTimer()
  }

  const ancestorHasTransform = ref(false)
  /**
   * <zh/> 祖先检测结果缓存（按容器元素身份）——同一容器重复触发时跳过 getComputedStyle 全链遍历，
   * <zh/> 避免强制同步布局。注意：与既有语义一致，仅容器变更时重检；祖先样式独立变化仍需外部触发重检。
   * <en/> Ancestor-check result cache (by container identity) — repeated triggers for the same container
   * <en/> skip the full getComputedStyle chain, avoiding forced sync layout. Consistent with the existing
   * <en/> semantics: re-checks only on container change; independent ancestor-style changes still need
   * <en/> an external trigger.
   */
  let lastTransformCheckEl: HTMLElement | null | undefined
  let lastTransformCheckResult = false
  function recheckAncestorTransform() {
    const el = containerEl?.value
    if (el != null && el === lastTransformCheckEl) {
      ancestorHasTransform.value = lastTransformCheckResult
      return
    }
    lastTransformCheckEl = el
    lastTransformCheckResult = hasTransformAncestor(el)
    ancestorHasTransform.value = lastTransformCheckResult
  }
  watch(
    () => containerEl?.value,
    () => recheckAncestorTransform(),
    { immediate: true },
  )
  /**
   * <zh/> 是否应使用 teleport 渲染。 | <en/> Whether teleport rendering should be used.
   * <zh/> 仅在 hoverOptionTeleport + hasHoverOptionColumns + 无祖先 transform 时为 true。 | <en/> Only true when hoverOptionTeleport + hasHoverOptionColumns + no ancestor transform.
   */
  const shouldUseTeleport = computed(() =>
    !!(hoverOptionTeleport.value)
    && hasHoverOptionColumns.value
    && !ancestorHasTransform.value,
  )

  /**
   * <zh/> AbortController 管理 window / visualViewport / 祖先容器的事件监听
   * <zh/> KeepAlive deactivated 时 abort 移除所有监听，activated 时重建
   * <en/> AbortController manages window / visualViewport / ancestor container event listeners
   * <en/> Aborted on KeepAlive deactivate to remove all listeners, recreated on activate
   */
  let controller = new AbortController()

  /**
   * <zh/> 注册全局事件监听（resize / orientationchange / visualViewport resize）
   * <en/> Register global event listeners (resize / orientationchange / visualViewport resize)
   *
   * @remarks
   * <zh/> 提取为独立函数，供初始化和 onActivated 重建时复用
   * <en/> Extracted as a standalone function for reuse during initialization and onActivated rebuild
   */
  function registerGlobalListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize, { signal: controller.signal })
      window.addEventListener('orientationchange', onResize, { signal: controller.signal })
      /**
       * <zh/> 捕获期截获所有后代滚动体的 scroll（scroll 不冒泡，唯捕获期可截获）——覆盖页面滚动
       * <zh/> 与祖先滚动容器。表内滚动另有 EP 自有通道处理，见 onWindowScrollCapture 的包含判定。
       * <en/> Intercept scrolls from all descendant scrollers in the capture phase (scroll never
       * <en/> bubbles, only capture can catch it) — covers page scroll and ancestor scroll containers.
       * <en/> In-table scrolls have their own EP channel; see the containment check in onWindowScrollCapture.
       */
      window.addEventListener('scroll', onWindowScrollCapture, { capture: true, passive: true, signal: controller.signal })
    }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (vv) {
      vv.addEventListener('resize', onResize, { signal: controller.signal })
    }
  }

  /**
   * <zh/> 注册祖先容器滚动监听
   * <en/> Register ancestor container scroll listener
   */
  function registerContainerScroll(el: HTMLElement | null | undefined): void {
    if (el) {
      el.addEventListener('scroll', onAncestorScroll, { passive: true, signal: controller.signal })
    }
  }

  /**
   * <zh/> 全局监听按需注册——与 `syncGlobalListeners` / `onActivated` 的装卸门控保持一致。
   * <zh/> 无 hover 列 / inline 模式时不注册 window resize / orientationchange / visualViewport / scroll 捕获，
   * <zh/> 避免每实例常驻 4 个空转监听；shouldUseTeleport 由 false 翻为 true 时由下方 watch 补注册。
   *
   * <en/> Register global listeners on demand — consistent with the bind/unbind gate in
   * <en/> `syncGlobalListeners` / `onActivated`. Skips window resize / orientationchange /
   * <en/> visualViewport / scroll capture when there are no hover columns or in inline mode, avoiding 4 idle
   * <en/> listeners per instance; the watch below registers them when shouldUseTeleport flips true.
   */
  if (shouldUseTeleport.value) {
    registerGlobalListeners()
  }

  /**
   * <zh/> 立即 invalidate rect 并调度重定位（用于 resize / 祖先滚动） | <en/> Immediately invalidate rect and schedule repositioning (used for resize / ancestor scroll)
   */
  function invalidateAndReposition() {
    if (!shouldShow())
      return
    scheduleUpdate()
  }

  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  function onResize() {
    if (resizeTimer != null) {
      clearTimeout(resizeTimer)
      resizeTimer = null
    }
    resizeTimer = setTimeout(() => {
      resizeTimer = null
      invalidateAndReposition()
    }, RESIZE_REPOSITION_DELAY)
  }

  function onAncestorScroll() {
    if (!shouldShow())
      return
    if (ancestorScrollRaf != null)
      return
    if (isScrolling && !isScrolling.value) {
      isScrolling.value = true
      teleportRowRect.value = undefined
    }
    ancestorScrollRaf = requestAnimationFrame(() => {
      ancestorScrollRaf = null
      clearSettleTimer()
      settleTimer = setTimeout(() => {
        settleTimer = null
        runRediscoverAfterSettle()
      }, SCROLL_SETTLE_DELAY)
    })
  }

  /**
   * <zh/> window 捕获期滚动分流——表内滚动走 EP 自有 scroll 通道（wrappedHandleScroll），此处跳过以免双重处理；
   * <zh/> 祖先滚动（页面滚动/外层滚动容器，含表内滚动链式触发的外层滚动）复用 onAncestorScroll：
   * <zh/> 滚动中失效 rect，稳定后按鼠标位置重发现行并重定位，避免 fixed 悬浮条停留在过期视口坐标
   * <zh/> （如容器外部）。与表格无关的滚动体直接跳过。
   * <en/> Window capture-phase scroll triage — in-table scrolls are owned by the EP scroll channel
   * <en/> (wrappedHandleScroll) and skipped here to avoid double handling; ancestor scrolls (page scroll /
   * <en/> outer scroll containers, including outer scrolls chained from in-table scrolling) reuse
   * <en/> onAncestorScroll: invalidate the rect while scrolling, re-discover the row under the cursor and
   * <en/> relocate after settling, so the fixed hover bar never lingers at stale viewport coordinates
   * <en/> (e.g. outside the container). Unrelated scrollers are skipped outright.
   */
  function onWindowScrollCapture(e: Event) {
    if (!shouldShow())
      return
    const target = e.target as Node | null
    const root = getRootEl?.() ?? containerEl?.value ?? null
    if (root && target instanceof Node) {
      // 表内滚动（含表内嵌套滚动体）→ EP 通道已处理，跳过
      if (target === root || root.contains(target))
        return
      // 祖先滚动：滚动目标必须包含表格根；无关滚动体（如侧边栏）跳过
      if (typeof target.contains !== 'function' || !target.contains(root))
        return
    }
    else if (target !== (typeof document !== 'undefined' ? document : null)) {
      // 根未知时仅处理页面级滚动，避免对无法判定关系的元素滚动做无效重定位
      return
    }
    onAncestorScroll()
  }
  watch(
    () => containerEl?.value,
    (el, prev) => {
      if (prev) {
        prev.removeEventListener('scroll', onAncestorScroll)
      }
      registerContainerScroll(el)
    },
  )

  onBeforeUnmount(() => {
    cancelPending()
    if (isScrolling)
      isScrolling.value = false
    controller.abort()
    if (resizeTimer != null) {
      clearTimeout(resizeTimer)
      resizeTimer = null
    }
    if (ancestorScrollRaf != null) {
      cancelAnimationFrame(ancestorScrollRaf)
      ancestorScrollRaf = null
    }
  })

  /**
   * KeepAlive deactivated 时取消所有待处理操作并清空 rect，避免隐藏表格中持续触发定位计算。
   * 同时 abort AbortController 移除所有全局和容器事件监听，防止 deactivated 期间产生不必要的 rAF 调度。
   */
  onDeactivated(() => {
    cancelPending()
    if (isScrolling)
      isScrolling.value = false
    teleportRowRect.value = undefined
    if (resizeTimer != null) {
      clearTimeout(resizeTimer)
      resizeTimer = null
    }
    /**
     * <zh/> abort 移除所有通过 controller.signal 注册的事件监听（resize / orientationchange / visualViewport / 祖先滚动）
     * <en/> abort removes all event listeners registered via controller.signal (resize / orientationchange / visualViewport / ancestor scroll)
     */
    controller.abort()
  })

  /**
   * KeepAlive activated 时重建 AbortController 并重新注册所有事件监听。
   * AbortController 一旦 abort 不可恢复，需创建新实例。
   */
  onActivated(() => {
    controller = new AbortController()
    // <zh/> 恢复监听同样走门控——与 setup/切换路径语义一致
    // <en/> Reactivation binds through the same gate — consistent with setup/flip paths
    if (shouldUseTeleport.value) {
      registerGlobalListeners()
      registerContainerScroll(containerEl?.value)
    }
    skipWatchScheduleUpdate = false
    /**
     * <zh/> 重新激活首帧同步补偿：onDeactivated 已清空 teleportRowRect，若 hoverRowKey /
     * <zh/> hoverLayerVisible 与停用前相同，watch 不会重新触发调度，RowActionBar 将在下一帧
     * <zh/> rAF 前保持屏幕外定位。此处同步执行一次定位计算消除该空档（内部按 shouldShow 守卫）。
     * <en/> Synchronous first-frame compensation on reactivation: onDeactivated cleared
     * <en/> teleportRowRect, and if hoverRowKey / hoverLayerVisible are unchanged from before
     * <en/> deactivation the watch won't re-fire, leaving the RowActionBar off-screen until
     * <en/> the next rAF. Compute the rect synchronously here to close the gap (guarded by shouldShow).
     */
    updateTeleportRowRect()
  })

  /**
   * <zh/> 全局监听按需装卸——禁止在 setup 即无条件注册 window resize/orientationchange/visualViewport/scroll 捕获
   * <zh/> 四个监听（回调内 shouldShow 短路故 CPU 开销≈0，但每实例常驻 4 个空转监听）。
   * <zh/> 必须以 shouldUseTeleport 门控：无 hover 列/inline 模式零注册，切换时动态装卸
   * （AbortController 重建语义与 KeepAlive 路径一致）。
   * <en/> On-demand global listeners — never register unconditionally at setup (handlers
   * <en/> short-circuit via shouldShow so CPU cost ≈ 0, yet 4 idle listeners persist per instance).
   * <en/> Must be gated by shouldUseTeleport: zero registration with no hover columns / inline mode;
   * <en/> dynamically bound/unbound on flips (AbortController rebuild matches the KeepAlive path).
   */
  function syncGlobalListeners(): void {
    controller.abort()
    controller = new AbortController()
    if (shouldUseTeleport.value) {
      registerGlobalListeners()
      registerContainerScroll(containerEl?.value)
    }
  }

  watch(shouldUseTeleport, () => {
    syncGlobalListeners()
  })

  watch(
    [hoverRowKey, hoverLayerVisible, hoverOptionTeleport],
    () => {
      if (shouldShow()) {
        // 源变化 → 同步重新定位
        clearSettleTimer()
        scheduleUpdate()
      }
      else {
        /**
         * 仅取消 rAF（定位重算），不清 settleTimer。
         * settleTimer 负责重置 isScrolling=false，若被取消则 isScrolling 永远为 true，
         * 导致 scrolling watcher 永远不触发 rediscoverHoverAfterScroll。
         * settleTimer 到期后 scheduleUpdate 会通过 shouldShow 守卫自动跳过。
         */
        if (rafId != null) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
        teleportRowRect.value = undefined
      }
    },
  )

  /** Teleport hover 层是否应渲染：需满足 teleport 配置 + 有 hover 列 + 无祖先 transform */
  const showTeleportHover = computed(() => shouldUseTeleport.value)

  /**
   * <zh/> 滚动停顿后重新发现鼠标下方的行并更新定位——三处 settle 定时器共用此序列。
   * <zh/> skipWatchScheduleUpdate 标记防止 watch 回调重复调用 updateTeleportRowRect。
   * <zh/> queueMicrotask 确保标志在当前同步代码执行完毕后立即重置。
   * <en/> Re-discover the row under the cursor and update positioning after scroll settles — shared by three settle timers.
   * <en/> skipWatchScheduleUpdate flag prevents watch callback from redundantly calling updateTeleportRowRect.
   * <en/> queueMicrotask ensures the flag is reset immediately after the current synchronous code completes.
   */
  function runRediscoverAfterSettle(): void {
    if (showTeleportHover.value) {
      skipWatchScheduleUpdate = true
      rediscoverHover?.()
      updateTeleportRowRect()
      queueMicrotask(() => {
        skipWatchScheduleUpdate = false
      })
    }
    if (isScrolling)
      isScrolling.value = false
  }

  function wrappedHandleScroll(params: { scrollLeft: number, scrollTop?: number }) {
    // <zh/> isScrolling 立即同步置 true，确保 handleHoverRowEnter 守卫第一时间生效
    // <en/> Set isScrolling = true synchronously to ensure handleHoverRowEnter guard takes effect immediately
    if (isScrolling && !isScrolling.value) {
      isScrolling.value = true
      /**
       * <zh/> 同步 invalidate teleportRowRect，使 teleportStyle 立即返回 hiddenStyle（off-screen -9999px）。
       * <zh/> 不能仅靠 isScrolling prop 控制 visibility: hidden——prop 更新需等父组件 re-render，
       * <zh/> 在 prop 更新前的间隙中 RowActionBar 仍以旧 rect 完全可见。
       * <zh/> 虚拟滚动行回收后旧坐标指向错误位置，产生定位闪烁。
       * <zh/> invalidate 后 teleportStyle 走 !rowRect 分支返回 hiddenStyle，下一帧 Vue flush 即移至 off-screen。
       * <en/> Synchronously invalidate teleportRowRect so teleportStyle immediately returns hiddenStyle (off-screen -9999px).
       * <en/> Cannot rely solely on isScrolling prop for visibility: hidden — prop update waits for parent re-render,
       * <en/> during the gap RowActionBar remains fully visible at the stale rect position.
       * <en/> After virtual scroll row recycling, the stale coordinates point to the wrong position, causing a positioning flash.
       * <en/> After invalidation, teleportStyle takes the !rowRect branch returning hiddenStyle, moved off-screen in the next Vue flush.
       */
      teleportRowRect.value = undefined
    }

    // <zh/> 将 handleScroll 调用与定时器管理合并到 rAF 批处理
    // <en/> Batch handleScroll call and timer management into rAF
    pendingScrollParams = params
    scrollRafId ??= requestAnimationFrame(() => {
      scrollRafId = null
      const p = pendingScrollParams
      if (!p)
        return

      /**
       * <zh/> 性能优化：仅在非 teleport 模式下更新 inline hover 层的水平滚动定位。
       * <zh/> 使用 `!showTeleportHover.value` 作为判断——teleport 模式下 inline hover 层永远不会使用，
       * <zh/> 无论 hoverLayerVisible 状态如何都应跳过 handleScroll。
       * <en/> Performance optimization: only update inline hover layer horizontal scroll positioning in non-teleport mode.
       * <en/> Uses `!showTeleportHover.value` as the check — in teleport mode the inline hover layer is never used,
       * <en/> so handleScroll should be skipped regardless of hoverLayerVisible.
       */
      if (!showTeleportHover.value) {
        handleScroll(p)
      }

      // <zh/> 滚动期间不再 invalidate rect，保留上次有效值供 RowActionBar 定位
      // <zh/> RowActionBar 通过 isScrolling prop 设置 visibility: hidden + pointer-events: none
      // <en/> Don't invalidate rect during scroll, keep last valid value for RowActionBar positioning
      // <en/> RowActionBar uses isScrolling prop to set visibility: hidden + pointer-events: none

      // 取消之前的 pending rAF（locateHoveredRow 重定位）和 settle timer
      if (rafId != null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      clearSettleTimer()

      // 滚动停止后（SCROLL_SETTLE_DELAY 内没有新事件）重置 isScrolling 并重定位 teleport 层。
      // 持续滚动会持续重置 settleTimer，仅在最后一次 scroll 之后才触发一次。
      settleTimer = setTimeout(() => {
        settleTimer = null
        runRediscoverAfterSettle()
      }, SCROLL_SETTLE_DELAY)
    })
  }

  /**
   * RowActionBar Teleport 模式下 fixed 到 body，wheel 无法滚动 table。
   * 操作栏 emit('forceHide') 时立即隐藏并 invalidate rect，鼠标下方变回 table
   * 后续 wheel 原生滚动 table（wrappedHandleScroll 接管滚动稳定后重定位）。
   * 不清 hoverRowKey/hoverRowData，滚动后鼠标仍在该行时下次 mousemove 重新显示。
   *
   * <zh/> forceHide 触发场景：scrollBody 返回 false（表格到达边缘或 scrollBody 不可用）。
   * <zh/> 此时可能不会有 scroll 事件触发（scrollTop 未变化），wrappedHandleScroll 不会被调用，
   * <zh/> 其 settleTimer 永远不会启动。如果不在此处启动 settleTimer，
   * <zh/> rediscoverHover 永远不会被调用，RowActionBar 保持隐藏，
   * <zh/> 而行的原生 CSS :hover 仍激活，造成「行看起来被 hover 但操作栏不显示」的视觉困惑。
   * <en/> forceHide trigger scenario: scrollBody returns false (table at edge or scrollBody unavailable).
   * <en/> In this case no scroll event may fire (scrollTop unchanged), wrappedHandleScroll is never called,
   * <en/> and its settleTimer never starts. Without starting a settleTimer here,
   * <en/> rediscoverHover is never called, RowActionBar stays hidden,
   * <en/> while the row's native CSS :hover remains active, creating visual confusion.
   */
  function handleForceHide(): void {
    hoverLayerVisible.value = false
    teleportRowRect.value = undefined

    /**
     * <zh/> 设置 isScrolling = true 抑制滚动期间 handleHoverRowEnter。
     * <zh/> 触控板滚动涉及鼠标移动，若不抑制会触发 cell-mouse-enter → handleHoverRowEnter，
     * <zh/> 导致 hoverLayerVisible 在 false/true 之间频繁切换，引发闪烁。
     * <en/> Set isScrolling = true to suppress handleHoverRowEnter during scrolling.
     * <en/> Touchpad scrolling involves mouse movement; without suppression, cell-mouse-enter → handleHoverRowEnter
     * <en/> would toggle hoverLayerVisible between false/true, causing flickering.
     */
    if (isScrolling && !isScrolling.value)
      isScrolling.value = true

    /**
     * <zh/> 启动防抖 settleTimer：每次 forceHide 调用都清除并重启定时器，
     * <zh/> 仅在最后一次 wheel 事件后 SCROLL_SETTLE_DELAY 才执行恢复逻辑。
     * <zh/> 这与 wrappedHandleScroll 的 settleTimer 共享同一个变量，互斥不会冲突——
     * <zh/> 后执行的 clearSettleTimer + setTimeout 总是覆盖先执行的。
     * <en/> Start debounced settleTimer: each forceHide call clears and restarts the timer,
     * <en/> only after the last wheel event + SCROLL_SETTLE_DELAY does the restore logic execute.
     * <zh/> This shares the same settleTimer variable as wrappedHandleScroll, mutually exclusive—
     * <en/> the later clearSettleTimer + setTimeout always overrides the earlier one.
     */
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    clearSettleTimer()
    settleTimer = setTimeout(() => {
      settleTimer = null
      runRediscoverAfterSettle()
    }, SCROLL_SETTLE_DELAY)
  }

  return {
    teleportRowRect,
    showTeleportHover,
    shouldUseTeleport,
    ancestorHasTransform,
    wrappedHandleScroll,
    handleForceHide,
  }
}
