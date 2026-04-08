/**
 * @file use-cell-span phase2 — 补充分支覆盖
 * Covers: rowSpan with custom compare, colSpan, ranges, spanMethod, getSpanInfo, SPAN_CELL_LIMIT
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useCellSpan } from '../../src/composables/data/use-cell-span'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useCellSpan phase2 — rowSpan with boolean config', () => {
  it('groups consecutive same-value rows', async () => {
    const data = [
      { name: 'Alice', dept: 'Eng' },
      { name: 'Bob', dept: 'Eng' },
      { name: 'Charlie', dept: 'Sales' },
    ]
    const columns = [makeCol('dept'), makeCol('name')]
    const { spanMap, spanEnabled } = useCellSpan({
      data: () => data,
      columns: () => columns,
      rowSpanCells: () => ({ dept: true } as any),
    })
    await nextTick()

    expect(spanEnabled.value).toBe(true)
    const map = spanMap.value
    // Row 0: origin with rowspan=2
    expect(map.get('0-dept')).toEqual({ rowspan: 2, colspan: 1, isOrigin: true })
    // Row 1: hidden
    expect(map.get('1-dept')).toEqual({ rowspan: 0, colspan: 0, isOrigin: false })
    // Row 2: standalone (no span)
    expect(map.has('2-dept')).toBe(false)
  })

  it('handles single row data', async () => {
    const data = [{ name: 'Alice', dept: 'Eng' }]
    const columns = [makeCol('dept'), makeCol('name')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
      rowSpanCells: () => ({ dept: true } as any),
    })
    await nextTick()
    // Single row should not produce any spans
    expect(spanMap.value.size).toBe(0)
  })

  it('handles empty data', async () => {
    const columns = [makeCol('dept')]
    const { spanMap, spanEnabled } = useCellSpan({
      data: () => [],
      columns: () => columns,
      rowSpanCells: () => ({ dept: true } as any),
    })
    await nextTick()
    expect(spanMap.value.size).toBe(0)
    expect(spanEnabled.value).toBe(false)
  })
})

describe('useCellSpan phase2 — rowSpan with custom compare function', () => {
  it('uses custom compare function for row span', async () => {
    const data = [
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 25 },
      { name: 'Charlie', age: 30 },
    ]
    const columns = [makeCol('age'), makeCol('name')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
      rowSpanCells: () => ({
        age: (a: any, b: any) => a.age === b.age,
      } as any),
    })
    await nextTick()

    const map = spanMap.value
    expect(map.get('0-age')).toEqual({ rowspan: 2, colspan: 1, isOrigin: true })
    expect(map.get('1-age')).toEqual({ rowspan: 0, colspan: 0, isOrigin: false })
  })
})

describe('useCellSpan phase2 — rowSpan via col.spanRows', () => {
  it('uses col.spanRows config', async () => {
    const data = [
      { name: 'Alice', dept: 'Eng' },
      { name: 'Bob', dept: 'Eng' },
    ]
    const columns = [makeCol('dept', { spanRows: true } as any), makeCol('name')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
    })
    await nextTick()

    expect(spanMap.value.get('0-dept')).toEqual({ rowspan: 2, colspan: 1, isOrigin: true })
  })
})

describe('useCellSpan phase2 — colSpan', () => {
  it('merges consecutive columns with same value', async () => {
    const data = [
      { a: 1, b: 1, c: 2 },
    ]
    const columns = [makeCol('a'), makeCol('b'), makeCol('c')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
      colSpanCells: () => ({
        a: true,
        b: true,
        c: true,
      } as any),
    })
    await nextTick()

    const map = spanMap.value
    // a and b have same value (1), should be merged
    expect(map.get('0-a')).toEqual(expect.objectContaining({ colspan: 2, isOrigin: true }))
    expect(map.get('0-b')).toEqual(expect.objectContaining({ colspan: 0, isOrigin: false }))
  })

  it('uses custom compare for colSpan', async () => {
    const data = [
      { a: 'x', b: 'y', c: 'z' },
    ]
    const columns = [makeCol('a'), makeCol('b'), makeCol('c')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
      colSpanCells: () => ({
        a: (row: any, left: string, cur: string) => row[left]?.length === row[cur]?.length,
        b: (row: any, left: string, cur: string) => row[left]?.length === row[cur]?.length,
      } as any),
    })
    await nextTick()

    const map = spanMap.value
    // a='x' (length 1), b='y' (length 1) → same length, should merge
    expect(map.get('0-a')).toEqual(expect.objectContaining({ colspan: 2, isOrigin: true }))
  })

  it('uses col.colSpan config', async () => {
    const data = [{ a: 1, b: 1 }]
    const columns = [
      makeCol('a', { colSpan: true } as any),
      makeCol('b', { colSpan: true } as any),
    ]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
    })
    await nextTick()

    expect(spanMap.value.get('0-a')).toEqual(expect.objectContaining({ colspan: 2, isOrigin: true }))
  })
})

describe('useCellSpan phase2 — ranges', () => {
  it('applies explicit span ranges', async () => {
    const data = [{ a: 1, b: 2 }, { a: 3, b: 4 }]
    const columns = [makeCol('a'), makeCol('b')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
      ranges: () => [{ row: 0, col: 0, rowspan: 2, colspan: 1 }] as any,
    })
    await nextTick()

    const map = spanMap.value
    expect(map.get('0-a')).toEqual(expect.objectContaining({ rowspan: 2, isOrigin: true }))
    expect(map.get('1-a')).toEqual(expect.objectContaining({ rowspan: 0, isOrigin: false }))
  })

  it('skips ranges with rowspan < 1 or colspan < 1', async () => {
    const data = [{ a: 1 }]
    const columns = [makeCol('a')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
      ranges: () => [
        { row: 0, col: 0, rowspan: 0, colspan: 1 },
        { row: 0, col: 0, rowspan: 1, colspan: 0 },
      ] as any,
    })
    await nextTick()

    expect(spanMap.value.size).toBe(0)
  })

  it('merges with existing origin cell', async () => {
    const data = [{ a: 1 }, { a: 1 }]
    const columns = [makeCol('a')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
      rowSpanCells: () => ({ a: true } as any),
      ranges: () => [{ row: 0, col: 0, rowspan: 2, colspan: 1 }] as any,
    })
    await nextTick()

    // Both rowSpan grouping and range should produce the same span
    const map = spanMap.value
    expect(map.get('0-a')).toEqual(expect.objectContaining({ rowspan: 2, isOrigin: true }))
  })
})

describe('useCellSpan phase2 — spanMethod', () => {
  it('returns span method function when spans exist', async () => {
    const data = [
      { dept: 'Eng', name: 'Alice' },
      { dept: 'Eng', name: 'Bob' },
    ]
    const columns = [makeCol('dept'), makeCol('name')]
    const { spanMethod, spanEnabled, getSpanInfo } = useCellSpan({
      data: () => data,
      columns: () => columns,
      rowSpanCells: () => ({ dept: true } as any),
    })
    await nextTick()
    await nextTick()

    // Verify spanMap is populated
    expect(spanEnabled.value).toBe(true)
    expect(getSpanInfo(0, 'dept')).toEqual({ rowspan: 2, colspan: 1, isOrigin: true })

    // spanMethod should be a function when spans exist
    const method = spanMethod.value
    expect(method).toBeDefined()
    expect(typeof method).toBe('function')
  })

  it('returns undefined for cells without span', async () => {
    const data = [{ name: 'Alice' }]
    const columns = [makeCol('name')]
    const { spanMethod } = useCellSpan({
      data: () => data,
      columns: () => columns,
    })
    await nextTick()

    const method = spanMethod.value
    expect(method).toBeUndefined()
  })
})

describe('useCellSpan phase2 — getSpanInfo', () => {
  it('returns span info by row and colKey', async () => {
    const data = [
      { dept: 'Eng', name: 'Alice' },
      { dept: 'Eng', name: 'Bob' },
    ]
    const columns = [makeCol('dept'), makeCol('name')]
    const { getSpanInfo } = useCellSpan({
      data: () => data,
      columns: () => columns,
      rowSpanCells: () => ({ dept: true } as any),
    })
    await nextTick()

    expect(getSpanInfo(0, 'dept')).toEqual({ rowspan: 2, colspan: 1, isOrigin: true })
    expect(getSpanInfo(1, 'dept')).toEqual({ rowspan: 0, colspan: 0, isOrigin: false })
    expect(getSpanInfo(0, 'name')).toBeUndefined()
  })
})

describe('useCellSpan phase2 — spanEnabled', () => {
  it('returns false when no span config', async () => {
    const data = [{ a: 1 }]
    const columns = [makeCol('a')]
    const { spanEnabled } = useCellSpan({
      data: () => data,
      columns: () => columns,
    })
    await nextTick()
    expect(spanEnabled.value).toBe(false)
  })

  it('returns true when rowSpanCells produces spans', async () => {
    const data = [{ a: 1 }, { a: 1 }]
    const columns = [makeCol('a')]
    const { spanEnabled } = useCellSpan({
      data: () => data,
      columns: () => columns,
      rowSpanCells: () => ({ a: true } as any),
    })
    await nextTick()
    expect(spanEnabled.value).toBe(true)
  })
})

describe('useCellSpan phase2 — SPAN_CELL_LIMIT', () => {
  it('skips span when estimated operations exceed limit', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data = Array.from({ length: 600000 }, (_, i) => ({ dept: i }))
    const columns = [makeCol('dept')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
      rowSpanCells: () => ({ dept: true } as any),
    })
    await nextTick()

    // Should return empty map due to limit
    expect(spanMap.value.size).toBe(0)
    consoleWarn.mockRestore()
  })
})
