import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultNotify, resolveNotify } from '../../src/utils/notification'
import { mockElMessage } from '../setup'

/**
 * <zh/> 通知通道单测——覆盖注入优先、默认降级与异常兜底。
 * <en/> Notify channel tests — injection priority, default fallback and throw safety.
 */
describe('resolveNotify', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('prefers injected notify from global config', () => {
    const injected = vi.fn()
    expect(resolveNotify({ notify: injected })).toBe(injected)
  })

  it('falls back to default notify when unconfigured', () => {
    expect(typeof resolveNotify(undefined)).toBe('function')
    expect(typeof resolveNotify({})).toBe('function')
  })
})

describe('createDefaultNotify', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('delegates to ElMessage on success path', () => {
    mockElMessage.mockClear()
    mockElMessage.mockImplementation(() => {})
    const notify = createDefaultNotify()
    notify('success', 'ok', 'export')
    expect(mockElMessage).toHaveBeenCalledWith({ message: 'ok', type: 'success' })
  })

  it('routes error type to console.error on ElMessage throw', () => {
    mockElMessage.mockImplementationOnce(() => {
      throw new Error('ep down')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const notify = createDefaultNotify()
    notify('error', 'bad', 'export')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('bad'))
  })

  it('routes non-error type to console.warn on ElMessage throw', () => {
    mockElMessage.mockImplementationOnce(() => {
      throw new Error('ep down')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const notify = createDefaultNotify()
    notify('warning', 'unsaved', 'print')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('unsaved'))
  })
})
