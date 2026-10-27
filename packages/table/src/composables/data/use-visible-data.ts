import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

export interface UseVisibleDataOptions<T = any> {
  finalDisplayData: MaybeRefOrGetter<T[]>
  isClientPagination: MaybeRefOrGetter<boolean>
  currentPage: MaybeRefOrGetter<number>
  pageSize: MaybeRefOrGetter<number>
}

export interface UseVisibleDataReturn<T = any> {
  visibleData: ComputedRef<T[]>
}

/**
 * <zh/> 可见数据 composable — 客户端分页模式下，从全量数据中截取当前页的可见行。
 *
 * @param options - <zh/> 分页与数据配置 | <en/> pagination and data config
 * @returns <zh/> 可见数据响应式引用 | <en/> reactive reference to visible data
 */
export function useVisibleData<T = any>(options: UseVisibleDataOptions<T>): UseVisibleDataReturn<T> {
  const {
    finalDisplayData,
    isClientPagination,
    currentPage,
    pageSize,
  } = options

  const visibleData = computed<T[]>((prev) => {
    const data = toValue(finalDisplayData)
    if (!toValue(isClientPagination)) {
      if (prev && prev === data)
        return prev
      return data
    }

    // <zh/> Math.max(1, NaN) 恒为 NaN：显式归一化，非有限/小于1一律回退 1/第一页
    // <en/> Math.max(1, NaN) is NaN: normalize explicitly, non-finite values fall back safely
    const rawSize = toValue(pageSize)
    const rawPage = toValue(currentPage)
    const size = typeof rawSize === 'number' && Number.isFinite(rawSize) ? Math.max(1, Math.floor(rawSize)) : 1
    const page = typeof rawPage === 'number' && Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
    const start = (page - 1) * size
    const end = start + size

    if (start === 0 && end >= data.length) {
      if (prev && prev === data)
        return prev
      return data
    }

    // <zh/> 不做 prev 启发式短路：禁止仅比较 prev[0] === data[start]，
    // <zh/> 数据引用变化（如 applyTransaction 局部更新生成新数组）但页首行对象未变时
    // <zh/> 返回陈旧切片——第 2+ 页中间行更新不渲染，直到翻页。
    // <zh/> 上游 finalDisplayData 已有逐层 refStable/shallowArrayStable 保证同内容复用引用，
    // <zh/> 走到这里即数据真实变化，直接重切片（O(pageSize)，可忽略）。
    // <en/> No prev heuristic short-circuit: never compare only prev[0] === data[start];
    // <en/> a data reference change (e.g. a new array from an applyTransaction partial update)
    // <en/> with an unchanged first page row returns a stale slice — mid-page row updates on
    // <en/> page 2+ never re-render until page flip.
    // <en/> Upstream finalDisplayData layers already reuse references when content is unchanged
    // <en/> (refStable / shallowArrayStable), so reaching here means the data really changed;
    // <en/> re-slice directly (O(pageSize), negligible).
    return data.slice(start, end)
  })

  return { visibleData }
}
