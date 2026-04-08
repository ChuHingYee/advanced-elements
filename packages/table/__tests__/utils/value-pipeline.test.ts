import { describe, expect, it, vi } from 'vitest'
import { resolveCellDisplayValue, resolveCellValue } from '../../src/utils/value-pipeline'

describe('resolveCellValue', () => {
  const row = { name: 'Alice', age: 30, email: 'alice@test.com' }

  it('uses valueGetter when provided', () => {
    const valueGetter = vi.fn(() => 'computed-val')
    const col = { prop: 'name', valueGetter, hidden: false } as any
    expect(resolveCellValue(row, col, 0)).toBe('computed-val')
    expect(valueGetter).toHaveBeenCalledWith({ row, column: col, rowIndex: 0 })
  })

  it('falls back to row prop when no valueGetter', () => {
    const col = { prop: 'name', hidden: false } as any
    expect(resolveCellValue(row, col, 0)).toBe('Alice')
  })

  it('returns undefined when prop is null/undefined', () => {
    expect(resolveCellValue(row, { } as any, 0)).toBeUndefined()
  })

  it('handles numeric prop correctly', () => {
    expect(resolveCellValue(row, { prop: 'age', hidden: false } as any, 0)).toBe(30)
  })

  it('works with ProcessedColumn type', () => {
    const col = { prop: 'email', hidden: false } as any
    expect(resolveCellValue(row, col, 0)).toBe('alice@test.com')
  })

  it('passes correct rowIndex to valueGetter', () => {
    const valueGetter = vi.fn()
    resolveCellValue(row, { prop: 'name', valueGetter, hidden: false } as any, 5)
    expect(valueGetter).toHaveBeenCalledWith(expect.objectContaining({ rowIndex: 5 }))
  })
})

describe('resolveCellDisplayValue', () => {
  const row = { name: 'Alice', score: 85 }

  it('returns raw value when no format', () => {
    const col = { prop: 'name', hidden: false } as any
    expect(resolveCellDisplayValue(row, col, 0)).toBe('Alice')
  })

  it('returns formatted string when format returns string', () => {
    const col = {
      prop: 'score',
      format: () => '85 pts',
      hidden: false,
    } as any
    expect(resolveCellDisplayValue(row, col, 0)).toBe('85 pts')
  })

  it('returns formatted number when format returns number', () => {
    const col = {
      prop: 'score',
      format: () => 85,
      hidden: false,
    } as any
    expect(resolveCellDisplayValue(row, col, 0)).toBe(85)
  })

  it('returns raw value when format returns non-primitive', () => {
    const col = {
      prop: 'score',
      format: () => ({ custom: true }),
      hidden: false,
    } as any
    expect(resolveCellDisplayValue(row, col, 0)).toBe(85)
  })

  it('passes columns to format context', () => {
    const format = vi.fn(() => 'val')
    const cols = [{ prop: 'score', format, hidden: false }] as any
    resolveCellDisplayValue(row, cols[0], 0, cols)
    expect(format).toHaveBeenCalledWith(expect.objectContaining({ columns: cols }))
  })

  it('returns raw value from valueGetter when no format', () => {
    const col = {
      valueGetter: ({ row }: any) => `${row.name}!!`,
    } as any
    expect(resolveCellDisplayValue(row, col, 0)).toBe('Alice!!')
  })

  it('calls resolveCellValue internally', () => {
    const col = { prop: 'name', hidden: false } as any
    expect(resolveCellDisplayValue(row, col, 0)).toBe(resolveCellValue(row, col, 0))
  })

  it('format 返回 boolean 类型值', () => {
    const col = {
      prop: 'active',
      format: () => true,
      hidden: false,
    } as any
    expect(resolveCellDisplayValue({ active: false }, col, 0)).toBe(true)
  })

  it('format 返回 undefined 时回退到原始值', () => {
    const col = {
      prop: 'score',
      format: () => undefined,
      hidden: false,
    } as any
    expect(resolveCellDisplayValue(row, col, 0)).toBe(85)
  })

  it('format 返回 null 时回退到原始值', () => {
    const col = {
      prop: 'score',
      format: () => null,
      hidden: false,
    } as any
    expect(resolveCellDisplayValue(row, col, 0)).toBe(85)
  })
})
