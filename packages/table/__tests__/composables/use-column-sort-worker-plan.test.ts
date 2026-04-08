/**
 * @file use-column-sort Phase 4 测试 — 覆盖 Worker 超时终止与 columnsSortKey computed 缓存
 *
 * 覆盖修改点：
 * - Worker 超时后调用 terminateWorker() 终止卡死的 Worker（避免 CPU 消耗）
 * - Worker 超时后不重置 workerAvailable，下次排序可恢复 Worker
 * - columnsSortKey computed 缓存：列 sortable 配置变化时重新触发排序
 * - 超时定时器在组件卸载时被清理
 */
import type { ProcessedColumn } from '../../src/types/column'
import { runInNewContext } from 'node:vm'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, KeepAlive, nextTick, ref, shallowRef } from 'vue'
import { useColumnSort } from '../../src/composables/data/use-column-sort'
import { useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'
import { SORT_WORKER_INLINE_SOURCE } from '../../src/utils/worker-blob'

// ── Mock Worker ──
class MockWorker {
  static instances: MockWorker[] = []
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()

  constructor() {
    MockWorker.instances.push(this)
  }

  emit(data: any) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }

  emitError() {
    this.onerror?.(new ErrorEvent('error'))
  }
}

beforeEach(() => {
  MockWorker.instances = []
  globalThis.Worker = MockWorker as any
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function completeWorker(worker = MockWorker.instances.at(-1)!) {
  const message = worker.postMessage.mock.calls.at(-1)![0]
  const context = { postMessage: (result: unknown) => worker.emit(result), message }
  runInNewContext(`${SORT_WORKER_INLINE_SOURCE}\nglobalThis.onmessage({ data: message })`, context)
}

const disposers: (() => void)[] = []

afterEach(() => {
  disposers.splice(0).forEach(dispose => dispose())
})

function createWorkerSort(column: Partial<ProcessedColumn> = {}) {
  const data = shallowRef([{ name: 1 }, { name: 3 }, { name: 2 }])
  const columns = ref<ProcessedColumn[]>([{ prop: 'name', label: 'Name', sortable: true, hidden: false, ...column }])
  const onSortWorkerError = vi.fn()
  const sort = useColumnSort({
    columns,
    data,
    sortWorkerThreshold: 0,
    sortWorkerMinEntries: 0,
    sortWorkerTimeout: 100,
    onSortWorkerError,
  })
  disposers.push(() => sort.dispose?.())
  return { sort, data, columns, onSortWorkerError }
}

function makeLargeData(count = 5001) {
  return Array.from({ length: count }, (_, i) => ({ name: `item${count - 1 - i}` }))
}

const sortableCol: ProcessedColumn = {
  prop: 'name',
  label: 'Name',
  sortable: true,
  hidden: false,
} as unknown as ProcessedColumn

describe('useColumnSort — compiled worker plan regressions', () => {
  it.each([
    { sortBy: 'rank' },
    { sortable: { type: 'client', sortBy: 'rank' } },
    { sortBy: ['missing', 'rank'] },
    { sortable: { type: 'client', sortBy: ['missing', 'rank'] } },
    { sortBy: 'nested.rank' },
    { sortable: { type: 'client', sortByFormat: true }, format: ({ cellData }: any) => -cellData },
    { valueGetter: ({ row }: any) => row.rank },
    { columnKey: 'alias' },
  ] as Partial<ProcessedColumn>[])('matches the full pipeline for %j', async (config) => {
    vi.useFakeTimers()
    const rows = Array.from({ length: 100_001 }, (_, i) => ({ name: 100_000 - i, rank: i, nested: { rank: i } }))
    const columns = [{ prop: 'name', label: 'Name', hidden: false, sortable: true, ...config }] as ProcessedColumn[]
    const scope = effectScope()
    const pipeline = scope.run(() => useTableDataPipeline({
      localColumns: columns,
      pipelineData: rows,
      tableData: rows,
      isClientPagination: false,
      currentPage: 1,
      pageSize: 10,
    }))!
    disposers.push(() => scope.stop())
    const main = useColumnSort({ columns, data: rows, sortWorkerThreshold: Infinity })
    disposers.push(() => main.dispose?.())
    pipeline.setSort('name', 'ascending')
    main.setSort('name', 'ascending')
    await nextTick()
    completeWorker()
    const expected = main.sortedData.value.data
    expect(pipeline.sortedData.value.data.every((row, index) => row === expected[index])).toBe(true)
    expect(pipeline.sortedData.value.data[0]).toBe(config.columnKey ? rows.at(-1) : rows[0])
  })

  it.each(['sortBy', 'format', 'valueGetter', 'sortMethod'] as const)('invalidates replaced %s functions', async (kind) => {
    vi.useFakeTimers()
    const config: Partial<ProcessedColumn> = kind === 'format'
      ? { sortable: { type: 'client', sortByFormat: true }, format: ({ cellData }: any) => cellData }
      : kind === 'sortMethod'
        ? { sortable: { type: 'client', sortMethod: (a: any, b: any) => a.name - b.name } }
        : kind === 'valueGetter'
          ? { valueGetter: ({ row }: any) => row.name }
          : { sortBy: (row: any) => row.name }
    const { sort, columns } = createWorkerSort(config)
    sort.setSort('name', 'ascending')
    await nextTick()
    if (kind !== 'sortMethod')
      completeWorker()
    expect(sort.sortedData.value.data.map(r => r.name)).toEqual([1, 2, 3])
    if (kind === 'sortMethod')
      columns.value[0].sortable = { type: 'client', sortMethod: (a: any, b: any) => b.name - a.name }
    else if (kind === 'format')
      columns.value[0].format = ({ cellData }: any) => -cellData
    else if (kind === 'valueGetter')
      columns.value[0].valueGetter = ({ row }: any) => -row.name
    else
      columns.value[0].sortBy = (row: any) => -row.name
    await nextTick()
    if (kind !== 'sortMethod') {
      expect(MockWorker.instances[0].postMessage).toHaveBeenCalledTimes(2)
      completeWorker()
    }
    expect(sort.sortedData.value.data.map(r => r.name)).toEqual([3, 2, 1])
  })

  it('invalidates client to server changes', async () => {
    const { sort, columns, data } = createWorkerSort({ sortable: { type: 'client' } })
    sort.setSort('name', 'ascending')
    await nextTick()
    completeWorker()
    expect(sort.sortedData.value.data).not.toBe(data.value)
    columns.value[0].sortable = { type: 'server' }
    await nextTick()
    expect(sort.sortedData.value.data).toBe(data.value)
  })

  it('reuses pending results only for the same source and rejects pre-flush stale replies', async () => {
    vi.useFakeTimers()
    const { sort, data } = createWorkerSort()
    sort.setSort('name', 'ascending')
    await nextTick()
    completeWorker()
    const previous = sort.sortedData.value
    sort.setSort('name', 'descending')
    await nextTick()
    expect(sort.sortedData.value).toBe(previous)
    data.value = [{ name: 8 }, { name: 9 }, { name: 7 }]
    expect(sort.sortedData.value.data).toBe(data.value)
    completeWorker()
    await nextTick()
    expect(sort.sortedData.value.data).toBe(data.value)
    completeWorker()
    expect(sort.sortedData.value.data.map(r => r.name)).toEqual([9, 8, 7])
  })

  it.each(['runtime', 'postMessage'] as const)('recovers from %s failure after success without old results or timers', async (failure) => {
    vi.useFakeTimers()
    const { sort, onSortWorkerError, data } = createWorkerSort()
    sort.setSort('name', 'ascending')
    await nextTick()
    completeWorker()
    expect(sort.sortedData.value.data.map(r => r.name)).toEqual([1, 2, 3])
    const worker = MockWorker.instances[0]
    if (failure === 'postMessage')
      worker.postMessage.mockImplementationOnce(() => { throw new Error('clone failed') })
    sort.setSort('name', 'descending')
    await nextTick()
    if (failure === 'runtime')
      worker.emitError()
    expect(sort.sortedData.value.data.map(r => r.name)).toEqual([3, 2, 1])
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(onSortWorkerError).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    data.value = [{ name: 6 }, { name: 4 }, { name: 5 }]
    await nextTick()
    expect(MockWorker.instances).toHaveLength(2)
    completeWorker()
    expect(sort.sortedData.value.data.map(r => r.name)).toEqual([6, 5, 4])
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['manual', 'scope'] as const)('stops future workers after %s disposal outside a component', async (mode) => {
    vi.useFakeTimers()
    const scope = effectScope()
    const { sort, data, columns } = scope.run(() => createWorkerSort())!
    sort.setSort('name', 'ascending')
    await nextTick()
    const worker = MockWorker.instances[0]
    if (mode === 'manual') {
      sort.dispose?.()
      sort.dispose?.()
    }
    else {
      scope.stop()
    }
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    data.value = [{ name: 8 }, { name: 9 }]
    columns.value = [{ ...columns.value[0], sortBy: (row: any) => -row.name }]
    sort.setSort('name', 'descending')
    await nextTick()
    expect(MockWorker.instances).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
    scope.stop()
  })
})

describe('useColumnSort — Worker timeout terminates stuck Worker', () => {
  it('terminates Worker on timeout to prevent CPU consumption', async () => {
    vi.useFakeTimers()

    const largeData = makeLargeData()
    const { setSort } = useColumnSort({
      columns: () => [sortableCol],
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
      sortWorkerTimeout: 100,
    })

    setSort('name', 'ascending')
    await nextTick()

    expect(MockWorker.instances.length).toBe(1)
    const worker = MockWorker.instances[0]
    expect(worker.postMessage).toHaveBeenCalled()
    expect(worker.terminate).not.toHaveBeenCalled()

    // Advance time past timeout — should terminate the stuck Worker
    vi.advanceTimersByTime(200)

    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('falls back to main thread sort after timeout termination', async () => {
    vi.useFakeTimers()

    const largeData = makeLargeData()
    const { setSort, sortedData } = useColumnSort({
      columns: () => [sortableCol],
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
      sortWorkerTimeout: 100,
    })

    setSort('name', 'ascending')
    await nextTick()

    // Before timeout: Worker in flight, not sorted yet
    expect(sortedData.value.isSorted).toBe(false)

    vi.advanceTimersByTime(200)

    // After timeout: main thread fallback completed
    expect(sortedData.value.isSorted).toBe(true)
    expect(sortedData.value.data[0].name).toBe('item0')
  })

  it('recovers Worker on next sort after timeout (workerAvailable not reset)', async () => {
    vi.useFakeTimers()

    const largeData = makeLargeData()
    const { setSort, sortedData } = useColumnSort({
      columns: () => [sortableCol],
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
      sortWorkerTimeout: 100,
    })

    // First sort: triggers Worker, times out
    setSort('name', 'ascending')
    await nextTick()
    expect(MockWorker.instances.length).toBe(1)
    const firstWorker = MockWorker.instances[0]

    vi.advanceTimersByTime(200)
    expect(firstWorker.terminate).toHaveBeenCalledTimes(1)
    expect(sortedData.value.isSorted).toBe(true)

    // Clear sort and re-sort: should create a NEW Worker
    setSort('name', null)
    await nextTick()
    setSort('name', 'descending')
    await nextTick()

    expect(MockWorker.instances.length).toBe(2)
    const secondWorker = MockWorker.instances[1]
    expect(secondWorker).not.toBe(firstWorker)
    expect(secondWorker.postMessage).toHaveBeenCalled()
  })

  it('clears pending timeout timer when new sort starts before timeout', async () => {
    vi.useFakeTimers()

    const largeData = makeLargeData()
    const { setSort } = useColumnSort({
      columns: () => [sortableCol],
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
      sortWorkerTimeout: 100,
    })

    setSort('name', 'ascending')
    await nextTick()

    const worker = MockWorker.instances[0]
    // First worker responds before timeout
    const call = worker.postMessage.mock.calls[0]
    const requestId = call[0].requestId
    worker.emit({ sortedIndices: Array.from({ length: 5001 }, (_, i) => i), requestId })
    await nextTick()

    // Now trigger a new sort — the old timeout should be cleared and a new one set
    setSort('name', 'descending')
    await nextTick()

    // Advance time past the FIRST timeout duration but NOT past the second
    // (first timeout was 100ms, second starts after the first elapsed ~0ms)
    // Since the old timeout was cleared, the worker should NOT be terminated
    vi.advanceTimersByTime(50)

    // Worker should NOT have been terminated — the stale first timer was cleared
    expect(worker.terminate).not.toHaveBeenCalled()

    // Advance past the second timeout — now it SHOULD terminate (second sort didn't get a response)
    vi.advanceTimersByTime(100)
    expect(worker.terminate).toHaveBeenCalled()
  })
})

describe('useColumnSort — columnsSortKey computed caching', () => {
  it('re-triggers Worker sort when column sortable config changes', async () => {
    vi.useFakeTimers()

    const largeData = makeLargeData()
    const columnsRef = ref<ProcessedColumn[]>([sortableCol])

    const { setSort, sortedData } = useColumnSort({
      columns: columnsRef,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
      sortWorkerTimeout: 5000,
    })

    setSort('name', 'ascending')
    await nextTick()

    expect(MockWorker.instances.length).toBe(1)
    const firstWorker = MockWorker.instances[0]
    const firstCall = firstWorker.postMessage.mock.calls[0]
    const firstRequestId = firstCall[0].requestId

    firstWorker.emit({ sortedIndices: Array.from({ length: 5001 }, (_, i) => i), requestId: firstRequestId })
    await nextTick()
    expect(sortedData.value.isSorted).toBe(true)

    // Change column sortable config — should trigger re-sort via columnsSortKey change
    columnsRef.value = [
      { ...sortableCol, sortable: { type: 'client', sortBy: 'name' } } as unknown as ProcessedColumn,
    ]
    await nextTick()

    // A new Worker sort should be triggered (columnsSortKey changed)
    expect(firstWorker.postMessage.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('does NOT re-trigger sort when columns reference changes but sortable config is identical', async () => {
    vi.useFakeTimers()

    const largeData = makeLargeData()
    const columnsRef = ref<ProcessedColumn[]>([sortableCol])

    const postMessageSpy = vi.fn()
    MockWorker.prototype.postMessage = postMessageSpy

    const { setSort } = useColumnSort({
      columns: columnsRef,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
      sortWorkerTimeout: 5000,
    })

    setSort('name', 'ascending')
    await nextTick()

    const initialCallCount = postMessageSpy.mock.calls.length

    // Replace columns with a new array but identical sortable config
    columnsRef.value = [{ ...sortableCol }]
    await nextTick()

    // No additional Worker postMessage — columnsSortKey is identical
    expect(postMessageSpy.mock.calls.length).toBe(initialCallCount)

    MockWorker.prototype.postMessage = vi.fn()
  })
})

describe('useColumnSort — timeout timer cleanup on unmount', () => {
  it('clears pending sort timeout on component unmount', async () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    const largeData = makeLargeData()

    const TestComp = defineComponent({
      setup() {
        const api = useColumnSort({
          columns: () => [sortableCol],
          data: () => largeData,
          sortWorkerThreshold: 100,
          sortWorkerMinEntries: 10,
          sortWorkerTimeout: 100,
        })
        return { ...api }
      },
      render() {
        return h('div')
      },
    })

    const wrapper = mount(TestComp)
    const vm = wrapper.vm as any
    vm.setSort('name', 'ascending')
    await nextTick()

    // Worker in flight, timeout pending
    expect(MockWorker.instances.length).toBe(1)

    wrapper.unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('cleans up Worker resources on KeepAlive deactivate', async () => {
    vi.useFakeTimers()
    const show = ref(true)

    const largeData = makeLargeData()

    const TestComp = defineComponent({
      setup() {
        const api = useColumnSort({
          columns: () => [sortableCol],
          data: () => largeData,
          sortWorkerThreshold: 100,
          sortWorkerMinEntries: 10,
          sortWorkerTimeout: 100,
        })
        return { ...api }
      },
      render() {
        return h('div')
      },
    })

    const Parent = defineComponent({
      setup() {
        return { show }
      },
      render() {
        return h(KeepAlive, null, {
          default: () => show.value ? h(TestComp) : null,
        })
      },
    })

    const wrapper = mount(Parent)
    await nextTick()

    const vm = wrapper.findComponent(TestComp).vm as any
    vm.setSort('name', 'ascending')
    await nextTick()

    expect(MockWorker.instances.length).toBe(1)
    const worker = MockWorker.instances[0]

    // Deactivate — suspends in-flight work but keeps the Worker instance for reuse
    show.value = false
    await nextTick()

    expect(worker.terminate).not.toHaveBeenCalled()

    // Reactivate with existing sort state — reuses the same Worker instance
    show.value = true
    await nextTick()
    expect(MockWorker.instances.length).toBe(1)
  })
})
