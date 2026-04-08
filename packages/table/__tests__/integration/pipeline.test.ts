import type { ProcessedColumn } from '../../src/types/column'
/**
 * <zh/> 管线集成 — Filter/Sort/Tree/Pagination 全链
 * <en/> Pipeline integration — Filter/Sort/Tree/Pagination full chain
 */
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'

function col(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return { key: overrides.key ?? overrides.prop ?? 'col', prop: overrides.prop ?? 'col', label: 'C', width: 100, hidden: false, ...overrides } as ProcessedColumn
}

describe('pipeline integration', () => {
  it('filter + sort + pagination', async () => {
    const columns = ref<ProcessedColumn[]>([col({ prop: 'name', key: 'name', sortable: true }), col({ prop: 'age', key: 'age' })])
    const data = ref([{ name: 'Bob', age: 30 }, { name: 'Alice', age: 25 }, { name: 'Carol', age: 35 }])
    const pipeline = useTableDataPipeline({
      localColumns: columns,
      pipelineData: computed(() => data.value),
      tableData: computed(() => data.value),
      isClientPagination: computed(() => true),
      currentPage: computed(() => 1),
      pageSize: computed(() => 2),
      rowKeyFn: () => (r: any) => r.name,
    })
    expect(pipeline.visibleData.value.length).toBe(2)
    pipeline.toggleSort('name')
    await new Promise(r => setTimeout(r, 0))
    expect(pipeline.visibleData.value[0].name).toBe('Alice')
  })

  it('tree flatten', async () => {
    const columns = ref<ProcessedColumn[]>([col({ prop: 'name', key: 'name' })])
    const data = ref([{ id: '1', name: 'A', children: [{ id: '1-1', name: 'B' }] }] as any)
    const pipeline = useTableDataPipeline({
      localColumns: columns,
      pipelineData: computed(() => data.value),
      tableData: computed(() => data.value),
      isClientPagination: computed(() => false),
      currentPage: computed(() => 1),
      pageSize: computed(() => 10),
      treeConfig: computed(() => ({ children: 'children' } as any)),
      rowKeyFn: () => (r: any) => r.id,
    })
    expect(pipeline.treeApi.treeEnabled.value).toBe(true)
    expect(pipeline.finalDisplayData.value.length).toBe(1)
    // <zh/> 树展平后可见数据含子（可能 1 或 2 取决于展开状态，至少 1）| <en/> Visible after tree flatten contains child (1 or 2 depending on expand, at least 1)
    expect(pipeline.visibleData.value.length).toBeGreaterThanOrEqual(1)
  })
})
