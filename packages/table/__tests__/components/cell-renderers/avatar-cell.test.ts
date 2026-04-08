import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import AvatarCell from '../../../src/components/cell-renderers/avatar-cell.vue'

const ElAvatarStub = defineComponent({
  name: 'ElAvatar',
  props: {
    size: { type: String, default: 'small' },
    src: { type: String, default: '' },
  },
  template: '<img v-if="src" :src="src" /><span v-else />',
})

describe('cell-renderers/avatar-cell', () => {
  /**
   * <zh/> 按生产契约传参：value-renderer 把 cellData 映射到 src（见 value-renderer.ts）
   * <en/> Pass params per the production contract: value-renderer maps cellData onto src (see value-renderer.ts)
   */
  function mountAvatar(src: unknown) {
    return mount(AvatarCell, {
      props: { src, cellData: src },
      global: { stubs: { ElAvatar: ElAvatarStub } },
    })
  }

  it('should render avatar with src', () => {
    const wrapper = mountAvatar('https://example.com/avatar.jpg')
    // <zh/> src 必须透传到 img，否则头像裂图
    // <en/> src must reach the img, otherwise a broken image renders
    expect(wrapper.find('img[src="https://example.com/avatar.jpg"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('should render empty span when cellData is null', () => {
    const wrapper = mountAvatar(null)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('span').exists()).toBe(true)
    wrapper.unmount()
  })

  it('should render empty span when cellData is empty string', () => {
    const wrapper = mountAvatar('')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('span').exists()).toBe(true)
    wrapper.unmount()
  })
})
