import { mount } from '@vue/test-utils'
import { ElButton, ElCheckbox } from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import ColumnSettingList from '../../../src/components/column-setting/column-setting-list.vue'
import { advTableColumnSettingListKey } from '../../../src/types/config'

/**
 * <zh/> ColumnSettingList 小覆盖：无 provider 时 FALLBACK 空列表/无操作回调 + 模板事件转发
 * <en/> ColumnSettingList small coverage: FALLBACK empty lists/noop callbacks without provider + template event relay
 */
describe('column-setting-list small coverage', () => {
  it('renders empty fallback without a provider and relays header events', async () => {
    // <zh/> 无 provide → useSafeInject 回退 FALLBACK（8 个闭包定义即覆盖）| <en/> no provide → useSafeInject falls back to FALLBACK (defining the 8 closures covers them)
    const wrapper = mount(ColumnSettingList)
    // <zh/> 空列表时分组不渲染 | <en/> no groups render with empty lists
    expect(wrapper.find('.adv-table-column-setting__group').exists()).toBe(false)
    // <zh/> @change 内联闭包 → FALLBACK handleHeaderChange 空操作 | <en/> @change inline closure → FALLBACK handleHeaderChange noop
    await wrapper.findComponent(ElCheckbox).setValue(true)
    // <zh/> @click 内联闭包 → 同一空操作 | <en/> @click inline closure → same noop
    await wrapper.findComponent(ElButton).trigger('click')
    wrapper.unmount()
  })

  it('renders groups with a provided context and relays group updates', async () => {
    // <zh/> 提供最小上下文使三组渲染，触发 @update:model-value 内联闭包 | <en/> provide a minimal context so all groups render, firing @update:model-value inline closures
    const handleGroupUpdate = vi.fn()
    const col = (key: string) => ({ key, prop: key, label: key })
    const wrapper = mount(ColumnSettingList, {
      global: {
        provide: {
          [advTableColumnSettingListKey as symbol]: {
            leftColumns: computed(() => [col('l')]),
            normalColumns: computed(() => [col('n')]),
            rightColumns: computed(() => [col('r')]),
            isChooseAll: ref(false),
            isIndeterminate: ref(false),
            isPinned: () => false,
            handleHeaderChange: () => {},
            handleColumnMove: () => true,
            handleColumnEnd: () => {},
            handleGroupUpdate,
          },
        },
      },
    })
    expect(wrapper.findAll('.adv-table-column-setting__group')).toHaveLength(3)
    const draggables = wrapper.findAllComponents({ name: 'VueDraggable' })
    expect(draggables.length).toBe(3)
    for (const [i, group] of (['left', 'normal', 'right'] as const).entries()) {
      await draggables[i]!.vm.$emit('update:modelValue', [])
      expect(handleGroupUpdate).toHaveBeenCalledWith(group, [])
    }
    wrapper.unmount()
  })
})
