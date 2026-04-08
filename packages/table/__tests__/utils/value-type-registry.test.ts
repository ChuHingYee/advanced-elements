import type { AdvColumn } from '../../src/types/column'
import { describe, expect, it } from 'vitest'
import { renderValueCell } from '../../src/components/cell-renderers/value-renderer'
import { BUILTIN_VALUE_TYPES } from '../../src/types/column'
import { resolveCellText } from '../../src/utils/resolve-cell-text'
import { getCustomValueType, registerValueType, unregisterValueType } from '../../src/utils/value-type-registry'

const baseColumn: AdvColumn = { prop: 'test', label: 'Test', hidden: false }
const baseRow = { id: 1 }

describe('value-type registry', () => {
  it('every BuiltinValueType resolves to a string via resolveCellText (render/export parity guard)', () => {
    for (const valueType of Object.keys(BUILTIN_VALUE_TYPES)) {
      const column: AdvColumn = { ...baseColumn, valueType }
      const result = resolveCellText({ cellData: 'x', row: baseRow, column, index: 0 })
      expect(typeof result, `valueType "${valueType}"`).toBe('string')
    }
  })

  it('every BuiltinValueType renders via renderValueCell without throwing', () => {
    for (const valueType of Object.keys(BUILTIN_VALUE_TYPES)) {
      const column: AdvColumn = { ...baseColumn, valueType }
      const out = renderValueCell({ cellData: 'x', rowData: baseRow, column, index: 0 })
      expect(typeof out === 'string' || typeof out === 'object', `valueType "${valueType}"`).toBe(true)
    }
  })

  it('builtin value types stay exhaustive (Record keys are exhaustive by construction)', () => {
    // <zh/> 同步性由 Record<BuiltinValueType, true> 类型保证；此处仅断言数量防整批误删
    expect(Object.keys(BUILTIN_VALUE_TYPES)).toHaveLength(31)
  })

  it('registerValueType plugs into both render and text pipelines', () => {
    registerValueType('my-badge', { toText: v => `badge:${String(v)}` })
    try {
      const column: AdvColumn = { ...baseColumn, valueType: 'my-badge' }
      expect(resolveCellText({ cellData: 'a', row: baseRow, column, index: 0 })).toBe('badge:a')
      expect(renderValueCell({ cellData: 'a', rowData: baseRow, column, index: 0 })).toBe('badge:a')
    }
    finally {
      unregisterValueType('my-badge')
    }
    expect(getCustomValueType('my-badge')).toBeUndefined()
  })

  it('registerValueType with a component renders the component', () => {
    const MyComp = { name: 'MyComp', setup: () => () => 'hi' }
    registerValueType('my-comp-type', { component: MyComp as never })
    try {
      const column: AdvColumn = { ...baseColumn, valueType: 'my-comp-type' }
      const out = renderValueCell({ cellData: 'a', rowData: baseRow, column, index: 0 })
      expect(out).toMatchObject({ type: MyComp })
    }
    finally {
      unregisterValueType('my-comp-type')
    }
  })

  it('registerValueType refuses to override a built-in name', () => {
    registerValueType('text', { toText: () => 'hacked' })
    expect(getCustomValueType('text')).toBeUndefined()
    const column: AdvColumn = { ...baseColumn, valueType: 'text' }
    expect(resolveCellText({ cellData: 'a', row: baseRow, column, index: 0 })).toBe('a')
  })

  it('unregisterValueType is idempotent', () => {
    expect(() => unregisterValueType('')).not.toThrow()
    expect(() => unregisterValueType('never-registered')).not.toThrow()
  })
})
