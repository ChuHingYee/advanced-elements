import type { TableError } from '../../src/types/error'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useRenderErrorBoundary } from '../../src/composables/rendering/use-render-error-boundary'

const ThrowOnRender = defineComponent({
  setup() {
    throw new Error('boom-render')
  },
  render: () => h('div'),
})

const StringThrow = defineComponent({
  setup() {
    // <zh/> 有意抛出字符串——覆盖边界对非 Error 抛出值的兼容路径
    // <en/> Intentionally throws a string — covers the boundary's non-Error throw-value path
    // eslint-disable-next-line no-throw-literal
    throw 'string-error'
  },
  render: () => h('div'),
})

function mountWith(opts: Parameters<typeof useRenderErrorBoundary>[0], child: any = ThrowOnRender) {
  const onError = vi.fn()
  const wrapper = mount(
    defineComponent({
      setup() {
        const api = useRenderErrorBoundary({ ...opts, onError })
        return { ...api }
      },
      render() {
        return h(child)
      },
    }),
  )
  return { wrapper, onError }
}

describe('use-render-error-boundary', () => {
  it('默认启用时捕获后代渲染抛错并翻转 hasError', async () => {
    const { wrapper, onError } = mountWith({})
    await nextTick()
    expect(wrapper.vm.hasError).toBe(true)
    expect(wrapper.vm.errorInfo).not.toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('结构化错误包含 TABLE_RENDER_ERROR 与 cause', async () => {
    const { onError } = mountWith({})
    await nextTick()
    const payload = onError.mock.calls[0][0] as TableError
    expect(payload.code).toBe('TABLE_RENDER_ERROR')
    expect(payload.cause).toBeInstanceOf(Error)
    // suggestion is delegated to TABLE_ERROR_CODES (single source of truth), not populated inline
    expect(typeof payload.field).toBe('string')
  })

  it('非 Error 实例的抛出会被包装为 Error', async () => {
    const { onError } = mountWith({}, StringThrow)
    await nextTick()
    const payload = onError.mock.calls[0][0] as TableError
    expect(payload.cause).toBeInstanceOf(Error)
    expect((payload.cause as Error).message).toBe('string-error')
  })

  it('enabled=false 时错误继续向上冒泡', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => mountWith({ enabled: false })).toThrow()
    await nextTick()
    spy.mockRestore()
  })

  it('reset 可清除错误态', async () => {
    const { wrapper } = mountWith({ render: undefined } as any)
    await nextTick()
    expect(wrapper.vm.hasError).toBe(true)
    wrapper.vm.reset()
    expect(wrapper.vm.hasError).toBe(false)
    expect(wrapper.vm.errorInfo).toBeNull()
  })
})
