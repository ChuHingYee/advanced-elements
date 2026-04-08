import type { VNode } from 'vue'
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTableSummary } from '../../src/composables/features/use-table-summary'
import { mockColumn } from '../helpers'

function createSummary(options?: {
  data?: any[]
  columns?: ProcessedColumn[]
  showSummary?: boolean
  sumText?: string
  summaryMethod?: (params: { columns: ProcessedColumn[], data: any[] }) => (string | VNode)[]
}) {
  const data = ref(options?.data ?? [
    { id: '1', name: 'Alice', age: 25, salary: 50000 },
    { id: '2', name: 'Bob', age: 30, salary: 60000 },
    { id: '3', name: 'Charlie', age: 35, salary: 70000 },
  ])
  const columns = ref(options?.columns ?? [
    { ...mockColumn({ prop: 'name', hidden: false }) },
    { ...mockColumn({ prop: 'age', hidden: false }) },
    { ...mockColumn({ prop: 'salary', hidden: false }) },
  ] as ProcessedColumn[])

  return useTableSummary({
    data,
    columns,
    showSummary: options?.showSummary ?? true,
    sumText: options?.sumText,
    summaryMethod: options?.summaryMethod,
  })
}

describe('useTableSummary - summaryMethod', () => {
  it('uses custom method when provided', () => {
    const summaryMethod = vi.fn(() => ['Total', '—', '180000'])
    const s = createSummary({ summaryMethod })
    const data = s.summaryData.value
    expect(summaryMethod).toHaveBeenCalled()
    expect(data).toEqual({
      name: 'Total',
      age: '—',
      salary: '180000',
    })
  })

  it('falls back to default aggregation', () => {
    const s = createSummary()
    // First column (name) should get sumText '合计'
    expect(s.summaryData.value.name).toBe('合计')
    // Numeric columns should sum
    expect(s.summaryData.value.age).toBe('90')
    expect(s.summaryData.value.salary).toBe('180000')
  })

  it('handles empty data', () => {
    const s = createSummary({ data: [] })
    expect(s.summaryData.value.name).toBe('合计')
    expect(s.summaryData.value.age).toBe('')
    expect(s.summaryData.value.salary).toBe('')
  })

  it('reference stability on unchanged data', () => {
    const s = createSummary()
    const firstRef = s.summaryData.value
    // Access again - should return same reference
    const secondRef = s.summaryData.value
    expect(firstRef).toBe(secondRef)
  })

  it('shows empty when showSummary is false', () => {
    const s = createSummary({ showSummary: false })
    expect(Object.keys(s.summaryData.value).length).toBe(0)
  })

  it('getSummaryValue returns correct value for column', () => {
    const s = createSummary()
    const col = { prop: 'age', key: 'age', hidden: false } as unknown as ProcessedColumn
    const value = s.getSummaryValue(col)
    expect(value).toBe('90')
  })

  it('custom sumText', () => {
    const s = createSummary({ sumText: 'Grand Total' })
    expect(s.summaryData.value.name).toBe('Grand Total')
  })
})

describe('useTableSummary - summaryMethod result mapping', () => {
  it('returns empty when custom method returns no values', () => {
    const summaryMethod = vi.fn(() => [])
    const s = createSummary({ summaryMethod })
    expect(Object.keys(s.summaryData.value).length).toBe(0)
  })
})
