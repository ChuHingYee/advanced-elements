import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import { EMPTY_CELL_STATE, useRowViewModel } from '../../src/composables/view-model/use-row-view-model'

describe('useRowViewModel', () => {
  const columns = computed<ProcessedColumn[]>(() => [
    { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
    { prop: 'age', key: 'age', label: 'Age', hidden: false } as unknown as ProcessedColumn,
  ])

  const data = shallowRef([
    { id: 1, name: 'Alice', age: 25 },
    { id: 2, name: 'Bob', age: 30 },
  ])

  function createRowViewModel(overrides: any = {}) {
    return useRowViewModel({
      visibleData: data,
      rowKeyFn: () => (row: any) => String(row.id),
      isCellEditing: vi.fn(() => false),
      isCellDirty: vi.fn(() => false),
      isCellSelected: vi.fn(() => false),
      columns,
      ...overrides,
    })
  }

  describe('basic functionality', () => {
    it('should build RowViewModel for each visible row', () => {
      const { rowViewModels } = createRowViewModel()
      const vms = rowViewModels.value
      expect(vms).toHaveLength(2)
      expect(vms[0].rowKey).toBe('1')
      expect(vms[0].row).toEqual({ id: 1, name: 'Alice', age: 25 })
      expect(vms[0].rowIndex).toBe(0)
      expect(vms[0].cells).toHaveLength(2)
    })

    it('should return empty array for empty data', () => {
      const { rowViewModels } = useRowViewModel({
        visibleData: shallowRef([]),
        rowKeyFn: () => (row: any) => String(row.id),
        isCellEditing: () => false,
        isCellDirty: () => false,
        isCellSelected: () => false,
        columns,
      })
      expect(rowViewModels.value).toHaveLength(0)
    })
  })

  describe('cellState values', () => {
    it('should use EMPTY_CELL_STATE for cells with no decoration state', () => {
      const { rowViewModels } = createRowViewModel()
      const cellState = rowViewModels.value[0].cells[0]
      expect(cellState).toBe(EMPTY_CELL_STATE)
      expect(cellState.isEditing).toBe(false)
      expect(cellState.isDirty).toBe(false)
      expect(cellState.isRangeSelected).toBe(false)
    })

    it('should build CellState with isEditing=true when cell is editing', () => {
      const { rowViewModels } = createRowViewModel({
        isCellEditing: (rowIndex: number, colKey: string) =>
          rowIndex === 0 && colKey === 'name',
      })
      const cellState = rowViewModels.value[0].cells[0]
      expect(cellState.isEditing).toBe(true)
      expect(cellState.isDirty).toBe(false)
    })

    it('should build CellState with isDirty=true when cell is dirty', () => {
      const { rowViewModels } = createRowViewModel({
        isCellDirty: (rowIndex: number, colKey: string) =>
          rowIndex === 1 && colKey === 'age',
      })
      const cellState = rowViewModels.value[1].cells[1]
      expect(cellState.isDirty).toBe(true)
    })

    it('should build CellState with isRangeSelected=true when cell is in selection', () => {
      const { rowViewModels } = createRowViewModel({
        isCellSelected: (rowIndex: number, colIndex: number) =>
          rowIndex === 0 && colIndex === 1,
      })
      const cellState = rowViewModels.value[0].cells[1]
      expect(cellState.isRangeSelected).toBe(true)
    })
  })

  describe('reference stability', () => {
    it('should reuse EMPTY_CELL_STATE constant for cells with no decoration', () => {
      const { rowViewModels } = createRowViewModel()
      const vm0 = rowViewModels.value[0]
      const vm1 = rowViewModels.value[1]
      // Both rows have no decoration state, should share EMPTY_CELL_STATE
      expect(vm0.cells[0]).toBe(EMPTY_CELL_STATE)
      expect(vm1.cells[0]).toBe(EMPTY_CELL_STATE)
    })
  })

  describe('eMPTY_CELL_STATE', () => {
    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(EMPTY_CELL_STATE)).toBe(true)
    })

    it('should have all decoration states as false', () => {
      expect(EMPTY_CELL_STATE.isEditing).toBe(false)
      expect(EMPTY_CELL_STATE.isDirty).toBe(false)
      expect(EMPTY_CELL_STATE.isRangeSelected).toBe(false)
    })
  })

  describe('selection column domain alignment', () => {
    // <zh/> 渲染端 colIndex 是排除 selection 列的索引，cells 数组必须同域——否则声明式
    // <zh/> { selection: true } 列会使其后所有列的编辑态/脏标/范围高亮整体错位 selectionCount 列。
    // <en/> The renderer's colIndex excludes selection columns, so the cells array must share that
    // <en/> domain — otherwise a declarative { selection: true }
    // <en/> column shifts every later column's editing/dirty/range state by selectionCount.
    it('excludes declarative selection columns so decoration states align with the renderer colIndex domain', () => {
      const selectionCols = computed<ProcessedColumn[]>(() => [
        { prop: '__selection__', key: '__selection__', selection: true, label: '', hidden: false } as unknown as ProcessedColumn,
        { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
        { prop: 'age', key: 'age', label: 'Age', hidden: false } as unknown as ProcessedColumn,
      ])
      const { rowViewModels } = useRowViewModel({
        visibleData: data,
        rowKeyFn: () => (row: any) => String(row.id),
        isCellEditing: (_r: number, colKey: string) => colKey === 'name',
        isCellDirty: () => false,
        isCellSelected: (_r: number, colIndex: number) => colIndex === 1,
        columns: selectionCols,
      })
      const vms = rowViewModels.value
      // selection 列被过滤：cells 只含 name/age 两格（与渲染端 colIndex 域一致）
      expect(vms[0].cells).toHaveLength(2)
      // name 位于过滤后域的下标 0——isEditing 必须落在 cells[0]，不得偏移到 cells[1]
      expect(vms[0].cells[0].isEditing).toBe(true)
      expect(vms[0].cells[1].isEditing).toBe(false)
      // 范围选区同样按过滤后域对齐（colIndex 1 = age）
      expect(vms[0].cells[1].isRangeSelected).toBe(true)
      expect(vms[0].cells[0].isRangeSelected).toBe(false)
    })
  })
})
