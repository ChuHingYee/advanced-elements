import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useTableRequest } from '../../src/composables/data/use-table-request'
import { resetDevWarnCacheForTests } from '../../src/utils/dev-warn'

describe('useTableRequest', () => {
  it('returns default values', () => {
    const isManual = ref(false)
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange: vi.fn(),
        updateLoading: vi.fn(),
        request: vi.fn() as any,
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })

    expect(result.loading.value).toBe(false)
    expect(result.total.value).toBe(0)
    expect(result.hasSource.value).toBe(false)
    expect(result.isPolling.value).toBe(false)
    expect(result.pagination).toBeDefined()
    expect(typeof result.refresh).toBe('function')
    expect(typeof result.fetchData).toBe('function')
    expect(typeof result.setLoading).toBe('function')
    expect(typeof result.setResponseData).toBe('function')
    expect(typeof result.clearResponseData).toBe('function')
    expect(typeof result.stopPolling).toBe('function')
    expect(typeof result.reorderData).toBe('function')
    expect(typeof result.handleCurrentPageChange).toBe('function')
    expect(typeof result.handlePageSizeChange).toBe('function')
    expect(typeof result.handleLoadMore).toBe('function')
    expect(typeof result.getPagination).toBe('function')
    expect(typeof result.setCurrentPageAndRefetch).toBe('function')
    expect(typeof result.setPageSizeAndRefetch).toBe('function')
    expect(typeof result.getFullData).toBe('function')
  })

  it('returns tableData from defaultData when no source', () => {
    const isManual = ref(false)
    const defaultData = [{ id: 1, name: 'test' }]
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      defaultData: () => defaultData,
      emits: {
        pageChange: vi.fn(),
        updateLoading: vi.fn(),
        request: vi.fn() as any,
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })

    expect(result.tableData.value).toEqual(defaultData)
    expect(result.getFullData()).toEqual(defaultData)
  })

  it('reorderData emits dataChange with oldData snapshot when no source (write in transaction writeFn)', () => {
    const isManual = ref(false)
    const updateData = vi.fn()
    const dataChange = vi.fn()
    const rows = [{ id: 1, name: 'reordered' }]
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange: vi.fn(),
        updateLoading: vi.fn(),
        request: vi.fn() as any,
        refresh: vi.fn(),
        updateData,
        dataChange,
        onError: vi.fn(),
      },
    })

    // <zh/> 新契约：reorderData 快照旧数据后交由事务写入（dataChange 处理器的 writeFn），
    // <zh/> 自身不再先写后发——否则 oldData === newData，回滚/否决失效。
    // <en/> New contract: reorderData snapshots the old data and hands the write to the
    // <en/> transaction (the dataChange handler's writeFn); it no longer writes before emitting
    // <en/> (which made oldData === newData and broke rollback/veto).
    result.reorderData(rows)
    expect(updateData).not.toHaveBeenCalled()
    expect(dataChange).toHaveBeenCalledTimes(1)
    const payload = dataChange.mock.calls[0][0]
    expect(payload.reason).toBe('drag')
    expect(payload.data).toEqual(rows)
    expect(Array.isArray(payload.oldData)).toBe(true)
  })

  it('stopPolling sets isPolling to false', () => {
    const isManual = ref(false)
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange: vi.fn(),
        updateLoading: vi.fn(),
        request: vi.fn() as any,
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })

    result.isPolling.value = true
    result.stopPolling()
    expect(result.isPolling.value).toBe(false)
  })

  it('getPagination returns current page, size, total', () => {
    const isManual = ref(false)
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange: vi.fn(),
        updateLoading: vi.fn(),
        request: vi.fn() as any,
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    const pag = result.getPagination()
    expect(typeof pag.currentPage).toBe('number')
    expect(typeof pag.pageSize).toBe('number')
    expect(typeof pag.total).toBe('number')
  })

  it('fetchData works in manual mode', async () => {
    const isManual = ref(true)
    const request = vi.fn().mockResolvedValue([])
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
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
    const d = await result.fetchData()
    expect(d).toEqual([])
  })

  it('fetchData in manual mode resolves null (not throw) for superseded failures (superseded-manual)', async () => {
    const isManual = ref(true)
    let rejectFirst!: (err: unknown) => void
    const firstGate = new Promise<never>((_, reject) => {
      rejectFirst = reject
    })
    const request = vi.fn()
      .mockReturnValueOnce(firstGate)
      .mockResolvedValueOnce([{ id: 1 }])
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
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
    // <zh/> 先发后到的旧请求被新请求取代后失败——应静默为 null，而非抛给调用方误报
    const stale = result.fetchData({ reason: 'page-change' })
    const fresh = result.fetchData({ reason: 'page-change' })
    rejectFirst(new Error('superseded'))
    await expect(stale).resolves.toBeNull()
    await expect(fresh).resolves.toEqual([{ id: 1 }])
  })

  it('setCurrentPageAndRefetch delegates to pagination', () => {
    const isManual = ref(false)
    const pageChange = vi.fn()
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange,
        updateLoading: vi.fn(),
        request: vi.fn().mockResolvedValue([]),
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    result.setCurrentPageAndRefetch(2)
    expect(pageChange).toHaveBeenCalledWith(2, 10)
  })

  it('setPageSizeAndRefetch delegates to pagination', () => {
    const isManual = ref(false)
    const pageChange = vi.fn()
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange,
        updateLoading: vi.fn(),
        request: vi.fn().mockResolvedValue([]),
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    result.setPageSizeAndRefetch(20)
    expect(pageChange).toHaveBeenCalledWith(1, 20)
  })

  it('refresh delegates to emit in manual mode', async () => {
    const isManual = ref(true)
    const request = vi.fn().mockResolvedValue([])
    const refreshEmit = vi.fn()
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange: vi.fn(),
        updateLoading: vi.fn(),
        request,
        refresh: refreshEmit,
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    await result.refresh()
    expect(refreshEmit).toHaveBeenCalled()
  })

  it('handleCurrentPageChange delegates to pagination', () => {
    const isManual = ref(false)
    const pageChange = vi.fn()
    const request = vi.fn().mockResolvedValue([])
    const result = useTableRequest({
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
        total: ref(100),
        paginationRef: ref(null),
        isManual,
      },
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange,
        updateLoading: vi.fn(),
        request,
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    result.handleCurrentPageChange(3)
    expect(pageChange).toHaveBeenCalledWith(3, 10)
  })

  it('handlePageSizeChange delegates to pagination', () => {
    const isManual = ref(false)
    const pageChange = vi.fn()
    const request = vi.fn().mockResolvedValue([])
    const result = useTableRequest({
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
        total: ref(100),
        paginationRef: ref(null),
        isManual,
      },
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange,
        updateLoading: vi.fn(),
        request,
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    result.handlePageSizeChange(50)
    expect(pageChange).toHaveBeenCalledWith(1, 50)
  })

  it('handleLoadMore returns when hasMore is false', () => {
    const isManual = ref(false)
    const request = vi.fn().mockResolvedValue([])
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
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
    // total is 0, hasMore is false → handleLoadMore should be a no-op
    result.handleLoadMore()
    // <zh/> 无更多数据时不得触发请求、不进入 loading
    // <en/> No request fires and no loading starts when there is nothing more
    expect(request).not.toHaveBeenCalled()
    expect(result.loading.value).toBe(false)
  })

  it('setLoading delegates to internal setLoading', async () => {
    const isManual = ref(false)
    const updateLoading = vi.fn()
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange: vi.fn(),
        updateLoading,
        request: vi.fn().mockResolvedValue([]),
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    result.setLoading(true)
    // <zh/> 转发经 watch 桥接（异步）：先同步 loading 状态，再等事件
    // <en/> Forwarding goes through a watch bridge (async): sync state first, then the event
    expect(result.loading.value).toBe(true)
    await nextTick()
    expect(updateLoading).toHaveBeenCalledWith(true)
    result.setLoading(false)
    expect(result.loading.value).toBe(false)
  })

  it('handleLoadMore increments page when hasMore is true', () => {
    const isManual = ref(true)
    const pageChange = vi.fn()
    const result = useTableRequest({
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
        total: ref(100),
        paginationRef: ref(null),
        isManual,
      },
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange,
        updateLoading: vi.fn(),
        request: vi.fn().mockResolvedValue([]),
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    result.pagination.pageSize.value = 10
    result.pagination.currentPage.value = 1
    result.handleLoadMore()
    expect(pageChange).toHaveBeenCalledWith(2, 10)
  })

  it('setPageSizeAndRefetch applies effects and emits', () => {
    const isManual = ref(false)
    const pageChange = vi.fn()
    const result = useTableRequest({
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
        total: ref(100),
        paginationRef: ref(null),
        isManual,
      },
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange,
        updateLoading: vi.fn(),
        request: vi.fn().mockResolvedValue([]),
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    result.setPageSizeAndRefetch(50)
    expect(pageChange).toHaveBeenCalledWith(1, 50)
  })

  it('requestTimeout is passed to underlying request', async () => {
    const isManual = ref(false)
    const requestSource = vi.fn().mockReturnValue(
      vi.fn((_params: any, _signal?: AbortSignal) => new Promise<any>(resolve => setTimeout(resolve, 200, { data: [{ id: 1 }], total: 1 }))),
    )
    const result = useTableRequest({
      requestSource,
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      requestTimeout: () => 10,
      emits: {
        pageChange: vi.fn(),
        updateLoading: vi.fn(),
        request: vi.fn() as any,
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    // With 10ms timeout and 200ms delay, request should time out
    vi.useFakeTimers()
    const promise = result.fetchData()
    vi.advanceTimersByTime(20)
    await expect(promise).rejects.toThrow('Request timed out')
    vi.useRealTimers()
  })

  it('stopPolling sets isPolling to false (dup)', () => {
    const isManual = ref(false)
    const result = useTableRequest({
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange: vi.fn(),
        updateLoading: vi.fn(),
        request: vi.fn() as any,
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    result.isPolling.value = true
    result.stopPolling()
    expect(result.isPolling.value).toBe(false)
  })

  it('reorderData works with data source', () => {
    const isManual = ref(false)
    const requestSource = vi.fn(() => vi.fn())
    const result = useTableRequest({
      requestSource,
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
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      defaultData: () => [{ id: 1 }],
      emits: {
        pageChange: vi.fn(),
        updateLoading: vi.fn(),
        request: vi.fn() as any,
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    // reorderData should emit updateData when no source
    const rows = [{ id: 2 }]
    result.reorderData(rows as any)
    // Should not throw
    expect(true).toBe(true)
  })

  it('setCurrentPageAndRefetch and setPageSizeAndRefetch work', () => {
    const isManual = ref(true)
    const pageChange = vi.fn()
    const result = useTableRequest({
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
        total: ref(100),
        paginationRef: ref(null),
        isManual,
      },
      searchParams: () => ({}),
      rowKeyFn: () => (r: any) => r.id,
      isManual,
      emits: {
        pageChange,
        updateLoading: vi.fn(),
        request: vi.fn().mockResolvedValue([]) as any,
        refresh: vi.fn(),
        updateData: vi.fn(),
        dataChange: vi.fn(),
        onError: vi.fn(),
      },
    })
    result.setCurrentPageAndRefetch(3)
    expect(pageChange).toHaveBeenCalledWith(3, 10)
    result.setPageSizeAndRefetch(50)
    expect(pageChange).toHaveBeenCalledWith(1, 50)
  })

  describe('tableData dirty-row sanitization', () => {
    function makeRequest(defaultData: () => any) {
      const isManual = ref(false)
      return useTableRequest({
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
        searchParams: () => ({}),
        rowKeyFn: () => (r: any) => r.id,
        isManual,
        defaultData,
        emits: {
          pageChange: vi.fn(),
          updateLoading: vi.fn(),
          request: vi.fn() as any,
          refresh: vi.fn(),
          updateData: vi.fn(),
          dataChange: vi.fn(),
          onError: vi.fn(),
        },
      })
    }

    it('returns the same array reference when data has no dirty rows (zero downstream churn)', () => {
      const defaultData = [{ id: 1 }, { id: 2 }]
      const result = makeRequest(() => defaultData)
      expect(result.tableData.value).toBe(defaultData)
    })

    it('drops null/undefined rows so rowKeyMeta never throws on property access', () => {
      resetDevWarnCacheForTests()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = makeRequest(() => [{ id: 1 }, null, undefined, { id: 2 }] as any)
      expect(result.tableData.value).toEqual([{ id: 1 }, { id: 2 }])
      // <zh/> 行键元信息构建必须成功
      // <en/> Row-key meta must build successfully (null rows previously threw TypeError here, crashing table computeds)
      expect(() => result.rowKeyMeta.value).not.toThrow()
      expect(result.rowKeyMeta.value.keyToIndex.get(1)).toBe(0)
      expect(result.rowKeyMeta.value.keyToIndex.get(2)).toBe(1)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dropped 2 null/undefined row(s)'),
      )
      warnSpy.mockRestore()
    })

    it('treats sparse-array holes as dirty rows', () => {
      resetDevWarnCacheForTests()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // eslint-disable-next-line no-sparse-arrays
      const result = makeRequest(() => [{ id: 1 }, , { id: 3 }] as any)
      expect(result.tableData.value).toEqual([{ id: 1 }, { id: 3 }])
      warnSpy.mockRestore()
    })

    it('degrades non-array data to an empty array', () => {
      const result = makeRequest(() => null as any)
      expect(result.tableData.value).toEqual([])
    })
  })

  /**
   * <zh/> 合并遍历后必须保持 tableData 的原始嵌套语义（展平归下游 useTreeData），
   * <zh/> 否则下游会二次展平产生重复行；同时 rowKeyMeta 仍覆盖整棵树的扁平索引域。
   * <en/> after merging the traversal, tableData must keep its raw nested shape (flattening belongs
   * <en/> to the downstream useTreeData) or the tree gets double-flattened into duplicate rows; meanwhile
   * <en/> rowKeyMeta still covers the whole tree in the flat index domain.
   */
  describe('tree data (childrenKey) single-pass merge', () => {
    function makeTreeRequest(data: () => any[]) {
      const isManual = ref(false)
      return useTableRequest({
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
        searchParams: () => ({}),
        rowKeyFn: () => (r: any) => String(r.id),
        isManual,
        defaultData: data,
        childrenKey: () => 'children',
        emits: {
          pageChange: vi.fn(),
          updateLoading: vi.fn(),
          request: vi.fn() as any,
          refresh: vi.fn(),
          updateData: vi.fn(),
          dataChange: vi.fn(),
          onError: vi.fn(),
        },
      })
    }

    const tree = [
      { id: '1', children: [{ id: '1-1', children: [{ id: '1-1-1' }] }, { id: '1-2' }] },
      { id: '2' },
    ]

    it('keeps tableData nested instead of pre-flattening the tree', () => {
      const result = makeTreeRequest(() => tree)
      expect(result.tableData.value).toHaveLength(2)
      expect(result.tableData.value[0].children).toHaveLength(2)
      // <zh/> 无脏行时复用原引用 | <en/> original reference reused when clean
      expect(result.tableData.value).toBe(tree)
    })

    it('indexes the whole tree in the flat depth-first domain', () => {
      const result = makeTreeRequest(() => tree)
      const { keyToIndex, keyToRow } = result.rowKeyMeta.value
      expect(keyToRow.size).toBe(5)
      expect(keyToIndex.get('1')).toBe(0)
      expect(keyToIndex.get('1-1')).toBe(1)
      expect(keyToIndex.get('1-1-1')).toBe(2)
      expect(keyToIndex.get('1-2')).toBe(3)
      expect(keyToIndex.get('2')).toBe(4)
    })

    it('drops top-level dirty rows while preserving the nested survivors', () => {
      resetDevWarnCacheForTests()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = makeTreeRequest(() => [{ id: '1', children: [{ id: '1-1' }] }, null, { id: '2' }] as any[])
      expect(result.tableData.value).toHaveLength(2)
      expect(result.tableData.value[0].children).toHaveLength(1)
      expect(result.rowKeyMeta.value.keyToRow.size).toBe(3)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dropped 1 null/undefined row(s)'),
      )
      warnSpy.mockRestore()
    })
  })
})
