/**
 * @file use-quick-filter phase2 — 补充分支覆盖
 * Covers: filter logic, column search fields, rowKey cache, invalidateRowCache
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useQuickFilter } from '../../src/composables/data/use-quick-filter'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useQuickFilter phase2 — basic filtering', () => {
  it('filters data by quick filter text', () => {
    const data = ref([
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ])
    const columns = computed(() => [makeCol('name'), makeCol('age')])

    const { filteredData, hasActiveQuickFilter } = useQuickFilter({
      quickFilterText: () => 'ali',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(hasActiveQuickFilter.value).toBe(true)
    expect(filteredData.value.isFiltered).toBe(true)
    expect(filteredData.value.data).toHaveLength(1)
    expect(filteredData.value.data[0].name).toBe('Alice')
  })

  it('returns all data when quickFilterText is empty', () => {
    const data = ref([
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ])
    const columns = computed(() => [makeCol('name'), makeCol('age')])

    const { filteredData, hasActiveQuickFilter } = useQuickFilter({
      quickFilterText: () => '',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(hasActiveQuickFilter.value).toBe(false)
    expect(filteredData.value.isFiltered).toBe(false)
    expect(filteredData.value.data).toHaveLength(2)
  })

  it('returns all data when quickFilterText is undefined', () => {
    const data = ref([{ name: 'Alice' }])
    const columns = computed(() => [makeCol('name')])

    const { filteredData, hasActiveQuickFilter } = useQuickFilter({
      quickFilterText: () => undefined,
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(hasActiveQuickFilter.value).toBe(false)
    expect(filteredData.value.isFiltered).toBe(false)
  })

  it('matches across multiple columns', () => {
    const data = ref([
      { name: 'Alice', age: 25, city: 'NYC' },
      { name: 'Bob', age: 30, city: 'LA' },
      { name: 'Charlie', age: 25, city: 'NYC' },
    ])
    const columns = computed(() => [makeCol('name'), makeCol('age'), makeCol('city')])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => '25',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(filteredData.value.data).toHaveLength(2)
  })
})

describe('useQuickFilter phase2 — case insensitive', () => {
  it('matches case insensitively', () => {
    const data = ref([
      { name: 'Alice' },
      { name: 'BOB' },
    ])
    const columns = computed(() => [makeCol('name')])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'alice',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    expect(filteredData.value.data).toHaveLength(1)
    expect(filteredData.value.data[0].name).toBe('Alice')
  })
})

describe('useQuickFilter phase2 — invalidateRowCache', () => {
  it('invalidates cache for specific row', () => {
    const data = ref([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])
    const columns = computed(() => [makeCol('name')])

    const { filteredData, invalidateRowCache } = useQuickFilter({
      quickFilterText: () => 'ali',
      data,
      columns,
      rowKey: (r: any) => r.id,
    })

    expect(filteredData.value.data).toHaveLength(1)

    // Change Alice's name to something that doesn't match
    data.value[0].name = 'Charlie'
    invalidateRowCache('1')

    // After invalidation, the filter should re-evaluate
    expect(filteredData.value.data).toHaveLength(0)
  })
})

describe('useQuickFilter phase2 — quickFilterSuppress', () => {
  it('suppresses columns with quickFilterSuppress from search', () => {
    const data = ref([
      { name: 'Alice', age: 25, secret: 'hidden' },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('age'),
      makeCol('secret', { quickFilterSuppress: true } as any),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'hidden',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    // 'secret' column is suppressed, should not match
    expect(filteredData.value.data).toHaveLength(0)
  })

  it('includes columns without quickFilterSuppress in search', () => {
    const data = ref([
      { name: 'Alice', age: 25, secret: 'hidden' },
    ])
    const columns = computed(() => [
      makeCol('name'),
      makeCol('age'),
      makeCol('secret'),
    ])

    const { filteredData } = useQuickFilter({
      quickFilterText: () => 'hidden',
      data,
      columns,
      rowKey: (r: any) => r.name,
    })

    // 'secret' column is not suppressed, should match
    expect(filteredData.value.data).toHaveLength(1)
  })
})
