/**
 * <zh/> Hover 行定位共享工具——提取 default 和 virtual 两种渲染器中的公共行定位逻辑
 * <en/> Hover row locator shared utility — extracts common row location logic from both default and virtual renderers
 *
 * @remarks
 * <zh/> 两个渲染器的 locateHoveredRow 实现有 70% 逻辑重复：
 * <zh/> 1. 通过 data-adv-table-row-key 属性查找行元素
 * <zh/> 2. 用 closest 找到行容器
 * <zh/> 3. 计算行 rect 并检查是否在容器可视区域内
 * <zh/> 4. Clamp 定位到容器可视区域
 * <zh/> 差异仅在：容器获取方式、行选择器、未找到行时的回退策略
 *
 * <en/> The two renderers' locateHoveredRow implementations share 70% of the logic:
 * <en/> 1. Find row element via data-adv-table-row-key attribute
 * <en/> 2. Use closest to find the row container
 * <en/> 3. Calculate row rect and check if it's within the container's visible area
 * <en/> 4. Clamp positioning to the container's visible area
 * <en/> Differences only in: container access method, row selector, fallback strategy when row not found
 *
 * <zh/> **本文件不含任何 Element Plus 类名**：所需选择器一律经参数（{@link BodyRectSpec} /
 * <zh/> {@link RowLocateSpec}）传入，由 DOM 适配器供给
 * <zh/> （见 `components/renderer-core/dom-adapter.ts`）。
 * <en/> **No Element Plus class names here**: all required selectors arrive as parameters
 * <en/> ({@link BodyRectSpec} / {@link RowLocateSpec}) supplied by the DOM adapter
 * <en/> (see `components/renderer-core/dom-adapter.ts`).
 */

import type { BodyScrollbarSpec } from '../components/renderer-core/dom-adapter'
import { ADV_TABLE_ROW_KEY_ATTR } from '../constants'
import { rowKeyAttrSelector } from './row-key-attr'

/**
 * <zh/> 行定位结果 | <en/> Row location result
 */
export interface HoveredRowRect {
  /** <zh/> 行顶部坐标（已 clamp 到容器可视区域） | <en/> Row top coordinate (clamped to container visible area) */
  top: number
  /** <zh/> 行高度（已 clamp 到容器可视区域） | <en/> Row height (clamped to container visible area) */
  height: number
  /** <zh/> 容器右边缘坐标 | <en/> Container right edge coordinate */
  containerRight: number
  /** <zh/> 容器左边缘坐标，用于计算 action bar 最大宽度防止溢出 | <en/> Container left edge coordinate, used to calculate action bar max width to prevent overflow */
  containerLeft: number
}

/**
 * <zh/> body 容器 rect 计算规格——body 选择器 + 滚动条选择器组合，均由 DOM 适配器供给。
 * <en/> Spec for computing the body container rect — body selector plus scrollbar selector bundle,
 * <en/> both supplied by the DOM adapter.
 */
export interface BodyRectSpec {
  /** <zh/> body/滚动容器选择器（相对表格根元素） | <en/> body/scroll container selector (relative to the table root) */
  bodySelector: string
  /** <zh/> 滚动条选择器组合 | <en/> scrollbar selector bundle */
  scrollbars: BodyScrollbarSpec
}

/**
 * <zh/> 行反查规格——行元素选择器、行键属性名与 body rect 规格。
 * <en/> Spec for row reverse lookup — row selector, row key attribute and the body rect spec.
 */
export interface RowLocateSpec {
  /** <zh/> 行元素选择器 | <en/> row element selector */
  rowSelector: string
  /** <zh/> 行键数据属性名，默认 `data-adv-table-row-key` | <en/> row key data attribute name, defaults to `data-adv-table-row-key` */
  rowKeyAttr?: string
  /** <zh/> body rect 计算规格 | <en/> body rect spec */
  bodyRect: BodyRectSpec
}

/**
 * <zh/> 缩小矩形右边界 | <en/> Shrink a rect's right edge
 *
 * @param rect - <zh/> 原始矩形 | <en/> original rect
 * @param amount - <zh/> 右边界内缩量（滚动条占位） | <en/> right-edge inset (scrollbar footprint)
 * @returns <zh/> 新的矩形 | <en/> new rect
 */
function shrinkRight(rect: DOMRect, amount: number): DOMRect {
  const adjustedRight = rect.right - amount
  // <zh/> SSR/Node 无 DOMRect 时回退 plain 对象（仅客户端调用，纯函数防呆）| <en/> Plain-object fallback without DOMRect in SSR/Node (client-only caller; defensive for a pure function)
  if (typeof DOMRect === 'undefined') {
    return {
      left: rect.left,
      top: rect.top,
      right: adjustedRight,
      bottom: rect.bottom,
      width: adjustedRight - rect.left,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    } as unknown as DOMRect
  }
  return new DOMRect(rect.left, rect.top, adjustedRight - rect.left, rect.height)
}

/**
 * <zh/> 获取表格 body/scroll 容器的 rect——用于 clamp 时排除 header 区域和竖向滚动条
 * <en/> Get the table body/scroll container's rect — used for clamping to exclude the header area and vertical scrollbar
 *
 * @remarks
 * <zh/> 表格根元素（.el-table / .el-table-v2）包含 header 和 body 两部分。
 * <zh/> clamp 如果基于根元素 rect，行滚动到 header 后方时不会被裁剪，
 * <zh/> 导致 Teleport 到 body 的 RowActionBar 以高 z-index 覆盖 header。
 * <zh/> 此函数查找 body 容器元素，返回其 rect 作为真正的可视区域边界。
 *
 * <zh/> 同时从右边缘减去竖向滚动条宽度，避免 RowActionBar 覆盖滚动条。
 * <zh/> 支持三种滚动条类型（顺序即优先级）：
 * <zh/> 1. 虚拟列表自定义滚动条——覆盖层，不占布局空间，必须在 scrollHeight 判定之前处理
 * <zh/> 2. 原生滚动条——通过 offsetWidth - clientWidth 计算
 * <zh/> 3. ElScrollbar 自定义滚动条——原生滚动条已被隐藏，通过 customBar 选择器定位
 *
 * <zh/> 右边缘始终 clamp 到根容器（containerEl）的右边缘，防止 body 元素超出根容器时
 * <zh/> RowActionBar 定位到表格可见区域之外（ElTableV2 的 Grid 宽度由 width prop 显式设置，
 * <zh/> 可能超出 .el-table-v2__root 的实际宽度）。
 *
 * <en/> The table root element (.el-table / .el-table-v2) contains both header and body.
 * <en/> If clamping is based on the root element's rect, rows scrolled behind the header won't be clipped,
 * <en/> causing the Teleported RowActionBar (with high z-index) to cover the header.
 * <en/> This function finds the body container element and returns its rect as the actual visible area boundary.
 *
 * <en/> Also subtracts the vertical scrollbar width from the right edge to prevent RowActionBar from covering the scrollbar.
 * <en/> Three scrollbar kinds are supported (the order is the priority):
 * <en/> 1. Virtual-list custom bar — an overlay taking no layout space, must run before the scrollHeight check
 * <en/> 2. Native scrollbar — computed via offsetWidth - clientWidth
 * <en/> 3. ElScrollbar custom bar — native bar hidden, located via the customBar selector
 *
 * <en/> The right edge is always clamped to the root container's (containerEl) right edge, preventing
 * <en/> RowActionBar from being positioned outside the table's visible area when the body element
 * <en/> extends beyond the root (ElTableV2's Grid width is set explicitly via width prop and may exceed
 * <en/> the actual width of .el-table-v2__root).
 *
 * @param containerEl - <zh/> 表格根容器 DOM 元素 | <en/> Table root container DOM element
 * @param spec - <zh/> body 与滚动条选择器规格（由 DOM 适配器供给） | <en/> body and scrollbar selector spec (supplied by the DOM adapter)
 * @returns <zh/> body 容器 rect（已排除滚动条宽度），未找到时回退到 containerEl 的 rect | <en/> body container rect (scrollbar width excluded), falls back to containerEl's rect if not found
 */
export function getBodyContainerRect(
  containerEl: HTMLElement,
  spec: BodyRectSpec,
): DOMRect {
  const bodyEl = containerEl.querySelector<HTMLElement>(spec.bodySelector)
  if (!bodyEl)
    return containerEl.getBoundingClientRect()

  const bodyRect = bodyEl.getBoundingClientRect()
  const rootRect = containerEl.getBoundingClientRect()

  /**
   * <zh/> 右边缘 clamp 到根容器，防止 body 元素（如 ElTableV2 Grid）超出根容器时
   * <zh/> RowActionBar 定位到表格可见区域之外。
   * <zh/> 顶部和底部使用 body 元素的值（排除 header 区域），左边缘同理。
   * <en/> Clamp the right edge to the root container, preventing the body element (e.g. ElTableV2 Grid)
   * <en/> from extending beyond the root container and positioning RowActionBar outside the visible area.
   * <en/> Top and bottom use the body element's values (excluding the header area), same for the left edge.
   */
  const clampedRight = Math.min(bodyRect.right, rootRect.right)
  const rect = new DOMRect(
    bodyRect.left,
    bodyRect.top,
    clampedRight - bodyRect.left,
    bodyRect.height,
  )

  /**
   * <zh/> 1. 虚拟列表自定义滚动条（优先检测）：绝对定位覆盖层，不占布局空间但覆盖在内容上方，
   * <zh/> 且虚拟网格根元素 overflow:hidden 导致 scrollHeight 不可靠，故必须先于 scrollHeight 检查处理。
   * <zh/> 渲染器未使用虚拟列表时适配器返回 undefined，本分支即整段跳过。
   * <en/> 1. Virtual-list custom bar (checked first): an absolutely-positioned overlay taking no layout
   * <en/> space but covering content; the grid root's overflow:hidden also makes scrollHeight unreliable,
   * <en/> so it must run before the scrollHeight check. The adapter returns undefined for renderers without
   * <en/> a virtual list, skipping this branch entirely (semantically identical to the original, where the
   * <en/> selector could never match for non-virtual renderers).
   */
  const { virtualBar, scrollWrap, customBar } = spec.scrollbars
  if (virtualBar && bodyEl.querySelector(virtualBar))
    return shrinkRight(rect, 6)

  /**
   * <zh/> 查找实际滚动元素（ElScrollbar 将内容包裹在 wrap 层）；scrollWrap 为空串表示
   * <zh/> body 容器自身即滚动元素（如 ElTableV2）。
   * <en/> Find the actual scrollable element (ElScrollbar wraps content in a wrap layer); an empty
   * <en/> scrollWrap means the body container scrolls itself (e.g. ElTableV2).
   */
  const scrollEl = scrollWrap
    ? (bodyEl.querySelector<HTMLElement>(scrollWrap) ?? bodyEl)
    : bodyEl

  /**
   * <zh/> 无垂直滚动时无需调整（滚动条不可见）
   * <en/> No adjustment needed when there's no vertical scroll (scrollbar not visible)
   */
  if (scrollEl.scrollHeight <= scrollEl.clientHeight)
    return rect

  /**
   * <zh/> 2. 原生滚动条：offsetWidth - clientWidth 即为滚动条宽度
   * <en/> 2. Native scrollbar: offsetWidth - clientWidth gives the scrollbar width
   */
  const nativeScrollbarWidth = scrollEl.offsetWidth - scrollEl.clientWidth
  if (nativeScrollbarWidth > 0)
    return shrinkRight(rect, nativeScrollbarWidth)

  /**
   * <zh/> 3. ElScrollbar 自定义滚动条：原生滚动条已被隐藏，查找自定义滚动条元素
   * <zh/> 自定义滚动条为绝对定位，不占布局空间但会覆盖在内容上方
   * <zh/> bodyEl.right - barRect.left = 滚动条宽度 + 右侧偏移量 = 滚动条占据的总空间
   * <en/> 3. ElScrollbar custom bar: native bar hidden, locate the custom bar element
   * <en/> The custom bar is absolutely positioned, takes no layout space but overlays content
   * <en/> bodyEl.right - barRect.left = scrollbar width + right offset = total space occupied by the scrollbar
   */
  if (customBar) {
    const customBarEl = bodyEl.querySelector<HTMLElement>(customBar)
    if (customBarEl) {
      const barRect = customBarEl.getBoundingClientRect()
      if (barRect.width > 0) {
        const scrollbarFootprint = rect.right - barRect.left
        if (scrollbarFootprint > 0)
          return shrinkRight(rect, scrollbarFootprint)
      }
    }
  }

  return rect
}

/**
 * <zh/> 通过行 key 定位行的几何位置——提取两个渲染器的公共逻辑
 * <en/> Locate a row's geometry by row key — extracts common logic from both renderers
 *
 * <zh/> 此函数处理以下公共逻辑：
 * <zh/> 1. 通过 data-adv-table-row-key 属性查找行标记元素
 * <zh/> 2. 用 rowSelector 通过 closest 找到行容器
 * <zh/> 3. 检查行是否在容器可视区域内
 * <zh/> 4. Clamp 定位到容器可视区域
 *
 * <en/> This function handles the following common logic:
 * <en/> 1. Find row marker element via data-adv-table-row-key attribute
 * <en/> 2. Find row container via closest using rowSelector
 * <en/> 3. Check if row is within container's visible area
 * <en/> 4. Clamp positioning to container's visible area
 *
 * @param containerEl - <zh/> 表格容器 DOM 元素 | <en/> Table container DOM element
 * @param rowKey - <zh/> 当前行 key（可为 null） | <en/> Current row key (can be null)
 * @param spec - <zh/> 行反查规格（选择器与 body rect 规格，均由 DOM 适配器供给） | <en/> row lookup spec (selectors and body rect spec, all supplied by the DOM adapter)
 * @returns <zh/> 行定位结果，未找到时返回 undefined | <en/> Row location result, or undefined if not found
 */
export function locateRowByKey(
  containerEl: HTMLElement,
  rowKey: string | null | undefined,
  spec: RowLocateSpec,
): { rect: DOMRect, containerRect: DOMRect } | undefined {
  if (rowKey == null)
    return undefined

  // <zh/> 缺省取常量而非字面量
  // <en/> Default from the constant, not a literal
  const rowKeyAttr = spec.rowKeyAttr ?? ADV_TABLE_ROW_KEY_ATTR

  /**
   * <zh/> 优先使用 body 容器 rect 进行 clamp，避免行滚动到 header 后方时 RowActionBar 覆盖 header
   * <en/> Prefer body container rect for clamping, preventing RowActionBar from covering the header when a row scrolls behind it
   */
  const containerRect = getBodyContainerRect(containerEl, spec.bodyRect)

  const marker = containerEl.querySelector<HTMLElement>(rowKeyAttrSelector(rowKey, rowKeyAttr))
  if (!marker)
    return undefined

  const row = marker.closest<HTMLElement>(spec.rowSelector)
  if (!row)
    return undefined

  const rect = row.getBoundingClientRect()

  /**
   * <zh/> 检查行是否在容器可视区域内
   * <en/> Check if the row is within the container's visible area
   * @remarks
   * <zh/> 滚动停止后 hoverRowKey 可能仍指向滚动前的行。
   * <zh/> 如果该行已滚出可视区域，返回 undefined 让 teleportRowRect 失效。
   * <en/> After scrolling stops, hoverRowKey may still point to the row before scrolling.
   * <en/> If that row has scrolled out of the visible area, return undefined to invalidate teleportRowRect.
   */
  const isRowVisible = rect.top + rect.height > containerRect.top
    && rect.top < containerRect.bottom
  if (!isRowVisible)
    return undefined

  return { rect, containerRect }
}

/**
 * <zh/> 将行 rect clamp 到容器可视区域内 | <en/> Clamp row rect to container's visible area
 *
 * @param rect - <zh/> 行的 getBoundingClientRect 结果 | <en/> Row's getBoundingClientRect result
 * @param containerRect - <zh/> 容器的 getBoundingClientRect 结果 | <en/> Container's getBoundingClientRect result
 * @returns <zh/> Clamp 后的定位结果 | <en/> Clamped location result
 */
export function clampRowToContainer(
  rect: DOMRect,
  containerRect: DOMRect,
): HoveredRowRect {
  const clampedTop = Math.max(rect.top, containerRect.top)
  const clampedBottom = Math.min(rect.bottom, containerRect.bottom)
  return {
    top: clampedTop,
    height: clampedBottom - clampedTop,
    containerRight: containerRect.right,
    containerLeft: containerRect.left,
  }
}
