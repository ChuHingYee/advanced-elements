import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { useNamedViews } from '../../src/composables/api/use-named-views'

/**
 * <zh/> 命名视图单测——覆盖保存/应用/列举/删除、非法快照与存储回退。
 * <en/> Named-views tests — save/apply/list/delete, invalid snapshots and storage fallback.
 */
function memoryAdapter(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn((k: string) => store.get(k) ?? null),
    set: vi.fn((k: string, v: string) => {
      store.set(k, v)
    }),
    remove: vi.fn((k: string) => {
      store.delete(k)
    }),
  }
}

const state = [{ colId: 'a', width: 120 }]

function setupViews(opts: {
  adapter?: any
  tableId?: string
  applyColumnState?: any
} = {}) {
  const adapter = opts.adapter ?? memoryAdapter()
  const applyColumnState = opts.applyColumnState ?? vi.fn()
  const api = useNamedViews({
    tableId: opts.tableId ?? 't1',
    persistence: computed(() => ({ storage: adapter }) as any),
    getColumnState: () => state as any,
    applyColumnState,
  })
  return { api, adapter, applyColumnState }
}

describe('useNamedViews', () => {
  it('saves, lists, applies and deletes views', () => {
    const t = setupViews()
    t.api.saveView('v1')
    expect(t.api.getSavedViews()).toEqual(['v1'])
    expect(t.api.applyView('v1')).toBe(true)
    expect(t.applyColumnState).toHaveBeenCalled()
    expect(t.applyColumnState.mock.calls[0][0]).toEqual(state)
    expect(t.api.deleteView('v1')).toBe(true)
    expect(t.api.getSavedViews()).toEqual([])
    expect(t.api.deleteView('v1')).toBe(false)
  })

  it('returns false for missing views', () => {
    const t = setupViews()
    expect(t.api.applyView('nope')).toBe(false)
  })

  it('rejects invalid stored snapshots', () => {
    const t = setupViews({ adapter: memoryAdapter({ 'adv-table-views:t1': JSON.stringify([{ colId: '', width: -1 }]) }) })
    expect(t.api.applyView('bad' as any)).toBe(false)
  })

  it('falls back to localStorage on custom-adapter read miss', () => {
    localStorage.setItem('adv-table-views:t1', JSON.stringify({ v2: state }))
    const t = setupViews({ adapter: memoryAdapter() })
    expect(t.api.getSavedViews()).toEqual(['v2'])
    expect(t.api.applyView('v2')).toBe(true)
    localStorage.removeItem('adv-table-views:t1')
  })

  it('isolates storage keys by tableId', () => {
    const adapter = memoryAdapter()
    const a = setupViews({ adapter, tableId: 'ta' })
    const b = setupViews({ adapter, tableId: 'tb' })
    a.api.saveView('v')
    expect(a.api.getSavedViews()).toEqual(['v'])
    expect(b.api.getSavedViews()).toEqual([])
  })

  it('overwrites views with the same name', () => {
    const t = setupViews()
    t.api.saveView('v')
    t.api.saveView('v')
    expect(t.api.getSavedViews()).toEqual(['v'])
  })
})
