import type { VNode } from 'vue'
import type { ButtonConfig, ComponentsMap, FormField } from '../components/search/types'
import type { AdvColumn, ColSpanCellsConfig, ProcessedColumn, RowSpanCellsConfig, SpanRange } from './column'
import type { ColumnGroupConfig } from './config-tree'

/**
 * URL 状态同步配置 — 将分页 / 搜索参数同步到路由 query 的 key 名（enabled 关闭时不参与同步）
 *
 * <zh/> 同页多表注意：默认 `pageKey='p'` / `sizeKey='s'` 为全局共享键，同路由两表同时启用
 * <zh/> `urlState` 会互相覆盖（后写赢）。请为每表配置不同的 key（如 `p_orders` / `p_users`）。
 * <en/> Multi-table note: default `pageKey='p'` / `sizeKey='s'` are shared keys; two tables with
 * <en/> `urlState` on the same route overwrite each other (last write wins). Give each table
 * <en/> distinct keys (e.g. `p_orders` / `p_users`).
 */
export interface UrlStateConfig {
  enabled?: boolean
  pageKey?: string
  sizeKey?: string
}

/**
 * <zh/> 外部筛选器契约（AG-Grid 风格）
 *
 * <zh/> 外部筛选器是数据管线中的一个可选阶段，位于列筛选与全局搜索之后、排序之前。
 * <zh/> 它允许调用方注入任意的业务过滤逻辑（如权限过滤、跨表关联过滤、动态条件组合等），
 * <zh/> 而无需修改 `columns` 配置或使用 `cellEditor`/`valueFormatter` 等 cell-level API。
 *
 * <zh/> 契约：
 * <zh/> - {@link isExternalFilterPresent} 在每次管线重算时被调用，决定是否启用外部筛选阶段。
 * <zh/>   返回 `false` 时跳过 {@link doesExternalFilterPass}，直接透传上游数据。
 * <zh/>   建议在无业务过滤条件时返回 `false`，避免不必要的全量遍历。
 * <zh/> - {@link doesExternalFilterPass} 对上游每行数据调用一次，返回 `true` 保留、`false` 过滤。
 * <zh/>   该函数必须是**纯函数**（无副作用、对同一输入始终返回同一结果），
 * <zh/>   因为其结果会被管线缓存并参与 prev-stability 优化。
 * <zh/> - 调用频率：`isExternalFilterPresent` 每次 reactive 依赖变更时调用一次；
 * <zh/>   `doesExternalFilterPass` 在 `isExternalFilterPresent` 返回 `true` 时，
 * <zh/>   对上游数据数组的每行调用一次（O(n) 复杂度）。
 *
 * <zh/> 性能建议：
 * <zh/> - 避免在 `doesExternalFilterPass` 中进行 IO 操作或重计算
 * <zh/> - 若过滤条件复杂，建议在外部预先 memoize（如 `computed`），仅在内层做查表
 * <zh/> - 大数据量场景下，考虑改用 `columns` 的 `filter` 配置走列级筛选（同样支持自定义 filterFn）
 *
 * <zh/> 示例：
 * ```ts
 * const activeDepartment = ref('eng')
 * const externalFilter = computed( => ({
 *   isExternalFilterPresent:  => !!activeDepartment.value,
 *   doesExternalFilterPass: (row: Employee) => row.department === activeDepartment.value,
 * }))
 * ```
 *
 * <en/> External filter contract (AG-Grid style)
 *
 * <en/> The external filter is an optional stage in the data pipeline, located after column filter
 * <en/> and quick filter, before sorting. It allows callers to inject arbitrary business filtering logic
 * <en/> (e.g. permission filter, cross-table join filter, dynamic condition composition) without modifying
 * <en/> `columns` config or using cell-level APIs like `cellEditor`/`valueFormatter`.
 *
 * <en/> Contract:
 * <en/> - {@link isExternalFilterPresent} is called on each pipeline recompute to decide whether the
 * <en/>   external filter stage is active. When returning `false`, {@link doesExternalFilterPass} is
 * <en/>   skipped and upstream data is passed through. Return `false` when no business filter is active
 * <en/>   to avoid an unnecessary full traversal.
 * <en/> - {@link doesExternalFilterPass} is called once per upstream row, returning `true` to keep,
 * <en/>   `false` to filter. It MUST be a **pure function** (no side effects, deterministic for the same input)
 * <en/>   because its result is cached by the pipeline and participates in prev-stability optimization.
 * <en/> - Call frequency: `isExternalFilterPresent` is called once per reactive dependency change;
 * <en/>   `doesExternalFilterPass` is called once per upstream row (O(n)) when `isExternalFilterPresent` returns `true`.
 *
 * <en/> Performance tips:
 * <en/> - Avoid IO or heavy computation inside `doesExternalFilterPass`
 * <en/> - For complex filter conditions, pre-memoize externally (e.g. via `computed`) and only do a lookup inside
 * <en/> - For large datasets, prefer `columns` `filter` config (column-level filtering also supports custom filterFn)
 *
 * @example
 * ```ts
 * const activeDepartment = ref('eng')
 * const externalFilter = computed( => ({
 *   isExternalFilterPresent:  => !!activeDepartment.value,
 *   doesExternalFilterPass: (row: Employee) => row.department === activeDepartment.value,
 * }))
 * ```
 */
export interface ExternalFilterConfig<T = any> {
  /**
   * <zh/> 是否存在外部筛选条件——返回 `false` 时跳过 {@link doesExternalFilterPass}，透传上游数据。
   * <en/> Whether an external filter condition is present — returning `false` skips {@link doesExternalFilterPass} and passes through upstream data.
   *
   * <zh/> 调用频率：每次管线 reactive 依赖变更时调用一次。
   * <en/> Call frequency: once per pipeline reactive dependency change.
   *
   * <zh/> 建议在无业务过滤条件时返回 `false`，避免不必要的全量遍历。
   * <en/> Return `false` when no business filter is active to avoid an unnecessary full traversal.
   */
  isExternalFilterPresent: () => boolean
  /**
   * <zh/> 单行过滤判定——返回 `true` 保留该行，`false` 过滤掉。
   * <en/> Per-row filter predicate — return `true` to keep the row, `false` to filter it out.
   *
   * <zh/> 必须是纯函数（无副作用、对同一输入始终返回同一结果）。
   * <zh/> 仅在 {@link isExternalFilterPresent} 返回 `true` 时对上游每行调用一次（O(n)）。
   *
   * <en/> MUST be a pure function (no side effects, deterministic for the same input).
   * <en/> Called once per upstream row (O(n)) only when {@link isExternalFilterPresent} returns `true`.
   *
   * @param row - <zh/> 上游数据行（已完成列筛选与全局搜索） | <en/> Upstream row (already passed column filter and quick filter)
   */
  doesExternalFilterPass: (row: T) => boolean
}

/** <zh/> 搜索栏配置 | <en/> Search bar config */
export interface SearchConfig {
  enabled?: boolean
  labelWidth?: number | 'auto'
  collapsed?: boolean
  /** <zh/> 毫秒 | <en/> Milliseconds */
  debounceTime?: number
  searchText?: string
  resetText?: string
  span?: number
  buttons?: ButtonConfig
  fields?: FormField[]
  components?: ComponentsMap
  defaultValues?: Record<string, unknown>
}

/** <zh/> 列配置：默认列定义、列拖拽、侧边面板与表头分组 | <en/> Column config: default col def, column dragging, side panel and header grouping */
export interface ColumnConfig<T = any> {
  /** <zh/> 会合并到每列 | <en/> Merged into every column definition */
  defaultColDef?: Partial<AdvColumn<T>>
  columnTypes?: Record<string, Partial<AdvColumn<T>>>
  autoSizeColumns?: boolean
  /** <zh/> 列是否可拖拽排序，默认 false | <en/> Whether columns can be reordered by dragging, defaults to false */
  columnDraggable?: boolean
  sidePanel?: boolean
  sidePanelPosition?: 'left' | 'right'
  sidePanelDefaultOpen?: boolean
  /** <zh/> 默认 true | <en/> Defaults to true */
  sidePanelDestroyOnClose?: boolean
  /**
   * <zh/> 表头分组动态编排配置
   * <zh/> 启用后用户可在侧边面板中创建/删除/重命名分组列、拖拽列跨层级移动，
   * <zh/> 实现表头分组结构的运行时调整。
   * <en/> Dynamic header group orchestration config.
   * <en/> When enabled, users can create/delete/rename group columns and drag columns across
   * <en/> levels in the side panel, adjusting the header group structure at runtime.
   *
   * @example
   * ```ts
   * :column-config="{
   *   columnGroup: {
   *     enabled: true,
   *     sidePanelPosition: 'right',
   *     maxDepth: 3,
   *     allowCreateGroup: true,
   *     allowRename: true,
   *     allowDeleteGroup: true,
   *   }
   * }"
   * ```
   */
  columnGroup?: ColumnGroupConfig
}

/** <zh/> 行配置：行 key、行选择与行拖拽 | <en/> Row config: row key, row selection and row dragging */
export interface RowConfig<T = any> {
  rowKey?: string | ((row: T) => string | number)
  /**
   * <zh/> 行选择模式。注意：表头全选 / `toggleAllSelection` 的作用域随渲染模式变化
   * <zh/>（`mode="default"` 为当前页，`mode="virtual"` 为全部筛选结果，见 `RendererCaps.selectionScope`），
   * <zh/> 切换 mode 会改变全选语义；与模式无关的当前页全选请用 `selectAllOnCurrentPage`。
   * <zh/> 服务端分页下 `virtual` 的“全部筛选结果”仍仅为当前页（服务端切片），真全选请走受控 `selectedRowKeys`。
   * <en/> Row selection mode. Note: header select-all / `toggleAllSelection` scope follows the render mode
   * <en/> (`mode="default"` selects the current page, `mode="virtual"` selects all filtered rows, see
   * <en/> `RendererCaps.selectionScope`); switching mode changes select-all semantics. For a mode-independent
   * <en/> current-page select-all use `selectAllOnCurrentPage`.
   * <en/> Under server-side pagination virtual's "all filtered rows" is still the current page only
   * <en/> (server slice); true select-all goes through controlled `selectedRowKeys`.
   */
  rowSelection?: 'single' | 'multiple'
  /**
   * <zh/> 跨页保留选中（默认 false）。服务端分页下翻页时当前页数据被移除，
   * <zh/> 数据刷新会从选中集剪除不在新数据中的行；设为 true 时保留选中集，
   * <zh/> 由外部通过 selectionChange 同步的 rowKey 维持跨页选择。
   * <zh/> 注意 keys 全但 rows 仅本页：`getSelectedRows()` / `selectionChange.rows`
   * <zh/> 只含当前页行（dev 有提示），跨页导出/提交请用 `meta.keys` 自拼全量行。
   * <en/> Keep selection across pages (default false). With server-side pagination,
   * <en/> the current page's rows leave the dataset on page change and get pruned
   * <en/> from the selection; set to true to keep the selection set, relying on
   * <en/> externally-synced rowKeys via selectionChange to maintain cross-page selection.
   * <en/> Note keys-complete but rows current-page-only: `getSelectedRows()` /
   * <en/> `selectionChange.rows` hold current-page rows (dev warns); resolve full rows
   * <en/> via `meta.keys` for cross-page export/submit.
   */
  keepSelectionAcrossPages?: boolean
  /**
   * <zh/> 允许单击多选（无需 Ctrl/Shift） | <en/> 允许单击multi-select（无需 Ctrl/Shift）
   * @see <zh/> rowSelection 仅在 'multiple' 模式下生效 | <en/> rowSelection only effective when 'multiple' mode
   */
  rowMultiSelectWithClick?: boolean
  /**
   * <zh/> 禁止点击行选中 | <en/> 禁止clickrowselect
   * @see <zh/> rowSelection 需配合行选择模式使用 | <en/> rowSelection requires row selection mode
   */
  suppressRowClickSelection?: boolean
  /**
   * <zh/> 点击行触发选中（默认 true）。false 时仅选择列 checkbox/radio 生效 | <en/> clickrowtriggersselect（default true）。false 时仅选择column checkbox/radio takes effect
   * @see <zh/> rowSelection 需配合行选择模式使用 | <en/> rowSelection requires row selection mode
   */
  rowClickSelect?: boolean
  /** <zh/> 启用行拖拽排序 | <en/> Enable row drag sorting */
  rowDraggable?: boolean
  /** <zh/> 拖拽手柄 CSS 选择器，指定后仅手柄区域可触发拖拽 | <en/> Drag handle CSS selector; when set, only the handle area can trigger dragging */
  rowDragHandle?: string
  /**
   * <zh/> 拖拽时禁止行实时移动，仅显示插入指示线，松开后才执行重排
   * <zh/> 默认 false
   * <en/> Disable real-time row movement while dragging; only show the insertion indicator line
   * <en/> and perform the reorder after release. Defaults to false
   */
  suppressMoveWhenRowDragging?: boolean
  /**
   * <zh/> 判断行是否可放置到目标位置，返回 false 时显示无效放置反馈 | <en/> determinerowwhether可放置到targetposition，returns false 时show无效放置反馈
   * @param context - <zh/> 拖拽上下文对象 | <en/> drag context object
   * @param context.sourceRow - <zh/> 被拖拽的行数据 | <en/> 被drag的row data
   * @param context.targetRow - <zh/> 目标位置行数据 | <en/> 目标位置row data
   * @param context.position - <zh/> 插入位置：'before' 目标行上方 / 'after' 目标行下方 | <en/> insertion position：'before' above target row / 'after' below target row
   */
  isRowValidDropPosition?: (context: {
    sourceRow: T
    targetRow: T
    position: 'before' | 'after'
  }) => boolean
  /** <zh/> 返回 false 取消拖拽 | <en/> Return false to cancel the drag */
  beforeDrag?: (context: {
    sourceRow: T
    sourceIndex: number
    targetRow: T
    targetIndex: number
    fullData: T[]
  }) => Promise<boolean> | boolean
}

/** <zh/> 筛选配置：快速筛选、浮动筛选与侧边面板 | <en/> Filter config: quick filter, floating filter and side panel */
export interface FilterConfig {
  /** <zh/> 毫秒 | <en/> Milliseconds */
  quickFilterDebounce?: number
  /** <zh/> 快速搜索行文本缓存上限，默认 5000 | <en/> Quick filter row text cache size limit, default 5000 */
  quickFilterCacheSize?: number
  /** <zh/> 启用列头浮动筛选 | <en/> Enable floating filter in column headers */
  floatingFilter?: boolean
  sidePanel?: boolean
  sidePanelPosition?: 'left' | 'right'
  sidePanelDefaultOpen?: boolean
  /** <zh/> 默认 true | <en/> Defaults to true */
  sidePanelDestroyOnClose?: boolean
}

/**
 * 排序配置 | Sort configuration
 */
export interface SortConfig {
  /**
   * <zh/> 多列排序（Shift+点击）允许的最大排序列数，默认不限。
   * <zh/> 超出上限时淘汰最早的排序列（FIFO），与主流表格行为一致；
   * <zh/> 设为 1 等价于关闭多列排序。
   * <en/> Maximum number of sort columns allowed in multi-sort (Shift+click), unlimited by default.
   * <en/> When exceeded, the oldest sort column is evicted (FIFO), consistent with mainstream grids;
   * <en/> setting to 1 effectively disables multi-sort.
   */
  maxSortColumns?: number
}

/**
 * <zh/> 数据管线阶段——列筛 / 快筛 / 外部筛 / 排序（顺序可配）
 * <en/> Data pipeline stages — column filter / quick filter / external filter / sort (order configurable)
 */
export type DataPipelineStage = 'columnFilter' | 'quickFilter' | 'externalFilter' | 'sort'

/**
 * <zh/> 数据管线配置 | <en/> Data pipeline configuration
 */
export interface DataPipelineConfig {
  /**
   * <zh/> 管线顺序：4 段的排列，缺省为 `['columnFilter','quickFilter','externalFilter','sort']`（历史行为）。
   * <zh/> 如将权限类外部筛前置可减少后续计算：`['externalFilter','columnFilter','quickFilter','sort']`。
   * <zh/> 非法值（缺段/重复/未知）回退默认并 devWarn。
   * <en/> Pipeline order: a permutation of the 4 stages; defaults to the historical order.
   * <en/> Invalid values fall back to default with a dev warning.
   *
   * @example
   * ```ts
   * :data-pipeline="{ order: ['externalFilter', 'columnFilter', 'quickFilter', 'sort'] }"
   * ```
   */
  order?: DataPipelineStage[]
}

/**
 * <zh/> 合并配置 — 行级、列级和声明式合并规则
 * <zh/> 支持扁平化简写：当值为 `Record<string, ColumnRowSpanConfig>` 且不含 `rows`/`cols`/`ranges` 键时，
 * <zh/> 自动等价于 `rows`。
 * <en/> Span config — row-level, column-level and declarative merge rules.
 * <en/> Flat shorthand is supported: when the value is a `Record<string, ColumnRowSpanConfig>`
 * <en/> without `rows`/`cols`/`ranges` keys, it is automatically equivalent to `rows`.
 *
 * @example
 * ```ts
 * spanConfig: { department: true }
 * spanConfig: {
 *   rows: { department: true, salary: (a, b) => a.salary === b.salary },
 *   cols: { firstName: true },
 *   ranges: [{ row: 0, col: 0, rowspan: 2, colspan: 2 }],
 * }
 * ```
 */
export interface SpanConfig {
  rows?: RowSpanCellsConfig
  cols?: ColSpanCellsConfig
  ranges?: SpanRange[]
}

/**
 * <zh/> 尺寸配置 — 覆盖默认尺寸预设中的表头高度、单元格内边距、字体大小等 | <en/> sizeconfig — 覆盖defaultsize预设中的headerheight、cell内边距、字体size等
 */
export interface SizeConfig {
  /** <zh/> 影响虚拟模式 headerHeight 计算和多级表头 rowspan | <en/> Affects virtual-mode headerHeight calculation and multi-level header rowspan */
  headerCellHeight?: number
  /** <zh/> 支持 CSS 简写如 "8px 12px" 或 [垂直, 水平] 数组 | <en/> Supports CSS shorthand like "8px 12px" or a [vertical, horizontal] array */
  cellPadding?: string | [number, number]
  /** <zh/> 语法同 cellPadding | <en/> Same syntax as cellPadding */
  headerCellPadding?: string | [number, number]
  /** <zh/> 仅 floatingFilter 开启时生效 | <en/> Only effective when floatingFilter is enabled */
  floatingFilterHeight?: number
  cellFontSize?: string
  /** <zh/> 虚拟模式行高，用于 autoPageSize 计算 | <en/> Virtual-mode row height, used for autoPageSize calculation */
  rowHeight?: number
  /** <zh/> 仅虚拟模式生效 | <en/> Only effective in virtual mode */
  summaryRowHeight?: number
}

/**
 * <zh/> 总计行位置——对齐 AG Grid grandTotalRow
 * <zh/> - 'top'：首行（可滚动，默认 sticky 吸顶）
 * <zh/> - 'bottom'：末行/表尾（默认，复用现有 footer）
 * <zh/> - 'pinnedTop'：固定顶部（复用 rowPin 顶部固定行，滚动始终可见）
 * <zh/> - 'pinnedBottom'：固定底部（复用 rowPin 底部固定行，滚动始终可见）
 * <en/> Grand total row position — aligned with AG Grid grandTotalRow
 * <en/> - 'top': first row (scrollable, sticky top by default)
 * <en/> - 'bottom': last row / footer (default, reuses existing footer)
 * <en/> - 'pinnedTop': pinned top (reuses rowPin top strip, always visible)
 * <en/> - 'pinnedBottom': pinned bottom (reuses rowPin bottom strip, always visible)
 */
export type GrandTotalRowPosition = 'top' | 'bottom' | 'pinnedTop' | 'pinnedBottom'

/**
 * <zh/> 分组小计行位置——对齐 AG Grid groupTotalRow 取值
 * <en/> Group total row position — aligned with AG Grid groupTotalRow values
 */
export type GroupTotalRowPosition = 'top' | 'bottom'

/**
 * <zh/> 分组小计行回调参数的节点信息——对齐 AG Grid GetGroupIncludeTotalRowParams.node
 * <en/> Node info for the group total row callback — aligned with AG Grid GetGroupIncludeTotalRowParams.node
 */
export interface GroupTotalRowNode {
  /** <zh/> 分组层级（0 = 第一级）| <en/> Group level (0 = first level) */
  level: number
  /** <zh/> 分组字段名 | <en/> Group field name */
  field: string
  /** <zh/> 分组字段值 | <en/> Group field value */
  value: unknown
  /** <zh/> 分组唯一键（内部复合 key）| <en/> Group unique key (internal composite key) */
  key: string
  /** <zh/> 组内叶子数据行数 | <en/> Leaf data row count in the group */
  rowCount: number
}

/**
 * <zh/> 分组小计行回调——对齐 AG Grid groupTotalRow 回调
 * <zh/> 返回 'top'/'bottom' 为该分组插入小计行，返回 undefined 跳过该分组。
 * <en/> Group total row callback — aligned with AG Grid groupTotalRow callback
 * <en/> Return 'top'/'bottom' to insert a total row for the group, undefined to skip it.
 */
export type GroupTotalRowCallback = (params: { node: GroupTotalRowNode }) => GroupTotalRowPosition | undefined

/**
 * <zh/> 分组小计行选项——固定位置或按分组回调选择性显示
 * <en/> Group total row option — fixed position or selective per-group callback
 */
export type GroupTotalRowOption = GroupTotalRowPosition | GroupTotalRowCallback

/**
 * <zh/> 合计标签取值参数——对齐 AG Grid totalValueGetter
 * <en/> Total label getter params — aligned with AG Grid totalValueGetter
 */
export interface TotalValueGetterParams {
  /** <zh/> 节点层级：-1 = Grand Total，>=0 = 分组小计层级 | <en/> Node level: -1 = grand total, >=0 = group total level */
  level: number
  /** <zh/> 分组字段值（Grand Total 时为 undefined）| <en/> Group field value (undefined for grand total) */
  value: unknown
  /** <zh/> 分组字段名（Grand Total 时为 undefined）| <en/> Group field name (undefined for grand total) */
  field?: string
  /** <zh/> 是否 Grand Total 行 | <en/> Whether this is the grand total row */
  isGrandTotal: boolean
}

/**
 * <zh/> 合计标签自定义——对齐 AG Grid autoGroupColumnDef.cellRendererParams.totalValueGetter
 * <en/> Total label customization — aligned with AG Grid autoGroupColumnDef.cellRendererParams.totalValueGetter
 */
export type TotalValueGetter = (params: TotalValueGetterParams) => string

/**
 * <zh/> 粘性合计行抑制——对齐 AG Grid suppressStickyTotalRow
 * <zh/> - true：全部取消粘性（滚动时滑出视口）
 * <zh/> - 'grand'：仅 Grand Total 取消粘性
 * <zh/> - 'group'：仅分组小计取消粘性
 * <zh/> - false/undefined：默认粘性
 * <en/> Sticky total row suppression — aligned with AG Grid suppressStickyTotalRow
 * <en/> - true: suppress all sticky totals (scroll out of viewport)
 * <en/> - 'grand': suppress grand total stickiness only
 * <en/> - 'group': suppress group total stickiness only
 * <en/> - false/undefined: sticky by default
 */
export type SuppressStickyTotalRow = boolean | 'grand' | 'group'

/**
 * <zh/> UI 配置 — 控制表格的尺寸主题、命名空间、空数据文本、合计行等外观行为
 * <en/> UI config — controls appearance behaviors such as size theme, namespace, empty text and summary rows
 */
export interface UiConfig<T = any> {
  size?: string
  namespace?: string
  columnEmptyText?: string
  showSummary?: boolean
  summaryMethod?: (params: { columns: ProcessedColumn[], data: T[] }) => (VNode | string)[] // Note: 聚合方法接收任意行数组，由实现方决定字段访问 | aggregation method receives arbitrary row arrays, field access decided by implementer
  sumText?: string
  /**
   * <zh/> Grand Total 总计行位置——对齐 AG Grid grandTotalRow
   * <zh/> 未设置时：showSummary=true 等价 'bottom'；showSummary=false/undefined 则无总计行。
   * <zh/> 设置后优先级高于 showSummary（显式位置即启用）。
   * <en/> Grand total row position — aligned with AG Grid grandTotalRow
   * <en/> When unset: showSummary=true equals 'bottom'; otherwise no grand total.
   * <en/> Explicit position wins over showSummary when set.
   */
  grandTotalRow?: GrandTotalRowPosition
  /**
   * <zh/> 分组小计行——对齐 AG Grid groupTotalRow
   * <zh/> 仅 rowGroupConfig 启用时生效；字符串为全部分组统一位置，回调可按分组选择性返回位置/undefined。
   * <en/> Group total rows — aligned with AG Grid groupTotalRow
   * <en/> Only effective when rowGroupConfig is enabled; string applies to all groups, callback enables selective per-group placement.
   */
  groupTotalRow?: GroupTotalRowOption
  /**
   * <zh/> 保留分组头聚合值——对齐 AG Grid groupSuppressBlankHeader
   * <zh/> 分组存在小计行时，默认隐藏组头行的聚合值（避免重复）；设为 true 则保留显示。
   * <en/> Keep group header aggregates — aligned with AG Grid groupSuppressBlankHeader
   * <en/> When a group has a total row, group header aggregates are hidden by default; set true to keep them.
   */
  groupSuppressBlankHeader?: boolean
  /**
   * <zh/> 合计标签自定义——对齐 AG Grid totalValueGetter
   * <zh/> 未设置时回退 sumText（Grand Total）/ `Sub Total (${value})`（分组小计）。
   * <en/> Total label customization — aligned with AG Grid totalValueGetter
   * <en/> Falls back to sumText (grand) / `Sub Total (${value})` (group) when unset.
   */
  totalValueGetter?: TotalValueGetter
  /**
   * <zh/> 粘性合计行抑制——对齐 AG Grid suppressStickyTotalRow
   * <en/> Sticky total row suppression — aligned with AG Grid suppressStickyTotalRow
   */
  suppressStickyTotalRow?: SuppressStickyTotalRow
  /**
   * <zh/> 表格实例 ID——用于列状态持久化 key、拖拽容器定位与多实例隔离。不传自动生成。
   * <zh/> 同一页面存在多个表格时**必须**传入互不相同的显式值，否则列持久化永不命中、
   * <zh/> 拖拽容器可能定位到错误的表格（dev 会对重复 ID 告警）。
   * <en/> Table instance ID — backs column-state persistence keys, drag-container lookup and
   * <en/> multi-instance isolation. Auto-generated when absent.
   * <en/> Pages hosting multiple tables **must** pass distinct explicit values; otherwise persisted
   * <en/> column state never hits and drag containers may resolve to the wrong table
   * <en/> (duplicates trigger a dev warning).
   */
  tableId?: string
  /** <zh/> 可覆盖 size 预设中的个别值 | <en/> Can override individual values in the size preset */
  sizeConfig?: SizeConfig
}

/**
 * <zh/> 范围选择配置 — enabled 开关，autoCopy 控制选择完成时自动复制到剪贴板。
 *
 * <zh/> 归位于本文件：所有 `AdvTableProps` 的对象型配置（search / pagination / rowConfig / filterConfig / uiConfig …）
 * <zh/> 统一存放于此，`table-props.ts` 只保留 props 形状本身；此前它单独留在 `table-props.ts` 内，
 * <zh/> 与桶文件声明的归位规则相矛盾（查找配置类型时需两处翻找）。
 *
 * <en/> Range selection config — the `enabled` switch; `autoCopy` copies the selection to the clipboard
 * <en/> once selection completes.
 *
 * <en/> Placed in this file on purpose: every object-shaped `AdvTableProps` config (search / pagination /
 * <en/> rowConfig / filterConfig / uiConfig …) lives here, while `table-props.ts` keeps only the prop shape
 * <en/> itself. It previously sat inside `table-props.ts`, contradicting the filing rule stated by the types
 * <en/> barrel (config lookups required searching two files).
 */
export interface RangeSelectionConfig {
  enabled?: boolean
  /**
   * <zh/> 选择完成时自动复制到剪贴板 | <en/> Auto-copy to clipboard when selection completes
   */
  autoCopy?: boolean
}
