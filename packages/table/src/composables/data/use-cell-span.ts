import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue'
import type { ColSpanCellsConfig, ColumnColSpanConfig, ColumnRowSpanConfig, ProcessedColumn, RowSpanCellsConfig, SpanInfo, SpanRange } from '../../types'
import type { SpanResult } from '../rendering/use-span-strategy'
import { computed, getCurrentScope, onScopeDispose, shallowRef, toRaw, toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { idleSchedule } from '../../utils/raf'
import { resolveColumnProp } from '../../utils/shared'

export interface UseCellSpanOptions {
  data: MaybeRefOrGetter<any[]>
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  rowSpanCells?: MaybeRefOrGetter<RowSpanCellsConfig | undefined>
  colSpanCells?: MaybeRefOrGetter<ColSpanCellsConfig | undefined>
  ranges?: MaybeRefOrGetter<SpanRange[] | undefined>
  /**
   * <zh/> 用户提供的函数式 spanMethod。若提供，其结果会叠加到 spanMap，
   * <zh/> 使虚拟模式下的 getSpanInfo 也能反映函数式 spanMethod（否则虚拟模式仅 spanConfig 生效）。
   * <zh/> 与 spanConfig 共存时，函数式 spanMethod 按单元格优先（与 default 模式 mergedSpanMethod 的 userFn ?? internalFn 语义一致）。
   *
   * <en/> User-provided function-style spanMethod. When provided, its results are overlaid onto spanMap,
   * <en/> so getSpanInfo in virtual mode also reflects the function-style spanMethod (otherwise virtual mode only honors spanConfig).
   * <en/> When coexisting with spanConfig, the function-style spanMethod takes precedence per cell
   * <en/> (consistent with default-mode mergedSpanMethod's userFn ?? internalFn semantics).
   */
  userSpanMethod?: MaybeRefOrGetter<UserSpanMethod | undefined>
  /**
   * <zh/> 单元格合并计算因数据规模超限被跳过时的回调（生产环境降级通知）。
   * <zh/> 触发场景：估算操作数（行数 × 列数）超过 SPAN_CELL_LIMIT，已静默跳过合并计算。
   *
   * <en/> Callback invoked when cell span computation is skipped due to scale exceeding limit (production degradation notification).
   * <en/> Triggered when: estimated operations (rows × cols) exceed SPAN_CELL_LIMIT, span computation silently skipped.
   */
  onSpanLimitExceeded?: (info: SpanLimitInfo) => void
  /**
   * <zh/> 延迟调度阈值——估算操作数超过此值时，经 requestIdleCallback/setTimeout 延迟建图，
   * <zh/> 首帧先渲染无合并，完成后一次性提交，避免大数据阻塞首帧。默认 50000。
   * <zh/> 小表恒走同步路径。
   *
   * <en/> Deferral threshold — builds exceeding this estimated op count are deferred through
   * <en/> requestIdleCallback/setTimeout: first paint renders unmerged, then a single swap lands.
   * <en/> Defaults to 50000. Small tables always take the sync path, identical to history.
   */
  deferThreshold?: MaybeRefOrGetter<number>
}

export interface SpanLimitInfo {
  /** <zh/> 估算操作数 | <en/> Estimated operations */
  estimatedOps: number
  /** <zh/> 上限阈值 | <en/> Limit threshold */
  limit: number
  /** <zh/> 触发来源：'spanConfig'（声明式 spanConfig）或 'functionStyle'（函数式 spanMethod） | <en/> Trigger source: 'spanConfig' (declarative) or 'functionStyle' (function-style spanMethod) */
  source: 'spanConfig' | 'functionStyle'
}

/**
 * <zh/> 用户函数式 spanMethod 类型——返回体复用渲染域 `SpanResult`，与
 * <zh/> `rendering/use-span-strategy.ts` 的同名类型同构归一，避免两处内联结构漂移。
 * <en/> User function-style spanMethod type — reuses the render-domain `SpanResult`, unified
 * <en/> with the same-named type in `rendering/use-span-strategy.ts`.
 */
export type UserSpanMethod = (params: { row: any, column: any, rowIndex: number, columnIndex: number }) => SpanResult | undefined

export interface UseCellSpanReturn {
  readonly spanMap: ShallowRef<Map<string, SpanInfo>>
  readonly spanEnabled: ComputedRef<boolean>
  readonly spanMethod: ComputedRef<UserSpanMethod | undefined>
  readonly getSpanInfo: (rowIndex: number, colKey: string) => SpanInfo | undefined
  /** <zh/> 延迟建图进行中（首帧无合并态） | <en/> Deferred build in flight (first paint renders unmerged) */
  readonly isSpanPending: ComputedRef<boolean>
}

function resolveRowSpanCompare(
  config: ColumnRowSpanConfig,
  prop: string | undefined,
): (a: any, b: any) => boolean {
  if (typeof config === 'function')
    return config
  return (a: any, b: any) => a[prop!] === b[prop!]
}

function buildRowSpanMapByGrouping(
  data: any[],
  colProp: string,
): Map<string, SpanInfo> {
  const result = new Map<string, SpanInfo>()

  if (data.length === 0)
    return result

  let chainStart = 0
  let chainStartValue = data[0]?.[colProp]

  for (let i = 1; i <= data.length; i++) {
    const currentValue = i < data.length ? data[i]?.[colProp] : undefined
    const isSame = i < data.length && currentValue === chainStartValue

    if (!isSame) {
      const rowspan = i - chainStart
      if (rowspan > 1) {
        result.set(`${chainStart}-${colProp}`, {
          rowspan,
          colspan: 1,
          isOrigin: true,
        })
        for (let j = chainStart + 1; j < i; j++) {
          result.set(`${j}-${colProp}`, {
            rowspan: 0,
            colspan: 0,
            isOrigin: false,
          })
        }
      }
      if (i < data.length) {
        chainStart = i
        chainStartValue = currentValue
      }
    }
  }

  return result
}

function resolveColSpanCompare(
  config: ColumnColSpanConfig,
  _prop: string | undefined,
): (row: any, leftColProp: string, currentColProp: string) => boolean {
  if (typeof config === 'function')
    return config
  return (row: any, leftColProp: string, currentColProp: string) => row[leftColProp] === row[currentColProp]
}

const SPAN_CELL_LIMIT = 500_000

function resolveRowSpanConfig(
  col: ProcessedColumn,
  rowSpanCells: RowSpanCellsConfig | undefined,
): ColumnRowSpanConfig | undefined {
  const prop = col.prop as string | undefined
  return col.spanRows ?? (prop ? rowSpanCells?.[prop] : undefined)
}

function resolveColSpanConfig(
  col: ProcessedColumn,
  colSpanCells: ColSpanCellsConfig | undefined,
): ColumnColSpanConfig | undefined {
  const prop = col.prop as string | undefined
  return col.colSpan ?? (prop ? colSpanCells?.[prop] : undefined)
}

/**
 * 默认延迟调度阈值（估算操作数）。Default deferral threshold in estimated ops.
 * 10k 行 x 2 列实测建图约 7.5ms，50k 预算覆盖常规大表同步路径，仅超限进入延迟。
 */
export const SPAN_DEFER_BUDGET = 50_000

/**
 * 轻量估算合并操作数（O(列数)，不扫描行），与 buildSpanMap 的超限口径一致。
 * Cheap span-op estimate in O(columns) without scanning rows, same caliber as the build limit.
 */
export function estimateSpanOps(
  dataLength: number,
  columns: ProcessedColumn[],
  rowSpanCells: RowSpanCellsConfig | undefined,
  colSpanCells: ColSpanCellsConfig | undefined,
  ranges: SpanRange[] | undefined,
): number {
  let rowSpanColumns = 0
  let colSpanColumnCount = 0
  for (const col of columns) {
    const prop = col.prop as string | undefined
    if (!prop)
      continue
    if (resolveRowSpanConfig(col, rowSpanCells))
      rowSpanColumns++
    if (resolveColSpanConfig(col, colSpanCells))
      colSpanColumnCount++
  }
  const rangesOps = ranges?.reduce((sum, r) => sum + Math.max(1, r.rowspan) * Math.max(1, r.colspan), 0) ?? 0
  return dataLength * (rowSpanColumns + colSpanColumnCount) + rangesOps
}

function applyRanges(
  map: Map<string, SpanInfo>,
  columns: ProcessedColumn[],
  ranges: SpanRange[],
): void {
  for (const range of ranges) {
    const { row, col, rowspan, colspan } = range
    // <zh/> 非法起点直接跳过——负索引会写入 "-1-prop" 幽灵键污染映射（查询下标恒 ≥0，永不命中）
    // <en/> Skip illegal origins — negative indexes would write "-1-prop" ghost keys polluting the map (lookup indexes are always ≥0, never hit)
    if (row < 0 || col < 0)
      continue
    if (rowspan < 1 || colspan < 1)
      continue

    const startCol = columns[col]
    const startProp = startCol?.prop as string | undefined
    if (!startProp)
      continue

    const existingOrigin = map.get(`${row}-${startProp}`)
    if (existingOrigin && existingOrigin.isOrigin) {
      map.set(`${row}-${startProp}`, {
        rowspan: Math.max(existingOrigin.rowspan, rowspan),
        colspan: Math.max(existingOrigin.colspan, colspan),
        isOrigin: true,
      })
    }
    else if (!existingOrigin) {
      map.set(`${row}-${startProp}`, {
        rowspan,
        colspan,
        isOrigin: true,
      })
    }

    for (let ri = row; ri < row + rowspan; ri++) {
      for (let ci = col; ci < col + colspan; ci++) {
        if (ri === row && ci === col)
          continue

        const coveredCol = columns[ci]
        const coveredProp = coveredCol?.prop as string | undefined
        if (!coveredProp)
          continue

        map.set(`${ri}-${coveredProp}`, {
          rowspan: 0,
          colspan: 0,
          isOrigin: false,
        })
      }
    }
  }
}

/**
 * <zh/> 行合并：grouping 相等分支（由 applyRowSpanPhase 编排）
 * <en/> Row span: grouping-equality branch
 */
function applyRowSpanByGrouping(
  map: Map<string, SpanInfo>,
  data: any[],
  colProp: string,
): void {
  const groupedMap = buildRowSpanMapByGrouping(data, colProp)
  for (const [key, value] of groupedMap) {
    if (!map.has(key))
      map.set(key, value)
  }
}

/**
 * <zh/> 行合并：compare 链分支（由 applyRowSpanPhase 编排）
 * <en/> Row span: compare-chain branch
 */
function applyRowSpanByCompare(
  map: Map<string, SpanInfo>,
  data: any[],
  colProp: string,
  compare: (a: any, b: any) => boolean,
): void {
  if (data.length === 0)
    return
  let chainStart = 0
  for (let i = 1; i <= data.length; i++) {
    const isSame = i < data.length && compare(data[i - 1]!, data[i]!)
    if (!isSame) {
      const rowspan = i - chainStart
      if (rowspan > 1) {
        const key = `${chainStart}-${colProp}`
        if (!map.has(key))
          map.set(key, { rowspan, colspan: 1, isOrigin: true })
        for (let j = chainStart + 1; j < i; j++) {
          const hiddenKey = `${j}-${colProp}`
          if (!map.has(hiddenKey))
            map.set(hiddenKey, { rowspan: 0, colspan: 0, isOrigin: false })
        }
      }
      chainStart = i
    }
  }
}

/**
 * <zh/> 行合并阶段：逐列按配置分发 grouping/compare（由 buildSpanMap 编排）
 * <en/> Row-span phase: per-column dispatch to grouping/compare by config (orchestrated by buildSpanMap)
 */
function applyRowSpanPhase(
  map: Map<string, SpanInfo>,
  data: any[],
  rowSpanColumns: ProcessedColumn[],
  rowSpanCells: RowSpanCellsConfig | undefined,
): void {
  for (const col of rowSpanColumns) {
    const colProp = col.prop as string
    const rowSpanConfig = resolveRowSpanConfig(col, rowSpanCells)
    if (!rowSpanConfig)
      continue
    if (rowSpanConfig === true)
      applyRowSpanByGrouping(map, data, colProp)
    else
      applyRowSpanByCompare(map, data, colProp, resolveRowSpanCompare(rowSpanConfig, colProp))
  }
}

/** <zh/> 列合并查找表：colProp → 列序号 + 行内比较器 | <en/> Column-span lookup: colProp → column index + in-row comparator */
type ColSpanLookup = Map<string, { index: number, compare: (row: any, leftColProp: string, currentColProp: string) => boolean }>

/**
 * <zh/> 构建列合并查找表（由 applyColSpanPhase 编排）
 * <en/> Build the column-span lookup
 */
function buildColSpanLookup(
  columns: ProcessedColumn[],
  colSpanCells: ColSpanCellsConfig | undefined,
): ColSpanLookup {
  const colSpanLookup: ColSpanLookup = new Map()
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx]!
    const colProp = col.prop as string | undefined
    if (!colProp)
      continue
    const colSpanConfig: ColumnColSpanConfig | undefined = resolveColSpanConfig(col, colSpanCells)
    if (!colSpanConfig)
      continue
    colSpanLookup.set(colProp, {
      index: colIdx,
      compare: resolveColSpanCompare(colSpanConfig, colProp),
    })
  }
  return colSpanLookup
}

/**
 * <zh/> 单行列合并：链式扫描，4 处落链条件归一为 flushChain（`colIdx - start > 1` 与 `end - start >= 1` 同值，已逐处验算等价）
 * <en/> Single-row column span: chain scan with the 4 chain-close conditions unified into flushChain (verified equivalent case by case)
 */
function applySingleRowColSpan(
  map: Map<string, SpanInfo>,
  row: any,
  rowIdx: number,
  columns: ProcessedColumn[],
  colSpanLookup: ColSpanLookup,
): void {
  let chainStartColIdx: number | null = null
  let chainStartProp: string | null = null
  const flushChain = (endColIdx: number): void => {
    if (chainStartColIdx !== null && endColIdx - chainStartColIdx >= 1)
      applyColSpan(map, rowIdx, columns, chainStartColIdx, chainStartProp!, endColIdx)
  }
  const resetChain = (): void => {
    chainStartColIdx = null
    chainStartProp = null
  }
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx]!
    const colProp = col.prop as string | undefined
    if (!colProp) {
      flushChain(colIdx - 1)
      resetChain()
      continue
    }
    const colSpanEntry = colSpanLookup.get(colProp)
    const existingInfo = map.get(`${rowIdx}-${colProp}`)
    if (existingInfo && !existingInfo.isOrigin) {
      flushChain(colIdx - 1)
      resetChain()
      continue
    }
    if (colSpanEntry) {
      if (chainStartColIdx !== null) {
        if (!colSpanEntry.compare(row, chainStartProp!, colProp)) {
          flushChain(colIdx - 1)
          chainStartColIdx = colIdx
          chainStartProp = colProp
        }
      }
      else {
        chainStartColIdx = colIdx
        chainStartProp = colProp
      }
    }
    else {
      flushChain(colIdx - 1)
      resetChain()
    }
  }
  flushChain(columns.length - 1)
}

/**
 * <zh/> 列合并阶段：建表后逐行应用（由 buildSpanMap 编排；空表直接返回）
 * <en/> Column-span phase: build the lookup then apply row by row (orchestrated by buildSpanMap; no-op when empty)
 */
function applyColSpanPhase(
  map: Map<string, SpanInfo>,
  data: any[],
  columns: ProcessedColumn[],
  colSpanCells: ColSpanCellsConfig | undefined,
): void {
  const colSpanLookup = buildColSpanLookup(columns, colSpanCells)
  if (colSpanLookup.size === 0)
    return
  for (let rowIdx = 0; rowIdx < data.length; rowIdx++)
    applySingleRowColSpan(map, data[rowIdx]!, rowIdx, columns, colSpanLookup)
}

function buildSpanMap(
  data: any[],
  columns: ProcessedColumn[],
  rowSpanCells: RowSpanCellsConfig | undefined,
  colSpanCells: ColSpanCellsConfig | undefined,
  ranges: SpanRange[] | undefined,
  onSpanLimitExceeded?: (info: SpanLimitInfo) => void,
): Map<string, SpanInfo> {
  const map = new Map<string, SpanInfo>()

  if (ranges && ranges.length > 0) {
    applyRanges(map, columns, ranges)
  }

  const rowSpanColumns = columns.filter((col) => {
    const prop = col.prop as string | undefined
    if (!prop)
      return false
    const config = resolveRowSpanConfig(col, rowSpanCells)
    return !!config
  })

  const colSpanColumnCount = columns.filter((col) => {
    const prop = col.prop as string | undefined
    if (!prop)
      return false
    return !!resolveColSpanConfig(col, colSpanCells)
  }).length

  // 超限口径与 estimateSpanOps 同源（公式一致，行注释见该函数）.
  // Limit caliber shares its formula with estimateSpanOps.
  const rangesOps = ranges?.reduce((sum, r) => sum + Math.max(1, r.rowspan) * Math.max(1, r.colspan), 0) ?? 0
  const estimatedOps = data.length * (rowSpanColumns.length + colSpanColumnCount) + rangesOps
  if (estimatedOps >= SPAN_CELL_LIMIT) {
    if (isDev && typeof console !== 'undefined') {
      devWarn(
        `[AdvTable] Cell span skipped: estimated ${estimatedOps} operations exceed limit (${SPAN_CELL_LIMIT}).`
        + ` Consider reducing data size or disabling span for better performance.`,
      )
    }
    onSpanLimitExceeded?.({
      estimatedOps,
      limit: SPAN_CELL_LIMIT,
      source: 'spanConfig',
    })
    return map
  }

  applyRowSpanPhase(map, data, rowSpanColumns, rowSpanCells)
  applyColSpanPhase(map, data, columns, colSpanCells)

  return map
}

function applyColSpan(
  map: Map<string, SpanInfo>,
  rowIdx: number,
  columns: ProcessedColumn[],
  startColIdx: number,
  startColProp: string,
  endColIdx: number,
): void {
  const colspan = endColIdx - startColIdx + 1
  if (colspan <= 1)
    return

  const existingOrigin = map.get(`${rowIdx}-${startColProp}`)
  if (existingOrigin && existingOrigin.isOrigin) {
    map.set(`${rowIdx}-${startColProp}`, { ...existingOrigin, colspan })
  }
  else if (!existingOrigin) {
    map.set(`${rowIdx}-${startColProp}`, {
      rowspan: 1,
      colspan,
      isOrigin: true,
    })
  }

  for (let ci = startColIdx + 1; ci <= endColIdx; ci++) {
    const prop = columns[ci]!.prop as string | undefined
    if (!prop)
      continue

    const existingHidden = map.get(`${rowIdx}-${prop}`)
    if (existingHidden) {
      if (existingHidden.isOrigin && (existingHidden.rowspan > 1 || existingHidden.colspan > 1)) {
        // <zh/> 已有真实合并起点（rowSpan/colSpan>1）时保留，避免 colSpan 隐藏覆盖行合并起点
        // <en/> Preserve real span origin (rowSpan/colSpan>1); don't overwrite with colSpan hidden
        continue
      }
      if (!existingHidden.isOrigin)
        continue
    }
    // <zh/> 无记录或为 1x1 占位起点时按 colSpan 隐藏处理
    // <en/> No record or 1x1 placeholder origin → mark as colSpan hidden
    if (!existingHidden) {
      map.set(`${rowIdx}-${prop}`, {
        rowspan: 0,
        colspan: 0,
        isOrigin: false,
      })
    }
    else if (existingHidden.isOrigin) {
      map.set(`${rowIdx}-${prop}`, {
        rowspan: 0,
        colspan: 0,
        isOrigin: false,
      })
    }
  }
}

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

/**
 * <zh/> default 模式合并方法依赖——用户函数与内部 span 叠加所需的全部输入
 * <en/> Default-mode merged-span-method deps — all inputs needed to overlay the user function over the internal span
 */
export interface MergedSpanMethodDeps {
  /** <zh/> 用户函数式 spanMethod | <en/> User function-style spanMethod */
  userSpanMethod: MaybeRefOrGetter<UserSpanMethod | undefined>
  /** <zh/> 内部 span 方法（声明式 spanConfig 产物） | <en/> Internal span method (built from declarative spanConfig) */
  internalSpanMethod: MaybeRefOrGetter<UserSpanMethod | undefined>
}

/**
 * <zh/> 两种模式均完整支持单元格合并，但机制不同：
 * <zh/>   • default 模式：通过 ElTable 的 span-method prop（返回 { rowspan, colspan }）
 * <zh/>   • virtual 模式：通过 getSpanInfo 查询 spanMap（VNode 改写方式）
 * <zh/> 用户函数式 spanMethod 在两种模式下均已生效：
 * <zh/>   • default 模式：下方用户函数优先、返回 undefined 时回退内部
 * <zh/>   • virtual 模式：useCellSpan 的 userSpanMethod 参数已将其叠加到 spanMap → getSpanInfo
 *
 * <zh/> 本函数不感知渲染模式：其产物仅经 `defaultRendererProps['span-method']` 下发给 default 渲染器，
 * <zh/> 虚拟渲染器从不读取该 prop（合并走 getSpanInfo 路径）。原先内联的 `if (isVirtual) return undefined`
 * <zh/> 与 props 分流的模式判定重复，属冗余模式判断，已移除。
 * <en/> Both modes fully support cell merging, but with different mechanisms:
 * <en/>   • default mode: via ElTable's span-method prop (returns { rowspan, colspan })
 * <en/>   • virtual mode: via getSpanInfo querying spanMap (VNode rewrite approach)
 * <en/> User function-style spanMethod is effective in both modes:
 * <en/>   • default: user function first below, falling back to internal when it returns undefined
 * <en/>   • virtual: already overlaid onto spanMap by useCellSpan's userSpanMethod param → getSpanInfo
 *
 * <en/> This function is mode-agnostic: its result is handed only to the default renderer via
 * <en/> `defaultRendererProps['span-method']`; the virtual renderer never reads that prop (merging goes
 * <en/> through the getSpanInfo path). The former inline `if (isVirtual) return undefined` duplicated the
 * <en/> props-split mode decision and was a redundant mode check, so it has been removed.
 */
export function createMergedSpanMethod(deps: MergedSpanMethodDeps): ComputedRef<UserSpanMethod | undefined> {
  return computed(() => {
    const userFn = toValue(deps.userSpanMethod)
    const internalFn = toValue(deps.internalSpanMethod)
    // <zh/> 无任何合并配置时返回 undefined | <en/> Return undefined when no span config
    if (!userFn || !internalFn)
      return userFn ?? internalFn
    // <zh/> 两者都存在时：用户函数优先，返回 undefined 时回退到内部 | <en/> Both present: user function first, fallback to internal when undefined
    return (params: { row: any, column: any, rowIndex: number, columnIndex: number }) =>
      userFn(params) ?? internalFn(params)
  })
}
