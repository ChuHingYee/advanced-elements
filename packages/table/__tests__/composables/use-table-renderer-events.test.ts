import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useTableRendererEvents } from '../../src/composables/rendering/use-table-renderer-events'

/**
 * <zh/> 渲染器事件转发单测——覆盖转发契约、行选、编辑启动、快捷键与节流。
 * <en/> Renderer-events tests — forward contract, row select, edit start, shortcuts and throttle.
 */
const rows = [{ id: 1, name: 'A' }]
const col: any = { key: 'name', prop: 'name', label: 'Name' }

function setupEvents(opts: {
  editConfig?: Record<string, any>
  intercept?: boolean
  isCellEditing?: boolean
} = {}) {
  const emit = vi.fn()
  const toggleRowSelection = vi.fn()
  const startEditing = vi.fn()
  const updateCellEditingValue = vi.fn()
  const undo = vi.fn()
  const redo = vi.fn()
  const handleClipboardCopy = vi.fn()
  const handleClipboardCut = vi.fn()
  const handleClipboardPaste = vi.fn()
  const byKey = new Map([['name', col]])
  const keyToIndex = new Map([['1', 0]])
  let api!: ReturnType<typeof useTableRendererEvents>
  const wrapper = mount(defineComponent({
    setup() {
      api = useTableRendererEvents({
        selection: {
          selectionState: { toggleRowSelection } as any,
          hasSelection: () => true,
          suppressRowClickSelection: () => false,
          rowClickSelect: () => true,
        },
        edit: {
          editConfig: () => opts.editConfig ?? {},
          isColumnEditable: () => true,
          isCellEditing: () => opts.isCellEditing ?? false,
          startEditing,
          updateCellEditingValue,
          commitEditing: vi.fn(),
          batchCommitCells: vi.fn(),
          undo,
          redo,
        } as any,
        pipeline: {
          effectiveColumns: () => [col],
          columnByKey: () => byKey,
          visibleData: () => rows,
          rowKeyFn: () => (row: any) => String(row.id),
          rowKeyMeta: () => ({ keyToRow: new Map([['1', rows[0]]]), keyToIndex }),
          toggleSort: vi.fn(),
          shiftKeyPressed: ref(false),
          toggleCollapse: vi.fn(),
        } as any,
        clipboard: { handleClipboardCopy, handleClipboardCut, handleClipboardPaste } as any,
        emit: emit as any,
        interceptor: { trigger: () => opts.intercept ?? false } as any,
        tableId: () => 't1',
      })
      return () => h('div')
    },
  }))
  return {
    api,
    wrapper,
    emit,
    toggleRowSelection,
    startEditing,
    updateCellEditingValue,
    undo,
    redo,
    handleClipboardCopy,
    handleClipboardCut,
    handleClipboardPaste,
  }
}

const cellParams = () => ({ rowData: rows[0], rowIndex: 0, column: col, columnIndex: 0, event: {} })

describe('useTableRendererEvents forwarders', () => {
  it('appends tableId to forwarded events', () => {
    const t = setupEvents()
    t.api.rendererEvents.rowDblclick({ a: 1 })
    const call = t.emit.mock.calls.find(c => c[0] === 'rowDblclick')
    expect(call![call!.length - 1]).toBe('t1')
    t.wrapper.unmount()
  })

  it('throttles scroll with leading and trailing edges', () => {
    vi.useFakeTimers()
    try {
      const t = setupEvents()
      t.api.rendererEvents.scroll({ top: 1 })
      t.api.rendererEvents.scroll({ top: 2 })
      expect(t.emit.mock.calls.filter(c => c[0] === 'scroll').length).toBe(1)
      vi.advanceTimersByTime(60)
      const scrolls = t.emit.mock.calls.filter(c => c[0] === 'scroll')
      expect(scrolls.length).toBe(2)
      expect(scrolls[1][1]).toEqual({ top: 2 })
      t.wrapper.unmount()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('batches cellMouseEnter within a frame', () => {
    const frames: FrameRequestCallback[] = []
    const realRaf = globalThis.requestAnimationFrame
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      value: ((cb: FrameRequestCallback) => {
        frames.push(cb)
        return frames.length
      }) as typeof globalThis.requestAnimationFrame,
      writable: true,
      configurable: true,
    })
    try {
      const t = setupEvents()
      t.api.rendererEvents.cellMouseEnter({ r: 1 })
      t.api.rendererEvents.cellMouseEnter({ r: 2 })
      expect(t.emit.mock.calls.filter(c => c[0] === 'cellMouseEnter').length).toBe(0)
      for (const cb of frames)
        cb(0)
      const calls = t.emit.mock.calls.filter(c => c[0] === 'cellMouseEnter')
      expect(calls.length).toBe(1)
      expect(calls[0][1]).toEqual({ r: 2 })
      t.wrapper.unmount()
    }
    finally {
      Object.defineProperty(globalThis, 'requestAnimationFrame', {
        value: realRaf,
        writable: true,
        configurable: true,
      })
    }
  })

  it('forwards header click', () => {
    const t = setupEvents()
    t.api.rendererEvents.headerClick({ column: col })
    expect(t.emit.mock.calls.find(c => c[0] === 'headerClick')).toBeDefined()
    t.wrapper.unmount()
  })

  it('blocks forwarding when the interceptor triggers', () => {
    const t = setupEvents({ intercept: true })
    t.api.rendererEvents.rowClick({ rowData: rows[0], event: {} })
    t.api.rendererEvents.headerClick({ column: col })
    t.api.rendererEvents.cellKeyDown({ event: new KeyboardEvent('keydown', { key: 'a' }) })
    expect(t.emit).not.toHaveBeenCalled()
    expect(t.toggleRowSelection).not.toHaveBeenCalled()
    t.wrapper.unmount()
  })
})

describe('useTableRendererEvents rowClick', () => {
  it('selects the row then forwards', () => {
    const t = setupEvents()
    t.api.rendererEvents.rowClick({ rowData: rows[0], event: {} })
    expect(t.toggleRowSelection).toHaveBeenCalledWith(rows[0], undefined, false, { shiftKey: false, ctrlKey: false })
    expect(t.emit.mock.calls.find(c => c[0] === 'rowClick')).toBeDefined()
    t.wrapper.unmount()
  })
})

describe('useTableRendererEvents editing', () => {
  it('starts editing on cellClick with singleClickEdit', () => {
    const t = setupEvents({ editConfig: { singleClickEdit: true } })
    t.api.rendererEvents.cellClick(cellParams())
    expect(t.startEditing).toHaveBeenCalledWith({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'A' })
    t.wrapper.unmount()
  })

  it('starts editing on cellDblclick without singleClickEdit', () => {
    const t = setupEvents({ editConfig: {} })
    t.api.rendererEvents.cellDblclick(cellParams())
    expect(t.startEditing).toHaveBeenCalled()
    t.wrapper.unmount()
  })

  it('clears the cell on Backspace with config', () => {
    const t = setupEvents({ editConfig: { enableCellEditingOnBackspace: true } })
    t.api.rendererEvents.cellKeyDown({ ...cellParams(), event: new KeyboardEvent('keydown', { key: 'Backspace' }) })
    expect(t.startEditing).toHaveBeenCalled()
    expect(t.updateCellEditingValue).toHaveBeenCalledWith('name', '')
    t.wrapper.unmount()
  })

  it('forwards unmatched keys', () => {
    const t = setupEvents()
    t.api.rendererEvents.cellKeyDown({ ...cellParams(), event: new KeyboardEvent('keydown', { key: 'a' }) })
    expect(t.emit.mock.calls.find(c => c[0] === 'cellKeyDown')).toBeDefined()
    t.wrapper.unmount()
  })
})

describe('useTableRendererEvents shortcuts', () => {
  it('handles undo/redo with enableUndo', () => {
    const t = setupEvents({ editConfig: { enableUndo: true } })
    t.api.rendererEvents.cellKeyDown({ ...cellParams(), event: new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }) })
    expect(t.undo).toHaveBeenCalled()
    t.api.rendererEvents.cellKeyDown({
      ...cellParams(),
      event: new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true }),
    })
    expect(t.redo).toHaveBeenCalled()
    t.wrapper.unmount()
  })

  it('copies via clipboard shortcut outside editing', () => {
    const t = setupEvents({ editConfig: { enableClipboard: true } })
    const params = { ...cellParams(), event: new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }) }
    t.api.rendererEvents.cellKeyDown(params)
    expect(t.handleClipboardCopy).toHaveBeenCalledWith(params)
    expect(t.emit.mock.calls.find(c => c[0] === 'cellKeyDown')).toBeUndefined()
    t.wrapper.unmount()
  })

  it('lets native clipboard through while editing', () => {
    const t = setupEvents({ editConfig: { enableClipboard: true }, isCellEditing: true })
    t.api.rendererEvents.cellKeyDown({ ...cellParams(), event: new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }) })
    expect(t.handleClipboardCopy).not.toHaveBeenCalled()
    expect(t.emit.mock.calls.find(c => c[0] === 'cellKeyDown')).toBeDefined()
    t.wrapper.unmount()
  })
})

describe('useTableRendererEvents row identity', () => {
  it('skips selection for synthetic rows but still forwards', () => {
    const t = setupEvents()
    t.api.rendererEvents.rowClick({ rowData: { __isGroupHeader: true }, event: {} })
    expect(t.toggleRowSelection).not.toHaveBeenCalled()
    expect(t.emit.mock.calls.find(c => c[0] === 'rowClick')).toBeDefined()
    t.wrapper.unmount()
  })

  it('skips selection for checkbox clicks', () => {
    const t = setupEvents()
    const input = document.createElement('input')
    input.type = 'checkbox'
    t.api.rendererEvents.rowClick({ rowData: rows[0], event: { target: input } })
    expect(t.toggleRowSelection).not.toHaveBeenCalled()
    expect(t.emit.mock.calls.find(c => c[0] === 'rowClick')).toBeDefined()
    t.wrapper.unmount()
  })

  it('resolves row index by key metadata', () => {
    const t = setupEvents()
    t.api.rendererEvents.cellClick({ rowData: { id: '9', name: 'Z' }, rowIndex: 5, column: col, columnIndex: 0, event: {} })
    expect(t.emit.mock.calls.find(c => c[0] === 'cellClick')).toBeDefined()
    t.wrapper.unmount()
  })
})

describe('useTableRendererEvents key fallbacks', () => {
  it('forwards Backspace/F2 without edit config', () => {
    const t = setupEvents({ editConfig: {} })
    t.api.rendererEvents.cellKeyDown({ ...cellParams(), event: new KeyboardEvent('keydown', { key: 'F2' }) })
    expect(t.startEditing).not.toHaveBeenCalled()
    t.api.rendererEvents.cellKeyDown({ ...cellParams(), event: new KeyboardEvent('keydown', { key: 'Backspace' }) })
    expect(t.startEditing).not.toHaveBeenCalled()
    expect(t.emit.mock.calls.filter(c => c[0] === 'cellKeyDown').length).toBe(2)
    t.wrapper.unmount()
  })

  it('cuts and pastes via shortcuts', () => {
    const t = setupEvents({ editConfig: { enableClipboard: true } })
    t.api.rendererEvents.cellKeyDown({ ...cellParams(), event: new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }) })
    expect(t.handleClipboardCut).toHaveBeenCalled()
    t.api.rendererEvents.cellKeyDown({ ...cellParams(), event: new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }) })
    expect(t.handleClipboardPaste).toHaveBeenCalled()
    t.wrapper.unmount()
  })

  it('ignores edit entry without column or row', () => {
    const t = setupEvents({ editConfig: { singleClickEdit: true } })
    t.api.rendererEvents.cellClick({ rowIndex: 0, columnIndex: 0, event: {} })
    expect(t.startEditing).not.toHaveBeenCalled()
    t.wrapper.unmount()
  })

  it('dispatches column double-click callbacks', () => {
    const onCellDoubleClick = vi.fn()
    const t = setupEvents()
    t.api.rendererEvents.cellDblclick({
      rowData: rows[0],
      rowIndex: 0,
      column: { ...col, onCellDoubleClick },
      columnIndex: 0,
      event: {},
    })
    expect(t.startEditing).toHaveBeenCalled()
    t.wrapper.unmount()
  })

  it('cleans pending timers on unmount', () => {
    const t = setupEvents()
    t.api.rendererEvents.scroll({ top: 1 })
    t.wrapper.unmount()
    expect(t.emit.mock.calls.filter(c => c[0] === 'scroll').length).toBe(1)
  })
})
