import type { Ref } from 'vue'
import dayjs from 'dayjs'
/**
 * <zh/> dayjs 本地化 Composable
 * <en/> dayjs localization composable
 * @remarks
 * <zh/> 监听 Element Plus 语言变化，自动计算 dayjs 语言名。随组件生命周期自动清理 watcher。扩展语言映射：调用 registerDayjsLocaleMap 注册额外的映射关系
 * <en/> Listens to Element Plus language changes, automatically resolves dayjs locale name. Cleans up watcher with component lifecycle. Extended language mappings: call registerDayjsLocaleMap to register additional mappings
 */
import customParseFormat from 'dayjs/plugin/customParseFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useGlobalConfig } from 'element-plus'
import { computed } from 'vue'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'

/**
 * <zh/> Element Plus 语言到 dayjs 语言的映射表
 * <en/> Element Plus to dayjs locale mapping table
 * @remarks
 * <zh/> 默认只包含中英文，可通过 registerDayjsLocaleMap 扩展
 * <en/> Default only includes Chinese and English, can be extended via registerDayjsLocaleMap
 */
const LOCALE_MAP: Record<string, string> = {
  'zh-cn': 'zh-cn',
  'zh-hans': 'zh-cn',
  'en': 'en',
  'en-us': 'en',
}

/**
 * 注册额外的 Element Plus → dayjs 语言映射
 * Register additional Element Plus to dayjs locale mappings
 *
 * @param map - 语言映射表，key 为 Element Plus 语言名，value 为 dayjs 语言名
 * @example
 * ```ts
 * import { registerDayjsLocaleMap } from 'advanced-elements/table'
 * import 'dayjs/locale/ja'
 * import 'dayjs/locale/ko'
 *
 * registerDayjsLocaleMap({
 *   'ja': 'ja',
 *   'ja-jp': 'ja',
 *   'ko': 'ko',
 *   'ko-kr': 'ko',
 * })
 * ```
 */
export function registerDayjsLocaleMap(map: Record<string, string>) {
  Object.assign(LOCALE_MAP, map)
}

dayjs.extend(customParseFormat)
dayjs.extend(relativeTime)

/**
 * <zh/> 根据 Element Plus locale 计算 dayjs 语言名
 * <zh/> 映射不到时返回 'zh-cn' 作为默认值
 * <en/> Calculate dayjs locale name from Element Plus locale
 * <en/> Returns 'zh-cn' as default when mapping fails
 */
function resolveDayjsLocaleName(elLocale: string | undefined): string {
  if (!elLocale)
    return 'zh-cn'
  return LOCALE_MAP[elLocale.toLowerCase()] ?? 'zh-cn'
}

/**
 * <zh/> 同步 dayjs 本地化设置
 * <zh/> 在组件 setup 中调用，watcher 随组件卸载自动清理
 * <zh/> 返回 dayjsLocaleName ref，消费方应使用 dayjs(...).locale(dayjsLocaleName.value)
 * <zh/> 而非全局 dayjs.locale，避免 SSR 跨请求污染
 * <en/> Sync dayjs locale settings
 * <en/> Called in component setup, watcher auto-cleans on unmount
 * <en/> Returns dayjsLocaleName ref, consumers should use dayjs(...).locale(dayjsLocaleName.value)
 * <en/> instead of global dayjs.locale to avoid SSR cross-request pollution
 */
export function useDayjsLocale(): { dayjsLocaleName: Ref<string> } {
  const elConfig = useGlobalConfig()

  const dayjsLocaleName = computed(() =>
    resolveDayjsLocaleName(elConfig.value?.locale?.name as unknown as string),
  )

  return { dayjsLocaleName }
}
