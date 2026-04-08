import type { AdvColumn } from '../../../src/types/column'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { renderValueCell } from '../../../src/components/cell-renderers/value-renderer'

describe('value-renderer', () => {
  describe('renderValueCell', () => {
    const baseOptions = {
      rowData: {},
      index: 0,
    }

    it('should return emptyText for null cellData', () => {
      const column = { emptyText: '-' } as unknown as AdvColumn
      const result = renderValueCell({ ...baseOptions, cellData: null, column })
      expect(result).toBe('-')
    })

    it('should return emptyText for empty string cellData', () => {
      const column = { emptyText: '-' } as unknown as AdvColumn
      const result = renderValueCell({ ...baseOptions, cellData: '', column })
      expect(result).toBe('-')
    })

    it('should use valueType renderer for money', () => {
      const column = {
        valueType: 'money',
        prop: 'amount',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({ ...baseOptions, cellData: 1000, column })
      expect(result).toBe('¥1,000.00')
    })

    it('should use valueType renderer for digit', () => {
      const column = { valueType: 'digit', prop: 'num', hidden: false } as unknown as AdvColumn
      const result = renderValueCell({ ...baseOptions, cellData: 1234, column })
      expect(result).toBe('1,234')
    })

    it('should use valueType renderer for percent', () => {
      const column = {
        valueType: 'percent',
        prop: 'pct',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({ ...baseOptions, cellData: 50, column })
      expect(result).toBe('50%')
    })

    it('should use valueType renderer for index', () => {
      const column = { valueType: 'index', prop: 'idx', hidden: false } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: undefined,
        column,
        index: 0,
      })
      expect(result).toBeDefined()
    })

    it('should use valueType renderer for indexBorder', () => {
      const column = {
        valueType: 'indexBorder',
        prop: 'idx',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: undefined,
        column,
        index: 5,
      })
      expect(result).toBeDefined()
    })

    it('should return string for unknown valueType', () => {
      const column = {
        valueType: 'unknown',
        prop: 'val',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: 'test',
        column,
      })
      expect(result).toBe('test')
    })

    it('should format date using date valueType', () => {
      const column = {
        valueType: 'date',
        prop: 'createdAt',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: '2024-01-15',
        column,
      })
      expect(result).toBe('2024-01-15')
    })

    it('should format datetime using dateTime valueType', () => {
      const column = {
        valueType: 'dateTime',
        prop: 'createdAt',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: '2024-01-15 10:30:00',
        column,
      })
      expect(result).toBe('2024-01-15 10:30:00')
    })

    it('should format time using time valueType', () => {
      const column = {
        valueType: 'time',
        prop: 'time',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: '10:30:00',
        column,
      })
      expect(result).toBe('10:30:00')
    })

    it('should return empty string for null date value', () => {
      const column = {
        valueType: 'date',
        prop: 'date',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: null,
        column,
      })
      expect(result).toBe('')
    })

    it('should return original value for invalid date', () => {
      const column = {
        valueType: 'date',
        prop: 'date',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: 'invalid-date',
        column,
      })
      expect(result).toBe('invalid-date')
    })

    it('should render select valueType with valueEnum', () => {
      const column = {
        valueType: 'select',
        prop: 'status',
        valueEnum: {
          1: { text: 'Active', status: 'success' },
          2: { text: 'Inactive', status: 'danger' },
        },
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: '1',
        column,
      })
      expect(result).toBeDefined()
    })

    it('should render select valueType without valueEnum', () => {
      const column = {
        valueType: 'select',
        prop: 'status',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: 'test',
        column,
      })
      expect(result).toBe('test')
    })

    it('should use context currency when provided', () => {
      const column = {
        valueType: 'money',
        prop: 'amount',
        hidden: false,
      } as unknown as AdvColumn
      const ctx = {
        currency: { value: { symbol: '$', locale: 'en-US' } },
      } as any
      const result = renderValueCell({
        ...baseOptions,
        cellData: 1000,
        column,
        ctx,
      })
      expect(result).toBe('$1,000.00')
    })

    it('should use column emptyText', () => {
      const column = {
        prop: 'name',
        emptyText: '-',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: null,
        column,
      })
      expect(result).toBe('-')
    })

    it('should use context dayjsLocale when provided', () => {
      const column = {
        valueType: 'date',
        prop: 'createdAt',
        hidden: false,
      } as unknown as AdvColumn
      const ctx = {
        dayjsLocale: { value: 'en' },
      } as any
      const result = renderValueCell({
        ...baseOptions,
        cellData: '2024-01-15',
        column,
        ctx,
      })
      expect(result).toBe('2024-01-15')
    })

    it('should format dateRange using dateRange valueType', () => {
      const column = {
        valueType: 'dateRange',
        prop: 'range',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: '2024-01-15',
        column,
      })
      expect(result).toBe('2024-01-15')
    })

    it('should format dateTimeRange using dateTimeRange valueType', () => {
      const column = {
        valueType: 'dateTimeRange',
        prop: 'range',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: '2024-01-15 10:30:00',
        column,
      })
      expect(result).toBe('2024-01-15 10:30:00')
    })

    it('should use fromNow valueType', () => {
      const column = {
        valueType: 'fromNow',
        prop: 'createdAt',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: '2024-01-01',
        column,
      })
      expect(result).toBeDefined()
    })

    it('should use fromNow with null value', () => {
      const column = {
        valueType: 'fromNow',
        prop: 'createdAt',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: null,
        column,
      })
      expect(result).toBe('')
    })

    it('should use fromNow with invalid date', () => {
      const column = {
        valueType: 'fromNow',
        prop: 'createdAt',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: 'invalid-date',
        column,
      })
      expect(result).toBe('invalid-date')
    })

    it('should use context columnEmptyText when column emptyText not present', () => {
      const column = {
        prop: 'name',
        hidden: false,
      } as unknown as AdvColumn
      const ctx = {
        columnEmptyText: ref('N/A'),
      } as any
      const result = renderValueCell({
        ...baseOptions,
        cellData: null,
        column,
        ctx,
      })
      expect(result).toBe('N/A')
    })

    it('should handle undefined valueType with emptyText from context', () => {
      const column = {} as unknown as AdvColumn
      const ctx = {
        columnEmptyText: ref('empty'),
      } as any
      const result = renderValueCell({
        ...baseOptions,
        cellData: null,
        column,
        ctx,
      })
      expect(result).toBe('empty')
    })

    it('should convert number cellData to string when no valueType', () => {
      const column = { prop: 'age', hidden: false } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: 123,
        column,
      })
      expect(result).toBe('123')
    })

    it('should return empty string for money with null value', () => {
      const column = {
        valueType: 'money',
        prop: 'amount',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: null,
        column,
      })
      expect(result).toBe('')
    })

    it('should return original value for money with non-numeric value', () => {
      const column = {
        valueType: 'money',
        prop: 'amount',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: 'not-a-number',
        column,
      })
      expect(result).toBe('not-a-number')
    })

    it('should return empty string for digit with null value', () => {
      const column = {
        valueType: 'digit',
        prop: 'num',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: null,
        column,
      })
      expect(result).toBe('')
    })

    it('should return original value for digit with non-numeric value', () => {
      const column = {
        valueType: 'digit',
        prop: 'num',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: 'abc',
        column,
      })
      expect(result).toBe('abc')
    })

    it('should return empty string for percent with null value', () => {
      const column = {
        valueType: 'percent',
        prop: 'pct',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: null,
        column,
      })
      expect(result).toBe('')
    })

    it('should return original value for percent with non-numeric value', () => {
      const column = {
        valueType: 'percent',
        prop: 'pct',
        hidden: false,
      } as unknown as AdvColumn
      const result = renderValueCell({
        ...baseOptions,
        cellData: 'abc',
        column,
      })
      expect(result).toBe('abc')
    })
  })
})
