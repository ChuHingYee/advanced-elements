import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { useClipboardHandler } from '../../src/composables/interaction/use-clipboard-handler'

function createMockColumn(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return {
    prop: 'name',
    label: 'Name',
    editable: true,
    hidden: false,
    key: 'name',
    ...overrides,
  } as ProcessedColumn
}

function createMockOptions(overrides: Record<string, any> = {}) {
  const columns = [createMockColumn()]
  const visibleData = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ]

  const selection = {
    selectionState: {
      getSelectedRows: vi.fn(() => []),
    },
  }

  const edit = {
    batchCommitCells: vi.fn().mockResolvedValue(undefined),
    isColumnEditable: vi.fn(() => true),
  }

  const pipeline = {
    effectiveColumns: vi.fn(() => columns),
    visibleData: vi.fn(() => visibleData),
    rowKeyFn: vi.fn(() => (row: { id: string }) => row.id),
  }

  return {
    selection,
    edit,
    pipeline,
    columns,
    visibleData,
    ...overrides,
  }
}

describe('useClipboardHandler', () => {
  it('returns handleClipboardCopy, handleClipboardCut, handleClipboardPaste functions', () => {
    const opts = createMockOptions()
    const result = useClipboardHandler(opts)
    expect(typeof result.handleClipboardCopy).toBe('function')
    expect(typeof result.handleClipboardCut).toBe('function')
    expect(typeof result.handleClipboardPaste).toBe('function')
  })

  describe('handleClipboardCopy', () => {
    it('copies selected rows when available', async () => {
      const opts = createMockOptions()
      opts.selection.selectionState.getSelectedRows = vi.fn(() => [
        { id: '1', name: 'Alice' },
      ])
      const result = useClipboardHandler(opts)

      // Mock clipboard API
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      await result.handleClipboardCopy({ rowData: { id: '1', name: 'Alice' }, column: opts.columns[0] })

      // writeText is called by copyRowsToClipboard
      expect(writeText).toHaveBeenCalled()

      vi.unstubAllGlobals()
    })

    it('copies single cell when no rows selected', async () => {
      const opts = createMockOptions()
      opts.selection.selectionState.getSelectedRows = vi.fn(() => [])
      const result = useClipboardHandler(opts)

      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      await result.handleClipboardCopy({
        rowData: { id: '1', name: 'Alice' },
        column: opts.columns[0],
      })

      expect(writeText).toHaveBeenCalled()

      vi.unstubAllGlobals()
    })

    it('does nothing when no rows and no cell context', async () => {
      const opts = createMockOptions()
      opts.selection.selectionState.getSelectedRows = vi.fn(() => [])
      const result = useClipboardHandler(opts)

      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      await result.handleClipboardCopy({})

      expect(writeText).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })

    it('excludes sensitive columns from row-copy payload (security contract S-1)', async () => {
      const opts = createMockOptions()
      opts.columns.push(createMockColumn({ prop: 'secret', label: 'Secret', key: 'secret', sensitive: true }))
      opts.selection.selectionState.getSelectedRows = vi.fn(() => [
        { id: '1', name: 'Alice', secret: 's3cret-token' },
      ])
      const result = useClipboardHandler(opts)

      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      await result.handleClipboardCopy({})

      expect(writeText).toHaveBeenCalledTimes(1)
      const tsv = writeText.mock.calls[0][0] as string
      expect(tsv).toContain('Alice')
      expect(tsv).not.toContain('s3cret-token')

      vi.unstubAllGlobals()
    })

    it('prefers the active range-selection TSV over selected rows (keyboard loop closure)', async () => {
      const rangeColumns = [
        createMockColumn({ prop: 'c1', label: 'C1', key: 'c1' }),
        createMockColumn({ prop: 'c2', label: 'C2', key: 'c2' }),
      ]
      const opts = createMockOptions({
        rangeLastSelection: () => ({ columns: rangeColumns, tsv: 'R1C1\tR1C2\nR2C1\tR2C2', rows: [] }),
      })
      // 即使同时存在选中行，范围选区也应优先
      opts.selection.selectionState.getSelectedRows = vi.fn(() => [{ id: '1', name: 'Alice' }])
      const result = useClipboardHandler(opts)

      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      await result.handleClipboardCopy({})

      expect(writeText).toHaveBeenCalledWith('R1C1\tR1C2\nR2C1\tR2C2')

      vi.unstubAllGlobals()
    })

    it('refuses to copy a single cell whose column is sensitive (security contract S-1)', async () => {
      const opts = createMockOptions()
      const secretCol = createMockColumn({ prop: 'secret', label: 'Secret', key: 'secret', sensitive: true })
      opts.selection.selectionState.getSelectedRows = vi.fn(() => [])
      const result = useClipboardHandler(opts)

      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      await result.handleClipboardCopy({
        rowData: { id: '1', name: 'Alice', secret: 's3cret-token' },
        column: secretCol,
      })

      expect(writeText).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })
  })

  describe('handleClipboardCut', () => {
    it('copies then clears selected rows via batchCommitCells', async () => {
      const opts = createMockOptions()
      const alice = { id: '1', name: 'Alice' }
      opts.pipeline.visibleData = vi.fn(() => [alice, { id: '2', name: 'Bob' }])
      opts.selection.selectionState.getSelectedRows = vi.fn(() => [alice])
      const result = useClipboardHandler(opts)

      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      await result.handleClipboardCut({ rowData: alice, column: opts.columns[0] })

      expect(opts.edit.batchCommitCells).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ prop: 'name', columnKey: 'name', value: '' }),
        ]),
        'cut',
      )

      vi.unstubAllGlobals()
    })

    it('never clears sensitive columns — cut surface equals copy surface', async () => {
      const opts = createMockOptions()
      opts.columns.push(createMockColumn({ prop: 'secret', label: 'Secret', key: 'secret', sensitive: true }))
      const alice = { id: '1', name: 'Alice', secret: 's3cret-token' }
      opts.pipeline.visibleData = vi.fn(() => [alice])
      opts.selection.selectionState.getSelectedRows = vi.fn(() => [alice])
      const result = useClipboardHandler(opts)

      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      await result.handleClipboardCut({ rowData: alice, column: opts.columns[0] })

      const clearedProps = opts.edit.batchCommitCells.mock.calls[0][0].map((c: any) => c.prop)
      expect(clearedProps).toContain('name')
      // 敏感列未进入剪贴板，就不能被静默清空
      expect(clearedProps).not.toContain('secret')

      vi.unstubAllGlobals()
    })

    it('skips rows not in visible data', async () => {
      const opts = createMockOptions()
      const selectedRows = [{ id: '99', name: 'Ghost' }]
      opts.selection.selectionState.getSelectedRows = vi.fn(() => selectedRows)
      const result = useClipboardHandler(opts)

      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      await result.handleClipboardCut({ rowData: selectedRows[0], column: opts.columns[0] })

      expect(opts.edit.batchCommitCells).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })

    it('does nothing when no rows selected', async () => {
      const opts = createMockOptions()
      opts.selection.selectionState.getSelectedRows = vi.fn(() => [])
      const result = useClipboardHandler(opts)

      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      await result.handleClipboardCut({})

      expect(opts.edit.batchCommitCells).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })
  })

  describe('handleClipboardPaste', () => {
    it('parses TSV and commits via batchCommitCells', async () => {
      const opts = createMockOptions()
      const result = useClipboardHandler(opts)

      const readText = vi.fn().mockResolvedValue('Charlie\t25\nDelta\t30')
      vi.stubGlobal('navigator', { clipboard: { readText } })

      await result.handleClipboardPaste({ rowIndex: 0 })

      expect(opts.edit.batchCommitCells).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ rowIndex: 0, prop: 'name', value: 'Charlie' }),
        ]),
        'paste',
      )

      vi.unstubAllGlobals()
    })

    it('returns early when clipboard is empty', async () => {
      const opts = createMockOptions()
      const result = useClipboardHandler(opts)

      const readText = vi.fn().mockResolvedValue('')
      vi.stubGlobal('navigator', { clipboard: { readText } })

      await result.handleClipboardPaste({ rowIndex: 0 })

      expect(opts.edit.batchCommitCells).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })

    it('returns early when clipboard has only whitespace', async () => {
      const opts = createMockOptions()
      const result = useClipboardHandler(opts)

      const readText = vi.fn().mockResolvedValue('   \n   ')
      vi.stubGlobal('navigator', { clipboard: { readText } })

      await result.handleClipboardPaste({ rowIndex: 0 })

      expect(opts.edit.batchCommitCells).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })

    it('returns early when no editable columns', async () => {
      const opts = createMockOptions()
      opts.edit.isColumnEditable = vi.fn(() => false)
      const result = useClipboardHandler(opts)

      const readText = vi.fn().mockResolvedValue('Charlie')
      vi.stubGlobal('navigator', { clipboard: { readText } })

      await result.handleClipboardPaste({ rowIndex: 0 })

      expect(opts.edit.batchCommitCells).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })

    it('silently catches clipboard API errors', async () => {
      const opts = createMockOptions()
      const result = useClipboardHandler(opts)

      const readText = vi.fn().mockRejectedValue(new Error('Clipboard API not available'))
      vi.stubGlobal('navigator', { clipboard: { readText } })

      // Should not throw
      await expect(result.handleClipboardPaste({ rowIndex: 0 })).resolves.toBeUndefined()

      vi.unstubAllGlobals()
    })

    it('respects startRowIndex from params', async () => {
      const opts = createMockOptions()
      opts.pipeline.visibleData = vi.fn(() => [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
      ])
      const result = useClipboardHandler(opts)

      const readText = vi.fn().mockResolvedValue('NewValue')
      vi.stubGlobal('navigator', { clipboard: { readText } })

      await result.handleClipboardPaste({ rowIndex: 2 })

      expect(opts.edit.batchCommitCells).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ rowIndex: 2 }),
        ]),
        'paste',
      )

      vi.unstubAllGlobals()
    })

    it('defaults to rowIndex 0 when not provided', async () => {
      const opts = createMockOptions()
      const result = useClipboardHandler(opts)

      const readText = vi.fn().mockResolvedValue('NewValue')
      vi.stubGlobal('navigator', { clipboard: { readText } })

      await result.handleClipboardPaste({})

      expect(opts.edit.batchCommitCells).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ rowIndex: 0 }),
        ]),
        'paste',
      )

      vi.unstubAllGlobals()
    })
  })
})
