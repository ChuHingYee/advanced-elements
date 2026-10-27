import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, provide, ref } from 'vue'
import HoverTeleportOverlay from '../../../src/components/cell-renderers/hover-teleport-overlay.vue'
import RowActionBar from '../../../src/components/cell-renderers/row-action-bar.vue'
import { advTableHoverLayerKey } from '../../../src/types/injection-keys'

/**
 * <zh/> HoverTeleportOverlay 行为回归——teleport 操作条的渲染必须与渲染器解耦：
 * <zh/> hover 状态变化只重渲染本组件，父级 render 次数保持不变（性能契约的核心）。
 * <en/> HoverTeleportOverlay behavior regression — the teleported bar must stay decoupled from
 * <en/> the renderer: hover state changes re-render only this component, leaving the parent's
 * <en/> render count unchanged (the core of the performance contract).
 */

const ACTIONS = [{ label: 'Edit', code: 'edit' }] as any[]

function mountOverlay(options: { shouldUseTeleport?: boolean } = {}) {
  const { shouldUseTeleport: enabled = true } = options
  const hoverRowData = ref<Record<string, unknown> | null>(null)
  const hoverRowIndex = ref(-1)
  const rowRect = ref<{ top: number, height: number, containerRight: number, containerLeft: number } | undefined>()
  const isScrolling = ref(false)
  const hoverLayerVisible = ref(false)
  const hoverLayerCollapsed = ref(false)
  const onEnter = vi.fn()
  const onLeave = vi.fn()
  const onForceHide = vi.fn()

  const api = {
    hoverRowKey: ref<string | null>(null),
    hoverLayerVisible,
    hoverLayerCollapsed,
    hoverLayerStyle: computed(() => ({})),
    hoverOptionColumns: computed(() => [{ actions: ACTIONS }] as any[]),
    hoverOptionTeleport: computed(() => true),
    shouldUseTeleport: computed(() => enabled),
    onToggleCollapse: vi.fn(),
    teleportOverlay: {
      hoverRowData,
      hoverRowIndex,
      rowRect,
      isScrolling,
      zIndex: computed(() => 4321),
      onEnter,
      onLeave,
      onForceHide,
    },
  }

  let parentRenders = 0
  const Shell = defineComponent({
    setup() {
      provide(advTableHoverLayerKey as any, api)
      return () => {
        parentRenders++
        return h(HoverTeleportOverlay)
      }
    },
  })
  const wrapper = mount(Shell)

  return {
    wrapper,
    parentRenders: () => parentRenders,
    refs: { hoverRowData, hoverRowIndex, rowRect, isScrolling, hoverLayerVisible, hoverLayerCollapsed },
    handlers: { onEnter, onLeave, onForceHide },
  }
}

function barEl(): HTMLElement | null {
  return document.body.querySelector('.adv-table-row-action-bar')
}

describe('hover-teleport-overlay', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('does not render the bar when teleport is unusable', () => {
    const ctx = mountOverlay({ shouldUseTeleport: false })
    wrapper = ctx.wrapper

    expect(wrapper.findComponent(RowActionBar).exists()).toBe(false)
    expect(barEl()).toBeNull()
  })

  it('keeps the parent render count unchanged while hover state changes', async () => {
    const ctx = mountOverlay()
    wrapper = ctx.wrapper
    const baseline = ctx.parentRenders()

    ctx.refs.hoverLayerVisible.value = true
    ctx.refs.hoverRowData.value = { id: '1', name: 'Alice' }
    ctx.refs.hoverRowIndex.value = 3
    ctx.refs.rowRect.value = { top: 40, height: 36, containerRight: 1200, containerLeft: 0 }
    await nextTick()

    expect(barEl()?.classList.contains('adv-table-row-action-bar--visible')).toBe(true)
    expect(ctx.parentRenders()).toBe(baseline)
  })

  it('shows the bar only when it is visible and a row is hovered', async () => {
    const ctx = mountOverlay()
    wrapper = ctx.wrapper

    ctx.refs.hoverRowData.value = { id: '1' }
    await nextTick()
    expect(barEl()?.classList.contains('adv-table-row-action-bar--visible')).toBe(false)

    ctx.refs.hoverLayerVisible.value = true
    await nextTick()
    expect(barEl()?.classList.contains('adv-table-row-action-bar--visible')).toBe(true)

    ctx.refs.hoverRowData.value = null
    await nextTick()
    expect(barEl()?.classList.contains('adv-table-row-action-bar--visible')).toBe(false)
  })

  it('forwards row, clamped row index, z-index and scroll state', async () => {
    const ctx = mountOverlay()
    wrapper = ctx.wrapper

    expect(wrapper.findComponent(RowActionBar).props('rowIndex')).toBe(0)

    ctx.refs.hoverRowIndex.value = 5
    ctx.refs.rowRect.value = { top: 40, height: 36, containerRight: 1200, containerLeft: 0 }
    ctx.refs.isScrolling.value = true
    await nextTick()

    const bar = wrapper.findComponent(RowActionBar)
    expect(bar.props('rowIndex')).toBe(5)
    expect(bar.props('zIndex')).toBe(4321)
    expect(bar.props('isScrolling')).toBe(true)
    expect(barEl()?.style.visibility).toBe('hidden')
  })

  it('reflects the collapse state', async () => {
    const ctx = mountOverlay()
    wrapper = ctx.wrapper

    ctx.refs.hoverLayerCollapsed.value = true
    await nextTick()
    expect(barEl()?.classList.contains('adv-table-row-action-bar--collapsed')).toBe(true)
  })

  it('bubbles bar events back to the overlay domain', async () => {
    const ctx = mountOverlay()
    wrapper = ctx.wrapper
    const bar = wrapper.findComponent(RowActionBar)

    bar.vm.$emit('mouseenter')
    bar.vm.$emit('mouseleave')
    bar.vm.$emit('forceHide')

    expect(ctx.handlers.onEnter).toHaveBeenCalledTimes(1)
    expect(ctx.handlers.onLeave).toHaveBeenCalledTimes(1)
    expect(ctx.handlers.onForceHide).toHaveBeenCalledTimes(1)
  })
})
