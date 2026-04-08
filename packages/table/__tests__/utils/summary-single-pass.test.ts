import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useDeferredRawAggregates } from '@/composables/features/use-async-summary'
import {
  buildDefaultSummaryRow,
  computeRawAggregates,
  formatRawAggregatesToFooter,
  shouldDeferSummary,
  SUMMARY_ASYNC_THRESHOLD,
} from '@/utils/summary-defaults'

function makeRows(n: number, m: number) {
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < n; i++) {
    const row: Record<string, unknown> = {}
    for (let j = 0; j < m; j++)
      row[`c${j}`] = i % 7 === 0 ? `text-${i}` : i * (j + 1)
    rows.push(row)
  }
  return rows
}

describe('deferred summary lifecycle', () => {
  let callbacks: (() => void)[]
  let scope: ReturnType<typeof effectScope>
  const cancel = vi.fn()

  beforeEach(() => {
    callbacks = []
    scope = effectScope()
    cancel.mockClear()
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => callbacks.push(cb))
    vi.stubGlobal('cancelIdleCallback', cancel)
  })

  afterEach(() => {
    scope.stop()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('schedules when enabled changes from false to true with unchanged inputs', async () => {
    const enabled = shallowRef(false)
    const rows = [{ qty: 2 }, { qty: 3 }]
    const columns = [{ prop: 'qty' }]
    const summary = scope.run(() => useDeferredRawAggregates({
      rows: () => rows,
      columns: () => columns,
      enabled: () => enabled.value,
      threshold: 1,
    }))!
    expect(summary.aggregates.value).toEqual({ qty: 5 })
    expect(callbacks).toHaveLength(0)
    enabled.value = true
    await nextTick()
    expect(callbacks).toHaveLength(1)
    expect(summary.isCalculating.value).toBe(true)
    callbacks[0]!()
    expect(summary.aggregates.value).toEqual({ qty: 5 })
    expect(summary.isCalculating.value).toBe(false)
  })

  it('cancels when disabled and rejects the old callback after re-enabling', async () => {
    const enabled = shallowRef(true)
    const rows = [{ qty: 2 }, { qty: 3 }]
    const columns = [{ prop: 'qty' }]
    const summary = scope.run(() => useDeferredRawAggregates({
      rows: () => rows,
      columns: () => columns,
      enabled: () => enabled.value,
      threshold: 1,
    }))!
    enabled.value = false
    await nextTick()
    expect(cancel).toHaveBeenCalledWith(1)
    expect(summary.isCalculating.value).toBe(false)
    expect(summary.aggregates.value).toEqual({ qty: 5 })
    enabled.value = true
    await nextTick()
    callbacks[0]!()
    expect(summary.aggregates.value).toEqual({})
    expect(summary.isCalculating.value).toBe(true)
    callbacks[1]!()
    expect(summary.aggregates.value).toEqual({ qty: 5 })
    expect(summary.isCalculating.value).toBe(false)
  })

  it('rejects superseded callbacks before and after the latest result commits', async () => {
    const rows = shallowRef([{ qty: 2 }, { qty: 3 }])
    const columns = [{ prop: 'qty' }]
    const summary = scope.run(() => useDeferredRawAggregates({
      rows: () => rows.value,
      columns: () => columns,
      threshold: 1,
    }))!
    rows.value = [{ qty: 10 }, { qty: 20 }]
    await nextTick()
    callbacks[0]!()
    expect(summary.aggregates.value).toEqual({})
    expect(summary.isCalculating.value).toBe(true)
    callbacks[1]!()
    expect(summary.aggregates.value).toEqual({ qty: 30 })
    callbacks[0]!()
    expect(summary.aggregates.value).toEqual({ qty: 30 })
    expect(summary.isCalculating.value).toBe(false)
  })

  it('preserves the current handle after a stale callback and cancels on scope stop', async () => {
    const rows = shallowRef([{ qty: 2 }, { qty: 3 }])
    const columns = [{ prop: 'qty' }]
    const summary = scope.run(() => useDeferredRawAggregates({
      rows: () => rows.value,
      columns: () => columns,
      threshold: 1,
    }))!
    rows.value = [{ qty: 10 }, { qty: 20 }]
    await nextTick()
    callbacks[0]!()
    scope.stop()
    expect(cancel).toHaveBeenCalledWith(2)
    expect(summary.isCalculating.value).toBe(false)
    callbacks[1]!()
    expect(summary.aggregates.value).toEqual({})
  })

  it('cancels timeout fallback and clears pending on pure effectScope.stop', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    const summary = scope.run(() => useDeferredRawAggregates({
      rows: () => [{ qty: 2 }, { qty: 3 }],
      columns: () => [{ prop: 'qty' }],
      threshold: 1,
    }))!
    expect(vi.getTimerCount()).toBe(1)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(summary.isCalculating.value).toBe(false)
    vi.runAllTimers()
    expect(summary.aggregates.value).toEqual({})
  })

  it('does not commit an aggregate whose callback stops its scope', () => {
    const summary = scope.run(() => useDeferredRawAggregates({
      rows: () => [{ qty: 2 }, { qty: 3 }],
      columns: () => [{
        prop: 'qty',
        aggFunc: () => {
          scope.stop()
          return 5
        },
      }],
      threshold: 1,
    }))!
    callbacks[0]!()
    expect(summary.aggregates.value).toEqual({})
    expect(summary.isCalculating.value).toBe(false)
  })
})

const AGGS = ['sum', 'avg', 'min', 'max', 'count', 'first', 'last'] as const

function makeCols(m: number) {
  return Array.from({ length: m }, (_, j) => ({
    prop: `c${j}`,
    aggFunc: AGGS[j % AGGS.length] as (typeof AGGS)[number],
  }))
}

describe('2-1 summary single-pass sharing (phase 2)', () => {
  it('formatRawAggregatesToFooter matches buildDefaultSummaryRow caliber', () => {
    const rows = makeRows(500, 6)
    const cols = [{ prop: 'name' }, ...makeCols(5).map((c, i) => ({ ...c, prop: `c${i}` }))]
    const data = rows.map((r, i) => ({ name: `row-${i}`, ...r }))
    const sumText = '合计'
    const expected = buildDefaultSummaryRow(cols as any, data as any, sumText)
    const raw = computeRawAggregates(data as any, cols as any)
    const actual = formatRawAggregatesToFooter(raw, cols as any, sumText)
    expect(actual).toEqual(expected)
  })

  it('footer sharing keeps sumText placeholder and empty-string caliber', () => {
    const cols = [{ prop: 'name' }, { prop: 'qty' }, { prop: 'note' }]
    const data = [{ name: 'a', qty: 10 }, { name: 'b', qty: 'bad' }]
    const raw = computeRawAggregates(data as any, cols as any)
    const footer = formatRawAggregatesToFooter(raw, cols as any, '合计')
    expect(footer[0]).toBe('合计')
    expect(footer[1]).toBe('10')
    expect(footer[2]).toBe('')
  })

  it('shouldDeferSummary gates on rows*cols >= threshold', () => {
    expect(SUMMARY_ASYNC_THRESHOLD).toBe(500_000)
    // <zh/> 边界即推迟：本项目的验收规模 10,000 行 × 50 列恰好等于阈值，必须走推迟路径
    // <en/> Boundary inclusive: the project's acceptance scale (10,000 × 50) equals the threshold and must defer
    expect(shouldDeferSummary(10_000, 50)).toBe(true)
    expect(shouldDeferSummary(100_000, 20)).toBe(true)
    expect(shouldDeferSummary(100, 20)).toBe(false)
    expect(shouldDeferSummary(0, 20)).toBe(false)
    expect(shouldDeferSummary(10, 10, 50)).toBe(true)
    // <zh/> 自定义阈值同样含边界 | <en/> custom thresholds are boundary-inclusive too
    expect(shouldDeferSummary(10, 5, 50)).toBe(true)
    expect(shouldDeferSummary(9, 5, 50)).toBe(false)
  })

  it('useDeferredRawAggregates stays synchronous for small data', () => {
    const scope = effectScope()
    scope.run(() => {
      const rows = makeRows(50, 4)
      const cols = makeCols(4)
      const { aggregates, isCalculating } = useDeferredRawAggregates({
        rows: () => rows,
        columns: () => cols,
      })
      expect(isCalculating.value).toBe(false)
      const direct = computeRawAggregates(rows as any, cols as any)
      expect(aggregates.value).toEqual(direct)
    })
    scope.stop()
  })
})
