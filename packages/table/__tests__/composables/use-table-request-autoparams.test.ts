import type { Ref } from 'vue'
import type { SortState } from '../../src/composables/data/use-column-sort'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTableRequest } from '../../src/composables/data/use-table-request'
import { resetDevWarnCacheForTests } from '../../src/utils/dev-warn'

/**
 * <zh/> 双路径契约测试——request.autoParams 开/关两条路径下，
 * <zh/> 晚绑定注入的排序/筛选状态（生产中由 sortFilterStateHolder 提供）必须正确进入请求载荷。
 * <zh/> 锁定未来“预创建共享状态”重构必须保持的行为。
 * <en/> Dual-path contract tests — with request.autoParams on/off,
 * <en/> late-bound sort/filter state (provided by sortFilterStateHolder in production) must land in the request payload.
 * <en/> Pins the behavior that the future "pre-created shared state" refactor must preserve.
 */
function buildManualRequest(overrides: {
  autoParamsConfig?: () => boolean | { sortKey?: string, filterKey?: string } | undefined
  autoSortState?: () => SortState[]
  autoFilterState?: () => Record<string, any>
  searchParams?: () => Record<string, any>
} = {}) {
  const isManual = ref(true)
  const request = vi.fn(async () => [] as any[])
  const result = useTableRequest<any>({
    requestSource: () => undefined,
    requestAuto: () => false,
    requestMode: () => 'paginated',
    formatMaps: () => undefined,
    paramKeys: () => undefined,
    transformRequest: () => undefined,
    transformResponse: () => undefined,
    urlStateEnabled: () => false,
    urlStatePageKey: () => 'p',
    urlStateSizeKey: () => 's',
    paginationOptions: {
      total: ref(0),
      paginationRef: ref(null),
      isManual,
    },
    searchParams: overrides.searchParams ?? (() => ({})),
    rowKeyFn: () => (r: any) => r.id,
    isManual,
    autoParamsConfig: overrides.autoParamsConfig,
    autoSortState: overrides.autoSortState,
    autoFilterState: overrides.autoFilterState,
    emits: {
      pageChange: vi.fn(),
      updateLoading: vi.fn(),
      request,
      refresh: vi.fn(),
      updateData: vi.fn(),
      dataChange: vi.fn(),
      onError: vi.fn(),
    },
  })
  return { result, request }
}

describe('useTableRequest autoParams dual path', () => {
  it('attaches late-bound sort/filter state when autoParams is on', async () => {
    // <zh/> 模拟生产 holder 语义：请求域创建时 holder 为空，管线就绪后回填
    // <en/> Mirrors the production holder semantics: empty at request-domain creation, backfilled once the pipeline is ready
    const holder: { sortState?: Ref<SortState[]>, filterState?: Ref<Record<string, any>> } = {}
    const { result, request } = buildManualRequest({
      autoParamsConfig: () => true,
      autoSortState: () => holder.sortState?.value ?? [],
      autoFilterState: () => holder.filterState?.value ?? {},
      searchParams: () => ({ q: 1 }),
    })
    holder.sortState = ref<SortState[]>([{ prop: 'name', order: 'descending' }])
    holder.filterState = ref<Record<string, any>>({ status: 'on' })
    await result.fetchData({ reason: 'sort' })
    expect(request).toHaveBeenCalledTimes(1)
    const payload = request.mock.calls[0][0]
    expect(payload.reason).toBe('sort')
    expect(payload.params).toMatchObject({
      q: 1,
      sort: [{ prop: 'name', order: 'desc' }],
      filter: { status: 'on' },
    })
  })

  it('passes searchParams through untouched when autoParams is off', async () => {
    const holder: { sortState?: Ref<SortState[]> } = {
      sortState: ref<SortState[]>([{ prop: 'name', order: 'descending' }]),
    }
    const { result, request } = buildManualRequest({
      searchParams: () => ({ q: 1 }),
      autoSortState: () => holder.sortState?.value ?? [],
    })
    await result.fetchData({ reason: 'refresh' })
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][0].params).toEqual({ q: 1 })
  })

  it('drops null-order sorts and omits empty sort/filter keys', async () => {
    const { result, request } = buildManualRequest({
      autoParamsConfig: () => true,
      autoSortState: () => [{ prop: 'a', order: null }],
      autoFilterState: () => ({}),
    })
    await result.fetchData({ reason: 'filter' })
    expect(request.mock.calls[0][0].params).toEqual({})
  })

  it('reads pre-created shared refs directly (post-holder wiring)', async () => {
    // <zh/> 生产新接线：data-columns 预创建后请求域与管线直连同一引用
    // <en/> New production wiring: data-columns pre-creates refs shared directly by the request domain and the pipeline
    const sortState = ref<SortState[]>([{ prop: 'name', order: 'descending' }])
    const filterState = ref<Record<string, any>>({ status: 'on' })
    const { result, request } = buildManualRequest({
      autoParamsConfig: () => true,
      autoSortState: () => sortState.value,
      autoFilterState: () => filterState.value,
      searchParams: () => ({ q: 1 }),
    })
    await result.fetchData({ reason: 'sort' })
    expect(request.mock.calls[0][0].params).toMatchObject({
      q: 1,
      sort: [{ prop: 'name', order: 'desc' }],
      filter: { status: 'on' },
    })
  })

  it('honors custom sort/filter keys', async () => {
    const { result, request } = buildManualRequest({
      autoParamsConfig: () => ({ sortKey: 's', filterKey: 'f' }),
      autoSortState: () => [{ prop: 'name', order: 'ascending' }],
      autoFilterState: () => ({ k: 'v' }),
    })
    await result.fetchData({ reason: 'refresh' })
    expect(request.mock.calls[0][0].params).toMatchObject({
      s: [{ prop: 'name', order: 'asc' }],
      f: { k: 'v' },
    })
  })

  it('falls back to asc with a dev warning on unknown sort orders', async () => {
    resetDevWarnCacheForTests()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result, request } = buildManualRequest({
      autoParamsConfig: () => true,
      autoSortState: () => [{ prop: 'name', order: 'weird' as unknown as SortState['order'] }],
    })
    await result.fetchData({ reason: 'sort' })
    expect(request.mock.calls[0][0].params).toMatchObject({
      sort: [{ prop: 'name', order: 'asc' }],
    })
    expect(warnSpy.mock.calls.map(args => String(args[0])).filter(m => m.includes('weird'))).toHaveLength(1)
    warnSpy.mockRestore()
  })
})
