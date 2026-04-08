/**
 * Tests for `use-context-menu-builtins` — built-in menu item registry.
 *
 * Verifies that every built-in code is registered, has the correct shape,
 * and that disabled codes are skipped when resolving items.
 */
import type { BuiltinMenuCode, ContextMenuItem, ContextMenuItemOrSeparator } from '../../src/types/context-menu'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBuiltinFactory,
  isBuiltinCode,
  resolveBuiltinItems,
} from '../../src/composables/features/use-context-menu-builtins'

/** 类型窄化：resolveBuiltinItems 仅返回 ContextMenuItem，不会包含 separator */
function asItem(item: ContextMenuItemOrSeparator): ContextMenuItem {
  return item as ContextMenuItem
}

const t = (path: string) => path
const params = {
  area: 'body' as const,
  event: new MouseEvent('contextmenu'),
}

describe('use-context-menu-builtins', () => {
  describe('isBuiltinCode', () => {
    it('returns true for known built-in codes', () => {
      expect(isBuiltinCode('copyCell')).toBe(true)
      expect(isBuiltinCode('copyRow')).toBe(true)
      expect(isBuiltinCode('editCell')).toBe(true)
      expect(isBuiltinCode('exportCsv')).toBe(true)
      expect(isBuiltinCode('exportExcel')).toBe(true)
      expect(isBuiltinCode('clearSort')).toBe(true)
    })

    it('returns false for unknown codes', () => {
      expect(isBuiltinCode('myCustomAction')).toBe(false)
      expect(isBuiltinCode('')).toBe(false)
      expect(isBuiltinCode('separator')).toBe(false)
    })
  })

  describe('getBuiltinFactory', () => {
    it('returns a factory for known codes', () => {
      const factory = getBuiltinFactory('copyCell')
      expect(factory).toBeDefined()
      expect(factory!.code).toBe('copyCell')
      expect(factory!.create).toBeTypeOf('function')
    })

    it('returns undefined for unknown codes', () => {
      expect(getBuiltinFactory('unknownCode' as any)).toBeUndefined()
    })
  })

  describe('resolveBuiltinItems', () => {
    it('returns translated items for a list of codes', () => {
      const items = resolveBuiltinItems(['copyCell', 'copyRow'], t, params)
      expect(items).toHaveLength(2)
      expect(items[0]!.code).toBe('copyCell')
      expect(asItem(items[0]!).name).toBe('table.contextMenu.copyCell')
      expect(items[1]!.code).toBe('copyRow')
      expect(asItem(items[1]!).name).toBe('table.contextMenu.copyRow')
    })

    it('skips codes in the disabled list', () => {
      const items = resolveBuiltinItems(['copyCell', 'copyRow', 'editCell'], t, params, ['copyRow'])
      expect(items.map(i => i.code)).toEqual(['copyCell', 'editCell'])
    })

    it('skips unknown codes silently', () => {
      const items = resolveBuiltinItems(['copyCell', 'unknown' as any], t, params)
      expect(items).toHaveLength(1)
      expect(items[0].code).toBe('copyCell')
    })

    it('returns an empty array for empty input', () => {
      expect(resolveBuiltinItems([], t, params)).toEqual([])
    })

    it('copyCell and cutCell include keyboard suffix when present', () => {
      const copy = asItem(resolveBuiltinItems(['copyCell'], t, params)[0]!)
      expect(copy.suffix).toEqual({ content: 'Ctrl+C' })

      const cut = asItem(resolveBuiltinItems(['cutCell'], t, params)[0]!)
      expect(cut.suffix).toEqual({ content: 'Ctrl+X' })

      const paste = asItem(resolveBuiltinItems(['pasteCell'], t, params)[0]!)
      expect(paste.suffix).toEqual({ content: 'Ctrl+V' })
    })

    it('created item `visible` values are computed per area at create time', () => {
      const copyBody = asItem(resolveBuiltinItems(['copyCell'], t, { ...params, area: 'body' })[0]!)
      const copyHeader = asItem(resolveBuiltinItems(['copyCell'], t, { ...params, area: 'header' })[0]!)
      expect(copyBody.visible).toBe(true)
      expect(copyHeader.visible).toBe(false)
    })

    it('clearSort visible only in header area', () => {
      const header = asItem(resolveBuiltinItems(['clearSort'], t, { ...params, area: 'header' })[0]!)
      const body = asItem(resolveBuiltinItems(['clearSort'], t, { ...params, area: 'body' })[0]!)
      expect(header.visible).toBe(true)
      expect(body.visible).toBe(false)
    })

    it('exportCsv / exportExcel / resetColumns are always visible', () => {
      const exportCsv = asItem(resolveBuiltinItems(['exportCsv'], t, params)[0]!)
      const exportExcel = asItem(resolveBuiltinItems(['exportExcel'], t, params)[0]!)
      const reset = asItem(resolveBuiltinItems(['resetColumns'], t, params)[0]!)
      expect(exportCsv.visible == null).toBe(true)
      expect(exportExcel.visible == null).toBe(true)
      expect(reset.visible == null).toBe(true)
    })
  })

  describe('integration with t function', () => {
    it('uses the translator for every name field', () => {
      const tSpy = vi.fn((path: string) => `tr(${path})`)
      const items = resolveBuiltinItems(['copyCell', 'editCell', 'deleteRow'], tSpy, params)
      for (const item of items) {
        expect(tSpy).toHaveBeenCalled()
        expect(asItem(item).name).toMatch(/^tr\(table\.contextMenu\./)
      }
    })
  })

  describe('cleanup', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('factory.create is consistent across calls (no side effects)', () => {
      const f = getBuiltinFactory('copyCell')!
      const a = f.create(t, params)
      const b = f.create(t, params)
      expect(a).toEqual(b)
      expect(a).not.toBe(b)
    })
  })

  describe('all built-in menu items visibility', () => {
    const headerParams = { ...params, area: 'header' as const }
    const bodyParams = { ...params, area: 'body' as const }
    const columnParams = { ...params, area: 'body' as const, column: { prop: 'name', label: 'Name' } }

    it('copyCellWithHeader has keyboard suffix', () => {
      const item = asItem(resolveBuiltinItems(['copyCellWithHeader'], t, params)[0]!)
      expect(item.code).toBe('copyCellWithHeader')
      expect(item.name).toBe('table.contextMenu.copyCellWithHeader')
    })

    it('copySelectedRows / copySelectedRowsWithHeaders are found', () => {
      const items = resolveBuiltinItems(['copySelectedRows', 'copySelectedRowsWithHeaders'], t, params)
      expect(items).toHaveLength(2)
      expect(items[0].code).toBe('copySelectedRows')
      expect(items[1].code).toBe('copySelectedRowsWithHeaders')
    })

    it('pasteCell is disabled', () => {
      const item = asItem(resolveBuiltinItems(['pasteCell'], t, params)[0]!)
      expect(item.disabled).toBe(true)
    })

    it('clearCell resolves correctly', () => {
      const item = asItem(resolveBuiltinItems(['clearCell'], t, params)[0]!)
      expect(item.code).toBe('clearCell')
      expect(item.name).toBe('table.contextMenu.clearCell')
    })

    it('autoSizeThisColumn is visible when column is present', () => {
      const factory = getBuiltinFactory('autoSizeThisColumn')!
      // create should produce valid item
      const item = factory.create(t, { ...params, column: { prop: 'x' } })
      expect(item.code).toBe('autoSizeThisColumn')
      expect(item.visible).toBe(true)
    })

    it('autoSizeThisColumn is hidden when column is absent', () => {
      const factory = getBuiltinFactory('autoSizeThisColumn')!
      const item = factory.create(t, params)
      expect(item.visible).toBe(false)
    })

    it('autoSizeAllColumns and resetColumns resolve', () => {
      const items = resolveBuiltinItems(['autoSizeAllColumns', 'resetColumns'], t, params)
      expect(items).toHaveLength(2)
      expect(items[0].code).toBe('autoSizeAllColumns')
      expect(items[1].code).toBe('resetColumns')
    })

    it('clearSort is visible only in header', () => {
      const headerItem = asItem(resolveBuiltinItems(['clearSort'], t, headerParams)[0]!)
      const bodyItem = asItem(resolveBuiltinItems(['clearSort'], t, bodyParams)[0]!)
      expect(bodyItem.visible).toBe(false)
      expect(headerItem.visible).toBe(true)
    })

    it('clearFilter is visible when column is present', () => {
      const factory = getBuiltinFactory('clearFilter')!
      const itemWithCol = factory.create(t, columnParams)
      expect(itemWithCol.visible).toBe(true)
      const itemWithoutCol = factory.create(t, bodyParams)
      expect(itemWithoutCol.visible).toBe(false)
    })

    it('clearAllFilters resolves', () => {
      const item = asItem(resolveBuiltinItems(['clearAllFilters'], t, params)[0]!)
      expect(item.code).toBe('clearAllFilters')
    })

    it('importExcel and print resolve', () => {
      const items = resolveBuiltinItems(['importExcel', 'print'], t, params)
      expect(items).toHaveLength(2)
      expect(items[0].code).toBe('importExcel')
      expect(items[1].code).toBe('print')
    })

    it('hideThisColumn is visible when column is present', () => {
      const factory = getBuiltinFactory('hideThisColumn')!
      const itemWithCol = factory.create(t, columnParams)
      expect(itemWithCol.visible).toBe(true)
      const itemWithoutCol = factory.create(t, bodyParams)
      expect(itemWithoutCol.visible).toBe(false)
    })

    it('showAllColumns resolves', () => {
      const item = asItem(resolveBuiltinItems(['showAllColumns'], t, params)[0]!)
      expect(item.code).toBe('showAllColumns')
    })

    it('disabled list does not mutate the original codes array', () => {
      const codes: BuiltinMenuCode[] = ['copyCell', 'copyRow', 'editCell']
      const originalCodes = [...codes]
      resolveBuiltinItems(codes, t, params, ['copyRow'])
      expect(codes).toEqual(originalCodes)
    })
  })
})
