import type { ProcessedColumn } from '../../src/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { estimateSpanOps, SPAN_DEFER_BUDGET, useCellSpan } from '../../src/composables/data/use-cell-span'

function makeRows(n: number, period = 10): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < n; i++)
    rows.push({ id: String(i), c0: `v${Math.floor(i / period)}` })
  return rows
}

function makeCols(): ProcessedColumn[] {
  return [{ key: 'c0', prop: 'c0', label: 'C0' } as unknown as ProcessedColumn]
}

describe('useCellSpan deferral (E1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Force the setTimeout fallback for determinism (happy-dom may lack rIC anyway).
    vi.stubGlobal('requestIdleCallback', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('builds synchronously below the threshold with no pending flash', () => {
    const span = useCellSpan({ data: makeRows(100), columns: makeCols(), rowSpanCells: { c0: true } as never })
    expect(span.isSpanPending.value).toBe(false)
    expect(span.spanMap.value.size).toBeGreaterThan(0)
    expect(span.spanEnabled.value).toBe(true)
    expect(span.getSpanInfo(0, 'c0')?.rowspan).toBe(10)
  })

  it('defers above the threshold and swaps once on idle', () => {
    const span = useCellSpan({
      data: makeRows(100),
      columns: makeCols(),
      rowSpanCells: { c0: true } as never,
      deferThreshold: 1,
    })
    expect(span.isSpanPending.value).toBe(true)
    expect(span.spanMap.value.size).toBe(0)
    expect(span.spanEnabled.value).toBe(false)

    vi.runAllTimers()

    expect(span.isSpanPending.value).toBe(false)
    expect(span.spanMap.value.size).toBeGreaterThan(0)
    expect(span.getSpanInfo(0, 'c0')?.rowspan).toBe(10)
  })

  it('drops superseded tasks when inputs change before idle', async () => {
    const data = ref<Record<string, unknown>[]>(makeRows(100, 10))
    const span = useCellSpan({
      data: data as never,
      columns: makeCols(),
      rowSpanCells: { c0: true } as never,
      deferThreshold: 1,
    })
    expect(span.isSpanPending.value).toBe(true)

    // Supersede before the first task runs: new grouping period of 5.
    data.value = makeRows(100, 5)
    // Flush the pre-flush watcher (microtask) before advancing macro timers.
    await nextTick()
    vi.runAllTimers()

    expect(span.isSpanPending.value).toBe(false)
    // Only the latest generation landed: rowspan 5, not 10.
    expect(span.getSpanInfo(0, 'c0')?.rowspan).toBe(5)
    expect(span.spanMap.value.size).toBeGreaterThan(0)
  })

  it('clears completed index-keyed spans while a new dataset is pending', async () => {
    const scope = effectScope()
    const data = ref(makeRows(20, 10))
    const span = scope.run(() => useCellSpan({
      data,
      columns: makeCols(),
      rowSpanCells: { c0: true },
      deferThreshold: 1,
    }))!
    try {
      vi.runAllTimers()
      expect(span.getSpanInfo(0, 'c0')?.rowspan).toBe(10)
      data.value = makeRows(20, 5)
      await nextTick()
      expect(span.isSpanPending.value).toBe(true)
      expect(span.spanMap.value.size).toBe(0)
      expect(span.spanEnabled.value).toBe(false)
      expect(span.spanMethod.value).toBeUndefined()
      expect(span.getSpanInfo(0, 'c0')).toBeUndefined()
      expect(span.getSpanInfo(1, 'c0')).toBeUndefined()
      vi.runAllTimers()
      expect(span.getSpanInfo(0, 'c0')?.rowspan).toBe(5)
      expect(span.isSpanPending.value).toBe(false)
    }
    finally {
      scope.stop()
    }
  })

  it('cancels timeout work and clears pending on pure effectScope.stop', () => {
    const scope = effectScope()
    const span = scope.run(() => useCellSpan({
      data: makeRows(20),
      columns: makeCols(),
      rowSpanCells: { c0: true },
      deferThreshold: 1,
    }))!
    expect(vi.getTimerCount()).toBe(1)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(span.isSpanPending.value).toBe(false)
    vi.runAllTimers()
    expect(span.spanMap.value.size).toBe(0)
  })

  it('ignores stale idle callbacks without losing the current cancellation handle', async () => {
    const callbacks: (() => void)[] = []
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => callbacks.push(cb))
    const cancel = vi.fn()
    vi.stubGlobal('cancelIdleCallback', cancel)
    const scope = effectScope()
    const data = ref(makeRows(20, 10))
    const span = scope.run(() => useCellSpan({
      data,
      columns: makeCols(),
      rowSpanCells: { c0: true },
      deferThreshold: 1,
    }))!
    try {
      data.value = makeRows(20, 5)
      await nextTick()
      expect(cancel).toHaveBeenCalledWith(1)
      callbacks[0]!()
      expect(span.spanMap.value.size).toBe(0)
      expect(span.isSpanPending.value).toBe(true)
      scope.stop()
      expect(cancel).toHaveBeenCalledWith(2)
      callbacks[1]!()
      expect(span.spanMap.value.size).toBe(0)
      expect(span.isSpanPending.value).toBe(false)
    }
    finally {
      scope.stop()
    }
  })

  it('does not commit a build whose user callback stops its scope', () => {
    const scope = effectScope()
    const span = scope.run(() => useCellSpan({
      data: makeRows(20),
      columns: makeCols(),
      userSpanMethod: () => () => {
        scope.stop()
        return { rowspan: 2, colspan: 1 }
      },
      deferThreshold: 1,
    }))!
    vi.runAllTimers()
    expect(span.spanMap.value.size).toBe(0)
    expect(span.isSpanPending.value).toBe(false)
  })

  it('estimateSpanOps matches the build limit caliber', () => {
    const cols = makeCols()
    expect(estimateSpanOps(100, cols, { c0: true } as never, undefined, undefined)).toBe(100)
    expect(estimateSpanOps(100, cols, undefined, undefined, [{ row: 0, col: 0, rowspan: 2, colspan: 3 }])).toBe(6)
    expect(SPAN_DEFER_BUDGET).toBe(50_000)
  })
})
