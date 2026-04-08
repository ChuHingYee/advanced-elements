import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { resolvePipelineOrder, useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'

function col(prop: string): ProcessedColumn {
  return { prop, label: prop, hidden: false, sortable: true, filter: true } as unknown as ProcessedColumn
}

describe('pipelineOrder', () => {
  it('defaults to the historical order when omitted', () => {
    expect(resolvePipelineOrder(undefined)).toEqual(['columnFilter', 'quickFilter', 'externalFilter', 'sort'])
  })

  it('falls back to default on invalid order', () => {
    const warn = vi.fn()
    expect(resolvePipelineOrder(['sort', 'sort', 'sort', 'sort'] as any, warn)).toEqual([
      'columnFilter',
      'quickFilter',
      'externalFilter',
      'sort',
    ])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('external-first order still filters and sorts correctly', () => {
    const columns = [col('name'), col('age')]
    const rows = [
      { name: 'Alice', age: 25, dept: 'eng' },
      { name: 'Bob', age: 30, dept: 'ops' },
      { name: 'Carol', age: 35, dept: 'eng' },
    ]
    const result = useTableDataPipeline({
      localColumns: ref(columns),
      pipelineData: ref(rows),
      tableData: ref(rows),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
      externalFilter: ref({
        isExternalFilterPresent: () => true,
        doesExternalFilterPass: (row: any) => row.dept === 'eng',
      }),
      pipelineOrder: ref(['externalFilter', 'columnFilter', 'quickFilter', 'sort']),
    } as any)
    // 外部筛前置：ops 行被剔除
    expect(result.finalDisplayData.value.map((r: any) => r.name).sort()).toEqual(['Alice', 'Carol'])
  })

  it('default order passes through unfiltered data identically', () => {
    const columns = [col('name')]
    const rows = [{ name: 'a' }, { name: 'b' }]
    const result = useTableDataPipeline({
      localColumns: ref(columns),
      pipelineData: ref(rows),
      tableData: ref(rows),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    } as any)
    expect(result.finalDisplayData.value).toEqual(rows)
  })
})
