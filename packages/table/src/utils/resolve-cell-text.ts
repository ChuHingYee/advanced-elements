import type { AdvColumn, FormatContext, ValueEnum } from '../types/column'
import type { TableContext } from '../types/config'
import { normalizeEnumItem } from './enum'
import { VALUE_TYPE_TEXT_FORMATTERS } from './value-format'
import { resolveCellValue } from './value-pipeline'
import { getCustomValueType } from './value-type-registry'

/**
 * <zh/> 根据 valueEnum 字典将单元格原始值解析为枚举文本。
 * <en/> Resolve a cell's raw value into enum text via the valueEnum dictionary.
 *
 * @param value - <zh/> 单元格原始值（键值） | <en/> raw cell value (key)
 * @param valueEnum - <zh/> 枚举映射字典 { 'key': '文本' | { text, status, color } } | <en/> enum mapping dictionary { 'key': 'text' | { text, status, color } }
 * @returns <zh/> 匹配到的枚举文本，未匹配则返回原始值的字符串形式 | <en/> matched enum text, or the string form of the raw value when unmatched
 */
function resolveEnumText(value: unknown, valueEnum: ValueEnum): string {
  const key = String(value)
  const item = valueEnum[key]
  if (!item)
    return String(value ?? '')
  return normalizeEnumItem(item).text
}

/**
 * <zh/> 空值显示占位单源——列级 `emptyText` 优先于表级 `columnEmptyText`，均未配置时回退 `''`。
 * <zh/> 显示链（resolveCellText / renderValueCell / renderCell）统一经此函数；导出/筛选/剪贴板等
 * <zh/> 刻意绕过占位的 `String(x ?? '')` 不走此处（语义不同，见 B1b）。
 * <en/> Single source for the empty-value display placeholder — column-level `emptyText` wins over
 * <en/> table-level `columnEmptyText`, falling back to `''`. All display paths go through this;
 * <en/> export/filter/clipboard paths that deliberately bypass the placeholder keep their own `''`.
 */
export function resolveEmptyText(
  column: Pick<AdvColumn, 'emptyText'>,
  ctx?: Pick<TableContext, 'columnEmptyText'> | null,
): string {
  return column.emptyText ?? ctx?.columnEmptyText?.value ?? ''
}

/**
 * <zh/> resolveCellText 函数的选项参数。
 * <en/> Options parameter for the resolveCellText function.
 */
export interface ResolveCellTextOptions {
  /** <zh/> 单元格原始数据 | <en/> raw cell data */
  cellData: unknown
  /** <zh/> 当前行数据对象 | <en/> current row data object */
  row: Record<string, unknown>
  /** <zh/> 当前列配置 | <en/> current column config */
  column: AdvColumn
  /** <zh/> 所有列配置（可选，用于 format 回调） | <en/> all column configs (optional, for the format callback) */
  columns?: AdvColumn[]
  /** <zh/> 当前行索引 | <en/> current row index */
  index: number
  /** <zh/> 当前列索引（可选，用于 format 回调） | <en/> current column index (optional, for the format callback) */
  columnIndex?: number
  /** <zh/> 表格上下文，用于读取 columnEmptyText 等全局配置 | <en/> table context, used to read global configs like columnEmptyText */
  ctx?: TableContext | null
}

/**
 * <zh/> 内置特殊 valueType 文本解析表——与 value-renderer.ts 的 RENDERER_SPECIFIC_TEXT / COMPONENT_RENDERERS 同键，新增内置类型时两处须同步（由 value-type 穷举单测守护）。
 * <en/> Built-in special valueType text resolver table — same keys as RENDERER_SPECIFIC_TEXT / COMPONENT_RENDERERS in value-renderer.ts; new built-ins must update both (guarded by the value-type exhaustive test).
 */
function resolveSelectText(cellData: unknown, opts: ResolveCellTextOptions): string {
  if (opts.column.valueEnum)
    return resolveEnumText(cellData, opts.column.valueEnum)
  return String(cellData ?? '')
}

// <zh/> 优先使用 rowExpandApi.getLogicalIndex（基于 WeakMap），避免读取用户行对象上的 __advLogicalIndex 字段
// <en/> Prefer rowExpandApi.getLogicalIndex (WeakMap-based), avoiding reading __advLogicalIndex on user row objects
function resolveIndexText(_cellData: unknown, opts: ResolveCellTextOptions): string {
  return String((opts.ctx?.getLogicalIndex?.(opts.row) ?? opts.index) + 1)
}

const SPECIAL_VALUE_TYPE_TEXT: Record<string, (cellData: unknown, opts: ResolveCellTextOptions) => string> = {
  select: resolveSelectText,
  radio: resolveSelectText,
  checkbox: resolveSelectText,
  index: resolveIndexText,
  indexBorder: resolveIndexText,
  switch: cellData => (cellData ? '✓' : '✗'),
  progress: cellData => (cellData != null ? `${cellData}%` : ''),
  rate: (cellData) => {
    if (cellData == null)
      return ''
    const numericValue = Number(cellData)
    return Number.isNaN(numericValue) ? String(cellData) : `${numericValue}`
  },
}

/**
 * <zh/> 将单元格数据解析为纯文本字符串，与页面展示逻辑保持一致
 * <en/> Resolve cell data into a plain-text string, kept consistent with the on-page rendering logic
 *
 * @remarks
 * <zh/> 解析链路（优先级递降）：valueGetter → format → valueType（money/date/percent 等）→
 * <zh/> valueEnum（select/radio/checkbox）→ 特殊类型兜底（index/indexBorder/switch/progress/rate）→
 * <zh/> 常规兜底（转 String，null/undefined 返回 emptyText）。复用 value-format 格式化规则但不涉及 Vue 组件渲染。
 * <en/> Resolution chain (descending priority): valueGetter → format → valueType (money/date/percent…) →
 * <en/> valueEnum (select/radio/checkbox) → special-type fallback (index/indexBorder/switch/progress/rate) →
 * <en/> general fallback (String conversion; returns emptyText on null/undefined). Reuses value-format rules without Vue component rendering.
 *
 * @param opts - <zh/> 解析选项，包含单元格数据、行数据、列配置、上下文等 | <en/> resolution options including cell data, row data, column config and context
 * @returns <zh/> 解析后的纯文本字符串 | <en/> resolved plain-text string
 * @example
 * resolveCellText({ cellData: 100, row: {}, column: { valueType: 'money' }, index: 0 })
 * // => '¥100.00'
 */
export function resolveCellText(opts: ResolveCellTextOptions): string {
  const { column, ctx, index } = opts

  const cellData = column.valueGetter
    ? resolveCellValue(opts.row, column, index)
    : opts.cellData

  if (column.format) {
    const formatCtx: FormatContext = {
      row: opts.row,
      cellData,
      column,
      columns: opts.columns ?? [column],
      index,
      columnIndex: opts.columnIndex ?? 0,
    }
    return column.format(formatCtx)
  }

  const valueType = column.valueType

  if (!valueType) {
    if (cellData == null || cellData === '')
      return resolveEmptyText(column, ctx)
    return String(cellData)
  }

  const textFormatter = VALUE_TYPE_TEXT_FORMATTERS[valueType]
  if (textFormatter) {
    return textFormatter(cellData, ctx)
  }

  // <zh/> 自定义 valueType 优先——与 value-renderer.ts 同一注册表，渲染与导出文本单源
  // <en/> Custom valueTypes first — same registry as value-renderer.ts, single source for render and export text
  const custom = getCustomValueType(valueType)
  if (custom?.toText) {
    return custom.toText(cellData, { cellData, row: opts.row, column, index, ctx })
  }

  const specialResolver = SPECIAL_VALUE_TYPE_TEXT[valueType]
  if (specialResolver) {
    return specialResolver(cellData, opts)
  }

  if (cellData == null || cellData === '')
    return resolveEmptyText(column, ctx)
  return String(cellData)
}
