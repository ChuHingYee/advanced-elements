import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSelectionState } from '../../src/composables/selection/use-selection-state'

const createRow = (id: number) => ({ id, name: `User ${id}` })

describe('useSelectionState composable', () => {
  const rowKeyGetter = () => (row: { id: number }) => String(row.id)
  const allData = [createRow(1), createRow(2), createRow(3), createRow(4), createRow(5)]
  const rowMap = new Map(allData.map(row => [String(row.id), row]))

  function createSelectionState() {
    return useSelectionState({
      rowKey: rowKeyGetter,
      allData: () => allData,
      rowMap: () => rowMap,
    })
  }

  describe('basic functionality', () => {
    it('should initialize with empty selection', () => {
      const result = createSelectionState()
      expect(result.selectedKeys.value.size).toBe(0)
    })

    it('should check if row is selected', () => {
      const result = createSelectionState()
      result.selectedKeys.value = new Set(['1', '2'])
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(3))).toBe(false)
    })
  })

  describe('toggleRowSelection', () => {
    it('should toggle row selection', () => {
      const result = createSelectionState()
      result.toggleRowSelection(createRow(1))
      expect(result.isSelected(createRow(1))).toBe(true)

      result.toggleRowSelection(createRow(1))
      expect(result.isSelected(createRow(1))).toBe(false)
    })

    it('should set row to specific selection state', () => {
      const result = createSelectionState()
      result.toggleRowSelection(createRow(1), true)
      expect(result.isSelected(createRow(1))).toBe(true)

      result.toggleRowSelection(createRow(1), false)
      expect(result.isSelected(createRow(1))).toBe(false)
    })

    it('should respect selectableFn', () => {
      const selectableFnGetter = () => (row: { id: number }) => row.id !== 2
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        selectableFn: selectableFnGetter,
      })

      result.toggleRowSelection(createRow(1), true)
      expect(result.isSelected(createRow(1))).toBe(true)

      result.toggleRowSelection(createRow(2), true)
      expect(result.isSelected(createRow(2))).toBe(false)
    })

    it('should respect selectableFn with Ctrl+Click', () => {
      const selectableFnGetter = () => (row: { id: number }) => row.id !== 2
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        selectableFn: selectableFnGetter,
      })

      result.toggleRowSelection(createRow(1), true)
      // Ctrl+Click on non-selectable row should be blocked
      result.toggleRowSelection(createRow(2), undefined, false, { ctrlKey: true })
      expect(result.isSelected(createRow(2))).toBe(false)
      expect(result.getSelectedCount()).toBe(1)

      // Ctrl+Click on selectable row should work
      result.toggleRowSelection(createRow(3), undefined, false, { ctrlKey: true })
      expect(result.isSelected(createRow(3))).toBe(true)
      expect(result.getSelectedCount()).toBe(2)
    })

    it('should respect selectableFn with Shift+Click (no anchor)', () => {
      const selectableFnGetter = () => (row: { id: number }) => row.id !== 2
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        selectableFn: selectableFnGetter,
      })

      // Shift+Click with no anchor falls back to single toggle
      result.toggleRowSelection(createRow(2), undefined, false, { shiftKey: true })
      expect(result.isSelected(createRow(2))).toBe(false)
    })
  })

  describe('toggleAllSelection', () => {
    it('should toggle all selection', () => {
      const result = createSelectionState()
      result.toggleAllSelection(allData)
      expect(result.selectedKeys.value.size).toBe(5)
    })

    it('should toggle off when all selected', () => {
      const result = createSelectionState()
      result.selectedKeys.value = new Set(['1', '2', '3', '4', '5'])
      result.toggleAllSelection(allData)
      expect(result.selectedKeys.value.size).toBe(0)
    })
  })

  describe('getCheckStatus', () => {
    it('should return correct check status when none selected', () => {
      const result = createSelectionState()
      const status = result.getCheckStatus(allData)
      expect(status.isAllSelected).toBe(false)
      expect(status.isIndeterminate).toBe(false)
    })

    it('should return correct check status when all selected', () => {
      const result = createSelectionState()
      result.selectedKeys.value = new Set(['1', '2', '3', '4', '5'])
      const status = result.getCheckStatus(allData)
      expect(status.isAllSelected).toBe(true)
      expect(status.isIndeterminate).toBe(false)
    })

    it('should return correct check status when partially selected', () => {
      const result = createSelectionState()
      result.selectedKeys.value = new Set(['1', '2'])
      const status = result.getCheckStatus(allData)
      expect(status.isAllSelected).toBe(false)
      expect(status.isIndeterminate).toBe(true)
    })
  })

  describe('getSelectedRows', () => {
    it('should return selected rows from allData', () => {
      const result = createSelectionState()
      result.selectedKeys.value = new Set(['1', '3'])
      const rows = result.getSelectedRows()
      expect(rows).toHaveLength(2)
      expect(rows.map(r => r.id)).toEqual([1, 3])
    })
  })

  describe('initSelectionByKeys', () => {
    it('should initialize selection by key array', () => {
      const result = createSelectionState()
      result.initSelectionByKeys(['1', '3'])
      expect(result.selectedKeys.value.size).toBe(2)
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(3))).toBe(true)
    })
  })

  describe('selectAll and clear', () => {
    it('selectAll selects only visible rows', () => {
      const result = createSelectionState()
      const visible = [createRow(1), createRow(2)]
      result.selectAll(visible)
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(2))).toBe(true)
      expect(result.isSelected(createRow(3))).toBe(false)
    })

    it('clearSelection clears all selections', () => {
      const result = createSelectionState()
      result.selectedKeys.value = new Set(['1', '2', '3', '4', '5'])
      result.clearSelection()
      expect(result.selectedKeys.value.size).toBe(0)
    })

    it('clearVisibleRows only clears visible rows', () => {
      const result = createSelectionState()
      result.selectedKeys.value = new Set(['1', '2', '3', '4', '5'])
      const visible = [createRow(1), createRow(2)]
      result.clearVisibleRows(visible)
      expect(result.isSelected(createRow(1))).toBe(false)
      expect(result.isSelected(createRow(3))).toBe(true)
    })
  })

  describe('single selection mode', () => {
    it('only allows one selection at a time', () => {
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        selectionMode: 'single',
      })
      result.toggleRowSelection(createRow(1))
      result.toggleRowSelection(createRow(2))
      expect(result.isSelected(createRow(1))).toBe(false)
      expect(result.isSelected(createRow(2))).toBe(true)
      expect(result.selectedKeys.value.size).toBe(1)
    })
  })

  describe('iteration and query', () => {
    it('forEachSelected iterates over selected rows', () => {
      const result = createSelectionState()
      result.selectedKeys.value = new Set(['1', '3'])
      const ids: number[] = []
      result.forEachSelected(row => ids.push(row.id))
      expect(ids).toEqual([1, 3])
    })

    it('getSelectedIndices returns indices in allData', () => {
      const result = createSelectionState()
      result.selectedKeys.value = new Set(['1', '3'])
      const indices = result.getSelectedIndices(allData)
      expect(indices).toEqual([0, 2])
    })

    it('reselecting already selected row no-ops', () => {
      const result = createSelectionState()
      result.toggleRowSelection(createRow(1))
      const before = new Set(result.selectedKeys.value)
      result.toggleRowSelection(createRow(1), true)
      expect(result.selectedKeys.value).toEqual(before)
    })
  })

  describe('emits', () => {
    it('onSelectionChange emitted when selection changes', () => {
      const onSelectionChange = vi.fn()
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
      }, { onSelectionChange })
      result.toggleRowSelection(createRow(1))
      expect(onSelectionChange).toHaveBeenCalledTimes(1)
    })

    it('onSelect emitted when selecting a row', () => {
      const onSelect = vi.fn()
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
      }, { onSelect })
      result.toggleRowSelection(createRow(1))
      expect(onSelect).toHaveBeenCalledTimes(1)
    })

    it('onSelectAll emitted when selectAll is called', () => {
      const onSelectAll = vi.fn()
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
      }, { onSelectAll })
      result.selectAll([createRow(1), createRow(2)])
      expect(onSelectAll).toHaveBeenCalledTimes(1)
    })
  })

  describe('selectRowByKey', () => {
    it('selects a row by key', () => {
      const result = createSelectionState()
      result.selectRowByKey('1')
      expect(result.isSelectedByKey('1')).toBe(true)
    })

    it('deselects a row by key', () => {
      const result = createSelectionState()
      result.selectRowByKey('1')
      result.selectRowByKey('1', false)
      expect(result.isSelectedByKey('1')).toBe(false)
    })

    it('single mode: only one selected at a time', () => {
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        selectionMode: 'single',
      })
      result.selectRowByKey('1')
      result.selectRowByKey('2')
      expect(result.isSelectedByKey('1')).toBe(false)
      expect(result.isSelectedByKey('2')).toBe(true)
    })
  })

  describe('isSelectedByKey', () => {
    it('returns true for selected key', () => {
      const result = createSelectionState()
      result.selectRowByKey('1')
      expect(result.isSelectedByKey('1')).toBe(true)
    })

    it('returns false for non-selected key', () => {
      const result = createSelectionState()
      expect(result.isSelectedByKey('1')).toBe(false)
    })
  })

  describe('getSelectedKeys', () => {
    it('returns all selected keys', () => {
      const result = createSelectionState()
      result.initSelectionByKeys(['1', '3'])
      const keys = result.getSelectedKeys()
      expect(keys).toEqual(expect.arrayContaining(['1', '3']))
    })
  })

  describe('getSelectedCount', () => {
    it('returns correct count', () => {
      const result = createSelectionState()
      expect(result.getSelectedCount()).toBe(0)
      result.initSelectionByKeys(['1', '2'])
      expect(result.getSelectedCount()).toBe(2)
    })
  })

  describe('selectAll', () => {
    it('selects all filtered rows', () => {
      const result = createSelectionState()
      result.selectAll([createRow(1), createRow(2)])
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(2))).toBe(true)
      expect(result.isSelected(createRow(3))).toBe(false)
    })
  })

  describe('clearVisibleRows', () => {
    it('deselects only filtered rows', () => {
      const result = createSelectionState()
      result.initSelectionByKeys(['1', '2', '3'])
      result.clearVisibleRows([createRow(1), createRow(2)])
      expect(result.isSelected(createRow(1))).toBe(false)
      expect(result.isSelected(createRow(2))).toBe(false)
      expect(result.isSelected(createRow(3))).toBe(true)
    })
  })

  describe('replaceSelection', () => {
    it('replaces entire selection with given rows', () => {
      const result = createSelectionState()
      result.initSelectionByKeys(['1', '2'])
      result.replaceSelection([createRow(3), createRow(4)])
      expect(result.isSelected(createRow(1))).toBe(false)
      expect(result.isSelected(createRow(3))).toBe(true)
      expect(result.isSelected(createRow(4))).toBe(true)
      expect(result.getSelectedCount()).toBe(2)
    })
  })

  describe('clearSelection', () => {
    it('clears all selections', () => {
      const result = createSelectionState()
      result.initSelectionByKeys(['1', '2', '3'])
      result.clearSelection()
      expect(result.getSelectedCount()).toBe(0)
    })
  })

  describe('setSelection', () => {
    it('selects given rows', () => {
      const result = createSelectionState()
      result.setSelection([createRow(1), createRow(2)])
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(2))).toBe(true)
    })

    it('deselects given rows when selected=false', () => {
      const result = createSelectionState()
      result.initSelectionByKeys(['1', '2', '3'])
      result.setSelection([createRow(1)], false)
      expect(result.isSelected(createRow(1))).toBe(false)
      expect(result.isSelected(createRow(2))).toBe(true)
    })

    it('no-ops on empty rows array', () => {
      const result = createSelectionState()
      result.setSelection([])
      expect(result.getSelectedCount()).toBe(0)
    })
  })

  describe('getCheckStatus with custom selectableFn', () => {
    it('respects custom selectableFn passed directly', () => {
      const result = createSelectionState()
      result.initSelectionByKeys(['1'])
      const status = result.getCheckStatus(
        [createRow(1), createRow(2), createRow(3)],
        row => row.id !== 2,
      )
      expect(status.isAllSelected).toBe(false)
      expect(status.isIndeterminate).toBe(true)
    })
  })

  describe('rowMultiSelectWithClick', () => {
    it('when false, row-click (selected=undefined) clears previous and selects only clicked row', () => {
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        rowMultiSelectWithClick: false,
      })
      result.initSelectionByKeys(['1', '2'])
      // Simulate row click (no selected parameter)
      result.toggleRowSelection(createRow(3))
      expect(result.isSelected(createRow(1))).toBe(false)
      expect(result.isSelected(createRow(2))).toBe(false)
      expect(result.isSelected(createRow(3))).toBe(true)
      expect(result.getSelectedCount()).toBe(1)
    })

    it('when false, re-clicking an already selected row clears others and keeps only it', () => {
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        rowMultiSelectWithClick: false,
      })
      result.initSelectionByKeys(['1', '2'])
      // Click on already-selected row 2
      result.toggleRowSelection(createRow(2))
      expect(result.isSelected(createRow(1))).toBe(false)
      expect(result.isSelected(createRow(2))).toBe(true)
      expect(result.getSelectedCount()).toBe(1)
    })

    it('when false, checkbox-click (selected=true) still appends', () => {
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        rowMultiSelectWithClick: false,
      })
      result.initSelectionByKeys(['1'])
      result.toggleRowSelection(createRow(2), true)
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(2))).toBe(true)
      expect(result.getSelectedCount()).toBe(2)
    })

    it('when false, checkbox-click (selected=false) deselects without side effects', () => {
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        rowMultiSelectWithClick: false,
      })
      result.initSelectionByKeys(['1', '2'])
      result.toggleRowSelection(createRow(2), false)
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(2))).toBe(false)
      expect(result.getSelectedCount()).toBe(1)
    })

    it('when true (default), row-click appends without clearing', () => {
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        rowMultiSelectWithClick: true,
      })
      result.initSelectionByKeys(['1'])
      result.toggleRowSelection(createRow(2))
      // Should append, not replace
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(2))).toBe(true)
      expect(result.getSelectedCount()).toBe(2)
    })

    it('when undefined (legacy default), row-click appends', () => {
      const result = createSelectionState()
      result.initSelectionByKeys(['1'])
      result.toggleRowSelection(createRow(2))
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(2))).toBe(true)
      expect(result.getSelectedCount()).toBe(2)
    })

    it('when false, Ctrl+Click still toggles single row without clearing', () => {
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        rowMultiSelectWithClick: false,
      })
      result.initSelectionByKeys(['1', '2'])
      // Ctrl+Click on row 3 should add it without clearing others
      result.toggleRowSelection(createRow(3), undefined, false, { ctrlKey: true })
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(2))).toBe(true)
      expect(result.isSelected(createRow(3))).toBe(true)
      expect(result.getSelectedCount()).toBe(3)
    })

    it('when false, Ctrl+Click on already selected row deselects it only', () => {
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        rowMultiSelectWithClick: false,
      })
      result.initSelectionByKeys(['1', '2', '3'])
      // Ctrl+Click on row 2 should deselect only row 2
      result.toggleRowSelection(createRow(2), undefined, false, { ctrlKey: true })
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(2))).toBe(false)
      expect(result.isSelected(createRow(3))).toBe(true)
      expect(result.getSelectedCount()).toBe(2)
    })

    it('when false, Shift+Click range select still works without side effects', () => {
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        rowMultiSelectWithClick: false,
      })
      // Set anchor at row 1 (index 0)
      result.setLastClickedKey('1')
      result.initSelectionByKeys(['1'])
      // Shift+Click on row 3 (index 2) — range select rows 1-3
      result.toggleRowSelection(createRow(3), undefined, false, { shiftKey: true })
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.isSelected(createRow(2))).toBe(true)
      expect(result.isSelected(createRow(3))).toBe(true)
      expect(result.getSelectedCount()).toBe(3)
    })

    it('emits onSelectionChange when rowMultiSelectWithClick clears and selects', () => {
      const onSelectionChange = vi.fn()
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        rowMultiSelectWithClick: false,
      }, { onSelectionChange })
      result.initSelectionByKeys(['1', '2'])
      onSelectionChange.mockClear()
      result.toggleRowSelection(createRow(3))
      expect(onSelectionChange).toHaveBeenCalledTimes(1)
      const selected = onSelectionChange.mock.calls[0][0]
      expect(selected).toHaveLength(1)
      expect(selected[0].id).toBe(3)
    })
  })

  describe('selectableFn filtering on batch selection', () => {
    /**
     * 验证受控选择入口（initSelectionByKeys）同样尊重 selectableFn 返回 false 的行——
     * 对应 2.7 demo "选择 1,3,5，其中 5 为 disabled" 场景的核心回归保护。
     */
    const selectableFnGetter = () => (row: { id: number }) => row.id !== 5
    const keyToIndexMap = new Map(allData.map((row, i) => [String(row.id), i]))

    function createSelectionStateWithSelectable() {
      return useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        selectableFn: selectableFnGetter,
        keyToIndexMap: () => keyToIndexMap,
      })
    }

    it('initSelectionByKeys should filter out disabled rows', () => {
      const result = createSelectionStateWithSelectable()
      // 包含 id=5（disabled）的 keys
      result.initSelectionByKeys(['1', '3', '5'])
      expect(result.isSelectedByKey('1')).toBe(true)
      expect(result.isSelectedByKey('3')).toBe(true)
      // id=5 被 selectableFn 禁用，因而不应被选中
      expect(result.isSelectedByKey('5')).toBe(false)
      expect(result.getSelectedCount()).toBe(2)
    })

    it('initSelectionByKeys with all disabled keys results in empty selection', () => {
      const result = createSelectionStateWithSelectable()
      result.initSelectionByKeys(['5'])
      expect(result.getSelectedCount()).toBe(0)
    })

    it('setSelection should skip disabled rows when selecting', () => {
      const result = createSelectionStateWithSelectable()
      // rows 中不含 id=5（disabled 行不参与）
      result.setSelection([createRow(1), createRow(5), createRow(3)])
      expect(result.isSelectedByKey('1')).toBe(true)
      expect(result.isSelectedByKey('3')).toBe(true)
      expect(result.isSelectedByKey('5')).toBe(false)
    })

    it('setSelection can still deselect disabled rows (deselect not blocked)', () => {
      const result = createSelectionStateWithSelectable()
      // 树形手动勾选时 disabled 行保持未选中状态（模拟真实树表行为）
      result.selectedKeys.value = new Set(['1', '5'])
      // 取消选中不应受 selectableFn 阻止
      result.setSelection([createRow(1), createRow(5)], false)
      expect(result.isSelectedByKey('1')).toBe(false)
      expect(result.isSelectedByKey('5')).toBe(false)
    })

    it('selectRowsByKeys should skip disabled rows when selecting', () => {
      const result = createSelectionStateWithSelectable()
      // keys 中含 id=5（disabled），应被忽略
      result.selectRowsByKeys(['1', '5', '3'], true)
      expect(result.isSelectedByKey('1')).toBe(true)
      expect(result.isSelectedByKey('3')).toBe(true)
      expect(result.isSelectedByKey('5')).toBe(false)
    })

    it('selectRowsByKeys can deselect disabled rows (deselect not blocked)', () => {
      const result = createSelectionStateWithSelectable()
      result.selectedKeys.value = new Set(['1', '5'])
      result.selectRowsByKeys(['1', '5'], false)
      expect(result.isSelectedByKey('1')).toBe(false)
      expect(result.isSelectedByKey('5')).toBe(false)
    })

    it('initSelectionByKeys without selectableFn selects all keys', () => {
      const result = createSelectionState()
      result.initSelectionByKeys(['1', '5'])
      expect(result.isSelectedByKey('1')).toBe(true)
      expect(result.isSelectedByKey('5')).toBe(true)
    })

    it('initSelectionByKeys preserves keys for rows not in current data (cross-page)', () => {
      const result = createSelectionStateWithSelectable()
      // '99' 不在当前数据集中，应被安全忽略
      result.initSelectionByKeys(['1', '99'])
      expect(result.isSelectedByKey('1')).toBe(true)
      expect(result.isSelectedByKey('99')).toBe(true)
    })
  })

  describe('pruneOnRowMapChange (keepSelectionAcrossPages)', () => {
    it('prunes selected keys missing from the new rowMap by default', () => {
      const onSelectionChange = vi.fn()
      const map = ref(new Map([['1', createRow(1)], ['2', createRow(2)], ['3', createRow(3)]]))
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => map.value,
      }, { onSelectionChange })

      result.toggleRowSelection(createRow(1), true)
      result.toggleRowSelection(createRow(2), true)
      expect(result.getSelectedKeys()).toEqual(['1', '2'])

      map.value = new Map([['4', createRow(4)], ['5', createRow(5)], ['6', createRow(6)]])
      expect(result.getSelectedKeys().length).toBe(0)
      expect(onSelectionChange).toHaveBeenCalled()
    })

    it('keeps selected keys when pruneOnRowMapChange is false (keepSelectionAcrossPages)', () => {
      const onSelectionChange = vi.fn()
      const map = ref(new Map([['1', createRow(1)], ['2', createRow(2)]]))
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => map.value,
        pruneOnRowMapChange: false,
      }, { onSelectionChange })

      result.toggleRowSelection(createRow(1), true)
      result.toggleRowSelection(createRow(2), true)
      const emitsBeforeSwap = onSelectionChange.mock.calls.length
      map.value = new Map([['3', createRow(3)]])
      expect(result.getSelectedKeys()).toEqual(['1', '2'])
      expect(onSelectionChange.mock.calls.length).toBe(emitsBeforeSwap)
    })

    it('responds reactively to a changing pruneOnRowMapChange flag', () => {
      const pruneFlag = ref(true)
      const map = ref(new Map([['1', createRow(1)], ['2', createRow(2)]]))
      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => map.value,
        pruneOnRowMapChange: pruneFlag,
      })

      result.toggleRowSelection(createRow(1), true)
      map.value = new Map([['3', createRow(3)]])
      expect(result.getSelectedKeys().length).toBe(0)

      pruneFlag.value = false
      result.toggleRowSelection(createRow(3), true)
      map.value = new Map([['4', createRow(4)]])
      expect(result.getSelectedKeys()).toEqual(['3'])

      pruneFlag.value = true
      result.toggleRowSelection(createRow(4), true)
      map.value = new Map([['5', createRow(5)]])
      expect(result.getSelectedKeys()).toEqual(['3'])
    })
  })

  describe('parent listener fault isolation (safeNotify)', () => {
    it('keeps the committed selection intact when onSelectionChange throws', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const subsequentPayloads: unknown[] = []

      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
      }, {
        onSelectionChange: () => {
          throw new Error('listener boom')
        },
        onSelect: payload => subsequentPayloads.push(payload),
        onRowSelected: payload => subsequentPayloads.push(payload),
      })

      // 父监听器异常不得冒泡到调用方，也不得回滚已提交的 selectedKeys
      // A throwing parent listener must not bubble up nor roll back the committed selectedKeys
      expect(() => result.toggleRowSelection(createRow(1), true)).not.toThrow()
      expect(result.isSelected(createRow(1))).toBe(true)
      expect(result.getSelectedKeys()).toEqual(['1'])

      // 同批后续通知仍要触发（onSelect / onRowSelected 不被前序抛错吞掉）
      // Subsequent notifications in the same batch still fire
      expect(subsequentPayloads).toHaveLength(2)

      warnSpy.mockRestore()
    })

    it('does not break the rowMap pruning path when the listener throws', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const map = ref(new Map([['1', createRow(1)], ['2', createRow(2)]]))

      const result = useSelectionState({
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => map.value,
      }, {
        onSelectionChange: () => {
          throw new Error('listener boom')
        },
      })

      result.toggleRowSelection(createRow(1), true)
      // 剪除补发同样经 safeNotify——异常不得中断 sync watcher 的状态提交
      // The pruning re-emit also goes through safeNotify — the exception must not break the sync watcher
      expect(() => {
        map.value = new Map([['3', createRow(3)]])
      }).not.toThrow()
      expect(result.getSelectedKeys()).toEqual([])

      warnSpy.mockRestore()
    })
  })
})
