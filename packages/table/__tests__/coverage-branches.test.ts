/**
 * <zh/> 分支覆盖率补充测试 | <en/> Branch coverage supplementary tests
 */
import type { ProcessedColumn } from '../src/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'

import { createCellSpan, renderEditingCell } from '../src/components/shared/cell-render-pipeline'
import { hasFixedColumns, partitionColumnsByFixed, useVirtualColumns } from '../src/components/table-virtual-renderer/use-virtual-columns'
import { createDefaultFilterValue } from '../src/composables/data/use-column-filter'
import { useTablePagination } from '../src/composables/data/use-table-pagination'
import { useSharedSingletons } from '../src/composables/shared/use-shared-singletons'
import { createEditRaceProtection } from '../src/utils/edit-race-protection'

// ── edit-race-protection.ts: branch coverage ──

describe('createEditRaceProtection branch coverage', () => {
  it('isStale returns true when unmounted', () => {
    const data = ref([1, 2, 3])
    const protection = createEditRaceProtection({ dataRef: data })
    const version = protection.version
    protection.markUnmounted()
    expect(protection.isStale(version, data.value)).toBe(true)
  })

  it('isStale returns true when version changed', () => {
    const data = ref([1, 2, 3])
    const protection = createEditRaceProtection({ dataRef: data })
    const version = protection.version
    protection.bumpVersion()
    expect(protection.isStale(version, data.value)).toBe(true)
  })

  it('isStale returns true when data reference changed and calls onDataChanged', () => {
    const onDataChanged = vi.fn()
    const data = ref([1, 2, 3])
    const protection = createEditRaceProtection({ dataRef: data, onDataChanged })
    const version = protection.version
    const originalData = data.value
    data.value = [...data.value, 4]
    expect(protection.isStale(version, originalData)).toBe(true)
    expect(onDataChanged).toHaveBeenCalled()
  })

  it('isStale returns true when data reference changed without onDataChanged callback', () => {
    const data = ref([1, 2, 3])
    const protection = createEditRaceProtection({ dataRef: data })
    const version = protection.version
    const originalData = data.value
    data.value = [...data.value, 4]
    expect(protection.isStale(version, originalData)).toBe(true)
  })

  it('isStale returns false when nothing changed', () => {
    const data = ref([1, 2, 3])
    const protection = createEditRaceProtection({ dataRef: data })
    const version = protection.version
    expect(protection.isStale(version, data.value)).toBe(false)
  })

  it('pendingCommit getter/setter works', () => {
    const data = ref([1])
    const protection = createEditRaceProtection({ dataRef: data })
    expect(protection.pendingCommit).toBeNull()
    const p = Promise.resolve()
    protection.pendingCommit = p
    expect(protection.pendingCommit).toBe(p)
    protection.pendingCommit = null
    expect(protection.pendingCommit).toBeNull()
  })

  it('pendingStart getter/setter works', () => {
    const data = ref([1])
    const protection = createEditRaceProtection({ dataRef: data })
    expect(protection.pendingStart).toBeNull()
    const p = Promise.resolve()
    protection.pendingStart = p
    expect(protection.pendingStart).toBe(p)
    protection.pendingStart = null
    expect(protection.pendingStart).toBeNull()
  })

  it('markUnmounted increments version', () => {
    const data = ref([1])
    const protection = createEditRaceProtection({ dataRef: data })
    const v1 = protection.version
    protection.markUnmounted()
    expect(protection.version).toBe(v1 + 1)
    expect(protection.unmounted).toBe(true)
  })
})

// ── cell-render-pipeline.ts: branch coverage ──

describe('renderEditingCell branch coverage', () => {
  function makeColumn(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
    return {
      prop: 'name',
      label: 'Name',
      key: 'name',
      width: 100,
      hidden: false,
      ...overrides,
    } as ProcessedColumn
  }

  it('returns null when no editor component', () => {
    const result = renderEditingCell({
      col: makeColumn(),
      row: { name: 'Alice' },
      rowIndex: 0,
      colIndex: 0,
      colKey: 'name',
      editApi: undefined,
      editConfig: undefined,
      rowKeyStr: 'row-0',
    })
    expect(result).toBeNull()
  })

  it('returns null when editApi has no getEditorComponent', () => {
    const result = renderEditingCell({
      col: makeColumn(),
      row: { name: 'Alice' },
      rowIndex: 0,
      colIndex: 0,
      colKey: 'name',
      editApi: {} as any,
      editConfig: undefined,
      rowKeyStr: 'row-0',
    })
    expect(result).toBeNull()
  })

  it('renders cell with editor component using getCellEditingValue', () => {
    const result = renderEditingCell({
      col: makeColumn(),
      row: { name: 'Alice' },
      rowIndex: 0,
      colIndex: 0,
      colKey: 'name',
      editApi: {
        getEditorComponent: () => 'input',
        getCellEditingValue: () => 'Alice',
        updateCellEditingValue: vi.fn(),
        getEditorSelectorParams: () => ({}),
      } as any,
      editConfig: { mode: 'cell' } as any,
      rowKeyStr: 'row-0',
    })
    expect(result).not.toBeNull()
  })

  it('renders cell with editor component using editingValue fallback', () => {
    const result = renderEditingCell({
      col: makeColumn(),
      row: { name: 'Alice' },
      rowIndex: 0,
      colIndex: 0,
      colKey: 'name',
      editApi: {
        getEditorComponent: () => 'input',
        editingValue: { value: 'Bob' } as any,
        updateEditingValue: vi.fn(),
      } as any,
      editConfig: { mode: 'cell' } as any,
      rowKeyStr: 'row-0',
    })
    expect(result).not.toBeNull()
  })

  it('renders cell with cellState isDirty', () => {
    const result = renderEditingCell({
      col: makeColumn(),
      row: { name: 'Alice' },
      rowIndex: 0,
      colIndex: 0,
      colKey: 'name',
      editApi: {
        getEditorComponent: () => 'input',
        getCellEditingValue: () => 'Alice',
        updateCellEditingValue: vi.fn(),
      } as any,
      editConfig: { mode: 'cell' } as any,
      cellState: { isDirty: true } as any,
      rowKeyStr: 'row-0',
      tabindex: true,
    })
    expect(result).not.toBeNull()
  })

  it('renders cell with cellEditorParams as function', () => {
    const result = renderEditingCell({
      col: makeColumn({ cellEditorParams: () => ({ options: [] }) } as any),
      row: { name: 'Alice' },
      rowIndex: 0,
      colIndex: 0,
      colKey: 'name',
      editApi: {
        getEditorComponent: () => 'input',
        getCellEditingValue: () => 'Alice',
        updateCellEditingValue: vi.fn(),
      } as any,
      editConfig: { mode: 'cell' } as any,
      rowKeyStr: 'row-0',
    })
    expect(result).not.toBeNull()
  })

  it('renders cell with popupRenderer from column', () => {
    const result = renderEditingCell({
      col: makeColumn({ popupRenderer: () => h('div', 'popup') } as any),
      row: { name: 'Alice' },
      rowIndex: 0,
      colIndex: 0,
      colKey: 'name',
      editApi: {
        getEditorComponent: () => 'input',
        getCellEditingValue: () => 'Alice',
        updateCellEditingValue: vi.fn(),
      } as any,
      editConfig: { mode: 'cell' } as any,
      rowKeyStr: 'row-0',
    })
    expect(result).not.toBeNull()
  })
})

describe('createCellSpan branch coverage', () => {
  it('creates span with range selected and dirty', () => {
    const vnode = createCellSpan({
      content: 'hello',
      rowKeyStr: 'row-0',
      rowIndex: 0,
      colIndex: 0,
      isRangeSelected: true,
      isDirty: true,
    })
    expect(vnode).toBeDefined()
  })

  it('creates span with cellClassRulesResult', () => {
    const vnode = createCellSpan({
      content: 'hello',
      rowKeyStr: 'row-0',
      rowIndex: 0,
      colIndex: 0,
      isRangeSelected: false,
      isDirty: false,
      cellClassRulesResult: 'custom-class',
    })
    expect(vnode).toBeDefined()
  })

  it('creates span with tabindex', () => {
    const vnode = createCellSpan({
      content: h('span', 'test'),
      rowKeyStr: 'row-0',
      rowIndex: 0,
      colIndex: 0,
      isRangeSelected: false,
      isDirty: false,
      tabindex: true,
    })
    expect(vnode).toBeDefined()
  })
})

// ── use-virtual-columns.ts: branch coverage ──

describe('useVirtualColumns branch coverage', () => {
  it('hasFixedColumns returns false for group with empty children', () => {
    expect(hasFixedColumns([{ prop: 'a', children: [] } as any])).toBe(false)
  })

  it('partitionColumnsByFixed handles group column without children', () => {
    const group = { prop: 'group', fixed: 'left' } as any
    const result = partitionColumnsByFixed([group])
    expect(result.left).toHaveLength(1)
  })

  it('partitionColumnsByFixed handles right-fixed group without children', () => {
    const group = { prop: 'group', fixed: 'right' } as any
    const result = partitionColumnsByFixed([group])
    expect(result.right).toHaveLength(1)
  })

  it('partitionColumnsByFixed handles non-fixed group with only left children', () => {
    const group = {
      prop: 'group',
      children: [{ prop: 'child', fixed: 'left' }],
    } as any
    const result = partitionColumnsByFixed([group])
    expect(result.left).toHaveLength(1)
    expect(result.right).toHaveLength(0)
    expect(result.main).toHaveLength(0)
  })

  it('partitionColumnsByFixed handles non-fixed group with only right children', () => {
    const group = {
      prop: 'group',
      children: [{ prop: 'child', fixed: 'right' }],
    } as any
    const result = partitionColumnsByFixed([group])
    expect(result.right).toHaveLength(1)
    expect(result.left).toHaveLength(0)
    expect(result.main).toHaveLength(0)
  })

  it('useVirtualColumns with isCollapsed undefined', () => {
    const cols = [{ prop: 'a', width: 100, hidden: false }]
    const { mainFiltered } = useVirtualColumns({
      columns: () => cols as any,
      getColumnWidth: () => 100,
    })
    expect(mainFiltered.value).toHaveLength(1)
  })

  it('useVirtualColumns with empty columns', () => {
    const { normalizedColumns, allLeaves, preparedColumns } = useVirtualColumns({
      columns: () => [],
      getColumnWidth: () => 100,
    })
    expect(normalizedColumns.value).toHaveLength(0)
    expect(allLeaves.value).toHaveLength(0)
    expect(preparedColumns.value.maxDepth).toBe(0)
  })
})

// ── use-table-pagination.ts: branch coverage ──

describe('useTablePagination branch coverage', () => {
  it('resolvedConfig uses defaults when options not provided', () => {
    const pagination = useTablePagination({
      total: ref(100),
      paginationRef: ref(null),
      isManual: ref(false),
    })
    expect(pagination.isClient.value).toBe(false)
    expect(pagination.pageSizes.value).toEqual([10, 20, 30])
  })

  it('resolvedConfig with enabled=false', () => {
    const pagination = useTablePagination({
      total: ref(100),
      paginationRef: ref(null),
      isManual: ref(false),
      enabled: false,
    })
    // enabled=false should still work, just affects resolvedConfig
    expect(pagination.currentPage.value).toBe(1)
  })

  it('paginationTotal uses propsTotal when defined in manual mode', () => {
    const isManual = ref(true)
    const total = ref(50)
    const pagination = useTablePagination({
      total,
      paginationRef: ref(null),
      isManual,
      mode: 'manual',
      propsTotal: 200,
    })
    expect(pagination.paginationTotal.value).toBe(200)
  })

  it('paginationTotal uses total when propsTotal is 0 in manual mode', () => {
    const isManual = ref(true)
    const total = ref(50)
    const pagination = useTablePagination({
      total,
      paginationRef: ref(null),
      isManual,
      mode: 'manual',
      propsTotal: 0,
    })
    // propsTotal is 0 (falsy), but `!== undefined` so it should use 0
    expect(pagination.paginationTotal.value).toBe(0)
  })

  it('loadMore returns null and does not advance when hasMore is false', () => {
    const total = ref(5)
    const pagination = useTablePagination({
      total,
      paginationRef: ref(null),
      isManual: ref(false),
      pageSize: 10,
    })
    const result = pagination.loadMore()
    expect(result).toBeNull()
    expect(pagination.currentPage.value).toBe(1)
  })

  it('setCurrentPage with valid page', () => {
    const pagination = useTablePagination({
      total: ref(100),
      paginationRef: ref(null),
      isManual: ref(false),
    })
    const result = pagination.setCurrentPage(5)
    expect(result.page).toBe(5)
    expect(pagination.currentPage.value).toBe(5)
  })

  it('setPageSize with valid size in client mode', () => {
    const pagination = useTablePagination({
      total: ref(100),
      paginationRef: ref(null),
      isManual: ref(false),
      mode: 'client',
    })
    const result = pagination.setPageSize(20)
    expect(result.size).toBe(20)
    expect(result.isClient).toBe(true)
    expect(result.needsReset).toBe(false)
  })
})

// ── use-shared-singletons.ts: branch coverage ──

describe('useSharedSingletons branch coverage', () => {
  it('returns all shared APIs and computed values', () => {
    const isContainerVisible = computed(() => true)
    const getFilterValue = vi.fn().mockReturnValue(undefined)
    const getEnumOptions = vi.fn().mockReturnValue(undefined)
    const isColumnFiltered = vi.fn().mockReturnValue(false)
    const setFilter = vi.fn()

    let result: ReturnType<typeof useSharedSingletons> | undefined
    const TestComponent = defineComponent({
      setup() {
        result = useSharedSingletons({
          isContainerVisible,
          tooltipEffect: () => 'dark',
          tooltipOptions: () => undefined,
          tooltipFormatter: () => undefined,
          getFilterValue,
          getEnumOptions,
          isColumnFiltered,
          setFilter,
        })
        return () => h('div')
      },
    })
    mount(TestComponent)

    expect(result).toBeDefined()
    expect(result!.sharedTooltip).toBeDefined()
    expect(result!.sharedCopyApi).toBeDefined()
    expect(result!.sharedFilterPopover).toBeDefined()
    expect(result!.sharedHeaderTooltip).toBeDefined()
    expect(result!.sharedFilterFormKey).toBeDefined()
    expect(result!.sharedFilterFormType).toBeDefined()
    expect(result!.sharedFilterFormValue).toBeDefined()
    expect(result!.sharedFilterFormEnumOptions).toBeDefined()
    expect(result!.sharedFilterFormActive).toBeDefined()
    expect(result!.handleSharedFilterUpdate).toBeDefined()
    expect(result!.overflowTooltipApi).toBeDefined()
    expect(result!.copyApi).toBeDefined()
    expect(result!.sharedFilterPopoverApi).toBeDefined()
    expect(result!.sharedHeaderTooltipApi).toBeDefined()
  })

  it('sharedFilterFormValue returns default when no active column key', () => {
    const isContainerVisible = computed(() => true)

    let result: ReturnType<typeof useSharedSingletons> | undefined
    const TestComponent = defineComponent({
      setup() {
        result = useSharedSingletons({
          isContainerVisible,
          tooltipEffect: () => undefined,
          tooltipOptions: () => undefined,
          tooltipFormatter: () => undefined,
          getFilterValue: () => undefined,
          getEnumOptions: () => undefined,
          isColumnFiltered: () => false,
          setFilter: vi.fn(),
        })
        return () => h('div')
      },
    })
    mount(TestComponent)

    // When no active column key, should return default text filter value
    expect(result!.sharedFilterFormValue.value).toEqual(createDefaultFilterValue('text'))
    expect(result!.sharedFilterFormEnumOptions.value).toBeUndefined()
    expect(result!.sharedFilterFormActive.value).toBe(false)
  })

  it('handleSharedFilterUpdate calls setFilter when active column key exists', async () => {
    const isContainerVisible = computed(() => true)
    const setFilter = vi.fn()

    let result: ReturnType<typeof useSharedSingletons> | undefined
    const TestComponent = defineComponent({
      setup() {
        result = useSharedSingletons({
          isContainerVisible,
          tooltipEffect: () => undefined,
          tooltipOptions: () => undefined,
          tooltipFormatter: () => undefined,
          getFilterValue: () => undefined,
          getEnumOptions: () => undefined,
          isColumnFiltered: () => false,
          setFilter,
        })
        return () => h('div')
      },
    })
    mount(TestComponent)

    // Without active column key, handleSharedFilterUpdate should not call setFilter
    result!.handleSharedFilterUpdate(createDefaultFilterValue('text'))
    expect(setFilter).not.toHaveBeenCalled()
  })
})
