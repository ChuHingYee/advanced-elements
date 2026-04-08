/**
 * <zh/> 列筛选 Composable
 * <en/> Column filter composable
 *
 * @remarks
 * <zh/> 管理所有可筛选列的筛选状态。支持四种筛选类型：文本模糊搜索、数字范围、日期筛选、枚举勾选
 * <en/> Manages filter state for all filterable columns. Supports four filter types: text (fuzzy search), number (range), date (before/after/range), enum (checkbox)
 */
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ColumnFilterConfig, ColumnFilterType, EnumFilterOption, ProcessedColumn } from '../../types'
import type {
  ColumnFilterValue,
} from '../../types/filter'
import { computed, shallowRef, toValue, watch } from 'vue'
import { findColumnByKey } from '../../utils/column-tree'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { mapsShallowEqual } from '../../utils/equality'
import { buildColumnKeyMap, getColumnKey } from '../../utils/shared'
import { resolveCellDisplayValue, resolveCellValue } from '../../utils/value-pipeline'
import { registerBuiltinFilterTypes } from '../features/builtin-filters'
import { getFilterStrategy, useFilterRegistry } from '../features/filter-registry'
import { isFilterActive, matchesFilter } from './filter-eval'

export type { ColumnFilterType }

/**
 * <zh/> 筛选值类型转出——唯一真源见 `types/filter.ts`。
 * <zh/> 此处转出以便筛选消费者单点导入。
 * <en/> Filter value type re-exports — single source of truth in `types/filter.ts`.
 * <en/> Re-exported here for single-point imports by filter consumers.
 */
export type {
  ColumnFilterValue,
  DateFilterValue,
  EnumFilterValue,
  GroupFilterValue,
  NumberCondition,
  NumberFilterValue,
  NumberOperator,
  TextCondition,
  TextFilterValue,
  TextOperator,
} from '../../types/filter'

/**
 * <zh/> 标准化筛选配置
 * <en/> Normalize filter configuration
 *
 * <zh/> 将多种入参形式统一转为 ColumnFilterConfig 对象
 * <en/> Unifies various input forms into a ColumnFilterConfig object
 *
 * @param filter - <zh/> 筛选配置，支持 boolean（true=文本筛选）、字符串（筛选类型名）、ColumnFilterConfig 对象 | <en/> Filter config, supports boolean (true=text filter), string (filter type name), or ColumnFilterConfig object
 * @returns <zh/> 标准化后的 ColumnFilterConfig | <en/> Normalized ColumnFilterConfig
 */
export function normalizeFilterConfig(filter: ColumnFilterType | ColumnFilterConfig | true): ColumnFilterConfig {
  if (filter === true) {
    return { type: 'text' }
  }
  if (typeof filter === 'string') {
    return { type: filter }
  }
  return filter
}

/**
 * <zh/> 创建指定类型的默认筛选值
 * <en/> Create default filter value for the specified type
 *
 * <zh/> 通过 FilterStrategy 策略生成默认值；若策略不存在，回退为文本筛选
 * <en/> Generates default value via FilterStrategy; falls back to text filter if no strategy exists
 *
 * @param type - <zh/> 筛选类型 | <en/> filter type
 * @returns <zh/> 默认 ColumnFilterValue | <en/> default ColumnFilterValue
 */
export function createDefaultFilterValue(type: ColumnFilterType): ColumnFilterValue {
  const strategy = getFilterStrategy(type)
  if (strategy)
    return strategy.createDefaultValue() as ColumnFilterValue

  if (isDev) {
    devWarn(`[AdvTable] Unknown filter type "${type}", falling back to text filter.`)
  }
  return { type: 'text', operator: 'contains' }
}

// 筛选文案格式化（纯函数）转出自 `utils/filter-format`，供调用方单点导入。
// Filter-text formatting (pure functions) lives in `utils/filter-format` (pure code motion); re-exported for single-point imports.
export { formatFilterCondition, registerFilterTextFormatter } from '../../utils/filter-format'
export type { FilterTextFormatter } from '../../utils/filter-format'

/**
 * <zh/> useColumnFilter 配置选项 | <en/> useColumnFilter configuration options
 */
export interface UseColumnFilterOptions<T = any> {
  /** <zh/> 列配置 | <en/> Column configuration */
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  /** <zh/> 当前展示数据 | <en/> Current display data */
  data: MaybeRefOrGetter<T[]>
  /** <zh/> 完整数据集，用于枚举筛选的选项扫描 | <en/> Full dataset for enum filter option scanning */
  allData?: MaybeRefOrGetter<T[]>
  /**
   * <zh/> 外部筛选状态——提供时复用该 ref 而非内部创建。
   * <zh/> 预创建共享状态切口：调用方预创建后同时注入请求域与管线，筛选状态标识全链路稳定。
   * <en/> External filter state — reused when provided instead of creating one internally.
   * <en/> Pre-created shared state seam: callers pre-create it and inject into both the request domain and the pipeline, keeping filter-state identity stable across the chain.
   */
  filterState?: Ref<Record<string, ColumnFilterValue>>
}

/**
 * <zh/> useColumnFilter 返回值 | <en/> useColumnFilter return value
 */
export interface UseColumnFilterReturn {
  /** <zh/> 筛选状态 Map（columnKey → ColumnFilterValue） | <en/> Filter state map (columnKey → ColumnFilterValue) */
  filterState: Ref<Record<string, ColumnFilterValue>>
  /** <zh/> 是否存在活跃的筛选条件 | <en/> Whether any active filter condition exists */
  hasActiveFilter: ComputedRef<boolean>
  /** <zh/> 设置指定列的筛选值 | <en/> Set filter value for a specific column */
  setFilter: (columnKey: string, value: ColumnFilterValue) => void
  /** <zh/> 重置指定列的筛选条件为默认值 | <en/> Reset filter condition for a specific column to default */
  resetColumnFilter: (columnKey: string) => void
  /** <zh/> 重置所有列的筛选条件 | <en/> Reset all column filter conditions */
  resetAllFilters: () => void
  /** <zh/> 获取指定列的枚举筛选选项 | <en/> Get enum filter options for a specific column */
  getEnumOptions: (columnKey: string) => EnumFilterOption[]
  /** <zh/> 筛选后的数据及是否被筛选的标志 | <en/> Filtered data and whether filtering was applied */
  filteredData: ComputedRef<{ data: any[], isFiltered: boolean }>
  /** <zh/> 获取指定列的当前筛选值 | <en/> Get current filter value for a specific column */
  getFilterValue: (columnKey: string) => ColumnFilterValue | undefined
  /** <zh/> 判断指定列是否处于活跃筛选状态 | <en/> Whether a specific column has an active filter */
  isColumnFiltered: (columnKey: string) => boolean
  /**
   * <zh/> 按**行对象**失效 cellValue 缓存——单元格编辑提交/撤销后调用，防止筛选命中编辑前旧值；
   * <zh/> 参数省略时整表清空（批量提交/undo 全局回滚）
   *
   * <zh/> 缓存以行对象为 WeakMap 键，故失效入口同样按行对象定位：**不接收行索引**。
   * <zh/> 编辑事件携带的 `rowIndex` 属于渲染域（renderData），而本缓存的 `data` 属于管线域
   * <zh/> （pipelineData），跨域传索引在筛选/排序/分页状态下必然指向错误的行。
   *
   * <en/> Invalidate the per-row cellValue cache **by row object** — call after a cell edit
   * <en/> commit/undo so filtering never matches pre-edit values; omit the argument to clear
   * <en/> everything (batch commits / global undo).
   *
   * <en/> The cache is a WeakMap keyed by row object, so invalidation is addressed by row object
   * <en/> too: it takes **no row index**. The `rowIndex` carried by edit events lives in the render
   * <en/> domain (renderData) while this cache's `data` is the pipeline domain (pipelineData);
   * <en/> passing an index across domains points at the wrong row whenever filtering, sorting or
   * <en/> pagination is active.
   */
  invalidateRowCache: (row?: object | null) => void
  /**
   * <zh/> 停止内部 watch 并清空缓存（幂等）——动态创建场景的资源兜底回收入口
   * <en/> Stop internal watches and clear caches (idempotent) — resource fallback for dynamic creation
   */
  dispose: () => void
}

// 筛选求值谓词转出自 ./filter-eval，供调用方单点导入。
// Filter predicate evaluation lives in ./filter-eval (pure code motion); re-exported for single-point imports.
export { isFilterActive, matchesFilter } from './filter-eval'

/**
 * 列筛选组合式函数
 * Composable for column filtering
 *
 * 管理可筛选列的筛选状态，支持文本/数字/日期/枚举四种类型，
 * 使用策略模式通过 FilterStrategy 扩展筛选逻辑。
 * @param options - 筛选配置
 * @returns 筛选状态和方法
 * @example
 * ```ts
 * const filter = useColumnFilter({
 *   columns: effectiveColumns,
 *   data: visibleData,
 * })
 * filter.setFilter('name', { type: 'text', operator: 'contains', value: 'John' })
 * ```
 */
export function useColumnFilter<T = any>(
  options: UseColumnFilterOptions<T>,
): UseColumnFilterReturn {
  registerBuiltinFilterTypes()

  const { columns, data, allData, filterState: injectedFilterState } = options

  const filterState = injectedFilterState ?? shallowRef<Record<string, ColumnFilterValue>>({})

  // <zh/> 策略读取器：setup 上下文命中注入的实例注册表（按表隔离），否则回退全局表
  // <en/> Strategy reader: setup context hits the injected per-table registry, else global fallback
  const getStrategy = useFilterRegistry().get

  /**
   * <zh/> Computed 枚举选项缓存 | <en/> Computed enum options cache
   */
  const ENUM_SCAN_ROW_LIMIT = 100_000
  const ENUM_SCAN_SAMPLE_LIMIT = 10_000

  const cacheVersion = shallowRef(0)

  const enumOptionsCache = computed<Map<string, EnumFilterOption[]>>((prev) => {
    const cols = toValue(columns)
    const rows = allData ? toValue(allData) : toValue(data)

    void cacheVersion.value
    const cache = new Map<string, EnumFilterOption[]>()

    const enumColsNeedingScan: { col: ProcessedColumn, key: string, prop: string, useFormat: boolean, colIndex: number }[] = []

    for (let colIdx = 0; colIdx < cols.length; colIdx++) {
      const col = cols[colIdx]
      if (col.filter === false || col.selection || col.valueType === 'option')
        continue
      const config = normalizeFilterConfig(col.filter ?? true)
      if (config.type !== 'enum')
        continue
      const key = getColumnKey(col)

      if (config.options && config.options.length > 0) {
        cache.set(key, config.options)
        continue
      }

      const prop = col.prop as string
      if (!prop)
        continue

      const useFormat = col.format && config.filterByFormat !== false
      enumColsNeedingScan.push({ col, key, prop, useFormat, colIndex: colIdx })
    }

    if (enumColsNeedingScan.length > 0 && rows.length > ENUM_SCAN_ROW_LIMIT) {
      if (isDev && typeof console !== 'undefined') {
        devWarn(
          `[AdvTable] Enum filter scan skipped: ${rows.length} rows exceed limit (${ENUM_SCAN_ROW_LIMIT}).`
          + ` Provide static options via column.filter.options for better performance.`,
        )
      }
      for (const { key } of enumColsNeedingScan) {
        cache.set(key, [])
      }
    }
    else {
      const rowsToScan = rows.length > ENUM_SCAN_SAMPLE_LIMIT
        ? rows.slice(0, ENUM_SCAN_SAMPLE_LIMIT)
        : rows
      for (const { col, key, prop, useFormat, colIndex } of enumColsNeedingScan) {
        const seen = new Set<string | number>()
        const options: EnumFilterOption[] = []

        let _optIdx = 0
        for (const row of rowsToScan) {
          const rawVal = (row as Record<string, unknown>)[prop]
          if (rawVal == null) {
            _optIdx++
            continue
          }

          if (useFormat) {
            const displayValue = String(resolveCellDisplayValue(row, col, _optIdx, cols, colIndex))
            const k = displayValue
            if (!seen.has(k)) {
              seen.add(k)
              options.push({ label: displayValue, value: displayValue })
            }
          }
          else {
            const k = typeof rawVal === 'number' ? rawVal : String(rawVal)
            if (!seen.has(k)) {
              seen.add(k)
              let label = String(rawVal)
              if (col.valueEnum) {
                const enumItem = col.valueEnum[String(rawVal)]
                if (enumItem) {
                  label = typeof enumItem === 'string' ? enumItem : enumItem.text
                }
              }
              options.push({ label, value: rawVal as string | number })
            }
          }
          _optIdx++
        }
        cache.set(key, options)
      }
    }
    if (prev && mapsShallowEqual(prev, cache, (a, b) =>
      a.length === b.length && a.every((opt, i) => opt.label === b[i].label && opt.value === b[i].value))) {
      return prev
    }
    return cache
  })

  /**
   * 行级 cellValue 持久缓存：预计算每行各列的 cellValue，
   * 跨 computed 求值持久化，避免每次筛选条件变化时重复计算。
   * data 或 columns 变化时由 watch 清空。
   *
   * Persistent per-row cellValue cache: pre-computes cellValue for each row/column pair.
   * Persists across computed evaluations, avoiding repeated computation on filter changes.
   * Cleared by watch when data or columns change.
   */
  let cellValueCache = new WeakMap<object, Map<string, unknown>>()

  /**
   * <zh/> 索引敏感列（format/valueGetter）独立缓存——每 (行, 列) 只占一槽 `{ index, value }`，
   * <zh/> 同序重筛命中（保性能），排序/分页重排后覆写旧槽（保正确），不会像
   * <zh/> `columnKey\0rowIndex` 后缀键那样随重排次数单调堆积。
   * <en/> Dedicated cache for index-sensitive columns (format/valueGetter) — one slot per
   * <en/> (row, column) holding `{ index, value }`; hits on same-order re-filter, overwritten
   * <en/> after reorder. Never accumulates like `columnKey\0rowIndex`-suffixed keys do.
   */
  let indexSensitiveCache = new WeakMap<object, Map<string, { index: number, value: unknown }>>()

  /** <zh/> 双缓存统一重置——新增缓存必须在此登记，避免漏清 | <en/> Reset both caches together — register any new cache here */
  function resetCellValueCaches(): void {
    cellValueCache = new WeakMap()
    indexSensitiveCache = new WeakMap()
  }

  /**
   * <zh/> 长度快照守卫——原地修改行数组（引用不变，如单元格编辑直改行属性后
   * <zh/> 上游仍以同引用触发重算）时引用 watcher 无法感知；配合按行失效接口
   * <zh/> invalidateRowCache 覆盖"编辑→筛选"链路的陈旧值问题。
   * <en/> Length-snapshot guard — catches in-place array mutation (same reference) that the
   * <en/> reference-based watch cannot see; combined with the per-row invalidateRowCache API
   * <en/> it closes the stale-value gap in the "edit → filter" chain.
   */
  let lastDataLength = -1

  /**
   * <zh/> 按行对象失效缓存——单元格编辑提交/撤销后调用，避免筛选命中编辑前的陈旧值。
   * <zh/> 参数省略时整表清空（批量提交/undo 全局回滚场景）。
   * <en/> Invalidate cached cell values for one row object — call after a cell edit commit/undo
   * <en/> so filtering no longer matches pre-edit values. Omit the row to clear everything
   * <en/> (batch commits / global undo rollback).
   */
  function invalidateRowCache(row?: object | null): void {
    if (row == null) {
      resetCellValueCaches()
    }
    else {
      cellValueCache.delete(row)
      indexSensitiveCache.delete(row)
    }
    cacheVersion.value++
  }

  /**
   * <zh/> 数据源引用变化时清空缓存 | <en/> Clear cache when data source reference changes.
   * <zh/> 持有 stop 句柄——本 composable 可能在管线 watch 回调（无实例上下文）中动态创建，
   * <zh/> 此时 watch 不归属任何 effect scope，必须由调用方经 dispose 手动停止，
   * <zh/> 否则随数据源存续整个应用生命周期（泄漏）。
   * <en/> Hold the stop handle — this composable may be created dynamically inside a pipeline
   * <en/> watch callback (no instance context), where the watch belongs to no effect scope;
   * <en/> the caller must stop it via dispose, otherwise it lives as long as the data source (leak).
   */
  const stopDataWatch = watch(() => toValue(data), (nextData) => {
    resetCellValueCaches()
    lastDataLength = nextData.length
  }, { flush: 'sync' })

  /**
   * <zh/> 长度变化守卫——处理原地变更（push/splice）导致引用不变但长度变化的场景，
   * <zh/> 独立成 watch，避免在 computed 内做副作用。
   * <en/> Length guard — handles in-place mutations (push/splice) where the reference is unchanged
   * <en/> but the length changes; a dedicated watch, so no side effect lives inside a computed.
   */
  const stopLengthWatch = watch(() => toValue(data)?.length ?? 0, (newLen) => {
    if (newLen !== lastDataLength) {
      lastDataLength = newLen
      resetCellValueCaches()
    }
  }, { flush: 'sync' })

  /**
   * <zh/> 列配置变化时清空缓存并按结构变化重建 filterState
   * <zh/> 使用列 key 签名比较而非引用比较——避免父组件无关 re-render（重建数组引用但列集合不变）时静默清空用户已设筛选值
   * <en/> Clear cache and rebuild filterState on structural column changes.
   * <en/> Uses column key signature comparison instead of reference comparison
   * <en/> avoids silently clearing user-set filter values when parent re-renders create a new array reference
   * <en/> with the same column set.
   * <zh/> 深监听必要性：列 filter 配置为嵌套对象且允许原地修改，浅监听漏检；回调内先算 key 签名，不变即 return，实际重建极少
   * <en/> Why deep: column filter configs are nested objects subject to in-place mutation, which a shallow watch misses; the callback computes the key signature first and returns early when unchanged, so rebuilds are rare.
   */
  let lastColumnSignature = ''
  const stopColumnsWatch = watch(() => toValue(columns), (cols) => {
    resetCellValueCaches()
    cacheVersion.value++
    const activeKeys = new Set<string>()
    const next = { ...filterState.value }

    /**
     * <zh/> 构建列 key 签名——仅包含可筛选列的 key + filter 类型。
     * <zh/> 签名不变时跳过 filterState 重建，保留用户已设筛选值。
     * <en/> Build a column key signature — includes only filterable columns' keys + filter types.
     * <en/> Skip filterState rebuild when signature is unchanged, preserving user-set filter values.
     */
    const currentSignature = cols
      .filter(col => col.filter !== false && !col.selection && col.valueType !== 'option')
      .map(col => `${getColumnKey(col)}:${normalizeFilterConfig(col.filter ?? true).type}`)
      .sort()
      .join('|')

    if (currentSignature === lastColumnSignature)
      return
    lastColumnSignature = currentSignature

    for (const col of cols) {
      if (col.filter === false)
        continue
      if (col.selection || col.valueType === 'option')
        continue
      const key = getColumnKey(col)
      activeKeys.add(key)
      if (!(key in next)) {
        const config = normalizeFilterConfig(col.filter ?? true)
        next[key] = createDefaultFilterValue(config.type)
      }
    }

    for (const key of Object.keys(next)) {
      if (!activeKeys.has(key)) {
        delete next[key]
      }
    }

    filterState.value = next
  }, { immediate: true, deep: true, flush: 'sync' })

  /**
   * <zh/> 停止内部 watch 并清空缓存，幂等可重复调用。
   * <zh/> 供动态创建场景（无组件实例上下文）兜底：管线在自身 setup 阶段通过
   * <zh/> onScopeDispose 统一回收所有动态升级产物（参见 use-table-data-pipeline）。
   * <en/> Stop internal watches and clear caches; idempotent.
   * <en/> Fallback for dynamic creation (no instance context): the pipeline flushes all
   * <en/> upgraded instances via a single setup-time onScopeDispose (see use-table-data-pipeline).
   */
  function dispose(): void {
    stopDataWatch()
    stopLengthWatch()
    stopColumnsWatch()
    resetCellValueCaches()
    lastDataLength = -1
  }

  const hasActiveFilter = computed(() =>
    Object.values(filterState.value).some((v): v is ColumnFilterValue => isFilterActive(v, getStrategy)),
  )

  /**
   * <zh/> 列键查找 Map——computed 缓存，避免每次解析调用都重建 O(n) Map。
   * <zh/> 与 use-column-sort 共用 utils/shared 的 buildColumnKeyMap（规范键 + prop 别名，首见优先），
   * <zh/> 约束两处实现同源以消除漂移风险；此处为查表 O(1)，禁止退化为线性扫描 O(n)。
   * <en/> Column-key lookup Map — computed-cached to avoid rebuilding an O(n) map per resolution call.
   * <en/> Shares utils/shared buildColumnKeyMap with use-column-sort (canonical key + prop alias,
   * <en/> first-match-wins), keeping both implementations from a single source to remove drift risk;
   * <en/> this path is an O(1) lookup and must not regress to a linear O(n) scan.
   */
  const colMap = computed(() => buildColumnKeyMap(toValue(columns)))

  /**
   * <zh/> 将调用方传入的 prop/columnKey 解析为内部主键——与 use-column-sort.ts 的 resolveColumnKey 语义对称。
   * <zh/> 优先按 prop 查找列定义并返回其 columnKey，找不到时按原值兜底（本身即 columnKey 或外部手动构造的 prop）。
   * <en/> Resolve caller-supplied prop/columnKey into the internal primary key — symmetric with use-column-sort.ts.
   * <en/> Prefers looking up the column by prop and returning its columnKey; falls back to the raw value.
   */
  function resolveColumnKey(input: string): string {
    const col = colMap.value.get(input)
    if (col)
      return getColumnKey(col)
    return input
  }

  function setFilter(columnKey: string, value: ColumnFilterValue) {
    const resolvedKey = resolveColumnKey(columnKey)
    filterState.value = { ...filterState.value, [resolvedKey]: value }
  }

  function resetColumnFilter(columnKey: string) {
    const resolvedKey = resolveColumnKey(columnKey)
    const next = { ...filterState.value }
    const cols = toValue(columns)
    const col = findColumnByKey(cols, resolvedKey)
    if (col && col.filter !== false && !col.selection && col.valueType !== 'option') {
      const config = normalizeFilterConfig(col.filter ?? true)
      next[resolvedKey] = createDefaultFilterValue(config.type)
    }
    else {
      delete next[resolvedKey]
    }
    filterState.value = next
  }

  function resetAllFilters() {
    const next: Record<string, ColumnFilterValue> = {}
    const cols = toValue(columns)
    for (const col of cols) {
      if (col.filter !== false && !col.selection && col.valueType !== 'option') {
        const key = getColumnKey(col)
        const config = normalizeFilterConfig(col.filter ?? true)
        next[key] = createDefaultFilterValue(config.type)
      }
    }
    filterState.value = next
  }

  function getEnumOptions(columnKey: string): EnumFilterOption[] {
    const resolvedKey = resolveColumnKey(columnKey)
    return enumOptionsCache.value.get(resolvedKey) ?? []
  }

  function getFilterValue(columnKey: string): ColumnFilterValue | undefined {
    const resolvedKey = resolveColumnKey(columnKey)
    return filterState.value[resolvedKey]
  }

  function isColumnFiltered(columnKey: string): boolean {
    const resolvedKey = resolveColumnKey(columnKey)
    const value = filterState.value[resolvedKey]
    return value ? isFilterActive(value, getStrategy) : false
  }

  /** <zh/> 独立 computed：仅依赖 filterState 和 columns | <en/> Standalone computed: depends only on filterState and columns */
  const activeFilters = computed(() => {
    const cols = toValue(columns)
    const filters: { columnKey: string, getCellValue: (row: any, rowIndex: number) => unknown, filterValue: ColumnFilterValue, indexSensitive: boolean }[] = []
    const state = filterState.value
    for (let colIdx = 0; colIdx < cols.length; colIdx++) {
      const col = cols[colIdx]
      if (col.filter === false)
        continue
      const key = getColumnKey(col)
      const fv = state[key]
      if (fv && isFilterActive(fv, getStrategy) && col.prop) {
        const prop = col.prop as string
        const config = normalizeFilterConfig(col.filter ?? true)
        let getCellValue: (row: any, rowIndex: number) => unknown
        let indexSensitive = false
        const customFilterValue = (config as ColumnFilterConfig).filterValue
        if (customFilterValue) {
          getCellValue = (row: any, _rowIndex: number) => customFilterValue(row, (row as Record<string, unknown>)[prop])
        }
        else if (col.format && config.filterByFormat !== false) {
          // <zh/> format/valueGetter 依赖 rowIndex：排序/分页重排后同行对象旧索引值失效，标记跳行缓存直算
          // <en/> format/valueGetter depend on rowIndex: skip the per-row cache after reorder, compute directly
          indexSensitive = true
          getCellValue = (row: any, rowIndex: number) => resolveCellDisplayValue(row, col, rowIndex, cols, colIdx)
        }
        else if (col.valueGetter) {
          indexSensitive = true
          getCellValue = (row: any, rowIndex: number) => resolveCellValue(row, col, rowIndex)
        }
        else {
          getCellValue = (row: any, _rowIndex: number) => (row as Record<string, unknown>)[prop]
        }
        filters.push({ columnKey: key, getCellValue, filterValue: fv, indexSensitive })
      }
    }
    return filters
  })

  const filteredData = computed<{ data: any[], isFiltered: boolean }>((prev) => {
    void cacheVersion.value
    const rows = toValue(data)
    const filters = activeFilters.value

    if (filters.length === 0) {
      if (prev && !prev.isFiltered && prev.data === rows)
        return prev
      return { data: rows, isFiltered: false }
    }

    /**
     * 使用 composable 级 cellValueCache，跨筛选条件变化持久化。
     * 仅当数据或列配置变化时（由 watch 清空）才需重建。
     */
    function getOrCacheCellValue(rowObj: object, columnKey: string, getter: (row: any, rowIndex: number) => unknown, row: any, rowIndex: number): unknown {
      let rowCache = cellValueCache.get(rowObj)
      if (!rowCache) {
        rowCache = new Map()
        cellValueCache.set(rowObj, rowCache)
      }
      // <zh/> 命中判据以"是否已计算"为准（has），而非"值是否为 undefined"：
      // <zh/> getter 合法返回 undefined（字段缺失/null 值链）时也应命中缓存，避免每次筛选重算。
      // <en/> Hit test uses "already computed" (has) instead of "value !== undefined": a getter
      // <en/> legitimately returning undefined (missing field / null chain) must still hit the cache
      // <en/> to avoid recomputation on every filter evaluation.
      if (rowCache.has(columnKey))
        return rowCache.get(columnKey)
      const value = getter(row, rowIndex)
      rowCache.set(columnKey, value)
      return value
    }

    /**
     * <zh/> 索引敏感列（format/valueGetter）单槽位取值：同 (行, 列, 索引) 命中，
     * <zh/> 索引变化即覆写重算。每格恒占一槽，不堆积。
     * <en/> Single-slot lookup for index-sensitive columns (format/valueGetter): hits on the
     * <en/> same (row, column, index), recomputes by overwrite on index change. One slot per cell, never accumulates.
     */
    function getOrCacheIndexSensitiveCellValue(rowObj: object, columnKey: string, getter: (row: any, rowIndex: number) => unknown, row: any, rowIndex: number): unknown {
      let rowCache = indexSensitiveCache.get(rowObj)
      if (!rowCache) {
        rowCache = new Map()
        indexSensitiveCache.set(rowObj, rowCache)
      }
      const slot = rowCache.get(columnKey)
      if (slot && slot.index === rowIndex)
        return slot.value
      const value = getter(row, rowIndex)
      rowCache.set(columnKey, { index: rowIndex, value })
      return value
    }

    const result = rows.filter((row, rowIndex) => {
      return filters.every(({ columnKey, getCellValue, filterValue, indexSensitive }) => {
        // <zh/> WeakMap 以行对象为键，避免排序/浅拷后索引错位
        // <en/> WeakMap keyed by row object to avoid index drift after sort/shallow-copy
        const rowObj = row as object
        const cellValue = row != null && typeof row === 'object'
          ? (indexSensitive
              // <zh/> 索引敏感列走独立单槽位缓存：同序重筛命中（保性能），重排后覆写（保正确）
              // <en/> Index-sensitive columns use the dedicated single-slot cache: hits on same-order re-filter, overwrite after reorder
              ? getOrCacheIndexSensitiveCellValue(rowObj, columnKey, getCellValue, row, rowIndex)
              : getOrCacheCellValue(rowObj, columnKey, getCellValue, row, rowIndex))
          : getCellValue(row, rowIndex)
        return matchesFilter(cellValue, filterValue, getStrategy)
      })
    })

    const next = { data: result, isFiltered: true }
    if (prev && prev.isFiltered === next.isFiltered && prev.data === next.data)
      return prev
    return next
  })

  return {
    filterState,
    hasActiveFilter,
    setFilter,
    resetColumnFilter,
    resetAllFilters,
    getEnumOptions,
    filteredData,
    getFilterValue,
    isColumnFiltered,
    invalidateRowCache,
    dispose,
  }
}
