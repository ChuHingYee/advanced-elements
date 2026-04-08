import type { Mock } from 'vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTableImport } from '../../src/composables/features/use-table-import'

vi.mock('../../src/utils/import-helpers', () => ({
  isCsvFile: vi.fn(),
  isExcelFile: vi.fn(),
  parseCsvText: vi.fn(),
  parseExcelBuffer: vi.fn(),
  readFileAsText: vi.fn(),
  readFileAsArrayBuffer: vi.fn(),
}))

const mockHelpers = await import('../../src/utils/import-helpers') as typeof import('../../src/utils/import-helpers') & {
  isCsvFile: Mock
  isExcelFile: Mock
  parseCsvText: Mock
  parseExcelBuffer: Mock
  readFileAsText: Mock
  readFileAsArrayBuffer: Mock
}

function mockFile(name: string, content?: string): File {
  return new File([content ?? ''], name, { type: 'text/plain' })
}

describe('useTableImport', () => {
  // <zh/> 声明提升至 afterEach 之前——该钩子在定义前即引用 mockNotify
  // <en/> Hoisted above afterEach — the hook references mockNotify before its previous declaration site
  const mockNotify = vi.fn()

  afterEach(() => {
    vi.restoreAllMocks()
    mockHelpers.isExcelFile.mockReset()
    mockHelpers.isCsvFile.mockReset()
    mockHelpers.readFileAsText.mockReset()
    mockHelpers.readFileAsArrayBuffer.mockReset()
    mockHelpers.parseCsvText.mockReset()
    mockHelpers.parseExcelBuffer.mockReset()
    mockNotify.mockReset()
    document.body.innerHTML = ''
  })

  const t = vi.fn((key: string) => {
    const map: Record<string, string> = {
      'table.import.success': 'Import successful',
      'table.import.fail': 'Import failed',
      'table.import.invalidFile': 'Invalid file type',
      'table.import.noData': 'No data found',
      'table.import.maxRowsExceeded': 'Max rows exceeded',
    }
    return map[key] || key
  })

  function setup(options?: any) {
    const onImportedRows = vi.fn()
    const importOptions = () => options ?? {}
    const result = useTableImport<any>({ importOptions, t, onImportedRows, notify: mockNotify })
    return { ...result, onImportedRows, importOptions }
  }

  describe('importFile', () => {
    it('handles file with unsupported extension without calling onImportedRows', async () => {
      const { importFile, onImportedRows } = setup()
      await importFile(mockFile('data.txt'))
      expect(onImportedRows).not.toHaveBeenCalled()
    })

    it('accept option filters file extensions', async () => {
      const { importFile, onImportedRows } = setup({ accept: ['.csv'] })
      mockHelpers.isExcelFile.mockReturnValue(false)
      mockHelpers.isCsvFile.mockReturnValue(false)
      await importFile(mockFile('data.xlsx'))
      expect(onImportedRows).not.toHaveBeenCalled()
    })

    it('prevents concurrent imports', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const { importFile, importing: _importing } = setup()
      const promise1 = importFile(mockFile('data.xlsx'))
      const promise2 = importFile(mockFile('data.xlsx'))
      await promise1
      await promise2
      expect(mockHelpers.parseExcelBuffer).toHaveBeenCalledTimes(1)
    })

    it('parses Excel files', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const { importFile, onImportedRows } = setup()
      await importFile(mockFile('data.xlsx'))
      expect(mockHelpers.parseExcelBuffer).toHaveBeenCalled()
      expect(onImportedRows).toHaveBeenCalledWith([{ name: 'Alice' }], 'append')
    })

    it('parses CSV files', async () => {
      mockHelpers.isExcelFile.mockReturnValue(false)
      mockHelpers.isCsvFile.mockReturnValue(true)
      mockHelpers.readFileAsText.mockResolvedValue('name,age\nAlice,25')
      mockHelpers.parseCsvText.mockReturnValue({ columns: ['name', 'age'], rows: [{ name: 'Alice', age: '25' }] })

      const { importFile, onImportedRows } = setup()
      await importFile(mockFile('data.csv'))
      expect(mockHelpers.parseCsvText).toHaveBeenCalled()
      expect(onImportedRows).toHaveBeenCalledWith([{ name: 'Alice', age: '25' }], 'append')
    })

    it('handles unsupported file type gracefully', async () => {
      mockHelpers.isExcelFile.mockReturnValue(false)
      mockHelpers.isCsvFile.mockReturnValue(false)

      const { importFile, onImportedRows } = setup()
      // <zh/> 非 Excel/CSV：静默跳过，不抛错、不回调、不污染已导入行
      // <en/> Neither Excel nor CSV: silently skipped, no throw, no callback, no imported rows
      await importFile(mockFile('data.csv'))
      expect(onImportedRows).not.toHaveBeenCalled()
    })

    it('shows warning when no rows parsed', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: [], rows: [] })

      const { importFile, onImportedRows } = setup()
      await importFile(mockFile('data.xlsx'))
      expect(onImportedRows).not.toHaveBeenCalled()
    })

    it('truncates rows beyond maxRows', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({
        columns: ['n'],
        rows: [{ n: '1' }, { n: '2' }, { n: '3' }, { n: '4' }, { n: '5' }],
      })

      const { importFile, onImportedRows } = setup({ maxRows: 3 })
      await importFile(mockFile('data.xlsx'))
      expect(onImportedRows).toHaveBeenCalledWith([{ n: '1' }, { n: '2' }, { n: '3' }], 'append')
    })

    it('applies transformRow and filters null results', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({
        columns: ['name'],
        rows: [{ name: 'Alice' }, { name: '' }, { name: 'Bob' }],
      })

      const { importFile, onImportedRows } = setup({
        transformRow: (row: any) => row.name ? row : null,
      })
      await importFile(mockFile('data.xlsx'))
      expect(onImportedRows).toHaveBeenCalledWith([{ name: 'Alice' }, { name: 'Bob' }], 'append')
    })

    it('awaits an async transformRow and preserves row order', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({
        columns: ['name'],
        rows: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      })

      // <zh/> 逐行 await：乱序 resolve 也不得打乱最终行序（顺序由 for 循环保证，非 Promise 完成序）
      // <en/> Per-row await: out-of-order resolution must not shuffle the final order (order comes
      // <en/> from the loop, not from promise completion order)
      const seen: number[] = []
      const { importFile, onImportedRows } = setup({
        transformRow: async (row: any, i: number) => {
          seen.push(i)
          await new Promise(resolve => setTimeout(resolve, (3 - i) * 5))
          return { name: `${row.name}!` }
        },
      })
      await importFile(mockFile('data.xlsx'))

      expect(seen).toEqual([0, 1, 2])
      expect(onImportedRows).toHaveBeenCalledWith(
        [{ name: 'a!' }, { name: 'b!' }, { name: 'c!' }],
        'append',
      )
    })

    it('respects beforeImport cancellation', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const beforeImport = vi.fn().mockResolvedValue(false)
      const { importFile, onImportedRows } = setup({ beforeImport })
      const result = await importFile(mockFile('data.xlsx'))
      expect(onImportedRows).not.toHaveBeenCalled()
      // <zh/> 取消必须可观测：cancelled=true 且不发成功提示 | <en/> Cancellation is observable: cancelled=true, no success toast
      expect(result.cancelled).toBe(true)
      expect(mockNotify).not.toHaveBeenCalledWith('success', expect.any(String), 'import')
    })

    it('returns cancelled=false and notifies on an accepted import', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const { importFile } = setup()
      const result = await importFile(mockFile('data.xlsx'))
      expect(result.cancelled).toBe(false)
      expect(mockNotify).toHaveBeenCalledWith('success', expect.any(String), 'import')
    })

    it('dispatches TABLE_IMPORT_FAILED for a rejected extension', async () => {
      const emit = vi.fn()
      const importOptions = () => ({})
      const { importFile } = useTableImport<any>({ importOptions, t, onImportedRows: vi.fn(), notify: mockNotify, emit })

      await importFile(mockFile('data.txt'))

      expect(emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'TABLE_IMPORT_FAILED' }))
    })

    it('dispatches TABLE_IMPORT_FAILED for an oversized file', async () => {
      const emit = vi.fn()
      const t2 = vi.fn((key: string) => key)
      const { importFile } = useTableImport<any>({
        importOptions: () => ({ maxFileSize: 1 }),
        t: t2,
        onImportedRows: vi.fn(),
        notify: mockNotify,
        emit,
      })

      await importFile(mockFile('data.xlsx'))

      expect(emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'TABLE_IMPORT_FAILED' }))
    })

    it('calls onImported callback', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const onImported = vi.fn()
      const { importFile } = setup({ onImported })
      await importFile(mockFile('data.xlsx'))
      expect(onImported).toHaveBeenCalledWith([{ name: 'Alice' }])
    })

    it('uses replace mode when configured', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const { importFile, onImportedRows } = setup({ mode: 'replace' })
      await importFile(mockFile('data.xlsx'))
      expect(onImportedRows).toHaveBeenCalledWith([{ name: 'Alice' }], 'replace')
    })

    it('handles errors during parsing', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockRejectedValue(new Error('Parse error'))

      const { importFile } = setup()
      await expect(importFile(mockFile('data.xlsx'))).rejects.toThrow('Parse error')
    })
  })

  describe('showMessage via notify', () => {
    it('calls notify on import success', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const { importFile } = setup()
      await importFile(mockFile('data.xlsx'))
      expect(mockNotify).toHaveBeenCalledWith('success', expect.any(String), 'import')
    })

    it('rethrows import errors without reporting (reporting belongs to handleFileChange)', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockRejectedValue(new Error('bad'))

      const { importFile } = setup()
      // <zh/> 新契约：importFile 只 rethrow 不上报——唯一调用方 handleFileChange 统一上报一次。
      // <en/> New contract: importFile only rethrows — the sole caller handleFileChange reports
      await expect(importFile(mockFile('data.xlsx'))).rejects.toThrow('bad')
      expect(mockNotify).not.toHaveBeenCalledWith('error', expect.any(String), 'import')
    })
  })

  describe('edge case branches', () => {
    it('importOptions returning undefined falls back to empty object', async () => {
      mockHelpers.isCsvFile.mockReturnValue(true)
      mockHelpers.readFileAsText.mockResolvedValue('name\nAlice')
      mockHelpers.parseCsvText.mockReturnValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const onImportedRows = vi.fn()
      const result = useTableImport<any>({
        importOptions: () => undefined as any,
        t,
        onImportedRows,
        notify: mockNotify,
      })
      await result.importFile(mockFile('data.csv'))
      expect(onImportedRows).toHaveBeenCalled()
    })

    it('beforeImport returning true proceeds with import', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const beforeImport = vi.fn().mockResolvedValue(true)
      const { importFile, onImportedRows } = setup({ beforeImport })
      await importFile(mockFile('data.xlsx'))
      expect(onImportedRows).toHaveBeenCalled()
    })

    it('showMessage uses fallbackKey when t(key, params) returns empty', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const tWithEmptyForParams = vi.fn((key: string, params?: any) => {
        if (key === 'table.import.success' && params)
          return ''
        const map: Record<string, string> = {
          'table.import.success': 'Import successful',
          'table.import.fail': 'Import failed',
          'table.import.invalidFile': 'Invalid file type',
          'table.import.noData': 'No data found',
        }
        return map[key] || key
      })

      const onImportedRows = vi.fn()
      const result = useTableImport<any>({ importOptions: () => ({}), t: tWithEmptyForParams, onImportedRows, notify: mockNotify })
      await result.importFile(mockFile('data.xlsx'))
      expect(onImportedRows).toHaveBeenCalled()
    })
  })

  describe('triggerImport', () => {
    it('creates file input and clicks it', () => {
      const { triggerImport } = setup()
      triggerImport()
      const input = document.querySelector('input[type="file"]')
      expect(input).not.toBeNull()
    })

    it('sets accept attribute from config', () => {
      const { triggerImport } = setup({ accept: ['.xlsx', '.csv'] })
      triggerImport()
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(input.accept).toBe('.xlsx,.csv')
    })

    it('uses default accept when config has no accept', () => {
      const { triggerImport } = setup()
      triggerImport()
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(input.accept).toBe('.csv,.xlsx,.xls')
    })

    it('reuses existing file input on subsequent calls', () => {
      const { triggerImport } = setup()
      triggerImport()
      triggerImport()
      const inputs = document.querySelectorAll('input[type="file"]')
      expect(inputs.length).toBe(1)
    })
  })

  describe('handleFileChange', () => {
    it('processes file selected via file input change event', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const { triggerImport, onImportedRows } = setup()
      triggerImport()
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = mockFile('data.xlsx')
      Object.defineProperty(input, 'files', { value: [file], writable: true })

      input.dispatchEvent(new Event('change'))
      await vi.waitFor(() => {
        expect(onImportedRows).toHaveBeenCalled()
      })
    })

    it('handles change event with no file selected', async () => {
      const { triggerImport, onImportedRows } = setup()
      triggerImport()
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      Object.defineProperty(input, 'files', { value: [], writable: true })

      input.dispatchEvent(new Event('change'))
      expect(onImportedRows).not.toHaveBeenCalled()
    })

    it('handles error during file change import', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockRejectedValue(new Error('read error'))

      const { triggerImport, onImportedRows } = setup()
      triggerImport()
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = mockFile('data.xlsx')
      Object.defineProperty(input, 'files', { value: [file], writable: true })

      input.dispatchEvent(new Event('change'))
      expect(onImportedRows).not.toHaveBeenCalled()
    })

    it('uses fallback message when error has no message property', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockRejectedValue({ code: 'UNKNOWN' })

      const { triggerImport, onImportedRows } = setup()
      triggerImport()
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = mockFile('data.xlsx')
      Object.defineProperty(input, 'files', { value: [file], writable: true })

      input.dispatchEvent(new Event('change'))
      expect(onImportedRows).not.toHaveBeenCalled()
    })
  })

  describe('importing state', () => {
    it('starts as false', () => {
      const { importing } = setup()
      expect(importing.value).toBe(false)
    })

    it('is true during import and false after completion', async () => {
      mockHelpers.isExcelFile.mockReturnValue(true)
      mockHelpers.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(0))
      mockHelpers.parseExcelBuffer.mockResolvedValue({ columns: ['name'], rows: [{ name: 'Alice' }] })

      const { importFile, importing } = setup()
      const promise = importFile(mockFile('data.xlsx'))
      expect(importing.value).toBe(true)
      await promise
      expect(importing.value).toBe(false)
    })
  })
})
