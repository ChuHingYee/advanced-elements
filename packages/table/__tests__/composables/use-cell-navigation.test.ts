import type { ProcessedColumn } from '../../src/types'
import type { EditConfig } from '../../src/types/edit'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { useCellNavigation } from '../../src/composables/editing/use-cell-navigation'

interface TestRow { id: string, name: string, age: number }

function createColumns(overrides: Partial<ProcessedColumn>[] = []): ProcessedColumn[] {
  const defaults: ProcessedColumn[] = [
    { prop: 'name', label: 'Name', editable: true, cellEditor: 'text', hidden: false } as unknown as ProcessedColumn,
    { prop: 'age', label: 'Age', editable: true, cellEditor: 'number', hidden: false } as unknown as ProcessedColumn,
    { prop: 'email', label: 'Email', editable: true, cellEditor: 'text', hidden: false } as unknown as ProcessedColumn,
  ]
  return defaults.map((d, i) => ({ ...d, ...overrides[i] }))
}

function createNavigation(options?: {
  columns?: ProcessedColumn[]
  data?: TestRow[]
  editConfig?: EditConfig
}) {
  const editableColumns = computed(() => options?.columns ?? createColumns())
  const data = computed(() => options?.data ?? [
    { id: '1', name: 'Alice', age: 25 },
    { id: '2', name: 'Bob', age: 30 },
    { id: '3', name: 'Charlie', age: 35 },
  ])
  const editConfig = computed(() => options?.editConfig)

  return useCellNavigation<TestRow>({ editableColumns, data, editConfig })
}

describe('useCellNavigation', () => {
  describe('findNextEditableCell - horizontal navigation', () => {
    it('should find next cell in same row', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(0, 'name', 'next')
      expect(result).toEqual({ rowIndex: 0, columnKey: 'age', prop: 'age' })
    })

    it('should find previous cell in same row', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(0, 'age', 'previous')
      expect(result).toEqual({ rowIndex: 0, columnKey: 'name', prop: 'name' })
    })

    it('should wrap to next row when at last column (next direction)', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(0, 'email', 'next')
      expect(result).toEqual({ rowIndex: 1, columnKey: 'name', prop: 'name' })
    })

    it('should wrap to previous row when at first column (previous direction)', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(1, 'name', 'previous')
      expect(result).toEqual({ rowIndex: 0, columnKey: 'email', prop: 'email' })
    })

    it('should return null when wrapping past last row (next direction)', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(2, 'email', 'next')
      expect(result).toBeNull()
    })

    it('should return null when wrapping past first row (previous direction)', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(0, 'name', 'previous')
      expect(result).toBeNull()
    })

    it('should return null when column key not found', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(0, 'nonexistent', 'next')
      expect(result).toBeNull()
    })

    it('should default direction to "next" when not specified', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(0, 'name')
      expect(result).toEqual({ rowIndex: 0, columnKey: 'age', prop: 'age' })
    })
  })

  describe('findNextEditableCell - vertical navigation', () => {
    it('should find next row same column (vertical next)', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(0, 'name', 'next', true)
      expect(result).toEqual({ rowIndex: 1, columnKey: 'name', prop: 'name' })
    })

    it('should find previous row same column (vertical previous)', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(1, 'age', 'previous', true)
      expect(result).toEqual({ rowIndex: 0, columnKey: 'age', prop: 'age' })
    })

    it('should return null when going past last row vertically', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(2, 'name', 'next', true)
      expect(result).toBeNull()
    })

    it('should return null when going past first row vertically', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(0, 'name', 'previous', true)
      expect(result).toBeNull()
    })

    it('should return null when column key not found (vertical)', () => {
      const nav = createNavigation()
      const result = nav.findNextEditableCell(0, 'nonexistent', 'next', true)
      expect(result).toBeNull()
    })
  })

  describe('findNextEditableCell - edge cases', () => {
    it('should return null when no editable columns', () => {
      const nav = createNavigation({ columns: [] })
      const result = nav.findNextEditableCell(0, 'name', 'next')
      expect(result).toBeNull()
    })

    it('should skip prop-less columns (single-cell commit writes by prop)', () => {
      const columns: ProcessedColumn[] = [
        { key: 'action', label: 'Action', editable: true, cellEditor: 'text', hidden: false } as unknown as ProcessedColumn,
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'text', hidden: false } as unknown as ProcessedColumn,
      ]
      const nav = createNavigation({ columns })
      // <zh/> 无 prop 列不可达：从 name 向前应直接出界，而非落到 action 列
      // <en/> Prop-less columns are unreachable: stepping back from name leaves the grid
      expect(nav.findNextEditableCell(0, 'name', 'previous')).toBeNull()
      expect(nav.findFirstEditableCell(0)).toEqual({ rowIndex: 0, columnKey: 'name', prop: 'name' })
      expect(nav.findLastEditableCell(0)).toEqual({ rowIndex: 0, columnKey: 'name', prop: 'name' })
    })

    it('should return null when all editable columns are prop-less', () => {
      const columns: ProcessedColumn[] = [
        { key: 'action', label: 'Action', editable: true, cellEditor: 'text', hidden: false } as unknown as ProcessedColumn,
      ]
      const nav = createNavigation({ columns })
      expect(nav.findNextEditableCell(0, 'action', 'next')).toBeNull()
      expect(nav.findFirstEditableCell(0)).toBeNull()
      expect(nav.findLastEditableCell(0)).toBeNull()
    })

    it('should return null when no data', () => {
      const nav = createNavigation({ data: [] })
      const result = nav.findNextEditableCell(0, 'name', 'next')
      expect(result).toBeNull()
    })

    it('should use custom tabToNextCell function when provided (horizontal only)', () => {
      const customFn = (ctx: { rowIndex: number, columnKey: string, direction: 'next' | 'previous' }) => ({
        rowIndex: ctx.rowIndex + 10,
        columnKey: `custom-${ctx.columnKey}`,
        prop: `custom-${ctx.columnKey}`,
      })
      const nav = createNavigation({ editConfig: { tabToNextCell: customFn } })
      const result = nav.findNextEditableCell(0, 'name', 'next')
      expect(result).toEqual({ rowIndex: 10, columnKey: 'custom-name', prop: 'custom-name' })
    })

    it('should not use custom tabToNextCell for vertical navigation', () => {
      const customFn = vi.fn(() => null)
      const nav = createNavigation({ editConfig: { tabToNextCell: customFn } })
      const result = nav.findNextEditableCell(0, 'name', 'next', true)
      expect(customFn).not.toHaveBeenCalled()
      expect(result).toEqual({ rowIndex: 1, columnKey: 'name', prop: 'name' })
    })
  })

  describe('findFirstEditableCell', () => {
    it('should return first editable cell in the row', () => {
      const nav = createNavigation()
      const result = nav.findFirstEditableCell(0)
      expect(result).toEqual({ rowIndex: 0, columnKey: 'name', prop: 'name' })
    })

    it('should return null when no editable columns', () => {
      const nav = createNavigation({ columns: [] })
      const result = nav.findFirstEditableCell(0)
      expect(result).toBeNull()
    })

    it('should return null when rowIndex is negative', () => {
      const nav = createNavigation()
      const result = nav.findFirstEditableCell(-1)
      expect(result).toBeNull()
    })

    it('should return null when rowIndex is out of bounds', () => {
      const nav = createNavigation()
      const result = nav.findFirstEditableCell(100)
      expect(result).toBeNull()
    })
  })

  describe('findLastEditableCell', () => {
    it('should return last editable cell in the row', () => {
      const nav = createNavigation()
      const result = nav.findLastEditableCell(0)
      expect(result).toEqual({ rowIndex: 0, columnKey: 'email', prop: 'email' })
    })

    it('should return null when no editable columns', () => {
      const nav = createNavigation({ columns: [] })
      const result = nav.findLastEditableCell(0)
      expect(result).toBeNull()
    })

    it('should return null when rowIndex is negative', () => {
      const nav = createNavigation()
      const result = nav.findLastEditableCell(-1)
      expect(result).toBeNull()
    })

    it('should return null when rowIndex is out of bounds', () => {
      const nav = createNavigation()
      const result = nav.findLastEditableCell(100)
      expect(result).toBeNull()
    })
  })
})
