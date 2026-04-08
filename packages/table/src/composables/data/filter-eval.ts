import type { ColumnFilterValue } from '../../types/filter'
import type { FilterStrategy } from '../features/filter-registry'
import { getFilterStrategy } from '../features/filter-registry'

/**
 * <zh/> 策略读取器——默认读全局注册表；按表隔离时传入 useFilterRegistry() 的 get。
 * <en/> Strategy reader — reads the global registry by default; pass useFilterRegistry()'s get for per-table isolation.
 */
export type FilterStrategyReader = (type: string) => FilterStrategy | undefined

/**
 * Filter predicate evaluation
 * 筛选求值谓词,纯搬移自 use-column-filter.ts,零行为变更.
 *
 * Both predicates delegate to the registered per-type strategy (see filter-registry.ts and
 * builtin-filters.ts), so new filter types need no changes here. Callers must ensure
 * registerBuiltinFilterTypes() ran (useColumnFilter does it in setup).
 */

/**
 * Whether a filter value actually constrains rows. Unknown types with no strategy count as inactive.
 * 筛选值是否真实起作用,无策略的未知类型视为未激活.
 */
export function isFilterActive(value: ColumnFilterValue | null | undefined, getStrategy: FilterStrategyReader = getFilterStrategy): boolean {
  if (!value || typeof value.type !== 'string')
    return false
  const strategy = getStrategy(value.type)
  if (strategy)
    return strategy.isActive(value)
  return false
}

/**
 * <zh/> 空值判定单源——text/number 筛选器的 blank/notBlank 分支共用（见 builtin-filters.ts），空语义变更只改此处。
 * <en/> Single source for blank checks — shared by text/number filter blank/notBlank branches (see builtin-filters.ts); blank-semantic changes touch only here.
 */
export function isBlankish(cellValue: unknown): boolean {
  return cellValue == null || cellValue === ''
}

/**
 * Whether a cell value passes a filter value. Unknown types with no strategy pass everything.
 * 单元格值是否通过筛选,无策略的未知类型全部放行.
 */
export function matchesFilter(cellValue: unknown, filterValue: ColumnFilterValue, getStrategy: FilterStrategyReader = getFilterStrategy): boolean {
  const strategy = getStrategy(filterValue.type)
  if (strategy)
    return strategy.matches(cellValue, filterValue)
  return true
}
