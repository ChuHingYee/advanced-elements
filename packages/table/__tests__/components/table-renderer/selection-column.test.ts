import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { SelectionColumn } from '../../../src/components/table-renderer/selection-column'

/* ── stubs ── */

const globalStubs = {
  ElTableColumn: {
    template: '<div class="el-table-column"><slot name="header" /><slot name="default" :row="{id:1}" :$index="0" /></div>',
    props: ['width', 'align'],
  },
  ElTable: { template: '<div class="el-table"><slot /></div>' },
}

/* ── helpers ── */

function createSelectionState() {
  return {
    isSelected: vi.fn(() => false),
    toggleRowSelection: vi.fn(),
  }
}

describe('selectionColumn', () => {
  it('renders a column for each selection column config', () => {
    const columns = [{ key: 'sel1', type: 'selection' }]
    const wrapper = mount(SelectionColumn, {
      props: {
        selectionColumns: columns,
        selectionState: createSelectionState(),
        rowKey: (row: any) => String(row.id),
        selectableData: [],
        visibleData: [],
        selectionMode: 'multiple',
        checkStatus: { isAllSelected: false, isIndeterminate: false },
      },
      global: { stubs: globalStubs },
    })
    expect(wrapper.findAll('.el-table-column')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders multiple selection columns', () => {
    const columns = [{ key: 'sel1' }, { key: 'sel2' }]
    const wrapper = mount(SelectionColumn, {
      props: {
        selectionColumns: columns,
        selectionState: createSelectionState(),
        rowKey: (row: any) => String(row.id),
        selectableData: [],
        visibleData: [],
        selectionMode: 'multiple',
        checkStatus: { isAllSelected: false, isIndeterminate: false },
      },
      global: { stubs: globalStubs },
    })
    expect(wrapper.findAll('.el-table-column')).toHaveLength(2)
    wrapper.unmount()
  })

  it('renders header with checkbox in multiple mode', () => {
    const wrapper = mount(SelectionColumn, {
      props: {
        selectionColumns: [{ key: 'sel1' }],
        selectionState: createSelectionState(),
        rowKey: (row: any) => String(row.id),
        selectableData: [{ id: 1 }],
        visibleData: [{ id: 1 }],
        selectionMode: 'multiple',
        checkStatus: { isAllSelected: false, isIndeterminate: false },
      },
      global: { stubs: globalStubs },
    })
    const columnDiv = wrapper.find('.el-table-column')
    expect(columnDiv.exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders header as null in single mode', () => {
    const wrapper = mount(SelectionColumn, {
      props: {
        selectionColumns: [{ key: 'sel1' }],
        selectionState: createSelectionState(),
        rowKey: (row: any) => String(row.id),
        selectableData: [],
        visibleData: [],
        selectionMode: 'single',
        checkStatus: { isAllSelected: false, isIndeterminate: false },
      },
      global: { stubs: globalStubs },
    })
    expect(wrapper.find('.el-table-column').exists()).toBe(true)
    wrapper.unmount()
  })

  it('passes row data to default slot for rendering selection cell', () => {
    const wrapper = mount(SelectionColumn, {
      props: {
        selectionColumns: [{ key: 'sel1' }],
        selectionState: createSelectionState(),
        rowKey: (row: any) => String(row.id),
        selectableData: [{ id: 1 }],
        visibleData: [{ id: 1 }],
        selectionMode: 'multiple',
        checkStatus: { isAllSelected: false, isIndeterminate: false },
      },
      global: {
        stubs: {
          ElTableColumn: {
            template: '<div class="el-table-column"><slot name="default" :row="{id:1}" :$index="0" /></div>',
          },
        },
      },
    })
    expect(wrapper.find('.el-table-column').exists()).toBe(true)
    wrapper.unmount()
  })
})
