import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { AdvTableCell } from '../../../src/components/cell/adv-table-cell'

/**
 * <zh/> 表格单元格单测——渲染、状态类名与 tooltip 包装。
 * <en/> Table-cell tests — render, state classes and tooltip wrap.
 */
function setupCell(overrides: Record<string, any> = {}, colOverrides: Record<string, any> = {}) {
  return mount(AdvTableCell as any, {
    props: {
      row: { id: 1, name: 'A' },
      col: { key: 'name', prop: 'name', label: 'Name', ...colOverrides },
      rowIndex: 0,
      colIndex: 0,
      columns: [{ key: 'name', prop: 'name' }],
      slots: {},
      slotKey: 'name',
      t: () => undefined,
      rowKeyStr: '1',
      ...overrides,
    },
  })
}

describe('advTableCell', () => {
  it('renders value text with markers', () => {
    const wrapper = setupCell()
    expect(wrapper.text()).toContain('A')
    expect(wrapper.attributes('data-adv-table-row-key')).toBe('1')
    expect(wrapper.attributes('role')).toBe('gridcell')
    wrapper.unmount()
  })

  it('applies state classes', () => {
    const wrapper = setupCell({ cellState: { isEditing: true, isDirty: true, isRangeSelected: true } })
    const cls = wrapper.classes()
    expect(cls).toContain('adv-table__cell--editing')
    expect(cls).toContain('adv-table__cell--dirty')
    expect(cls).toContain('adv-table__cell--range-selected')
    expect(wrapper.attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('renders custom renderers', () => {
    const wrapper = setupCell({}, { cellRenderer: () => h('b', 'custom') })
    expect(wrapper.text()).toContain('custom')
    wrapper.unmount()
  })

  it('skips tooltip for special value types', () => {
    const wrapper = setupCell({}, { valueType: 'image' })
    expect(wrapper.find('.adv-table__cell--overflow').exists()).toBe(false)
    wrapper.unmount()
  })

  it('marks disabled tooltips', () => {
    const wrapper = setupCell({ tooltipDisabled: true })
    expect(wrapper.find('[data-adv-tooltip-disabled="true"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
