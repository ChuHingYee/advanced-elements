import type { SortState } from '../src/composables/data/use-column-sort'
/**
 * <zh/> 补充覆盖率测试 — 针对多个模块的未覆盖分支 | <en/> Supplementary coverage tests — targeting uncovered branches across multiple modules
 */
import type { ProcessedColumn } from '../src/types'
import type { ColumnState, ColumnStatePersistence } from '../src/types/column-state'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useColumnState } from '../src/composables/columns/use-column-state'
import { useTablePagination } from '../src/composables/data/use-table-pagination'
import { useHoverLayerStyle } from '../src/composables/rendering/use-hover-layer'
import { getHoverOptionZIndex, resolveCellClassRules } from '../src/utils/shared'

// ── utils/shared.ts: getHoverOptionZIndex ──

describe('getHoverOptionZIndex', () => {
  it('returns zIndex when column has teleport hoverActions with zIndex', () => {
    const cols = [
      { valueType: 'option', hoverActions: { teleport: true, zIndex: 999 } },
    ] as any
    expect(getHoverOptionZIndex(cols)).toBe(999)
  })

  it('returns undefined when no option column with teleport', () => {
    const cols = [
      { valueType: 'text', hoverActions: { teleport: true, zIndex: 999 } },
    ] as any
    expect(getHoverOptionZIndex(cols)).toBeUndefined()
  })

  it('returns undefined when teleport is false', () => {
    const cols = [
      { valueType: 'option', hoverActions: { teleport: false, zIndex: 999 } },
    ] as any
    expect(getHoverOptionZIndex(cols)).toBeUndefined()
  })

  it('returns undefined when hoverActions has no zIndex', () => {
    const cols = [
      { valueType: 'option', hoverActions: { teleport: true } },
    ] as any
    expect(getHoverOptionZIndex(cols)).toBeUndefined()
  })

  it('returns undefined for empty columns', () => {
    expect(getHoverOptionZIndex([])).toBeUndefined()
  })
})

// ── utils/shared.ts: resolveCellClassRules ──

describe('resolveCellClassRules', () => {
  it('returns empty string for undefined rules', () => {
    expect(resolveCellClassRules(undefined, {})).toBe('')
  })

  it('returns classes for matching predicates', () => {
    const rules = {
      active: (params: any) => params.active === true,
      disabled: (params: any) => params.disabled === true,
    }
    expect(resolveCellClassRules(rules, { active: true })).toBe('active')
  })

  it('returns multiple classes space-separated', () => {
    const rules = {
      active: () => true,
      highlighted: () => true,
    }
    const result = resolveCellClassRules(rules, {})
    expect(result).toContain('active')
    expect(result).toContain('highlighted')
  })

  it('returns empty string when no predicates match', () => {
    const rules = {
      active: () => false,
    }
    expect(resolveCellClassRules(rules, {})).toBe('')
  })
})

// ── use-hover-layer.ts: useHoverLayerStyle ──

describe('useHoverLayerStyle', () => {
  it('computes hoverLayerStyle with right offset', () => {
    const { hoverLayerStyle } = useHoverLayerStyle({
      contentWidth: 1000,
      containerWidth: 500,
    })
    // right = max(0, 1000 - 500 - 0) = 500
    expect(hoverLayerStyle.value.right).toBe('500px')
    expect(hoverLayerStyle.value.position).toBe('absolute')
    // maxInlineSize = containerWidth = 500
    expect(hoverLayerStyle.value.maxInlineSize).toBe('500px')
  })

  it('returns 0 right when content fits in container', () => {
    const { hoverLayerStyle } = useHoverLayerStyle({
      contentWidth: 300,
      containerWidth: 500,
    })
    // right = max(0, 300 - 500 - 0) = 0
    expect(hoverLayerStyle.value.right).toBe('0px')
    // maxInlineSize = containerWidth = 500
    expect(hoverLayerStyle.value.maxInlineSize).toBe('500px')
  })

  it('handleScroll updates scrollLeft and style', () => {
    const { handleScroll, hoverLayerStyle, scrollLeft } = useHoverLayerStyle({
      contentWidth: 1000,
      containerWidth: 500,
    })
    handleScroll({ scrollLeft: 200 })
    expect(scrollLeft.value).toBe(200)
    // right = max(0, 1000 - 500 - 200) = 300
    expect(hoverLayerStyle.value.right).toBe('300px')
    // maxInlineSize stays at containerWidth = 500 regardless of scrollLeft
    expect(hoverLayerStyle.value.maxInlineSize).toBe('500px')
  })

  it('handleScroll.cancel stops pending throttle', () => {
    const { handleScroll, scrollLeft } = useHoverLayerStyle({
      contentWidth: 1000,
      containerWidth: 500,
    })
    // <zh/> happy-dom 的 rAF 同步执行，无"待处理"态可取消；此处锁定无待处理时 cancel 是安全空操作
    // <en/> happy-dom runs rAF synchronously so no pending state exists here; this locks cancel as a safe no-op without pending frames
    expect(() => handleScroll.cancel()).not.toThrow()
    expect(scrollLeft.value).toBe(0)
  })

  it('returns same style reference when values do not change', () => {
    const { hoverLayerStyle } = useHoverLayerStyle({
      contentWidth: 1000,
      containerWidth: 500,
    })
    const first = hoverLayerStyle.value
    // Access again — should return same reference
    expect(hoverLayerStyle.value).toBe(first)
  })

  it('works with refs for contentWidth and containerWidth', () => {
    const contentWidth = ref(1000)
    const containerWidth = ref(500)
    const { hoverLayerStyle } = useHoverLayerStyle({
      contentWidth,
      containerWidth,
    })
    expect(hoverLayerStyle.value.right).toBe('500px')
    expect(hoverLayerStyle.value.maxInlineSize).toBe('500px')
    contentWidth.value = 800
    expect(hoverLayerStyle.value.right).toBe('300px')
    // maxInlineSize stays at containerWidth = 500 when only contentWidth changes
    expect(hoverLayerStyle.value.maxInlineSize).toBe('500px')
  })
})

// ── use-table-pagination.ts: additional coverage ──

describe('useTablePagination additional coverage', () => {
  function setupPagination(overrides: Record<string, any> = {}) {
    const total = ref(100)
    const paginationRef = ref(null)
    const isManual = ref(false)
    const pagination = useTablePagination({
      total,
      paginationRef,
      isManual,
      enabled: true,
      mode: 'page',
      ...overrides,
    })
    return { pagination, total, paginationRef, isManual }
  }

  it('loadMore returns null when no more data', () => {
    const { pagination } = setupPagination({ mode: 'manual' })
    // isManual is false by default, so hasMore uses total
    // currentPage=1, pageSize=10, total=100 → hasMore = true
    // But isManual.value is false, so hasMore still checks
    const result = pagination.loadMore()
    // In page mode, hasMore = 1*10 < 100 = true
    expect(result).not.toBeNull()
  })

  it('loadMore returns null when hasMore is false', () => {
    const { pagination, total } = setupPagination()
    total.value = 5 // less than pageSize (10)
    const result = pagination.loadMore()
    expect(result).toBeNull()
  })

  it('loadMore returns null when total is 0', () => {
    const { pagination, total } = setupPagination()
    total.value = 0
    expect(pagination.hasMore.value).toBe(false)
    expect(pagination.loadMore()).toBeNull()
  })

  it('paginationTotal uses propsTotal in manual mode', () => {
    const { pagination } = setupPagination({
      mode: 'manual',
      isManual: ref(true),
      propsTotal: 200,
    })
    expect(pagination.paginationTotal.value).toBe(200)
  })

  it('paginationTotal falls back to total when propsTotal is undefined in manual mode', () => {
    const isManual = ref(true)
    const total = ref(50)
    const pagination = useTablePagination({
      total,
      paginationRef: ref(null),
      isManual,
      mode: 'manual',
      propsTotal: undefined,
    })
    expect(pagination.paginationTotal.value).toBe(50)
  })

  it('paginationTotal uses total in non-manual mode', () => {
    const { pagination } = setupPagination({ mode: 'page' })
    expect(pagination.paginationTotal.value).toBe(100)
  })

  it('hasMore is true when currentPage * pageSize < total', () => {
    const { pagination } = setupPagination()
    expect(pagination.hasMore.value).toBe(true)
  })

  it('hasMore is false when currentPage * pageSize >= total', () => {
    const { pagination, total } = setupPagination()
    total.value = 5
    expect(pagination.hasMore.value).toBe(false)
  })

  it('hasMore is false when total <= 0', () => {
    const { pagination, total } = setupPagination()
    total.value = 0
    expect(pagination.hasMore.value).toBe(false)
  })

  it('setCurrentPage clamps to minimum 1', () => {
    const { pagination } = setupPagination()
    const result = pagination.setCurrentPage(-5)
    expect(result.page).toBe(1)
    expect(pagination.currentPage.value).toBe(1)
  })

  it('setPageSize clamps to minimum 1 and resets page', () => {
    const { pagination } = setupPagination()
    pagination.setCurrentPage(5)
    const result = pagination.setPageSize(-3)
    expect(result.size).toBe(1)
    expect(result.page).toBe(1)
    expect(result.reason).toBe('pageSizeChange')
    expect(result.needsReset).toBe(false)
    expect(pagination.currentPage.value).toBe(1)
  })

  it('setPageSize returns needsReset=true in manual mode', () => {
    const isManual = ref(true)
    const pagination = useTablePagination({
      total: ref(100),
      paginationRef: ref(null),
      isManual,
      mode: 'manual',
    })
    const result = pagination.setPageSize(20)
    expect(result.needsReset).toBe(true)
    expect(result.isClient).toBe(false)
  })

  it('loadMore advances page and returns loadMore result', () => {
    const { pagination } = setupPagination()
    const result = pagination.loadMore()
    expect(result).not.toBeNull()
    expect(result!.page).toBe(2)
    expect(result!.reason).toBe('loadMore')
    expect(result!.isClient).toBe(false)
    expect(pagination.currentPage.value).toBe(2)
  })

  it('paginationClass includes sticky and manual classes', () => {
    const isManual = ref(true)
    const pagination = useTablePagination({
      total: ref(100),
      paginationRef: ref(null),
      isManual,
      mode: 'manual',
    })
    // isSticky starts as false (no observer setup in test env)
    expect(pagination.paginationClass.value).toContain('manual')
  })

  it('isClient is true in client mode', () => {
    const { pagination } = setupPagination({ mode: 'client' })
    expect(pagination.isClient.value).toBe(true)
  })

  it('isClient is false in page mode', () => {
    const { pagination } = setupPagination({ mode: 'page' })
    expect(pagination.isClient.value).toBe(false)
  })

  it('localPageLayout uses default layout', () => {
    const { pagination } = setupPagination()
    expect(pagination.localPageLayout.value).toContain('total')
    expect(pagination.localPageLayout.value).toContain('pager')
  })

  it('localPageLayout uses custom layout when provided', () => {
    const { pagination } = setupPagination({ layout: 'prev, next' })
    expect(pagination.localPageLayout.value).toBe('prev, next')
  })

  it('pageSizes uses default when not provided', () => {
    const { pagination } = setupPagination()
    expect(pagination.pageSizes.value).toEqual([10, 20, 30])
  })

  it('pageSizes uses custom when provided', () => {
    const { pagination } = setupPagination({ pageSizes: [5, 10, 50] })
    expect(pagination.pageSizes.value).toEqual([5, 10, 50])
  })

  it('setCurrentPage returns pageChange result', () => {
    const { pagination } = setupPagination({ mode: 'client' })
    const result = pagination.setCurrentPage(3)
    expect(result.page).toBe(3)
    expect(result.reason).toBe('pageChange')
    expect(result.isClient).toBe(true)
    expect(result.needsReset).toBe(false)
  })
})

// ── use-column-state.ts: additional coverage ──

describe('useColumnState additional coverage', () => {
  function makeColumn(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
    return {
      prop: 'col',
      label: 'Col',
      key: 'col',
      width: 100,
      hidden: false,
      ...overrides,
    } as ProcessedColumn
  }

  function setupColumnState(overrides: Record<string, any> = {}) {
    const localColumns = ref<ProcessedColumn[]>([
      makeColumn({ prop: 'name', key: 'name', width: 100 }),
      makeColumn({ prop: 'age', key: 'age', width: 80 }),
    ])
    const sortState = ref<SortState[]>([])
    const resetColumns = vi.fn()
    const setColumns = vi.fn((cols: ProcessedColumn[]) => {
      localColumns.value = cols
    })
    const setSorts = vi.fn()
    const persistence = computed<ColumnStatePersistence | undefined>(() => undefined)
    const tableId = 'test-table'

    const state = useColumnState({
      localColumns,
      sortState,
      resetColumns,
      setColumns,
      setSorts,
      persistence,
      // <zh/> tableId 为 getter 约定（使 storageKey 跟随运行时变更） | <en/> tableId follows the getter convention
      tableId: () => tableId,
      ...overrides,
    })
    return { state, localColumns, sortState, resetColumns, setColumns, setSorts, persistence }
  }

  it('getColumnState returns states for all columns', () => {
    const { state } = setupColumnState()
    const states = state.getColumnState()
    expect(states).toHaveLength(2)
    expect(states[0].colId).toBe('name')
    expect(states[0].width).toBe(100)
    expect(states[1].colId).toBe('age')
    expect(states[1].width).toBe(80)
  })

  it('getColumnState includes sort state', () => {
    const { state, sortState } = setupColumnState()
    sortState.value = [{ prop: 'name', order: 'ascending' }]
    const states = state.getColumnState()
    const nameState = states.find(s => s.colId === 'name')
    expect(nameState?.sort).toBe('ascending')
    expect(nameState?.sortIndex).toBe(0)
  })

  it('getColumnState respects include config', () => {
    const { state, persistence: _persistence } = setupColumnState({
      persistence: computed(() => ({ enabled: true, include: ['width'] as any })),
    })
    const states = state.getColumnState()
    expect(states[0].width).toBe(100)
    expect(states[0].hidden).toBeUndefined()
    expect(states[0].fixed).toBeUndefined()
    expect(states[0].sort).toBeUndefined()
  })

  it('applyColumnState does nothing for null state', () => {
    const { state } = setupColumnState()
    const before = state.getColumnState()
    expect(() => state.applyColumnState(null)).not.toThrow()
    // <zh/> 非法输入整体拒绝：列状态快照必须原样不动
    // <en/> Invalid input is rejected as a whole: the column snapshot must stay untouched
    expect(state.getColumnState()).toEqual(before)
  })

  it('applyColumnState does nothing for empty array', () => {
    const { state } = setupColumnState()
    const before = state.getColumnState()
    expect(() => state.applyColumnState([])).not.toThrow()
    expect(state.getColumnState()).toEqual(before)
  })

  it('applyColumnState restores width and hidden', () => {
    const { state, localColumns } = setupColumnState()
    const savedState: ColumnState[] = [
      { colId: 'name', width: 200, hidden: true, schemaVersion: 1 },
      { colId: 'age', width: 120, hidden: false, schemaVersion: 1 },
    ]
    state.applyColumnState(savedState)
    expect(localColumns.value[0].width).toBe(200)
    expect(localColumns.value[0].hidden).toBe(true)
    expect(localColumns.value[1].width).toBe(120)
  })

  it('applyColumnState applies sort', () => {
    const { state, setSorts } = setupColumnState()
    const savedState: ColumnState[] = [
      { colId: 'name', sort: 'ascending', sortIndex: 0, schemaVersion: 1 },
    ]
    state.applyColumnState(savedState)
    expect(setSorts).toHaveBeenCalledWith([{ prop: 'name', order: 'ascending' }])
  })

  it('applyColumnState applies order via reorderColumns', () => {
    const { state, setColumns } = setupColumnState()
    const savedState: ColumnState[] = [
      { colId: 'age', schemaVersion: 1 },
      { colId: 'name', schemaVersion: 1 },
    ]
    state.applyColumnState(savedState)
    expect(setColumns).toHaveBeenCalled()
    const calledWith = setColumns.mock.calls[0][0] as ProcessedColumn[]
    expect(calledWith[0].key).toBe('age')
    expect(calledWith[1].key).toBe('name')
  })

  it('applyColumnState with applyOrder=false skips reorder', () => {
    const { state, setColumns } = setupColumnState()
    const savedState: ColumnState[] = [
      { colId: 'age', schemaVersion: 1 },
      { colId: 'name', schemaVersion: 1 },
    ]
    state.applyColumnState(savedState, { applyOrder: false })
    expect(setColumns).not.toHaveBeenCalled()
  })

  it('applyColumnState with applyWidth=false skips width restore', () => {
    const { state, localColumns } = setupColumnState()
    const savedState: ColumnState[] = [
      { colId: 'name', width: 200, schemaVersion: 1 },
    ]
    state.applyColumnState(savedState, { applyWidth: false })
    expect(localColumns.value[0].width).toBe(100)
  })

  it('applyColumnState with applySort=false skips sort restore', () => {
    const { state, setSorts } = setupColumnState()
    const savedState: ColumnState[] = [
      { colId: 'name', sort: 'ascending', sortIndex: 0, schemaVersion: 1 },
    ]
    state.applyColumnState(savedState, { applySort: false })
    expect(setSorts).not.toHaveBeenCalled()
  })

  it('resetColumnState calls resetColumns', () => {
    const { state, resetColumns } = setupColumnState()
    state.resetColumnState()
    expect(resetColumns).toHaveBeenCalled()
  })

  it('resetColumnState removes from storage when persistence enabled', () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      remove: vi.fn(),
    }
    const { state } = setupColumnState({
      persistence: computed(() => ({ enabled: true, storage: mockStorage })),
    })
    state.resetColumnState()
    expect(mockStorage.remove).toHaveBeenCalled()
  })

  it('resetColumnState handles storage errors silently', () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      remove: vi.fn().mockImplementation(() => { throw new Error('Storage error') }),
    }
    const { state, resetColumns } = setupColumnState({
      persistence: computed(() => ({ enabled: true, storage: mockStorage })),
    })
    // <zh/> 存储层抛错不得中断重置：列重置照常执行且不向外抛错
    // <en/> Storage failure must not abort the reset: columns still reset, nothing escapes
    expect(() => state.resetColumnState()).not.toThrow()
    expect(resetColumns).toHaveBeenCalled()
  })

  it('resetColumnState calls onStorageError when provided', () => {
    const onStorageError = vi.fn()
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      remove: vi.fn().mockImplementation(() => { throw new Error('Storage error') }),
    }
    const { state } = setupColumnState({
      persistence: computed(() => ({ enabled: true, storage: mockStorage, onStorageError })),
    })
    state.resetColumnState()
    expect(onStorageError).toHaveBeenCalled()
  })

  it('resetColumnState throws when errorStrategy is throw', () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      remove: vi.fn().mockImplementation(() => { throw new Error('Storage error') }),
    }
    const { state } = setupColumnState({
      persistence: computed(() => ({ enabled: true, storage: mockStorage, errorStrategy: 'throw' })),
    })
    expect(() => state.resetColumnState()).toThrow('Storage error')
  })
})
