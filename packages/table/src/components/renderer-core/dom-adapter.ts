import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { CellLocator } from '../../types/cell-locator'
import type { DragLocator } from '../../types/drag-locator'

/**
 * @file dom-adapter.ts
 * @description
 * <zh/> 渲染器 DOM 适配器 —— Element Plus 内部 DOM 结构（类名、层级、组件包装层）的唯一出口。
 *
 * <zh/> **为什么需要**：`utils/ep-selectors.ts` 只把类名字符串集中到一处（改名一处生效），
 * <zh/> 但消费点仍直接 `querySelector('.el-*')` —— 结构层级与组件包装差异仍散落在 hook 与渲染器中。
 * <zh/> 本适配器提供「接口 + 双实现」，hook 只依赖接口方法，不再持有任何 EP 类名字符串：
 * <zh/> EP 大版本升级时只需改两个实现文件（`default-dom-adapter` / `virtual-dom-adapter`）。
 *
 * <zh/> **设计约束**：
 * <zh/> 1. 仅暴露「已被真实消费」的能力，不做投机性 API（每个方法至少有 1 个生产调用点）。
 * <zh/> 2. 选择器读取保持动态——命名空间（`uiConfig.namespace`）与表格尺寸可在运行时变化，
 * <zh/>    故一律以方法（而非静态属性）暴露，每次调用读取当前值。
 * <zh/> 3. 拖拽定位器/单元格定位器**整体**由适配器创建：其内部的 DOM 查询不再泄漏到 hook。
 *
 * <en/> Renderer DOM adapter — the single outlet for Element Plus internal DOM structure
 * <en/> (class names, hierarchy, component wrappers).
 *
 * <en/> **Why**: `utils/ep-selectors.ts` centralizes class-name strings only (one-place rename), yet
 * <en/> consumers still call `querySelector('.el-*')` directly, leaving structural/wrapper differences
 * <en/> scattered across hooks and renderers. This adapter provides "one interface, two implementations":
 * <en/> hooks depend on interface methods only and never hold an EP class-name string, so an EP major
 * <en/> upgrade only touches the two adapter implementation files.
 *
 * <en/> **Design constraints**:
 * <en/> 1. Expose only capabilities with a real consumer — no speculative API (every method has ≥1 production call site).
 * <en/> 2. Selectors stay dynamic — the namespace (`uiConfig.namespace`) and table geometry can change at
 * <en/>    runtime, so everything is exposed as methods (not static properties) reading the current value,
 * <en/>    matching the previous inline implementations' behavior exactly.
 * <en/> 3. Drag/cell locators are created **as a whole** by the adapter: their internal DOM queries never
 * <en/>    leak into hooks.
 *
 * @remarks
 * <zh/> 本接口由 `core/use-renderer-adapter.ts` 按模式供给（与 `RendererCaps` 同源），
 * <zh/> 经域键下发到渲染器，经 `RendererContext.dom` 下发到子编排器。
 * <en/> Supplied per mode by `core/use-renderer-adapter.ts` (same source as `RendererCaps`), handed to
 * <en/> renderers via domain keys and to sub-orchestrators via `RendererContext.dom`.
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
