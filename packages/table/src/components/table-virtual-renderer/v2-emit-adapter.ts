/**
 * <zh/> virtual 渲染器的事件适配器工厂
 * <en/> Virtual-renderer emit adapter factory
 *
 * @remarks
 * <zh/> 职责单一：把渲染器内部的行/表头事件参数转换为对外的 emits 载荷。
 * <zh/> 两处收敛点：
 * <zh/> 1. **append 合成行屏蔽**——所有行事件统一跳过 append 合成行（宿主不应感知内部合成数据）；
 * <zh/> 2. **滚动期鼠标事件抑制**——cellMouseEnter/cellMouseLeave 在滚动期间不转发（与 default 模式一致）。
 * <zh/> 另有列索引域统一：headerDragend 的 columnIndex 必须在统一索引域
 * <zh/> （selection + normal 非 fixed + normal fixed）内解析，与 `data-adv-cell-col` 语义一致。
 * <en/> Single responsibility: translate renderer-internal row/header event params into the public
 * <en/> emit payloads. Two convergence points:
 * <en/> 1. **append synthetic-row suppression** — every row event skips append synthetic rows (the host
 * <en/>    must never observe internal synthetic data);
 * <en/> 2. **scroll-time mouse-event suppression** — cellMouseEnter/cellMouseLeave are not forwarded
 * <en/>    while scrolling (consistent with default mode).
 * <en/> Plus one index-domain unification: headerDragend's columnIndex must resolve within the unified
 * <en/> domain (selection + normal non-fixed + normal fixed), matching `data-adv-cell-col` semantics.
 */
import type { MaybeRefOrGetter } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import { toValue } from 'vue'
import { getColumnKey } from '../../utils/shared'
import { isAppendRowData } from './append-row-helpers'

/**
 * <zh/> 渲染器 emit 函数的最小契约——EP 上游无类型，属第三方边界豁免，保留 any
 * <en/> Minimal contract of the renderer emit function — untyped upstream (EP boundary exemption, keeps any)
 */
export type V2EmitFn = (event: any, ...args: any[]) => void

/** <zh/> 事件适配器依赖 | <en/> Emit-adapter deps */
export interface V2EmitAdapterDeps {
  /** <zh/> 组件 emit | <en/> component emit */
  emit: V2EmitFn
  /** <zh/> 是否处于滚动中（滚动期抑制鼠标事件转发） | <en/> whether scrolling (mouse events are suppressed while scrolling) */
  isScrolling: MaybeRefOrGetter<boolean>
  /** <zh/> 统一索引域的叶子列（用于 headerDragend 的列索引解析） | <en/> Leaf columns of the unified index domain (for headerDragend columnIndex resolution) */
  allVirtualLeafColumns: () => readonly LocalColumn[]
  /**
   * <zh/> 业务行索引域映射——把 EP 数据域索引（非粘性 Grand 顶部合计行前插会造成
   * <zh/> 偏移）换算回 `props.data` 域；返回 undefined 表示该行是合成行（Grand 合计/append），
   * <zh/> 不应对外暴露业务索引。未提供时按 EP 索引原样透传。
   * <en/> Business-row index mapping — converts the EP data-domain index (offset when a
   * <en/> non-sticky grand total row is prepended) back to the `props.data` domain; undefined means
   * <en/> the row is synthetic (grand total / append) and must not expose a business index.
   */
  resolveBusinessRowIndex?: (rowData: unknown, epRowIndex: number) => number | undefined
}

/** <zh/> 事件适配器的两个出口 | <en/> The two exits of the emit adapter */
export interface V2EmitAdapterReturn {
  /** <zh/> 行事件（ElTableV2 row-event-handlers 消费，载荷行数据为 unknown，由 isAppendRowData 收窄） | <en/> row events (consumed by ElTableV2 row-event-handlers; payload row data is unknown, narrowed by isAppendRowData) */
  rowEmit: {
    onRowClick: (params: { rowData: unknown, rowIndex: number, event: Event }) => void
    onRowContextmenu: (params: { rowData: unknown, rowIndex: number, event: Event }) => void
    onRowDblclick: (params: { rowData: unknown, rowIndex: number, event: Event }) => void
    onCurrentChange: (params: { currentRow: unknown, oldRow: unknown }) => void
    onCellClick: (params: { rowData?: unknown, rowIndex: number }) => void
    onCellDblclick: (params: { rowData?: unknown, rowIndex: number }) => void
    onCellContextmenu: (params: { rowData?: unknown, rowIndex: number }) => void
    onCellMouseEnter: (params: { rowData: unknown, rowIndex: number, event?: Event }) => void
    onCellMouseLeave: () => void
  }
  /** <zh/> 表头事件 | <en/> header events */
  headerEmit: {
    onHeaderDragend: (params: {
      column?: unknown
      columnKey: string
      newWidth: number
      oldWidth: number
      event: MouseEvent | KeyboardEvent
    }) => void
  }
}

/**
 * <zh/> 创建 virtual 渲染器的事件适配器
 * <en/> Create the virtual renderer's emit adapter
 */
export function createV2EmitAdapter(deps: V2EmitAdapterDeps): V2EmitAdapterReturn {
  const { emit, allVirtualLeafColumns } = deps

  /**
   * <zh/> 业务行索引域归一——EP 索引减去头部合成行偏移；合成行返回 undefined（调用方丢弃）。
   * <en/> Business-row index domain normalization — EP index minus the head synthetic-row offset; synthetic rows yield undefined (discarded by callers).
   */
  function businessRowIndex(rowData: unknown, epRowIndex: number): number | undefined {
    const resolver = deps.resolveBusinessRowIndex
    if (!resolver)
      return epRowIndex
    return resolver(rowData, epRowIndex)
  }

  const rowEmit: V2EmitAdapterReturn['rowEmit'] = {
    onRowClick: (params) => {
      if (isAppendRowData(params.rowData))
        return
      const rowIndex = businessRowIndex(params.rowData, params.rowIndex)
      if (rowIndex === undefined)
        return
      emit('rowClick', { rowData: params.rowData, rowIndex, event: params.event })
    },
    onRowContextmenu: (params) => {
      if (isAppendRowData(params.rowData))
        return
      const rowIndex = businessRowIndex(params.rowData, params.rowIndex)
      if (rowIndex === undefined)
        return
      emit('rowContextmenu', { rowData: params.rowData, rowIndex, event: params.event })
    },
    onRowDblclick: (params) => {
      if (isAppendRowData(params.rowData))
        return
      const rowIndex = businessRowIndex(params.rowData, params.rowIndex)
      if (rowIndex === undefined)
        return
      emit('rowDblclick', { rowData: params.rowData, rowIndex, event: params.event })
    },
    onCurrentChange: (params) => {
      if (isAppendRowData(params.currentRow) || isAppendRowData(params.oldRow))
        return
      emit('currentChange', { currentRow: params.currentRow, oldRow: params.oldRow })
    },
    // cell 载荷的 rowIndex 源自行事件链（use-row-events），同样处于 EP 数据域，
    // 因此必须与行事件走同一个业务索引归一；合成行（Grand 合计/append）整条丢弃。
    // the cell payload's rowIndex is inherited from the row-event chain, so it is in the EP
    // data domain too and must go through the same normalisation; synthetic rows are dropped whole.
    onCellClick: (params) => {
      if (isAppendRowData(params.rowData))
        return
      const rowIndex = businessRowIndex(params.rowData, params.rowIndex)
      if (rowIndex === undefined)
        return
      emit('cellClick', { ...params, rowIndex })
    },
    onCellDblclick: (params) => {
      if (isAppendRowData(params.rowData))
        return
      const rowIndex = businessRowIndex(params.rowData, params.rowIndex)
      if (rowIndex === undefined)
        return
      emit('cellDblclick', { ...params, rowIndex })
    },
    onCellContextmenu: (params) => {
      if (isAppendRowData(params.rowData))
        return
      const rowIndex = businessRowIndex(params.rowData, params.rowIndex)
      if (rowIndex === undefined)
        return
      emit('cellContextmenu', { ...params, rowIndex })
    },
    onCellMouseEnter: (params) => {
      if (isAppendRowData(params.rowData))
        return
      // <zh/> 滚动期间抑制 cellMouseEnter 事件转发，与 default 模式一致
      // <en/> Suppress cellMouseEnter forwarding during scrolling, consistent with default mode
      if (toValue(deps.isScrolling))
        return
      const rowIndex = businessRowIndex(params.rowData, params.rowIndex)
      if (rowIndex === undefined)
        return
      emit('cellMouseEnter', { rowData: params.rowData, rowIndex, event: params.event })
    },
    onCellMouseLeave: () => {
      // <zh/> 滚动期间抑制 cellMouseLeave 事件转发，与 default 模式一致
      // <en/> Suppress cellMouseLeave forwarding during scrolling, consistent with default mode
      if (toValue(deps.isScrolling))
        return
      emit('cellMouseLeave')
    },
  }

  const headerEmit = {
    onHeaderDragend: (params: {
      column?: unknown
      columnKey: string
      newWidth: number
      oldWidth: number
      event: MouseEvent | KeyboardEvent
    }) => {
      const column = params.column as LocalColumn | undefined
      // <zh/> 列索引必须按统一索引域（selection + normal 非 fixed + normal fixed）解析，
      // <zh/> 与 default 模式 / data-adv-cell-col 索引语义一致。
      // <en/> Resolve columnIndex within the unified index domain (selection + normal non-fixed + normal fixed),
      // <en/> consistent with the default mode / data-adv-cell-col index semantics.
      const columnIndex = column
        ? allVirtualLeafColumns().findIndex(c => getColumnKey(c) === getColumnKey(column))
        : -1
      emit('headerDragend', { column, columnIndex, newWidth: params.newWidth, oldWidth: params.oldWidth, event: params.event })
    },
  }

  return { rowEmit, headerEmit }
}
