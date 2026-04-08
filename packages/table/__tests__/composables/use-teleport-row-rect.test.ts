import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useTeleportRowRect } from '../../src/composables/rendering/use-teleport-row-rect'

/**
 * <zh/> teleport 行矩形单测——覆盖显示门控、矩形更新、滚动抑制与强制隐藏。
 * <en/> Teleport row-rect tests — show gate, rect update, scroll settle and force hide.
 */
const rect = { top: 10, height: 20, containerRight: 200, containerLeft: 0 }

function setupRect(opts: {
  teleport?: boolean
  hasHover?: boolean
  visible?: boolean
  key?: string | null
  locate?: () => any
} = {}) {
  const hoverOptionTeleport = ref<boolean | undefined>(opts.teleport ?? true)
  const hasHoverOptionColumns = ref(opts.hasHover ?? true)
  const hoverRowKey = ref<string | null>(opts.key === undefined ? '1' : opts.key)
  const hoverLayerVisible = ref(opts.visible ?? true)
  const isScrolling = ref(false)
  const locateHoveredRow = vi.fn(opts.locate ?? (() => rect))
  const handleScroll = vi.fn()
  const onRowNotFound = vi.fn()
  let api!: ReturnType<typeof useTeleportRowRect>
  const wrapper = mount(defineComponent({
    setup() {
      api = useTeleportRowRect({
        hoverOptionTeleport,
        hasHoverOptionColumns,
        hoverRowKey,
        hoverLayerVisible,
        locateHoveredRow: locateHoveredRow as any,
        handleScroll: handleScroll as any,
        isScrolling,
        onRowNotFound,
      })
      return () => h('div')
    },
  }))
  return {
    api,
    wrapper,
    hoverOptionTeleport,
    hasHoverOptionColumns,
    hoverRowKey,
    hoverLayerVisible,
    isScrolling,
    locateHoveredRow,
    handleScroll,
    onRowNotFound,
  }
}

describe('useTeleportRowRect', () => {
  it('updates the rect when all gates pass', async () => {
    const t = setupRect()
    t.hoverRowKey.value = '2'
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 0))
    expect(t.locateHoveredRow).toHaveBeenCalled()
    expect(t.api.teleportRowRect.value).toEqual(rect)
    t.wrapper.unmount()
  })

  it('stays empty when teleport is off', async () => {
    const t = setupRect({ teleport: false })
    await Promise.resolve()
    expect(t.api.teleportRowRect.value).toBeUndefined()
    t.wrapper.unmount()
  })

  it('clears and notifies when the row is gone', async () => {
    const t = setupRect({ locate: () => undefined })
    t.hoverRowKey.value = '2'
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 0))
    expect(t.onRowNotFound).toHaveBeenCalled()
    expect(t.api.teleportRowRect.value).toBeUndefined()
    t.wrapper.unmount()
  })

  it('marks scrolling on scroll and settles after delay', () => {
    vi.useFakeTimers()
    try {
      const t = setupRect()
      t.api.wrappedHandleScroll({ scrollLeft: 0 })
      expect(t.isScrolling.value).toBe(true)
      vi.advanceTimersByTime(1000)
      expect(t.isScrolling.value).toBe(false)
      t.wrapper.unmount()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('force hide clears the rect', async () => {
    const t = setupRect()
    t.hoverRowKey.value = '2'
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 0))
    expect(t.api.teleportRowRect.value).toEqual(rect)
    t.api.handleForceHide()
    expect(t.api.teleportRowRect.value).toBeUndefined()
    t.wrapper.unmount()
  })

  it('repositions on window resize', async () => {
    // <zh/> 全新挂载直测 resize：同步 rAF mock 下首次调度后 rafId 残留，后续调度会被跳过，故不用复用已更新过的实例
    // <en/> Fresh mount for resize: under the sync-rAF mock the first schedule leaves a stale rafId that skips later schedules
    const container = document.createElement('div')
    document.body.appendChild(container)
    const t = setupRect()
    t.locateHoveredRow.mockClear()
    window.dispatchEvent(new Event('resize'))
    await new Promise(r => setTimeout(r, 120))
    expect(t.locateHoveredRow).toHaveBeenCalled()
    expect(t.api.showTeleportHover.value).toBe(true)
    t.wrapper.unmount()
    container.remove()
  })

  it('repositions on ancestor scroll and settles', () => {
    const css = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transform: 'none',
      filter: 'none',
      contain: '',
    } as any)
    vi.useFakeTimers()
    try {
      const ancestor = document.createElement('div')
      const container = document.createElement('div')
      ancestor.appendChild(container)
      document.body.appendChild(ancestor)
      const isScrolling = ref(false)
      const locate = vi.fn(() => rect)
      let api!: ReturnType<typeof useTeleportRowRect>
      const wrapper = mount(defineComponent({
        setup() {
          api = useTeleportRowRect({
            hoverOptionTeleport: ref(true),
            hasHoverOptionColumns: ref(true),
            hoverRowKey: ref('1'),
            hoverLayerVisible: ref(true),
            locateHoveredRow: locate as any,
            handleScroll: vi.fn() as any,
            containerEl: ref(container),
            getRootEl: () => null,
            isScrolling,
          })
          return () => h('div')
        },
      }))
      expect(api.ancestorHasTransform.value).toBe(false)
      expect(api.showTeleportHover.value).toBe(true)
      ancestor.dispatchEvent(new Event('scroll'))
      expect(isScrolling.value).toBe(true)
      vi.advanceTimersByTime(1000)
      expect(isScrolling.value).toBe(false)
      wrapper.unmount()
      ancestor.remove()
    }
    finally {
      vi.useRealTimers()
      css.mockRestore()
    }
  })
})
