import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ColumnSettingItem from '../../../src/components/column-setting/column-setting-item.vue'

/**
 * <zh/> 列设置项单测——渲染、显隐切换、固定操作。
 * <en/> Column-setting item tests — render, visibility toggle, pin actions.
 */
function setupItem(col: any = { key: 'a', prop: 'a', label: 'A' }, extra: Record<string, any> = {}) {
  const onUpdate = vi.fn()
  const onSetFixed = vi.fn()
  const onUnfix = vi.fn()
  const wrapper = mount(ColumnSettingItem as any, {
    props: {
      col,
      groupKey: 'normal',
      groupName: 'test-group',
      isPinned: () => false,
      ...extra,
    },
    global: {
      stubs: { VueDraggable: { template: '<div><slot /></div>' } },
    },
  })
  return { wrapper, onUpdate, onSetFixed, onUnfix }
}

describe('columnSettingItem', () => {
  it('renders the column label', async () => {
    const { wrapper } = setupItem()
    await nextTick()
    expect(wrapper.text()).toContain('A')
    wrapper.unmount()
  })

  it('toggles visibility through the checkbox', async () => {
    const { wrapper } = setupItem()
    await nextTick()
    const checkbox = wrapper.find('input[type="checkbox"]')
    // <zh/> 复选框必须存在（守卫式 if 会掩盖 UI 回归）
    // <en/> The checkbox must exist (a guarded if would mask UI regressions)
    expect(checkbox.exists()).toBe(true)
    await checkbox.setValue(false)
    await nextTick()
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
    wrapper.unmount()
  })

  it('renders group children', async () => {
    const { wrapper } = setupItem({
      key: 'g',
      label: 'G',
      children: [{ key: 'a', prop: 'a', label: 'A' }],
    })
    await nextTick()
    expect(wrapper.text()).toContain('G')
    wrapper.unmount()
  })

  it('hides the drag handle when not draggable', async () => {
    const { wrapper } = setupItem({ key: 'a', prop: 'a', label: 'A' }, { draggable: false, isOnlyChild: true })
    await nextTick()
    // <zh/> 不可拖拽时手柄占位必须带隐藏类，而非直接消失（布局占位语义）
    // <en/> The handle keeps its layout slot with a hidden class instead of vanishing
    const handle = wrapper.find('.adv-table-column-setting-item__drag-handle')
    expect(handle.exists()).toBe(true)
    expect(handle.classes()).toContain('adv-table-column-setting-item__drag-handle--hidden')
    wrapper.unmount()
  })
})
