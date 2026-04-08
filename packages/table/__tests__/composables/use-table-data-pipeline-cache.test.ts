import type { ExternalFilterConfig, ProcessedColumn } from '../../src/types'
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

describe('useTableDataPipeline phase3', () => {
  const columns = ref<ProcessedColumn[]>([createCol()])
  const allData = ref([{ name: 'Alice' }, { name: 'Bob' }])

  it('afterExternalFilterData cache hit on identical filter result', () => {
    const externalFilter = ref<ExternalFilterConfig | undefined>({
      isExternalFilterPresent: () => true,
      doesExternalFilterPass: () => true,
    })
    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: allData,
      tableData: allData,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
      externalFilter,
    })
    const first = result.finalDisplayData.value
    externalFilter.value = {
      isExternalFilterPresent: () => true,
      doesExternalFilterPass: () => true,
    }
    const second = result.finalDisplayData.value
    expect(second).toStrictEqual(first)
  })

  it('finalDisplayData cache hit on stable result', () => {
    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: allData,
      tableData: allData,
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })
    const first = result.finalDisplayData.value
    const second = result.finalDisplayData.value
    expect(first).toBe(second)
  })

  it('selectableData cache hit without selectableFn', () => {
    const selectableFn = ref<any>(undefined)
    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: allData,
      tableData: allData,
      selectableFn,
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })
    const first = result.selectableData.value
    selectableFn.value = null as any
    const second = result.selectableData.value
    expect(second).toBe(first)
  })

  it('selectableData cache hit with stable filter result', () => {
    const selectableFn = ref<any>((_row: any) => true)
    const result = useTableDataPipeline({
      localColumns: columns,
      pipelineData: allData,
      tableData: allData,
      selectableFn,
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    })
    const first = result.selectableData.value
    selectableFn.value = (_row: any) => true
    const second = result.selectableData.value
    expect(second).toStrictEqual(first)
  })
})
