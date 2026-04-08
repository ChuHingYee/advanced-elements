/**
 * @file use-scroll-reconcile.ts
 * @description
 * <zh/> 虚拟滚动失步自愈（从 table-virtual-renderer.vue 抽离的滚动协调域）。
 *
 * <zh/> **职责**：追踪当前滚动位置；检测并自愈 ElTableV2 内部网格滚动状态与 DOM 滚动位置的失步；
 * <zh/> 管理失步检测的全部触发源（容器尺寸/数据引用/滚动静默/window resize/visibilitychange/KeepAlive）
 * <zh/> 及其 rAF/定时器资源的完整生命周期清理。
 *
 * <zh/> **失步表现**：滚动条未动但顶部出现空白带、渲染行整体下移，鼠标微微一滚即恢复。
 * <en/> Virtual scroll desync self-healing (the scroll-reconcile domain extracted from
 * <en/> table-virtual-renderer.vue).
 *
 * <en/> **Responsibilities**: track the current scroll position; detect and heal desync between
 * <en/> ElTableV2's internal grid scroll state and the DOM scroll position; own every trigger
 * <en/> source (container size / data reference / window resize / visibilitychange / KeepAlive)
 * <en/> plus full lifecycle cleanup of their rAF/timer resources.
 */
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowRef, toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { detectVirtualScrollDesync, findVirtualScrollWindow } from '../../utils/virtual-scroll-sync'
import { useV2ScrollApi } from './use-v2-scroll-api'

/**
 * <zh/> 滚动协调所需的宿主能力——结构最小化，避免依赖 ElTableV2 的完整类型 |
 * <en/> Host capabilities required for reconciliation — structurally minimal to avoid coupling to ElTableV2's full type
 */
export interface ScrollReconcileHost {
  /** <zh/> EP 提供的状态回写入口（内部带 state===target 早退守卫） | <en/> EP's state-write entry (guarded by internal state===target early-return) */
  scrollToTop?: (top: number) => void
  $el?: HTMLElement | null
}

export interface UseScrollReconcileOptions {
  /** <zh/> 宿主实例 getter（ElTableV2 组件 ref） | <en/> Host instance getter (ElTableV2 component ref) */
  host: () => ScrollReconcileHost | null
  /** <zh/> 行高 getter——失步判定的容差基准 | <en/> Row height getter — tolerance basis for desync detection */
  rowHeight: () => number
  /** <zh/> 容器实测宽度（ResizeObserver） | <en/> Measured container width (ResizeObserver) */
  measuredWidth: Ref<number>
  /** <zh/> 容器实测高度（ResizeObserver） | <en/> Measured container height (ResizeObserver) */
  measuredHeight: Ref<number>
  /** <zh/> 数据引用 getter——loading→数据、翻页等引用变化后布局可能失步 | <en/> Data reference getter — layout may desync after reference changes (loading→data, pagination) */
  data: () => unknown[]
  /**
   * <zh/> 当前模式 DOM 适配器——body/行选择器经其解析（命名空间化），缺 dom 时跳过 DOM 侧检测。
   * <en/> Current-mode DOM adapter — resolves body/row selectors (namespace-aware); DOM-side checks skipped without it.
   */
  dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
  /**
   * <zh/> 低性能档——为 true 时看门狗（500ms rAF 检测序列）不再启动，仅保留单次 reconcile
   * <zh/> 行拖拽中同样为 true：SortableJS 临时打乱 body 行 DOM 顺序，rows[0] 读数为假象，检测与自愈一并暂停
   * <en/> Low performance tier — when true the watchdog (500ms rAF sequence) never starts; single-shot reconcile remains
   * <en/> Also true while row-dragging: SortableJS temporarily shuffles body-row DOM order, so rows[0] readings are artifacts; detection and healing pause together
   */
  skipWatchdog?: () => boolean
}

export interface ScrollReconcileApi {
  /** <zh/> 当前滚动位置——供 scrollBody 计算下一个滚动目标 | <en/> Current scroll position — for computing the next scroll target */
  scrollTop: Ref<number>
  scrollLeft: Ref<number>
  /**
   * <zh/> 记录宿主上报的最新滚动位置（scroll 事件回调内调用） |
   * <en/> Record the latest host-reported scroll position (call inside the scroll event handler)
   */
  trackScrollPosition: (scrollLeft: number, scrollTop: number) => void
  /**
   * <zh/> 手动触发一次失步检测（rAF 合并调度）。对外作为 reconcileScroll 暴露，
   * <zh/> 供自动检测窗口之外的场景使用（如 el-drawer/el-dialog 的 @closed）。
   * <en/> Manually schedule one desync check (rAF-coalesced). Exposed externally as
   * <en/> reconcileScroll for scenarios outside the automatic detection window,
   * <en/> e.g. el-drawer / el-dialog @closed.
   */
  scheduleReconcile: () => void
}

/** <zh/> 看门狗检测窗口（ms）——基于 performance.now，与刷新率无关 | <en/> Watchdog detection window (ms) — refresh-rate independent via performance.now */
const WATCHDOG_DURATION = 500
/** <zh/> 尺寸驱动的看门狗启动防抖（ms） | <en/> Debounce for size-driven watchdog start (ms) */
const WATCHDOG_RESTART_DEBOUNCE = 120
/**
 * <zh/> 滚动静默延迟（ms）——scroll 事件停止后多久做一次 settle 验证。
 * <zh/> 与 WATCHDOG_RESTART_DEBOUNCE 同值：活跃滚动期间只重置 timer、零检测开销，
 * <zh/> settle 后单次验证（失步则自愈，对齐则刷新基线）。
 * <en/> Scroll-settle delay (ms) — how long after the last scroll event to run one settle check.
 * <en/> Same value as WATCHDOG_RESTART_DEBOUNCE: active scrolling only resets the timer at zero detection cost,
 * <en/> then a single post-settle check runs (heals on desync, refreshes the baseline when aligned).
 */
const SCROLL_SETTLE_DELAY = 120

/**
 * <zh/> 创建虚拟滚动协调器。所有 window/document 监听、rAF 循环与定时器
 * <zh/> 均在本 composable 内注册并在卸载/停用时完整清理。
 *
 * <en/> Create the virtual scroll reconciler. Every window/document listener, rAF loop and
 * <en/> timer is registered here and fully cleaned up on unmount/deactivation.
 */
export function useScrollReconcile(options: UseScrollReconcileOptions): ScrollReconcileApi {
  const { host, rowHeight, measuredWidth, measuredHeight, data, skipWatchdog = () => false } = options

  /**
   * <zh/> scrollToTop 探针——收口至 `use-v2-scroll-api`，使 EP 未声明方法在本模块内**不再**自带
   * <zh/> 内联 `typeof` 判定。EP 改名时只需改探针一处，本模块与 scroll 恢复逻辑随之一起失效/修复，
   * <zh/> 而非两处各自静默降级。探针每次调用重新解析实例（重挂载后实例会变，不可缓存）。
   * <en/> scrollToTop probe — centralized in `use-v2-scroll-api` so this module no longer carries its own
   * <en/> inline `typeof` check. An EP rename then needs a single-site fix and this module plus the scroll
   * <en/> restore path fail/heal together, instead of two sites silently degrading independently. The probe
   * <en/> re-resolves the instance per call (it changes across remounts, so it is never cached).
   */
  const scrollApi = useV2ScrollApi(host)

  /** <zh/> 当前滚动位置追踪——供 scrollBody 计算下一个滚动目标位置 | <en/> Current scroll position tracking — used by scrollBody to calculate the next scroll target */
  const scrollTop = shallowRef(0)
  const scrollLeft = shallowRef(0)

  /**
   * <zh/> KeepAlive 失活标志——失活期间表处于隐藏状态、不参与布局，除停掉在跑的看门狗外，
   * <zh/> 还必须拦截由 `data`/尺寸变化**重新启动**的检测（否则隐藏表上仍会跑满 500ms rAF 序列，
   * <zh/> 并在隐藏 DOM 上读 `style.top`）。失活时已摘除 resize/visibilitychange 全局监听，
   * <zh/> 故只需在本模块的调度入口统一拦截。
   * <en/> KeepAlive deactivation flag — while deactivated the table is hidden and not laid out, so besides
   * <en/> stopping the running watchdog, restarts triggered by `data`/size changes must be gated (otherwise a
   * <en/> full 500ms rAF sequence still runs against a hidden table and reads `style.top` on hidden DOM).
   * <en/> The resize/visibilitychange listeners are already removed on deactivate, so gating the scheduling
   * <en/> entry points here is sufficient.
   */
  let deactivated = false

  function trackScrollPosition(nextLeft: number, nextTop: number): void {
    scrollLeft.value = nextLeft
    scrollTop.value = nextTop
  }

  // 失步自愈主流程 | Desync self-healing main flow

  let reconcileRafId: number | null = null

  function scheduleReconcile(): void {
    if (deactivated)
      return
    ensureScrollCapture()
    if (reconcileRafId != null)
      return
    if (typeof requestAnimationFrame === 'undefined')
      return
    reconcileRafId = requestAnimationFrame(() => {
      reconcileRafId = null
      reconcileVirtualScroll()
    })
  }

  /**
   * <zh/> 有限帧看门狗——事件触发后基于时间检测 N 毫秒并自愈，完成后自动停止
   * <en/> Limited-duration watchdog — checks and heals for N ms after event trigger, then stops
   *
   * @remarks
   * <zh/> 对标 ag-grid 事件驱动失步检测：不做持续轮询，仅在 scroll/resize/visibilitychange/容器尺寸 watch 等事件回调中触发。
   * <zh/> 弹层（el-drawer / el-dialog）关闭后可能出现静默失步——DOM scrollTop 被浏览器重置为 0 而 EP 内部 state 不变，
   * <zh/> 且无 resize/visibility 事件。本看门狗以 performance.now 度量窗口（默认 500ms，与刷新率无关），
   * <zh/> 期间逐帧检测并自愈；检测到失步并完成自愈后提前终止，否则序列自然结束，无持续 CPU 开销。
   * <en/> Aligned with ag-grid's event-driven detection: no continuous polling, only triggered in event callbacks.
   * <en/> Overlays (el-drawer/el-dialog) close may cause silent desync — DOM scrollTop is reset to 0 while EP state
   * <en/> stays, with no resize/visibility event. This watchdog uses performance.now for the window (default 500ms,
   * <en/> refresh-rate independent), checking per frame; it terminates early on heal or ends naturally with no CPU cost.
   */
  let watchdogRafId: number | null = null
  let watchdogStartTime = 0

  /**
   * <zh/> 启动基于时间的看门狗——重置起始时间（延长检测窗口）。
   * <zh/> 连续事件（如 resize → data change 连续触发）会重置起始时间，确保覆盖完整变化序列。
   * <en/> Start time-based watchdog — resets start time (extends detection window).
   * <en/> Consecutive events (e.g. resize → data change in quick succession) reset the timer, ensuring
   * <en/> coverage of the full change sequence.
   */
  function startWatchdog(): void {
    if (deactivated)
      return
    if (skipWatchdog())
      return
    ensureScrollCapture()
    if (typeof requestAnimationFrame === 'undefined')
      return
    watchdogStartTime = performance.now()
    if (watchdogRafId != null)
      return
    const tick = () => {
      watchdogRafId = null
      reconcileVirtualScroll()
      if (performance.now() - watchdogStartTime >= WATCHDOG_DURATION) {
        // <zh/> 达到最大时长且未检测到持续失步，自然停止 | <en/> Reached max duration without persistent desync, stop naturally
        return
      }
      watchdogRafId = requestAnimationFrame(tick)
    }
    watchdogRafId = requestAnimationFrame(tick)
  }

  function stopWatchdog(): void {
    if (watchdogRafId != null) {
      cancelAnimationFrame(watchdogRafId)
      watchdogRafId = null
    }
    watchdogStartTime = 0
  }

  /**
   * <zh/> 检测并自愈主表体网格的滚动失步
   * <en/> Detect and heal scroll desync of the main body grid
   */

  // <zh/> 最近一次「对齐」帧的快照：DOM 滚动位置与首行偏移。用于判定失步时哪一侧被破坏。
  // <zh/> 行未动而 DOM 回落（弹层/隐藏容器把 DOM 位置静默重置）→ 破坏在 DOM 侧，
  // <zh/> 应以最近对齐位置恢复 DOM（保留用户阅读位置）；行整体漂移而 DOM 未动 →
  // <zh/> 破坏在状态侧，应以 DOM 为准回写状态。
  // <en/> Snapshot of the last "aligned" frame: DOM scrollTop and first-row offset. Used to
  // <en/> decide which side was corrupted on desync. Rows stable while the DOM dropped
  // <en/> (overlays/hidden containers silently reset the DOM position) → the DOM side is
  // <en/> broken, restore the DOM to the last aligned position (keep the reading position);
  // <en/> rows drifted while the DOM stayed → the state side is broken, rewrite the state
  // <en/> from the DOM.
  let lastAlignedScrollTop: number | null = null
  let lastAlignedFirstRowTop: number | null = null

  function reconcileVirtualScroll(): void {
    // <zh/> 暂停条件（含行拖拽中）：SortableJS 临时打乱 body 行 DOM 顺序，
    // <zh/> 按 DOM 顺序取 rows[0] 会读到被换行的 style.top，判定结果为假象；
    // <zh/> 此处直接返回且不更新基线，看门狗自然停止或被拖后 watch(data) 重建基线
    // <en/> Pause conditions (incl. row dragging): SortableJS temporarily shuffles body-row DOM
    // <en/> order, so reading rows[0] in DOM order yields a swapped row's style.top artifact;
    // <en/> return directly without touching the baseline; the watchdog stops naturally or
    // <en/> watch(data) rebuilds the baseline after the drag
    if (skipWatchdog())
      return
    const v2 = host()
    // <zh/> scrollToTop 可用性交由集中探针判定（EP 未声明方法单点回归点）；
    // <zh/> 探针与下方读 $el 需同一实例，故此处先取实例再判定。
    // <en/> scrollToTop availability is decided by the centralized probe (single regression point for an
    // <en/> EP-undeclared method); the probe and the $el read below must agree on one instance, so we
    // <en/> resolve the instance first and then ask the probe.
    if (!v2 || !scrollApi.hasScrollToTop())
      return
    const rootEl = v2.$el ?? undefined
    if (!rootEl)
      return
    // <zh/> body/行选择器经 DOM 适配器解析（命名空间化）；缺 dom 时跳过本次检测（与未命中同等处理）
    // <en/> Body/row selectors resolved via the DOM adapter; skipped without dom (same as a miss)
    const dom = toValue(options.dom)
    const scopeSelector = dom?.getScopeSelector()
    const bodySelector = dom?.getBodySelector()
    const rowSelector = dom?.getRowSelector()
    if (!scopeSelector || !bodySelector || !rowSelector)
      return
    const bodyWrapper = rootEl.querySelector<HTMLElement>(`${scopeSelector} ${bodySelector}`)
    if (!bodyWrapper || bodyWrapper.clientHeight <= 0)
      return
    // <zh/> body（虚拟列表 wrapper）只是外壳，真正可滚动的 window 是其内部可滚动子 div
    // <en/> The body (virtual list wrapper) is just a shell; the scrollable window is its inner scrollable div
    const body = findVirtualScrollWindow(bodyWrapper)
    if (!body || body.scrollHeight <= body.clientHeight)
      return
    const rows = Array.from(body.querySelectorAll<HTMLElement>(rowSelector))
    if (rows.length === 0)
      return
    const firstRow = rows[0]!
    const lastRow = rows.at(-1)!
    const domScrollTop = body.scrollTop
    const firstRowTop = Number.parseFloat(firstRow.style.top) || 0
    const desync = detectVirtualScrollDesync({
      domScrollTop,
      clientHeight: body.clientHeight,
      firstRowTop,
      lastRowTop: Number.parseFloat(lastRow.style.top) || 0,
      lastRowHeight: Number.parseFloat(lastRow.style.height) || rowHeight(),
    }, rowHeight())
    if (desync) {
      // <zh/> 顶部空白且行未移动、DOM 位置回落 → DOM 侧被破坏：恢复 DOM 到最近对齐位置
      // <zh/> （保留用户阅读位置）。此处必须直接写 DOM scrollTop，而非调用 EP 的 scrollToTop：
      // <zh/> EP 的 scrollTo 内部有「state === target 则 early-return」守卫，而此时 state 恰好
      // <zh/> 已在 lastAlignedScrollTop（行未动即证明 state 未变），scrollToTop 会成为 no-op，
      // <zh/> DOM 永远停留在被重置的 0，看门狗无限循环空转。直接写 DOM 后，EP 的 onScroll
      // <zh/> 会读取新位置但同样 early-return（state 已对齐），不会触发多余重渲染。
      // <en/> Blank at top with stable rows and a dropped DOM position → the DOM side is
      // <en/> broken: restore the DOM to the last aligned position (keeping the reading
      // <en/> position). We must write the DOM scrollTop directly instead of calling EP's
      // <en/> scrollToTop: EP's scrollTo has a "state === target → early-return" guard, and
      // <en/> since the state is already at lastAlignedScrollTop (stable rows prove the state
      // <en/> hasn't changed), scrollToTop would be a no-op — the DOM would stay at 0 forever
      // <en/> and the watchdog would spin infinitely. After the direct DOM write, EP's onScroll
      // <en/> reads the new position but also early-returns (state already aligned), so no
      // <en/> extra re-render is triggered.
      const domReset = desync === 'top'
        && lastAlignedScrollTop != null
        && lastAlignedFirstRowTop != null
        && domScrollTop < lastAlignedScrollTop
        && Math.abs(firstRowTop - lastAlignedFirstRowTop) <= rowHeight()
      const target = domReset ? lastAlignedScrollTop! : domScrollTop
      if (isDev) {
        devWarn(
          `[AdvTable] virtual scroll desync healed: ${domReset ? `restored domScrollTop=${target} (rows stable, DOM was reset)` : `re-aligned state to domScrollTop=${target} (rows drifted, was firstRowTop=${firstRowTop})`}`,
        )
      }
      if (domReset) {
        body.scrollTop = target
      }
      else {
        // <zh/> 走集中探针（而非内联 v2.scrollToTop），EP 改名时只有一个回归点
        // <en/> Go through the centralized probe (not an inline v2.scrollToTop) so an EP rename has one regression point
        scrollApi.scrollToTop(target)
      }
      return
    }
    lastAlignedScrollTop = domScrollTop
    lastAlignedFirstRowTop = firstRowTop
  }

  function handleDocumentVisibilityChange(): void {
    if (!document.hidden) {
      scheduleReconcile()
      startWatchdog()
    }
  }

  /**
   * <zh/> 尺寸驱动的看门狗启动——防抖 120ms。
   * <zh/> 禁止每个 resize tick 直接重启 500ms rAF 看门狗：拖拽调整容器期间
   * <zh/> 每帧一次 DOM 读循环持续运行；仅在尺寸稳定时启动一轮。
   * <en/> Size-driven watchdog start — debounced by 120ms. Never restart
   * <en/> the 500ms rAF watchdog on EVERY resize tick, which keeps a per-frame DOM-read loop alive throughout interactive
   * <en/> container resizing; start one watchdog round only after size settles.
   */
  let watchdogStartTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleWatchdogRestart(): void {
    if (skipWatchdog())
      return
    if (watchdogStartTimer != null)
      clearTimeout(watchdogStartTimer)
    watchdogStartTimer = setTimeout(() => {
      watchdogStartTimer = null
      startWatchdog()
    }, WATCHDOG_RESTART_DEBOUNCE)
  }

  function clearWatchdogStartTimer(): void {
    if (watchdogStartTimer != null) {
      clearTimeout(watchdogStartTimer)
      watchdogStartTimer = null
    }
  }

  /**
   * <zh/> 滚动静默捕获——根节点 capture 监听 scroll（scroll 不冒泡，但 capture 可截获后代滚动）。
   * <zh/> ag-grid 原则把 scroll 列为首位触发源，但本模块此前只接了尺寸/数据/resize/visibility——
   * <zh/> "DOM 被改写、EP 监听没跑"的静默改写不产生任何上述事件，reconcile 永不运行，只能等手动滚动。
   * <zh/> 祖先 capture 先于 target 监听执行，不受 target 的 stopImmediatePropagation 影响。
   * <zh/> 开销：活跃滚动期只重置 120ms timer；settle 后单次验证（失步自愈，对齐刷新基线，
   * <zh/> 使 domReset 零跳变分支在稳态下依然有效）。
   * <en/> Scroll-settle capture — capture-phase scroll listener on the table root (scroll never
   * <en/> bubbles, but capture still intercepts descendant scrolling). The ag-grid principle lists
   * <en/> scroll first, yet this module wired only size/data/resize/visibility — a silent rewrite
   * <en/> ("DOM changed, EP's listener never ran") fires none of those, so reconcile never runs.
   * <en/> Ancestor capture precedes target listeners, immune to stopImmediatePropagation there.
   * <en/> Cost: active scrolling only resets a 120ms timer; one post-settle check follows (heals on
   * <en/> desync, refreshes the baseline when aligned, keeping the zero-jump domReset path valid).
   */
  let scrollSettleTimer: ReturnType<typeof setTimeout> | null = null
  let scrollCaptureRoot: HTMLElement | null = null

  function handleScrollCapture(): void {
    if (deactivated || skipWatchdog())
      return
    if (scrollSettleTimer != null)
      clearTimeout(scrollSettleTimer)
    scrollSettleTimer = setTimeout(() => {
      scrollSettleTimer = null
      scheduleReconcile()
    }, SCROLL_SETTLE_DELAY)
  }

  /**
   * <zh/> 确保滚动捕获挂在当前实例根上——gridInstanceKey 翻转重挂载后 $el 会换，
   * <zh/> 旧根随卸载 GC（监听同消），此处在每次调度入口幂等重挂。
   * <en/> Keep the scroll capture on the current instance root — a gridInstanceKey remount swaps
   * <en/> the $el, the old root is GC'd with its listener, so re-attach idempotently here on every scheduling entry.
   */
  function ensureScrollCapture(): void {
    if (typeof window === 'undefined')
      return
    // <zh/> 门控与检测入口一致（含行拖拽暂停）：暂停期间连实例都不解析，
    // <zh/> 拖拽结束的 watch(data)/schedule 会重新挂载
    // <en/> Same gate as the detection entry (incl. the row-drag pause): never even resolve
    // <en/> the instance while paused; post-drag watch(data)/schedule re-attaches
    if (deactivated || skipWatchdog())
      return
    // <zh/> 与下方读 $el 共用同一实例（探针注释的同实例约定），重挂载后实例会变、每次重解
    // <en/> Shares the instance with the $el read below (the same-instance convention of the probe comment); the instance changes across remounts, re-resolve every time
    const root = host()?.$el ?? null
    if (!root || root === scrollCaptureRoot)
      return
    detachScrollCapture()
    root.addEventListener('scroll', handleScrollCapture, { capture: true, passive: true })
    scrollCaptureRoot = root
  }

  function detachScrollCapture(): void {
    if (scrollCaptureRoot) {
      scrollCaptureRoot.removeEventListener('scroll', handleScrollCapture, { capture: true })
      scrollCaptureRoot = null
    }
    if (scrollSettleTimer != null) {
      clearTimeout(scrollSettleTimer)
      scrollSettleTimer = null
    }
  }

  // ── 触发源接线 | Trigger wiring ──

  // <zh/> 容器尺寸变化（含 drawer/dialog 锁 body 滚动导致的视口宽高重排）| <en/> Container size changes (incl. viewport reflow from drawer/dialog body scroll lock)
  watch([measuredWidth, measuredHeight], () => {
    scheduleReconcile()
    scheduleWatchdogRestart()
  })

  // <zh/> 数据引用变化后（loading → 数据、分页切换等）重排可能失步 | <en/> After data reference changes (loading → data, pagination switch, etc.) layout may desync
  watch(data, () => {
    scheduleReconcile()
    startWatchdog()
  })

  /**
   * <zh/> window resize 回调——同时触发单次 reconcile 和有限帧看门狗。
   * <zh/> 弹层关闭导致的 viewport reflow 会触发 window resize 事件，
   * <zh/> 需要启动有限帧序列覆盖可能的静默失步。
   * <en/> window resize callback — triggers both single reconcile and limited-frame watchdog.
   * <en/> Overlay close causing viewport reflow fires window resize event;
   * <en/> needs limited-frame sequence to cover potential silent desync.
   */
  function handleWindowResize(): void {
    scheduleReconcile()
    startWatchdog()
  }

  // <zh/> 挂载时注册 window/document 事件监听并启动有限帧看门狗——覆盖首次渲染后的潜在失步（如 SSR hydration 与实际 DOM 不一致）
  // <zh/> 将事件监听移入 onMounted 利用 Vue 生命周期保证只在客户端执行，避免 SSR 场景下的模块顶层副作用
  // <en/> Register window/document listeners and start limited-frame watchdog on mount — covers potential desync after initial render (e.g. SSR hydration mismatch)
  // <en/> Moving event listeners into onMounted leverages Vue lifecycle to ensure client-only execution, avoiding module-top-level side effects in SSR scenarios
  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleWindowResize, { passive: true })
      if (typeof document !== 'undefined')
        document.addEventListener('visibilitychange', handleDocumentVisibilityChange, { passive: true })
    }
    ensureScrollCapture()
    startWatchdog()
  })

  // <zh/> KeepAlive 复活的表头网格同款自愈（EP 内部仅有 +1px nudge，此处做完整检测） | <en/> Self-heal on KeepAlive reactivation (EP only nudges +1px internally; this does a full detection)
  onActivated(() => {
    // 先解除失活门控，否则下方的 startWatchdog / scheduleReconcile 会被拦截
    // Lift the deactivation gate first, otherwise the startWatchdog / scheduleReconcile calls below are blocked
    deactivated = false
    ensureScrollCapture()
    // 失活时已摘除全局监听，此处重新挂载（挂载期已注册时 addEventListener 幂等去重由浏览器保证需先摘后加，故统一先摘后加）
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleWindowResize)
      window.addEventListener('resize', handleWindowResize, { passive: true })
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
        document.addEventListener('visibilitychange', handleDocumentVisibilityChange, { passive: true })
      }
    }
    startWatchdog()
    scheduleReconcile()
  })

  onDeactivated(() => {
    deactivated = true
    stopWatchdog()
    clearWatchdogStartTimer()
    detachScrollCapture()
    // 失活即取消已排队的单次 reconcile——隐藏表不该再跑一次滚动自愈
    if (reconcileRafId != null) {
      cancelAnimationFrame(reconcileRafId)
      reconcileRafId = null
    }
    // 失活即摘全局监听：隐藏表不再响应 resize/visibilitychange，避免写隐藏 DOM 与 rAF 空转
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleWindowResize)
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
    }
  })

  onBeforeUnmount(() => {
    stopWatchdog()
    clearWatchdogStartTimer()
    detachScrollCapture()
    if (reconcileRafId != null) {
      cancelAnimationFrame(reconcileRafId)
      reconcileRafId = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleWindowResize)
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
    }
  })

  return {
    scrollTop,
    scrollLeft,
    trackScrollPosition,
    scheduleReconcile,
  }
}
