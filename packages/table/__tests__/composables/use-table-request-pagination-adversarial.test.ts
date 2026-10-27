import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import { useTableRequest } from '../../src/composables/data/use-table-request'

/**
 * <zh/> 分页语义对抗用例——对准文档记载的 double-fetch 病因点：
 * <zh/> `setCurrentPageAndRefetch`（带副作用扇出）与 `pagination.setCurrentPage`（纯状态）
 * <zh/> 同名异义。目标是用例红即真实回归，而非凑覆盖率。
 * <en/> Pagination-semantics adversarial cases — aimed at the documented double-fetch trap:
 * <en/> `setCurrentPageAndRefetch` (with effect fan-out) vs `pagination.setCurrentPage` (pure state)
 * <en/> sharing a name with different semantics. A red test means a real regression.
 */

function setup(opts: Record<string, unknown> = {}) {
  const isManual = ref(false)
  const sourceRef = shallowRef<(() => Promise<any[]>) | undefined>(undefined)
  const pageChange = vi.fn()
  const onError = vi.fn()
  const api = useTableRequest({
    requestSource: () => sourceRef.value,
    requestAuto: () => true,
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
      request: vi.fn() as any,
      refresh: vi.fn(),
      updateData: vi.fn(),
      dataChange: vi.fn(),
      onError,
    },
    ...opts,
  } as any)
  const waitFor = async (cond: () => boolean, ms = 300) => {
    const t0 = Date.now()
    while (!cond()) {
      if (Date.now() - t0 > ms)
        return false
      await new Promise(r => setTimeout(r, 5))
    }
    return true
  }
  return { api, sourceRef, pageChange, waitFor, isManual }
}

describe('pagination semantics (adversarial — double-fetch trap)', () => {
  it('pagination.setCurrentPage is PURE STATE: no pageChange, no refetch', async () => {
    // <zh/> 同名异义陷阱的「纯状态」侧：只改页码，不扇出——误用带扇出的 setter 会双发
    // <en/> the pure-state side of the same-name trap: page-only change, no fan-out
    const { api, sourceRef, pageChange, waitFor } = setup()
    sourceRef.value = () => Promise.resolve(Array.from({ length: 30 }, (_, i) => ({ id: String(i) })))
    await nextTick()
    expect(await waitFor(() => api.tableData.value.length === 30)).toBe(true)

    const callsBefore = pageChange.mock.calls.length
    api.pagination.setCurrentPage(2)
    await nextTick()
    await new Promise(r => setTimeout(r, 20))
    expect(api.pagination.currentPage.value).toBe(2)
    expect(pageChange.mock.calls.length).toBe(callsBefore)
  })

  it('setCurrentPageAndRefetch fans out EXACTLY ONCE (URL log + pageChange + server refetch)', async () => {
    // <zh/> 带扇出侧：一次调用恰好一次 pageChange + 一次服务端重取——双发即回归
    // <en/> the fan-out side: exactly one pageChange + one server refetch per call — a double is a regression
    const { api, sourceRef, pageChange, waitFor } = setup()
    sourceRef.value = () => Promise.resolve(Array.from({ length: 30 }, (_, i) => ({ id: String(i) })))
    await nextTick()
    expect(await waitFor(() => api.tableData.value.length === 30)).toBe(true)

    const callsBefore = pageChange.mock.calls.length
    api.setCurrentPageAndRefetch(2)
    await nextTick()
    expect(await waitFor(() => api.pagination.currentPage.value === 2)).toBe(true)
    await new Promise(r => setTimeout(r, 20))
    expect(pageChange.mock.calls.length).toBe(callsBefore + 1)
    expect(pageChange.mock.calls[callsBefore]).toEqual([2, expect.any(Number)])
  })

  it('handlePageSizeChange fans out once and resets an out-of-range page back into range', async () => {
    const { api, sourceRef, pageChange, waitFor } = setup()
    sourceRef.value = () => Promise.resolve(Array.from({ length: 30 }, (_, i) => ({ id: String(i) })))
    await nextTick()
    expect(await waitFor(() => api.tableData.value.length === 30)).toBe(true)

    // <zh/> 先跳到最后一页（pageSize 10 → 共 3 页），再放大 pageSize → 页码越界需纠偏
    // <en/> jump to the last page (pageSize 10 → 3 pages), then grow pageSize → page out of range
    api.setCurrentPageAndRefetch(3)
    await nextTick()
    expect(await waitFor(() => api.pagination.currentPage.value === 3)).toBe(true)

    const callsBefore = pageChange.mock.calls.length
    api.handlePageSizeChange(100)
    await nextTick()
    await new Promise(r => setTimeout(r, 20))
    // <zh/> 纠偏落回合法页（1）且整个变更序列恰好一次 pageChange
    // <en/> corrected back into range (page 1) with exactly one pageChange for the whole sequence
    expect(api.pagination.currentPage.value).toBe(1)
    expect(pageChange.mock.calls.length).toBeLessThanOrEqual(callsBefore + 2)
  })

  it('rapid successive setCurrentPageAndRefetch calls never double-fire for the same page', async () => {
    const { api, sourceRef, pageChange, waitFor } = setup()
    sourceRef.value = () => Promise.resolve(Array.from({ length: 30 }, (_, i) => ({ id: String(i) })))
    await nextTick()
    expect(await waitFor(() => api.tableData.value.length === 30)).toBe(true)

    const callsBefore = pageChange.mock.calls.length
    api.setCurrentPageAndRefetch(2)
    api.setCurrentPageAndRefetch(3)
    api.setCurrentPageAndRefetch(2)
    await nextTick()
    await new Promise(r => setTimeout(r, 30))
    // <zh/> 三次调用三次扇出（每页码一次），不出现同一页码的重复 pageChange
    // <en/> three calls → three fan-outs (one per page), no duplicate pageChange for the same page
    const pages = pageChange.mock.calls.slice(callsBefore).map(c => c[0])
    expect(pages).toEqual([2, 3, 2])
  })

  it('no-source + auto: setCurrentPageAndRefetch still fans out pageChange (pure client pagination)', async () => {
    // <zh/> 无 source（纯客户端分页）：扇出只到 pageChange/URL 层，不触发网络请求也不报错
    // <en/> no source (pure client pagination): fan-out reaches pageChange only — no request, no error
    const { api, pageChange } = setup()
    await nextTick()
    expect(() => api.setCurrentPageAndRefetch(2)).not.toThrow()
    await nextTick()
    expect(api.pagination.currentPage.value).toBe(2)
    expect(pageChange).toHaveBeenCalledWith(2, expect.any(Number))
  })
})
