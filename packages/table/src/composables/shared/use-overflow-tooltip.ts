import type { InjectionKey, VNode } from 'vue'
import { computed, ref, shallowRef } from 'vue'
import { useVirtualTooltip } from './use-virtual-tooltip'

function isCellOverflow(el: HTMLElement | null): boolean {
  if (!el)
    return false
  return el.scrollWidth > Math.ceil(el.clientWidth)
}

/** <zh/> tooltipFormatter 函数签名 | <en/> Tooltip formatter function signature */
export type TooltipFormatter = (data: { row: any, column: any, cellValue: any }) => VNode | string

export interface CellEnterContext {
  /** <zh/> 行数据 | <en/> Row data */
  row?: any
  /** <zh/> 列配置 | <en/> Column config */
  column?: any
  /** <zh/> 单元格值 | <en/> Cell value */
  cellValue?: any
  /** <zh/> 列级别 tooltipFormatter，优先于表级别 | <en/> Column-level tooltipFormatter, takes priority over table-level */
  tooltipFormatter?: TooltipFormatter
}

export interface OverflowTooltipApi {
  /** <zh/> 单元格 mouseenter 时调用，检测溢出并激活共享 tooltip | <en/> Called on cell mouseenter, detects overflow and activates shared tooltip */
  onCellEnter: (el: HTMLElement, disabled: boolean, ctx?: CellEnterContext) => void
  /** <zh/> 单元格 mouseleave 时调用，延迟隐藏 tooltip | <en/> Called on cell mouseleave, delayed hide of tooltip */
  onCellLeave: () => void
  /** <zh/> 强制隐藏 tooltip — 编辑开始 / 组件 deactivated / mode 切换时调用 | <en/> Force hide tooltip — called on edit start / component deactivated / mode switch */
  forceHide: () => void
}

/**
 * 溢出提示 API 的 provide/inject key
 */
export const advOverflowTooltipKey: InjectionKey<OverflowTooltipApi> = Symbol('advOverflowTooltip')

export interface UseOverflowTooltipOptions {
  containerVisible?: () => boolean
  /** 溢出 tooltip 的 effect 主题 */
  tooltipEffect?: () => string | undefined
  /** 溢出 tooltip 的自定义选项 */
  tooltipOptions?: () => Record<string, any> | undefined
  /** 表级别 tooltipFormatter，列级别未设置时使用 */
  tooltipFormatter?: () => TooltipFormatter | undefined
}

/**
 * 溢出提示 Composable——整个表格只维护 1 个 ElTooltip 实例，
 * 通过虚拟触发 + 事件委托检测单元格内容溢出。
 *
 * @remarks
 * <zh/> 基于 {@linkcode useVirtualTooltip} 基类，扩展溢出检测、formatter VNode、MutationObserver 锚点存活检测。
 * <en/> Built on the {@linkcode useVirtualTooltip} base, extending with overflow detection, formatter VNode, and MutationObserver anchor-alive detection.
 *
 * @param options - 配置选项
 * @returns onCellEnter/onCellLeave（溢出检测）、provideOverflowTooltip（注入）、tooltipProps（传给 ElTooltip 的属性）
 */
export function useOverflowTooltip(options: UseOverflowTooltipOptions = {}) {
  /** <zh/> 溢出 tooltip 专属状态：disabled 标志与 formatter VNode | <en/> Overflow-tooltip-specific state: disabled flag and formatter VNode */
  const tooltipDisabled = ref(true)
  /** formatter 返回的 VNode，用于 ElTooltip 默认插槽渲染 */
  const formatterVNode = shallowRef<VNode | null>(null)

  // ── 锚点存活检测：虚拟滚动回收、数据刷新、列显隐切换等场景下，目标单元格可能被 DOM 移除 ──
  // ── Anchor-alive detection: target cell may be removed by DOM during virtual scroll recycling, data refresh, column toggle, etc. ──
  //
  // 使用 MutationObserver 监听 DOM 子树变化，替代 setInterval 轮询，
  // 在元素被移除时立即响应且不产生空闲 CPU 开销。
  //
  // 观察范围：锚元素最近的表格容器祖先（el-table__body-wrapper / el-table-v2__main），
  // 而非 document.body——避免监听整页 DOM 变化（其他组件更新、动画等）导致的高频回调。
  let anchorObserver: MutationObserver | null = null

  function stopAnchorAlivePolling() {
    if (anchorObserver) {
      anchorObserver.disconnect()
      anchorObserver = null
    }
  }

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
    /** <zh/> onHide 回调：清理溢出 tooltip 专属状态 | <en/> onHide callback: cleanup overflow-tooltip-specific state */
    onHide: () => {
      tooltipDisabled.value = true
      formatterVNode.value = null
      stopAnchorAlivePolling()
    },
  })

  function startAnchorAlivePolling() {
    const el = triggerEl.value
    if (!el || !el.parentNode)
      return
    if (anchorObserver)
      return

    anchorObserver = new MutationObserver(() => {
      if (!el.isConnected) {
        hide()
        stopAnchorAlivePolling()
      }
    })

    // 优先观察表格根容器（自有类名，与模式/命名空间无关，含所有行/单元格的稳定祖先），
    // fallback 到 el.parentElement（仍比 document.body 范围小得多）。
    // Observe the table root (owned class, mode/namespace-agnostic) first,
    // falling back to el.parentElement (still far narrower than document.body).
    // <zh/> 注意：此处不用 EP 内部类名——根类名由本组件持有，EP 升级/自定义命名空间下仍然命中
    // <en/> Note: no EP-internal class names here — the root class is owned by this component, so it still matches under EP upgrades and custom namespaces
    const tableBody = el.closest('.adv-table')
    const target = tableBody || el.parentElement || document.body
    anchorObserver.observe(target, {
      childList: true,
      subtree: true,
    })
  }

  function onCellEnter(el: HTMLElement, disabled: boolean, ctx?: CellEnterContext) {
    /** <zh/> 容器不可见 / 禁用 / 无溢出时直接隐藏 | <en/> Hide directly when the container is invisible, disabled, or the cell has no overflow */
    if (!isContainerVisible() || disabled || !isCellOverflow(el)) {
      hide()
      return
    }

    // 列级别 formatter 优先，否则使用表级别 formatter
    const formatter = ctx?.tooltipFormatter ?? options.tooltipFormatter?.()
    const cellContent = formatter
      ? formatter({ row: ctx?.row, column: ctx?.column, cellValue: ctx?.cellValue })
      : (el.textContent ?? '')

    scheduleShow(() => {
      triggerEl.value = el
      if (typeof cellContent === 'string') {
        content.value = cellContent
        formatterVNode.value = null
      }
      else {
        content.value = ''
        formatterVNode.value = cellContent
      }
      tooltipDisabled.value = false
      visible.value = true
      startAnchorAlivePolling()
    })
  }

  function onCellLeave() {
    scheduleHide()
  }

  const api: OverflowTooltipApi = { onCellEnter, onCellLeave, forceHide }

  const tooltipProps = computed(() => {
    /** 容器不可见时强制 disabled + hidden，防止 v-show / keep-alive deactivated 残留 */
    const containerHidden = !isContainerVisible()
    const effect = options.tooltipEffect?.() ?? 'dark'
    const customOptions = options.tooltipOptions?.() ?? {}
    return {
      ...customOptions,
      effect,
      content: content.value,
      placement: (customOptions.placement as 'top' | 'bottom' | 'left' | 'right' | undefined) ?? 'top' as const,
      disabled: tooltipDisabled.value || containerHidden,
      virtualTriggering: true,
      virtualRef: triggerEl.value ?? undefined,
      visible: visible.value && !containerHidden,
    }
  })

  return {
    onCellEnter,
    onCellLeave,
    api,
    tooltipProps,
    formatterVNode,
    forceHide,
  }
}
