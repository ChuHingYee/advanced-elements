import type { VNode } from 'vue'
import type { AdvColumn } from '../../types'
import type { CellContext, CellRendererParams } from '../../types/column'
import type { TableContext } from '../../types/config'
import type { Translator } from '../../types/translator'
import { h } from 'vue'
import { resolveEmptyText } from '../../utils/resolve-cell-text'
import { resolveCellValue } from '../../utils/value-pipeline'
import { renderErrorFallback } from '../renderer-core/render-error-fallback'
import { CopyableCell } from './copyable-cell'
import { renderValueCell } from './value-renderer'

/**
 * <zh/> 单元格渲染配置选项
 * <en/> Cell rendering configuration options
 * @remarks
 * <zh/> - 继承自 CellRendererParams，剔除 column / columns / cellData 后自行提供
 * <zh/> - 支持通过 cellRenderer 函数、cellComponent 组件、具名插槽、format 回调等方式渲染
 * <zh/> - 兜底逻辑：根据 valueType / valueEnum → 空文本 → 字符串化
 * <zh/> - copyable 开启时自动包裹 CopyableCell
 * <en/> - Inherits from CellRendererParams, provides its own after removing column / columns / cellData
 * <en/> - Supports rendering via cellRenderer function, cellComponent component, named slots, format callback, etc.
 * <en/> - Fallback logic: valueType / valueEnum → empty text → stringify
 * <en/> - Automatically wraps with CopyableCell when copyable is enabled
 */
interface RenderCellOptions
  extends Omit<CellRendererParams, 'column' | 'columns' | 'cellData'> {
  /** <zh/> 单元格原始数据，优先于 `rowData[dataKey]`。 | <en/> Raw cell data, takes precedence over `rowData[dataKey]`. */
  cellData?: unknown
  /** <zh/> 当前列配置。 | <en/> Current column config. */
  column: AdvColumn
  /** <zh/> 所有列配置，用于部分渲染回调。 | <en/> All column configs, used by some render callbacks. */
  columns?: AdvColumn[]
  /** <zh/> 父组件插槽集合。 | <en/> Parent component slots collection. */
  slots: Record<string | symbol, (...args: unknown[]) => VNode[]>
  /** <zh/> 优先尝试的插槽名称。 | <en/> Slot name to try first. */
  slotKey: string
  /** <zh/> 国际化翻译函数（可选）。 | <en/> I18n translation function (optional). */
  t?: Translator
  /** <zh/> 表格上下文（可选）。 | <en/> Table context (optional). */
  ctx?: TableContext | null
  /** <zh/> hover 操作列列表，用于 OptionCell 行内渲染模式 | <en/> Hover option column list, used by OptionCell inline render mode */
  hoverOptionColumns?: AdvColumn[]
}

/**
 * <zh/> 渲染单元格内容
 * <en/> Render cell content
 *
 * @remarks
 * <zh/> 渲染优先级（按序）：cellRenderer → cellComponent → slots[slotKey] → column.format →
 * <zh/> valueType/valueEnum → 空数据显示 column.emptyText 或 ctx.columnEmptyText → 兜底转字符串。
 * <zh/> 渲染完成后，column.copyable 为真时自动包裹 CopyableCell 组件。
 * <en/> Render priority (in order): cellRenderer → cellComponent → slots[slotKey] → column.format →
 * <en/> valueType/valueEnum → empty shows column.emptyText or ctx.columnEmptyText → fallback to string.
 * <en/> After rendering, wraps with CopyableCell when column.copyable is true.
 *
 * @param opts - <zh/> 渲染配置选项 | <en/> render options
 * @returns <zh/> 渲染结果（VNode 或纯文本字符串） | <en/> render result (VNode or plain text string)
 */
export function renderCell(opts: RenderCellOptions): VNode | string {
  const { column, rowData, rowIndex, columns, columnIndex, slots, slotKey, t, ctx } = opts
  const dataKey = column.dataKey ?? column.prop ?? ''
  // <zh/> 取值统一咽喉：定义了 valueGetter 时所有渲染分支（cellRenderer/cellComponent/插槽/
  // <zh/> format/valueType/纯文本）与排序、筛选、导出共用同一解析链，消除"显示值≠导出值"口径分裂。
  // <zh/> 调用方（buildCellContent）已每格单次预解析时直接复用（`in` 判定，
  // <zh/> 解析结果为 undefined 同样复用，避免重复取值）；未提供时走本地解析。
  // <en/> Single resolution choke point: when valueGetter is defined, ALL render branches
  // <en/> (cellRenderer/cellComponent/slot/format/valueType/plain text) share the same resolution chain
  // <en/> as sorting/filtering/export, eliminating the "display ≠ export" divergence.
  // <en/> reuses the caller-pre-resolved value when provided (checked via `in`;
  // <en/> an undefined result is still reused to avoid duplicate resolution).
  const resolvedCellData = ('cellData' in opts)
    ? opts.cellData
    : (column.valueGetter
        ? resolveCellValue(rowData, column, rowIndex)
        : rowData[String(dataKey)])

  if (column.cellRenderer) {
    const cellCtx: CellContext = {
      cellData: resolvedCellData,
      rowData,
      rowIndex,
      columns: columns ?? [column],
      column,
      columnIndex: columnIndex ?? 0,
    }
    try {
      return column.cellRenderer(cellCtx)
    }
    catch (e) {
      return renderErrorFallback(e, 'cell')
    }
  }

  if (column.cellComponent) {
    try {
      return h(column.cellComponent, {
        row: rowData,
        cellData: resolvedCellData,
        column,
        columns: columns ?? [column],
        index: rowIndex,
        columnIndex: columnIndex ?? 0,
      })
    }
    catch (e) {
      return renderErrorFallback(e, 'cell')
    }
  }

  if (slots[slotKey]) {
    try {
      return slots[slotKey]({ row: rowData, cellData: resolvedCellData, column, index: rowIndex })[0] ?? null
    }
    catch (e) {
      return renderErrorFallback(e, 'cell')
    }
  }

  if (column.format) {
    try {
      return column.format({
        row: rowData,
        cellData: resolvedCellData,
        column,
        columns: columns ?? [column],
        index: rowIndex,
        columnIndex: columnIndex ?? 0,
      })
    }
    catch (e) {
      return renderErrorFallback(e, 'cell')
    }
  }

  let content: VNode | string

  if (column.valueType || column.valueEnum) {
    try {
      content = renderValueCell({ cellData: resolvedCellData, rowData, column, index: rowIndex, ctx, hoverOptionColumns: opts.hoverOptionColumns })
    }
    catch (e) {
      return renderErrorFallback(e, 'cell')
    }
  }
  else if (resolvedCellData == null || resolvedCellData === '') {
    content = resolveEmptyText(column, ctx)
  }
  else {
    content = String(resolvedCellData)
  }

  if (column.copyable) {
    const copyHeaders = typeof column.copyable === 'object' ? column.copyable.copyHeaders : false
    return h(CopyableCell, {
      cellData: resolvedCellData,
      columnLabel: column.label ?? '',
      copyHeaders,
      t,
    }, () => content)
  }

  return content
}
