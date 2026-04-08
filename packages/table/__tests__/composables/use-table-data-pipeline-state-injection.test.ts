import type { SortState } from '../../src/composables/data/use-column-sort'
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import { useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'

function createCol(overrides: Record<string, unknown> = {}): ProcessedColumn {
  return {
    prop: 'name',
    label: 'Name',
    hidden: false,
    ...overrides,
  } as unknown as ProcessedColumn
}

function createPipeline(
  columns: ReturnType<typeof ref<ProcessedColumn[]>>,
  data: ReturnType<typeof ref<any[]>>,
  sortState: ReturnType<typeof shallowRef<SortState[]>>,
  filterState: ReturnType<typeof shallowRef<Record<string, any>>>,
) {
  return useTableDataPipeline({
    localColumns: columns,
    pipelineData: data,
    tableData: data,
    isClientPagination: ref(false),
    currentPage: ref(1),
    pageSize: ref(20),
    sortState,
    filterState,
  } as any)
}

/**
 * <zh/> 预创建共享状态注入——noop 存根与懒升级的真实 composable 共用同一 ref，
 * <zh/> 升级前后引用稳定，调用方可直接持有。
 * <en/> Pre-created shared state injection — noop stubs and lazily-upgraded real composables
 * <en/> share one ref, keeping identity stable across upgrades so callers hold it directly.
 */
describe('useTableDataPipeline pre-created state injection', () => {
  it('exposes the injected refs in both noop and upgraded phases', async () => {
    const sortState = shallowRef<SortState[]>([])
    const filterState = shallowRef<Record<string, any>>({})
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name' })])
    const data = ref([{ name: 'b' }, { name: 'a' }])
    const pipeline = createPipeline(columns, data, sortState, filterState)

    // <zh/> 筛选列同步升级，排序仍为 noop——两者均应暴露注入的引用
    // <en/> Filter upgrades synchronously, sort stays noop — both must expose the injected refs
    expect(pipeline.filterState).toBe(filterState)
    expect(pipeline.sortState).toBe(sortState)

    // <zh/> 写入流入共享引用 | <en/> Writes flow into the shared refs
    pipeline.setFilter('name', { type: 'text', operator: 'contains', value: 'a' })
    expect(Object.keys(filterState.value)).toHaveLength(1)
    expect(pipeline.hasActiveFilter.value).toBe(true)

    // <zh/> 运行时升级排序后引用保持不变 | <en/> Reference stays identical after the runtime sort upgrade
    columns.value = [createCol({ prop: 'name', sortable: true })]
    await nextTick()
    await nextTick()
    expect(pipeline.sortState).toBe(sortState)
    pipeline.toggleSort('name')
    expect(sortState.value).toHaveLength(1)
    expect(pipeline.getSortOrder('name')).toBe('ascending')
  })

  it('upgraded composables observe state pre-filled before upgrade', async () => {
    const sortState = shallowRef<SortState[]>([{ prop: 'name', order: 'ascending' }])
    const filterState = shallowRef<Record<string, any>>({})
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name', filter: false })])
    const data = ref([{ name: 'b' }, { name: 'a' }])
    const pipeline = createPipeline(columns, data, sortState, filterState)

    // <zh/> 升级前写入被 noop 丢弃是既有语义；但直接预填的共享状态必须被升级后的真实实例采纳
    // <en/> Pre-upgrade writes via noop are dropped (existing semantics); but shared state pre-filled
    // <en/> directly must be honored by the upgraded real instance
    columns.value = [createCol({ prop: 'name', filter: false, sortable: true })]
    await nextTick()
    await nextTick()
    expect(pipeline.sortState).toBe(sortState)
    expect(pipeline.finalDisplayData.value.map(r => r.name)).toEqual(['a', 'b'])
  })

  it('falls back to internal state when nothing is injected', () => {
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name', sortable: true })])
    const data = ref([{ name: 'b' }, { name: 'a' }])
    const pipeline = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    } as any)
    pipeline.toggleSort('name')
    expect(pipeline.sortState.value).toHaveLength(1)
    expect(pipeline.finalDisplayData.value.map(r => r.name)).toEqual(['a', 'b'])
  })
})
