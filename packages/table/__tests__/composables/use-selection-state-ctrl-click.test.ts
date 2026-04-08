import type { TreeApi } from '../../src/types/config'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSelectionState } from '../../src/composables/selection/use-selection-state'

function setup(options?: {
  data?: any[]
  rowKey?: (row: any) => string
  selectableFn?: (row: any, index: number) => boolean
  selectionMode?: 'single' | 'multiple'
  rowMultiSelectWithClick?: boolean
  treeApi?: TreeApi
  keyToIndexMap?: Map<string, number>
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
      treeApi: options?.treeApi ? () => options.treeApi : undefined,
      keyToIndexMap: options?.keyToIndexMap ? () => options.keyToIndexMap : undefined,
    },
    { onSelectionChange, onSelect, onSelectAll, onRowSelected },
  )

  return { ...state, data, rowKey, rowMap, onSelectionChange, onSelect, onSelectAll, onRowSelected }
}

describe('useSelectionState phase3 — ctrl+click', () => {
  it('ctrl+click toggles row independently', () => {
    const s = setup()
    s.toggleRowSelection(s.data[0], true, false, {})
    s.toggleRowSelection(s.data[2], true, false, { ctrlKey: true })
    expect(s.isSelected(s.data[0])).toBe(true)
    expect(s.isSelected(s.data[1])).toBe(false)
    expect(s.isSelected(s.data[2])).toBe(true)
  })

  it('ctrl+click deselects previously selected row', () => {
    const s = setup()
    s.toggleRowSelection(s.data[0], true, false, {})
    s.toggleRowSelection(s.data[0], false, false, { ctrlKey: true })
    expect(s.isSelected(s.data[0])).toBe(false)
  })

  it('ctrl+click respects selectableFn', () => {
    const s = setup({ selectableFn: row => row.id !== '2' })
    s.toggleRowSelection(s.data[1], true, false, { ctrlKey: true })
    expect(s.isSelected(s.data[1])).toBe(false)
  })

  it('ctrl+click with ignoreSelectable bypasses selectableFn', () => {
    const s = setup({ selectableFn: row => row.id !== '2' })
    s.toggleRowSelection(s.data[1], true, true, { ctrlKey: true })
    expect(s.isSelected(s.data[1])).toBe(true)
  })
})

describe('useSelectionState phase3 — shift+click deselect', () => {
  it('shift+click with shouldSelect=false deselects range', () => {
    const s = setup()
    s.selectAll(s.data)
    s.setLastClickedKey('1')
    // Shift-click row 3 to deselect range
    s.toggleRowSelection(s.data[3], false, false, { shiftKey: true })
    expect(s.isSelected(s.data[0])).toBe(false)
    expect(s.isSelected(s.data[1])).toBe(false)
    expect(s.isSelected(s.data[2])).toBe(false)
    expect(s.isSelected(s.data[3])).toBe(false)
    expect(s.isSelected(s.data[4])).toBe(true)
  })

  it('shift+click with anchor not in data degrades to single-row toggle', () => {
    const s = setup()
    s.setLastClickedKey('999')
    s.toggleRowSelection(s.data[2], true, false, { shiftKey: true })
    // Invalid anchor: degrades to single-row toggle (selects clicked row + re-anchors)
    expect(s.getSelectedCount()).toBe(1)
    expect(s.isSelected(s.data[2])).toBe(true)
  })

  it('shift+click with clicked row not in data returns early', () => {
    const s = setup()
    s.setLastClickedKey('1')
    // Create a row that's not in allData
    const orphanRow = { id: '999', name: 'Orphan' }
    s.toggleRowSelection(orphanRow, true, false, { shiftKey: true })
    // clickedIdx === -1, should return early
    expect(s.getSelectedCount()).toBe(0)
  })

  it('shift+click with empty allData returns early', () => {
    const s = setup({ data: [] })
    s.toggleRowSelection({ id: '1', name: 'Test' }, true, false, { shiftKey: true })
    expect(s.getSelectedCount()).toBe(0)
  })
})

describe('useSelectionState phase3 — selectRowsByKeys', () => {
  it('selectRowsByKeys selects multiple rows', () => {
    const s = setup()
    s.selectRowsByKeys(['1', '3', '5'])
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('3')).toBe(true)
    expect(s.isSelectedByKey('5')).toBe(true)
    expect(s.getSelectedCount()).toBe(3)
  })

  it('selectRowsByKeys deselects with selected=false', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2', '3'])
    s.selectRowsByKeys(['1', '3'], false)
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(true)
    expect(s.isSelectedByKey('3')).toBe(false)
  })

  it('selectRowsByKeys toggles with selected=undefined', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2'])
    s.selectRowsByKeys(['2', '3'], undefined)
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(true)
  })

  it('selectRowsByKeys in single mode selects only first key', () => {
    const s = setup({ selectionMode: 'single' })
    s.selectRowsByKeys(['1', '2', '3'])
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(false)
  })

  it('selectRowsByKeys with number keys converts to string', () => {
    const s = setup()
    s.selectRowsByKeys([1, 3])
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('3')).toBe(true)
  })

  // ── selected=true replace semantics (new) ──

  it('selectRowsByKeys with selected=true replaces entire selection', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2', '3'])
    s.selectRowsByKeys(['2', '4'], true)
    // Only keys 2 and 4 should be selected; 1 and 3 should be cleared
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(true)
    expect(s.isSelectedByKey('3')).toBe(false)
    expect(s.isSelectedByKey('4')).toBe(true)
    expect(s.getSelectedCount()).toBe(2)
  })

  it('selectRowsByKeys with selected=true and empty array clears selection', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2', '3'])
    expect(s.getSelectedCount()).toBe(3)
    s.selectRowsByKeys([], true)
    expect(s.getSelectedCount()).toBe(0)
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(false)
  })

  it('selectRowsByKeys with selected=true and empty array emits selectionChange', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2'])
    s.onSelectionChange.mockClear()
    s.selectRowsByKeys([], true)
    expect(s.onSelectionChange).toHaveBeenCalledTimes(1)
    const selection = s.onSelectionChange.mock.calls[0][0]
    expect(selection).toHaveLength(0)
  })

  it('selectRowsByKeys with selected=true and empty array on empty selection does not emit', () => {
    const s = setup()
    // No selection to begin with
    expect(s.getSelectedCount()).toBe(0)
    s.selectRowsByKeys([], true)
    // Should not emit since nothing changed
    expect(s.onSelectionChange).not.toHaveBeenCalled()
  })

  it('selectRowsByKeys with selected=true skips disabled rows and replaces', () => {
    const s = setup({ selectableFn: row => row.id !== '2' })
    s.initSelectionByKeys(['1', '3'])
    s.selectRowsByKeys(['1', '2', '4'], true)
    // Row 2 is disabled, should be skipped; selection = {1, 4}
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(false)
    expect(s.isSelectedByKey('4')).toBe(true)
    expect(s.getSelectedCount()).toBe(2)
  })

  it('selectRowsByKeys with selected=true and all-disabled keys clears selection', () => {
    const s = setup({ selectableFn: row => row.id !== '2' })
    s.initSelectionByKeys(['1', '3'])
    s.selectRowsByKeys(['2'], true)
    // Key 2 is disabled, so nothing gets selected; old selection is cleared
    expect(s.getSelectedCount()).toBe(0)
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(false)
  })
})

describe('useSelectionState phase3 — setSelection', () => {
  it('setSelection adds rows to selection', () => {
    const s = setup()
    s.initSelectionByKeys(['1'])
    s.setSelection([s.data[1], s.data[2]], true)
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(true)
    expect(s.isSelectedByKey('3')).toBe(true)
  })

  it('setSelection removes rows from selection', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2', '3'])
    s.setSelection([s.data[0], s.data[2]], false)
    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(true)
    expect(s.isSelectedByKey('3')).toBe(false)
  })

  it('setSelection with empty array is a no-op', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2'])
    s.setSelection([], true)
    expect(s.getSelectedCount()).toBe(2)
  })
})

describe('useSelectionState phase3 — getCheckStatus', () => {
  it('getCheckStatus with customSelectableFn', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '3'])
    const status = s.getCheckStatus(s.data, row => row.id !== '2')
    expect(status.isAllSelected).toBe(false)
    expect(status.isIndeterminate).toBe(true)
  })

  it('getCheckStatus all selected', () => {
    const s = setup()
    s.selectAll(s.data)
    const status = s.getCheckStatus(s.data)
    expect(status.isAllSelected).toBe(true)
    expect(status.isIndeterminate).toBe(false)
  })

  it('getCheckStatus none selected', () => {
    const s = setup()
    const status = s.getCheckStatus(s.data)
    expect(status.isAllSelected).toBe(false)
    expect(status.isIndeterminate).toBe(false)
  })

  it('getCheckStatus with selectableFn filtering all rows', () => {
    const s = setup()
    s.selectAll(s.data)
    const status = s.getCheckStatus(s.data, () => false)
    // No selectable rows -> total=0, selectedCount=0 -> not all selected, not indeterminate
    expect(status.isAllSelected).toBe(false)
    expect(status.isIndeterminate).toBe(false)
  })
})

describe('useSelectionState phase3 — getSelectedCount', () => {
  it('returns correct count', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '3', '5'])
    expect(s.getSelectedCount()).toBe(3)
  })

  it('returns 0 when nothing selected', () => {
    const s = setup()
    expect(s.getSelectedCount()).toBe(0)
  })
})

describe('useSelectionState phase3 — rowMultiSelectWithClick=false', () => {
  it('row click (undefined selected) clears previous and selects current', () => {
    const s = setup({ rowMultiSelectWithClick: false })
    s.toggleRowSelection(s.data[0], undefined, false, {})
    expect(s.isSelected(s.data[0])).toBe(true)
    s.toggleRowSelection(s.data[2], undefined, false, {})
    expect(s.isSelected(s.data[0])).toBe(false)
    expect(s.isSelected(s.data[2])).toBe(true)
  })
})

describe('useSelectionState phase3 — tree cascade', () => {
  function createTreeApi(overrides?: Partial<TreeApi>): TreeApi {
    return {
      treeEnabled: { value: true } as any,
      checkStrictly: { value: false } as any,
      getDescendantKeys: vi.fn((key: string) => {
        const tree: Record<string, string[]> = {
          1: ['2', '3'],
          2: [],
          3: [],
          4: ['5'],
          5: [],
        }
        return new Set(tree[key] ?? [])
      }),
      getAncestorKeys: vi.fn((key: string) => {
        const parents: Record<string, string[]> = {
          1: [],
          2: ['1'],
          3: ['1'],
          4: [],
          5: ['4'],
        }
        return parents[key] ?? []
      }),
      ...overrides,
    } as any
  }

  it('tree cascade selects descendants and ancestors', () => {
    const api = createTreeApi()
    const s = setup({ treeApi: api })
    // Select row 3 (child of 1)
    s.toggleRowSelection(s.data[2], true, false, {})

    expect(s.isSelectedByKey('3')).toBe(true)
    // Row 1 (ancestor) should NOT be selected because not all descendants are selected (row 2 not selected)
    expect(s.isSelectedByKey('1')).toBe(false)
  })

  it('tree cascade selects ancestor when all descendants selected', () => {
    const api = createTreeApi()
    const s = setup({ treeApi: api })
    // Select both children of row 1
    s.toggleRowSelection(s.data[1], true, false, {}) // row 2
    s.toggleRowSelection(s.data[2], true, false, {}) // row 3

    // Row 1 (ancestor) should be selected because all descendants are selected
    expect(s.isSelectedByKey('1')).toBe(true)
  })

  it('tree cascade deselects descendants and ancestors', () => {
    const api = createTreeApi()
    const s = setup({ treeApi: api })
    s.selectAll(s.data)
    // Deselect row 1 (parent of 2, 3)
    s.toggleRowSelection(s.data[0], false, false, {})

    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(false)
  })

  it('tree cascade with checkStrictly=true disables cascade', () => {
    const api = createTreeApi({ checkStrictly: { value: true } as any })
    const s = setup({ treeApi: api })
    s.toggleRowSelection(s.data[0], true, false, {})

    // Only row 1 should be selected, no cascade
    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(false)
  })

  it('tree cascade with treeEnabled=false disables cascade', () => {
    const api = createTreeApi({ treeEnabled: { value: false } as any })
    const s = setup({ treeApi: api })
    s.toggleRowSelection(s.data[0], true, false, {})

    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(false)
  })

  it('selectAll with tree cascade selects descendants', () => {
    const api = createTreeApi()
    const s = setup({ treeApi: api })
    s.selectAll(s.data)

    expect(s.isSelectedByKey('1')).toBe(true)
    expect(s.isSelectedByKey('2')).toBe(true)
    expect(s.isSelectedByKey('3')).toBe(true)
  })

  it('clearVisibleRows with tree cascade deselects descendants', () => {
    const api = createTreeApi()
    const s = setup({ treeApi: api })
    s.selectAll(s.data)
    s.clearVisibleRows([s.data[0]])

    expect(s.isSelectedByKey('1')).toBe(false)
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(false)
  })

  it('tree cascade honors selectableFn for descendants (no bypass)', () => {
    const api = createTreeApi()
    const s = setup({ treeApi: api, selectableFn: row => row.id !== '2' })
    // Select row 1 (parent) — descendants go through the same selectableFn check as selectAll
    s.toggleRowSelection(s.data[0], true, false, {})

    // Row 1 should be selected (it passed selectableFn check)
    expect(s.isSelectedByKey('1')).toBe(true)
    // Row 2 is NOT selected: disabled rows are never cascade-selected, consistent with selectAll
    expect(s.isSelectedByKey('2')).toBe(false)
    expect(s.isSelectedByKey('3')).toBe(true)
  })
})

describe('useSelectionState phase3 — rowMap watcher cleanup', () => {
  it('rowMap watcher removes stale keys when rowMap changes', async () => {
    const data = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ]
    const rowMapRef = ref(new Map(data.map(r => [r.id, r])))
    const rowKey = (row: any) => row.id
    const state = useSelectionState({
      rowKey: () => rowKey,
      allData: () => data,
      rowMap: () => rowMapRef.value,
    })

    state.initSelectionByKeys(['1', '2', '3'])
    expect(state.getSelectedCount()).toBe(3)

    // Simulate rowMap change - remove row 2
    rowMapRef.value = new Map([
      ['1', data[0]],
      ['3', data[2]],
    ])

    // Wait for the watcher to fire (flush: 'sync')
    await new Promise(resolve => setTimeout(resolve, 0))

    // Row 2 should be removed from selection
    expect(state.isSelectedByKey('1')).toBe(true)
    expect(state.isSelectedByKey('2')).toBe(false)
    expect(state.isSelectedByKey('3')).toBe(true)
  })
})

describe('useSelectionState phase3 — emitSelectionChange patch', () => {
  it('emitSelectionChange patches selection when row not in rowMap', () => {
    const data = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]
    const rowKey = (row: any) => row.id
    const rowMap = new Map(data.map(r => [r.id, r]))
    const onSelectionChange = vi.fn()
    const onSelect = vi.fn()
    const onRowSelected = vi.fn()

    const state = useSelectionState(
      {
        rowKey: () => rowKey,
        allData: () => data,
        rowMap: () => rowMap,
      },
      { onSelectionChange, onSelect, onRowSelected },
    )

    // Select a row that exists in the map
    state.toggleRowSelection(data[0], true, false, {})

    expect(onSelectionChange).toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalled()
    expect(onRowSelected).toHaveBeenCalledWith({ row: data[0], selected: true })
  })
})

describe('useSelectionState phase3 — toggleRowSelection edge cases', () => {
  it('toggleRowSelection with same shouldSelect and wasSelected is no-op', () => {
    const s = setup()
    s.toggleRowSelection(s.data[0], true, false, {})
    const onSelectionChangeCount = s.onSelectionChange.mock.calls.length
    // Toggle again with same selected=true
    s.toggleRowSelection(s.data[0], true, false, {})
    // Should not fire selection change (handleDefaultToggle returns early)
    expect(s.onSelectionChange.mock.calls.length).toBe(onSelectionChangeCount)
  })

  it('toggleRowSelection respects selectableFn', () => {
    const s = setup({ selectableFn: row => row.id !== '2' })
    s.toggleRowSelection(s.data[1], true, false, {})
    expect(s.isSelected(s.data[1])).toBe(false)
  })

  it('toggleRowSelection with ignoreSelectable bypasses selectableFn', () => {
    const s = setup({ selectableFn: row => row.id !== '2' })
    s.toggleRowSelection(s.data[1], true, true, {})
    expect(s.isSelected(s.data[1])).toBe(true)
  })
})

describe('useSelectionState phase3 — initSelectionByKeys same keys', () => {
  it('initSelectionByKeys with same keys is a no-op', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2'])
    const changeCount = s.onSelectionChange.mock.calls.length
    s.initSelectionByKeys(['1', '2'])
    expect(s.onSelectionChange.mock.calls.length).toBe(changeCount)
  })

  it('initSelectionByKeys with different order but same keys is a no-op', () => {
    const s = setup()
    s.initSelectionByKeys(['1', '2', '3'])
    const changeCount = s.onSelectionChange.mock.calls.length
    s.initSelectionByKeys(['3', '2', '1'])
    expect(s.onSelectionChange.mock.calls.length).toBe(changeCount)
  })
})
