/**
 * <zh/> DragLocator — 抽象的"从 DOM 定位拖拽行元素"策略接口
 *
 * <zh/> useRowDrag 通过此注入接口操作 DOM，不再内嵌不同渲染器的 CSS 选择器知识。
 * <zh/> 各渲染模式（ElTable / ElTableV2）在各自目录中提供实现。
 *
 * <en/> DragLocator — abstract strategy interface for locating drag row elements from DOM
 *
 * <en/> useRowDrag operates on DOM through this injected interface, no longer embedding CSS selector knowledge for different renderers.
 * <en/> Each rendering mode (ElTable / ElTableV2) provides its own implementation in its directory.
 */
export interface DragLocator {
  /** <zh/> 获取行容器 DOM 元素 | <en/> Get row container DOM element */
  getRowContainer: () => HTMLElement | null
  /** <zh/> 获取当前所有行的 key 数组 | <en/> Get all current row key array */
  getCurrentRowKeys: () => string[]
  /**
   * <zh/> 按 DOM 顺序返回每一行 `{ element, key }`——含无业务 key 的 synthetic 行（key 为 null），
   * <zh/> 调用方用 Sortable 的 DOM 索引先定位到本数组，再取业务 key；不得用 DOM 索引直接索引压缩后的 key 数组。
   * <en/> Row entries in DOM order — including key-less synthetic rows (null key).
   */
  getCurrentRowEntries?: () => Array<{ element: HTMLElement, key: string | null }>
  /** <zh/> 拖拽手柄 CSS 选择器 | <en/> Drag handle CSS selector */
  getDragHandleSelector: () => string
  /** <zh/> 可拖拽行的 CSS 选择器 | <en/> Draggable row CSS selector */
  getDraggableRowSelector: () => string
  /**
   * <zh/> 行内单元格的 CSS 选择器——`forceFallback` 模式下把源行单元格样式同步到克隆行时使用。
   *
   * <zh/> 由适配器供给（default 模式为原生 `td`，virtual 模式为命名空间化的行单元格类名），
   * <zh/> 使 `utils/drag-ghost` 不持有任何 EP 类名字面量。缺省时消费方回退为 `td`。
   * <en/> CSS selector for cells inside a row — used when syncing source-row cell styles onto the
   * <en/> fallback clone under `forceFallback`.
   *
   * <en/> Supplied by the adapter (native `td` in default mode; the namespace-aware row-cell class in
   * <en/> virtual mode) so `utils/drag-ghost` holds no EP class-name literal. Consumers fall back to
   * <en/> `td` when absent.
   */
  getCellSelector?: () => string
  /** <zh/> SortableJS animation 时长（ms），虚拟表格为 0 | <en/> SortableJS animation duration (ms), 0 for virtual table */
  getAnimation: () => number
  /** <zh/> ghost class，虚拟表格为 undefined | <en/> Ghost class, undefined for virtual table */
  getGhostClass: () => string | undefined
  /** <zh/> 获取滚动容器 DOM 元素（虚拟表格专用） | <en/> Get scroll container DOM element (virtual table only) */
  getScrollContainer?: () => HTMLElement | null
  /**
   * <zh/> 获取滚动容器内的可见行元素——行虚拟化拖拽时缓存可见行用；命名空间与模式差异由实现方封装，调用方不再拼接行类名。
   * <en/> Get the visible row elements inside a scroll container — for caching visible rows during virtualized row drag; namespace and mode differences are encapsulated by implementations, callers never concatenate row class names.
   */
  getVisibleRowElements: (scrollContainer: HTMLElement) => HTMLElement[]
  /** <zh/> 获取行高（虚拟表格专用） | <en/> Get row height (virtual table only) */
  getRowHeight?: () => number
  /** <zh/> 获取插入指示线容器 DOM 元素，用于定位 drop indicator | <en/> Get insert indicator container DOM element, used for positioning drop indicator */
  getInsertIndicatorContainer?: () => HTMLElement | null
}
