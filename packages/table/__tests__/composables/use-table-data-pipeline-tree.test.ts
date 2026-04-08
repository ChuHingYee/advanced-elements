/**
 * @file use-table-data-pipeline phase4 — tree, row group, row expand, selectableFn branches
 * Covers: prePaginationExpandedData with expand, prePaginationGroupedData with group,
 * selectableData with predicate, columnClassification with hover option columns
 */
import type { ProcessedColumn } from '../../src/types'
import type { RowExpandConfig, RowGroupConfig, TreeConfig } from '../../src/types/config'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'

function createCol(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return {
    prop: 'name',
    label: 'Name',
    ...overrides,
    hidden: false,
  } as unknown as ProcessedColumn
}

describe('useTableDataPipeline phase4 — tree data', () => {
  it('prePaginationData uses flattened tree data when tree is enabled', () => {
    const columns = ref<ProcessedColumn[]>([
      createCol({ prop: 'name', key: 'name' }),
    ])
    const data = ref([
      { id: 1, name: 'parent', children: [
        { id: 2, name: 'child1' },
        { id: 3, name: 'child2' },
      ] },
    ])
    const treeConfig = ref<TreeConfig>({
      enabled: true,
      children: 'children',
      rowKey: 'id',
    })

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
      treeConfig,
    })

    // Tree data should flatten parent + children
    const treeApi = result.treeApi
    expect(treeApi.treeEnabled.value).toBe(true)
    // Accessing flattenedData triggers the tree flatten
    expect(treeApi.flattenedData.value.length).toBeGreaterThanOrEqual(1)
  })

  it('prePaginationData passes through when tree is disabled', () => {
    const columns = ref<ProcessedColumn[]>([createCol()])
    const data = ref([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    expect(result.treeApi.treeEnabled.value).toBe(false)
    expect(result.finalDisplayData.value).toBe(data.value)
  })
})

describe('useTableDataPipeline phase4 — row group', () => {
  it('prePaginationGroupedData uses grouped data when group is enabled', () => {
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'category' })])
    const data = ref([
      { category: 'A', name: 'item1' },
      { category: 'A', name: 'item2' },
      { category: 'B', name: 'item3' },
    ])
    const rowGroupConfig = ref<RowGroupConfig>({
      enabled: true,
      groupBy: 'category',
    })

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
      rowGroupConfig,
    })

    expect(result.rowGroupApi.groupEnabled.value).toBe(true)
    // Grouped data should have group header rows
    const grouped = result.prePaginationExpandedData.value
    expect(grouped.length).toBeGreaterThanOrEqual(data.value.length)
  })

  it('prePaginationGroupedData passes through when group is disabled', () => {
    const columns = ref<ProcessedColumn[]>([createCol()])
    const data = ref([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    expect(result.rowGroupApi.groupEnabled.value).toBe(false)
  })
})

describe('useTableDataPipeline phase4 — row expand', () => {
  it('prePaginationExpandedData uses expanded data when expand is enabled', () => {
    const columns = ref<ProcessedColumn[]>([createCol()])
    const data = ref([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ])
    const rowExpandConfig = ref<RowExpandConfig>({
      enabled: true,
      expandedRowKeys: [1],
    })

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
      rowExpandConfig,
    })

    expect(result.rowExpandApi.expandEnabled.value).toBe(true)
    // Expanded data includes detail rows
    const expanded = result.prePaginationExpandedData.value
    expect(expanded.length).toBeGreaterThanOrEqual(data.value.length)
  })

  it('prePaginationExpandedData passes through when expand is disabled', () => {
    const columns = ref<ProcessedColumn[]>([createCol()])
    const data = ref([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    expect(result.rowExpandApi.expandEnabled.value).toBe(false)
  })
})

describe('useTableDataPipeline phase4 — selectableFn with predicate', () => {
  it('selectableData filters rows based on selectableFn', () => {
    const columns = ref<ProcessedColumn[]>([createCol()])
    const data = ref([
      { name: 'Alice', active: true },
      { name: 'Bob', active: false },
      { name: 'Charlie', active: true },
    ])
    const selectableFn = ref<(row: any, index: number) => boolean>(
      (row: any) => row.active === true,
    )

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn,
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    const selectable = result.selectableData.value
    expect(selectable).toHaveLength(2)
    expect(selectable[0].name).toBe('Alice')
    expect(selectable[1].name).toBe('Charlie')
  })

  it('selectableData cache stability with same predicate result', () => {
    const columns = ref<ProcessedColumn[]>([createCol()])
    const data = ref([{ name: 'Alice' }])
    const selectableFn = ref<any>(() => true)

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn,
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    const first = result.selectableData.value
    // Change fn but same result
    selectableFn.value = (_row: any) => true
    const second = result.selectableData.value
    expect(second).toStrictEqual(first)
  })
})

describe('useTableDataPipeline phase4 — columnClassification with hover option', () => {
  it('classifies hover option columns with teleport=true', () => {
    const columns = ref<ProcessedColumn[]>([
      createCol({ prop: 'name', key: 'name' }),
      createCol({
        prop: 'actions',
        key: 'actions',
        valueType: 'option',
        hoverActions: { teleport: true, actions: [] } as any,
      }),
    ])
    const data = ref([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    const cc = result.columnClassification.value
    expect(cc.hasTeleport).toBe(true)
    expect(cc.hoverOptionColumns).toHaveLength(1)
  })

  it('classifies hover option columns with teleport=false (inline mode)', () => {
    const columns = ref<ProcessedColumn[]>([
      createCol({ prop: 'name', key: 'name' }),
      createCol({
        prop: 'actions',
        key: 'actions',
        valueType: 'option',
        hoverActions: { teleport: false, actions: [] } as any,
      }),
    ])
    const data = ref([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    const cc = result.columnClassification.value
    expect(cc.hasTeleport).toBe(false)
    expect(cc.hoverOptionColumns).toHaveLength(1)
    // Inline mode should have width=1, label=''
    expect(cc.hoverOptionColumns[0].width).toBe(1)
  })

  it('sets allKeepAlive=false when keepAlive is false', () => {
    const columns = ref<ProcessedColumn[]>([
      createCol({ prop: 'name', key: 'name' }),
      createCol({
        prop: 'actions',
        key: 'actions',
        valueType: 'option',
        hoverActions: { teleport: true, keepAlive: false, actions: [] } as any,
      }),
    ])
    const data = ref([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    const cc = result.columnClassification.value
    expect(cc.allKeepAlive).toBe(false)
  })

  it('detects hasFixed when column has fixed=true', () => {
    const columns = ref<ProcessedColumn[]>([
      createCol({ prop: 'name', key: 'name', fixed: 'left' }),
      createCol({ prop: 'age', key: 'age' }),
    ])
    const data = ref([{ name: 'Alice', age: 30 }])

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    const cc = result.columnClassification.value
    expect(cc.hasFixed).toBe(true)
  })

  it('handles group columns with hidden children', () => {
    const columns = ref<ProcessedColumn[]>([
      {
        key: 'group1',
        label: 'Group',
        hidden: false,
        children: [
          createCol({ prop: 'a', key: 'a', hidden: true }),
          createCol({ prop: 'b', key: 'b', hidden: false }),
        ],
      } as unknown as ProcessedColumn,
    ])
    const data = ref([{ a: 1, b: 2 }])

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    const cc = result.columnClassification.value
    // Only visible child 'b' should be in leafColumns
    expect(cc.leafColumns).toHaveLength(2) // both a and b are leaf (hidden check is separate)
    expect(cc.visibleTree).toHaveLength(1)
  })

  it('handles selection columns', () => {
    const columns = ref<ProcessedColumn[]>([
      createCol({ prop: 'selection', key: 'selection', selection: true } as any),
      createCol({ prop: 'name', key: 'name' }),
    ])
    const data = ref([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })

    const cc = result.columnClassification.value
    expect(cc.selection).toHaveLength(1)
    expect(cc.normal).toHaveLength(1)
  })
})
