import type { DragLocator } from '../types/drag-locator'
import { createDropIndicator } from './row-drag-utils'

/**
 * <zh/> 拖拽指示器与视觉反馈管理器
 *
 * <zh/> 从 use-row-drag.ts 抽取，职责单一化：
 * <zh/> - 插入指示线的创建、定位、移除（suppressMoveWhenRowDragging 模式）
 * <zh/> - 拖拽目标行高亮管理（drop-target / invalid-drop 类）
 * <zh/> - 所有拖拽相关样式类的清理
 *
 * <en/> Drag indicator and visual feedback manager
 *
 * <en/> Extracted from use-row-drag.ts, single responsibility:
 * <en/> - Insert indicator line creation, positioning, removal (suppressMoveWhenRowDragging mode)
 * <en/> - Drag target row highlighting management (drop-target / invalid-drop classes)
 * <en/> - Cleanup of all drag-related style classes
 */
export interface DragIndicatorManager {
  /** <zh/> 将指示线定位到目标行的上方或下方 | <en/> Position the indicator above or below the target row */
  positionIndicator: (targetRow: HTMLElement, position: 'before' | 'after', invalid: boolean) => void
  /** <zh/> 隐藏并移除指示线 | <en/> Hide and remove the indicator */
  removeIndicator: () => void
  /** <zh/> 清除拖拽目标行高亮（drop-target 类 + invalid-drop 类） | <en/> Clear drop target row highlighting (drop-target class + invalid-drop class) */
  clearDropTarget: () => void
  /** <zh/> 清除无效放置行样式 | <en/> Clear invalid-drop row style */
  clearInvalidDropClass: () => void
  /** <zh/> 清除所有拖拽相关样式类 | <en/> Clear all drag-related style classes */
  clearAllDragClasses: () => void
  /** <zh/> 设置拖拽目标行高亮（清除前一个 + 添加 drop-target 类） | <en/> Set drop target row highlighting (clear previous + add drop-target class) */
  setDropTarget: (row: HTMLElement) => void
  /** <zh/> 仅跟踪目标行引用（不加类），用于 suppressMove 模式 | <en/> Track target row reference without adding class, for suppressMove mode */
  trackTarget: (row: HTMLElement) => void
}

/**
 * <zh/> 创建拖拽指示器与视觉反馈管理器
 *
 * <zh/> 封装拖拽指示器的内部状态（indicatorEl / lastDropTarget / indicatorInvalid）
 * <zh/> 与操作方法（positionIndicator / removeIndicator / clearDropTarget / clearAllDragClasses）。
 *
 * <en/> Create drag indicator and visual feedback manager
 *
 * <en/> Encapsulates drag indicator internal state (indicatorEl / lastDropTarget / indicatorInvalid)
 * <en/> and operations (positionIndicator / removeIndicator / clearDropTarget / clearAllDragClasses).
 *
 * @param getDragLocator - <zh/> 获取拖拽定位器的函数 | <en/> Function to get the drag locator
 * @param getRowContainer - <zh/> 获取行容器 DOM 的函数 | <en/> Function to get the row container DOM
 * @returns <zh/> 拖拽指示器管理器 | <en/> drag indicator manager
 */
export function createDragIndicatorManager(
  getDragLocator: () => DragLocator,
  getRowContainer: () => HTMLElement | null,
): DragIndicatorManager {
  /** <zh/> 指示线 DOM 元素 | <en/> Indicator line DOM element */
  let indicatorEl: HTMLElement | null = null
  /** <zh/> 当前指示线是否标记为无效放置 | <en/> Whether the current indicator line marks an invalid drop */
  let indicatorInvalid = false
  /** <zh/> 当前高亮的放置目标行 | <en/> Currently highlighted drop target row */
  let lastDropTarget: HTMLElement | null = null

  /**
   * <zh/> 将指示线定位到目标行的上方或下方
   * <en/> Position the indicator above or below the target row
   */
  function positionIndicator(targetRow: HTMLElement, position: 'before' | 'after', invalid: boolean): void {
    const dragLoc = getDragLocator()
    const indicatorContainer = dragLoc.getInsertIndicatorContainer?.()
    if (!indicatorContainer)
      return

    if (!indicatorEl) {
      indicatorEl = createDropIndicator()
    }

    // 确保容器有定位上下文 | Ensure the container has a positioning context
    const containerStyle = getComputedStyle(indicatorContainer)
    if (containerStyle.position === 'static') {
      indicatorContainer.style.position = 'relative'
    }

    if (!indicatorEl.parentElement) {
      indicatorContainer.appendChild(indicatorEl)
    }

    // 计算指示线位置：相对于 indicatorContainer | Calculate indicator line position: relative to indicatorContainer
    const containerRect = indicatorContainer.getBoundingClientRect()
    const rowRect = targetRow.getBoundingClientRect()

    const top = position === 'before'
      ? rowRect.top - containerRect.top
      : rowRect.bottom - containerRect.top

    indicatorEl.style.top = `${top}px`
    indicatorEl.style.width = `${rowRect.width}px`

    if (invalid !== indicatorInvalid) {
      indicatorEl.classList.toggle('adv-table-row-drop-indicator--invalid', invalid)
      indicatorInvalid = invalid
    }
  }

  /**
   * <zh/> 隐藏并移除指示线
   * <en/> Hide and remove the indicator
   */
  function removeIndicator(): void {
    if (indicatorEl?.parentElement) {
      indicatorEl.parentElement.removeChild(indicatorEl)
    }
    indicatorEl = null
    indicatorInvalid = false
  }

  /**
   * <zh/> 清除无效放置行样式
   * <en/> Clear invalid-drop row style
   */
  function clearInvalidDropClass(): void {
    const rowContainer = getRowContainer()
    if (rowContainer) {
      rowContainer.querySelectorAll('.adv-table__row--invalid-drop').forEach((el) => {
        el.classList.remove('adv-table__row--invalid-drop')
      })
    }
  }

  /**
   * <zh/> 清除拖拽目标行高亮
   * <en/> Clear drop target row highlighting
   */
  function clearDropTarget(): void {
    if (lastDropTarget) {
      lastDropTarget.classList.remove('adv-table__row--drop-target')
      lastDropTarget = null
    }
    clearInvalidDropClass()
  }

  /**
   * <zh/> 设置拖拽目标行高亮
   * <en/> Set drop target row highlighting
   */
  function setDropTarget(row: HTMLElement): void {
    clearDropTarget()
    row.classList.add('adv-table__row--drop-target')
    lastDropTarget = row
  }

  /**
   * <zh/> 仅跟踪目标行引用（不加类），用于 suppressMove 模式
   * <en/> Track target row reference without adding class, for suppressMove mode
   */
  function trackTarget(row: HTMLElement): void {
    lastDropTarget = row
  }

  /**
   * <zh/> 清除所有拖拽相关样式类
   * <en/> Clear all drag-related style classes
   */
  function clearAllDragClasses(): void {
    const rowContainer = getRowContainer()
    if (rowContainer) {
      rowContainer.querySelectorAll('.adv-table__row--no-drop, .adv-table__row--drop-target, .adv-table__row--chosen, .adv-table__row--drag, .adv-table__row--invalid-drop').forEach((el) => {
        el.classList.remove('adv-table__row--no-drop', 'adv-table__row--drop-target', 'adv-table__row--chosen', 'adv-table__row--drag', 'adv-table__row--invalid-drop')
      })
    }
  }

  return {
    positionIndicator,
    removeIndicator,
    clearDropTarget,
    clearInvalidDropClass,
    clearAllDragClasses,
    setDropTarget,
    trackTarget,
  }
}
