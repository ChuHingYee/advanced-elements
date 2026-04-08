import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useSelectionState } from '../../src/composables/selection/use-selection-state'
import { useTableSelection } from '../../src/composables/selection/use-table-selection'
import { DEFAULT_RENDERER_CAPS, VIRTUAL_RENDERER_CAPS } from '../../src/types/renderer-caps'

vi.mock('../../src/composables/selection/use-selection-state', () => ({
  useSelectionState: vi.fn((_opts: any, _callbacks: any) => {
    const selectedKeys = ref(new Set<string>())
    return {
      selectedKeys,
      isSelected: vi.fn(() => false),
      toggleRowSelection: vi.fn(),
      toggleAllSelection: vi.fn(),
      selectAll: vi.fn(),
      clearSelection: vi.fn(),
      clearVisibleRows: vi.fn(),
      setSelection: vi.fn(),
      getSelectedRows: vi.fn(() => []),
      initSelectionByKeys: vi.fn(),
      getCheckStatus: vi.fn(() => ({ isAllSelected: false, isIndeterminate: false })),
      selectRowByKey: vi.fn(),
      isSelectedByKey: vi.fn(() => false),
      getSelectedKeys: vi.fn(() => []),
      getSelectedCount: vi.fn(() => 0),
      replaceSelection: vi.fn(),
      forEachSelected: vi.fn(),
      getSelectedIndices: vi.fn(() => []),
      lastClickedKey: ref(null),
      setLastClickedKey: vi.fn(),
    }
  }),
}))

describe('useTableSelection', () => {
  const data = ref([{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }])
  const rowKey = computed(() => (row: any) => row.id)
  const rowKeyMeta = ref({ keyToRow: new Map(), keyToIndex: new Map() })
  const selectableFn = computed(() => undefined)
  const selectionMode = computed(() => 'multiple' as 'single' | 'multiple')
  const rowMultiSelectWithClick = computed(() => true)

  function createSelection(opts: {
    selectedRowKeys?: string[]
    onSelectionChange?: any
  } = {}) {
    return useTableSelection({
      rowKey,
      allData: data,
      rowKeyMeta,
      selectableFn,
      selectionMode,
      rowMultiSelectWithClick,
      selectedRowKeys: () => opts.selectedRowKeys,
      visibleData: () => data.value,
      finalDisplayData: () => data.value,
      // <zh/> 能力表取代模式布尔量：非行虚拟化
      // <en/> Capability table replaces the mode boolean: rows not virtualized
      caps: DEFAULT_RENDERER_CAPS,
      onSelectionChange: opts.onSelectionChange ?? vi.fn(),
      onSelect: vi.fn(),
      onSelectAll: vi.fn(),
      onRowSelected: vi.fn(),
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns selectionState', () => {
    const sel = createSelection()
    expect(sel.selectionState).toBeDefined()
    expect(typeof sel.selectionState.toggleRowSelection).toBe('function')
  })

  it('checkStatus is computed for multiple mode', () => {
    const sel = createSelection()
    expect(sel.checkStatus.value).toEqual({ isAllSelected: false, isIndeterminate: false })
  })

  it('checkStatus returns empty for single mode', () => {
    const singleMode = computed(() => 'single' as 'single' | 'multiple')
    const sel = useTableSelection({
      rowKey,
      allData: data,
      rowKeyMeta,
      selectableFn,
      selectionMode: singleMode,
      rowMultiSelectWithClick,
      selectedRowKeys: () => [],
      visibleData: () => data.value,
      finalDisplayData: () => data.value,
      caps: DEFAULT_RENDERER_CAPS,
      onSelectionChange: vi.fn(),
      onSelect: vi.fn(),
      onSelectAll: vi.fn(),
      onRowSelected: vi.fn(),
    })
    expect(sel.checkStatus.value).toEqual({ isAllSelected: false, isIndeterminate: false })
  })

  it('refreshSelection with keys calls initSelectionByKeys', () => {
    const sel = createSelection({ selectedRowKeys: ['1', '2'] })
    sel.refreshSelection()
    expect(sel.selectionState.initSelectionByKeys).toHaveBeenCalledWith(['1', '2'])
  })

  it('refreshSelection with empty keys calls clearSelection', () => {
    const sel = createSelection({ selectedRowKeys: [] })
    sel.refreshSelection()
    expect(sel.selectionState.clearSelection).toHaveBeenCalled()
  })

  it('toggleAllSelection delegates to selectionState', () => {
    const sel = createSelection()
    sel.toggleAllSelection()
    expect(sel.selectionState.toggleAllSelection).toHaveBeenCalled()
  })

  it('selectAll delegates with allData by default', () => {
    const sel = createSelection()
    sel.selectAll()
    expect(sel.selectionState.selectAll).toHaveBeenCalledWith(data.value)
  })

  it('selectAllFiltered delegates to selectAll with finalDisplayData', () => {
    const sel = createSelection()
    sel.selectAllFiltered()
    expect(sel.selectionState.selectAll).toHaveBeenCalledWith(data.value)
  })

  it('deselectAllFiltered delegates to clearVisibleRows', () => {
    const sel = createSelection()
    sel.deselectAllFiltered()
    expect(sel.selectionState.clearVisibleRows).toHaveBeenCalledWith(data.value)
  })

  it('getSelectedIndices delegates', () => {
    const sel = createSelection()
    sel.getSelectedIndices()
    expect(sel.selectionState.getSelectedIndices).toHaveBeenCalledWith(data.value)
  })

  it('getCurrentPageData returns copy of visibleData', () => {
    const sel = createSelection()
    const pageData = sel.getCurrentPageData()
    expect(pageData).toEqual(data.value)
    expect(pageData).not.toBe(data.value)
  })

  it('selectAllOnCurrentPage delegates to selectAll with visibleData', () => {
    const sel = createSelection()
    sel.selectAllOnCurrentPage()
    expect(sel.selectionState.selectAll).toHaveBeenCalledWith(data.value)
  })

  it('deselectAllOnCurrentPage delegates to clearVisibleRows with visibleData', () => {
    const sel = createSelection()
    sel.deselectAllOnCurrentPage()
    expect(sel.selectionState.clearVisibleRows).toHaveBeenCalledWith(data.value)
  })

  describe('a2 select-all scope (locked: virtual=cross-page, default=current-page)', () => {
    const windowRows = [{ id: 'w1' }]
    const allFilteredRows = [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }]

    function createScoped(caps: typeof DEFAULT_RENDERER_CAPS) {
      return useTableSelection({
        rowKey,
        allData: data,
        rowKeyMeta,
        selectableFn,
        selectionMode,
        rowMultiSelectWithClick,
        selectedRowKeys: () => [],
        visibleData: () => windowRows as any,
        finalDisplayData: () => allFilteredRows as any,
        caps,
        onSelectionChange: vi.fn(),
        onSelect: vi.fn(),
        onSelectAll: vi.fn(),
        onRowSelected: vi.fn(),
      })
    }

    it('virtual: toggleAll uses finalDisplayData (all filtered, cross-page)', () => {
      const sel = createScoped(VIRTUAL_RENDERER_CAPS)
      sel.toggleAllSelection()
      expect(sel.selectionState.toggleAllSelection).toHaveBeenCalledWith(allFilteredRows)
    })

    it('default: toggleAll uses visibleData (current page)', () => {
      const sel = createScoped(DEFAULT_RENDERER_CAPS)
      sel.toggleAllSelection()
      expect(sel.selectionState.toggleAllSelection).toHaveBeenCalledWith(windowRows)
    })
  })

  it('forwards selectionChange meta from the state core to the consumer', () => {
    // <zh/> 回归：meta 曾在 useTableSelection 层被收窄丢弃，公开事件拿不到全量键
    // <en/> Regression: meta used to be narrowed away inside useTableSelection, starving the public event of full keys
    const onSelectionChange = vi.fn()
    createSelection({ onSelectionChange })
    const callbacks = vi.mocked(useSelectionState).mock.calls[0]![1]
    const rows = [{ id: '1' }]
    const meta = { keys: ['1'], count: 1 }
    callbacks.onSelectionChange(rows, meta)
    expect(onSelectionChange).toHaveBeenCalledWith(rows, meta)
  })
})
