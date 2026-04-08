import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
/**
 * @advanced-elements/config-provider — 入口测试
 *
 * 测试默认导出的 plugin 结构及具名导出
 */
import { createApp, defineComponent, h } from 'vue'
import AdvConfigProvider from '../src/config-provider.vue'
import plugin, { advConfigKey, provideAdvConfig, useAdvConfig } from '../src/index'

describe('config-provider 入口', () => {
  it('默认导出带有 .install 方法', () => {
    expect(plugin).toBeDefined()
    expect(typeof plugin.install).toBe('function')
  })

  it('.install 调用 app.component 注册 AdvConfigProvider', () => {
    const app = createApp({ render: () => null })
    const componentSpy = vi.spyOn(app, 'component')

    app.use(plugin)

    expect(componentSpy).toHaveBeenCalledWith('AdvConfigProvider', expect.any(Object))
  })

  it('具名导出包括 advConfigKey / provideAdvConfig / useAdvConfig', () => {
    expect(advConfigKey).toBeDefined()
    expect(typeof provideAdvConfig).toBe('function')
    expect(typeof useAdvConfig).toBe('function')
  })

  it('.install 传入 config 时应用级可 inject，后代 Provider 可覆盖', () => {
    const Child = defineComponent({
      setup() {
        const config = useAdvConfig()
        return () => h('div', { class: 'app-page-size' }, String(config.value.table?.pagination?.pageSize ?? ''))
      },
    })
    const wrapper = mount(Child, {
      global: {
        plugins: [[plugin, { config: { table: { pagination: { pageSize: 42 } } } }]],
      },
    })
    expect(wrapper.find('.app-page-size').text()).toBe('42')
  })

  it('.install 传入 config 时后代 Provider 合并覆盖应用级配置', () => {
    const Child = defineComponent({
      setup() {
        const config = useAdvConfig()
        return () => h('div', { class: 'nested-page-size' }, String(config.value.table?.pagination?.pageSize ?? ''))
      },
    })
    const wrapper = mount(AdvConfigProvider, {
      props: { config: { table: { pagination: { pageSize: 20 } } } },
      slots: { default: () => h(Child) },
      global: {
        plugins: [[plugin, { config: { table: { pagination: { pageSize: 42 } } } }]],
      },
    })
    expect(wrapper.find('.nested-page-size').text()).toBe('20')
  })
})
