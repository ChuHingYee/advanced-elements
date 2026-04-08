import { describe, expect, it, vi } from 'vitest'
import {
  buildDefaultSummaryRow,
  computeColumnAggregate,
  computeRawAggregates,
  formatAggregateValue,
  readColumnValues,
  runSummaryPass,
} from '@/utils/summary-defaults'

describe('computeColumnAggregate (AG Grid aggFunc parity)', () => {
  it('sums valid numbers, ignores non-numbers/NaN', () => {
    expect(computeColumnAggregate([1, 2, 'x', Number.NaN, null, 3], [1, 2, 3], 'sum')).toBe(6)
  })

  it('returns null for sum with no valid numbers', () => {
    expect(computeColumnAggregate(['a', null], [{}, {}], 'sum')).toBe(null)
  })

  it('defaults to sum when agg is undefined', () => {
    expect(computeColumnAggregate([4, 5], [{}, {}], undefined)).toBe(9)
  })

  it('avg divides by valid count, not total rows', () => {
    expect(computeColumnAggregate([10, 'bad', 20], [{}, {}, {}], 'avg')).toBe(15)
  })

  it('avg returns null with no valid numbers', () => {
    expect(computeColumnAggregate([], [], 'avg')).toBe(null)
  })

  it('min/max pick extremes among valid numbers', () => {
    expect(computeColumnAggregate([3, 1, 2], [{}, {}, {}], 'min')).toBe(1)
    expect(computeColumnAggregate([3, 1, 2], [{}, {}, {}], 'max')).toBe(3)
  })

  it('min/max return null with no valid numbers', () => {
    expect(computeColumnAggregate(['x'], [{}], 'min')).toBe(null)
    expect(computeColumnAggregate(['x'], [{}], 'max')).toBe(null)
  })

  it('count returns row count', () => {
    expect(computeColumnAggregate([1, 2, 3], [{}, {}, {}], 'count')).toBe(3)
  })

  it('first/last skip undefined but keep null', () => {
    expect(computeColumnAggregate([undefined, null, 5], [{}, {}, {}], 'first')).toBe(null)
    expect(computeColumnAggregate([5, undefined], [{}, {}], 'last')).toBe(5)
    expect(computeColumnAggregate([undefined], [{}], 'first')).toBe(null)
  })

  it('custom fn receives (values, rows) and exceptions map to null', () => {
    expect(computeColumnAggregate([1, 2], [{ a: 1 }, { a: 2 }], values => (values as number[]).reduce((s, v) => s + v, 0))).toBe(3)
    expect(computeColumnAggregate([1], [{}], () => {
      throw new Error('boom')
    })).toBe(null)
  })
})

describe('readColumnValues / formatAggregateValue', () => {
  it('prefers getValue over prop', () => {
    const rows = [{ price: 10 }, { price: 20 }]
    expect(readColumnValues(rows, { prop: 'price', getValue: (r: any) => r.price * 2 }, 'price')).toEqual([20, 40])
  })

  it('returns [] without prop nor getValue', () => {
    expect(readColumnValues([{}], {}, undefined)).toEqual([])
  })

  it('formats null/undefined to empty string', () => {
    expect(formatAggregateValue(null)).toBe('')
    expect(formatAggregateValue(undefined)).toBe('')
    expect(formatAggregateValue(0)).toBe('0')
    expect(formatAggregateValue(42)).toBe('42')
  })
})

describe('buildDefaultSummaryRow with aggFunc', () => {
  const cols = [{ prop: 'name' }, { prop: 'qty' }, { prop: 'price' }]
  const data = [
    { name: 'a', qty: 2, price: 10 },
    { name: 'b', qty: 4, price: 20 },
  ]

  it('keeps legacy sum behavior without aggFunc', () => {
    expect(buildDefaultSummaryRow(cols, data, '合计')).toEqual(['合计', '6', '30'])
  })

  it('applies per-column aggFunc (avg/count)', () => {
    const aggCols = [{ prop: 'name' }, { prop: 'qty', aggFunc: 'avg' as const }, { prop: 'price', aggFunc: 'count' as const }]
    expect(buildDefaultSummaryRow(aggCols, data, '合计')).toEqual(['合计', '3', '2'])
  })

  it('first prop column keeps label even with aggFunc', () => {
    const aggCols = [{ prop: 'name', aggFunc: 'count' as const }, { prop: 'qty' }]
    expect(buildDefaultSummaryRow(aggCols, data, 'Total')).toEqual(['Total', '6'])
  })

  it('custom aggFunc per column', () => {
    const aggCols = [{ prop: 'name' }, { prop: 'qty', aggFunc: ((values: unknown[]) => Math.max(...(values as number[]))) as any }]
    expect(buildDefaultSummaryRow(aggCols, data, '合计')).toEqual(['合计', '4'])
  })
})

describe('computeRawAggregates', () => {
  it('returns prop-keyed raw values with null for empty columns', () => {
    const out = computeRawAggregates(
      [{ a: 1 }, { a: 2 }, { b: 'x' }],
      [{ prop: 'a' }, { prop: 'b' }, {}],
    )
    expect(out).toEqual({ a: 3, b: null })
  })
})

describe('runSummaryPass (single-pass kernel parity)', () => {
  it('matches per-column semantics across all builtin aggFuncs incl. NaN/null/undefined', () => {
    const rows = [
      { a: 1, b: 'x', c: Number.NaN, d: undefined, e: null },
      { a: 2, b: 'y', c: 5, d: 7, e: undefined },
      { a: 3, b: 'z', c: 4, d: null, e: 0 },
    ]
    const items = (['sum', 'avg', 'min', 'max', 'count', 'first', 'last'] as const).map(agg => ({
      get: (row: any) => row.a,
      agg,
    }))
    const raws = runSummaryPass(rows, items)
    const expected = (['sum', 'avg', 'min', 'max', 'count', 'first', 'last'] as const).map(agg =>
      computeColumnAggregate(rows.map(r => r.a), rows, agg),
    )
    expect(raws).toEqual(expected)
  })

  it('passes identical (values, rows) to custom fns and maps throws to null', () => {
    const rows = [{ a: 1 }, { a: 2 }]
    const seen: unknown[][] = []
    const fn = vi.fn((values: unknown[], rs: unknown[]) => {
      seen.push([values, rs])
      return 'custom!'
    })
    const raws = runSummaryPass(rows, [
      { get: (row: any) => row.a, agg: fn },
      { get: (_row: any) => { throw new Error('getter boom') }, agg: 'sum' },
      { get: (row: any) => row.a, agg: () => { throw new Error('fn boom') } },
    ])
    expect(raws[0]).toBe('custom!')
    expect(seen[0]![0]).toEqual([1, 2])
    expect(seen[0]![1]).toBe(rows)
    // <zh/> getValue 抛错按 undefined 计入 | <en/> throwing getters count as undefined
    expect(raws[1]).toBe(null)
    expect(raws[2]).toBe(null)
  })

  it('count needs no getter and first/last keep null but skip undefined', () => {
    const rows = [{}, {}, {}]
    expect(runSummaryPass(rows, [{ get: null, agg: 'count' }])).toEqual([3])
    expect(runSummaryPass(
      [{ a: undefined }, { a: null }],
      [{ get: (r: any) => r.a, agg: 'first' }],
    )).toEqual([null])
    expect(runSummaryPass(
      [{ a: undefined }, { a: null }],
      [{ get: (r: any) => r.a, agg: 'last' }],
    )).toEqual([null])
  })

  it('buildDefaultSummaryRow and computeRawAggregates agree on prop columns', () => {
    const rows = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]
    const cols = [{ prop: 'label' }, { prop: 'a', aggFunc: 'sum' as const }, { prop: 'b', aggFunc: 'avg' as const }]
    const row = buildDefaultSummaryRow(cols, rows, '合计')
    const raw = computeRawAggregates(rows, cols)
    expect(row[0]).toBe('合计')
    expect(row[1]).toBe(String(raw.a))
    expect(row[2]).toBe(String(raw.b))
  })
})
