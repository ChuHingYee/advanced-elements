import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { createScopedEditorRegistry, registerCellEditor, resolveEditor, unregisterCellEditor } from '../../src/components/cell-editors/editor-factory'

const CompA = defineComponent({ name: 'CompA', setup: () => () => null })
const CompB = defineComponent({ name: 'CompB', setup: () => () => null })

describe('scoped editor registry', () => {
  it('two registries are isolated from each other and from globals', () => {
    const a = createScopedEditorRegistry()
    const b = createScopedEditorRegistry()
    a.register('my-editor', CompA)
    expect(a.has('my-editor')).toBe(true)
    expect(b.has('my-editor')).toBe(false)
    expect(resolveEditor('my-editor', b.asOverrides())).toBeUndefined()
    expect(resolveEditor('my-editor', a.asOverrides())).toBe(CompA)
    // globals untouched
    expect(resolveEditor('my-editor', undefined)).toBeUndefined()
  })

  it('scoped overrides outrank globals (per-table priority)', () => {
    registerCellEditor('shared-name', CompB)
    const scoped = createScopedEditorRegistry()
    scoped.register('shared-name', CompA)
    try {
      expect(resolveEditor('shared-name', scoped.asOverrides())).toBe(CompA)
      expect(resolveEditor('shared-name', undefined)).toBe(CompB)
    }
    finally {
      unregisterCellEditor('shared-name')
    }
  })

  it('unregister is idempotent and registry dies with its holder', () => {
    const scoped = createScopedEditorRegistry()
    scoped.register('temp', CompA)
    scoped.unregister('temp')
    expect(scoped.has('temp')).toBe(false)
    expect(() => scoped.unregister('')).not.toThrow()
    expect(() => scoped.unregister('never')).not.toThrow()
    expect(resolveEditor('temp', scoped.asOverrides())).toBeUndefined()
  })
})
