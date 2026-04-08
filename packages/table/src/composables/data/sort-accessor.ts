import type { ProcessedColumn } from '../../types'
import { resolveCellDisplayValue, resolveCellValue } from '../../utils/value-pipeline'

/**
 * <zh/> 构建列排序取值函数——委托 compileSortAccessor，按函数 / 点分路径 / 数组回退 / 格式化值 / valueGetter / fallbackProp 顺序解析。
 * <en/> Build the sort accessor for a column — delegates to compileSortAccessor, resolving in order: function / dotted path / array fallback / formatted value / valueGetter / fallbackProp.
 *
 * @param col - <zh/> 目标列配置 | <en/> Target column config
 * @param sortBy - <zh/> 排序字段（函数、点分路径字符串或路径数组） | <en/> Sort field (function, dotted path or path array)
 * @param fallbackProp - <zh/> 未配置 sortBy 时的回退字段 | <en/> Fallback field when sortBy is absent
 * @param sortByFormat - <zh/> 是否按格式化展示值排序 | <en/> Whether to sort by formatted display value
 * @param allColumns - <zh/> 全部列（格式化值排序时解析单元格所需） | <en/> All columns (required to resolve the cell for formatted-value sorting)
 * @param columnIndex - <zh/> 当前列索引（格式化值排序所需） | <en/> Column index (required for formatted-value sorting)
 * @returns <zh/> 供排序比较使用的取值函数 | <en/> An accessor function for sort comparison
 */
export function getCachedSortAccessor(
  col: ProcessedColumn,
  sortBy?: string | string[] | ((row: any) => unknown),
  fallbackProp?: string,
  sortByFormat?: boolean,
  allColumns?: ProcessedColumn[],
  columnIndex?: number,
): (row: any, rowIndex: number) => unknown {
  // <zh/> 函数型 sortBy 闭包与调用方身份绑定，不缓存（缓存会跨列串用）；其余按列对象缓存并校验依赖
  // <en/> Function sortBy closures bind to caller identity — never cache them; cache the rest per column with dep validation
  if (typeof sortBy === 'function')
    return sortBy as (row: any, rowIndex: number) => unknown
  // <zh/> 数组型内含函数成员同样跳缓存，避免子闭包串用
  // <en/> Array form containing functions also skips the cache to avoid sub-closure aliasing
  const cacheable = sortBy == null || typeof sortBy === 'string'
    ? true
    : Array.isArray(sortBy) ? sortBy.every(s => typeof s === 'string') : false
  if (!cacheable)
    return compileSortAccessor(col, sortBy, fallbackProp, sortByFormat, allColumns, columnIndex)
  const cache = getAccessorCache(col)
  const key = buildAccessorCacheKey(sortBy, fallbackProp, sortByFormat, columnIndex)
  const entry = cache.get(key)
  // <zh/> 依赖校验：列对象可原地 mutate（format/valueGetter 重装）且 allColumns 可换引用，
  // <zh/> 命中时必须比对捕获的依赖，否则返回过期闭包（回归测试：uses the current allColumns context）
  // <en/> Validate captured deps on hit: columns mutate in place and allColumns changes identity
  if (entry
    && entry.format === (col as { format?: unknown }).format
    && entry.valueGetter === (col as { valueGetter?: unknown }).valueGetter
    && entry.allColumns === allColumns) {
    return entry.accessor
  }
  const accessor = compileSortAccessor(col, sortBy, fallbackProp, sortByFormat, allColumns, columnIndex)
  cache.set(key, {
    accessor,
    format: (col as { format?: unknown }).format,
    valueGetter: (col as { valueGetter?: unknown }).valueGetter,
    allColumns,
  })
  return accessor
}

interface AccessorCacheEntry {
  accessor: (row: any, rowIndex: number) => unknown
  format: unknown
  valueGetter: unknown
  allColumns: ProcessedColumn[] | undefined
}

const accessorCache = new WeakMap<object, Map<string, AccessorCacheEntry>>()

function getAccessorCache(col: ProcessedColumn): Map<string, AccessorCacheEntry> {
  let cache = accessorCache.get(col)
  if (!cache) {
    cache = new Map()
    accessorCache.set(col, cache)
  }
  return cache
}

function buildAccessorCacheKey(
  sortBy: string | string[] | ((row: any) => unknown) | undefined,
  fallbackProp: string | undefined,
  sortByFormat: boolean | undefined,
  columnIndex: number | undefined,
): string {
  // <zh/> sortBy 为字符串/字符串数组时可稳定序列化；函数型已在上游短路，此处仅处理可缓存形态
  // <en/> Only cacheable forms reach here (string / string-array / undefined), so serialization is stable
  const sortByKey = Array.isArray(sortBy) ? `arr:${sortBy.join('\0')}` : `str:${String(sortBy ?? '')}`
  return `${sortByKey}\0${String(fallbackProp ?? '')}\0${sortByFormat ? '1' : '0'}\0${String(columnIndex ?? -1)}`
}

/**
 * Compile a sort accessor function from column configuration.
 * 编译排序取值函数.
 */
export function compileSortAccessor(
  col: ProcessedColumn,
  sortBy?: string | string[] | ((row: any) => unknown),
  fallbackProp?: string,
  sortByFormat?: boolean,
  allColumns?: ProcessedColumn[],
  columnIndex?: number,
): (row: any, rowIndex: number) => unknown {
  if (typeof sortBy === 'function')
    return sortBy as (row: any, rowIndex: number) => unknown

  if (typeof sortBy === 'string') {
    const parts = sortBy.split('.')
    if (parts.length === 1) {
      return (row: any, _rowIndex: number) => row?.[sortBy]
    }
    return (row: any, _rowIndex: number) => {
      let currentValue: any = row
      for (const part of parts) {
        if (currentValue == null)
          return undefined
        currentValue = currentValue[part]
      }
      return currentValue
    }
  }

  if (Array.isArray(sortBy)) {
    const accessors = sortBy.map(s => compileSortAccessor(col, s, undefined, sortByFormat, allColumns, columnIndex))
    return (row: any, rowIndex: number) => {
      for (const accessor of accessors) {
        const sortValue = accessor(row, rowIndex)
        if (sortValue != null)
          return sortValue
      }
      return undefined
    }
  }

  if (sortByFormat && col.format) {
    return (row: any, rowIndex: number) => resolveCellDisplayValue(row, col, rowIndex, allColumns, columnIndex)
  }

  if (col.valueGetter) {
    return (row: any, rowIndex: number) => resolveCellValue(row, col, rowIndex)
  }

  if (fallbackProp) {
    return (row: any, _rowIndex: number) => row?.[fallbackProp]
  }

  return (_row: any, _rowIndex: number) => undefined
}
