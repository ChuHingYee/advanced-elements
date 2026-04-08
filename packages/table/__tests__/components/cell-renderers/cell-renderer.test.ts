import type { AdvColumn } from '../../../src/types/column'
import { describe, expect, it } from 'vitest'
import { h, ref } from 'vue'
import { renderCell } from '../../../src/components/cell-renderers/cell-renderer'

describe('cell-renderer', () => {
  describe('renderCell', () => {
    const baseOptions = {
      rowIndex: 0,
      columnIndex: 0,
      slots: {} as Record<string | symbol, (...args: unknown[]) => any>,
      slotKey: 'name',
    }

    it('should use cellRenderer when present', () => {
      const column = {
        cellRenderer: () => h('span', 'Custom'),
      } as unknown as AdvColumn
      const rowData = { name: 'test' }

      const result = renderCell({ ...baseOptions, column, rowData })
      expect(result).toBeDefined()
    })

    it('should use slot when present', () => {
      const column = { prop: 'name', hidden: false } as unknown as AdvColumn
      const rowData = { name: 'test' }
      const slots = {
        name: ({ row }: any) => h('span', row.name),
      } as Record<string | symbol, (...args: unknown[]) => any>

      const result = renderCell({ ...baseOptions, column, rowData, slots })
      expect(result).toBeDefined()
    })

    it('should use format when present', () => {
      const column = {
        prop: 'name',
        format: () => 'formatted',
        hidden: false,
      } as unknown as AdvColumn
      const rowData = { name: 'test' }

      const result = renderCell({ ...baseOptions, column, rowData })
      expect(result).toBe('formatted')
    })

    it('should convert cellData to string when no valueType/valueEnum', () => {
      const column = { prop: 'name', hidden: false } as unknown as AdvColumn
      const rowData = { name: 123 }

      const result = renderCell({ ...baseOptions, column, rowData })
      expect(result).toBe('123')
    })

    it('should return empty string for undefined cellData', () => {
      const column = { prop: 'name', hidden: false } as unknown as AdvColumn
      const rowData = {}

      const result = renderCell({ ...baseOptions, column, rowData })
      expect(result).toBe('')
    })

    it('should use dataKey when valueType or valueEnum present', () => {
      const column = {
        dataKey: 'user.name',
        prop: 'name',
        valueType: 'text',
        hidden: false,
      } as unknown as AdvColumn
      const rowData = { user: { name: 'test' } }

      const result = renderCell({ ...baseOptions, column, rowData })
      expect(result).toBeDefined()
    })

    it('should use cellComponent when present', () => {
      const column = {
        prop: 'name',
        cellComponent: 'span',
        hidden: false,
      } as unknown as AdvColumn
      const rowData = { name: 'test' }

      const result = renderCell({ ...baseOptions, column, rowData })
      expect(result).toBeDefined()
    })

    it('should render CopyableCell when copyable is true', () => {
      const column = {
        prop: 'name',
        copyable: true,
        hidden: false,
      } as unknown as AdvColumn
      const rowData = { name: 'test' }

      const result = renderCell({ ...baseOptions, column, rowData })
      expect(result).toBeDefined()
    })

    it('should use column emptyText when cellData is null', () => {
      const column = {
        prop: 'name',
        emptyText: '-',
        hidden: false,
      } as unknown as AdvColumn
      const rowData = {}

      const result = renderCell({ ...baseOptions, column, rowData })
      expect(result).toBe('-')
    })

    it('should use context columnEmptyText when column emptyText not present', () => {
      const column = {
        prop: 'name',
        hidden: false,
      } as unknown as AdvColumn
      const rowData = {}
      const ctx = {
        columnEmptyText: ref('N/A'),
      } as any

      const result = renderCell({ ...baseOptions, column, rowData, ctx })
      expect(result).toBe('N/A')
    })

    it('should resolve cellData from rowData using prop', () => {
      const column = {
        prop: 'name',
        hidden: false,
      } as unknown as AdvColumn
      const rowData = { name: 'John' }

      const result = renderCell({ ...baseOptions, column, rowData })
      expect(result).toBe('John')
    })

    it('should convert number cellData to string', () => {
      const column = {
        prop: 'age',
        hidden: false,
      } as unknown as AdvColumn
      const rowData = { age: 25 }

      const result = renderCell({ ...baseOptions, column, rowData })
      expect(result).toBe('25')
    })
  })
})
