/**
 * @file pagination-effects — 服务端空页校正的 total 口径
 * @file pagination-effects — total caliber of the server empty-page correction
 *
 * Covers: in manual mode the correction must read the parent-declared `propsTotal` instead of the
 * response-side total (which stays 0 because manual never runs useRequest.request()).
 * 覆盖：manual 模式下校正必须取父组件声明的 `propsTotal`，而非恒为 0 的响应侧 total。
 */
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createPaginationEffects } from '../../src/composables/data/pagination-effects'

function setup(options: { isManual: boolean, propsTotal: number, responseTotal: number }) {
  const isManual = ref(options.isManual)
  const responseData = ref<{ id: string }[]>([])
  const total = ref(options.responseTotal)
  const currentPage = ref(1)
  const pageSize = ref(10)

  const pagination = {
    isClient: ref(false),
    currentPage,
    pageSize,
    paginationTotal: ref(options.propsTotal),
    loadMore: () => null,
    setCurrentPage: (page: number) => {
      currentPage.value = page
      return { page, size: pageSize.value, reason: 'pageChange' as const, isClient: false, needsReset: false }
    },
  }
  const correctPage = vi.fn((page: number) => {
    currentPage.value = page
  })
  const optionsTotal = ref(options.propsTotal)

  createPaginationEffects({
    pagination: pagination as any,
    responseData,
    total,
    hasSource: ref(true),
    isManual,
    paginationOptions: { propsTotal: () => options.propsTotal, total: optionsTotal } as any,
    setPageLog: () => {},
    emits: { pageChange: () => {}, onError: () => {} },
    stopPolling: () => {},
    clearResponseData: () => {},
    fetchData: () => Promise.resolve(null),
    correctPage,
  } as any)

  return { currentPage, pageSize, responseData, total, correctPage, optionsTotal }
}

describe('pagination effects — empty-page correction total caliber', () => {
  it('corrects an out-of-range page in manual mode from the parent-declared total', async () => {
    // total 20 / pageSize 10 → maxPage 2; landing on page 3 with an empty page must correct to 2.
    const s = setup({ isManual: true, propsTotal: 20, responseTotal: 0 })
    s.currentPage.value = 3
    await nextTick()

    expect(s.correctPage).toHaveBeenCalledWith(2)
  })

  it('reads the response-side total outside manual mode', async () => {
    const s = setup({ isManual: false, propsTotal: 20, responseTotal: 50 })
    s.currentPage.value = 3
    await nextTick()

    // 50 / 10 → maxPage 5, so page 3 is in range and no correction happens
    expect(s.correctPage).not.toHaveBeenCalled()
  })

  it('does not sync the response-side total into options in manual mode', async () => {
    // <zh/> manual 下 response total 恒 0（父驱动），同步会闪断 options.total——必须跳过
    // <en/> In manual mode the response total stays 0 (parent-driven); syncing would flash options.total — must skip
    const s = setup({ isManual: true, propsTotal: 20, responseTotal: 0 })
    s.total.value = 99
    await nextTick()
    expect(s.optionsTotal.value).toBe(20)
  })

  it('syncs the response-side total into options outside manual mode', async () => {
    const s = setup({ isManual: false, propsTotal: 20, responseTotal: 50 })
    s.total.value = 99
    await nextTick()
    expect(s.optionsTotal.value).toBe(99)
  })
})
