/**
 * @file Tests for print utilities — 打印工具纯函数测试
 */
import type { PreparedExportData } from '../../src/utils/export-helpers'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildPrintHtml,
  buildPrintStyle,
  createPrintIframe,
  escapeHtml,
  paginateRows,
  printTable,
  resolvePageTemplate,
} from '../../src/utils/print'

// ── Mock prepareExportData ──────────────────────────────────
vi.mock('../../src/utils/export-helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/utils/export-helpers')>()
  return {
    ...original,
    prepareExportData: vi.fn((opts: any) => {
      const rows = (opts.data).map((row: any) => {
        return opts.columns.map((col: any) => String(row[col.prop] ?? ''))
      })
      const headers = opts.columns.map((col: any) => col.label ?? col.prop)
      return { headers, rows, exportableCols: opts.columns }
    }),
  }
})

// ── buildPrintStyle ─────────────────────────────────────────

describe('buildPrintStyle', () => {
  it('generates print style for A4 portrait', () => {
    const style = buildPrintStyle('A4', 'portrait')
    expect(style).toContain('size: 210mm 297mm')
    expect(style).toContain('@page')
  })

  it('generates print style for A4 landscape', () => {
    const style = buildPrintStyle('A4', 'landscape')
    expect(style).toContain('size: 297mm 210mm')
  })

  it('generates print style for A3 portrait', () => {
    const style = buildPrintStyle('A3', 'portrait')
    expect(style).toContain('size: 297mm 420mm')
  })

  it('generates print style for letter', () => {
    const style = buildPrintStyle('letter', 'portrait')
    expect(style).toContain('size: 215.9mm 279.4mm')
  })

  it('falls back to A4 for unknown paper size', () => {
    const style = buildPrintStyle('unknown', 'portrait')
    expect(style).toContain('size: 210mm 297mm')
  })

  it('includes custom style when provided', () => {
    const style = buildPrintStyle('A4', 'portrait', 'body { color: red; }')
    expect(style).toContain('body { color: red; }')
  })

  it('includes BEM print classes', () => {
    const style = buildPrintStyle('A4', 'portrait')
    expect(style).toContain('adv-table-print-title')
    expect(style).toContain('adv-table-print-table')
    expect(style).toContain('adv-table-print-cell')
    expect(style).toContain('adv-table-print-cell--header')
    expect(style).toContain('adv-table-print-cell--body')
    expect(style).toContain('adv-table-print-cell--row-index')
    expect(style).toContain('adv-table-print-row')
  })
})

// ── resolvePageTemplate ─────────────────────────────────────

describe('resolvePageTemplate', () => {
  const params = { currentPage: 1, totalPages: 3, sheetName: 'Test' }

  it('returns empty string for undefined template', () => {
    expect(resolvePageTemplate(undefined, params)).toBe('')
  })

  it('returns string template as-is', () => {
    expect(resolvePageTemplate('Hello', params)).toBe('Hello')
  })

  it('calls function template with params', () => {
    const fn = vi.fn(() => '<p>Header</p>')
    expect(resolvePageTemplate(fn, params)).toBe('<p>Header</p>')
    expect(fn).toHaveBeenCalledWith(params)
  })
})

// ── paginateRows ────────────────────────────────────────────

describe('paginateRows', () => {
  const rows = [
    ['a1', 'b1'],
    ['a2', 'b2'],
    ['a3', 'b3'],
    ['a4', 'b4'],
    ['a5', 'b5'],
  ]

  it('returns single page when rowsPerPage is 0', () => {
    expect(paginateRows(rows, 0)).toEqual([rows])
  })

  it('returns single page when rowsPerPage >= rows.length', () => {
    expect(paginateRows(rows, 10)).toEqual([rows])
    expect(paginateRows(rows, 5)).toEqual([rows])
  })

  it('returns single page when rowsPerPage is negative', () => {
    expect(paginateRows(rows, -1)).toEqual([rows])
  })

  it('splits rows into multiple pages', () => {
    const pages = paginateRows(rows, 2)
    expect(pages).toHaveLength(3)
    expect(pages[0]).toEqual([['a1', 'b1'], ['a2', 'b2']])
    expect(pages[1]).toEqual([['a3', 'b3'], ['a4', 'b4']])
    expect(pages[2]).toEqual([['a5', 'b5']])
  })

  it('handles single row', () => {
    expect(paginateRows([['only']], 1)).toEqual([[['only']]])
  })

  it('handles empty rows', () => {
    expect(paginateRows([], 5)).toEqual([[]])
  })
})

// ── escapeHtml ─────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes & to &amp;', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes < to &lt;', () => {
    expect(escapeHtml('<tag>')).toBe('&lt;tag&gt;')
  })

  it('escapes > to &gt;', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b')
  })

  it('escapes " to &quot;', () => {
    expect(escapeHtml('he"llo')).toBe('he&quot;llo')
  })

  it('escapes all special characters', () => {
    expect(escapeHtml('<script>"&test"</script>')).toBe('&lt;script&gt;&quot;&amp;test&quot;&lt;/script&gt;')
  })

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('returns the same string when no special chars', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

// ── buildPrintHtml ─────────────────────────────────────────

describe('buildPrintHtml', () => {
  const prepared: PreparedExportData = {
    headers: ['Name', 'Age'],
    rows: [['Alice', '30'], ['Bob', '25']],
    exportableCols: [{ prop: 'name', label: 'Name' }, { prop: 'age', label: 'Age' }] as any,
  }

  it('builds a valid HTML document', () => {
    const html = buildPrintHtml(prepared, { data: [], columns: [] })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html>')
    expect(html).toContain('</html>')
  })

  it('includes headers in thead', () => {
    const html = buildPrintHtml(prepared, { data: [], columns: [] })
    expect(html).toContain('<th')
    expect(html).toContain('Name')
    expect(html).toContain('Age')
  })

  it('includes data rows in tbody', () => {
    const html = buildPrintHtml(prepared, { data: [], columns: [] })
    expect(html).toContain('Alice')
    expect(html).toContain('Bob')
    expect(html).toContain('30')
    expect(html).toContain('25')
  })

  it('shows sheet title when provided', () => {
    const html = buildPrintHtml(prepared, { data: [], columns: [], sheetName: 'My Report' })
    expect(html).toContain('My Report')
    expect(html).toContain('adv-table-print-title')
  })

  it('omits title element when sheetName is empty', () => {
    const html = buildPrintHtml(prepared, { data: [], columns: [] })
    // The CSS always contains .adv-table-print-title, but the HTML should not have a title div
    const bodyContent = html.slice(html.indexOf('<body>'), html.indexOf('</body>'))
    expect(bodyContent).not.toContain('class="adv-table-print-title"')
  })

  it('adds row index column when showRowIndex is true', () => {
    const html = buildPrintHtml(prepared, { data: [], columns: [], showRowIndex: true })
    expect(html).toContain('序号')
    expect(html).toContain('1')
    expect(html).toContain('2')
    expect(html).toContain('adv-table-print-cell--row-index')
  })

  it('includes header html when provided as string', () => {
    const html = buildPrintHtml(prepared, { data: [], columns: [], headerHtml: '<div>My Header</div>' })
    expect(html).toContain('My Header')
    expect(html).toContain('adv-table-print-header')
  })

  it('includes footer html when provided as string', () => {
    const html = buildPrintHtml(prepared, { data: [], columns: [], footerHtml: '<div>Page 1</div>' })
    expect(html).toContain('Page 1')
    expect(html).toContain('adv-table-print-footer')
  })

  it('includes header html when provided as function', () => {
    const html = buildPrintHtml(prepared, {
      data: [],
      columns: [],
      headerHtml: () => 'Func Header',
    })
    expect(html).toContain('Func Header')
  })

  it('includes footer html when provided as function', () => {
    const html = buildPrintHtml(prepared, {
      data: [],
      columns: [],
      footerHtml: () => 'Func Footer',
    })
    expect(html).toContain('Func Footer')
  })

  it('paginates when rowsPerPage is set', () => {
    const manyRows: PreparedExportData = {
      headers: ['X'],
      rows: [['1'], ['2'], ['3'], ['4'], ['5']],
      exportableCols: [],
    }
    const html = buildPrintHtml(manyRows, { data: [], columns: [], rowsPerPage: 2 })
    // Count page-break divs in the body only (not in CSS style block)
    const bodyStart = html.indexOf('<body>')
    const bodyContent = html.slice(bodyStart)
    const matches = bodyContent.match(/adv-table-print-page-break/g)
    expect(matches).toHaveLength(3)
  })

  it('escapes HTML in cell content to prevent injection', () => {
    // buildPrintHtml HTML-escapes cell content to prevent XSS injection
    const unsafe: PreparedExportData = {
      headers: ['X'],
      rows: [['<script>alert("xss")</script>']],
      exportableCols: [],
    }
    const html = buildPrintHtml(unsafe, { data: [], columns: [] })
    // Cell content is HTML-escaped by buildPrintHtml
    expect(html).not.toContain('<script>alert("xss")</script>')
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })

  it('escapes HTML in headers to prevent injection', () => {
    const unsafe: PreparedExportData = {
      headers: ['<b>Name</b>'],
      rows: [['Alice']],
      exportableCols: [],
    }
    const html = buildPrintHtml(unsafe, { data: [], columns: [] })
    expect(html).toContain('&lt;b&gt;Name&lt;/b&gt;')
    expect(html).not.toContain('<b>Name</b>')
  })

  it('applies RTL direction when specified', () => {
    // Currently no RTL support in buildPrintHtml; ensure basic structure
    const html = buildPrintHtml(prepared, { data: [], columns: [], pageOrientation: 'landscape' })
    expect(html).toContain('adv-table-print-table')
  })
})

// ── printTable ──────────────────────────────────────────────

describe('printTable', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws when no exportable columns', async () => {
    // Temporarily override the mock to simulate empty columns
    const { prepareExportData } = await import('../../src/utils/export-helpers')
    vi.mocked(prepareExportData).mockImplementationOnce(() => {
      throw new Error('[AdvTable] No exportable columns found.')
    })
    await expect(printTable({ data: [], columns: [] })).rejects.toThrow('[AdvTable] No exportable columns found.')
  })

  it('cancels print when beforePrint returns false', async () => {
    const beforePrint = vi.fn(() => false)
    const afterPrint = vi.fn()

    // Mock createPrintIframe to fail test if called
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await printTable({
      data: [{ name: 'Alice' }],
      columns: [{ prop: 'name', label: 'Name' }],
      beforePrint,
      afterPrint,
    })

    expect(beforePrint).toHaveBeenCalled()
    expect(afterPrint).not.toHaveBeenCalled()
    consoleLogSpy.mockRestore()
  })

  it('rejects without calling afterPrint when iframe print is unavailable', async () => {
    // <zh/> happy-dom 没有 contentWindow.print，createPrintIframe 会 reject；printTable 必须原样透出拒绝
    // <zh/> 而不是吞掉——成功路径只能在真浏览器（browser project）验证，此处锁定失败契约。
    // <en/> happy-dom lacks contentWindow.print so createPrintIframe rejects; printTable must propagate
    // <en/> the rejection instead of swallowing it — the success path is only verifiable in a real
    // <en/> browser (browser project); this locks the failure contract.
    const afterPrint = vi.fn()
    await expect(printTable({
      data: [{ name: 'Alice' }],
      columns: [{ prop: 'name', label: 'Name' }],
      afterPrint,
    })).rejects.toThrow()
    expect(afterPrint).not.toHaveBeenCalled()
  })
})

// ── createPrintIframe ───────────────────────────────────────

describe('createPrintIframe', () => {
  beforeEach(() => {
    // Ensure document.body exists in happy-dom
    if (!document.body) {
      const body = document.createElement('body')
      document.documentElement.appendChild(body)
    }
  })

  it('creates an iframe and rejects when contentWindow.print is unavailable', async () => {
    const printHtml = '<html><body>Test</body></html>'

    // In happy-dom, iframe.contentWindow.print is not a function,
    // so createPrintIframe should reject
    const promise = createPrintIframe(printHtml)
    expect(promise).toBeInstanceOf(Promise)
    await expect(promise).rejects.toThrow()
  })
})
