import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ColumnFilterPanel from '../../../src/components/filter-panel/column-filter-panel.vue'
import FloatingFilterCell from '../../../src/components/filter-panel/floating-filter-cell.vue'

/* ── helpers ── */

function createFilterValue(type: string): any {
  if (type === 'text')
    return { type: 'text', operator: 'contains', value: '' }
  if (type === 'number')
    return { type: 'number', operator: '=', value: undefined }
  if (type === 'date')
    return { type: 'date', operator: 'between', value: '' }
  if (type === 'enum')
    return { type: 'enum', selected: [] }
  return { type, operator: '=', value: '' }
}

/* ── stubs ── */
const globalStubs = {
  ColumnFilterPanel: {
    name: 'ColumnFilterPanel',
    template: '<div class="stub-column-filter-panel"><slot /></div>',
    props: ['columnKey', 'filterType', 'modelValue', 'active', 'enumOptions', 't'],
  },
  ColumnFilterForm: {
    name: 'ColumnFilterForm',
    template: '<div class="stub-column-filter-form" />',
    props: ['columnKey', 'filterType', 'modelValue', 'enumOptions', 'active', 't', 'inline'],
  },
  ElInput: {
    template: '<div class="el-input"><input :value="modelValue" readonly /><slot name="prepend" /><slot name="append" /></div>',
    props: ['modelValue', 'size', 'readonly', 'placeholder'],
  },
  ElPopover: {
    template: '<div class="el-popover"><slot name="reference" /><slot /></div>',
    props: ['visible', 'width', 'trigger', 'placement', 'showArrow', 'popperClass', 'popper-class'],
  },
  ElIcon: {
    template: '<span class="el-icon"><slot /></span>',
  },
}

function createBaseProps(overrides?: Record<string, any>) {
  return {
    columnKey: 'name',
    filterType: 'text' as string,
    modelValue: createFilterValue('text'),
    active: false,
    t: (key: string) => key,
    ...overrides,
  }
}

describe('floatingFilterCell', () => {
  describe('text filter', () => {
    it('renders the readonly input for displaying filter text', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps(),
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.el-input').exists()).toBe(true)
      wrapper.unmount()
    })

    it('renders ColumnFilterPanel for the filter button', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps(),
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.stub-column-filter-panel').exists()).toBe(true)
      wrapper.unmount()
    })

    it('renders the main container with correct class', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps(),
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.adv-table-floating-filter').exists()).toBe(true)
      wrapper.unmount()
    })

    it('adds active class when active prop is true', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({ active: true }),
        global: { stubs: globalStubs },
      })
      const input = wrapper.find('.adv-table-floating-filter__input')
      expect(input.classes()).toContain('adv-table-floating-filter__input--active')
      wrapper.unmount()
    })

    it('does not add active class when active prop is false', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({ active: false }),
        global: { stubs: globalStubs },
      })
      const input = wrapper.find('.adv-table-floating-filter__input')
      expect(input.classes()).not.toContain('adv-table-floating-filter__input--active')
      wrapper.unmount()
    })
  })

  describe('number filter', () => {
    it('renders the readonly input for number filter type', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({
          filterType: 'number',
          modelValue: createFilterValue('number'),
        }),
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.el-input').exists()).toBe(true)
      wrapper.unmount()
    })

    it('passes correct filterType to ColumnFilterPanel', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({
          filterType: 'number',
          modelValue: createFilterValue('number'),
        }),
        global: { stubs: globalStubs },
      })
      const panel = wrapper.findComponent(ColumnFilterPanel)
      expect(panel.exists()).toBe(true)
      expect(panel.props('filterType')).toBe('number')
      wrapper.unmount()
    })
  })

  describe('date filter', () => {
    it('renders for date filter type', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({
          filterType: 'date',
          modelValue: createFilterValue('date'),
        }),
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.el-input').exists()).toBe(true)
      expect(wrapper.find('.stub-column-filter-panel').exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('enum filter', () => {
    it('renders for enum filter type with enum options', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({
          filterType: 'enum',
          modelValue: createFilterValue('enum'),
          enumOptions: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
        }),
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.el-input').exists()).toBe(true)
      expect(wrapper.find('.stub-column-filter-panel').exists()).toBe(true)
      wrapper.unmount()
    })

    it('passes enumOptions through internal resolve (no forward to ColumnFilterPanel)', () => {
      const enumOptions = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({
          filterType: 'enum',
          modelValue: createFilterValue('enum'),
          enumOptions,
        }),
        global: { stubs: globalStubs },
      })
      const panel = wrapper.findComponent(ColumnFilterPanel)
      expect(panel.exists()).toBe(true)
      expect(panel.props('enumOptions')).toBeUndefined()
      wrapper.unmount()
    })
  })

  describe('custom floatingFilterComponent', () => {
    it('renders a custom component when floatingFilterComponent is provided', () => {
      const CustomFilter = { template: '<div class="custom-filter" />', props: ['modelValue', 'params'] }
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({
          floatingFilterComponent: CustomFilter,
        }),
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.custom-filter').exists()).toBe(true)
      expect(wrapper.find('.stub-column-filter-panel').exists()).toBe(false)
      wrapper.unmount()
    })

    it('does not render the default input when custom component is used', () => {
      const CustomFilter = { template: '<div class="custom-filter" />', props: ['modelValue', 'params'] }
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({
          floatingFilterComponent: CustomFilter,
        }),
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.adv-table-floating-filter__input').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  describe('suppressFilterButton mode', () => {
    it('renders input with clickable class when suppressFilterButton is true', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({
          suppressFilterButton: true,
        }),
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.stub-column-filter-panel').exists()).toBe(false)
      const input = wrapper.find('.adv-table-floating-filter__input--clickable')
      expect(input.exists()).toBe(true)
      wrapper.unmount()
    })

    it('does not render ElPopover in suppress mode (shared popover provided by parent)', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({
          suppressFilterButton: true,
        }),
        global: { stubs: globalStubs },
      })
      // 在 suppress 模式下，FloatingFilterCell 不渲染 ElPopover
      // 共享弹窗由 table.vue 统一渲染
      expect(wrapper.find('.el-popover').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  describe('props passing', () => {
    it('passes columnKey to ColumnFilterPanel', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({ columnKey: 'age' }),
        global: { stubs: globalStubs },
      })
      const panel = wrapper.findComponent(ColumnFilterPanel)
      expect(panel.exists()).toBe(true)
      expect(panel.props('columnKey')).toBe('age')
      wrapper.unmount()
    })

    it('passes active state to ColumnFilterPanel', () => {
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({ active: true }),
        global: { stubs: globalStubs },
      })
      const panel = wrapper.findComponent(ColumnFilterPanel)
      expect(panel.exists()).toBe(true)
      expect(panel.props('active')).toBe(true)
      wrapper.unmount()
    })

    it('uses translation function internally (no forward to ColumnFilterPanel)', () => {
      const t = (key: string) => `translated:${key}`
      const wrapper = mount(FloatingFilterCell, {
        props: createBaseProps({ t }),
        global: { stubs: globalStubs },
      })
      const panel = wrapper.findComponent(ColumnFilterPanel)
      expect(panel.exists()).toBe(true)
      expect(panel.props('t')).toBeUndefined()
      wrapper.unmount()
    })
  })
})
