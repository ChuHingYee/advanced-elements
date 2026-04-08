/**
 * @advanced-elements/config-provider — context 测试
 *
 * 测试 provideAdvConfig / useAdvConfig 提供-注入连线功能
 */
import type { ComponentOptions } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { advConfigKey, provideAdvConfig, useAdvConfig } from '../src/context'

// 测试辅助组件：内部使用 useAdvConfig 显示 table 的 pageSize
const ChildComponent = defineComponent({
  setup() {
    const config = useAdvConfig()
    return () => h('div', { class: 'child' }, String(config.value.table?.pagination?.pageSize ?? ''))
  },
})

function withProvide(config: Record<string, any>): ComponentOptions {
  return defineComponent({
    setup() {
      provideAdvConfig(ref(config))
      return () => h(ChildComponent)
    },
  })
}

describe('context', () => {
  it('提供-注入连线：provideAdvConfig + useAdvConfig', () => {
    const wrapper = mount(withProvide({ table: { pagination: { pageSize: 20 } } }))
    expect(wrapper.find('.child').text()).toBe('20')
  })

  it('未提供配置时 useAdvConfig 返回空对象默认值', () => {
    mount(
      defineComponent({
        setup() {
          const config = useAdvConfig()
          expect(config.value).toEqual({})
          return () => h('div')
        },
      }),
    )
  })

  it('advConfigKey 是有效的 Symbol InjectionKey', () => {
    expect(typeof advConfigKey).toBe('symbol')
  })

  it('useAdvConfig 默认值引用稳定：多次调用返回同一 ref', () => {
    const refs: any[] = []
    mount(
      defineComponent({
        setup() {
          refs.push(useAdvConfig())
          refs.push(useAdvConfig())
          return () => h('div')
        },
      }),
    )
    // 两次调用返回同一个 EMPTY_CONFIG ref
    expect(refs[0]).toBe(refs[1])
  })

  it('useAdvConfig 默认值已冻结：经共享引用写入不会污染', () => {
    mount(
      defineComponent({
        setup() {
          const config = useAdvConfig()
          expect(Object.isFrozen(config.value)).toBe(true)
          return () => h('div')
        },
      }),
    )
  })
})
