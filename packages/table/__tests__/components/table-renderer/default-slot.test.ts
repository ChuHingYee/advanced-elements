import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDefaultDomAdapter } from '../../../src/components/renderer-core/default-dom-adapter'
import TableRenderer from '../../../src/components/table-renderer/TableRenderer.vue'

/* ── stubs ── */

const globalStubs = {
  // ElTable stub forwards its default slot so the test observes
  // whether TableRenderer passes declarative children through.
  ElTable: { template: '<div class="el-table"><slot /><slot name="empty" /><slot name="append" /></div>' },
  SelectionColumn: { template: '<div class="selection-column-stub" />' },
  NormalColumn: { template: '<div class="normal-column-stub" />' },
  RowActionBar: { template: '<div class="row-action-bar-stub" />' },
}

const minimalProps = {
  data: [],
  columns: [],
  rowKey: (row: any) => String(row.id),
  leafColumns: [],
  selectionColumns: [],
  normalColumns: [],
  displayNormalColumns: [],
  selectableData: [],
  checkStatus: { isAllSelected: false, isIndeterminate: false },
  dom: createDefaultDomAdapter('el'),
}

describe('tableRenderer default slot (declarative columns)', () => {
  it('forwards default-slot children into ElTable', () => {
    const wrapper = mount(TableRenderer, {
      props: minimalProps as any,
      slots: { default: '<span class="declarative-marker">name</span>' },
      global: { stubs: globalStubs },
    })
    const table = wrapper.find('.el-table')
    expect(table.exists()).toBe(true)
    expect(table.find('.declarative-marker').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders ElTable without declarative children when no default slot is given', () => {
    const wrapper = mount(TableRenderer, {
      props: minimalProps as any,
      global: { stubs: globalStubs },
    })
    const table = wrapper.find('.el-table')
    expect(table.exists()).toBe(true)
    expect(table.find('.declarative-marker').exists()).toBe(false)
    wrapper.unmount()
  })
})
