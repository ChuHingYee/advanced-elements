/**
 * @file column-vnode-factory.test.ts
 * @description
 * <zh/> 表头内容工厂单测——工厂是两模式表头内容的唯一来源，此处即等价守护：
 * <zh/> 排序指示器渲染、点击回调接线、列键包装属性。
 * <zh/> 采用微型宿主组件挂载，获得真实 DOM 断言能力且不依赖 EP 表格布局。
 *
 * <en/> Header content factory tests — the factory is the single source of headers for both
 * <en/> modes, so these guard headers equivalently: sort indicator rendering, toggle callback
 * <en/> wiring, and the key-carrying wrapper. Uses a tiny host component mounted via VTU for
 * <en/> real-DOM assertions without EP table layout dependency.
 */
import type { LocalColumn } from '../../../src/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createColumnVNodeFactory } from '../../../src/components/renderer-core/column-vnode-factory'

const col = {
  prop: 'name',
  label: 'Name',
  sortable: true,
  hidden: false,
} as unknown as LocalColumn

function makeFactory(toggleSpy: ReturnType<typeof vi.fn>) {
  return createColumnVNodeFactory(
    {
      filterSortApi: {
        getSortOrder: () => null,
        getSortIndex: () => -1,
        onToggleSort: toggleSpy,
        getFilterValue: () => undefined,
        setFilter: vi.fn(),
        isColumnFiltered: () => false,
        getEnumOptions: () => [],
        filterT: () => () => '',
      },
    } as any,
    {
      getEditConfig: () => undefined,
      resolveHoverTeleport: () => false,
      resolveHoverColumns: () => [],
      resolveTreePrefix: () => [],
      renderDetailFirstCol: () => ({}) as any,
      renderSyntheticEmptyCol: () => null,
      renderGroupFirstCol: () => ({}) as any,
    },
  )
}

describe('column-vnode-factory — header content', () => {
  it('renders a clickable sort indicator inside the key-carrying wrapper', async () => {
    const toggleSpy = vi.fn()
    const factory = makeFactory(toggleSpy)

    const Host = defineComponent({
      setup() {
        return () => factory.buildHeaderContent({
          col,
          key: 'name',
          colIndex: 0,
          columns: [col],
          slots: {},
          wrap: (k, content) => h('span', { 'data-adv-table-column-key': k }, [content]),
        })
      },
    })

    const w = mount(Host)
    const indicator = w.find('.adv-table__sort-indicator')
    expect(indicator.exists()).toBe(true)
    expect(w.find('[data-adv-table-column-key="name"]').exists()).toBe(true)

    await indicator.trigger('click')
    expect(toggleSpy).toHaveBeenCalledWith('name', expect.anything())
  })
})
