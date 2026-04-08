import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useVirtualRenderer } from '../../../src/components/table-virtual-renderer/use-virtual-renderer'

/**
 * <zh/> virtual 渲染器单测——无挂载 ElTableV2 时的空 root 降级与容器测量。
 * <en/> Virtual-renderer tests — null-root fallbacks and container measurement without a mounted ElTableV2.
 */
const cols = [{ key: 'a', prop: 'a', label: 'A' }]

function setupRenderer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let api!: ReturnType<typeof useVirtualRenderer>
  const wrapper = mount(defineComponent({
    setup() {
      api = useVirtualRenderer({
        props: {
          columns: cols,
          data: [{ id: '1', a: 'x' }],
          rowKey: (row: any) => String(row.id),
          selectionColumns: [],
          normalColumns: cols,
          selectableData: [],
          checkStatus: { isAllSelected: false, isIndeterminate: false },
        } as any,
        tableV2Ref: ref(null),
        containerRef: ref<HTMLElement | null>(container),
      })
      return () => h('div')
    },
  }), { attachTo: document.body })
  return { api, wrapper, container }
}

describe('useVirtualRenderer without mount', () => {
  it('falls back when the table root is absent', () => {
    const { api, wrapper, container } = setupRenderer()
    expect(api.rendererExpose.getColumnDragContainer()).toBeNull()
    expect(api.rendererExpose.getRowDragContainer()).toBeNull()
    expect(api.rendererExpose.getRenderedColumnKeys()).toEqual([])
    expect(api.currentRowKey.value).toBeNull()
    expect(api.isRowSelectable({ id: '1' }, 0)).toBe(true)
    wrapper.unmount()
    container.remove()
  })

  it('exposes column and width state', () => {
    const { api, wrapper, container } = setupRenderer()
    expect(api.hasHoverOptionColumns.value).toBe(false)
    expect(api.selectionColumnSyncKey.value).toBe('')
    wrapper.unmount()
    container.remove()
  })

  it('measures the main grid when autoSizeColumns is on', async () => {
    const root = document.createElement('div')
    const main = document.createElement('div')
    main.className = 'main'
    root.appendChild(main)
    document.body.appendChild(root)
    vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 300,
      bottom: 100,
      width: 300,
      height: 100,
    } as DOMRect)
    let api!: ReturnType<typeof useVirtualRenderer>
    const wrapper = mount(defineComponent({
      setup() {
        api = useVirtualRenderer({
          props: {
            columns: cols,
            data: [{ id: '1', a: 'x' }],
            rowKey: (row: any) => String(row.id),
            selectionColumns: [],
            normalColumns: cols,
            selectableData: [],
            checkStatus: { isAllSelected: false, isIndeterminate: false },
            autoSizeColumns: true,
            resizable: true,
            dom: {
              getScopeSelector: () => '.main',
              getBodySelector: () => '.body',
              getRowSelector: () => 'tr',
              closestRow: (el: Element) => el.closest('tr'),
              getHeaderSelector: () => '.thead',
              getHeaderCellSelector: () => 'th',
              getHeaderRowSelector: () => 'thead tr',
              getBodyScrollbarSpec: () => ({}),
              createDragLocator: () => ({}),
              createCellLocator: () => ({}),
            },
          } as any,
          tableV2Ref: ref({ $el: root }),
          containerRef: ref<HTMLElement | null>(root),
        })
        return () => h('div')
      },
    }), { attachTo: document.body })
    expect(api.rendererExpose.getColumnDragContainer()).toBeNull()
    await nextTick()
    await nextTick()
    expect(api.columnsTotalWidth.value).toBeGreaterThanOrEqual(0)
    wrapper.unmount()
    root.remove()
    vi.restoreAllMocks()
  })
})
