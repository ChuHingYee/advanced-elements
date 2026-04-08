import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import ColumnFilterPanel from '../../../src/components/filter-panel/column-filter-panel.vue'
import { advTableSharedFilterPopoverKey } from '../../../src/types/config'

/**
 * <zh/> 列筛选面板触发器单测——注意本组件只是表头筛选图标按钮（props 仅 columnKey/filterType/active），
 * <zh/> 完整表单是 ColumnFilterForm（另有专测）。旧版用例误传 modelValue/t/enumOptions（均被忽略），
 * <zh/> 此处只断言触发器真实契约：渲染态、toggle 调用、键盘激活、事件隔离、无 provider 降级。
 * <en/> Trigger-button tests — this component is only the header filter icon (props: columnKey/filterType/active);
 * <en/> the full form is ColumnFilterForm (tested separately). Old cases wrongly passed modelValue/t/enumOptions
 * <en/> (all ignored). Only the trigger's real contract is asserted here.
 */
function setupTrigger(extra: Record<string, any> = {}, popover?: { toggle: ReturnType<typeof vi.fn> }) {
  const toggle = popover?.toggle ?? vi.fn()
  const wrapper = mount(ColumnFilterPanel as any, {
    props: {
      columnKey: 'name',
      filterType: 'text',
      active: false,
      ...extra,
    },
    global: popover
      ? { provide: { [advTableSharedFilterPopoverKey as symbol]: { toggle } } }
      : undefined,
  })
  return { wrapper, toggle }
}

describe('column-filter-panel.vue trigger', () => {
  it('renders the trigger as an accessible button', async () => {
    const { wrapper } = setupTrigger()
    await nextTick()
    const trigger = wrapper.find('.adv-table__filter-trigger')
    expect(trigger.exists()).toBe(true)
    expect(trigger.attributes('role')).toBe('button')
    expect(trigger.attributes('tabindex')).toBe('0')
    wrapper.unmount()
  })

  it('reflects active state in class and aria-label', async () => {
    const { wrapper } = setupTrigger({ active: true })
    await nextTick()
    const trigger = wrapper.find('.adv-table__filter-trigger')
    expect(trigger.classes()).toContain('adv-table__filter-trigger--active')
    expect(trigger.attributes('aria-label')).toContain('清除筛选')
    wrapper.unmount()

    const idle = setupTrigger({ active: false })
    await nextTick()
    expect(idle.wrapper.find('.adv-table__filter-trigger').classes()).not.toContain(
      'adv-table__filter-trigger--active',
    )
    expect(idle.wrapper.find('.adv-table__filter-trigger').attributes('aria-label')).toContain('打开筛选')
    idle.wrapper.unmount()
  })

  it('calls shared popover toggle on click with column context', async () => {
    const toggle = vi.fn()
    const { wrapper } = setupTrigger({}, { toggle })
    await nextTick()
    await wrapper.find('.adv-table__filter-trigger').trigger('click')
    // <zh/> 点击必须带列上下文调用 toggle，否则弹窗不知道为哪列开
    // <en/> Click must call toggle with the column context, otherwise the popover opens for no column
    expect(toggle).toHaveBeenCalledTimes(1)
    const [key, target, type] = toggle.mock.calls[0]
    expect(key).toBe('name')
    expect(target).toBeInstanceOf(HTMLElement)
    expect(type).toBe('text')
    wrapper.unmount()
  })

  it('stops click propagation to header', async () => {
    const onParent = vi.fn()
    const toggle = vi.fn()
    const wrapper = mount(defineComponent({
      setup() {
        return () => h('div', { onClick: onParent }, [
          h(ColumnFilterPanel as any, {
            columnKey: 'name',
            filterType: 'text',
            active: false,
          }),
        ])
      },
    }), {
      global: { provide: { [advTableSharedFilterPopoverKey as symbol]: { toggle } } },
    })
    await nextTick()
    await wrapper.find('.adv-table__filter-trigger').trigger('click')
    expect(toggle).toHaveBeenCalledTimes(1)
    expect(onParent).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('activates on Enter and Space keys', async () => {
    const toggle = vi.fn()
    const { wrapper } = setupTrigger({}, { toggle })
    await nextTick()
    const trigger = wrapper.find('.adv-table__filter-trigger')
    await trigger.trigger('keydown', { key: 'Enter' })
    await trigger.trigger('keydown', { key: ' ' })
    expect(toggle).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('ignores unrelated keys', async () => {
    const toggle = vi.fn()
    const { wrapper } = setupTrigger({}, { toggle })
    await nextTick()
    const trigger = wrapper.find('.adv-table__filter-trigger')
    await trigger.trigger('keydown', { key: 'a' })
    await trigger.trigger('keydown', { key: 'Escape' })
    expect(toggle).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('degrades silently without a provided popover', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // <zh/> 独立挂载无 provider：dev 告警但点击不抛错（生产兜底）
      // <en/> Standalone mount without provider: dev warns but clicks never throw (production fallback)
      const { wrapper } = setupTrigger()
      await nextTick()
      await expect(
        wrapper.find('.adv-table__filter-trigger').trigger('click'),
      ).resolves.toBeUndefined()
      wrapper.unmount()
    }
    finally {
      warn.mockRestore()
    }
  })
})
