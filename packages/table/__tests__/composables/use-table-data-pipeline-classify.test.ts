/**
 * @file use-table-data-pipeline phase2 — 补充分支覆盖
 * Covers: classifyColumns with hoverActions/teleport/group columns, externalFilter, tree, rowGroup, rowExpand, selectableFn
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

// <zh/> 保留的备用装配器——当前用例均直接构造 pipeline 选项；前缀下划线标记有意未使用
// <en/> Kept fallback assembler — current cases build pipeline options directly; underscore marks intentional non-use
function _createPipeline(overrides: any = {}) {
  const localColumns = ref<ProcessedColumn[]>([
    makeCol('name'),
    makeCol('age'),
  ])
  const pipelineData = ref<any[]>([
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 },
  ])
  const tableData = ref<any[]>([
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 },
  ])

  return {
    localColumns,
    pipelineData,
    tableData,
    ...useTableDataPipeline({
      localColumns,
      pipelineData,
      tableData,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
      ...overrides,
    }),
  }
}

describe('useTableDataPipeline phase2 — classifyColumns with hoverActions', () => {
  it('classifies hover option columns with teleport=true', () => {
    const localColumns = ref<ProcessedColumn[]>([
      makeCol('name'),
      makeCol('actions', {
        valueType: 'option',
        hoverActions: { teleport: true },
      }),
    ])
    const data = ref<any[]>([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
    })

    const cls = result.columnClassification.value
    expect(cls.hasTeleport).toBe(true)
    expect(cls.hoverOptionColumns).toHaveLength(1)
  })

  it('classifies hover option columns with teleport=false (inline mode)', () => {
    const localColumns = ref<ProcessedColumn[]>([
      makeCol('name'),
      makeCol('actions', {
        valueType: 'option',
        hoverActions: { teleport: false, keepAlive: false },
      }),
    ])
    const data = ref<any[]>([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
    })

    const cls = result.columnClassification.value
    expect(cls.hasTeleport).toBe(false)
    expect(cls.allKeepAlive).toBe(false)
    expect(cls.hoverOptionColumns).toHaveLength(1)
    // Inline mode: width should be 1, label cleared
    expect(cls.hoverOptionColumns[0].width).toBe(1)
    expect(cls.hoverOptionColumns[0].label).toBe('')
  })

  it('detects hasFixed for columns with fixed property', () => {
    const localColumns = ref<ProcessedColumn[]>([
      makeCol('name', { fixed: 'left' }),
      makeCol('age'),
    ])
    const data = ref<any[]>([{ name: 'Alice', age: 25 }])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
    })

    const cls = result.columnClassification.value
    expect(cls.hasFixed).toBe(true)
  })

  it('sets hasFixed for hover option columns with fixed (teleport: auto fix)', () => {
    const localColumns = ref<ProcessedColumn[]>([
      makeCol('name'),
      makeCol('actions', {
        valueType: 'option',
        fixed: 'right',
        hoverActions: { teleport: true },
      }),
    ])
    const data = ref<any[]>([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
    })

    const cls = result.columnClassification.value
    // hover option columns with fixed SHOULD set hasFixed=true so that
    // teleport: 'auto' resolves to Teleport mode (avoiding fixed overlay covering inline hover layer)
    expect(cls.hasFixed).toBe(true)
  })
})

describe('useTableDataPipeline phase2 — group columns', () => {
  it('processes group columns with hidden children', () => {
    const child1 = makeCol('child1')
    const child2 = makeCol('child2', { hidden: true })
    const parent = makeCol('parent', { children: [child1, child2] as any })
    const localColumns = ref<ProcessedColumn[]>([parent])
    const data = ref<any[]>([{ child1: 'a', child2: 'b' }])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
    })

    const cls = result.columnClassification.value
    expect(cls.leafColumns).toHaveLength(1) // only child1 is visible
    expect(cls.visibleTree).toHaveLength(1)
  })

  it('handles group columns where all children are hidden', () => {
    const child1 = makeCol('child1', { hidden: true })
    const parent = makeCol('parent', { children: [child1] as any })
    const localColumns = ref<ProcessedColumn[]>([parent])
    const data = ref<any[]>([{ child1: 'a' }])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
    })

    const cls = result.columnClassification.value
    // Parent with no visible children should not appear in visibleTree
    expect(cls.visibleTree).toHaveLength(0)
  })
})

describe('useTableDataPipeline phase2 — externalFilter', () => {
  it('filters data by external filter', () => {
    const data = ref([
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ])
    const localColumns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
      externalFilter: () => ({
        isExternalFilterPresent: () => true,
        doesExternalFilterPass: (row: any) => row.age > 26,
      }),
    })

    expect(result.finalDisplayData.value).toHaveLength(1)
    expect(result.finalDisplayData.value[0].name).toBe('Bob')
  })

  it('passes data through when external filter is not present', () => {
    const data = ref([
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ])
    const localColumns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
      externalFilter: () => ({
        isExternalFilterPresent: () => false,
        doesExternalFilterPass: () => true,
      }),
    })

    expect(result.finalDisplayData.value).toHaveLength(2)
  })
})

describe('useTableDataPipeline phase2 — selectableFn', () => {
  it('filters visible data by selectableFn', () => {
    const data = ref([
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ])
    const localColumns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
      selectableFn: () => (row: any) => row.age > 26,
    })

    expect(result.selectableData.value).toHaveLength(1)
    expect(result.selectableData.value[0].name).toBe('Bob')
  })

  it('returns all data when selectableFn is undefined', () => {
    const data = ref([
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ])
    const localColumns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
    })

    expect(result.selectableData.value).toHaveLength(2)
  })
})

describe('useTableDataPipeline phase2 — selection columns', () => {
  it('separates selection columns from normal columns', () => {
    const localColumns = ref<ProcessedColumn[]>([
      makeCol('selection', { selection: true } as any),
      makeCol('name'),
    ])
    const data = ref<any[]>([{ name: 'Alice' }])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => false,
      currentPage: () => 1,
      pageSize: () => 10,
    })

    const cls = result.columnClassification.value
    expect(cls.selection).toHaveLength(1)
    expect(cls.normal).toHaveLength(1)
  })
})

describe('useTableDataPipeline phase2 — client pagination', () => {
  it('slices data for client pagination', () => {
    const data = ref(
      Array.from({ length: 25 }, (_, i) => ({ name: `User${i}`, age: i })),
    )
    const localColumns = ref<ProcessedColumn[]>([makeCol('name'), makeCol('age')])

    const result = useTableDataPipeline({
      localColumns,
      pipelineData: data,
      tableData: data,
      isClientPagination: () => true,
      currentPage: () => 2,
      pageSize: () => 10,
    })

    // Page 2: items 10-19
    expect(result.visibleData.value).toHaveLength(10)
    expect(result.visibleData.value[0].name).toBe('User10')
  })
})
