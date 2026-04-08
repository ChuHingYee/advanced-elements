/**
 * <zh/> 内置筛选器策略
 * <en/> Built-in filter strategies
 *
 * @remarks
 * <zh/> 将四种内置筛选类型（text、number、date、enum）注册到筛选器注册表。必须在初始化时调用一次
 * <en/> Registers the four built-in filter types (text, number, date, enum) into the filter registry. Must be called once during initialization
 */
import type {
  DateFilterValue,
  EnumFilterValue,
  GroupFilterValue,
  NumberCondition,
  NumberFilterValue,
  TextCondition,
  TextFilterValue,
} from '../../types/filter'
import type { FilterStrategy } from '../features/filter-registry'
import dayjs from 'dayjs'
import { conditionGroup, conditionLeaf, evaluateConditionTree } from '../../utils/filter-condition-tree'
import { isBlankish } from '../data/filter-eval'
import { getFilterStrategy, registerFilterType } from '../features/filter-registry'

/**
 * <zh/> 判断文本筛选条件是否处于激活状态
 * <en/> Check if a text filter condition is active
 *
 * @remarks
 * <zh/> 对于 blank/notBlank 操作符始终视为激活；其他操作符需要 value 非空
 * <en/> For blank/notBlank operators always active; other operators require non-empty value
 *
 * @param cond - <zh/> 文本筛选条件 | <en/> text filter condition
 * @returns <zh/> 条件是否激活 | <en/> whether the condition is active
 */
function isTextConditionActive(cond: TextCondition): boolean {
  if (cond.operator === 'blank' || cond.operator === 'notBlank')
    return true
  return cond.value !== undefined && cond.value !== ''
}

/**
 * <zh/> 判断单元格值是否匹配指定文本筛选条件
 * <en/> Check if a cell value matches the specified text filter condition
 *
 * @param cellValue - <zh/> 单元格原始值 | <en/> raw cell value
 * @param cond - <zh/> 文本筛选条件 | <en/> text filter condition
 * @returns <zh/> 是否匹配 | <en/> whether it matches
 */
function matchesTextCondition(cellValue: unknown, cond: TextCondition): boolean {
  if (cond.operator === 'blank')
    return isBlankish(cellValue)
  if (cond.operator === 'notBlank')
    return !isBlankish(cellValue)
  // 预计算 str/keyword 的小写形式，避免在每个 case 分支重复 toLowerCase
  const str = String(cellValue ?? '')
  const keyword = cond.value ?? ''
  const lowerStr = str.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  switch (cond.operator) {
    case 'contains': return lowerStr.includes(lowerKeyword)
    case 'notContains': return !lowerStr.includes(lowerKeyword)
    case 'equals': return str === keyword
    case 'notEquals': return str !== keyword
    case 'beginsWith': return lowerStr.startsWith(lowerKeyword)
    case 'endsWith': return lowerStr.endsWith(lowerKeyword)
  }
  return false
}

/**
 * <zh/> 判断数字筛选条件是否处于激活状态
 * <en/> Check if a number filter condition is active
 *
 * @remarks
 * <zh/> 对于 blank/notBlank 始终激活；between 需要至少一个边界值；其他需要 value 有定义
 * <en/> For blank/notBlank always active; between requires at least one boundary value; others require value to be defined
 *
 * @param cond - <zh/> 数字筛选条件 | <en/> number filter condition
 * @returns <zh/> 条件是否激活 | <en/> whether the condition is active
 */
function isNumberConditionActive(cond: NumberCondition): boolean {
  if (cond.operator === 'blank' || cond.operator === 'notBlank')
    return true
  if (cond.operator === 'between')
    return cond.min !== undefined || cond.max !== undefined
  return cond.value !== undefined
}

/**
 * <zh/> 判断单元格值是否匹配指定数字筛选条件
 * <en/> Check if a cell value matches the specified number filter condition
 *
 * @param cellValue - <zh/> 单元格原始值 | <en/> raw cell value
 * @param cond - <zh/> 数字筛选条件 | <en/> number filter condition
 * @returns <zh/> 是否匹配 | <en/> whether it matches
 */
function matchesNumberCondition(cellValue: unknown, cond: NumberCondition): boolean {
  if (cond.operator === 'blank')
    return isBlankish(cellValue)
  if (cond.operator === 'notBlank')
    return !isBlankish(cellValue)
  const num = Number(cellValue)
  if (Number.isNaN(num))
    return false
  switch (cond.operator) {
    case 'eq': return cond.value !== undefined && num === cond.value
    case 'neq': return cond.value !== undefined && num !== cond.value
    case 'gt': return cond.value !== undefined && num > cond.value
    case 'gte': return cond.value !== undefined && num >= cond.value
    case 'lt': return cond.value !== undefined && num < cond.value
    case 'lte': return cond.value !== undefined && num <= cond.value
    case 'between':
      return (cond.min === undefined || num >= cond.min)
        && (cond.max === undefined || num <= cond.max)
  }
  return false
}

function parseDayjs(value: unknown): dayjs.Dayjs | null {
  if (value == null)
    return null
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date))
    return null
  const dayjsInstance = dayjs(value)
  return dayjsInstance.isValid() ? dayjsInstance : null
}

// 模块级幂等保护：首次调用时注册，后续调用直接跳过
// Module-level idempotent guard: registers only on first call
let builtinRegistered = false

export /**
        * <zh/> 是否为相对快捷日期操作符（today/thisWeek/thisMonth）——这类操作符不依赖用户输入值，
        * <zh/> isActive 恒为 true。
        * <en/> Whether the operator is a relative quick date operator (today/thisWeek/thisMonth) — these
        * <en/> need no user input; isActive is always true.
        */
function isRelativeDateOperator(operator: string): boolean {
  return operator === 'today' || operator === 'thisWeek' || operator === 'thisMonth'
}

/**
 * <zh/> 注册四种内置筛选类型
 * <en/> Register the four built-in filter types (text, number, date, enum)
 *
 * @remarks
 * <zh/> 幂等：重复调用安全，仅首次注册
 * <en/> Idempotent: safe to call multiple times, only registers on first call
 */
export function registerBuiltinFilterTypes(): void {
  if (builtinRegistered)
    return
  builtinRegistered = true
  // <zh/> 条件树策略——GroupFilterValue 的 N 元 AND/OR 组合（可嵌套），逐子条件以各自类型
  // <zh/> 的策略对同一单元格值判定，经 filter-condition-tree 短路求值。空组恒真（未启用）。
  // <en/> Condition-tree strategy — N-ary AND/OR composition for GroupFilterValue (nestable);
  // <en/> each child is judged against the SAME cell value by its own type's strategy and
  // <en/> short-circuit-evaluated via filter-condition-tree. An empty group is vacuously true (not engaged).
  registerFilterType({
    type: 'group',
    createDefaultValue: (): GroupFilterValue => ({ type: 'group', logic: 'and', conditions: [] }),
    isActive: (value: GroupFilterValue): boolean => {
      if (!Array.isArray(value.conditions))
        return false
      return value.conditions.some((child) => {
        const strategy = child && typeof child.type === 'string' ? getFilterStrategy(child.type) : undefined
        return strategy ? strategy.isActive(child) : false
      })
    },
    matches: (cellValue: unknown, filterValue: GroupFilterValue): boolean => {
      const children = Array.isArray(filterValue.conditions) ? filterValue.conditions : []
      const tree = conditionGroup(
        filterValue.logic === 'or' ? 'or' : 'and',
        children.map(child => conditionLeaf(() => {
          const strategy = child && typeof child.type === 'string' ? getFilterStrategy(child.type) : undefined
          return strategy ? strategy.matches(cellValue, child) : true
        })),
      )
      return evaluateConditionTree(tree)
    },
  } satisfies FilterStrategy<GroupFilterValue>)
  registerFilterType({
    type: 'text',
    createDefaultValue: (): TextFilterValue => ({ type: 'text', operator: 'contains' }),
    isActive: (value: TextFilterValue): boolean => {
      if (isTextConditionActive(value))
        return true
      if (value.conditions)
        return isTextConditionActive(value.conditions.condition)
      return false
    },
    matches: (cellValue: unknown, filterValue: TextFilterValue): boolean => {
      const primaryResult = matchesTextCondition(cellValue, filterValue)
      if (!filterValue.conditions)
        return primaryResult
      if (!isTextConditionActive(filterValue.conditions.condition))
        return primaryResult
      const secondaryResult = matchesTextCondition(cellValue, filterValue.conditions.condition)
      return filterValue.conditions.logic === 'and' ? primaryResult && secondaryResult : primaryResult || secondaryResult
    },
  } satisfies FilterStrategy<TextFilterValue>)

  registerFilterType({
    type: 'number',
    createDefaultValue: (): NumberFilterValue => ({ type: 'number', operator: 'eq' }),
    isActive: (value: NumberFilterValue): boolean => {
      if (isNumberConditionActive(value))
        return true
      if (value.conditions)
        return isNumberConditionActive(value.conditions.condition)
      return false
    },
    matches: (cellValue: unknown, filterValue: NumberFilterValue): boolean => {
      const primaryResult = matchesNumberCondition(cellValue, filterValue)
      if (!filterValue.conditions)
        return primaryResult
      if (!isNumberConditionActive(filterValue.conditions.condition))
        return primaryResult
      const secondaryResult = matchesNumberCondition(cellValue, filterValue.conditions.condition)
      return filterValue.conditions.logic === 'and' ? primaryResult && secondaryResult : primaryResult || secondaryResult
    },
  } satisfies FilterStrategy<NumberFilterValue>)

  registerFilterType({
    type: 'date',
    createDefaultValue: (): DateFilterValue => ({ type: 'date', operator: 'before' }),
    isActive: (value: DateFilterValue): boolean => {
      // <zh/> 相对快捷操作符恒活跃——残留的 value/startDate 字段被忽略（无害），
      // <zh/> column-filter-form.vue 的 setDateOperator 已在操作符切换时清理全部值字段。
      // <en/> Relative quick operators are always active — residual value/startDate fields are ignored (harmless),
      // <en/> setDateOperator in column-filter-form.vue clears all value fields on operator switch.
      if (isRelativeDateOperator(value.operator))
        return true
      if (value.operator === 'between')
        return value.startDate !== undefined || value.endDate !== undefined
      return value.value !== undefined
    },
    matches: (cellValue: unknown, filterValue: DateFilterValue): boolean => {
      const cellDate = parseDayjs(cellValue)
      if (!cellDate)
        return false
      switch (filterValue.operator) {
        case 'before': {
          const target = parseDayjs(filterValue.value)
          return target !== null && cellDate.isBefore(target.add(1, 'day'), 'day')
        }
        case 'after': {
          const target = parseDayjs(filterValue.value)
          return target !== null && cellDate.isAfter(target.subtract(1, 'day'), 'day')
        }
        case 'between': {
          const start = filterValue.startDate ? parseDayjs(filterValue.startDate) : null
          const end = filterValue.endDate ? parseDayjs(filterValue.endDate) : null
          return (!start || cellDate.isSame(start, 'day') || cellDate.isAfter(start))
            && (!end || cellDate.isSame(end, 'day') || cellDate.isBefore(end))
        }
        // <zh/> 相对快捷操作符——无需用户输入值，按当前时刻的 dayjs 单位边界判定。
        // <en/> Relative quick operators — no user input required; boundaries come from the
        // <en/> current moment's dayjs unit start/end.
        case 'today':
          return cellDate.isSame(dayjs(), 'day')
        case 'thisWeek':
          return cellDate.isSame(dayjs(), 'week')
        case 'thisMonth':
          return cellDate.isSame(dayjs(), 'month')
      }
      return false
    },
  } satisfies FilterStrategy<DateFilterValue>)

  registerFilterType({
    type: 'enum',
    createDefaultValue: (): EnumFilterValue => ({ type: 'enum', selected: [] }),
    isActive: (value: EnumFilterValue): boolean => {
      return value.selected.length > 0
    },
    matches: (cellValue: unknown, filterValue: EnumFilterValue): boolean => {
      if (filterValue.selected.length === 0)
        return true
      return filterValue.selected.includes(cellValue as string | number)
    },
  } satisfies FilterStrategy<EnumFilterValue>)
}

/**
 * <zh/> 检查内置筛选类型是否已注册
 * <en/> Check if built-in filter types are registered
 *
 * @returns <zh/> 是否已注册 | <en/> whether registered
 * @example
 * isBuiltinFilterTypesRegistered // => true
 */
export function isBuiltinFilterTypesRegistered(): boolean {
  return builtinRegistered
}
