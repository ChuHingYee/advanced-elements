import type { AdvTableStorageAdapter, ColumnState, ColumnStatePersistence } from '../../src/types/column-state'

import { describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import { useTableApi } from '../../src/composables/api/use-table-api'

/**
 * <zh/> 命名视图预设契约测试——saveView/applyView/getSavedViews/deleteView 基于
 * <zh/> 列状态快照与统一适配器（默认适配器后端 localStorage，由 happy-dom 提供）。
 * <zh/> 注入场景验证：自定义适配器读写通路、legacy 双读回退、errorStrategy 三分支。
 *
 * <en/> Named view-preset contract tests — saveView/applyView/getSavedViews/deleteView on top of
 * <en/> column-state snapshots and the unified adapter (default adapter backs localStorage via happy-dom).
 * <en/> Injection scenarios: custom adapter read/write path, legacy dual-read fallback, errorStrategy triple.
 */
function setup(overrides?: { persistence?: ColumnStatePersistence }) {
  const columns = ref<ProcessedColumnLike[]>([
    { prop: 'name', label: 'Name', hidden: false },
    { prop: 'age', label: 'Age', hidden: false },
  ] as any)
  const data = ref([{ name: 'a' }, { name: 'b' }])
  const tableId = shallowRef('views-test')

  const api = useTableApi({
    tableId,
    // <zh/> 透传持久化配置——默认 undefined（使用默认适配器）；测试用例可覆盖
    // <en/> Passthrough persistence config — undefined by default (uses default adapter); tests can override
    ...(overrides?.persistence
      ? { persistence: computed(() => overrides!.persistence) }
      : {}),
    dataColumns: {
      getColumnState: () => [
        { colId: 'name', hidden: false, width: 120 },
        { colId: 'age', hidden: true },
      ] as unknown as ColumnState[],
      applyColumnState: vi.fn(),
      resetColumnState: vi.fn(),
      treeApi: { toggleRowExpand: vi.fn(), expandRow: vi.fn(), collapseRow: vi.fn(), expandAll: vi.fn(), collapseAll: vi.fn(), getTreeMeta: vi.fn() },
      rowGroupApi: { toggleGroupExpand: vi.fn(), expandAllGroups: vi.fn(), collapseAllGroups: vi.fn() },
      rowExpandApi: { toggleRowExpand: vi.fn(), expandRow: vi.fn(), collapseRow: vi.fn(), expandAllRows: vi.fn(), collapseAllRows: vi.fn() },
      rowPinApi: { pinRow: vi.fn(), unpinRow: vi.fn(), isRowPinned: vi.fn(() => false), clearPinnedRows: vi.fn() },
      effectiveColumns: () => columns.value,
      visibleData: () => data.value,
    },
    selection: {
      selectionState: { toggleRowSelection: vi.fn() } as any,
      toggleAllSelection: vi.fn(),
      invertSelection: vi.fn(),
      selectAll: vi.fn(),
      selectAllFiltered: vi.fn(),
      deselectAllFiltered: vi.fn(),
      selectAllOnCurrentPage: vi.fn(),
      deselectAllOnCurrentPage: vi.fn(),
      getSelectedIndices: vi.fn(),
      refreshSelection: vi.fn(),
      setCurrentRow: vi.fn(),
      getCurrentRow: () => null,
      getCurrentPageData: () => [],
    },
    getRowKey: (row: any) => row.name,
    setQuickFilter: vi.fn(),
    getQuickFilter: () => '',
    features: {
      getQueryFormModel: vi.fn(),
      setQueryFormModel: vi.fn(),
      tableSearchRef: ref(null),
      exportExcel: vi.fn(),
      exportCsv: vi.fn(),
      print: vi.fn(),
      triggerImport: vi.fn(),
      importing: ref(false),
    },
    sharedEditing: {
      startEditing: vi.fn(),
      stopEditing: vi.fn(),
      commitBatchEdit: vi.fn().mockResolvedValue({ applied: [], rejected: [] }),
      cancelBatchEdit: vi.fn(),
      hasPendingChanges: ref(false),
      batchHasPending: ref(false),
      batchPendingChanges: ref(new Map()),
      submitEdit: vi.fn(),
      discardEdit: vi.fn(),
      validate: vi.fn().mockResolvedValue(true),
      validateRow: vi.fn().mockResolvedValue(true),
      clearValidate: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: ref(false),
      canRedo: ref(false),
      hasUnsavedChanges: () => false,
    },
    contextMenu: {
      showContextMenu: vi.fn().mockResolvedValue(undefined),
      hideContextMenu: vi.fn(),
    },
  } as any)

  return { api, columns, data, tableId }
}

interface ProcessedColumnLike {
  prop: string
  label: string
  hidden: boolean
}

describe('view presets (saveView/applyView)', () => {
  it('saves, lists, applies and deletes named views round-trip', () => {
    localStorage.clear()
    const { api } = setup()

    expect(api.getSavedViews()).toEqual([])

    api.saveView('compact')
    expect(api.getSavedViews()).toEqual(['compact'])

    // apply 命中已存视图 → 走 applyColumnState；未命中 → false
    expect(api.applyView('missing')).toBe(false)

    // delete 后列表为空且 apply 失败
    expect(api.deleteView('compact')).toBe(true)
    expect(api.deleteView('compact')).toBe(false)
    expect(api.getSavedViews()).toEqual([])
    expect(api.applyView('compact')).toBe(false)
    localStorage.clear()
  })

  it('isolates and prunes cached views when tableId changes synchronously', () => {
    localStorage.clear()
    const storage: AdvTableStorageAdapter = {
      get: () => null,
      set: vi.fn(),
      remove: vi.fn(),
    }
    const { api, tableId } = setup({ persistence: { enabled: true, storage } })

    api.saveView('old-view')
    expect(api.getSavedViews()).toEqual(['old-view'])
    tableId.value = 'other-table'
    expect(api.getSavedViews()).toEqual([])
    expect(api.applyView('old-view')).toBe(false)
    expect(api.deleteView('old-view')).toBe(false)
    tableId.value = 'views-test'
    expect(api.getSavedViews()).toEqual([])
  })

  it('does not leak an async save into a new table cache', async () => {
    localStorage.clear()
    let resolveSave!: () => void
    const pending = new Promise<void>((resolve) => {
      resolveSave = resolve
    })
    const storage: AdvTableStorageAdapter = {
      get: () => Promise.resolve(null),
      set: vi.fn(() => pending),
      remove: vi.fn(),
    }
    const { api, tableId } = setup({ persistence: { enabled: true, storage } })

    api.saveView('old-view')
    expect(api.getSavedViews()).toEqual(['old-view'])
    tableId.value = 'other-table'
    expect(api.getSavedViews()).toEqual([])
    resolveSave()
    await pending
    expect(api.getSavedViews()).toEqual([])
    expect(storage.set).toHaveBeenCalledWith('adv-table-views:views-test', expect.any(String))
  })

  it.each(['save', 'delete'] as const)('does not roll back the new table cache when an old %s rejects', async (operation) => {
    localStorage.clear()
    let rejectWrite!: (error: Error) => void
    const pending = new Promise<void>((_resolve, reject) => {
      rejectWrite = reject
    })
    const set = vi.fn<AdvTableStorageAdapter['set']>()
    const onStorageError = vi.fn()
    const storage: AdvTableStorageAdapter = {
      get: () => Promise.resolve(null),
      set,
      remove: vi.fn(),
    }
    const { api, tableId } = setup({ persistence: { enabled: true, storage, onStorageError } })

    api.saveView('old-view')
    set.mockReturnValueOnce(pending)
    if (operation === 'save')
      api.saveView('pending-view')
    else
      expect(api.deleteView('old-view')).toBe(true)
    tableId.value = 'other-table'
    api.saveView('new-view')
    rejectWrite(new Error('Write failed'))
    await pending.catch(() => {})

    expect(api.getSavedViews()).toEqual(['new-view'])
    expect(api.applyView('old-view')).toBe(false)
    expect(onStorageError).toHaveBeenCalledWith(expect.objectContaining({ phase: 'save', domain: 'namedView' }))
  })

  it.each(['save', 'delete'] as const)('still rolls back a failed %s within the same table', async (operation) => {
    localStorage.clear()
    let rejectWrite!: (error: Error) => void
    const pending = new Promise<void>((_resolve, reject) => {
      rejectWrite = reject
    })
    const set = vi.fn<AdvTableStorageAdapter['set']>()
    const storage: AdvTableStorageAdapter = {
      get: () => Promise.resolve(null),
      set,
      remove: vi.fn(),
    }
    const { api } = setup({ persistence: { enabled: true, storage } })

    api.saveView('old-view')
    set.mockReturnValueOnce(pending)
    if (operation === 'save')
      api.saveView('pending-view')
    else
      expect(api.deleteView('old-view')).toBe(true)
    rejectWrite(new Error('Write failed'))
    await pending.catch(() => {})

    expect(api.getSavedViews()).toEqual(['old-view'])
  })

  it('overwrites existing view with same name', () => {
    localStorage.clear()
    const { api } = setup()

    api.saveView('v1')
    api.saveView('v1') // 覆盖写入
    expect(api.getSavedViews()).toEqual(['v1'])

    localStorage.clear()
  })

  // ── R3：适配器注入测试 —— 自定义适配器读写通路 ──

  it('writes to injected adapter, not localStorage', () => {
    localStorage.clear()
    const adapterCalls: string[] = []
    const stubAdapter: AdvTableStorageAdapter = {
      get: vi.fn(() => null),
      set: vi.fn((_key: string, _value: string) => {
        adapterCalls.push('set')
      }),
      remove: vi.fn(),
    }

    const { api } = setup({
      persistence: {
        enabled: true,
        storage: stubAdapter,
        storageKey: 'custom-key',
      },
    })

    api.saveView('my-view')
    // 写入应走自定义适配器
    expect(adapterCalls).toEqual(['set'])
    localStorage.clear()
  })

  it('legacy dual-read: falls back to default localStorage on adapter miss', () => {
    localStorage.clear()

    // 先在默认 localStorage 预置数据（模拟既有的已存储数据）
    const legacyData = { legacy: [{ colId: 'x', hidden: false }] }
    localStorage.setItem('adv-table-views:views-test', JSON.stringify(legacyData))

    const stubAdapter: AdvTableStorageAdapter = {
      // 自定义适配器读取未命中（返回 null）
      get: vi.fn(() => null),
      set: vi.fn(),
      remove: vi.fn(),
    }

    const { api } = setup({
      persistence: {
        enabled: true,
        storage: stubAdapter,
        storageKey: 'adv-table-views:views-test',
      },
    })

    // 虽然自定义适配器未命中，但 legacy 双读回退到 localStorage → 应能读取到 legacy 视图
    expect(api.getSavedViews()).toEqual(['legacy'])
    localStorage.clear()
  })

  it('errorStrategy="warn" logs warning and does not interrupt flow', () => {
    localStorage.clear()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const stubAdapter: AdvTableStorageAdapter = {
      get: () => null,
      set: () => {
        throw new Error('Storage full')
      },
      remove: vi.fn(),
    }

    const { api } = setup({
      persistence: {
        enabled: true,
        storage: stubAdapter,
        errorStrategy: 'warn',
      },
    })

    // 写入失败应触发 warn 但不抛错
    expect(() => api.saveView('fail-view')).not.toThrow()
    expect(warnSpy).toHaveBeenCalled()
    localStorage.clear()
    warnSpy.mockRestore()
  })

  it('errorStrategy="throw" rethrows and invokes onStorageError', () => {
    localStorage.clear()
    const onError = vi.fn()

    const stubAdapter: AdvTableStorageAdapter = {
      get: () => null,
      set: () => {
        throw new Error('Storage full')
      },
      remove: vi.fn(),
    }

    const { api } = setup({
      persistence: {
        enabled: true,
        storage: stubAdapter,
        errorStrategy: 'throw',
        onStorageError: onError,
      },
    })

    expect(() => api.saveView('fail-view')).toThrow('Storage full')
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'save', domain: 'namedView' }),
    )
    localStorage.clear()
  })

  it('onStorageError receives domain "namedView" for read failures', () => {
    localStorage.clear()
    const onError = vi.fn()

    const stubAdapter: AdvTableStorageAdapter = {
      get: () => {
        throw new Error('Read error')
      },
      set: vi.fn(),
      remove: vi.fn(),
    }

    const { api } = setup({
      persistence: {
        enabled: true,
        storage: stubAdapter,
        errorStrategy: 'silent',
        onStorageError: onError,
      },
    })

    // getSavedViews 触发读取 → 异常应上报 domain: 'namedView'
    api.getSavedViews()
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'restore', domain: 'namedView' }),
    )
    localStorage.clear()
  })
})
