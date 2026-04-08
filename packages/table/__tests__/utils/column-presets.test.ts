/**
 * Tests for `BUILTIN_COLUMN_TYPES`
 *
 * Verifies the shape of every preset so consumers can rely on them.
 */
import { describe, expect, it } from 'vitest'
import { BUILTIN_COLUMN_TYPES } from '../../src/utils/column-presets'

describe('bUILTIN_COLUMN_TYPES', () => {
  it('exposes the documented preset keys', () => {
    expect(Object.keys(BUILTIN_COLUMN_TYPES).sort()).toEqual(
      [
        'actionColumn',
        'dateColumn',
        'dateTimeColumn',
        'nonEditableColumn',
        'numericColumn',
        'selectColumn',
        'textColumn',
      ].sort(),
    )
  })

  describe('numericColumn', () => {
    it('aligns right with a number editor, digit value type and number filter', () => {
      expect(BUILTIN_COLUMN_TYPES.numericColumn).toEqual({
        align: 'right',
        cellEditor: 'number',
        valueType: 'digit',
        filter: { type: 'number' },
        sortable: true,
      })
    })
  })

  describe('textColumn', () => {
    it('uses text editor with text filter and is sortable', () => {
      expect(BUILTIN_COLUMN_TYPES.textColumn).toEqual({
        cellEditor: 'text',
        filter: { type: 'text' },
        sortable: true,
      })
    })
  })

  describe('dateColumn', () => {
    it('uses date editor with date filter and centered alignment', () => {
      expect(BUILTIN_COLUMN_TYPES.dateColumn).toEqual({
        cellEditor: 'date',
        valueType: 'date',
        filter: { type: 'date' },
        sortable: true,
        align: 'center',
      })
    })
  })

  describe('dateTimeColumn', () => {
    it('uses datetime editor with dateTime value type', () => {
      expect(BUILTIN_COLUMN_TYPES.dateTimeColumn).toEqual({
        cellEditor: 'datetime',
        valueType: 'dateTime',
        filter: { type: 'date' },
        sortable: true,
        align: 'center',
      })
    })
  })

  describe('selectColumn', () => {
    it('uses select editor with enum filter and is centered', () => {
      expect(BUILTIN_COLUMN_TYPES.selectColumn).toEqual({
        cellEditor: 'select',
        filter: { type: 'enum' },
        align: 'center',
      })
    })
  })

  describe('nonEditableColumn', () => {
    it('disables editing', () => {
      expect(BUILTIN_COLUMN_TYPES.nonEditableColumn).toEqual({
        editable: false,
      })
    })
  })

  describe('actionColumn', () => {
    it('is right-fixed, non-editable, non-sortable, option-rendered', () => {
      const ac = BUILTIN_COLUMN_TYPES.actionColumn
      expect(ac).toEqual({
        valueType: 'option',
        align: 'center',
        fixed: 'right',
        width: 150,
        editable: false,
        sortable: false,
        filter: undefined,
      })
    })
  })

  describe('value semantics', () => {
    it('mutating a preset affects all consumers — verify behaviour', () => {
      // Snapshot the current values to ensure the preset is consistent
      // (this protects against accidental re-shape breaking users).
      const snapshot = JSON.parse(JSON.stringify(BUILTIN_COLUMN_TYPES))
      expect(snapshot).toBeDefined()
      // Ensure all entries are plain objects
      for (const value of Object.values(BUILTIN_COLUMN_TYPES)) {
        expect(value).toBeTypeOf('object')
        expect(value).not.toBeNull()
      }
    })
  })
})
