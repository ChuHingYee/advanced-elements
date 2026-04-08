import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { registerBuiltInEditor, registerCellEditor, resolveEditor } from '../../../src/components/cell-editors/editor-factory'

const DummyEditor = defineComponent({ name: 'DummyEditor', setup: () => () => null })

describe('editor-factory', () => {
  it('resolveEditor returns undefined for falsy input', () => {
    expect(resolveEditor(undefined)).toBeUndefined()
    expect(resolveEditor(null as any)).toBeUndefined()
  })

  it('resolveEditor returns component directly for non-string input', () => {
    expect(resolveEditor(DummyEditor)).toBe(DummyEditor)
  })

  it('resolveEditor finds built-in editor by name', () => {
    registerBuiltInEditor('dummy-builtin', DummyEditor)
    expect(resolveEditor('dummy-builtin')).toBe(DummyEditor)
  })

  it('resolveEditor finds custom editor by name', () => {
    const CustomEditor = defineComponent({ name: 'CustomEditor', setup: () => () => null })
    registerCellEditor('my-custom', CustomEditor)
    expect(resolveEditor('my-custom')).toBe(CustomEditor)
  })

  it('resolveEditor returns undefined for unknown string', () => {
    expect(resolveEditor('non-existent-editor')).toBeUndefined()
  })

  it('registerCellEditor stores editor in custom registry', () => {
    const AnotherEditor = defineComponent({ name: 'AnotherEditor', setup: () => () => null })
    registerCellEditor('another-custom', AnotherEditor)
    expect(resolveEditor('another-custom')).toBe(AnotherEditor)
  })
})
