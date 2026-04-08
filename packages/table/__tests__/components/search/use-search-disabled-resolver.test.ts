import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useSearchDisabledResolver } from '../../../src/components/search/use-search-disabled-resolver'

/**
 * <zh/> 搜索 disabled 解析单测——覆盖同步/异步解析、版本防过期、异常降级与卸载守卫。
 * <en/> Search disabled-resolver tests — sync/async resolve, version staleness, error fallback and unmount guard.
 */
function field(prop: string, disabledFunc?: any): any {
  return { prop, type: 'input', disabledFunc }
}

describe('useSearchDisabledResolver', () => {
  it('writes false for fields without disabledFunc', () => {
    let api!: ReturnType<typeof useSearchDisabledResolver>
    mount(defineComponent({
      setup() {
        api = useSearchDisabledResolver({ fields: () => [field('a')] })
        return () => h('div')
      },
    })).unmount()
    // <zh/> 卸载后同步写入仍可断言（同步路径不受卸载标志影响） | <en/> sync write assertable after unmount (sync path unaffected by the flag)
    api.syncDisabledStates({})
    expect(api.resolvedDisabledMap.value).toEqual({ a: false })
  })

  it('resolves sync boolean results', () => {
    let api!: ReturnType<typeof useSearchDisabledResolver>
    const wrapper = mount(defineComponent({
      setup() {
        api = useSearchDisabledResolver({ fields: () => [field('a', () => true)] })
        return () => h('div')
      },
    }))
    api.syncDisabledStates({})
    expect(api.resolvedDisabledMap.value).toEqual({ a: true })
    wrapper.unmount()
  })

  it('resolves async results', async () => {
    let api!: ReturnType<typeof useSearchDisabledResolver>
    const wrapper = mount(defineComponent({
      setup() {
        api = useSearchDisabledResolver({ fields: () => [field('a', async () => true)] })
        return () => h('div')
      },
    }))
    api.syncDisabledStates({})
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 0))
    expect(api.resolvedDisabledMap.value).toEqual({ a: true })
    wrapper.unmount()
  })

  it('drops stale async results by version', async () => {
    let api!: ReturnType<typeof useSearchDisabledResolver>
    let release!: (v: boolean) => void
    const gate = new Promise<boolean>((resolve) => {
      release = resolve
    })
    let current: any[] = [field('a', () => gate)]
    const wrapper = mount(defineComponent({
      setup() {
        api = useSearchDisabledResolver({ fields: () => current })
        return () => h('div')
      },
    }))
    api.syncDisabledStates({})
    // <zh/> 第二次同步改用同步解析并立即写入，同时使第一次的异步请求过期 | <en/> second sync switches to sync resolve, expiring the first async request
    current = [field('a', () => false)]
    api.syncDisabledStates({})
    expect(api.resolvedDisabledMap.value).toEqual({ a: false })
    release!(true)
    await gate
    await new Promise(r => setTimeout(r, 0))
    // <zh/> 过期回调不得覆盖新值 | <en/> stale callback must not overwrite the fresh value
    expect(api.resolvedDisabledMap.value).toEqual({ a: false })
    wrapper.unmount()
  })

  it('falls back to false and warns when disabledFunc throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let api!: ReturnType<typeof useSearchDisabledResolver>
    const wrapper = mount(defineComponent({
      setup() {
        api = useSearchDisabledResolver({ fields: () => [field('a', () => {
          throw new Error('nope')
        })] })
        return () => h('div')
      },
    }))
    api.syncDisabledStates({})
    expect(api.resolvedDisabledMap.value).toEqual({ a: false })
    expect(warn).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('removes field state', () => {
    let api!: ReturnType<typeof useSearchDisabledResolver>
    const wrapper = mount(defineComponent({
      setup() {
        api = useSearchDisabledResolver({ fields: () => [field('a')] })
        return () => h('div')
      },
    }))
    api.syncDisabledStates({})
    expect(api.resolvedDisabledMap.value).toEqual({ a: false })
    api.removeField('a')
    expect(api.resolvedDisabledMap.value).toEqual({})
    wrapper.unmount()
  })

  it('ignores async writes after unmount', async () => {
    let api!: ReturnType<typeof useSearchDisabledResolver>
    let release!: (v: boolean) => void
    const gate = new Promise<boolean>((resolve) => {
      release = resolve
    })
    const wrapper = mount(defineComponent({
      setup() {
        api = useSearchDisabledResolver({ fields: () => [field('a', () => gate)] })
        return () => h('div')
      },
    }))
    api.syncDisabledStates({})
    wrapper.unmount()
    release!(true)
    await gate
    await new Promise(r => setTimeout(r, 0))
    expect(api.resolvedDisabledMap.value).toEqual({})
  })
})
