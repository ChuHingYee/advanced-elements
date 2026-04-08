/**
 * <zh/> virtual 渲染器的渲染数据域行索引
 * <en/> Virtual-renderer render-data-domain row index
 *
 * @remarks
 * <zh/> 职责单一：把「行键 → rowIndex」的解析收敛到**渲染数据域**，并给出超大数据量下的降级路径。
 * <zh/> 为什么不用 `rowKeyMeta.keyToIndex`（全量 tableData 域）：客户端分页 / 树形折叠时全量索引与
 * <zh/> 渲染索引分叉——第 2 页起 keyToIndex 返回 10-19 而 `data.length` 为 10，越界守卫会静默丢弃事件。
 * <zh/> 降级：行数超过 `ROW_KEY_FALLBACK_LIMIT` 时不再做 O(n) 全量构建，改由 `rowsRendered` 事件
 * <zh/> 增量构建**渲染窗口局部** Map（含预渲染缓存行），保证可见/缓存窗口内的行仍可定位。
 * <en/> Single responsibility: converge "row key → rowIndex" resolution on the **render data domain**,
 * <en/> plus the degradation path for huge datasets.
 * <en/> Why not `rowKeyMeta.keyToIndex` (full tableData domain): under client pagination / collapsed
 * <en/> trees the full-data index diverges from the render index — from page 2 on, keyToIndex returns
 * <en/> 10-19 while `data.length` is 10, so the out-of-bounds guard silently drops events.
 * <en/> Degradation: above `ROW_KEY_FALLBACK_LIMIT` rows the O(n) full build is skipped in favour of a
 * <en/> **window-local** Map built incrementally from the `rowsRendered` event (pre-render cache rows
 * <en/> included), keeping rows inside the visible/cache window locatable.
 */
import type { ComputedRef } from 'vue'
import { computed, shallowRef, watch } from 'vue'
import { ROW_KEY_FALLBACK_LIMIT } from '../../composables/rendering/use-row-key-meta-resolver'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { mapsShallowEqual } from '../../utils/equality'

/** <zh/> 行索引域依赖 | <en/> Row-index domain deps */
export interface UseV2RowIndexDeps<T = any> {
  /** <zh/> 渲染数据（页内可见数据） | <en/> render data (page-local visible data) */
  data: () => readonly T[]
  /** <zh/> 行键函数 | <en/> row key function */
  rowKeyFn: () => (row: T) => string
}

/** <zh/> 行索引域返回 | <en/> Row-index domain return */
export interface UseV2RowIndexReturn {
  /** <zh/> 渲染数据域 key → rowIndex（超阈值时退化为渲染窗口局部 Map） | <en/> render-data-domain key → rowIndex (degrades to a window-local Map beyond the threshold) */
  virtualKeyToIndex: ComputedRef<Map<string, number>>
  /**
   * <zh/> 由 `rowsRendered` 增量构建渲染窗口局部索引（O(窗口) 而非 O(n)）
   * <en/> Incrementally build the window-local index from `rowsRendered` (O(window) instead of O(n))
   */
  buildWindowIndex: (rowCacheStart: number, rowCacheEnd: number) => void
}

/**
 * <zh/> 创建渲染数据域行索引
 * <en/> Create the render-data-domain row index
 */
export function useV2RowIndex<T = any>(deps: UseV2RowIndexDeps<T>): UseV2RowIndexReturn {
  const { data, rowKeyFn } = deps

  /**
   * <zh/> 超大数据量时的渲染窗口局部索引——由 rowsRendered 事件驱动增量构建，
   * <zh/> 在跳过全量 O(n) 构建的前提下仍能对可见/缓存窗口内的行解析 rowIndex。
   * <en/> Window-local render-domain index for huge datasets — built incrementally by the
   * <en/> rowsRendered event, resolving rowIndex for rows inside the visible/cache window
   * <en/> even though the full O(n) build is skipped.
   */
  const windowKeyToIndex = shallowRef<Map<string, number>>(new Map())

  const virtualKeyToIndex = computed<Map<string, number>>((prev) => {
    const rows = data()
    const rk = rowKeyFn()
    // <zh/> 超大数据量下跳过 O(n) 全量构建，降级为渲染窗口局部 Map（见 buildWindowIndex）。
    // <zh/> 不在超阈值时静默失效：可见/缓存窗口内的行仍可定位，且 dev 下输出降级告警（见下方 watch）。
    // <en/> Skip the O(n) full build on huge datasets and degrade to a window-local Map (see buildWindowIndex).
    // <en/> Not silently broken beyond threshold: rows inside the visible/cache window remain locatable,
    // <en/> and a degradation warning is emitted in dev (see the watch below).
    if (rows.length > ROW_KEY_FALLBACK_LIMIT)
      return windowKeyToIndex.value
    const map = new Map<string, number>()
    for (let i = 0; i < rows.length; i++) {
      map.set(rk(rows[i]), i)
    }
    if (prev && mapsShallowEqual(prev, map))
      return prev
    return map
  })

  // <zh/> 超阈值降级告警以 watch 承载而非 computed 内副作用：超阈值期间 windowKeyToIndex 随
  // <zh/> rowsRendered 每次滚动都会更新并触发 computed 重算，computed 内告警会重复刷屏；
  // <zh/> 数据降回阈值内时重置去重标志，再次超限会重新告警。
  // <en/> The degradation warning lives in a watch instead of a computed side effect: while degraded,
  // <en/> windowKeyToIndex updates on every scroll-driven rowsRendered, re-running the computed and
  // <en/> flooding the console; the dedup flag resets when data drops back below the threshold.
  let rowIndexDegradationWarned = false
  watch(
    () => data().length > ROW_KEY_FALLBACK_LIMIT,
    (degraded) => {
      if (!degraded) {
        rowIndexDegradationWarned = false
        return
      }
      if (isDev && !rowIndexDegradationWarned && typeof console !== 'undefined') {
        rowIndexDegradationWarned = true
        devWarn(
          `[AdvTable] Row key index skipped: ${data().length} rows exceed limit (${ROW_KEY_FALLBACK_LIMIT}).`
          + ' Cell event rowIndex and scrollToRow(key) resolve only rows inside the rendered window;'
          + ' provide rowKeyMeta or enable pagination for full coverage.',
        )
      }
    },
    { immediate: true },
  )

  function buildWindowIndex(rowCacheStart: number, rowCacheEnd: number): void {
    const rows = data()
    if (rows.length <= ROW_KEY_FALLBACK_LIMIT)
      return
    const rk = rowKeyFn()
    const map = new Map<string, number>()
    const start = Math.max(0, rowCacheStart)
    const end = Math.min(rows.length, rowCacheEnd + 1)
    for (let i = start; i < end; i++)
      map.set(rk(rows[i] as T), i)
    windowKeyToIndex.value = map
  }

  return { virtualKeyToIndex, buildWindowIndex }
}
