import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef, watch } from 'vue'
import { formatFilterCondition, normalizeFilterConfig, useColumnFilter } from '../../src/composables/data/use-column-filter'

// ─── normalizeFilterConfig ────────────────────────────────────────────

describe('normalizeFilterConfig', () => {
  it('should normalize string to config object', () => {
    expect(normalizeFilterConfig('text')).toEqual({ type: 'text' })
    expect(normalizeFilterConfig('number')).toEqual({ type: 'number' })
    expect(normalizeFilterConfig('enum')).toEqual({ type: 'enum' })
  })

  it('should return config object as-is', () => {
    const config = { type: 'enum' as const, options: [{ label: 'Active', value: 1 }] }
    expect(normalizeFilterConfig(config)).toBe(config)
  })
})

// ─── useColumnFilter ──────────────────────────────────────────────────

describe('useColumnFilter cache regressions', () => {
  it.each(['row', 'all', 'null'] as const)('notifies filtered data and enum options after %s invalidation', (mode) => {
    const data = shallowRef([{ name: 'Alice' }, { name: 'Bob' }])
    const filter = useColumnFilter({
      data,
      columns: [{ prop: 'name', label: 'Name', hidden: false, filter: 'enum' }],
    })
    filter.setFilter('name', { type: 'text', operator: 'equals', value: 'Alice' })
    const observed = vi.fn()
    const stop = watch(filter.filteredData, observed, { flush: 'sync' })
    expect(filter.filteredData.value.data).toEqual([data.value[0]])
    expect(filter.getEnumOptions('name')).toEqual([{ label: 'Alice', value: 'Alice' }, { label: 'Bob', value: 'Bob' }])
    data.value[0].name = 'Carol'
    filter.invalidateRowCache(mode === 'row' ? data.value[0] : mode === 'null' ? null : undefined)
    expect(filter.filteredData.value.data).toEqual([])
    expect(observed).toHaveBeenCalledTimes(1)
    expect(filter.getEnumOptions('name')).toEqual([{ label: 'Carol', value: 'Carol' }, { label: 'Bob', value: 'Bob' }])
    stop()
    filter.dispose()
  })

  it.each(['format', 'valueGetter'] as const)('refreshes same-key %s without resetting the filter', async (kind) => {
    const columns = ref<ProcessedColumn[]>([{ prop: 'name', label: 'Name', hidden: false, filter: 'text' }])
    const filter = useColumnFilter({ data: [{ name: 'Alice' }], columns })
    filter.setFilter('name', { type: 'text', operator: 'equals', value: 'Alice' })
    expect(filter.filteredData.value.data).toHaveLength(1)
    const state = filter.filterState.value
    columns.value = [{ ...columns.value[0], [kind]: () => 'Bob' }]
    expect(filter.filteredData.value.data).toEqual([])
    await nextTick()
    expect(filter.filteredData.value.data).toEqual([])
    expect(filter.filterState.value).toBe(state)
    filter.dispose()
  })

  it('refreshes enum configuration repeatedly with unchanged data', () => {
    const columns = ref<ProcessedColumn[]>([{ prop: 'status', label: 'Status', hidden: false, filter: 'enum' }])
    const filter = useColumnFilter({ data: [{ status: 'a' }], columns })
    expect(filter.getEnumOptions('status')).toEqual([{ label: 'a', value: 'a' }])
    columns.value = [{ ...columns.value[0], valueEnum: { a: 'Active' } }]
    expect(filter.getEnumOptions('status')).toEqual([{ label: 'Active', value: 'a' }])
    columns.value[0].valueEnum!.a = 'Available'
    expect(filter.getEnumOptions('status')).toEqual([{ label: 'Available', value: 'a' }])
    columns.value[0].format = () => 'Formatted'
    expect(filter.getEnumOptions('status')).toEqual([{ label: 'Formatted', value: 'Formatted' }])
    columns.value[0].filter = { type: 'enum', filterByFormat: false }
    expect(filter.getEnumOptions('status')).toEqual([{ label: 'Available', value: 'a' }])
    columns.value[0].filter = { type: 'enum', options: [{ label: 'Static', value: 's' }] }
    expect(filter.getEnumOptions('status')).toEqual([{ label: 'Static', value: 's' }])
    columns.value[0].filter = false
    expect(filter.getEnumOptions('status')).toEqual([])
    filter.dispose()
  })

  it('tracks same-length enum row edits throughout repeated scans', () => {
    const data = ref([{ status: 'a' }])
    const filter = useColumnFilter({
      data,
      columns: [{ prop: 'status', label: 'Status', hidden: false, filter: 'enum' }],
    })
    expect(filter.getEnumOptions('status')).toEqual([{ label: 'a', value: 'a' }])
    for (const status of ['b', 'c']) {
      data.value[0].status = status
      expect(filter.getEnumOptions('status')).toEqual([{ label: status, value: status }])
    }
    filter.dispose()
  })

  it('invalidates enum options from allData even when the row is not visible', () => {
    const allData = shallowRef([{ status: 'a' }, { status: 'b' }])
    const filter = useColumnFilter({
      data: [allData.value[0]],
      allData,
      columns: [{ prop: 'status', label: 'Status', hidden: false, filter: 'enum' }],
    })
    expect(filter.getEnumOptions('status')).toHaveLength(2)
    allData.value[1].status = 'c'
    filter.invalidateRowCache(allData.value[1])
    expect(filter.getEnumOptions('status')).toEqual([{ label: 'a', value: 'a' }, { label: 'c', value: 'c' }])
    filter.dispose()
  })
})

describe('useColumnFilter', () => {
  function createFilter(options?: { columns?: ProcessedColumn[], data?: any[] }) {
    return useColumnFilter({
      columns: () => options?.columns ?? [],
      data: () => options?.data ?? [],
    })
  }

  const columns: ProcessedColumn[] = [
    { prop: 'name', label: 'Name', filter: 'text', hidden: false },
    { prop: 'age', label: 'Age', filter: { type: 'number' }, hidden: false },
    { prop: 'status', label: 'Status', filter: { type: 'enum' }, valueEnum: { 1: { text: 'Active' }, 2: { text: 'Inactive' } }, hidden: false },
    { prop: 'email', label: 'Email', hidden: false },
  ]

  const data = [
    { name: 'Alice', age: 25, status: '1', email: 'a@b.com' },
    { name: 'Bob', age: 30, status: '2', email: 'b@b.com' },
    { name: 'Charlie', age: 35, status: '1', email: 'c@b.com' },
    { name: '', age: 28, status: '2', email: 'd@b.com' },
  ]

  it('should initialize with no active filters', () => {
    const { hasActiveFilter, filteredData } = createFilter({ columns, data })
    expect(hasActiveFilter.value).toBe(false)
    expect(filteredData.value.isFiltered).toBe(false)
    expect(filteredData.value.data).toEqual(data)
  })

  // ─── Text filter ───────────────────────────────────────────────

  describe('text filter', () => {
    it('should filter rows by keyword (case-insensitive, contains)', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'contains', value: 'ali' })
      expect(filteredData.value.isFiltered).toBe(true)
      expect(filteredData.value.data).toEqual([data[0]])
    })

    it('should return all rows when value is empty', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'contains', value: '' })
      expect(filteredData.value.isFiltered).toBe(false)
      expect(filteredData.value.data).toEqual(data)
    })

    it('should filter rows with "notContains" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'notContains', value: 'ali' })
      expect(filteredData.value.data).toEqual([data[1], data[2], data[3]])
    })

    it('should filter rows with "equals" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'equals', value: 'Alice' })
      expect(filteredData.value.data).toEqual([data[0]])
    })

    it('should filter rows with "notEquals" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'notEquals', value: 'Alice' })
      expect(filteredData.value.data).toEqual([data[1], data[2], data[3]])
    })

    it('should filter rows with "beginsWith" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'beginsWith', value: 'bo' })
      expect(filteredData.value.data).toEqual([data[1]])
    })

    it('should filter rows with "endsWith" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'endsWith', value: 'ice' })
      // 'Alice' ends with 'ice' (case-insensitive), 'Charlie' ends with 'lie' not 'ice'
      expect(filteredData.value.data).toEqual([data[0]])
    })

    it('should filter rows with "blank" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'blank' })
      expect(filteredData.value.data).toEqual([data[3]])
    })

    it('should filter rows with "notBlank" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'notBlank' })
      expect(filteredData.value.data).toEqual([data[0], data[1], data[2]])
    })

    it('should filter with AND condition group', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', {
        type: 'text',
        operator: 'contains',
        value: 'li',
        conditions: {
          logic: 'and',
          condition: { operator: 'beginsWith', value: 'A' },
        },
      })
      // Contains 'li' AND beginsWith 'A' → only Alice
      expect(filteredData.value.data).toEqual([data[0]])
    })

    it('should filter with OR condition group', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', {
        type: 'text',
        operator: 'beginsWith',
        value: 'A',
        conditions: {
          logic: 'or',
          condition: { operator: 'beginsWith', value: 'Bo' },
        },
      })
      // beginsWith 'A' OR beginsWith 'Bo' → Alice, Bob
      expect(filteredData.value.data).toEqual([data[0], data[1]])
    })
  })

  // ─── Number filter ─────────────────────────────────────────────

  describe('number filter', () => {
    it('should filter rows with "gt" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('age', { type: 'number', operator: 'gt', value: 28 })
      expect(filteredData.value.data).toEqual([data[1], data[2]])
    })

    it('should filter rows with "lt" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('age', { type: 'number', operator: 'lt', value: 30 })
      expect(filteredData.value.data).toEqual([data[0], data[3]])
    })

    it('should filter rows with "eq" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('age', { type: 'number', operator: 'eq', value: 30 })
      expect(filteredData.value.data).toEqual([data[1]])
    })

    it('should filter rows with "neq" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('age', { type: 'number', operator: 'neq', value: 30 })
      expect(filteredData.value.data).toEqual([data[0], data[2], data[3]])
    })

    it('should filter rows with "gte" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('age', { type: 'number', operator: 'gte', value: 30 })
      expect(filteredData.value.data).toEqual([data[1], data[2]])
    })

    it('should filter rows with "lte" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('age', { type: 'number', operator: 'lte', value: 30 })
      expect(filteredData.value.data).toEqual([data[0], data[1], data[3]])
    })

    it('should filter rows with "between" operator', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('age', { type: 'number', operator: 'between', min: 26, max: 32 })
      expect(filteredData.value.data).toEqual([data[1], data[3]])
    })

    it('should filter rows with "blank" operator', () => {
      const customData = [...data, { name: 'Dave', age: null, status: '1', email: 'd@b.com' }]
      const { setFilter, filteredData } = createFilter({ columns, data: customData })
      setFilter('age', { type: 'number', operator: 'blank' })
      expect(filteredData.value.data).toEqual([customData[4]])
    })

    it('should filter rows with "notBlank" operator', () => {
      const customData = [...data, { name: 'Dave', age: null, status: '1', email: 'd@b.com' }]
      const { setFilter, filteredData } = createFilter({ columns, data: customData })
      setFilter('age', { type: 'number', operator: 'notBlank' })
      expect(filteredData.value.data).toEqual(data)
    })

    it('should exclude NaN values', () => {
      const customData = [...data, { name: 'Dave', age: Number.NaN, status: '1', email: 'd@b.com' }]
      const { setFilter, filteredData } = createFilter({ columns, data: customData })
      setFilter('age', { type: 'number', operator: 'gt', value: 0 })
      expect(filteredData.value.data).not.toContain(customData[4])
    })

    // ─── AND/OR condition group ─────────────────────────────────

    describe('condition group', () => {
      it('should apply AND condition group', () => {
        const { setFilter, filteredData } = createFilter({ columns, data })
        setFilter('age', {
          type: 'number',
          operator: 'gt',
          value: 24,
          conditions: {
            logic: 'and',
            condition: { operator: 'lt', value: 35 },
          },
        })
        // age > 24 AND age < 35 => Alice(25), Bob(30), 空行(28)
        expect(filteredData.value.data).toEqual([data[0], data[1], data[3]])
      })

      it('should apply OR condition group', () => {
        const { setFilter, filteredData } = createFilter({ columns, data })
        setFilter('age', {
          type: 'number',
          operator: 'lt',
          value: 26,
          conditions: {
            logic: 'or',
            condition: { operator: 'gt', value: 34 },
          },
        })
        // age < 26 OR age > 34 => Alice (25) and Charlie (35)
        expect(filteredData.value.data).toEqual([data[0], data[2]])
      })

      it('should apply OR condition group with between', () => {
        const { setFilter, filteredData } = createFilter({ columns, data })
        setFilter('age', {
          type: 'number',
          operator: 'eq',
          value: 25,
          conditions: {
            logic: 'or',
            condition: { operator: 'between', min: 29, max: 31 },
          },
        })
        // age === 25 OR (age >= 29 && age <= 31) => Alice (25) and Bob (30)
        expect(filteredData.value.data).toEqual([data[0], data[1]])
      })
    })
  })

  // ─── Enum filter ───────────────────────────────────────────────

  describe('enum filter', () => {
    it('should filter rows by selected enum values', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('status', { type: 'enum', selected: ['1'] })
      expect(filteredData.value.data).toEqual([data[0], data[2]])
    })

    it('should return all rows when no enum values selected', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('status', { type: 'enum', selected: [] })
      expect(filteredData.value.isFiltered).toBe(false)
    })
  })

  // ─── getEnumOptions ────────────────────────────────────────────

  describe('getEnumOptions', () => {
    it('should auto-derive enum options from data with valueEnum text', () => {
      const { getEnumOptions } = createFilter({ columns, data })
      const options = getEnumOptions('status')
      expect(options).toEqual([
        { label: 'Active', value: '1' },
        { label: 'Inactive', value: '2' },
      ])
    })

    it('should use explicit options when provided', () => {
      const explicitCols: ProcessedColumn[] = [
        { prop: 'status', label: 'Status', filter: { type: 'enum', options: [{ label: 'Yes', value: 1 }, { label: 'No', value: 0 }] }, hidden: false },
      ]
      const { getEnumOptions } = createFilter({ columns: explicitCols, data })
      const options = getEnumOptions('status')
      expect(options).toEqual([{ label: 'Yes', value: 1 }, { label: 'No', value: 0 }])
    })

    it('should pass correct row index to format function', () => {
      const formatSpy = vi.fn(({ cellData }: any) => `${cellData}-fmt`)
      const cols: ProcessedColumn[] = [
        {
          prop: 'status',
          label: 'Status',
          filter: { type: 'enum' },
          format: formatSpy,
          hidden: false,
        } as any,
      ]
      const rows = [
        { status: 'A' }, // idx 0, will be formatted
        { status: null }, // idx 1, null → skipped (continue), _optIdx still increments
        { status: 'B' }, // idx 2, will be formatted
        { status: 'C' }, // idx 3, will be formatted
      ]
      const { getEnumOptions } = createFilter({ columns: cols, data: rows })
      getEnumOptions('status')

      // First call: row 0, _optIdx=0
      expect(formatSpy).toHaveBeenCalledWith(
        expect.objectContaining({ index: 0, cellData: 'A' }),
      )
      // Second call: row 2, _optIdx=2 (row 1 was null, skipped but _optIdx incremented to 1, then row 2 increments to 2)
      expect(formatSpy).toHaveBeenCalledWith(
        expect.objectContaining({ index: 2, cellData: 'B' }),
      )
      // Third call: row 3, _optIdx=3
      expect(formatSpy).toHaveBeenCalledWith(
        expect.objectContaining({ index: 3, cellData: 'C' }),
      )
      // Exactly 3 calls (row 1 was skipped)
      expect(formatSpy).toHaveBeenCalledTimes(3)
    })
  })

  // ─── resetColumnFilter ─────────────────────────────────────────

  describe('resetColumnFilter', () => {
    it('should reset a specific column filter', () => {
      const { setFilter, resetColumnFilter, isColumnFiltered, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'contains', value: 'ali' })
      expect(isColumnFiltered('name')).toBe(true)
      resetColumnFilter('name')
      expect(isColumnFiltered('name')).toBe(false)
      expect(filteredData.value.isFiltered).toBe(false)
    })
  })

  // ─── resetAllFilters ───────────────────────────────────────────

  describe('resetAllFilters', () => {
    it('should reset all column filters', () => {
      const { setFilter, resetAllFilters, hasActiveFilter, filteredData } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'contains', value: 'ali' })
      setFilter('age', { type: 'number', operator: 'gt', value: 20 })
      expect(hasActiveFilter.value).toBe(true)
      resetAllFilters()
      expect(hasActiveFilter.value).toBe(false)
      expect(filteredData.value.isFiltered).toBe(false)
    })
  })

  // ─── isColumnFiltered ──────────────────────────────────────────

  describe('isColumnFiltered', () => {
    it('should return false for columns without filter', () => {
      const { isColumnFiltered } = createFilter({ columns, data })
      expect(isColumnFiltered('email')).toBe(false)
    })
  })

  // ─── Multiple filters ──────────────────────────────────────────

  describe('multiple filters', () => {
    it('should apply multiple filters simultaneously (AND logic)', () => {
      const { setFilter, filteredData } = createFilter({ columns, data })
      setFilter('status', { type: 'enum', selected: ['1'] })
      setFilter('age', { type: 'number', operator: 'gt', value: 26 })
      // status='1' AND age > 26 => only Charlie
      expect(filteredData.value.data).toEqual([data[2]])
    })
  })

  // ─── getFilterValue ─────────────────────────────────────────────

  describe('getFilterValue', () => {
    it('should return filter value for a key', () => {
      const { setFilter, getFilterValue } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'contains', value: 'ali' })
      const val = getFilterValue('name')
      expect(val).toBeDefined()
      expect(val!.type).toBe('text')
    })

    it('should return undefined for unknown key', () => {
      const { getFilterValue } = createFilter({ columns, data })
      expect(getFilterValue('nonexistent')).toBeUndefined()
    })
  })

  // ─── isColumnFiltered ───────────────────────────────────────────

  describe('isColumnFiltered (active state)', () => {
    it('should return true when column has active filter', () => {
      const { setFilter, isColumnFiltered } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'contains', value: 'ali' })
      expect(isColumnFiltered('name')).toBe(true)
    })

    it('should return false when column filter is inactive', () => {
      const { isColumnFiltered } = createFilter({ columns, data })
      expect(isColumnFiltered('name')).toBe(false)
    })
  })

  // ─── normalizeFilterConfig with true ────────────────────────────

  describe('normalizeFilterConfig true', () => {
    it('should return text type when true', () => {
      expect(normalizeFilterConfig(true)).toEqual({ type: 'text' })
    })
  })

  // ─── format type guard ────────────────────────────────────

  describe('format type guard', () => {
    it('should use formatted string value for filtering', () => {
      const cols: ProcessedColumn[] = [
        {
          prop: 'status',
          label: 'Status',
          filter: 'text',
          format: ({ cellData }: any) => cellData === '1' ? 'OK' : 'ERR',
          hidden: false,
        } as any,
      ]
      const rows = [
        { status: '1' },
        { status: '2' },
      ]
      const { setFilter, filteredData } = createFilter({ columns: cols, data: rows })
      setFilter('status', { type: 'text', operator: 'equals', value: 'OK' })
      expect(filteredData.value.data).toEqual([rows[0]])
    })

    it('should use formatted number value for filtering', () => {
      const cols: ProcessedColumn[] = [
        {
          prop: 'score',
          label: 'Score',
          filter: { type: 'number' },
          format: ({ cellData }: any) => (cellData as number) * 10,
          hidden: false,
        } as any,
      ]
      const rows = [
        { score: 5 },
        { score: 8 },
        { score: 3 },
      ]
      const { setFilter, filteredData } = createFilter({ columns: cols, data: rows })
      // format multiplies by 10: 5→50, 8→80, 3→30. Filter > 40 → 50, 80
      setFilter('score', { type: 'number', operator: 'gt', value: 40 })
      expect(filteredData.value.data).toEqual([rows[0], rows[1]])
    })

    it('should fall back to raw value when format returns non-primitive', () => {
      const cols: ProcessedColumn[] = [
        {
          prop: 'name',
          label: 'Name',
          filter: 'text',
          // format returns a VNode-like object (non-primitive)
          format: () => ({ __v_isVNode: true, type: 'span' }),
          hidden: false,
        } as any,
      ]
      const rows = [
        { name: 'Alice' },
        { name: 'Bob' },
      ]
      const { setFilter, filteredData } = createFilter({ columns: cols, data: rows })
      // Falls back to raw 'name' prop since format returned object
      setFilter('name', { type: 'text', operator: 'contains', value: 'Ali' })
      expect(filteredData.value.data).toEqual([rows[0]])
    })

    it('should ignore format when filterByFormat is false', () => {
      const formatFn = vi.fn(() => 'FORMATTED')
      const cols: ProcessedColumn[] = [
        {
          prop: 'name',
          label: 'Name',
          filter: { type: 'text', filterByFormat: false },
          format: formatFn,
          hidden: false,
        } as any,
      ]
      const rows = [
        { name: 'Alice' },
        { name: 'Bob' },
      ]
      const { setFilter, filteredData } = createFilter({ columns: cols, data: rows })
      // filterByFormat: false → uses raw 'Alice'/'Bob', not 'FORMATTED'
      setFilter('name', { type: 'text', operator: 'contains', value: 'Ali' })
      expect(filteredData.value.data).toEqual([rows[0]])
    })

    it('should use raw value when column has no format', () => {
      const cols: ProcessedColumn[] = [
        { prop: 'name', label: 'Name', filter: 'text', hidden: false },
      ]
      const rows = [
        { name: 'Alice' },
        { name: 'Bob' },
      ]
      const { setFilter, filteredData } = createFilter({ columns: cols, data: rows })
      setFilter('name', { type: 'text', operator: 'contains', value: 'Bob' })
      expect(filteredData.value.data).toEqual([rows[1]])
    })
  })

  // ─── filterState ref interface ───────────────────────────────

  describe('filterState ref interface', () => {
    it('filterState is a ref with Record type', () => {
      const { filterState } = createFilter({ columns, data })
      expect(filterState).toHaveProperty('value')
      expect(typeof filterState.value).toBe('object')
      expect(filterState.value).not.toBeNull()
    })

    it('setFilter mutates filterState.value[key] directly', () => {
      const { filterState, setFilter } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'contains', value: 'ali' })
      expect(filterState.value.name).toBeDefined()
      expect(filterState.value.name.type).toBe('text')
    })
  })

  // ─── immutable object creation ──────────────────────────────

  describe('immutable object creation', () => {
    it('resetColumnFilter creates a new filterState object', () => {
      const { filterState, setFilter, resetColumnFilter } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'contains', value: 'ali' })
      const originalRef = filterState.value
      resetColumnFilter('name')
      expect(filterState.value).not.toBe(originalRef)
    })

    it('resetAllFilters creates a completely new filterState object', () => {
      const { filterState, setFilter, resetAllFilters } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'contains', value: 'ali' })
      setFilter('age', { type: 'number', operator: 'gt', value: 20 })
      const originalRef = filterState.value
      resetAllFilters()
      expect(filterState.value).not.toBe(originalRef)
    })

    it('setFilter creates a new filterState object', () => {
      const { filterState, setFilter } = createFilter({ columns, data })
      setFilter('name', { type: 'text', operator: 'contains', value: 'ali' })
      const originalRef = filterState.value
      setFilter('age', { type: 'number', operator: 'gt', value: 20 })
      expect(filterState.value).not.toBe(originalRef)
    })
  })

  // ─── hasActiveFilter with ref ────────────────────────────────

  describe('hasActiveFilter with ref', () => {
    it('hasActiveFilter is false when filterState has no active filter values', () => {
      const { hasActiveFilter } = createFilter({ columns, data })
      // filterState may have keys from watch initialization, but none are active
      expect(hasActiveFilter.value).toBe(false)
    })

    it('hasActiveFilter toggles true/false correctly after setFilter then resetAllFilters', () => {
      const { hasActiveFilter, setFilter, resetAllFilters } = createFilter({ columns, data })
      expect(hasActiveFilter.value).toBe(false)
      setFilter('name', { type: 'text', operator: 'contains', value: 'ali' })
      expect(hasActiveFilter.value).toBe(true)
      resetAllFilters()
      expect(hasActiveFilter.value).toBe(false)
    })
  })

  it('getEnumOptions returns empty array for unknown column', () => {
    const { getEnumOptions } = createFilter({ columns, data })
    expect(getEnumOptions('nonexistent')).toEqual([])
  })

  it('skips enum options for column without prop', () => {
    const cols: ProcessedColumn[] = [
      ...columns,
      { prop: undefined as any, label: 'NoProp', filter: { type: 'enum' }, hidden: false },
    ]
    const { getEnumOptions } = createFilter({ columns: cols, data })
    expect(getEnumOptions('NoProp')).toEqual([])
  })

  it('uses string valueEnum directly as label', () => {
    const cols: ProcessedColumn[] = [
      { prop: 'status', label: 'Status', filter: { type: 'enum' }, valueEnum: { 1: 'Active', 2: 'Inactive' }, hidden: false },
    ]
    const dataWithEnum = [
      { name: 'Alice', status: '1' },
      { name: 'Bob', status: '2' },
    ]
    const { getEnumOptions } = createFilter({ columns: cols, data: dataWithEnum })
    const options = getEnumOptions('status')
    expect(options).toHaveLength(2)
    expect(options[0].label).toBe('Active')
    expect(options[1].label).toBe('Inactive')
  })

  it('resetColumnFilter deletes filter for column with filter:false', () => {
    const cols: ProcessedColumn[] = [
      { prop: 'blocked', label: 'Blocked', filter: false, hidden: false },
    ]
    const { setFilter, resetColumnFilter, getFilterValue } = createFilter({ columns: cols, data })
    setFilter('blocked', { type: 'text', operator: 'contains', value: 'test' })
    resetColumnFilter('blocked')
    expect(getFilterValue('blocked')).toBeUndefined()
  })

  it('handles setFilter and getFilterValue', () => {
    const { setFilter, getFilterValue } = useColumnFilter({
      columns: ref([]),
      onFilterChange: vi.fn(),
    } as any)
    setFilter('name', { type: 'text', operator: 'contains', value: 'test' })
    const val = getFilterValue('name')
    expect(val).toBeDefined()
    expect((val as any).value).toBe('test')
  })

  it('resetAllFilters clears all filters', () => {
    const onFilterChange = vi.fn()
    const { setFilter, resetAllFilters, getFilterValue } = useColumnFilter({
      columns: ref([]),
      onFilterChange,
    } as any)
    setFilter('name', { type: 'text', operator: 'contains', value: 'test' })
    resetAllFilters()
    expect(getFilterValue('name')).toBeUndefined()
  })
})

// ─── cellValueCache 命中判据 ─────────────────────────────────────────

describe('useColumnFilter cellValueCache hit criterion', () => {
  /**
   * <zh/> getter 合法返回 undefined（字段缺失 / null 值链）时，命中判据必须以"是否已计算"（has）
   * <zh/> 为准，而非"缓存值是否为 undefined"；否则每次筛选条件变更都会重复调用 getter，
   * <zh/> 退化为 O(条件变更次数 × 行数)。
   * <en/> When a getter legitimately returns undefined (missing field / null chain), the hit criterion
   * <en/> must be "already computed" (`has`) rather than "cached value is undefined"; otherwise every
   * <en/> filter change re-invokes the getter, degrading to O(filter changes × rows).
   */
  function createUndefinedGetterFixture() {
    const valueGetter = vi.fn(() => undefined)
    const columns: ProcessedColumn[] = [
      { prop: 'score', label: 'Score', filter: { type: 'text' }, valueGetter, hidden: false } as unknown as ProcessedColumn,
    ]
    const data = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Carol' }]
    const filter = useColumnFilter({ columns: () => columns, data: () => data })
    return { valueGetter, filter, data }
  }

  it('caches a legitimately-undefined getter result across filter changes', () => {
    const { valueGetter, filter } = createUndefinedGetterFixture()
    const { setFilter, filteredData } = filter

    // 首次激活筛选：每行调用一次 getter（3 行 → 3 次）
    setFilter('score', { type: 'text', operator: 'contains', value: 'x' })
    expect(filteredData.value.isFiltered).toBe(true)
    expect(filteredData.value.data).toEqual([])
    expect(valueGetter).toHaveBeenCalledTimes(3)

    // 变更筛选条件：cellValueCache 未清空（data/columns 未变），undefined 缓存值必须命中
    setFilter('score', { type: 'text', operator: 'contains', value: 'y' })
    expect(filteredData.value.data).toEqual([])
    expect(valueGetter).toHaveBeenCalledTimes(3)
  })

  it('recomputes after invalidateRowCache once a filter change re-evaluates', () => {
    const { valueGetter, filter } = createUndefinedGetterFixture()
    const { setFilter, filteredData, invalidateRowCache } = filter

    setFilter('score', { type: 'text', operator: 'blank' })
    // 'blank' 操作符对 undefined 值应全部匹配
    expect(filteredData.value.data).toHaveLength(3)
    expect(valueGetter).toHaveBeenCalledTimes(3)

    // 条件变更触发重算，但 undefined 缓存命中——getter 不再调用
    setFilter('score', { type: 'text', operator: 'notBlank' })
    expect(filteredData.value.data).toHaveLength(0)
    expect(valueGetter).toHaveBeenCalledTimes(3)

    // invalidateRowCache 仅清缓存，不改变响应式依赖；随后一次筛选变更触发重算并重填缓存
    invalidateRowCache()
    setFilter('score', { type: 'text', operator: 'blank' })
    expect(filteredData.value.data).toHaveLength(3)
    expect(valueGetter).toHaveBeenCalledTimes(6)
  })

  it('still caches non-undefined values correctly (no regression)', () => {
    const valueGetter = vi.fn(({ row }: { row: any }) => row.tags?.primary)
    const columns: ProcessedColumn[] = [
      { prop: 'score', label: 'Score', filter: { type: 'text' }, valueGetter, hidden: false } as unknown as ProcessedColumn,
    ]
    const data = [{ id: 1, tags: { primary: 'red' } }, { id: 2, tags: { primary: 'blue' } }]
    const { setFilter, filteredData, invalidateRowCache } = useColumnFilter({ columns: () => columns, data: () => data })

    setFilter('score', { type: 'text', operator: 'equals', value: 'red' })
    expect(filteredData.value.data).toEqual([data[0]])
    expect(valueGetter).toHaveBeenCalledTimes(2)

    setFilter('score', { type: 'text', operator: 'equals', value: 'blue' })
    expect(filteredData.value.data).toEqual([data[1]])
    // 缓存命中——不重复调用 getter
    expect(valueGetter).toHaveBeenCalledTimes(2)

    // 编辑提交后按行失效（按行对象定位，避免跨域行索引）：重新计算并命中编辑后的最新值
    data[0].tags.primary = 'green'
    invalidateRowCache(data[0])
    setFilter('score', { type: 'text', operator: 'equals', value: 'green' })
    expect(filteredData.value.data).toEqual([data[0]])
    // 仅第 0 行重算
    expect(valueGetter).toHaveBeenCalledTimes(3)
  })
})

// ─── formatFilterCondition ──────────────────────────────────────────

describe('formatFilterCondition', () => {
  it('returns empty string for undefined', () => {
    expect(formatFilterCondition(undefined)).toBe('')
  })

  describe('date filter', () => {
    it('formats "between" with start and end', () => {
      const result = formatFilterCondition({
        type: 'date',
        operator: 'between',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      })
      expect(result).toBe('2024-01-01 ~ 2024-12-31')
    })

    it('formats "between" with null dates as empty', () => {
      const result = formatFilterCondition({
        type: 'date',
        operator: 'between',
      })
      expect(result).toBe('')
    })

    it('formats "before" with value', () => {
      const result = formatFilterCondition({
        type: 'date',
        operator: 'before',
        value: '2024-06-01',
      })
      expect(result).toBe('早于 2024-06-01')
    })

    it('formats "before" without value as empty', () => {
      const result = formatFilterCondition({
        type: 'date',
        operator: 'before',
      })
      expect(result).toBe('')
    })

    it('formats "after" with value', () => {
      const result = formatFilterCondition({
        type: 'date',
        operator: 'after',
        value: '2024-06-01',
      })
      expect(result).toBe('晚于 2024-06-01')
    })

    it('returns empty for between operator without start/end', () => {
      // between requires startDate/endDate, won't use generic value
      const result = formatFilterCondition({
        type: 'date',
        operator: 'between' as any,
        value: '2024-01-01',
      })
      expect(result).toBe('')
    })
  })

  describe('enum filter without options', () => {
    it('joins selected values with comma', () => {
      const result = formatFilterCondition({
        type: 'enum',
        selected: ['a', 'b', 'c'],
      })
      expect(result).toBe('a, b, c')
    })
  })

  describe('text filter with conditions', () => {
    it('formats AND condition with both primary and secondary', () => {
      const result = formatFilterCondition({
        type: 'text',
        operator: 'contains',
        value: 'hello',
        conditions: { logic: 'and', condition: { operator: 'equals', value: 'world' } },
      })
      expect(result).toContain('hello')
      expect(result).toContain('world')
    })

    it('returns primary when secondary is empty for text AND', () => {
      const result = formatFilterCondition({
        type: 'text',
        operator: 'contains',
        value: 'hello',
        conditions: { logic: 'and', condition: { operator: 'equals', value: undefined } },
      })
      expect(result).toBe('Contains hello')
    })

    it('returns secondary when primary is empty for text AND', () => {
      const result = formatFilterCondition({
        type: 'text',
        operator: 'contains',
        value: '',
        conditions: { logic: 'and', condition: { operator: 'equals', value: 'fallback' } },
      })
      expect(result).toBe('Equals fallback')
    })
  })

  describe('number filter with conditions', () => {
    it('formats between with min and max', () => {
      const result = formatFilterCondition({
        type: 'number',
        operator: 'between',
        min: 10,
        max: 20,
      })
      expect(result).toContain('10')
      expect(result).toContain('20')
    })

    it('formats blank operator', () => {
      const result = formatFilterCondition({
        type: 'number',
        operator: 'blank',
      })
      expect(result).toBe('Is blank')
    })

    it('formats notBlank operator', () => {
      const result = formatFilterCondition({
        type: 'number',
        operator: 'notBlank',
      })
      expect(result).toBe('Is not blank')
    })
  })

  describe('unknown filter type', () => {
    it('returns empty string for unknown type', () => {
      const result = formatFilterCondition({ type: 'unknown' as any })
      expect(result).toBe('')
    })
  })
})
