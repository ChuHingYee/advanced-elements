import { describe, expect, it, vi } from 'vitest'
import { isBlankish } from '../../src/composables/data/filter-eval'
import { isBuiltinFilterTypesRegistered, registerBuiltinFilterTypes } from '../../src/composables/features/builtin-filters'
import { getFilterStrategy } from '../../src/composables/features/filter-registry'

vi.mock('../../src/composables/use-dayjs-locale', () => ({
  dayjs: ((val?: any) => {
    const valid = val != null && val !== ''
    return {
      isValid: () => valid,
      isBefore: () => true,
      isAfter: () => true,
      isSame: () => true,
      add: () => ({ isBefore: () => true }),
      subtract: () => ({ isAfter: () => true }),
    }
  }) as any,
}))

describe('builtin-filters', () => {
  it('registers built-in filter types on first call', () => {
    expect(isBuiltinFilterTypesRegistered()).toBe(false)
    registerBuiltinFilterTypes()
    expect(isBuiltinFilterTypesRegistered()).toBe(true)
  })

  it('is idempotent on second call', () => {
    registerBuiltinFilterTypes()
    expect(isBuiltinFilterTypesRegistered()).toBe(true)
  })

  it('isBlankish is the single blank source: text/number blank semantics stay in sync', () => {
    expect(isBlankish(null)).toBe(true)
    expect(isBlankish(undefined)).toBe(true)
    expect(isBlankish('')).toBe(true)
    expect(isBlankish(0)).toBe(false)
    expect(isBlankish('hello')).toBe(false)
    const text = getFilterStrategy('text')!
    const number = getFilterStrategy('number')!
    for (const v of [null, undefined, '', 0, 'hello']) {
      expect(
        text.matches(v, { type: 'text', operator: 'blank' }),
        `text blank ${String(v)}`,
      ).toBe(isBlankish(v))
      expect(
        number.matches(v, { type: 'number', operator: 'blank' }),
        `number blank ${String(v)}`,
      ).toBe(isBlankish(v))
      expect(
        text.matches(v, { type: 'text', operator: 'notBlank' }),
        `text notBlank ${String(v)}`,
      ).toBe(!isBlankish(v))
      expect(
        number.matches(v, { type: 'number', operator: 'notBlank' }),
        `number notBlank ${String(v)}`,
      ).toBe(!isBlankish(v))
    }
  })

  describe('text filter strategy', () => {
    it('createDefaultValue returns contains', () => {
      const strategy = getFilterStrategy('text')!
      const val = strategy.createDefaultValue()
      expect(val.type).toBe('text')
      expect(val.operator).toBe('contains')
    })

    it('matches contains', () => {
      const strategy = getFilterStrategy('text')!
      expect(strategy.matches('Hello World', { type: 'text', operator: 'contains', value: 'hello' })).toBe(true)
      expect(strategy.matches('Hello World', { type: 'text', operator: 'contains', value: 'xyz' })).toBe(false)
    })

    it('matches notContains', () => {
      const strategy = getFilterStrategy('text')!
      expect(strategy.matches('Hello', { type: 'text', operator: 'notContains', value: 'xyz' })).toBe(true)
      expect(strategy.matches('Hello', { type: 'text', operator: 'notContains', value: 'hello' })).toBe(false)
    })

    it('matches equals', () => {
      const strategy = getFilterStrategy('text')!
      expect(strategy.matches('Hello', { type: 'text', operator: 'equals', value: 'Hello' })).toBe(true)
      expect(strategy.matches('Hello', { type: 'text', operator: 'equals', value: 'hello' })).toBe(false)
    })

    it('matches notEquals', () => {
      const strategy = getFilterStrategy('text')!
      expect(strategy.matches('Hello', { type: 'text', operator: 'notEquals', value: 'hello' })).toBe(true)
    })

    it('matches beginsWith', () => {
      const strategy = getFilterStrategy('text')!
      expect(strategy.matches('Hello World', { type: 'text', operator: 'beginsWith', value: 'hello' })).toBe(true)
      expect(strategy.matches('Hello World', { type: 'text', operator: 'beginsWith', value: 'world' })).toBe(false)
    })

    it('matches endsWith', () => {
      const strategy = getFilterStrategy('text')!
      expect(strategy.matches('Hello World', { type: 'text', operator: 'endsWith', value: 'world' })).toBe(true)
    })

    it('matches blank/null values', () => {
      const strategy = getFilterStrategy('text')!
      expect(strategy.matches(null, { type: 'text', operator: 'blank' })).toBe(true)
      expect(strategy.matches('hello', { type: 'text', operator: 'blank' })).toBe(false)
      expect(strategy.matches(null, { type: 'text', operator: 'notBlank' })).toBe(false)
      expect(strategy.matches('hello', { type: 'text', operator: 'notBlank' })).toBe(true)
    })

    it('isActive checks conditions', () => {
      const strategy = getFilterStrategy('text')!
      expect(strategy.isActive({ type: 'text', operator: 'contains', value: '' })).toBe(false)
      expect(strategy.isActive({ type: 'text', operator: 'contains', value: 'hello' })).toBe(true)
      expect(strategy.isActive({ type: 'text', operator: 'blank' })).toBe(true)
    })

    it('isActive with secondary conditions', () => {
      const strategy = getFilterStrategy('text')!
      expect(strategy.isActive({ type: 'text', operator: 'contains', value: '', conditions: { condition: { operator: 'contains', value: 'hello' }, logic: 'and' } })).toBe(true)
    })

    it('matches with secondary conditions (and logic)', () => {
      const strategy = getFilterStrategy('text')!
      const result = strategy.matches('Hello World', { type: 'text', operator: 'contains', value: 'hello', conditions: { condition: { operator: 'endsWith', value: 'world' }, logic: 'and' } })
      expect(result).toBe(true)
    })

    it('matches with secondary conditions (or logic)', () => {
      const strategy = getFilterStrategy('text')!
      const result = strategy.matches('Hello World', { type: 'text', operator: 'contains', value: 'hello', conditions: { condition: { operator: 'contains', value: 'xyz' }, logic: 'or' } })
      expect(result).toBe(true)
    })
  })

  describe('number filter strategy', () => {
    it('createDefaultValue returns eq', () => {
      const strategy = getFilterStrategy('number')!
      const val = strategy.createDefaultValue()
      expect(val.type).toBe('number')
      expect(val.operator).toBe('eq')
    })

    it('matches eq', () => {
      const strategy = getFilterStrategy('number')!
      expect(strategy.matches(10, { type: 'number', operator: 'eq', value: 10 })).toBe(true)
      expect(strategy.matches(10, { type: 'number', operator: 'eq', value: 20 })).toBe(false)
    })

    it('matches neq', () => {
      const strategy = getFilterStrategy('number')!
      expect(strategy.matches(10, { type: 'number', operator: 'neq', value: 20 })).toBe(true)
    })

    it('matches gt/gte/lt/lte', () => {
      const strategy = getFilterStrategy('number')!
      expect(strategy.matches(10, { type: 'number', operator: 'gt', value: 5 })).toBe(true)
      expect(strategy.matches(10, { type: 'number', operator: 'gte', value: 10 })).toBe(true)
      expect(strategy.matches(10, { type: 'number', operator: 'lt', value: 20 })).toBe(true)
      expect(strategy.matches(10, { type: 'number', operator: 'lte', value: 10 })).toBe(true)
    })

    it('matches between', () => {
      const strategy = getFilterStrategy('number')!
      expect(strategy.matches(10, { type: 'number', operator: 'between', min: 5, max: 15 })).toBe(true)
      expect(strategy.matches(10, { type: 'number', operator: 'between', min: 15 })).toBe(false)
      expect(strategy.matches(10, { type: 'number', operator: 'between', max: 5 })).toBe(false)
    })

    it('matches blank/null', () => {
      const strategy = getFilterStrategy('number')!
      expect(strategy.matches(null, { type: 'number', operator: 'blank' })).toBe(true)
      expect(strategy.matches(10, { type: 'number', operator: 'notBlank' })).toBe(true)
    })

    it('handles NaN values', () => {
      const strategy = getFilterStrategy('number')!
      expect(strategy.matches('abc', { type: 'number', operator: 'eq', value: 10 })).toBe(false)
    })

    it('isActive checks conditions', () => {
      const strategy = getFilterStrategy('number')!
      expect(strategy.isActive({ type: 'number', operator: 'eq', value: 10 })).toBe(true)
      expect(strategy.isActive({ type: 'number', operator: 'blank' })).toBe(true)
      expect(strategy.isActive({ type: 'number', operator: 'between' })).toBe(false)
      expect(strategy.isActive({ type: 'number', operator: 'between', min: 5 })).toBe(true)
    })

    it('matches with secondary conditions', () => {
      const strategy = getFilterStrategy('number')!
      const result = strategy.matches(10, { type: 'number', operator: 'eq', value: 10, conditions: { condition: { operator: 'gt', value: 5 }, logic: 'and' } })
      expect(result).toBe(true)
    })
  })

  describe('date filter strategy', () => {
    it('createDefaultValue returns before', () => {
      const strategy = getFilterStrategy('date')!
      const val = strategy.createDefaultValue()
      expect(val.type).toBe('date')
      expect(val.operator).toBe('before')
    })

    it('matches before', () => {
      const strategy = getFilterStrategy('date')!
      expect(strategy.matches('2024-01-01', { type: 'date', operator: 'before', value: '2024-01-02' })).toBe(true)
    })

    it('matches after', () => {
      const strategy = getFilterStrategy('date')!
      expect(strategy.matches('2024-01-02', { type: 'date', operator: 'after', value: '2024-01-01' })).toBe(true)
    })

    it('matches between', () => {
      const strategy = getFilterStrategy('date')!
      expect(strategy.matches('2024-01-15', { type: 'date', operator: 'between', startDate: '2024-01-01', endDate: '2024-01-31' })).toBe(true)
    })

    it('returns false for invalid dates', () => {
      const strategy = getFilterStrategy('date')!
      expect(strategy.matches(null, { type: 'date', operator: 'before', value: '2024-01-02' })).toBe(false)
    })

    it('isActive checks operator', () => {
      const strategy = getFilterStrategy('date')!
      expect(strategy.isActive({ type: 'date', operator: 'before', value: '2024-01-01' })).toBe(true)
      expect(strategy.isActive({ type: 'date', operator: 'before' })).toBe(false)
      expect(strategy.isActive({ type: 'date', operator: 'between', startDate: '2024-01-01' })).toBe(true)
    })
  })

  describe('enum filter strategy', () => {
    it('createDefaultValue returns empty selected', () => {
      const strategy = getFilterStrategy('enum')!
      const val = strategy.createDefaultValue()
      expect(val.type).toBe('enum')
      expect(val.selected).toEqual([])
    })

    it('isActive returns true when selected has items', () => {
      const strategy = getFilterStrategy('enum')!
      expect(strategy.isActive({ type: 'enum', selected: ['a'] })).toBe(true)
      expect(strategy.isActive({ type: 'enum', selected: [] })).toBe(false)
    })

    it('matches includes value', () => {
      const strategy = getFilterStrategy('enum')!
      expect(strategy.matches('a', { type: 'enum', selected: ['a', 'b'] })).toBe(true)
      expect(strategy.matches('c', { type: 'enum', selected: ['a', 'b'] })).toBe(false)
    })

    it('returns true when no selection', () => {
      const strategy = getFilterStrategy('enum')!
      expect(strategy.matches('a', { type: 'enum', selected: [] })).toBe(true)
    })
  })
})
