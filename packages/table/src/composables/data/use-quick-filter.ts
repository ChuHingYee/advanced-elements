import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { ProcessedColumn } from '../../types'
import { computed, shallowRef, toValue, watch } from 'vue'
import { flattenLeafColumns } from '../../utils/column-tree'
import { getColumnKey } from '../../utils/shared'
import { resolveCellDisplayValue, resolveCellValue } from '../../utils/value-pipeline'

export interface UseQuickFilterOptions<T = any> {
  /** <zh/> 全局搜索文本（空/undefined = 禁用） | <en/> Quick filter text string (empty/undefined = disabled) */
  quickFilterText: MaybeRefOrGetter<string | undefined>
  /** <zh/> 待筛选的数据 | <en/> Data to filter */
  data: MaybeRefOrGetter<T[]>
  /** <zh/> 所有列（含分组列） | <en/> All columns (including group columns) */
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  /**
   * <zh/> 行唯一标识函数，用于原地编辑时精确失效缓存
   * <en/> Row key function for cache invalidation on in-place edits
   * @param row - <zh/> 行数据 | <en/> row data
   * @param index - <zh/> 行索引 | <en/> row index
   * @returns <zh/> 行唯一标识 | <en/> row unique identifier
   */
  rowKey?: (row: T, index: number) => string
  /** <zh/> 行文本缓存上限，超过时淘汰最旧条目，默认 5000 | <en/> Row text cache size limit, evicts oldest entries when exceeded, default 5000 */
  cacheSize?: number
}

export interface UseQuickFilterReturn {
  /**
   * Filtered data with active flag
   * 筛选后的数据及是否激活标记
   */
  filteredData: ComputedRef<{ data: any[], isFiltered: boolean }>
  /**
   * Whether quick filter is currently active (non-empty text)
   * quickFilter 是否激活（非空文本）
   */
  hasActiveQuickFilter: ComputedRef<boolean>
  /**
   * Invalidate cache for a specific row by its rowKey
   * 按 rowKey 清除单条缓存条目，用于原地编辑场景
   * @param rowKey - 行唯一标识
   */
  invalidateRowCache: (rowKey: string | number) => void
  /**
   * Invalidate cache for multiple rows by their rowKeys in a single call
   * 批量按 rowKey 清除缓存条目，用于批量编辑/导入等场景，避免逐行 Map.delete 调用开销
   * @param rowKeys - 行唯一标识数组 | <en/> row unique identifiers
   */
  invalidateRowCacheBatch: (rowKeys: (string | number)[]) => void
  /**
   * <zh/> 停止内部 watch 并清空缓存（幂等）——动态创建场景的资源兜底回收入口
   * <en/> Stop internal watches and clear caches (idempotent) — resource fallback for dynamic creation
   */
  dispose?: () => void
}

/**
 * <zh/> 全局文本搜索 composable
 *
 * <zh/> 遍历所有可见列的格式化单元格值，返回任一列包含搜索文本的行。
 * <en/> Global text search composable
 *
 * <en/> Iterates formatted cell values of all visible columns, returns rows where any column contains the search text.
 */
export function useQuickFilter<T = any>(
  options: UseQuickFilterOptions<T>,
): UseQuickFilterReturn {
  const { quickFilterText, data, columns, rowKey, cacheSize } = options

  /**
   * 当前是否启用了全局搜索（非空文本）
   * Whether quick filter is currently active (non-empty text)
   */
  const hasActiveQuickFilter = computed(() => {
    const text = toValue(quickFilterText)
    return text !== undefined && text !== ''
  })

  /**
   * 参与全局搜索的叶子列列表（预计算缓存，排除 selection、option 及 quickFilterSuppress 列）
   * Pre-computed list of leaf columns that participate in quickFilter
   * (excludes selection, option, and quickFilterSuppress columns)
   *
   * @returns 可参与搜索的列数组
   */
  const quickFilterColumns = computed<ProcessedColumn[]>((prev) => {
    const cols = toValue(columns)
    const leafCols = flattenLeafColumns(cols)
    const result = leafCols.filter((col) => {
      if (col.selection)
        return false
      if (col.valueType === 'option')
        return false
      if ((col as Record<string, unknown>).quickFilterSuppress === true)
        return false
      return true
    })
    if (prev && prev.length === result.length && prev.every((c, i) => c === result[i]))
      return prev
    return result
  })

  /**
   * 为每个叶子列预计算取值函数（缓存 valueGetter/format/valueEnum 转换结果）
   * For each leaf column, pre-compute a getCellValue function that
   * respects valueGetter, format, and valueEnum, so the filtering computed
   * below only needs to call the pre-built getter.
   *
   * []>}
   *   列 key 与对应取值函数的数组
   */
  const columnGetters = computed(() => {
    const cols = toValue(quickFilterColumns)
    const allCols = toValue(columns)
    // <zh/> columnIndex 必须是大表下标（format 回调依赖），子集下标错位；预建 Map O(1) 解析
    // <en/> columnIndex must be the full-table index (format callbacks depend on it); pre-build a Map
    const fullIndexMap = new Map<ProcessedColumn, number>()
    for (let i = 0; i < allCols.length; i++)
      fullIndexMap.set(allCols[i], i)
    return cols.map((col) => {
      const prop = col.prop as string | undefined
      const key = getColumnKey(col)
      const fullColIndex = fullIndexMap.get(col) ?? allCols.indexOf(col as ProcessedColumn)

      let getValue: (row: any, rowIndex?: number) => unknown

      if (!prop && !col.valueGetter) {
        getValue = () => undefined
      }
      else if (col.format) {
        getValue = (row: any, rowIndex?: number) => resolveCellDisplayValue(row, col, rowIndex ?? 0, allCols, fullColIndex)
      }
      else if (col.valueEnum) {
        getValue = (row: any) => {
          const rawVal = resolveCellValue(row, col, 0)
          if (rawVal == null)
            return undefined
          const enumItem = col.valueEnum![String(rawVal)]
          if (enumItem) {
            return typeof enumItem === 'string' ? enumItem : enumItem.text
          }
          return rawVal
        }
      }
      else if (col.valueGetter) {
        getValue = (row: any, rowIndex?: number) => resolveCellValue(row, col, rowIndex ?? 0)
      }
      else {
        getValue = (row: any) => row[prop!]
      }

      return { key, getValue }
    })
  })

  /**
   * 行级文本持久缓存：将每行所有列的值拼接后统一 toLowerCase 一次，
   * 跨 computed 求值持久化，避免每次搜索文本变化时重建 Map。
   * 数据源变化或列配置变化时由 watch 清空。
   *
   * Persistent per-row text cache: concatenates all column values and lowercases once.
   * Persists across computed evaluations, avoiding Map rebuild on each search text change.
   * Cleared by watch when data source or column config changes.
   */
  /**
   * <zh/> 缓存容量上限——默认值随数据规模自适应：`max(行数×1.2, 5000)`。
   * <zh/> 约束：禁止固定 5000；数据超过该值时每次击键触发 FIFO 滚动淘汰，
   * <zh/> 命中率趋零并退化为 O(n×cols) 全量重算。显式传入 cacheSize 时以其为下限。
   * <zh/> 惰性求值：异步加载的数据到达后容量随之增长，无需重建 composable。
   * <en/> Cache capacity — adapts to data scale: `max(rows×1.2, 5000)`. Invariant: never fix at 5000;
   * <en/> datasets beyond it cause FIFO thrash on every keystroke, collapsing hit-rate to ~0 and
   * <en/> degrading into full O(n×cols) recomputation. An explicit cacheSize acts as the floor.
   * <en/> Lazily evaluated so capacity grows when async data arrives, no composable rebuild needed.
   */
  const userCacheFloor = cacheSize ?? 5000
  function getMaxCacheSize(): number {
    const dataLength = toValue(data)?.length ?? 0
    return Math.max(Math.ceil(dataLength * 1.2), userCacheFloor)
  }
  const cacheVersion = shallowRef(0)
  const rowTextCache = new Map<string, { row: T, rowIndex: number, text: string }>()
  /** <zh/> 无 rowKey 时的弱引用缓存——以行对象为键，避免索引移位导致的旧文本命中 | <en/> Weak cache for no-rowKey case — keyed by row object to avoid stale hits from index shifts */
  let rowTextWeakCache = new WeakMap<object, { rowIndex: number, text: string }>()

  const stopDataWatch = watch(() => toValue(data), () => {
    rowTextCache.clear()
    rowTextWeakCache = new WeakMap()
  }, { flush: 'sync' })

  /**
   * <zh/> valueEnum 的稳定内容键——valueEnum 允许原地改 label（引用不变，深监听才检得到）。
   * <zh/> 序列化失败（cycle/异常）时退回引用身份：宁可漏检一次也不让签名计算抛错炸掉 watch。
   * <en/> Stable content key for valueEnum — labels may be edited in place (reference unchanged, only
   * <en/> a deep watch caught that). On serialization failure (cycle/throw) it degrades to reference
   * <en/> identity: a missed invalidation beats a signature computation that throws and breaks the watch.
   */
  function valueEnumContentKey(valueEnum: unknown): string {
    if (valueEnum == null || typeof valueEnum !== 'object')
      return ''
    try {
      return JSON.stringify(valueEnum)
    }
    catch {
      return '[unserializable]'
    }
  }

  /**
   * <zh/> 影响行文本取值的列签名——key / prop / format / valueGetter / valueEnum 内容。
   * <zh/> 替代 `watch(columns, { deep: true })`：深监听在每次嵌套赋值都触发，而签名只在**取值口径**
   * <zh/> 变化时变，避免配置里无关字段抖动导致缓存被反复清空。
   * <en/> Column signature of everything that affects row-text resolution — key/prop/format/
   * <en/> valueGetter/valueEnum contents. Replaces `watch(columns, { deep: true })`: a deep watch
   * <en/> fires on every nested assignment, whereas the signature only changes when the **value
   * <en/> caliber** changes, so unrelated config churn no longer clears the cache repeatedly.
   */
  const columnsTextKey = computed<unknown[]>((previous) => {
    const next = toValue(columns).flatMap(c => [
      getColumnKey(c),
      c.prop,
      c.format,
      c.valueGetter,
      valueEnumContentKey(c.valueEnum),
    ])
    return previous && previous.length === next.length && next.every((value, index) => Object.is(value, previous[index]))
      ? previous
      : next
  })

  /**
   * 列配置变化时清空缓存（参与搜索的列或取值函数可能已变）
   * Clear cache on column config change (columns involved in search or their value functions may have changed)
   * <zh/> 以 columnsTextKey 签名为源而非深监听：签名已覆盖全部取值相关字段；
   * <zh/> 原地修改 format/valueGetter/valueEnum 时签名中的函数引用会变，仍能命中。
   * <en/> Watches the columnsTextKey signature rather than deep-tracking: the signature covers every
   * <en/> value-affecting field, and in-place format/valueGetter/valueEnum edits still change the
   * <en/> referenced function and are detected.
   */
  const stopColumnsWatch = watch(columnsTextKey, () => {
    rowTextCache.clear()
    rowTextWeakCache = new WeakMap()
    cacheVersion.value++
  }, { flush: 'sync' })

  /**
   * <zh/> 停止内部 watch 并清空行文本缓存，幂等可重复调用。
   * <zh/> 供动态创建场景兜底：本 composable 可能在管线 watch 回调（无实例上下文）中创建，
   * <zh/> 内部 watch 不归属任何 effect scope，须由调用方经 dispose 停止，
   * <zh/> 否则随数据源存续整个应用生命周期（参见 use-table-data-pipeline 升级注册表）。
   * <en/> Stop internal watches and clear the row text cache; idempotent.
   * <en/> Fallback for dynamic creation: this composable may be created inside a pipeline watch
   * <en/> callback (no instance context), where its watches belong to no effect scope — the caller
   * <en/> must stop them via dispose, otherwise they live as long as the data source
   * <en/> (see the upgrade registry in use-table-data-pipeline).
   */
  function dispose(): void {
    stopDataWatch()
    stopColumnsWatch()
    rowTextCache.clear()
    rowTextWeakCache = new WeakMap()
  }

  /**
   * <zh/> 按 rowKey 清除单条缓存条目
   * <zh/> 用于原地编辑场景：编辑提交后调用此方法使缓存失效
   * @param rowKeyVal - <zh/> 行唯一标识 | <en/> row unique identifier
   * <en/> Clear a single cache entry by rowKey
   * <en/> Used in inline editing scenarios: call this method after edit commit to invalidate cache
   */
  function invalidateRowCache(rowKeyVal: string | number): void {
    invalidateRowCacheBatch([rowKeyVal])
  }

  /**
   * <zh/> 批量按 rowKey 清除缓存条目——用于批量编辑/导入等场景
   * <zh/> 单次调用遍历 rowKeys 执行 Map.delete，避免 N 次 invalidateRowCache 调用的函数调用开销
   * @param rowKeys - <zh/> 行唯一标识数组 | <en/> row unique identifiers
   * <en/> Batch invalidate cache entries by rowKeys — for batch edit/import scenarios
   * <en/> Single call iterates rowKeys performing Map.delete, avoiding N function call overhead of invalidateRowCache
   */
  function invalidateRowCacheBatch(rowKeys: (string | number)[]): void {
    if (rowKeys.length === 0)
      return
    if (rowKey) {
      for (const key of rowKeys)
        rowTextCache.delete(String(key))
    }
    else {
      rowTextWeakCache = new WeakMap()
    }
    cacheVersion.value++
  }

  /**
   * 筛选后的数据结果，包含 isFiltered 标记以区分"无搜索"和"搜索无结果"
   * Filtered data result with isFiltered flag to distinguish
   * "no search" from "search returned no results"
   *
   * 行级字符串缓存已提升为 composable 级别持久缓存，
   * 数据/列变化时由 watch 清空，搜索文本变化时复用已有缓存。
   *
   * >}
   *   - isFiltered=false: 未启用搜索，返回原始数据
   *   - isFiltered=true: 已搜索，返回匹配行（可能为空数组）
   */
  const filteredData = computed<{ data: any[], isFiltered: boolean }>((prev) => {
    void cacheVersion.value
    const rows = toValue(data)
    const query = toValue(quickFilterText)

    if (!query || query === '') {
      if (prev && !prev.isFiltered && prev.data === rows)
        return prev
      return { data: rows, isFiltered: false }
    }

    const lowerQuery = query.toLowerCase()
    const getters = columnGetters.value

    if (getters.length === 0) {
      const next = { data: [] as never[], isFiltered: true }
      if (prev && prev.isFiltered && prev.data.length === 0)
        return prev
      return next
    }

    /**
     * <zh/> 使用 composable 级 rowTextCache，跨搜索文本变化持久化。
     * <zh/> 仅当行数据或列配置变化时（由 watch 清空）才需重建。
     * <en/> Uses composable-level rowTextCache, persisted across search text changes.
     * <en/> Only needs rebuild when row data or column config changes (cleared by watch).
     */
    function getRowLowerText(rowIndex: number, row: any): string {
      // 无 rowKey 时以行对象为弱键，彻底避免索引移位导致的旧数据命中
      if (!rowKey) {
        const weakCached = rowTextWeakCache.get(row as object)
        if (weakCached?.rowIndex === rowIndex)
          return weakCached.text
        const parts: string[] = []
        for (const { getValue } of getters) {
          const cellValue = getValue(row, rowIndex)
          if (cellValue != null) {
            const str = String(cellValue)
            if (str !== '')
              parts.push(str)
          }
        }
        const lower = parts.join('\u0000').toLowerCase()
        rowTextWeakCache.set(row as object, { rowIndex, text: lower })
        return lower
      }
      const cacheKey = rowKey(row, rowIndex) || String(rowIndex)
      const cached = rowTextCache.get(cacheKey)
      if (cached && cached.row === row && cached.rowIndex === rowIndex) {
        // <zh/> 命中直接返回，不做 delete+set 热度提升：筛选是击键高频路径，写放大得不偿失；
        // <zh/> 淘汰退化为 FIFO（首键即最久插入），由容量上限保证内存有界。
        // <en/> Return on hit without delete+set promotion: filtering is keystroke-hot, write amplification costs more than it saves;
        // <en/> eviction degrades to FIFO (first key is oldest insertion), bounded by capacity.
        return cached.text
      }
      const parts: string[] = []
      for (const { getValue } of getters) {
        const cellValue = getValue(row, rowIndex)
        if (cellValue != null) {
          const str = String(cellValue)
          if (str !== '')
            parts.push(str)
        }
      }
      const lower = parts.join('\u0000').toLowerCase()
      if (rowTextCache.size >= getMaxCacheSize()) {
        // <zh/> FIFO 淘汰（无命中提升，见上）：Map 首键即最早插入
        // <en/> FIFO eviction (no hit promotion, see above): first key is the earliest inserted
        const oldestKey = rowTextCache.keys().next().value
        if (oldestKey !== undefined)
          rowTextCache.delete(oldestKey)
      }
      rowTextCache.set(cacheKey, { row, rowIndex, text: lower })
      return lower
    }

    const result = rows.filter((row, rowIndex) => {
      return getRowLowerText(rowIndex, row).includes(lowerQuery)
    })

    const next = { data: result, isFiltered: true }
    if (prev && prev.isFiltered === next.isFiltered && prev.data === next.data)
      return prev
    return next
  })

  return {
    filteredData,
    hasActiveQuickFilter,
    invalidateRowCache,
    invalidateRowCacheBatch,
    dispose,
  }
}
