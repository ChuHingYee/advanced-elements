/**
 * <zh/> 共享表头提示 Composable
 * <en/> Shared header tooltip composable
 *
 * @remarks
 * <zh/> 将原本每列一个 ElTooltip 的表头提示（col.tooltip），收敛为整个表格仅维护 1 个 ElTooltip 实例
 * <en/> Consolidates per-column ElTooltip header tooltips (col.tooltip) into a single ElTooltip instance for the entire table
 *
 * <zh/> 通过 virtualTriggering + virtualRef 复用 EP 原生 Popper 定位机制，鼠标 hover 表头时动态切换 tooltip 内容和触发元素
 * <en/> Uses virtualTriggering + virtualRef to reuse EP's native Popper positioning mechanism, dynamically switching tooltip content and trigger element on header hover
 *
 * <zh/> 性能收益：N 列有 col.tooltip → 从 N 个 ElTooltip 降为 1 个
 * <en/> Performance benefit: N columns with col.tooltip → from N ElTooltips down to 1
 *
 * <zh/>
 * - 基于 {@linkcode useVirtualTooltip} 基类，但不需要溢出检测——col.tooltip 设置即始终显示
 * - 使用 show-after 延迟（300ms）避免鼠标快速划过时频繁触发
 * - 支持容器不可见 / KeepAlive deactivated 时自动隐藏
 *
 * <en/>
 * - Built on the {@linkcode useVirtualTooltip} base, but doesn't need overflow detection — col.tooltip is always shown when set
 * - Uses show-after delay (300ms) to avoid frequent triggering on fast mouse movements
 * - Supports auto-hide when container is invisible / KeepAlive deactivated
 */
import type { ComputedRef } from 'vue'
import { computed, watch } from 'vue'
import { useVirtualTooltip } from './use-virtual-tooltip'

/**
 * <zh/> 共享表头提示 API——通过 provide/inject 提供给 column-renderer。
 * <en/> Shared header tooltip API — provided to column-renderer via provide/inject.
 */
export interface SharedHeaderTooltipApi {
  /**
   * <zh/> 表头 mouseenter 时调用，延迟显示 tooltip
   * @param el - <zh/> 触发元素（表头文本 span） | <en/> trigger element (header text span)
   * @param content - <zh/> tooltip 内容（col.tooltip） | <en/> tooltip content (col.tooltip)
   */
  onHeaderEnter: (el: HTMLElement, content: string) => void
  /** <zh/> 表头 mouseleave 时调用，延迟隐藏 tooltip | <en/> Called on header mouseleave, hides tooltip with delay */
  onHeaderLeave: () => void
}

export interface UseSharedHeaderTooltipOptions {
  /** <zh/> 表格容器是否可见（v-show / keep-alive deactivated / display:none 时为 false） | <en/> Whether the table container is visible (false when v-show / keep-alive deactivated / display:none) */
  containerVisible: () => boolean
}

export interface UseSharedHeaderTooltipReturn {
  onHeaderEnter: (el: HTMLElement, content: string) => void
  onHeaderLeave: () => void
  /** <zh/> 传给 ElTooltip 的响应式 props（含 virtualTriggering + virtualRef） | <en/> Reactive props passed to ElTooltip (includes virtualTriggering + virtualRef) */
  tooltipProps: ComputedRef<Record<string, unknown>>
  /** <zh/> 强制隐藏（deactivated / container hidden 时调用） | <en/> Force hide (called when deactivated / container hidden) */
  forceHide: () => void
}

/**
 * <zh/> 共享表头提示组合式函数
 *
 * 管理 1 个 ElTooltip 的可见性、内容和触发元素，
 * 处理 show-after 延迟、hide 延迟、容器隐藏等生命周期。
 *
 * @param options - <zh/> 配置选项 | <en/> configuration options
 * @returns <zh/> 表头提示 API + tooltip props | <en/> header tooltip API + tooltip props
 * @example
 * ```ts
 * const sharedHeaderTooltip = useSharedHeaderTooltip({
 *   containerVisible:  => isContainerVisible.value,
 * })
 * // 在模板中：
 * // <ElTooltip v-bind="sharedHeaderTooltip.tooltipProps.value" />
 * ```
 */
export function useSharedHeaderTooltip(options: UseSharedHeaderTooltipOptions): UseSharedHeaderTooltipReturn {
  // ── 基类：状态 + 计时器 + 生命周期 ──
  // ── Base: state + timers + lifecycle ──
  const {
    visible,
    content,
    triggerEl,
    hide,
    forceHide,
    scheduleShow,
    scheduleHide,
    isContainerVisible,
  } = useVirtualTooltip({
    containerVisible: options.containerVisible,
  })

  function onHeaderEnter(el: HTMLElement, tooltipContent: string) {
    if (!isContainerVisible()) {
      hide()
      return
    }
    /**
     * <zh/> 锚点存活检测：记录进入时元素的连接状态，延迟回调触发时仅检测"从已连接变为断开"
     * <zh/> 的情况（虚拟滚动回收 / 列折叠移除），不阻断从未连接的元素（如测试环境）
     * <en/> Anchor survival check: record connection state on enter, only detect "was connected → now disconnected"
     * <en/> (virtual scroll recycling / column collapse) in the delay callback, don't block elements that were never connected (e.g., test env)
     */
    const wasConnected = el.isConnected
    scheduleShow(() => {
      if (wasConnected && !el.isConnected) {
        hide()
        return
      }
      triggerEl.value = el
      content.value = tooltipContent
      visible.value = true
    })
  }

  function onHeaderLeave() {
    scheduleHide()
  }

  const tooltipProps = computed(() => {
    return {
      content: content.value,
      placement: 'top' as const,
      effect: 'light' as const,
      virtualTriggering: true,
      virtualRef: triggerEl.value ?? undefined,
      visible: visible.value,
      disabled: !visible.value,
    }
  })

  watch(() => options.containerVisible(), (isVisible) => {
    if (!isVisible)
      hide()
  })

  return {
    onHeaderEnter,
    onHeaderLeave,
    tooltipProps,
    forceHide,
  }
}
