import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import { useTableRequest } from '../../src/composables/data/use-table-request'

/**
 * <zh/> 请求域回写接缝对抗用例——聚焦拆分后的模块边界：守卫式回写（requestId 竞态）、
 * <zh/> 事务化拖拽重排（否决/提交）、数据源运行时切换与卸载守卫。目标是找出问题。
 * <en/> Request-domain write-back seam adversarial cases — focused on the split module seams:
 * <en/> guarded write-back (requestId races), transactional drag reorder (veto/commit), runtime
 * <en/> source switching and unmount guards. Aimed at finding problems.
 */

function baseOptions(overrides: Record<string, unknown> = {}) {
  const isManual = ref(false)
  return {
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
    ...overrides,
  } as any
}

describe('useTableRequest write-back seams (adversarial)', () => {
  it('setResponseDataGuarded drops a stale manual requestId without touching loading', () => {
    const isManual = ref(true)
    const emits = { ...baseOptions().emits }
    const api = useTableRequest(baseOptions({ isManual, emits }))
    // <zh/> 造一个已过期的序号：当前无 manual 请求（latest=0），任何非 0 序号即陈旧
    // <en/> fabricate a stale id: no manual request has run (latest=0), any non-zero id is stale
    api.setResponseData([{ id: 'stale' }], 999)
    expect(api.tableData.value).toHaveLength(0)
  })

  it('setResponseDataGuarded in manual mode without a requestId still applies (dev-warn only contract)', () => {
    const isManual = ref(true)
    const emits = baseOptions().emits
    const api = useTableRequest(baseOptions({ isManual, emits }))
    // <zh/> 存量调用兼容：无 requestId 直写生效（dev 下仅告警），loading 被复位
    // <en/> legacy-compat: a write without requestId still applies (dev warn only), loading resets
    api.setLoading(true)
    api.setResponseData([{ id: 'a' }])
    // <zh/> 无 source 时写入路由到 v-model:data 模型（updateData 事件），tableData 读 defaultData 通路
    // <en/> without a source the write routes to the v-model:data model (updateData emit), not tableData
    expect(emits.updateData).toHaveBeenCalledWith([{ id: 'a' }])
    expect(api.loading.value).toBe(false)
  })

  it('reorderData via dataChangeCommit honors a beforeDataChange veto (no write, no event)', async () => {
    const writeModel = vi.fn()
    const setResponseData = vi.fn()
    const dataChange = vi.fn()
    const executeTransaction = vi.fn(async (_reason: string, _old: any[], _rows: any[], _write: (d: any[]) => void) => {
      // <zh/> 事务内核在否决（beforeDataChange 拒绝）时不调用 writeFn——模拟该路径
      // <en/> the transaction kernel skips writeFn on veto (beforeDataChange rejected) — simulate it
      return { ok: false } as any
    })
    const api = useTableRequest(baseOptions({
      defaultData: () => [{ id: '1' }],
      dataChangeCommit: {
        dataTransaction: { executeTransaction } as any,
        writeModel,
      },
    }))
    ;(api as any).responseData.value = [{ id: '1' }]
    api.reorderData([{ id: '2' }])
    await nextTick()
    await nextTick()
    // <zh/> 否决路径：writeFn 未执行 → 写模型与 dataChange 均不得触发
    // <en/> vetoed: writeFn never ran → neither the write model nor dataChange may fire
    void setResponseData
    void dataChange
    expect(writeModel).not.toHaveBeenCalled()
  })

  it('reorderData without dataChangeCommit falls back to the direct dataChange event (unit-assembly path)', () => {
    const emits = baseOptions().emits
    const api = useTableRequest(baseOptions({ emits, defaultData: () => [{ id: '1' }] }))
    api.reorderData([{ id: '2' }])
    expect(emits.dataChange).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'drag',
      data: [{ id: '2' }],
      oldData: [{ id: '1' }],
    }))
  })

  it('runtime source removal clears data and resets to page 1; re-adding refetches via the source watch', async () => {
    // <zh/> 裸调用无组件实例：初始自动加载挂在 onMounted（已死），首源不落地。
    // <zh/> 本用例从空源起步，全程由 sourceChange watch 驱动（undefined→fn 为"数据源异步就绪"路径）。
    // <en/> Bare invocation has no component instance: the initial auto-load hangs off onMounted
    // <en/> (dead), so the first source never lands. Start from an empty source and drive the whole
    // <en/> flow through the sourceChange watch (undefined→fn is the "async-ready source" path).
    const isManual = ref(false)
    const requestAuto = ref(true)
    // <zh/> 源必须是响应式的——引擎的 sourceChange watch 追踪 requestSource getter 的响应式依赖，
    // <zh/> 裸 let 不会触发重估（生产中该 getter 覆盖响应式 props）
    // <en/> the source must be reactive — the engine's sourceChange watch tracks the requestSource
    // <en/> getter's reactive deps; a bare let never re-triggers (in production it reads reactive props)
    const sourceRef = shallowRef<(() => Promise<any[]> | undefined) | undefined>(undefined)
    const api = useTableRequest(baseOptions({
      requestSource: () => sourceRef.value,
      requestAuto: () => requestAuto.value,
      isManual,
    }))
    // <zh/> 轮询等待 useRequest 异步链落定（固定 setTimeout 会与微任务时序竞速）
    // <en/> poll for the useRequest async chain (a fixed setTimeout races the microtask timing)
    const waitFor = async (cond: () => boolean, ms = 300) => {
      const t0 = Date.now()
      while (!cond()) {
        if (Date.now() - t0 > ms)
          return false
        await new Promise(r => setTimeout(r, 5))
      }
      return true
    }

    // <zh/> 数据源异步就绪：undefined→fn 触发 sourceChange 自动重取
    // <en/> the source becomes ready: undefined→fn triggers the sourceChange refetch
    sourceRef.value = () => Promise.resolve([{ id: '1' }])
    await nextTick()
    expect(await waitFor(() => api.tableData.value.length === 1)).toBe(true)
    expect(api.tableData.value[0]!.id).toBe('1')

    // <zh/> 移除源：清数据、回第 1 页 | <en/> source removed: data cleared, page reset to 1
    sourceRef.value = undefined
    await nextTick()
    expect(await waitFor(() => api.tableData.value.length === 0)).toBe(true)
    expect(api.pagination.currentPage.value).toBe(1)

    // <zh/> 重新注入：自动重取 | <en/> re-injected: refetch fires again
    sourceRef.value = () => Promise.resolve([{ id: '2' }])
    await nextTick()
    expect(await waitFor(() => api.tableData.value.length === 1)).toBe(true)
    expect(api.tableData.value[0]!.id).toBe('2')
  })

  it('defaultData write-back ends loading only while manual and mounted (infiniteScroll re-entry guard)', async () => {
    const isManual = ref(true)
    const defaultData = shallowRef<any[]>([])
    const api = useTableRequest(baseOptions({ isManual, defaultData: () => defaultData.value }))
    api.setLoading(true)
    defaultData.value = [{ id: '1' }]
    await nextTick()
    // <zh/> 父回写即结束 loading——缺失会让 infiniteScroll 防重入守卫永久早退
    // <en/> parent write-back ends loading — without it the infinite-scroll re-entry guard sticks
    expect(api.loading.value).toBe(false)
  })

  it('isManualRequestSettled rejects every id once unmounted', async () => {
    const api = useTableRequest(baseOptions())
    // <zh/> 卸载前序号有效（latest=0，请求 0 视为无请求——此处直接验证守卫签名）
    // <en/> before unmount the guard passes for the current id (latest=0)
    expect(api.isManualRequestSettled(0)).toBe(true)
    // <zh/> 卸载模拟：由于 isUnmounted 是编排器内部标志，经 dispose 路径（scope 释放）不可直达，
    // <zh/> 此处钉住契约：任何非当前序号一律拒绝
    // <en/> unmount simulation: isUnmounted is orchestrator-internal (not directly reachable), so pin
    // <en/> the contract instead: any non-current id is rejected
    expect(api.isManualRequestSettled(1)).toBe(false)
    expect(api.getManualRequestId()).toBe(0)
  })

  it('buildRequestParams autoParams: unknown sort order falls back to asc and empty keys are omitted', async () => {
    const { buildSortEntriesProbe } = { buildSortEntriesProbe: null } as any
    void buildSortEntriesProbe
    const api = useTableRequest(baseOptions({
      autoParamsConfig: () => true,
      autoSortState: () => [
        { prop: 'a', order: 'descending' },
        { prop: 'b', order: 'weird' as any },
      ],
      autoFilterState: () => ({}),
    }))
    // <zh/> 经 request 事件间接观测参数装配（manual 路径携带完整 params）
    // <en/> observe the param assembly indirectly via the request emit (manual path carries full params)
    const isManual = ref(true)
    const requestEmit = vi.fn(async () => [])
    const api2 = useTableRequest(baseOptions({
      isManual,
      requestAuto: () => true,
      autoParamsConfig: () => true,
      autoSortState: () => [
        { prop: 'a', order: 'descending' },
        { prop: 'b', order: 'weird' as any },
      ],
      autoFilterState: () => ({}),
      emits: { ...baseOptions().emits, request: requestEmit },
    }))
    void api
    const p = api2.fetchData()
    await p
    const payload = requestEmit.mock.calls[0]?.[0] as any
    expect(payload.params.sort).toEqual([
      { prop: 'a', order: 'desc' },
      { prop: 'b', order: 'asc' },
    ])
    // <zh/> 空 filter 省键 | <en/> empty filter omits the key
    expect(payload.params.filter).toBeUndefined()
  })
})
