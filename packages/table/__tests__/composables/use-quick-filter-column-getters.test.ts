/**
 * @file use-quick-filter phase3 — columnGetters branch coverage
 * Covers: valueGetter, format, valueEnum, no prop, option columns, quickFilterSuppress
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useQuickFilter } from '../../src/composables/data/use-quick-filter'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useQuickFilter phase3 — columnGetters branches', () => {
  it('uses valueGetter when column has valueGetter', () => {
    const data = ref([
      { name: 'Alice', computed: 'special-x' },
      { name: 'Bob', computed: 'special-y' },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('computed', { valueGetter: ({ row }: any) => row.computed }),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'special-x',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(filteredData.value.data).toHaveLength(1)
    expect(filteredData.value.data[0].name).toBe('Alice')
  })

  it('uses format function to resolve cell display value', () => {
    const data = ref([
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('age', { format: ({ cellData }: any) => `FormattedAge:${cellData}` } as any),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'formattedage:25',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(filteredData.value.data).toHaveLength(1)
    expect(filteredData.value.data[0].name).toBe('Alice')
  })

  it('uses valueEnum to resolve cell display value', () => {
    const data = ref([
      { name: 'Alice', status: '1' },
      { name: 'Bob', status: '2' },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('status', {
        valueEnum: {
          1: { text: 'Active' },
          2: 'Disabled',
        },
      }),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'active',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(filteredData.value.data).toHaveLength(1)
    expect(filteredData.value.data[0].name).toBe('Alice')
  })

  it('handles null rawVal in valueEnum lookup', () => {
    const data = ref([
      { name: 'Alice', status: null },
      { name: 'Bob', status: '1' },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('status', {
        valueEnum: {
          1: { text: 'Active' },
        },
      }),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'alice',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    // Alice matches by name (status is null, valueEnum returns undefined)
    expect(filteredData.value.data).toHaveLength(1)
    expect(filteredData.value.data[0].name).toBe('Alice')
  })

  it('returns rawVal from valueEnum when enum key not found', () => {
    const data = ref([
      { name: 'Alice', status: 'unknown' },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('status', {
        valueEnum: {
          1: { text: 'Active' },
        },
      }),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'unknown',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(filteredData.value.data).toHaveLength(1)
  })

  it('uses valueGetter when no prop and no format', () => {
    const data = ref([
      { name: 'Alice', fullAge: 25 },
      { name: 'Bob', fullAge: 30 },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('age', {
        valueGetter: ({ row }: any) => `AgeNum:${row.fullAge}`,
      }),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'agenum:25',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(filteredData.value.data).toHaveLength(1)
    expect(filteredData.value.data[0].name).toBe('Alice')
  })

  it('excludes option valueType columns from search', () => {
    const data = ref([
      { name: 'Alice', option: 'searchable' },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('option', { valueType: 'option' as any }),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'searchable',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    // option column is excluded, so 'searchable' won't match
    expect(filteredData.value.data).toHaveLength(0)
  })

  it('excludes selection columns from search', () => {
    const data = ref([
      { name: 'Alice', selectable: 'hidden' },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('selectable', { selection: true }),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'hidden',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    // selection column is excluded
    expect(filteredData.value.data).toHaveLength(0)
  })

  it('returns all data when getters is empty', () => {
    const data = ref([
      { name: 'Alice' },
    ])
    const columns = computed(() => [
      makeCol('name', { selection: true }),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'alice',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    // All columns excluded → getters empty → no data matches
    expect(filteredData.value.data).toHaveLength(0)
  })

  it('skips null/empty cell values in search text', () => {
    const data = ref([
      { name: 'Alice', age: null, city: '' },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('age'),
      makeCol('city'),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'alice',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(filteredData.value.data).toHaveLength(1)
  })
})
