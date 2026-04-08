import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useMergedLeafColumns, useRendererCommon } from '../../src/composables/rendering/use-renderer-common'

/**
 * <zh/> 渲染器公共逻辑单测——覆?hover 层装配、事件工厂与叶子列合并复用? * <en/> Renderer-common tests ?hover assembly, event factories and leaf-column reuse.
 */
function setupCommon() {
  const hasHover = ref(false)
  let api!: ReturnType<typeof useRendererCommon>
  const wrapper = mount(defineComponent({
    setup() {
      api = useRendererCommon({
        hoverOptionColumns: [],
        hasHoverOptionColumns: hasHover,
        hoverOptionTeleport: false,
        displayNormalColumns: [],
        selectionColumnSyncKey: 'sel',
        keepAlive: false,
      })
      return () => h('div')
    },
  }))
  return { api, wrapper, hasHover }
}

describe('useRendererCommon', () => {
  it('exposes initial hover state', () => {
    const { api, wrapper } = setupCommon()
    expect(api.hoverRowKey.value).toBeNull()
    expect(api.hoverLayerVisible.value).toBe(false)
    expect(api.hoverLayerCollapsed.value).toBe(false)
    wrapper.unmount()
  })

  it('toggles layer collapse and enter/leave', () => {
    const { api, wrapper } = setupCommon()
    api.toggleHoverLayerCollapse(new Event('click'))
    expect(api.hoverLayerCollapsed.value).toBe(true)
    api.toggleHoverLayerCollapse(new Event('click'))
    expect(api.hoverLayerCollapsed.value).toBe(false)
    api.handleHoverLayerEnter()
    api.handleHoverLayerLeave()
    api.rediscoverHoverAfterScroll()
    wrapper.unmount()
  })

  it('builds hover event factories without throwing', () => {
    const { api, wrapper } = setupCommon()
    const hoverEvents = api.hoverEvents.createElTableHoverEvents()
    expect(hoverEvents.value).toBeDefined()
    const v2Handlers = api.hoverEvents.createElTableV2RowEventHandlers({} as any)
    expect(typeof v2Handlers.value.onMouseenter).toBe('function')
    expect(typeof v2Handlers.value.onMouseleave).toBe('function')
    v2Handlers.value.onMouseleave()
    wrapper.unmount()
  })

  it('hides the layer when hover columns are disabled', async () => {
    const { api, wrapper, hasHover } = setupCommon()
    hasHover.value = true
    await Promise.resolve()
    hasHover.value = false
    await Promise.resolve()
    expect(api.hoverLayerVisible.value).toBe(false)
    wrapper.unmount()
  })
})

describe('useMergedLeafColumns', () => {
  const sel = [{ key: 's', prop: '__sel' }]
  const normal = [{ key: 'a', prop: 'a' }, { key: 'b', prop: 'b' }]

  it('merges selection-first order', () => {
    const cols = useMergedLeafColumns(sel as any, normal as any)
    expect(cols.value.map(c => c.prop)).toEqual(['__sel', 'a', 'b'])
  })

  it('reuses the previous array when references are unchanged', () => {
    const cols = useMergedLeafColumns(sel as any, normal as any)
    const first = cols.value
    expect(cols.value).toBe(first)
  })

  it('handles empty inputs', () => {
    const cols = useMergedLeafColumns([] as any, [] as any)
    expect(cols.value).toEqual([])
  })

  it('places fixed columns after non-fixed ones', () => {
    const cols = useMergedLeafColumns(sel as any, [
      { key: 'a', prop: 'a', fixed: 'right' },
      { key: 'b', prop: 'b' },
    ] as any)
    expect(cols.value.map(c => c.prop)).toEqual(['__sel', 'b', 'a'])
  })
})
