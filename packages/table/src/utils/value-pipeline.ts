/**
 * <zh/> 值管线处理函数，用于处理单元格值的解析链路（valueGetter → formatter → valueParser）。
 * <en/> Value pipeline handlers that process the cell value resolution chain (valueGetter → formatter → valueParser).
 *
 * <zh/> 统一的单元格取值入口，供筛选、排序、全局搜索、导出和编辑使用，支持 valueGetter 和 format。
 * <en/> Unified cell-value entry point used by filtering, sorting, global search, export and editing; supports valueGetter and format.
 *
 * <zh/> 数据流：row[prop] → valueGetter → [format] → 显示；编辑提交 → valueParser → valueSetter → row[prop]
 * <en/> Data flow: row[prop] → valueGetter → [format] → display; edit submit → valueParser → valueSetter → row[prop]
 */
import type { AdvColumn, ProcessedColumn } from '../types/column'

/**
 * <zh/> 值管线第一步：从行数据中解析单元格原始值，若定义了 valueGetter 则优先使用。
 * <zh/> 这是 format 之前的基值，用于排序、筛选和编辑初始值。
 * <en/> Step 1 of the value pipeline: resolve the raw cell value from row data, preferring valueGetter when defined.
 * <en/> This is the base value before formatting, used for sorting, filtering and the initial edit value.
 *
 * @param row - <zh/> 行数据对象 | <en/> row data object
 * @param col - <zh/> 列配置（AdvColumn 或 ProcessedColumn） | <en/> column config (AdvColumn or ProcessedColumn)
 * @param rowIndex - <zh/> 行索引 | <en/> row index
 * @returns <zh/> 解析到的原始值，未找到时返回 undefined | <en/> resolved raw value, undefined if not found
 *
 * @example
 * resolveCellValue(row, { prop: 'name' }, 0)
 * // => row['name']
 */
export function resolveCellValue<T = any>(
  row: T,
  col: AdvColumn<T> | ProcessedColumn,
  rowIndex: number,
): unknown {
  if (col.valueGetter) {
    return col.valueGetter({ row, column: col as AdvColumn<T>, rowIndex })
  }
  const prop = col.prop
  return prop != null ? (row as Record<string, unknown>)[prop] : undefined
}

/**
 * <zh/> 值管线第二步：解析单元格的显示值，若定义了 format 则应用它。
 * <zh/> 用于筛选（filterByFormat=true 时）和排序（sortByFormat=true 时）。
 * <zh/> 返回原始类型（string/number/boolean）以便筛选/排序比较；若 format 返回非原始类型（对象/数组），回退到原始值。
 * <en/> Step 2 of the value pipeline: resolve the display value of a cell, applying format when defined.
 * <en/> Used for filtering (when filterByFormat=true) and sorting (when sortByFormat=true).
 * <en/> Returns a primitive type (string/number/boolean) for filter/sort comparison; falls back to the raw value if format returns a non-primitive (object/array).
 *
 * @param row - <zh/> 行数据对象 | <en/> row data object
 * @param col - <zh/> 列配置（AdvColumn 或 ProcessedColumn） | <en/> column config (AdvColumn or ProcessedColumn)
 * @param rowIndex - <zh/> 行索引 | <en/> row index
 * @param columns - <zh/> 全部列配置（format 回调可能需要） | <en/> all column configs (may be needed by the format callback)
 * @returns <zh/> 格式化后的显示值，或回退到原始值 | <en/> formatted display value, or the raw value as fallback
 *
 * @example
 * resolveCellDisplayValue(row, { prop: 'price', format: (p) => `$${p.cellData}` }, 0)
 * // => '$100'
 */
export function resolveCellDisplayValue<T = any>(
  row: T,
  col: AdvColumn<T> | ProcessedColumn,
  rowIndex: number,
  columns?: AdvColumn<T>[],
  columnIndex?: number,
): unknown {
  const rawValue = resolveCellValue(row, col, rowIndex)

  if (col.format) {
    const formatted = col.format({
      row,
      cellData: rawValue,
      column: col as AdvColumn<T>,
      columns: columns ?? [col as AdvColumn<T>],
      index: rowIndex,
      // columnIndex 由调用方穿透传入，缺省时回退为 0
      // columnIndex is threaded from the caller, falls back to 0 for backward compatibility
      columnIndex: columnIndex ?? 0,
    })
    if (typeof formatted === 'string' || typeof formatted === 'number' || typeof formatted === 'boolean') {
      return formatted
    }
    return rawValue
  }

  return rawValue
}
