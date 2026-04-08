import type { AdvColumn } from '../../src/types/column'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { resolveCellText } from '../../src/utils/resolve-cell-text'

describe('resolve-cell-text', () => {
  const baseColumn: AdvColumn = {
    prop: 'test',
    label: 'Test',
    hidden: false,
  }

  const baseRow = { id: 1 }

  it('should return formatted text using column.format', () => {
    const column: AdvColumn = {
      ...baseColumn,
      format: ({ row }: any) => `formatted-${row.id}`,
    }
    const result = resolveCellText({ cellData: 'test', row: baseRow, column, index: 0 })
    expect(result).toBe('formatted-1')
  })

  it('should return emptyText when cellData is null and emptyText is set', () => {
    const column: AdvColumn = {
      ...baseColumn,
      emptyText: 'N/A',
    }
    const result = resolveCellText({ cellData: null, row: baseRow, column, index: 0 })
    expect(result).toBe('N/A')
  })

  it('should return empty string when cellData is null and no emptyText', () => {
    const result = resolveCellText({ cellData: null, row: baseRow, column: baseColumn, index: 0 })
    expect(result).toBe('')
  })

  it('should return empty string when cellData is empty string', () => {
    const result = resolveCellText({ cellData: '', row: baseRow, column: baseColumn, index: 0 })
    expect(result).toBe('')
  })

  it('should return string representation when no valueType', () => {
    const result = resolveCellText({ cellData: 123, row: baseRow, column: baseColumn, index: 0 })
    expect(result).toBe('123')
  })

  describe('valueType: money', () => {
    it('should format money with default currency', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'money' }
      const result = resolveCellText({ cellData: 1234.5, row: baseRow, column, index: 0 })
      expect(result).toBe('¥1,234.50')
    })

    it('should return empty string for null money', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'money' }
      const result = resolveCellText({ cellData: null, row: baseRow, column, index: 0 })
      expect(result).toBe('')
    })

    it('should handle invalid money value', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'money' }
      const result = resolveCellText({ cellData: 'invalid', row: baseRow, column, index: 0 })
      expect(result).toBe('invalid')
    })
  })

  describe('valueType: digit', () => {
    it('should format digit with locale', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'digit' }
      const result = resolveCellText({ cellData: 1234, row: baseRow, column, index: 0 })
      expect(result).toBe('1,234')
    })

    it('should return empty string for null digit', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'digit' }
      const result = resolveCellText({ cellData: null, row: baseRow, column, index: 0 })
      expect(result).toBe('')
    })

    it('should handle invalid digit value', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'digit' }
      const result = resolveCellText({ cellData: 'abc', row: baseRow, column, index: 0 })
      expect(result).toBe('abc')
    })
  })

  describe('valueType: percent', () => {
    it('should format percent', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'percent' }
      const result = resolveCellText({ cellData: 50, row: baseRow, column, index: 0 })
      expect(result).toBe('50%')
    })

    it('should return empty string for null percent', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'percent' }
      const result = resolveCellText({ cellData: null, row: baseRow, column, index: 0 })
      expect(result).toBe('')
    })

    it('should handle invalid percent value', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'percent' }
      const result = resolveCellText({ cellData: 'abc', row: baseRow, column, index: 0 })
      expect(result).toBe('abc')
    })
  })

  describe('valueType: date', () => {
    it('should format date', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'date' }
      const result = resolveCellText({ cellData: '2024-01-15', row: baseRow, column, index: 0 })
      expect(result).toBe('2024-01-15')
    })

    it('should return empty string for null date', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'date' }
      const result = resolveCellText({ cellData: null, row: baseRow, column, index: 0 })
      expect(result).toBe('')
    })

    it('should handle invalid date value', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'date' }
      const result = resolveCellText({ cellData: 'invalid-date', row: baseRow, column, index: 0 })
      expect(result).toBe('invalid-date')
    })
  })

  describe('valueType: dateTime', () => {
    it('should format datetime', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'dateTime' }
      const result = resolveCellText({ cellData: '2024-01-15 10:30:00', row: baseRow, column, index: 0 })
      expect(result).toContain('2024-01-15')
    })
  })

  describe('valueType: time', () => {
    it('should format time', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'time' }
      const result = resolveCellText({ cellData: '10:30:00', row: baseRow, column, index: 0 })
      expect(result).toBe('10:30:00')
    })
  })

  describe('valueType: dateRange', () => {
    it('should format date range', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'dateRange' }
      const result = resolveCellText({ cellData: ['2024-01-01', '2024-01-15'], row: baseRow, column, index: 0 })
      expect(result).toContain('2024-01-01')
    })
  })

  describe('valueType: dateTimeRange', () => {
    it('should format datetime range', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'dateTimeRange' }
      const result = resolveCellText({ cellData: ['2024-01-01 00:00:00', '2024-01-15 23:59:59'], row: baseRow, column, index: 0 })
      expect(result).toContain('2024-01-01')
    })
  })

  describe('valueType: fromNow', () => {
    it('should format relative time', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'fromNow' }
      const result = resolveCellText({ cellData: new Date().toISOString(), row: baseRow, column, index: 0 })
      expect(result).toBeTruthy()
    })

    it('should return empty string for null fromNow', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'fromNow' }
      const result = resolveCellText({ cellData: null, row: baseRow, column, index: 0 })
      expect(result).toBe('')
    })

    it('should handle invalid fromNow value', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'fromNow' }
      const result = resolveCellText({ cellData: 'invalid', row: baseRow, column, index: 0 })
      expect(result).toBe('invalid')
    })
  })

  describe('valueType: select/radio/checkbox', () => {
    it('should resolve enum text', () => {
      const column: AdvColumn = {
        ...baseColumn,
        valueType: 'select',
        valueEnum: { 1: 'Active', 2: 'Inactive' },
      }
      const result = resolveCellText({ cellData: '1', row: baseRow, column, index: 0 })
      expect(result).toBe('Active')
    })

    it('should return original value when enum key not found', () => {
      const column: AdvColumn = {
        ...baseColumn,
        valueType: 'select',
        valueEnum: { 1: 'Active' },
      }
      const result = resolveCellText({ cellData: '99', row: baseRow, column, index: 0 })
      expect(result).toBe('99')
    })

    it('should handle enum with object value', () => {
      const column: AdvColumn = {
        ...baseColumn,
        valueType: 'select',
        valueEnum: { 1: { text: 'Active', status: 'success' } },
      }
      const result = resolveCellText({ cellData: '1', row: baseRow, column, index: 0 })
      expect(result).toBe('Active')
    })

    it('should handle null cellData for select', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'select' }
      const result = resolveCellText({ cellData: null, row: baseRow, column, index: 0 })
      expect(result).toBe('')
    })
  })

  describe('valueType: index', () => {
    it('should return index + 1', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'index' }
      const result = resolveCellText({ cellData: undefined, row: baseRow, column, index: 0 })
      expect(result).toBe('1')
    })

    it('should handle different indices', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'index' }
      const result = resolveCellText({ cellData: undefined, row: baseRow, column, index: 4 })
      expect(result).toBe('5')
    })
  })

  describe('valueType: indexBorder', () => {
    it('should return index + 1', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'indexBorder' }
      const result = resolveCellText({ cellData: undefined, row: baseRow, column, index: 0 })
      expect(result).toBe('1')
    })
  })

  describe('valueType: switch', () => {
    it('should return checkmark for true', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'switch' }
      const result = resolveCellText({ cellData: true, row: baseRow, column, index: 0 })
      expect(result).toBe('✓')
    })

    it('should return cross for false', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'switch' }
      const result = resolveCellText({ cellData: false, row: baseRow, column, index: 0 })
      expect(result).toBe('✗')
    })
  })

  describe('valueType: progress', () => {
    it('should format progress', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'progress' }
      const result = resolveCellText({ cellData: 75, row: baseRow, column, index: 0 })
      expect(result).toBe('75%')
    })

    it('should return empty string for null progress', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'progress' }
      const result = resolveCellText({ cellData: null, row: baseRow, column, index: 0 })
      expect(result).toBe('')
    })
  })

  describe('valueType: rate', () => {
    it('should format rate', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'rate' }
      const result = resolveCellText({ cellData: 4, row: baseRow, column, index: 0 })
      expect(result).toBe('4')
    })

    it('should return empty string for null rate', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'rate' }
      const result = resolveCellText({ cellData: null, row: baseRow, column, index: 0 })
      expect(result).toBe('')
    })

    it('should handle invalid rate value', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'rate' }
      const result = resolveCellText({ cellData: 'abc', row: baseRow, column, index: 0 })
      expect(result).toBe('abc')
    })
  })

  describe('valueType: text/textarea', () => {
    it('should return text value', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'text' }
      const result = resolveCellText({ cellData: 'hello', row: baseRow, column, index: 0 })
      expect(result).toBe('hello')
    })

    it('should use column emptyText', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'text', emptyText: 'No data' }
      const result = resolveCellText({ cellData: '', row: baseRow, column, index: 0 })
      expect(result).toBe('No data')
    })
  })

  describe('valueType: avatar/image/images/link/code/jsonCode/color/option', () => {
    it('should return string for link', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'link' }
      const result = resolveCellText({ cellData: 'https://example.com', row: baseRow, column, index: 0 })
      expect(result).toBe('https://example.com')
    })

    it('should use emptyText for image types', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'image', emptyText: 'No image' }
      const result = resolveCellText({ cellData: '', row: baseRow, column, index: 0 })
      expect(result).toBe('No image')
    })
  })

  describe('with context', () => {
    it('should use ctx columnEmptyText', () => {
      const ctx = { columnEmptyText: ref('Custom Empty') }
      const result = resolveCellText({ cellData: '', row: baseRow, column: baseColumn, index: 0, ctx: ctx as any })
      expect(result).toBe('Custom Empty')
    })

    it('should use custom currency', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'money' }
      const ctx = { currency: { value: { symbol: '$', locale: 'en-US' } } }
      const result = resolveCellText({ cellData: 1000, row: baseRow, column, index: 0, ctx: ctx as any })
      expect(result).toBe('$1,000.00')
    })
  })

  describe('valueType: date 系列', () => {
    it('should format date type', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'date' }
      const result = resolveCellText({ cellData: '2024-01-15', row: baseRow, column, index: 0 })
      expect(result).toBe('2024-01-15')
    })

    it('should format dateTime type', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'dateTime' }
      const result = resolveCellText({ cellData: '2024-01-15T10:30:00', row: baseRow, column, index: 0 })
      expect(result).toMatch(/2024/)
    })

    it('should format time type', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'time' }
      const result = resolveCellText({ cellData: '2024-01-15T10:30:00', row: baseRow, column, index: 0 })
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/)
    })

    it('should handle invalid date gracefully', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'date' }
      const result = resolveCellText({ cellData: 'invalid-date', row: baseRow, column, index: 0 })
      expect(result).toBe('invalid-date')
    })

    it('should return empty string for null date', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'date' }
      const result = resolveCellText({ cellData: null, row: baseRow, column, index: 0 })
      expect(result).toBe('')
    })
  })

  describe('valueType: year', () => {
    it('should format year', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'year' }
      const result = resolveCellText({ cellData: '2024-06-15', row: baseRow, column, index: 0 })
      expect(result).toBe('2024')
    })
  })

  describe('valueEnum', () => {
    it('should resolve enum text for select type', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'select', valueEnum: { 1: 'Active', 2: 'Inactive' } }
      const result = resolveCellText({ cellData: 1, row: baseRow, column, index: 0 })
      expect(result).toBe('Active')
    })

    it('should fallback to raw string when enum key not found', () => {
      const column: AdvColumn = { ...baseColumn, valueType: 'select', valueEnum: { 1: 'Active' } }
      const result = resolveCellText({ cellData: 999, row: baseRow, column, index: 0 })
      expect(result).toBe('999')
    })
  })

  describe('valueGetter priority', () => {
    it('should use valueGetter over cellData', () => {
      const column: AdvColumn = {
        ...baseColumn,
        valueGetter: ({ row }: any) => `Getter: ${row.custom}`,
      }
      const row = { id: 1, custom: 'Hello' }
      const result = resolveCellText({ cellData: 'raw', row, column, index: 0 })
      expect(result).toBe('Getter: Hello')
    })
  })
})
