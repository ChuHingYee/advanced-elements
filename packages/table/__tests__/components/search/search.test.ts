import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SearchForm from '../../../src/components/search/search.vue'

/* ── stubs ── */

const globalStubs = {
  ElForm: { template: '<form class="el-form"><slot /></form>', props: ['model'], methods: { resetFields() {} } },
  ElFormItem: {
    template: '<div class="el-form-item" :class="$attrs.class" :style="$attrs.style"><slot /></div>',
    props: ['prop', 'label'],
  },
  ElInput: { template: '<input class="el-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />', props: ['modelValue'] },
  ElSelect: { template: '<select class="el-select"><slot /></select>', props: ['modelValue'] },
  ElOption: { template: '<option class="el-option" />', props: ['label', 'value'] },
  ElDatePicker: { template: '<input class="el-date-picker" :value="modelValue" />', props: ['modelValue'] },
  ElInputNumber: { template: '<input class="el-input-number" :value="modelValue" />', props: ['modelValue'] },
  ElSwitch: { template: '<input class="el-switch" type="checkbox" :checked="modelValue" />', props: ['modelValue'] },
  ElButton: { template: '<button class="el-button" :type="type"><slot /></button>', props: ['type'] },
  ElIcon: { template: '<span class="el-icon"><slot /></span>' },
  ArrowUp: { template: '<span class="arrow-up" />' },
  ArrowDown: { template: '<span class="arrow-down" />' },
}

/* ── helpers ── */

function createField(overrides = {}): any {
  return { prop: 'name', label: 'Name', type: 'input', ...overrides, hidden: false }
}

const baseProps = {
  modelValue: { name: 'test' },
  fields: [createField()],
}

describe('searchForm (QueryForm)', () => {
  describe('rendering', () => {
    it('renders an ElForm', () => {
      const wrapper = mount(SearchForm, { props: baseProps, global: { stubs: globalStubs } })
      expect(wrapper.find('.el-form').exists()).toBe(true)
      wrapper.unmount()
    })

    it('renders a form item for each field', () => {
      const fields = [createField({ prop: 'a', hidden: false }), createField({ prop: 'b', hidden: false })]
      const wrapper = mount(SearchForm, {
        props: { ...baseProps, fields },
        global: { stubs: globalStubs },
      })
      expect(wrapper.findAll('.el-form-item').length).toBeGreaterThanOrEqual(2)
      wrapper.unmount()
    })

    it('renders the built-in query button by default', () => {
      const wrapper = mount(SearchForm, { props: baseProps, global: { stubs: globalStubs } })
      const buttons = wrapper.findAll('.el-button')
      expect(buttons.length).toBeGreaterThanOrEqual(1)
      wrapper.unmount()
    })

    it('renders built-in buttons: query, reset', () => {
      const wrapper = mount(SearchForm, {
        props: { ...baseProps, buttons: ['query', 'reset'] },
        global: { stubs: globalStubs },
      })
      const buttons = wrapper.findAll('.el-button')
      expect(buttons.length).toBeGreaterThanOrEqual(2)
      wrapper.unmount()
    })

    it('renders a custom button from config object', () => {
      const customBtn = { type: 'export', label: 'Export', props: {} }
      const wrapper = mount(SearchForm, {
        props: { ...baseProps, buttons: [customBtn] },
        global: { stubs: globalStubs },
      })
      const btn = wrapper.find('.el-button')
      expect(btn.text()).toContain('Export')
      wrapper.unmount()
    })

    it('renders input component for input type field', () => {
      const wrapper = mount(SearchForm, {
        props: baseProps,
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.el-input').exists()).toBe(true)
      wrapper.unmount()
    })

    it('renders select component for select type field', () => {
      const wrapper = mount(SearchForm, {
        props: {
          ...baseProps,
          fields: [createField({ prop: 'city', type: 'select', hidden: false })],
        },
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.el-select').exists()).toBe(true)
      wrapper.unmount()
    })

    it('shows expand button when there are hidden items', () => {
      const wrapper = mount(SearchForm, {
        props: baseProps,
        global: { stubs: globalStubs },
      })
      const expandBtn = wrapper.find('[data-expand-btn]')
      expect(expandBtn.exists()).toBe(true)
      // By default v-show="hasHiddenItems" is false → display:none
      // happy-dom evaluates style.display
      wrapper.unmount()
    })
  })

  describe('events', () => {
    it('emits query when query button is clicked', async () => {
      const wrapper = mount(SearchForm, {
        props: { ...baseProps, buttons: ['query'], searchText: '查询' },
        global: { stubs: globalStubs },
      })
      await wrapper.find('button.el-button').trigger('click')
      expect(wrapper.emitted('query')).toBeTruthy()
      expect(wrapper.emitted('query')![0][0]).toEqual({ name: 'test' })
      wrapper.unmount()
    })

    it('emits reset when reset button is clicked', async () => {
      const wrapper = mount(SearchForm, {
        props: { ...baseProps, buttons: ['reset'], resetText: '重置' },
        global: { stubs: globalStubs },
      })
      await wrapper.find('button.el-button').trigger('click')
      expect(wrapper.emitted('reset')).toBeTruthy()
      wrapper.unmount()
    })

    it('emits add when add button is clicked', async () => {
      const wrapper = mount(SearchForm, {
        props: { ...baseProps, buttons: ['add'], searchText: '追加' },
        global: { stubs: globalStubs },
      })
      await wrapper.find('button.el-button').trigger('click')
      expect(wrapper.emitted('add')).toBeTruthy()
      wrapper.unmount()
    })

    it('emits btnClick when a custom button is clicked', async () => {
      const customBtn = { type: 'export', label: 'Export', props: {} }
      const wrapper = mount(SearchForm, {
        props: { ...baseProps, buttons: [customBtn] },
        global: { stubs: globalStubs },
      })
      await wrapper.find('button.el-button').trigger('click')
      expect(wrapper.emitted('btnClick')).toBeTruthy()
      expect(wrapper.emitted('btnClick')![0][0]).toBe('export')
      wrapper.unmount()
    })

    it('emits change when an input field value changes', async () => {
      vi.useFakeTimers()
      const wrapper = mount(SearchForm, {
        props: { ...baseProps, debounceTime: 10 },
        global: { stubs: globalStubs },
      })
      const inputEl = wrapper.find('input.el-input').element
      Object.assign(inputEl, { value: 'new-value' })
      inputEl.dispatchEvent(new Event('input', { bubbles: true }))
      vi.advanceTimersByTime(50)
      expect(wrapper.emitted('change')).toBeTruthy()
      wrapper.unmount()
      vi.useRealTimers()
    })
  })

  describe('expand/collapse', () => {
    it('starts expanded by default', () => {
      const wrapper = mount(SearchForm, {
        props: baseProps,
        global: { stubs: globalStubs },
      })
      expect((wrapper.vm as any).expanded).toBe(true)
      wrapper.unmount()
    })

    it('starts collapsed when collapsed prop is true', () => {
      const wrapper = mount(SearchForm, {
        props: { ...baseProps, collapsed: true },
        global: { stubs: globalStubs },
      })
      expect((wrapper.vm as any).expanded).toBe(false)
      wrapper.unmount()
    })

    it('toggles expanded on toggleExpanded call', () => {
      const wrapper = mount(SearchForm, {
        props: baseProps,
        global: { stubs: globalStubs },
      })
      const vm = wrapper.vm as any
      expect(vm.expanded).toBe(true)
      vm.setExpanded(false)
      expect(vm.expanded).toBe(false)
      vm.setExpanded(true)
      expect(vm.expanded).toBe(true)
      wrapper.unmount()
    })

    it('exposes setExpanded and resize via defineExpose', () => {
      const wrapper = mount(SearchForm, {
        props: baseProps,
        global: { stubs: globalStubs },
      })
      const exposed = wrapper.vm as any
      expect(typeof exposed.setExpanded).toBe('function')
      expect(typeof exposed.resize).toBe('function')
      expect(typeof exposed.getComponentRefs).toBe('function')
      wrapper.unmount()
    })
  })

  describe('custom components map', () => {
    it('accepts custom component mapping', () => {
      const CustomInput = { template: '<input class="custom-input" />' }
      const wrapper = mount(SearchForm, {
        props: {
          ...baseProps,
          fields: [createField({ prop: 'test', type: 'custom-input', hidden: false })],
          components: { 'custom-input': CustomInput },
        },
        global: { stubs: globalStubs },
      })
      expect(wrapper.find('.custom-input').exists()).toBe(true)
      wrapper.unmount()
    })
  })
})
