/**
 * @file use-header-style-reconcile.ts
 * @description
 * <zh/> 合并表头样式失步自愈（与 `use-scroll-reconcile` 同机制的表头协调域）。
 *
 * <zh/> **职责**：追踪列签名/容器尺寸/数据引用；事件驱动 + 500ms 有限帧看门狗检测并
 * <zh/> 自愈合并/分组表头 DOM 几何与期望几何的失步；管理全部触发源及其 rAF/定时器
 * <zh/> 资源的完整生命周期清理。DOM 执行层见 `utils/header-style-heal.ts`。
 *
 * <zh/> **失步表现**：分组头宽度 ≠ 其叶子和、表头格与同列首行体格像素错位（>1px 即
 * <zh/> 边框/底色可见错位），列拖拽/折叠/弹层关闭后偶发，任意一次重渲染即恢复。
 * <en/> Merged-header style desync self-healing (the header-reconcile domain sharing the
 * <en/> `use-scroll-reconcile` mechanism).
 *
 * <en/> **Responsibilities**: track the column signature / container size / data reference;
 * <en/> detect and heal divergence between merged/grouped header DOM geometry and the
 * <en/> expected geometry via event-driven scheduling plus a 500ms limited-frame watchdog;
 * <en/> own every trigger source plus full lifecycle cleanup of their rAF/timer resources.
 * <en/> The DOM execution layer lives in `utils/header-style-heal.ts`.
 *
 * <en/> **Desync symptoms**: group width ≠ sum of its leaves, header cell vs first body cell
 * <en/> pixel drift (>1px shows as border/background seams), occasionally after column
 * <en/> resize/collapse/overlay close; any re-render heals it.
 *
 * @remarks
 * <zh/> 与滚动自愈同哲学：自愈走 DOM 直接回写（以体格实测为准回写表头），不经过 EP
 * <zh/> 状态——EP 的表头宽度派生自内部布局，程序化回写会被 early-return 或下一次布局
 * <zh/> 覆盖，直接写 DOM 后 EP 的后续布局读到已对齐的位置，不再触发多余重渲染。
 * <zh/> 虚拟模式全量自愈（表头宽度归我们所有）；default 模式仅做叶子对齐 + 缺失类回填，
 * <zh/> 分组头宽度归 EP 表格布局所有，不直接写（dev 告警提示），避免与 EP 布局打架。
 * <en/> Same philosophy as scroll healing: healing writes the DOM directly (headers rewritten
 * <en/> from measured body cells), bypassing EP state — EP derives header widths from its
 * <en/> internal layout, so programmatic rewrites get early-returned or overwritten by the next
 * <en/> layout, while a direct DOM write reads back aligned with no extra render. Virtual mode
 * <en/> heals fully (header widths are owned); default mode heals leaves plus missing-class
 * <en/> backfill only — group widths belong to EP's table layout and are never written (dev
 * <en/> warns instead), so healing never fights EP's layout.
 */
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, toValue, watch } from 'vue'
import { healHeaderSection } from '../../utils/header-style-heal'

/**
 * <zh/> 表头样式协调所需选项 | <en/> Options for header-style reconciliation
 */
export interface UseHeaderStyleReconcileOptions {
  /** <zh/> 表格根元素 getter（ElTable / ElTableV2 的 $el） | <en/> Table root element getter (ElTable / ElTableV2 $el) */
  rootEl: () => HTMLElement | null
  /**
   * <zh/> 当前模式 DOM 适配器——表头/表体/行选择器经其解析（命名空间化），缺 dom 时跳过检测
   * <en/> Current-mode DOM adapter — header/body/row selectors resolved through it (namespace-aware); detection skipped without it
   */
  dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
  /** <zh/> 分组头宽度归属（能力语义，替代模式判断：为 true 时分组头宽度归我们所有，可直接自愈） | <en/> Group-header width ownership (capability, not a mode check: when true group widths are owned and directly healable) */
  ownsGroupHeaderWidths: () => boolean
  /**
   * <zh/> 列签名 getter——列增删/宽度/折叠变化后布局可能失步。必须返回原始签名
   * <zh/> （如 `key:width` 拼接串），每次求值返回新引用会导致 watch 常驻触发
   * <en/> Column signature getter — layout may desync after column add/remove/width/collapse changes. Must return a primitive signature
   * <en/> (e.g. a `key:width` joined string); a fresh reference per evaluation keeps the watcher firing forever
   */
  columnsVersion: () => unknown
  /** <zh/> 数据引用 getter——loading→数据、翻页等引用变化后布局可能失步 | <en/> Data reference getter — layout may desync after reference changes (loading→data, pagination) */
  data: () => unknown[]
  /** <zh/> 容器实测宽度（ResizeObserver） | <en/> Measured container width (ResizeObserver) */
  measuredWidth: Ref<number>
  /** <zh/> 容器实测高度（ResizeObserver） | <en/> Measured container height (ResizeObserver) */
  measuredHeight: Ref<number>
  /**
   * <zh/> 低性能档——为 true 时看门狗（500ms rAF 检测序列）不再启动，仅保留单次 reconcile
   * <en/> Low performance tier — when true the watchdog (500ms rAF sequence) never starts; single-shot reconcile remains
   */
  skipWatchdog?: () => boolean
}

/**
 * <zh/> 表头样式协调 API | <en/> Header-style reconcile API
 */
export interface HeaderStyleReconcileApi {
  /**
   * <zh/> 手动触发一次表头样式检测（rAF 合并调度），供自动检测窗口之外的场景使用
   * <en/> Manually schedule one header-style check (rAF-coalesced) for scenarios outside the automatic detection window
   */
  scheduleReconcile: () => void
}

/** <zh/> 看门狗检测窗口（ms）——与 use-scroll-reconcile 同值，基于 performance.now | <en/> Watchdog window (ms) — same as use-scroll-reconcile, via performance.now */
const WATCHDOG_DURATION = 500
/** <zh/> 尺寸驱动的看门狗启动防抖（ms）——与 use-scroll-reconcile 同值 | <en/> Debounce for size-driven watchdog start (ms) — same as use-scroll-reconcile */
const WATCHDOG_RESTART_DEBOUNCE = 120
/** <zh/> 列宽拖拽进行中标记——拖拽期间表头宽度瞬态，不检测不自愈 | <en/> Column-resize-in-progress marker — widths are transient mid-drag, neither detect nor heal */
const RESIZING_BODY_CLASS = 'adv-table-resizing'

/**
 * <zh/> 创建合并表头样式协调器。所有 window/document 监听、rAF 循环与定时器
 * <zh/> 均在本 composable 内注册并在卸载/停用时完整清理。
 * <en/> Create the merged-header style reconciler. Every window/document listener, rAF loop and
 * <en/> timer is registered here and fully cleaned up on unmount/deactivation.
 */
export function useHeaderStyleReconcile(options: UseHeaderStyleReconcileOptions): HeaderStyleReconcileApi {
  const { rootEl, ownsGroupHeaderWidths, columnsVersion, data, measuredWidth, measuredHeight, skipWatchdog = () => false } = options

  let deactivated = false
  let reconcileRafId: number | null = null
  let watchdogRafId: number | null = null
  let watchdogStartTime = 0
  let watchdogStartTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleReconcile(): void {
    if (deactivated)
      return
    if (reconcileRafId != null)
      return
    if (typeof requestAnimationFrame === 'undefined')
      return
    reconcileRafId = requestAnimationFrame(() => {
      reconcileRafId = null
      reconcileHeaderStyles()
    })
  }

  function startWatchdog(): void {
    if (deactivated || skipWatchdog() || typeof requestAnimationFrame === 'undefined')
      return
    watchdogStartTime = performance.now()
    if (watchdogRafId != null)
      return
    const tick = () => {
      watchdogRafId = null
      reconcileHeaderStyles()
      if (performance.now() - watchdogStartTime >= WATCHDOG_DURATION)
        return
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

  function reconcileHeaderStyles(): void {
    if (skipWatchdog())
      return
    if (typeof document === 'undefined')
      return
    // <zh/> 列宽拖拽中表头宽度瞬态：读数为过程值而非失步，检测与自愈一并暂停
    // <en/> Mid-column-resize widths are transient: readings are intermediate values, not desync; detection and healing pause together
    if (document.body.classList.contains(RESIZING_BODY_CLASS))
      return
    const root = rootEl()
    if (!root)
      return
    const dom = toValue(options.dom)
    if (!dom)
      return
    let headerContainers: HTMLElement[]
    try {
      headerContainers = Array.from(root.querySelectorAll<HTMLElement>(dom.getHeaderSelector()))
    }
    catch {
      return
    }
    if (headerContainers.length === 0)
      return
    const healPlaceholders = ownsGroupHeaderWidths()
    // <zh/> 按 header 容器去重（选择器在嵌套结构下可能重复命中同一容器），单区失败不阻断其余分区
    // <en/> Dedup by header container (the selector may hit the same container twice in nested structures); one section failing never blocks the rest
    for (const container of new Set(headerContainers)) {
      try {
        healHeaderSection(root, container, dom, healPlaceholders)
      }
      catch {
        // <zh/> 隐藏分区读数异常时仍继续 | <en/> Continue even when a hidden section reads abnormally
      }
    }
  }

  function handleDocumentVisibilityChange(): void {
    if (!document.hidden) {
      scheduleReconcile()
      startWatchdog()
    }
  }

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

  function handleWindowResize(): void {
    scheduleReconcile()
    startWatchdog()
  }

  watch([measuredWidth, measuredHeight], () => {
    scheduleReconcile()
    scheduleWatchdogRestart()
  })

  watch([columnsVersion, data], () => {
    scheduleReconcile()
    startWatchdog()
  })

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleWindowResize, { passive: true })
      if (typeof document !== 'undefined')
        document.addEventListener('visibilitychange', handleDocumentVisibilityChange, { passive: true })
    }
    startWatchdog()
  })

  onActivated(() => {
    deactivated = false
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

  onBeforeUnmount(() => {
    stopWatchdog()
    clearWatchdogStartTimer()
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

  return { scheduleReconcile }
}
