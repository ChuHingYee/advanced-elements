import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, provide } from 'vue'
import ColumnFilterPanel from '../../../src/components/filter-panel/column-filter-panel.vue'
import { advTableSharedFilterPopoverKey } from '../../../src/types/config'

/**
 * <zh/> ColumnFilterPanel 小覆盖：最小 props 挂载、点击/键盘触发 toggle、active 状态
 * <en/> ColumnFilterPanel small coverage: minimal-props mount, click/keyboard toggle, active state
 */
describe('column-filter-panel small coverage', () => {
  // <zh/> 用宿主组件 provide 共享弹窗 mock（symbol key 经对象字面量不可靠） | <en/> provide the shared popover mock via a host (symbol keys are unreliable in object literals)
  function mountPanel(props: Record<string, unknown>, popover?: { toggle: (...args: any[]) => void }) {
    const Host = defineComponent({
      setup() {
        if (popover)
          provide(advTableSharedFilterPopoverKey, popover)
        return () => h(ColumnFilterPanel as any, props as any)
      },
    })
    return mount(Host)
  }

  it('calls toggle on click with columnKey, target and filterType', async () => {
    // <zh/> 点击触发 handleClick → sharedPopover.toggle | <en/> click fires handleClick → sharedPopover.toggle
    const toggle = vi.fn()
    const wrapper = mountPanel({ columnKey: 'name', filterType: 'text', active: false }, { toggle })
    const trigger = wrapper.find('.adv-table__filter-trigger')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    expect(toggle).toHaveBeenCalledTimes(1)
    expect(toggle.mock.calls[0][0]).toBe('name')
    expect(toggle.mock.calls[0][1]).toBeInstanceOf(HTMLElement)
    expect(toggle.mock.calls[0][2]).toBe('text')
    // <zh/> 未激活时无高亮类 + aria-label 回退硬编码 | <en/> no highlight class when inactive + hardcoded aria-label fallback
    expect(trigger.classes()).not.toContain('adv-table__filter-trigger--active')
    expect(trigger.attributes('aria-label')).toBe('打开筛选')
    wrapper.unmount()
  })

  it('reflects active state via highlight class and aria-label', async () => {
    // <zh/> active 切换高亮类与 aria-label | <en/> active toggles the highlight class and aria-label
    const toggle = vi.fn()
    const wrapper = mountPanel({ columnKey: 'age', filterType: 'number', active: true }, { toggle })
    const trigger = wrapper.find('.adv-table__filter-trigger')
    expect(trigger.classes()).toContain('adv-table__filter-trigger--active')
    expect(trigger.attributes('aria-label')).toBe('清除筛选')
    wrapper.unmount()
  })

  it('activates on Enter/Space keydown and ignores Escape', async () => {
    // <zh/> handleKeydown：Enter/Space 等价点击，Escape 无操作 | <en/> handleKeydown: Enter/Space equal click, Escape is a no-op
    const toggle = vi.fn()
    const wrapper = mountPanel({ columnKey: 'status', filterType: 'enum', active: false }, { toggle })
    const trigger = wrapper.find('.adv-table__filter-trigger')
    await trigger.trigger('keydown', { key: 'Enter' })
    expect(toggle).toHaveBeenCalledTimes(1)
    await trigger.trigger('keydown', { key: ' ' })
    expect(toggle).toHaveBeenCalledTimes(2)
    await trigger.trigger('keydown', { key: 'Escape' })
    expect(toggle).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('no-ops click and keydown when the shared popover is not provided', async () => {
    // <zh/> 无 provide 时 sharedPopover 为 undefined，点击/按键静默跳过 | <en/> without provide sharedPopover is undefined; click/keys silently skip
    const wrapper = mountPanel({ columnKey: 'name', filterType: 'text', active: false })
    const trigger = wrapper.find('.adv-table__filter-trigger')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    await trigger.trigger('keydown', { key: 'Enter' })
    expect(trigger.attributes('aria-label')).toBe('打开筛选')
    wrapper.unmount()
  })
})
