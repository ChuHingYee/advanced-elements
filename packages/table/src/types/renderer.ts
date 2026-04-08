import type { TableProps } from 'element-plus'
import type { Slots, VNode } from 'vue'
import type { IRendererDomAdapter } from '../components/renderer-core/dom-adapter'
import type { CheckStatus } from '../composables/selection/use-selection-state'
import type { ProcessedColumn, SpanInfo } from './column'
import type { EditConfig } from './edit'
import type { ColumnFilterValue } from './filter'
import type { SpanDynamicCoexistence } from './renderer-interface'
import type { SortState } from './sort'
import type { Translator } from './translator'

//  RendererCommonProps — 双渲染器共享属性
//  RendererCommonProps — shared props for both renderers

/**
 * <zh/> 渲染器通用属性接口。
 *
 * <zh/> 编辑相关属性通过 provide/inject 传递（advTableEditKey），
 * <zh/> 筛选/排序操作属性通过域键 advTableFilterSortKey 传递——避免 props 逐层传递和 diff 开销。
 * <zh/> 选中状态通过 props 传递（selectionMode/selectionColumns 等）。
 *
 * @typeParam T – <zh/> 表格行数据类型 | <en/> table row data type
 *
 * <en/> Renderer common props interface.
 *
 * <en/> Edit-related props are passed via provide/inject (advTableEditKey),
 * <en/> filter/sort operation props via the advTableFilterSortKey domain key,
 * <en/> selection state is passed via props (selectionMode/selectionColumns, etc.).
 */
export interface RendererCommonProps<T = any> {
  /** <zh/> 所有列定义（含分组列） | <en/> All column definitions (including group columns) */
  columns: ProcessedColumn[]
  /** <zh/> 需要正常渲染的列（不含 selection、hover 等特殊列） | <en/> Columns to render normally (excluding special columns like selection, hover) */
  displayNormalColumns: ProcessedColumn[]
  /** <zh/> 表格行数据 | <en/> Table row data */
  data: T[]
  /** <zh/> 透传的插槽 | <en/> Forwarded slots */
  forwardedSlots?: Slots
  /** <zh/> 国际化翻译函数 | <en/> i18n translation function */
  t?: Translator
  /** <zh/> 获取行唯一标识 key 的函数 | <en/> Function to get row unique identifier key */
  rowKey: (row: T) => string
  /**
   * <zh/> 显式字段型 rowKey 的字段名：virtual 渲染器存在时直接传给 EP `:row-key`
   * <zh/>（EP 按属性名读取，冻结行无需写入 AUTO_KEY）；函数/auto 时为 undefined。
   * <en/> Field name of an explicit field-style rowKey: handed directly to EP `:row-key` when a virtual renderer exists
   * <en/> (EP reads by property name; frozen rows need no AUTO_KEY writes); undefined for function/auto.
   */
  rowKeyField?: string | number | symbol
  /** <zh/> 选中模式：单选或多选 | <en/> Selection mode: single or multiple */
  selectionMode?: 'single' | 'multiple'
  /** <zh/> 复选框/单选列定义 | <en/> Checkbox/radio column definitions */
  selectionColumns: ProcessedColumn[]
  /** <zh/> 普通列定义（含 filtering） | <en/> Normal column definitions (including filtering) */
  normalColumns: ProcessedColumn[]
  /** <zh/> 可被选中的行数据 | <en/> Selectable row data */
  selectableData: T[]
  /** <zh/> 自定义行是否可选中 | <en/> Custom function to determine if a row is selectable */
  selectableFn?: (row: T, index: number) => boolean
  /** <zh/> 全选/半选状态 | <en/> Select-all/partial-select state */
  checkStatus: CheckStatus
  /** <zh/> 是否显示汇总行 | <en/> Whether to show summary row */
  showSummary?: boolean
  /** <zh/> 自定义汇总行渲染方法 | <en/> Custom summary row render method */
  summaryMethod?: (params: { columns: ProcessedColumn[], data: T[] }) => (string | VNode)[]
  /** <zh/> 汇总行左侧文本 | <en/> Summary row left text */
  sumText?: string
  /** <zh/> 汇总计算使用的数据（分页前的全量数据），未提供时回退到 data | <en/> Data for summary calculation (full data before pagination), falls back to data if not provided */
  summaryData?: T[]
  /**
   * <zh/> Grand Total 总计行位置——对齐 AG Grid grandTotalRow，未设置时 showSummary=true 回退 'bottom'
   * <en/> Grand total position — aligned with AG Grid grandTotalRow; showSummary=true falls back to 'bottom' when unset
   */
  grandTotalRow?: import('./config-options').GrandTotalRowPosition
  /**
   * <zh/> 合计标签自定义——对齐 AG Grid totalValueGetter
   * <en/> Total label customization — aligned with AG Grid totalValueGetter
   */
  totalValueGetter?: import('./config-options').TotalValueGetter
  /**
   * <zh/> 粘性合计行抑制——对齐 AG Grid suppressStickyTotalRow
   * <en/> Sticky total suppression — aligned with AG Grid suppressStickyTotalRow
   */
  suppressStickyTotalRow?: import('./config-options').SuppressStickyTotalRow
  /** <zh/> 是否显示加载状态 | <en/> Whether to show loading state */
  loading?: boolean
  /** <zh/> 定义了 hover 操作按钮的列 | <en/> Columns with hover action buttons defined */
  hoverOptionColumns?: ProcessedColumn[]
  /** <zh/> 是否存在 hover 操作列 | <en/> Whether hover action columns exist */
  hasHoverOptionColumns?: boolean
  /** <zh/> 是否有 hover 列启用了 teleport | <en/> Whether any hover column has teleport enabled */
  hoverOptionTeleport?: boolean
  /** <zh/> selection 列的稳定同步 key | <en/> Stable sync key for selection column */
  selectionColumnSyncKey?: string
  /** <zh/> 是否保留 hover 层 DOM（v-show vs v-if） | <en/> Whether to keep hover layer DOM (v-show vs v-if) */
  keepAliveHover?: boolean
  /**
   * <zh/> 列自适应宽度模式。
   * <zh/> true 时：
   * <zh/>   - 所有列默认参与等比拉伸（flexGrow=1 / ElTable 自动分配剩余空间）
   * <zh/>   - 列级 stretch: false 可排除特定列不参与拉伸
   * <zh/>   - minWidth 为下限，maxWidth 为上限
   * <zh/>   - 用户拖拽列宽后该列自动固定
   * <zh/> false 时：传统固定宽度模式。
   * <zh/> 用户显式设置的 minWidth/maxWidth/flexGrow 始终被尊重。
   *
   * <en/> Column auto-size width mode.
   * <en/> When true:
   * <en/>   - All columns participate in proportional stretching by default (flexGrow=1 / ElTable auto-distributes remaining space)
   * <en/>   - Column-level stretch: false excludes specific columns from stretching
   * <en/>   - minWidth is lower bound, maxWidth is upper bound
   * <en/>   - Column auto-fixes after user drag-resize
   * <en/> When false: traditional fixed width mode.
   * <en/> User-explicitly set minWidth/maxWidth/flexGrow are always respected.
   */
  autoSizeColumns?: boolean
  /** <zh/> 启用内联浮动筛选 | <en/> Enable inline floating filter */
  floatingFilter?: boolean
  /**
   * <zh/> 是否显示表格边框
   * <zh/> 控制 ElTable 的 border prop（外边框 + 纵向内边框）。
   *
   * <en/> Whether to show table borders
   * <en/> Controls ElTable's border prop (outer border + vertical inner borders).
   */
  border?: boolean
  /**
   * <zh/> 是否允许拖拽调整列宽
   * <zh/> 由 AdvTable 的 `resizable` prop 传入，控制自定义列宽拖拽逻辑。
   *
   * <en/> Whether to allow drag-resizing column widths
   * <en/> Passed in by AdvTable's `resizable` prop, controls custom column width drag logic.
   */
  resizable?: boolean
  /**
   * <zh/> 空数据时显示的文本
   * <zh/> - default 模式: 传递给 ElTable 的 `empty-text` prop
   * <zh/> - virtual 模式: 通过 `#empty` 插槽实现
   *
   * <en/> Text to display when there is no data
   * <en/> - default mode: passed to ElTable's `empty-text` prop
   * <en/> - virtual mode: implemented via `#empty` slot
   */
  emptyText?: string
  /** <zh/> 单元格编辑配置 | <en/> Cell editing configuration */
  editConfig?: EditConfig
  /**
   * <zh/> 行的 className，支持函数或字符串
   * <zh/> - 函数签名: `({ row, rowIndex }) => string`
   * <zh/> - 两种模式下行为一致
   *
   * <en/> Row className, supports function or string
   * <en/> - Function signature: `({ row, rowIndex }) => string`
   * <en/> - Behavior is consistent across both modes
   */
  rowClassName?: TableProps<any>['rowClassName']
  /** <zh/> 表格高度（透传给 ElTable / ElTableV2） | <en/> Table height (passed to ElTable / ElTableV2) */
  height?: number | string
  /** <zh/> 是否显示斑马纹 | <en/> Whether to display striped rows */
  stripe?: boolean
  /** <zh/> 是否高亮当前行 | <en/> Whether to highlight the current row */
  highlightCurrentRow?: boolean
  /** <zh/> 是否显示表头 | <en/> Whether to show the table header */
  showHeader?: boolean
  /** <zh/> 表格尺寸 | <en/> Table size */
  size?: TableProps<any>['size']
  /** <zh/> 表格布局方式 | <en/> Table layout */
  tableLayout?: TableProps<any>['tableLayout']
  /**
   * <zh/> 溢出 tooltip 的 effect 主题
   * <zh/> 默认 'dark'
   *
   * <en/> Overflow tooltip effect theme
   * <en/> Default 'dark'
   */
  tooltipEffect?: TableProps<any>['tooltipEffect']
  /**
   * <zh/> 溢出 tooltip 的自定义选项（placement、popperClass 等）
   *
   * <en/> Custom options for overflow tooltip (placement, popperClass, etc.)
   */
  tooltipOptions?: TableProps<any>['tooltipOptions']
  /**
   * <zh/> 当前模式的 DOM 适配器——渲染器查询 EP 内部 DOM（行/body 选择器、滚动条规格、
   * <zh/> 单元格定位器）的唯一入口，渲染器自身不得持有 EP 类名字符串。
   * <zh/> 由 `core/use-renderer-adapter.ts` 按模式供给（与 caps 同源）。
   *
   * <en/> DOM adapter for the current mode — the only entry point for a renderer to query EP internals
   * <en/> (row/body selectors, scrollbar spec, cell locator); renderers must not hold EP class-name strings.
   * <en/> Supplied per mode by `core/use-renderer-adapter.ts` (same source as caps).
   */
  dom: IRendererDomAdapter
}

//  DefaultRendererProps — ElTable 模式
//  DefaultRendererProps — ElTable mode

/** <zh/> 默认渲染器（ElTable）props | <en/> Default renderer (ElTable) props */
export interface DefaultRendererProps<T = any> extends RendererCommonProps<T> {
  /** <zh/> 叶子列（多级表头展开后的最底层列） | <en/> Leaf columns (bottom-level columns after expanding multi-level headers) */
  leafColumns: ProcessedColumn[]
  /**
   * <zh/> 行高（px），供行固定（row pinning）sticky 偏移计算，缺省按 48 处理
   * <en/> Row height (px) for row-pinning sticky offset math, defaults to 48
   */
  rowHeight?: number
  /**
   * <zh/> 单元格合并方法，返回 { rowspan, colspan } 或 undefined
   * <en/> Cell span method, returns { rowspan, colspan } or undefined
   * @param params - <zh/> 合并参数 | <en/> span params
   * @param params.row - <zh/> 当前行数据 | <en/> current row data
   * @param params.column - <zh/> 当前列配置 | <en/> current column config
   * @param params.rowIndex - <zh/> 当前行索引 | <en/> current row index
   * @param params.columnIndex - <zh/> 当前列索引 | <en/> current column index
   */
  spanMethod?: (params: {
    row: T
    column: ProcessedColumn
    rowIndex: number
    columnIndex: number
  }) => { rowspan: number, colspan: number } | undefined
}

//  VirtualRendererProps — ElTableV2 模式
//  VirtualRendererProps — ElTableV2 mode

/**
 * <zh/> 虚拟表格渲染器配置属性
 *
 * <zh/> 用于 ElTableV2 虚拟滚动表格模式的渲染器配置，继承自 RendererCommonProps。
 * <zh/> 提供虚拟表格所需的尺寸、筛选、排序、单元格合并等配置项。
 *
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 *
 * <en/> Virtual table renderer configuration props
 *
 * <en/> Renderer configuration for ElTableV2 virtual scrolling table mode, extends RendererCommonProps.
 * <en/> Provides configuration items for virtual table sizing, filtering, sorting, cell merging, etc.
 */
export interface VirtualRendererProps<T = any> extends RendererCommonProps<T> {
  /** <zh/> 表格高度（px），控制虚拟滚动视口高度 | <en/> Table height (px), controls virtual scroll viewport height */
  height?: number | string
  /** <zh/> 表格宽度（px） | <en/> Table width (px) */
  width?: number | string
  /** <zh/> 选择列宽度（px），用于多选/单选列 | <en/> Selection column width (px), for multi/single select columns */
  selectionWidth?: number
  /** <zh/> 列筛选状态，键为列标识，值为筛选条件 | <en/> Column filter state, key is column identifier, value is filter condition */
  filterState?: Record<string, ColumnFilterValue>
  /** <zh/> 排序状态数组（多列排序），统一为 SortState[] 形式 | <en/> Sort state array (multi-column sort), unified as SortState[] form */
  sortState?: SortState[]
  /**
   * <zh/> 获取单元格合并信息
   * @param rowIndex - <zh/> 行索引 | <en/> row index
   * @param colKey - <zh/> 列键 | <en/> column key
   * @param rowData - <zh/> 行对象（可选，用于 grand/pin 行身份换算；缺省回退直接查表） | <en/> row object (optional, for grand/pin identity translation; fallback direct lookup)
   * @returns <zh/> SpanInfo 或 undefined（无需合并时返回 undefined） | <en/> SpanInfo or undefined (undefined when no merge needed)
   */
  getSpanInfo?: (rowIndex: number, colKey: string, rowData?: unknown) => SpanInfo | undefined
  /** <zh/> 是否启用单元格合并 | <en/> Whether to enable cell merging */
  spanEnabled?: boolean
  /** <zh/> 底部表脚高度（px） | <en/> Footer height (px) */
  footerHeight?: number
  /**
   * <zh/> 虚拟滚动预渲染行数（缓存行数），透传至 ElTableV2 的 cache prop。
   * <zh/> 值越大滚动越平滑但 DOM 节点更多，默认 2。
   *
   * <en/> Virtual scroll pre-render row count (cache rows), passed through to ElTableV2's cache prop.
   * <en/> Larger values result in smoother scrolling but more DOM nodes, default 2.
   */
  cache?: number
  /**
   * <zh/> 动态行高模式下每行的预估高度（px），透传至 ElTableV2 的 estimated-row-height prop。
   * <zh/> 当 rowHeight 未设置且行高不统一时使用，默认 undefined（采用固定 rowHeight）。
   *
   * <en/> Estimated row height (px) in dynamic row height mode, passed through to ElTableV2's estimated-row-height prop.
   * <en/> Used when rowHeight is not set and row heights are non-uniform, default undefined (uses fixed rowHeight).
   */
  estimatedRowHeight?: number
  /**
   * <zh/> 合并×动态行高共存策略（特性开关，默认 'warn-only' 零行为变更）| <en/> Span×dynamic coexistence strategy (flag, default 'warn-only' = zero behavior change)
   */
  spanDynamicMode?: SpanDynamicCoexistence
}

//  RendererProps — 联合类型
//  RendererProps — union type

/** <zh/> 渲染器 props 联合类型（按 mode 区分） | <en/> Renderer props union (discriminated by mode) */
export type RendererProps<T = any>
  = | (DefaultRendererProps<T> & { mode: 'default', __renderer: 'default' })
    | (VirtualRendererProps<T> & { mode: 'virtual', __renderer: 'virtual' })

//  Type guards — 运行时区分渲染模式
//  Type guards — runtime discrimination of rendering modes

/**
 * <zh/> 判断是否为默认渲染器（ElTable）模式
 *
 * <zh/> 类型守卫函数，通过检查 `props.mode === 'default'` 来缩小类型范围。
 * <zh/> 返回 `true` 时，TypeScript 将 props 类型收窄为 `DefaultRendererProps<T>`，
 * <zh/> 同时在类型层面标记 `__renderer` 字面量，供渲染器分发逻辑使用。
 *
 * @param props - <zh/> 渲染器属性对象 | <en/> renderer props object
 * @returns <zh/> props 是否为 default 模式 | <en/> whether props is default mode
 *
 * <en/> Determine if it is the default renderer (ElTable) mode
 *
 * <en/> Type guard function, narrows the type by checking `props.mode === 'default'`.
 * <en/> When `true` is returned, TypeScript narrows the props type to `DefaultRendererProps<T>`,
 * <en/> and marks the `__renderer` literal at the type level for renderer dispatch logic.
 */
export function isDefaultRendererProps<T>(
  props: RendererProps<T>,
): props is DefaultRendererProps<T> & { mode: 'default', __renderer: 'default' } {
  return props.mode === 'default'
}

/**
 * <zh/> 判断是否为虚拟渲染器（ElTableV2）模式
 *
 * <zh/> 类型守卫函数，通过检查 `props.mode === 'virtual'` 来缩小类型范围。
 * <zh/> 返回 `true` 时，TypeScript 将 props 类型收窄为 `VirtualRendererProps<T>`，
 * <zh/> 同时在类型层面标记 `__renderer` 字面量，供渲染器分发逻辑使用。
 *
 * @param props - <zh/> 渲染器属性对象 | <en/> renderer props object
 * @returns <zh/> props 是否为 virtual 模式 | <en/> whether props is virtual mode
 *
 * <en/> Determine if it is the virtual renderer (ElTableV2) mode
 *
 * <en/> Type guard function, narrows the type by checking `props.mode === 'virtual'`.
 * <en/> When `true` is returned, TypeScript narrows the props type to `VirtualRendererProps<T>`,
 * <en/> and marks the `__renderer` literal at the type level for renderer dispatch logic.
 */
export function isVirtualRendererProps<T>(
  props: RendererProps<T>,
): props is VirtualRendererProps<T> & { mode: 'virtual', __renderer: 'virtual' } {
  return props.mode === 'virtual'
}
