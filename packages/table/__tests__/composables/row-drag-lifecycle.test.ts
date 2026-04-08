import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createDragContainerLifecycle } from '../../src/composables/interaction/row-drag-lifecycle'

const cleanups: (() => void)[] = []

function makeObservedLifecycle(targetClass = 'el-table__body-wrapper', dom?: { getBodySelector: () => string }) {
  const table = document.createElement('div')
  table.id = 'row-drag-lifecycle-table'
  const target = document.createElement('div')
  target.className = targetClass
  table.appendChild(target)
  document.body.appendChild(table)
  const getContainer = vi.fn(() => target.querySelector<HTMLElement>('[data-ready]'))
  const onContainerReady = vi.fn()
  const lifecycle = createDragContainerLifecycle({
    enabled: true,
    tableId: table.id,
    getContainer,
    onContainerReady,
    dom: dom as any,
  })
  cleanups.push(() => {
    lifecycle.dispose()
    table.remove()
  })
  const makeReady = () => {
    const container = document.createElement('div')
    container.dataset.ready = ''
    target.appendChild(container)
    return container
  }
  return { lifecycle, table, target, getContainer, onContainerReady, makeReady }
}

describe('row-drag-lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup())
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('delivers a ready container after nextTick', async () => {
    const el = document.createElement('div')
    const onContainerReady = vi.fn()
    const lifecycle = createDragContainerLifecycle({
      enabled: true,
      getContainer: () => el,
      onContainerReady,
    })
    lifecycle.init()
    expect(onContainerReady).not.toHaveBeenCalled()
    await nextTick()
    expect(onContainerReady).toHaveBeenCalledTimes(1)
    expect(onContainerReady).toHaveBeenCalledWith(el)
  })

  it('only resolves the latest of rapid pending inits', async () => {
    const el = document.createElement('div')
    const getContainer = vi.fn(() => el)
    const onContainerReady = vi.fn()
    const beforeInit = vi.fn()
    const lifecycle = createDragContainerLifecycle({
      enabled: true,
      getContainer,
      onContainerReady,
      beforeInit,
    })
    lifecycle.init()
    lifecycle.init()
    lifecycle.init()
    expect(beforeInit).toHaveBeenCalledTimes(3)
    expect(getContainer).not.toHaveBeenCalled()
    await nextTick()
    expect(getContainer).toHaveBeenCalledTimes(1)
    expect(onContainerReady).toHaveBeenCalledExactlyOnceWith(el)
  })

  it('stays idle when disabled', async () => {
    const getContainer = vi.fn(() => document.createElement('div'))
    const onContainerReady = vi.fn()
    const beforeInit = vi.fn()
    const lifecycle = createDragContainerLifecycle({
      enabled: false,
      getContainer,
      onContainerReady,
      beforeInit,
    })
    lifecycle.init()
    await nextTick()
    expect(beforeInit).not.toHaveBeenCalled()
    expect(getContainer).not.toHaveBeenCalled()
    expect(onContainerReady).not.toHaveBeenCalled()
  })

  it('destroy leaves a pending nextTick init intact and allows later re-init', async () => {
    const el = document.createElement('div')
    const getContainer = vi.fn(() => el)
    const onContainerReady = vi.fn()
    const lifecycle = createDragContainerLifecycle({
      enabled: true,
      getContainer,
      onContainerReady,
    })
    lifecycle.init()
    lifecycle.destroy()
    expect(getContainer).not.toHaveBeenCalled()
    await nextTick()
    expect(getContainer).toHaveBeenCalledTimes(1)
    expect(onContainerReady).toHaveBeenCalledExactlyOnceWith(el)

    lifecycle.destroy()
    lifecycle.init()
    await nextTick()
    expect(getContainer).toHaveBeenCalledTimes(2)
    expect(onContainerReady).toHaveBeenNthCalledWith(2, el)
  })

  it('dispose cancels a pending ready-container init and prevents all future resolution', async () => {
    const getContainer = vi.fn(() => document.createElement('div'))
    const onContainerReady = vi.fn()
    const lifecycle = createDragContainerLifecycle({
      enabled: true,
      getContainer,
      onContainerReady,
    })
    lifecycle.init()
    lifecycle.dispose()
    await nextTick()
    lifecycle.init()
    lifecycle.init()
    await nextTick()
    expect(getContainer).not.toHaveBeenCalled()
    expect(onContainerReady).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['el-table__body-wrapper', 'el-table-v2__body', 'fallback'])(
    'without dom falls back to the table root with subtree observation for %s',
    async (targetClass) => {
      const observe = vi.spyOn(MutationObserver.prototype, 'observe')
      const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
      const { lifecycle, table, target, getContainer, onContainerReady, makeReady } = makeObservedLifecycle(targetClass)
      lifecycle.init()
      lifecycle.init()
      lifecycle.init()
      await nextTick()
      expect(getContainer).toHaveBeenCalledTimes(1)
      // <zh/> 无 dom 时不持有 EP 类名字面量，观察目标回退到表格根 + 整树
      expect(observe).toHaveBeenCalledExactlyOnceWith(table, {
        childList: true,
        subtree: true,
      })
      expect(setTimeoutSpy).toHaveBeenCalledExactlyOnceWith(expect.any(Function), 3000)
      const timer = setTimeoutSpy.mock.results[0]!.value
      expect(vi.getTimerCount()).toBe(1)

      const container = makeReady()
      await vi.advanceTimersByTimeAsync(0)
      expect(onContainerReady).toHaveBeenCalledExactlyOnceWith(container)
      expect(disconnect).toHaveBeenCalledTimes(1)
      expect(disconnect.mock.contexts[0]).toBe(observe.mock.contexts[0])
      expect(clearTimeoutSpy).toHaveBeenCalledExactlyOnceWith(timer)
      expect(vi.getTimerCount()).toBe(0)
      const calls = getContainer.mock.calls.length
      target.appendChild(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(3000)
      expect(getContainer).toHaveBeenCalledTimes(calls)
      expect(onContainerReady).toHaveBeenCalledTimes(1)
    },
  )

  it('with dom observes the adapter body selector narrowly', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe')
    const { lifecycle, target, getContainer, onContainerReady, makeReady } = makeObservedLifecycle(
      'custom-body',
      { getBodySelector: () => '.custom-body' },
    )
    lifecycle.init()
    await nextTick()
    expect(getContainer).toHaveBeenCalledTimes(1)
    expect(observe).toHaveBeenCalledExactlyOnceWith(target, {
      childList: true,
      subtree: false,
    })
    const container = makeReady()
    await vi.advanceTimersByTimeAsync(0)
    expect(onContainerReady).toHaveBeenCalledExactlyOnceWith(container)
  })

  it.each(['destroy', 'dispose'] as const)('%s disconnects the observer and cancels its existing 3s timer', async (method) => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe')
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { lifecycle, getContainer, onContainerReady, makeReady } = makeObservedLifecycle()
    lifecycle.init()
    await nextTick()
    expect(observe).toHaveBeenCalledTimes(1)
    expect(setTimeoutSpy).toHaveBeenCalledExactlyOnceWith(expect.any(Function), 3000)
    const timer = setTimeoutSpy.mock.results[0]!.value
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(2999)
    expect(disconnect).not.toHaveBeenCalled()

    lifecycle[method]()
    lifecycle[method]()
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(disconnect.mock.contexts[0]).toBe(observe.mock.contexts[0])
    expect(clearTimeoutSpy).toHaveBeenCalledExactlyOnceWith(timer)
    expect(vi.getTimerCount()).toBe(0)
    const container = makeReady()
    await vi.advanceTimersByTimeAsync(3000)
    expect(getContainer).toHaveBeenCalledTimes(1)
    expect(onContainerReady).not.toHaveBeenCalled()

    lifecycle.init()
    await nextTick()
    if (method === 'dispose') {
      expect(getContainer).toHaveBeenCalledTimes(1)
      expect(onContainerReady).not.toHaveBeenCalled()
    }
    else {
      expect(getContainer).toHaveBeenCalledTimes(2)
      expect(onContainerReady).toHaveBeenCalledExactlyOnceWith(container)
    }
  })

  it('re-init cancels the old observer and timer before installing one replacement', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe')
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { lifecycle, getContainer, onContainerReady, makeReady } = makeObservedLifecycle()
    lifecycle.init()
    await nextTick()
    expect(setTimeoutSpy).toHaveBeenCalledExactlyOnceWith(expect.any(Function), 3000)
    const firstTimer = setTimeoutSpy.mock.results[0]!.value
    await vi.advanceTimersByTimeAsync(2000)

    lifecycle.init()
    lifecycle.init()
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(disconnect.mock.contexts[0]).toBe(observe.mock.contexts[0])
    expect(clearTimeoutSpy).toHaveBeenCalledExactlyOnceWith(firstTimer)
    expect(vi.getTimerCount()).toBe(0)
    await nextTick()
    expect(getContainer).toHaveBeenCalledTimes(2)
    expect(observe).toHaveBeenCalledTimes(2)
    expect(observe.mock.contexts[1]).not.toBe(observe.mock.contexts[0])
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2)
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 3000)
    const secondTimer = setTimeoutSpy.mock.results[1]!.value
    expect(secondTimer).not.toBe(firstTimer)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(getContainer).toHaveBeenCalledTimes(2)

    const container = makeReady()
    await vi.advanceTimersByTimeAsync(0)
    expect(onContainerReady).toHaveBeenCalledExactlyOnceWith(container)
    expect(getContainer).toHaveBeenCalledTimes(3)
    expect(disconnect).toHaveBeenCalledTimes(2)
    expect(disconnect.mock.contexts[1]).toBe(observe.mock.contexts[1])
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)
    expect(clearTimeoutSpy).toHaveBeenNthCalledWith(2, secondTimer)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(3000)
    expect(onContainerReady).toHaveBeenCalledTimes(1)
  })
})
