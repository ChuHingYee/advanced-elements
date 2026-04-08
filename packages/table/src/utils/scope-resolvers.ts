import type { MaybeRefOrGetter } from 'vue'
import type { AdvColumn } from '../types'
import type { ColumnMode, DataMode } from '../types/scope'
import { toValue } from 'vue'

export type { ColumnMode, DataMode }

/**
 * <zh/> 数据/列范围决议（定义见 `../types/scope`，本模块只保留决议函数）
 * <en/> Data/column scope resolvers (defined in `../types/scope`; this module keeps only the resolvers)
 */

/**
 * <zh/> 根据 dataMode 解析待导出/打印的数据
 * <en/> Resolve data based on dataMode for export/print
 *
 * @param dataMode - <zh/> 数据范围 | <en/> data scope
 * @param allData - <zh/> 全量数据 | <en/> all data
 * @param currentData - <zh/> 当前页数据 | <en/> current page data
 * @param selectedRows - <zh/> 选中行数据 | <en/> selected rows data
 * @param filteredData - <zh/> 筛选/搜索后的全量数据（dataMode 为 'filtered' 时使用） | <en/> full data after filter/search (used when dataMode is 'filtered')
 */
export function resolveDataByMode<T>(
  dataMode: DataMode | undefined,
  allData: MaybeRefOrGetter<T[]>,
  currentData: MaybeRefOrGetter<T[]>,
  selectedRows: MaybeRefOrGetter<T[]>,
  filteredData?: MaybeRefOrGetter<T[]>,
): T[] {
  const mode = dataMode ?? 'all'
  switch (mode) {
    case 'current':
      return toValue(currentData)
    case 'selected':
      return toValue(selectedRows)
    case 'filtered':
      return filteredData ? toValue(filteredData) : toValue(allData)
    case 'all':
    default:
      return toValue(allData)
  }
}

/**
 * <zh/> 根据 columnMode 解析待导出/打印的列
 * <en/> Resolve columns based on columnMode for export/print
 *
 * @param columnMode - <zh/> 列范围 | <en/> column scope
 * @param columns - <zh/> 可见列 | <en/> visible columns
 * @param allColumns - <zh/> 全量列 | <en/> all columns
 */
export function resolveColumnsByMode<T>(
  columnMode: ColumnMode | undefined,
  columns: MaybeRefOrGetter<AdvColumn<T>[]>,
  allColumns: MaybeRefOrGetter<AdvColumn<T>[]>,
): AdvColumn<T>[] {
  const resolvedColumnMode = columnMode ?? 'visible'
  return resolvedColumnMode === 'all'
    ? toValue(allColumns)
    : toValue(columns)
}

/**
 * <zh/> 导出作用域（列 + 数据组合口径）——与内置导出/打印同一决议，供业务侧自写导出（如 PDF/JSON）复用，避免"导出的列与画面不一致"。
 * <en/> Export scope (combined column + data resolution) — same caliber as built-in export/print, for custom business exports (e.g. PDF/JSON) so exported columns never drift from the screen.
 */
export interface ExportScope<T = any> {
  /** <zh/> 按 columnMode 决议的列 | <en/> columns resolved by columnMode */
  columns: AdvColumn<T>[]
  /** <zh/> 按 dataMode 决议的数据 | <en/> data resolved by dataMode */
  data: T[]
}

export function resolveExportScope<T>(options: {
  columnMode: ColumnMode | undefined
  dataMode: DataMode | undefined
  visibleColumns: MaybeRefOrGetter<AdvColumn<T>[]>
  allColumns: MaybeRefOrGetter<AdvColumn<T>[]>
  allData: MaybeRefOrGetter<T[]>
  currentData: MaybeRefOrGetter<T[]>
  selectedRows: MaybeRefOrGetter<T[]>
  filteredData?: MaybeRefOrGetter<T[]>
}): ExportScope<T> {
  return {
    columns: resolveColumnsByMode(options.columnMode, options.visibleColumns, options.allColumns),
    data: resolveDataByMode(options.dataMode, options.allData, options.currentData, options.selectedRows, options.filteredData),
  }
}
