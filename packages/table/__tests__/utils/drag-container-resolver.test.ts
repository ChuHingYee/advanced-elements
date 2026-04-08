/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveDragContainer } from '../../src/utils/drag-container-resolver'

/**
 * <zh/> 拖拽容器解析单测——覆盖立即就绪、observer 回调与清理。
 * <en/> Drag-container resolver tests — immediate ready, observer callback and cleanup.
 */
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('resolveDragContainer', () => {
  it('calls onReady immediately when container exists', () => {
    const el = document.createElement('div')
    const onReady = vi.fn()
    const cleanup = resolveDragContainer({ getContainer: () => el, onReady })
    expect(onReady).toHaveBeenCalledWith(el)
    cleanup()
  })

  it('observes table subtree and fires when container appears', () => {
    const table = document.createElement('div')
    table.id = 't1'
    document.body.appendChild(table)
    let current: HTMLElement | null = null
    const onReady = vi.fn()
    const cleanup = resolveDragContainer({
      getContainer: () => current,
      tableId: 't1',
      onReady,
    })
    expect(onReady).not.toHaveBeenCalled()
    current = document.createElement('div')
    table.appendChild(current)
    vi.advanceTimersByTime(0)
    // <zh/> MutationObserver 回调为微任务，等待 flush | <en/> observer callback is a microtask, wait for flush
    return Promise.resolve().then(() => {
      expect(onReady).toHaveBeenCalledWith(current)
      cleanup()
    })
  })

  it('warns in dev when table element is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cleanup = resolveDragContainer({
      getContainer: () => null,
      tableId: 'missing-table',
      onReady: vi.fn(),
      isDev: true,
      devWarnPrefix: 'testDrag',
    })
    expect(warn).toHaveBeenCalled()
    cleanup()
  })

  it('cleanup stops pending retry without onReady', () => {
    const table = document.createElement('div')
    table.id = 't2'
    document.body.appendChild(table)
    const onReady = vi.fn()
    const cleanup = resolveDragContainer({
      getContainer: () => null,
      tableId: 't2',
      onReady,
      maxRetries: 0,
    })
    cleanup()
    vi.advanceTimersByTime(10000)
    expect(onReady).not.toHaveBeenCalled()
  })

  it('observes direct children when ancestor selector matches', () => {
    const table = document.createElement('div')
    table.id = 't3'
    table.innerHTML = '<div class="wrap"></div>'
    document.body.appendChild(table)
    let current: HTMLElement | null = null
    const onReady = vi.fn()
    const cleanup = resolveDragContainer({
      getContainer: () => current,
      tableId: 't3',
      observeTargetSelector: '.wrap',
      onReady,
    })
    current = document.createElement('div')
    table.querySelector('.wrap')!.appendChild(current)
    return Promise.resolve().then(() => {
      expect(onReady).toHaveBeenCalledWith(current)
      cleanup()
    })
  })
})
