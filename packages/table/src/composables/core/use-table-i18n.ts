/**
 * <zh/> 表格国际化子 composable | <en/> Table i18n sub-composable
 *
 * <zh/> 从 useAdvTableCore 拆分，收敛 locale/dayjs 初始化。
 * <en/> Extracted from useAdvTableCore, consolidates locale/dayjs initialization.
 */
import { useAdvLocale } from '../../locale'
import { useDayjsLocale } from '../locale/use-dayjs-locale'

export interface UseTableI18nReturn {
  t: ReturnType<typeof useAdvLocale>['t']
  locale: ReturnType<typeof useAdvLocale>['locale']
  dayjsLocaleName: ReturnType<typeof useDayjsLocale>['dayjsLocaleName']
}

export function useTableI18n(): UseTableI18nReturn {
  const { t, locale } = useAdvLocale()
  const { dayjsLocaleName } = useDayjsLocale()
  return { t, locale, dayjsLocaleName }
}
