/**
 * <zh/> 搜索状态子 composable | <en/> Search state sub-composable
 *
 * <zh/> 从 useAdvTableCore 拆分，管理 searchParams 与 quickFilter 防抖文本。
 * <en/> Extracted from useAdvTableCore, manages searchParams and quickFilter debounced text.
 */
import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
import { shallowRef } from 'vue'
import { useQuickFilterDebounce } from '../data/use-quick-filter-debounce'

export interface UseTableSearchStateReturn {
  searchParams: ShallowRef<Record<string, unknown>>
  quickFilterText: Ref<string | undefined>
}

/**
 * @param quickFilterModel - <zh/> 快速筛选 v-model ref | <en/> Quick filter v-model ref
 * @param debounceDelay - <zh/> 防抖延迟毫秒数（来自 filterConfig.quickFilterDebounce），默认 300；
 * <zh/> 支持 ref/getter——运行时调整防抖延迟即时生效，无需重建表格实例
 * <en/> debounce delay in ms (from filterConfig.quickFilterDebounce), default 300;
 * <en/> accepts ref/getter — runtime debounce changes take effect without recreating the table instance
 */
export function useTableSearchState(
  quickFilterModel: Ref<string | undefined>,
  debounceDelay: MaybeRefOrGetter<number> = 300,
): UseTableSearchStateReturn {
  const searchParams = shallowRef<Record<string, unknown>>({})
  const quickFilterText = useQuickFilterDebounce(quickFilterModel, debounceDelay)
  return { searchParams, quickFilterText }
}
