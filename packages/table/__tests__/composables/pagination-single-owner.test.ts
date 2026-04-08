import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useTablePagination, watchClientPaginationCorrection } from '../../src/composables/data/use-table-pagination'

describe('pagination single owner', () => {
  it('client mode reads clientTotal, server total writes are ignored by sync', async () => {
    const serverTotal = ref(999)
    const clientTotal = ref(0)
    const pagination = useTablePagination({
      mode: ref('client'),
      total: serverTotal,
      clientTotal,
      pageSize: ref(10),
      paginationRef: ref(null),
      isManual: ref(false),
    } as any)

    watchClientPaginationCorrection({
      displayLength: () => 25,
      isClient: pagination.isClient,
      total: serverTotal,
      clientTotal,
      pageSize: pagination.pageSize,
      currentPage: pagination.currentPage,
      setCurrentPage: pagination.setCurrentPage,
    })
    await nextTick()
    // 校正只写 client 侧，不污染服务端 total
    expect(clientTotal.value).toBe(25)
    expect(serverTotal.value).toBe(999)
    // 分页总数取 client 口径
    expect(pagination.paginationTotal.value).toBe(25)
  })

  it('server mode paginationTotal ignores clientTotal', () => {
    const pagination = useTablePagination({
      mode: ref('page'),
      total: ref(100),
      clientTotal: ref(5),
      pageSize: ref(10),
      paginationRef: ref(null),
      isManual: ref(false),
    } as any)
    expect(pagination.paginationTotal.value).toBe(100)
  })

  it('correction falls back to total for legacy callers without clientTotal', async () => {
    const total = ref(0)
    const pagination = useTablePagination({
      mode: ref('client'),
      total,
      pageSize: ref(10),
      paginationRef: ref(null),
      isManual: ref(false),
    } as any)
    watchClientPaginationCorrection({
      displayLength: () => 30,
      isClient: pagination.isClient,
      total,
      pageSize: pagination.pageSize,
      currentPage: pagination.currentPage,
      setCurrentPage: pagination.setCurrentPage,
    })
    await nextTick()
    expect(total.value).toBe(30)
  })
})
