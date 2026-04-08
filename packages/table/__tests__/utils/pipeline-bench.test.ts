import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { useCellSpan } from '../../src/composables/data/use-cell-span'
import { classifyColumns } from '../../src/composables/data/use-column-classification'
import { sanitizeDataArray } from '../../src/utils/security'
import { compareSortValues } from '../../src/utils/sort-comparator'
import { resolveCellDisplayValue, resolveCellValue } from '../../src/utils/value-pipeline'

/**
 * <zh/> 管线基准——10k 行 × 50 列，调用真实实现（classifyColumns / compareSortValues / sanitizeDataArray）。
 * <zh/> 仅输出耗时日志用于优化前后对比，不设硬门限（避免 CI 机器抖动误杀）。
 * <en/> Pipeline benchmark — 10k rows × 50 cols against real implementations
 * <en/> (classifyColumns / compareSortValues / sanitizeDataArray).
 * <en/> Logs timings for before/after comparison only; no hard threshold (avoids CI flakiness).
 */
function makeRows(n: number, m: number): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < n; i++) {
    const row: Record<string, unknown> = { id: String(i) }
    for (let c = 0; c < m; c++)
      row[`c${c}`] = `v${i % 10}`
    rows.push(row)
  }
  return rows
}

function makeCols(m: number): ProcessedColumn[] {
  return Array.from({ length: m }, (_, i) => ({
    key: `c${i}`,
    prop: `c${i}`,
    label: `C${i}`,
    width: 100,
    sortable: i < 5,
  }) as unknown as ProcessedColumn)
}

describe('pipeline benchmark (10k x 50, real implementations)', () => {
  it('logs classify / sanitize / sort timings', () => {
    const rows = makeRows(10_000, 50)
    const cols = makeCols(50)

    const t0 = performance.now()
    const classification = classifyColumns(cols)
    const t1 = performance.now()
    const safe = sanitizeDataArray(rows)
    const t2 = performance.now()
    const sorted = [...safe].sort((a, b) =>
      compareSortValues(
        (a as Record<string, unknown>).c0,
        (b as Record<string, unknown>).c0,
        1,
      ),
    )
    const t3 = performance.now()

    // eslint-disable-next-line no-console
    console.log(
      `[pipeline-bench] classify: ${(t1 - t0).toFixed(1)}ms, sanitize: ${(t2 - t1).toFixed(1)}ms, sort: ${(t3 - t2).toFixed(1)}ms`,
    )

    expect(classification.leafColumns).toHaveLength(50)
    expect(safe).toHaveLength(10_000)
    expect(sorted).toHaveLength(10_000)
  })

  it('logs filter format-path vs raw-path timings (E2 gate: 10k x 5 format cols)', () => {
    const rows = makeRows(10_000, 5)
    const cols = makeCols(5).map(c => ({
      ...c,
      format: ({ cellData }: { cellData: unknown }) => `fmt:${String(cellData)}`,
    }) as unknown as ProcessedColumn)

    const t0 = performance.now()
    let sink = 0
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < cols.length; j++)
        sink += String(resolveCellValue(rows[i], cols[j]!, i)).length
    }
    const t1 = performance.now()
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < cols.length; j++)
        sink += String(resolveCellDisplayValue(rows[i], cols[j]!, i, cols as never, j)).length
    }
    const t2 = performance.now()

    // eslint-disable-next-line no-console
    console.log(
      `[filter-format-bench] raw: ${(t1 - t0).toFixed(1)}ms, format: ${(t2 - t1).toFixed(1)}ms, ratio: ${((t2 - t1) / Math.max(t1 - t0, 0.01)).toFixed(2)}x`,
    )

    expect(sink).toBeGreaterThan(0)
  })

  it('logs 100k x 5 filter-format worst case (E2 decision gate: workerize only beyond 100ms)', () => {
    const rows = makeRows(100_000, 5)
    const cols = makeCols(5).map(c => ({
      ...c,
      format: ({ cellData }: { cellData: unknown }) => `fmt:${String(cellData)}`,
    }) as unknown as ProcessedColumn)

    const t0 = performance.now()
    let hits = 0
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < cols.length; j++) {
        const v = String(resolveCellDisplayValue(rows[i], cols[j]!, i, cols as never, j))
        if (v.includes('fmt:v1'))
          hits++
      }
    }
    const t1 = performance.now()

    // eslint-disable-next-line no-console
    console.log(
      `[filter-100k-bench] format single pass: ${(t1 - t0).toFixed(1)}ms, hits: ${hits}`,
    )

    expect(hits).toBeGreaterThan(0)
  })

  it('logs span build timings (E1 gate: 10k rows x 2 span cols, real useCellSpan)', () => {
    // <zh/> 每 10 行连续同值 → 1000 组 × rowspan 10（含 hidden 键）， exercises origin + hidden 路径
    // <en/> 10 consecutive rows share a value → 1000 groups × rowspan 10 (incl. hidden keys)
    const rows: Record<string, unknown>[] = []
    for (let i = 0; i < 10_000; i++)
      rows.push({ id: String(i), c0: `v${Math.floor(i / 10)}`, c1: `w${Math.floor(i / 10)}`, c2: `x${i}` })
    const cols = makeCols(3)
    let limitHits = 0

    const t0 = performance.now()
    const span = useCellSpan({
      data: rows,
      columns: cols,
      rowSpanCells: { c0: true, c1: true } as never,
      onSpanLimitExceeded: () => { limitHits++ },
    })
    const map = span.spanMap.value
    const enabled = span.spanEnabled.value
    const t1 = performance.now()

    // eslint-disable-next-line no-console
    console.log(
      `[span-bench] build: ${(t1 - t0).toFixed(1)}ms, entries: ${map.size}, enabled: ${enabled}, limitHits: ${limitHits}`,
    )

    expect(map.size).toBeGreaterThan(0)
    expect(enabled).toBe(true)
  })

  it('logs worker payload build vs clone cost (E3 gate: 10k rows x 3 sort keys)', () => {
    const rows = makeRows(10_000, 20)
    const keys: unknown[][] = []
    const t0 = performance.now()
    for (let e = 0; e < 3; e++) {
      const arr: unknown[] = Array.from({ length: rows.length })
      for (let i = 0; i < rows.length; i++)
        arr[i] = (rows[i] as Record<string, unknown>)[`c${e}`]
      keys.push(arr)
    }
    const t1 = performance.now()
    const probe = keys.map(k => k.length)
    // <zh/> structuredClone  acting as a proxy for postMessage clone cost (same algorithm)
    // <en/> structuredClone as a proxy for postMessage clone cost (same algorithm)
    const cloned = structuredClone({ entries: probe, rows: rows.slice(0, 1000) })
    const t2 = performance.now()

    // eslint-disable-next-line no-console
    console.log(
      `[worker-payload-bench] takeKeys(3x10k): ${(t1 - t0).toFixed(1)}ms, clone(1k rows sample): ${(t2 - t1).toFixed(1)}ms`,
    )

    expect(probe).toEqual([10_000, 10_000, 10_000])
    expect(cloned.rows).toHaveLength(1000)
  })

  it('logs horizontal cell-descriptor build cost (E4 gate: 50 cols x 20 visible rows)', () => {
    const cols = makeCols(50)
    const widths = cols.map((c, i) => (c.width as number) + (i % 3))
    const prefix: number[] = Array.from({ length: widths.length + 1 }).fill(0) as number[]
    for (let i = 0; i < widths.length; i++)
      prefix[i + 1] = prefix[i]! + widths[i]!

    const t0 = performance.now()
    let cells = 0
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 50; c++) {
        // <zh/> O(1) 前缀和定位（列虚拟化依赖） vs 全量 1000 格描述符构建
        // <en/> O(1) prefix-sum lookup (column-virtualization dependency) vs full 1000-cell descriptor build
        const x = prefix[c + 1]! - prefix[c]!
        if (x > 0)
          cells++
      }
    }
    const t1 = performance.now()

    // eslint-disable-next-line no-console
    console.log(
      `[hscroll-bench] 1000 cells O(1) locate: ${(t1 - t0).toFixed(1)}ms, cells: ${cells}, totalWidth: ${prefix[50]}`,
    )

    expect(cells).toBe(1000)
  })
})
