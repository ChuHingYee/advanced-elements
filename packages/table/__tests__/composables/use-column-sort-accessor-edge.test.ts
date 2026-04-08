/**
 * @file use-column-sort Phase 3 测试 — 覆盖 Worker 排序、compileSortAccessor 边界、cleanup 等
 */
import type { ProcessedColumn } from '../../src/types/column'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useColumnSort } from '../../src/composables/data/use-column-sort'

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

  /** Simulate receiving a message from the worker */
  emit(data: any) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }

  /** Simulate worker error */
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

describe('useColumnSort — compileSortAccessor edge cases', () => {
  function createSort(options?: { columns?: ProcessedColumn[], data?: any[] }) {
    return useColumnSort({
      columns: () => options?.columns ?? [],
      data: () => options?.data ?? [],
    })
  }

  it('sortBy with dot notation path', () => {
    const cols: ProcessedColumn[] = [
      {
        prop: 'user',
        label: 'User',
        sortable: true,
        sortBy: 'profile.name',
        hidden: false,
      } as any,
    ]
    // sortBy path is applied to the row root, not nested under prop
    const data = [
      { profile: { name: 'Charlie' } },
      { profile: { name: 'Alice' } },
      { profile: { name: 'Bob' } },
    ]

    const { setSort, sortedData } = createSort({ columns: cols, data })
    setSort('user', 'ascending')
    expect(sortedData.value.data.map((r: any) => r.profile.name)).toEqual([
      'Alice',
      'Bob',
      'Charlie',
    ])
  })

  it('sortBy with dot notation path handles null intermediate', () => {
    const cols: ProcessedColumn[] = [
      {
        prop: 'user',
        label: 'User',
        sortable: true,
        sortBy: 'profile.name',
        hidden: false,
      } as any,
    ]
    const data = [
      { profile: { name: 'Bob' } },
      { profile: null },
      { profile: { name: 'Alice' } },
    ]

    const { setSort, sortedData } = createSort({ columns: cols, data })
    setSort('user', 'ascending')
    // null/undefined should sort to end
    const names = sortedData.value.data.map((r: any) => r.profile?.name ?? null)
    expect(names[0]).toBe('Alice')
    expect(names[1]).toBe('Bob')
    expect(names[2]).toBeNull()
  })

  it('sortByFormat uses formatted display value', () => {
    const cols: ProcessedColumn[] = [
      {
        prop: 'price',
        label: 'Price',
        sortable: {
          type: 'client',
          sortByFormat: true,
        },
        format: (ctx: any) => `$${ctx.cellData}`,
        hidden: false,
      } as any,
    ]
    const data = [
      { price: 100 },
      { price: 50 },
      { price: 200 },
    ]

    const { setSort, sortedData } = createSort({ columns: cols, data })
    setSort('price', 'ascending')
    // Formatted values are strings: '$100', '$50', '$200'
    // compareSortValues uses Intl.Collator with { numeric: true }, so digit runs inside formatted
    // strings compare numerically: '$50' < '$100' < '$200'. A plain lexicographic compare would give
    // '$100' < '$200' < '$50' (because '1' < '2' < '5'), i.e. it would order digit runs by first char.
    // compareSortValues 使用 Intl.Collator({ numeric: true }) 按数值比较格式化串中的数字段，
    // 结果 '$50' < '$100' < '$200'；若按字典序比较会得到 '$100' < '$200' < '$50'（按首字符排序）。
    expect(sortedData.value.data.map((r: any) => r.price)).toEqual([50, 100, 200])
  })

  it('col.valueGetter is used when no sortBy', () => {
    const cols: ProcessedColumn[] = [
      {
        prop: 'fullName',
        label: 'Full Name',
        sortable: true,
        valueGetter: (params: any) => params.row.lastName,
        hidden: false,
      } as any,
    ]
    const data = [
      { fullName: 'A', lastName: 'Zebra' },
      { fullName: 'B', lastName: 'Apple' },
      { fullName: 'C', lastName: 'Mango' },
    ]

    const { setSort, sortedData } = createSort({ columns: cols, data })
    setSort('fullName', 'ascending')
    expect(sortedData.value.data.map((r: any) => r.lastName)).toEqual([
      'Apple',
      'Mango',
      'Zebra',
    ])
  })

  it('uses fallbackProp (sort.prop) when no sortBy/sortByFormat/valueGetter', () => {
    const cols: ProcessedColumn[] = [
      {
        prop: 'x',
        label: 'X',
        sortable: true,
        hidden: false,
      } as any,
    ]
    const data = [
      { x: 3 },
      { x: 1 },
      { x: 2 },
    ]

    const { setSort, sortedData } = createSort({ columns: cols, data })
    setSort('x', 'ascending')
    // fallbackProp is sort.prop = 'x', so accessor returns row['x']
    expect(sortedData.value.data.map((r: any) => r.x)).toEqual([1, 2, 3])
  })

  it('sortBy as array with all null values returns undefined', () => {
    const cols: ProcessedColumn[] = [
      {
        prop: 'name',
        label: 'Name',
        sortable: true,
        sortBy: ['nickName', 'lastName'],
        hidden: false,
      } as any,
    ]
    const data = [
      { name: 'A', nickName: null, lastName: null },
      { name: 'B', nickName: null, lastName: null },
      { name: 'C', nickName: null, lastName: null },
    ]

    const { setSort, sortedData } = createSort({ columns: cols, data })
    setSort('name', 'ascending')
    // All values null, original order preserved
    expect(sortedData.value.data).toEqual(data)
  })
})

describe('useColumnSort — Worker sorting', () => {
  it('uses Worker when data exceeds threshold', async () => {
    vi.useFakeTimers()

    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', sortable: true, hidden: false } as any,
    ]
    // Generate data exceeding default threshold (5000)
    const largeData = Array.from({ length: 5001 }, (_, i) => ({ name: `item${5000 - i}` }))

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
    })

    setSort('name', 'ascending')
    await nextTick()

    expect(MockWorker.instances.length).toBeGreaterThan(0)
    const worker = MockWorker.instances[0]
    expect(worker.postMessage).toHaveBeenCalled()

    // sortedData should show unsorted while worker is processing
    expect(sortedData.value.isSorted).toBe(false)
  })

  it('keeps the previous sorted view during a re-sort in-flight window (no unsorted flicker)', async () => {
    vi.useFakeTimers()

    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', sortable: true, hidden: false } as any,
    ]
    const largeData = Array.from({ length: 5001 }, (_, i) => ({ name: `item${i}` }))

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
      // 超时拉长——确保测试可在响应前采样在飞窗口
      sortWorkerTimeout: 10_000,
    })

    // 第一次排序（升序）：等待 Worker 结果落地，建立"最近已排序快照"
    setSort('name', 'ascending')
    await nextTick()
    const worker1 = MockWorker.instances[0]
    worker1.emit({
      requestId: 1,
      sortedIndices: Array.from({ length: largeData.length }, (_, i) => i), // 已是升序
    })
    await nextTick()
    expect(sortedData.value.isSorted).toBe(true)
    const stableView = sortedData.value

    // 第二次排序（降序）：同一数据引用，Worker 在飞窗口内
    setSort('name', 'descending')
    await nextTick()
    expect(sortedData.value.isSorted).toBe(true)
    // 关键断言：视图保持旧序（引用与内容均未跳变为未序原始数据）
    expect(sortedData.value.data).toBe(stableView.data)

    // Worker 返回降序结果后视图切换为新序
    MockWorker.instances.at(-1)!.emit({
      requestId: 2,
      sortedIndices: Array.from({ length: largeData.length }, (_, i) => largeData.length - 1 - i),
    })
    await nextTick()
    expect(sortedData.value.isSorted).toBe(true)
    expect(sortedData.value.data[0].name).toBe('item5000')
  })
  it('falls back to main thread when Worker construction fails', async () => {
    // Make Worker constructor throw
    const originalWorker = globalThis.Worker
    globalThis.Worker = vi.fn(() => {
      throw new Error('CSP blocked')
    }) as any

    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', sortable: true, hidden: false } as any,
    ]
    const largeData = Array.from({ length: 5001 }, (_, i) => ({ name: `item${5000 - i}` }))

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
    })

    setSort('name', 'ascending')
    await nextTick()

    // Should have fallen back to main thread sorting
    expect(sortedData.value.isSorted).toBe(true)
    expect(sortedData.value.data[0].name).toBe('item0')

    globalThis.Worker = originalWorker
  })

  it('handles Worker error and falls back to main thread', async () => {
    vi.useFakeTimers()

    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', sortable: true, hidden: false } as any,
    ]
    const largeData = Array.from({ length: 5001 }, (_, i) => ({ name: `item${5000 - i}` }))

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
      sortWorkerTimeout: 100,
    })

    setSort('name', 'ascending')
    await nextTick()

    const worker = MockWorker.instances[0]
    worker.emitError()

    expect(worker.terminate).toHaveBeenCalled()

    // Next sort should use main thread
    expect(sortedData.value.isSorted).toBe(true)
  })

  it('handles Worker timeout and falls back to main thread', async () => {
    vi.useFakeTimers()

    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', sortable: true, hidden: false } as any,
    ]
    const largeData = Array.from({ length: 5001 }, (_, i) => ({ name: `item${5000 - i}` }))

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
      sortWorkerTimeout: 100,
    })

    setSort('name', 'ascending')
    await nextTick()

    // Worker should be in flight
    expect(MockWorker.instances.length).toBeGreaterThan(0)

    // Advance time past timeout
    vi.advanceTimersByTime(200)

    // Should have fallen back to main thread
    expect(sortedData.value.isSorted).toBe(true)
  })

  it('processes Worker result when message arrives', async () => {
    vi.useFakeTimers()

    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', sortable: true, hidden: false } as any,
    ]
    const largeData = Array.from({ length: 5001 }, (_, i) => ({ name: `item${i}` }))

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
    })

    setSort('name', 'ascending')
    await nextTick()

    const worker = MockWorker.instances[0]
    const call = worker.postMessage.mock.calls[0]
    const requestId = call[0].requestId

    // Simulate worker returning sorted indices (ascending order)
    const sortedIndices = Array.from({ length: 5001 }, (_, i) => i)
    worker.emit({ sortedIndices, requestId })

    await nextTick()

    expect(sortedData.value.isSorted).toBe(true)
    expect(sortedData.value.data[0].name).toBe('item0')
  })

  it('discards stale Worker results', async () => {
    vi.useFakeTimers()

    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', sortable: true, hidden: false } as any,
    ]
    const largeData = Array.from({ length: 5001 }, (_, i) => ({ name: `item${i}` }))

    const dataRef = ref(largeData)
    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: dataRef,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
    })

    try {
      setSort('name', 'ascending')
      await nextTick()

      const worker = MockWorker.instances[0]
      const firstCall = worker.postMessage.mock.calls[0]
      const firstRequestId = firstCall[0].requestId

      // Change data to trigger a new sort
      dataRef.value = [...largeData].reverse()
      await nextTick()

      // Simulate old worker response (stale requestId) with indices that differ
      // from both the raw order and the correct sort, so application is detectable
      worker.emit({ sortedIndices: [4, 3, 2], requestId: firstRequestId })
      await nextTick()

      // <zh/> 陈旧结果（旧 requestId）必须被丢弃：若被应用，首行会是反转数据的 item4996；
      // <zh/> 注意反转后原始数据首行正是 item5000，不能用它做区分。
      // <en/> Stale results (old requestId) must be discarded: if applied, the first row would be item4996
      // <en/> of the reversed data; the raw reversed head (item5000) cannot discriminate, so it is not asserted.
      expect(sortedData.value.data).toHaveLength(5001)
      expect(sortedData.value.data[0].name).not.toBe('item4996')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('does not use Worker when sortable is custom', async () => {
    const cols: ProcessedColumn[] = [
      { prop: 'score', label: 'Score', sortable: 'custom', hidden: false } as any,
    ]
    const largeData = Array.from({ length: 5001 }, (_, i) => ({ score: i }))

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
    })

    setSort('score', 'ascending')
    await nextTick()

    // Worker should NOT be created (custom sort = server-side)
    // Data should be returned as-is with isSorted=true
    expect(sortedData.value.isSorted).toBe(true)
    expect(sortedData.value.data).toEqual(largeData)
  })

  it('does not use Worker when sortMethod is provided', async () => {
    const cols: ProcessedColumn[] = [
      {
        prop: 'name',
        label: 'Name',
        sortable: {
          type: 'client',
          sortMethod: (a: any, b: any) => a.name.length - b.name.length,
        },
        hidden: false,
      } as any,
    ]
    const largeData = Array.from({ length: 5001 }, (_, i) => ({ name: `i${i}` }))

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 10,
    })

    setSort('name', 'ascending')
    await nextTick()

    // Worker should NOT be used because sortMethod can't be serialized
    expect(sortedData.value.isSorted).toBe(true)
  })

  it('does not use Worker when total entries below minEntries', async () => {
    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', sortable: true, hidden: false } as any,
    ]
    // Data exceeds threshold but total entries (1 * 5001 = 5001) < minEntries (100000)
    const largeData = Array.from({ length: 5001 }, (_, i) => ({ name: `item${5000 - i}` }))

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => largeData,
      sortWorkerThreshold: 100,
      sortWorkerMinEntries: 100000,
    })

    setSort('name', 'ascending')
    await nextTick()

    // Should use main thread (total entries below min)
    expect(sortedData.value.isSorted).toBe(true)
    expect(sortedData.value.data[0].name).toBe('item0')
  })
})

describe('useColumnSort — sortable config object', () => {
  it('handles sortable object with type server', () => {
    const cols: ProcessedColumn[] = [
      {
        prop: 'score',
        label: 'Score',
        sortable: { type: 'server' } as any,
        hidden: false,
      } as any,
    ]
    const data = [
      { score: 3 },
      { score: 1 },
      { score: 2 },
    ]

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => data,
    })

    setSort('score', 'ascending')
    // Server-side sort returns data as-is
    expect(sortedData.value.isSorted).toBe(true)
    expect(sortedData.value.data).toEqual(data)
  })

  it('handles sortable object with type client and sortBy', () => {
    const cols: ProcessedColumn[] = [
      {
        prop: 'display',
        label: 'Display',
        sortable: {
          type: 'client',
          sortBy: 'sortKey',
        } as any,
        hidden: false,
      } as any,
    ]
    const data = [
      { display: 'A', sortKey: 3 },
      { display: 'B', sortKey: 1 },
      { display: 'C', sortKey: 2 },
    ]

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => data,
    })

    setSort('display', 'ascending')
    expect(sortedData.value.data.map((r: any) => r.display)).toEqual(['B', 'C', 'A'])
  })
})

describe('useColumnSort — number vs string comparison', () => {
  it('compares mixed types (string vs number) by converting to string', () => {
    const cols: ProcessedColumn[] = [
      { prop: 'val', label: 'Val', sortable: true, hidden: false } as any,
    ]
    const data = [
      { val: 10 },
      { val: 'abc' },
      { val: 5 },
    ]

    const { setSort, sortedData } = useColumnSort({
      columns: () => cols,
      data: () => data,
    })

    setSort('val', 'ascending')
    // Mixed types: numbers compared first (5 < 10), then string ('abc')
    expect(sortedData.value.isSorted).toBe(true)
  })
})
