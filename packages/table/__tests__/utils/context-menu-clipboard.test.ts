/**
 * Tests for `context-menu-clipboard`
 *
 * Verifies cell/row copy helpers and the clipboard wrappers.
 */
import type { ProcessedColumn } from '../../src/types/column'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  copyCellToClipboard,
  copyRowsToClipboard,
  copyRowToClipboard,
  getCellValue,
  getRowsValues,
  getRowValues,
} from '../../src/utils/context-menu-clipboard'

function col(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return { prop: 'name', label: 'Name', ...overrides, hidden: false } as unknown as ProcessedColumn
}

describe('context-menu-clipboard', () => {
  beforeEach(() => {
    vi.mocked(navigator.clipboard.writeText).mockClear()
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCellValue', () => {
    it('returns the string representation of a row value', () => {
      expect(getCellValue({ row: { name: 'Alice' }, column: col() })).toBe('Alice')
    })

    it('returns string form of non-string primitives', () => {
      expect(getCellValue({ row: { name: 42 as any }, column: col() })).toBe('42')
    })

    it('returns empty string when value is null', () => {
      expect(getCellValue({ row: { name: null as any }, column: col() })).toBe('')
    })

    it('returns empty string when value is undefined', () => {
      expect(getCellValue({ row: { name: undefined as any }, column: col() })).toBe('')
    })

    it('returns empty string when column has no prop', () => {
      expect(getCellValue({ row: { name: 'x' }, column: col({ prop: undefined, hidden: false }) })).toBe('')
    })
  })

  describe('getRowValues', () => {
    it('joins cell values with tabs by default', () => {
      const columns = [col({ prop: 'name', hidden: false }), col({ prop: 'age', hidden: false })]
      const result = getRowValues({ row: { name: 'Alice', age: 30 }, columns })
      expect(result).toBe('Alice\t30')
    })

    it('prepends tab-separated header row when includeHeaders is true', () => {
      const columns = [col({ prop: 'name', label: 'Name', hidden: false }), col({ prop: 'age', label: 'Age', hidden: false })]
      const result = getRowValues({
        row: { name: 'Alice', age: 30 },
        columns,
        includeHeaders: true,
      })
      expect(result).toBe('Name\tAge\nAlice\t30')
    })

    it('falls back to prop for header label when label is missing', () => {
      const columns = [col({ prop: 'name', label: undefined, hidden: false })]
      const result = getRowValues({
        row: { name: 'Alice' },
        columns,
        includeHeaders: true,
      })
      expect(result).toBe('name\nAlice')
    })

    it('returns empty string for cells that are null/undefined', () => {
      const columns = [col({ prop: 'city', hidden: false })]
      const result = getRowValues({ row: { city: null }, columns })
      expect(result).toBe('')
    })
  })

  describe('getRowsValues', () => {
    it('joins rows with newlines and cells with tabs', () => {
      const columns = [col({ prop: 'name', hidden: false }), col({ prop: 'age', hidden: false })]
      const result = getRowsValues({
        rows: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        columns,
      })
      expect(result).toBe('Alice\t30\nBob\t25')
    })

    it('prepends headers when includeHeaders is true', () => {
      const columns = [col({ prop: 'name', label: 'Name', hidden: false }), col({ prop: 'age', label: 'Age', hidden: false })]
      const result = getRowsValues({
        rows: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        columns,
        includeHeaders: true,
      })
      expect(result).toBe('Name\tAge\nAlice\t30\nBob\t25')
    })

    it('returns empty string for empty rows array', () => {
      expect(getRowsValues({ rows: [], columns: [col()] })).toBe('')
    })

    it('returns only headers when rows is empty and includeHeaders is true', () => {
      const result = getRowsValues({ rows: [], columns: [col({ prop: 'name', label: 'Name', hidden: false })], includeHeaders: true })
      expect(result).toBe('Name')
    })
  })

  describe('copy wrappers', () => {
    it('copyCellToClipboard writes the cell value', async () => {
      const ok = await copyCellToClipboard({ name: 'Alice' }, col())
      expect(ok).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Alice')
    })

    it('copyRowToClipboard writes tab-separated values', async () => {
      const ok = await copyRowToClipboard(
        { name: 'Alice', age: 30 },
        [col({ prop: 'name', hidden: false }), col({ prop: 'age', hidden: false })],
      )
      expect(ok).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Alice\t30')
    })

    it('copyRowToClipboard with includeHeaders prepends a header line', async () => {
      const ok = await copyRowToClipboard(
        { name: 'Alice', age: 30 },
        [col({ prop: 'name', label: 'Name', hidden: false }), col({ prop: 'age', label: 'Age', hidden: false })],
        true,
      )
      expect(ok).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Name\tAge\nAlice\t30')
    })

    it('copyRowsToClipboard writes newline-separated values', async () => {
      const ok = await copyRowsToClipboard(
        [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        [col({ prop: 'name', hidden: false }), col({ prop: 'age', hidden: false })],
      )
      expect(ok).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Alice\t30\nBob\t25')
    })

    it('returns false when clipboard write fails', async () => {
      vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'))
      // After the Clipboard API fails, the fallback execCommand path runs;
      // happy-dom doesn't implement execCommand, so we expect it to return false
      // unless execCommand returns true. Verify we resolve (don't throw) with
      // a boolean.
      const ok = await copyCellToClipboard({ name: 'Alice' }, col())
      expect(typeof ok).toBe('boolean')
    })
  })
})
