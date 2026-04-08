import type { ActionConfig } from '../../../src/types/column'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { OptionCell } from '../../../src/components/cell-renderers/option-cell'

const ElButtonStub = defineComponent({
  name: 'ElButton',
  props: {
    type: { type: String, default: 'primary' },
    size: { type: String, default: 'small' },
    link: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    icon: { type: Object, default: null },
  },
  emits: ['click'],
  template: `<button type="button" :disabled="disabled" @click="$emit('click', $event)"><slot /></button>`,
})

describe('cell-renderers/option-cell', () => {
  it('renders buttons when actions are provided', () => {
    const actions: ActionConfig[] = [
      { label: 'Edit', onClick: vi.fn() },
      { label: 'Delete', onClick: vi.fn() },
    ]

    const wrapper = mount(OptionCell, {
      props: {
        cellData: undefined,
        rowData: { id: 1 },
        column: { actions },
        index: 0,
      },
      global: {
        stubs: { ElButton: ElButtonStub },
      },
    })

    expect(wrapper.find('.adv-table__option').exists()).toBe(true)
    expect(wrapper.findAll('button')).toHaveLength(2)
  })

  it('renders empty span when no actions', () => {
    const wrapper = mount(OptionCell, {
      props: {
        cellData: undefined,
        rowData: { id: 1 },
        column: {},
        index: 0,
      },
      global: {
        stubs: { ElButton: ElButtonStub },
      },
    })

    expect(wrapper.find('.adv-table__option').exists()).toBe(false)
    expect(wrapper.find('span').exists()).toBe(true)
  })

  it('renders empty span when no visible buttons', () => {
    const actions: ActionConfig[] = [
      { label: 'Edit', visible: false },
    ]

    const wrapper = mount(OptionCell, {
      props: {
        cellData: undefined,
        rowData: { id: 1 },
        column: { actions },
        index: 0,
      },
      global: {
        stubs: { ElButton: ElButtonStub },
      },
    })

    expect(wrapper.find('.adv-table__option').exists()).toBe(false)
  })

  it('uses visible function to filter buttons', () => {
    const actions: ActionConfig[] = [
      { label: 'Show', visible: ({ row }) => row.id === 1 },
      { label: 'Hide', visible: ({ row }) => row.id === 2 },
    ]

    const wrapper = mount(OptionCell, {
      props: {
        cellData: undefined,
        rowData: { id: 1 },
        column: { actions },
        index: 0,
      },
      global: {
        stubs: { ElButton: ElButtonStub },
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].text()).toBe('Show')
  })

  it('handles button disabled state', () => {
    const actions: ActionConfig[] = [
      { label: 'Edit', disabled: true },
    ]

    const wrapper = mount(OptionCell, {
      props: {
        cellData: undefined,
        rowData: { id: 1 },
        column: { actions },
        index: 0,
      },
      global: {
        stubs: { ElButton: ElButtonStub },
      },
    })

    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('handles dynamic disabled state', () => {
    const actions: ActionConfig[] = [
      { label: 'Edit', disabled: ({ row }) => row.id === 1 },
    ]

    const wrapper = mount(OptionCell, {
      props: {
        cellData: undefined,
        rowData: { id: 1 },
        column: { actions },
        index: 0,
      },
      global: {
        stubs: { ElButton: ElButtonStub },
      },
    })

    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('calls onClick when button is clicked', async () => {
    const onClick = vi.fn()
    const actions: ActionConfig[] = [
      { label: 'Edit', onClick },
    ]

    const wrapper = mount(OptionCell, {
      props: {
        cellData: undefined,
        rowData: { id: 1 },
        column: { actions },
        index: 0,
      },
      global: {
        stubs: { ElButton: ElButtonStub },
      },
    })

    await wrapper.find('button').trigger('click')
    expect(onClick).toHaveBeenCalledWith({ row: { id: 1 }, index: 0 })
  })

  it('renders dividers between buttons', () => {
    const actions: ActionConfig[] = [
      { label: 'Edit', onClick: vi.fn() },
      { label: 'Delete', onClick: vi.fn() },
    ]

    const wrapper = mount(OptionCell, {
      props: {
        cellData: undefined,
        rowData: { id: 1 },
        column: { actions },
        index: 0,
      },
      global: {
        stubs: { ElButton: ElButtonStub },
      },
    })

    expect(wrapper.findAll('.adv-table__option-divider')).toHaveLength(1)
  })

  it('has correct name', () => {
    expect(OptionCell.name).toBe('AdvOptionCell')
  })
})
