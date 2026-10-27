<!--
  @component TableRenderer
  @displayName 表格渲染器（ElTable）
  @displayName Table Renderer (ElTable)
  @description <zh/> 封装 Element Plus 的 ElTable，提供列折叠、编辑、筛选、排序、行展开、行分组、悬浮操作层、单元格事件等高级表格特性
  @description <en/> Wraps Element Plus ElTable, provides column collapse, editing, filtering, sorting, row expand, row grouping, hover layer, cell events, etc.
  @category 数据展示 | Data Display
  @extends ElTable
  @since 1.0.0
-->
<script setup lang="ts" generic="T">
import type { TableInstance } from 'element-plus'
import type { UseSelectionStateReturn } from '../../composables/selection/use-selection-state'
import type { ProcessedColumn } from '../../types/column'
import type { TableHoverTeleportOverlayApi } from '../../types/config-api'
import type { DefaultRendererProps } from '../../types/renderer'
import type { RendererEmitsMap } from '../../types/renderer-emits'
import type { ITableRenderer } from '../../types/renderer-interface'
import type { ScrollTarget, ScrollToRowOptions } from '../../utils/table-drag'
import { useElementSize } from '@vueuse/core'
import { ElTable, vLoading } from 'element-plus'
import { computed, inject, onActivated, onBeforeUnmount, onDeactivated, shallowRef, unref, useAttrs, watch } from 'vue'
import { useHeaderStyleReconcile } from '../../composables/rendering/use-header-style-reconcile'
import { createHoverLocator } from '../../composables/rendering/use-hover-locator'
import { useMergedLeafColumns, useTeleportRowRect } from '../../composables/rendering/use-renderer-common'
import { useHoverLayerProvider, useRendererCellEvents } from '../../composables/rendering/use-renderer-event-adapter'
import { useSpanStrategy } from '../../composables/rendering/use-span-strategy'
import { clampMinWidth, DEFAULT_MIN_COLUMN_WIDTH } from '../../constants'
import {
  advTableFilterSortKey,
  advTableKey,
  advTablePerformanceProfileKey,
  advTableRowExpandKey,
  advTableRowGroupKey,
  advTableRowPinKey,
  advTableSelectionKey,
} from '../../types/injection-keys'
import { findColumnByKey } from '../../utils/column-tree'
import { devWarn } from '../../utils/dev-warn'
import { createRowEventHandlers } from '../../utils/event-handlers'
import { clampRowToContainer, getBodyContainerRect } from '../../utils/hover-locator'
import { rowKeyAttrSelector } from '../../utils/row-key-attr'
import { getColumnKey, getHoverOptionZIndex, resolveColumnProp } from '../../utils/shared'
import { ADV_TABLE_COLUMN_KEY_ATTR, ADV_TABLE_ROW_KEY_ATTR } from '../../utils/table-drag'
import { isGrandTotalRow, isGroupTotalRow } from '../../utils/total-rows'

import HoverTeleportOverlay from '../cell-renderers/hover-teleport-overlay.vue'

import { isTeleportHoverColumn } from '../renderer-core/column-build-shared'
import { EL_TABLE_DISABLED_TREE_PROPS } from '../renderer-core/el-table-tree-isolation'
import { pauseGridA11yObserver, pickGridA11yAttrs, resumeGridA11yObserver, vGridA11y } from '../renderer-core/grid-a11y-attrs'
import { useRendererLocale } from '../renderer-core/render-helpers'
import { NormalColumn } from './normal-column'
import { SelectionColumn } from './selection-column'
import { useDefaultGrand } from './use-default-grand'

import { useTableRenderer } from './use-table-renderer'

defineOptions({ name: 'TableRenderer', inheritAttrs: false })

const props = withDefaults(defineProps<DefaultRendererProps & {
  /**
   * <zh/> 模式判别器——供 isDefaultRendererProps 守卫复活；本组件接收后忽略，禁入 DOM。
   * <en/> Mode discriminator — revives the isDefaultRendererProps guard; accepted and ignored, never reaches the DOM.
   */
  mode?: 'default'
  originalColumns?: ProcessedColumn[]
  canCollapse?: (col: ProcessedColumn) => boolean
  isCollapsed?: (columnKey: string) => boolean
}>(), {
  leafColumns: () => [],
  selectionColumns: () => [],
  normalColumns: () => [],
  selectableData: () => [],
  checkStatus: () => ({ isAllSelected: false, isIndeterminate: false }),
  originalColumns: () => [],
  selectionMode: 'multiple',
})

/**
 * <zh/> 透传 ElTable 原生事件并包装高级表格自定义事件（行列索引、列信息等）
 * <en/> Passthrough ElTable native events and wrap advanced table custom events (row/column index, column info, etc.)
 * @remarks
 * <zh/> 事件签名引用共享的 RendererEmitsMap 类型，与 table-virtual-renderer.vue 保持编译时一致
 * <en/> Event signatures reference the shared RendererEmitsMap type, ensuring compile-time consistency with table-virtual-renderer.vue
 */
const emit = defineEmits<RendererEmitsMap<T>>()

/** <zh/> 键盘调整列宽步长（px）| <en/> Keyboard resize step (px) */
const KEYBOARD_RESIZE_STEP = 10

const resolvedSelectionMode = computed(() => props.selectionMode ?? 'multiple')

// <zh/> element-plus 2.14.7 起 ElTable 声明为泛型函数组件，InstanceType 不再成立，改用官方 TableInstance
// <en/> From element-plus 2.14.7 ElTable is a generic function component; use TableInstance instead of InstanceType
const tableRef = shallowRef<TableInstance | null>(null)

/**
 * <zh/> 网格语义透传——本组件 `inheritAttrs: false`，table.vue 下发的 role/aria-* 经共享
 * <zh/> pickGridA11yAttrs 挑出后绑到单根包裹层（display: contents，无盒模型，视觉零影响）。
 * <en/> Grid semantics passthrough — with `inheritAttrs: false`, the role/aria-* from table.vue
 * <en/> are picked via shared pickGridA11yAttrs and bound on the single-root wrapper
 * <en/> (display: contents, no box, zero visual impact).
 */
const gridA11yAttrs = computed(() => pickGridA11yAttrs(useAttrs() as Record<string, unknown>))

function getRowKey(row: any): string {
  return props.rowKey(row as T)
}

// <zh/> 按域注入（上帝上下文已删除）| <en/> per-domain injection (god context removed)
const selectionCtx = inject(advTableSelectionKey, undefined) as UseSelectionStateReturn | undefined
// <zh/> aria-selected 与渲染同步：空 DOM（测试环境/未挂载）下 querySelectorAll 返回空集合，forEach 空转无害；
// <zh/> 大数据时跳过（default 模式阈值 1000，外层已警告）。失败走 devWarn，不静默吞错。
// <en/> Sync aria-selected with render: empty DOM (test env/unmounted) yields an empty NodeList, a no-op forEach;
// <en/> skipped for large datasets (default mode threshold 1000, warned externally). Failures go through devWarn.
watch(() => [selectionCtx?.selectedKeys?.value, tableRef.value?.$el, props.data] as const, ([selectedKeys, el]) => {
  const selCtx: UseSelectionStateReturn | undefined = selectionCtx
  if (!el || !selCtx?.isSelectedByKey)
    return
  try {
    const rows = (el as HTMLElement).querySelectorAll<HTMLElement>(props.dom.getRowSelector())
    // <zh/> 大数据保护：DOM 行数 >500 时跳过全量遍历（virtual 模式 DOM 仅窗口 ~20 行，此分支仅影响 default 大表误用）
    // <en/> Large-data guard: skip full traversal when DOM rows >500 (virtual DOM is window ~20, this only affects misused large default tables)
    if (rows.length > 500)
      return
    const selectedSet = selectedKeys as Set<string> | undefined
    rows.forEach((tr) => {
      const key = tr.getAttribute(ADV_TABLE_ROW_KEY_ATTR) ?? ''
      if (!key)
        return
      const selected = selectedSet ? selectedSet.has(key) : selCtx.isSelectedByKey(key)
      if (selected)
        tr.setAttribute('aria-selected', 'true')
      else tr.removeAttribute('aria-selected')
      tr.setAttribute('role', 'row')
    })
  }
  catch (error) {
    // <zh/> aria 增强失败不可静默吞错——dev 去重告警（高频 watcher，避免刷屏），生产构建自动剔除
    // <en/> Never swallow aria-sync failures silently — deduped dev warning (high-frequency watcher), stripped in production
    devWarn('TableRenderer: failed to sync aria-selected attributes.', error)
  }
}, { flush: 'post' })
const tableContext = inject(advTableKey, undefined)
const rowKeyMeta = tableContext?.rowKeyMeta

const filterSortApi = inject(advTableFilterSortKey, undefined)

const rowGroupApi = inject(advTableRowGroupKey, undefined)

const rowExpandApi = inject(advTableRowExpandKey, undefined)

const rowPinApi = inject(advTableRowPinKey, undefined)

// Grand 合计与行固定显示域转出自 ./use-default-grand。
// Grand-total and row-pinning display domain lives in ./use-default-grand (pure code motion).
const {
  grandLabel,
  showFooterSummary,
  wrappedSummaryMethod,
  pinnedDisplayData,
  resolvePinnedRowStyle,
} = useDefaultGrand({ props, rowPinApi })

const performanceProfile = inject(advTablePerformanceProfileKey, undefined)
const lowPerformance = computed(() => performanceProfile?.value === 'low')

const {
  currentRow,
  rendererExpose,
  hoverOptionColumns,
  hasHoverOptionColumns,
  hoverOptionTeleport,
  displayNormalColumns,
  tableProps,
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
  hoverTableEvents,
  handleScroll,
  isScrolling,
  rowIndexMap,
  columnIndexMap,
  columnIndexColumns,
} = useTableRenderer({ props, tableRef, rowKeyMeta, lowPerformance })

const eventHandlers = createRowEventHandlers<T>({
  getRowResolver: () => ({ getRowKey }),
  getIndexMaps: () => ({
    rowIndexMap: rowIndexMap.value,
    columnIndexMap: columnIndexMap.value,
  }),
})

/**
 * <zh/> 将 ElTable 内部列对象解析为对应的 ProcessedColumn。
 * <zh/> ElTable 内部将 prop 重命名为 property，导致事件回调中的列对象使用 property 而非 prop。
 * <zh/> 此函数确保两种渲染模式下事件 payload 中的 column 始终为 ProcessedColumn（含 prop），
 * <zh/> 与虚拟渲染器（ElTableV2）的行为保持一致。
 * <en/> Resolve ElTable's internal column object to the corresponding ProcessedColumn.
 * <en/> ElTable internally renames prop to property, causing the column object in event callbacks to use property instead of prop.
 * <en/> This function ensures the column in event payloads is always a ProcessedColumn (with prop),
 * <en/> consistent with the virtual renderer (ElTableV2) behavior.
 * @remarks
 * <zh/> 按统一列索引域（selection + normal 非 fixed + normal fixed）取列，与虚拟渲染器一致；
 * <zh/> selection 列同样能解析到 ProcessedColumn。
 * <en/> Resolves within the unified column index domain (selection + normal non-fixed + normal fixed), matching the virtual renderer;
 * <en/> selection columns also resolve to their ProcessedColumn.
 */
// Why: EP 原生回调无类型且以 property 代 prop，入口单点收窄；统一索引域回查，EP ^2.14 前提
function resolveColumn(col: any): ProcessedColumn {
  const key = getColumnKey(col)
  const index = columnIndexMap.value.get(key)
  if (index != null && index >= 0 && index < columnIndexColumns.value.length) {
    return columnIndexColumns.value[index]
  }
  if (col.property && !col.prop) {
    return { ...col, prop: col.property } as ProcessedColumn
  }
  return col as ProcessedColumn
}

function handleCurrentChange(row: any, oldRow: any) {
  currentRow.value = row
  emit('currentChange', { currentRow: row, oldRow })
}

/**
 * <zh/> 键盘 a11y 调整列宽（default 模式）
 * <en/> Keyboard-accessible column resize (default mode)
 *
 * <zh/> 表头获得焦点时按 Alt + ←/→ 以 10px 步长调整列宽，与 virtual 模式行为对齐（a11y 对称性）。
 * <zh/> Alt + ArrowRight：加宽；Alt + ArrowLeft：收窄（受列级 minWidth / DEFAULT_MIN_COLUMN_WIDTH 下限限制）。
 * <en/> Alt + ←/→ with 10px step when header has focus, aligned with virtual mode behavior (a11y symmetry).
 * <en/> Alt + ArrowRight: widen; Alt + ArrowLeft: narrow (clamped by column minWidth / DEFAULT_MIN_COLUMN_WIDTH).
 */
function handleHeaderKeyDown(event: KeyboardEvent) {
  if (!event.altKey)
    return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    return

  const target = event.target as HTMLElement | null
  if (!target)
    return

  // 从事件 target 向上查找表头单元格 (th)
  const headerCell = target.closest<HTMLElement>('th')
  if (!headerCell)
    return

  // 按列 key 解析目标叶子列，不按 DOM th 索引——分组子表头 DOM 顺序是叶子序，
  // 用顶层列树索引会调错列。分组头代理到最右叶子（与列宽拖拽手柄落点一致）。
  const keyMarker = headerCell.querySelector(`[${ADV_TABLE_COLUMN_KEY_ATTR}]`)
    ?? target.closest(`[${ADV_TABLE_COLUMN_KEY_ATTR}]`)
  const headerColumnKey = keyMarker?.getAttribute(ADV_TABLE_COLUMN_KEY_ATTR)
  if (!headerColumnKey)
    return

  // eslint-disable-next-line ts/no-use-before-define -- filteredColumns 是 computed，运行时访问时已完成初始化；受限于依赖链（← useTeleportRowRect）无法前移
  const cols = filteredColumns.value
  const headerNode = findColumnByKey(cols, headerColumnKey, getColumnKey)
  if (!headerNode)
    return
  let col: ProcessedColumn = headerNode
  const headerChildren = (headerNode as ProcessedColumn & { children?: ProcessedColumn[] }).children
  if (Array.isArray(headerChildren) && headerChildren.length > 0) {
    let rightmost: ProcessedColumn | undefined = headerNode
    while (rightmost) {
      const children: ProcessedColumn[] | undefined = (rightmost as ProcessedColumn & { children?: ProcessedColumn[] }).children
      if (!Array.isArray(children) || children.length === 0)
        break
      rightmost = children.at(-1)
    }
    if (!rightmost)
      return
    col = rightmost
  }
  // selection 列不可键盘调宽
  if ((col as ProcessedColumn).selection)
    return
  const currentWidth = col.width ?? col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH
  const delta = event.key === 'ArrowRight' ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP
  // <zh/> 下限经 clampMinWidth 唯一出口，并尊重列级 minWidth（`Math.max(全局默认, …)` 会把
  // <zh/> minWidth 更大的列压到其自身下限之下）。与 use-column-resize 键盘路径同口径。
  // <en/> Floor via the single clampMinWidth outlet, honoring the column-level minWidth
  // <en/> (`Math.max(global default, …)` would push columns with a larger minWidth below
  // <en/> their own floor). Same caliber as the use-column-resize keyboard path.
  const newWidth = clampMinWidth(currentWidth + delta, col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH)

  if (newWidth === currentWidth)
    return

  event.preventDefault()
  event.stopPropagation()

  // <zh/> 不直接突变 props.columns（违反单向数据流），仅通过事件通知上层；
  // <zh/> 上层经 columnState / setColumns 受控更新，符合 Vue 最佳实践
  // <en/> Do not mutate props.columns directly (violates one-way flow); notify parent via event
  // <en/> and let the controlled columnState channel apply the change
  emit('headerDragend', eventHandlers.headerDragend(newWidth, currentWidth, resolveColumn(col), event))
}

function handleCellMouseEnter(row: any, _column: any, _cell: HTMLElement, event: Event) {
  /**
   * <zh/> 滚动期间抑制 cellMouseEnter 事件转发
   * <en/> Suppress cellMouseEnter event forwarding during scrolling
   * @remarks
   * <zh/> 滚动时鼠标跨行会频繁触发 cell-mouse-enter（每行约 N 列次事件）。
   * <zh/> 每次转发需读取 rowIndexMap/columnIndexMap 响应式值并构造 payload 对象 + emit 上抛，
   * <zh/> 多列场景下显著放大滚动开销。与 handleHoverRowEnter 的 scrolling 守卫对称。
   * <zh/> 滚动停止 150ms 后 isScrolling 回落 false，鼠标移动时自然恢复转发。
   * <en/> During scrolling, mouse crossing rows triggers cell-mouse-enter frequently (about N events per row).
   * <en/> Each forwarding reads rowIndexMap/columnIndexMap reactive values and constructs a payload object + emit,
   * <en/> amplifying scroll overhead significantly in multi-column scenarios. Symmetric with handleHoverRowEnter's scrolling guard.
   * <en/> After scrolling stops for 150ms, isScrolling falls back to false, and forwarding naturally resumes on mouse movement.
   */
  if (isScrolling.value)
    return
  emit('cellMouseEnter', eventHandlers.cellMouseEnter(row, event))
}

function handleCellMouseLeave() {
  /** <zh/> 滚动期间抑制 cellMouseLeave（与 handleCellMouseEnter 对称） | <en/> Suppress cellMouseLeave during scrolling (symmetric to handleCellMouseEnter) */
  if (isScrolling.value)
    return
  emit('cellMouseLeave')
}

/**
   * <zh/> 纯转发事件绑定对象——将 ElTable 原生事件包装为带行列索引的结构化事件后 emit。
   *
   * <zh/> 以下事件保留为 @ 绑定（不合并到此对象）：
   * <zh/> - current-change：有 currentRow.value 赋值副作用
   * <zh/> - cell-mouse-enter / cell-mouse-leave：需与 hoverTableEvents 的同名 key 通过 mergeProps 数组合并
   * <zh/> - scroll：有 originalWrappedHandleScroll 调用副作用
   *
   * <en/> Pure event forwarding binding object — wraps ElTable native events into structured events with row/column indices before emit.
   *
   * <en/> The following events are kept as @ bindings (not merged into this object):
   * <en/> - current-change: has currentRow.value assignment side effect
   * <en/> - cell-mouse-enter / cell-mouse-leave: need to be array-merged with hoverTableEvents' same-named keys via mergeProps
   * <en/> - scroll: has originalWrappedHandleScroll call side effect
   */
const tableEventBindings = {
  'row-click': (row: any, _column: any, event: Event) =>
    emit('rowClick', eventHandlers.rowClick(row, event)),
  'row-contextmenu': (row: any, _column: any, event: Event) =>
    emit('rowContextmenu', eventHandlers.rowContextmenu(row, event)),
  'row-dblclick': (row: any, _column: any, event: Event) =>
    emit('rowDblclick', eventHandlers.rowDblclick(row, event)),
  'cell-click': (row: any, column: any, _cell: HTMLElement, event: Event) =>
    emit('cellClick', eventHandlers.cellClick(row, resolveColumn(column), event)),
  'cell-dblclick': (row: any, column: any, _cell: HTMLElement, event: Event) =>
    emit('cellDblclick', eventHandlers.cellDblclick(row, resolveColumn(column), event)),
  'cell-contextmenu': (row: any, column: any, _cell: HTMLElement, event: Event) =>
    emit('cellContextmenu', eventHandlers.cellContextmenu(row, resolveColumn(column), event)),
  'header-click': (column: any, event: Event) =>
    emit('headerClick', eventHandlers.headerClick(resolveColumn(column), event)),
  'header-contextmenu': (column: any, event: Event) =>
    emit('headerContextmenu', eventHandlers.headerContextmenu(resolveColumn(column), event)),
  'header-dragend': (newWidth: number, oldWidth: number, column: any, event: MouseEvent | KeyboardEvent) =>
    emit('headerDragend', eventHandlers.headerDragend(newWidth, oldWidth, resolveColumn(column), event)),
} as const

const tableRootEl = computed(() => (tableRef.value?.$el as HTMLElement) ?? null)

/**
 * <zh/> 滚动期间在 capture 阶段拦截 mouseenter，阻止 EP 内部 hoverRow 更新
 * <en/> Intercept mouseenter in capture phase during scrolling to block EP's internal hoverRow updates
 *
 * @remarks
 * <zh/> 核心约束：isScrolling 不得在 EP render effect 内读取，否则滚动起停触发全表重渲染。
 * <zh/> 在 table 容器注册 capture 阶段监听器（render effect 外），capture 先于 target，
 * <zh/> 滚动时 stopPropagation 阻止 td.onMouseenter → EP hoverRow 不更新 → 无 DOM 遍历开销；非滚动时不干预。
 * <en/> Core constraint: isScrolling must not be read inside EP's render effect, or scroll start/stop triggers full re-render.
 * <en/> A capture-phase listener on the container (outside the render effect) intercepts before td; during scroll,
 * <en/> stopPropagation blocks td.onMouseenter → EP hoverRow stays put → no DOM traversal; idle mouse hover is untouched.
 */
let captureMouseEnterCleanup: (() => void) | null = null

/**
 * <zh/> 绑定 mouseenter capture 监听器到指定元素
 * <zh/> 抽取为函数以便 onActivated 重新绑定（KeepAlive 场景）
 * <en/> Bind mouseenter capture listener to the specified element
 * <en/> Extracted as a function for re-binding in onActivated (KeepAlive scenario)
 */
function bindMouseEnterCapture(el: Element | null) {
  if (!el)
    return
  const captureHandler = (e: Event) => {
    if (isScrolling.value)
      e.stopPropagation()
  }
  el.addEventListener('mouseenter', captureHandler, { capture: true })
  captureMouseEnterCleanup = () => {
    el.removeEventListener('mouseenter', captureHandler, { capture: true })
    captureMouseEnterCleanup = null
  }
}

/**
 * <zh/> 解绑当前 mouseenter capture 监听器
 * <en/> Unbind the current mouseenter capture listener
 */
function unbindMouseEnterCapture() {
  captureMouseEnterCleanup?.()
  captureMouseEnterCleanup = null
}

watch(tableRootEl, (el, prevEl) => {
  if (prevEl)
    unbindMouseEnterCapture()
  if (el)
    bindMouseEnterCapture(el)
}, { immediate: true })

onBeforeUnmount(unbindMouseEnterCapture)

onDeactivated(() => {
  unbindMouseEnterCapture()
  // 隐藏表不再扫描 DOM 做 a11y 归一
  pauseGridA11yObserver(tableRootEl.value)
})

// <zh/> KeepAlive activate 时根据当前 tableRootEl 重新绑定监听器
// <en/> Re-bind listener based on current tableRootEl on KeepAlive activate
onActivated(() => {
  bindMouseEnterCapture(tableRootEl.value)
  resumeGridA11yObserver(tableRootEl.value)
})
/**
 * <zh/> 合并 selection + normal 列为叶子列视图，供 useCellEvents 解析坐标
 * <zh/> 提取为共享 composable useMergedLeafColumns，与虚拟渲染器共用同一实现
 * <en/> Merge selection + normal columns into leaf column view, for useCellEvents to resolve coordinates
 * <en/> Extracted as shared composable useMergedLeafColumns, shared with virtual renderer
 */
const allLeafColumns = useMergedLeafColumns(
  () => props.selectionColumns,
  () => props.normalColumns,
)
useRendererCellEvents<T>({
  containerRef: tableRootEl,
  columns: allLeafColumns,
  // <zh/> 数据域必须与 DOM 渲染域一致：cell locator 返回的是 tbody 内 tr 序号，
  // <zh/> 即 pinnedDisplayData 域（pin 启用时含 top/bottom 固定行）。禁止传 props.data，
  // <zh/> 否则有顶部固定行时 cellFocused/cellKeyDown 系列载荷的 row/rowIndex 整体前移。
  // <zh/> pin 关闭时 pinnedDisplayData === props.data（同引用），行为不变。
  // <en/> The data domain MUST match the rendered DOM domain: the cell locator returns tbody tr
  // <en/> ordinals, i.e. the pinnedDisplayData domain (includes top/bottom pinned rows when pin
  // <en/> is on). Never pass props.data: it shifts every cellFocused/cellKeyDown payload's row/rowIndex
  // <en/> forward by the top-pinned count. With pin off, pinnedDisplayData === props.data (same
  // <en/> reference) — no behavior change.
  data: computed(() => pinnedDisplayData.value),
  // <zh/> 单元格定位器由 DOM 适配器创建——本渲染器不持有 EP 类名/结构知识
  // <en/> The cell locator comes from the DOM adapter — this renderer holds no EP class-name/structure knowledge
  locator: props.dom.createCellLocator(),
  emit,
})

/** <zh/> 列分组折叠切换（从内联闭包提取，避免每次渲染创建新函数） | <en/> Column group collapse toggle (extracted from inline closure to avoid per-render function creation) */
function handleToggleColumnGroupCollapse(key: string) {
  emit('toggleColumnGroupCollapse', key)
}

/**
 * <zh/> 滚动定位 API——公共 tableApi.scrollToRow/scrollToColumn 的 default 模式实现。
 * <zh/> default 模式全量渲染行，行定位走 data-adv-table-row-key 精确查询 + scrollIntoView；
 * <zh/> 列定位按叶子列序累计前置宽度后在滚动容器上设置 scrollLeft（best-effort）。
 * <en/> Scroll positioning APIs — default-mode implementations behind the public
 * <en/> tableApi.scrollToRow/scrollToColumn.
 * <en/> Default mode renders all rows, so row targeting queries by data-adv-table-row-key + scrollIntoView;
 * <en/> column targeting accumulates preceding leaf widths and sets scrollLeft on the scroll container (best-effort).
 */

function scrollToRow(target: ScrollTarget, options?: ScrollToRowOptions): boolean {
  const el = (tableRef.value?.$el as HTMLElement | undefined) ?? null
  if (!el)
    return false

  // <zh/> 选择器经 rowKeyAttrSelector 构造（内含 cssEscape 防注入）——rowKey 来自数据可能含引号等特殊字符
  // <zh/> 属性名取共享常量，不再本地重声明
  // <en/> The selector is built by rowKeyAttrSelector (which applies cssEscape against injection)
  // <en/> rowKey comes from data and may contain quotes. The attribute name comes from the shared
  // <en/> constant instead of a local re-declaration
  const rowEl = el.querySelector(rowKeyAttrSelector(target))
  if (!rowEl)
    return false

  const block = options?.align === 'start'
    ? 'start'
    : options?.align === 'center'
      ? 'center'
      : options?.align === 'end' ? 'end' : 'nearest'
  // <zh/> behavior 透传——支持 scrollToRow(target, { behavior: 'smooth' }) 平滑滚动
  // <en/> behavior passthrough — enables smooth scrolling via scrollToRow(target, { behavior: 'smooth' })
  rowEl.scrollIntoView({ block, inline: 'nearest', behavior: options?.behavior })
  return true
}

function scrollToColumn(target: ScrollTarget): boolean {
  const el = (tableRef.value?.$el as HTMLElement | undefined) ?? null
  if (!el)
    return false

  const cols = allLeafColumns.value
  // <zh/> 列身份双匹配（key 或 prop 均命中），与 columnByKeyMap 双注册、virtual keyToIndex（getColumnKey）同口径；
  // <zh/> 另兼容 ElTable 内部列对象的 property 形态（经 resolveColumnProp）。
  // <en/> Dual column-identity match (key or prop both hit), same caliber as columnByKeyMap dual
  // <en/> registration and virtual keyToIndex (getColumnKey); also tolerates ElTable internal
  // <en/> column objects' property shape (via resolveColumnProp).
  const index = cols.findIndex(c => getColumnKey(c) === target || resolveColumnProp(c) === target)
  if (index < 0 || index >= cols.length)
    return false

  let left = 0
  for (let i = 0; i < index; i++)
    left += Number(cols[i]?.width ?? 0)

  // <zh/> 滚动容器经 DOM 适配器解析：滚动条 wrap 优先，缺失回退 body 包装
  // <en/> Scroll container resolved via the DOM adapter: scrollbar wrap first, body wrapper as fallback
  const wrap = (el.querySelector(props.dom.getBodyScrollbarSpec().scrollWrap) ?? el.querySelector(props.dom.getBodySelector())) as HTMLElement | null
  if (!wrap)
    return false
  wrap.scrollTo({ left: Math.max(0, left), behavior: undefined })
  return true
}

defineExpose({ ...rendererExpose, scrollToRow, scrollToColumn, getInteractionDomain } satisfies ITableRenderer as ITableRenderer & typeof rendererExpose)

const {
  teleportRowRect,
  shouldUseTeleport,
  wrappedHandleScroll: originalWrappedHandleScroll,
  handleForceHide,
} = useTeleportRowRect({
  hoverOptionTeleport,
  hasHoverOptionColumns,
  hoverRowKey,
  hoverLayerVisible,
  handleScroll,
  isScrolling,
  rediscoverHover: rediscoverHoverAfterScroll,
  // <zh/> 表格根（ElTable 根）——供 teleport 矩形域区分表内滚动与祖先滚动
  // <en/> Table root (ElTable root) — lets the teleport-rect domain separate in-table from ancestor scrolls
  getRootEl: () => tableRef.value?.$el as HTMLElement | null,
  locateHoveredRow: (() => {
    const locate = createHoverLocator({
      getContainer: () => tableRef.value?.$el as HTMLElement | null,
      // <zh/> 行/body 选择器与滚动条规格均由 DOM 适配器供给（渲染器不持有 EP 类名）
      // <en/> Row/body selectors and the scrollbar spec all come from the DOM adapter
      dom: props.dom,
      hoverRowKey,
    })
    return () => {
      const rect = locate()
      if (rect)
        return rect
      // <zh/> 回退：通过 hoverRowIndex 直接查找行 | <en/> Fallback: find row by hoverRowIndex directly
      const el = tableRef.value?.$el as HTMLElement | undefined
      if (!el)
        return undefined
      const containerRect = getBodyContainerRect(el, {
        bodySelector: props.dom.getBodySelector(),
        scrollbars: props.dom.getBodyScrollbarSpec(),
      })
      const rows = el.querySelectorAll<HTMLElement>(props.dom.getRowSelector())
      const hoverIndex = hoverRowIndex.value
      if (hoverIndex >= 0 && hoverIndex < rows.length) {
        const rect = rows[hoverIndex].getBoundingClientRect()
        const isRowVisible = rect.top + rect.height > containerRect.top && rect.top < containerRect.bottom
        if (!isRowVisible)
          return undefined
        return clampRowToContainer(rect, containerRect)
      }
      return undefined
    }
  })(),
})

function wrappedHandleScroll(params: { scrollLeft: number, scrollTop?: number }) {
  originalWrappedHandleScroll(params)
  // <zh/> 确保 scrollTop 始终为 number，与 virtual 模式和 AdvTable 声明一致
  // <en/> Ensure scrollTop is always a number, consistent with virtual mode and AdvTable declaration
  emit('scroll', { scrollLeft: params.scrollLeft, scrollTop: params.scrollTop ?? 0 })
}

/**
 * <zh/> teleport 操作条渲染域——ref 只交给 HoverTeleportOverlay 消费，禁止在本渲染器模板内读取，
 * <zh/> 否则每次跨行/滚动帧都会重渲染整表（ElTable 插槽重建 → ElTableBody 全量 renderRow）。
 * <en/> Teleport bar render domain — the refs are consumed only by HoverTeleportOverlay and must NOT be
 * <en/> read in this renderer's template, or every row crossing/scroll frame re-renders the whole table
 * <en/> (ElTable slot rebuild → full ElTableBody renderRow).
 */
const teleportOverlay: TableHoverTeleportOverlayApi = {
  hoverRowData,
  hoverRowIndex,
  rowRect: teleportRowRect,
  isScrolling,
  zIndex: computed(() => getHoverOptionZIndex(props.columns)),
  onEnter: handleHoverLayerEnter,
  onLeave: handleHoverLayerLeave,
  onForceHide: handleForceHide,
}

useHoverLayerProvider({
  api: {
    hoverRowKey,
    hoverLayerVisible,
    hoverLayerCollapsed,
    hoverLayerStyle,
    hoverOptionColumns,
    hoverOptionTeleport,
    shouldUseTeleport,
    onToggleCollapse: toggleHoverLayerCollapse,
    teleportOverlay,
    scrollBody: (dx, dy) => {
      const el = tableRef.value?.$el as HTMLElement | undefined
      if (!el)
        return false
      const bodyWrapper = el.querySelector(props.dom.getBodySelector())
      if (!bodyWrapper)
        return false
      const scrollEl = bodyWrapper.querySelector<HTMLElement>(props.dom.getBodyScrollbarSpec().scrollWrap) ?? bodyWrapper
      const nextTop = scrollEl.scrollTop + dy
      const nextLeft = scrollEl.scrollLeft + dx
      const maxTop = scrollEl.scrollHeight - scrollEl.clientHeight
      const maxLeft = scrollEl.scrollWidth - scrollEl.clientWidth
      // At edge — clamp and return false to allow fallback
      if (nextTop < 0 || nextTop > maxTop || nextLeft < 0 || nextLeft > maxLeft) {
        scrollEl.scrollTop = Math.max(0, Math.min(nextTop, maxTop))
        scrollEl.scrollLeft = Math.max(0, Math.min(nextLeft, maxLeft))
        return false
      }
      scrollEl.scrollTop = nextTop
      scrollEl.scrollLeft = nextLeft
      return true
    },
  },
})

/**
 * <zh/> 过滤掉需要 teleport 的 hover 操作列——在 teleport 模式下，hover 操作列由悬浮操作条渲染，
 * <zh/> 不应再在 ElTable 中出现。仅在 shouldUseTeleport 为 true 时过滤，否则零开销透传。
 * <en/> Filter out hover action columns that need teleport — in teleport mode, hover action columns
 * <en/> are rendered by the hover action bar and should not appear in ElTable again. Zero-overhead
 * <en/> passthrough when shouldUseTeleport is false.
 */
// <zh/> 引用守卫——列对象同一性（===）而非值语义，避免 useStableComputed 的 shallowEqual 误判不同引用同值列 | <en/> Reference guard — column identity (===) not value semantics, avoids useStableComputed shallowEqual misjudging different refs with same values

const filteredColumns = computed<ProcessedColumn[]>((prev) => {
  if (!shouldUseTeleport.value)
    return props.columns
  const result = props.columns.filter(col => !isTeleportHoverColumn(col))
  if (prev && prev.length === result.length && prev.every((item, i) => item === result[i]))
    return prev
  return result
})

/**
 * <zh/> 合并表头样式失步自愈（与虚拟模式同机制）——default 模式仅做叶子对齐 + 缺失类回填，
 * <zh/> 分组头宽度归 EP 表格布局所有（dev 告警提示，不直接写）。容器尺寸经 ResizeObserver 实测。
 * <en/> Merged-header style desync self-healing (same mechanism as virtual mode) — default mode heals
 * <en/> leaves plus missing-class backfill only; group widths belong to EP's table layout (dev warns,
 * <en/> never written). Container size comes from a ResizeObserver measurement.
 */
const { width: headerReconcileWidth, height: headerReconcileHeight } = useElementSize(tableRootEl)
useHeaderStyleReconcile({
  rootEl: () => tableRootEl.value,
  dom: props.dom,
  ownsGroupHeaderWidths: () => false,
  columnsVersion: () => filteredColumns.value
    .map(col => `${getColumnKey(col)}:${Number((col as { width?: unknown }).width ?? 0)}`)
    .join('|'),
  data: () => pinnedDisplayData.value,
  measuredWidth: headerReconcileWidth,
  measuredHeight: headerReconcileHeight,
  skipWatchdog: () => lowPerformance.value,
})

/**
 * <zh/> 交互域显示坐标（defineExpose 惰性读取）——行取 pinnedDisplayData 域，列取过滤后叶子列，
 * <zh/> columnIndexes 为两域同构的恒等映射（default 事件域即 cells 域序）。
 * <en/> Interaction display coordinates (lazily read via defineExpose) — rows come from the
 * <en/> pinnedDisplayData domain, columns from the filtered leaf columns, with columnIndexes as
 * <en/> the identity mapping (default's event domain is isomorphic to the cells domain).
 */
function getInteractionDomain() {
  const columns = props.normalColumns.filter(col => !isTeleportHoverColumn(col) || !shouldUseTeleport.value)
  return {
    rows: pinnedDisplayData.value,
    columns,
    columnIndexes: columns.map((_, index) => index),
  }
}

const computedSlots = computed<Record<string, any>>((prev) => {
  const next = props.forwardedSlots
  if (next)
    return next
  // forwardedSlots 为空时复用上一次的空对象引用，避免模板重渲染
  // Reuse the previous empty-object reference when forwardedSlots is empty, avoiding template re-render
  return prev ?? {}
})

const { t } = useRendererLocale(props.t)

/**
 * <zh/> 合并单元格策略 — 展开行/分组头行的 span 和类名逻辑统一由 useSpanStrategy 管理
 * <en/> Span strategy — detail/group-header row span and class logic unified via useSpanStrategy
 */
const {
  mergedSpanMethod,
  mergedRowClassName: baseRowClassName,
} = useSpanStrategy(
  {
    rowExpandApi,
    rowGroupApi,
    selectionColumnCount: () => props.selectionColumns.length,
    normalColumnCount: () => props.normalColumns.length,
  },
  () => unref(props.spanMethod),
  () => props.rowClassName,
)

/**
 * <zh/> 合计行类名包装——在 span 策略类名基础上追加 Grand/Group 合计标记类（含粘性修饰），
 * <zh/> 供表尾对齐 CSS 与 sticky 降级（Safari）兜底。原 rowClassName 字符串/函数语义保持不变。
 * <en/> Total-row class wrapper — appends grand/group total marker classes (with sticky modifiers)
 * <en/> on top of the span-strategy class, for footer-alignment CSS and sticky fallbacks. The original
 * <en/> rowClassName string/function semantics are preserved.
 */
function totalAwareRowClassName(params: { row: any, rowIndex: number }): string {
  const base = baseRowClassName(params) ?? ''
  const row = params.row
  let extra = ''
  if (isGrandTotalRow(row))
    extra = `adv-table__grand-total adv-table__grand-total--${row.__grandPosition}${row.__sticky ? ' adv-table__total--sticky' : ' adv-table__total--static'}`
  else if (isGroupTotalRow(row))
    extra = `adv-table__group-total adv-table__group-total--${row.__groupTotalPosition}${row.__sticky ? ' adv-table__total--sticky' : ' adv-table__total--static'}`
  if (!extra)
    return base as string
  return base ? `${base} ${extra}` : extra
}
</script>

<template>
  <!--
    <zh/> 单根包裹层（display: contents）——ElTable 与悬浮操作条合并为单一 vnode 根：
    避免 fragment 根导致的 attrs 透传失效 / Transition 与 ref 行为异常等问题；
    display: contents 使包裹层不生成盒模型，子元素仍直接参与 .adv-table__body-row
    的 flex 布局（order/flex 规则继续命中 .adv-table__main），视觉零影响。
    <en/> Single-root wrapper (display: contents) — merges ElTable and hover action bar into one vnode root,
    avoiding fragment-root pitfalls (attrs fallthrough loss, Transition/ref anomalies);
    display: contents generates no box, so children still participate directly as flex items
    of .adv-table__body-row (order/flex rules keep matching .adv-table__main). Zero visual impact.
  -->
  <div
    v-grid-a11y
    class="adv-table-default-renderer"
    v-bind="gridA11yAttrs"
  >
    <ElTable
      ref="tableRef"
      v-bind="tableProps"
      v-loading="props.loading"
      class="adv-table__main"
      :data="pinnedDisplayData"
      :row-key="getRowKey"
      :height="props.height"
      :stripe="props.stripe"
      :border="props.border"
      :show-header="props.showHeader"
      :highlight-current-row="props.highlightCurrentRow"
      :size="props.size"
      :table-layout="props.tableLayout"
      :empty-text="props.emptyText"
      :span-method="mergedSpanMethod"
      :row-class-name="totalAwareRowClassName"
      :row-style="resolvePinnedRowStyle"
      :tooltip-effect="props.tooltipEffect"
      :tooltip-options="props.tooltipOptions"
      :show-summary="showFooterSummary"
      :summary-method="wrappedSummaryMethod"
      :sum-text="grandLabel"
      :tree-props="EL_TABLE_DISABLED_TREE_PROPS"
      v-on="{ ...tableEventBindings, ...hoverTableEvents }"
      @keydown="handleHeaderKeyDown"
      @current-change="handleCurrentChange"
      @cell-mouse-enter="handleCellMouseEnter"
      @cell-mouse-leave="handleCellMouseLeave"
      @scroll="wrappedHandleScroll"
    >
      <SelectionColumn
        :selection-columns="props.selectionColumns"
        :visible-data="pinnedDisplayData"
        :check-status="props.checkStatus"
        :selectable-fn="props.selectableFn"
        :row-key="getRowKey"
        :selection-mode="resolvedSelectionMode"
      />
      <NormalColumn
        v-for="(col, index) in filteredColumns"
        :key="getColumnKey(col)"
        :col="col"
        :col-index="index"
        :display-normal-columns="displayNormalColumns"
        :auto-size-columns="props.autoSizeColumns"
        :has-hover-option-columns="hasHoverOptionColumns"
        :floating-filter="props.floatingFilter"
        :slots="computedSlots"
        :t="t"
        :row-key="getRowKey"
        :original-columns="props.originalColumns"
        :can-collapse="props.canCollapse"
        :is-collapsed="props.isCollapsed"
        :edit-config="props.editConfig"
        @toggle-column-group-collapse="handleToggleColumnGroupCollapse"
        @toggle-sort="filterSortApi?.onToggleSort"
      />
      <!--
        @slot default - 声明式列透传（仅 default 模式；virtual 模式由 AdvTable 层警告并丢弃，不到达此处）
        @slot Default slot passthrough for declarative columns (default mode only; virtual is warned and dropped at the AdvTable layer)
      -->
      <slot />
      <template
        v-if="$slots.empty"
        #empty
      >
        <slot name="empty" />
      </template>
      <template
        v-if="$slots.append"
        #append
      >
        <slot name="append" />
      </template>
    </ElTable>

    <HoverTeleportOverlay />
  </div>
</template>
