<!--
  @component TableVirtualRenderer
  @displayName 表格渲染器（ElTableV2 虚拟滚动）
  @displayName Table Virtual Renderer (ElTableV2)
  @description <zh/> 基于 ElTableV2 实现高性能虚拟滚动表格，支持列分组、固定列、选择列、行展开、行分组、行编辑、单元格合并、表头分组、浮动筛选、列拖拽、汇总行等功能
  @description <en/> High-performance virtual scrolling table based on ElTableV2, supports column grouping, fixed columns, selection columns, row expand, row grouping, row editing, cell merge, header grouping, floating filter, column resize, summary rows, etc.
  @category 数据展示 | Data Display
  @extends ElTableV2
  @since 1.0.0
-->
<script lang="tsx" setup generic="T">
import type { MaybeRefOrGetter, Slots } from 'vue'
import type { UseSelectionStateReturn } from '../../composables/selection/use-selection-state'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { VirtualRendererProps } from '../../types/renderer'
import type { VirtualRendererEmitsMap } from '../../types/renderer-emits'
import type { ITableRenderer } from '../../types/renderer-interface'
import type { PinStripCellEntry } from './pin-strip-row'
import type { VirtualSummaryFooterExpose } from './virtual-summary-footer.vue'
import { useElementSize } from '@vueuse/core'
import { ElAutoResizer, ElTableV2 } from 'element-plus'
import { computed, inject, shallowRef, toValue, useAttrs, watch } from 'vue'
import { useHeaderStyleReconcile } from '../../composables/rendering/use-header-style-reconcile'
import { useMergedLeafColumns } from '../../composables/rendering/use-renderer-common'
import { DEFAULT_ROW_HEIGHT } from '../../constants'
import {
  advTableIsRowDraggingKey,
  advTableKey,
  advTablePerformanceProfileKey,
  advTableRowExpandKey,
  advTableRowGroupKey,
  advTableRowPinKey,
  advTableSelectionKey,
  advTableTreeKey,
} from '../../types/injection-keys'
import { EMPTY_ROW, getColumnKey, getHoverOptionZIndex } from '../../utils/shared'
import RowActionBar from '../cell-renderers/row-action-bar.vue'
import { filterTeleportHoverColumns } from '../renderer-core/column-build-shared'
import { pickGridA11yAttrs, vGridA11y } from '../renderer-core/grid-a11y-attrs'
import { useRendererLocale } from '../renderer-core/render-helpers'
import { createAppendRowData } from './append-row-helpers'
import { PinStripRow } from './pin-strip-row'
import { useV2GridCore } from './use-v2-grid-core'
import { useV2GridShell } from './use-v2-grid-shell'
import { useV2Hover } from './use-v2-hover'
import { useV2Pinning } from './use-v2-pinning'
import { useV2ScrollApi } from './use-v2-scroll-api'
import { useV2ScrollRuntime } from './use-v2-scroll-runtime'
import VirtualSummaryFooter from './virtual-summary-footer.vue'

defineOptions({ name: 'TableVirtualRenderer', inheritAttrs: false })

/**
 * <zh/> 组件属性，继承 VirtualRendererProps 并扩展本地列分组折叠相关属性
 * <en/> Component props, extends VirtualRendererProps with local column group collapse related properties
 */
const props = withDefaults(defineProps<VirtualRendererProps & {
  /**
   * <zh/> 模式判别器——供 isVirtualRendererProps 守卫复活；本组件接收后忽略，禁入 DOM。
   * <en/> Mode discriminator — revives the isVirtualRendererProps guard; accepted and ignored, never reaches the DOM.
   */
  mode?: 'virtual'
  /** <zh/> 原始列配置（用于列分组折叠时查找原始列） | <en/> Original column config (used to find original columns during column group collapse) */
  originalColumns?: LocalColumn[]
  /** <zh/> 判断列是否可折叠 | <en/> Whether the column is collapsible */
  canCollapse?: (col: LocalColumn) => boolean
  /** <zh/> 判断指定列是否已折叠 | <en/> Whether the specified column is collapsed */
  isCollapsed?: (columnKey: string) => boolean
  /** <zh/> 列折叠状态映射 | <en/> Column collapse state map */
  collapsedState?: Record<string, boolean>
  /** <zh/> 列折叠版本号，用于触发重新计算 | <en/> Column collapse version number, used to trigger recalculation */
  collapsedVersion?: number
  /**
   * <zh/> 表头单元格高度（px）——必填（`withDefaults` 已兜底 50，调用方可省略）；
   * <zh/> 与 `V2RendererProps` 同强度必填，使本组件 props 可直接传给各子域而不经 `as any`。
   * <en/> Header cell height (px) — required (defaulted to 50 via `withDefaults`, omittable by callers);
   * <en/> same required strength as `V2RendererProps` so these props flow into sub-domains without `as any`.
   */
  headerCellHeight?: number
  /** <zh/> 浮动筛选行高度（px，同上必填，默认 32） | <en/> Floating filter row height (px, same required treatment, defaults to 32) */
  floatingFilterHeight?: number
  /** <zh/> 行高（px，同上必填，默认 DEFAULT_ROW_HEIGHT） | <en/> Row height (px, same required treatment, defaults to DEFAULT_ROW_HEIGHT) */
  rowHeight?: number
  /** <zh/> 是否根据内容自动计算列宽（由 table.vue 传入） | <en/> Whether to auto-size columns based on content (passed from table.vue) */
  autoSizeColumns?: boolean
}>(), {
  originalColumns: () => [],
  canCollapse: undefined,
  isCollapsed: undefined,
  collapsedState: () => ({}),
  collapsedVersion: 0,
  headerCellHeight: 50,
  floatingFilterHeight: 32,
  // <zh/> 取共享常量——`withDefaults` 的默认值是运行期求值，可安全引用 import。
  // <zh/> <en/> Takes the shared constant — `withDefaults` defaults are evaluated at
  // <zh/> runtime, so referencing an import is safe.
  rowHeight: DEFAULT_ROW_HEIGHT,
  cache: 2,
  estimatedRowHeight: undefined,
})

const emit = defineEmits<VirtualRendererEmitsMap<T>>()

// <zh/> 标记 PinStripRow 已使用，避免 vue-tsc unused 误报（模板中使用）| <en/> Mark PinStripRow as used to avoid vue-tsc unused false positive (used in template)
void PinStripRow

const EMPTY_SLOTS: Slots = Object.freeze({} as Slots)
const tableV2Ref = shallowRef<InstanceType<typeof ElTableV2> | null>(null)
/**
 * <zh/> V2 程序化滚动探针——scrollTo/scrollToRow 的 `(v2 as any)` 探测收敛于此，
 * <zh/> EP 改名仅需改一处（见 use-v2-scroll-api.ts）。置于顶部供恢复 watcher/悬停层/定位 API 共用。
 * <en/> V2 programmatic-scroll probe — all `(v2 as any)` scrollTo/scrollToRow probing converges
 * <en/> here; an EP rename only needs a single-site fix (see use-v2-scroll-api.ts). Declared
 * <en/> early for the restore watcher, hover layer and positioning APIs below.
 */
const v2ScrollApi = useV2ScrollApi(() => tableV2Ref.value)
const containerRef = shallowRef<HTMLElement | null>(null)
const resizeProxyRef = shallowRef<HTMLElement | undefined | null>(undefined)
const summaryFooterRef = shallowRef<VirtualSummaryFooterExpose | null>(null)
/**
 * <zh/> 顶部 Grand 汇总条带引用——与表尾同一组件、同一单元格数据，仅渲染位置在表头之下
 * <en/> Grand top strip ref — same component and cell data as the footer, rendered below the header
 */
const grandTopStripRef = shallowRef<VirtualSummaryFooterExpose | null>(null)

const { width: measuredWidth, height: measuredHeight } = useElementSize(containerRef)
// <zh/> 按域注入（上帝上下文已删除）| <en/> per-domain injection (god context removed)
const performanceProfile = inject(advTablePerformanceProfileKey, undefined)
const lowPerformance = computed(() => performanceProfile?.value === 'low')

//  行固定 + 滚动协调（use-v2-pinning）
//  Row pinning + scroll reconcile (use-v2-pinning)
/** <zh/> 行拖拽进行中（域键透传的同一引用） | <en/> Row drag in progress (same reference via domain key) */
const isRowDraggingRef = inject(advTableIsRowDraggingKey, undefined)
const isRowDragging = computed(() => isRowDraggingRef?.value ?? false)
const rowPinCtx = inject(advTableRowPinKey, undefined)
const {
  topPinnedRows,
  bottomPinnedRows,
  currentScrollTop,
  currentScrollLeft,
  reconcileScroll,
  stripInnerStyle,
} = useV2Pinning({
  rowPinCtx,
  isRowDragging,
  lowPerformance,
  host: () => tableV2Ref.value,
  rowHeight: () => props.rowHeight,
  measuredWidth,
  measuredHeight,
  data: () => props.data,
  dom: props.dom,
})

/**
 * <zh/> 合并 selection + normal 列为叶子列视图，供虚拟渲染器单元格事件定位使用
 *
 * <zh/> 关键：此数组的列顺序必须与 V2 列数组（v2Columns）的顺序一致，
 * <zh/> 即 [...selection, ...normal(非 fixed), ...normal(fixed)]；
 * <zh/> 顺序错乱会让 data-adv-cell-col 索引与 columns.value[index] 不匹配，
 * <zh/> 导致点击单元格返回错误的 column 对象。
 *
 * <zh/> 与渲染侧（normal-v2-column filteredCols）同一开关 + 同一过滤函数
 * <zh/> 剔除 teleport 悬浮列。teleport 状态由下方 useV2Hover 产出，此处以迟绑定
 * <zh/> getter 接入（computed 惰性求值，首次求值时开关已就绪）。
 *
 * <en/> Merge selection + normal columns into leaf column view, for virtual renderer cell event locator.
 *
 * <en/> Critical: the column order of this array MUST match the V2 column array (v2Columns),
 * <en/> i.e., [...selection, ...normal(non-fixed), ...normal(fixed)]; a wrong order makes the
 * <en/> data-adv-cell-col index mismatch columns.value[index], returning the wrong column object.
 */
let isTeleportActiveGetter: () => boolean | undefined = () => undefined
const mergedVirtualLeafColumns = useMergedLeafColumns(props.selectionColumns, props.normalColumns)
const allVirtualLeafColumns = computed(() => {
  const isTeleport = isTeleportActiveGetter() ?? props.hoverOptionTeleport ?? false
  const next = filterTeleportHoverColumns(mergedVirtualLeafColumns.value, isTeleport)
  return next
})

/** <zh/> 行键元信息（用于单元格定位） | <en/> Row key metadata (used for cell locator) */
const rowKeyMeta = inject(advTableKey, undefined)?.rowKeyMeta
/** <zh/> 行分组 API | <en/> Row group API */
const rowGroupApi = inject(advTableRowGroupKey, undefined)
/** <zh/> 行展开 API | <en/> Row expand API */
const rowExpandApi = inject(advTableRowExpandKey, undefined)

const slots: MaybeRefOrGetter<Slots> = () => props.forwardedSlots ?? EMPTY_SLOTS

const appendRowData = createAppendRowData()
/**
 * <zh/> append 槽在 virtual 模式无模板出口（EP 无 `#append` 插槽）——append 内容被合成为
 * <zh/> 末行数据参与虚拟滚动，故此处读 `forwardedSlots` 而非 `$slots`；default 模式相反，
 * <zh/> `#empty/#append` 走模板插槽。两模式口径差异属刻意不对称，见 ARCHITECTURE §4。
 * <en/> No `#append` slot exists in virtual mode (EP has none) — append content is synthesized into a
 * <en/> trailing data row so this reads `forwardedSlots`, not `$slots`; default mode does the opposite
 * <en/> via template slots. The differing source is a deliberate asymmetry (see ARCHITECTURE §4).
 */
const hasAppendSlot = computed(() => Boolean(toValue(slots).append))

/**
 * <zh/> 业务行索引域映射——非粘性 Grand 顶部合计行会被前插到 EP 数据域首位，
 * <zh/> 使业务行的 EP 索引整体 +1。emit 边界按行身份校验并扣除头部合成行偏移，
 * <zh/> 保证对外 rowIndex 恒为 `props.data` 域；合成行（Grand 合计/append）返回 undefined。
 * <en/> business-row index mapping — a non-sticky grand total row is prepended to the EP data
 * <en/> domain, shifting every business row index by 1. The emit boundary verifies row identity and
 * <en/> subtracts the head-synthetic offset so the public rowIndex stays in the `props.data` domain;
 * <en/> synthetic rows (grand total / append) resolve to undefined.
 */
let resolveBusinessRowIndex: (rowData: unknown, epRowIndex: number) => number | undefined = (_rowData, epRowIndex) => epRowIndex

//  网格内核（use-v2-grid-core）— 渲染器会话 / 行索引 / 实例度量 / 行外观
//  Grid core (use-v2-grid-core) — renderer session / row index / instance metrics / row appearance
const {
  rowKeyFn,
  rendererExpose,
  hoverOptionColumns,
  displayNormalColumns,
  hasHoverOptionColumns,
  hoverOptionTeleport,
  getColumnWidth,
  columnWidths,
  handleHeaderMouseMove,
  handleHeaderMouseOut,
  handleHeaderKeyDown,
  handleResizeStart,
  resizeProxyVisible,
  tableContainerWidth,
  hoverRowKey,
  hoverRowData,
  hoverRowIndex,
  hoverLayerVisible,
  hoverLayerCollapsed,
  hoverLayerStyle,
  toggleHoverLayerCollapse,
  handleHoverLayerEnter,
  handleHoverLayerLeave,
  rediscoverHoverAfterScroll,
  rowEventHandlers,
  handleScroll,
  isScrolling,
  tableProps,
  rowKeyAttr,
  resetColumnWidths,
  buildWindowIndex,
  virtualKeyToIndex,
  numericHeight,
  explicitHeightPx,
  effectiveEstimatedRowHeight,
  gridInstanceKey,
  vScrollbarSize,
  summaryGutterVar,
  resetAfterRowIndex,
  refreshVirtualRowHeight,
  currentRowClass,
  getRowKeyForAttr,
  clearCachedRect,
} = useV2GridCore<T>({
  // <zh/> 本组件 props（含 withDefaults 兜底的必填高度）已与 V2RendererProps 同构，直传无需断言
  // <en/> These props (with withDefaults-backed required heights) match V2RendererProps; pass directly, no assertion
  props,
  emit,
  lowPerformance,
  tableV2Ref,
  containerRef,
  resizeProxyRef,
  rowKeyMeta,
  rowExpandApi,
  rowGroupApi,
  hasAppendSlot,
  currentScrollTop,
  currentScrollLeft,
  v2ScrollApi,
  allVirtualLeafColumns: () => allVirtualLeafColumns.value,
  // 事件列域与渲染列域同开关（迟绑定，hover 初始化后赋值）
  isTeleportActive: () => isTeleportActiveGetter(),
  // 业务行索引域映射（迟绑定，grand-total 域装配后赋值）
  resolveBusinessRowIndex: () => resolveBusinessRowIndex,
})

const { t } = useRendererLocale(props.t)

const $virtualRendererAttrs = useAttrs()
/** <zh/> class 拆词正则（模块级常量，避免每次调用重编译） | <en/> class split regex (module-level constant, avoids recompiling per call) */
const CLASS_WHITESPACE_RE = /\s+/
/** <zh/> 布局类前缀（table.vue 下发的 `adv-table__*`） | <en/> layout-class prefix handed down by table.vue */
const LAYOUT_CLASS_PREFIX = 'adv-table__'
/**
 * <zh/> 网格语义透传——本组件 `inheritAttrs: false`，table.vue 下发的 role/aria-* 经共享
 * <zh/> pickGridA11yAttrs 挑出后绑到根节点，避免语义静默丢失。
 * <en/> Grid semantics passthrough — with `inheritAttrs: false`, the role/aria-* from table.vue
 * <en/> are picked via shared pickGridA11yAttrs and bound on the root node to avoid silent loss.
 */
const gridA11yAttrs = computed(() => pickGridA11yAttrs($virtualRendererAttrs as Record<string, unknown>))
/**
 * <zh/> 布局 class 透传——本组件 `inheritAttrs: false`，table.vue 下发的
 * <zh/> `adv-table__main` 无法落到作为 flex item 的根节点（只会落在内层 ElTableV2 上），
 * <zh/> 导致 `--filter-left` / `--filter-both` 的 `order` 规则在 virtual 模式失效。
 * <zh/> 此处把 `adv-table__*` 布局类合入根节点 class（语义类仍走 gridA11yAttrs），
 * <zh/> 不依赖内部 ElTableV2 上的同名 class。
 * <en/> layout-class passthrough — with `inheritAttrs: false`, table.vue's `adv-table__main`
 * <en/> never reaches the flex-item root (it lands on the inner ElTableV2), so the
 * <en/> `--filter-left` / `--filter-both` `order` rules do not apply in virtual mode. `adv-table__*`
 * <en/> layout classes are merged into the root class here (semantic classes still go through
 * <en/> gridA11yAttrs), never relying on the same-named class of the inner ElTableV2.
 */
const rootLayoutClass = computed(() => {
  const layoutClasses: string[] = []
  for (const value of Object.values($virtualRendererAttrs as Record<string, unknown>)) {
    if (typeof value !== 'string')
      continue
    for (const cls of value.split(CLASS_WHITESPACE_RE)) {
      if (cls.startsWith(LAYOUT_CLASS_PREFIX))
        layoutClasses.push(cls)
    }
  }
  return layoutClasses
})
const resolvedSelectionMode = computed(() =>
  (props.selectionMode ?? $virtualRendererAttrs['selection-mode'] ?? 'multiple') as 'single' | 'multiple',
)

//  悬停操作层（use-v2-hover）— teleport 定位 + 子组件 provide
//  Hover action layer (use-v2-hover) — teleport positioning + child provide
const {
  teleportRowRect,
  showTeleportHover,
  shouldUseTeleport,
  wrappedHandleScroll,
  handleForceHide,
  hoverLayerApi,
} = useV2Hover<T>({
  tableV2Ref,
  dom: props.dom,
  hasHoverOptionColumns,
  hoverOptionColumns,
  hoverOptionTeleport,
  hoverRowKey,
  hoverRowData,
  hoverRowIndex,
  hoverLayerVisible,
  hoverLayerCollapsed,
  hoverLayerStyle,
  toggleHoverLayerCollapse,
  handleScroll,
  isScrolling,
  rediscoverHoverAfterScroll,
  currentScrollLeft,
  currentScrollTop,
  v2ScrollApi,
  // <zh/> 表格根（ElTableV2 根）——供 teleport 矩形域区分表内滚动与祖先滚动
  // <en/> Table root (ElTableV2 root) — lets the teleport-rect domain separate in-table from ancestor scrolls
  getRootEl: () => (tableV2Ref.value?.$el ?? tableV2Ref.value) as HTMLElement | null,
})
// 事件列域与渲染列域共用同一 teleport 开关（渲染侧 normal-v2-column 用
// shouldUseTeleport ?? hoverOptionTeleport，此处保持完全一致）
isTeleportActiveGetter = () => toValue(shouldUseTeleport) ?? props.hoverOptionTeleport ?? false

//  网格装配壳（use-v2-grid-shell）— 汇总 / 列 / 合并 / 表头 / 定位
//  Grid assembly shell (use-v2-grid-shell) — summary / columns / span / header / positioning
const {
  showFooterSummaryV,
  showGrandTopStripV,
  isSummaryCalculatingV,
  grandTopStripHeightV,
  dataWithAppend,
  mergedTopPinnedRowsV,
  mergedBottomPinnedRowsV,
  bottomStripHeight,
  footerHeightWithPinBottom,
  v2Columns,
  computedHeaderHeight,
  needsFixedWidth,
  leftSummaryCells,
  mainSummaryCells,
  rightSummaryCells,
  summaryMainWidth,
  SpanRow,
  spanCellProps,
  CustomHeader,
  scrollToRow,
  scrollToColumn,
} = useV2GridShell<T>({
  // <zh/> 同上：与 V2RendererProps 同构，直传（见 useV2GridCore 接线注释）
  // <en/> Same as above: matches V2RendererProps, passed directly (see the useV2GridCore wiring note)
  props,
  emit,
  t,
  slots,
  hasAppendSlot,
  appendRowData,
  topPinnedRows,
  bottomPinnedRows,
  rowExpandApi,
  selectionState: inject(advTableSelectionKey, undefined) as UseSelectionStateReturn | undefined,
  // Why: 树域注入在无 treeConfig 时为 undefined，消费侧收窄为 TreeApi；此处 any 收窄为显式联合
  treeApi: inject(advTableTreeKey, undefined) as import('../../types/config-tree').TreeApi | undefined,
  resolvedSelectionMode,
  getColumnWidth,
  columnWidths,
  displayNormalColumns,
  rowKeyFn,
  hoverLayerApi,
  hasHoverOptionColumns,
  hoverOptionColumns,
  hoverOptionTeleport,
  shouldUseTeleport,
  tableContainerWidth,
  virtualKeyToIndex,
  currentScrollTop,
  v2ScrollApi,
  spanDynamicMode: () => props.spanDynamicMode,
  isDynamic: () => effectiveEstimatedRowHeight.value != null,
})

/** tableV2Fixed 复用 needsFixedWidth，避免重复依赖追踪和计算 */
const tableV2Fixed = needsFixedWidth

/**
 * <zh/> 合并表头样式失步自愈（与虚拟滚动自愈同机制）——列签名变化（拖拽/折叠/持久化恢复）、
 * <zh/> 容器尺寸变化、数据引用变化后，分组头宽度/表头-表体像素可能短暂分叉，看门狗覆盖静默失步。
 * <en/> Merged-header style desync self-healing (same mechanism as scroll self-healing) — group widths /
 * <en/> header-body pixels can briefly fork after column-signature (resize/collapse/persistence restore),
 * <en/> container size or data reference changes; the watchdog covers silent desync.
 */
useHeaderStyleReconcile({
  rootEl: () => (tableV2Ref.value?.$el as HTMLElement | undefined) ?? null,
  dom: props.dom,
  ownsGroupHeaderWidths: () => true,
  columnsVersion: () => v2Columns.value
    .map(col => `${getColumnKey(col as unknown as Parameters<typeof getColumnKey>[0])}:${Number((col as { width?: unknown }).width ?? 0)}`)
    .join('|'),
  data: () => props.data,
  measuredWidth,
  measuredHeight,
  skipWatchdog: () => lowPerformance.value || isRowDragging.value,
})

/**
 * <zh/> EP 数据域头部合成行偏移——首条业务行在 `dataWithAppend` 中的实际位置。
 * <zh/> 无前插合计行时为 0；判定只需 `indexOf(首条业务行)`（合成行只在首/末，数量为 0~2）。
 * <en/> Head synthetic-row offset in the EP data domain — the actual position of the first business row inside `dataWithAppend`.
 * <en/> 0 without prepended total rows; resolving only needs `indexOf(first business row)` (synthetic rows sit at head/tail, 0–2 in count).
 */
const epHeadOffset = computed(() => {
  const rows = dataWithAppend.value as unknown[]
  const business = props.data as unknown[]
  if (business.length === 0)
    return 0
  const idx = rows.indexOf(business[0])
  return idx < 0 ? 0 : idx
})

resolveBusinessRowIndex = (rowData, epRowIndex) => {
  const rows = dataWithAppend.value as unknown[]
  // 行身份校验：EP 索引处不是该行 → 合成行（Grand 合计 / append），不暴露业务索引
  if (rows[epRowIndex] !== rowData)
    return undefined
  const businessIndex = epRowIndex - epHeadOffset.value
  if (businessIndex < 0)
    return undefined
  const business = props.data as unknown[]
  return business[businessIndex] === rowData ? businessIndex : undefined
}

/**
 * <zh/> 底部固定条带按 `fixed` 分 left/main/right 三区（与 VirtualSummaryFooter 同机制）。
 * <zh/> 条带单元格收到的是**全列序全局索引**——索引敏感 renderer（valueGetter/编辑态）与表体一致。
 * <zh/> left/main/right 顺序即 v2Columns 内的相对顺序，与 EP 固定列分区一致。
 * <en/> partition the bottom pinned strip into left/main/right by `fixed` (same mechanism as
 * <en/> VirtualSummaryFooter). Strip cells receive the **global** column index of the full column
 * <en/> order, matching the body for index-sensitive renderers.
 */
const pinStripEntries = computed(() => {
  const left: PinStripCellEntry[] = []
  const main: PinStripCellEntry[] = []
  const right: PinStripCellEntry[] = []
  v2Columns.value.forEach((column: any, columnIndex: number) => {
    const entry = { column, columnIndex }
    if (column?.fixed === 'right')
      right.push(entry)
    else if (column?.fixed)
      left.push(entry)
    else
      main.push(entry)
  })
  return { left, main, right }
})

const interactionDomain = computed(() => {
  const attrByKey = new Map(v2Columns.value.map((col, index) => [getColumnKey(col), index]))
  const columns = props.normalColumns.filter(col => attrByKey.has(getColumnKey(col)))
  return {
    rows: dataWithAppend.value,
    columns,
    columnIndexes: columns.map(col => attrByKey.get(getColumnKey(col))!),
  }
})

function getInteractionDomain() {
  return interactionDomain.value
}

defineExpose({
  ...rendererExpose,
  getInteractionDomain,
  /**
   * <zh/> 重置列宽拖拽缓存，供列状态持久化恢复时调用
   * <en/> Reset column resize drag cache, called during column state persistence restoration
   */
  resetColumnWidths,
  /**
   * <zh/> 手动触发虚拟滚动状态自愈——适用于自动化检测窗口外的场景，
  例如 el-drawer / el-dialog 在 @closed 后调用。若检测到滚动失步则立即自愈，否则为空操作。
   * <en/> Manually trigger virtual scroll state self-healing — for scenarios outside the
   * automatic detection window, e.g. call it in el-drawer / el-dialog @closed.
   * No-op when no desync is detected.
   */
  reconcileScroll,
  scrollToRow,
  scrollToColumn,
  /**
   * <zh/> 透传 EP 原生行高重测——动态网格下自定义 cell 异步撑高后调用，清除 index 之后
   * <zh/> 全部行的缓存行高并重排；固定网格/实例未就绪时返回 false（dev 可观测告警）。
   * <en/> Pass-through EP native row-height reset — call after async cell-content growth on the
   * <en/> dynamic grid to drop cached heights after index and reflow; false (with a dev-observable
   * <en/> warning) on fixed grids or when the instance is not ready.
   */
  resetAfterRowIndex,
  /**
   * <zh/> 便捷重测——`resetAfterRowIndex(index, true)`，默认从 0 行起全量重测。
   * <en/> Convenience remeasure — `resetAfterRowIndex(index, true)`, resetting everything from row 0 by default.
   */
  refreshVirtualRowHeight,
} satisfies ITableRenderer as ITableRenderer & typeof rendererExpose)

/**
 * <zh/> 滚动运行时（速度采样 / 汇总条带同步 / 事件分发）——见 use-v2-scroll-runtime
 * <en/> Scroll runtime (velocity sampling / summary-strip sync / event dispatch) — see use-v2-scroll-runtime
 */
const { dynamicCache, onSummaryScroll, onTableScroll } = useV2ScrollRuntime({
  cache: () => props.cache,
  lowPerformance,
  currentScrollTop,
  currentScrollLeft,
  wrappedHandleScroll,
  emitScroll: params => emit('scroll', params),
  summaryFooterRef,
  topStripRef: grandTopStripRef,
  tableV2Ref,
  // 横向滚动时清列宽拖拽的表头 rect 缓存（表头随滚动移动，旧 rect 会错判命中区）
  clearCachedRect,
})

/** <zh/> 滚动到底部事件转发 | <en/> End reached event forwarder */
function handleEndReached(distance: number): void {
  emit('endReached', distance)
}

/** <zh/> 行渲染事件转发（含渲染窗口局部索引增量构建） | <en/> Rows-rendered forwarder (incl. incremental window index build) */
function handleRowsRendered(params: { rowCacheStart: number, rowCacheEnd: number, rowVisibleStart: number, rowVisibleEnd: number }): void {
  buildWindowIndex(params.rowCacheStart, params.rowCacheEnd)
  emit('rowsRendered', params)
}

const hoverOptionZIndex = computed(() => getHoverOptionZIndex(props.columns))

// <zh/> 容器宽度回灌——useElementSize 观察外层 div，列溢出检测依赖它。
// <zh/> 与 use-virtual-renderer 内的主体层 observer 分工不同，二者不可合并（详见该文件说明）。
// <en/> Container width back-fill — useElementSize observes the outer div; overflow detection depends on it.
// <en/> It has a different job from the body-layer observer inside use-virtual-renderer; do not merge (see that file).
watch(measuredWidth, (containerWidth) => {
  if (containerWidth > 0 && tableContainerWidth.value !== containerWidth)
    tableContainerWidth.value = containerWidth
})
</script>

<template>
  <div
    ref="containerRef"
    v-grid-a11y
    class="adv-table-virtual-renderer"
    :class="[{ 'is-fixed': needsFixedWidth }, rootLayoutClass]"
    v-bind="gridA11yAttrs"
    :style="summaryGutterVar"
    @mousemove="handleHeaderMouseMove"
    @mousedown="handleResizeStart"
    @mouseout="handleHeaderMouseOut"
    @keydown="handleHeaderKeyDown"
  >
    <ElAutoResizer>
      <template #default="{ height: cHeight, width: cWidth }">
        <!-- <zh/> 行固定布局：顶部固定行经 EP 原生 fixed-data 渲染于表头内部，
              底部固定行渲染于 footer slot 内（汇总之上）；Grand top 粘性时渲染顶部汇总条带（表头之下）。
              未启用时高度换算恒等于原值。
              高度口径：显式 px 高度（explicitHeightPx）优先于 AutoResizer 实测——与 default 模式
              ElTable 直传 height 对齐，避免不定高祖先下实测值把表格撑满；相对单位/缺省仍走实测。
              <en/> Row-pinning layout: top pinned rows render inside the EP header via native
              fixed-data, bottom pinned rows inside the footer slot (above the summary); sticky grand-top
              renders a top summary strip below the header. When disabled, the height math reduces to the original value.
              Height source: an explicit px height (explicitHeightPx) wins over the AutoResizer measurement —
              aligned with default-mode ElTable passthrough, so tables never stretch to fill indefinite
              ancestors; relative units / missing values still measure. -->
        <div
          class="adv-table-v2__pin-layout"
          :style="{ display: 'flex', flexDirection: 'column', height: `${explicitHeightPx ?? (cHeight > 0 ? cHeight : numericHeight)}px` }"
        >
          <!-- <zh/> Grand top 顶部汇总条带（AG Grid grandTotalRow='top'）：与 footer 同一组件、同一聚合单元格，
               主区域为原生滚动条（stable 槽位预留，与表尾/表体同宽），经同一同步器双向同步，保证像素对齐
               <en/> Grand top summary strip (AG Grid grandTotalRow='top'): same component and aggregate cells as the
               footer, native scrollbar with stable gutter reservation (same width as footer/body), synced
               bidirectionally by the same sync manager for pixel alignment -->
          <VirtualSummaryFooter
            v-if="showGrandTopStripV"
            ref="grandTopStripRef"
            :left-cells="leftSummaryCells"
            :main-cells="mainSummaryCells"
            :right-cells="rightSummaryCells"
            :main-width="summaryMainWidth"
            :on-scroll="onSummaryScroll"
            class="adv-table-v2__grand-top-strip"
            :class="{ 'adv-table-v2__summary--calculating': isSummaryCalculatingV }"
          />
          <!-- eslint-disable vue/no-restricted-v-bind -->
          <ElTableV2
            ref="tableV2Ref"
            :key="gridInstanceKey"
            v-bind="tableProps"
            v-loading="props.loading"
            :columns="v2Columns"
            :data="dataWithAppend"
            :row-key="rowKeyAttr"
            :fixed="tableV2Fixed"
            :v-scrollbar-size="vScrollbarSize"
            :height="(explicitHeightPx ?? (cHeight > 0 ? cHeight : numericHeight)) - grandTopStripHeightV"
            :width="width ?? cWidth"
            :header-height="computedHeaderHeight"
            :fixed-data="mergedTopPinnedRowsV"
            :row-event-handlers="rowEventHandlers"
            :row-class="currentRowClass"
            :cell-props="spanCellProps"
            :cache="dynamicCache"
            :estimated-row-height="effectiveEstimatedRowHeight"
            :footer-height="footerHeightWithPinBottom"
            :class="`adv-table__main${(props.border ?? true) ? ' adv-table-v2--border' : ''}`"
            @scroll="onTableScroll"
            @end-reached="handleEndReached"
            @rows-rendered="handleRowsRendered"
          >
            <template
              v-if="SpanRow"
              #row="rowProps"
            >
              <component
                :is="SpanRow"
                v-bind="rowProps"
              />
            </template>

            <template #header="headerProps">
              <CustomHeader v-bind="headerProps" />
            </template>

            <template #footer>
              <!-- <zh/> 底部固定行（ag-grid 顺序）：footer 无分区/层级，恒渲染于此，汇总之上；
                   footer 容器不跟随横向滚动，保留手动平移同步。Grand pinnedBottom 合并于用户固定行之后。
                   <en/> Bottom pinned rows (ag-grid order): the footer has no partitions/levels, always renders
                   here above the summary; the footer container doesn't auto-scroll, so keep the manual translate sync.
                   Grand pinnedBottom merges after user pinned rows. -->
              <div
                v-if="mergedBottomPinnedRowsV.length > 0"
                class="adv-table-v2__pin-strip adv-table-v2__pin-strip--bottom"
                :style="{ height: `${bottomStripHeight}px` }"
              >
                <PinStripRow
                  v-for="pinnedRow in mergedBottomPinnedRowsV"
                  :key="getRowKeyForAttr(pinnedRow)"
                  :left-entries="pinStripEntries.left"
                  :main-entries="pinStripEntries.main"
                  :right-entries="pinStripEntries.right"
                  :main-style="stripInnerStyle"
                  :row="pinnedRow"
                  :handlers="rowEventHandlers"
                  :row-key-value="getRowKeyForAttr(pinnedRow)"
                />
              </div>
              <VirtualSummaryFooter
                v-if="showFooterSummaryV"
                ref="summaryFooterRef"
                :left-cells="leftSummaryCells"
                :main-cells="mainSummaryCells"
                :right-cells="rightSummaryCells"
                :main-width="summaryMainWidth"
                :on-scroll="onSummaryScroll"
                :class="{ 'adv-table-v2__summary--calculating': isSummaryCalculatingV }"
              />
            </template>

            <template #empty>
              <slot name="empty">
                <div
                  v-if="props.emptyText"
                  class="adv-table__virtual-empty-text"
                >
                  {{ props.emptyText }}
                </div>
              </slot>
            </template>
          </ElTableV2>
        </div>
      </template>
    </ElAutoResizer>

    <div
      v-show="resizeProxyVisible"
      ref="resizeProxyRef"
      class="adv-table-virtual-renderer__column-resize-proxy"
    />

    <RowActionBar
      v-if="showTeleportHover"
      :visible="hoverLayerVisible && !!hoverRowData"
      :collapsed="hoverLayerCollapsed"
      :hover-option-columns="hoverOptionColumns"
      :row="(hoverRowData ?? EMPTY_ROW) as Record<string, unknown>"
      :row-index="hoverRowIndex >= 0 ? hoverRowIndex : 0"
      is-teleport
      :row-rect="teleportRowRect"
      :z-index="hoverOptionZIndex"
      :is-scrolling="isScrolling"
      @mouseenter="handleHoverLayerEnter"
      @mouseleave="handleHoverLayerLeave"
      @force-hide="handleForceHide"
    />
  </div>
</template>
