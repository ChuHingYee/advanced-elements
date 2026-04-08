import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import {
  extractColumnRenderProps,
  hasCustomRender,
  NO_TOOLTIP_VALUE_TYPES,
  renderColumnSlot,
  renderHeaderCell,
  renderHeaderDragMarker,
  renderHeaderSlot,
  renderRowDragMarker,
  renderSortIndicator,
} from '../../../src/components/renderer-core/render-helpers'
import { getColumnKey } from '../../../src/utils/shared'
import { ADV_TABLE_COLUMN_KEY_ATTR, ADV_TABLE_ROW_KEY_ATTR } from '../../../src/utils/table-drag'

describe('shared', () => {
  describe('getColumnKey', () => {
    it('returns key when key exists', () => {
      expect(getColumnKey({ key: 'testKey' })).toBe('testKey')
    })

    it('returns prop when key does not exist', () => {
      expect(getColumnKey({ prop: 'testProp', hidden: false })).toBe('testProp')
    })

    it('generates unique key when neither key nor prop exists', () => {
      expect(getColumnKey({})).toBe('')
    })

    it('converts non-string key to string', () => {
      expect(getColumnKey({ key: 123 })).toBe('123')
    })

    it('prioritizes key over prop', () => {
      expect(getColumnKey({ key: 'keyValue', prop: 'propValue', hidden: false })).toBe('keyValue')
    })
  })

  describe('renderHeaderDragMarker', () => {
    it('wraps content with drag marker span', () => {
      const vnode = renderHeaderDragMarker('col-1', 'Header Text')
      expect(vnode.type).toBe('span')
      expect(vnode.props!.class).toBe('adv-table__header-cell adv-table__drag-header-marker')
      expect(vnode.props![ADV_TABLE_COLUMN_KEY_ATTR]).toBe('col-1')
      expect(vnode.children).toBe('Header Text')
    })
  })

  describe('renderRowDragMarker', () => {
    it('wraps content with row drag marker span', () => {
      const rowKeyFn = (row: any) => row.id
      const vnode = renderRowDragMarker(rowKeyFn, { id: 'row-42' }, 'Cell Content')
      expect(vnode.type).toBe('span')
      expect(vnode.props!.class).toBe('adv-table__cell adv-table__drag-row-marker')
      expect(vnode.props![ADV_TABLE_ROW_KEY_ATTR]).toBe('row-42')
      expect(vnode.children).toBe('Cell Content')
    })
  })

  describe('renderHeaderCell', () => {
    it('uses headerCellRenderer when provided', () => {
      const renderer = vi.fn(() => 'Custom Header')
      const col = { prop: 'name', label: 'Name', headerCellRenderer: renderer, hidden: false } as any
      const result = renderHeaderCell(col)
      expect(result).toBe('Custom Header')
      expect(renderer).toHaveBeenCalledWith({
        columns: [col],
        column: col,
        columnIndex: 0,
        headerIndex: 0,
      })
    })

    it('falls back to label then prop', () => {
      expect(renderHeaderCell({ prop: 'name', label: 'Label', hidden: false } as any)).toBe('Label')
      expect(renderHeaderCell({ prop: 'name', hidden: false } as any)).toBe('name')
    })

    it('passes columns, columnIndex, and headerIndex to headerCellRenderer', () => {
      const renderer = vi.fn(() => 'X')
      const cols = [{ prop: 'a', hidden: false }, { prop: 'b', hidden: false }] as any
      renderHeaderCell({ prop: 'b', headerCellRenderer: renderer, hidden: false } as any, cols, 1, 2)
      expect(renderer).toHaveBeenCalledWith({
        columns: cols,
        column: { prop: 'b', headerCellRenderer: renderer, hidden: false },
        columnIndex: 1,
        headerIndex: 2,
      })
    })
  })

  describe('renderSortIndicator', () => {
    it('returns null when col is not sortable', () => {
      const result = renderSortIndicator({ prop: 'name', hidden: false } as any)
      expect(result).toBeNull()
    })

    it('renders sort indicator for sortable column', () => {
      const result = renderSortIndicator({ prop: 'name', sortable: true, hidden: false } as any)
      expect(result).not.toBeNull()
      expect((result as any)?.type).toBe('span')
      expect((result as any)?.props?.class).toBe('adv-table__sort-indicator')
    })

    it('applies is-active class for ascending order', () => {
      const result = renderSortIndicator({ prop: 'name', sortable: true, hidden: false } as any, 'ascending')
      const [ascIcon, descIcon] = result!.children as any[]
      expect(ascIcon.props.class).toContain('adv-table__sort-icon--active')
      expect(descIcon.props.class).not.toContain('adv-table__sort-icon--active')
    })

    it('applies is-active class for descending order', () => {
      const result = renderSortIndicator({ prop: 'name', sortable: true, hidden: false } as any, 'descending')
      const [ascIcon, descIcon] = result!.children as any[]
      expect(ascIcon.props.class).not.toContain('adv-table__sort-icon--active')
      expect(descIcon.props.class).toContain('adv-table__sort-icon--active')
    })

    it('calls onToggleSort on click', () => {
      const onToggle = vi.fn()
      const result = renderSortIndicator({ prop: 'name', sortable: true, hidden: false } as any, null, onToggle)
      ;(result as any)?.props?.onClick(new Event('click'))
      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('stops propagation on click', () => {
      const stopPropagation = vi.fn()
      const event = new Event('click')
      event.stopPropagation = stopPropagation
      const result = renderSortIndicator({ prop: 'name', sortable: true, hidden: false } as any, null, vi.fn())
      ;(result as any)?.props?.onClick(event)
      expect(stopPropagation).toHaveBeenCalled()
    })
  })

  describe('renderHeaderSlot', () => {
    it('returns null when slot does not exist', () => {
      const result = renderHeaderSlot({ prop: 'name', hidden: false } as any, {})
      expect(result).toBeNull()
    })

    it('returns single VNode directly', () => {
      const slots = { 'name-header': () => [h('span', { class: 'custom' }, 'text')] }
      const result = renderHeaderSlot({ prop: 'name', hidden: false } as any, slots)
      expect(result).not.toBeNull()
      expect((result as any).props.class).toBe('custom')
    })

    it('wraps multiple VNodes in Fragment', () => {
      const slots = { 'name-header': () => [h('span', 'a'), h('span', 'b')] }
      const result = renderHeaderSlot({ prop: 'name', hidden: false } as any, slots)
      expect(result).not.toBeNull()
      expect((result as any).type).toBeDefined()
    })

    it('uses column key for slot lookup', () => {
      const slots = { 'myKey-header': () => [h('span', 'slot content')] }
      const result = renderHeaderSlot({ key: 'myKey', prop: 'name', hidden: false } as any, slots)
      expect(result).not.toBeNull()
    })
  })

  describe('renderColumnSlot', () => {
    it('returns null when slot does not exist', () => {
      const result = renderColumnSlot({ prop: 'name', hidden: false } as any, {})
      expect(result).toBeNull()
    })

    it('returns single VNode directly', () => {
      const slots = { name: () => [h('div', 'cell')] }
      const result = renderColumnSlot({ prop: 'name', hidden: false } as any, slots)
      expect((result as any).children).toBe('cell')
    })

    it('wraps multiple VNodes in Fragment', () => {
      const slots = { name: () => [h('span', 'x'), h('span', 'y')] }
      const result = renderColumnSlot({ prop: 'name', hidden: false } as any, slots)
      expect(result).toBeDefined()
    })
  })

  describe('nO_TOOLTIP_VALUE_TYPES', () => {
    it('contains all non-text value types', () => {
      expect(NO_TOOLTIP_VALUE_TYPES.has('progress')).toBe(true)
      expect(NO_TOOLTIP_VALUE_TYPES.has('switch')).toBe(true)
      expect(NO_TOOLTIP_VALUE_TYPES.has('avatar')).toBe(true)
      expect(NO_TOOLTIP_VALUE_TYPES.has('image')).toBe(true)
      expect(NO_TOOLTIP_VALUE_TYPES.has('rate')).toBe(true)
      expect(NO_TOOLTIP_VALUE_TYPES.has('option')).toBe(true)
    })

    it('does not contain text-like value types', () => {
      expect(NO_TOOLTIP_VALUE_TYPES.has('text')).toBe(false)
      expect(NO_TOOLTIP_VALUE_TYPES.has('textarea')).toBe(false)
      expect(NO_TOOLTIP_VALUE_TYPES.has('money')).toBe(false)
      expect(NO_TOOLTIP_VALUE_TYPES.has('date')).toBe(false)
    })
  })

  describe('hasCustomRender', () => {
    it('returns true if column has cellRenderer', () => {
      const col = { prop: 'name', cellRenderer: () => 'x', hidden: false } as any
      expect(hasCustomRender(col, {}, 'name')).toBe(true)
    })

    it('returns true if column has cellComponent', () => {
      const col = { prop: 'name', cellComponent: { name: 'TestComponent' }, hidden: false } as any
      expect(hasCustomRender(col, {}, 'name')).toBe(true)
    })

    it('returns true if slot exists', () => {
      const col = { prop: 'name', hidden: false } as any
      const slots = { name: () => [h('span')] }
      expect(hasCustomRender(col, slots, 'name')).toBe(true)
    })

    it('returns false if no custom render is configured', () => {
      const col = { prop: 'name', hidden: false } as any
      expect(hasCustomRender(col, {}, 'name')).toBe(false)
    })
  })

  describe('extractColumnRenderProps', () => {
    it('removes render-specific props and keeps others', () => {
      const col = {
        prop: 'name',
        label: 'Name',
        cellRenderer: () => 'x',
        cellComponent: undefined,
        headerCellRenderer: undefined,
        format: (v: any) => String(v),
        valueType: 'text',
        valueEnum: undefined,
        copyable: true,
        ellipsis: true,
        showOverflowTooltip: true,
        filter: true,
        sortable: true,
        merge: undefined,
        colMerge: undefined,
        children: undefined,
        width: 100,
        align: 'left',
        hidden: false,
      } as any
      const result = extractColumnRenderProps(col)
      expect(result).not.toHaveProperty('cellRenderer')
      expect(result).not.toHaveProperty('cellComponent')
      expect(result).not.toHaveProperty('headerCellRenderer')
      expect(result).not.toHaveProperty('hidden')
      expect(result).not.toHaveProperty('format')
      expect(result).not.toHaveProperty('valueType')
      expect(result).not.toHaveProperty('valueEnum')
      expect(result).not.toHaveProperty('copyable')
      expect(result).not.toHaveProperty('ellipsis')
      expect(result).not.toHaveProperty('showOverflowTooltip')
      expect(result).not.toHaveProperty('filter')
      expect(result).not.toHaveProperty('sortable')
      expect(result).not.toHaveProperty('merge')
      expect(result).not.toHaveProperty('colMerge')
      expect(result).not.toHaveProperty('children')
      expect(result).toHaveProperty('prop', 'name')
      expect(result).toHaveProperty('label', 'Name')
      expect(result).toHaveProperty('width', 100)
      expect(result).toHaveProperty('align', 'left')
    })
  })
})
