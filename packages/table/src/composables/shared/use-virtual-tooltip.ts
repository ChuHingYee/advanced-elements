/**
 * <zh/> 虚拟触发 tooltip 基类 composable
 *
 * <zh/> 管理单个 ElTooltip 实例的可见性、触发元素与延迟计时器。
 * <zh/> 被 {@linkcode useOverflowTooltip} 和 {@linkcode useSharedHeaderTooltip} 复用，
 * <zh/> 消除两者在状态管理、计时器、生命周期清理上的重复代码。
 *
 * <en/> Virtual-trigger tooltip base composable
 *
 * <en/> Manages visibility, trigger element, and delay timers for a single ElTooltip instance.
 * <en/> Reused by {@linkcode useOverflowTooltip} and {@linkcode useSharedHeaderTooltip},
 * <en/> eliminating duplication in state management, timers, and lifecycle cleanup.
 *
 * @remarks
 * <zh/> 子 composable 通过 `onHide` 回调注入自身清理逻辑（如溢出 tooltip 的 MutationObserver 断开、formatterVNode 清空）。
 * <zh/> 基类统一处理 `onBeforeUnmount` / `onDeactivated` 时的 forceHide，确保计时器与子清理均被触发。
 *
 * <en/> Sub-composables inject their own cleanup logic via the `onHide` callback
 * <en/> (e.g., overflow tooltip's MutationObserver disconnect, formatterVNode clearing).
 * <en/> The base handles `onBeforeUnmount` / `onDeactivated` forceHide, ensuring both timers and sub-cleanup are triggered.
 */
import type { Ref, ShallowRef } from 'vue'
import { onBeforeUnmount, onDeactivated, ref, shallowRef } from 'vue'

export interface UseVirtualTooltipOptions {
  /** <zh/> 表格容器是否可见（v-show / keep-alive deactivated / display:none 时为 false） | <en/> Whether the table container is visible */
  containerVisible?: () => boolean
  /**
   * <zh/> tooltip 隐藏时的回调——子 composable 注入额外清理逻辑
   * <en/> Callback when tooltip is hidden — sub-composables inject extra cleanup logic
   */
  onHide?: () => void
  /** <zh/> Tooltip 显示延迟（ms），默认 300 | <en/> Tooltip show delay (ms), default 300 */
  showAfter?: number
  /** <zh/> Tooltip 隐藏延迟（ms），默认 150 | <en/> Tooltip hide delay (ms), default 150 */
  hideDelay?: number
}

/** <zh/> 虚拟触发 tooltip 基类返回值 | <en/> Virtual-trigger tooltip base return */
export interface UseVirtualTooltipReturn {
  visible: Ref<boolean>
  content: Ref<string>
  triggerEl: ShallowRef<HTMLElement | null>
  /** <zh/> 清除所有计时器（show + hide） | <en/> Clear all timers (show + hide) */
  clearTimers: () => void
  /** <zh/> 立即隐藏并触发 onHide 清理 | <en/> Immediately hide and trigger onHide cleanup */
  hide: () => void
  /** <zh/> 强制隐藏（等同 hide，语义化别名） | <en/> Force hide (alias of hide, semantic) */
  forceHide: () => void
  /**
   * <zh/> 调度延迟显示——清除所有待处理计时器后设置 show 计时器
   * <en/> Schedule a delayed show — clears all pending timers then sets show timer
   * @param callback - <zh/> 延迟到达后执行（由子 composable 设置 triggerEl/content/visible 等） | <en/> Executed after delay (sub-composable sets triggerEl/content/visible etc.)
   */
  scheduleShow: (callback: () => void) => void
  /** <zh/> 调度延迟隐藏——清除所有待处理计时器后设置 hide 计时器 | <en/> Schedule a delayed hide — clears all pending timers then sets hide timer */
  scheduleHide: () => void
  /** <zh/> 容器是否可见（未配置时恒为 true） | <en/> Whether container is visible (always true if unconfigured) */
  isContainerVisible: () => boolean
}

/**
 * <zh/> 虚拟触发 tooltip 基类
 *
 * <en/> Virtual-trigger tooltip base
 */
export function useVirtualTooltip(options: UseVirtualTooltipOptions = {}): UseVirtualTooltipReturn {
  const visible = ref(false)
  const content = ref('')
  const triggerEl = shallowRef<HTMLElement | null>(null)

  const HIDE_DELAY = options.hideDelay ?? 150
  const SHOW_AFTER = options.showAfter ?? 300

  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let showTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimers() {
    if (hideTimer != null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    if (showTimer != null) {
      clearTimeout(showTimer)
      showTimer = null
    }
  }

  function hide() {
    clearTimers()
    visible.value = false
    triggerEl.value = null
    options.onHide?.()
  }

  function forceHide() {
    hide()
  }

  function scheduleShow(callback: () => void) {
    clearTimers()
    showTimer = setTimeout(() => {
      showTimer = null
      callback()
    }, SHOW_AFTER)
  }

  function scheduleHide() {
    clearTimers()
    hideTimer = setTimeout(hide, HIDE_DELAY)
  }

  function isContainerVisible() {
    return options.containerVisible?.() ?? true
  }

  onBeforeUnmount(() => {
    forceHide()
  })

  onDeactivated(() => {
    forceHide()
  })

  return {
    visible,
    content,
    triggerEl,
    clearTimers,
    hide,
    forceHide,
    scheduleShow,
    scheduleHide,
    isContainerVisible,
  }
}
