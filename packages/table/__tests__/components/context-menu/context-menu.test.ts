import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ContextMenu from '../../../src/components/context-menu/context-menu.vue'

/**
 * <zh/> 右键菜单单测——渲染、点击派发、键盘导航与子菜单（Teleport 到 body 查 DOM）。
 * <en/> Context-menu tests — render, click dispatch, keyboard nav and submenus (teleported, query document).
 */
const items = [
  [{ code: 'copy', name: 'Copy' }, { code: 'cut', name: 'Cut', disabled: true }],
  [{ code: 'more', name: 'More', children: [{ code: 'sub1', name: 'Sub1' }] }],
]

function setupMenu(itemsProp: any = items) {
  const wrapper = mount(ContextMenu as any, {
    props: {
      visible: true,
      style: { left: '10px', top: '20px' },
      items: itemsProp,
      params: null,
    },
    attachTo: document.body,
  })
  return wrapper
}

function menuEl() {
  return document.body.querySelector('.adv-table-context-menu') as HTMLElement | null
}

function menuItems() {
  return [...document.body.querySelectorAll('.adv-table-context-menu .adv-table-context-menu-item')] as HTMLElement[]
}

describe('contextMenu', () => {
  it('renders groups and items', async () => {
    const wrapper = setupMenu()
    await nextTick()
    expect(menuEl()).not.toBeNull()
    expect(menuItems().length).toBeGreaterThanOrEqual(3)
    wrapper.unmount()
  })

  it('emits itemClick on item click', async () => {
    const wrapper = setupMenu()
    await nextTick()
    menuItems()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    const clicks = (wrapper.emitted('itemClick') ?? []) as any[]
    expect(clicks.length).toBe(1)
    expect(clicks[0][0].code).toBe('copy')
    wrapper.unmount()
  })

  it('ignores clicks on disabled items', async () => {
    const wrapper = setupMenu()
    await nextTick()
    const cut = menuItems().find(el => el.textContent?.includes('Cut'))!
    cut.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    const clicks = (wrapper.emitted('itemClick') ?? []) as any[]
    expect(clicks.every(c => c[0].code !== 'cut')).toBe(true)
    wrapper.unmount()
  })

  it('closes on Escape', async () => {
    const wrapper = setupMenu()
    await nextTick()
    menuEl()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('close')).toBeDefined()
    wrapper.unmount()
  })

  it('opens submenus on hover', async () => {
    vi.useFakeTimers()
    const wrapper = setupMenu()
    try {
      await nextTick()
      const more = menuItems().find(el => el.textContent?.includes('More'))!
      more.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
      // <zh/> 子菜单悬停开启延迟 150ms，快进时钟而非干等 | <en/> Submenu hover-open delay is 150ms — advance the clock instead of sleeping
      await vi.advanceTimersByTimeAsync(200)
      // <zh/> 悬停必须展开子菜单并渲染出子项，否则多级菜单入口静默失效
      // <en/> Hover must expand the submenu and render its items, otherwise nested entries silently break
      expect(more.classList.contains('adv-table-context-menu-item--expanded')).toBe(true)
      expect(document.body.textContent).toContain('Sub1')
    }
    finally {
      vi.useRealTimers()
      wrapper.unmount()
    }
  })

  it('navigates with arrow keys', async () => {
    const wrapper = setupMenu()
    await nextTick()
    const menu = menuEl()!
    const focusedText = () => document.body.querySelector('.adv-table-context-menu-item--focused')?.textContent ?? ''
    // <zh/> Down 从 -1 落到首个可点项（copy）， disabled 的 cut 必须被跳过
    // <en/> Down from -1 lands on the first clickable (copy); disabled cut must be skipped
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    expect(focusedText()).toContain('Copy')
    // <zh/> 再 Down 跳过 cut 落到 more | <en/> Another Down skips cut and lands on more
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    expect(focusedText()).toContain('More')
    // <zh/> Up 从 more 回绕测试：先回 copy 再 Up 应落到末项 more（回绕语义）
    // <en/> Wrap-around: Up from the first item lands on the last clickable
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    await nextTick()
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    await nextTick()
    expect(focusedText()).toContain('More')
    // <zh/> Enter 落在有子项的 more 上必须展开子菜单而非 itemClick
    // <en/> Enter on children-bearing more must expand the submenu instead of itemClick
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    await new Promise(r => setTimeout(r, 20))
    expect(document.body.textContent).toContain('Sub1')
    expect(wrapper.emitted('itemClick')).toBeUndefined()
    wrapper.unmount()
  })
})
