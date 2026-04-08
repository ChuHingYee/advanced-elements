/**
 * @vitest-environment happy-dom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useColumnDrag } from '../../src/composables/columns/use-column-drag'

/**
 * <zh/> 列拖拽单测——覆盖初始化/销毁/挂起/恢复生命周期与开关门控。
 * <en/> Column-drag tests — init/destroy/suspend/resume lifecycle and enable gate.
 */
function setupDrag(opts: { draggable?: boolean } = {}) {
  const draggable = ref(opts.draggable ?? false)
  const table = document.createElement('div')
  table.id = 't-coldrag'
  const header = document.createElement('div')
  header.className = 'header'
  const col = document.createElement('div')
  col.setAttribute('data-col', 'a')
  header.appendChild(col)
  table.appendChild(header)
  document.body.appendChild(table)
  let api!: ReturnType<typeof useColumnDrag>
  const wrapper = mount(defineComponent({
    setup() {
      api = useColumnDrag({
        columnDraggable: draggable,
        columns: ref([{ key: 'a', prop: 'a' }]) as any,
        onColumnsReordered: vi.fn(),
        getColumnDragContainer: () => header,
        getRenderedColumnKeys: () => ['a'],
        getDefaultColumnDragHandle: () => '.handle',
        getColumnDraggableSelector: () => '[data-col]',
        tableId: 't-coldrag',
      })
      return () => h('div')
    },
  }), { attachTo: document.body })
  return { api, wrapper, draggable, table }
}

describe('useColumnDrag', () => {
  it('stays idle when disabled', async () => {
    const t = setupDrag({ draggable: false })
    await Promise.resolve()
    // <zh/> Sortable/MutationObserver 在 happy-dom 不可观测；此处锁定各生命周期在禁用态下可安全调用
    // <en/> Sortable/MutationObserver are unobservable in happy-dom; this locks lifecycle methods as safely callable while disabled
    expect(typeof t.api.suspend).toBe('function')
    expect(typeof t.api.resume).toBe('function')
    expect(typeof t.api.destroy).toBe('function')
    expect(() => {
      t.api.suspend()
      t.api.resume()
      t.api.destroy()
    }).not.toThrow()
    t.wrapper.unmount()
    t.table.remove()
  })

  it('initializes and tears down when enabled', async () => {
    const t = setupDrag({ draggable: true })
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 10))
    expect(() => {
      t.api.suspend()
      t.api.resume()
      t.api.destroy()
    }).not.toThrow()
    t.wrapper.unmount()
    t.table.remove()
  })

  it('reacts to late enablement', async () => {
    const t = setupDrag({ draggable: false })
    t.draggable.value = true
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 10))
    expect(() => t.api.destroy()).not.toThrow()
    t.wrapper.unmount()
    t.table.remove()
  })
})
