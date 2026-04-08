import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import {
  COLLAPSED_ARROW_PATH,
  EP_ARROW_PATH,
  EXPANDED_ARROW_PATH,
  extractColumnRenderProps,
  hasCustomRender,
  injectRendererContext,
  NO_TOOLTIP_VALUE_TYPES,
  renderColumnSlot,
  renderDragMarker,
  renderHeaderCell,
  renderHeaderDragMarker,
  renderHeaderSlot,
  renderRowDragMarker,
  renderSortIndicator,
  useRendererLocale,
} from '../../../src/components/renderer-core/render-helpers'
import { advLocaleKey } from '../../../src/types/injection-keys'

/**
 * <zh/> 渲染辅助单测——覆盖 VNode 构建、插槽渲染、排序指示与上下文注入。
 * <en/> Render-helper tests — VNode builders, slot rendering, sort indicator and context inject.
 */
const col: any = { key: 'name', prop: 'name', label: 'Name' }

describe('renderDragMarker family', () => {
  it('builds a span with data attr', () => {
    const vnode = renderDragMarker('cls', 'data-k', 'v1', 'x')
    expect(vnode.type).toBe('span')
    expect((vnode.props as any).class).toBe('cls')
    expect((vnode.props as any)['data-k']).toBe('v1')
  })

  it('builds header marker with aria when sorting', () => {
    const vnode = renderHeaderDragMarker('c1', 'x', 'ascending')
    expect((vnode.props as any)['aria-sort']).toBe('ascending')
    expect((vnode.props as any).role).toBe('columnheader')
  })

  it('builds header marker without aria by default', () => {
    const vnode = renderHeaderDragMarker('c1', 'x')
    expect((vnode.props as any)['aria-sort']).toBeUndefined()
  })

  it('builds row marker from rowKeyFn', () => {
    const vnode = renderRowDragMarker((row: any) => String(row.id), { id: 7 }, 'x')
    expect((vnode.props as any)['data-adv-table-row-key']).toBe('7')
  })
})

describe('useRendererLocale', () => {
  it('prefers the translator from props', () => {
    const t = () => 'hit'
    let out!: ReturnType<typeof useRendererLocale>
    mount(defineComponent({
      setup() {
        out = useRendererLocale(t as any)
        return () => h('div')
      },
    })).unmount()
    expect(out.t()?.('anything')).toBe('hit')
  })

  it('falls back to injected locale', () => {
    let out!: ReturnType<typeof useRendererLocale>
    mount(defineComponent({
      setup() {
        out = useRendererLocale()
        return () => h('div')
      },
    }), { global: { provide: { [advLocaleKey as symbol]: ref({ table: { sortAsc: '升序' } }) } } }).unmount()
    expect(out.t()?.('table.sortAsc')).toBe('升序')
  })

  it('returns undefined without props or injection', () => {
    let out!: ReturnType<typeof useRendererLocale>
    mount(defineComponent({
      setup() {
        out = useRendererLocale()
        return () => h('div')
      },
    })).unmount()
    expect(out.t()).toBeUndefined()
  })
})

describe('renderHeaderCell', () => {
  it('uses headerCellRenderer result', () => {
    const vnode = renderHeaderCell({ ...col, headerCellRenderer: () => h('b', 'H') })
    expect(vnode).toMatchObject({ type: 'b' })
  })

  it('falls back to error vnode when renderer throws', () => {
    const vnode = renderHeaderCell({ ...col, headerCellRenderer: () => {
      throw new Error('bad')
    } })
    expect(vnode).toBeDefined()
  })

  it('falls back to label then prop', () => {
    expect(renderHeaderCell(col)).toBe('Name')
    expect(renderHeaderCell({ key: 'a', prop: 'a' })).toBe('a')
  })
})

describe('renderSortIndicator', () => {
  it('returns null for non-sortable columns', () => {
    expect(renderSortIndicator({ ...col, sortable: false })).toBeNull()
  })

  it('renders active ascending label', () => {
    const vnode = renderSortIndicator({ ...col, sortable: true }, 'ascending')!
    expect((vnode.props as any)['aria-label']).toContain('ascending')
  })

  it('renders index badge and handles click/keydown', () => {
    const onToggleSort = vi.fn()
    const vnode = renderSortIndicator({ ...col, sortable: true }, undefined, onToggleSort, 2, k => k)!
    expect(vnode).toBeDefined()
    const stop = vi.fn()
    const prevent = vi.fn()
    ;(vnode.props as any).onClick({ stopPropagation: stop } as any)
    expect(stop).toHaveBeenCalled()
    expect(onToggleSort).toHaveBeenCalledTimes(1)
    ;(vnode.props as any).onKeydown({ key: 'Enter', preventDefault: prevent, stopPropagation: stop } as any)
    expect(onToggleSort).toHaveBeenCalledTimes(2)
  })

  it('falls back to English labels without translator', () => {
    const vnode = renderSortIndicator({ ...col, sortable: true }, 'descending')!
    expect((vnode.props as any)['aria-label']).toContain('descending')
  })
})

describe('renderColumnSlot family', () => {
  it('renders cell slot and unwraps single vnode', () => {
    const inner = h('i', 'S')
    expect(renderColumnSlot(col, { name: () => [inner] } as any)).toBe(inner)
  })

  it('wraps multiple vnodes in a fragment', () => {
    const out = renderColumnSlot(col, { name: () => [h('i'), h('i')] } as any)!
    expect(out).toBeDefined()
    expect(Array.isArray((out as any).children)).toBe(true)
  })

  it('returns null for missing slot or empty array', () => {
    expect(renderColumnSlot(col, {} as any)).toBeNull()
    expect(renderColumnSlot(col, { name: () => [] } as any)).toBeNull()
  })

  it('returns error fallback when slot throws', () => {
    const out = renderColumnSlot(col, { name: () => {
      throw new Error('slot')
    } } as any)
    expect(out).toBeDefined()
  })

  it('renders header slot by suffix', () => {
    const inner = h('b', 'H')
    expect(renderHeaderSlot(col, { 'name-header': () => [inner] } as any)).toBe(inner)
    expect(renderHeaderSlot(col, {} as any)).toBeNull()
  })
})

describe('column render metadata', () => {
  it('detects custom render', () => {
    expect(hasCustomRender({ ...col, cellRenderer: () => null } as any, {}, 'name')).toBe(true)
    expect(hasCustomRender(col, { name: () => null }, 'name')).toBe(true)
    expect(hasCustomRender(col, {}, 'name')).toBe(false)
  })

  it('extracts pass-through props', () => {
    const rest = extractColumnRenderProps({ ...col, cellRenderer: () => null, sortable: true, width: 120 } as any)
    expect((rest as any).cellRenderer).toBeUndefined()
    expect((rest as any).sortable).toBeUndefined()
    expect((rest as any).width).toBe(120)
    expect((rest as any).label).toBe('Name')
  })

  it('exposes icon path constants and tooltip set', () => {
    expect(COLLAPSED_ARROW_PATH).toContain('M8.59')
    expect(EXPANDED_ARROW_PATH).toContain('M7.41')
    expect(EP_ARROW_PATH.length).toBeGreaterThan(10)
    expect(NO_TOOLTIP_VALUE_TYPES.has('image')).toBe(true)
    expect(NO_TOOLTIP_VALUE_TYPES.has('text')).toBe(false)
  })
})

describe('injectRendererContext', () => {
  it('returns undefined fields without providers', () => {
    let ctx!: ReturnType<typeof injectRendererContext>
    mount(defineComponent({
      setup() {
        ctx = injectRendererContext()
        return () => h('div')
      },
    })).unmount()
    expect(ctx.tableContext).toBeUndefined()
    expect(ctx.editApi).toBeUndefined()
  })
})
