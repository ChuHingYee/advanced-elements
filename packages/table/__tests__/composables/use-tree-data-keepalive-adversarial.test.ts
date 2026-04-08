import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { useTreeData } from '../../src/composables/data/use-tree-data'

/**
 * <zh/> 树懒加载 KeepAlive 接缝对抗用例——deactivate 中飞清理（abort + loading 复位 +
 * <zh/> revision 递增）与卸载路径。目标是找出问题：任何「响应写入已停靠组件」或
 * <zh/> 「loading 图标卡死」即暴露缺陷。
 * <en/> Tree lazy-load KeepAlive seam adversarial cases — mid-flight deactivate cleanup
 * <en/> (abort + loading reset + revision bump) and the unmount path. A response writing into a
 * <en/> parked component or a stuck loading icon exposes a defect.
 */

function mountKeepAlive(setupCb: () => void) {
  const show = ref(true)
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
    deactivate: async () => {
      show.value = false
      await nextTick()
    },
    activate: async () => {
      show.value = true
      await nextTick()
    },
  }
}

describe('tree lazy-load KeepAlive seam (adversarial)', () => {
  it('deactivation mid-flight aborts the load: children are NOT written into the parked component', async () => {
    // <zh/> 切出时 abort + loading 复位——迟到的 children 不得写入已停靠组件
    // <en/> switching away aborts and resets loading — late children must not write a parked component
    let release: (() => void) | null = null
    const gate = new Promise<any[]>((resolve) => {
      release = () => resolve([{ id: 'r-late' }])
    })
    const loadData = vi.fn(async (_row: any, _key: string, opts: { signal?: AbortSignal }) => {
      await new Promise<void>((r) => {
        opts.signal?.addEventListener('abort', () => r([]))
        void gate.then(() => r([{ id: 'r-late' }]))
      })
      return opts.signal?.aborted ? [] : [{ id: 'r-late' }]
    })
    const row = { id: 'r', hasChildren: true }
    let api!: ReturnType<typeof useTreeData>
    const harness = mountKeepAlive(() => {
      api = useTreeData<any>({
        treeConfig: ref({ children: 'children', loadData: loadData as any, hasChildren: 'hasChildren' }),
        data: ref([row]),
        rowKeyFn: () => (r: any) => r.id,
      })
    })
    void api.flattenedData.value

    const pending = api.toggleRowExpand('r')
    await harness.deactivate()
    release!()
    await pending
    await nextTick()

    // <zh/> 迟到响应被丢弃：children 未写入、loading 已复位、行未标记 loaded
    // <en/> the late response is dropped: children unwritten, loading reset, not marked loaded
    expect(row.children).toBeUndefined()
    const meta = api.getTreeMeta(row)
    expect(meta?.loading).toBe(false)
    expect(meta?.loaded).toBe(false)

    harness.wrapper.unmount()
  })

  it('after deactivate-abort the row stays retryable on reactivation (no permanent wedge)', async () => {
    // <zh/> abort 后不标记 loaded：重新激活后再次展开重新请求——防「永久卡死」
    // <en/> after an abort the row is not marked loaded: re-expanding after reactivation re-requests
    let release: (() => void) | null = null
    const gate = new Promise<any[]>((resolve) => {
      release = () => resolve([{ id: 'r-late' }])
    })
    const loadData = vi.fn(async () => {
      await gate
      return [{ id: 'r-late' }]
    })
    const row = { id: 'r', hasChildren: true }
    let api!: ReturnType<typeof useTreeData>
    const harness = mountKeepAlive(() => {
      api = useTreeData<any>({
        treeConfig: ref({ children: 'children', loadData: loadData as any, hasChildren: 'hasChildren' }),
        data: ref([row]),
        rowKeyFn: () => (r: any) => r.id,
      })
    })
    void api.flattenedData.value

    const pending = api.toggleRowExpand('r')
    await harness.deactivate()
    release!()
    await pending
    await harness.activate()

    // <zh/> 重激活后再次展开 → 重新请求并成功落地
    // <en/> re-expanding after reactivation → fresh request that lands
    await api.toggleRowExpand('r')
    expect(loadData).toHaveBeenCalledTimes(2)
    expect(row.children).toEqual([{ id: 'r-late' }])
    expect(api.expandedRowKeys.value.has('r')).toBe(true)

    harness.wrapper.unmount()
  })

  it('unmount mid-flight also drops the response (no write-after-unmount)', async () => {
    let release: (() => void) | null = null
    const gate = new Promise<any[]>((resolve) => {
      release = () => resolve([{ id: 'late' }])
    })
    const loadData = vi.fn(async () => {
      await gate
      return [{ id: 'late' }]
    })
    const row = { id: 'r', hasChildren: true }
    let api!: ReturnType<typeof useTreeData>
    const harness = mountKeepAlive(() => {
      api = useTreeData<any>({
        treeConfig: ref({ children: 'children', loadData: loadData as any, hasChildren: 'hasChildren' }),
        data: ref([row]),
        rowKeyFn: () => (r: any) => r.id,
      })
    })
    void api.flattenedData.value

    const pending = api.toggleRowExpand('r')
    harness.wrapper.unmount()
    release!()
    await pending
    await nextTick()

    expect(row.children).toBeUndefined()
    expect(api.expandedRowKeys.value.has('r')).toBe(false)
  })
})
