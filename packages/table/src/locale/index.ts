/**
 * <zh/> AdvTable 表格组件国际化（i18n）配置入口模块
 * <en/> AdvTable table component i18n configuration entry module
 *
 * @remarks
 * <zh/> 提供：
 * <zh/> - `useAdvLocale` — 组合式 API，获取当前 locale 对象和翻译函数 `t`
 * <zh/> - `resolvePath` — 点分隔路径取值工具函数
 * <zh/> - `advLocaleKey` — 自定义 locale 的注入 key
 * <en/> Provides:
 * <en/> - `useAdvLocale` — composable API to get current locale object and translate function `t`
 * <en/> - `resolvePath` — dot-separated path value resolver
 * <en/> - `advLocaleKey` — custom locale injection key
 *
 * <zh/> 语言优先级：
 * <zh/>   1. 通过 `advLocaleKey` 注入的自定义 locale
 * <zh/>   2. Element Plus 当前 locale 映射（zh-cn / en）
 * <zh/>   3. 默认中文（zh-cn）
 * <en/> Language priority:
 * <en/>   1. Custom locale injected via `advLocaleKey`
 * <en/>   2. Element Plus current locale mapping (zh-cn / en)
 * <en/>   3. Default Chinese (zh-cn)
 */

import type { AdvTableLocale } from './types'
import { useGlobalConfig } from 'element-plus'
import { computed, inject, ref } from 'vue'
import { advLocaleKey } from '../types/injection-keys'
import { en } from './lang/en'
import { zhCn } from './lang/zh-cn'

/** 模块级正则：参数占位符 {key} */
const PARAM_RE = /\{(\w+)\}/g

/**
 * 语言标识到国际化对象的映射表
 * 支持中英文及常见变体（zh-cn、zh-hans、en、en-us）
 */
const LANG_MAP: Record<string, AdvTableLocale> = {
  'zh-cn': zhCn,
  'zh-hans': zhCn,
  en,
  'en-us': en,
}

/**
 * 按点分隔路径解析嵌套属性值
 * 共享于 useAdvLocale 和 useRendererLocale
 * @param locale - 国际化对象
 * @param path - 点分隔的路径字符串
 * @returns 解析到的字符串值，未找到时回退英文，再未找到返回原 path
 * @example
 * resolvePath(en, 'table.query') // => 'Search'
 * resolvePath(zhCn, 'table.import.success', { count: '10' }) // => '导入成功，共 10 条'
 */
export function resolvePath(locale: AdvTableLocale, path: string, params?: Record<string, unknown>): string {
  const keys = path.split('.')
  let current: unknown = locale
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      current = undefined
      break
    }
    current = (current as Record<string, unknown>)[key]
  }
  // <zh/> 主 locale 缺键时回退英文——避免中文硬编码兜底导致国际化场景下仍显示中文
  // <en/> Fallback to English when the primary locale misses the key
  if (typeof current !== 'string') {
    let enCurrent: unknown = en
    for (const key of keys) {
      if (enCurrent == null || typeof enCurrent !== 'object') {
        enCurrent = undefined
        break
      }
      enCurrent = (enCurrent as Record<string, unknown>)[key]
    }
    if (typeof enCurrent === 'string') {
      current = enCurrent
    }
    else {
      return path
    }
  }

  // 参数替换：将 {key} 替换为 params[key]（模块级正则避免每次调用重新编译）
  if (params) {
    return (current as string).replace(PARAM_RE, (_: string, key: string) => {
      return params[key] !== undefined ? String(params[key]) : `{${key}}`
    })
  }
  return current as string
}

/**
 * 获取当前表格国际化实例 — 优先使用自定义 locale，其次从 Element Plus locale 推断
 *
 * 返回值：
 * - `locale` — 响应式的 AdvTableLocale 对象，根据优先级自动选择语言
 * - `t` — 翻译函数，通过点分隔路径（如 `'table.query'`）获取对应语言的文本
 *
 * 使用方式：
 * ```ts
 * const { locale, t } = useAdvLocale
 * t('table.query') // 根据当前语言返回 '查询' 或 'Search'
 * ```
 *
 * @returns `{ locale, t }` — locale 对象和翻译函数 t
 */
export function useAdvLocale() {
  // <zh/> locale 经 advLocaleKey 注入；组件树外回退 EP locale
  // <en/> Locale injected via advLocaleKey; outside the component tree fall back to the EP locale
  const customLocale = inject(advLocaleKey, ref<AdvTableLocale | undefined>())

  const epLocale = useGlobalConfig('locale')

  const locale = computed<AdvTableLocale>(() => {
    if (customLocale.value)
      return customLocale.value

    // <zh/> Element Plus locale 对象结构为 { name, el }，语言标识在 `.name` 字段
    // <en/> Element Plus locale object structure is { name, el }; the language identifier is on `.name`
    const epLang = (epLocale.value as { name?: string } | undefined)?.name
    // <zh/> 未知语言回退英文，历史默认中文导致英文环境下仍展示中文
    // <en/> Unknown languages fall back to English
    return LANG_MAP[epLang ?? 'en'] ?? en
  })

  const translate = (path: string, params?: Record<string, unknown>): string => resolvePath(locale.value, path, params)

  return { locale, t: translate }
}

/**
 * 内置语言包——文档示例与业务侧自定义 locale 的起点（`{ ...zhCn, table: { ... } }`）。
 * Built-in language packs — starting point for docs examples and consumer locale customization.
 */
export { en } from './lang/en'
export { zhCn } from './lang/zh-cn'
/**
 * 自定义 locale 的注入 key，由父组件通过 `provide(advLocaleKey, localeRef)` 注入
 * 参见 {@link ./context.ts}
 */
export { advLocaleKey }
/**
 * AdvTableLocale 类型定义 — 所有可翻译文本的接口
 * 参见 {@link ./types}
 */
export type { AdvTableLocale }
