import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import ColumnGroupNode from '../../../src/components/column-group/column-group-node.vue'
import { advTableColumnGroupKey } from '../../../src/types/injection-keys'

/**
 * <zh/> 列组节点单测——渲染、重命名、删除空分组。
 * <en/> Column-group node tests — render, rename, empty-group removal.
 */
function setupNode(col: any, api: any = { options: ref({ allowRename: false }) }) {
  return mount(ColumnGroupNode as any, {
    props: { col, depth: 0 },
    global: {
      provide: { [advTableColumnGroupKey as symbol]: api },
      stubs: { VueDraggable: { template: '<div class="drag-stub"><slot /></div>' } },
    },
  })
}

describe('columnGroupNode', () => {
  it('renders leaf labels', async () => {
    const wrapper = setupNode({ key: 'a', prop: 'a', label: 'A' })
    await nextTick()
    expect(wrapper.text()).toContain('A')
    wrapper.unmount()
  })

  it('renders group children recursively', async () => {
    const wrapper = setupNode({
      key: 'g',
      label: 'G',
      children: [{ key: 'a', prop: 'a', label: 'A' }],
    })
    await nextTick()
    expect(wrapper.text()).toContain('G')
    expect(wrapper.text()).toContain('A')
    wrapper.unmount()
  })

  it('renames groups through the api', async () => {
    const renameGroup = vi.fn()
    const wrapper = mount(ColumnGroupNode as any, {
      props: { col: { key: 'g', label: 'G', children: [{ key: 'a', prop: 'a', label: 'A' }] }, depth: 0 },
      global: {
        provide: {
          [advTableColumnGroupKey as symbol]: { renameGroup, options: ref({ allowRename: true }) },
        },
        stubs: { VueDraggable: { template: '<div class="drag-stub"><slot /></div>' } },
      },
    })
    await nextTick()
    const btn = wrapper.find('.adv-table-column-group-node__action-btn')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    await nextTick()
    const input = wrapper.find('.adv-table-column-group-node__rename-input input')
    expect(input.exists()).toBe(true)
    await input.setValue('Renamed')
    await input.trigger('blur')
    await nextTick()
    expect(renameGroup).toHaveBeenCalledWith('g', 'Renamed')
    wrapper.unmount()
  })

  it('marks empty groups', async () => {
    const wrapper = setupNode({ key: 'g', label: 'G', children: [], __isGroup: true })
    await nextTick()
    expect(wrapper.find('.adv-table-column-group-node__empty-hint').exists()).toBe(true)
    wrapper.unmount()
  })
})
