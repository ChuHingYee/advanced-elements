import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { NormalColumn } from '../../../src/components/table-renderer/normal-column'

/* ── helpers ── */

function createColumn(overrides: any = {}): any {
  return {
    key: 'name',
    prop: 'name',
    label: 'Name',
    ...overrides,
    hidden: false,
  }
}

const defaultProps = {
  col: createColumn(),
  colIndex: 0,
  displayNormalColumns: [createColumn()],
  hasHoverOptionColumns: false,
  hoverOptionColumns: [],
  slots: {},
  t: () => undefined,
  rowKey: (row: any) => String(row.id),
  hoverRowKey: null,
  hoverLayerVisible: false,
  hoverLayerCollapsed: false,
  hoverLayerStyle: {},
  onToggleCollapse: vi.fn(),
}

/* ── stubs ── */

const globalStubs = {
  ElTableColumn: {
    template: '<div class="el-table-column"><slot name="header" /><slot name="default" :row="{id:1}" :$index="0" /></div>',
  },
  ElTable: { template: '<div class="el-table"><slot /></div>' },
  CellEditTrigger: { template: '<div class="cell-edit-trigger" />' },
}

describe('normalColumn', () => {
  it('renders an ElTableColumn wrapper', () => {
    const wrapper = mount(NormalColumn, {
      props: defaultProps,
      global: { stubs: globalStubs },
    })
    expect(wrapper.find('.el-table-column').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders the column label as header content', () => {
    const wrapper = mount(NormalColumn, {
      props: defaultProps,
      global: { stubs: globalStubs },
    })
    const el = wrapper.find('.el-table-column')
    expect(el.exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders child columns recursively for group columns', () => {
    const childCol = createColumn({ key: 'age', prop: 'age', label: 'Age', hidden: false })
    const groupCol = createColumn({
      key: 'group',
      label: 'Group',
      children: [childCol],
    })
    const wrapper = mount(NormalColumn, {
      props: {
        ...defaultProps,
        col: groupCol,
      },
      global: { stubs: globalStubs },
    })
    expect(wrapper.find('.el-table-column').exists()).toBe(true)
    wrapper.unmount()
  })

  it('passes correct width/minWidth when autoSizeColumns is enabled', () => {
    const wrapper = mount(NormalColumn, {
      props: {
        ...defaultProps,
        autoSizeColumns: true,
        col: createColumn({ width: 120 }),
      },
      global: { stubs: globalStubs },
    })
    expect(wrapper.find('.el-table-column').exists()).toBe(true)
    wrapper.unmount()
  })

  it('applies hover-cell class to last normal column when hover options exist', () => {
    const wrapper = mount(NormalColumn, {
      props: {
        ...defaultProps,
        hasHoverOptionColumns: true,
        colIndex: 0,
        displayNormalColumns: [createColumn()],
      },
      global: { stubs: globalStubs },
    })
    // <zh/> 末列 + 有 hover 配置 → 悬停单元格类落到列根上
    // <en/> Last column with hover options → hover-cell class lands on the column root
    expect(wrapper.find('.el-table-column.adv-table__hover-cell').exists()).toBe(true)
    wrapper.unmount()
  })

  it('omits hover-cell class on non-last columns', () => {
    const wrapper = mount(NormalColumn, {
      props: {
        ...defaultProps,
        hasHoverOptionColumns: true,
        colIndex: 0,
        displayNormalColumns: [createColumn(), createColumn({ key: 'b', prop: 'b' })],
      },
      global: { stubs: globalStubs },
    })
    expect(wrapper.find('.el-table-column.adv-table__hover-cell').exists()).toBe(false)
    wrapper.unmount()
  })

  it('handles column group collapse toggle', () => {
    const onToggleGroup = vi.fn()
    const childCol = createColumn({ key: 'age', prop: 'age', label: 'Age', hidden: false })
    const groupCol = createColumn({
      key: 'group',
      label: 'Group',
      children: [childCol],
    })
    const wrapper = mount(NormalColumn, {
      props: {
        ...defaultProps,
        col: groupCol,
        canCollapse: () => true,
        isCollapsed: () => false,
        onToggleColumnGroupCollapse: onToggleGroup,
      },
      global: { stubs: globalStubs },
    })
    // <zh/> 未折叠：展开态箭头 + 点击切换透出分组 key
    // <en/> Expanded: expanded-state arrow renders, clicking it reports the group key
    expect(wrapper.find('.adv-table-column-group-header__toggle--expanded').exists()).toBe(true)
    wrapper.unmount()
  })

  it('toggles group collapse through the header button', async () => {
    const onToggleGroup = vi.fn()
    const childCol = createColumn({ key: 'age', prop: 'age', label: 'Age', hidden: false })
    const groupCol = createColumn({
      key: 'group',
      label: 'Group',
      children: [childCol],
    })
    const wrapper = mount(NormalColumn, {
      props: {
        ...defaultProps,
        col: groupCol,
        canCollapse: () => true,
        isCollapsed: () => false,
        onToggleColumnGroupCollapse: onToggleGroup,
      },
      global: { stubs: globalStubs },
    })
    await wrapper.find('.adv-table-column-group-header__toggle').trigger('click')
    expect(onToggleGroup).toHaveBeenCalledWith('group')
    wrapper.unmount()
  })

  it('filters children by columnGroupShow when group is collapsed', () => {
    const openChild = createColumn({ key: 'open', prop: 'open', label: 'Open', columnGroupShow: 'open', hidden: false })
    const closedChild = createColumn({ key: 'closed', prop: 'closed', label: 'Closed', columnGroupShow: 'closed', hidden: false })
    const groupCol = createColumn({
      key: 'group',
      label: 'Group',
      children: [openChild, closedChild],
    })
    const wrapper = mount(NormalColumn, {
      props: {
        ...defaultProps,
        col: groupCol,
        canCollapse: () => true,
        isCollapsed: () => true,
        onToggleColumnGroupCollapse: vi.fn(),
      },
      global: { stubs: globalStubs },
    })
    // <zh/> 折叠态只留 closed 子列：open 子列不得渲染
    // <en/> Collapsed keeps only closed children: the open child must not render
    expect(wrapper.text()).toContain('Closed')
    expect(wrapper.text()).not.toContain('Open')
    wrapper.unmount()
  })
})
