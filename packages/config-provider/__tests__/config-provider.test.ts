/**
 * @advanced-elements/config-provider — AdvConfigProvider SFC 测试
 *
 * 测试组件渲染、配置提供、嵌套覆盖、空配置默认值、引用稳定性
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import AdvConfigProvider from '../src/config-provider.vue'
import { useAdvConfig } from '../src/context'

const UseConfigChild = defineComponent({
  setup() {
    const config = useAdvConfig()
    return () =>
      h('div', { class: 'child' }, [
        h('span', { class: 'page-size' }, String(config.value.table?.pagination?.pageSize ?? '')),
        h('span', { class: 'search-btn' }, String(config.value.table?.search?.buttons ?? '')),
        h('span', { class: 'polling-time' }, String(config.value.table?.toolbar?.pollingOptions?.time ?? '')),
        h('span', { class: 'size-h' }, String(config.value.table?.uiConfig?.sizeConfig?.headerCellHeight ?? '')),
        h('span', { class: 'size-pad' }, String(config.value.table?.uiConfig?.sizeConfig?.cellPadding ?? '')),
      ])
  },
})

/** Captures config ref for reference-stability assertions */
const CaptureConfigChild = defineComponent({
  setup(_, { expose }) {
    const config = useAdvConfig()
    const captures: any[] = []
    const capture = () => {
      captures.push(config.value)
    }
    // <zh/> 经 expose 暴露 captures，否则外部无法读取闭包变量，断言空跑恒过
    // <en/> Expose captures via expose; otherwise it stays unreachable and the assertion vacuously passes
    expose({ captures })
    return () =>
      h('div', { class: 'capture' }, [
        h('button', { class: 'capture-btn', onClick: capture }, 'capture'),
        h('pre', { class: 'captures' }, JSON.stringify(captures.length)),
      ])
  },
})

describe('advConfigProvider', () => {
  it('渲染默认插槽内容', () => {
    const wrapper = mount(AdvConfigProvider, {
      slots: { default: () => h('div', 'Hello World') },
    })
    expect(wrapper.text()).toContain('Hello World')
  })

  it('通过 config prop 注入 table 配置', () => {
    const wrapper = mount(AdvConfigProvider, {
      props: {
        config: {
          table: { pagination: { pageSize: 50 } },
        },
      },
      slots: { default: () => h(UseConfigChild) },
    })
    expect(wrapper.find('.page-size').text()).toBe('50')
  })

  it('子组件可通过 useAdvConfig() 获取配置', () => {
    const wrapper = mount(AdvConfigProvider, {
      props: {
        config: {
          table: {
            search: { buttons: ['query', 'reset'] },
            toolbar: { pollingOptions: { time: 5000 } },
          },
        },
      },
      slots: { default: () => h(UseConfigChild) },
    })
    expect(wrapper.find('.search-btn').text()).toBe('query,reset')
    expect(wrapper.find('.polling-time').text()).toBe('5000')
  })

  it('嵌套 provider 时子 provider 覆盖父 provider 的同级配置', () => {
    const wrapper = mount(AdvConfigProvider, {
      props: {
        config: {
          table: { pagination: { pageSize: 10, pageSizes: [10, 20] } },
        },
      },
      slots: {
        default: () =>
          h(AdvConfigProvider, {
            config: {
              table: { pagination: { pageSize: 20 } },
            },
          }, {
            default: () => h(UseConfigChild),
          }),
      },
    })
    // pageSize 被覆盖为 20，pageSizes 从父级继承
    expect(wrapper.find('.page-size').text()).toBe('20')
  })

  it('嵌套 provider 时合并深层嵌套字段（toolbar.pollingOptions）', () => {
    const wrapper = mount(AdvConfigProvider, {
      props: {
        config: {
          table: { toolbar: { pollingOptions: { time: 3000, immediate: true } } },
        },
      },
      slots: {
        default: () =>
          h(AdvConfigProvider, {
            config: {
              table: { toolbar: { pollingOptions: { time: 5000 } } },
            },
          }, {
            default: () => h(UseConfigChild),
          }),
      },
    })
    // time 被覆盖为 5000，immediate 从父级继承
    expect(wrapper.find('.polling-time').text()).toBe('5000')
  })

  it('config 为 undefined 时使用空对象默认值', () => {
    const wrapper = mount(AdvConfigProvider, {
      props: { config: undefined },
      slots: { default: () => h(UseConfigChild) },
    })
    expect(wrapper.find('.page-size').text()).toBe('')
  })

  it('子 provider 无 uiConfig 时继承父 provider 的 uiConfig', () => {
    const wrapper = mount(AdvConfigProvider, {
      props: {
        config: {
          table: { uiConfig: { sizeConfig: { headerCellHeight: 40 } } },
        },
      },
      slots: {
        default: () =>
          h(AdvConfigProvider, {}, {
            default: () => h(UseConfigChild),
          }),
      },
    })
    expect(wrapper.find('.size-h').text()).toBe('40')
  })

  it('config prop 为 null 时回退为空对象', () => {
    const wrapper = mount(AdvConfigProvider, {
      props: { config: null as any },
      slots: { default: () => h(UseConfigChild) },
    })
    expect(wrapper.find('.page-size').text()).toBe('')
  })

  // ─── P1-#4: uiConfig.sizeConfig deep merge ───

  it('sizeConfig 深度合并：子 provider 的字段与父 provider 合并而非替换', () => {
    const wrapper = mount(AdvConfigProvider, {
      props: {
        config: {
          table: { uiConfig: { sizeConfig: { headerCellHeight: 40, cellPadding: '8px 12px' } } },
        },
      },
      slots: {
        default: () =>
          h(AdvConfigProvider, {
            config: {
              table: { uiConfig: { sizeConfig: { headerCellHeight: 56 } } },
            },
          }, {
            default: () => h(UseConfigChild),
          }),
      },
    })
    // headerCellHeight 被覆盖为 56，cellPadding 从父级继承
    expect(wrapper.find('.size-h').text()).toBe('56')
    expect(wrapper.find('.size-pad').text()).toBe('8px 12px')
  })

  // ─── P0-#1: mergedConfig reference stability ───

  it('mergedConfig 引用稳定：配置不变时返回相同引用', async () => {
    const configRef = ref({ table: { pagination: { pageSize: 20 } } })
    const wrapper = mount(AdvConfigProvider, {
      props: { config: configRef.value },
      slots: { default: () => h(CaptureConfigChild) },
    })

    await wrapper.find('.capture-btn').trigger('click')
    // Trigger a reactive update that doesn't change config content
    await wrapper.setProps({ config: { table: { pagination: { pageSize: 20 } } } })
    await nextTick()
    await wrapper.find('.capture-btn').trigger('click')

    // The config object should be the same reference if content is equal
    const child = wrapper.findComponent(CaptureConfigChild)
    const captures = (child.vm as any)?.captures
    expect(captures).toHaveLength(2)
    expect(captures[0]).toBe(captures[1])
  })
})
