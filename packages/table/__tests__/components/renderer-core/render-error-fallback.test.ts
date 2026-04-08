import { describe, expect, it, vi } from 'vitest'
import { renderErrorFallback } from '../../../src/components/renderer-core/render-error-fallback'
import { resetDevWarnCacheForTests } from '../../../src/utils/dev-warn'

describe('renderErrorFallback', () => {
  it('returns a span VNode with error class for cell scope', () => {
    const vnode = renderErrorFallback(new Error('boom'))

    expect(vnode).toBeDefined()
    expect(vnode.type).toBe('span')
    expect((vnode.props as Record<string, unknown>).class).toBe('adv-table__cell--error')
  })

  it('returns a span VNode with header class for header scope', () => {
    const vnode = renderErrorFallback(new Error('boom'), 'header')

    expect(vnode.type).toBe('span')
    expect((vnode.props as Record<string, unknown>).class).toBe('adv-table__header--error')
  })

  it('uses default scope (cell) when scope argument is omitted', () => {
    const vnode = renderErrorFallback('fail')

    expect((vnode.props as Record<string, unknown>).class).toBe('adv-table__cell--error')
  })

  it('logs via the unified dev channel (console.warn) in dev mode with scope label', () => {
    resetDevWarnCacheForTests()
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = new Error('boom')

    renderErrorFallback(err, 'header')

    expect(spy).toHaveBeenCalled()
    const message = spy.mock.calls[0][0] as string
    expect(message).toContain('Header')
    expect(message).toContain('render error')
    spy.mockRestore()
    resetDevWarnCacheForTests()
  })

  it('uses error.message for title when error is an Error instance', () => {
    const vnode = renderErrorFallback(new Error('specific message'))

    expect((vnode.props as Record<string, unknown>).title).toBe('specific message')
  })

  it('uses String(error) for title when error is not an Error instance', () => {
    const vnode = renderErrorFallback('plain string error')

    expect((vnode.props as Record<string, unknown>).title).toBe('plain string error')
  })
})
