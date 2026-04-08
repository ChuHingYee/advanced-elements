/**
 * Tests for `export-helpers` — column filtering + header resolution.
 */
import type { AdvColumn } from '../../src/types/column'
import { describe, expect, it } from 'vitest'
import {
  filterAllExportableColumns,
  filterVisibleExportableColumns,
  prepareExportData,
  resolveColumnHeader,
  resolveExportableColumns,
} from '../../src/utils/export-helpers'

interface Row {
  name: string
  age: number
}

function col(overrides: Partial<AdvColumn<Row>> = {}): AdvColumn<Row> {
  return { prop: 'name', label: 'Name', hidden: false, ...overrides } as AdvColumn<Row>
}

describe('filterVisibleExportableColumns', () => {
  it('excludes columns that are hidden, selection, or option value type', () => {
    const visible = col({ prop: 'name', hidden: false })
    const hidden = col({ prop: 'nick' as any, label: 'Nick', hidden: true })
    const selection = col({ prop: '__sel' as any, label: 'Sel', selection: true, hidden: false })
    const option = col({ prop: '__opt' as any, label: 'Opt', valueType: 'option', hidden: false })
    const result = filterVisibleExportableColumns([visible, hidden, selection, option])
    expect(result).toEqual([visible])
  })

  it('returns the input array reference is not preserved — produces a new array', () => {
    const a = col()
    const b = col()
    const arr = [a, b]
    const result = filterVisibleExportableColumns(arr)
    expect(result).not.toBe(arr)
  })

  it('returns empty array for empty input', () => {
    expect(filterVisibleExportableColumns([])).toEqual([])
  })

  it('keeps columns with hidden=false explicitly', () => {
    const a = col({ prop: 'a' as any, hidden: false })
    const b = col({ prop: 'b' as any, hidden: false })
    const result = filterVisibleExportableColumns([a, b])
    expect(result).toEqual([a, b])
  })
})

describe('filterAllExportableColumns', () => {
  it('excludes selection and option value type columns but keeps hidden ones', () => {
    const a = col({ prop: 'name', hidden: false })
    const hidden = col({ prop: 'nick' as any, hidden: true })
    const selection = col({ prop: '__sel' as any, selection: true, hidden: false })
    const option = col({ prop: '__opt' as any, valueType: 'option', hidden: false })
    const result = filterAllExportableColumns([a, hidden, selection, option])
    expect(result).toEqual([a, hidden])
  })

  it('returns empty array for empty input', () => {
    expect(filterAllExportableColumns([])).toEqual([])
  })

  it('preserves column order', () => {
    const a = col({ prop: 'a' as any, hidden: false })
    const b = col({ prop: 'b' as any, hidden: false })
    const c = col({ prop: 'c' as any, hidden: false })
    const result = filterAllExportableColumns([a, b, c])
    expect(result.map(c => c.prop)).toEqual(['a', 'b', 'c'])
  })
})

describe('resolveColumnHeader', () => {
  it('returns `label`', () => {
    expect(resolveColumnHeader({ label: 'My Label', prop: 'name', hidden: false } as any)).toBe('My Label')
  })

  it('falls back to `prop` when `label` is missing (string prop)', () => {
    expect(resolveColumnHeader({ prop: 'name', hidden: false } as any)).toBe('name')
  })

  it('returns empty string when no usable field is present', () => {
    expect(resolveColumnHeader({} as any)).toBe('')
  })

  it('returns empty string when prop is a Symbol', () => {
    expect(resolveColumnHeader({ prop: Symbol('id'), hidden: false } as any)).toBe('')
  })
})

describe('resolveExportableColumns', () => {
  it('uses overrideColumns when provided', () => {
    const cols = [col({ prop: 'name', hidden: false })]
    const override = [col({ prop: 'custom', hidden: false })]
    const result = resolveExportableColumns(cols, 'visible', override)
    // override 分支同样展平为叶子列（叶子原引用，故内容相等）
    expect(result).toEqual(override)
  })

  it('overrideColumns 也递归展平分组子列并剔除 selection/option 列', () => {
    const leaf = col({ prop: 'child', hidden: false })
    const group = { ...col({ label: 'G' }), children: [leaf, col({ selection: true }), col({ valueType: 'option' })] } as any
    const result = resolveExportableColumns([col({ prop: 'name', hidden: false })], 'visible', [group])
    expect(result).toEqual([leaf])
  })

  it('falls back to columnMode when overrideColumns is empty', () => {
    const cols = [col({ prop: 'name', hidden: false })]
    const result = resolveExportableColumns(cols, 'visible', [])
    expect(result).toEqual(cols)
  })

  it('uses filterAllExportableColumns for columnMode=all', () => {
    const visible = col({ prop: 'name', hidden: false })
    const hidden = col({ prop: 'nick', hidden: true })
    const result = resolveExportableColumns([visible, hidden], 'all')
    expect(result).toEqual([visible, hidden])
  })

  it('uses filterVisibleExportableColumns for columnMode=visible', () => {
    const visible = col({ prop: 'name', hidden: false })
    const hidden = col({ prop: 'nick', hidden: true })
    const result = resolveExportableColumns([visible, hidden], 'visible')
    expect(result).toEqual([visible])
  })

  it('defaults to visible mode when columnMode is undefined', () => {
    const visible = col({ prop: 'name', hidden: false })
    const hidden = col({ prop: 'nick', hidden: true })
    const result = resolveExportableColumns([visible, hidden], undefined)
    expect(result).toEqual([visible])
  })
})

describe('prepareExportData', () => {
  it('prepares headers and rows from data', () => {
    const cols = [
      col({ prop: 'name', label: 'Name' }),
      col({ prop: 'age', label: 'Age' }),
    ]
    const data: Row[] = [
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ]
    const result = prepareExportData({ data, columns: cols })
    expect(result.headers).toEqual(['Name', 'Age'])
    expect(result.rows).toEqual([
      ['Alice', '25'],
      ['Bob', '30'],
    ])
  })

  it('throws when no exportable columns found', () => {
    const cols = [col({ prop: '__sel', selection: true })]
    expect(() => prepareExportData({ data: [], columns: cols })).toThrow('No exportable columns found')
  })

  it('uses data array for export', () => {
    const cols = [col({ prop: 'name', label: 'Name' })]
    const data: Row[] = [{ name: 'Bob', age: 30 }]
    const result = prepareExportData({ data, columns: cols })
    expect(result.rows).toEqual([['Bob']])
  })

  it('uses overrideColumns when provided', () => {
    const cols = [col({ prop: 'name', label: 'Name' })]
    const overrideCols = [col({ prop: 'age', label: 'Age' })]
    const data: Row[] = [{ name: 'Alice', age: 25 }]
    const result = prepareExportData({ data, columns: cols, overrideColumns: overrideCols })
    expect(result.headers).toEqual(['Age'])
    expect(result.exportableCols).toEqual(overrideCols)
  })

  it('uses columnMode=all to include hidden columns', () => {
    const cols = [
      col({ prop: 'name', label: 'Name', hidden: false }),
      col({ prop: 'age', label: 'Age', hidden: true }),
    ]
    const data: Row[] = [{ name: 'Alice', age: 25 }]
    const result = prepareExportData({ data, columns: cols, columnMode: 'all' })
    expect(result.headers).toEqual(['Name', 'Age'])
    expect(result.rows).toEqual([['Alice', '25']])
  })

  it('handles empty data', () => {
    const cols = [col({ prop: 'name', label: 'Name' })]
    const result = prepareExportData({ data: [], columns: cols })
    expect(result.headers).toEqual(['Name'])
    expect(result.rows).toEqual([])
  })

  it('handles column with no prop', () => {
    const cols = [col({ prop: '' as any, label: 'Computed' })]
    const data = [{ name: 'Alice' }]
    const result = prepareExportData({ data, columns: cols })
    expect(result.headers).toEqual(['Computed'])
  })
})

describe('prepareExportData group-header stripping', () => {
  it('excludes group-header synthetic rows from the export matrix', () => {
    const columns = [
      { prop: 'name', label: 'Name', hidden: false },
      { prop: 'qty', label: 'Qty', hidden: false },
    ] as any[]
    const data = [
      { name: 'a', qty: 1 },
      { __isGroupHeader: true, __groupValue: 'east', __groupCount: 2 },
      { name: 'b', qty: 2 },
    ] as any[]

    const result = prepareExportData({ data, columns, columnMode: 'all' })
    expect(result.rows).toEqual([['a', '1'], ['b', '2']])
  })
})
