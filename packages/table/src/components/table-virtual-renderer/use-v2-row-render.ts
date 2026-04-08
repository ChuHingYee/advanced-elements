/**
 * <zh/> virtual 渲染器的行外观域
 * <en/> Virtual-renderer row-appearance domain
 *
 * @remarks
 * <zh/> 职责单一：决定「一行长什么样、点在哪一格」——span 合成行（展开详情/分组头）类名、
 * <zh/> 行类名合成（合计行 > 合成行 > 斑马纹/当前行 > 自定义）、以及基于 DOM 的单元格事件转发。
 * <zh/> 单元格定位器由 DOM 适配器创建，本渲染器不持有 EP 的类名/结构知识。
 * <en/> Single responsibility: decide "what a row looks like and which cell was hit" — span synthetic-row
 * <en/> (expand detail / group header) classes, row-class composition (totals > synthetic > stripe/current
 * <en/> > custom), and DOM-based cell-event forwarding. The cell locator comes from the DOM adapter; this
 * <en/> renderer holds no EP class-name/structure knowledge.
 */
import type { ComputedRef, ShallowRef } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { V2RendererProps } from './v2-renderer-props'
import { computed } from 'vue'
import { useRendererCellEvents } from '../../composables/rendering/use-renderer-event-adapter'
import { useSpanStrategy } from '../../composables/rendering/use-span-strategy'
import { useV2RowClass } from './use-v2-row-class'

/** <zh/> 行外观域依赖 | <en/> Row-appearance domain deps */
export interface UseV2RowRenderDeps<T = any> {
  /** <zh/> 渲染器 props | <en/> renderer props */
  props: V2RendererProps<T>
  /** <zh/> ElTableV2 实例（单元格事件挂载点） | <en/> ElTableV2 instance (cell-event mount point) */
  tableV2Ref: ShallowRef<any>
  /** <zh/> 行展开 API（合成行类型判定） | <en/> row-expand API (synthetic row type detection) */
  rowExpandApi?: any
  /** <zh/> 行分组 API（合成行类型判定） | <en/> row-group API (synthetic row type detection) */
  rowGroupApi?: any
  /** <zh/> 当前行键 | <en/> current row key */
  currentRowKey: ComputedRef<string | number | null>
  /** <zh/> 行键函数 | <en/> row key function */
  rowKeyFn: ComputedRef<(row: T) => string>
  /** <zh/> 统一索引域的叶子列 | <en/> Leaf columns of the unified index domain */
  allVirtualLeafColumns: () => LocalColumn[]
  /** <zh/> 渲染数据 | <en/> render data */
  data: ComputedRef<any[]>
  /** <zh/> 渲染数据域 key → rowIndex | <en/> render-data-domain key → rowIndex */
  virtualKeyToIndex: ComputedRef<Map<string, number>>
  /** <zh/> 组件 emit | <en/> component emit */
  emit: (event: any, ...args: any[]) => void
  /**
   * <zh/> 业务行索引解析（晚绑定透传）——条纹按业务奇偶
   * <en/> Business-row index resolver (late-bound) — stripe by business parity
   */
  resolveBusinessIndex?: (rowData: unknown, epRowIndex: number) => number | undefined
}

/** <zh/> 行外观域返回 | <en/> Row-appearance domain return */
export interface UseV2RowRenderReturn {
  /** <zh/> ElTableV2 的 row-class 回调 | <en/> ElTableV2 row-class callback */
  currentRowClass: ComputedRef<(params: { columns: any, rowData: any, rowIndex: number }) => string>
  /** <zh/> 固定行的 row-key 值（条带行挂属性与事件转发用） | <en/> Pinned-row key value (for strip row attributes and event forwarding) */
  getRowKeyForAttr: (row: any) => string
}

/**
 * <zh/> 创建行外观域
 * <en/> Create the row-appearance domain
 */
export function useV2RowRender<T = any>(deps: UseV2RowRenderDeps<T>): UseV2RowRenderReturn {
  const {
    props,
    tableV2Ref,
    rowExpandApi,
    rowGroupApi,
    currentRowKey,
    rowKeyFn,
    allVirtualLeafColumns,
    data,
    virtualKeyToIndex,
    emit,
    resolveBusinessIndex,
  } = deps

  /**
   * <zh/> 合并单元格策略 — 展开行/分组头行的类型检测和类名统一由 useSpanStrategy 管理
   * <en/> Span strategy — detail/group-header row type detection and class names unified via useSpanStrategy
   */
  const {
    getSyntheticRowClass,
  } = useSpanStrategy({
    rowExpandApi,
    rowGroupApi,
    selectionColumnCount: () => props.selectionColumns.length,
    normalColumnCount: () => props.normalColumns.length,
  })

  const { currentRowClass } = useV2RowClass<T>({
    props,
    currentRowKey,
    rowKeyFn,
    getSyntheticRowClass,
    resolveBusinessIndex,
  })

  useRendererCellEvents<T>({
    containerRef: computed(() => (tableV2Ref.value?.$el as HTMLElement) ?? null),
    columns: computed(() => allVirtualLeafColumns()),
    data,
    // <zh/> 单元格定位器由 DOM 适配器创建——本渲染器不持有 EP 类名/结构知识
    // <en/> The cell locator comes from the DOM adapter — this renderer holds no EP class-name/structure knowledge
    locator: props.dom.createCellLocator(virtualKeyToIndex),
    emit,
    // <zh/> virtual 模式下 cellClick/cellDblclick/cellContextmenu 由 useElTableV2RowEventHandlers
    // <zh/> 的 onClick/onDblclick/onContextmenu 中 resolveClickedColumn 补齐列信息后统一 emit
    // <en/> In virtual mode, cellClick/cellDblclick/cellContextmenu are emitted by
    // <en/> useElTableV2RowEventHandlers via resolveClickedColumn in onClick/onDblclick/onContextmenu
    enableMouseEvents: false,
  })

  /**
   * <zh/> 固定行的 row-key 值——供条带行挂 ADV_TABLE_ROW_KEY_ATTR 与事件转发使用
   * <en/> Pinned-row key value — used for the strip rows' ADV_TABLE_ROW_KEY_ATTR and event forwarding
   */
  function getRowKeyForAttr(row: any): string {
    try {
      return String(rowKeyFn.value(row))
    }
    catch {
      return ''
    }
  }

  return { currentRowClass, getRowKeyForAttr }
}
