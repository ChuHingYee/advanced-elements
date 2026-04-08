/**
 * @file use-column-state phase2 — 补充分支覆盖
 * Covers: applyColumnState with options, resetColumnState, persistence with custom storage, error strategies, include filter
 */
import type { ProcessedColumn } from '../../src/types'
import type { ColumnStatePersistence } from '../../src/types/column-state'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useColumnState } from '../../src/composables/columns/use-column-state'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

function createColumnState(overrides?: {
  columns?: ProcessedColumn[]
  persistence?: ColumnStatePersistence | undefined
  sortState?: any[]
}) {
  const localColumns = ref<ProcessedColumn[]>(overrides?.columns ?? [
    makeCol('a', { width: 100 }),
    makeCol('b', { width: 200 }),
    makeCol('c', { width: 300 }),
  ])
  const sortState = ref<any[]>(overrides?.sortState ?? [])
  const persistence = computed(() => overrides?.persistence)
  const resetColumns = vi.fn()
  const setColumns = vi.fn((cols: ProcessedColumn[]) => {
    localColumns.value = cols
  })
  const setSorts = vi.fn()

  const result = useColumnState({
    localColumns,
    sortState,
    resetColumns,
    setColumns,
    setSorts,
    persistence,
    // <zh/> tableId 为 getter 约定（使 storageKey 跟随运行时变更），传字符串会在内部调用时抛
    // <en/> tableId follows the getter convention (so storageKey tracks runtime changes); a string throws internally
    tableId: () => 'test-table',
  })

  return { localColumns, sortState, resetColumns, setColumns, setSorts, persistence, ...result }
}

describe('useColumnState phase2 — getColumnState', () => {
  it('returns state for all columns', () => {
    const { getColumnState } = createColumnState()
    const state = getColumnState()
    expect(state).toHaveLength(3)
    expect(state[0].colId).toBe('a')
    expect(state[0].width).toBe(100)
    expect(state[0].schemaVersion).toBe(1)
  })

  it('includes sort state when available', () => {
    /**
     * <zh/> 排序词表以 `SortState.order` / `ColumnState.sort` 的声明为准：`'ascending' | 'descending' | null`。
     * <zh/> 序列化即 `sortEntry.order` 原样落库（见 use-column-state 的 getColumnState），不做 'asc'/'desc' 压缩；
     * <zh/> 此处此前用非规范的 'asc'，与 isValidColumnStateData 的取值集合不一致。
     * <en/> The sort vocabulary follows the declared `SortState.order` / `ColumnState.sort`:
     * <en/> `'ascending' | 'descending' | null`. Serialization writes `sortEntry.order` verbatim (see
     * <en/> getColumnState) with no 'asc'/'desc' compaction; this case used the non-canonical 'asc',
     * <en/> inconsistent with the value set accepted by isValidColumnStateData.
     */
    const { getColumnState } = createColumnState({
      sortState: [{ prop: 'a', order: 'ascending' }],
    })
    const state = getColumnState()
    expect(state[0].sort).toBe('ascending')
    expect(state[0].sortIndex).toBe(0)
  })

  it('respects include filter for width only', () => {
    const { getColumnState } = createColumnState({
      persistence: { enabled: true, include: ['width'] } as any,
    })
    const state = getColumnState()
    expect(state[0].width).toBe(100)
    expect(state[0].hidden).toBeUndefined()
    expect(state[0].fixed).toBeUndefined()
  })
})

describe('useColumnState phase2 — applyColumnState', () => {
  it('applies width from saved state', () => {
    const { localColumns, applyColumnState } = createColumnState()
    applyColumnState([
      { colId: 'a', width: 150, schemaVersion: 1 },
      { colId: 'b', width: 250, schemaVersion: 1 },
    ])
    expect(localColumns.value[0].width).toBe(150)
    expect(localColumns.value[1].width).toBe(250)
  })

  it('applies hidden from saved state', () => {
    const { localColumns, applyColumnState } = createColumnState()
    applyColumnState([
      { colId: 'a', hidden: true, schemaVersion: 1 },
    ])
    expect(localColumns.value[0].hidden).toBe(true)
  })

  it('applies fixed from saved state', () => {
    const { localColumns, applyColumnState } = createColumnState()
    applyColumnState([
      { colId: 'a', fixed: 'left', schemaVersion: 1 },
    ])
    expect(localColumns.value[0].fixed).toBe('left')
  })

  it('skips unknown colId', () => {
    const { localColumns, applyColumnState } = createColumnState()
    applyColumnState([
      { colId: 'unknown', width: 999, schemaVersion: 1 },
    ])
    // Should not throw, columns remain unchanged
    expect(localColumns.value[0].width).toBe(100)
  })

  it('handles null/undefined state gracefully', () => {
    const { applyColumnState } = createColumnState()
    expect(() => applyColumnState(null)).not.toThrow()
    expect(() => applyColumnState(undefined)).not.toThrow()
  })

  it('handles empty array', () => {
    const { applyColumnState } = createColumnState()
    expect(() => applyColumnState([])).not.toThrow()
  })

  it('applies sort state', () => {
    /**
     * <zh/> 入参必须是规范词表 `'ascending' | 'descending'`：`isValidColumnStateData` 对非规范值
     * <zh/> （如 'asc'）会**整体拒绝**该份状态（而非逐项丢弃），因此旧测试传 'asc' 时 setSorts 根本不会被调用。
     * <zh/> 出参同理透传 `SortState.order`，不做压缩。
     * <en/> Input must use the canonical `'ascending' | 'descending'`: `isValidColumnStateData` rejects the
     * <en/> WHOLE payload for a non-canonical value (such as 'asc') rather than dropping items, so the previous
     * <en/> 'asc' input meant setSorts was never called at all. Output passes `SortState.order` through verbatim.
     */
    const { setSorts, applyColumnState } = createColumnState()
    applyColumnState([
      { colId: 'a', sort: 'ascending', sortIndex: 0, schemaVersion: 1 },
      { colId: 'b', sort: 'descending', sortIndex: 1, schemaVersion: 1 },
    ])
    expect(setSorts).toHaveBeenCalledWith([
      { prop: 'a', order: 'ascending' },
      { prop: 'b', order: 'descending' },
    ])
  })

  it('skips sort when applySort is false', () => {
    const { setSorts, applyColumnState } = createColumnState()
    applyColumnState(
      [{ colId: 'a', sort: 'asc', sortIndex: 0, schemaVersion: 1 }],
      { applySort: false },
    )
    expect(setSorts).not.toHaveBeenCalled()
  })

  it('skips width when applyWidth is false', () => {
    const { localColumns, applyColumnState } = createColumnState()
    applyColumnState(
      [{ colId: 'a', width: 999, schemaVersion: 1 }],
      { applyWidth: false },
    )
    expect(localColumns.value[0].width).toBe(100)
  })

  it('reorders columns when applyOrder is true', () => {
    const { localColumns, applyColumnState } = createColumnState()
    applyColumnState([
      { colId: 'c', schemaVersion: 1 },
      { colId: 'a', schemaVersion: 1 },
      { colId: 'b', schemaVersion: 1 },
    ])
    expect(localColumns.value[0].key).toBe('c')
    expect(localColumns.value[1].key).toBe('a')
    expect(localColumns.value[2].key).toBe('b')
  })

  it('skips reorder when applyOrder is false', () => {
    const { localColumns, applyColumnState } = createColumnState()
    applyColumnState(
      [{ colId: 'c', schemaVersion: 1 }, { colId: 'a', schemaVersion: 1 }],
      { applyOrder: false },
    )
    expect(localColumns.value[0].key).toBe('a')
  })
})

describe('useColumnState phase2 — resetColumnState', () => {
  it('calls resetColumns', () => {
    const { resetColumnState, resetColumns } = createColumnState()
    resetColumnState()
    expect(resetColumns).toHaveBeenCalled()
  })

  it('removes storage when persistence is enabled', () => {
    const storage = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      remove: vi.fn(),
    }
    const { resetColumnState } = createColumnState({
      persistence: { enabled: true, storage } as any,
    })
    resetColumnState()
    expect(storage.remove).toHaveBeenCalledWith('adv-table-cols-test-table')
  })

  it('does not remove storage when persistence is disabled', () => {
    const storage = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      remove: vi.fn(),
    }
    const { resetColumnState } = createColumnState({
      persistence: { enabled: false, storage } as any,
    })
    resetColumnState()
    expect(storage.remove).not.toHaveBeenCalled()
  })
})

describe('useColumnState phase2 — custom storage adapter', () => {
  it('uses custom storage adapter for save', async () => {
    vi.useFakeTimers()
    const storage = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      remove: vi.fn(),
    }
    const { localColumns } = createColumnState({
      persistence: { enabled: true, autoSave: true, storage, debounce: 0 } as any,
    })

    // Modify a column property to trigger auto-save watch
    localColumns.value[0].width = 999
    localColumns.value = [...localColumns.value]
    // Wait for Vue watch to fire, then flush the debounce timer
    await nextTick()
    vi.advanceTimersByTime(0)
    expect(storage.set).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('handles storage errors with silent strategy', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const storage = {
      get: vi.fn().mockImplementation(() => { throw new Error('Storage error') }),
      set: vi.fn().mockImplementation(() => {
        throw new Error('Storage error')
      }),
      remove: vi.fn(),
    }

    const { resetColumnState } = createColumnState({
      persistence: { enabled: true, storage, errorStrategy: 'silent' } as any,
    })

    // Should not throw
    expect(() => resetColumnState()).not.toThrow()
    consoleWarn.mockRestore()
  })

  it('handles storage errors with warn strategy', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const storage = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      remove: vi.fn().mockImplementation(() => { throw new Error('Remove error') }),
    }

    const { resetColumnState } = createColumnState({
      persistence: { enabled: true, storage, errorStrategy: 'warn' } as any,
    })

    resetColumnState()
    expect(consoleWarn).toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('handles storage errors with throw strategy', () => {
    const storage = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      remove: vi.fn().mockImplementation(() => { throw new Error('Remove error') }),
    }

    const { resetColumnState } = createColumnState({
      persistence: { enabled: true, storage, errorStrategy: 'throw' } as any,
    })

    expect(() => resetColumnState()).toThrow('Remove error')
  })

  it('calls onStorageError callback', () => {
    const onStorageError = vi.fn()
    const storage = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      remove: vi.fn().mockImplementation(() => { throw new Error('Remove error') }),
    }

    const { resetColumnState } = createColumnState({
      persistence: { enabled: true, storage, onStorageError } as any,
    })

    resetColumnState()
    expect(onStorageError).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'remove',
        error: expect.any(Error),
      }),
    )
  })
})

describe('useColumnState phase2 — custom storageKey', () => {
  it('uses custom storageKey', () => {
    const storage = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      remove: vi.fn(),
    }
    const { resetColumnState } = createColumnState({
      persistence: { enabled: true, storage, storageKey: 'custom-key' } as any,
    })
    resetColumnState()
    expect(storage.remove).toHaveBeenCalledWith('custom-key')
  })
})
