/**
 * @file use-editor-keyboard 编辑器键盘与提交状态管理 composable 测试
 */
import { describe, expect, it, vi } from 'vitest'
import { useEditorKeyboard } from '../../src/composables/editing/use-editor-keyboard'

describe('useEditorKeyboard', () => {
  it('committed starts as false and resets on mount', () => {
    const stopEditing = vi.fn()
    const { committed } = useEditorKeyboard(stopEditing)
    expect(committed.value).toBe(false)
  })

  it('handleKeydown with Escape emits stopEditing(false, "escape")', () => {
    const stopEditing = vi.fn()
    const { handleKeydown } = useEditorKeyboard(stopEditing)
    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    const stopPropagation = vi.spyOn(event, 'stopPropagation')
    handleKeydown(event)
    expect(stopEditing).toHaveBeenCalledWith(false, 'escape')
    expect(stopPropagation).toHaveBeenCalled()
  })

  it('handleKeydown with Enter emits stopEditing(true, "enter")', () => {
    const stopEditing = vi.fn()
    const { handleKeydown } = useEditorKeyboard(stopEditing)
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    handleKeydown(event)
    expect(stopEditing).toHaveBeenCalledWith(true, 'enter')
  })

  it('handleKeydown with skipEnter does not emit on Enter', () => {
    const stopEditing = vi.fn()
    const { handleKeydown } = useEditorKeyboard(stopEditing, { skipEnter: true })
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    handleKeydown(event)
    expect(stopEditing).not.toHaveBeenCalled()
  })

  it('handleKeydown with enterCommits=false does not emit on Enter', () => {
    const stopEditing = vi.fn()
    const { handleKeydown } = useEditorKeyboard(stopEditing, { enterCommits: false })
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    handleKeydown(event)
    expect(stopEditing).not.toHaveBeenCalled()
  })

  it('handleKeydown with Tab emits stopEditing(true, "tab") and prevents default', () => {
    const stopEditing = vi.fn()
    const { handleKeydown } = useEditorKeyboard(stopEditing)
    const event = new KeyboardEvent('keydown', { key: 'Tab' })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    handleKeydown(event)
    expect(stopEditing).toHaveBeenCalledWith(true, 'tab')
    expect(preventDefault).toHaveBeenCalled()
  })

  it('handleKeydown with Shift+Tab emits stopEditing(true, "shift-tab")', () => {
    const stopEditing = vi.fn()
    const { handleKeydown } = useEditorKeyboard(stopEditing)
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true })
    handleKeydown(event)
    expect(stopEditing).toHaveBeenCalledWith(true, 'shift-tab')
  })

  it('handleKeydown with Home calls onHomeEnd and navigates when target found', () => {
    const stopEditing = vi.fn()
    const onHomeEnd = vi.fn(() => ({ rowIndex: 1, columnKey: 'name', prop: 'name' }))
    const { handleKeydown } = useEditorKeyboard(stopEditing, { onHomeEnd })
    const event = new KeyboardEvent('keydown', { key: 'Home' })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    handleKeydown(event)
    expect(onHomeEnd).toHaveBeenCalledWith('Home')
    expect(preventDefault).toHaveBeenCalled()
    expect(stopEditing).toHaveBeenCalledWith(true, 'home')
  })

  it('handleKeydown with Home does nothing when onHomeEnd returns null', () => {
    const stopEditing = vi.fn()
    const onHomeEnd = vi.fn(() => null)
    const { handleKeydown } = useEditorKeyboard(stopEditing, { onHomeEnd })
    const event = new KeyboardEvent('keydown', { key: 'Home' })
    handleKeydown(event)
    expect(stopEditing).not.toHaveBeenCalled()
  })

  it('handleKeydown with Home does nothing when onHomeEnd is not configured', () => {
    const stopEditing = vi.fn()
    const { handleKeydown } = useEditorKeyboard(stopEditing)
    const event = new KeyboardEvent('keydown', { key: 'Home' })
    handleKeydown(event)
    expect(stopEditing).not.toHaveBeenCalled()
  })

  it('handleKeydown ignores non-matching keys', () => {
    const stopEditing = vi.fn()
    const { handleKeydown } = useEditorKeyboard(stopEditing)
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
    handleKeydown(event)
    expect(stopEditing).not.toHaveBeenCalled()
  })

  it('handleBlur emits stopEditing(true) when not committed', () => {
    const stopEditing = vi.fn()
    const { handleBlur } = useEditorKeyboard(stopEditing)
    handleBlur()
    expect(stopEditing).toHaveBeenCalledWith(true)
  })

  it('handleBlur does nothing when already committed', () => {
    const stopEditing = vi.fn()
    const { handleKeydown, handleBlur } = useEditorKeyboard(stopEditing)
    // Escape marks committed first
    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    handleKeydown(event)
    stopEditing.mockClear()
    handleBlur()
    expect(stopEditing).not.toHaveBeenCalled()
  })

  it('markCommitted sets committed to true', () => {
    const stopEditing = vi.fn()
    const { committed, markCommitted } = useEditorKeyboard(stopEditing)
    expect(committed.value).toBe(false)
    markCommitted()
    expect(committed.value).toBe(true)
  })

  it('resetCommitted sets committed to false', () => {
    const stopEditing = vi.fn()
    const { committed, markCommitted, resetCommitted } = useEditorKeyboard(stopEditing)
    markCommitted()
    expect(committed.value).toBe(true)
    resetCommitted()
    expect(committed.value).toBe(false)
  })

  it('handles event without key property gracefully', () => {
    const stopEditing = vi.fn()
    const { handleKeydown } = useEditorKeyboard(stopEditing)
    handleKeydown({} as Event)
    expect(stopEditing).not.toHaveBeenCalled()
  })
})
