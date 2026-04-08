/**
 * <zh/> 表格 `#error` 兜底插槽契约测试——渲染抛错后插槽收到 `{ error, reset }`，调用 reset 恢复渲染。
 * <en/> Table `#error` fallback slot contract test — after a render throw the slot receives `{ error, reset }`; calling reset resumes rendering.
 */
import type { VueWrapper } from '@vue/test-utils'
import type { AdvColumn } from '../../src/types'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import AdvTable from '../../src/AdvTable.vue'

// Pre-load async renderer modules so defineAsyncComponent resolves immediately
import ('../../src/components/table-renderer/TableRenderer.vue')
import('../../src/components/table-virtual-renderer/TableVirtualRenderer.vue')

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('table error slot contract', () => {
  it('#error 收到 error 与可恢复渲染的 reset', { timeout: 30000 }, async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const emittedErrors: unknown[] = []
    let shouldThrow = true
    const seen: Array<{ error: unknown, reset: unknown }> = []
    const columns = ref([
      { prop: 'name', label: '姓名', hidden: false },
    ] as AdvColumn[] as any)
    const data = [{ id: '1', name: 'Alice' }]
    wrapper = mount(() => (
      <AdvTable columns={columns.value} data={data} rowConfig={{ rowKey: 'id' }} onError={(e: unknown) => emittedErrors.push(e)}>
        {{
          // <zh/> 表头插槽抛错直达表级错误边界（单元格抛错会被单格兜底就地消化，见 render-error-fallback）
          // <en/> A header-slot throw reaches the table-level boundary (cell throws are digested locally, see render-error-fallback)
          'header-left': () => {
            if (shouldThrow)
              throw new Error('boom-header')
            return 'header-ok'
          },
          'error': (props: any) => {
            seen.push(props)
            return <div class="test-error-fallback">fallback</div>
          },
        }}
      </AdvTable>
    ), {
      global: {
        config: {
          globalProperties: { $router: { query: {} } },
        } as any,
      },
    })
    // <zh/> 等待异步渲染器 chunk 与错误边界翻转 | <en/> Wait for the async renderer chunk and the boundary flip
    const deadline = Date.now() + 12_000
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25))
      await nextTick()
      if (wrapper.find('.adv-table__error-boundary').exists())
        break
    }
    expect(wrapper.find('.adv-table__error-boundary').exists()).toBe(true)
    expect(seen.length).toBeGreaterThan(0)
    const first = seen[0] as { error: any, reset: any }
    expect(first.error?.code).toBe('TABLE_RENDER_ERROR')
    expect(typeof first.reset).toBe('function')
    // <zh/> 3：首错胜出——沉降后 error 事件只派发一次
    // <en/> 3: first error wins — after settling the error event fires exactly once (previously rethrows outside the fallback looped captures)
    await new Promise(resolve => setTimeout(resolve, 300))
    await nextTick()
    expect(emittedErrors).toHaveLength(1)

    // <zh/> 恢复渲染源后调用 reset，兜底消失、表头重现 | <en/> Fix the source, call reset: fallback gone, header back
    shouldThrow = false
    await first.reset()
    await nextTick()
    await nextTick()
    expect(wrapper.find('.adv-table__error-boundary').exists()).toBe(false)
    expect(wrapper.text()).toContain('header-ok')
    errorSpy.mockRestore()
  })
})
