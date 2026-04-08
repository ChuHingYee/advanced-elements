/**
 * @file use-table-request — manual 回写通道与 loading 复位
 * @file use-table-request — manual write-back channel and loading reset
 *
 * Covers: setResponseData write route (with / without request.source), stale requestId drop,
 * and the manual "parent write-back ends loading" reset that keeps the infinite-scroll
 * re-entry guard from short-circuiting forever.
 * 覆盖：setResponseData 的写入路由（有 / 无 request.source）、过期 requestId 丢弃，
 * 以及 manual 模式「父回写即结束 loading」的复位（避免无限滚动防重入守卫永久早退）。
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

describe('useTableRequest — write-back route', () => {
  it('writes responseData when request.source is configured', () => {
    const isManual = ref(true)
    const updateData = vi.fn()
    const opts = createOptions({
      isManual,
      emits: { ...createEmits(), updateData },
      requestSource: () => ({ url: '/api/data' }),
    })

    const result = useTableRequest(opts)
    result.setResponseData([{ id: 'row-1' }])

    expect(result.responseData.value).toEqual([{ id: 'row-1' }])
    expect(updateData).not.toHaveBeenCalled()
  })

  it('writes the v-model data model when no request.source is configured', () => {
    const isManual = ref(true)
    const updateData = vi.fn()
    const opts = createOptions({
      isManual,
      emits: { ...createEmits(), updateData },
      requestSource: () => undefined,
      defaultData: () => [{ id: 'row-1' }],
    })

    const result = useTableRequest(opts)
    result.setLoading(true)
    result.setResponseData([{ id: 'row-2' }])

    // Without a source the responseData channel is never read by tableData, so the write must
    // target the v-model model; a responseData write here would be silently invisible.
    expect(updateData).toHaveBeenCalledWith([{ id: 'row-2' }])
    expect(result.loading.value).toBe(false)
  })

  it('drops a write-back carrying a stale requestId', async () => {
    const isManual = ref(true)
    const opts = createOptions({
      isManual,
      requestSource: () => ({ url: '/api/data' }),
    })

    const result = useTableRequest(opts)
    void result.fetchData()
    await nextTick()

    const current = result.getManualRequestId()
    expect(current).toBeGreaterThan(0)

    result.setResponseData([{ id: 'stale' }], current - 1)
    expect(result.responseData.value).toEqual([])

    result.setResponseData([{ id: 'fresh' }], current)
    expect(result.responseData.value).toEqual([{ id: 'fresh' }])
  })
})

describe('useTableRequest — manual loading reset on write-back', () => {
  it('clears loading when the parent writes data back during a manual request', async () => {
    const isManual = ref(true)
    const dataModel = ref<{ id: string }[] | undefined>(undefined)
    const opts = createOptions({
      isManual,
      requestSource: () => undefined,
      defaultData: () => dataModel.value ?? [],
    })

    const result = useTableRequest(opts)
    result.setLoading(true)
    expect(result.loading.value).toBe(true)

    // Simulates the parent's v-model:data write-back following the request event.
    dataModel.value = [{ id: 'row-1' }]
    await nextTick()

    expect(result.loading.value).toBe(false)
  })

  it('leaves loading untouched outside manual mode', async () => {
    const isManual = ref(false)
    const dataModel = ref<{ id: string }[] | undefined>(undefined)
    const opts = createOptions({
      isManual,
      requestSource: () => undefined,
      defaultData: () => dataModel.value ?? [],
    })

    const result = useTableRequest(opts)
    result.setLoading(true)

    dataModel.value = [{ id: 'row-1' }]
    await nextTick()

    expect(result.loading.value).toBe(true)
  })
})
