import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { useTableRendererRefs } from '../../src/composables/core/use-table-renderer-refs'

/**
 * <zh/> 渲染器引用单测——覆盖异步组件定义、槽位绑定与活跃渲染器派生。
 * <en/> Renderer-refs tests — async component definitions, slot binding and active derivation.
 */
function setupHarness(mode: 'default' | 'virtual' = 'default') {
  const onLoadError = vi.fn()
  const modeRef = computed(() => mode)
  let api!: ReturnType<typeof useTableRendererRefs>
  const wrapper = mount(defineComponent({
    setup() {
      api = useTableRendererRefs(modeRef as any, () => 'el', onLoadError)
      return () => h('div')
    },
  }))
  return { api, wrapper, onLoadError }
}

describe('useTableRendererRefs', () => {
  it('defines both async renderer components', () => {
    const { api, wrapper } = setupHarness()
    expect(api.TableRenderer).toBeDefined()
    expect(api.TableVirtualRenderer).toBeDefined()
    expect(api.paginationRef.value).toBeUndefined()
    wrapper.unmount()
  })

  it('starts with empty renderer refs', () => {
    const { api, wrapper } = setupHarness()
    expect(api.tableRendererRef.value).toBeNull()
    expect(api.tableVirtualRendererRef.value).toBeNull()
    wrapper.unmount()
  })

  it('derives activeRenderer from the default slot in default mode', () => {
    const { api, wrapper } = setupHarness('default')
    const expose = { getRenderedRowKeys: () => ['1'] }
    api.tableRendererRef.value = expose as any
    api.tableVirtualRendererRef.value = { getRenderedRowKeys: () => ['2'] } as any
    expect((api.activeRenderer.value as any)?.getRenderedRowKeys()).toEqual(['1'])
    wrapper.unmount()
  })

  it('derives activeRenderer from the virtual slot in virtual mode', () => {
    const { api, wrapper } = setupHarness('virtual')
    api.tableRendererRef.value = { getRenderedRowKeys: () => ['1'] } as any
    const expose = { getRenderedRowKeys: () => ['2'] }
    api.tableVirtualRendererRef.value = expose as any
    expect((api.activeRenderer.value as any)?.getRenderedRowKeys()).toEqual(['2'])
    wrapper.unmount()
  })

  it('exposes the renderer adapter', () => {
    const { api, wrapper } = setupHarness()
    expect(api.rendererAdapter).toBeDefined()
    wrapper.unmount()
  })

  it('reacts to namespace changes', () => {
    const ns = ref<string | undefined>('el')
    let api!: ReturnType<typeof useTableRendererRefs>
    const wrapper = mount(defineComponent({
      setup() {
        api = useTableRendererRefs(computed(() => 'default' as const) as any, ns, undefined)
        return () => h('div')
      },
    }))
    ns.value = 'ep'
    expect(api.rendererAdapter).toBeDefined()
    wrapper.unmount()
  })
})
