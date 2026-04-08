import type { Slots } from 'vue'
import type { CheckStatus } from '../composables/selection/use-selection-state'
import type { ProcessedColumn } from '../types'
import type { DefaultRendererProps, RendererCommonProps, RendererProps, VirtualRendererProps } from '../types/renderer'
import type { RendererModeName } from '../types/renderer-caps'
import type { Translator } from '../types/translator'
import { SELECTION_COLUMN_WIDTH } from '../constants'
import { normalizeTableHeight } from './normalize-height'

/**
 * <zh/> 渲染器绑定属性类型——共享接口 + 各渲染器本地 props（originalColumns/canCollapse/...）。
 * <zh/> 键名统一 camelCase，与 RendererCommonProps 接口键一致，键漂移即编译报错。
 * <en/> Renderer bind-prop types — shared interface plus per-renderer local props.
 * <en/> camelCase keys match RendererCommonProps so key drift fails the build.
 */
export type BaseRendererBindProps<T = any> = RendererCommonProps<T> & {
  /**
   * <zh/> 渲染模式判别器——复活 isDefault/isVirtualRendererProps 死守卫；两渲染器组件声明接收后忽略，禁入 DOM（inheritAttrs: false）。
   * <en/> Render-mode discriminator — revives the dead isDefault/isVirtualRendererProps guards; both renderer components declare and ignore it, never reaching the DOM (inheritAttrs: false).
   */
  mode: RendererModeName
  originalColumns?: ProcessedColumn[]
  canCollapse?: (col: ProcessedColumn) => boolean
  isCollapsed?: (columnKey: string) => boolean
  collapsedState?: Record<string, boolean>
  collapsedVersion?: number
}

export type DefaultRendererBindProps<T = any> = DefaultRendererProps<T> & BaseRendererBindProps<T>

export type VirtualRendererBindProps<T = any> = VirtualRendererProps<T> & BaseRendererBindProps<T> & VirtualRendererPart

/** <zh/> 虚拟模式专属属性（独立接口，避免 Pick 约束漂移） | <en/> Virtual-only props (standalone interface, immune to Pick constraint drift) */
export interface VirtualRendererPart {
  headerCellHeight?: number
  floatingFilterHeight?: number
  rowHeight?: number
  footerHeight?: number
  filterState?: unknown
  sortState?: unknown
  getSpanInfo?: unknown
  spanEnabled?: boolean
  selectionWidth?: number
  estimatedRowHeight?: number | undefined
  /** <zh/> 合并×动态行高共存策略（特性开关，默认 'warn-only'） | <en/> Span×dynamic coexistence strategy (flag, default 'warn-only') */
  spanDynamicMode?: unknown
}

/**
 * <zh/> 渲染器 props 域输入——全部为解包后的普通值（SFC 在 computed 内组装后传入，响应式追踪不断），
 * <zh/> 故本模块零 Vue 导入、可脱离组件单测。
 * <en/> Renderer props domain inputs — all unwrapped plain values (assembled inside a computed in the
 * <en/> SFC so reactivity tracking holds); this module imports zero Vue APIs and is unit-testable standalone.
 */
export interface RendererPropsDomains<T = any> {
  visibleTree: ProcessedColumn[]
  selectionColumns: ProcessedColumn[]
  normalColumns: ProcessedColumn[]
  leafColumns: ProcessedColumn[]
  localColumns: ProcessedColumn[]
  canCollapse: (col: ProcessedColumn) => boolean
  isCollapsed: (columnKey: string) => boolean
  collapsedState: Record<string, boolean>
  collapsedVersion: number
  columnKeepAlive: boolean
  displayNormalColumns: ProcessedColumn[]
  hoverOptionColumns: ProcessedColumn[]
  hasHoverOptionColumns: boolean
  hoverOptionTeleport: boolean
  selectionColumnSyncKey: string
  dom: unknown
  renderRows: T[]
  rowKeyFn: (row: T) => string
  /** <zh/> 显式字段型 rowKey 的字段名（virtual 直传 EP :row-key） | <en/> Explicit field rowKey name (passed straight to EP :row-key in virtual) */
  rowKeyField?: string | number | symbol
  selectableData: T[]
  selectableFn: ((row: T, index: number) => boolean) | undefined
  /** <zh/> 全选状态——unknown 避免 utils 反向 import 选择域类型，赋值处收窄 | <en/> unknown so utils never imports the selection domain; narrowed at assignment */
  checkStatus: unknown
  prePaginationExpandedData: T[]
  t: Translator
  showSummary: boolean | undefined
  summaryMethod: unknown
  sumText: string | undefined
  grandTotalRow: unknown
  totalValueGetter: unknown
  /** <zh/> 合计行粘性抑制（联合形态，透传不解释）| <en/> Total-row sticky suppression (union shape; passed through opaquely) */
  suppressStickyTotalRow: unknown
  summaryData: T[]
  mergedLoading: boolean
  autoSizeColumns: boolean
  floatingFilter: unknown
  mergedBorder: boolean
  /** <zh/> 列宽拖拽开关（合并值可为字符串形态，透传不解释）| <en/> Column resize toggle (merged value may be a string; passed through opaquely) */
  mergedResizable: unknown
  mergedEmptyText: string | undefined
  rowSelection: string
  sizeConfig: { headerCellHeight: number, floatingFilterHeight: number, rowHeight: number, summaryRowHeight: number }
  filterState: unknown
  sortState: unknown
  getSpanInfo: unknown
  spanEnabled: boolean
  spanDynamicMode: unknown
  mergedSpanMethod: unknown
  editConfig: unknown
  rowClassName: unknown
  tooltipEffect: unknown
  tooltipOptions: unknown
  stripe: boolean
  highlightCurrentRow: boolean
  showHeader: boolean
  size: unknown
  tableLayout: unknown
  height: unknown
  estimatedRowHeight: number | undefined
  slots: Slots
}

/**
 * <zh/> 渲染器选择域——`table.vue → renderer → selection-column` 链路中与选择相关的全部字段。
 * <zh/> 中间层转发此域时应整体透传（后续收窄转发即以此接口为缝），新增选择字段只加此处。
 * <en/> Renderer selection domain — every selection-related field on the `table.vue → renderer → selection-column` path.
 * <en/> Intermediate layers should forward this domain as a whole (future forwarding-narrowing starts from this interface); new selection fields land here only.
 */
export interface RendererSelectionDomain<T = any> {
  selectionColumns: ProcessedColumn[]
  selectableData: T[]
  selectableFn: ((row: T, index: number) => boolean) | undefined
  checkStatus: CheckStatus
  selectionColumnSyncKey: string
  selectionMode: string
}

/**
 * <zh/> 从全量域中提取选择域——字段集合由 renderer-props-factory 单测锁定，增删即显式。
 * <en/> Pick the selection domain out of the full domains — the field set is pinned by the renderer-props-factory test; any add/remove is deliberate.
 */
export function pickRendererSelectionDomain<T>(d: RendererPropsDomains<T>): RendererSelectionDomain<T> {
  return {
    selectionColumns: d.selectionColumns,
    selectableData: d.selectableData,
    selectableFn: d.selectableFn,
    checkStatus: d.checkStatus as CheckStatus,
    selectionColumnSyncKey: d.selectionColumnSyncKey,
    selectionMode: d.rowSelection,
  }
}

/**
 * <zh/> 构建渲染器基础属性（两种模式共享）| <en/> Build base renderer props (shared between both modes)
 */
export function buildBaseRendererProps<T>(d: RendererPropsDomains<T>): BaseRendererBindProps<T> {
  return {
    columns: d.visibleTree,
    displayNormalColumns: d.displayNormalColumns,
    data: d.renderRows,
    forwardedSlots: d.slots,
    t: d.t,
    rowKey: d.rowKeyFn,
    rowKeyField: d.rowKeyField,
    ...pickRendererSelectionDomain(d),
    normalColumns: d.normalColumns,
    hoverOptionColumns: d.hoverOptionColumns,
    hasHoverOptionColumns: d.hasHoverOptionColumns,
    hoverOptionTeleport: d.hoverOptionTeleport,
    keepAliveHover: d.columnKeepAlive,
    showSummary: d.showSummary,
    summaryMethod: d.summaryMethod,
    sumText: d.sumText,
    grandTotalRow: d.grandTotalRow,
    totalValueGetter: d.totalValueGetter,
    suppressStickyTotalRow: d.suppressStickyTotalRow,
    summaryData: d.summaryData,
    loading: d.mergedLoading,
    originalColumns: d.localColumns,
    canCollapse: d.canCollapse,
    isCollapsed: d.isCollapsed,
    collapsedState: d.collapsedState,
    collapsedVersion: d.collapsedVersion,
    autoSizeColumns: d.autoSizeColumns,
    floatingFilter: d.floatingFilter,
    border: d.mergedBorder,
    resizable: d.mergedResizable,
    emptyText: d.mergedEmptyText,
    editConfig: d.editConfig,
    rowClassName: d.rowClassName,
    tooltipEffect: d.tooltipEffect,
    tooltipOptions: d.tooltipOptions,
    // <zh/> 高度单点归一化——非法值回退自适应，避免两种渲染器各自处理分叉
    // <en/> Single-point height normalization — illegal values fall back to auto height
    height: normalizeTableHeight(d.height as string | number | undefined),
    stripe: d.stripe,
    highlightCurrentRow: d.highlightCurrentRow,
    showHeader: d.showHeader,
    size: d.size,
    tableLayout: d.tableLayout,
    // <zh/> EP 内部 DOM 结构的唯一出口（与 caps 同源），渲染器自身不持有 EP 类名字符串
    // <en/> The only outlet for EP internal DOM structure (same source as caps)
    dom: d.dom,
  } as BaseRendererBindProps<T>
}

/**
 * <zh/> 构建虚拟模式专属属性。selectionWidth 为虚拟独占——default 侧透传只会落入 attrs 被丢弃。
 * <en/> Virtual-only props. selectionWidth is virtual-only — passing it to default lands in dropped attrs.
 */
export function buildVirtualPart<T>(d: RendererPropsDomains<T>): VirtualRendererPart {
  return {
    headerCellHeight: d.sizeConfig.headerCellHeight,
    floatingFilterHeight: d.sizeConfig.floatingFilterHeight,
    rowHeight: d.sizeConfig.rowHeight,
    footerHeight: d.showSummary ? d.sizeConfig.summaryRowHeight : 0,
    filterState: d.filterState,
    sortState: d.sortState,
    getSpanInfo: d.getSpanInfo,
    spanEnabled: d.spanEnabled,
    selectionWidth: SELECTION_COLUMN_WIDTH,
    // <zh/> 预估行高逃生通道——append/展开行触发的动态行高回退的用户侧开关
    // <en/> Estimated-row-height escape hatch for append/expand dynamic-height fallback
    estimatedRowHeight: d.estimatedRowHeight,
    // <zh/> 特性开关透传——undefined 等同 'warn-only'
    // <en/> Coexistence flag passthrough — undefined means 'warn-only'
    spanDynamicMode: d.spanDynamicMode,
  }
}

/** <zh/> default 模式完整属性 | <en/> Full default-mode props */
export function buildDefaultRendererProps<T>(d: RendererPropsDomains<T>): DefaultRendererBindProps<T> {
  return {
    ...buildBaseRendererProps(d),
    mode: 'default',
    leafColumns: d.leafColumns,
    spanMethod: d.mergedSpanMethod,
    rowHeight: d.sizeConfig.rowHeight,
  } as DefaultRendererBindProps<T>
}

/** <zh/> virtual 模式完整属性（virtual 用 visibleTree 而非 leafColumns，避免同名异义） | <en/> Full virtual-mode props */
export function buildVirtualRendererProps<T>(d: RendererPropsDomains<T>): VirtualRendererBindProps<T> {
  return {
    ...buildBaseRendererProps(d),
    ...buildVirtualPart(d),
    mode: 'virtual',
  } as VirtualRendererBindProps<T>
}

/** <zh/> 按模式分发——穷尽登记：漏登记任一模式即编译失败 | <en/> Dispatch by mode — exhaustive registry: a missing mode fails compilation */
export function buildRendererProps<T>(mode: RendererModeName, d: RendererPropsDomains<T>): DefaultRendererBindProps<T> | VirtualRendererBindProps<T> {
  const builders: Record<RendererModeName, (d: RendererPropsDomains<T>) => DefaultRendererBindProps<T> | VirtualRendererBindProps<T>> = {
    default: buildDefaultRendererProps,
    virtual: buildVirtualRendererProps,
  }
  return builders[mode](d)
}

export type { RendererProps }
