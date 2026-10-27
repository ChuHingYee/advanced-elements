import type { Ref } from 'vue'
import type { SortOrder, SortState } from '../../types/sort'
import type { UseColumnFilterReturn } from '../data/use-column-filter'
import type { UseColumnSortReturn } from '../data/use-column-sort'
import { computed, shallowRef } from 'vue'

/**
 * <zh/> noop API 存根依赖 | <en/> Noop API stub deps
 */
export interface PipelineNoopApisDeps {
  /** <zh/> 预创建的筛选状态（缺省自建） | <en/> pre-created filter state (self-created when absent) */
  injectedFilterState?: Ref<Record<string, any>>
  /** <zh/> 预创建的排序状态（缺省自建） | <en/> pre-created sort state (self-created when absent) */
  injectedSortState?: Ref<SortState[]>
}

/**
 * <zh/> 管线 noop API 存根——无可筛选列/无快速搜索文本/无可排序列时替代真实 composable，
 * <zh/> 保持接口完整；noop 期写入透传到共享状态 ref，升级后不丢失。
 *
 * <zh/> 自 use-table-data-pipeline.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改。
 * <en/> Pipeline noop API stubs — replace the real composables when no filterable columns / quick
 * <en/> text / sortable columns exist, keeping the interface intact; noop-phase writes pass through
 * <en/> to the shared state refs and survive the upgrade.
 *
 * <en/> Migrated verbatim from use-table-data-pipeline.ts (COMPLEXITY-PLAN battle line 3, knife C).
 */
export function createPipelineNoopApis(deps: PipelineNoopApisDeps = {}) {
  const { injectedFilterState, injectedSortState } = deps

  /**
   * <zh/> 列筛选 noop——无线筛选项时替代真实 useColumnFilter，保持接口完整 | <en/> Column filter noop — replaces real useColumnFilter when no filterable columns exist, keeping the interface intact
   */
  const noopFilterData = computed(() => ({ data: [] as any[], isFiltered: false }))
  const noopFilterState = injectedFilterState ?? shallowRef<Record<string, any>>({})
  const noopFilterApi = {
    filterState: noopFilterState,
    hasActiveFilter: computed(() => false),
    /**
     * <zh/> noop 期的写入透传到底层共享 filterState——升级为真实 composable 后状态不丢失，
     * <zh/> 而不是静默丢弃（用户在"无可筛选列"窗口设置后的列筛选会蒸发）。
     * <en/> Writes during the noop phase pass through to the shared filterState so they survive
     * <en/> the upgrade to a real composable instead of being silently dropped.
     */
    setFilter: (prop: string, value: any) => {
      noopFilterState.value = { ...noopFilterState.value, [prop]: value }
    },
    resetColumnFilter: (prop: string) => {
      if (prop in noopFilterState.value) {
        const next = { ...noopFilterState.value }
        delete next[prop]
        noopFilterState.value = next
      }
    },
    resetAllFilters: () => {
      noopFilterState.value = {}
    },
    getEnumOptions: (_prop: string) => [],
    filteredData: noopFilterData,
    getFilterValue: (prop: string) => noopFilterState.value[prop],
    isColumnFiltered: (prop: string) => {
      const v = noopFilterState.value[prop]
      return v != null && v !== false
    },
    invalidateRowCache: (_row?: object | null) => {},
    dispose: () => {},
  } as const

  /**
   * <zh/> 快速筛选 noop——无快速搜索文本时替代真实 useQuickFilter | <en/> Quick filter noop — replaces real useQuickFilter when no quick filter text exists
   */
  const noopQuickFilterData = computed(() => ({ data: [] as any[], isFiltered: false }))
  const noopQuickFilterApi = {
    filteredData: noopQuickFilterData,
    hasActiveQuickFilter: computed(() => false),
    invalidateRowCache: (_rowKey: string | number) => {},
    invalidateRowCacheBatch: (_rowKeys: (string | number)[]) => {},
    dispose: () => {},
  } as const

  /**
   * <zh/> 排序 noop——无可排序列时替代真实 useColumnSort | <en/> Sort noop — replaces real useColumnSort when no sortable columns exist
   */
  const noopSortData = computed(() => ({ data: [] as any[], isSorted: false }))
  const noopSortState = injectedSortState ?? shallowRef<SortState[]>([])
  const noopSortApi = {
    sortState: noopSortState,
    // <zh/> noop 期的写入透传到底层共享 sortState（理由同 noopFilterApi.setFilter） | <en/> Pass noop-phase writes through to the shared sortState (same rationale as noopFilterApi.setFilter)
    toggleSort: (prop: string, _event?: { shiftKey?: boolean }) => {
      const list = noopSortState.value
      const idx = list.findIndex(s => s.prop === prop || s.columnKey === prop)
      if (idx < 0) {
        noopSortState.value = [{ prop, order: 'ascending' } as SortState]
      }
      else if (list[idx].order === 'ascending') {
        noopSortState.value = list.map((s, i) => (i === idx ? { ...s, order: 'descending' } : s) as SortState)
      }
      else {
        noopSortState.value = list.filter((_, i) => i !== idx)
      }
    },
    setSort: (prop: string, order: SortOrder) => {
      noopSortState.value = [{ prop, order } as SortState]
    },
    setSorts: (sorts: SortState[]) => {
      noopSortState.value = [...sorts]
    },
    clearSort: () => {
      noopSortState.value = []
    },
    getSortOrder: (columnKey: string) => {
      const s = noopSortState.value.find(x => x.prop === columnKey || x.columnKey === columnKey)
      return (s?.order ?? null) as SortOrder
    },
    getSortIndex: (columnKey: string) => {
      const idx = noopSortState.value.findIndex(x => x.prop === columnKey || x.columnKey === columnKey)
      return idx >= 0 ? idx : -1
    },
    sortedData: noopSortData,
    dispose: () => {},
  } as const

  return {
    noopFilterApi: noopFilterApi as unknown as UseColumnFilterReturn,
    noopQuickFilterApi: noopQuickFilterApi as unknown as import('../data/use-quick-filter').UseQuickFilterReturn,
    noopSortApi: noopSortApi as unknown as UseColumnSortReturn,
    noopFilterState,
    noopSortState,
  }
}
