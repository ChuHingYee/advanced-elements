import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import ProgressCell from '../../../src/components/cell-renderers/progress-cell.vue'

const ElProgressStub = defineComponent({
  name: 'ElProgress',
  props: {
    percentage: { type: Number, default: 0 },
    strokeWidth: { type: Number, default: 6 },
  },
  template: '<div>{{ percentage }}</div>',
})

describe('cell-renderers/progress-cell', () => {
  /**
   * <zh/> 按生产契约传参：value-renderer 把 cellData 同时映射到 value（见 value-renderer.ts）
   * <en/> Pass params per the production contract: value-renderer maps cellData onto value (see value-renderer.ts)
   */
  function renderedPercentage(value: unknown) {
    const wrapper = mount(ProgressCell, {
      props: { value, cellData: value },
      global: { stubs: { ElProgress: ElProgressStub } },
    })
    const result = wrapper.findComponent({ name: 'ElProgress' }).props('percentage')
    wrapper.unmount()
    return result
  }

  it('should render progress with valid percentage', () => {
    expect(renderedPercentage(50)).toBe(50)
  })

  it('should clamp percentage to 0-100 range', () => {
    expect(renderedPercentage(150)).toBe(100)
  })

  it('should clamp negative percentage to 0', () => {
    expect(renderedPercentage(-10)).toBe(0)
  })

  it('should handle string percentage', () => {
    expect(renderedPercentage('75')).toBe(75)
  })

  it('should default to 0 for invalid value', () => {
    expect(renderedPercentage('invalid')).toBe(0)
  })
})
