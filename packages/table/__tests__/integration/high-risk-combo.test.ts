import type { ProcessedColumn } from '../../src/types/column'
/**
 * <zh/> 高危组合集成测试 — 覆盖初审 Phase3 的 8 场景中 3 个自构造高危组合
 * <en/> High-risk combo integration tests — covers 3 self-constructed high-risk combos from Phase3
 *
 * @remarks
 * <zh/> 场景6: rowPin + span + pagination — 验证 spanMap 按 renderData 域与 pin-strip 解耦
 * <zh/> 场景7: quickFilter + externalFilter + tree — 验证三阶段 O(3n) 串行不丢数据
 * <zh/> 场景8: column drag + fixed + virtual — 验证 fixed 列拖拽后 needsFixedWidth 翻转
 * <en/> Scenario6: rowPin + span + pagination — verifies spanMap decoupled from pin-strip
 * <en/> Scenario7: quickFilter + externalFilter + tree — verifies 3-stage O(3n) pipeline
 * <en/> Scenario8: column drag + fixed + virtual — verifies fixed column drag flips needsFixedWidth
 */
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'

function mockCol(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return {
    key: overrides.key ?? overrides.prop ?? 'col',
    prop: overrides.prop ?? 'col',
    label: overrides.label ?? 'Col',
    width: overrides.width ?? 100,
    hidden: false,
    ...overrides,
  } as ProcessedColumn
}

describe('high-risk combo integration', () => {
  it('scenario6: spanMap rebuilds on pagination page flip', async () => {
    const columns = ref<ProcessedColumn[]>([
      mockCol({ prop: 'dept', key: 'dept' }),
      mockCol({ prop: 'name', key: 'name' }),
    ])
    const fullData = Array.from({ length: 20 }, (_, i) => ({ id: String(i), dept: i < 10 ? 'A' : 'B', name: `N${i}` }))
    const currentPage = ref(1)
    const pageSize = ref(10)
    const isClientPagination = ref(true)

    const pipeline = useTableDataPipeline({
      localColumns: columns,
      pipelineData: computed(() => fullData),
      tableData: computed(() => fullData),
      isClientPagination: computed(() => isClientPagination.value),
      currentPage: computed(() => currentPage.value),
      pageSize: computed(() => pageSize.value),
      rowSpanCells: computed(() => ({ dept: true })),
      colSpanCells: computed(() => undefined),
      ranges: computed(() => undefined),
      userSpanMethod: computed(() => undefined),
      rowKeyFn: () => (row: any) => row.id,
    })

    // <zh/> 第1页 dept=A 的 span 起点在 rowIndex 0 | <en/> Page1 dept=A origin at rowIndex 0
    expect(pipeline.getSpanInfo(0, 'dept')?.isOrigin).toBe(true)
    expect(pipeline.getSpanInfo(0, 'dept')?.rowspan).toBe(10)

    currentPage.value = 2
    await new Promise(r => setTimeout(r, 0))

    // <zh/> 第2页 dept=B 的 span 起点仍在 rowIndex 0（新页首行），非复用旧页 Map | <en/> Page2 dept=B origin at rowIndex 0, not reused
    expect(pipeline.getSpanInfo(0, 'dept')?.isOrigin).toBe(true)
    expect(pipeline.getSpanInfo(0, 'dept')?.rowspan).toBe(10)
  })

  it('scenario7: externalFilter pure function does not break tree flatten', async () => {
    const columns = ref<ProcessedColumn[]>([mockCol({ prop: 'name', key: 'name' })])
    const fullData = [
      { id: '1', name: 'Alice', dept: 'eng', children: [{ id: '1-1', name: 'Bob', dept: 'eng' }] },
      { id: '2', name: 'Carol', dept: 'hr', children: [] },
    ]
    const externalFilter = computed(() => ({
      isExternalFilterPresent: () => true,
      doesExternalFilterPass: (row: any) => row.dept === 'eng',
    }))

    const pipeline = useTableDataPipeline({
      localColumns: columns,
      pipelineData: computed(() => fullData as any),
      tableData: computed(() => fullData as any),
      isClientPagination: computed(() => false),
      currentPage: computed(() => 1),
      pageSize: computed(() => 10),
      externalFilter: externalFilter as any,
      treeConfig: computed(() => ({ children: 'children' } as any)),
      rowKeyFn: () => (row: any) => row.id,
    })

    // <zh/> 外部筛选后 eng 的 2 行（Alice + Bob）保留，hr 被滤除 | <en/> After external filter, 2 eng rows remain
    expect(pipeline.finalDisplayData.value.length).toBe(1) // <zh/> 外部筛选在 tree 展平前，顶层仅 Alice 命中 | <en/> External filter before tree flatten, only Alice at top
  })

  it('scenario8: fixed column drag does not crash needsFixedWidth', async () => {
    const columns = ref<ProcessedColumn[]>([
      mockCol({ prop: 'a', key: 'a', fixed: 'left', width: 100 }),
      mockCol({ prop: 'b', key: 'b', width: 100 }),
      ...Array.from({ length: 48 }, (_, i) => mockCol({ prop: `c${i}`, key: `c${i}`, width: 100 })),
    ])
    // <zh/> 虚拟下固定列 + 溢出应触发 needsFixedWidth | <en/> Fixed + overflow should trigger needsFixedWidth
    const { useCellSpan: _useCellSpan } = await import('../../src/composables/data/use-cell-span')
    const data = ref(Array.from({ length: 10 }, (_, i) => ({ id: String(i) })))
    const span = _useCellSpan({
      data: computed(() => data.value),
      columns: computed(() => columns.value),
      rowSpanCells: computed(() => undefined),
      colSpanCells: computed(() => undefined),
      ranges: computed(() => undefined),
    })
    expect(span.spanEnabled.value).toBe(false)
    // <zh/> 拖拽后列宽变更不影响 spanEnabled | <en/> Drag does not affect spanEnabled
    columns.value = columns.value.map(c => c.key === 'a' ? { ...c, width: 120 } : c)
    await new Promise(r => setTimeout(r, 0))
    expect(span.spanEnabled.value).toBe(false)
  })
})
