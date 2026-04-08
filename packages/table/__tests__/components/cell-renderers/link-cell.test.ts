import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import LinkCell from '../../../src/components/cell-renderers/link-cell.vue'

const ElLinkStub = defineComponent({
  name: 'ElLink',
  props: {
    href: { type: String, default: '' },
    target: { type: String, default: '_blank' },
    type: { type: String, default: 'primary' },
  },
  template: '<a :href="href" :target="target"><slot /></a>',
})

describe('cell-renderers/link-cell', () => {
  function mountLink(cellData: unknown) {
    return mount(LinkCell, {
      props: { cellData },
      global: { stubs: { ElLink: ElLinkStub } },
    })
  }

  it('should render link with href', () => {
    const wrapper = mountLink('https://example.com')
    // <zh/> href 必须透传到 a 标签，否则链接不可点
    // <en/> href must reach the anchor, otherwise the link is dead
    expect(wrapper.find('a[href="https://example.com"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('should render empty span when cellData is null', () => {
    const wrapper = mountLink(null)
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('span').exists()).toBe(true)
    wrapper.unmount()
  })

  it('should render empty span when cellData is empty string', () => {
    const wrapper = mountLink('')
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('span').exists()).toBe(true)
    wrapper.unmount()
  })
})
