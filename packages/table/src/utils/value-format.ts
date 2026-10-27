import type { CurrencyConfig, TableContext } from '../types/config'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

/**
 * <zh/> relativeTime 插件懒初始化——仅 fromNow 路径需要，不用相对时间的格式化零初始化开销
 * <en/> Lazy relativeTime plugin setup — only the fromNow path needs it, other formatters pay zero init cost
 */
let relativeTimeExtended = false
function ensureRelativeTime(): void {
  if (!relativeTimeExtended) {
    dayjs.extend(relativeTime)
    relativeTimeExtended = true
  }
}

/** <zh/> 默认货币配置：人民币符号 + 中文区域 | <en/> Default currency config: RMB symbol + Chinese locale */
export const DEFAULT_CURRENCY: CurrencyConfig = { symbol: '¥', locale: 'zh-CN' }

/**
 * <zh/> 获取当前表格上下文的货币配置，未设置时返回默认值 ¥ / zh-CN。
 * <en/> Get the currency config for the current table context, returning the default ¥ / zh-CN when unset.
 *
 * @param ctx - <zh/> 表格上下文（可选） | <en/> table context (optional)
 * @returns <zh/> 货币配置对象 { symbol, locale } | <en/> currency config object { symbol, locale }
 */
export function getCurrency(ctx?: TableContext | null): CurrencyConfig {
  return ctx?.currency?.value ?? DEFAULT_CURRENCY
}

/**
 * <zh/> 获取 dayjs 国际化 locale 名称，默认 'zh-cn'。
 * <en/> Get the dayjs internationalization locale name, defaulting to 'zh-cn'.
 *
 * @param ctx - <zh/> 表格上下文（可选） | <en/> table context (optional)
 * @returns <zh/> locale 字符串，如 'zh-cn'、'en' | <en/> locale string, e.g. 'zh-cn', 'en'
 */
export function getDayjsLocale(ctx?: TableContext | null): string {
  return ctx?.dayjsLocale?.value ?? 'zh-cn'
}

/** <zh/> valueType → dayjs 格式字符串映射 | <en/> valueType → dayjs format string map */
export const DAYJS_FORMAT_MAP: Record<string, string> = {
  date: 'YYYY-MM-DD',
  dateTime: 'YYYY-MM-DD HH:mm:ss',
  time: 'HH:mm:ss',
  dateRange: 'YYYY-MM-DD',
  dateTimeRange: 'YYYY-MM-DD HH:mm:ss',
  monthRange: 'YYYY-MM',
  year: 'YYYY',
  yearRange: 'YYYY',
}

const RANGE_VALUE_TYPES = new Set(['dateRange', 'dateTimeRange', 'monthRange', 'yearRange'])

/**
 * <zh/> 格式化日期值，支持范围类型 "start ~ end"。
 * <en/> Format a date value, supporting range types as "start ~ end".
 *
 * @example
 * formatDate('2024-01-01', 'date'); // => '2024-01-01'
 * formatDate(['2024-01-01', '2024-12-31'], 'dateRange'); // => '2024-01-01 ~ 2024-12-31'
 */
export function formatDate(value: unknown, valueType: string, ctx?: TableContext | null): string {
  if (!value)
    return ''
  const format = DAYJS_FORMAT_MAP[valueType] || 'YYYY-MM-DD HH:mm:ss'

  if (RANGE_VALUE_TYPES.has(valueType)) {
    if (!Array.isArray(value))
      return String(value)
    // <zh/> locale 与格值无关，每格解析一次| <en/> Locale is value-independent; resolve once per cell (was once per endpoint)
    const localeName = getDayjsLocale(ctx)
    const [start, end] = value
    const dStart = dayjs(start as string | number | Date).locale(localeName)
    const dEnd = dayjs(end as string | number | Date).locale(localeName)
    if (!dStart.isValid() || !dEnd.isValid())
      return String(value)
    return `${dStart.format(format)} ~ ${dEnd.format(format)}`
  }

  const dayjsInstance = dayjs(value as string | number | Date).locale(getDayjsLocale(ctx))
  if (!dayjsInstance.isValid())
    return String(value)
  return dayjsInstance.format(format)
}

/**
 * <zh/> Intl.NumberFormat 实例缓存——按 locale+options 键复用实例。
 * <zh/> toLocaleString 每格调用都会新建 Intl.NumberFormat（构造昂贵），虚拟滚动每帧重绘
 * <zh/> 数十个 money/digit 格时累积为可观长任务；locale/options 组合极少，Map 无淘汰即可。
 * <en/> Intl.NumberFormat instance cache — reuses instances per locale+options key.
 * <en/> toLocaleString constructs a fresh Intl.NumberFormat per cell (expensive to build); with
 * <en/> dozens of money/digit cells re-rendered per virtual-scroll frame it accumulates into
 * <en/> visible long tasks. Locale/options combinations are few, so an unbounded Map suffices.
 */
const numberFormatCache = new Map<string, Intl.NumberFormat>()

function getNumberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = options ? `${locale}|${JSON.stringify(options)}` : locale
  let formatter = numberFormatCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options)
    numberFormatCache.set(key, formatter)
  }
  return formatter
}

/** <zh/> 货币小数的固定格式选项（模块级常量，键稳定且避免每格重建对象字面量） | <en/> Fixed fraction options for money (module-level constant — stable cache key, no per-cell literal) */
const MONEY_FRACTION_OPTIONS: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

/**
 * <zh/> 格式化货币值，保留两位小数，使用上下文中指定的货币符号与 locale。
 * <en/> Format a monetary value with two decimal places, using the currency symbol and locale from context.
 *
 * @example
 * formatMoney(1234.5); // => '¥1,234.50'
 * formatMoney(null);   // => ''
 *
 * @param value - <zh/> 原始数值 | <en/> raw numeric value
 * @param ctx - <zh/> 表格上下文（可选） | <en/> table context (optional)
 * @returns <zh/> 格式化后的货币字符串 | <en/> formatted currency string
 */
export function formatMoney(value: unknown, ctx?: TableContext | null): string {
  if (value == null)
    return ''
  const num = Number(value)
  if (Number.isNaN(num))
    return String(value)
  const currency = getCurrency(ctx)
  return `${currency.symbol}${getNumberFormat(currency.locale, MONEY_FRACTION_OPTIONS).format(num)}`
}

/**
 * <zh/> 格式化百分比值，原样拼接 '%' 后缀。
 * <en/> Format a percentage value by appending a '%' suffix as-is.
 *
 * @example
 * formatPercent(0.25);  // => '0.25%'
 * formatPercent(null); // => ''
 *
 * @param value - <zh/> 百分比数值（如 0.25 表示 25%） | <en/> percentage value (e.g. 0.25 means 25%)
 * @returns <zh/> 格式化后的百分比字符串 | <en/> formatted percentage string
 */
export function formatPercent(value: unknown): string {
  if (value == null)
    return ''
  const num = Number(value)
  if (Number.isNaN(num))
    return String(value)
  return `${num}%`
}

/**
 * <zh/> 格式化数字为千分位分隔字符串。
 * <en/> Format a number as a thousands-separated string.
 *
 * @example
 * formatDigit(1234567);   // => '1,234,567'
 * formatDigit(1234567.89) // => '1,234,567.89'
 *
 * @param value - <zh/> 原始数值 | <en/> raw numeric value
 * @param ctx - <zh/> 表格上下文（可选，用于获取 locale） | <en/> table context (optional, used to get the locale)
 * @returns <zh/> 千分位格式化后的字符串 | <en/> thousands-formatted string
 */
export function formatDigit(value: unknown, ctx?: TableContext | null): string {
  if (value == null)
    return ''
  const num = Number(value)
  if (Number.isNaN(num))
    return String(value)
  const currency = getCurrency(ctx)
  return getNumberFormat(currency.locale).format(num)
}

/**
 * <zh/> 将日期值格式化为相对时间文本（如 "5 个月前"）
 * <en/> Format a date value as relative time text (e.g. "5 months ago")
 *
 * @param value - <zh/> 日期值（可被 dayjs 解析的任意形式） | <en/> date value in any dayjs-parseable form
 * @param ctx - <zh/> 表格上下文，用于获取 dayjs 语言 | <en/> table context, used to resolve the dayjs locale
 * @returns <zh/> 相对时间文本，空值返回空串 | <en/> relative time text; empty string for falsy values
 *
 * @example
 * formatFromNow('2024-01-01'); // => '5 months ago'
 */
export function formatFromNow(value: unknown, ctx?: TableContext | null): string {
  if (!value)
    return ''
  // <zh/> 首次调用时注册插件，后续复用
  // <en/> Register the plugin on first call, reused afterwards
  ensureRelativeTime()
  const dayjsInstance = dayjs(value as string | number | Date).locale(getDayjsLocale(ctx))
  if (!dayjsInstance.isValid())
    return String(value)
  return dayjsInstance.fromNow()
}

/**
 * <zh/> 统一的 valueType → 文本格式化调度表，value-renderer.ts 与 resolve-cell-text.ts 共享，避免规则漂移。
 * <en/> Unified valueType → text-format dispatcher shared by value-renderer.ts and resolve-cell-text.ts to avoid rule drift.
 */
export const VALUE_TYPE_TEXT_FORMATTERS: Record<string, (value: unknown, ctx?: TableContext | null) => string> = {
  money: (v, ctx) => formatMoney(v, ctx),
  digit: (v, ctx) => formatDigit(v, ctx),
  percent: v => formatPercent(v),
  date: (v, ctx) => formatDate(v, 'date', ctx),
  dateTime: (v, ctx) => formatDate(v, 'dateTime', ctx),
  time: (v, ctx) => formatDate(v, 'time', ctx),
  dateRange: (v, ctx) => formatDate(v, 'dateRange', ctx),
  dateTimeRange: (v, ctx) => formatDate(v, 'dateTimeRange', ctx),
  monthRange: (v, ctx) => formatDate(v, 'monthRange', ctx),
  year: (v, ctx) => formatDate(v, 'year', ctx),
  yearRange: (v, ctx) => formatDate(v, 'yearRange', ctx),
  fromNow: (v, ctx) => formatFromNow(v, ctx),
}
