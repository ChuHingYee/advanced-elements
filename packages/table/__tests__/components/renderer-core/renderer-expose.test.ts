import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createRendererExpose, useSharedCurrentRow } from '../../../src/components/renderer-core/renderer-expose'
import { advTableCurrentRowKey } from '../../../src/types/injection-keys'
import { ADV_TABLE_COLUMN_KEY_ATTR, ADV_TABLE_ROW_KEY_ATTR } from '../../../src/utils/table-drag'

/**
 * <zh/> 渲染器 expose 单测——覆盖共享 currentRow 与 DOM 查询工厂。
 * <en/> Renderer-expose tests — shared currentRow and DOM query factory.
 */
const config = {
  getRootEl: () => null,
  getColumnDragContainer: () => null,
  getRowDragContainer: () => null,
  defaultColumnDragHandle: '.col-handle',
  defaultRowDragHandle: '.row-handle',
  columnDraggableSelector: '.col-draggable',
}

describe('useSharedCurrentRow', () => {
  it('falls back to a local ref without provider', () => {
    let row!: ReturnType<typeof useSharedCurrentRow>
    mount(defineComponent({
      setup() {
        row = useSharedCurrentRow()
        return () => h('div')
      },
    })).unmount()
    expect(row.value).toBeNull()
    row.value = { id: 1 } as any
    expect((row.value as any).id).toBe(1)
  })

  it('returns the injected shared ref when provided', () => {
    const shared = { value: { id: 9 } }
    let row!: ReturnType<typeof useSharedCurrentRow>
    mount(defineComponent({
      setup() {
        row = useSharedCurrentRow()
        return () => h('div')
      },
    }), {
      global: { provide: { [advTableCurrentRowKey as symbol]: shared } },
    }).unmount()
    expect(row).toBe(shared as any)
  })
})

describe('createRendererExpose', () => {
  it('reads keys from marked children', () => {
    const colBox = document.createElement('div')
    colBox.innerHTML = `<div><span ${ADV_TABLE_COLUMN_KEY_ATTR}="a"></span></div><div><span ${ADV_TABLE_COLUMN_KEY_ATTR}="b"></span></div><div></div>`
    const rowBox = document.createElement('div')
    rowBox.innerHTML = `<div><span ${ADV_TABLE_ROW_KEY_ATTR}="1"></span></div>`
    const expose = createRendererExpose({ ...config, getColumnDragContainer: () => colBox, getRowDragContainer: () => rowBox })
    expect(expose.getRenderedColumnKeys()).toEqual(['a', 'b'])
    expect(expose.getRenderedRowKeys()).toEqual(['1'])
  })

  it('returns empty arrays for null containers', () => {
    const expose = createRendererExpose(config)
    expect(expose.getRenderedColumnKeys()).toEqual([])
    expect(expose.getRenderedRowKeys()).toEqual([])
    expect(expose.getColumnDragContainer()).toBeNull()
    expect(expose.getRowDragContainer()).toBeNull()
  })

  it('exposes selector config', () => {
    const expose = createRendererExpose(config)
    expect(expose.getDefaultColumnDragHandle()).toBe('.col-handle')
    expect(expose.getDefaultRowDragHandle()).toBe('.row-handle')
    expect(expose.getColumnDraggableSelector()).toBe('.col-draggable')
  })
})
