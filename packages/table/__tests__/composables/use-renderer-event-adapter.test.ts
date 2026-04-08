/**
 * @vitest-environment happy-dom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { useHoverLayerProvider, useRendererCellEvents } from '../../src/composables/rendering/use-renderer-event-adapter'

/**
 * <zh/> 渲染器事件适配单测——覆盖键?鼠标转发开关与 hover 层发布? * <en/> Renderer event-adapter tests ?keyboard/mouse forward toggles and hover-layer provide.
 */
const locator = {
  getRowIndex: () => 0,
  getColumnIndex: () => 0,
}

function setupCellEvents(enableMouseEvents = false) {
  const emit = vi.fn()
  const container = document.createElement('div')
  const cell = document.createElement('div')
  container.appendChild(cell)
  document.body.appendChild(container)
  const containerRef = ref<HTMLElement | null>(container)
  let unmounted = false
  const wrapper = mount(defineComponent({
    setup() {
      useRendererCellEvents({
        containerRef,
        columns: computed(() => [{ prop: 'a' }]),
        data: computed(() => [{ a: 1 }]),
        locator,
        emit,
        enableMouseEvents,
      } as any)
      return () => h('div')
    },
  }))
  return {
    emit,
    container,
    cell,
    cleanup: () => {
      wrapper.unmount()
      unmounted = unmounted || true
      container.remove()
    },
  }
}

describe('useRendererCellEvents', () => {
  it('forwards keyboard events without mouse events by default', () => {
    const t = setupCellEvents(false)
    t.cell.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(t.emit).toHaveBeenCalledWith('cellFocused', expect.anything())
    t.emit.mockClear()
    t.cell.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(t.emit).not.toHaveBeenCalledWith('cellClick', expect.anything())
    t.cleanup()
  })

  it('forwards mouse events when enabled', () => {
    const t = setupCellEvents(true)
    t.cell.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    t.cell.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(t.emit).toHaveBeenCalledWith('cellClick', expect.anything())
    t.cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(t.emit).toHaveBeenCalledWith('cellDblclick', expect.anything())
    t.cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    expect(t.emit).toHaveBeenCalledWith('cellContextmenu', expect.anything())
    t.cell.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    expect(t.emit).toHaveBeenCalledWith('cellKeyDown', expect.anything())
    t.cleanup()
  })
})

describe('useHoverLayerProvider', () => {
  it('provides the hover layer api to descendants', async () => {
    const { advTableHoverLayerKey } = await import('../../src/types/injection-keys')
    const { inject } = await import('vue')
    const api = { visible: true }
    let injected: unknown = 'unset'
    const wrapper = mount(defineComponent({
      setup() {
        useHoverLayerProvider({ api: api as any })
        return () => h(defineComponent({
          setup() {
            injected = inject(advTableHoverLayerKey, null)
            return () => h('div')
          },
        }))
      },
    }))
    expect(injected).toBe(api)
    wrapper.unmount()
  })
})
