import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IconDrag from '../../../src/components/column-setting/icon-drag.vue'

describe('iconDrag', () => {
  it('renders an SVG with default size 16', () => {
    const wrapper = mount(IconDrag)
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('width')).toBe('16')
    expect(svg.attributes('height')).toBe('16')
    wrapper.unmount()
  })

  it('accepts a custom size prop', () => {
    const wrapper = mount(IconDrag, { props: { size: 24 } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('24')
    expect(svg.attributes('height')).toBe('24')
    wrapper.unmount()
  })

  it('accepts a string size', () => {
    const wrapper = mount(IconDrag, { props: { size: '32' } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('32')
    expect(svg.attributes('height')).toBe('32')
    wrapper.unmount()
  })

  it('renders with the correct viewBox', () => {
    const wrapper = mount(IconDrag)
    const svg = wrapper.find('svg')
    expect(svg.attributes('viewBox')).toBe('0 0 1024 1024')
    wrapper.unmount()
  })

  it('renders a path with currentColor fill', () => {
    const wrapper = mount(IconDrag)
    const path = wrapper.find('path')
    expect(path.exists()).toBe(true)
    expect(path.attributes('fill')).toBe('currentColor')
    wrapper.unmount()
  })
})
