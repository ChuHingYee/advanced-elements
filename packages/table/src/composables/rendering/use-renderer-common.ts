import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import type { ProcessedColumn } from '../../types'
import type { RowKeyMeta } from '../../types/row-rect'
import type { RowEventEmits } from '../rendering/use-row-events'
import { computed, toValue, watch } from 'vue'
import { buildColumnIndexOrder } from '../../utils/shared'
import { useHoverLayer } from '../rendering/use-hover-layer'
import { useElTableHoverEvents, useElTableV2RowEventHandlers } from '../rendering/use-row-events'
import { useTeleportRowRect } from '../rendering/use-teleport-row-rect'

export interface UseRendererCommonOptions {
  hoverOptionColumns: MaybeRefOrGetter<ProcessedColumn[]>
  hasHoverOptionColumns: MaybeRefOrGetter<boolean>
  hoverOptionTeleport: MaybeRefOrGetter<boolean | undefined>
  /** <zh/> 普通（非 selection）显示列 | <en/> Normal (non-selection) display columns */
  displayNormalColumns: MaybeRefOrGetter<ProcessedColumn[]>
  /** <zh/> selection 列同步 key | <en/> Selection column sync key */
  selectionColumnSyncKey: MaybeRefOrGetter<string>
  keepAlive: MaybeRefOrGetter<boolean>
  /** <zh/> 行键元数据（从 table.vue inject） | <en/> Row key metadata (injected from table.vue) */
  rowKeyMeta?: MaybeRefOrGetter<RowKeyMeta>
  data?: MaybeRefOrGetter<any[]>
  rowKey?: MaybeRefOrGetter<(row: any) => string>
  extraSyncWatchSources?: MaybeRefOrGetter<unknown>[]
  containerRef?: MaybeRefOrGetter<HTMLElement | null | undefined>
  handleScroll?: { cancel?: () => void }
  /**
   * <zh/> 滚动状态标志：滚动期间为 true，停止 150ms 后回落 false
   * <en/> Scroll state flag: true during scrolling, falls back to false 150ms after stopping
   * @remarks
   * <zh/> 由 useTeleportRowRect 的 wrappedHandleScroll 维护（两种渲染器共用），用于在滚动期间抑制 handleHoverRowEnter / handleHoverRowLeave
   * <en/> Maintained by useTeleportRowRect's wrappedHandleScroll (shared by both renderers), used to suppress handleHoverRowEnter / handleHoverRowLeave during scrolling
   */
  isScrolling?: MaybeRefOrGetter<boolean>
  /** <zh/> 低性能档——透传至 useHoverLayer 关闭 hover 鼠标追踪（performanceProfile=low） | <en/> Low performance tier — forwarded to useHoverLayer to disable hover mouse tracking */
  lowPerformance?: MaybeRefOrGetter<boolean>
  /** <zh/> 当前模式 DOM 适配器——透传至 useHoverLayer 做行反查 | <en/> Current-mode DOM adapter — forwarded to useHoverLayer for row reverse lookup */
  dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
}

export interface RendererCommonHoverLayer {
  /** <zh/> 当前悬停行 key（null 表示无） | <en/> Key of the currently hovered row (null when none) */
  hoverRowKey: Ref<string | null>
  /** <zh/> 悬停行数据（不透明行对象，实现侧恒为 shallowRef，禁止深代理） | <en/> Hovered row data (opaque row object, always a shallowRef impl-side, never deeply proxied) */
  hoverRowData: Ref<any>
  /** <zh/> 当前悬停行索引 | <en/> Index of the currently hovered row */
  hoverRowIndex: Ref<number>
  /** <zh/> 悬停层可见状态 | <en/> Hover layer visibility state */
  hoverLayerVisible: Ref<boolean>
  /** <zh/> 悬停层是否处于收起态 | <en/> Whether the hover layer is collapsed */
  hoverLayerCollapsed: Ref<boolean>
  /** <zh/> 切换悬停层收起/展开 | <en/> Toggle hover layer collapse/expand */
  toggleHoverLayerCollapse: (event: Event) => void
  /** <zh/> 鼠标进入悬停层回调 | <en/> Callback when the mouse enters the hover layer */
  handleHoverLayerEnter: () => void
  /** <zh/> 鼠标离开悬停层回调 | <en/> Callback when the mouse leaves the hover layer */
  handleHoverLayerLeave: () => void
  /** <zh/> 滚动停止后重新发现鼠标下方的行 | <en/> Re-discover the row under the cursor after scrolling stops */
  rediscoverHoverAfterScroll: () => void
}

export interface HeaderEventEmits {
  /** <zh/> 表头列宽拖拽结束事件回调（由 ElTable header-dragend 解析后转发） | <en/> Header column-resize end callback (forwarded from ElTable header-dragend) */
  onHeaderDragend?: (params: { column?: unknown, columnKey: string, newWidth: number, oldWidth: number, event: MouseEvent | KeyboardEvent }) => void
}

export interface RendererCommonHoverEvents {
  /** <zh/> 生成 ElTable hover 事件处理器 | <en/> Generate ElTable hover event handlers */
  createElTableHoverEvents: () => ComputedRef<Record<string, ((...args: any[]) => void) | undefined>>
  /**
   * <zh/> 生成 ElTableV2 行事件处理器（hover + 点击/右键/双击）
   * <en/> Generate ElTableV2 row event handlers (hover + click/contextmenu/dblclick)
   */
  createElTableV2RowEventHandlers: <T>(emit?: RowEventEmits<T>, displayColumns?: MaybeRefOrGetter<any[]>) => ComputedRef<{
    /** <zh/> 行 mouseenter：更新悬停层并派发 onCellMouseEnter | <en/> Row mouseenter: updates the hover layer and forwards onCellMouseEnter */
    onMouseenter: (params: { rowData: T, rowIndex: number, event?: Event }) => void
    /** <zh/> 行 mouseleave：隐藏悬停层并派发 onCellMouseLeave | <en/> Row mouseleave: hides the hover layer and forwards onCellMouseLeave */
    onMouseleave: () => void
    /** <zh/> 行点击：转发 onRowClick，可解析列时发射 onCellClick | <en/> Row click: forwards onRowClick and emits onCellClick when the column resolves */
    onClick?: (params: { rowData: T, rowIndex: number, event: Event, rowKey: any }) => void
    /** <zh/> 行右键：转发 onRowContextmenu，可解析列时发射 onCellContextmenu | <en/> Row contextmenu: forwards onRowContextmenu and emits onCellContextmenu when the column resolves */
    onContextmenu?: (params: { rowData: T, rowIndex: number, event: Event, rowKey: any }) => void
    /** <zh/> 行双击：转发 onRowDblclick，可解析列时发射 onCellDblclick | <en/> Row dblclick: forwards onRowDblclick and emits onCellDblclick when the column resolves */
    onDblclick?: (params: { rowData: T, rowIndex: number, event: Event, rowKey: any }) => void
  }>
}

export interface UseRendererCommonReturn {
  /** <zh/> 当前悬停行 key（null 表示无） | <en/> Key of the currently hovered row (null when none) */
  hoverRowKey: Ref<string | null>
  /** <zh/> 悬停行数据（不透明行对象，实现侧恒为 shallowRef，禁止深代理） | <en/> Hovered row data (opaque row object, always a shallowRef impl-side, never deeply proxied) */
  hoverRowData: Ref<any>
  /** <zh/> 当前悬停行索引 | <en/> Index of the currently hovered row */
  hoverRowIndex: Ref<number>
  /** <zh/> 悬停层可见状态 | <en/> Hover layer visibility state */
  hoverLayerVisible: Ref<boolean>
  /** <zh/> 悬停层是否处于收起态 | <en/> Whether the hover layer is collapsed */
  hoverLayerCollapsed: Ref<boolean>
  /** <zh/> 切换悬停层收起/展开 | <en/> Toggle hover layer collapse/expand */
  toggleHoverLayerCollapse: (event: Event) => void
  /** <zh/> 鼠标进入悬停层回调 | <en/> Callback when the mouse enters the hover layer */
  handleHoverLayerEnter: () => void
  /** <zh/> 鼠标离开悬停层回调 | <en/> Callback when the mouse leaves the hover layer */
  handleHoverLayerLeave: () => void
  /** <zh/> 滚动停止后重新发现鼠标下方的行 | <en/> Re-discover the row under the cursor after scrolling stops */
  rediscoverHoverAfterScroll: () => void
  /** <zh/> 悬停事件生成器 | <en/> Hover event generators */
  hoverEvents: RendererCommonHoverEvents
}

/**
 * 渲染器共享逻辑 composable — 提取 default 和 virtual 两种渲染器的公共 hover 层与事件逻辑。
 *
 * @param options - 渲染器共享配置
 * @returns hover 层状态与事件处理器
 */
export function useRendererCommon(options: UseRendererCommonOptions): UseRendererCommonReturn {
  const {
    hoverOptionColumns,
    hasHoverOptionColumns,
    hoverOptionTeleport,
    displayNormalColumns,
    selectionColumnSyncKey,
    keepAlive,
    rowKeyMeta: providedRowKeyMeta,
    data: providedData,
    rowKey: providedRowKey,
    extraSyncWatchSources = [],
    containerRef,
    handleScroll,
    isScrolling,
    lowPerformance,
    dom,
  } = options

  const {
    rowKeyToIndex,
    hoverRowKey,
    hoverRowData,
    hoverRowIndex,
    hoverLayerVisible,
    hoverLayerCollapsed,
    hideHoverLayerImmediately,
    toggleHoverLayerCollapse,
    syncHoverLayerState,
    handleHoverRowEnter,
    handleHoverRowLeave,
    handleHoverLayerEnter,
    handleHoverLayerLeave,
    rediscoverHoverAfterScroll,
  } = useHoverLayer({
    hasHoverOptionColumns,
    rowKeyMeta: providedRowKeyMeta,
    data: providedData,
    rowKey: providedRowKey,
    keepAlive,
    isTeleport: hoverOptionTeleport,
    containerRef,
    handleScroll,
    isScrolling,
    lowPerformance,
    dom,
  })

  const hoverEvents: RendererCommonHoverEvents = {
    createElTableHoverEvents: () => useElTableHoverEvents({
      hasHoverOptionColumns,
      hoverOptionColumns,
      handleHoverRowEnter,
      handleHoverRowLeave,
    }),
    createElTableV2RowEventHandlers: <T>(emit?: RowEventEmits<T>, displayColumns?: MaybeRefOrGetter<any[]>) => useElTableV2RowEventHandlers<T>({
      hasHoverOptionColumns,
      hoverOptionColumns,
      handleHoverRowEnter,
      handleHoverRowLeave,
      displayColumns,
      emit,
    }),
  }

  watch(
    [rowKeyToIndex, hoverOptionColumns, displayNormalColumns, selectionColumnSyncKey, ...extraSyncWatchSources],
    () => {
      syncHoverLayerState()
    },
    { flush: 'post' },
  )

  watch(() => toValue(hasHoverOptionColumns), (enabled) => {
    if (!enabled) {
      hideHoverLayerImmediately()
    }
  })

  return {
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
  }
}

/**
 * <zh/> 合并 selection + normal 列为叶子列视图，供单元格事件定位使用
 *
 * <zh/> 列顺序使用 buildColumnIndexOrder：[...selection, ...normal(非 fixed), ...normal(fixed)]，
 * <zh/> 与虚拟渲染器的 allVirtualLeafColumns 和 data-adv-cell-col 索引域一致。
 *
 * <zh/> 使用 prev 引用短路：当两侧数组元素引用未变时复用上一次结果，
 * <zh/> 避免每次 computed 求值生成新数组引用导致下游依赖误判变更
 *
 * <en/> Merge selection + normal columns into leaf column view, for cell event locator to resolve coordinates.
 *
 * <en/> Column order uses buildColumnIndexOrder: [...selection, ...normal(non-fixed), ...normal(fixed)],
 * <en/> consistent with the virtual renderer's allVirtualLeafColumns and data-adv-cell-col index domain.
 *
 * <en/> Uses prev reference short-circuit: when both array element references are unchanged, reuses last result,
 * <en/> avoiding downstream dependencies misjudging changes from new array references on each computed evaluation
 *
 * @param selectionColumns - <zh/> selection 列数组（MaybeRefOrGetter） | <en/> selection column array (MaybeRefOrGetter)
 * @param normalColumns - <zh/> normal 列数组（MaybeRefOrGetter） | <en/> normal column array (MaybeRefOrGetter)
 * @returns <zh/> 合并后的叶子列 ComputedRef | <en/> merged leaf columns ComputedRef
 */
export function useMergedLeafColumns(
  selectionColumns: MaybeRefOrGetter<ProcessedColumn[]>,
  normalColumns: MaybeRefOrGetter<ProcessedColumn[]>,
): ComputedRef<ProcessedColumn[]> {
  return computed<ProcessedColumn[]>((prev) => {
    const next = buildColumnIndexOrder(toValue(selectionColumns), toValue(normalColumns))
    if (prev && prev.length === next.length && prev.every((c, i) => c === next[i]))
      return prev
    return next
  })
}

export { useTeleportRowRect }
export type { RowRect } from '../../types/row-rect'
export type { RowEventEmits } from '../rendering/use-row-events'
