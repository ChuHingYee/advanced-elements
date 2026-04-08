/**
 * <zh/> 筛选文案格式化（纯函数）。将 ColumnFilterValue 格式化为人类可读文字，用于浮动筛选 readonly 显示；i18n 文案改动只进本文件，不碰状态机。
 * <en/> Filter-text formatting (pure functions). Formats a ColumnFilterValue into human-readable text for floating-filter readonly display; i18n copy changes stay in this file, never in the state machine.
 */
import type {
  ColumnFilterValue,
  GroupFilterValue,
} from '../types/filter'
import { tf } from './locale-fallback'

/** <zh/> 文本操作符 → i18n 键映射 | <en/> Text operator → i18n key mapping */
const TEXT_OP_I18N_KEYS: Record<string, string> = {
  contains: 'table.filter.contains',
  notContains: 'table.filter.notContains',
  equals: 'table.filter.equals',
  notEquals: 'table.filter.notEquals',
  beginsWith: 'table.filter.beginsWith',
  endsWith: 'table.filter.endsWith',
}

/** <zh/> 数字操作符 → i18n 键映射 | <en/> Number operator → i18n key mapping */
const NUM_OP_I18N_KEYS: Record<string, string> = {
  eq: 'table.filter.eq',
  neq: 'table.filter.neq',
  gt: 'table.filter.gt',
  gte: 'table.filter.gte',
  lt: 'table.filter.lt',
  lte: 'table.filter.lte',
  between: 'table.filter.between',
  blank: 'table.filter.blank',
  notBlank: 'table.filter.notBlank',
}

/** <zh/> 文本操作符英文回退标签（t 未注入或翻译缺失时回退英文，） | <en/> Text operator English fallback labels (used when t is not provided or translation missing) */
const TEXT_OP_FALLBACK: Record<string, string> = {
  contains: 'Contains',
  notContains: 'Does not contain',
  equals: 'Equals',
  notEquals: 'Not equals',
  beginsWith: 'Begins with',
  endsWith: 'Ends with',
}

/** <zh/> 数字操作符英文回退标签 | <en/> Number operator English fallback labels */
const NUM_OP_FALLBACK: Record<string, string> = {
  eq: 'Equals',
  neq: 'Not equals',
  gt: 'Greater than',
  gte: 'Greater than or equal',
  lt: 'Less than',
  lte: 'Less than or equal',
  between: 'Between',
  blank: 'Is blank',
  notBlank: 'Is not blank',
}

/**
 * <zh/> 解析操作符标签——优先使用 t 翻译，回退到英文常量
 * <en/> Resolve operator label — uses t translation first, falls back to the English constant
 */
function resolveOpLabel(
  op: string,
  i18nKeys: Record<string, string>,
  fallbacks: Record<string, string>,
  t?: (key: string) => string,
): string {
  const i18nKey = i18nKeys[op]
  if (i18nKey && t) {
    const translated = t(i18nKey)
    // t may return the key itself when missing — treat as untranslated and fall back to English
    if (translated && translated !== i18nKey)
      return translated
  }
  return fallbacks[op] ?? op
}

/** <zh/> 格式化单个文本条件 | <en/> Format a single text condition */
function fmtText(op: string, value: string | undefined, t?: (key: string) => string): string {
  if (!value)
    return ''
  return `${resolveOpLabel(op, TEXT_OP_I18N_KEYS, TEXT_OP_FALLBACK, t)} ${value}`
}

/** <zh/> 格式化单个数字条件 | <en/> Format a single number condition */
function fmtNumber(op: string, value: number | undefined, min: number | undefined, max: number | undefined, t?: (key: string) => string): string {
  const label = resolveOpLabel(op, NUM_OP_I18N_KEYS, NUM_OP_FALLBACK, t)
  if (op === 'blank')
    return label
  if (op === 'notBlank')
    return label
  if (op === 'between') {
    if (min == null && max == null)
      return ''
    return `${min ?? '?'} ~ ${max ?? '?'}`
  }
  if (value == null)
    return ''
  return `${label} ${value}`
}

/**
 * <zh/> 筛选文案格式化注册表——新增筛选类型只需在此登记 formatter，无需改分发链。
 * <en/> Filter-text formatter registry — new filter types only register here.
 */
export type FilterTextFormatter = (
  filterValue: ColumnFilterValue,
  ctx: { enumOptions?: { label: string, value: string | number }[], t?: (key: string) => string, andLabel: string, orLabel: string, recurse: typeof formatFilterCondition },
) => string

function formatTextFilter(filterValue: ColumnFilterValue, ctx: { t?: (key: string) => string, andLabel: string, orLabel: string }): string {
  const v = filterValue as Extract<ColumnFilterValue, { type: 'text' }>
  const primary = fmtText(v.operator, v.value, ctx.t)
  if (v.conditions?.condition) {
    const logic = v.conditions.logic === 'and' ? ` ${ctx.andLabel} ` : ` ${ctx.orLabel} `
    const secondary = fmtText(v.conditions.condition.operator, v.conditions.condition.value, ctx.t)
    if (primary && secondary)
      return `${primary}${logic}${secondary}`
    return primary || secondary
  }
  return primary
}

function formatNumberFilter(filterValue: ColumnFilterValue, ctx: { t?: (key: string) => string, andLabel: string, orLabel: string }): string {
  const v = filterValue as Extract<ColumnFilterValue, { type: 'number' }>
  const primary = fmtNumber(v.operator, v.value, v.min, v.max, ctx.t)
  if (v.conditions?.condition) {
    const c = v.conditions.condition
    const logic = v.conditions.logic === 'and' ? ` ${ctx.andLabel} ` : ` ${ctx.orLabel} `
    const secondary = fmtNumber(c.operator, c.value, c.min, c.max, ctx.t)
    if (primary && secondary)
      return `${primary}${logic}${secondary}`
    return primary || secondary
  }
  return primary
}

function formatDateFilter(filterValue: ColumnFilterValue, ctx: { t?: (key: string) => string }): string {
  const v = filterValue as Extract<ColumnFilterValue, { type: 'date' }>
  const beforeLabel = tf(ctx.t, 'table.filter.before', '早于')
  const afterLabel = tf(ctx.t, 'table.filter.after', '晚于')
  if (v.operator === 'between') {
    if (!v.startDate && !v.endDate)
      return ''
    return `${v.startDate ?? '?'} ~ ${v.endDate ?? '?'}`
  }
  if (v.operator === 'before')
    return v.value ? `${beforeLabel} ${v.value}` : ''
  if (v.operator === 'after')
    return v.value ? `${afterLabel} ${v.value}` : ''
  return v.value ?? ''
}

function formatEnumFilter(filterValue: ColumnFilterValue, ctx: { enumOptions?: { label: string, value: string | number }[] }): string {
  const v = filterValue as Extract<ColumnFilterValue, { type: 'enum' }>
  if (!v.selected?.length)
    return ''
  if (ctx.enumOptions?.length)
    return v.selected.map(s => ctx.enumOptions!.find(o => o.value === s)?.label ?? String(s)).join(', ')
  return v.selected.join(', ')
}

function formatGroupFilter(filterValue: ColumnFilterValue, ctx: { enumOptions?: { label: string, value: string | number }[], t?: (key: string) => string, andLabel: string, orLabel: string, recurse: typeof formatFilterCondition }): string {
  const group = filterValue as GroupFilterValue
  if (!group.conditions?.length)
    return ''
  const logic = group.logic === 'and' ? ctx.andLabel : ctx.orLabel
  const parts = group.conditions.map(c => ctx.recurse(c, ctx.enumOptions, ctx.t)).filter(Boolean)
  if (parts.length === 0)
    return ''
  if (parts.length === 1)
    return parts[0]!
  return `(${parts.join(` ${logic} `)})`
}

const FILTER_TEXT_FORMATTERS: Record<string, FilterTextFormatter> = {
  text: formatTextFilter as FilterTextFormatter,
  number: formatNumberFilter as FilterTextFormatter,
  date: formatDateFilter as FilterTextFormatter,
  enum: formatEnumFilter as FilterTextFormatter,
  group: formatGroupFilter as FilterTextFormatter,
}

/** 注册自定义筛选文案 formatter（与 filter-registry 策略层解耦，仅管可读文案） */
export function registerFilterTextFormatter(type: string, formatter: FilterTextFormatter): void {
  FILTER_TEXT_FORMATTERS[type] = formatter
}

/**
 * <zh/> 将筛选条件格式化为可读文案——按条件类型分发到已注册的 formatter，嵌套条件组递归拼接（且/或）。
 * <en/> Format a filter condition into human-readable text — dispatches by condition type to registered
 * <en/> formatters and recursively joins nested groups with AND/OR labels.
 *
 * @param filterValue - <zh/> 待格式化的筛选条件值 | <en/> Filter condition value to format
 * @param enumOptions - <zh/> 枚举选项列表（用于回显枚举项标签） | <en/> Enum options (for enum item labels)
 * @param t - <zh/> i18n 翻译函数（拼接连接词文案） | <en/> i18n translation function (for connector labels)
 * @returns <zh/> 格式化后的筛选条件文案，无匹配 formatter 时为空串 | <en/> Formatted filter text; empty string when no formatter matches
 */
export function formatFilterCondition(
  filterValue: ColumnFilterValue | undefined,
  enumOptions?: { label: string, value: string | number }[],
  t?: (key: string) => string,
): string {
  if (!filterValue)
    return ''

  const andLabel = tf(t, 'table.filter.and', '且')
  const orLabel = tf(t, 'table.filter.or', '或')
  const formatter = FILTER_TEXT_FORMATTERS[filterValue.type]
  if (!formatter)
    return ''
  return formatter(filterValue, { enumOptions, t, andLabel, orLabel, recurse: formatFilterCondition })
}
