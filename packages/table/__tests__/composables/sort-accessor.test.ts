import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { compileSortAccessor, getCachedSortAccessor } from '../../src/composables/data/sort-accessor'

function makeCol(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return { key: 'c0', prop: 'c0', label: 'C0', ...overrides } as unknown as ProcessedColumn
}

describe('sort-accessor (pure motion from use-column-sort)', () => {
  it('compiles direct prop access', () => {
    const accessor = compileSortAccessor(makeCol(), undefined, 'c0')
    expect(accessor({ c0: 'x' }, 0)).toBe('x')
  })

  it('compiles dot-notation paths with null safety', () => {
    const accessor = compileSortAccessor(makeCol(), 'profile.name')
    expect(accessor({ profile: { name: 'n' } }, 0)).toBe('n')
    expect(accessor({ profile: null }, 0)).toBeUndefined()
    expect(accessor(null, 0)).toBeUndefined()
  })

  it('compiles arrays by first non-null value', () => {
    const accessor = compileSortAccessor(makeCol(), ['a', 'b'])
    expect(accessor({ b: 2 }, 0)).toBe(2)
    expect(accessor({}, 0)).toBeUndefined()
  })

  it('prefers format display value when sortByFormat', () => {
    const col = makeCol({ format: ({ cellData }: { cellData: unknown }) => `f:${String(cellData)}` })
    const accessor = compileSortAccessor(col, undefined, 'c0', true, [col], 0)
    expect(accessor({ c0: 'v' }, 0)).toBe('f:v')
  })

  it('prefers valueGetter without sortByFormat', () => {
    const col = makeCol({ valueGetter: ({ row }: { row: unknown }) => (row as Record<string, unknown>).c0 })
    const accessor = compileSortAccessor(col, undefined, 'c0')
    expect(accessor({ c0: 'v' }, 0)).toBe('v')
  })

  it('preserves accessor semantics across repeated compilation', () => {
    const col = makeCol()
    const row = { c0: 1, c1: 2 }
    const a = getCachedSortAccessor(col, undefined, 'c0')
    const b = getCachedSortAccessor(col, undefined, 'c0')
    expect(b(row, 0)).toBe(a(row, 0))
    const c = getCachedSortAccessor(col, undefined, 'c1')
    expect(c(row, 0)).toBe(2)
  })

  it('distinguishes comma-containing strings from fallback arrays', () => {
    const col = makeCol()
    const row = { 'a,b': 3, 'a': 1, 'b': 2 }
    expect(getCachedSortAccessor(col, 'a,b')(row, 0)).toBe(3)
    expect(getCachedSortAccessor(col, ['a', 'b'])(row, 0)).toBe(1)
  })

  it('uses the current allColumns context and newly installed getters', () => {
    const col = makeCol({ format: ({ columns }) => columns[1].label })
    const first = [col, makeCol({ label: 'first' })]
    const second = [col, makeCol({ label: 'second' })]
    expect(getCachedSortAccessor(col, undefined, 'c0', true, first, 0)({}, 0)).toBe('first')
    expect(getCachedSortAccessor(col, undefined, 'c0', true, second, 0)({}, 0)).toBe('second')
    getCachedSortAccessor(col, undefined, 'c0')
    col.valueGetter = () => 42
    expect(getCachedSortAccessor(col, undefined, 'c0')({}, 0)).toBe(42)
  })

  it('bypasses cache for function sortBy', () => {
    const col = makeCol()
    const fn = (row: unknown) => row
    const a = getCachedSortAccessor(col, fn)
    const b = getCachedSortAccessor(col, fn)
    expect(a).toBe(fn)
    expect(b).toBe(fn)
  })
})
