import type { PollingOptions } from '../../../src/types/config'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import HeaderPollingBtn from '../../../src/components/header/polling-btn.vue'
import { advTableKey } from '../../../src/types/injection-keys'

vi.mock('../../../src/locale', () => ({
  useAdvLocale: () => ({
    t: (path: string) => path,
  }),
}))

function createHarness(refresh: () => Promise<unknown>, options: Partial<PollingOptions> = {}, initial = false) {
  const visible = ref(true)
  const polling = ref(initial)
  const wrapper = mount(defineComponent({
    setup: () => () => h(KeepAlive, () => visible.value
      ? h(HeaderPollingBtn, {
          'isPolling': polling.value,
          'onUpdate:isPolling': (value: boolean) => { polling.value = value },
          'options': { time: 1000, ...options },
        })
      : null),
  }), {
    global: {
      provide: {
        [advTableKey as symbol]: { refresh, loading: ref(false), columnEmptyText: '-' },
      },
    },
  })
  return { wrapper, visible, polling }
}

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('headerPollingBtn', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should reset polling state when the immediate refresh fails', async () => {
    const error = new Error('refresh failed')
    const refresh = vi.fn().mockRejectedValue(error)
    const onFail = vi.fn()
    const onChange = vi.fn()
    const { wrapper, polling } = createHarness(refresh, { immediate: true, onFail, onChange })
    await wrapper.find('.adv-table-polling-toggle').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(3000)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onFail).toHaveBeenCalledExactlyOnceWith(error)
    expect(polling.value).toBe(false)
    expect(onChange.mock.calls).toEqual([[true], [false]])
    wrapper.unmount()
  })

  it.each([true, false])('ignores late success after unmount with immediate=%s', async (immediate) => {
    const pending = deferred()
    const refresh = vi.fn(() => pending.promise)
    const onSuccess = vi.fn()
    const onFail = vi.fn()
    const onChange = vi.fn()
    const { wrapper } = createHarness(refresh, { immediate, onSuccess, onFail, onChange })
    await wrapper.find('.adv-table-polling-toggle').trigger('click')
    if (!immediate)
      await vi.advanceTimersByTimeAsync(1000)
    expect(refresh).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    pending.resolve()
    await flushPromises()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).not.toHaveBeenCalled()
    expect(onChange.mock.calls).toEqual([[true]])
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['resolve', 'reject'] as const)('isolates late %s from a stopped generation', async (outcome) => {
    const old = deferred()
    const current = deferred()
    const refresh = vi.fn().mockReturnValueOnce(old.promise).mockReturnValue(current.promise)
    const onSuccess = vi.fn()
    const onFail = vi.fn()
    const { wrapper, polling } = createHarness(refresh, { immediate: true, onSuccess, onFail })
    await wrapper.find('.adv-table-polling-toggle').trigger('click')
    await wrapper.find('.adv-table-polling-toggle').trigger('click')
    await wrapper.find('.adv-table-polling-toggle').trigger('click')
    expect(refresh).toHaveBeenCalledTimes(2)
    if (outcome === 'resolve')
      old.resolve()
    else
      old.reject(new Error('old'))
    await flushPromises()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).not.toHaveBeenCalled()
    expect(polling.value).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    current.resolve()
    await flushPromises()
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
  })

  it.each(['resolve', 'reject'] as const)('preserves activation intent without callbacks from deactivated %s', async (outcome) => {
    const old = deferred()
    const refresh = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    const onFail = vi.fn()
    const onChange = vi.fn()
    const { wrapper, visible, polling } = createHarness(refresh, { immediate: true, onSuccess, onFail, onChange })
    await wrapper.find('.adv-table-polling-toggle').trigger('click')
    visible.value = false
    await nextTick()
    if (outcome === 'resolve')
      old.resolve()
    else
      old.reject(new Error('deactivated'))
    await flushPromises()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(polling.value).toBe(true)
    visible.value = true
    await nextTick()
    expect(refresh).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls).toEqual([[true]])
    wrapper.unmount()
  })

  it('honors external model changes while inactive and does not duplicate initial immediate refresh', async () => {
    const pending = deferred()
    const refresh = vi.fn(() => pending.promise)
    const { wrapper, visible, polling } = createHarness(refresh, { immediate: true }, true)
    await nextTick()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    visible.value = false
    await nextTick()
    polling.value = false
    await nextTick()
    visible.value = true
    await nextTick()
    pending.resolve()
    await flushPromises()
    expect(vi.getTimerCount()).toBe(0)
    expect(refresh).toHaveBeenCalledTimes(1)
    polling.value = true
    await nextTick()
    await flushPromises()
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
  })
})
