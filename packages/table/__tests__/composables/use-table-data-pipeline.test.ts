import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'

function createCol(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return {
    prop: 'name',
    label: 'Name',
    hidden: false,
    ...overrides,
  } as unknown as ProcessedColumn
}

interface CreatePipelineOptions {
  columns?: ProcessedColumn[]
  data?: any[]
  clientPagination?: boolean
  currentPage?: number
  pageSize?: number
  selectableFn?: (row: any, index: number) => boolean
  mergeCells?: any
  colMergeCells?: any
}

function createPipeline(options: CreatePipelineOptions = {}) {
  const columns = options.columns ?? [
    createCol({ prop: 'name', label: 'Name', hidden: false }),
    createCol({ prop: 'age', label: 'Age', hidden: false }),
  ]
  const pipelineData = options.data ?? [
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 },
    { name: 'Charlie', age: 35 },
  ]

  return useTableDataPipeline({
    localColumns: ref(columns),
    pipelineData: ref(pipelineData),
    tableData: ref(pipelineData),
    selectableFn: ref(options.selectableFn),
    isClientPagination: ref(options.clientPagination ?? false),
    currentPage: ref(options.currentPage ?? 1),
    pageSize: ref(options.pageSize ?? 20),
    mergeCells: options.mergeCells !== undefined ? ref(options.mergeCells) : undefined,
    colMergeCells: options.colMergeCells !== undefined ? ref(options.colMergeCells) : undefined,
  } as any)
}

describe('useTableDataPipeline', () => {
  describe('basic initialization', () => {
    it('returns pipeline outputs', () => {
      const result = createPipeline()
      expect(result.columnClassification).toBeDefined()
      expect(result.finalDisplayData).toBeDefined()
      expect(result.visibleData).toBeDefined()
      expect(result.selectableData).toBeDefined()
      expect(result.spanMethod).toBeDefined()
      expect(result.getSpanInfo).toBeDefined()
      expect(result.spanEnabled).toBeDefined()
      expect(result.hasActiveFilter).toBeDefined()
      expect(result.filterState).toBeDefined()
      expect(result.sortState).toBeDefined()
      expect(result.setFilter).toBeDefined()
      expect(result.toggleSort).toBeDefined()
      expect(result.getFilterValue).toBeDefined()
      expect(result.getEnumOptions).toBeDefined()
      expect(result.getSortOrder).toBeDefined()
    })

    it('passes through data when no client pagination', () => {
      const result = createPipeline({ data: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] })
      expect(result.visibleData.value).toHaveLength(3)
      expect(result.finalDisplayData.value).toHaveLength(3)
    })

    it('returns correct column classification', () => {
      const cols = [
        createCol({ prop: 'name', label: 'Name', hidden: false }),
        { selection: true } as unknown as ProcessedColumn,
        createCol({ prop: 'age', label: 'Age', hidden: false }),
      ]
      const result = createPipeline({ columns: cols })
      const cc = result.columnClassification.value
      expect(cc.selection).toHaveLength(1)
      expect(cc.normal).toHaveLength(2)
      expect(cc.leafColumns).toHaveLength(3)
      expect(cc.visibleTree).toHaveLength(2)
    })

    it('includes hoverOptionColumns and displayNormalColumns in classification', () => {
      const cols = [
        createCol({ prop: 'name', label: 'Name', hidden: false }),
        createCol({ prop: 'action', valueType: 'option', hoverActions: true, hidden: false }),
      ]
      const result = createPipeline({ columns: cols })
      const cc = result.columnClassification.value
      expect(cc.hoverOptionColumns).toHaveLength(1)
      expect(cc.hoverOptionColumns[0].prop).toBe('action')
      expect(cc.displayNormalColumns).toHaveLength(1)
      expect(cc.displayNormalColumns[0].prop).toBe('name')
    })

    it('correctly computes hasTeleport and allKeepAlive from hoverActions columns', () => {
      const cols = [
        createCol({ prop: 'name', label: 'Name', hidden: false }),
        createCol({ prop: 'a1', valueType: 'option', hoverActions: { teleport: true, keepAlive: false }, hidden: false }),
        createCol({ prop: 'a2', valueType: 'option', hoverActions: true, hidden: false }),
      ]
      const result = createPipeline({ columns: cols })
      const cc = result.columnClassification.value
      expect(cc.hasTeleport).toBe(true)
      expect(cc.allKeepAlive).toBe(false)
    })

    it('correctly computes hasFixed from fixed columns', () => {
      const cols = [
        createCol({ prop: 'name', label: 'Name', fixed: 'left', hidden: false }),
        createCol({ prop: 'age', label: 'Age', hidden: false }),
      ]
      const result = createPipeline({ columns: cols })
      const cc = result.columnClassification.value
      expect(cc.hasFixed).toBe(true)
    })

    it('correctly computes hasFixed as false when no fixed columns', () => {
      const cols = [
        createCol({ prop: 'name', label: 'Name', hidden: false }),
        createCol({ prop: 'age', label: 'Age', hidden: false }),
      ]
      const result = createPipeline({ columns: cols })
      const cc = result.columnClassification.value
      expect(cc.hasFixed).toBe(false)
    })

    it('correctly computes hasFixed with fixed right', () => {
      const cols = [
        createCol({ prop: 'name', label: 'Name', hidden: false }),
        createCol({ prop: 'action', label: 'Action', fixed: 'right', hidden: false }),
      ]
      const result = createPipeline({ columns: cols })
      const cc = result.columnClassification.value
      expect(cc.hasFixed).toBe(true)
    })

    it('filters hidden columns from classification', () => {
      const cols = [
        createCol({ prop: 'name', label: 'Name', hidden: true }),
        createCol({ prop: 'age', label: 'Age', hidden: false }),
      ]
      const result = createPipeline({ columns: cols })
      const cc = result.columnClassification.value
      expect(cc.normal).toHaveLength(1)
      expect(cc.visibleTree).toHaveLength(1)
      expect(cc.leafColumns).toHaveLength(1)
    })
  })

  describe('client pagination', () => {
    it('slices data when client pagination is enabled', () => {
      const data = Array.from({ length: 50 }, (_, i) => ({ name: `User${i}`, age: i }))
      const result = createPipeline({ data, clientPagination: true, currentPage: 1, pageSize: 10 })
      expect(result.visibleData.value).toHaveLength(10)
      expect(result.visibleData.value[0].name).toBe('User0')
    })

    it('returns correct page for client pagination', () => {
      const data = Array.from({ length: 50 }, (_, i) => ({ name: `User${i}`, age: i }))
      const result = createPipeline({ data, clientPagination: true, currentPage: 3, pageSize: 10 })
      expect(result.visibleData.value).toHaveLength(10)
      expect(result.visibleData.value[0].name).toBe('User20')
    })

    it('returns last page data correctly', () => {
      const data = Array.from({ length: 25 }, (_, i) => ({ name: `User${i}`, age: i }))
      const result = createPipeline({ data, clientPagination: true, currentPage: 3, pageSize: 10 })
      expect(result.visibleData.value).toHaveLength(5)
    })
  })

  describe('selectableData', () => {
    it('computes selectableData filtering with selectableFn', () => {
      const data = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
        { name: 'Charlie', age: 35 },
      ]
      const result = createPipeline({
        data,
        selectableFn: (row: any) => row.age >= 30,
      })
      expect(result.selectableData.value).toHaveLength(2)
      expect(result.selectableData.value[0].name).toBe('Bob')
    })

    it('passes through all data when no selectableFn is provided', () => {
      const result = createPipeline({ data: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] })
      expect(result.selectableData.value).toHaveLength(3)
    })

    it('returns empty selectableData when no rows pass selectableFn', () => {
      const result = createPipeline({
        data: [{ name: 'Alice', age: 25 }],
        selectableFn: () => false,
      })
      expect(result.selectableData.value).toHaveLength(0)
    })

    it('returns empty selectableData for empty data', () => {
      const result = createPipeline({ data: [] })
      expect(result.selectableData.value).toHaveLength(0)
    })

    it('uses selectableFn index parameter', () => {
      const result = createPipeline({
        data: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        selectableFn: (_row: any, index: number) => index % 2 === 0,
      })
      expect(result.selectableData.value).toHaveLength(2)
      expect(result.selectableData.value[0].name).toBe('A')
      expect(result.selectableData.value[1].name).toBe('C')
    })

    it('re-filters when selectableFn changes', () => {
      const selectableFnRef = ref<(row: any, index: number) => boolean>(() => true)

      const result = useTableDataPipeline({
        localColumns: ref([createCol({ prop: 'name', label: 'Name', hidden: false })]),
        pipelineData: ref([{ name: 'A' }, { name: 'B' }, { name: 'C' }]),
        tableData: ref([{ name: 'A' }, { name: 'B' }, { name: 'C' }]),
        selectableFn: selectableFnRef,
        isClientPagination: ref(false),
        currentPage: ref(1),
        pageSize: ref(20),
      })

      expect(result.selectableData.value).toHaveLength(3)

      selectableFnRef.value = (row: any) => row.name !== 'B'
      expect(result.selectableData.value).toHaveLength(2)
      expect(result.selectableData.value.map((r: any) => r.name)).toEqual(['A', 'C'])
    })

    it('falls back to all data when selectableFn becomes undefined', () => {
      const selectableFnRef = ref<(row: any, index: number) => boolean>(() => false)

      const result = useTableDataPipeline({
        localColumns: ref([createCol({ prop: 'name', label: 'Name', hidden: false })]),
        pipelineData: ref([{ name: 'A' }, { name: 'B' }]),
        tableData: ref([{ name: 'A' }, { name: 'B' }]),
        selectableFn: selectableFnRef,
        isClientPagination: ref(false),
        currentPage: ref(1),
        pageSize: ref(20),
      })

      expect(result.selectableData.value).toHaveLength(0)

      selectableFnRef.value = undefined as any
      expect(result.selectableData.value).toHaveLength(2)
    })

    it('returns stable computed references for unchanged data', () => {
      const result = createPipeline()
      const sd1 = result.selectableData.value
      const sd2 = result.selectableData.value
      expect(sd1).toBe(sd2)
    })
  })

  describe('individual pipeline output stability', () => {
    it('returns stable references for unchanged computed sources', () => {
      const result = createPipeline()
      const cc1 = result.columnClassification.value
      const cc2 = result.columnClassification.value
      expect(cc1.visibleTree).toBe(cc2.visibleTree)
      expect(cc1.normal).toBe(cc2.normal)
      expect(cc1.selection).toBe(cc2.selection)
    })

    it('maintains stable function references across evaluations', () => {
      const result = createPipeline()
      const gv1 = result.getFilterValue
      const gv2 = result.getFilterValue
      expect(gv1).toBe(gv2)

      const sf1 = result.setFilter
      const sf2 = result.setFilter
      expect(sf1).toBe(sf2)

      const gso1 = result.getSortOrder
      const gso2 = result.getSortOrder
      expect(gso1).toBe(gso2)

      const ts1 = result.toggleSort
      const ts2 = result.toggleSort
      expect(ts1).toBe(ts2)
    })
  })

  describe('filter and sort integration', () => {
    it('hasActiveFilter starts false', () => {
      const result = createPipeline()
      expect(result.hasActiveFilter.value).toBe(false)
    })

    it('sortState starts empty', () => {
      const result = createPipeline()
      expect(result.sortState.value).toEqual([])
    })

    it('filteredData returns all data when no filter is set', () => {
      const result = createPipeline({ data: [{ name: 'A' }, { name: 'B' }] })
      expect(result.filteredData.value).toEqual({
        data: [{ name: 'A' }, { name: 'B' }],
        isFiltered: false,
      })
    })
  })

  describe('cell span integration', () => {
    it('spanEnabled is false when no span config', () => {
      const result = createPipeline()
      expect(result.spanEnabled.value).toBe(false)
    })

    it('spanMethod returns undefined when span is not enabled', () => {
      const result = createPipeline()
      expect(result.spanMethod.value).toBeUndefined()
    })

    it('getSpanInfo returns undefined when no span config', () => {
      const result = createPipeline()
      expect(result.getSpanInfo(0, 'name')).toBeUndefined()
    })
  })
})
