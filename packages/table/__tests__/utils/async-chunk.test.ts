import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import {
  ASYNC_CHUNK_MAX_RETRIES,
  AsyncChunkLoadError,
  createChunkLoadOnError,
} from '../../src/utils/async-chunk'

/**
 * <zh/> 异步 chunk 失败处理单测——覆盖重试预算、用尽失败与兜底 UI。
 * <en/> Async-chunk tests — retry budget, final fail and fallback UI.
 */
describe('createChunkLoadOnError', () => {
  it('retries within budget', () => {
    const retry = vi.fn()
    const fail = vi.fn()
    const onError = createChunkLoadOnError('table')
    onError(new Error('x'), retry, fail, 1)
    expect(retry).toHaveBeenCalledTimes(1)
    expect(fail).not.toHaveBeenCalled()
  })

  it('retries at max boundary', () => {
    const retry = vi.fn()
    const fail = vi.fn()
    createChunkLoadOnError('table')(new Error('x'), retry, fail, ASYNC_CHUNK_MAX_RETRIES)
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('fails with console.error and onFinalFail beyond budget', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const retry = vi.fn()
    const fail = vi.fn()
    const onFinalFail = vi.fn()
    const err = new Error('cdn down')
    createChunkLoadOnError('table', onFinalFail)(err, retry, fail, ASYNC_CHUNK_MAX_RETRIES + 1)
    expect(retry).not.toHaveBeenCalled()
    expect(fail).toHaveBeenCalledTimes(1)
    expect(onFinalFail).toHaveBeenCalledWith(err)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})

describe('asyncChunkLoadError fallback', () => {
  it('renders error message with role=alert', () => {
    const vnode = (AsyncChunkLoadError as any)({ error: new Error('load fail') }, {} as any)
    expect(vnode.type).toBe('div')
    expect(vnode.props.role).toBe('alert')
    expect(String(vnode.children)).toContain('load fail')
  })

  it('renders empty string without error', () => {
    const vnode = (AsyncChunkLoadError as any)({}, {} as any)
    expect(vnode.props.role).toBe('alert')
  })

  it('exposes functional component shape', () => {
    expect(typeof AsyncChunkLoadError).toBe('function')
    expect(h).toBeDefined()
  })
})
