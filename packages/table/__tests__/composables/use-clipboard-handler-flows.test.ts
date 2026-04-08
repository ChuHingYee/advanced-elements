import { afterEach, describe, expect, it, vi } from 'vitest'
import { useClipboardHandler } from '../../src/composables/interaction/use-clipboard-handler'

/**
 * <zh/> 剪贴板流程单测——覆盖范围复制过滤、剪切、粘贴与失败派发。
 * <en/> Clipboard flow tests — range copy filtering, cut, paste and failure dispatch.
 */
const cols = [
  { key: 'name', prop: 'name', label: 'Name', editable: true },
  { key: 'secret', prop: 'secret', label: 'Secret', editable: true, sensitive: true },
]
const visData = [{ id: '1', name: 'A', secret: 's1' }]

function setupHandler(opts: {
  range?: any
  emit?: any
  readText?: () => Promise<string>
} = {}) {
  const emit = opts.emit ?? vi.fn()
  if (opts.readText)
    (navigator.clipboard as any).readText = opts.readText
  const edit = {
    batchCommitCells: vi.fn(async () => {}),
    isColumnEditable: () => true,
  }
  const api = useClipboardHandler({
    selection: { selectionState: { getSelectedRows: () => [] } } as any,
    edit: edit as any,
    pipeline: {
      effectiveColumns: () => cols,
      visibleData: () => visData,
      rowKeyFn: () => (row: any) => String(row.id),
    } as any,
    rangeLastSelection: opts.range ? () => opts.range : undefined,
    emit,
  })
  return { api, emit, edit }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (navigator.clipboard as any).readText
})

describe('useClipboardHandler range copy', () => {
  it('filters sensitive columns from range tsv', async () => {
    const writeText = navigator.clipboard.writeText as unknown as ReturnType<typeof vi.fn>
    writeText.mockClear()
    const t = setupHandler({
      range: { columns: cols, tsv: 'A\ts1', rows: [{ id: '1', name: 'A', secret: 's1' }] },
    })
    t.api.handleClipboardCopy({})
    await new Promise(r => setTimeout(r, 200))
    expect(writeText).toHaveBeenCalled()
    const written = String(writeText.mock.calls[0][0])
    expect(written).toContain('A')
    expect(written).not.toContain('s1')
    t.api.cancelPendingCopy()
  })

  it('writes raw tsv when no columns are stripped', async () => {
    const writeText = navigator.clipboard.writeText as unknown as ReturnType<typeof vi.fn>
    writeText.mockClear()
    const t = setupHandler({
      range: { columns: [{ key: 'name', prop: 'name' }], tsv: 'A\ts1', rows: [] },
    })
    t.api.handleClipboardCopy({})
    await new Promise(r => setTimeout(r, 200))
    expect(writeText).toHaveBeenCalledWith('A\ts1')
    t.api.cancelPendingCopy()
  })
})

describe('useClipboardHandler cut', () => {
  it('clears range cells through the edit pipeline', async () => {
    const t = setupHandler({
      range: { columns: [{ key: 'name', prop: 'name' }], tsv: 'A', rows: [{ id: '1', name: 'A' }] },
    })
    await t.api.handleClipboardCut({})
    expect(t.edit.batchCommitCells).toHaveBeenCalled()
  })
})

describe('useClipboardHandler paste', () => {
  it('pastes tsv cells starting at the anchor row', async () => {
    const t = setupHandler({ readText: async () => 'B' })
    await t.api.handleClipboardPaste({ rowData: visData[0] })
    expect(t.edit.batchCommitCells).toHaveBeenCalled()
    const cells = t.edit.batchCommitCells.mock.calls[0][0] as any[]
    expect(cells[0]).toMatchObject({ rowIndex: 0, prop: 'name', value: 'B' })
  })

  it('ignores empty clipboard text', async () => {
    const t = setupHandler({ readText: async () => '  \n' })
    await t.api.handleClipboardPaste({})
    expect(t.edit.batchCommitCells).not.toHaveBeenCalled()
  })

  it('aborts on synthetic anchor rows', async () => {
    const t = setupHandler({ readText: async () => 'B' })
    await t.api.handleClipboardPaste({ rowData: { __synthetic: true } })
    expect(t.edit.batchCommitCells).not.toHaveBeenCalled()
  })

  it('dispatches read failure on permission denial', async () => {
    const err = new DOMException('denied', 'NotAllowedError')
    const emit = vi.fn()
    const t = setupHandler({
      emit,
      readText: async () => {
        throw err
      },
    })
    await t.api.handleClipboardPaste({})
    expect(emit).toHaveBeenCalled()
  })

  it('dispatches paste failure on commit error', async () => {
    const emit = vi.fn()
    const t = setupHandler({ emit, readText: async () => 'B' })
    t.edit.batchCommitCells.mockRejectedValueOnce(new Error('commit down'))
    await t.api.handleClipboardPaste({ rowData: visData[0] })
    expect(emit).toHaveBeenCalled()
  })
})

describe('useClipboardHandler copy failure', () => {
  it('dispatches copy failure when the transport fails', async () => {
    const writeText = navigator.clipboard.writeText as unknown as ReturnType<typeof vi.fn>
    writeText.mockRejectedValueOnce(new Error('denied'))
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true, writable: true })
    const emit = vi.fn()
    const t = setupHandler({ emit })
    t.api.handleClipboardCopy({ rowData: visData[0], column: cols[0] })
    await new Promise(r => setTimeout(r, 200))
    expect(emit).toHaveBeenCalled()
    t.api.cancelPendingCopy()
  })
})
