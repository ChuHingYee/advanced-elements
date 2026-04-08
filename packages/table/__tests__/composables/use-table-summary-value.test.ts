/**
 * @file use-table-summary phase4 — getSummaryValue and summaryValueMap coverage
 * Covers: getSummaryValue with various column types, summaryValueMap prev comparison
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useTableSummary } from '../../src/composables/features/use-table-summary'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useTableSummary phase4 — getSummaryValue', () => {
  it('returns summary value by column key', () => {
    const data = ref([{ name: 'Alice', age: 25, salary: 100 }])
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age'), makeCol('salary')])
    const { getSummaryValue } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })

    // name is first column → gets sumText; age and salary get sums
    expect(getSummaryValue({ key: 'name', prop: 'name' } as any)).toBe('合计')
    expect(getSummaryValue({ key: 'age', prop: 'age' } as any)).toBe('25')
    expect(getSummaryValue({ key: 'salary', prop: 'salary' } as any)).toBe('100')
  })

  it('returns undefined for column with no summary', () => {
    const data = ref([{ name: 'Alice' }])
    const columns = ref<ProcessedColumn[]>([makeCol('name')])
    const { getSummaryValue } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })

    expect(getSummaryValue({ key: 'nonexistent', prop: 'nonexistent' } as any)).toBeUndefined()
  })

  it('returns undefined when showSummary is false', () => {
    const data = ref([{ age: 25 }])
    const columns = ref<ProcessedColumn[]>([makeCol('age')])
    const { getSummaryValue } = useTableSummary({
      data,
      columns,
      showSummary: () => false,
    })

    expect(getSummaryValue({ key: 'age', prop: 'age' } as any)).toBeUndefined()
  })

  it('looks up by column key when prop is absent', () => {
    const data = ref([{ name: 'Alice', age: 25 }])
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])
    const { getSummaryValue } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })

    // Column with key but no prop should still find the summary via key
    expect(getSummaryValue({ key: 'age' } as any)).toBe('25')
  })

  it('handles columns with prop but different key', () => {
    const data = ref([{ name: 'Alice', age: 25 }])
    const columns = ref<ProcessedColumn[]>([
      makeCol('col-name', { prop: 'name' }),
      makeCol('col-age', { prop: 'age' }),
    ])
    const { getSummaryValue } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })

    // Summary is stored by prop, getSummaryValue looks up by key then prop
    expect(getSummaryValue({ key: 'col-age', prop: 'age' } as any)).toBe('25')
  })

  it('handles summaryMethod returning undefined values', () => {
    const data = ref([{ name: 'Alice', age: 25 }])
    const columns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])
    const { getSummaryValue } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
      summaryMethod: () => [undefined, '55'],
    })

    // name has undefined result → not stored; age has '55'
    expect(getSummaryValue({ key: 'name', prop: 'name' } as any)).toBeUndefined()
    expect(getSummaryValue({ key: 'age', prop: 'age' } as any)).toBe('55')
  })

  it('handles columns without prop in getSummaryValue', () => {
    const data = ref([{ name: 'Alice', age: 25 }])
    const columns = ref<ProcessedColumn[]>([
      makeCol('selection', { selection: true, prop: undefined } as any),
      makeCol('name'),
      makeCol('age'),
    ])
    const { getSummaryValue } = useTableSummary({
      data,
      columns,
      showSummary: () => true,
    })

    // Selection column has no prop, should return undefined
    expect(getSummaryValue({ key: 'selection' } as any)).toBeUndefined()
  })
})
