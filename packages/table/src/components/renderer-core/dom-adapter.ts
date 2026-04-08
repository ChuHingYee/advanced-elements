import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { CellLocator } from '../../types/cell-locator'
import type { DragLocator } from '../../types/drag-locator'

/**
 * @file dom-adapter.ts
 * @description
 * <zh/> 渲染器 DOM 适配器 —— Element Plus 内部 DOM 结构（类名 / 层级 / 组件包装层）的唯一出口。
 * <en/> Renderer DOM adapter — single outlet for Element Plus internal DOM structure.
 *
 * @remarks
 * <zh/> 动机：`utils/ep-selectors.ts` 只集中类名字符串，消费点仍直接 `querySelector('.el-*')`，
 * <zh/> 结构差异散落各处。本适配器提供「接口 + 双实现」，hook 仅依赖接口方法，
 * <zh/> EP 大版本升级时只改 `default-dom-adapter` 与 `virtual-dom-adapter`。
 * <zh/> 约束：仅暴露有真实消费点的 API；选择器以方法暴露（namespace / 尺寸运行时可变）；
 * <zh/> 定位器整体由适配器创建，内部 DOM 查询不外泄到 hook。
 * <zh/> 由 `core/use-renderer-adapter.ts` 按模式供给（与 `RendererCaps` 同源），经域键与 `RendererContext.dom` 下发。
 * <en/> Motivation: `ep-selectors.ts` centralizes class strings only; consumers still call `querySelector('.el-*')`,
 * <en/> so structural differences leak across hooks. This adapter offers "one interface, two implementations";
 * <en/> hooks depend on interface methods only — an EP major upgrade only touches the two adapter files.
 * <en/> Constraints: only APIs with real consumers; selectors are methods (namespace/geometry can change at runtime);
 * <en/> locators are created whole by the adapter so internal DOM queries never leak to hooks.
 * <en/> Supplied per mode by `core/use-renderer-adapter.ts` (same source as `RendererCaps`), via domain keys and `RendererContext.dom`.
 */
export interface IRendererDomAdapter {
  /**
   * <zh/> 单元格反查的作用域选择器——将查询收窄到主网格，避免钉住条带/汇总区的同属性单元格被误命中。
   * <zh/> 无收窄需求的渲染器返回 `undefined`（查询落在容器自身）。
   * <en/> Scope selector for cell reverse lookup — narrows the query to the main grid so pinned-strip /
   * <en/> summary duplicates cannot be hit. Renderers without narrowing return `undefined`.
   */
  getScopeSelector: () => string | undefined

  /**
   * <zh/> hover 矩形 clamp 所用的 body/滚动容器选择器（相对表格根元素，不含表格 id 作用域）。
   * <zh/> 以 body（而非根元素）为界可排除 header 区域，避免悬浮条覆盖表头。
   * <en/> Body/scroll container selector for hover rect clamping (relative to the table root, unscoped
   * <en/> by table id). Clamping to the body (not the root) excludes the header area.
   */
  getBodySelector: () => string

  /**
   * <zh/> hover 行容器反查所用的行元素选择器（相对表格根元素）。
   * <en/> Row element selector used by hover row reverse lookup (relative to the table root).
   */
  getRowSelector: () => string

  /**
   * <zh/> 从任意后代元素向上反查最近的行元素——`closest(getRowSelector())` 的适配器封装，
   * <zh/> hook 不再持有行类名字面量（自定义命名空间下仍然命中）。
   * <en/> Reverse-lookup the nearest row element from any descendant — adapter wrapper around
   * <en/> `closest(getRowSelector())`, so hooks never hold a row class-name literal.
   */
  closestRow: (el: Element) => HTMLElement | null

  /**
   * <zh/> 表头包装容器选择器（相对表格根元素）——列拖拽容器观察目标等 header 侧查询使用。
   * <en/> Header wrapper selector (relative to the table root) — for header-side queries such as
   * <en/> the column-drag container observe target.
   */
  getHeaderSelector: () => string

  /**
   * <zh/> EP 内置表头单元格选择器（相对表格根元素）——列宽拖拽在自有表头类名未命中时的回退匹配。
   * <en/> Built-in EP header cell selector (relative to the table root) — fallback match for column
   * <en/> resize when the owned header class names miss.
   */
  getHeaderCellSelector: () => string

  /**
   * <zh/> 列拖拽容器（表头行）选择器（相对表格根元素）——结构后缀（`thead tr` / 内置 header-row 类）
   * <zh/> 由适配器封装，渲染器不再拼接 EP 类名。
   * <en/> Column-drag container (header row) selector (relative to the table root) — structural
   * <en/> suffixes (`thead tr` / built-in header-row class) encapsulated by the adapter.
   */
  getHeaderRowSelector: () => string

  /**
   * <zh/> body 容器的滚动条选择器组合——`utils/hover-locator` 据此计算「排除滚动条后的可视右边界」。
   * <en/> Scrollbar selector bundle for the body container — `utils/hover-locator` uses it to compute the
   * <en/> visible right edge with the scrollbar excluded.
   */
  getBodyScrollbarSpec: () => BodyScrollbarSpec

  /**
   * <zh/> 创建拖拽定位器——行容器/行键集合/拖拽行/插入指示线容器的 DOM 查询全部封装在适配器内。
   * <en/> Create the drag locator — all DOM queries (row container, current row keys, draggable rows,
   * <en/> insert-indicator container) stay inside the adapter.
   *
   * @param tableId - <zh/> 表格根元素 id（查询作用域） | <en/> table root element id (query scope)
   * @param rowHeight - <zh/> 行高（虚拟渲染器用于插入指示线定位） | <en/> row height (used by the virtual renderer for indicator positioning)
   */
  createDragLocator: (tableId: string, rowHeight: MaybeRefOrGetter<number | undefined>) => DragLocator

  /**
   * <zh/> 创建单元格定位器——DOM 结构解析（行列索引反查）封装在适配器内。
   * <en/> Create the cell locator — DOM structure parsing (row/column index reverse lookup) stays
   * <en/> inside the adapter.
   *
   * @param keyToIndex - <zh/> 渲染数据域行键 → 行索引映射（虚拟渲染器需要；default 忽略） | <en/> render-data-domain rowKey → rowIndex map (required by virtual; ignored by default)
   */
  createCellLocator: (keyToIndex?: ComputedRef<Map<string, number>>) => CellLocator
}

/**
 * <zh/> hover 矩形 clamp 所需的滚动条选择器组合——由适配器供给，`utils/hover-locator` 消费，
 * <zh/> 使该工具函数不持有任何 EP 类名字面量。
 * <en/> Scrollbar selector bundle for hover rect clamping — supplied by the adapter and consumed by
 * <en/> `utils/hover-locator`, keeping that utility free of EP class-name literals.
 */
export interface BodyScrollbarSpec {
  /**
   * <zh/> 虚拟列表竖向滚动条选择器（覆盖层，不占布局）——必须在 `scrollHeight` 判定之前减除。
   * <zh/> 该渲染器不使用虚拟列表时返回 `undefined`。
   * <en/> Virtual-list vertical bar selector (overlay, takes no layout space) — must be subtracted before
   * <en/> the `scrollHeight` check. `undefined` when the renderer uses no virtual list.
   */
  virtualBar: string | undefined
  /**
   * <zh/> 实际滚动元素选择器（ElScrollbar 把内容包在 wrap 层）。
   * <zh/> 空串表示 body 容器自身即滚动元素。
   * <en/> Actual scrollable element selector (ElScrollbar wraps content). An empty string means the body
   * <en/> container scrolls itself.
   */
  scrollWrap: string
  /**
   * <zh/> 自定义竖向滚动条轨道选择器（原生滚动条被隐藏时的宽度来源）；无自定义滚动条时返回 `undefined`。
   * <en/> Custom vertical bar track selector (width source when the native bar is hidden); `undefined`
   * <en/> when there is no custom scrollbar.
   */
  customBar: string | undefined
}
