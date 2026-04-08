/**
 * <zh/> 列筛选值类型——领域类型下沉。
 * <zh/> 此处为唯一真源，hook 内转出以便筛选消费者单点导入。
 * <en/> Column filter value types — domain types sunk to the type layer.
 * <en/> Single source of truth here; re-exported from the hook so filter consumers import from one place.
 */
import type { ColumnFilterType } from './column'

/** <zh/> 文本筛选操作符：包含/不包含/等于/不等于/开头是/结尾是/空值/非空值 | <en/> Text filter operators: contains/notContains/equals/notEquals/beginsWith/endsWith/blank/notBlank */
export type TextOperator = 'contains' | 'notContains' | 'equals' | 'notEquals' | 'beginsWith' | 'endsWith' | 'blank' | 'notBlank'

/** <zh/> 文本筛选条件 | <en/> Text filter condition */
export interface TextCondition {
  operator: TextOperator
  value?: string
}

/** <zh/> 文本筛选值 | <en/> Text filter value */
export interface TextFilterValue {
  type: 'text'
  operator: TextOperator
  value?: string
  conditions?: {
    logic: 'and' | 'or'
    condition: TextCondition
  }
}

/** <zh/> 数字筛选操作符：等于/不等于/大于/大于等于/小于/小于等于/介于/空值/非空值 | <en/> Number filter operators: eq/neq/gt/gte/lt/lte/between/blank/notBlank */
export type NumberOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'blank' | 'notBlank'

/** <zh/> 数字筛选条件 | <en/> Number filter condition */
export interface NumberCondition {
  operator: NumberOperator
  value?: number
  min?: number
  max?: number
}

/** <zh/> 数字筛选值 | <en/> Number filter value */
export interface NumberFilterValue {
  type: 'number'
  operator: NumberOperator
  value?: number
  min?: number
  max?: number
  conditions?: {
    logic: 'and' | 'or'
    condition: NumberCondition
  }
}

/** <zh/> 日期筛选值 | <en/> Date filter value */
export interface DateFilterValue {
  type: 'date'
  /**
   * <zh/> 操作符——today/thisWeek/thisMonth 为相对快捷项，不依赖用户输入值
   * <en/> Operators — today/thisWeek/thisMonth are relative quick ops needing no user input
   */
  operator: 'before' | 'after' | 'between' | 'today' | 'thisWeek' | 'thisMonth'
  value?: string
  startDate?: string
  endDate?: string
}

/** <zh/> 枚举筛选值 | <en/> Enum filter value */
export interface EnumFilterValue {
  type: 'enum'
  selected: (string | number)[]
}

/**
 * <zh/> 组合条件值（条件树）——将同列多条件 AND/OR 组合从两槽硬编码提升为任意深度嵌套。
 * <zh/> children 中每个元素仍是标准 ColumnFilterValue（可继续嵌套 group），逐元素用各自
 * <zh/> 类型的策略对同一单元格值判定；由注册的 'group' 策略短路求值。
 * <en/> Group condition value (condition tree) — lifts same-column multi-condition AND/OR beyond
 * <en/> the two-slot model to arbitrary nesting. Each element of `conditions` is a standard
 * <en/> ColumnFilterValue (groups nest freely); every element is judged against the SAME cell
 * <en/> value by its own type's strategy, short-circuit-evaluated by the registered 'group' strategy.
 */
export interface GroupFilterValue {
  type: 'group'
  logic: 'and' | 'or'
  conditions: ColumnFilterValue[]
}

/**
 * <zh/> 列筛选值联合类型 | <en/> Column filter value union type
 */
export type ColumnFilterValue = TextFilterValue | NumberFilterValue | DateFilterValue | EnumFilterValue | GroupFilterValue

export type { ColumnFilterType }
