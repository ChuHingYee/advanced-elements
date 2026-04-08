import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { copyCellToClipboard, copyRowsToClipboard, copyRowToClipboard, getCellValue, getRowsValues, getRowValues } from '../../src/utils/context-menu-clipboard'
import { copyToClipboard } from '../../src/utils/copy'

vi.mock('../../src/utils/copy', () => ({
  copyToClipboard: vi.fn(),
}))

const mockColumns = [
  { prop: 'name', label: 'Name', hidden: false },
  { prop: 'age', label: 'Age', hidden: false },
  { prop: 'email', label: 'Email', hidden: false },
] as ProcessedColumn[]

const mockRow = { name: 'Alice', age: 25, email: 'alice@test.com' }
const mockRows = [
  { name: 'Alice', age: 25, email: 'alice@test.com' },
  { name: 'Bob', age: 30, email: 'bob@test.com' },
  { name: 'Charlie', age: 35, email: 'charlie@test.com' },
]

describe('getCellValue', () => {
  it('returns cell value as string', () => {
    expect(getCellValue({ row: mockRow, column: mockColumns[0] })).toBe('Alice')
    expect(getCellValue({ row: mockRow, column: mockColumns[1] })).toBe('25')
  })

  it('returns empty string for null value', () => {
    const row = { name: null, age: 0 }
    expect(getCellValue({ row, column: { prop: 'name', hidden: false } as unknown as ProcessedColumn })).toBe('')
    expect(getCellValue({ row, column: { prop: 'age', hidden: false } as unknown as ProcessedColumn })).toBe('0')
  })

  it('returns empty string for undefined value', () => {
    const row = { name: undefined }
    expect(getCellValue({ row, column: { prop: 'name', hidden: false } as unknown as ProcessedColumn })).toBe('')
  })
})

describe('getRowValues', () => {
  it('returns tab-separated values', () => {
    const result = getRowValues({ row: mockRow, columns: mockColumns })
    expect(result).toBe('Alice\t25\talice@test.com')
  })

  it('includes headers when includeHeaders is true', () => {
    const result = getRowValues({ row: mockRow, columns: mockColumns, includeHeaders: true })
    expect(result).toBe('Name\tAge\tEmail\nAlice\t25\talice@test.com')
  })

  it('handles empty columns', () => {
    const result = getRowValues({ row: mockRow, columns: [] })
    expect(result).toBe('')
  })
})

describe('getRowsValues', () => {
  it('returns newline-separated rows', () => {
    const result = getRowsValues({ rows: mockRows, columns: mockColumns })
    expect(result).toBe('Alice\t25\talice@test.com\nBob\t30\tbob@test.com\nCharlie\t35\tcharlie@test.com')
  })

  it('includes headers when includeHeaders is true', () => {
    const result = getRowsValues({ rows: mockRows, columns: mockColumns, includeHeaders: true })
    expect(result).toBe('Name\tAge\tEmail\nAlice\t25\talice@test.com\nBob\t30\tbob@test.com\nCharlie\t35\tcharlie@test.com')
  })

  it('handles empty rows', () => {
    const result = getRowsValues({ rows: [], columns: mockColumns })
    expect(result).toBe('')
  })

  it('handles single row', () => {
    const result = getRowsValues({ rows: [mockRow], columns: mockColumns })
    expect(result).toBe('Alice\t25\talice@test.com')
  })
})

describe('copyCellToClipboard', () => {
  it('copies cell value to clipboard', async () => {
    await copyCellToClipboard(mockRow, mockColumns[0])
    expect(copyToClipboard).toHaveBeenCalledWith('Alice')
  })
})

describe('copyRowToClipboard', () => {
  it('copies row values', async () => {
    await copyRowToClipboard(mockRow, mockColumns)
    expect(copyToClipboard).toHaveBeenCalledWith('Alice\t25\talice@test.com')
  })

  it('copies row values with header', async () => {
    await copyRowToClipboard(mockRow, mockColumns, true)
    expect(copyToClipboard).toHaveBeenCalledWith('Name\tAge\tEmail\nAlice\t25\talice@test.com')
  })
})

describe('copyRowsToClipboard', () => {
  it('copies all rows', async () => {
    await copyRowsToClipboard(mockRows, mockColumns)
    expect(copyToClipboard).toHaveBeenCalledWith('Alice\t25\talice@test.com\nBob\t30\tbob@test.com\nCharlie\t35\tcharlie@test.com')
  })

  it('copies rows with header', async () => {
    await copyRowsToClipboard(mockRows, mockColumns, true)
    expect(copyToClipboard).toHaveBeenCalledWith('Name\tAge\tEmail\nAlice\t25\talice@test.com\nBob\t30\tbob@test.com\nCharlie\t35\tcharlie@test.com')
  })

  it('handles empty rows array', async () => {
    await copyRowsToClipboard([], mockColumns, true)
    expect(copyToClipboard).toHaveBeenCalledWith('Name\tAge\tEmail')
  })
})
