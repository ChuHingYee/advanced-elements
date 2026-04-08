import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exportCsv } from '../../src/utils/export-csv'
import { resolveCellText } from '../../src/utils/resolve-cell-text'

vi.mock('../../src/utils/resolve-cell-text', () => ({
  resolveCellText: vi.fn(({ cellData }) => {
    if (cellData == null || cellData === '')
      return ''
    return String(cellData)
  }),
}))

vi.mock('../../src/composables/use-dayjs-locale', () => ({
  dayjs: vi.fn(),
}))

class MockBlob {
  parts: any[]
  options: any
  constructor(parts: any[], options: any) {
    this.parts = parts
    this.options = options
  }
}

describe('exportCsv', () => {
  const mockColumns = [
    { prop: 'name', label: 'Name', hidden: false },
    { prop: 'age', label: 'Age', hidden: false },
    { prop: 'email', label: 'Email', hidden: true },
    { prop: 'hidden', hidden: false },
    { selection: true },
    { valueType: 'option' },
  ] as any

  const mockData = [
    { name: 'John, Doe', age: 30, email: 'john@test.com' },
    { name: 'Jane', age: 25, email: 'jane@test.com' },
  ]

  let link: any
  let lastBlob: MockBlob

  beforeEach(() => {
    lastBlob = undefined as any
    link = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    vi.stubGlobal('Blob', class extends MockBlob {
      constructor(parts: any[], options: any) {
        super(parts, options)
        lastBlob = new MockBlob(parts, options)
      }
    })
    vi.spyOn(document, 'createElement').mockReturnValue(link)
    vi.spyOn(document.body, 'appendChild').mockReturnValue(link)
    vi.spyOn(document.body, 'removeChild').mockReturnValue(link)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function getBlobContent(): string {
    return lastBlob?.parts?.[0] ?? ''
  }

  function getBlobOptions(): any {
    return lastBlob?.options
  }

  it('exports CSV with visible columns by default', () => {
    exportCsv({ data: mockData, columns: mockColumns })
    const content = getBlobContent()
    expect(content).toContain('Name,Age')
    expect(content).toContain('"John, Doe",30')
    expect(content).toContain('Jane,25')
    expect(content).not.toContain('Email')
    expect(link.download).toBe('export.csv')
    expect(link.click).toHaveBeenCalledOnce()
  })

  it('uses BOM by default', () => {
    exportCsv({ data: mockData, columns: mockColumns })
    const opts = getBlobOptions()
    expect(opts).toEqual({ type: 'text/csv;charset=utf-8;' })
  })

  it('exports all columns when columnMode is all', () => {
    exportCsv({ data: mockData, columns: mockColumns, columnMode: 'all' })
    const content = getBlobContent()
    expect(content).toContain('Email')
  })

  it('excludes selection and option columns', () => {
    exportCsv({ data: mockData, columns: mockColumns, columnMode: 'all' })
    const content = getBlobContent()
    expect(content).not.toContain('selection')
    expect(content).not.toContain('option')
  })

  it('uses overrideColumns when provided', () => {
    const overrideCols = [{ prop: 'name', label: 'Name', hidden: false }] as any
    exportCsv({ data: mockData, columns: mockColumns, overrideColumns: overrideCols })
    const content = getBlobContent()
    expect(content).toContain('Name')
    expect(content).not.toContain('Age')
  })

  it('exports with custom data', () => {
    const customData = [{ name: 'Override Only' }] as any
    exportCsv({ data: customData, columns: mockColumns })
    const content = getBlobContent()
    expect(content).toContain('Override Only')
    expect(content).not.toContain('John')
  })

  it('escapes CSV special characters', () => {
    exportCsv({ data: mockData, columns: mockColumns })
    const content = getBlobContent()
    expect(content).toContain('"John, Doe"')
  })

  it('uses custom filename', () => {
    exportCsv({ data: mockData, columns: mockColumns, filename: 'custom-report' })
    expect(link.download).toBe('custom-report.csv')
  })

  it('can disable BOM', () => {
    exportCsv({ data: mockData, columns: mockColumns, bom: false })
    const content = getBlobContent()
    expect(content.startsWith('\uFEFF')).toBe(false)
  })

  it('uses label over prop for column header', () => {
    const cols = [
      { prop: 'a', label: 'Label A', hidden: false },
      { prop: 'b', label: 'Label B', hidden: false },
      { prop: 'c', hidden: false },
    ] as any
    exportCsv({ data: [{ a: '1', b: '2', c: '3' }], columns: cols })
    const content = getBlobContent()
    expect(content).toContain('Label A,Label B,c')
  })

  it('escapes values with newlines and quotes', () => {
    const data = [{ name: 'he said "hello"\nworld', age: 1 }] as any
    exportCsv({ data, columns: [{ prop: 'name', label: 'Name', hidden: false }] as any })
    const content = getBlobContent()
    expect(content).toContain('"')
    expect(content).toContain('\r\n')
  })

  it('handles empty exportable columns - throws error', () => {
    expect(() =>
      exportCsv({
        data: mockData,
        columns: [{ selection: true }] as any,
      }),
    ).toThrow('[AdvTable] No exportable columns found.')
  })

  it('handles null/undefined cellData as empty string', () => {
    const data = [{ name: null }, { name: undefined }, {}] as any
    exportCsv({ data, columns: [{ prop: 'name', label: 'Name', hidden: false }] as any })
    const content = getBlobContent()
    const lines = content.split('\r\n')
    expect(lines[1]).toBe('')
    expect(lines[2]).toBe('')
    expect(lines[3]).toBe('')
  })

  it('uses resolveCellText for each cell', () => {
    vi.mocked(resolveCellText).mockClear()
    exportCsv({ data: mockData, columns: [{ prop: 'name', label: 'Name', hidden: false }] as any })
    expect(resolveCellText).toHaveBeenCalledTimes(2)
  })

  it('uses data param correctly', () => {
    const data = [{ name: 'Row1' }, { name: 'Row2' }] as any
    exportCsv({ data, columns: [{ prop: 'name', label: 'Name', hidden: false }] as any })
    const content = getBlobContent()
    expect(content).toContain('Row1')
    expect(content).toContain('Row2')
  })

  it('uses CRLF line endings', () => {
    exportCsv({ data: mockData, columns: [{ prop: 'name', label: 'Name', hidden: false }] as any })
    const content = getBlobContent()
    expect(content).toContain('\r\n')
  })

  it('routes large datasets to the chunked async path and returns a promise', async () => {
    // <zh/> jsdom 缺 requestIdleCallback → idleSchedule 回退 setTimeout(0)，用 fake timers 推进
    // <en/> jsdom lacks requestIdleCallback (idleSchedule falls back to setTimeout 0); advance with fake timers
    vi.useFakeTimers()
    try {
      const cols = [{ prop: 'name', label: 'Name', hidden: false }] as any
      // <zh/> 超过 10000 行阈值即走分片异步路径 | <en/> Above the 10,000-row threshold the chunked async path is used
      const big: any[] = Array.from({ length: 10_001 }, (_, i) => ({ name: `n${i}` }))
      const result = exportCsv({ data: big, columns: cols })

      expect(typeof (result as Promise<void>)?.then).toBe('function')
      await vi.advanceTimersByTimeAsync(50)
      await (result as Promise<void>)
      expect(link.click).toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('builds the cell matrix exactly once for both sync and chunked paths', async () => {
    const cols = [{ prop: 'name', label: 'Name', hidden: false }] as any

    vi.mocked(resolveCellText).mockClear()
    const small = [{ name: 'a' }, { name: 'b' }] as any
    exportCsv({ data: small, columns: cols })
    expect(resolveCellText).toHaveBeenCalledTimes(2)

    vi.mocked(resolveCellText).mockClear()
    const big: any[] = Array.from({ length: 10_001 }, (_, i) => ({ name: `n${i}` }))
    vi.useFakeTimers()
    try {
      const result = exportCsv({ data: big, columns: cols }) as Promise<void>
      await vi.advanceTimersByTimeAsync(50)
      await result
    }
    finally {
      vi.useRealTimers()
    }
    // <zh/> 阈值判断复用同一次组装（不重复 buildCsvParts），每格恰好解析一次
    // <en/> The threshold check reuses the same assembly (no duplicate buildCsvParts); each cell resolves exactly once
    expect(resolveCellText).toHaveBeenCalledTimes(10_001)
  })
})
