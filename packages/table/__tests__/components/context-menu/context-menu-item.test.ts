import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ContextMenuItem from '../../../src/components/context-menu/context-menu-item.vue'

/**
 * <zh/> 菜单项单测——点击守卫、悬停子菜单延时、状态类名。
 * <en/> Menu-item tests — click guards, hover submenu delay, state classes.
 */
function setupItem(item: any = { code: 'a', name: 'A' }, extra: Record<string, any> = {}) {
  return mount(ContextMenuItem as any, {
    props: { item, focused: false, expanded: false, ...extra },
  })
}

describe('contextMenuItem', () => {
  it('emits click for enabled items', async () => {
    const wrapper = setupItem()
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
    wrapper.unmount()
  })

  it('blocks clicks when disabled or loading', async () => {
    const d = setupItem({ code: 'a', name: 'A', disabled: true })
    await d.trigger('click')
    expect(d.emitted('click')).toBeUndefined()
    expect(d.classes()).toContain('adv-table-context-menu-item--disabled')
    d.unmount()
    const l = setupItem({ code: 'a', name: 'A', loading: true })
    await l.trigger('click')
    expect(l.emitted('click')).toBeUndefined()
    l.unmount()
  })

  it('applies focused and expanded classes', () => {
    const wrapper = setupItem({ code: 'a', name: 'A' }, { focused: true, expanded: true })
    expect(wrapper.classes()).toContain('adv-table-context-menu-item--focused')
    expect(wrapper.classes()).toContain('adv-table-context-menu-item--expanded')
    wrapper.unmount()
  })

  it('opens submenus after hover delay', async () => {
    const wrapper = setupItem({ code: 'm', name: 'M', children: [{ code: 's', name: 'S' }] })
    await wrapper.trigger('mouseenter')
    expect(wrapper.emitted('mouseenter')).toHaveLength(1)
    await new Promise(r => setTimeout(r, 200))
    expect(wrapper.emitted('submenuOpen')).toHaveLength(1)
    await wrapper.trigger('mouseleave')
    await new Promise(r => setTimeout(r, 250))
    expect(wrapper.emitted('submenuClose')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders check marks and icons', () => {
    const wrapper = setupItem({ code: 'a', name: 'A', checked: true })
    expect(wrapper.find('.adv-table-context-menu-item__check').exists()).toBe(true)
    wrapper.unmount()
  })
})
