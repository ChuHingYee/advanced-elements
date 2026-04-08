/**
 * @file use-table-summary phase2 — 补充分支覆盖
 * Covers: summaryMethod, default calculation, sumText, t() fallback, showSummary toggle
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useTableSummary } from '../../src/composables/features/use-table-summary'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useTableSummary phase2 — default calculation', () => {
  it('calculates sum for numeric columns', () => {
    const data = ref([{ name: 'Alice', age: 25, salary: 100 }, { name: 'Bob', age: 30, salary: 200 }])
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age'), makeCol('salary')])
    const { summaryData } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })
    // First column with prop gets sumText ('合计'), subsequent columns get sums
    expect(summaryData.value.name).toBe('合计')
    expect(summaryData.value.age).toBe('55')
    expect(summaryData.value.salary).toBe('300')
  })

  it('returns empty object when showSummary is false', () => {
    const data = ref([{ age: 25 }])
    const columns = ref<ProcessedColumn[]>([makeCol('age')])
    const { summaryData } = useTableSummary({
      data,
      columns,
      showSummary: () => false,
    })
    expect(summaryData.value).toEqual({})
  })

  it('handles empty data', () => {
    const data = ref([])
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])
    const { summaryData } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })
    // name is first col → gets sumText; age has no valid numbers → ''
    expect(summaryData.value.name).toBe('合计')
    expect(summaryData.value.age).toBe('')
  })

  it('handles non-numeric values', () => {
    const data = ref([{ name: 'Alice', age: 'not a number' }])
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])
    const { summaryData } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })
    // name is first col → gets sumText; age has no valid numbers → ''
    expect(summaryData.value.name).toBe('合计')
    expect(summaryData.value.age).toBe('')
  })

  it('handles null/undefined values', () => {
    const data = ref([{ name: 'A', age: null }, { name: 'B', age: undefined }, { name: 'C', age: 25 }])
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])
    const { summaryData } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })
    // name is first col → gets sumText; age sum = 25 (null/undefined skipped)
    expect(summaryData.value.name).toBe('合计')
    expect(summaryData.value.age).toBe('25')
  })
})

describe('useTableSummary phase2 — custom summaryMethod', () => {
  it('uses custom summaryMethod', () => {
    const data = ref([{ name: 'Alice', age: 25 }, { name: 'Bob', age: 30 }])
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])
    const { summaryData } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
      summaryMethod: ({ columns: cols, data: rows }) => {
        return cols.map((col) => {
          if (col.prop === 'age')
            return `Total: ${rows.reduce((sum, r) => sum + r.age, 0)}`
          return ''
        })
      },
    })
    expect(summaryData.value.age).toBe('Total: 55')
  })
})

describe('useTableSummary phase2 — sumText and t() fallback', () => {
  it('uses sumText when provided', () => {
    const data = ref([{ age: 25 }])
    const columns = ref<ProcessedColumn[]>([makeCol('age')])
    const { summaryData } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
      sumText: 'Total',
    } as any)
    // sumText is stored as the first column-with-prop's summary value
    expect(summaryData.value.age).toBe('Total')
  })

  it('uses t() when sumText is not provided', () => {
    const data = ref([{ age: 25 }])
    const columns = ref<ProcessedColumn[]>([makeCol('age')])
    const { summaryData } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
      t: () => 'Sum',
    } as any)
    // t('table.summary') fallback is stored as the first column-with-prop's summary value
    expect(summaryData.value.age).toBe('Sum')
  })

  it('falls back to 合计 when neither sumText nor t() is provided', () => {
    const data = ref([{ age: 25 }])
    const columns = ref<ProcessedColumn[]>([makeCol('age')])
    const { summaryData } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })
    expect(summaryData.value.age).toBe('合计')
  })
})

describe('useTableSummary phase2 — columns without prop', () => {
  it('skips columns without prop', () => {
    const data = ref([{ name: 'A', age: 25 }])
    const columns = ref<ProcessedColumn[]>([
      makeCol('selection', { selection: true, prop: undefined } as any),
      makeCol('name'),
      makeCol('age'),
    ])
    const { summaryData } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })
    // selection has no prop → skipped; name is first with prop → sumText; age → sum
    expect(summaryData.value.age).toBe('25')
    expect(summaryData.value.selection).toBeUndefined()
  })
})
