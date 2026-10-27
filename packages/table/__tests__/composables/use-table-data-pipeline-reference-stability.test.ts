import type { SortState } from '../../src/composables/data/use-column-sort'
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import { useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'

/**
 * <zh/> 管线引用稳定性契约：筛选/排序阶段逐元素稳定（shallowArrayStable）——
 * <zh/> 列对象抖动（列宽提交原地改 width 后重赋列数组）不改行对象引用，命中集合/排序结果
 * <zh/> 内容不变时 `finalDisplayData` 必须复用 prev 引用。这是 `modelUpdated` 语义的直接前提：
 * <zh/> 该事件以引用变化为触发（use-adv-table-watchers），引用不变即不发射——
 * <zh/> 「无实际变化的重算」不再产生假事件（实测列宽提交在筛选态曾整 tbody 重渲染 ≈220ms/100 行）。
 * <en/> Pipeline reference-stability contract: filter/sort stages are element-wise stable
 * <en/> (shallowArrayStable) — column-object churn (a width commit mutating width in place and
 * <en/> reassigning the column array) keeps row-object references intact, so when the hit-set or
 * <en/> sorted result content is unchanged, `finalDisplayData` must reuse the prev reference. This is
 * <en/> the direct premise of the `modelUpdated` semantics: the event fires on reference change
 * <en/> (use-adv-table-watchers), so a stable reference cannot emit — no-op recomputes no longer
 * <en/> produce phantom events (a width commit under an active filter used to re-render the whole
 * <en/> tbody, ≈220ms at 100 rows).
 */

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

describe('pipeline reference stability (shallowArrayStable stages)', () => {
  it('keeps finalDisplayData identity when a filter hit-set is unchanged by column churn', async () => {
    const sortState = shallowRef<SortState[]>([])
    const filterState = shallowRef<Record<string, any>>({})
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name' }), createCol({ prop: 'age' })])
    const data = ref([{ name: 'ab' }, { name: 'ba' }, { name: 'c' }])
    const pipeline = createPipeline(columns, data, sortState, filterState)

    pipeline.setFilter('name', { type: 'text', operator: 'contains', value: 'a' })
    await nextTick()
    await nextTick()
    const before = pipeline.finalDisplayData.value
    expect(before.map(r => r.name)).toEqual(['ab', 'ba'])

    // <zh/> 列宽提交形状的列抖动：新列数组、行引用不变、命中集合内容不变
    // <en/> Column churn in the shape of a width commit: new column array, row references intact, hit-set unchanged
    columns.value = [createCol({ prop: 'name', width: 200 }), createCol({ prop: 'age', width: 100 })]
    await nextTick()
    await nextTick()
    expect(pipeline.finalDisplayData.value).toBe(before)
  })

  it('keeps finalDisplayData identity when the sorted result is unchanged by column churn', async () => {
    const sortState = shallowRef<SortState[]>([{ prop: 'name', order: 'ascending' }])
    const filterState = shallowRef<Record<string, any>>({})
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name', sortable: true })])
    const data = ref([{ name: 'b' }, { name: 'a' }, { name: 'c' }])
    const pipeline = createPipeline(columns, data, sortState, filterState)

    await nextTick()
    await nextTick()
    expect(pipeline.finalDisplayData.value.map(r => r.name)).toEqual(['a', 'b', 'c'])
    const before = pipeline.finalDisplayData.value

    columns.value = [createCol({ prop: 'name', sortable: true, width: 200 })]
    await nextTick()
    await nextTick()
    expect(pipeline.finalDisplayData.value).toBe(before)
  })

  it('still yields a new reference when the filter result actually changes', async () => {
    const sortState = shallowRef<SortState[]>([])
    const filterState = shallowRef<Record<string, any>>({})
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name' })])
    const data = ref([{ name: 'ab' }, { name: 'ba' }, { name: 'c' }])
    const pipeline = createPipeline(columns, data, sortState, filterState)

    pipeline.setFilter('name', { type: 'text', operator: 'contains', value: 'a' })
    await nextTick()
    await nextTick()
    const before = pipeline.finalDisplayData.value

    // <zh/> 真实筛选变化必须换引用——否则 modelUpdated 不发射，消费方拿不到刷新信号
    // <en/> A real filter change must swap the reference — otherwise modelUpdated never fires and consumers lose the refresh signal
    pipeline.setFilter('name', { type: 'text', operator: 'contains', value: 'c' })
    await nextTick()
    await nextTick()
    expect(pipeline.finalDisplayData.value).not.toBe(before)
    expect(pipeline.finalDisplayData.value.map(r => r.name)).toEqual(['c'])
  })
})
