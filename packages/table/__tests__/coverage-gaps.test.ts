/**
 * <zh/> 覆盖率补充测试 — 针对覆盖率低于 90% 的模块补充边界用例 | <en/> Coverage gap tests — supplementary edge cases for modules below 90%
 */
import type { ProcessedColumn } from '../src/types'
import type { EditConfig, EditingCellState } from '../src/types/edit'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import { withHeaderDragEndHandler } from '../src/components/renderer-core/event-bindings'
import { extractColumnRenderProps, hasCustomRender, NO_TOOLTIP_VALUE_TYPES, renderColumnSlot, renderHeaderCell, renderHeaderSlot, renderSortIndicator } from '../src/components/renderer-core/render-helpers'
import { useEditDirty } from '../src/composables/editing/use-edit-dirty'
import { useTableSummary } from '../src/composables/features/use-table-summary'
import { useSelectionState } from '../src/composables/selection/use-selection-state'
import { getColumnKey } from '../src/utils/shared'

// ── event-bindings.ts ──

describe('event-bindings coverage gaps', () => {
  it('withHeaderDragEndHandler replaces headerDragend with new handler', () => {
    const newCb = vi.fn()
    const emit = vi.fn()
    const events = { headerDragend: vi.fn() }
    const merged = withHeaderDragEndHandler(events as any, { emit, onHeaderDragEnd: newCb } as any)
    merged.headerDragend({ col: 'x' })
    expect(newCb).toHaveBeenCalledWith({ col: 'x' })
    expect(events.headerDragend).toHaveBeenCalledWith({ col: 'x' })
  })
})

// ── render-helpers.ts ──

describe('render-helpers coverage gaps', () => {
  it('renderHeaderCell returns empty string for column without label/prop', () => {
    const result = renderHeaderCell({ hidden: false } as any)
    expect(result).toBe('')
  })

  it('renderSortIndicator returns null for non-sortable column with order', () => {
    const result = renderSortIndicator({ prop: 'x', hidden: false } as any, 'ascending')
    expect(result).toBeNull()
  })

  it('hasCustomRender returns false for column without renderer/slot', () => {
    expect(hasCustomRender({ prop: 'x', hidden: false } as any, {}, 'x')).toBe(false)
  })

  it('hasCustomRender returns true for cellComponent', () => {
    expect(hasCustomRender({ prop: 'x', cellComponent: {}, hidden: false } as any, {}, 'x')).toBe(true)
  })

  it('extractColumnRenderProps keeps width and align', () => {
    const result = extractColumnRenderProps({
      prop: 'x',
      label: 'X',
      width: 100,
      align: 'center',
      cellRenderer: () => 'x',
      cellComponent: undefined,
      headerCellRenderer: undefined,
      format: undefined,
      valueType: undefined,
      valueEnum: undefined,
      copyable: undefined,
      ellipsis: undefined,
      showOverflowTooltip: undefined,
      filter: undefined,
      sortable: undefined,
      merge: undefined,
      colMerge: undefined,
      children: undefined,
      hidden: false,
    } as any)
    expect(result).toHaveProperty('prop', 'x')
    expect(result).toHaveProperty('label', 'X')
    expect(result).toHaveProperty('width', 100)
    expect(result).toHaveProperty('align', 'center')
    expect(result).not.toHaveProperty('cellRenderer')
  })

  it('renderHeaderSlot uses key for slot lookup when prop differs', () => {
    const slots = { 'customKey-header': () => [null] }
    const result = renderHeaderSlot({ key: 'customKey', prop: 'name', hidden: false } as any, slots)
    expect(result).toBeNull()
  })

  it('renderColumnSlot returns null for empty slot result', () => {
    const slots = { name: () => [] }
    const result = renderColumnSlot({ prop: 'name', hidden: false } as any, slots)
    expect(result).toBeNull()
  })

  it('nO_TOOLTIP_VALUE_TYPES does not contain number type', () => {
    expect(NO_TOOLTIP_VALUE_TYPES.has('number')).toBe(false)
    expect(NO_TOOLTIP_VALUE_TYPES.has('money')).toBe(false)
  })
})

// ── use-edit-dirty.ts ──

describe('use-edit-dirty coverage gaps', () => {
  function createDeps(overrides: Record<string, any> = {}) {
    const data = ref([{ id: '1', name: 'Alice' }])
    const columns = computed(() => [{ prop: 'name', label: 'Name', hidden: false }] as ProcessedColumn[])
    const editConfig = computed<EditConfig | undefined>(() => ({ showStatus: true }))
    const rowKey = computed<((row: any) => string) | null>(() => (row: any) => row.id)
    const editingCell = shallowRef<EditingCellState | null>(null)
    return { data, columns, editConfig, rowKey, editingCell, ...overrides }
  }

  it('clears dirty cells when rowKey is null and data changes', async () => {
    const deps = createDeps({
      rowKey: computed<((row: any) => string) | null>(() => null),
    })

    const dirty = useEditDirty(deps as any)

    dirty.recordOriginalValue(0, 'name', 'Alice')
    // rowKey is null, so recordOriginalValue returns early
    expect(dirty.dirtyCells.value.size).toBe(0)
  })

  it('columnKeyMap is computed from columns', () => {
    const deps = createDeps({
      columns: computed(() => [
        { prop: 'name', label: 'Name', hidden: false },
        { prop: 'age', label: 'Age', hidden: false },
      ] as ProcessedColumn[]),
    })

    const dirty = useEditDirty(deps as any)

    expect(dirty.columnKeyMap.value.size).toBe(2)
    expect(dirty.columnKeyMap.value.has('name')).toBe(true)
    expect(dirty.columnKeyMap.value.has('age')).toBe(true)
  })

  it('clearDirtyCell removes specific cell', () => {
    const dataRef = ref([{ id: '1', name: 'Alice', age: 25 }])
    const deps = createDeps({
      data: dataRef,
      columns: computed(() => [
        { prop: 'name', label: 'Name', hidden: false },
        { prop: 'age', label: 'Age', hidden: false },
      ] as ProcessedColumn[]),
    })

    const dirty = useEditDirty(deps as any)

    dirty.recordOriginalValue(0, 'name', 'Alice')
    dirty.recordOriginalValue(0, 'age', 25)

    // Change data so cells are dirty (current != original)
    dataRef.value = [{ id: '1', name: 'Bob', age: 30 }]

    expect(dirty.isCellDirty(0, 'name')).toBe(true)
    expect(dirty.isCellDirty(0, 'age')).toBe(true)

    dirty.clearDirtyCell(0, 'name')
    expect(dirty.isCellDirty(0, 'name')).toBe(false)
    expect(dirty.isCellDirty(0, 'age')).toBe(true)
  })
})

// ── use-selection-state.ts (additional coverage) ──

describe('use-selection-state additional coverage', () => {
  it('toggleRowSelection toggles and calls callbacks', () => {
    const data = [{ id: '1', name: 'Alice' }]
    const rowMap = new Map(data.map(r => [r.id, r]))
    const onSelectionChange = vi.fn()
    const onSelect = vi.fn()
    const onRowSelected = vi.fn()

    const state = useSelectionState({
      rowKey: () => (r: any) => r.id,
      allData: () => data,
      rowMap: () => rowMap,
    }, { onSelectionChange, onSelect, onRowSelected })

    state.toggleRowSelection(data[0], true)
    expect(state.isSelectedByKey('1')).toBe(true)
    expect(onSelectionChange).toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalled()
    expect(onRowSelected).toHaveBeenCalledWith({ row: data[0], selected: true })

    state.toggleRowSelection(data[0], false)
    expect(state.isSelectedByKey('1')).toBe(false)
  })

  it('replaceSelection replaces all selected rows', () => {
    const data = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const rowMap = new Map(data.map(r => [r.id, r]))

    const state = useSelectionState({
      rowKey: () => (r: any) => r.id,
      allData: () => data,
      rowMap: () => rowMap,
    })

    state.initSelectionByKeys(['1', '2'])
    expect(state.getSelectedCount()).toBe(2)

    state.replaceSelection([data[2]])
    expect(state.getSelectedCount()).toBe(1)
    expect(state.isSelectedByKey('3')).toBe(true)
    expect(state.isSelectedByKey('1')).toBe(false)
  })

  it('forEachSelected iterates over all selected rows', () => {
    const data = [{ id: '1' }, { id: '2' }]
    const rowMap = new Map(data.map(r => [r.id, r]))

    const state = useSelectionState({
      rowKey: () => (r: any) => r.id,
      allData: () => data,
      rowMap: () => rowMap,
    })

    state.initSelectionByKeys(['1', '2'])
    const keys: string[] = []
    state.forEachSelected(row => keys.push(row.id))
    expect(keys).toEqual(expect.arrayContaining(['1', '2']))
  })

  it('selectRowByKey selects and deselects by key', () => {
    const data = [{ id: '1' }, { id: '2' }]
    const rowMap = new Map(data.map(r => [r.id, r]))

    const state = useSelectionState({
      rowKey: () => (r: any) => r.id,
      allData: () => data,
      rowMap: () => rowMap,
    })

    state.selectRowByKey('1', true)
    expect(state.isSelectedByKey('1')).toBe(true)

    state.selectRowByKey('1', false)
    expect(state.isSelectedByKey('1')).toBe(false)
  })

  it('setSelection adds rows to existing selection', () => {
    const data = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const rowMap = new Map(data.map(r => [r.id, r]))

    const state = useSelectionState({
      rowKey: () => (r: any) => r.id,
      allData: () => data,
      rowMap: () => rowMap,
    })

    state.initSelectionByKeys(['1'])
    state.setSelection([data[1], data[2]])
    expect(state.getSelectedCount()).toBe(3)
    expect(state.isSelectedByKey('1')).toBe(true)
    expect(state.isSelectedByKey('2')).toBe(true)
    expect(state.isSelectedByKey('3')).toBe(true)
  })

  it('setSelection removes rows when selected=false', () => {
    const data = [{ id: '1' }, { id: '2' }]
    const rowMap = new Map(data.map(r => [r.id, r]))

    const state = useSelectionState({
      rowKey: () => (r: any) => r.id,
      allData: () => data,
      rowMap: () => rowMap,
    })

    state.initSelectionByKeys(['1', '2'])
    state.setSelection([data[0]], false)
    expect(state.getSelectedCount()).toBe(1)
    expect(state.isSelectedByKey('2')).toBe(true)
    expect(state.isSelectedByKey('1')).toBe(false)
  })

  it('setSelection is no-op when rows is empty', () => {
    const data = [{ id: '1' }]
    const rowMap = new Map(data.map(r => [r.id, r]))

    const state = useSelectionState({
      rowKey: () => (r: any) => r.id,
      allData: () => data,
      rowMap: () => rowMap,
    })

    state.initSelectionByKeys(['1'])
    state.setSelection([])
    expect(state.getSelectedCount()).toBe(1)
  })

  it('clearVisibleRows clears only visible rows', () => {
    const data = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const rowMap = new Map(data.map(r => [r.id, r]))

    const state = useSelectionState({
      rowKey: () => (r: any) => r.id,
      allData: () => data,
      rowMap: () => rowMap,
    })

    state.selectAll(data)
    expect(state.getSelectedCount()).toBe(3)

    state.clearVisibleRows([data[0], data[1]])
    expect(state.isSelectedByKey('1')).toBe(false)
    expect(state.isSelectedByKey('2')).toBe(false)
    expect(state.isSelectedByKey('3')).toBe(true)
  })

  it('getSelectedRows returns selected row objects', () => {
    const data = [{ id: '1' }, { id: '2' }]
    const rowMap = new Map(data.map(r => [r.id, r]))

    const state = useSelectionState({
      rowKey: () => (r: any) => r.id,
      allData: () => data,
      rowMap: () => rowMap,
    })

    state.initSelectionByKeys(['1'])
    const rows = state.getSelectedRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('1')
  })
})

// ── use-table-summary.ts (additional coverage) ──

describe('use-table-summary additional coverage', () => {
  it('returns empty summary for no columns', () => {
    const summary = useTableSummary({
      showSummary: true,
      data: [],
      columns: [],
      sumText: '合计',
    })

    expect(summary.summaryData.value).toEqual({})
  })

  it('uses custom summaryMethod when provided', () => {
    const data = [{ id: '1', score: 90 }, { id: '2', score: 80 }]
    const columns = [
      { prop: 'name', label: 'Name', hidden: false },
      { prop: 'score', label: 'Score', hidden: false },
    ] as ProcessedColumn[]

    const summary = useTableSummary({
      showSummary: true,
      data,
      columns,
      sumText: '合计',
      summaryMethod: (params: any) => {
        return params.columns.map((col: any) => {
          if (col.prop === 'score')
            return params.data.reduce((sum: number, row: any) => sum + (row.score ?? 0), 0)
          return ''
        })
      },
    })

    const summaryData = summary.summaryData.value
    expect(summaryData).toBeDefined()
    expect(summaryData.score).toBe(170)
  })

  it('returns empty when showSummary is false', () => {
    const summary = useTableSummary({
      showSummary: false,
      data: [],
      columns: [],
      sumText: '合计',
    })

    expect(summary.summaryData.value).toEqual({})
  })

  it('calculates default sum for numeric columns', () => {
    const data = [{ id: '1', name: 'A', score: 90 }, { id: '2', name: 'B', score: 80 }]
    const columns = [
      { prop: 'name', label: 'Name', hidden: false },
      { prop: 'score', label: 'Score', hidden: false },
    ] as ProcessedColumn[]

    const summary = useTableSummary({
      showSummary: true,
      data,
      columns,
      sumText: '合计',
    })

    const summaryData = summary.summaryData.value
    expect(summaryData.name).toBe('合计')
    expect(summaryData.score).toBe('170')
  })

  it('getSummaryValue returns value by column key', () => {
    const data = [{ id: '1', score: 90 }]
    const columns = [
      { prop: 'name', label: 'Name', hidden: false },
      { prop: 'score', label: 'Score', hidden: false },
    ] as ProcessedColumn[]

    const summary = useTableSummary({
      showSummary: true,
      data,
      columns,
      sumText: '合计',
    })

    expect(summary.getSummaryValue({ prop: 'name' })).toBe('合计')
    expect(summary.getSummaryValue({ prop: 'score' })).toBe('90')
  })
})

// ── utils/shared.ts (additional coverage) ──

describe('utils/shared additional coverage', () => {
  it('getColumnKey handles numeric prop', () => {
    expect(getColumnKey({ prop: 123, hidden: false } as any)).toBe('123')
  })

  it('getColumnKey handles object with both key and prop', () => {
    expect(getColumnKey({ key: 'k', prop: 'p', hidden: false } as any)).toBe('k')
  })

  it('getColumnKey returns empty string for empty object', () => {
    expect(getColumnKey({} as any)).toBe('')
  })
})
