import type { Ref } from 'vue'
import { ref } from 'vue'
import { clampMinWidth } from '../../constants'

/**
 * <zh/> 列宽拖拽代理线依赖——调用方持有的代理元素引用
 * <en/> Column-resize proxy deps — proxy element ref owned by the caller
 */
export interface UseColumnResizeProxyOptions {
  /** <zh/> 代理线元素引用 | <en/> Proxy line element ref */
  resizeProxyRef?: Ref<HTMLElement | undefined | null>
}

/**
 * <zh/> 列宽拖拽代理线状态
 *
 * <zh/> 职责单一：仅拥有拖拽会话的视觉状态（resizing / proxy 可见性 / 拖拽列 key / 会话快照）
 * <zh/> 与代理线 DOM 操作（定位/钳制/最小宽度警告/全局 cursor 与 body class 清理）。
 * <zh/> 宽度提交（columnWidths 写入 / onHeaderDragend）仍归主 composable，避免双源。
 *
 * <en/> Column-resize proxy state.
 *
 * <en/> Single responsibility: owns only the drag session's visual state (resizing / proxy visibility /
 * <en/> dragging key / session snapshot) and proxy DOM ops (position/clamp/min-width warning/global cursor
 * <en/> and body-class cleanup). Width commit stays in the main composable to avoid dual sources.
 */
export interface ResizeProxySession {
  /** <zh/> 目标列 key | <en/> Target column key */
  columnKey: string
  /** <zh/> 拖拽起始 clientX | <en/> Drag start clientX */
  startX: number
  /** <zh/> 起始宽度 | <en/> Start width */
  startWidth: number
  /** <zh/> 列左边缘（相对表格） | <en/> Column left edge (relative to table) */
  startColumnLeft: number
  /** <zh/> 表格左边缘 | <en/> Table left edge */
  tableLeft: number
  /** <zh/> 代理线最小左界 | <en/> Proxy min left bound */
  minLeft: number
}

/**
 * <zh/> 列宽拖拽代理线 composable——管理拖拽会话视觉状态与代理线 DOM 定位/清理。
 * <en/> Column-resize proxy composable — owns the drag session visual state and proxy line DOM positioning/cleanup.
 *
 * @param options - <zh/> 配置项（代理线元素引用） | <en/> Options (proxy line element ref)
 * @returns <zh/> 拖拽状态、会话快照与代理线操作方法集 | <en/> Drag state, session accessor and proxy line operation methods
 */
export function useColumnResizeProxy(options: UseColumnResizeProxyOptions = {}) {
  const { resizeProxyRef } = options

  const resizing = ref(false)
  const resizeProxyVisible = ref(false)
  const draggingColumnKey = ref<string | null>(null)

  let resizeState: ResizeProxySession | null = null

  /**
   * <zh/> 设置 document.body cursor，相同值跳过以避免重排 | <en/> Set document.body cursor, skip identical values to avoid reflow
   *
   * @param cursor - <zh/> CSS cursor 值 | <en/> CSS cursor value
   */
  function setCursor(cursor: string): void {
    if (typeof document === 'undefined')
      return
    if (document.body.style.cursor === cursor)
      return
    document.body.style.cursor = cursor
  }

  /**
   * <zh/> 显示代理线并定位到列右边缘 | <en/> Show the proxy line positioned at the column's right edge
   *
   * @param columnKey - <zh/> 目标列 key | <en/> target column key
   * @param session - <zh/> 会话快照 | <en/> session snapshot
   * @param rightEdge - <zh/> 列右边缘（相对表格） | <en/> column right edge (relative to table)
   */
  function showProxy(columnKey: string, session: ResizeProxySession, rightEdge: number): void {
    resizeState = session
    resizing.value = true
    resizeProxyVisible.value = true
    draggingColumnKey.value = columnKey
    const proxyEl = resizeProxyRef?.value
    if (proxyEl)
      proxyEl.style.left = `${rightEdge}px`
  }

  /**
   * <zh/> 移动代理线（rAF 节流后的单帧处理） | <en/> Move the proxy line (single-frame handling after rAF throttle)
   *
   * @param clientX - <zh/> 当前鼠标 clientX | <en/> current mouse clientX
   */
  function moveProxy(clientX: number): void {
    if (!resizeState)
      return
    const proxyEl = resizeProxyRef?.value
    if (!proxyEl)
      return
    const deltaLeft = clientX - resizeState.startX
    const proxyLeft = resizeState.startColumnLeft + resizeState.startWidth + deltaLeft
    const clampedLeft = Math.max(resizeState.minLeft, proxyLeft)
    proxyEl.style.left = `${clampedLeft}px`
    proxyEl.classList.toggle(
      'adv-table-virtual-renderer__column-resize-proxy--min',
      clampedLeft <= resizeState.minLeft,
    )
  }

  /**
   * <zh/> 读取代理线最终位置并推算新宽度（含三重 NaN 防御，异常回退起始宽度）
   * <en/> Read the proxy final position and derive the new width (triple-NaN guard, falls back to start width)
   *
   * @param minWidth - <zh/> 最小列宽 | <en/> minimum column width
   * @returns <zh/> 会话与新宽度，无会话返回 null | <en/> session with new width, null when no session
   */
  function takeProxyResult(minWidth: number): { session: ResizeProxySession, newWidth: number } | null {
    if (!resizeState)
      return null
    const session = resizeState
    const proxyEl = resizeProxyRef?.value
    let newWidth = session.startWidth
    if (proxyEl) {
      const finalLeft = Number.parseInt(proxyEl.style.left, 10)
      if (
        !Number.isNaN(finalLeft)
        && !Number.isNaN(session.startColumnLeft)
        && Number.isFinite(finalLeft - session.startColumnLeft)
      ) {
        // <zh/> 拖拽下限经 clampMinWidth 唯一出口 | <en/> drag floor via the single clampMinWidth outlet
        newWidth = clampMinWidth(finalLeft - session.startColumnLeft, minWidth)
      }
    }
    return { session, newWidth }
  }

  /**
   * <zh/> 隐藏代理线并清理会话与全局视觉残留 | <en/> Hide the proxy and clear the session plus global visual residue
   */
  function hideProxy(): void {
    resizeState = null
    resizing.value = false
    resizeProxyVisible.value = false
    draggingColumnKey.value = null
    setCursor('')
    const proxyEl = resizeProxyRef?.value
    if (proxyEl)
      proxyEl.classList.remove('adv-table-virtual-renderer__column-resize-proxy--min')
  }

  /**
   * <zh/> 无条件清理全局残留（body class / cursor / 监听由调用方移除）——卸载/失活兜底
   * <en/> Unconditionally clear global residue (body class / cursor; listeners removed by caller) — unmount/deactivate fallback
   */
  function clearGlobalVisual(): void {
    if (typeof document === 'undefined')
      return
    setCursor('')
    document.body.classList.remove('adv-table-resizing', 'adv-table-resizing--col')
  }

  return {
    resizing,
    resizeProxyVisible,
    draggingColumnKey,
    getSession: (): ResizeProxySession | null => resizeState,
    setCursor,
    showProxy,
    moveProxy,
    takeProxyResult,
    hideProxy,
    clearGlobalVisual,
  }
}

/** <zh/> useColumnResizeProxy 返回形状（供类型复用） | <en/> useColumnResizeProxy return shape (for type reuse) */
export type ColumnResizeProxy = ReturnType<typeof useColumnResizeProxy>
