import type { VueWrapper } from '@vue/test-utils'
import type { VNode } from 'vue'
import type { AdvColumn } from '../../src/types'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import AdvTable from '../../src/AdvTable.vue'

// <zh/> 预加载异步渲染器模块，defineAsyncComponent 即时解析 | <en/> Pre-load async renderer modules so defineAsyncComponent resolves immediately
import ('../../src/components/table-renderer/TableRenderer.vue')
import('../../src/components/table-virtual-renderer/TableVirtualRenderer.vue')

let wrapper: VueWrapper | null = null

function _mount(render: () => VNode): VueWrapper {
  wrapper = mount(render, {
    global: {
      config: {
        globalProperties: {
          $router: { query: {} },
        } as any,
      },
    },
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function countWarnsWith(warnSpy: ReturnType<typeof vi.spyOn>, code: string): number {
  return warnSpy.mock.calls.filter(args => args.some(a => String(a).includes(code))).length
}

const rows = [
  { id: 'r1', name: 'Alice' },
  { id: 'r2', name: 'Bob' },
]

describe('uncontrolled columns shadow check', () => {
  it('warns on one-way :columns with column drag enabled', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const columns = ref([
      { prop: 'id', label: 'ID', hidden: false },
      { prop: 'name', label: 'Name', hidden: false },
    ] as AdvColumn[] as any)
    // <zh/> 单向绑定：无 onUpdate:columns 监听 | <en/> One-way binding: no onUpdate:columns listener
    _mount(() => h(AdvTable as any, {
      mode: 'default',
      columns: columns.value,
      data: rows,
      rowConfig: { rowKey: 'id' },
      columnConfig: { columnDraggable: true },
    }))
    await nextTick()
    await nextTick()

    expect(countWarnsWith(warnSpy, 'TABLE_UNCONTROLLED_COLUMNS_SHADOW')).toBeGreaterThanOrEqual(1)
    warnSpy.mockRestore()
  })

  it('stays silent with v-model:columns (update:columns listener)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const columns = ref([
      { prop: 'id', label: 'ID', hidden: false },
      { prop: 'name', label: 'Name', hidden: false },
    ] as AdvColumn[] as any)
    _mount(() => h(AdvTable as any, {
      'mode': 'default',
      'columns': columns.value,
      'data': rows,
      'rowConfig': { rowKey: 'id' },
      'columnConfig': { columnDraggable: true },
      'onUpdate:columns': () => {},
    }))
    await nextTick()
    await nextTick()

    expect(countWarnsWith(warnSpy, 'TABLE_UNCONTROLLED_COLUMNS_SHADOW')).toBe(0)
    warnSpy.mockRestore()
  })

  it('stays silent for read-only one-way columns (no drag/setting)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const columns = ref([
      { prop: 'id', label: 'ID', hidden: false },
      { prop: 'name', label: 'Name', hidden: false },
    ] as AdvColumn[] as any)
    _mount(() => h(AdvTable as any, {
      mode: 'default',
      columns: columns.value,
      data: rows,
      rowConfig: { rowKey: 'id' },
    }))
    await nextTick()
    await nextTick()

    expect(countWarnsWith(warnSpy, 'TABLE_UNCONTROLLED_COLUMNS_SHADOW')).toBe(0)
    warnSpy.mockRestore()
  })
})
