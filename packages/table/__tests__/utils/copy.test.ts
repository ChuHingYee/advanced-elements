/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '../../src/utils/copy'

describe('copyToClipboard', () => {
  let originalClipboard: Clipboard | undefined
  let originalExecCommand: typeof document.execCommand | undefined

  beforeEach(() => {
    originalClipboard = navigator.clipboard
    originalExecCommand = document.execCommand
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(document, 'execCommand', {
      value: originalExecCommand,
      configurable: true,
      writable: true,
    })
    vi.restoreAllMocks()
  })

  function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })
  }

  function removeClipboard() {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })
  }

  function mockExecCommand(impl: (...args: any[]) => boolean) {
    Object.defineProperty(document, 'execCommand', {
      value: impl,
      configurable: true,
      writable: true,
    })
  }

  it('should copy text using Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    mockClipboard(writeText)

    const result = await copyToClipboard('hello')
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(result).toBe(true)
  })

  it('should fallback to execCommand when Clipboard API is not available', async () => {
    removeClipboard()
    const execCommandSpy = vi.fn().mockReturnValue(true)
    mockExecCommand(execCommandSpy)

    const result = await copyToClipboard('hello')
    expect(execCommandSpy).toHaveBeenCalledWith('copy')
    expect(result).toBe(true)
  })

  it('should fallback to execCommand when Clipboard API throws', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    mockClipboard(writeText)
    const execCommandSpy = vi.fn().mockReturnValue(true)
    mockExecCommand(execCommandSpy)

    const result = await copyToClipboard('hello')
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(execCommandSpy).toHaveBeenCalledWith('copy')
    expect(result).toBe(true)
  })

  it('should return false when both Clipboard API and execCommand fail', async () => {
    removeClipboard()
    mockExecCommand(() => false)

    const result = await copyToClipboard('hello')
    expect(result).toBe(false)
  })

  it('should return false when execCommand throws', async () => {
    removeClipboard()
    mockExecCommand(() => {
      throw new Error('not allowed')
    })

    const result = await copyToClipboard('hello')
    expect(result).toBe(false)
  })

  it('should create and remove a textarea element in fallback', async () => {
    removeClipboard()
    mockExecCommand(() => true)

    const appendChildSpy = vi.spyOn(document.body, 'appendChild')
    const removeChildSpy = vi.spyOn(document.body, 'removeChild')

    await copyToClipboard('test-text')

    expect(appendChildSpy).toHaveBeenCalled()
    const textarea = appendChildSpy.mock.calls[0][0] as HTMLTextAreaElement
    expect(textarea.value).toBe('test-text')
    expect(textarea.style.position).toBe('fixed')
    expect(textarea.style.left).toBe('-9999px')
    expect(textarea.style.opacity).toBe('0')
    expect(removeChildSpy).toHaveBeenCalledWith(textarea)
  })

  it('should handle empty string', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    mockClipboard(writeText)

    const result = await copyToClipboard('')
    expect(writeText).toHaveBeenCalledWith('')
    expect(result).toBe(true)
  })
})
