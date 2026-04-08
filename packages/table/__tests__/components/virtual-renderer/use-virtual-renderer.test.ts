import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import { useVirtualRenderer } from '../../../src/components/table-virtual-renderer/use-virtual-renderer'

vi.mock('@vueuse/core', () => ({
  useMouseInElement: vi.fn(() => ({
    isOutside: ref(true),
  })),
}))

vi.mock('../../../src/composables/use-column-resize', () => ({
  useColumnResize: vi.fn(() => ({
    getColumnWidth: vi.fn((col: any) => col?.width),
    handleHeaderMouseMove: vi.fn(),
    handleHeaderMouseOut: vi.fn(),
    handleResizeStart: vi.fn(),
    resizeProxyVisible: ref(false),
  })),
}))

vi.mock('../../../src/utils/table-drag', () => ({
  ADV_TABLE_COLUMN_KEY_ATTR: 'data-adv-table-column-key',
  ADV_TABLE_ROW_KEY_ATTR: 'data-adv-table-row-key',
  ADV_TABLE_INTERNAL_COLUMN_ID: '__advTableColumnId',
  getMarkedChildKeys: vi.fn(() => []),
}))

describe('use-virtual-renderer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic initialization', () => {
    it('should return required state and methods', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.currentRow).toBeDefined()
      expect(result.rowKeyFn).toBeDefined()
      expect(result.rendererExpose).toBeDefined()
      expect(result.isRowSelectable).toBeDefined()
      expect(result.hasHoverOptionColumns).toBeDefined()
      expect(result.displayNormalColumns).toBeDefined()
      expect(result.getColumnWidth).toBeDefined()
      expect(result.handleResizeStart).toBeDefined()
      expect(result.tableContainerWidth).toBeDefined()
      expect(result.columnsTotalWidth).toBeDefined()
      expect(result.hoverRowKey).toBeDefined()
      expect(result.hoverLayerVisible).toBeDefined()
      expect(result.hoverLayerStyle).toBeDefined()
      expect(result.rowEventHandlers).toBeDefined()
      expect(result.handleScroll).toBeDefined()
    })

    it('should use custom rowKey function', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKey: (row: any) => row.id,
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      const row = { id: 123, name: 'test' }
      expect(result.rowKeyFn.value(row)).toBe(123)
    })
  })

  describe('isRowSelectable', () => {
    it('should return true when selectableFn is not provided', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.isRowSelectable({ id: 1 }, 0)).toBe(true)
    })

    it('should use selectableFn when provided', () => {
      const tableV2Ref = shallowRef<any>(null)
      const selectableFn = vi.fn((row: any) => row.id > 0)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        selectableFn,
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.isRowSelectable({ id: 1 }, 0)).toBe(true)
      expect(result.isRowSelectable({ id: 0 }, 0)).toBe(false)
      expect(selectableFn).toHaveBeenCalledWith({ id: 1 }, 0)
    })
  })

  describe('currentRow management', () => {
    it('should set and get current row', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      const row = { id: 1, name: 'test' }
      // <zh/> setCurrentRow/getCurrentRow 收敛至选择编排器（同一 shared ref 的唯一门面）
      // <en/> setCurrentRow/getCurrentRow have been converged to the selection orchestrator (single facade for the same shared ref)
      result.currentRow.value = row
      expect(result.currentRow.value).toBe(row)
    })

    it('should set current row to null', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      result.currentRow.value = { id: 1 }
      result.currentRow.value = null
      expect(result.currentRow.value).toBeNull()
    })
  })

  describe('rendererExpose', () => {
    it('should expose getColumnDragContainer', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.rendererExpose.getColumnDragContainer).toBeDefined()
    })

    it('should expose getRowDragContainer', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.rendererExpose.getRowDragContainer).toBeDefined()
    })

    it('should expose getRenderedColumnKeys', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.rendererExpose.getRenderedColumnKeys).toBeDefined()
    })

    it('should expose getRenderedRowKeys', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.rendererExpose.getRenderedRowKeys).toBeDefined()
    })

    it('should expose getDefaultColumnDragHandle', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.rendererExpose.getDefaultColumnDragHandle()).toBe('.adv-table__v2-header-cell')
    })

    it('should expose getDefaultRowDragHandle', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.rendererExpose.getDefaultRowDragHandle()).toBe('.adv-table__cell')
    })
  })

  describe('columnsTotalWidth', () => {
    it('should calculate width with selection columns', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [{ key: 'selection' }],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        selectionWidth: 60,
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.columnsTotalWidth.value).toBe(60)
    })

    it('should calculate width without selection columns', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.columnsTotalWidth.value).toBe(0)
    })

    it('should use default selection width', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [{ key: 'selection' }],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.columnsTotalWidth.value).toBe(50)
    })

    it('excludes fixed left/right columns from total width (used for hover layer positioning)', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [
          { key: 'a', width: 100 },
          { key: 'b', width: 120, fixed: 'right' },
          { key: 'c', width: 80, fixed: 'left' },
        ],
        data: [],
        selectionColumns: [{ key: 'selection' }],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        selectionWidth: 50,
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      // selection (50) + main area column 'a' (100) = 150
      // fixed 'right' 'b' (120) and fixed 'left' 'c' (80) MUST be excluded
      expect(result.columnsTotalWidth.value).toBe(150)
    })

    it('falls back to col.width sum when autoSizeColumns is true but main DOM width is not yet measured (no tableV2Ref)', () => {
      // hoverActions.teleport triggers autoSizeColumns=true, where el-table-v2 overrides
      // width to minWidth and stretches via flexGrow. Static col.width is no longer
      // accurate, but if the DOM has not been measured yet (e.g. in unit tests),
      // we must fall back gracefully to the legacy computation rather than
      // emitting a width of 0.
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [
          { key: 'a', width: 100 },
          { key: 'b', width: 80, minWidth: 80 },
        ],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: { isAllSelected: false, isIndeterminate: false },
        autoSizeColumns: true,
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      // Without DOM measurement, autoSizeColumns still uses col.width fallback
      expect(result.columnsTotalWidth.value).toBe(180)
    })
  })

  describe('hover layer', () => {
    it('should return hover layer state', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.hoverRowKey).toBeDefined()
      expect(result.hoverRowData).toBeDefined()
      expect(result.hoverRowIndex).toBeDefined()
      expect(result.hoverLayerVisible).toBeDefined()
      expect(result.hoverLayerCollapsed).toBeDefined()
      expect(result.hoverLayerStyle).toBeDefined()
      expect(result.toggleHoverLayerCollapse).toBeDefined()
      expect(result.handleHoverLayerEnter).toBeDefined()
      expect(result.handleHoverLayerLeave).toBeDefined()
    })

    it('should return hover option columns from categorization', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [
          { key: 'action', prop: 'action', valueType: 'option', hoverActions: true },
        ],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        hasHoverOptionColumns: true,
        hoverOptionColumns: [
          { key: 'action', prop: 'action', valueType: 'option', hoverActions: true },
        ],
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.hasHoverOptionColumns.value).toBe(true)
      expect(result.hoverOptionColumns.value).toHaveLength(1)
    })

    it('should return hoverOptionTeleport from categorization', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        hoverOptionTeleport: true,
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.hoverOptionTeleport.value).toBe(true)
    })

    it('should return displayNormalColumns', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [
          { key: 'name', prop: 'name', label: 'Name' },
        ],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        displayNormalColumns: [
          { key: 'name', prop: 'name', label: 'Name' },
        ],
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.displayNormalColumns.value).toHaveLength(1)
    })

    it('should return selectionColumnSyncKey', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [{ key: 'selection' }],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        selectionColumnSyncKey: 'selection',
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.selectionColumnSyncKey.value).toBe('selection')
    })

    it('should handle toggleHoverLayerCollapse', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.hoverLayerCollapsed.value).toBe(false)
      result.toggleHoverLayerCollapse(new Event('click'))
      expect(result.hoverLayerCollapsed.value).toBe(true)
    })
  })

  describe('rowEventHandlers', () => {
    it('should return handlers with only mouse events when no hover columns', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.rowEventHandlers.value).toBeDefined()
      expect(result.rowEventHandlers.value.onMouseenter).toBeDefined()
      expect(result.rowEventHandlers.value.onMouseleave).toBeDefined()
    })

    it('should return full handlers when hover columns exist', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [
          { key: 'action', prop: 'action', valueType: 'option', hoverActions: true },
        ],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.rowEventHandlers.value).toBeDefined()
    })

    it('should call row click emit', () => {
      const tableV2Ref = shallowRef<any>(null)
      const onRowClick = vi.fn()
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
        rowEmit: {
          onRowClick,
        },
      })

      const handlers = result.rowEventHandlers.value
      handlers.onClick?.({
        rowData: { id: 1 },
        rowIndex: 0,
        event: new Event('click'),
        rowKey: '1',
      })

      expect(onRowClick).toHaveBeenCalled()
    })

    it('should call row contextmenu emit', () => {
      const tableV2Ref = shallowRef<any>(null)
      const onRowContextmenu = vi.fn()
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
        rowEmit: {
          onRowContextmenu,
        },
      })

      const handlers = result.rowEventHandlers.value
      handlers.onContextmenu?.({
        rowData: { id: 1 },
        rowIndex: 0,
        event: new Event('contextmenu'),
        rowKey: '1',
      })

      expect(onRowContextmenu).toHaveBeenCalled()
    })

    it('should call row dblclick emit', () => {
      const tableV2Ref = shallowRef<any>(null)
      const onRowDblclick = vi.fn()
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
        rowEmit: {
          onRowDblclick,
        },
      })

      const handlers = result.rowEventHandlers.value
      handlers.onDblclick?.({
        rowData: { id: 1 },
        rowIndex: 0,
        event: new Event('dblclick'),
        rowKey: '1',
      })

      expect(onRowDblclick).toHaveBeenCalled()
    })

    it('should call cell mouse enter emit', () => {
      const tableV2Ref = shallowRef<any>(null)
      const onCellMouseEnter = vi.fn()
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
        rowEmit: {
          onCellMouseEnter,
        },
      })

      const handlers = result.rowEventHandlers.value
      handlers.onMouseenter?.({
        rowData: { id: 1 },
        rowIndex: 0,
        event: new Event('mouseenter'),
      })

      expect(onCellMouseEnter).toHaveBeenCalled()
    })

    it('should call cell mouse leave emit', () => {
      const tableV2Ref = shallowRef<any>(null)
      const onCellMouseLeave = vi.fn()
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
        rowEmit: {
          onCellMouseLeave,
        },
      })

      const handlers = result.rowEventHandlers.value
      handlers.onMouseleave?.()

      expect(onCellMouseLeave).toHaveBeenCalled()
    })

    it('should update current row on click', () => {
      const tableV2Ref = shallowRef<any>(null)
      const onCurrentChange = vi.fn()
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
        rowEmit: {
          onCurrentChange,
        },
      })

      const handlers = result.rowEventHandlers.value
      handlers.onClick?.({
        rowData: { id: 1 },
        rowIndex: 0,
        event: new Event('click'),
        rowKey: '1',
      })

      expect(result.currentRow.value).toEqual({ id: 1 })
      expect(onCurrentChange).toHaveBeenCalledWith({ currentRow: { id: 1 }, oldRow: null })
    })
  })

  describe('handleScroll', () => {
    it('should have handleScroll function', () => {
      const tableV2Ref = shallowRef<any>(null)
      const props = {
        columns: [],
        data: [],
        selectionColumns: [],
        normalColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
      }

      const result = useVirtualRenderer({
        props: props as any,
        tableV2Ref,
      })

      expect(result.handleScroll).toBeDefined()
    })
  })
})
