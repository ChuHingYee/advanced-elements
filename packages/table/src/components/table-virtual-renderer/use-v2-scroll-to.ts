/**
 * <zh/> virtual 渲染器的滚动定位 API
 * <en/> Virtual-renderer scroll-positioning APIs
 *
 * @remarks
 * <zh/> 公共 `tableApi.scrollToRow/scrollToColumn` 的虚拟模式实现：
 * <zh/> - `scrollToRow`：键经**渲染数据域** `virtualKeyToIndex` 解析为索引后委托 EP；
 * <zh/>   virtual 模式的 `behavior` 不受支持（EP scrollToRow 无该参数），非 'auto' 时告警后忽略。
 * <zh/> - `scrollToColumn`：按最终渲染列序累计前置宽度得到 scrollLeft（前缀和 O(1) 查表）；
 * <zh/>   固定列恒可见，直接返回 true。
 * <en/> Virtual-mode implementations behind the public `tableApi.scrollToRow/scrollToColumn`:
 * <en/> - `scrollToRow`: resolves the key through the **render-data-domain** `virtualKeyToIndex`, then
 * <en/>   delegates to EP; virtual mode supports no `behavior` (EP's scrollToRow has no such option),
 * <en/>   so a non-'auto' value is warned about and ignored.
 * <en/> - `scrollToColumn`: accumulates preceding widths over the final rendered column order
 * <en/>   (O(1) prefix-sum lookup); fixed columns are always visible and return true immediately.
 */
import type { ComputedRef, Ref } from 'vue'
import type { ScrollTarget, ScrollToRowOptions } from '../../utils/table-drag'
import type { UseV2ScrollApiReturn } from './use-v2-scroll-api'
import { devWarn } from '../../utils/dev-warn'

/** <zh/> 滚动定位依赖 | <en/> Scroll-positioning deps */
export interface UseV2ScrollToDeps<T = any> {
  /** <zh/> 渲染数据域 key → 索引 | <en/> render-data-domain key → index */
  virtualKeyToIndex: ComputedRef<Map<string, number>>
  /** <zh/> 含 append/Grand 合成行的渲染数据 | <en/> render data including append/grand synthetic rows */
  dataWithAppend: ComputedRef<T[]>
  /** <zh/> 最终 V2 列数组 | <en/> final V2 column array */
  v2Columns: ComputedRef<Array<{ width?: unknown, fixed?: unknown }>>
  /** <zh/> 列偏移前缀和缓存 | <en/> column offset prefix-sum cache */
  v2ColumnOffsetCache: ComputedRef<{ offsets: number[], keyToIndex: Map<string, number> }>
  /** <zh/> 当前纵向滚动位置 | <en/> current vertical scroll position */
  currentScrollTop: Ref<number>
  /** <zh/> V2 程序化滚动探针 | <en/> V2 programmatic-scroll probe */
  v2ScrollApi: UseV2ScrollApiReturn
}

/**
 * <zh/> 创建滚动定位 API
 * <en/> Create the scroll-positioning APIs
 */
export function useV2ScrollTo<T = any>(deps: UseV2ScrollToDeps<T>) {
  const {
    virtualKeyToIndex,
    dataWithAppend,
    v2Columns,
    v2ColumnOffsetCache,
    currentScrollTop,
    v2ScrollApi,
  } = deps

  function resolveRowIndex(target: ScrollTarget): number {
    return virtualKeyToIndex.value.get(target) ?? -1
  }

  function scrollToRow(target: ScrollTarget, options?: ScrollToRowOptions): boolean {
    if (options?.behavior && options.behavior !== 'auto') {
      devWarn(
        `scrollToRow behavior "${options.behavior}" is ignored in virtual mode (ElTableV2 scrollToRow has no smooth/instant support).`,
      )
    }
    const index = resolveRowIndex(target)
    if (index < 0 || index >= dataWithAppend.value.length)
      return false
    return v2ScrollApi.scrollToRow(index, options?.align ?? 'auto')
  }

  function scrollToColumn(target: ScrollTarget): boolean {
    const cols = v2Columns.value
    const cache = v2ColumnOffsetCache.value
    const index = cache.keyToIndex.get(target) ?? -1
    // <zh/> 固定列（fixed 左/右分区）始终可见，无需水平滚动 | <en/> Fixed columns are always visible, no horizontal scrolling needed
    if (index >= 0 && cols[index]?.fixed)
      return true
    if (index < 0 || index >= cols.length)
      return false
    // <zh/> 前缀和 O(1) 查表替代逐列累加 | <en/> O(1) prefix-sum lookup instead of per-column accumulation
    const left = cache.offsets[index] ?? 0
    return v2ScrollApi.scrollTo({ scrollLeft: left, scrollTop: currentScrollTop.value })
  }

  return { scrollToRow, scrollToColumn }
}
