import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import ColumnGroupTree from '../../../src/components/column-group/column-group-tree.vue'
import { advTableColumnGroupKey } from '../../../src/types/injection-keys'

/**
 * <zh/> 列组树单测——渲染、有/无注入、创建分组。
 * <en/> Column-group tree tests — render, with/without injection, create group.
 */
const tree = ref([
  { key: 'g', label: 'G', children: [{ key: 'a', prop: 'a', label: 'A' }] },
  { key: 'b', prop: 'b', label: 'B' },
])

function setupTree(api: any = {}) {
  return mount(ColumnGroupTree as any, {
    global: {
      provide: {
        [advTableColumnGroupKey as symbol]: {
          configTree: tree,
          options: ref({ allowRename: false }),
          createRootGroup: vi.fn(),
          ...api,
        },
      },
      stubs: { VueDraggable: { template: '<div class="drag-stub"><slot /></div>' } },
    },
  })
}

describe('columnGroupTree', () => {
  it('renders root nodes', async () => {
    const wrapper = setupTree()
    await nextTick()
    expect(wrapper.text()).toContain('G')
    expect(wrapper.text()).toContain('B')
    wrapper.unmount()
  })

  it('renders empty without injection', async () => {
    const wrapper = mount(ColumnGroupTree as any, {
      global: { stubs: { VueDraggable: { template: '<div><slot /></div>' } } },
    })
    await nextTick()
    // <zh/> 无注入时树不渲染任何节点（也不 crash）：断言无节点文本
    // <en/> Without injection the tree renders no nodes (and doesn't crash): assert node-free output
    expect(wrapper.text()).not.toContain('G')
    expect(wrapper.text()).not.toContain('B')
    wrapper.unmount()
  })

  it('creates root groups through the api', async () => {
    // <zh/> 注意按钮实际调用的是 createGroup(null, rootCount)，旧用例 mock 的 createRootGroup 根本不存在、永远不会被调
    // <en/> The button actually calls createGroup(null, rootCount); the old mock name createRootGroup does not exist and is never called
    const createGroup = vi.fn()
    const wrapper = mount(ColumnGroupTree as any, {
      global: {
        provide: {
          [advTableColumnGroupKey as symbol]: {
            configTree: tree,
            // <zh/> 创建按钮受 allowCreateGroup 门控，旧用例没开导致零按钮空转
            // <en/> The create button is gated on allowCreateGroup; the old test never enabled it and spun vacantly
            options: ref({ allowRename: false, allowCreateGroup: true }),
            createGroup,
          },
        },
        stubs: { VueDraggable: { template: '<div class="drag-stub"><slot /></div>' } },
      },
    })
    await nextTick()
    const btns = wrapper.findAll('button')
    // <zh/> 创建按钮必须存在（守卫式 if 会掩盖按钮丢失）
    // <en/> The create button must exist (a guarded if would mask a missing button)
    expect(btns.length).toBeGreaterThan(0)
    await btns[0].trigger('click')
    await nextTick()
    // <zh/> 树有 2 个根节点，创建位置为末尾索引 2
    // <en/> The tree has 2 roots, so creation lands at tail index 2
    expect(createGroup).toHaveBeenCalledWith(null, 2)
    wrapper.unmount()
  })
})
