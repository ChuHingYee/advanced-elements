import { describe, expect, it, vi } from 'vitest'
import { isCsvFile, isExcelFile, parseCsvText, readFileAsArrayBuffer, readFileAsText } from '../../src/utils/import-helpers'

describe('isExcelFile', () => {
  it('returns true for .xlsx files', () => {
    expect(isExcelFile('data.xlsx')).toBe(true)
  })

  it('returns true for .xls files', () => {
    expect(isExcelFile('data.xls')).toBe(true)
  })

  it('returns false for .csv files', () => {
    expect(isExcelFile('data.csv')).toBe(false)
  })

  it('returns false for other extensions', () => {
    expect(isExcelFile('data.txt')).toBe(false)
  })

  it('handles uppercase extensions', () => {
    expect(isExcelFile('data.XLSX')).toBe(true)
  })
})

describe('isCsvFile', () => {
  it('returns true for .csv files', () => {
    expect(isCsvFile('data.csv')).toBe(true)
  })

  it('returns false for other extensions', () => {
    expect(isCsvFile('data.xlsx')).toBe(false)
  })

  it('handles uppercase extension', () => {
    expect(isCsvFile('data.CSV')).toBe(true)
  })
})

describe('parseCsvText', () => {
  it('parses basic CSV with header row', () => {
    const result = parseCsvText('name,age\nAlice,25\nBob,30')
    expect(result.columns).toEqual(['name', 'age'])
    expect(result.rows).toEqual([{ name: 'Alice', age: '25' }, { name: 'Bob', age: '30' }])
  })

  it('parses CSV without header row', () => {
    const result = parseCsvText('Alice,25\nBob,30', { headerRow: false })
    expect(result.columns).toEqual(['col_0', 'col_1'])
    expect(result.rows).toEqual([{ col_0: 'Alice', col_1: '25' }, { col_0: 'Bob', col_1: '30' }])
  })

  it('handles empty input', () => {
    const result = parseCsvText('')
    expect(result.columns).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('handles custom delimiter', () => {
    const result = parseCsvText('name|age\nAlice|25', { delimiter: '|' })
    expect(result.rows).toEqual([{ name: 'Alice', age: '25' }])
  })

  it('handles quoted fields with commas', () => {
    const result = parseCsvText('name,desc\nAlice,"has, a, comma"')
    expect(result.rows).toEqual([{ name: 'Alice', desc: 'has, a, comma' }])
  })

  it('handles escaped double quotes', () => {
    const result = parseCsvText('name,note\nBob,"said ""hello"""')
    expect(result.rows).toEqual([{ name: 'Bob', note: 'said "hello"' }])
  })

  it('handles multiline quoted fields', () => {
    const result = parseCsvText('name,address\nCharlie,"Line1\nLine2"')
    expect(result.rows).toEqual([{ name: 'Charlie', address: 'Line1\nLine2' }])
  })

  it('handles CRLF line endings', () => {
    const result = parseCsvText('name,age\r\nAlice,25\r\nBob,30')
    expect(result.rows).toHaveLength(2)
  })

  it('handles trailing empty field at EOF', () => {
    const result = parseCsvText('name,age\nAlice,25\nBob,')
    expect(result.rows[1].age).toBe('')
  })

  it('fills missing trailing columns with empty string', () => {
    const result = parseCsvText('name,age,city\nAlice,25')
    expect(result.rows[0]).toEqual({ name: 'Alice', age: '25', city: '' })
  })
})

describe('readFileAsText', () => {
  it('reads text file content', async () => {
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' })
    const text = await readFileAsText(file)
    expect(text).toBe('hello world')
  })

  it('reads with custom encoding', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const text = await readFileAsText(file, 'utf-8')
    expect(text).toBe('test')
  })

  it('rejects on file read error', async () => {
    const file = new File(['x'], 'bad.txt')
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementationOnce(function (this: FileReader) {
      this.onerror?.(new ProgressEvent('error') as any)
    })
    await expect(readFileAsText(file)).rejects.toThrow('Failed to read file')
  })
})

describe('readFileAsArrayBuffer', () => {
  it('reads file as ArrayBuffer', async () => {
    const content = new Uint8Array([1, 2, 3, 4])
    const blob = new Blob([content])
    const file = new File([blob], 'data.bin')
    const buffer = await readFileAsArrayBuffer(file)
    expect(buffer.byteLength).toBe(4)
  })

  it('rejects on file read error', async () => {
    const file = new File(['x'], 'bad.bin')
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementationOnce(function (this: FileReader) {
      this.onerror?.(new ProgressEvent('error') as any)
    })
    await expect(readFileAsArrayBuffer(file)).rejects.toThrow('Failed to read file')
  })
})
