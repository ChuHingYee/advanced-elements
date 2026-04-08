import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useTablePagination, watchClientPaginationCorrection } from '../../src/composables/data/use-table-pagination'

const nullRef = ref(null)

describe('useTablePagination', () => {
  it('returns default state', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    expect(result.currentPage.value).toBe(1)
    expect(result.pageSize.value).toBe(10)
    expect(result.isClient.value).toBe(false)
    expect(result.pageSizes.value).toEqual([10, 20, 30])
    expect(result.paginationTotal.value).toBe(100)
  })

  it('setCurrentPage returns change info', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    const info = result.setCurrentPage(3)
    expect(info.page).toBe(3)
    expect(info.size).toBe(10)
    expect(info.reason).toBe('pageChange')
    expect(info.isClient).toBe(false)
    expect(info.needsReset).toBe(false)
  })

  it('setCurrentPage clamps to minimum 1', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    const info = result.setCurrentPage(0)
    expect(info.page).toBe(1)
  })

  it('setPageSize resets page to 1', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    result.setCurrentPage(3)
    expect(result.currentPage.value).toBe(3)
    const info = result.setPageSize(20)
    expect(result.pageSize.value).toBe(20)
    expect(result.currentPage.value).toBe(1)
    expect(info.page).toBe(1)
    expect(info.size).toBe(20)
    expect(info.reason).toBe('pageSizeChange')
  })

  it('setPageSize clamps to minimum 1', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    const info = result.setPageSize(0)
    expect(info.size).toBe(1)
  })

  it('loadMore returns null when no more data', () => {
    const total = ref(10)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    result.pageSize.value = 10
    result.currentPage.value = 1
    const info = result.loadMore()
    expect(info).toBeNull()
  })

  it('loadMore returns next page info', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    result.pageSize.value = 10
    result.currentPage.value = 1
    const info = result.loadMore()
    expect(info).not.toBeNull()
    expect(info!.page).toBe(2)
    expect(info!.reason).toBe('loadMore')
  })

  it('paginationClass returns sticky class when sticky', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    expect(result.paginationClass.value).toBe('')
    result.isSticky.value = true
    expect(result.paginationClass.value).toBe('adv-table__page--sticky')
  })

  it('paginationClass returns manual class in manual mode', () => {
    const total = ref(100)
    const isManual = ref(true)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    result.isSticky.value = true
    expect(result.paginationClass.value).toContain('adv-table__page--manual')
  })

  it('exposes hasMore in manual mode', () => {
    const total = ref(100)
    const isManual = ref(true)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    result.pageSize.value = 10
    result.currentPage.value = 5
    // 5 * 10 = 50 < 100, so hasMore is true
    expect(result.hasMore.value).toBe(true)

    result.currentPage.value = 10
    // 10 * 10 = 100 >= 100, so hasMore is false
    expect(result.hasMore.value).toBe(false)
  })

  it('uses propsTotal in manual mode', () => {
    const total = ref(50)
    const isManual = ref(true)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      propsTotal: 200,
    })
    expect(result.paginationTotal.value).toBe(200)
  })

  it('uses custom pageSizes', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      pageSizes: [5, 10, 25, 50],
    })
    expect(result.pageSizes.value).toEqual([5, 10, 25, 50])
  })

  it('should not create sticky observer during setup (deferred to onMounted)', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      sticky: true,
      containerHeight: 800,
    })
    // isSticky starts false — the watch on containerHeight has NO immediate:true,
    // and onMounted hasn't run (not inside a mounted component)
    expect(result.isSticky.value).toBe(false)

    // Changing containerHeight after setup DOES trigger the watch (reactive still works)
    // but with nullRef paginationRef, setupStickyObserver bails early → isSticky stays false
    // This at minimum confirms the watch syntax is valid and doesn't crash
  })

  it('isClient is true when mode is client', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      mode: 'client',
    })
    expect(result.isClient.value).toBe(true)
  })

  it('isClient is false for page mode', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      mode: 'page',
    })
    expect(result.isClient.value).toBe(false)
  })

  it('paginationTotal is 0 when total is 0', () => {
    const total = ref(0)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    expect(result.paginationTotal.value).toBe(0)
  })

  it('paginationTotal uses total directly in page mode', () => {
    const total = ref(50)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      propsTotal: 999,
    })
    expect(result.paginationTotal.value).toBe(50)
  })

  it('hasMore returns false when total is 0', () => {
    const total = ref(0)
    const isManual = ref(true)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    expect(result.hasMore.value).toBe(false)
  })

  it('loadMore returns null when total is 0 in manual mode', () => {
    const total = ref(0)
    const isManual = ref(true)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    const info = result.loadMore()
    expect(info).toBeNull()
  })

  it('setPageSize returns needsReset=true in manual mode', () => {
    const total = ref(100)
    const isManual = ref(true)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    const info = result.setPageSize(20)
    expect(info.needsReset).toBe(true)
  })

  it('setCurrentPage returns isClient=true in client mode', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      mode: 'client',
    })
    const info = result.setCurrentPage(2)
    expect(info.isClient).toBe(true)
  })

  it('paginationClass is empty when not sticky and not manual', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    expect(result.paginationClass.value).toBe('')
  })

  it('uses custom layout', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      layout: 'prev, pager, next',
    })
    expect(result.localPageLayout.value).toBe('prev, pager, next')
  })

  it('loadMore returns null when current page is the last page', () => {
    const total = ref(50)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    result.pageSize.value = 10
    result.currentPage.value = 5
    expect(result.loadMore()).toBeNull()
  })

  it('paginationTotal tracks total ref changes', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: nullRef, isManual })
    expect(result.paginationTotal.value).toBe(100)
    total.value = 200
    expect(result.paginationTotal.value).toBe(200)
  })

  it('loadMore returns pagination info for next page', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: ref(null), isManual })
    result.setPageSize(10)
    result.setCurrentPage(1)
    const info = result.loadMore()
    expect(info).not.toBeNull()
    expect(info!.page).toBe(2)
    expect(info!.reason).toBe('loadMore')
  })

  it('loadMore returns null when total is 0 in manual mode (boundary)', () => {
    const total = ref(0)
    const isManual = ref(true)
    const result = useTablePagination({ total, paginationRef: ref(null), isManual })
    expect(result.loadMore()).toBeNull()
  })

  it('hasMore returns false when total is 0 (boundary)', () => {
    const total = ref(0)
    const isManual = ref(true)
    const result = useTablePagination({ total, paginationRef: ref(null), isManual })
    expect(result.hasMore.value).toBe(false)
  })

  it('setPageSize returns needsReset true in manual mode (boundary)', () => {
    const total = ref(100)
    const isManual = ref(true)
    const result = useTablePagination({ total, paginationRef: ref(null), isManual })
    const info = result.setPageSize(20)
    expect(info.needsReset).toBe(true)
  })

  it('setCurrentPage returns isClient true in client mode (boundary)', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: ref(null), isManual, mode: 'client' })
    const info = result.setCurrentPage(2)
    expect(info.isClient).toBe(true)
  })

  it('paginationClass is empty when not sticky and not manual (dup)', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: ref(null), isManual })
    expect(result.paginationClass.value).toBe('')
  })

  it('uses custom layout (dup)', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: ref(null), isManual, layout: 'prev, pager, next' })
    expect(result.localPageLayout.value).toBe('prev, pager, next')
  })

  it('handles sticky class when sticky', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({ total, paginationRef: ref(null), isManual, sticky: true, containerHeight: 800 })
    result.isSticky.value = true
    expect(result.paginationClass.value).toBe('adv-table__page--sticky')
  })

  it('handles manual class in manual mode', () => {
    const total = ref(100)
    const isManual = ref(true)
    const result = useTablePagination({ total, paginationRef: ref(null), isManual })
    result.isSticky.value = true
    expect(result.paginationClass.value).toContain('adv-table__page--manual')
  })
})

describe('watchClientPaginationCorrection', () => {
  it('syncs total and clamps an out-of-range page in client mode', async () => {
    const total = ref(0)
    const isManual = ref(false)
    const pagination = useTablePagination({ total, paginationRef: ref(null), isManual, mode: 'client' })
    pagination.setCurrentPage(5)
    const displayLength = ref(0)
    watchClientPaginationCorrection({
      displayLength: () => displayLength.value,
      isClient: pagination.isClient,
      total,
      pageSize: pagination.pageSize,
      currentPage: pagination.currentPage,
      setCurrentPage: pagination.setCurrentPage,
    })
    // immediate run with len 0 → guard no-op
    expect(total.value).toBe(0)
    expect(pagination.currentPage.value).toBe(5)
    displayLength.value = 25
    await nextTick()
    expect(total.value).toBe(25)
    // 25 rows / 10 per page → max page 3, current page 5 is clamped
    expect(pagination.currentPage.value).toBe(3)
  })

  it('does nothing without client pagination', async () => {
    const total = ref(0)
    const isManual = ref(false)
    const pagination = useTablePagination({ total, paginationRef: ref(null), isManual })
    const displayLength = ref(25)
    watchClientPaginationCorrection({
      displayLength: () => displayLength.value,
      isClient: pagination.isClient,
      total,
      pageSize: pagination.pageSize,
      currentPage: pagination.currentPage,
      setCurrentPage: pagination.setCurrentPage,
    })
    await nextTick()
    expect(total.value).toBe(0)
  })

  it('does nothing on empty data even in client mode', async () => {
    const total = ref(99)
    const isManual = ref(false)
    const pagination = useTablePagination({ total, paginationRef: ref(null), isManual, mode: 'client' })
    watchClientPaginationCorrection({
      displayLength: () => 0,
      isClient: pagination.isClient,
      total,
      pageSize: pagination.pageSize,
      currentPage: pagination.currentPage,
      setCurrentPage: pagination.setCurrentPage,
    })
    await nextTick()
    expect(total.value).toBe(99)
  })
})
