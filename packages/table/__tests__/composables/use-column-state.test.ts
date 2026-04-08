import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { isValidColumnStateData, useColumnState } from '../../src/composables/columns/use-column-state'

/**
 * <zh/> 列状态单测——覆盖 schema 校验、应用/重置、存取错误路径。
 * <en/> Column-state tests — schema validation, apply/reset, persistence error paths.
 */
function memoryAdapter(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
    }),
    remove: vi.fn(async (k: string) => {
      store.delete(k)
    }),
  }
}

function setupState(opts: {
  seed?: Record<string, string>
  persistence?: Record<string, any>
  failSet?: boolean
} = {}) {
  const adapter = memoryAdapter(opts.seed)
  if (opts.failSet)
    adapter.set.mockRejectedValueOnce(new Error('quota'))
  const onStorageError = vi.fn()
  const localColumns = ref<any[]>([
    { key: 'a', prop: 'a', label: 'A', width: 100 },
    { key: 'b', prop: 'b', label: 'B', hidden: true, fixed: 'left' },
  ])
  const setColumns = vi.fn((cols: any[]) => {
    localColumns.value = cols
  })
  const resetColumns = vi.fn()
  let api!: ReturnType<typeof useColumnState>
  const wrapper = mount(defineComponent({
    setup() {
      api = useColumnState({
        localColumns: localColumns as any,
        sortState: ref([]) as any,
        resetColumns,
        setColumns,
        setSorts: vi.fn(),
        persistence: computed(() => ({
          enabled: true,
          storage: adapter,
          debounce: 5,
          errorStrategy: 'warn',
          onStorageError,
          ...opts.persistence,
        }) as any),
        tableId: () => 't-cols',
      })
      return () => h('div')
    },
  }))
  return { api, wrapper, adapter, onStorageError, localColumns, setColumns, resetColumns }
}

describe('isValidColumnStateData', () => {
  it('accepts well-formed states', () => {
    expect(isValidColumnStateData([{ colId: 'a', width: 120, hidden: false, fixed: 'left', sort: 'ascending', sortIndex: 0, schemaVersion: 1, mode: 'default' }])).toBe(true)
    expect(isValidColumnStateData([])).toBe(true)
  })

  it('rejects malformed states', () => {
    expect(isValidColumnStateData(null)).toBe(false)
    expect(isValidColumnStateData([{}])).toBe(false)
    expect(isValidColumnStateData([{ colId: '' }])).toBe(false)
    expect(isValidColumnStateData([{ colId: 'a', width: -1 }])).toBe(false)
    expect(isValidColumnStateData([{ colId: 'a', width: 'x' }])).toBe(false)
    expect(isValidColumnStateData([{ colId: 'a', hidden: 1 }])).toBe(false)
    expect(isValidColumnStateData([{ colId: 'a', fixed: 'middle' }])).toBe(false)
    expect(isValidColumnStateData([{ colId: 'a', sort: 'weird' }])).toBe(false)
    expect(isValidColumnStateData([{ colId: 'a', sortIndex: 1.5 }])).toBe(false)
    expect(isValidColumnStateData([{ colId: 'a', schemaVersion: 1.5 }])).toBe(false)
    expect(isValidColumnStateData([{ colId: 'a', mode: '3d' }])).toBe(false)
    expect(isValidColumnStateData([{ colId: 'a', width: Number.NaN }])).toBe(false)
  })
})

describe('useColumnState apply/reset', () => {
  it('reads current column state', () => {
    const t = setupState()
    const state = t.api.getColumnState()
    expect(state.find(s => s.colId === 'a')?.width).toBe(100)
    expect(state.find(s => s.colId === 'b')?.hidden).toBe(true)
    t.wrapper.unmount()
  })

  it('applies valid width updates', () => {
    const t = setupState()
    t.api.applyColumnState([{ colId: 'a', width: 200 }])
    expect(t.localColumns.value.find((c: any) => c.key === 'a').width).toBe(200)
    t.wrapper.unmount()
  })

  it('ignores non-array and schema-invalid states', () => {
    const t = setupState()
    const before = JSON.stringify(t.localColumns.value)
    t.api.applyColumnState('nope' as any)
    t.api.applyColumnState([{ colId: 'a', width: -5 }])
    expect(JSON.stringify(t.localColumns.value)).toBe(before)
    t.wrapper.unmount()
  })

  it('resets columns and clears storage', async () => {
    const t = setupState({ seed: { 'adv-table-cols-t-cols': '[]' } })
    t.api.resetColumnState()
    expect(t.resetColumns).toHaveBeenCalled()
    await new Promise(r => setTimeout(r, 20))
    expect(t.adapter.remove).toHaveBeenCalled()
    t.wrapper.unmount()
  })

  it('reports save failures to onStorageError', async () => {
    const t = setupState({ failSet: true })
    t.api.applyColumnState([{ colId: 'a', width: 150 }])
    await new Promise(r => setTimeout(r, 50))
    expect(t.onStorageError).toHaveBeenCalled()
    t.wrapper.unmount()
  })

  it('discards corrupted stored JSON on restore', async () => {
    const t = setupState({ seed: { 'adv-table-cols-t-cols': '{broken' } })
    await new Promise(r => setTimeout(r, 50))
    expect(t.adapter.remove).toHaveBeenCalled()
    t.wrapper.unmount()
  })
})
