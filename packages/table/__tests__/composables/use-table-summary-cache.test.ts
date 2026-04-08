/**
 * @file use-table-summary phase5 — cache stability branches
 * Covers: summaryData cache hit when showSummary=false, summaryMethod cache,
 * default summary cache, summaryValueMap cache stability
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTableSummary } from '../../src/composables/features/use-table-summary'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useTableSummary phase5 — summaryData cache stability', () => {
  it('returns prev when showSummary is false and prev is already empty', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name')])
    const data = ref([{ name: 'Alice' }])
    const showSummary = ref(false)

    const result = useTableSummary({ data, columns, showSummary })

    const first = result.summaryData.value
    expect(first).toEqual({})

    // Access again - should return same reference (cache hit)
    const second = result.summaryData.value
    expect(first).toBe(second)
  })

  it('returns prev when summaryMethod result is unchanged', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b')])
    const data = ref([{ a: 1, b: 2 }])
    const showSummary = ref(true)
    const summaryMethod = vi.fn(() => ['Total', '3'])

    const result = useTableSummary({ data, columns, showSummary, summaryMethod })

    const first = result.summaryData.value
    // Access again - summaryMethod returns same result
    summaryMethod.mockReturnValue(['Total', '3'])
    const second = result.summaryData.value
    expect(first).toBe(second)
  })

  it('returns prev when default summary result is unchanged', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('name'),
      makeCol('score'),
    ])
    const data = ref([{ name: 'Alice', score: 100 }])
    const showSummary = ref(true)

    const result = useTableSummary({ data, columns, showSummary })

    const first = result.summaryData.value
    // Access again - same data and columns
    const second = result.summaryData.value
    expect(first).toBe(second)
  })

  it('summaryData changes when data changes', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('name'),
      makeCol('score'),
    ])
    const data = ref([{ name: 'Alice', score: 100 }])
    const showSummary = ref(true)

    const result = useTableSummary({ data, columns, showSummary })

    const first = result.summaryData.value
    expect(first.score).toBe('100')

    data.value = [{ name: 'Alice', score: 200 }]
    const second = result.summaryData.value
    expect(second.score).toBe('200')
    expect(first).not.toBe(second)
  })

  it('summaryData with showSummary toggling from true to false', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('score')])
    const data = ref([{ name: 'Alice', score: 100 }])
    const showSummary = ref(true)

    const result = useTableSummary({ data, columns, showSummary })

    const first = result.summaryData.value
    expect(Object.keys(first).length).toBeGreaterThan(0)

    showSummary.value = false
    const second = result.summaryData.value
    expect(second).toEqual({})
  })

  it('summaryData with no prop columns returns empty map', () => {
    const columns = ref<ProcessedColumn[]>([
      { key: 'sel', label: '', hidden: false, selection: true } as any,
    ])
    const data = ref([{}])
    const showSummary = ref(true)

    const result = useTableSummary({ data, columns, showSummary })
    expect(result.summaryData.value).toEqual({})
  })

  it('summaryData with non-number values returns empty string', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('name'),
      makeCol('text'),
    ])
    const data = ref([{ name: 'Alice', text: 'hello' }])
    const showSummary = ref(true)

    const result = useTableSummary({ data, columns, showSummary })
    expect(result.summaryData.value.text).toBe('')
  })

  it('summaryData with NaN values excludes them from sum', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('name'),
      makeCol('val'),
    ])
    const data = ref([
      { name: 'A', val: 10 },
      { name: 'B', val: Number.NaN },
      { name: 'C', val: 20 },
    ])
    const showSummary = ref(true)

    const result = useTableSummary({ data, columns, showSummary })
    expect(result.summaryData.value.val).toBe('30')
  })

  it('summaryData with sumText fallback to t()', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('score')])
    const data = ref([{ name: 'Alice', score: 100 }])
    const showSummary = ref(true)

    const result = useTableSummary({
      data,
      columns,
      showSummary,
      t: (key: string) => key === 'table.summary' ? 'Sum' : key,
    })

    expect(result.summaryData.value.name).toBe('Sum')
  })

  it('summaryData with sumText fallback to default 合计', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('score')])
    const data = ref([{ name: 'Alice', score: 100 }])
    const showSummary = ref(true)

    const result = useTableSummary({ data, columns, showSummary })

    expect(result.summaryData.value.name).toBe('合计')
  })
})

describe('useTableSummary phase5 — summaryValueMap cache stability', () => {
  it('returns prev when map entries are unchanged', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('score')])
    const data = ref([{ name: 'Alice', score: 100 }])
    const showSummary = ref(true)

    const result = useTableSummary({ data, columns, showSummary })

    // Access getSummaryValue to trigger summaryValueMap computation
    const firstVal = result.getSummaryValue({ key: 'score', prop: 'score' })
    const secondVal = result.getSummaryValue({ key: 'score', prop: 'score' })

    expect(firstVal).toBe(secondVal)
  })

  it('getSummaryValue returns undefined for unknown column', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name')])
    const data = ref([{ name: 'Alice' }])
    const showSummary = ref(true)

    const result = useTableSummary({ data, columns, showSummary })
    expect(result.getSummaryValue({ key: 'unknown', prop: 'unknown' })).toBeUndefined()
  })

  it('getSummaryValue finds value by key when prop is not in summaryData', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('custom-key', { prop: undefined } as any),
    ])
    const data = ref([{}])
    const showSummary = ref(true)
    const summaryMethod = () => ['Custom']

    const result = useTableSummary({ data, columns, showSummary, summaryMethod })
    const val = result.getSummaryValue({ key: 'custom-key' })
    expect(val).toBe('Custom')
  })
})

describe('useTableSummary phase5 — summaryMethod with undefined result', () => {
  it('skips undefined values in summaryMethod result', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b'), makeCol('c')])
    const data = ref([{ a: 1, b: 2, c: 3 }])
    const showSummary = ref(true)
    const summaryMethod = () => ['A', undefined, 'C']

    const result = useTableSummary({ data, columns, showSummary, summaryMethod })
    expect(result.summaryData.value.a).toBe('A')
    expect(result.summaryData.value.b).toBeUndefined()
    expect(result.summaryData.value.c).toBe('C')
  })
})
