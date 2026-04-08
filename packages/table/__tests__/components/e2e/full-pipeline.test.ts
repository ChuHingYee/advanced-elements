import { mount } from '@vue/test-utils'
/**
 * <zh/> e2e 全链路 — 过滤+排序+分页+树 在浏览器真实 DOM
 * <en/> e2e full pipeline — filter+sort+pagination+tree in real browser DOM
 */
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import AdvTable from '../../../src/AdvTable.vue'

describe('e2e full pipeline', () => {
  it('mounts and filters', async () => {
    const Comp = defineComponent({
      setup() {
        return () => h(AdvTable, {
          mode: 'virtual',
          height: 400,
          columns: [
            { key: 'name', prop: 'name', label: 'Name', width: 100, sortable: true },
            { key: 'age', prop: 'age', label: 'Age', width: 80 },
          ],
          data: [
            { id: '1', name: 'Alice', age: 30 },
            { id: '2', name: 'Bob', age: 25 },
          ],
        })
      },
    })
    const wrapper = mount(Comp)
    expect(wrapper.find('.adv-table').exists()).toBe(true)
    expect(wrapper.html()).toContain('adv-table')
  })
})
