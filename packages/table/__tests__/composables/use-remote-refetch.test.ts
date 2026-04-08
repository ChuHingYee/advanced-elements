import type { SortState } from '../../src/composables/data/use-column-sort'
import type { AdvTableEmitFn, ProcessedColumn } from '../../src/types'
import type { TableErrorHandler } from '../../src/utils/error-handler'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import {
  createRemoteRefetchTrigger,
  isSortStateEqual,
  REMOTE_REFETCH_DEBOUNCE_MS,
  shouldSkipLocalSortRefetch,
  watchFilterRefetch,
  watchSortChangeAndRefetch,
} from '../../src/composables/data/use-remote-refetch'

const handleError = () => vi.fn() as unknown as TableErrorHandler
const emit = () => vi.fn() as unknown as AdvTableEmitFn

describe('isSortStateEqual', () => {
  it('treats identical references as equal', () => {
    const sorts: SortState[] = [{ prop: 'a', order: 'ascending' }]
    expect(isSortStateEqual(sorts, sorts)).toBe(true)
  })

  it('compares by prop and order only', () => {
    expect(isSortStateEqual(
      [{ prop: 'a', order: 'ascending', columnKey: 'k1' }],
      [{ prop: 'a', order: 'ascending', columnKey: 'k2' }],
    )).toBe(true)
    expect(isSortStateEqual(
      [{ prop: 'a', order: 'ascending' }],
      [{ prop: 'a', order: 'descending' }],
    )).toBe(false)
    expect(isSortStateEqual([{ prop: 'a', order: 'ascending' }], [])).toBe(false)
  })
})

describe('createRemoteRefetchTrigger', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces rapid triggers into a single fetchData', async () => {
    const fetchData = vi.fn().mockResolvedValue([])
    const trigger = createRemoteRefetchTrigger({ hasSource: () => true, fetchData, handleError: handleError() }, 'sort')
    trigger.trigger()
    trigger.trigger()
    trigger.trigger()
    expect(fetchData).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(fetchData).toHaveBeenCalledTimes(1)
    expect(fetchData).toHaveBeenCalledWith({ reason: 'sort' })
  })

  it('skips fetch when no remote source exists', async () => {
    const fetchData = vi.fn().mockResolvedValue([])
    const trigger = createRemoteRefetchTrigger({ hasSource: () => false, fetchData, handleError: handleError() }, 'filter')
    trigger.trigger()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(fetchData).not.toHaveBeenCalled()
  })

  it('routes fetch failure to handleError', async () => {
    const onError = handleError()
    const fetchData = vi.fn().mockRejectedValue(new Error('boom'))
    const trigger = createRemoteRefetchTrigger({ hasSource: () => true, fetchData, handleError: onError }, 'sort')
    trigger.trigger()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    await nextTick()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBe('TABLE_REQUEST_FAILED')
  })

  it('dispose cancels a pending fetch', async () => {
    const fetchData = vi.fn().mockResolvedValue([])
    const trigger = createRemoteRefetchTrigger({ hasSource: () => true, fetchData, handleError: handleError() }, 'sort')
    trigger.trigger()
    trigger.dispose()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(fetchData).not.toHaveBeenCalled()
  })

  it('skips the debounced fetch when the source is removed before firing', async () => {
    // <zh/> 防抖窗口内 source 被移除（租户切换/卸载前），发射时复查不再打出后台请求
    // <en/> When the source is removed inside the debounce window, the fire-time re-check skips the background fetch
    let alive = true
    const fetchData = vi.fn().mockResolvedValue([])
    const trigger = createRemoteRefetchTrigger({ hasSource: () => alive, fetchData, handleError: handleError() }, 'sort')
    trigger.trigger()
    alive = false
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(fetchData).not.toHaveBeenCalled()
  })
})

describe('watchSortChangeAndRefetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setup(hasSource: boolean, initial: SortState[] = []) {
    const sortState = ref<SortState[]>(initial)
    const col = { key: 'a', prop: 'a' } as unknown as ProcessedColumn
    const columnByKeyMap = ref(new Map<string, ProcessedColumn>([['a', col]]))
    const fetchData = vi.fn().mockResolvedValue([])
    const onEmit = emit()
    watchSortChangeAndRefetch({
      sortState,
      columnByKeyMap,
      hasSource: () => hasSource,
      fetchData,
      handleError: handleError(),
      emit: onEmit,
      tableId: () => 't1',
    })
    return { sortState, fetchData, onEmit, col }
  }

  it('emits sortChange with mapped columns and refetches when remote', async () => {
    const { sortState, fetchData, onEmit, col } = setup(true)
    sortState.value = [{ prop: 'a', order: 'ascending' }]
    await nextTick()
    expect(onEmit).toHaveBeenCalledTimes(1)
    expect(onEmit).toHaveBeenCalledWith('sortChange', {
      sortState: [{ prop: 'a', order: 'ascending' }],
      prop: 'a',
      order: 'ascending',
      column: col,
      columns: [col],
    }, 't1')
    expect(fetchData).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(fetchData).toHaveBeenCalledTimes(1)
    expect(fetchData).toHaveBeenCalledWith({ reason: 'sort' })
  })

  it('skips equal-content updates entirely', async () => {
    const { sortState, fetchData, onEmit } = setup(true, [{ prop: 'a', order: 'ascending' }])
    sortState.value = [{ prop: 'a', order: 'ascending' }]
    await nextTick()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(onEmit).not.toHaveBeenCalled()
    expect(fetchData).not.toHaveBeenCalled()
  })

  it('emits locally without refetch when no remote source exists', async () => {
    const { sortState, fetchData, onEmit } = setup(false)
    sortState.value = [{ prop: 'a', order: 'ascending' }]
    await nextTick()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(onEmit).toHaveBeenCalledTimes(1)
    expect(fetchData).not.toHaveBeenCalled()
  })
})

describe('c05 local-sort refetch gate (shouldSkipLocalSortRefetch)', () => {
  const localCol = { key: 'a', prop: 'a', sortable: true } as unknown as ProcessedColumn
  const serverCol = { key: 's', prop: 's', sortable: { type: 'server' } } as unknown as ProcessedColumn
  const customCol = { key: 'c', prop: 'c', sortable: 'custom' } as unknown as ProcessedColumn
  const map = new Map<string, ProcessedColumn>([['a', localCol], ['s', serverCol], ['c', customCol]])
  const off = () => false
  const on = () => true

  it('skips only for known local columns with autoParams off outside manual mode', () => {
    expect(shouldSkipLocalSortRefetch(
      [{ prop: 'a', order: 'ascending' }],
      map,
      { autoParamsEnabled: off, isManual: off },
    )).toBe(true)
  })

  it('keeps legacy refetch for server/custom/unknown/unsortable sorts', () => {
    const opts = { autoParamsEnabled: off, isManual: off }
    expect(shouldSkipLocalSortRefetch([{ prop: 's', order: 'ascending' }], map, opts)).toBe(false)
    expect(shouldSkipLocalSortRefetch([{ prop: 'c', order: 'ascending' }], map, opts)).toBe(false)
    expect(shouldSkipLocalSortRefetch([{ prop: 'zzz', order: 'ascending' }], map, opts)).toBe(false)
    // <zh/> 混合：任一服务端列即整体走历史行为 | <en/> Mixed: any server-delegated sort keeps legacy behavior
    expect(shouldSkipLocalSortRefetch(
      [{ prop: 'a', order: 'ascending' }, { prop: 's', order: 'ascending' }],
      map,
      opts,
    )).toBe(false)
  })

  it('keeps legacy refetch when deps are absent, autoParams on, manual, or sorts cleared', () => {
    const local = [{ prop: 'a', order: 'ascending' }]
    expect(shouldSkipLocalSortRefetch(local, map)).toBe(false)
    expect(shouldSkipLocalSortRefetch(local, map, { autoParamsEnabled: on, isManual: off })).toBe(false)
    expect(shouldSkipLocalSortRefetch(local, map, { autoParamsEnabled: off, isManual: on })).toBe(false)
    expect(shouldSkipLocalSortRefetch([], map, { autoParamsEnabled: off, isManual: off })).toBe(false)
  })

  it('watcher emits sortChange but skips refetch + page reset for local sorts', async () => {
    vi.useFakeTimers()
    try {
      const sortState = ref<SortState[]>([])
      const columnByKeyMap = ref(new Map<string, ProcessedColumn>([['a', localCol]]))
      const fetchData = vi.fn().mockResolvedValue([])
      const resetPage = vi.fn()
      const onEmit = emit()
      watchSortChangeAndRefetch({
        sortState,
        columnByKeyMap,
        hasSource: () => true,
        fetchData,
        handleError: handleError(),
        emit: onEmit,
        tableId: () => 't1',
        autoParamsEnabled: off,
        isManual: off,
        resetPage,
      })
      sortState.value = [{ prop: 'a', order: 'ascending' }]
      await nextTick()
      expect(onEmit).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
      expect(fetchData).not.toHaveBeenCalled()
      expect(resetPage).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })
})

describe('watchFilterRefetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setup(hasSource: boolean) {
    const filterState = ref<Record<string, any>>({})
    const fetchData = vi.fn().mockResolvedValue([])
    watchFilterRefetch({
      filterState,
      hasSource: () => hasSource,
      fetchData,
      handleError: handleError(),
    })
    return { filterState, fetchData }
  }

  it('refetches on content change when remote', async () => {
    const { filterState, fetchData } = setup(true)
    filterState.value = { status: 'on' }
    await nextTick()
    expect(fetchData).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(fetchData).toHaveBeenCalledTimes(1)
    expect(fetchData).toHaveBeenCalledWith({ reason: 'filter' })
  })

  it('coalesces consecutive changes into a single request', async () => {
    const { filterState, fetchData } = setup(true)
    filterState.value = { a: 1 }
    await nextTick()
    filterState.value = { a: 1, b: 2 }
    await nextTick()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(fetchData).toHaveBeenCalledTimes(1)
  })

  it('skips content-equal replacement', async () => {
    const { filterState, fetchData } = setup(true)
    filterState.value = {}
    await nextTick()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(fetchData).not.toHaveBeenCalled()
  })

  it('skips refetch without a remote source', async () => {
    const { filterState, fetchData } = setup(false)
    filterState.value = { status: 'on' }
    await nextTick()
    await vi.advanceTimersByTimeAsync(REMOTE_REFETCH_DEBOUNCE_MS)
    expect(fetchData).not.toHaveBeenCalled()
  })
})
