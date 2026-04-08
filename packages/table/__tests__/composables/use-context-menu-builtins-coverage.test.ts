/**
 * @file use-context-menu-builtins phase2 — exhaustively test all visible() and create() functions
 * Covers: every registered builtin's visible and create functions
 */
import type { ContextMenuParams } from '../../src/types/context-menu'
import { describe, expect, it } from 'vitest'
import { getBuiltinFactory, resolveBuiltinItems } from '../../src/composables/features/use-context-menu-builtins'

const t = (path: string) => path

const bodyParams: ContextMenuParams<any> = {
  area: 'body',
  event: new MouseEvent('contextmenu'),
}

const headerParams: ContextMenuParams<any> = {
  area: 'header',
  event: new MouseEvent('contextmenu'),
}

const columnBodyParams: ContextMenuParams<any> = {
  area: 'body',
  event: new MouseEvent('contextmenu'),
  column: { prop: 'name', label: 'Name' } as any,
}

const columnHeaderParams: ContextMenuParams<any> = {
  area: 'header',
  event: new MouseEvent('contextmenu'),
  column: { prop: 'name', label: 'Name' } as any,
}

/** All registered builtin codes */
const ALL_CODES = [
  'copyCell',
  'copyCellWithHeader',
  'copyRow',
  'copyRowWithHeaders',
  'copySelectedRows',
  'copySelectedRowsWithHeaders',
  'cutCell',
  'pasteCell',
  'clearCell',
  'editCell',
  'autoSizeThisColumn',
  'autoSizeAllColumns',
  'resetColumns',
  'clearSort',
  'clearFilter',
  'clearAllFilters',
  'exportCsv',
  'exportExcel',
  'importExcel',
  'print',
  'hideThisColumn',
  'showAllColumns',
] as const

describe('use-context-menu-builtins phase2 — exhaustive visible/create coverage', () => {
  describe('all body-area codes visible/create', () => {
    const bodyCodes = [
      'copyCell',
      'copyCellWithHeader',
      'copyRow',
      'copyRowWithHeaders',
      'copySelectedRows',
      'copySelectedRowsWithHeaders',
      'cutCell',
      'pasteCell',
      'clearCell',
      'editCell',
    ]

    bodyCodes.forEach((code) => {
      it(`${code} create visible=true in body, visible=false in header`, () => {
        const factory = getBuiltinFactory(code as any)!
        expect(factory.create(t, bodyParams).visible).toBe(true)
        expect(factory.create(t, headerParams).visible).toBe(false)
      })

      it(`${code} create returns valid item`, () => {
        const factory = getBuiltinFactory(code as any)!
        const item = factory.create(t, bodyParams)
        expect(item.code).toBe(code)
        expect(item.name).toBe(`table.contextMenu.${code}`)
        expect(item.visible).toBe(true)
      })
    })
  })

  describe('clearSort visible only in header', () => {
    it('create visible=true in header, visible=false in body', () => {
      const factory = getBuiltinFactory('clearSort')!
      expect(factory.create(t, headerParams).visible).toBe(true)
      expect(factory.create(t, bodyParams).visible).toBe(false)
    })

    it('create returns visible=true in header', () => {
      const factory = getBuiltinFactory('clearSort')!
      const item = factory.create(t, headerParams)
      expect(item.code).toBe('clearSort')
      expect(item.visible).toBe(true)
    })

    it('create returns visible=false in body', () => {
      const factory = getBuiltinFactory('clearSort')!
      const item = factory.create(t, bodyParams)
      expect(item.visible).toBe(false)
    })
  })

  describe('always-visible codes', () => {
    const alwaysVisibleCodes = [
      'autoSizeAllColumns',
      'resetColumns',
      'clearAllFilters',
      'exportCsv',
      'exportExcel',
      'importExcel',
      'print',
      'showAllColumns',
    ]

    alwaysVisibleCodes.forEach((code) => {
      it(`${code} create visible in all areas`, () => {
        const factory = getBuiltinFactory(code as any)!
        expect(factory.create(t, bodyParams).visible == null).toBe(true)
        expect(factory.create(t, headerParams).visible == null).toBe(true)
      })

      it(`${code} create returns valid item`, () => {
        const factory = getBuiltinFactory(code as any)!
        const item = factory.create(t, bodyParams)
        expect(item.code).toBe(code)
      })
    })
  })

  describe('column-dependent codes', () => {
    it('autoSizeThisColumn visible depends on column in create', () => {
      const factory = getBuiltinFactory('autoSizeThisColumn')!
      expect(factory.create(t, columnBodyParams).visible).toBe(true)
      expect(factory.create(t, bodyParams).visible).toBe(false)
    })

    it('autoSizeThisColumn create visible=true with column', () => {
      const factory = getBuiltinFactory('autoSizeThisColumn')!
      const item = factory.create(t, columnBodyParams)
      expect(item.visible).toBe(true)
    })

    it('autoSizeThisColumn create visible=false without column', () => {
      const factory = getBuiltinFactory('autoSizeThisColumn')!
      const item = factory.create(t, bodyParams)
      expect(item.visible).toBe(false)
    })

    it('clearFilter visible depends on column in create', () => {
      const factory = getBuiltinFactory('clearFilter')!
      expect(factory.create(t, columnBodyParams).visible).toBe(true)
      expect(factory.create(t, bodyParams).visible).toBe(false)
    })

    it('clearFilter create visible=true with column', () => {
      const factory = getBuiltinFactory('clearFilter')!
      const item = factory.create(t, columnHeaderParams)
      expect(item.visible).toBe(true)
    })

    it('clearFilter create visible=false without column', () => {
      const factory = getBuiltinFactory('clearFilter')!
      const item = factory.create(t, bodyParams)
      expect(item.visible).toBe(false)
    })

    it('hideThisColumn visible depends on column in create', () => {
      const factory = getBuiltinFactory('hideThisColumn')!
      expect(factory.create(t, columnBodyParams).visible).toBe(true)
      expect(factory.create(t, bodyParams).visible).toBe(false)
    })

    it('hideThisColumn create visible=true with column', () => {
      const factory = getBuiltinFactory('hideThisColumn')!
      const item = factory.create(t, columnBodyParams)
      expect(item.visible).toBe(true)
    })

    it('hideThisColumn create visible=false without column', () => {
      const factory = getBuiltinFactory('hideThisColumn')!
      const item = factory.create(t, bodyParams)
      expect(item.visible).toBe(false)
    })
  })

  describe('resolveBuiltinItems with all codes', () => {
    it('resolves all codes without error', () => {
      const items = resolveBuiltinItems([...ALL_CODES] as any, t, columnBodyParams)
      expect(items.length).toBe(ALL_CODES.length)
    })

    it('resolves all codes in header context', () => {
      const items = resolveBuiltinItems([...ALL_CODES] as any, t, columnHeaderParams)
      expect(items.length).toBe(ALL_CODES.length)
    })

    it('skips all codes when all disabled', () => {
      const items = resolveBuiltinItems([...ALL_CODES] as any, t, bodyParams, [...ALL_CODES] as any)
      expect(items).toHaveLength(0)
    })
  })
})
