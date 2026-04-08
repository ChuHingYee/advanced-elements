/**
 * <zh/> virtual 渲染器的网格内核
 * <en/> Virtual-renderer grid core
 *
 * @remarks
 * <zh/> 职责单一：装配「ElTableV2 本体」所需的五组内聚能力，并向外暴露统一的门面。
 * <zh/> 1. **渲染器会话**（`useVirtualRenderer`）——行键、列宽、列宽拖拽、悬停行状态、列调整代理；
 * <zh/> 2. **行索引**（`useV2RowIndex`）——渲染数据域 key→rowIndex 及超阈值降级；
 * <zh/> 3. **网格实例**（`useV2GridInstance`）——固定/动态行高模式、重挂载键、高度与滚动条预留；
 * <zh/> 4. **行高重测**（`useV2RowHeightReset`）——异步撑高后主动清 EP 行高缓存；
 * <zh/> 5. **行外观**（`useV2RowRender`）——span 合成行类名、行类名合成、单元格事件转发。
 *
 * <zh/> 为什么合在一处：其中「渲染器会话 × 事件适配器」存在**构造期循环**——事件适配器需要 `isScrolling`，而
 * <zh/> `isScrolling` 由 `useVirtualRenderer` 产出，`useVirtualRenderer` 又必须消费适配器产出的
 * <zh/> `rowEmit/headerEmit`。容器（`isScrollingHolder`）与装配次序都只能由本模块保证，
 * <zh/> 拆回 SFC 会让隐式时序约束再次分散。
 *
 * <en/> Single responsibility: assemble the five cohesive capability groups ElTableV2 itself needs and
 * <en/> expose one unified facade.
 * <en/> 1. **renderer session** (`useVirtualRenderer`) — row keys, column widths, resize proxy, hovered-row state;
 * <en/> 2. **row index** (`useV2RowIndex`) — render-data-domain key→rowIndex and its over-threshold degradation;
 * <en/> 3. **grid instance** (`useV2GridInstance`) — fixed/dynamic row-height mode, remount key, height, scrollbar gutter;
 * <en/> 4. **row-height reset** (`useV2RowHeightReset`) — proactively drop EP's cached heights after async growth;
 * <en/> 5. **row appearance** (`useV2RowRender`) — span synthetic-row classes, row-class composition, cell-event forwarding.
 *
 * <en/> Why together: the "renderer session × emit adapter" pair carries a **construction-time cycle** — the emit adapter needs
 * <en/> `isScrolling`, which `useVirtualRenderer` produces, while `useVirtualRenderer` must consume the
 * <en/> adapter's `rowEmit/headerEmit`. Only this module can guarantee both the holder
 * <en/> (`isScrollingHolder`) and the assembly order; pushing it back into the SFC would scatter the
 * <en/> implicit timing constraints again.
 */
import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { UseV2ScrollApiReturn } from './use-v2-scroll-api'
import type { V2RendererProps } from './v2-renderer-props'
import { computed, shallowRef, watch } from 'vue'
import { useV2GridInstance } from './use-v2-grid-instance'
import { useV2RowHeightReset } from './use-v2-row-height-reset'
import { useV2RowIndex } from './use-v2-row-index'
import { useV2RowRender } from './use-v2-row-render'
import { useVirtualRenderer } from './use-virtual-renderer'
import { createV2EmitAdapter } from './v2-emit-adapter'

/** <zh/> 网格内核依赖 | <en/> Grid-core deps */
export interface UseV2GridCoreDeps<T = any> {
  /** <zh/> 渲染器 props | <en/> renderer props */
  props: V2RendererProps<T>
  /** <zh/> 组件 emit | <en/> component emit */
  emit: (event: any, ...args: any[]) => void
  /** <zh/> 是否处于低性能档 | <en/> whether the low-performance tier is active */
  lowPerformance: ComputedRef<boolean>
  /** <zh/> ElTableV2 实例 | <en/> ElTableV2 instance */
  tableV2Ref: ShallowRef<any>
  /** <zh/> 外层容器元素 | <en/> outer container element */
  containerRef: ShallowRef<HTMLElement | null>
  /** <zh/> 列宽拖拽代理元素 | <en/> column-resize proxy element */
  resizeProxyRef: ShallowRef<HTMLElement | undefined | null>
  /** <zh/> 行键元信息 | <en/> row key metadata */
  rowKeyMeta?: any
  /** <zh/> 行展开 API | <en/> row expand API */
  rowExpandApi?: any
  /** <zh/> 行分组 API | <en/> row group API */
  rowGroupApi?: any
  /** <zh/> 是否存在 append 插槽 | <en/> whether the append slot exists */
  hasAppendSlot: ComputedRef<boolean>
  /** <zh/> 当前纵向滚动位置 | <en/> current vertical scroll position */
  currentScrollTop: { value: number }
  /** <zh/> 当前横向滚动位置 | <en/> current horizontal scroll position */
  currentScrollLeft: { value: number }
  /** <zh/> V2 程序化滚动探针 | <en/> V2 programmatic-scroll probe */
  v2ScrollApi: UseV2ScrollApiReturn
  /** <zh/> 统一索引域的叶子列（事件转发与 headerDragend 列索引解析） | <en/> Leaf columns of the unified index domain (event forwarding and headerDragend index resolution) */
  allVirtualLeafColumns: () => LocalColumn[]
  /** <zh/> teleport 是否生效（透传至 useVirtualRenderer 事件列域） | <en/> Whether teleport hover is active (forwarded to useVirtualRenderer event column domain) */
  isTeleportActive?: MaybeRefOrGetter<boolean | undefined>
  /**
   * <zh/> 业务行索引域映射（透传至事件适配器）——EP 索引 → `props.data` 域索引；
   * <zh/> undefined 表示合成行。装配晚于 grid core，故以 late-binding getter 注入。
   * <en/> Business-row index mapping (forwarded to the emit adapter) — EP index →
   * <en/> `props.data` index; undefined means a synthetic row. Wired via a late-binding getter
   * <en/> because the grand-total domain is assembled after the grid core.
   */
  resolveBusinessRowIndex?: () => (rowData: unknown, epRowIndex: number) => number | undefined
}

/**
 * <zh/> 创建网格内核
 * <en/> Create the grid core
 */
export function useV2GridCore<T = any>(deps: UseV2GridCoreDeps<T>) {
  const {
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
    allVirtualLeafColumns,
    isTeleportActive,
    resolveBusinessRowIndex,
  } = deps
  /**
   * <zh/> 滚动中标志的转发槽——事件适配器必须先于 useVirtualRenderer 构建（后者消费 rowEmit/headerEmit），
   * <zh/> 而 isScrolling 又是后者的产物；以浅引用容器打破这一构造期循环依赖。
   * <en/> Forwarding slot for the scrolling flag — the emit adapter must be built before
   * <en/> useVirtualRenderer (which consumes rowEmit/headerEmit), yet isScrolling is produced by it;
   * <en/> a shallow holder breaks this construction-time cycle.
   */
  const isScrollingHolder = shallowRef(false)

  const renderer = useVirtualRenderer<T>({
    props,
    isTeleportActive,
    lowPerformance,
    tableV2Ref,
    containerRef,
    rowKeyMeta,
    resizeProxyRef,
    ...createV2EmitAdapter({
      emit,
      isScrolling: () => isScrollingHolder.value,
      allVirtualLeafColumns,
      // 晚绑定——不能在 setup 期就解引用 getter 并固化返回值。
      // 消费方（SFC）会在拿到 dataWithAppend 后重新赋值 resolveBusinessRowIndex，
      // 此处若提前求值，adapter 永远持有初始 identity 桩 → 合计行偏移永不修正。
      // Late-bound: the consumer reassigns the resolver once its data domain exists, so
      // the adapter must invoke the getter per event instead of capturing a snapshot.
      resolveBusinessRowIndex: (rowData, epRowIndex) => resolveBusinessRowIndex?.()(rowData, epRowIndex),
    }),
  })

  watch(renderer.isScrolling, (value) => {
    isScrollingHolder.value = value
  }, { immediate: true })

  const virtualData = computed(() => props.data)

  const { virtualKeyToIndex, buildWindowIndex } = useV2RowIndex<T>({
    data: () => props.data ?? [],
    rowKeyFn: () => renderer.rowKeyFn.value,
  })

  const gridInstance = useV2GridInstance({
    props,
    rowExpandApi,
    hasAppendSlot,
    currentScrollTop,
    currentScrollLeft,
    v2ScrollApi,
  })

  /**
   * <zh/> 行高重测——内容异步撑高后主动清 EP 行高缓存；仅 dynamic 网格有效，
   * <zh/> fixed 网格与 default 渲染器下调用返回 false（dev 可观测告警）。
   * <en/> Row-height reset — proactively drops EP's cached row heights after async content
   * <en/> growth; dynamic grids only, false (with a dev-observable warning) on fixed grids and
   * <en/> the default renderer.
   */
  const rowHeightReset = useV2RowHeightReset({
    getInstance: () => tableV2Ref.value,
    isDynamic: () => gridInstance.gridInstanceKey.value.startsWith('dynamic'),
    // 使已挂载行重新挂载实测（EP 2.14 仅在 onMounted 测量）
    remeasure: gridInstance.requestRowRemeasure,
    /**
     * <zh/> 不可用原因上报（EP 漂移的生产可观测通道）——此前 `onUnavailable` 声明并调用却
     * <zh/> **没有任何调用方装配**，探测失败仅剩 dev 期 `console.warn`，生产完全静默。
     * <zh/> 现经 `rendererError` 汇入表格 `error` 通道，使 EP 内部结构漂移可被消费方编程感知。
     * <en/> Unavailability reporting (the production-observable channel for EP drift) — previously
     * <en/> `onUnavailable` was declared and invoked but wired by **no caller**, so a failed probe
     * <en/> left only a dev-mode `console.warn` and production was completely silent. It now flows
     * <en/> through `rendererError` into the table's `error` channel, making EP internal-structure
     * <en/> drift programmatically perceivable.
     */
    onUnavailable: (reason) => {
      emit('rendererError', 'TABLE_ROW_HEIGHT_RESET_UNAVAILABLE', { reason })
    },
  })

  const rowRender = useV2RowRender<T>({
    props,
    tableV2Ref,
    rowExpandApi,
    rowGroupApi,
    currentRowKey: renderer.currentRowKey,
    rowKeyFn: renderer.rowKeyFn,
    allVirtualLeafColumns,
    data: virtualData,
    virtualKeyToIndex,
    emit,
    // <zh/> 晚绑定：与事件适配器同源，SFC 装配 dataWithAppend 后才就绪，按次调用不固化
    // <en/> Late-bound like the emit adapter: ready only after SFC assembles dataWithAppend
    resolveBusinessIndex: (rowData, epRowIndex) => resolveBusinessRowIndex?.()(rowData, epRowIndex),
  })

  return {
    ...renderer,
    ...gridInstance,
    ...rowHeightReset,
    ...rowRender,
    virtualData,
    virtualKeyToIndex,
    buildWindowIndex,
  }
}
