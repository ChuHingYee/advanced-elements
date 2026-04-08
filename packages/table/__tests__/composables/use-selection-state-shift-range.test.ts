import { describe, expect, it, vi } from 'vitest'
import { useSelectionState } from '../../src/composables/selection/use-selection-state'

function setup(options?: {
  data?: any[]
  rowKey?: (row: any) => string
  selectableFn?: (row: any, index: number) => boolean
  selectionMode?: 'single' | 'multiple'
  rowMultiSelectWithClick?: boolean
  shiftScopeData?: () => any[]
}) {
  const data = options?.data ?? [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '4', name: 'Diana' },
    { id: '5', name: 'Eve' },
  ]
  const rowKey = options?.rowKey ?? ((row: any) => row.id)
  const rowMap = new Map(data.map(r => [rowKey(r), r]))
  const onSelectionChange = vi.fn()
  const onSelect = vi.fn()
  const onSelectAll = vi.fn()
  const onRowSelected = vi.fn()

  const state = useSelectionState(
    {
      rowKey: () => rowKey,
      allData: () => data,
      rowMap: () => rowMap,
      selectableFn: options?.selectableFn ? () => options.selectableFn : undefined,
      selectionMode: () => options?.selectionMode ?? 'multiple',
      rowMultiSelectWithClick: () => options?.rowMultiSelectWithClick,
      shiftScopeData: options?.shiftScopeData,
    },
    { onSelectionChange, onSelect, onSelectAll, onRowSelected },
  )

  return { ...state, data, rowKey, rowMap, onSelectionChange, onSelect, onSelectAll, onRowSelected }
}

describe('useSelectionState - shift+click range selection', () => {
  it('selects range from last clicked to shift+clicked row', () => {
    const s = setup()
    s.toggleRowSelection(s.data[0], true, false, {}) // click row 0
    expect(s.isSelected(s.data[0])).toBe(true)
    expect(s.lastClickedKey.value).toBe('1')

    s.toggleRowSelection(s.data[3], true, false, { shiftKey: true }) // shift-click row 3
    expect(s.isSelected(s.data[0])).toBe(true)
    expect(s.isSelected(s.data[1])).toBe(true)
    expect(s.isSelected(s.data[2])).toBe(true)
    expect(s.isSelected(s.data[3])).toBe(true)
    expect(s.isSelected(s.data[4])).toBe(false)
  })

  it('handles shift+click when no prior selection', () => {
    const s = setup()
    s.toggleRowSelection(s.data[2], true, false, { shiftKey: true })
    // No anchor, should act as normal click
    expect(s.isSelected(s.data[2])).toBe(true)
    expect(s.lastClickedKey.value).toBe('3')
  })

  it('works with ctrl+shift combination', () => {
    const s = setup()
    s.toggleRowSelection(s.data[0], true, false, {})
    // ctrlKey + shiftKey: ctrlKey takes priority -> single row toggle for row 3
    s.toggleRowSelection(s.data[3], true, false, { shiftKey: true, ctrlKey: true })
    expect(s.isSelected(s.data[0])).toBe(true)
    expect(s.isSelected(s.data[3])).toBe(true)
    expect(s.isSelected(s.data[1])).toBe(false)
    expect(s.isSelected(s.data[2])).toBe(false)
  })

  it('range selection respects selectableFn', () => {
    const s = setup({ selectableFn: row => row.id !== '2' })
    s.toggleRowSelection(s.data[0], true, false, {})
    s.toggleRowSelection(s.data[4], true, false, { shiftKey: true })
    expect(s.isSelected(s.data[0])).toBe(true)
    expect(s.isSelected(s.data[1])).toBe(false) // row 2 is not selectable
    expect(s.isSelected(s.data[2])).toBe(true)
    expect(s.isSelected(s.data[3])).toBe(true)
    expect(s.isSelected(s.data[4])).toBe(true)
  })
})

describe('useSelectionState - key-based operations', () => {
  it('selectRowByKey selects a row', () => {
    const s = setup()
    s.selectRowByKey('1')
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.getSelectedCount()).toBe(1)
  })

  it('selectRowByKey deselects when selected=false', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2'])
    s.selectRowByKey('1', false)
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(true)
  })

  it('isSelectedByKey returns correct state', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '3'])
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(true)
  })

  it('initSelectionByKeys with partial/invalid keys', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '999', '3'])
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('3')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(false)
  })

  it('selectRowByKey works in single mode', () => {
    const s = setup({ selectionMode: 'single' })
    s.selectRowByKey('1')
    expect(s.isSelectedByKey('1')).toBe(true)
    s.selectRowByKey('2')
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(true)
  })

  it('getSelectedKeys returns all selected keys', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '3', '5'])
    expect(s.getSelectedKeys()).toEqual(['1', '3', '5'])
  })
})

describe('useSelectionState - filtered selection', () => {
  it('selectAllFiltered selects only filtered rows', () => {
    const s = setup()
    const visibleRows = [s.data[0], s.data[2], s.data[4]]
    s.selectAll(visibleRows)
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(true)
    expect(s.isSelectedByKey('4')).toBe(false)
    expect(s.isSelectedByKey('5')).toBe(true)
  })

  it('clearVisibleRows deselects visible rows', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2', '3', '4', '5'])
    const visibleRows = [s.data[0], s.data[1]]
    s.clearVisibleRows(visibleRows)
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(true)
    expect(s.isSelectedByKey('4')).toBe(true)
    expect(s.isSelectedByKey('5')).toBe(true)
  })

  it('selectAll on current page', () => {
    const s = setup()
    const pageRows = [s.data[0], s.data[1]]
    s.selectAll(pageRows)
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(true)
    expect(s.isSelectedByKey('3')).toBe(false)
  })

  it('toggleAllSelection toggles select all / clear', () => {
    const s = setup()
    const visibleRows = [s.data[0], s.data[1]]
    s.toggleAllSelection(visibleRows)
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(true)
    // deselect
    s.toggleAllSelection(visibleRows)
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(false)
  })
})

describe('useSelectionState - edge cases', () => {
  it('clearSelection clears everything', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2', '3'])
    s.clearSelection()
    expect(s.getSelectedCount()).toBe(0)
  })

  it('clearSelection no-op when already empty', () => {
    const s = setup()
    s.clearSelection()
    expect(s.getSelectedCount()).toBe(0)
  })

  it('replaceSelection replaces entire selection', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2'])
    s.replaceSelection([s.data[3], s.data[4]])
    expect(s.isSelectedByKey('4')).toBe(true)
    expect(s.isSelectedByKey('5')).toBe(true)
    expect(s.isSelectedByKey('1')).toBe(false)
  })

  it('forEachSelected iterates selected rows', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '3'])
    const callback = vi.fn()
    s.forEachSelected(callback)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(s.data[0], '1')
    expect(callback).toHaveBeenCalledWith(s.data[2], '3')
  })

  it('getSelectedIndices returns correct indices', () => {
    const s = setup()
    s.initSelectionByKeys(['2', '4'])
    const indices = s.getSelectedIndices(s.data)
    expect(indices).toEqual([1, 3])
  })

  it('setLastClickedKey updates lastClickedKey', () => {
    const s = setup()
    s.setLastClickedKey('5')
    expect(s.lastClickedKey.value).toBe('5')
  })
})

describe('useSelectionState - single mode', () => {
  it('toggleRowSelection replaces selection in single mode', () => {
    const s = setup({ selectionMode: 'single' })
    s.toggleRowSelection(s.data[0], true)
    expect(s.isSelectedByKey('1')).toBe(true)
    s.toggleRowSelection(s.data[2], true)
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(true)
  })
})

describe('useSelectionState - rowMultiSelectWithClick false', () => {
  it('clears previous selection on row click', () => {
    const s = setup({ rowMultiSelectWithClick: false })
    s.initSelectionByKeys(['1', '2'])
    s.toggleRowSelection(s.data[3], undefined, false, {})
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('4')).toBe(true)
  })
})

describe('useSelectionState - shift range scope', () => {
  it('restricts shift ranges to the scope data, ignoring filtered-out rows', () => {
    // <zh/> 回归：范围曾按全量 allData 切片，过滤/分页后锚点到点击间的不可见行被误选
    // <en/> Regression: ranges used to slice full allData, wrongly picking up invisible rows between anchor and click after filtering/pagination
    const s = setup()
    const scope = [s.data[0], s.data[2], s.data[4]]
    const scoped = setup({ shiftScopeData: () => scope })
    scoped.toggleRowSelection(scoped.data[0], true, false, {})
    scoped.toggleRowSelection(scoped.data[4], true, false, { shiftKey: true })
    expect(scoped.isSelectedByKey('1')).toBe(true)
    expect(scoped.isSelectedByKey('2')).toBe(false)
    expect(scoped.isSelectedByKey('3')).toBe(true)
    expect(scoped.isSelectedByKey('4')).toBe(false)
    expect(scoped.isSelectedByKey('5')).toBe(true)
  })

  it('falls back to full data without scope (existing behavior)', () => {
    const s = setup()
    s.toggleRowSelection(s.data[0], true, false, {})
    s.toggleRowSelection(s.data[3], true, false, { shiftKey: true })
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(true)
    expect(s.isSelectedByKey('3')).toBe(true)
    expect(s.isSelectedByKey('4')).toBe(true)
    expect(s.isSelectedByKey('5')).toBe(false)
  })
})
