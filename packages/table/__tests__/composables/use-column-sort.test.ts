import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it } from 'vitest'
import { useColumnSort } from '../../src/composables/data/use-column-sort'

describe('useColumnSort', () => {
  function createSort(options?: { columns?: ProcessedColumn[], data?: any[] }) {
    return useColumnSort({
      columns: () => options?.columns ?? [],
      data: () => options?.data ?? [],
    })
  }

  const columns: ProcessedColumn[] = [
    { prop: 'name', label: 'Name', sortable: true, hidden: false },
    { prop: 'age', label: 'Age', sortable: true, hidden: false },
    { prop: 'score', label: 'Score', sortable: 'custom', hidden: false },
    { prop: 'email', label: 'Email', hidden: false },
  ]

  const data = [
    { name: 'Charlie', age: 35, score: 85, email: 'c@b.com' },
    { name: 'Alice', age: 25, score: 90, email: 'a@b.com' },
    { name: 'Bob', age: 30, score: 75, email: 'b@b.com' },
  ]

  it('should initialize with no active sort', () => {
    const { sortState, sortedData } = createSort({ columns, data })
    expect(sortState.value).toEqual([])
    expect(sortedData.value.isSorted).toBe(false)
    expect(sortedData.value.data).toEqual(data)
  })

  describe('toggleSort', () => {
    it('should toggle: null → ascending → descending → null (single mode)', () => {
      const { toggleSort, sortState } = createSort({ columns, data })

      toggleSort('name')
      expect(sortState.value).toEqual([{ prop: 'name', columnKey: 'name', order: 'ascending' }])

      toggleSort('name')
      expect(sortState.value).toEqual([{ prop: 'name', columnKey: 'name', order: 'descending' }])

      toggleSort('name')
      expect(sortState.value).toEqual([])
    })

    it('should start with ascending when switching to different column', () => {
      const { toggleSort, sortState } = createSort({ columns, data })

      toggleSort('name')
      expect(sortState.value[0].order).toBe('ascending')

      toggleSort('age')
      expect(sortState.value).toEqual([{ prop: 'age', columnKey: 'age', order: 'ascending' }])
    })

    it('should add column on Shift+click (multi-sort)', () => {
      const { toggleSort, sortState } = createSort({ columns, data })

      toggleSort('name')
      toggleSort('age', { shiftKey: true })
      expect(sortState.value).toEqual([
        { prop: 'name', columnKey: 'name', order: 'ascending' },
        { prop: 'age', columnKey: 'age', order: 'ascending' },
      ])
    })

    it('should toggle direction of existing column in multi-sort', () => {
      const { toggleSort, sortState } = createSort({ columns, data })

      toggleSort('name', { shiftKey: true })
      toggleSort('age', { shiftKey: true })
      toggleSort('name', { shiftKey: true })
      expect(sortState.value).toEqual([
        { prop: 'name', columnKey: 'name', order: 'descending' },
        { prop: 'age', columnKey: 'age', order: 'ascending' },
      ])
    })

    it('should remove column from multi-sort when toggling past descending', () => {
      const { toggleSort, sortState } = createSort({ columns, data })

      toggleSort('name', { shiftKey: true })
      toggleSort('age', { shiftKey: true })
      toggleSort('name', { shiftKey: true })
      toggleSort('name', { shiftKey: true })
      expect(sortState.value).toEqual([
        { prop: 'age', columnKey: 'age', order: 'ascending' },
      ])
    })
  })

  describe('setSort', () => {
    it('should set sort state directly (single column)', () => {
      const { setSort, sortState } = createSort({ columns, data })

      setSort('name', 'ascending')
      expect(sortState.value).toEqual([{ prop: 'name', columnKey: 'name', order: 'ascending' }])

      setSort('age', 'descending')
      expect(sortState.value).toEqual([{ prop: 'age', columnKey: 'age', order: 'descending' }])

      // <zh/> order=null 仅移除该列：name 未在排序中即 no-op，age 保留；移除 age 后才清空
      // <en/> Null order removes only that column: removing a non-sorted column is a no-op
      setSort('name', null)
      expect(sortState.value).toEqual([{ prop: 'age', columnKey: 'age', order: 'descending' }])

      setSort('age', null)
      expect(sortState.value).toEqual([])
    })
  })

  describe('setSorts', () => {
    it('should set multi-column sort state directly', () => {
      const { setSorts, sortState } = createSort({ columns, data })

      setSorts([
        { prop: 'name', columnKey: 'name', order: 'ascending' },
        { prop: 'age', columnKey: 'age', order: 'descending' },
      ])
      expect(sortState.value).toEqual([
        { prop: 'name', columnKey: 'name', order: 'ascending' },
        { prop: 'age', columnKey: 'age', order: 'descending' },
      ])
    })

    it('should filter out invalid entries', () => {
      const { setSorts, sortState } = createSort({ columns, data })

      setSorts([
        { prop: 'name', columnKey: 'name', order: 'ascending' },
        { prop: '', order: null },
      ])
      expect(sortState.value).toEqual([
        { prop: 'name', columnKey: 'name', order: 'ascending' },
      ])
    })
  })

  describe('clearSort', () => {
    it('should reset sort state', () => {
      const { toggleSort, clearSort, sortState } = createSort({ columns, data })

      toggleSort('name')
      expect(sortState.value.length).toBe(1)

      clearSort()
      expect(sortState.value).toEqual([])
    })
  })

  describe('getSortOrder', () => {
    it('should return sort order for specific column', () => {
      const { setSort, getSortOrder } = createSort({ columns, data })

      setSort('name', 'ascending')
      expect(getSortOrder('name')).toBe('ascending')
      expect(getSortOrder('age')).toBeNull()
    })

    it('should return null for non-sorted column', () => {
      const { getSortOrder } = createSort({ columns, data })
      expect(getSortOrder('name')).toBeNull()
    })
  })

  describe('getSortIndex', () => {
    it('should return 0-based sort priority', () => {
      const { setSorts, getSortIndex } = createSort({ columns, data })

      setSorts([
        { prop: 'name', columnKey: 'name', order: 'ascending' },
        { prop: 'age', columnKey: 'age', order: 'descending' },
      ])
      expect(getSortIndex('name')).toBe(0)
      expect(getSortIndex('age')).toBe(1)
      expect(getSortIndex('score')).toBe(-1)
    })
  })

  describe('sortedData - client-side sort', () => {
    it('should sort strings ascending', () => {
      const { setSort, sortedData } = createSort({ columns, data })

      setSort('name', 'ascending')
      expect(sortedData.value.isSorted).toBe(true)
      expect(sortedData.value.data).toEqual([
        data[1],
        data[2],
        data[0],
      ])
    })

    it('should sort strings descending', () => {
      const { setSort, sortedData } = createSort({ columns, data })

      setSort('name', 'descending')
      expect(sortedData.value.data).toEqual([
        data[0],
        data[2],
        data[1],
      ])
    })

    it('should sort numbers ascending', () => {
      const { setSort, sortedData } = createSort({ columns, data })

      setSort('age', 'ascending')
      expect(sortedData.value.data).toEqual([
        data[1],
        data[2],
        data[0],
      ])
    })

    it('should sort numbers descending', () => {
      const { setSort, sortedData } = createSort({ columns, data })

      setSort('age', 'descending')
      expect(sortedData.value.data).toEqual([
        data[0],
        data[2],
        data[1],
      ])
    })

    it('should handle null/undefined values (sort to end)', () => {
      const dataWithNull = [
        { name: 'Bob', age: 30 },
        { name: 'Alice', age: null },
        { name: 'Charlie' },
      ]
      const { setSort, sortedData } = createSort({ columns, data: dataWithNull })

      setSort('age', 'ascending')
      expect(sortedData.value.data).toEqual([
        dataWithNull[0],
        dataWithNull[1],
        dataWithNull[2],
      ])
    })

    it('should apply multi-column sort in priority order', () => {
      const multiData = [
        { name: 'Alice', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
        { name: 'Bob', age: 20 },
      ]
      const { setSorts, sortedData } = createSort({ columns, data: multiData })

      setSorts([
        { prop: 'name', columnKey: 'name', order: 'ascending' },
        { prop: 'age', columnKey: 'age', order: 'ascending' },
      ])
      expect(sortedData.value.data).toEqual([
        multiData[1],
        multiData[0],
        multiData[3],
        multiData[2],
      ])
    })
  })

  describe('sortedData - custom sort', () => {
    it('should not modify data when sortable is "custom"', () => {
      const { setSort, sortedData } = createSort({ columns, data })

      setSort('score', 'ascending')
      expect(sortedData.value.isSorted).toBe(true)
      expect(sortedData.value.data).toEqual(data)
    })
  })

  describe('sortMethod', () => {
    it('should use custom sortMethod when provided', () => {
      const colsWithSortMethod: ProcessedColumn[] = [
        {
          prop: 'name',
          label: 'Name',
          sortable: {
            type: 'client',
            sortMethod: (a: any, b: any) => a.name.length - b.name.length,
          },
          hidden: false,
        },
      ]

      const { setSort, sortedData } = createSort({ columns: colsWithSortMethod, data })

      setSort('name', 'ascending')
      expect(sortedData.value.data).toEqual([data[2], data[1], data[0]])
    })
  })

  describe('sortBy', () => {
    it('should use sortBy function to get cell value', () => {
      const colsWithSortBy: ProcessedColumn[] = [
        {
          prop: 'fullName',
          label: 'Full Name',
          sortable: true,
          sortBy: (row: any) => row.lastName,
          hidden: false,
        },
      ]

      const sortData = [
        { fullName: 'John Doe', lastName: 'Doe' },
        { fullName: 'Jane Smith', lastName: 'Smith' },
        { fullName: 'Bob Brown', lastName: 'Brown' },
      ]

      const { setSort, sortedData } = createSort({ columns: colsWithSortBy, data: sortData })

      setSort('fullName', 'ascending')
      expect(sortedData.value.data).toEqual([
        sortData[2],
        sortData[0],
        sortData[1],
      ])
    })

    it('should use sortBy string to get cell value', () => {
      const colsWithSortBy: ProcessedColumn[] = [
        {
          prop: 'displayName',
          label: 'Display',
          sortable: true,
          sortBy: 'realName',
          hidden: false,
        },
      ]

      const sortData = [
        { displayName: 'A', realName: 'Charlie' },
        { displayName: 'B', realName: 'Alice' },
        { displayName: 'C', realName: 'Bob' },
      ]

      const { setSort, sortedData } = createSort({ columns: colsWithSortBy, data: sortData })

      setSort('displayName', 'ascending')
      expect(sortedData.value.data).toEqual([
        sortData[1],
        sortData[2],
        sortData[0],
      ])
    })

    it('should use sortBy array to get first non-null value', () => {
      const colsWithSortBy: ProcessedColumn[] = [
        {
          prop: 'name',
          label: 'Name',
          sortable: true,
          sortBy: ['nickName', 'lastName', 'firstName'],
          hidden: false,
        },
      ]

      const sortData = [
        { name: 'A', nickName: null, lastName: 'Smith', firstName: 'John' },
        { name: 'B', nickName: 'Bobby', lastName: null, firstName: null },
        { name: 'C', nickName: null, lastName: null, firstName: 'Charlie' },
      ]

      const { setSort, sortedData } = createSort({ columns: colsWithSortBy, data: sortData })

      setSort('name', 'ascending')
      expect(sortedData.value.data).toEqual([
        sortData[1],
        sortData[2],
        sortData[0],
      ])
    })
  })

  describe('edge cases', () => {
    it('should handle non-sortable column gracefully', () => {
      const { setSort, sortedData } = createSort({ columns, data })

      setSort('email', 'ascending')
      expect(sortedData.value.isSorted).toBe(false)
      expect(sortedData.value.data).toEqual(data)
    })

    it('should not mutate original data', () => {
      const originalData = [...data]
      const { setSort, sortedData: _sortedData } = createSort({ columns, data })

      setSort('age', 'ascending')
      expect(data).toEqual(originalData)
      expect(data[0]).toBe(originalData[0])
    })

    it('should handle empty data', () => {
      const { setSort, sortedData } = createSort({ columns, data: [] })

      setSort('name', 'ascending')
      expect(sortedData.value.data).toEqual([])
    })
  })
})
