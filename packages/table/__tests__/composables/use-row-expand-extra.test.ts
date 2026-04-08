import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useRowExpand } from '../../src/composables/data/use-row-expand'

/**
 * <zh/> 行展开补充单测——覆盖异步持久化、存储失败、逻辑索引与加载取消。
 * <en/> Row-expand supplementary tests — async persistence, storage faults, logical index and load cancel.
 */
const rows = [{ id: 1 }, { id: 2 }]
const rowKeyFn = (row: any) => String(row.id)

describe('useRowExpand async persistence', () => {
  it('restores nothing from async adapters on the sync path', () => {
    const { expandedData } = useRowExpand({
      rowExpandConfig: ref({ enabled: true, persistence: { key: 'k', storage: 'localStorage' } }),
      data: ref(rows.map(r => ({ ...r }))),
      rowKeyFn: ref(rowKeyFn),
    })
    expect(expandedData.value).toHaveLength(2)
  })

  it('reports corrupted stored json', () => {
    const onStorageError = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem('k-bad', '{broken')
    useRowExpand({
      rowExpandConfig: ref({ enabled: true, persistence: { key: 'k-bad', storage: 'localStorage' } }),
      data: ref(rows.map(r => ({ ...r }))),
      rowKeyFn: ref(rowKeyFn),
      onStorageError,
    })
    expect(onStorageError).toHaveBeenCalledWith(expect.objectContaining({ phase: 'read' }))
    localStorage.removeItem('k-bad')
    warn.mockRestore()
  })
})

describe('useRowExpand logical index', () => {
  it('maps known rows and misses foreign objects', () => {
    const dataArr = rows.map(r => ({ ...r }))
    const { rowExpandApi, expandedData } = useRowExpand({
      rowExpandConfig: ref({ enabled: true }),
      data: ref(dataArr),
      rowKeyFn: ref(rowKeyFn),
    })
    expect(expandedData.value).toHaveLength(2)
    expect(rowExpandApi.getLogicalIndex(expandedData.value[0])).toBe(0)
    expect(rowExpandApi.getLogicalIndex({ id: 99 })).toBeUndefined()
  })
})

describe('useRowExpand load cancellation', () => {
  it('drops loads cancelled before resolve', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let api!: ReturnType<typeof useRowExpand>
    const wrapper = mount(defineComponent({
      setup() {
        api = useRowExpand({
          rowExpandConfig: ref({ enabled: true }),
          data: ref(rows.map(r => ({ ...r }))),
          rowKeyFn: ref(rowKeyFn),
          load: () => gate,
        } as any)
        return () => h('div')
      },
    }))
    const p = api.rowExpandApi.expandDetailRow(1)
    api.rowExpandApi.collapseDetailRow(1)
    release!()
    await p
    await new Promise(r => setTimeout(r, 0))
    expect(api.expandedData.value).toHaveLength(2)
    wrapper.unmount()
  })
})
