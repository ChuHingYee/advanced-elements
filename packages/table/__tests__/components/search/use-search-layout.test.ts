import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useSearchLayout } from '../../../src/components/search/use-search-layout'

/**
 * <zh/> 搜索布局单测——覆盖可见性判定、宽度影子计算、自动展开/折叠与字段维护。
 * <en/> Search-layout tests — visibility gates, width shadow calc, auto expand/collapse and field upkeep.
 */
function field(prop: string, overrides: Record<string, any> = {}): any {
  return { prop, type: 'input', ...overrides }
}

function setupHarness(opts: {
  fields?: any[]
  itemGap?: number
  disableResize?: boolean
  debounceTime?: number
  expanded?: boolean
  userExpanded?: boolean
  customHiddenMap?: Record<string, boolean>
  formItemRefs?: Record<string, any>
  btn?: any
} = {}) {
  const expanded = ref(opts.expanded ?? false)
  const userExpanded = ref(opts.userExpanded ?? false)
  const customHiddenMap = ref(opts.customHiddenMap ?? {})
  const onExpandChange = vi.fn()
  const fieldsArr = opts.fields ?? [field('a'), field('b')]
  const refsMap = opts.formItemRefs ?? Object.fromEntries(fieldsArr.map(f => [f.prop, { el: null, width: 0 }]))
  let api!: ReturnType<typeof useSearchLayout>
  const wrapper = mount(defineComponent({
    setup() {
      api = useSearchLayout({
        fields: () => fieldsArr,
        itemGap: () => opts.itemGap ?? 8,
        disableResize: () => opts.disableResize ?? false,
        debounceTime: () => opts.debounceTime ?? 5,
        expanded,
        userExpanded,
        customHiddenMap,
        formItemRefs: refsMap,
        formEl: () => undefined,
        btnRef: ref(opts.btn ?? null),
        onExpandChange,
      })
      return () => h('div')
    },
  }))
  return { api, wrapper, expanded, userExpanded, customHiddenMap, onExpandChange }
}

describe('useSearchLayout visibility gates', () => {
  it('hides everything before init', () => {
    const t = setupHarness()
    expect(t.api.isVisible('a')).toBe(false)
    expect(t.api.getVisibilityClass('a')).toBe('')
    expect(t.api.getVisibilityStyle('a', 3)).toEqual({ zIndex: -1 })
    t.wrapper.unmount()
  })

  it('marks all visible when resize is disabled', () => {
    const t = setupHarness({ disableResize: true })
    t.api.calculateVisibility('init')
    expect(t.api.initialized.value).toBe(true)
    expect(t.api.isVisible('a')).toBe(true)
    expect(t.api.getVisibilityClass('a')).toContain('visible')
    expect(t.api.getVisibilityStyle('a', 3)).toEqual({ zIndex: 3 })
    t.wrapper.unmount()
  })

  it('respects custom hidden map', () => {
    const t = setupHarness({ disableResize: true, customHiddenMap: { a: true } })
    t.api.calculateVisibility('init')
    expect(t.api.isVisible('a')).toBe(false)
    expect(t.api.isVisible('b')).toBe(true)
    t.wrapper.unmount()
  })

  it('shows all when expanded', () => {
    const t = setupHarness({ disableResize: true, expanded: true })
    t.api.calculateVisibility('init')
    expect(t.api.isVisible('a')).toBe(true)
    expect(t.api.isVisible('b')).toBe(true)
    t.wrapper.unmount()
  })
})

describe('useSearchLayout width shadow', () => {
  it('keeps all visible when width fits', () => {
    const t = setupHarness()
    t.api.setFormItemWidth('a', 100)
    t.api.setFormItemWidth('b', 100)
    t.api.width.value = 500
    t.api.calculateVisibility('init')
    expect(t.api.systemHiddenMap.value).toEqual({ a: false, b: false })
    expect(t.api.isVisible('a')).toBe(true)
    t.wrapper.unmount()
  })

  it('hides overflow items when narrow', () => {
    const t = setupHarness()
    t.api.setFormItemWidth('a', 100)
    t.api.setFormItemWidth('b', 100)
    t.api.width.value = 150
    t.api.calculateVisibility('init')
    expect(t.api.systemHiddenMap.value.b).toBe(true)
    expect(t.api.isVisible('b')).toBe(false)
    t.wrapper.unmount()
  })

  it('auto-expands on data change when a visible item becomes hidden', () => {
    const t = setupHarness()
    t.api.setFormItemWidth('a', 100)
    t.api.setFormItemWidth('b', 100)
    t.api.width.value = 500
    t.api.calculateVisibility('init')
    expect(t.api.lastVisibleProps.value.has('a')).toBe(true)
    t.api.width.value = 150
    t.api.calculateVisibility('data')
    expect(t.expanded.value).toBe(true)
    expect(t.onExpandChange).toHaveBeenCalledWith(true)
    expect(t.userExpanded.value).toBe(false)
    t.wrapper.unmount()
  })

  it('auto-collapses on resize when programmatically expanded', () => {
    const t = setupHarness({ expanded: true })
    t.api.setFormItemWidth('a', 100)
    t.api.setFormItemWidth('b', 100)
    t.api.width.value = 150
    t.api.calculateVisibility('resize')
    expect(t.expanded.value).toBe(false)
    expect(t.onExpandChange).toHaveBeenCalledWith(false)
    t.wrapper.unmount()
  })

  it('keeps user-expanded state on resize', () => {
    const t = setupHarness({ expanded: true, userExpanded: true })
    t.api.setFormItemWidth('a', 100)
    t.api.setFormItemWidth('b', 100)
    t.api.width.value = 150
    t.api.calculateVisibility('resize')
    expect(t.expanded.value).toBe(true)
    t.wrapper.unmount()
  })

  it('remeasures dynamic-width items', () => {
    const div = document.createElement('div')
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect)
    const t = setupHarness({
      fields: [field('c', { dynamicWidth: true })],
      formItemRefs: { c: { el: { $el: div }, width: 0 } },
    })
    t.api.setFormItemWidth('c', 10)
    t.api.width.value = 500
    t.api.calculateVisibility('init')
    // <zh/> 动态宽度被重新量测为 120（500 宽度下单项必然可见） | <en/> dynamic width remeasured to 120
    expect(t.api.formItemWidths.value.c).toBe(120)
    expect(t.api.systemHiddenMap.value.c).toBe(false)
    t.wrapper.unmount()
  })
})

describe('useSearchLayout upkeep', () => {
  it('captures visible snapshot excluding hidden/custom/system-hidden', () => {
    const t = setupHarness({
      fields: [field('a'), field('b', { hidden: true }), field('c')],
      customHiddenMap: { c: true },
      disableResize: true,
    })
    t.api.calculateVisibility('init')
    t.api.captureVisibleSnapshot()
    expect([...t.api.lastVisibleProps.value]).toEqual(['a'])
    t.wrapper.unmount()
  })

  it('removes field state and resets caches', () => {
    const t = setupHarness()
    t.api.setFormItemWidth('a', 100)
    t.api.calculateVisibility('init')
    t.api.removeField('a')
    expect(t.api.formItemWidths.value.a).toBeUndefined()
    expect(t.api.systemHiddenMap.value.a).toBeUndefined()
    t.api.resetExpandBtnWidthCache()
    t.api.triggerLayoutRecalc()
    t.wrapper.unmount()
  })
})
