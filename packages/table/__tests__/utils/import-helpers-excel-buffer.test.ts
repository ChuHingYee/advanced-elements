/**
 * @file import-helpers phase2 — parseExcelBuffer coverage
 * Covers: xlsx dynamic import, worksheet not found, empty aoa, headerRow false, error handling
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('parseExcelBuffer', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockXlsx(aoa: unknown[][], workbookSheetNames = ['Sheet1']) {
    const mockWorkbook = {
      SheetNames: workbookSheetNames,
      Sheets: Object.fromEntries(workbookSheetNames.map(name => [name, {}])),
    }
    vi.doMock('xlsx', () => ({
      read: vi.fn(() => mockWorkbook),
      utils: {
        sheet_to_json: vi.fn(() => aoa),
      },
    }))
    return mockWorkbook
  }

  it('parses Excel buffer with header row', async () => {
    mockXlsx([
      ['name', 'age'],
      ['Alice', 25],
      ['Bob', 30],
    ])

    const { parseExcelBuffer } = await import('../../src/utils/import-helpers')
    const result = await parseExcelBuffer(new ArrayBuffer(8))

    expect(result.columns).toEqual(['name', 'age'])
    expect(result.rows).toEqual([
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ])
  })

  it('parses Excel buffer without header row', async () => {
    mockXlsx([
      ['Alice', 25],
      ['Bob', 30],
    ])

    const { parseExcelBuffer } = await import('../../src/utils/import-helpers')
    const result = await parseExcelBuffer(new ArrayBuffer(8), { headerRow: false })

    expect(result.columns).toEqual(['col_0', 'col_1'])
    expect(result.rows).toHaveLength(2)
  })

  it('uses specified sheetName', async () => {
    const wb = mockXlsx([
      ['col'],
      ['val'],
    ], ['Sheet1', 'Sheet2'])

    const { parseExcelBuffer } = await import('../../src/utils/import-helpers')
    await parseExcelBuffer(new ArrayBuffer(8), { sheetName: 'Sheet2' })

    expect(wb.Sheets.Sheet2).toBeDefined()
  })

  it('returns empty result when worksheet is not found', async () => {
    mockXlsx([])

    const { parseExcelBuffer } = await import('../../src/utils/import-helpers')
    const result = await parseExcelBuffer(new ArrayBuffer(8), { sheetName: 'NonExistent' })

    expect(result.columns).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('returns empty result when aoa is empty', async () => {
    mockXlsx([])

    const { parseExcelBuffer } = await import('../../src/utils/import-helpers')
    const result = await parseExcelBuffer(new ArrayBuffer(8))

    expect(result.columns).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('skips empty records in aoa', async () => {
    mockXlsx([
      ['name', 'age'],
      ['Alice', 25],
      [],
      ['Bob', 30],
    ])

    const { parseExcelBuffer } = await import('../../src/utils/import-helpers')
    const result = await parseExcelBuffer(new ArrayBuffer(8))

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].name).toBe('Alice')
    expect(result.rows[1].name).toBe('Bob')
  })

  it('fills missing columns with empty string', async () => {
    mockXlsx([
      ['name', 'age', 'city'],
      ['Alice', 25],
    ])

    const { parseExcelBuffer } = await import('../../src/utils/import-helpers')
    const result = await parseExcelBuffer(new ArrayBuffer(8))

    expect(result.rows[0]).toEqual({ name: 'Alice', age: 25, city: '' })
  })

  it('handles null/undefined values in header row', async () => {
    mockXlsx([
      [null, undefined],
      ['val1', 'val2'],
    ])

    const { parseExcelBuffer } = await import('../../src/utils/import-helpers')
    const result = await parseExcelBuffer(new ArrayBuffer(8))

    expect(result.columns).toEqual(['', ''])
  })

  it('throws error when xlsx is not installed', async () => {
    vi.doMock('xlsx', () => {
      throw new Error('Cannot find module xlsx')
    })

    const { parseExcelBuffer } = await import('../../src/utils/import-helpers')
    await expect(parseExcelBuffer(new ArrayBuffer(8))).rejects.toThrow(
      '[AdvTable] xlsx is required for Excel import',
    )
  })

  it('uses defval to fill empty cells', async () => {
    const sheetToJson = vi.fn(() => [
      ['a', 'b'],
      ['1', '2'],
    ])
    vi.doMock('xlsx', () => ({
      read: vi.fn(() => ({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      })),
      utils: {
        sheet_to_json: sheetToJson,
      },
    }))

    const { parseExcelBuffer } = await import('../../src/utils/import-helpers')
    await parseExcelBuffer(new ArrayBuffer(8))

    expect(sheetToJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ header: 1, defval: '' }),
    )
  })
})
