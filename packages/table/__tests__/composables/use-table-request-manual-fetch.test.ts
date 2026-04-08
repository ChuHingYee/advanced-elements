/**
 * @file use-table-request phase2 — 补充分支覆盖
 * Covers: fetchData manual mode, reorderData, handleCurrentPageChange, handlePageSizeChange, handleLoadMore, rowKeyMeta with childrenKey, refresh
 */
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useTableRequest } from '../../src/composables/data/use-table-request'

function createEmits() {
  return {
    pageChange: vi.fn(),
    updateLoading: vi.fn(),
    request: vi.fn().mockResolvedValue([]) as any,
    refresh: vi.fn(),
    updateData: vi.fn(),
    dataChange: vi.fn(),
    onError: vi.fn(),
  }
}

function createOptions(overrides: any = {}) {
  const isManual = ref(false)
  return {
    requestSource: () => undefined,
    requestAuto: () => false,
    requestMode: () => 'paginated' as const,
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
    searchParams: () => ({}),
    rowKeyFn: () => (r: any) => r.id,
    isManual,
    emits: createEmits(),
    ...overrides,
  }
}

describe('useTableRequest phase2 — fetchData manual mode', () => {
  it('emits request in manual mode', async () => {
    const isManual = ref(true)
    const emits = createEmits()
    const opts = createOptions({
      isManual,
      emits,
      paginationOptions: { total: ref(100), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    const data = await result.fetchData()
    expect(data).toEqual([])
    expect(emits.request).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        size: 10,
        append: false,
        reason: 'refresh',
      }),
    )
  })

  it('emits request with append=true for loadMore reason', async () => {
    const isManual = ref(true)
    const emits = createEmits()
    const opts = createOptions({
      isManual,
      emits,
      paginationOptions: { total: ref(100), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    await result.fetchData({ append: true, reason: 'loadMore' })
    expect(emits.request).toHaveBeenCalledWith(
      expect.objectContaining({
        append: true,
        reason: 'loadMore',
      }),
    )
  })
})

describe('useTableRequest phase2 — refresh', () => {
  it('calls emits.refresh and emits.request in manual mode', async () => {
    const isManual = ref(true)
    const emits = createEmits()
    const opts = createOptions({
      isManual,
      emits,
      paginationOptions: { total: ref(100), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    await result.refresh()
    expect(emits.refresh).toHaveBeenCalled()
    expect(emits.request).toHaveBeenCalled()
  })
})

describe('useTableRequest phase2 — reorderData', () => {
  it('emits dataChange with oldData snapshot when hasSource is true (write moved into transaction writeFn)', () => {
    const isManual = ref(false)
    const emits = createEmits()
    const opts = createOptions({
      isManual,
      emits,
      requestSource: () => ({ url: '/api/data' }),
      paginationOptions: { total: ref(0), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    const rows = [{ id: 1, name: 'Alice' }]
    result.reorderData(rows)
    // <zh/> 新契约：reorderData 只快照 + 发事务事件，写入由 dataChange 处理器的
    // <zh/> writeFn 在事务内执行（beforeDataChange 可否决、rollbackLast 真实生效）。
    // <en/> New contract: reorderData only snapshots + emits the transaction event; the write
    // <en/> happens inside the dataChange handler's writeFn (beforeDataChange can veto and
    // <en/> rollbackLast genuinely works).
    expect(emits.dataChange).toHaveBeenCalledTimes(1)
    const payload = emits.dataChange.mock.calls[0][0]
    expect(payload.reason).toBe('drag')
    expect(payload.data).toEqual(rows)
    expect(Array.isArray(payload.oldData)).toBe(true)
    // <zh/> 不再先写后发 | <en/> no longer writes before emitting
    expect(emits.updateData).not.toHaveBeenCalled()
  })

  it('emits dataChange with oldData snapshot and does NOT write when hasSource is false', () => {
    const isManual = ref(false)
    const emits = createEmits()
    const opts = createOptions({
      isManual,
      emits,
      paginationOptions: { total: ref(0), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    const rows = [{ id: 1, name: 'Alice' }]
    result.reorderData(rows)
    expect(emits.updateData).not.toHaveBeenCalled()
    expect(emits.dataChange).toHaveBeenCalledTimes(1)
    const payload = emits.dataChange.mock.calls[0][0]
    expect(payload.reason).toBe('drag')
    expect(payload.data).toEqual(rows)
    expect(Array.isArray(payload.oldData)).toBe(true)
  })
})

describe('useTableRequest phase2 — getPagination', () => {
  it('returns current pagination state', () => {
    const isManual = ref(false)
    const opts = createOptions({
      isManual,
      paginationOptions: { total: ref(50), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    result.setCurrentPageAndRefetch(3)
    const pagination = result.getPagination()
    expect(pagination.currentPage).toBe(3)
    expect(pagination.pageSize).toBe(10)
    expect(pagination.total).toBe(50)
  })
})

describe('useTableRequest phase2 — getFullData', () => {
  it('returns copy of tableData', () => {
    const isManual = ref(false)
    const opts = createOptions({
      isManual,
      defaultData: () => [{ id: 1, name: 'Alice' }],
      paginationOptions: { total: ref(0), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    const data = result.getFullData()
    expect(data).toEqual([{ id: 1, name: 'Alice' }])
    // Ensure it's a copy
    expect(data).not.toBe(result.tableData.value)
  })
})

describe('useTableRequest phase2 — rowKeyMeta with childrenKey', () => {
  it('walks tree data when childrenKey is provided', () => {
    const isManual = ref(false)
    const treeData = [
      { id: '1', name: 'Parent', children: [
        { id: '1-1', name: 'Child 1' },
        { id: '1-2', name: 'Child 2' },
      ] },
    ]
    const opts = createOptions({
      isManual,
      defaultData: () => treeData,
      childrenKey: () => 'children',
      paginationOptions: { total: ref(0), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    const meta = result.rowKeyMeta.value
    expect(meta.keyToRow.size).toBe(3) // parent + 2 children
    expect(meta.keyToRow.get('1-1')).toEqual({ id: '1-1', name: 'Child 1' })
  })

  it('handles flat data without childrenKey', () => {
    const isManual = ref(false)
    const flatData = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]
    const opts = createOptions({
      isManual,
      defaultData: () => flatData,
      paginationOptions: { total: ref(0), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    const meta = result.rowKeyMeta.value
    expect(meta.keyToRow.size).toBe(2)
    expect(meta.keyToIndex.get('2')).toBe(1)
  })
})

describe('useTableRequest phase2 — setLoading and setIsPolling', () => {
  it('setLoading updates loading state', async () => {
    const isManual = ref(false)
    const emits = createEmits()
    const opts = createOptions({
      isManual,
      emits,
      paginationOptions: { total: ref(0), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    result.setLoading(true)
    await nextTick()
    expect(result.loading.value).toBe(true)
    expect(emits.updateLoading).toHaveBeenCalledWith(true)
  })

  it('setIsPolling updates polling state', () => {
    const isManual = ref(false)
    const opts = createOptions({
      isManual,
      paginationOptions: { total: ref(0), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    result.setIsPolling(true)
    expect(result.isPolling.value).toBe(true)
    result.stopPolling()
    expect(result.isPolling.value).toBe(false)
  })
})

describe('useTableRequest phase2 — clearResponseData', () => {
  it('clears response data', () => {
    const isManual = ref(false)
    const opts = createOptions({
      isManual,
      requestSource: () => ({ url: '/api/data' }),
      paginationOptions: { total: ref(0), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    result.setResponseData([{ id: 1 }])
    expect(result.responseData.value).toHaveLength(1)
    result.clearResponseData()
    expect(result.responseData.value).toEqual([])
  })
})

describe('useTableRequest phase2 — handleLoadMore', () => {
  it('does nothing when hasMore is false', () => {
    const isManual = ref(true)
    const emits = createEmits()
    const opts = createOptions({
      isManual,
      emits,
      paginationOptions: { total: ref(5), paginationRef: ref(null), isManual },
    })

    const result = useTableRequest(opts)
    result.handleLoadMore()
    // Actually hasMore = currentPage * pageSize < total = 1 * 10 < 5 → false
    expect(emits.request).not.toHaveBeenCalled()
  })
})
