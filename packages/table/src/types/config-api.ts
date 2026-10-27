import type { ComputedRef, CSSProperties, Ref, ShallowRef } from 'vue'
import type { ProcessedColumn } from './column'
import type { CellEditStopReason, EditingCellState } from './edit'
import type { ColumnFilterValue } from './filter'
import type { RowKeyMeta, RowRect } from './row-rect'
import type { SortOrder } from './sort'

/** <zh/> 通用无返回值回调签名，用于各类状态变更钩子 | <en/> Generic void-returning callback signature, used by various state-change hooks */
export type AnyFunction = (...args: unknown[]) => void

/** <zh/> 轮询配置 — time 为间隔毫秒，immediate 控制首屏是否立即拉取，onChange/onSuccess/onFail 为状态回调 | <en/> Polling config — time is the interval in milliseconds, immediate controls whether to fetch immediately on first render, onChange/onSuccess/onFail are state callbacks */
export interface PollingOptions {
  time: number
  immediate: boolean
  startTip?: string
  stopTip?: string
  onChange?: AnyFunction
  onSuccess?: AnyFunction
  onFail?: AnyFunction
}

/** <zh/> 货币格式配置 — symbol 为货币符号，locale 为 Intl 国际化区域 | <en/> Currency format config — symbol is the currency symbol, locale is the Intl localization locale */
export interface CurrencyConfig {
  symbol: string
  locale: string
}

/**
 * <zh/> 表格上下文 — 通过 provide/inject 提供给所有子组件，
 * <zh/> 包含刷新、加载状态、空数据文本、货币/国际化配置等核心信息
 * <en/> Table context — provided to all child components via provide/inject,
 * <en/> containing core info such as refresh, loading state, empty text, currency/i18n config
 */
export interface TableContext {
  refresh: () => Promise<void>
  loading: ComputedRef<boolean>
  columnEmptyText: ComputedRef<string>
  /**
   * <zh/> 当前生效的 EP 命名空间（`core.namespace`：props.uiConfig.namespace ?? EP ConfigProvider namespace ?? 'el'）。
   * <zh/> 需要发出 EP 风格类名（展开图标/缩进）时经 `ep-selectors.ts` 构造器由此值生成，禁止硬编码 `el-` 前缀。
   * <en/> Effective EP namespace (`core.namespace`: props.uiConfig.namespace ?? EP ConfigProvider namespace ?? 'el').
   * <en/> When emitting EP-style class names (expand icons/indents), build them from this value via the
   * <en/> `ep-selectors.ts` builders; hard-coding the `el-` prefix is forbidden.
   */
  namespace: ComputedRef<string>
  currency: ComputedRef<CurrencyConfig>
  dayjsLocale: Ref<string>
  /** <zh/> 用于 O(1) 查找 | <en/> Used for O(1) lookup */
  rowKeyMeta: ShallowRef<RowKeyMeta>
  /** <zh/> display:none 或 keepalive 隐藏时为 0 | <en/> 0 when hidden via display:none or keepalive */
  containerWidth: Ref<number>
  /** <zh/> containerWidth > 0 时为 true | <en/> true when containerWidth > 0 */
  containerVisible: ComputedRef<boolean>
  /**
   * <zh/> 查询行的逻辑索引（排除 DetailRow 后的索引），供 index/indexBorder valueType 使用
   * <zh/> 由 rowExpandApi.getLogicalIndex 桥接，避免 mutate 用户行对象
   *
   * <en/> Look up a row's logical index (excluding DetailRows) for index/indexBorder valueType
   * <en/> Bridged from rowExpandApi.getLogicalIndex to avoid mutating user row objects
   */
  getLogicalIndex?: (row: any) => number | undefined
}

/**
 * 编辑 API — 通过 provide/inject 提供。
 *
 * 泛型参数 T 为行数据类型，约束编辑值与行数据的类型；
 * 编辑器组件类型由用户运行时配置决定（getEditorComponent 返回值），
 * 因 Vue DefineComponent 与 Component 之间存在复杂协变，此处保留 unknown 作为返回值。
 *
 * <en/> Edit API — provided via provide/inject.
 * <en/> Generic parameter T is the row data type, constraining edit value and row types;
 * <en/> editor component type is decided by user runtime config (getEditorComponent return value).
 * <en/> Due to complex variance between Vue DefineComponent and Component, unknown is kept as return value.
 *
 * @typeParam T - <zh/> 表格行数据类型 | <en/> table row data type
 */
export interface TableEditApi<T = any> {
  editingCell: Ref<EditingCellState | null | undefined>
  /** <zh/> 当前编辑值；类型由列编辑器运行时决定，使用 unknown 替代 any 强制消费方收窄 | <en/> Current editing value; type decided at runtime by column editor, using unknown instead of any forces consumers to narrow */
  editingValue: Ref<unknown>
  /** <zh/> 仅 fullRow 模式有效 | <en/> Only effective in fullRow mode */
  editingRowIndex: Ref<number | null | undefined>
  /** <zh/> 进入编辑；初始值类型由列编辑器运行时决定 | <en/> Start editing; initial value type decided at runtime by column editor */
  startEditing: (params: { rowIndex: number, prop: string, columnKey: string, value: unknown }) => void
  stopEditing: (reason: CellEditStopReason, commit?: boolean) => void
  /** <zh/> 获取编辑器组件；返回值为 Vue 组件类型，因运行时多态保留 unknown | <en/> Get editor component; return is Vue component type, kept as unknown due to runtime polymorphism */
  getEditorComponent: (col: ProcessedColumn, row?: T, rowIndex?: number) => unknown
  isColumnEditable: (col: ProcessedColumn) => boolean
  /** <zh/> 更新编辑值；类型由列编辑器运行时决定 | <en/> Update editing value; type decided at runtime by column editor */
  updateEditingValue: (val: unknown) => void
  isCellEditing: (rowIndex: number, columnKey: string) => boolean
  /** <zh/> 仅全行模式有效 | <en/> Only effective in full-row mode */
  /** <zh/> 单元格编辑值；类型由列编辑器运行时决定 | <en/> Cell editing value; type decided at runtime by column editor */
  getCellEditingValue: (columnKey: string) => unknown
  /** <zh/> 仅全行模式有效 | <en/> Only effective in full-row mode */
  updateCellEditingValue: (columnKey: string, val: unknown) => void
  /** <zh/> 用于 Tab/Enter 导航 | <en/> Used for Tab/Enter navigation */
  findNextEditableCell: (fromRowIndex: number, fromColumnKey: string, direction?: 'next' | 'previous', vertical?: boolean) => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 用于 Home 键导航 | <en/> Used for Home key navigation */
  findFirstEditableCell: (rowIndex: number) => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 用于 End 键导航 | <en/> Used for End key navigation */
  findLastEditableCell: (rowIndex: number) => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 获取选择器参数；行数据为运行时多态类型，返回 unknown 由消费方收窄 | <en/> Get selector params; row data is runtime polymorphic, return unknown for consumer to narrow */
  getEditorSelectorParams: (col: ProcessedColumn, row?: T, rowIndex?: number) => unknown
  /** <zh/> 值与原始值不同时返回 true | <en/> Returns true when the value differs from the original */
  isCellDirty: (rowIndex: number, columnKey: string) => boolean
  /** <zh/> 校验当前编辑中的单元格值（不提交），供编辑器 trigger: 'input'/'change' 时调用 | <en/> Validate the currently editing cell value (without committing), called by editors on trigger: 'input'/'change' */
  validateCurrentValue: () => Promise<void>
}

/**
 * <zh/> 筛选与排序操作 API，通过 provide/inject 提供以减少渲染器 props diff
 * <en/> Filter and sort operations API, provided via provide/inject to reduce renderer props diff
 */
export interface TableFilterSortOps {
  getFilterValue?: (key: string) => ColumnFilterValue | undefined
  setFilter?: (key: string, val: ColumnFilterValue) => void
  isColumnFiltered?: (key: string) => boolean
  getEnumOptions?: (key: string) => any[] | undefined
  filterT?: (key: string) => string
  getSortOrder?: (key: string) => SortOrder
  getSortIndex?: (key: string) => number
  onToggleSort?: (prop: string, event?: MouseEvent) => void
  /** <zh/> 重置单个列筛选（保留用户在该列上的输入状态） | <en/> Reset a single column filter (keeps the user's input state on that column) */
  resetColumnFilter?: (key: string) => void
  /** <zh/> 重置全部列筛选 | <en/> Reset all column filters */
  resetAllFilters?: () => void
  /** <zh/> 清除全部排序 | <en/> Clear all sorting */
  clearSort?: () => void
}

/** <zh/> 共享列筛选 Popover API——N 个列筛选入口收敛为 1 个 ElPopover 实例 | <en/> Shared column-filter popover API — N column filter entries converge into 1 ElPopover instance */
export interface TableSharedFilterPopoverApi {
  readonly activeColumnKey: Readonly<ShallowRef<string | null>>
  readonly activeFilterType: Readonly<ShallowRef<string | null>>
  readonly visible: Readonly<Ref<boolean>>
  /** <zh/> 传给 ElPopover 的响应式 props（含 visible + disabled + virtualTriggering + virtualRef） | <en/> Reactive props passed to ElPopover (includes visible + disabled + virtualTriggering + virtualRef) */
  readonly popoverProps: ComputedRef<Record<string, unknown>>
  open: (columnKey: string, el: HTMLElement, filterType: string) => void
  close: () => void
  toggle: (columnKey: string, el: HTMLElement, filterType: string) => void
}

/**
 * <zh/> 共享表头提示 API——通过 provide/inject 提供给 column-renderer，
 * <zh/> 将 N 个 per-column ElTooltip (col.tooltip) 收敛为 1 个共享实例
 * <en/> Shared header tooltip API — provided to column-renderer via provide/inject,
 * <en/> collapsing N per-column ElTooltip instances (col.tooltip) into 1 shared instance
 */
export interface TableSharedHeaderTooltipApi {
  onHeaderEnter: (el: HTMLElement, content: string) => void
  onHeaderLeave: () => void
}

/** <zh/> 悬浮操作层 API——行 hover 时展示的操作层状态与开关 | <en/> Hover action layer API — state and toggles of the row-hover action layer */
export interface TableHoverLayerApi {
  hoverRowKey: Ref<string | null>
  hoverLayerVisible: Ref<boolean>
  hoverLayerCollapsed: Ref<boolean>
  hoverLayerStyle: ComputedRef<CSSProperties>
  hoverOptionColumns: ComputedRef<ProcessedColumn[]>
  hoverOptionTeleport: ComputedRef<boolean | undefined>
  /** <zh/> Teleport 是否真正可用（考虑祖先 transform 等因素） | <en/> Whether Teleport is actually usable (considering ancestor transforms and other factors) */
  shouldUseTeleport: ComputedRef<boolean>
  onToggleCollapse: (e: Event) => void
  /**
   * <zh/> 手动滚动表格内容区，供 teleport 模式下 RowActionBar 上滚轮使用。
   * <zh/> 返回 true 表示实际滚动了（delta 被消耗），返回 false 表示未滚动（表格在边缘，
   * <zh/> 调用方应让浏览器处理默认滚动行为）。
   * <en/> Manually scroll the table body. Returns true if the scroll was actually applied
   * <en/> (delta was consumed), false if the table is at the edge of its scroll range
   * <en/> and the caller should fall back to the browser's default scroll behavior.
   */
  scrollBody?: (dx: number, dy: number) => boolean
  /**
   * <zh/> Teleport 悬浮操作条的独立渲染域——渲染器只装配该对象，ref 由 overlay 组件在自己的 render 内读取，
   * <zh/> 避免 hover 状态进入渲染器 render effect 触发全表（默认模式全部行 × 列）重渲染。
   * <en/> Standalone render domain of the teleported hover action bar — renderers only assemble this object;
   * <en/> the overlay component reads the refs inside its own render effect, keeping hover state out of the
   * <en/> renderer's render effect (which would otherwise re-render every row × column in default mode).
   */
  teleportOverlay?: TableHoverTeleportOverlayApi
}

/** <zh/> Teleport 悬浮操作条渲染域 | <en/> Teleport hover action bar render domain */
export interface TableHoverTeleportOverlayApi {
  /** <zh/> 当前悬停行数据（离开延迟后置空） | <en/> Current hovered row data (nulled after the leave delay) */
  hoverRowData: Ref<any>
  /** <zh/> 当前悬停行索引，-1 表示无 | <en/> Current hovered row index, -1 when none */
  hoverRowIndex: Ref<number>
  /** <zh/> 悬停行在视口中的矩形，undefined 时操作条回到隐藏态 | <en/> Hovered row rect in viewport; undefined hides the bar */
  rowRect: Ref<RowRect | undefined>
  /** <zh/> 滚动中标志（操作条经 CSS visibility 隐藏） | <en/> Scrolling flag (bar hidden via CSS visibility) */
  isScrolling: Ref<boolean>
  /** <zh/> teleport 操作列配置的层级 | <en/> z-index configured on the teleport option column */
  zIndex: ComputedRef<number | string | undefined>
  /** <zh/> 鼠标进入操作条（取消离开计时） | <en/> Pointer entered the bar (cancels the leave timer) */
  onEnter: () => void
  /** <zh/> 鼠标离开操作条（延迟隐藏） | <en/> Pointer left the bar (delayed hide) */
  onLeave: () => void
  /** <zh/> 强制隐藏（滚轮转发到表格 / 中键自动滚动） | <en/> Force hide (wheel forwarded to table / middle-click auto-scroll) */
  onForceHide: () => void
}

/** <zh/> 侧边筛选面板 API | <en/> Side filter panel API */
export interface FilterPanelApi {
  panelPosition: ComputedRef<'left' | 'right'>
  activeFilterKeys: ComputedRef<Set<string>>
  /** <zh/> 重置所有筛选（不关闭面板） | <en/> Reset all filters (keeps the panel open) */
  resetAllFilters: () => void
}
