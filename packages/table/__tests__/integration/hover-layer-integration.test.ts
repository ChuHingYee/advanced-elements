import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
/**
 * Integration test for use-hover-layer with mounted DOM elements.
 * Tests teleport mode, mouse interaction, and onMounted lifecycle.
 * Runs in real browser (playwright) via the `browser` vitest project.
 */
import { defineComponent, h, nextTick, ref } from 'vue'
import { useHoverLayer } from '../../src/composables/rendering/use-hover-layer'

describe('useHoverLayer (browser integration)', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  function mountHoverLayer(opts: {
    hasHoverOptionColumns?: boolean
    isTeleport?: boolean
    keepAlive?: boolean
    withContainerRef?: boolean
  } = {}) {
    const hasHoverOptionColumns = ref(opts.hasHoverOptionColumns ?? true)
    const isTeleport = ref(opts.isTeleport ?? false)
    const keepAlive = ref(opts.keepAlive ?? true)
    const data = ref([{ id: 1, name: 'test' }])
    const rowKey = ref((row: any) => String(row.id))
    const containerRef = opts.withContainerRef ? ref(null) : undefined

    const Comp = defineComponent({
      setup() {
        const result = useHoverLayer({
          hasHoverOptionColumns,
          data,
          rowKey,
          isTeleport,
          keepAlive,
          containerRef,
        })
        return { ...result, data, rowKey, containerRef }
      },
      render() {
        return h('div', { class: 'hover-container', ref: 'containerRef' }, [
          h('div', { class: 'hover-row', onMouseenter: () => this.handleHoverRowEnter(this.data[0], 0), onMouseleave: () => this.handleHoverRowLeave() }, 'Row 1'),
          h('div', { class: 'hover-layer-wrapper' }, [
            this.hoverLayerVisible ? h('div', { class: 'hover-layer' }, 'Hover Layer') : null,
          ]),
        ])
      },
    })

    wrapper = mount(Comp, {
      attachTo: document.body,
    })
    return wrapper.vm as any
  }

  it('shows hover layer on mouse enter and hides on leave (non-teleport)', async () => {
    const vm = mountHoverLayer()

    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 0)
    await nextTick()
    expect(vm.hoverLayerVisible).toBe(true)
    expect(vm.hoverRowKey).toBe('1')
    expect(vm.hoverRowIndex).toBe(0)

    vm.handleHoverRowLeave()
    await nextTick()
    expect(vm.hoverLayerVisible).toBe(false)
  })

  it('delays hide in teleport mode', async () => {
    vi.useFakeTimers()
    const vm = mountHoverLayer({ isTeleport: true })

    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 0)
    await nextTick()
    expect(vm.hoverLayerVisible).toBe(true)

    vm.handleHoverRowLeave()
    // In teleport mode, hide is delayed by TELEPORT_HIDE_DELAY (100ms)
    expect(vm.hoverLayerVisible).toBe(true)

    vi.advanceTimersByTime(50)
    expect(vm.hoverLayerVisible).toBe(true)

    vi.advanceTimersByTime(60)
    expect(vm.hoverLayerVisible).toBe(false)

    vi.useRealTimers()
  })

  it('handleHoverLayerEnter clears the hide timer in teleport mode', async () => {
    vi.useFakeTimers()
    const vm = mountHoverLayer({ isTeleport: true })

    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 0)
    await nextTick()
    expect(vm.hoverLayerVisible).toBe(true)

    vm.handleHoverRowLeave()
    expect(vm.hoverLayerVisible).toBe(true)

    // Mouse re-enters the hover layer before delay expires
    vm.handleHoverLayerEnter()
    vi.advanceTimersByTime(200) // well past the delay
    expect(vm.hoverLayerVisible).toBe(true) // still visible because clearHideTimer + enter flag

    vi.useRealTimers()
  })

  it('handleHoverLayerLeave hides immediately', async () => {
    const vm = mountHoverLayer({ isTeleport: true })

    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 0)
    await nextTick()
    expect(vm.hoverLayerVisible).toBe(true)

    vm.handleHoverLayerLeave()
    expect(vm.hoverLayerVisible).toBe(false)
  })

  it('syncHoverLayerState hides for dismissed rows', async () => {
    const vm = mountHoverLayer({ isTeleport: true })

    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 0)
    await nextTick()
    expect(vm.hoverLayerVisible).toBe(true)

    vm.dismissedRowKeys = new Set(['1'])
    vm.syncHoverLayerState()
    expect(vm.hoverLayerVisible).toBe(false)
  })

  it('does not show hover layer when hasHoverOptionColumns is false', async () => {
    const vm = mountHoverLayer({ hasHoverOptionColumns: false })

    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 0)
    await nextTick()
    expect(vm.hoverLayerVisible).toBe(false)
  })

  it('handleHoverRowEnter with dismissed row hides immediately', () => {
    const vm = mountHoverLayer()
    vm.dismissedRowKeys = new Set(['1'])
    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 0)
    expect(vm.hoverLayerVisible).toBe(false)
  })

  it('resolveRowIndex uses fallbackIndex when >= 0', () => {
    const vm = mountHoverLayer()
    // Internal function: we can only test through handleHoverRowEnter
    // Pass fallbackIndex=5 to exercise the fallbackIndex >= 0 branch
    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 5)
    expect(vm.hoverRowIndex).toBe(5)
  })

  it('toggleHoverLayerCollapse toggles collapse state', () => {
    const vm = mountHoverLayer()
    expect(vm.hoverLayerCollapsed).toBe(false)

    const mockEvent = { stopPropagation: vi.fn() }
    vm.toggleHoverLayerCollapse(mockEvent)
    expect(vm.hoverLayerCollapsed).toBe(true)
    expect(mockEvent.stopPropagation).toHaveBeenCalled()

    vm.toggleHoverLayerCollapse(mockEvent)
    expect(vm.hoverLayerCollapsed).toBe(false)
  })

  it('syncHoverLayerState does nothing when hasHoverOptionColumns is true but no hovered row', () => {
    const vm = mountHoverLayer()
    vm.syncHoverLayerState()
    // Should not throw, hover stays hidden
    expect(vm.hoverLayerVisible).toBe(false)
  })

  it('syncHoverLayerState hides when hoverRowKey is dismissed after enter', () => {
    const vm = mountHoverLayer()
    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 0)
    expect(vm.hoverLayerVisible).toBe(true)

    vm.dismissedRowKeys = new Set(['1'])
    vm.syncHoverLayerState()
    expect(vm.hoverLayerVisible).toBe(false)
  })

  it('syncHoverLayerState hides when mapped row key is null (data changed)', async () => {
    const data = ref([{ id: 1, name: 'test' }])
    const rowKey = ref((row: any) => String(row.id))
    const hasHoverOptionColumns = ref(true)
    const isTeleport = ref(false)
    const keepAlive = ref(true)

    const Comp = defineComponent({
      setup() {
        const result = useHoverLayer({
          hasHoverOptionColumns,
          data,
          rowKey,
          isTeleport,
          keepAlive,
        })
        return { ...result, data, rowKey }
      },
      render() {
        return h('div', [
          h('div', { class: 'hover-row' }, 'Row'),
        ])
      },
    })

    wrapper = mount(Comp, { attachTo: document.body })
    const vm = wrapper.vm as any

    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 0)
    expect(vm.hoverLayerVisible).toBe(true)

    // Change data so that the key no longer maps
    data.value = [{ id: 2, name: 'other' }]
    await nextTick()

    vm.syncHoverLayerState()
    expect(vm.hoverLayerVisible).toBe(false)
  })

  it('hoverLayerKeepAlive defaults to true when keepAlive is undefined', () => {
    const hasHoverOptionColumns = ref(true)
    const isTeleport = ref(false)
    const data = ref([{ id: 1, name: 'test' }])
    const rowKey = ref((row: any) => String(row.id))

    const Comp = defineComponent({
      setup() {
        const result = useHoverLayer({
          hasHoverOptionColumns,
          data,
          rowKey,
          isTeleport,
        })
        return { ...result }
      },
      render() {
        return h('div')
      },
    })

    wrapper = mount(Comp, { attachTo: document.body })
    const vm = wrapper.vm as any
    expect(vm.hoverLayerKeepAlive).toBe(true)
  })

  it('hoverLayerKeepAlive reflects keepAlive=false', () => {
    const vm = mountHoverLayer({ keepAlive: false })
    expect(vm.hoverLayerKeepAlive).toBe(false)
  })

  it('pruneDismissedRowKeys does nothing when set is empty', () => {
    const vm = mountHoverLayer()
    // Call internal prune - it should be a no-op
    expect(vm.dismissedRowKeys.size).toBe(0)
    // Access via syncHoverLayerState which calls pruneDismissedRowKeys
    vm.syncHoverLayerState()
    expect(vm.dismissedRowKeys.size).toBe(0)
  })

  it('pruneDismissedRowKeys removes stale keys', () => {
    const vm = mountHoverLayer()
    vm.dismissedRowKeys = new Set(['999'])
    // syncHoverLayerState calls pruneDismissedRowKeys first
    vm.syncHoverLayerState()
    // Key '999' doesn't exist in data, should be pruned
    expect(vm.dismissedRowKeys.size).toBe(0)
  })

  it('handles scroll cancel on beforeUnmount when handleScroll is provided', async () => {
    // We can only trigger onBeforeUnmount by unmounting
    const handleScroll = {
      cancel: vi.fn(),
    } as any
    const hasHoverOptionColumns = ref(true)
    const isTeleport = ref(false)
    const data = ref([{ id: 1, name: 'test' }])
    const rowKey = ref((row: any) => String(row.id))

    const Comp = defineComponent({
      setup() {
        const result = useHoverLayer({
          hasHoverOptionColumns,
          data,
          rowKey,
          isTeleport,
          handleScroll,
        })
        return { ...result }
      },
      render() {
        return h('div')
      },
    })

    wrapper = mount(Comp, { attachTo: document.body })

    // onBeforeUnmount should call handleScroll.cancel()
    wrapper.unmount()
    wrapper = null

    expect(handleScroll.cancel).toHaveBeenCalled()
  })

  it('handleHoverLayerLeave with isTeleport=true and hoverLayerHovered=true keeps layer visible', async () => {
    vi.useFakeTimers()
    const vm = mountHoverLayer({ isTeleport: true })

    vm.handleHoverRowEnter({ id: 1, name: 'test' }, 0)
    await nextTick()
    expect(vm.hoverLayerVisible).toBe(true)

    vm.handleHoverLayerEnter()
    vm.handleHoverRowLeave()

    vi.advanceTimersByTime(200)
    // Still visible because hoverLayerHovered is true
    expect(vm.hoverLayerVisible).toBe(true)

    vi.useRealTimers()
  })
})
