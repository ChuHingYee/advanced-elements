import type { ProcessedColumn } from '../types/column'
import { copyToClipboard } from './copy'
import { resolveCellText } from './resolve-cell-text'
import { neutralizeFormulaInjection } from './security'

/** <zh/> 获取单个单元格值的选项 | <en/> Options for getting a single cell value */
export interface CellValueOptions<T> {
  /** <zh/> 行数据 | <en/> row data */
  row: T
  /** <zh/> 列定义 | <en/> column definition */
  column: ProcessedColumn
  /** <zh/> 行索引（供 format/valueType 解析使用） | <en/> row index (used by format/valueType resolution) */
  index?: number
  /** <zh/> 所有列配置（用于 format 回调与列索引定位） | <en/> all column configs (used by format callbacks and column-index resolution) */
  columns?: ProcessedColumn[]
}

/** <zh/> 获取单行制表符分隔值的选项 | <en/> Options for getting tab-separated values of a single row */
export interface RowValuesOptions<T> {
  /** <zh/> 行数据 | <en/> row data */
  row: T
  /** <zh/> 列定义列表 | <en/> column definitions */
  columns: ProcessedColumn[]
  /** <zh/> 是否包含表头行 | <en/> whether to include the header row */
  includeHeaders?: boolean
  /** <zh/> 行索引（供 format/valueType 解析使用） | <en/> row index (used by format/valueType resolution) */
  index?: number
}

/** <zh/> 获取多行制表符分隔值的选项 | <en/> Options for getting tab-separated values of multiple rows */
export interface RowsValuesOptions<T> {
  /** <zh/> 行数据列表 | <en/> row data list */
  rows: T[]
  /** <zh/> 列定义列表 | <en/> column definitions */
  columns: ProcessedColumn[]
  /** <zh/> 是否包含表头行 | <en/> whether to include the header row */
  includeHeaders?: boolean
  /** <zh/> 起始行索引（供 format/valueType 解析使用） | <en/> starting row index (used by format/valueType resolution) */
  startIndex?: number
}

/**
 * <zh/> 获取单元格显示文本。
 * <en/> Get the cell display text.
 *
 * @param row - <zh/> 行数据 | <en/> row data
 * @param column - <zh/> 列定义 | <en/> column definition
 * @returns <zh/> 单元格的字符串值，为空时返回空字符串 | <en/> cell string value, empty string when blank
 */
function getCellDisplayValue<T>(
  row: T,
  column: ProcessedColumn,
  index = 0,
  columns?: ProcessedColumn[],
): string {
  const prop = column.prop as keyof T | undefined
  if (!prop)
    return ''
  const cellData = row[prop]
  if (cellData == null)
    return ''
  const colIndex = columns ? columns.indexOf(column) : undefined
  const text = resolveCellText({
    cellData,
    row: row as Record<string, unknown>,
    column: column as unknown as import('../types').AdvColumn,
    columns: columns as unknown as import('../types').AdvColumn[],
    index,
    columnIndex: colIndex && colIndex >= 0 ? colIndex : undefined,
  })
  /**
   * <zh/> 安全契约：剪贴板是"数据离开表格进入电子表格软件"的出口，与 CSV 导出同类。
   * <zh/> 约束：复制侧与导出侧必须同时做公式注入中和，未中和的文本粘贴进 Excel 即触发命令执行。
   * <zh/> 统一在单元格文本产出点中和，使 copyCell/copyRow/copyRows 三条路径同时受保护。
   * <en/> Security contract: the clipboard is an exit where data leaves the table and enters a
   * <en/> spreadsheet app — the same class as CSV export. Constraint: copy and export sides must both
   * <en/> neutralize formula injection; unneutralized text triggers command execution on paste into Excel.
   * <en/> Neutralizing at the cell-text production point protects copyCell/copyRow/copyRows at once.
   */
  return neutralizeFormulaInjection(text)
}

/**
 * <zh/> 获取单个单元格的值。
 * <en/> Get a single cell's value.
 *
 * @param options - <zh/> 选项，包含行数据和列定义 | <en/> options containing row data and column definition
 * @returns <zh/> 单元格字符串值 | <en/> cell string value
 */
export function getCellValue<T>(options: CellValueOptions<T>): string {
  return getCellDisplayValue(options.row, options.column, options.index ?? 0, options.columns)
}

/**
 * <zh/> 将二维字符串矩阵序列化为 TSV——剪贴板复制的唯一序列化实现。
 *
 * <zh/> 约束：禁止 `getRowValues` / `getRowsValues` / 范围选区侧（`use-cell-range-selection.extractRangeText`）
 * <zh/> 各存一份 `map + join('\t') + join('\n')`，三处必须共用同一实现，避免分隔符语义漂移。
 *
 * <en/> Serialize a 2-D string matrix to TSV — the single serialization implementation for clipboard copy.
 *
 * <en/> Constraint: `getRowValues` / `getRowsValues` and the range-selection side
 * <en/> (`use-cell-range-selection.extractRangeText`) must not each keep their own
 * <en/> `map + join('\t') + join('\n')`; all three share one implementation, keeping the
 * <en/> delimiter semantics from drifting apart.
 *
 * @param lines - <zh/> 行数组，每行为单元格字符串数组 | <en/> row array, each row is an array of cell strings
 * @returns <zh/> TSV 文本 | <en/> TSV text
 */
export function serializeTsv(lines: string[][]): string {
  let out = ''
  for (let i = 0; i < lines.length; i++) {
    if (i > 0)
      out += '\n'
    out += lines[i].join('\t')
  }
  return out
}

/**
 * <zh/> 按列位置切片 TSV——剔除指定列后重新序列化。
 *
 * <zh/> 用于敏感列过滤：范围选区的 TSV 已经过 `resolveCellText` 解析，
 * <zh/> 若因剔除列而重新解析，format 回调会被二次执行且 `columnIndex` 语义会变。
 * <zh/> 直接按位置切片可完整保留已解析的单元格文本，零语义漂移。
 *
 * <en/> Slice a TSV by column position — drop the given columns and re-serialize.
 *
 * <en/> Used for sensitive-column filtering: range-selection TSV has already been resolved via
 * <en/> `resolveCellText`; re-resolving after dropping columns would run format callbacks twice and
 * <en/> change the meaning of `columnIndex`. Positional slicing preserves the resolved cell text
 * <en/> exactly, with zero semantic drift.
 *
 * @param tsv - <zh/> 原始 TSV 文本 | <en/> source TSV text
 * @param keepColIndices - <zh/> 需保留的列下标（相对原始列序） | <en/> column indices to keep (relative to the original column order)
 * @returns <zh/> 切片后的 TSV 文本 | <en/> sliced TSV text
 */
export function sliceTsvColumns(tsv: string, keepColIndices: readonly number[]): string {
  if (tsv === '')
    return ''
  const lines = tsv.split('\n')
  const out: string[][] = []
  for (const line of lines) {
    const cells = line.split('\t')
    const kept: string[] = []
    for (const i of keepColIndices) {
      kept.push(cells[i] ?? '')
    }
    out.push(kept)
  }
  return serializeTsv(out)
}

/**
 * <zh/> 获取制表符分隔的行值（可选包含表头）。
 * <en/> Get tab-separated row values (optionally including the header).
 */
export function getRowValues<T>(options: RowValuesOptions<T>): string {
  const { row, columns, includeHeaders, index = 0 } = options
  const values = columns.map(col => getCellDisplayValue(row, col, index, columns))
  if (includeHeaders) {
    const headers = columns.map(col => col.label ?? col.prop ?? '')
    return serializeTsv([headers, values])
  }
  return serializeTsv([values])
}

/**
 * <zh/> 获取制表符分隔的多行值（可选包含表头）。
 * <en/> Get tab-separated multi-row values (optionally including the header).
 */
export function getRowsValues<T>(options: RowsValuesOptions<T>): string {
  const { rows, columns, includeHeaders, startIndex = 0 } = options
  const lines: string[][] = []
  if (includeHeaders) {
    lines.push(columns.map(col => col.label ?? col.prop ?? ''))
  }
  for (let i = 0; i < rows.length; i++) {
    lines.push(columns.map(col => getCellDisplayValue(rows[i], col, startIndex + i, columns)))
  }
  return serializeTsv(lines)
}

/**
 * <zh/> 复制单个单元格值到剪贴板。
 * <en/> Copy a single cell value to the clipboard.
 *
 * @param row - <zh/> 当前行数据 | <en/> current row data
 * @param column - <zh/> 当前列配置 | <en/> current column config
 * @param columns - <zh/> 所有列配置（可选，用于 format 回调） | <en/> all column configs (optional, for format callbacks)
 * @returns <zh/> 是否复制成功 | <en/> whether the copy succeeded
 */
export async function copyCellToClipboard<T>(row: T, column: ProcessedColumn, columns?: ProcessedColumn[]): Promise<boolean> {
  const value = getCellValue({ row, column, columns })
  return copyToClipboard(value)
}

/**
 * <zh/> 复制单行数据到剪贴板（Tab 分隔）。
 * <en/> Copy a single row's data to the clipboard (Tab-separated).
 *
 * @param row - <zh/> 当前行数据 | <en/> current row data
 * @param columns - <zh/> 列配置数组 | <en/> column config array
 * @param includeHeaders - <zh/> 是否在首行拼接列名表头 | <en/> whether to prepend the column-name header on the first line
 * @returns <zh/> 是否复制成功 | <en/> whether the copy succeeded
 */
export async function copyRowToClipboard<T>(row: T, columns: ProcessedColumn[], includeHeaders?: boolean): Promise<boolean> {
  const value = getRowValues({ row, columns, includeHeaders })
  return copyToClipboard(value)
}

/**
 * <zh/> 复制多行数据到剪贴板（Tab 分隔，行间换行）。
 * <en/> Copy multiple rows' data to the clipboard (Tab-separated, newline between rows).
 *
 * @param rows - <zh/> 行数据数组 | <en/> row data array
 * @param columns - <zh/> 列配置数组 | <en/> column config array
 * @param includeHeaders - <zh/> 是否在首行拼接列名表头 | <en/> whether to prepend the column-name header on the first line
 * @returns <zh/> 是否复制成功 | <en/> whether the copy succeeded
 */
export async function copyRowsToClipboard<T>(rows: T[], columns: ProcessedColumn[], includeHeaders?: boolean): Promise<boolean> {
  const value = getRowsValues({ rows, columns, includeHeaders })
  return copyToClipboard(value)
}
