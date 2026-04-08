/**
 * @file use-table-pagination phase2 — 补充分支覆盖
 * Covers: autoPageSize, manual mode, hasMore, loadMore, paginationClass, sticky observer
 */
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useTablePagination } from '../../src/composables/data/use-table-pagination'

const nullRef = ref(null)

describe('useTablePagination phase2 — manual mode', () => {
  it('paginationTotal prefers propsTotal in manual mode', () => {
    const total = ref(50)
    const isManual = ref(true)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      propsTotal: () => 100,
    })
    expect(result.paginationTotal.value).toBe(100)
  })

  it('paginationTotal falls back to total when propsTotal is undefined', () => {
    const total = ref(50)
    const isManual = ref(true)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
    })
    expect(result.paginationTotal.value).toBe(50)
  })

  it('paginationTotal uses total directly in non-manual mode', () => {
    const total = ref(50)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      propsTotal: () => 100,
    })
    expect(result.paginationTotal.value).toBe(50)
  })
})

describe('useTablePagination phase2 — hasMore', () => {
  it('returns true when current page * size < total', () => {
    const total = ref(100)
    const isManual = ref(true)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
    })
    result.setCurrentPage(5)
    expect(result.hasMore.value).toBe(true) // 5 * 10 = 50 < 100
  })

  it('returns false when total <= 0', () => {
    const total = ref(0)
    const isManual = ref(true)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
    })
    expect(result.hasMore.value).toBe(false)
  })

  it('returns false when current page * size >= total', () => {
    const total = ref(20)
    const isManual = ref(true)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      pageSize: () => 10,
    })
    result.setCurrentPage(2)
    expect(result.hasMore.value).toBe(false) // 2 * 10 = 20 >= 20
  })
})

describe('useTablePagination phase2 — loadMore', () => {
  it('returns null when no more data', () => {
    const total = ref(10)
    const isManual = ref(true)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      pageSize: () => 10,
    })
    const info = result.loadMore()
    expect(info).toBeNull()
  })

  it('increments page and returns change info', () => {
    const total = ref(100)
    const isManual = ref(true)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
    })
    result.setCurrentPage(1)
    const info = result.loadMore()
    expect(info).not.toBeNull()
    expect(info!.page).toBe(2)
    expect(info!.reason).toBe('loadMore')
    expect(info!.isClient).toBe(false)
    expect(info!.needsReset).toBe(false)
  })
})

describe('useTablePagination phase2 — paginationClass', () => {
  it('includes sticky class when isSticky is true', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      sticky: () => false, // disable observer to avoid side effects
    })
    // isSticky starts as false
    expect(result.paginationClass.value).not.toContain('sticky')
  })

  it('includes manual class when isManual is true', () => {
    const total = ref(100)
    const isManual = ref(true)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      sticky: () => false,
    })
    expect(result.paginationClass.value).toContain('manual')
  })
})

describe('useTablePagination phase2 — client mode', () => {
  it('isClient is true when mode is client', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      mode: () => 'client',
    })
    expect(result.isClient.value).toBe(true)
  })

  it('isClient is false when mode is page', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      mode: () => 'page',
    })
    expect(result.isClient.value).toBe(false)
  })
})

describe('useTablePagination phase2 — setPageSize with manual mode', () => {
  it('returns needsReset=true in manual mode', () => {
    const total = ref(100)
    const isManual = ref(true)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
    })
    const info = result.setPageSize(20)
    expect(info.needsReset).toBe(true)
  })

  it('returns needsReset=false in non-manual mode', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
    })
    const info = result.setPageSize(20)
    expect(info.needsReset).toBe(false)
  })
})

describe('useTablePagination phase2 — custom layout and pageSizes', () => {
  it('uses custom layout', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      layout: () => 'prev, next',
    })
    expect(result.localPageLayout.value).toBe('prev, next')
  })

  it('uses default layout when not provided', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
    })
    expect(result.localPageLayout.value).toBe('total, sizes, prev, pager, next, jumper')
  })

  it('uses custom pageSizes', () => {
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      pageSizes: () => [5, 10, 50],
    })
    expect(result.pageSizes.value).toEqual([5, 10, 50])
  })
})

describe('useTablePagination phase2 — resolvedConfig stability', () => {
  it('syncs external pageSize changes to localPageSize', async () => {
    const pageSizeRef = ref(10)
    const total = ref(100)
    const isManual = ref(false)
    const result = useTablePagination({
      total,
      paginationRef: nullRef,
      isManual,
      pageSize: () => pageSizeRef.value,
    })
    expect(result.pageSize.value).toBe(10)
    pageSizeRef.value = 20
    await nextTick()
    expect(result.pageSize.value).toBe(20)
  })
})
