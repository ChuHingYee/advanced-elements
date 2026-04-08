import type { ColSpanCellsConfig, ProcessedColumn, RowSpanCellsConfig, SpanInfo, SpanRange } from '../../types'
import type { SpanLimitInfo, UseCellSpanOptions, UseCellSpanReturn, UserSpanMethod } from './use-cell-span-types'
import { computed, getCurrentScope, onScopeDispose, shallowRef, toRaw, toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { idleSchedule } from '../../utils/raf'
import { resolveColumnProp } from '../../utils/shared'
import { buildSpanMap, estimateSpanOps, SPAN_CELL_LIMIT, SPAN_DEFER_BUDGET } from './use-cell-span-build'

export { estimateSpanOps, SPAN_DEFER_BUDGET } from './use-cell-span-build'
export { createMergedSpanMethod } from './use-cell-span-merged'
export type { MergedSpanMethodDeps } from './use-cell-span-merged'
// <zh/> 契约类型与公开纯函数自子模块 re-export，既有导入路径零变化 | <en/> Contract types and public pure helpers re-exported from sub-modules; existing import paths unchanged
export type { SpanLimitInfo, UseCellSpanOptions, UseCellSpanReturn, UserSpanMethod } from './use-cell-span-types'

/**
 * <zh/> 单元格合并 composable — 根据行合并、列合并和声明式区域配置生成 spanMap
 * <en/> Cell span composable — generates spanMap based on row merge, column merge, and declarative range config
 *
 * @param options - <zh/> 合并配置 | <en/> merge options
 * @returns spanMap 响应式引用与查询方法
 */
export function useCellSpan(options: UseCellSpanOptions): UseCellSpanReturn {
  const { data, columns, rowSpanCells, colSpanCells, ranges, userSpanMethod, onSpanLimitExceeded, deferThreshold } = options

  /**
   * <zh/> 构建完整 spanMap：先由 spanConfig（rowSpanCells/colSpanCells/ranges）生成基础映射，
   * <zh/> 再叠加用户函数式 spanMethod 的结果。函数式 spanMethod 按单元格优先（覆盖 spanConfig 条目）。
   * <en/> Build full spanMap: first generate base map from spanConfig (rowSpanCells/colSpanCells/ranges),
   * <en/> then overlay user function-style spanMethod results. Function-style spanMethod takes precedence per cell (overrides spanConfig entries).
   */
  function buildFullSpanMap(
    d: any[],
    c: ProcessedColumn[],
    rs: RowSpanCellsConfig | undefined,
    cs: ColSpanCellsConfig | undefined,
    r: SpanRange[] | undefined,
    uf: UserSpanMethod | undefined,
    onSpanLimitExceeded?: (info: SpanLimitInfo) => void,
  ): Map<string, SpanInfo> {
    const baseMap = buildSpanMap(d, c, rs, cs, r, onSpanLimitExceeded)
    if (!uf)
      return baseMap

    // 函数式 spanMethod 调用预算 = 行 × 列，受 SPAN_CELL_LIMIT 约束
    // Function-style spanMethod call budget = rows × cols, bounded by SPAN_CELL_LIMIT
    const estimatedOps = d.length * c.length
    if (estimatedOps >= SPAN_CELL_LIMIT) {
      if (isDev && typeof console !== 'undefined') {
        devWarn(
          `[AdvTable] Function-style spanMethod skipped: estimated ${estimatedOps} cell calls exceed limit (${SPAN_CELL_LIMIT}).`
          + ` Consider using spanConfig (declarative) or reducing data size for better performance.`,
        )
      }
      onSpanLimitExceeded?.({
        estimatedOps,
        limit: SPAN_CELL_LIMIT,
        source: 'functionStyle',
      })
      return baseMap
    }

    for (let rowIdx = 0; rowIdx < d.length; rowIdx++) {
      const row = d[rowIdx]
      for (let colIdx = 0; colIdx < c.length; colIdx++) {
        const col = c[colIdx]!
        const colProp = col.prop as string | undefined
        if (!colProp)
          continue
        const result = uf({ row, column: col, rowIndex: rowIdx, columnIndex: colIdx })
        if (result) {
          // <zh/> 用户函数返回值消毒——非有限/负数跨度会使 EP 渲染进入未定义行为，钳为合法值
          // <en/> Sanitize user-function output — non-finite/negative spans push EP rendering into undefined behavior, clamp to legal values
          const rowspan = Number.isFinite(result.rowspan) ? Math.max(0, result.rowspan) : 1
          const colspan = Number.isFinite(result.colspan) ? Math.max(0, result.colspan) : 1
          // 函数式 spanMethod 优先：覆盖 spanConfig 的条目
          // Function-style spanMethod takes precedence: override spanConfig entry
          baseMap.set(`${rowIdx}-${colProp}`, {
            rowspan,
            colspan,
            isOrigin: rowspan > 0 && colspan > 0,
          })
        }
        // result 为 undefined 时保留 spanConfig 条目（若有）| When result is undefined, keep spanConfig entry (if any)
      }
    }
    return baseMap
  }

  const spanMap = shallowRef<Map<string, SpanInfo>>(new Map())
  const spanPending = shallowRef(false)
  const isSpanPending = computed(() => spanPending.value)

  /**
   * 延迟建图调度——估算操作数超过 deferThreshold 时经 requestIdleCallback/setTimeout
   * 延迟执行，首帧先渲染无合并，完成后一次性提交，避免大数据阻塞首帧；
   * 小表与 SSR 恒走同步路径。
   * Deferred build scheduling — estimates beyond deferThreshold run idle-deferred with a
   * single swap on completion; small tables and SSR stay synchronous (history-identical).
   */
  let spanGeneration = 0
  let cancelScheduledSpan: (() => void) | null = null

  /**
   * <zh/> 行对象 → spanMap 行号映射——统一索引域的关键：ElTable 传入的 rowIndex 属于 composed 域
   * <zh/>（含 pin 条带/grand 合计行），spanMap 建在 unpinned 域；按行对象身份换算后两者对齐，
   * <zh/> 与 grand 插空、顶部固定行数无关。每次提交 spanMap 时同步重建（同数据源、同代际）。
   * <en/> Row-object → spanMap row-number map — the key to the unified index domain: ElTable passes
   * <en/> composed-domain indexes (incl. pinned strips/grand rows) while spanMap is built on the
   * <en/> unpinned domain; translating by row identity aligns them regardless of grand interleaving
   * <en/> or pinned counts. Rebuilt synchronously with every spanMap commit (same data, same generation).
   */
  let rowIndexMap: WeakMap<object, number> | null = null
  /** <zh/> rowIndexMap 的数据源引用——data 引用未变时复用映射（仅列/range 变化免 O(n) 重建） | <en/> Data source of rowIndexMap — reused while the data reference is unchanged (spares an O(n) rebuild when only columns/ranges change) */
  let rowIndexMapSource: any[] | null = null

  function buildRowIndexMap(d: any[]): WeakMap<object, number> {
    // <zh/> data 引用未变即行集合不变——复用原映射。行内字段变化不影响身份→索引关系。
    // <en/> An unchanged data reference means the row set is unchanged — reuse the map. In-place
    // <en/> field edits do not affect the identity→index relation.
    if (rowIndexMap && rowIndexMapSource === d)
      return rowIndexMap
    const map = new WeakMap<object, number>()
    for (let i = 0; i < d.length; i++) {
      const row = d[i]
      if (typeof row === 'object' && row !== null) {
        map.set(row, i)
        map.set(toRaw(row), i)
      }
    }
    rowIndexMapSource = d
    return map
  }

  function requestSpanBuild(
    d: any[],
    c: ProcessedColumn[],
    rs: RowSpanCellsConfig | undefined,
    cs: ColSpanCellsConfig | undefined,
    r: SpanRange[] | undefined,
    uf: UserSpanMethod | undefined,
  ): void {
    // 先作废被超车的任务（代际递增使其闭包失效）.
    // Invalidate the superseded task first (generation bump voids its closure).
    spanGeneration++
    cancelScheduledSpan?.()
    cancelScheduledSpan = null
    const threshold = toValue(deferThreshold) ?? SPAN_DEFER_BUDGET
    // 函数式叠加层按每格一次调用计入预算（与 buildFullSpanMap 的 uf 循环同口径）.
    // The function-style overlay counts one call per cell (same caliber as its loop).
    let ops = estimateSpanOps(d.length, c, rs, cs, r)
    if (uf)
      ops += d.length * c.length
    const gen = spanGeneration
    if (ops <= threshold || typeof window === 'undefined') {
      const next = buildFullSpanMap(d, c, rs, cs, r, uf, onSpanLimitExceeded)
      if (gen === spanGeneration) {
        rowIndexMap = buildRowIndexMap(d)
        spanMap.value = next
        spanPending.value = false
      }
      return
    }
    spanMap.value = new Map()
    rowIndexMap = null
    spanPending.value = true
    const task = () => {
      if (gen !== spanGeneration)
        return
      cancelScheduledSpan = null
      const next = buildFullSpanMap(d, c, rs, cs, r, uf, onSpanLimitExceeded)
      if (gen === spanGeneration) {
        rowIndexMap = buildRowIndexMap(d)
        spanMap.value = next
        spanPending.value = false
      }
    }
    // <zh/> 空闲调度经 utils/raf 唯一出口（与 use-async-summary 同源）| <en/> idle scheduling via the single utils/raf outlet (same source as use-async-summary)
    cancelScheduledSpan = idleSchedule(task, 100)
  }

  requestSpanBuild(
    toValue(data),
    toValue(columns),
    toValue(rowSpanCells),
    toValue(colSpanCells),
    toValue(ranges),
    toValue(userSpanMethod),
  )

  watch(
    () => [toValue(data), toValue(columns), toValue(rowSpanCells), toValue(colSpanCells), toValue(ranges), toValue(userSpanMethod)] as const,
    ([d, c, rs, cs, r, uf], prev) => {
      // 引用未变时跳过重建——上游 computed 透传相同引用时避免无谓的 buildSpanMap 开销
      // Skip rebuild when references unchanged — avoids unnecessary buildSpanMap overhead when upstream computed passes same refs
      if (prev && d === prev[0] && c === prev[1] && rs === prev[2] && cs === prev[3] && r === prev[4] && uf === prev[5])
        return
      requestSpanBuild(d, c, rs, cs, r, uf)
    },
    { flush: 'pre', deep: false },
  )

  if (getCurrentScope()) {
    onScopeDispose(() => {
      spanGeneration++
      cancelScheduledSpan?.()
      cancelScheduledSpan = null
      spanPending.value = false
    })
  }

  const spanEnabled = computed(() => spanMap.value.size > 0)

  const getSpanInfo = (rowIndex: number, colKey: string, rowData?: unknown): SpanInfo | undefined => {
    // <zh/> 0：virtual grand 滚动行（dataWithAppend 首位 grandTopScroll）占据 grid index 0，
    // <zh/> 若直接按 grid 行号查 spanMap 会全表错位一位；按行对象身份换算为 unpinned 域行号，
    // <zh/> grand/pin/append 合成行不在映射中即回退 undefined（合计行永不参与合并）。
    // <en/> 0: virtual grand scroll rows occupy grid index 0; translate by row identity into the
    // <en/> unpinned domain, and miss (grand/pin/append) falls back to undefined (never merge).
    if (rowData !== undefined && typeof rowData === 'object' && rowData !== null && rowIndexMap) {
      const local = rowIndexMap.get(rowData as object)
      if (local === undefined)
        return undefined
      return spanMap.value.get(`${local}-${colKey}`)
    }
    return spanMap.value.get(`${rowIndex}-${colKey}`)
  }

  type SpanFn = (params: { row: any, column: any, rowIndex: number, columnIndex: number }) => { rowspan: number, colspan: number } | undefined

  /**
   * <zh/> 闭包缓存——spanMap 引用未变时复用上一次的函数对象，避免 ElTable 收到新函数引用触发不必要的重渲染
   * <en/> Closure cache — reuses the previous function object when spanMap reference is unchanged,
   * <en/> preventing ElTable from receiving a new function reference and triggering unnecessary re-renders
   */
  let lastSpanMap: Map<string, SpanInfo> | null = null
  let lastRowIndexMap: WeakMap<object, number> | null = null
  let cachedSpanFn: SpanFn | null = null

  const spanMethod = computed<SpanFn | undefined>(() => {
    if (!spanEnabled.value)
      return undefined

    const currentMap = spanMap.value
    const currentRowIndex = rowIndexMap

    // spanMap 引用未变时复用缓存的函数对象 | Reuse cached function when spanMap reference is unchanged
    if (cachedSpanFn && lastSpanMap === currentMap && lastRowIndexMap === currentRowIndex)
      return cachedSpanFn

    lastSpanMap = currentMap
    lastRowIndexMap = currentRowIndex
    const capturedMap = currentMap
    const capturedRowIndex = currentRowIndex
    cachedSpanFn = (params) => {
      const { row, column } = params
      // <zh/> 数据字段域：spanMap 按 prop 键控，统一走 resolveColumnProp（prop → property）
      // <en/> Data-field domain: spanMap is keyed by prop, unified via resolveColumnProp (prop → property)
      const colProp = resolveColumnProp(column)
      if (!colProp)
        return undefined

      // <zh/> 统一索引域换算：按行对象身份把 composed 域行号换算为 spanMap 的 unpinned 域行号；
      // <zh/> pin 条带/grand 合计行不在 unpinned 域中，换算落空即回退 undefined（ElTable 取默认 {1,1}），条带永不参与合并。
      // <en/> Unified-domain translation: map the composed-domain row to the spanMap's unpinned-domain
      // <en/> number by row identity; pinned strips/grand rows miss and fall back to undefined (ElTable
      // <en/> defaults to {1,1}), so strips never merge.
      const localIndex = (typeof row === 'object' && row !== null && capturedRowIndex)
        ? (capturedRowIndex.get(row) ?? capturedRowIndex.get(toRaw(row)))
        : undefined
      if (localIndex === undefined)
        return undefined

      const info = capturedMap.get(`${localIndex}-${colProp}`)
      if (!info)
        return undefined

      if (info.isOrigin) {
        return { rowspan: info.rowspan, colspan: info.colspan }
      }
      return { rowspan: 0, colspan: 0 }
    }
    return cachedSpanFn
  })

  return {
    spanMap,
    spanEnabled,
    getSpanInfo,
    spanMethod,
    isSpanPending,
  }
}
