import type { AdvColumn } from '../../src/types/column'
import { describe, expect, it } from 'vitest'
import { resolveCellDisplayValue, resolveCellValue } from '../../src/utils/value-pipeline'

describe('resolveCellValue', () => {
  const row = { id: 1, name: 'Alice', age: 25 }

  it('returns row[prop] when no valueGetter', () => {
    const col = { prop: 'name', hidden: false } as AdvColumn
    expect(resolveCellValue(row, col, 0)).toBe('Alice')
  })

  it('uses valueGetter when defined', () => {
    const col = {
      prop: 'name',
      valueGetter: ({ row: r }: any) => `Mr. ${r.name}`,
      hidden: false,
    } as AdvColumn
    expect(resolveCellValue(row, col, 0)).toBe('Mr. Alice')
  })

  it('returns undefined when prop is undefined', () => {
    const col = {} as AdvColumn
    expect(resolveCellValue(row, col, 0)).toBeUndefined()
  })

  it('returns undefined when prop is null', () => {
    const col = { prop: null, hidden: false } as any
    expect(resolveCellValue(row, col, 0)).toBeUndefined()
  })

  it('passes rowIndex to valueGetter', () => {
    const col = {
      prop: 'name',
      valueGetter: ({ rowIndex: i }: any) => `Row ${i}`,
      hidden: false,
    } as AdvColumn
    expect(resolveCellValue(row, col, 5)).toBe('Row 5')
  })
})

describe('resolveCellDisplayValue', () => {
  const row = { id: 1, name: 'Alice', age: 25, score: 95.5 }

  it('returns raw value when no format', () => {
    const col = { prop: 'name', hidden: false } as AdvColumn
    expect(resolveCellDisplayValue(row, col, 0)).toBe('Alice')
  })

  it('applies format function', () => {
    const col = {
      prop: 'score',
      format: ({ cellData }: any) => `${cellData}%`,
      hidden: false,
    } as AdvColumn
    expect(resolveCellDisplayValue(row, col, 0)).toBe('95.5%')
  })

  it('returns raw value when format returns non-primitive', () => {
    const col = {
      prop: 'name',
      format: () => ({ custom: 'object' }),
      hidden: false,
    } as unknown as AdvColumn
    expect(resolveCellDisplayValue(row, col, 0)).toBe('Alice')
  })

  it('returns formatted number', () => {
    const col = {
      prop: 'age',
      format: ({ cellData }: any) => Number(cellData),
      hidden: false,
    } as unknown as AdvColumn
    expect(resolveCellDisplayValue(row, col, 0)).toBe(25)
  })

  it('returns formatted boolean', () => {
    const rowBool = { id: 1, active: true }
    const col = {
      prop: 'active',
      format: () => true,
      hidden: false,
    } as unknown as AdvColumn
    expect(resolveCellDisplayValue(rowBool, col, 0)).toBe(true)
  })

  it('falls back to raw value when format returns array', () => {
    const col = {
      prop: 'name',
      format: () => ['a', 'b'],
      hidden: false,
    } as unknown as AdvColumn
    expect(resolveCellDisplayValue(row, col, 0)).toBe('Alice')
  })

  it('uses valueGetter result as input to format', () => {
    const col = {
      prop: 'name',
      valueGetter: ({ row: r }: any) => r.name.toUpperCase(),
      format: ({ cellData }: any) => `Formatted: ${cellData}`,
      hidden: false,
    } as AdvColumn
    expect(resolveCellDisplayValue(row, col, 0)).toBe('Formatted: ALICE')
  })
})
