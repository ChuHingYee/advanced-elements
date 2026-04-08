import { describe, expect, it } from 'vitest'
import { filterTableProps } from '../../src/utils/filter-table-props'

describe('filter-table-props', () => {
  const tableAllowed = new Set(['data', 'columns', 'border', 'stripe'])
  const emptyBound = new Set<string>()

  it('keeps only allowed table props', () => {
    const props = {
      data: [1, 2],
      columns: [{ prop: 'a', hidden: false }],
      border: true,
      stripe: true,
      unknownProp: 'value',
      extra: 42,
    }
    const result = filterTableProps(props, tableAllowed, emptyBound)
    expect(result).toEqual({
      data: [1, 2],
      columns: [{ prop: 'a', hidden: false }],
      border: true,
      stripe: true,
    })
  })

  it('removes props not in allowedKeys', () => {
    const props = {
      unknownProp: 'value',
      extra: 42,
      myCustomProp: true,
    }
    const result = filterTableProps(props, tableAllowed, emptyBound)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('returns empty when all props are removed', () => {
    const props = {
      data: [1],
      columns: [{ prop: 'a', hidden: false }],
      border: false,
    }
    const result = filterTableProps(props, new Set<string>(), emptyBound)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('respects explicitlyBound', () => {
    const props = { data: [1], extra: 42 }
    const explicitlyBound = new Set(['data'])
    const result = filterTableProps(props, tableAllowed, explicitlyBound)
    expect(result.data).toBeUndefined()
  })

  it('allows html attrs even when not in allowedKeys', () => {
    const props = { class: 'my-class', style: 'color: red', id: 'test', extra: 1 }
    const result = filterTableProps(props, new Set(['extra']), emptyBound)
    expect(result.class).toBe('my-class')
    expect(result.style).toBe('color: red')
    expect(result.id).toBe('test')
  })

  it('handles empty props', () => {
    const result = filterTableProps({}, tableAllowed, emptyBound)
    expect(result).toEqual({})
  })
})
