import type { ColumnFilterValue } from '../../src/composables/data/use-column-filter'
import { beforeAll, describe, expect, it } from 'vitest'
import { isFilterActive, matchesFilter } from '../../src/composables/data/filter-eval'
import { registerBuiltinFilterTypes } from '../../src/composables/features/builtin-filters'

beforeAll(() => {
  registerBuiltinFilterTypes()
})

describe('filter-eval (pure motion from use-column-filter)', () => {
  it('isFilterActive rejects empty and unknown types', () => {
    expect(isFilterActive(null)).toBe(false)
    expect(isFilterActive(undefined)).toBe(false)
    expect(isFilterActive({ type: 'text', operator: 'contains' })).toBe(false)
    expect(isFilterActive({ type: 'text', operator: 'contains', value: 'a' })).toBe(true)
    expect(isFilterActive({ type: 'unknown-type' } as unknown as ColumnFilterValue)).toBe(false)
  })

  it('matchesFilter passes unknown types', () => {
    expect(matchesFilter('anything', { type: 'unknown-type' } as unknown as ColumnFilterValue)).toBe(true)
  })

  it('matchesFilter evaluates text strategies', () => {
    expect(matchesFilter('hello world', { type: 'text', operator: 'contains', value: 'world' })).toBe(true)
    expect(matchesFilter('hello', { type: 'text', operator: 'contains', value: 'world' })).toBe(false)
    expect(matchesFilter('hello', { type: 'text', operator: 'equals', value: 'hello' })).toBe(true)
  })

  it('matchesFilter evaluates number and enum strategies', () => {
    expect(matchesFilter(5, { type: 'number', operator: 'gt', value: 3 })).toBe(true)
    expect(matchesFilter(2, { type: 'number', operator: 'gt', value: 3 })).toBe(false)
    expect(matchesFilter('a', { type: 'enum', selected: ['a', 'b'] })).toBe(true)
    expect(matchesFilter('c', { type: 'enum', selected: ['a', 'b'] })).toBe(false)
  })
})
