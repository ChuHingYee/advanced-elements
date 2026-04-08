import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useColumnFilter } from '../../src/composables/data/use-column-filter'
import { useColumnSort } from '../../src/composables/data/use-column-sort'
import { useQuickFilter } from '../../src/composables/data/use-quick-filter'
import { useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'

/**
 * <zh/> 动态升级资源处置契约测试。
 *
 * <zh/> 背景：管线在 watch 回调（flush:'post'，无实例/作用域上下文）中动态升级 noop → 真实
 * <zh/> composable 时，被升级方内部的生命周期注册（onBeforeUnmount 等）静默失效，
 * <zh/> 导致排序 Worker 与内部 watch 泄漏。修复后各 composable 暴露幂等 dispose()，
 * <zh/> 由管线 setup 阶段的唯一 onScopeDispose 统一回收。
 *
 * <en/> Dynamic-upgrade resource disposal contract tests.
 *
 * <en/> Background: when the pipeline dynamically upgrades noop → real composable inside a watch
 * <en/> callback (flush:'post', no instance/scope context), the upgraded composable's internal
 * <en/> lifecycle registrations silently no-op, leaking the sort Worker and internal watches.
 * <en/> After the fix, each composable exposes an idempotent dispose(), flushed by a single
 * <en/> setup-time onScopeDispose in the pipeline.
 */
function createCol(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return {
    prop: 'name',
    label: 'Name',
    hidden: false,
    ...overrides,
  } as unknown as ProcessedColumn
}

describe('useTableDataPipeline dynamic upgrade', () => {
  it('upgrades noop → real sort composable at runtime without lifecycle warnings', async () => {
    // <zh/> 探针在管线创建后启动——排除裸调用场景下无条件创建的 useTreeData 等
    // <zh/> 既有告警噪音，只监测"运行时动态升级"窗口内的实例级生命周期告警。
    // <en/> Start the probe AFTER pipeline creation — excludes pre-existing bare-invocation
    // <en/> noise from unconditionally-created composables (useTreeData etc.), monitoring only
    // <en/> the runtime dynamic-upgrade window for instance-level lifecycle warnings.
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name', label: 'Name', filter: false })])
    const data = ref([
      { name: 'charlie' },
      { name: 'alice' },
      { name: 'bob' },
    ])

    const pipeline = useTableDataPipeline({
      localColumns: columns,
      pipelineData: data,
      tableData: data,
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
    } as any)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // <zh/> 初始无可排序列——noop API 生效 | <en/> No sortable columns initially — noop API active
      expect(pipeline.getSortOrder('name')).toBeNull()

      // <zh/> 运行时注入可排序列 → post-flush 升级 | <en/> Runtime sortable column → post-flush upgrade
      columns.value = [createCol({ prop: 'name', label: 'Name', sortable: true })]
      await nextTick()
      await nextTick()

      pipeline.toggleSort('name')
      expect(pipeline.sortState.value).toHaveLength(1)
      expect(pipeline.finalDisplayData.value.map(r => r.name)).toEqual(['alice', 'bob', 'charlie'])

      // <zh/> 修复前：升级路径内 onBeforeUnmount 触发 "no active component instance" 告警
      // <en/> Before fix: the upgrade path triggered "no active component instance" warnings
      const lifecycleWarnings = warnSpy.mock.calls.filter(([msg]) =>
        typeof msg === 'string' && /onBeforeUnmount|onScopeDispose|no active component instance/i.test(msg),
      )
      expect(lifecycleNotes(lifecycleWarnings)).toEqual([])
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  it('flushes dynamically upgraded composables when the owning scope stops', async () => {
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name', label: 'Name', filter: false })])
    const data = ref([{ name: 'Alice' }, { name: 'Bob' }])

    const scope = effectScope()
    let pipeline: ReturnType<typeof useTableDataPipeline>
    scope.run(() => {
      pipeline = useTableDataPipeline({
        localColumns: columns,
        pipelineData: data,
        tableData: data,
        isClientPagination: ref(false),
        currentPage: ref(1),
        pageSize: ref(20),
      } as any)
    })

    // <zh/> 动态升级出真实筛选 composable | <en/> Dynamically upgrade to the real filter composable
    columns.value = [createCol({ prop: 'name', label: 'Name' })]
    await nextTick()
    await nextTick()

    pipeline!.setFilter('name', { type: 'text', operator: 'contains', value: 'Ali' })
    await nextTick()
    expect(pipeline!.hasActiveFilter.value).toBe(true)
    expect(pipeline!.filteredData.value.isFiltered).toBe(true)
    expect(pipeline!.filteredData.value.data).toEqual([{ name: 'Alice' }])

    // <zh/> 作用域销毁 → 注册表冲刷 → 升级产物 dispose | <en/> Scope stop → registry flush → upgraded instances disposed
    scope.stop()

    // <zh/> 销毁后再发生结构性列变化：升级产物的列 watch 已停止，不得重建 filterState。
    // <zh/> 泄漏未修复时该 watch 无归属仍存活，会为新增列补默认筛选键 'extra'。
    // <en/> Structural column change after teardown: the upgraded filter's column watch is stopped
    // <en/> and must NOT rebuild filterState. Pre-fix the unowned watch survived and would add
    // <en/> a default filter entry for the new column key 'extra'.
    columns.value = [
      createCol({ prop: 'name', label: 'Name' }),
      createCol({ prop: 'extra', label: 'Extra' }),
    ]
    await nextTick()
    await nextTick()

    expect(Object.keys(pipeline!.filterState.value)).not.toContain('extra')
  })
})

describe('useColumnFilter.dispose', () => {
  it('stops internal watches so later structural column changes no longer rebuild filterState', async () => {
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name', label: 'Name' })])
    const data = ref([{ name: 'A' }, { name: 'B' }])
    const api = useColumnFilter({ columns, data, allData: data })

    expect(api.filterState.value.name).toBeDefined()

    // <zh/> 结构性列变化 → 签名变化 → filterState 重建并补充新列默认值
    // <en/> Structural column change → new signature → filterState rebuilt with the new column default
    columns.value = [createCol({ prop: 'name', label: 'Name' }), createCol({ prop: 'score', label: 'Score', filter: 'number' })]
    await nextTick()
    expect(api.filterState.value.score).toBeDefined()

    api.dispose()

    columns.value = [
      createCol({ prop: 'name', label: 'Name' }),
      createCol({ prop: 'score', label: 'Score', filter: 'number' }),
      createCol({ prop: 'extra', label: 'Extra' }),
    ]
    await nextTick()
    expect(api.filterState.value.extra).toBeUndefined()
  })

  it('is idempotent', () => {
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name', label: 'Name' })])
    const data = ref([{ name: 'A' }])
    const api = useColumnFilter({ columns, data, allData: data })
    expect(() => {
      api.dispose()
      api.dispose()
    }).not.toThrow()
  })
})

describe('useColumnSort.dispose', () => {
  it('exposes an idempotent dispose that keeps state readable afterwards', () => {
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name', label: 'Name', sortable: true })])
    const data = ref([{ name: 'b' }, { name: 'a' }])
    const api = useColumnSort({ columns, data })

    expect(typeof api.dispose).toBe('function')
    api.dispose!()
    expect(() => api.dispose!()).not.toThrow()
    expect(api.sortedData.value.isSorted).toBe(false)

    // <zh/> dispose 后排序状态接口仍可安全读取（不复活资源） | <en/> State APIs remain safely readable after dispose (no resource resurrection)
    expect(api.getSortOrder('name')).toBeNull()
  })
})

describe('useQuickFilter.dispose', () => {
  it('exposes an idempotent dispose', () => {
    const columns = ref<ProcessedColumn[]>([createCol({ prop: 'name', label: 'Name' })])
    const data = ref([{ name: 'Alice' }])
    const api = useQuickFilter({
      quickFilterText: ref('ali'),
      data,
      columns,
      rowKey: (row: any) => row.name,
    })

    expect(typeof api.dispose).toBe('function')
    api.dispose!()
    expect(() => api.dispose!()).not.toThrow()
    expect(api.hasActiveQuickFilter.value).toBe(true)
  })
})

/** <zh/> 测试辅助：将捕获到的告警参数格式化为字符串数组 | <en/> Test helper: normalize captured warning args to strings */
function lifecycleNotes(calls: unknown[][]): unknown[] {
  return calls.map(args => args.join(' '))
}
