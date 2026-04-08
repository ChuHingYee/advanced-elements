import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { useTableRequest } from '../../src/composables/data/use-table-request'

/**
 * <zh/> loading 桥接 KeepAlive 接缝对抗用例（拆分新模块 use-request-loading-bridge）——
 * <zh/> deactivated 停 watch 并失效 manual 在飞、reactivated 重启并补发 loading、
 * <zh/> 重激活触发 URL 分页重同步。目标是找出问题。
 * <en/> Loading-bridge KeepAlive seam adversarial cases (the new use-request-loading-bridge module) —
 * <en/> deactivate stops the watch and invalidates in-flight manual work; reactivate restarts and
 * <en/> re-syncs loading; reactivation re-syncs URL pagination. Aimed at finding problems.
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

/**
 * <zh/> KeepAlive 挂载壳——Host 常驻，Inner 可被 deactivate/reactivate（切 v-if）。
 * <en/> KeepAlive mount shell — Host stays alive; Inner is deactivated/reactivated via v-if.
 */
function mountKeepAlive(setupCb: () => void) {
  const show = ref(true)
  // <zh/> Inner 先声明（Host 的渲染闭包引用它）；hook 注册在 setup 内，顺序无碍
  // <en/> Inner declared first (Host's render closure references it); hooks register inside setup
  const Inner = defineComponent({
    setup() {
      setupCb()
      return () => h('div')
    },
  })
  const Host = defineComponent({
    setup() {
      return () => h(KeepAlive, () => (show.value ? h(Inner) : null))
    },
  })
  const wrapper = mount(Host)
  return {
    wrapper,
    /** <zh/> 切出（触发 onDeactivated） | <en/> switch away (fires onDeactivated) */
    deactivate: async () => {
      show.value = false
      await nextTick()
    },
    /** <zh/> 切回（触发 onActivated） | <en/> switch back (fires onActivated) */
    activate: async () => {
      show.value = true
      await nextTick()
    },
  }
}

describe('use-request-loading-bridge KeepAlive seam (adversarial)', () => {
  it('deactivation invalidates an in-flight manual request: the late response is dropped', async () => {
    // <zh/> 切出时 manual 序号推进 + abort——deactivated 期间完成的旧响应经守卫丢弃，
    // <zh/> 不得写入已停靠组件的数据（auto 路径由 useRequest cancelRequest 对称处理）
    // <en/> switching away bumps the manual sequence and aborts — responses completing while
    // <en/> deactivated are dropped by the guard and never write a parked component's data
    let release: (() => void) | null = null
    const gate = new Promise<any[]>((resolve) => {
      release = () => resolve([{ id: 'late' }])
    })
    const isManual = ref(true)
    const requestEmit = vi.fn(() => gate)
    const updateData = vi.fn()
    let api!: ReturnType<typeof useTableRequest>
    const harness = mountKeepAlive(() => {
      api = useTableRequest(baseOptions({
        isManual,
        requestAuto: () => true,
        emits: { ...baseOptions().emits, request: requestEmit, updateData },
      }))
    })

    api!.fetchData({ reason: 'refresh' })
    await harness.deactivate()
    release!()
    await gate
    await nextTick()
    await new Promise(r => setTimeout(r, 10))

    // <zh/> 迟到响应被丢弃：无写入、无 loading 泄漏 | <en/> the late response is dropped: no write, no loading leak
    expect(updateData).not.toHaveBeenCalled()
    expect(api!.loading.value).toBe(false)
    // <zh/> 序号已推进：旧请求永久失效 | <en/> the sequence advanced: the old request is permanently superseded
    expect(api!.isManualRequestSettled(1)).toBe(false)

    harness.wrapper.unmount()
  })

  it('reactivation restarts the loading watch and re-syncs the current value to the parent', async () => {
    // <zh/> 重激活补发：watch 重启后立即同步当前 loading（避免漏 emit）
    // <en/> on reactivation the restarted watch syncs the current loading value (no missed emit)
    const isManual = ref(false)
    const updateLoading = vi.fn()
    let api!: ReturnType<typeof useTableRequest>
    const harness = mountKeepAlive(() => {
      api = useTableRequest(baseOptions({ isManual, emits: { ...baseOptions().emits, updateLoading } }))
    })

    const callsBefore = updateLoading.mock.calls.length
    api!.setLoading(true)
    await nextTick()
    // <zh/> flush:'pre' 的 watch 回调经调度队列——断言前必须让 tick 跑完
    // <en/> the flush:'pre' watch callback goes through the scheduler queue — let a tick land first
    expect(updateLoading.mock.calls.length).toBeGreaterThan(callsBefore)

    await harness.deactivate()
    // <zh/> 停靠期间 loading 变化不外发（watch 已停） | <en/> loading flips while parked do not emit (watch stopped)
    const parkedBefore = updateLoading.mock.calls.length
    api!.setLoading(false)
    api!.setLoading(true)
    await nextTick()
    expect(updateLoading.mock.calls.length).toBe(parkedBefore)

    await harness.activate()
    // <zh/> 重激活补发当前值 | <en/> reactivation re-emits the current value
    const last = updateLoading.mock.calls.at(-1)
    expect(last?.[0]).toBe(api!.loading.value)

    harness.wrapper.unmount()
  })

  it('deactivation aborts an in-flight manual request so its settle guard turns false', async () => {
    let release: (() => void) | null = null
    const gate = new Promise<any[]>((resolve) => {
      release = () => resolve([])
    })
    const isManual = ref(true)
    const requestEmit = vi.fn(() => gate)
    let api!: ReturnType<typeof useTableRequest>
    const harness = mountKeepAlive(() => {
      api = useTableRequest(baseOptions({
        isManual,
        requestAuto: () => true,
        emits: { ...baseOptions().emits, request: requestEmit },
      }))
    })

    api!.fetchData({ reason: 'refresh' })
    const activeId = api!.getManualRequestId()
    expect(api!.isManualRequestSettled(activeId)).toBe(true)

    await harness.deactivate()
    // <zh/> 序号推进后，起飞时的序号即刻失效 | <en/> the bump instantly voids the in-flight id
    expect(api!.isManualRequestSettled(activeId)).toBe(false)

    release!()
    harness.wrapper.unmount()
  })

  it('unmount (not deactivate) also aborts in-flight work and stops the watch permanently', async () => {
    let release: (() => void) | null = null
    const gate = new Promise<any[]>((resolve) => {
      release = () => resolve([{ id: 'late' }])
    })
    const isManual = ref(true)
    const requestEmit = vi.fn(() => gate)
    const updateData = vi.fn()
    const updateLoading = vi.fn()
    let api!: ReturnType<typeof useTableRequest>
    const harness = mountKeepAlive(() => {
      api = useTableRequest(baseOptions({
        isManual,
        requestAuto: () => true,
        emits: { ...baseOptions().emits, request: requestEmit, updateData, updateLoading },
      }))
    })

    api!.fetchData({ reason: 'refresh' })
    harness.wrapper.unmount()
    release!()
    await gate
    await nextTick()
    await new Promise(r => setTimeout(r, 10))

    // <zh/> 卸载后：迟到响应丢弃、loading 不再外发 | <en/> after unmount: late response dropped, no loading emits
    expect(updateData).not.toHaveBeenCalled()
    const lastEmit = updateLoading.mock.calls.at(-1)?.[0]
    expect(lastEmit).toBe(false)
  })
})
