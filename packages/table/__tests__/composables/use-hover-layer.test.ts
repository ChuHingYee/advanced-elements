import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { useHoverLayer } from '../../src/composables/rendering/use-hover-layer'

/**
 * <zh/> hover 层单测——覆盖进入/离开、滚动抑制、消除与同步。
 * <en/> Hover-layer tests — enter/leave, scroll suppression, dismiss and sync.
 */
const rows = [{ id: 1 }, { id: 2 }]

function setupLayer(opts: {
  hasHover?: boolean
  teleport?: boolean
  scrolling?: boolean
  lowPerformance?: boolean
} = {}) {
  const hasHover = ref(opts.hasHover ?? true)
  const scrolling = ref(opts.scrolling ?? false)
  const container = document.createElement('div')
  document.body.appendChild(container)
  let api!: ReturnType<typeof useHoverLayer>
  const wrapper = mount(defineComponent({
    setup() {
      api = useHoverLayer({
        hasHoverOptionColumns: hasHover,
        data: rows,
        rowKey: computed(() => (row: any) => String(row.id)),
        isTeleport: opts.teleport ?? false,
        containerRef: container,
        isScrolling: scrolling,
        lowPerformance: opts.lowPerformance ?? false,
      })
      return () => h('div')
    },
  }), { attachTo: document.body })
  return { api, wrapper, hasHover, scrolling, container }
}

describe('useHoverLayer', () => {
  it('shows the layer on row enter', () => {
    const t = setupLayer()
    t.api.handleHoverRowEnter(rows[0], 0)
    expect(t.api.hoverRowKey.value).toBe('1')
    expect(t.api.hoverRowIndex.value).toBe(0)
    expect(t.api.hoverRowData.value).toBe(rows[0])
    expect(t.api.hoverLayerVisible.value).toBe(true)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('ignores enter without hover columns', () => {
    const t = setupLayer({ hasHover: false })
    t.api.handleHoverRowEnter(rows[0], 0)
    expect(t.api.hoverLayerVisible.value).toBe(false)
    expect(t.api.hoverRowKey.value).toBeNull()
    t.wrapper.unmount()
    t.container.remove()
  })

  it('suppresses enter/leave while scrolling', () => {
    const t = setupLayer({ scrolling: true })
    t.api.handleHoverRowEnter(rows[0], 0)
    expect(t.api.hoverLayerVisible.value).toBe(false)
    t.api.handleHoverRowLeave()
    t.wrapper.unmount()
    t.container.remove()
  })

  it('hides immediately on leave in inline mode', () => {
    const t = setupLayer()
    t.api.handleHoverRowEnter(rows[0], 0)
    expect(t.api.hoverLayerVisible.value).toBe(true)
    t.api.handleHoverRowLeave()
    expect(t.api.hoverLayerVisible.value).toBe(false)
    expect(t.api.hoverRowKey.value).toBeNull()
    t.wrapper.unmount()
    t.container.remove()
  })

  it('delays hide on leave in teleport mode', async () => {
    vi.useFakeTimers()
    try {
      const t = setupLayer({ teleport: true })
      t.api.handleHoverRowEnter(rows[0], 0)
      t.api.handleHoverRowLeave()
      expect(t.api.hoverLayerVisible.value).toBe(true)
      vi.advanceTimersByTime(200)
      expect(t.api.hoverLayerVisible.value).toBe(false)
      t.wrapper.unmount()
      t.container.remove()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('toggles collapse and hides immediately', () => {
    const t = setupLayer()
    t.api.handleHoverRowEnter(rows[0], 0)
    t.api.toggleHoverLayerCollapse(new Event('click'))
    expect(t.api.hoverLayerCollapsed.value).toBe(true)
    t.api.hideHoverLayerImmediately()
    expect(t.api.hoverLayerVisible.value).toBe(false)
    expect(t.api.hoverRowKey.value).toBeNull()
    t.wrapper.unmount()
    t.container.remove()
  })

  it('syncs index from key metadata', () => {
    const t = setupLayer()
    t.api.handleHoverRowEnter(rows[1], -1)
    expect(t.api.hoverRowIndex.value).toBe(1)
    t.api.syncHoverLayerState()
    expect(t.api.hoverRowIndex.value).toBe(1)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('clears hover when columns are removed', () => {
    const t = setupLayer()
    t.api.handleHoverRowEnter(rows[0], 0)
    t.hasHover.value = false
    t.api.syncHoverLayerState()
    expect(t.api.hoverLayerVisible.value).toBe(false)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('suppresses dismissed rows', () => {
    const t = setupLayer()
    t.api.dismissedRowKeys.value = new Set(['1'])
    expect(t.api.isRowDismissed('1')).toBe(true)
    expect(t.api.isRowDismissed('2')).toBe(false)
    t.api.handleHoverRowEnter(rows[0], 0)
    expect(t.api.hoverLayerVisible.value).toBe(false)
    t.api.syncHoverLayerState()
    expect(t.api.hoverLayerVisible.value).toBe(false)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('prunes stale dismissed keys on sync', () => {
    const t = setupLayer()
    t.api.dismissedRowKeys.value = new Set(['gone'])
    t.api.syncHoverLayerState()
    expect(t.api.dismissedRowKeys.value.has('gone')).toBe(false)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('hides stale hover when rediscovering without mouse position', () => {
    const t = setupLayer()
    t.api.handleHoverRowEnter(rows[0], 0)
    expect(t.api.hoverLayerVisible.value).toBe(true)
    t.api.rediscoverHoverAfterScroll()
    expect(t.api.hoverLayerVisible.value).toBe(false)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('resolves index by reference when the key map misses', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    let api!: ReturnType<typeof useHoverLayer>
    const wrapper = mount(defineComponent({
      setup() {
        api = useHoverLayer({
          hasHoverOptionColumns: ref(true),
          rowKeyMeta: { keyToRow: new Map(), keyToIndex: new Map() },
          data: rows,
          rowKey: computed(() => (row: any) => String(row.id)),
          containerRef: container,
        })
        return () => h('div')
      },
    }), { attachTo: document.body })
    api.handleHoverRowEnter(rows[1], -1)
    expect(api.hoverRowIndex.value).toBe(1)
    expect(api.hoverRowData.value).toBe(rows[1])
    wrapper.unmount()
    container.remove()
  })

  it('activates row class on layer enter with a marked row', () => {
    const container = document.createElement('div')
    container.innerHTML = '<table><tr data-adv-table-row-key="1"><td><span data-adv-table-row-key="1">x</span></td></tr></table>'
    document.body.appendChild(container)
    const hasHover = ref(true)
    let api!: ReturnType<typeof useHoverLayer>
    const wrapper = mount(defineComponent({
      setup() {
        api = useHoverLayer({
          hasHoverOptionColumns: hasHover,
          data: rows,
          rowKey: computed(() => (row: any) => String(row.id)),
          isTeleport: true,
          containerRef: container,
          dom: { closestRow: (el: Element) => el.closest('tr') } as any,
        })
        return () => h('div')
      },
    }), { attachTo: document.body })
    api.handleHoverRowEnter(rows[0], 0)
    api.handleHoverLayerEnter()
    expect(container.querySelector('tr')!.classList.contains('adv-table__row--hover-layer-active')).toBe(true)
    api.handleHoverLayerLeave()
    expect(api.hoverLayerVisible.value).toBe(false)
    wrapper.unmount()
    container.remove()
  })

  it('hides on sync when the hovered row leaves the data', () => {
    const dataRef = ref([
      { id: 1 },
      { id: 2 },
    ])
    const container = document.createElement('div')
    document.body.appendChild(container)
    let api!: ReturnType<typeof useHoverLayer>
    const wrapper = mount(defineComponent({
      setup() {
        api = useHoverLayer({
          hasHoverOptionColumns: ref(true),
          data: dataRef,
          rowKey: computed(() => (row: any) => String(row.id)),
          containerRef: container,
        })
        return () => h('div')
      },
    }), { attachTo: document.body })
    api.handleHoverRowEnter(dataRef.value[0], 0)
    expect(api.hoverLayerVisible.value).toBe(true)
    dataRef.value = [{ id: 2 }]
    api.syncHoverLayerState()
    expect(api.hoverLayerVisible.value).toBe(false)
    wrapper.unmount()
    container.remove()
  })

  it('enters the layer without an active row', () => {
    const t = setupLayer()
    t.api.handleHoverLayerEnter()
    expect(t.api.hoverLayerVisible.value).toBe(false)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('rediscovers the row under the cursor after scroll', () => {
    const container = document.createElement('div')
    container.innerHTML = '<table><tr><td><span data-adv-table-row-key="1">x</span></td></tr></table>'
    document.body.appendChild(container)
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
    } as DOMRect)
    let api!: ReturnType<typeof useHoverLayer>
    const wrapper = mount(defineComponent({
      setup() {
        api = useHoverLayer({
          hasHoverOptionColumns: ref(true),
          data: rows,
          rowKey: computed(() => (row: any) => String(row.id)),
          containerRef: container,
        })
        return () => h('div')
      },
    }), { attachTo: document.body })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }))
    // <zh/> happy-dom 无 elementFromPoint：查无元素 → 隐藏路径；不断言具体行，只锁定"不抛错 + 无幽灵 hover"
    // <en/> happy-dom lacks elementFromPoint: lookup misses → hide path; assert no-throw plus no phantom hover
    expect(() => api.rediscoverHoverAfterScroll()).not.toThrow()
    expect(api.hoverRowKey.value).toBeNull()
    expect(api.hoverLayerVisible.value).toBe(false)
    wrapper.unmount()
    container.remove()
    vi.restoreAllMocks()
  })

  it('cancels scroll handling on unmount', () => {
    const cancel = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const wrapper = mount(defineComponent({
      setup() {
        useHoverLayer({
          hasHoverOptionColumns: ref(true),
          data: rows,
          rowKey: computed(() => (row: any) => String(row.id)),
          containerRef: container,
          handleScroll: { cancel },
        })
        return () => h('div')
      },
    }), { attachTo: document.body })
    wrapper.unmount()
    expect(cancel).toHaveBeenCalled()
    container.remove()
  })
})
