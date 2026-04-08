import { describe, expect, it } from 'vitest'
import {
  buildDefaultSummaryRow,
  computeRawAggregates,
} from '../../src/utils/summary-defaults'

/**
 * <zh/> 汇总聚合基准——10 万行 × 20 列，SSD/HDD 无关，纯 CPU。
 * <zh/> 仅输出耗时日志用于优化前后对比，不设硬门限（避免 CI 机器抖动误杀）。
 * <en/> Summary aggregation benchmark — 100k rows × 20 cols, CPU-only.
 * <en/> Logs timings for before/after comparison only; no hard threshold (avoids CI flakiness).
 */
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

const AGGS = ['sum', 'avg', 'min', 'max', 'count', 'first', 'last'] as const

function makeCols(m: number) {
  return Array.from({ length: m }, (_, j) => ({
    prop: `c${j}`,
    aggFunc: AGGS[j % AGGS.length] as (typeof AGGS)[number],
  }))
}

describe('summary aggregation benchmark (100k x 20, mixed aggFuncs)', () => {
  it('logs buildDefaultSummaryRow + computeRawAggregates timings', () => {
    const rows = makeRows(100_000, 20)
    const cols = makeCols(20)

    const t0 = performance.now()
    const row = buildDefaultSummaryRow(cols, rows, '合计')
    const t1 = performance.now()
    const raw = computeRawAggregates(rows, cols)
    const t2 = performance.now()

    // eslint-disable-next-line no-console
    console.log(`[summary-bench] buildDefaultSummaryRow: ${(t1 - t0).toFixed(1)}ms, computeRawAggregates: ${(t2 - t1).toFixed(1)}ms`)

    expect(row).toHaveLength(20)
    expect(row[0]).toBe('合计')
    expect(Object.keys(raw)).toHaveLength(20)
  })
})
