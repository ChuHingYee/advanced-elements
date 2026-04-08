import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { buildSharedHeaderContent } from '../../../src/components/shared/column-renderer'

function createCol(overrides: any = {}) {
  return {
    prop: 'name',
    label: 'Name',
    key: 'name',
    ...overrides,
    hidden: false,
  }
}

describe('buildSharedHeaderContent', () => {
  it('renders header text from column prop', () => {
    const result = buildSharedHeaderContent({
      col: createCol({ prop: 'username', label: 'Username', hidden: false }),
      colIndex: 0,
      columns: [],
      slots: {},
    })
    expect(result.type).toBe('span')
    expect(result.props!.class).toBe('adv-table__header-cell-content')
  })

  it('uses header slot when available', () => {
    const col = createCol({ prop: 'name', hidden: false })
    const slots = {
      'name-header': () => [h('span', { class: 'custom-slot' }, 'Custom')],
    }
    const result = buildSharedHeaderContent({
      col,
      colIndex: 0,
      columns: [],
      slots,
    })
    expect(result).toBeDefined()
  })

  it('renders without sort/filter when skipActions is true', () => {
    const col = createCol({ prop: 'name', sortable: true, filter: true, hidden: false })
    const result = buildSharedHeaderContent({
      col,
      colIndex: 0,
      columns: [],
      slots: {},
      skipActions: true,
    })
    expect(result).toBeDefined()
  })

  it('renders sort indicator when sortable and getSortOrder is provided', () => {
    const col = createCol({ prop: 'name', sortable: true, hidden: false })
    const result = buildSharedHeaderContent({
      col,
      colIndex: 0,
      columns: [],
      slots: {},
      getSortOrder: () => 'ascending',
      toggleSort: () => {},
    })
    expect(result).toBeDefined()
  })

  it('renders filter icon when filterable and setFilter is provided', () => {
    const col = createCol({ prop: 'name', filter: true, hidden: false })
    const result = buildSharedHeaderContent({
      col,
      colIndex: 0,
      columns: [],
      slots: {},
      getFilterValue: () => undefined,
      setFilter: () => {},
      isColumnFiltered: () => false,
      getEnumOptions: () => [],
    })
    expect(result).toBeDefined()
  })

  it('applies align style for centering', () => {
    const col = createCol({ prop: 'name', align: 'center', hidden: false })
    const result = buildSharedHeaderContent({
      col,
      colIndex: 0,
      columns: [],
      slots: {},
    })
    expect(result.props!.style).toEqual({ justifyContent: 'center' })
  })

  it('applies align style for right alignment', () => {
    const col = createCol({ prop: 'name', align: 'right', hidden: false })
    const result = buildSharedHeaderContent({
      col,
      colIndex: 0,
      columns: [],
      slots: {},
    })
    expect(result.props!.style).toEqual({ justifyContent: 'flex-end' })
  })

  it('attaches header click handler when onHeaderClick is provided', () => {
    const onHeaderClick = vi.fn()
    const col = createCol({ prop: 'name', hidden: false })
    const result = buildSharedHeaderContent({
      col,
      colIndex: 0,
      columns: [],
      slots: {},
      onHeaderClick,
    })
    const textSpan = (result.children as any)[0] as any
    textSpan.props.onClick(new Event('click'))
    expect(onHeaderClick).toHaveBeenCalledWith({
      column: col,
      columnIndex: 0,
      event: expect.any(Event),
    })
  })

  it('attaches header contextmenu handler when onHeaderContextmenu is provided', () => {
    const onHeaderContextmenu = vi.fn()
    const col = createCol({ prop: 'name', hidden: false })
    const result = buildSharedHeaderContent({
      col,
      colIndex: 0,
      columns: [],
      slots: {},
      onHeaderContextmenu,
    })
    const textSpan = (result.children as any)[0] as any
    textSpan.props.onContextmenu(new Event('contextmenu'))
    expect(onHeaderContextmenu).toHaveBeenCalledWith({
      column: col,
      columnIndex: 0,
      event: expect.any(Event),
    })
  })

  it('handles enum columns without filter', () => {
    const col = createCol({ prop: 'name', filter: true, hidden: false })
    const result = buildSharedHeaderContent({
      col,
      colIndex: 0,
      columns: [],
      slots: {},
      getFilterValue: () => undefined,
      setFilter: () => {},
    })
    expect(result).toBeDefined()
  })

  it('skips filter config for selection and option columns', () => {
    const selectionCol = { ...createCol({ prop: 'name', hidden: false }), selection: true }
    const result = buildSharedHeaderContent({
      col: selectionCol,
      colIndex: 0,
      columns: [],
      slots: {},
      getFilterValue: () => undefined,
      setFilter: () => {},
    })
    expect(result).toBeDefined()
  })
})
