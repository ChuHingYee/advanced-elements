import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import ImageCell from '../../../src/components/cell-renderers/image-cell.vue'

const ElImageStub = defineComponent({
  name: 'ElImage',
  props: {
    src: { type: String, default: '' },
    previewSrcList: { type: Array, default: () => [] },
    style: { type: Object, default: () => ({}) },
  },
  template: '<img :src="src" />',
})

describe('cell-renderers/image-cell', () => {
  /**
   * <zh/> 按生产契约传参：value-renderer 把 cellData 映射到 src
   * <en/> Pass params per the production contract: value-renderer maps cellData onto src
   */
  function mountImage(src: unknown) {
    return mount(ImageCell, {
      props: { src, cellData: src },
      global: { stubs: { ElImage: ElImageStub } },
    })
  }

  it('should render image with src', () => {
    const wrapper = mountImage('https://example.com/image.jpg')
    // <zh/> src 透传且预览列表由 src 派生，否则点击预览无图
    // <en/> src passes through and the preview list derives from it, otherwise click-preview shows nothing
    expect(wrapper.find('img[src="https://example.com/image.jpg"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ElImage' }).props('previewSrcList')).toEqual([
      'https://example.com/image.jpg',
    ])
    wrapper.unmount()
  })

  it('should render empty span when cellData is null', () => {
    const wrapper = mountImage(null)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('span').exists()).toBe(true)
    wrapper.unmount()
  })

  it('should render empty span when cellData is empty string', () => {
    const wrapper = mountImage('')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('span').exists()).toBe(true)
    wrapper.unmount()
  })

  it('should set preview src list', () => {
    const wrapper = mountImage('https://example.com/image.jpg')
    // <zh/> 预览列表恒为单元素数组（空值时为空数组，不传 undefined 进 EP）
    // <en/> Preview list is always an array (empty for empty values, never undefined into EP)
    expect(wrapper.findComponent({ name: 'ElImage' }).props('previewSrcList')).toEqual([
      'https://example.com/image.jpg',
    ])
    wrapper.unmount()
  })
})
