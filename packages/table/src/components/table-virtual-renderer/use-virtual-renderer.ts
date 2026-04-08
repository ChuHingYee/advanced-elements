import type { ComputedRef, CSSProperties, MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import type { HeaderEventEmits, RowEventEmits } from '../../composables/rendering/use-renderer-common'
import type { CheckStatus } from '../../composables/selection/use-selection-state'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { RowKeyMeta } from '../../types/row-rect'
import type { Translator } from '../../types/translator'
import type { TableRendererExpose } from '../../utils/table-drag'
import { ElTableV2 } from 'element-plus'
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, toValue, watch } from 'vue'
import { useColumnResize } from '../../composables/columns/use-column-resize'
import { useHoverLayerStyle } from '../../composables/rendering/use-hover-layer'
import { useRendererCommon } from '../../composables/rendering/use-renderer-common'
import { DEFAULT_COLUMN_WIDTH, findColumnByKey } from '../../utils/column-tree'
import { shallowEqual } from '../../utils/equality'
import { filterTableProps } from '../../utils/filter-table-props'
import { AUTO_KEY_NAME, normalizeRowKey } from '../../utils/normalize-row-key'
import { buildColumnIndexOrder, buildColumnKeySignature, isRowSelectable as checkRowSelectable, getColumnKey } from '../../utils/shared'
import { filterTeleportHoverColumns } from '../renderer-core/column-build-shared'
import { pauseGridA11yObserver, resumeGridA11yObserver } from '../renderer-core/grid-a11y-attrs'
import { createRendererExpose, useSharedCurrentRow } from '../renderer-core/renderer-expose'

export interface UseVirtualRendererOptions<T> {
  /** <zh/> 低性能档（透传至 useRendererCommon/useHoverLayer） | <en/> Low performance tier (forwarded to useRendererCommon/useHoverLayer) */
  lowPerformance?: MaybeRefOrGetter<boolean>
  /**
   * <zh/> teleport 是否生效：事件列域必须与渲染列域（normal-v2-column 的 filteredCols）
   * <zh/> 使用同一开关 + 同一过滤函数，否则 data-adv-cell-col 索引错位。未注入时回退 hoverOptionTeleport。
   * <en/> Whether teleport takes effect: the event column domain must share the same switch + filter function
   * <en/> with the render column domain (filteredCols of normal-v2-column), otherwise data-adv-cell-col indexes misalign.
   * <en/> Falls back to hoverOptionTeleport when uninjected.
   */
  isTeleportActive?: MaybeRefOrGetter<boolean | undefined>
  props: {
    columns: LocalColumn[]
    data: T[]
    height?: number | string
    width?: number | string
    selectionWidth?: number
    forwardedSlots?: any
    t?: Translator
    rowKey: ((row: T) => string)
    selectionColumns: LocalColumn[]
    normalColumns: LocalColumn[]
    selectableData: T[]
    selectableFn?: (row: any, index: number) => boolean
    checkStatus: CheckStatus
    hoverOptionColumns?: LocalColumn[]
    hasHoverOptionColumns?: boolean
    hoverOptionTeleport?: boolean
    /**
     * <zh/> 显式字段型 rowKey 的字段名：存在时 EP `:row-key` 直接用原字段
     * <zh/>（冻结行无需写入 AUTO_KEY）；函数/auto 时回退 AUTO_KEY_NAME。
     * <en/> Field name of an explicit field-style rowKey: EP `:row-key` uses the raw field directly when present
     * <en/> (no AUTO_KEY writes for frozen rows); function/auto falls back to AUTO_KEY_NAME.
     */
    rowKeyField?: string | number | symbol
    displayNormalColumns?: LocalColumn[]
    selectionColumnSyncKey?: string
    keepAliveHover?: boolean
    border?: boolean
    resizable?: boolean
    autoSizeColumns?: boolean
    /** <zh/> 当前模式 DOM 适配器（透传至 useRendererCommon/useHoverLayer 与 useColumnResize） | <en/> Current-mode DOM adapter (forwarded to useRendererCommon/useHoverLayer and useColumnResize) */
    dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
  }
  rowKeyMeta?: MaybeRefOrGetter<RowKeyMeta<T>>
  tableV2Ref: Ref<InstanceType<typeof ElTableV2> | null>
  containerRef?: Ref<HTMLElement | null>
  rowEmit?: RowEventEmits<T>
  headerEmit?: HeaderEventEmits
  resizeProxyRef?: Ref<HTMLElement | undefined | null>
}

/**
 * <zh/> ElTableV2 属性键集合（懒求值）
 * <en/> ElTableV2 prop key set (lazily evaluated)
 *
 * @returns <zh/> 属性键集合；SSR 无 DOM 时返回空集合 | <en/> prop key set; empty set when SSR without DOM
 *
 * @remarks
 * <zh/> 模块顶层求值会在 SSR import 阶段执行，延迟到首次调用可避免服务端崩溃。
 * <en/> Module-level evaluation runs at SSR import time; deferring to first call avoids server crashes.
 */
let cachedElTableV2PropKeys: Set<string> | null = null
function getElTableV2PropKeys(): Set<string> {
  if (!cachedElTableV2PropKeys) {
    // SSR 环境无 DOM，直接返回空集合走透传降级
    // Without DOM in SSR, return an empty set for passthrough fallback
    if (typeof window === 'undefined') {
      cachedElTableV2PropKeys = new Set()
    }
    else {
      cachedElTableV2PropKeys = new Set(Object.keys(ElTableV2.props || {}))
    }
  }
  return cachedElTableV2PropKeys
}

/**
 * <zh/> 模板已显式绑定的键——filterTableProps 排除透传。由 ep-props guard 测试锚定：任一条目必须真实存在于 ElTableV2.props，否则为幻觉键。
 * <en/> Template-bound keys excluded from passthrough. Anchored by the ep-props guard test: every entry must really exist in ElTableV2.props.
 */
export const EXPLICITLY_BOUND = new Set([
  'columns',
  'data',
  'rowKey',
  'height',
  'width',
  'headerHeight',
  'footerHeight',
  'fixed',
  'rowClass',
  'rowEventHandlers',
  'cache',
  'estimatedRowHeight',
  'vScrollbarSize',
  /**
   * <zh/> `sortState` 同为 ElTableV2 原生 prop，但其期望形状是 `{ [columnKey]: SortOrder }`，
   * <zh/> 而本库下发的 `sortState` 是 `SortState[]`（供自有 v2 表头使用）。进白名单即不再透传给 EP，
   * <zh/> 避免 EP 侧读到形状不符的排序状态（表头已由 `#header` 槽接管，无需 EP 的排序状态）。
   * <en/> `sortState` is also an ElTableV2 native prop, but EP expects `{ [columnKey]: SortOrder }`
   * <en/> whereas this library hands down `SortState[]` (used by our own v2 header). Whitelisting it here
   * <en/> stops a shape-mismatched value reaching EP (the header is owned by the `#header` slot, so EP needs
   * <en/> no sort state).
   */
  'sortState',
])

export interface UseVirtualRendererReturn<T> {
  currentRow: ShallowRef<T | null>
  currentRowKey: ComputedRef<string | null>
  rowKeyFn: ComputedRef<(row: T) => string>
  /** <zh/> 传给 EP :row-key 的属性名：显式字段直传，否则 AUTO_KEY_NAME | <en/> Attribute name passed to EP :row-key: explicit fields pass through, otherwise AUTO_KEY_NAME */
  rowKeyAttr: ComputedRef<string | number | symbol>
  rendererExpose: TableRendererExpose
  isRowSelectable: (row: T, index: number) => boolean
  hoverOptionColumns: ComputedRef<LocalColumn[]>
  hasHoverOptionColumns: ComputedRef<boolean>
  hoverOptionTeleport: ComputedRef<boolean | undefined>
  displayNormalColumns: ComputedRef<LocalColumn[]>
  selectionColumnSyncKey: ComputedRef<string>
  keepAliveHover: ComputedRef<boolean>
  getColumnWidth: (col: any) => number
  columnWidths: Record<string, number>
  handleHeaderMouseMove: (event: MouseEvent) => void
  handleHeaderMouseOut: (event: MouseEvent) => void
  handleHeaderKeyDown: (event: KeyboardEvent) => void
  handleResizeStart: (event: MouseEvent) => void
  resizeProxyVisible: Ref<boolean>
  tableContainerWidth: ShallowRef<number>
  columnsTotalWidth: ComputedRef<number>
  hoverRowKey: Ref<string | null>
  /** <zh/> 悬停行数据（不透明行对象，实现侧恒为 shallowRef，禁止深代理） | <en/> Hovered row data (opaque row object, always a shallowRef impl-side, never deeply proxied) */
  hoverRowData: Ref<any>
  hoverRowIndex: Ref<number>
  hoverLayerVisible: Ref<boolean>
  hoverLayerCollapsed: Ref<boolean>
  hoverLayerStyle: ComputedRef<CSSProperties>
  toggleHoverLayerCollapse: (event: Event) => void
  handleHoverLayerEnter: () => void
  handleHoverLayerLeave: () => void
  /** <zh/> 滚动停止后重新发现鼠标下方的行 | <en/> Re-discover the row under the cursor after scrolling stops */
  rediscoverHoverAfterScroll: () => void
  rowEventHandlers: ComputedRef<{
    onMouseenter: (params: { rowData: T, rowIndex: number, event?: Event }) => void
    onMouseleave: () => void
    onClick?: (params: { rowData: T, rowIndex: number, event: Event, rowKey: any }) => void
    onContextmenu?: (params: { rowData: T, rowIndex: number, event: Event, rowKey: any }) => void
    onDblclick?: (params: { rowData: T, rowIndex: number, event: Event, rowKey: any }) => void
  }>
  handleScroll: { (args: { scrollLeft: number }): void, cancel: () => void }
  /** <zh/> 滚动状态标志，传入 useTeleportRowRect 维护 | <en/> Scroll state flag, maintained by useTeleportRowRect */
  isScrolling: Ref<boolean>
  /** <zh/> 清除列宽拖拽缓存的 DOM Rect，防止虚拟滚动回收后使用过期坐标 | <en/> Clear the cached DOM Rect of column-width dragging to prevent using stale coordinates after virtual scroll recycling */
  clearCachedRect: () => void
  /** <zh/> 重置列宽拖拽缓存 | <en/> Reset column resize drag cache */
  resetColumnWidths: () => void
  tableProps: ComputedRef<Record<string, unknown>>
}

/**
 * <zh/> 虚拟滚动渲染器 composable，管理虚拟行渲染、列宽计算与滚动同步
 * <en/> Virtual scroll renderer composable, manages virtual row rendering, column width calculation, and scroll synchronization
 */
export function useVirtualRenderer<T>(options: UseVirtualRendererOptions<T>): UseVirtualRendererReturn<T> {
  const { props, tableV2Ref, containerRef, rowEmit, headerEmit, rowKeyMeta, resizeProxyRef, isTeleportActive } = options
  const rowKeyFn = computed<(row: T) => string>(() => {
    if (props.rowKey)
      return props.rowKey

    return normalizeRowKey<T>()
  })
  // <zh/> currentRow 三源合一——注入共享引用（无 provider 时回退本地 ref），替代本地 shallowRef
  // <en/> currentRow three-sources-unified — inject the shared reference (falls back to a local ref
  // <en/> without a provider) instead of a renderer-local shallowRef
  const currentRow = useSharedCurrentRow<T>()
  const currentRowKey = computed(() => {
    const row = currentRow.value
    return row ? rowKeyFn.value(row) : null
  })

  function isRowSelectable(row: T, index: number): boolean {
    return checkRowSelectable(row, index, props.selectableFn)
  }

  function getRootEl(): HTMLElement | null {
    return ((tableV2Ref.value?.$el ?? tableV2Ref.value) as HTMLElement | undefined) ?? null
  }

  /**
   * <zh/> 当前模式 DOM 适配器——本文件所有 EP 结构查询经其解析，缺 dom 时返回 null
   * <zh/>（调用方 resolveDragContainer 经 tableId 回退，正确性不变）。
   * <en/> Current-mode DOM adapter — all EP structure queries go through it.
   */
  function domAdapter() {
    return toValue(props.dom) ?? null
  }

  function getColumnDragContainer(): HTMLElement | null {
    const rootEl = getRootEl()
    const dom = domAdapter()
    if (!rootEl || !dom)
      return null
    // <zh/> 表头行优先，`[role="row"]` 兜底（结构知识收敛至适配器）
    // <en/> Header row first, `[role="row"]` as fallback (structural knowledge converged into the adapter)
    return (rootEl.querySelector(dom.getHeaderRowSelector())
      ?? rootEl.querySelector(`${dom.getHeaderSelector()} [role="row"]`)) as HTMLElement | null
  }

  function getRowDragContainer(): HTMLElement | null {
    const rootEl = getRootEl()
    const dom = domAdapter()
    if (!rootEl || !dom)
      return null
    const scope = dom.getScopeSelector() ?? ''
    const rowSelector = dom.getRowSelector()
    // <zh/> 首行父级回退 main（`main row, main [role=row]`），选择器来源为适配器；
    // <zh/> scope 在 virtual 适配器恒有值，`?? ''` 仅为类型收窄（无 scope 时退化为根内全量匹配再回退 null）
    // <en/> Falls back to the first row's parent (`main row, main [role=row]`); selectors come from the adapter
    // <en/> scope always holds a value in the virtual adapter; `?? ''` only narrows the type (without scope, degrades to full in-root matching, then null)
    const firstRow = rootEl.querySelector(`${scope} ${rowSelector}, ${scope} [role="row"]`) as HTMLElement | null
    return firstRow?.parentElement ?? (scope ? rootEl.querySelector(scope) as HTMLElement | null : null)
  }

  const rendererExpose = createRendererExpose({
    getRootEl,
    getColumnDragContainer,
    getRowDragContainer,
    defaultColumnDragHandle: '.adv-table__v2-header-cell',
    defaultRowDragHandle: '.adv-table__cell',
    // <zh/> EP 内置表头单元格选择器经适配器解析（命名空间化）；缺 dom 时回退自有表头类（单测等无 dom 场景）。
    // <zh/> 可拖拽匹配 = EP 原生胞 + 自有 framed 自定义头（选择列/分组头）：与此前匹配集合一致，
    // <zh/> EP 改名后自定义头仍可拖拽（原生胞走 EP-UPGRADE-CHECKLIST 回归）。
    // <en/> Namespace-aware built-in EP header-cell selector via the adapter, falling back to the
    // <en/> owned header class without dom (dom-less scenarios like unit tests).
    // <en/> Draggable matching = EP-native cells + owned framed custom headers (selection/group):
    // <en/> identical match set as before, custom headers stay draggable after an EP rename
    // <en/> (native cells regressed per EP-UPGRADE-CHECKLIST).
    columnDraggableSelector: [
      domAdapter()?.getHeaderCellSelector() ?? '.adv-table__v2-header-cell',
      '.adv-table__v2-header-cell--framed',
    ].join(', '),
  })

  const {
    getColumnWidth,
    columnWidths,
    handleHeaderMouseMove,
    handleHeaderMouseOut,
    handleHeaderKeyDown,
    handleResizeStart,
    resizeProxyVisible,
    clearCachedRect,
    resetColumnWidths,
  } = useColumnResize({
    getColumnKey: col => getColumnKey(col),
    columns: computed(() => props.normalColumns),
    groupTree: computed(() => props.columns),
    resizeProxyRef,
    resizable: computed(() => props.resizable),
    dom: props.dom,
    onHeaderDragend: (params) => {
      const column = findColumnByKey(props.normalColumns, params.columnKey)
      headerEmit?.onHeaderDragend?.({ column, columnKey: params.columnKey, newWidth: params.newWidth, oldWidth: params.oldWidth, event: params.event })
    },
  })

  const tableContainerWidth = shallowRef(0)

  const MEASURE_EPSILON = 0.5

  const mainContentWidth = shallowRef(0)
  let mainResizeObserver: ResizeObserver | null = null
  let observedMain: HTMLElement | null = null
  /** <zh/> rAF 节流 ID，避免 ResizeObserver 高频回调导致 reflow | <en/> rAF throttle ID, avoids ResizeObserver high-frequency callbacks causing reflow */
  let measureRafId: number | null = null
  /** <zh/> 缓存最近一次 ResizeObserver 回调传入的 contentRect.width，避免在 rAF 回调中再次 getBoundingClientRect 导致强制布局 | <en/> Cache the latest contentRect.width from ResizeObserver callback, avoids forced layout from getBoundingClientRect in rAF callback */
  let pendingMainWidth: number | null = null
  /** <zh/> KeepAlive 失活闸门——失活期间不重装 observer、不写宽度 | <en/> KeepAlive deactivation gate — no observer reinstall or width writes while hidden */
  let isDeactivated = false

  /**
   * <zh/> 应用缓存的测量值到 mainContentWidth
   * <en/> Apply cached measurement to mainContentWidth
   *
   * <zh/> 使用 ResizeObserverEntry.contentRect 替代 getBoundingClientRect：
   * <zh/> 浏览器在派发回调时已计算好 contentRect，无需额外触发同步布局（避免 layout thrashing）。
   * <en/> Use ResizeObserverEntry.contentRect instead of getBoundingClientRect:
   * <en/> browser computes contentRect when dispatching the callback, no extra forced sync layout needed (avoids layout thrashing).
   */
  function applyPendingMainWidth() {
    measureRafId = null
    if (pendingMainWidth == null)
      return
    const measuredWidth = pendingMainWidth
    pendingMainWidth = null
    if (measuredWidth > 0 && Math.abs(mainContentWidth.value - measuredWidth) > MEASURE_EPSILON)
      mainContentWidth.value = measuredWidth
  }

  /**
   * <zh/> 卸载 ResizeObserver 并清理 rAF
   * <en/> Tear down ResizeObserver and clean up rAF
   */
  function teardownObserver() {
    if (measureRafId != null) {
      cancelAnimationFrame(measureRafId)
      measureRafId = null
    }
    pendingMainWidth = null
    mainResizeObserver?.disconnect()
  }

  function measureMainContentWidth() {
    // <zh/> autoSizeColumns 关闭时不安装 ResizeObserver，避免无意义 DOM 观察与 reflow
    // <en/> Do not install ResizeObserver when autoSizeColumns is off, avoiding meaningless DOM observation and reflow
    if (!props.autoSizeColumns) {
      teardownObserver()
      mainResizeObserver = null
      observedMain = null
      if (mainContentWidth.value !== 0)
        mainContentWidth.value = 0
      return
    }

    // KeepAlive 失活期不重装 observer——隐藏表的尺寸变化无意义，
    // 重新激活时由 onActivated 统一补一次测量
    if (isDeactivated)
      return

    const root = tableV2Ref.value?.$el as HTMLElement | undefined
    if (!root)
      return
    // <zh/> 主网格作用域经适配器解析（命名空间化）；缺 dom 时按未命中同等处理
    // <en/> Main-grid scope resolved via the adapter (namespaced); missing dom counts as a miss
    const scopeSelector = domAdapter()?.getScopeSelector()
    const main = scopeSelector ? root.querySelector<HTMLElement>(scopeSelector) : null
    if (!main) {
      teardownObserver()
      mainResizeObserver = null
      observedMain = null
      if (mainContentWidth.value !== 0)
        mainContentWidth.value = 0
      return
    }

    // <zh/> 首次同步测量：建立初始值，减少初始 0→真实值 跳变
    // <en/> First synchronous measurement: establish initial value, reducing initial 0→real-value jump
    const initialWidth = main.getBoundingClientRect().width
    if (initialWidth > 0 && Math.abs(mainContentWidth.value - initialWidth) > MEASURE_EPSILON)
      mainContentWidth.value = initialWidth

    // 目标元素变化时重建 observer
    // Rebuild observer when target element changes
    if (observedMain !== main) {
      teardownObserver()
      observedMain = main
      // <zh/> 无 ResizeObserver 环境降级：保留同步测量值，不安装观察器，避免 ReferenceError
      // <en/> Degrade without ResizeObserver: keep the sync measurement, skip installing the observer to avoid ReferenceError
      if (typeof ResizeObserver === 'undefined')
        return
      mainResizeObserver = new ResizeObserver((entries) => {
        // <zh/> 直接使用 entry.contentRect.width，浏览器派发回调时已计算好，无需 getBoundingClientRect
        // <en/> Use entry.contentRect.width directly, browser computes it when dispatching callback, no getBoundingClientRect needed
        const entry = entries[0]
        if (!entry)
          return
        pendingMainWidth = entry.contentRect.width
        if (measureRafId != null)
          return
        measureRafId = requestAnimationFrame(applyPendingMainWidth)
      })
      mainResizeObserver.observe(main)
    }
  }
  /**
   * <zh/> 浅层追踪列结构变化，避免 deep: true 递归遍历列配置的所有嵌套属性
   * <en/> Shallowly track column structure changes, avoid deep: true recursively traversing all nested properties of column config
   * @remarks
   * <zh/> 仅当列 key/prop 结构、selectionColumns 数量、autoSizeColumns/width/height 变化时才触发测量。
   * deep: true 会在列属性微调（排序状态、筛选值等）时触发无效的 DOM 测量
   * <en/> Only triggers measurement when column key/prop structure, selectionColumns count, autoSizeColumns/width/height change.
   * deep: true would trigger invalid DOM measurements on column property tweaks (sort state, filter values, etc.)
   */
  watch(
    [
      () => buildColumnKeySignature(props.columns),
      () => props.selectionColumns.length,
      () => props.autoSizeColumns,
      () => props.width,
      () => props.height,
      tableV2Ref,
    ],
    () => {
      nextTick(measureMainContentWidth)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    teardownObserver()
    mainResizeObserver = null
    observedMain = null
  })

  /**
   * <zh/> KeepAlive deactivated 时清理 ResizeObserver 与 rAF
   * <en/> Clean up ResizeObserver and rAF when KeepAlive deactivated
   * @remarks
   * <zh/> 避免隐藏表格中持续观察 DOM 与调度 rAF 测量。与 use-table-pagination / use-column-drag 等 composable 保持一致
   * <en/> Avoid continuously observing DOM and scheduling rAF measurements in hidden tables. Consistent with use-table-pagination / use-column-drag composables
   *
   * <zh/> 注意：不置空 mainResizeObserver 与 observedMain，以便 reactivated 时若 observedMain 未变化可直接复用 observer
   * <en/> Note: do not nullify mainResizeObserver and observedMain, so that on reactivated, if observedMain hasn't changed, the observer can be reused directly
   */
  onDeactivated(() => {
    isDeactivated = true
    teardownObserver()
    // 隐藏表不再扫描 DOM 做 a11y 归一
    pauseGridA11yObserver(containerRef?.value)
  })

  /**
   * <zh/> KeepAlive reactivated 时重新观察主元素并触发一次测量，
   * 确保隐藏期间的容器尺寸变化被捕获。
   * <en/> Re-observe the main element and trigger a measurement when KeepAlive reactivates,
   * ensuring container size changes during hidden period are captured.
   */
  onActivated(() => {
    isDeactivated = false
    resumeGridA11yObserver(containerRef?.value)
    if (observedMain && mainResizeObserver) {
      mainResizeObserver.observe(observedMain)
      nextTick(measureMainContentWidth)
    }
  })

  const columnsTotalWidth = computed(() => {
    const selectionW = props.selectionColumns.length > 0 ? (props.selectionWidth ?? 50) : 0
    if (props.autoSizeColumns && mainContentWidth.value > 0) {
      return selectionW + mainContentWidth.value
    }
    const mainW = props.columns.reduce((sum, col) => {
      if (col.fixed) {
        return sum
      }
      const colWidth = getColumnWidth(col) ?? DEFAULT_COLUMN_WIDTH
      return sum + colWidth
    }, 0)
    return selectionW + mainW
  })

  const { hoverLayerStyle, handleScroll } = useHoverLayerStyle({
    contentWidth: columnsTotalWidth,
    containerWidth: tableContainerWidth,
  })

  /**
   * <zh/> 滚动状态标志
   * <en/> Scroll state flag
   * @remarks
   * <zh/> 由 useTeleportRowRect 的 wrappedHandleScroll 维护（滚动中 true / 停止后 false），
   * 传入 useHoverLayer 在滚动期间抑制 handleHoverRowEnter / handleHoverRowLeave。
   * 在 useTeleportRowRect 之前创建，保证 useHoverLayer 能读取到
   * <en/> Maintained by useTeleportRowRect's wrappedHandleScroll (true while scrolling / false after stopping),
   * passed to useHoverLayer to suppress handleHoverRowEnter / handleHoverRowLeave during scrolling.
   * Created before useTeleportRowRect to ensure useHoverLayer can read it
   */
  const isScrolling = ref(false)

  const {
    hoverRowKey,
    hoverRowData,
    hoverRowIndex,
    hoverLayerVisible,
    hoverLayerCollapsed,
    toggleHoverLayerCollapse,
    handleHoverLayerEnter,
    handleHoverLayerLeave,
    rediscoverHoverAfterScroll,
    hoverEvents,
  } = useRendererCommon({
    hoverOptionColumns: () => props.hoverOptionColumns ?? [],
    hasHoverOptionColumns: () => props.hasHoverOptionColumns ?? false,
    hoverOptionTeleport: () => props.hoverOptionTeleport,
    displayNormalColumns: () => props.displayNormalColumns ?? [],
    selectionColumnSyncKey: () => props.selectionColumnSyncKey ?? '',
    keepAlive: () => props.keepAliveHover ?? false,
    rowKeyMeta,
    // <zh/> 传入渲染数据 + rowKey，使 useRowKeyMetaResolver 优先从渲染数据构建 keyToIndex
    // <en/> Pass render data + rowKey so useRowKeyMetaResolver prefers building keyToIndex from render data
    data: () => props.data,
    rowKey: () => rowKeyFn.value,
    extraSyncWatchSources: [() => props.width, () => props.height],
    containerRef,
    handleScroll,
    isScrolling,
    lowPerformance: () => toValue(options.lowPerformance) ?? false,
    dom: props.dom,
  })

  const rowEventHandlers = hoverEvents.createElTableV2RowEventHandlers<T>({
    onRowClick: (params) => {
      const oldRow = currentRow.value
      if (oldRow !== params.rowData) {
        currentRow.value = params.rowData
        rowEmit?.onCurrentChange?.({ currentRow: params.rowData, oldRow })
      }
      rowEmit?.onRowClick?.(params)
    },
    onRowContextmenu: (params) => {
      rowEmit?.onRowContextmenu?.(params)
    },
    onRowDblclick: (params) => {
      rowEmit?.onRowDblclick?.(params)
    },
    onCellClick: (params) => {
      rowEmit?.onCellClick?.(params)
    },
    onCellDblclick: (params) => {
      rowEmit?.onCellDblclick?.(params)
    },
    onCellContextmenu: (params) => {
      rowEmit?.onCellContextmenu?.(params)
    },
    onCellMouseEnter: (params) => {
      rowEmit?.onCellMouseEnter?.(params)
    },
    onCellMouseLeave: () => {
      rowEmit?.onCellMouseLeave?.()
    },
  }, () => {
    /**
     * <zh/> displayColumns 传入 selection + normal(非fixed) + normal(fixed) 的合并数组，
     * <zh/> 与 V2 列数组顺序和 data-adv-cell-col 索引一致，
     * <zh/> 确保 resolveClickedColumn 能正确按索引查找列对象。
     * <zh/> 与渲染侧同一开关 + 同一过滤函数剔除 teleport 悬浮列，不得另算列域。
     * <en/> displayColumns is the merged array of selection + normal(non-fixed) + normal(fixed),
     * <en/> matching the V2 column array order and data-adv-cell-col indices,
     * <en/> ensuring resolveClickedColumn correctly looks up column objects by index
     */
    const selection = props.selectionColumns ?? []
    const normal = props.normalColumns ?? []
    const merged = buildColumnIndexOrder(selection, normal)
    const isTeleport = toValue(isTeleportActive) ?? props.hoverOptionTeleport ?? false
    return filterTeleportHoverColumns(merged, isTeleport)
  })

  // <zh/> 引用稳定——过滤结果浅相等时复用上一次引用，避免每次求值生成新对象
  // <zh/> 导致 ElTableV2 v-bind 全量 patch（库内 v2Columns:1003 范式）。
  // <en/> reference stability — reuses the previous reference on shallow-equal
  // <en/> filter results, avoiding a fresh object per evaluation that would force a full
  // <en/> ElTableV2 v-bind patch (the codebase's v2Columns:1003 pattern).
  const tableProps = computed<Record<string, unknown>>((prev) => {
    const next = filterTableProps(props, getElTableV2PropKeys(), EXPLICITLY_BOUND)
    if (prev && shallowEqual(prev as Record<string, unknown>, next))
      return prev
    return next
  })

  // 显式字段型 rowKey 直接把原字段传给 EP（冻结行无需写入 AUTO_KEY）；
  // 函数/auto 回退 AUTO_KEY_NAME（冻结行退化仅 dev 告警，见 normalize-row-key）。
  const rowKeyAttr = computed(() => props.rowKeyField ?? AUTO_KEY_NAME)

  return {
    currentRow,
    currentRowKey,
    rowKeyFn,
    rowKeyAttr,
    rendererExpose,
    isRowSelectable,
    hoverOptionColumns: computed(() => props.hoverOptionColumns ?? []),
    hasHoverOptionColumns: computed(() => props.hasHoverOptionColumns ?? false),
    hoverOptionTeleport: computed(() => props.hoverOptionTeleport),
    displayNormalColumns: computed(() => props.displayNormalColumns ?? []),
    selectionColumnSyncKey: computed(() => props.selectionColumnSyncKey ?? ''),
    keepAliveHover: computed(() => props.keepAliveHover ?? false),
    getColumnWidth,
    columnWidths,
    handleHeaderMouseMove,
    handleHeaderMouseOut,
    handleHeaderKeyDown,
    handleResizeStart,
    resizeProxyVisible,
    tableContainerWidth,
    columnsTotalWidth,
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
    clearCachedRect,
    resetColumnWidths,
    tableProps,
  }
}
