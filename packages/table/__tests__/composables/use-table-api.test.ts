import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTableApi } from '../../src/composables/api/use-table-api'

describe('useTableApi', () => {
  function createMockSelectionState(overrides: any = {}) {
    return {
      clearSelection: vi.fn(),
      toggleRowSelection: vi.fn(),
      setSelection: vi.fn(),
      getSelectedRows: vi.fn(() => []),
      initSelectionByKeys: vi.fn(),
      selectRowByKey: vi.fn(),
      selectRowsByKeys: vi.fn(),
      isSelectedByKey: vi.fn(() => false),
      getSelectedKeys: vi.fn(() => []),
      getSelectedCount: vi.fn(() => 0),
      replaceSelection: vi.fn(),
      forEachSelected: vi.fn(),
      ...overrides,
    }
  }

  function createApi(overrides: any = {}) {
    // <zh/> 按域编排器分组构造 options——与 use-adv-table.ts 中的分组方式一致
    // <en/> Build options grouped by domain orchestrator — mirrors the grouping in use-adv-table.ts
    const dataColumns: any = {
      refresh: vi.fn(() => Promise.resolve()),
      loading: ref(false),
      setLoading: vi.fn(),
      getPagination: vi.fn(() => ({ currentPage: 1, pageSize: 10, total: 0 })),
      setCurrentPageAndRefetch: vi.fn(),
      setPageSizeAndRefetch: vi.fn(),
      getFullData: vi.fn(() => []),
      effectiveColumns: vi.fn(() => []),
      visibleData: vi.fn(() => []),
      setFilter: vi.fn(),
      resetColumnFilter: vi.fn(),
      resetAllFilters: vi.fn(),
      getFilterValue: vi.fn(),
      isColumnFiltered: vi.fn(() => false),
      hasActiveFilter: ref(false),
      hasActiveQuickFilter: ref(false),
      toggleSort: vi.fn(),
      setSort: vi.fn(),
      setSorts: vi.fn(),
      clearSort: vi.fn(),
      getSortOrder: vi.fn(() => null),
      getSortIndex: vi.fn(() => -1),
      getColumnState: vi.fn(() => []),
      applyColumnState: vi.fn(),
      resetColumnState: vi.fn(),
      treeApi: {
        toggleTreeNodeExpand: vi.fn(),
        expandTreeNode: vi.fn(),
        collapseTreeNode: vi.fn(),
        expandAllTreeNodes: vi.fn(),
        collapseAllTreeNodes: vi.fn(),
        getTreeMeta: vi.fn(),
      },
      rowExpandApi: {
        toggleDetailRowExpand: vi.fn(),
        expandDetailRow: vi.fn(),
        collapseDetailRow: vi.fn(),
        expandAllDetailRows: vi.fn(),
        collapseAllDetailRows: vi.fn(),
      },
      rowGroupApi: {
        toggleGroupExpand: vi.fn(),
        expandAllGroups: vi.fn(),
        collapseAllGroups: vi.fn(),
      },
      rowPinApi: {
        pinRow: vi.fn(),
        unpinRow: vi.fn(),
        isRowPinned: vi.fn(() => false),
        clearPinnedRows: vi.fn(),
      },
      renderData: vi.fn(() => []),
    }
    const selection: any = {
      selectionState: createMockSelectionState(),
      toggleAllSelection: vi.fn(),
      selectAll: vi.fn(),
      selectAllFiltered: vi.fn(),
      deselectAllFiltered: vi.fn(),
      selectAllOnCurrentPage: vi.fn(),
      deselectAllOnCurrentPage: vi.fn(),
      getSelectedIndices: vi.fn(() => []),
      refreshSelection: vi.fn(),
      setCurrentRow: vi.fn(),
      getCurrentRow: vi.fn(() => null),
      getCurrentPageData: vi.fn(() => []),
    }
    const features: any = {
      getQueryFormModel: vi.fn(() => ({})),
      setQueryFormModel: vi.fn(),
      tableSearchRef: ref(null),
      exportExcel: vi.fn(),
      exportCsv: vi.fn(),
      print: vi.fn(),
      triggerImport: vi.fn(),
      importing: ref(false),
    }
    const sharedEditing: any = {
      startEditing: vi.fn(),
      stopEditing: vi.fn(),
      commitBatchEdit: vi.fn(),
      cancelBatchEdit: vi.fn(),
      hasPendingChanges: ref(false),
      batchHasPending: ref(false),
      batchPendingChanges: ref(new Map()),
      submitEdit: vi.fn(),
      discardEdit: vi.fn(),
      validate: vi.fn(() => Promise.resolve(true)),
      validateRow: vi.fn(() => Promise.resolve(true)),
      clearValidate: vi.fn(),
      undo: vi.fn(() => false),
      redo: vi.fn(() => false),
      canUndo: ref(false),
      canRedo: ref(false),
      hasUnsavedChanges: vi.fn(() => false),
    }
    const contextMenu: any = {
      showContextMenu: vi.fn(() => Promise.resolve()),
      hideContextMenu: vi.fn(),
    }
    const options: any = {
      dataColumns,
      selection,
      features,
      sharedEditing,
      contextMenu,
      getRowKey: vi.fn(),
      setQuickFilter: vi.fn(),
      getQuickFilter: vi.fn(() => ''),
    }
    // <zh/> 将旧扁平 overrides 分发到对应域对象，测试用例无需感知分组结构
    // <en/> Route flat overrides into their domain buckets so test cases stay agnostic of grouping
    for (const [key, value] of Object.entries(overrides)) {
      if (key in dataColumns) {
        dataColumns[key] = value
      }
      else if (key in selection) {
        selection[key] = value
      }
      else if (key in features) {
        features[key] = value
      }
      else if (key in sharedEditing) {
        sharedEditing[key] = value
      }
      else if (key in contextMenu) {
        contextMenu[key] = value
      }
      else {
        options[key] = value
      }
    }
    return useTableApi(options)
  }

  it('exposes refresh and loading', () => {
    const api = createApi()
    expect(api.refresh).toBeDefined()
    expect(api.loading).toBeDefined()
    expect(api.loading.value).toBe(false)
  })

  it('exposes selection methods', () => {
    const api = createApi()
    expect(api.clearSelection).toBeDefined()
    expect(api.toggleRowSelection).toBeDefined()
    expect(api.setSelection).toBeDefined()
    expect(api.getSelectedRows).toBeDefined()
    expect(api.initSelectionByKeys).toBeDefined()
    expect(api.selectRowByKey).toBeDefined()
    expect(api.selectRowsByKeys).toBeDefined()
    expect(api.isSelectedByKey).toBeDefined()
    expect(api.getSelectedKeys).toBeDefined()
    expect(api.getSelectedCount).toBeDefined()
    expect(api.replaceSelection).toBeDefined()
    expect(api.forEachSelected).toBeDefined()
  })

  it('exposes export methods', () => {
    const api = createApi()
    expect(api.exportExcel).toBeDefined()
    expect(api.exportCsv).toBeDefined()
  })

  it('exposes filter methods', () => {
    const api = createApi()
    expect(api.setFilter).toBeDefined()
    expect(api.resetColumnFilter).toBeDefined()
    expect(api.resetAllFilters).toBeDefined()
    expect(api.getFilterValue).toBeDefined()
    expect(api.isColumnFiltered).toBeDefined()
    expect(api.hasActiveFilter).toBeDefined()
  })

  it('exposes sort methods', () => {
    const api = createApi()
    expect(api.toggleSort).toBeDefined()
    expect(api.setSort).toBeDefined()
    expect(api.setSorts).toBeDefined()
    expect(api.clearSort).toBeDefined()
    expect(api.getSortOrder).toBeDefined()
    expect(api.getSortIndex).toBeDefined()
  })

  it('exposes pagination methods', () => {
    const api = createApi()
    expect(api.getPagination).toBeDefined()
    expect(api.setCurrentPage).toBeDefined()
    expect(api.setPageSize).toBeDefined()
  })

  it('exposes column state methods', () => {
    const api = createApi()
    expect(api.getColumnState).toBeDefined()
    expect(api.applyColumnState).toBeDefined()
    expect(api.resetColumnState).toBeDefined()
  })

  it('exposes batch edit methods', () => {
    const api = createApi()
    expect(api.commitBatchEdit).toBeDefined()
    expect(api.cancelBatchEdit).toBeDefined()
    expect(api.hasPendingChanges).toBeDefined()
  })

  it('calls startEditing with params object directly', () => {
    const startEditing = vi.fn()
    const api = createApi({ startEditing })
    const params = { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' }
    api.startEditing(params)
    expect(startEditing).toHaveBeenCalledWith(params)
  })

  it('uses selectionState methods when available', () => {
    const selState = createMockSelectionState()
    const api = createApi({ selectionState: selState })
    expect(api.isSelectedByKey('test')).toBe(false)
    expect(api.getSelectedKeys()).toEqual([])
    expect(api.getSelectedCount()).toBe(0)
  })
})
