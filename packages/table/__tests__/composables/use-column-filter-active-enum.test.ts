/**
 * @file use-column-filter phase2 — valueGetter, format, enum scan, cache stability
 * Covers: activeFilters with valueGetter, format, filterValue callback,
 * enum scan row limits, cached cell value, filteredData cache stability
 */
import type { ColumnFilterConfig, ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useColumnFilter } from '../../src/composables/data/use-column-filter'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useColumnFilter phase2 — activeFilters with valueGetter', () => {
  it('uses valueGetter when no format and no filterValue', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('name', { valueGetter: ({ row }) => (row as any).name?.toUpperCase() } as any),
    ])
    const data = ref([
      { name: 'alice' },
      { name: 'Bob' },
    ])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    result.setFilter('name', { type: 'text', operator: 'contains', value: 'ALICE' })
    expect(result.filteredData.value.isFiltered).toBe(true)
    expect(result.filteredData.value.data).toHaveLength(1)
    expect(result.filteredData.value.data[0].name).toBe('alice')
  })

  it('uses format when format is set and filterByFormat !== false', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('status', {
        format: ({ cellData }) => cellData === 1 ? 'Yes' : 'No',
      } as any),
    ])
    const data = ref([
      { status: 1 },
      { status: 0 },
      { status: 1 },
    ])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    // 'Yes' does not contain 'No' (case-insensitive), so only status=1 rows match
    result.setFilter('status', { type: 'text', operator: 'contains', value: 'Yes' })
    expect(result.filteredData.value.isFiltered).toBe(true)
    expect(result.filteredData.value.data).toHaveLength(2)
  })

  it('uses filterValue callback from ColumnFilterConfig', () => {
    const filterConfig: ColumnFilterConfig = {
      type: 'text',
      filterValue: (row: any, propValue: any) => `${row.prefix}_${propValue}`,
    }
    const columns = ref<ProcessedColumn[]>([
      makeCol('name', { filter: filterConfig } as any),
    ])
    const data = ref([
      { name: 'test', prefix: 'A' },
      { name: 'test', prefix: 'B' },
    ])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    result.setFilter('name', { type: 'text', operator: 'contains', value: 'A_test' })
    expect(result.filteredData.value.isFiltered).toBe(true)
    expect(result.filteredData.value.data).toHaveLength(1)
    expect(result.filteredData.value.data[0].prefix).toBe('A')
  })

  it('uses raw prop value when no format, no valueGetter, no filterValue', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name')])
    const data = ref([{ name: 'Alice' }, { name: 'Bob' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    result.setFilter('name', { type: 'text', operator: 'contains', value: 'Ali' })
    expect(result.filteredData.value.isFiltered).toBe(true)
    expect(result.filteredData.value.data).toHaveLength(1)
  })
})

describe('useColumnFilter phase2 — enum scan limits', () => {
  it('skips scan when rows exceed ENUM_SCAN_ROW_LIMIT', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const columns = ref<ProcessedColumn[]>([
      makeCol('status', { filter: { type: 'enum' } as any }),
    ])
    // Create > 100000 rows
    const largeData = Array.from({ length: 100001 }, (_, i) => ({ status: i % 3 }))

    const result = useColumnFilter({
      columns,
      data: ref(largeData),
      allData: ref(largeData),
    })

    const options = result.getEnumOptions('status')
    expect(options).toHaveLength(0)
    expect(consoleWarn).toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('samples when rows exceed ENUM_SCAN_SAMPLE_LIMIT but not ROW_LIMIT', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('status', { filter: { type: 'enum' } as any }),
    ])
    // Create 15000 rows (above 10000 sample limit, below 100000 row limit)
    const mediumData = Array.from({ length: 15000 }, (_, i) => ({ status: i % 5 }))

    const result = useColumnFilter({
      columns,
      data: ref(mediumData),
      allData: ref(mediumData),
    })

    const options = result.getEnumOptions('status')
    // Should scan only first 10000 rows → values 0-4
    expect(options.length).toBeLessThanOrEqual(5)
    expect(options.length).toBeGreaterThan(0)
  })

  it('uses static options from config when provided', () => {
    const staticOptions = [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
    ]
    const columns = ref<ProcessedColumn[]>([
      makeCol('status', { filter: { type: 'enum', options: staticOptions } as any }),
    ])
    const data = ref([{ status: 'active' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    const options = result.getEnumOptions('status')
    expect(options).toEqual(staticOptions)
  })

  it('skips columns with filter === false', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('name', { filter: false } as any),
    ])
    const data = ref([{ name: 'Alice' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    // No filter should be created for this column
    expect(result.getFilterValue('name')).toBeUndefined()
  })

  it('skips selection and option columns', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('sel', { selection: true } as any),
      makeCol('act', { valueType: 'option' } as any),
    ])
    const data = ref([{}])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    expect(result.getFilterValue('sel')).toBeUndefined()
    expect(result.getFilterValue('act')).toBeUndefined()
  })
})

describe('useColumnFilter phase2 — filteredData cache stability', () => {
  it('returns prev when data and filters unchanged (not filtered)', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name')])
    const data = ref([{ name: 'Alice' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    const first = result.filteredData.value
    const second = result.filteredData.value
    expect(first).toBe(second)
  })

  it('returns prev when filter result is identical', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name')])
    const data = ref([{ name: 'Alice' }, { name: 'Bob' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    result.setFilter('name', { type: 'text', operator: 'contains', value: 'Ali' })
    const first = result.filteredData.value
    // Access again - should return prev (same reference)
    const second = result.filteredData.value
    expect(first).toBe(second)
  })

  it('cached cell value is reused across filter changes', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('name', { valueGetter: ({ row }) => (row as any).name } as any),
    ])
    const data = ref([{ name: 'Alice' }, { name: 'Bob' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    result.setFilter('name', { type: 'text', operator: 'contains', value: 'A' })
    const firstResult = result.filteredData.value
    expect(firstResult.data).toHaveLength(1)

    // Second filter on same column - should use cached cell value
    result.setFilter('name', { type: 'text', operator: 'contains', value: 'B' })
    const secondResult = result.filteredData.value
    expect(secondResult.data).toHaveLength(1)
    expect(secondResult.data[0].name).toBe('Bob')
  })
})

describe('useColumnFilter phase2 — resetColumnFilter edge cases', () => {
  it('deletes filter for unknown column key', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name')])
    const data = ref([{ name: 'Alice' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    result.setFilter('unknown', { type: 'text', operator: 'contains', value: 'test' })
    expect(result.getFilterValue('unknown')).toBeDefined()

    // Reset - should delete since column is not found
    result.resetColumnFilter('unknown')
    expect(result.getFilterValue('unknown')).toBeUndefined()
  })

  it('resets filter for column with filter=false', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name', { filter: false } as any)])
    const data = ref([{ name: 'Alice' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    result.setFilter('name', { type: 'text', operator: 'contains', value: 'test' })
    result.resetColumnFilter('name')
    expect(result.getFilterValue('name')).toBeUndefined()
  })
})

describe('useColumnFilter phase2 — enum options with format', () => {
  it('scans enum options using format when filterByFormat !== false', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('status', {
        filter: { type: 'enum' } as any,
        format: ({ cellData }) => cellData === 1 ? 'Active' : 'Inactive',
      } as any),
    ])
    const data = ref([
      { status: 1 },
      { status: 0 },
      { status: 1 },
    ])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    const options = result.getEnumOptions('status')
    expect(options).toHaveLength(2)
    expect(options.some(o => o.label === 'Active')).toBe(true)
    expect(options.some(o => o.label === 'Inactive')).toBe(true)
  })

  it('scans enum options with valueEnum', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('status', {
        filter: { type: 'enum' } as any,
        valueEnum: {
          1: 'Active',
          0: { text: 'Inactive' },
        },
      } as any),
    ])
    const data = ref([
      { status: 1 },
      { status: 0 },
    ])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    const options = result.getEnumOptions('status')
    expect(options).toHaveLength(2)
    expect(options.find(o => o.value === 1)?.label).toBe('Active')
    expect(options.find(o => o.value === 0)?.label).toBe('Inactive')
  })

  it('skips null values in enum scan', () => {
    const columns = ref<ProcessedColumn[]>([
      makeCol('status', { filter: { type: 'enum' } as any }),
    ])
    const data = ref([
      { status: 1 },
      { status: null },
      { status: 2 },
      { status: undefined },
    ])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    const options = result.getEnumOptions('status')
    expect(options).toHaveLength(2)
  })
})

describe('useColumnFilter phase2 — isColumnFiltered', () => {
  it('returns false for column with no filter', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name')])
    const data = ref([{ name: 'Alice' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    expect(result.isColumnFiltered('name')).toBe(false)
  })

  it('returns false for inactive filter', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name')])
    const data = ref([{ name: 'Alice' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    // Default filter is inactive (empty value)
    expect(result.isColumnFiltered('name')).toBe(false)
  })

  it('returns true for active filter', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('name')])
    const data = ref([{ name: 'Alice' }])

    const result = useColumnFilter({
      columns,
      data,
      allData: data,
    })

    result.setFilter('name', { type: 'text', operator: 'contains', value: 'Ali' })
    expect(result.isColumnFiltered('name')).toBe(true)
  })
})
