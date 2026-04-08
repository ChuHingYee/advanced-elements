import type { MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { SortOrder, SortState } from '../../types/sort'
import { computed, toValue } from 'vue'
import { buildColumnKeyMap, getColumnKey, resolveColumnProp } from '../../utils/shared'

const ASC = 'ascending' as const
const DESC = 'descending' as const

/**
 * <zh/> 排序状态机依赖 | <en/> Sort state-machine deps
 */
export interface UseColumnSortStateDeps {
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  sortState: Ref<SortState[]>
  maxSortColumns?: MaybeRefOrGetter<number | undefined>
}

/**
 * <zh/> 排序状态机——sortState 的全部变更/查询 API（colMap 缓存、toSortEntry 归一、
 * <zh/> toggle 单/多列、capMultiSort 上限裁剪、setSort/setSorts、getSortOrder/getSortIndex）。
 *
 * <zh/> 自 use-column-sort.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），函数体逐字未改。
 * <en/> Sort state machine — every sortState mutation/query API (colMap cache, toSortEntry
 * <en/> normalization, single/multi toggle, capMultiSort eviction, setSort/setSorts,
 * <en/> getSortOrder/getSortIndex).
 *
 * <en/> Migrated verbatim from use-column-sort.ts (COMPLEXITY-PLAN battle line 3, knife C).
 */
export function useColumnSortState(deps: UseColumnSortStateDeps) {
  const { columns, sortState, maxSortColumns } = deps

  /**
   * <zh/> 缓存的列主键 Map——基于 columns computed 缓存，避免 resolveColumnKey 每次调用都重建 O(n) Map
   * <en/> Cached column-key Map — based on columns computed, avoids rebuilding O(n) Map on every resolveColumnKey call
   */
  const colMap = computed(() => buildColumnKeyMap(toValue(columns)))

  /**
   * <zh/> 将调用方传入的 prop/columnKey 解析为内部主键：优先取列定义的 columnKey，
   * <zh/> 找不到时按原值（本身即 columnKey 或外部手动构造的 prop）兜底。
   * <zh/> 使用缓存的 colMap computed，避免每次调用都重建 Map。
   * <en/> Resolve caller-supplied prop/columnKey into the internal primary key:
   * <en/> prefer the column's columnKey; fall back to the raw value otherwise.
   * <en/> Uses the cached colMap computed to avoid rebuilding Map on every call.
   */
  function resolveColumnKey(input: string): string {
    const col = colMap.value.get(input)
    if (col)
      return getColumnKey(col)
    return input
  }

  function toSortEntry(prop: string, order: SortOrder): SortState {
    const columnKey = resolveColumnKey(prop)
    // <zh/> prop 必须保留数据字段（供 autoParams 发服务端），columnKey 保留列身份；
    // <zh/> key!==prop 时禁止把 canonical key 写进 prop。
    // <en/> `prop` must stay the data field (autoParams sends it to the server) while `columnKey` keeps
    // <en/> the column identity; the canonical key must never be written into `prop`.
    const col = colMap.value.get(prop) ?? colMap.value.get(columnKey)
    const dataProp = col ? (resolveColumnProp(col as unknown as Record<string, any>) ?? columnKey) : prop
    return { prop: dataProp, order, columnKey }
  }

  function toggleSort(prop: string, event?: { shiftKey?: boolean }) {
    const key = resolveColumnKey(prop)
    if (event?.shiftKey) {
      toggleSortMulti(key)
    }
    else {
      toggleSortSingle(key)
    }
  }

  function toggleSortSingle(key: string) {
    const current = sortState.value
    if (current.length > 0 && (current[0].columnKey ?? current[0].prop) === key) {
      if (current[0].order === ASC) {
        sortState.value = [toSortEntry(key, DESC)]
      }
      else if (current[0].order === DESC) {
        sortState.value = []
      }
      else {
        sortState.value = [toSortEntry(key, ASC)]
      }
    }
    else {
      sortState.value = [toSortEntry(key, ASC)]
    }
  }

  function toggleSortMulti(key: string) {
    const current = sortState.value
    const existingIndex = current.findIndex(s => (s.columnKey ?? s.prop) === key)

    if (existingIndex >= 0) {
      if (current[existingIndex].order === ASC) {
        const next = current.map(s => ({ ...s }))
        next[existingIndex] = toSortEntry(key, DESC)
        sortState.value = next
      }
      else {
        sortState.value = current.filter(s => (s.columnKey ?? s.prop) !== key)
      }
    }
    else {
      sortState.value = capMultiSort([...current, toSortEntry(key, ASC)])
    }
  }

  /**
   * <zh/> 多列排序上限裁剪——超出 maxSortColumns 时淘汰最早的排序列（FIFO）；
   * <zh/> 设为 1 等价于关闭多列排序；未配置时不限（向后兼容）。
   * <zh/> 同时按键去重并保留末次声明，保证 sortState 键唯一（比较器按序应用的前提）。
   * <en/> Multi-sort cap — evict the oldest sort columns (FIFO) beyond maxSortColumns;
   * <en/> setting it to 1 effectively disables multi-sort; unlimited when unset.
   * <en/> Also dedupes by key keeping the last declaration, guaranteeing unique keys in
   * <en/> sortState (a precondition for the comparator applying entries in order).
   */
  function capMultiSort(entries: SortState[]): SortState[] {
    const seen = new Set<string>()
    const deduped: SortState[] = []
    for (let i = entries.length - 1; i >= 0; i--) {
      const k = entries[i].columnKey ?? entries[i].prop
      if (seen.has(k))
        continue
      seen.add(k)
      deduped.unshift(entries[i])
    }
    const max = toValue(maxSortColumns)
    return max != null && max >= 1 && deduped.length > max
      ? deduped.slice(deduped.length - max)
      : deduped
  }

  function setSort(prop: string, order: SortOrder) {
    if (order) {
      sortState.value = [toSortEntry(prop, order)]
    }
    else {
      // <zh/> order 为空仅移除该列（与 toggleSortMulti 移除语义一致），禁止清空全部
      // <en/> Null order removes only this column (same as toggleSortMulti removal), never clears all
      const key = resolveColumnKey(prop)
      const current = sortState.value
      const next = current.filter(s => (s.columnKey ?? s.prop) !== key)
      if (next.length !== current.length)
        sortState.value = next
    }
  }

  function setSorts(sorts: SortState[]) {
    // <zh/> 编程式批量设置与点击路径共用同一上限/去重裁剪（点击路径同样受 maxSortColumns 约束）
    // <en/> Programmatic batch set shares the same cap/dedupe as the click path
    // <en/> (historically bypassed maxSortColumns — fixed)
    sortState.value = capMultiSort(
      sorts
        .filter(s => s.prop && s.order)
        .map((s) => {
          // <zh/> 优先用调用方显式 columnKey 定列，避免重派生丢失；prop 仍经 toSortEntry 归一化为数据字段
          // <en/> Prefer the caller-provided columnKey for identity; prop is still normalized to the data field
          const entry = toSortEntry(s.columnKey ?? s.prop, s.order)
          if (s.columnKey)
            entry.columnKey = s.columnKey
          return entry
        }),
    )
  }
  function getSortOrder(columnKey: string): SortOrder {
    const entry = sortState.value.find(s => s.columnKey === columnKey || s.prop === columnKey)
    return entry?.order ?? null
  }

  function getSortIndex(columnKey: string): number {
    return sortState.value.findIndex(s => s.columnKey === columnKey || s.prop === columnKey)
  }

  return {
    colMap,
    toggleSort,
    setSort,
    setSorts,
    getSortOrder,
    getSortIndex,
  }
}
