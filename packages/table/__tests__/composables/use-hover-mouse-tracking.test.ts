/**
 * @vitest-environment happy-dom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { useHoverMouseTracking } from '../../src/composables/rendering/use-hover-mouse-tracking'

/**
 * <zh/> hover 鼠标追踪单测——覆盖启停、坐标记录与离容回调? * <en/> Hover mouse-tracking tests ?start/stop, coord recording and leave callback.
 */
function setupTracking(shouldTrack = true) {
  const track = ref(shouldTrack)
  const onContainerLeave = vi.fn()
  const container = document.createElement('div')
  document.body.appendChild(container)
  let api!: ReturnType<typeof useHoverMouseTracking>
  const wrapper = mount(defineComponent({
    setup() {
      api = useHoverMouseTracking({
        containerRef: container,
        shouldTrack: computed(() => track.value),
        onContainerLeave,
      })
      return () => h('div')
    },
  }), { attachTo: document.body })
  return { api, wrapper, track, onContainerLeave, container }
}

describe('useHoverMouseTracking', () => {
  it('starts untracked', () => {
    const t = setupTracking(false)
    expect(t.api.lastMouseClientX.value).toBe(-1)
    expect(t.api.lastMouseClientY.value).toBe(-1)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('records viewport coords on window mousemove', () => {
    const t = setupTracking(true)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 80 }))
    expect(t.api.lastMouseClientX.value).toBe(120)
    expect(t.api.lastMouseClientY.value).toBe(80)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('toggles tracking with shouldTrack', async () => {
    const t = setupTracking(false)
    t.track.value = true
    await Promise.resolve()
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 20 }))
    expect(t.api.lastMouseClientX.value).toBe(10)
    t.track.value = false
    await Promise.resolve()
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 99, clientY: 99 }))
    expect(t.api.lastMouseClientX.value).toBe(10)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('no-ops start without a container and stop without start', () => {
    const onContainerLeave = vi.fn()
    let api!: ReturnType<typeof useHoverMouseTracking>
    const wrapper = mount(defineComponent({
      setup() {
        api = useHoverMouseTracking({
          containerRef: undefined,
          shouldTrack: computed(() => false),
          onContainerLeave,
        })
        return () => h('div')
      },
    }))
    expect(api.lastMouseClientX.value).toBe(-1)
    api.startMouseTracking()
    expect(api.lastMouseClientX.value).toBe(-1)
    api.stopMouseTracking()
    expect(onContainerLeave).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('start/stop are idempotent', () => {
    const t = setupTracking(true)
    t.api.startMouseTracking()
    t.api.startMouseTracking()
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 6 }))
    expect(t.api.lastMouseClientX.value).toBe(5)
    t.api.stopMouseTracking()
    t.api.stopMouseTracking()
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 7, clientY: 8 }))
    expect(t.api.lastMouseClientX.value).toBe(5)
    t.wrapper.unmount()
    t.container.remove()
  })
})
