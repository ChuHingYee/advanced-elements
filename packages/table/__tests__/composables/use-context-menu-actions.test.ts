import type { ProcessedColumn } from '../../src/types'
/**
 * <zh/> useContextMenuActions 单元测试 | <en/> useContextMenuActions unit tests
 */
import type { ContextMenuParams } from '../../src/types/context-menu'
import { describe, expect, it, vi } from 'vitest'
import { useContextMenuActions } from '../../src/composables/features/use-context-menu-actions'

vi.mock('../../src/utils/context-menu-clipboard', () => ({
  copyCellToClipboard: vi.fn(),
  copyRowsToClipboard: vi.fn(),
  copyRowToClipboard: vi.fn(),
}))

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

function makeOptions(overrides: Record<string, any> = {}) {
  return {
    effectiveColumns: () => [makeColumn({ prop: 'name', key: 'name' }), makeColumn({ prop: 'age', key: 'age' })],
    getSelectedRows: () => [{ id: '1', name: 'Alice' }],
    startEditing: vi.fn(),
    updateCellEditingValue: vi.fn(),
    commitEditing: vi.fn().mockResolvedValue(undefined),
    applyColumnState: vi.fn(),
    resetColumnState: vi.fn(),
    clearSort: vi.fn(),
    resetColumnFilter: vi.fn(),
    resetAllFilters: vi.fn(),
    exportCsv: vi.fn(),
    exportExcel: vi.fn(),
    triggerImport: vi.fn(),
    print: vi.fn(),
    ...overrides,
  }
}

function makeContext(overrides: Partial<ContextMenuParams> = {}): ContextMenuParams {
  return {
    area: 'body',
    row: { id: '1', name: 'Alice', age: 30 },
    rowIndex: 0,
    column: makeColumn({ prop: 'name', key: 'name' }),
    columnIndex: 0,
    event: new MouseEvent('contextmenu'),
    ...overrides,
  }
}

describe('useContextMenuActions', () => {
  it('copyCell copies cell to clipboard', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    const { copyCellToClipboard } = await import('../../src/utils/context-menu-clipboard')
    vi.mocked(copyCellToClipboard).mockResolvedValue(true)
    await handleBuiltinAction('copyCell', makeContext())
    expect(copyCellToClipboard).toHaveBeenCalledWith({ id: '1', name: 'Alice', age: 30 }, makeContext().column)
  })

  it('copyCell reports TABLE_CLIPBOARD_COPY_FAILED when clipboard refuses', async () => {
    const onError = vi.fn()
    const options = makeOptions({ onError })
    const { handleBuiltinAction } = useContextMenuActions(options)
    const { copyCellToClipboard } = await import('../../src/utils/context-menu-clipboard')
    vi.mocked(copyCellToClipboard).mockResolvedValue(false)
    await handleBuiltinAction('copyCell', makeContext())
    expect(onError).toHaveBeenCalledWith(expect.anything(), 'TABLE_CLIPBOARD_COPY_FAILED')
  })

  it('blocks copy and cut for sensitive grouped child columns', async () => {
    const sensitiveColumn = makeColumn({ prop: 'password', key: 'password', sensitive: true })
    const options = makeOptions({
      effectiveColumns: () => [{ label: 'Account', children: [sensitiveColumn] }],
    })
    const { handleBuiltinAction } = useContextMenuActions(options)
    const { copyCellToClipboard } = await import('../../src/utils/context-menu-clipboard')
    vi.mocked(copyCellToClipboard).mockClear()
    const context = makeContext({
      column: sensitiveColumn,
      row: { id: '1', name: 'Alice', password: 'secret' },
    })

    await handleBuiltinAction('copyCell', context)
    await handleBuiltinAction('cutCell', context)

    expect(copyCellToClipboard).not.toHaveBeenCalled()
    expect(options.startEditing).not.toHaveBeenCalled()
  })

  it('copyCell does nothing without row or column', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    const { copyCellToClipboard } = await import('../../src/utils/context-menu-clipboard')
    vi.mocked(copyCellToClipboard).mockClear()
    await handleBuiltinAction('copyCell', makeContext({ row: undefined }))
    expect(copyCellToClipboard).not.toHaveBeenCalled()
  })

  it('copyCellWithHeader copies row with header', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    const { copyRowToClipboard } = await import('../../src/utils/context-menu-clipboard')
    await handleBuiltinAction('copyCellWithHeader', makeContext())
    expect(copyRowToClipboard).toHaveBeenCalledWith({ id: '1', name: 'Alice', age: 30 }, [makeContext().column], true)
  })

  it('copyRow copies entire row', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    const { copyRowToClipboard } = await import('../../src/utils/context-menu-clipboard')
    await handleBuiltinAction('copyRow', makeContext())
    expect(copyRowToClipboard).toHaveBeenCalledWith({ id: '1', name: 'Alice', age: 30 }, options.effectiveColumns())
  })

  it('copyRowWithHeaders copies row with headers', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    const { copyRowToClipboard } = await import('../../src/utils/context-menu-clipboard')
    await handleBuiltinAction('copyRowWithHeaders', makeContext())
    expect(copyRowToClipboard).toHaveBeenCalledWith({ id: '1', name: 'Alice', age: 30 }, options.effectiveColumns(), true)
  })

  it('copySelectedRows copies selected rows', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    const { copyRowsToClipboard } = await import('../../src/utils/context-menu-clipboard')
    await handleBuiltinAction('copySelectedRows', makeContext())
    expect(copyRowsToClipboard).toHaveBeenCalledWith([{ id: '1', name: 'Alice' }], options.effectiveColumns())
  })

  it('copySelectedRowsWithHeaders copies selected rows with headers', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    const { copyRowsToClipboard } = await import('../../src/utils/context-menu-clipboard')
    await handleBuiltinAction('copySelectedRowsWithHeaders', makeContext())
    expect(copyRowsToClipboard).toHaveBeenCalledWith([{ id: '1', name: 'Alice' }], options.effectiveColumns(), true)
  })

  it('cutCell copies and clears cell value', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('cutCell', makeContext())
    expect(options.startEditing).toHaveBeenCalledWith({
      rowIndex: 0,
      prop: 'name',
      columnKey: 'name',
      value: 'Alice',
    })
    expect(options.updateCellEditingValue).toHaveBeenCalledWith('name', '')
    expect(options.commitEditing).toHaveBeenCalledWith('contextMenu')
  })

  it('cutCell does nothing without row', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('cutCell', makeContext({ row: undefined }))
    expect(options.startEditing).not.toHaveBeenCalled()
  })

  it('clearCell clears cell value through editing pipeline', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('clearCell', makeContext())
    expect(options.startEditing).toHaveBeenCalledWith({
      rowIndex: 0,
      prop: 'name',
      columnKey: 'name',
      value: 'Alice',
    })
    expect(options.updateCellEditingValue).toHaveBeenCalledWith('name', '')
    expect(options.commitEditing).toHaveBeenCalledWith('contextMenu')
  })

  it('clearCell does nothing without row', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('clearCell', makeContext({ row: undefined }))
    expect(options.startEditing).not.toHaveBeenCalled()
  })

  it('editCell starts editing', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('editCell', makeContext())
    expect(options.startEditing).toHaveBeenCalledWith({
      rowIndex: 0,
      prop: 'name',
      columnKey: 'name',
      value: 'Alice',
    })
  })

  it('editCell does nothing without row', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('editCell', makeContext({ row: undefined }))
    expect(options.startEditing).not.toHaveBeenCalled()
  })

  it('autoSizeThisColumn applies column state with colId', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('autoSizeThisColumn', makeContext())
    expect(options.applyColumnState).toHaveBeenCalledWith([{ colId: 'name' }], { applyOrder: false })
  })

  it('autoSizeThisColumn does nothing without column', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('autoSizeThisColumn', makeContext({ column: undefined }))
    expect(options.applyColumnState).not.toHaveBeenCalled()
  })

  it('autoSizeAllColumns applies column state for all columns', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('autoSizeAllColumns', makeContext())
    expect(options.applyColumnState).toHaveBeenCalledWith([{ colId: 'name' }, { colId: 'age' }], { applyOrder: false })
  })

  it('resetColumns resets column state', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('resetColumns', makeContext())
    expect(options.resetColumnState).toHaveBeenCalled()
  })

  it('clearSort clears sort', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('clearSort', makeContext())
    expect(options.clearSort).toHaveBeenCalled()
  })

  it('clearFilter resets column filter', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('clearFilter', makeContext())
    expect(options.resetColumnFilter).toHaveBeenCalledWith('name')
  })

  it('clearFilter does nothing without column', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('clearFilter', makeContext({ column: undefined }))
    expect(options.resetColumnFilter).not.toHaveBeenCalled()
  })

  it('clearAllFilters resets all filters', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('clearAllFilters', makeContext())
    expect(options.resetAllFilters).toHaveBeenCalled()
  })

  it('exportCsv triggers CSV export', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('exportCsv', makeContext())
    expect(options.exportCsv).toHaveBeenCalled()
  })

  it('exportExcel triggers Excel export', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('exportExcel', makeContext())
    expect(options.exportExcel).toHaveBeenCalled()
  })

  it('importExcel triggers import', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('importExcel', makeContext())
    expect(options.triggerImport).toHaveBeenCalled()
  })

  it('print triggers print', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('print', makeContext())
    expect(options.print).toHaveBeenCalled()
  })

  it('hideThisColumn applies hidden state', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('hideThisColumn', makeContext())
    expect(options.applyColumnState).toHaveBeenCalledWith([{ colId: 'name', hidden: true }])
  })

  it('hideThisColumn does nothing without column', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('hideThisColumn', makeContext({ column: undefined }))
    expect(options.applyColumnState).not.toHaveBeenCalled()
  })

  it('showAllColumns shows all columns', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('showAllColumns', makeContext())
    expect(options.applyColumnState).toHaveBeenCalledWith([{ colId: 'name', hidden: false }, { colId: 'age', hidden: false }])
  })

  it('cutCell uses column.key fallback to column.prop when key is undefined', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    const context = makeContext({
      column: makeColumn({ prop: 'name', key: undefined as any }),
    })
    await handleBuiltinAction('cutCell', context)
    expect(options.startEditing).toHaveBeenCalledWith({
      rowIndex: 0,
      prop: 'name',
      columnKey: 'name',
      value: 'Alice',
    })
  })

  it('clearCell does nothing when rowIndex is null', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('clearCell', makeContext({ rowIndex: undefined }))
    expect(options.startEditing).not.toHaveBeenCalled()
  })

  it('clearCell does nothing when column has no prop', async () => {
    const options = makeOptions()
    const { handleBuiltinAction } = useContextMenuActions(options)
    await handleBuiltinAction('clearCell', makeContext({ column: makeColumn({ prop: undefined as any }) }))
    expect(options.startEditing).not.toHaveBeenCalled()
  })
})
