import { describe, expect, it, vi } from 'vitest'
import { AdvTable, registerDayjsLocaleMap } from '../../src/index'
import { advLocaleKey, useAdvLocale } from '../../src/locale/index'

import { exportExcel } from '../../src/utils/export-excel'
import { AUTO_KEY_NAME, normalizeRowKey } from '../../src/utils/normalize-row-key'

vi.mock('xlsx', () => {
  const mockWorkbook = { SheetNames: [], Sheets: {} }
  return {
    utils: {
      aoa_to_sheet: vi.fn(() => ({ '!ref': 'A1:B2' })),
      book_new: vi.fn(() => ({ ...mockWorkbook })),
      book_append_sheet: vi.fn(),
    },
    writeFile: vi.fn(),
  }
})

describe('entry exports', () => {
  it('should export advLocaleKey as Symbol', () => {
    expect(typeof advLocaleKey).toBe('symbol')
  })

  it('should export useAdvLocale', () => {
    expect(typeof useAdvLocale).toBe('function')
  })

  it('should export normalizeRowKey', () => {
    expect(typeof normalizeRowKey).toBe('function')
  })

  it('should export AUTO_KEY_NAME', () => {
    expect(AUTO_KEY_NAME).toBe('__adv_table_auto_key')
  })

  it('should normalize row keys', () => {
    const fn = normalizeRowKey('id')
    expect(fn({ id: 1 })).toBe('1')
  })

  it('should normalize row keys from function', () => {
    const fn = normalizeRowKey((row: any) => row.id)
    expect(fn({ id: 42 })).toBe('42')
  })

  it('should handle missing rowKey with auto-generate', () => {
    const fn = normalizeRowKey(undefined)
    const row = { name: 'test' }
    const key = fn(row)
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  })
})

describe('main index entry', () => {
  it('should export AdvTable component with install method', () => {
    expect(AdvTable).toBeDefined()
    expect(typeof (AdvTable as any).install).toBe('function')
    const app = { component: vi.fn() }
    ;(AdvTable as any).install(app)
    expect(app.component).toHaveBeenCalled()
  })

  it('should export registerDayjsLocaleMap', () => {
    expect(typeof registerDayjsLocaleMap).toBe('function')
  })

  it('should re-export exportExcel', async () => {
    expect(typeof exportExcel).toBe('function')
    const result = exportExcel({ data: [], columns: [], filename: 'test' })
    await expect(result).rejects.toThrow('No exportable columns')
  })
})
