import type { AdvColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'

import { exportExcel } from '../../src/utils/export-excel'

// <zh/> 共享的 xlsx mock 工厂：顶层 vi.mock 与用例内的 vi.doMock 共用，保证动态 import 永不落到真实现
// <en/> Shared xlsx mock factory for both the hoisted vi.mock and per-test vi.doMock,
// <en/> so dynamic imports never resolve the real implementation (which writes to disk)
const { createXlsxMock } = vi.hoisted(() => {
  function createXlsxMock() {
    const mockWorkbook = {
      SheetNames: [],
      Sheets: {},
    }
    return {
      utils: {
        aoa_to_sheet: vi.fn(() => ({ '!ref': 'A1:B2' })),
        book_new: vi.fn(() => ({ ...mockWorkbook })),
        book_append_sheet: vi.fn(),
      },
      writeFile: vi.fn(),
    }
  }
  return { createXlsxMock }
})

vi.mock('xlsx', createXlsxMock)

describe('export-excel', () => {
  it('exports data to an Excel file', async () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]
    const columns = [
      { prop: 'name', label: 'Name' },
      { prop: 'age', label: 'Age' },
    ]

    await expect(
      exportExcel({
        data,
        columns: columns as any,
        filename: 'test-export',
        sheetName: 'Data',
      }),
    ).resolves.toBeUndefined()
  })

  it('handles custom columnMode: all', async () => {
    const data = [{ name: 'Alice' }]
    const columns = [
      { prop: 'name', label: 'Name' },
      { prop: 'hidden_field', label: 'Hidden' },
    ]

    await expect(
      exportExcel({ data, columns: columns as any, filename: 'test', columnMode: 'all' }),
    ).resolves.toBeUndefined()
  })

  it('handles empty data', async () => {
    await expect(
      exportExcel({ data: [], columns: [{ prop: 'name', label: 'Name' }], filename: 'empty' }),
    ).resolves.toBeUndefined()
  })

  it('exports with custom data', async () => {
    const data = [{ name: 'override' }]
    const columns = [{ prop: 'name', label: 'Name' }]

    await expect(
      exportExcel({ data, columns: columns as any, filename: 'custom-data' }),
    ).resolves.toBeUndefined()
  })

  it('uses overrideColumns when provided', async () => {
    const data = [{ name: 'Alice' }]
    const columns: AdvColumn[] = []
    const overrideColumns = [{ prop: 'name', label: 'Override' }]

    await expect(
      exportExcel({ data, columns, overrideColumns, filename: 'override-cols' }),
    ).resolves.toBeUndefined()
  })

  it('passes xlsxOptions to writeFile', async () => {
    const data = [{ name: 'Alice' }]
    const columns = [{ prop: 'name', label: 'Name' }]

    await expect(
      exportExcel({ data, columns: columns as any, filename: 'opts', xlsxOptions: { bookType: 'csv' } }),
    ).resolves.toBeUndefined()
  })

  it('throws when no exportable columns', async () => {
    const data = [{ name: 'Alice' }]
    const columns: AdvColumn[] = []

    await expect(
      exportExcel({ data, columns, filename: 'no-cols' }),
    ).rejects.toThrow('No exportable columns')
  })

  it('throws when xlsx is not installed', async () => {
    // <zh/> 动态 import 失败时 ensureXlsx 应抛友好错误（替代原来无断言的 doUnmock 写法，
    // <zh/> 旧写法还会毒化后续用例的动态导入、把真文件写到包根目录）
    // <en/> A failed dynamic import must surface ensureXlsx's friendly error (replaces the old
    // <en/> assertion-free doUnmock version, which also poisoned later tests' dynamic imports
    // <en/> and wrote real files into the package root)
    vi.doMock('xlsx', () => {
      throw new Error('Cannot find module \'xlsx\'')
    })

    await expect(
      exportExcel({ data: [{ name: 'Alice' }], columns: [{ prop: 'name', label: 'Name' }] as any, filename: 'no-xlsx' }),
    ).rejects.toThrow('[AdvTable] xlsx is required')
  })

  it('filters selection columns in all mode', async () => {
    const data = [{ name: 'Alice' }]
    const columns = [
      { prop: 'name', label: 'Name' },
      { prop: 'selection', label: 'Selection', selection: true },
      { prop: 'action', label: 'Action', valueType: 'option' as const },
    ]

    // <zh/> 显式重 mock：前面的缺包用例覆盖了动态导入失败路径，此处必须回到 mock，
    // <zh/> 否则真 xlsx 会把 `filtered.xlsx` 写到包根目录
    // <en/> Re-mock explicitly: the missing-dependency test above covers the dynamic-import
    // <en/> failure path, so this test must switch back to the mock — otherwise the real xlsx
    // <en/> writes `filtered.xlsx` into the package root
    vi.doMock('xlsx', createXlsxMock)

    await expect(
      exportExcel({ data, columns: columns as any, filename: 'filtered', columnMode: 'all' }),
    ).resolves.toBeUndefined()

    const mocked = await import('xlsx')
    expect(mocked.writeFile).toHaveBeenCalledWith(expect.anything(), 'filtered.xlsx', undefined)
  })

  it('filters hidden and selection columns in visible mode', async () => {
    const data = [{ name: 'Alice' }]
    const columns = [
      { prop: 'name', label: 'Name' },
      { prop: 'hidden', label: 'Hidden', hidden: true },
      { prop: 'selection', label: 'Selection', selection: true },
    ]

    // <zh/> 同上：回到 mock，避免真 xlsx 把 `visible-filtered.xlsx` 写到包根目录
    // <en/> Same as above: switch back to the mock so the real xlsx never writes
    // <en/> `visible-filtered.xlsx` into the package root
    vi.doMock('xlsx', createXlsxMock)

    await expect(
      exportExcel({ data, columns: columns as any, filename: 'visible-filtered' }),
    ).resolves.toBeUndefined()

    const mocked = await import('xlsx')
    expect(mocked.writeFile).toHaveBeenCalledWith(expect.anything(), 'visible-filtered.xlsx', undefined)
  })
})

/**
 * <zh/> 安全与工作表选项——公式注入防御（攻击视角）与 freeze/merges 透传。
 * <en/> Security and sheet options — formula-injection defense (attacker view) and freeze/merges passthrough.
 */
describe('export-excel security', () => {
  it('reverts formula cells to plain strings', async () => {
    // <zh/> 攻击载荷：aoa_to_sheet 把 `=` 开头值解释成公式格（t === 'f'），打开即执行
    // <en/> Attack payload: aoa_to_sheet interprets `=`-leading values as formula cells (t === 'f'), executing on open
    let captured: any = null
    const base = createXlsxMock()
    vi.doMock('xlsx', () => ({
      ...base,
      utils: {
        ...base.utils,
        aoa_to_sheet: vi.fn(() => {
          captured = {
            'A2': { t: 'f', f: 'HYPERLINK("http://evil","x")', v: 'x' },
            'B2': { t: 'f', v: 'plain-without-formula' },
            '!ref': 'A1:B2',
          }
          return captured
        }),
      },
    }))

    await expect(
      exportExcel({
        data: [{ name: '=HYPERLINK("http://evil","x")' }],
        columns: [{ prop: 'name', label: 'Name' }] as any,
        filename: 'formula-attack',
      }),
    ).resolves.toBeUndefined()

    // <zh/> 有 f 取 `=` 前缀公式文本；无 f 回退到 v——两种都不再是可执行公式格
    // <en/> With f take the `=`-prefixed formula text; without f fall back to v — neither stays executable
    expect(captured.A2).toEqual({ t: 's', v: '=HYPERLINK("http://evil","x")' })
    expect(captured.B2).toEqual({ t: 's', v: 'plain-without-formula' })
    vi.doMock('xlsx', createXlsxMock)
  })

  it('passes freezePane and merges through to the worksheet', async () => {
    let captured: any = null
    const base = createXlsxMock()
    vi.doMock('xlsx', () => ({
      ...base,
      utils: {
        ...base.utils,
        encode_cell: vi.fn(({ r, c }: any) => `R${r}C${c}`),
        aoa_to_sheet: vi.fn(() => {
          captured = {}
          return captured
        }),
      },
    }))

    await expect(
      exportExcel({
        data: [{ name: 'a' }],
        columns: [{ prop: 'name', label: 'Name' }] as any,
        filename: 'frozen',
        freezePane: { xSplit: 1, ySplit: 2 },
        merges: [{ s: { r: 0, c: 0 }, e: { r: 1, c: 1 } }],
      } as any),
    ).resolves.toBeUndefined()

    expect(captured['!freeze']).toMatchObject({ xSplit: 1, ySplit: 2, topLeftCell: 'R2C1', activePane: 'bottomRight' })
    expect(captured['!pane']).toMatchObject({ state: 'frozen' })
    expect(captured['!merges']).toHaveLength(1)
    vi.doMock('xlsx', createXlsxMock)
  })
})
