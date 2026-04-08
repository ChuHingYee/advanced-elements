/**
 * useSharedHeaderTooltip 测试
 *
 * 共享表头提示组合式函数——管理 1 个 ElTooltip 的可见性、内容和触发元素，
 * 处理 show-after / hide 延迟、容器隐藏、KeepAlive deactivated 等生命周期。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useSharedHeaderTooltip } from '../../src/composables/shared/use-shared-header-tooltip'

describe('useSharedHeaderTooltip', () => {
  const containerVisible = ref(true)

  beforeEach(() => {
    containerVisible.value = true
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createTooltip() {
    return useSharedHeaderTooltip({
      containerVisible: () => containerVisible.value,
    })
  }

  describe('初始状态', () => {
    it('初始时 tooltipProps.visible 为 false', () => {
      const tooltip = createTooltip()
      expect(tooltip.tooltipProps.value.visible).toBe(false)
    })

    it('初始时 tooltipProps.content 为空字符串', () => {
      const tooltip = createTooltip()
      expect(tooltip.tooltipProps.value.content).toBe('')
    })
  })

  describe('onHeaderEnter / onHeaderLeave', () => {
    it('在延迟后显示 tooltip', () => {
      const tooltip = createTooltip()
      const el = document.createElement('span')

      tooltip.onHeaderEnter(el, '这是一个提示')
      expect(tooltip.tooltipProps.value.visible).toBe(false)

      vi.advanceTimersByTime(300)
      expect(tooltip.tooltipProps.value.visible).toBe(true)
      expect(tooltip.tooltipProps.value.content).toBe('这是一个提示')
    })

    it('在 mouseleave 后隐藏 tooltip (有 HIDE_DELAY)', () => {
      const tooltip = createTooltip()
      const el = document.createElement('span')

      tooltip.onHeaderEnter(el, '提示内容')
      vi.advanceTimersByTime(300)
      expect(tooltip.tooltipProps.value.visible).toBe(true)

      tooltip.onHeaderLeave()
      // 立即检查：还可见（有 HIDE_DELAY=150）
      expect(tooltip.tooltipProps.value.visible).toBe(true)

      vi.advanceTimersByTime(150)
      expect(tooltip.tooltipProps.value.visible).toBe(false)
    })

    it('鼠标快速划过时不触发 tooltip', () => {
      const tooltip = createTooltip()
      const el = document.createElement('span')

      tooltip.onHeaderEnter(el, '提示')
      vi.advanceTimersByTime(100)
      tooltip.onHeaderLeave()
      vi.advanceTimersByTime(300)
      expect(tooltip.tooltipProps.value.visible).toBe(false)
    })

    it('重新进入时清除之前的延迟定时器', () => {
      const tooltip = createTooltip()
      const el1 = document.createElement('span')
      const el2 = document.createElement('span')

      tooltip.onHeaderEnter(el1, '第一个提示')
      vi.advanceTimersByTime(100)
      tooltip.onHeaderEnter(el2, '第二个提示')
      vi.advanceTimersByTime(300)
      expect(tooltip.tooltipProps.value.content).toBe('第二个提示')
    })

    it('容器不可见时 onHeaderEnter 直接隐藏', () => {
      containerVisible.value = false
      const tooltip = createTooltip()
      const el = document.createElement('span')

      tooltip.onHeaderEnter(el, '提示')
      vi.advanceTimersByTime(300)
      expect(tooltip.tooltipProps.value.visible).toBe(false)
    })
  })

  describe('tooltipProps', () => {
    it('包含正确的默认属性', () => {
      const tooltip = createTooltip()
      const props = tooltip.tooltipProps.value

      expect(props.placement).toBe('top')
      expect(props.effect).toBe('light')
      expect(props.virtualTriggering).toBe(true)
    })

    it('hidden 时 disabled=true', () => {
      const tooltip = createTooltip()
      expect(tooltip.tooltipProps.value.disabled).toBe(true)
    })

    it('visible 时 disabled=false', () => {
      const tooltip = createTooltip()
      const el = document.createElement('span')

      tooltip.onHeaderEnter(el, '内容')
      vi.advanceTimersByTime(300)
      expect(tooltip.tooltipProps.value.disabled).toBe(false)
    })
  })

  describe('forceHide', () => {
    it('强制隐藏 tooltip', () => {
      const tooltip = createTooltip()
      const el = document.createElement('span')

      tooltip.onHeaderEnter(el, '内容')
      vi.advanceTimersByTime(300)
      expect(tooltip.tooltipProps.value.visible).toBe(true)

      tooltip.forceHide()
      expect(tooltip.tooltipProps.value.visible).toBe(false)
    })
  })

  describe('容器不可见', () => {
    it('容器隐藏时自动隐藏 tooltip', async () => {
      const tooltip = createTooltip()
      const el = document.createElement('span')

      tooltip.onHeaderEnter(el, '内容')
      vi.advanceTimersByTime(300)
      expect(tooltip.tooltipProps.value.visible).toBe(true)

      containerVisible.value = false
      await nextTick()
      expect(tooltip.tooltipProps.value.visible).toBe(false)
    })
  })
})
