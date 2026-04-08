import type { ColumnSortableConfig, ProcessedColumn } from '../../types'
import type { SortState } from '../../types/sort'
import type { SortEntry } from './sort-plan'
import { buildColumnKeyMap, getColumnKey } from '../../utils/shared'
import { compareSortValues } from '../../utils/sort-comparator'
import { getCachedSortAccessor } from './sort-accessor'

const ASC = 'ascending' as const

/**
 * <zh/> 排序计划纯函数层——resolveSortableConfig / buildSortEntries / computeSortedData /
 * <zh/> buildColumnsSortKey（自 use-column-sort.ts 原样迁出，COMPLEXITY-PLAN 战线三，刀法 A）。
 *
 * <zh/> 唯一签名变化：computeSortedData 由闭包读 `toValue(data)/sortState.value/toValue(columns)`
 * <zh/> 改为显式入参 `(rows, sorts, cols)`（纯函数化；调度器侧经零参包装适配）。
 * <en/> Sort-plan pure layer — resolveSortableConfig / buildSortEntries / computeSortedData /
 * <en/> buildColumnsSortKey (migrated verbatim from use-column-sort.ts, COMPLEXITY-PLAN battle
 * <en/> line 3, knife A).
 *
 * <en/> Sole signature change: computeSortedData takes explicit `(rows, sorts, cols)` args instead
 * <en/> of reading `toValue(data)/sortState.value/toValue(columns)` from the closure (purified;
 * <en/> the scheduler adapts via a zero-arg wrapper).
 */
/**
 * <zh/> 解析列的 sortable 配置对象——统一提取逻辑，消除 buildSortEntries 和 shouldUseWorker 中的重复代码
 * <en/> Resolve column's sortable config object — unifies extraction logic, eliminating duplication between buildSortEntries and shouldUseWorker
 *
 * @param col - <zh/> 列定义（可为 undefined） | <en/> column definition (can be undefined)
 * @returns <zh/> ColumnSortableConfig 或 undefined | <en/> ColumnSortableConfig or undefined
 */
export function resolveSortableConfig(col: ProcessedColumn | undefined): ColumnSortableConfig | undefined {
  if (!col)
    return undefined
  const sortable = col.sortable
  return typeof sortable === 'object' && sortable !== null
    ? (sortable as ColumnSortableConfig)
    : undefined
}

/**
 * <zh/> 构建排序条目并检测服务端排序委托
 * <en/> Build sort entries and detect server-side sort delegation
 *
 * @remarks
 * <zh/> 统一 computeSortedData 和 requestWorkerSort 的重复逻辑：
 * <zh/> 1. 过滤有效排序状态 → 2. 检测服务端/custom 排序 → 3. 编译 SortEntry 数组
 * <en/> Unifies duplicated logic between computeSortedData and requestWorkerSort:
 * <en/> 1. Filter valid sort states → 2. Detect server/custom sort → 3. Compile SortEntry array
 *
 * @returns <zh/> `{ sortEntries, isServerSort }` — isServerSort=true 时调用方应跳过本地排序 | <en/> `{ sortEntries, isServerSort }` — caller should skip local sort when isServerSort=true
 */
export function buildSortEntries<T>(
  sorts: SortState[],
  cols: ProcessedColumn[],
  prebuiltColMap?: Map<string, ProcessedColumn>,
): { sortEntries: SortEntry<T>[], isServerSort: boolean, hasCustomSortMethod: boolean } {
  const activeSorts = sorts.filter(sort => sort.prop && sort.order)
  if (!activeSorts.length) {
    return { sortEntries: [], isServerSort: false, hasCustomSortMethod: false }
  }

  const map = prebuiltColMap ?? buildColumnKeyMap(cols)

  // <zh/> 检测服务端/custom 排序委托 <en/> Detect server/custom sort delegation
  let hasCustomSortMethod = false
  for (const sort of activeSorts) {
    const col = map.get(sort.columnKey ?? sort.prop)
    const sortable = col?.sortable
    if (sortable === 'custom' || (typeof sortable === 'object' && sortable?.type === 'server')) {
      return { sortEntries: [], isServerSort: true, hasCustomSortMethod: false }
    }
    const sortableConfig = resolveSortableConfig(col)
    if (sortableConfig?.sortMethod)
      hasCustomSortMethod = true
  }

  // <zh/> 预构建列索引 Map，避免在编译条目循环中每次执行 O(n) 的 cols.indexOf(col) | <en/> Pre-build column index map to avoid O(n) cols.indexOf(col) inside the sort entry compile loop
  const indexMap = new Map<ProcessedColumn, number>()
  for (let i = 0; i < cols.length; i++)
    indexMap.set(cols[i], i)

  // <zh/> 编译排序条目——accessor 使用 WeakMap 缓存，避免每次 buildSortEntries 调用时重新编译 <en/> Compile sort entries — accessor cached via WeakMap to avoid recompilation on every buildSortEntries call
  const sortEntries: SortEntry<T>[] = activeSorts.map((sort) => {
    const col = map.get(sort.columnKey ?? sort.prop)
    if (!col || !col.sortable)
      return null
    const sortableConfig = resolveSortableConfig(col)
    const sortByConfig = sortableConfig?.sortBy ?? col.sortBy
    const sortByFormat = sortableConfig?.sortByFormat ?? false
    const sortMethod = sortableConfig?.sortMethod
    const colIndex = indexMap.get(col) ?? -1
    const fallbackProp = col.prop ?? sort.prop
    const accessor = getCachedSortAccessor(col, sortByConfig, fallbackProp, sortByFormat, cols, colIndex)
    const workerProp = typeof sortByConfig === 'string'
      ? (sortByConfig.includes('.') ? undefined : sortByConfig)
      : sortByConfig == null && !(sortByFormat && col.format) && !col.valueGetter
        ? fallbackProp
        : undefined
    const multiplier = sort.order === ASC ? 1 : -1
    return { accessor, multiplier, sortMethod, workerProp: sortMethod ? undefined : workerProp }
  }).filter((e): e is NonNullable<typeof e> => e !== null)

  return { sortEntries, isServerSort: false, hasCustomSortMethod }
}

export function computeSortedData<T>(rows: T[], sorts: SortState[], cols: ProcessedColumn[]): { data: T[], isSorted: boolean } {
  if (!sorts.length) {
    return { data: rows, isSorted: false }
  }

  const { sortEntries, isServerSort } = buildSortEntries(sorts, cols)

  if (isServerSort) {
    return { data: rows, isSorted: true }
  }

  if (!sortEntries.length) {
    return { data: rows, isSorted: false }
  }

  const len = rows.length
  const indices = Array.from({ length: len }, (_, i) => i)

  const entryCount = sortEntries.length
  // <zh/> 单列同样预取值：每行 accessor 只调用一次（n 次），比较器复用缓存值；
  // <zh/> 否则 format/valueGetter 列退化为每次比较取值（约 n·log n 次，10 万行 ≈ 170 万次调用）。
  // <en/> Single-column also pre-resolves keys: one accessor call per row (n total), comparator reuses cached values;
  // <en/> otherwise format/valueGetter columns degrade to per-comparison access (~n·log n calls, ~1.7M for 100k rows).
  if (entryCount === 1) {
    const entry = sortEntries[0]!
    if (entry.sortMethod) {
      indices.sort((indexA, indexB) => entry.sortMethod!(rows[indexA], rows[indexB]) * entry.multiplier)
    }
    else {
      const keys: unknown[] = Array.from({ length: len })
      for (let i = 0; i < len; i++)
        keys[i] = entry.accessor(rows[i], i)
      indices.sort((indexA, indexB) => {
        return compareSortValues(keys[indexA], keys[indexB], entry.multiplier)
      })
    }
  }
  else {
    // <zh/> 多列按需缓存：仅对参与比较的行分配 keys，降低峰值内存（原 flatKeys 预分配 len*entryCount）
    // <en/> Multi-column on-demand cache: allocate keys only for rows involved in comparisons, reducing peak memory (vs flatKeys len*entryCount pre-allocation)
    const keyCache = new Map<number, unknown[]>()
    const getKeys = (idx: number): unknown[] => {
      let keys = keyCache.get(idx)
      if (!keys) {
        keys = Array.from({ length: entryCount })
        for (let j = 0; j < entryCount; j++) {
          const entry = sortEntries[j]!
          keys[j] = entry.sortMethod ? undefined : entry.accessor(rows[idx]!, idx)
        }
        keyCache.set(idx, keys)
      }
      return keys
    }
    indices.sort((indexA, indexB) => {
      const keysA = getKeys(indexA)
      const keysB = getKeys(indexB)
      for (let i = 0; i < entryCount; i++) {
        const entry = sortEntries[i]!
        if (entry.sortMethod) {
          const result = entry.sortMethod(rows[indexA]!, rows[indexB]!) * entry.multiplier
          if (result !== 0)
            return result
        }
        else {
          const result = compareSortValues(keysA[i], keysB[i], entry.multiplier)
          if (result !== 0)
            return result
        }
      }
      return 0
    })
  }

  return { data: indices.map(i => rows[i]), isSorted: true }
}

export function buildColumnsSortKey(cols: ProcessedColumn[]): unknown[] {
  return cols.flatMap((c) => {
    const config = resolveSortableConfig(c)
    const sortBy = config?.sortBy ?? c.sortBy
    return [
      getColumnKey(c),
      c.prop,
      typeof c.sortable,
      config?.type ?? c.sortable,
      Array.isArray(sortBy),
      Array.isArray(sortBy) ? JSON.stringify(sortBy) : sortBy,
      config?.sortMethod,
      config?.sortByFormat,
      c.format,
      c.valueGetter,
      // <zh/> format 排序依赖全量列序（resolveCellDisplayValue 需 allCols+colIndex）：仅用列数+本列键作稳定代理，
      // <zh/> 禁止直接塞入 cols 数组引用（新引用必不等，保稳自我击败）
      // <en/> Format-sort depends on column order — use a stable proxy (length), never the cols array ref
      config?.sortByFormat && c.format ? cols.length : undefined,
    ]
  })
}
