/**
 * @vitest-environment happy-dom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { useRowDrag } from '../../src/composables/interaction/use-row-drag'

/**
 * <zh/> 行拖拽单测——覆盖初始化/销毁/同步生命周期与开关门控。
 * <en/> Row-drag tests — init/destroy/sync lifecycle and enable gate.
 */
function locatorStub(container: HTMLElement) {
  return {
    getRowContainer: () => container,
    getDragHandleSelector: () => '.drag-handle',
    getDraggableRowSelector: () => 'tr[data-key]',
    getCurrentRowKeys: () => ['1', '2'],
    getScrollContainer: () => null,
    getVisibleRowElements: () => [],
    getAnimation: () => 150,
    getGhostClass: () => undefined,
    getRowHeight: () => 40,
  }
}

function setupDrag(opts: { draggable?: boolean } = {}) {
  const draggable = ref(opts.draggable ?? false)
  const container = document.createElement('div')
  container.innerHTML = '<table><tr data-key="1"><td>a</td></tr></table>'
  document.body.appendChild(container)
  let api!: ReturnType<typeof useRowDrag>
  const wrapper = mount(defineComponent({
    setup() {
      api = useRowDrag({
        tableId: 't-rowdrag',
        rowDraggable: draggable,
        rowDragHandle: '',
        fullData: ref([{ id: 1 }]),
        rowKey: (row: any) => String(row.id),
        onDataReorder: vi.fn(),
        dragLocator: computed(() => locatorStub(container) as any),
        caps: { rowIndexDomain: 'composed' },
      } as any)
      return () => h('div')
    },
  }), { attachTo: document.body })
  return { api, wrapper, draggable, container }
}

describe('useRowDrag', () => {
  it('stays idle when disabled', async () => {
    const t = setupDrag({ draggable: false })
    await Promise.resolve()
    expect(t.api.isRowDragging.value).toBe(false)
    t.api.initRowDrag()
    t.api.syncDrags()
    t.api.destroyRowDrag()
    t.api.destroyRowDrag()
    expect(t.api.isRowDragging.value).toBe(false)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('initializes and tears down when enabled', async () => {
    const t = setupDrag({ draggable: true })
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 10))
    expect(t.api.isRowDragging.value).toBe(false)
    t.api.syncDrags()
    t.api.destroyRowDrag()
    t.wrapper.unmount()
    t.container.remove()
  })

  it('reacts to late enablement', async () => {
    const t = setupDrag({ draggable: false })
    t.draggable.value = true
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 10))
    expect(t.api.isRowDragging.value).toBe(false)
    t.wrapper.unmount()
    t.container.remove()
  })
})
