import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SummaryCell from '../../../src/components/table-virtual-renderer/summary-cell.vue'

describe('summaryCell', () => {
  it('renders nothing when value is undefined', () => {
    const wrapper = mount(SummaryCell, { props: { value: undefined } })
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })

  it('renders a string value as text', () => {
    const wrapper = mount(SummaryCell, { props: { value: 'Total: 100' } })
    expect(wrapper.text()).toBe('Total: 100')
    wrapper.unmount()
  })

  it('renders an empty string value', () => {
    const wrapper = mount(SummaryCell, { props: { value: '' } })
    expect(wrapper.text()).toBe('')
    wrapper.unmount()
  })

  it('renders a numeric value as text', () => {
    const wrapper = mount(SummaryCell, { props: { value: '42' } })
    expect(wrapper.text()).toBe('42')
    wrapper.unmount()
  })

  it('renders a VNode via component :is', () => {
    const vnode = { render: () => 'vnode-content' }
    const wrapper = mount(SummaryCell, { props: { value: vnode as any } })
    expect(wrapper.text()).toBe('vnode-content')
    wrapper.unmount()
  })
})
