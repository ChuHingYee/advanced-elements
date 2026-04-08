import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTableRequest } from '../../src/composables/data/use-table-request'

/**
 * <zh/> 内建事务提交路径——reorderData 经 dataChangeCommit 走事务内核，
 * <zh/> 写路由收敛到 writeFullData，不再需要调用方晚绑定 holder
 * <en/> Built-in transaction commit path — reorderData commits via dataChangeCommit through
 * <en/> the transaction kernel, with writes converged on writeFullData; no caller-side late-bound holder
 */
function buildRequest(options: {
  source?: boolean
  veto?: boolean
  defaultData?: any[]
} = {}) {
  const isManual = ref(false)
  const writeModel = vi.fn()
  const executed: Array<[string, any[], any[]]> = []
  const rows = options.defaultData ?? [{ id: '1' }, { id: '2' }]
  const dataTransaction = {
    executeTransaction: vi.fn(async (reason: string, oldData: any[], newData: any[], writeFn: (data: any[]) => void) => {
      executed.push([reason, oldData, newData])
      if (options.veto)
        return false
      await writeFn(newData)
      return true
    }),
  }
  const result = useTableRequest<any>({
    requestSource: options.source ? () => ({ url: '/api/data' }) as any : () => undefined,
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
    defaultData: () => rows,
    dataChangeCommit: { dataTransaction: dataTransaction as any, writeModel },
    emits: {
      pageChange: vi.fn(),
      updateLoading: vi.fn(),
      request: vi.fn() as any,
      refresh: vi.fn(),
      updateData: vi.fn(),
      onError: vi.fn(),
    },
  })
  return { result, writeModel, dataTransaction, executed, rows }
}

describe('useTableRequest dataChangeCommit path', () => {
  it('routes local reorder writes to writeModel with a pre-write snapshot', async () => {
    const { result, writeModel, dataTransaction, executed, rows } = buildRequest()
    const reordered = [rows[1], rows[0]]
    result.reorderData(reordered)
    await Promise.resolve()
    expect(dataTransaction.executeTransaction).toHaveBeenCalledTimes(1)
    expect(executed[0][0]).toBe('drag')
    expect(executed[0][1]).toEqual(rows)
    expect(executed[0][1]).not.toBe(rows)
    expect(executed[0][2]).toBe(reordered)
    expect(writeModel).toHaveBeenCalledWith(reordered)
  })

  it('routes remote reorder writes to responseData (observable via tableData)', async () => {
    const { result } = buildRequest({ source: true })
    expect(result.hasSource.value).toBe(true)
    const reordered = [{ id: '2' }, { id: '1' }]
    result.reorderData(reordered)
    await Promise.resolve()
    expect(result.tableData.value).toEqual(reordered)
  })

  it('writes nothing when the transaction is vetoed', async () => {
    const { result, writeModel } = buildRequest({ veto: true })
    result.reorderData([{ id: '9' }])
    await Promise.resolve()
    expect(writeModel).not.toHaveBeenCalled()
  })
})
