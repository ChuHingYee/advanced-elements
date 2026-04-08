import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import SwitchCell from '../../../src/components/cell-renderers/switch-cell.vue'

const ElSwitchStub = defineComponent({
  name: 'ElSwitch',
  props: {
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  template: '<input type="checkbox" :checked="modelValue" :disabled="disabled" />',
})

describe('cell-renderers/switch-cell', () => {
  /**
   * <zh/> 按生产契约传参：value-renderer 把 cellData 同时映射到 value
   * <en/> Pass params per the production contract: value-renderer maps cellData onto value
   */
  function switchValue(value: unknown) {
    const wrapper = mount(SwitchCell, {
      props: { value, cellData: value },
      global: { stubs: { ElSwitch: ElSwitchStub } },
    })
    const result = wrapper.findComponent({ name: 'ElSwitch' }).props('modelValue')
    wrapper.unmount()
    return result
  }

  it('should render switch with true value', () => {
    expect(switchValue(true)).toBe(true)
  })

  it('should render switch with false value', () => {
    expect(switchValue(false)).toBe(false)
  })

  it('should convert truthy value to true', () => {
    expect(switchValue(1)).toBe(true)
    expect(switchValue('yes')).toBe(true)
  })

  it('should convert falsy value to false', () => {
    expect(switchValue(0)).toBe(false)
    expect(switchValue(null)).toBe(false)
  })
})
