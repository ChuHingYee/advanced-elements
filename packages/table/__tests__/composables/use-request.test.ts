import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, KeepAlive, nextTick, ref } from 'vue'
import { useRequest } from '../../src/composables/data/use-request'
import { resetDevWarnCacheForTests } from '../../src/utils/dev-warn'

describe('useRequest', () => {
  afterEach(() => vi.useRealTimers())

  it.each(['resolve', 'reject'] as const)('invalidates scope-owned requests on disposal before late %s', async (outcome) => {
    vi.useFakeTimers()
    let resolve!: (value: unknown) => void
    let reject!: (error: Error) => void
    const dataSource = vi.fn(() => new Promise((res, rej) => {
      resolve = res
      reject = rej
    }))
    const onError = vi.fn()
    const transformResponse = vi.fn(() => [{ id: 1 }])
    const scope = effectScope()
    const api = scope.run(() => useRequest({ dataSource, onError, transformResponse, timeout: 1000 }))!
    const pending = api.request(1, 10)
    const signal = api.getSignal()!
    scope.stop()
    expect(signal.aborted).toBe(true)
    expect(api.loading.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    if (outcome === 'resolve')
      resolve({ data: [{ id: 1 }], total: 1 })
    else
      reject(new Error('late'))
    expect(await pending).toBeNull()
    expect(api.data.value).toEqual([])
    expect(api.total.value).toBe(0)
    expect(onError).not.toHaveBeenCalled()
    expect(transformResponse).not.toHaveBeenCalled()
    expect(await api.refresh(1, 10)).toBeNull()
    expect(dataSource).toHaveBeenCalledTimes(1)
  })

  it('pauses while deactivated, resumes on activation, and finally disposes on unmount', async () => {
    let resolve!: (value: unknown) => void
    const dataSource = vi.fn()
      .mockImplementationOnce(() => new Promise(res => (resolve = res)))
      .mockResolvedValue({ data: [{ id: 2 }], total: 2 })
    let api!: ReturnType<typeof useRequest>
    const visible = ref(true)
    const child = defineComponent({
      setup() {
        api = useRequest({ dataSource })
        return () => h('div')
      },
    })
    const wrapper = mount(defineComponent({
      setup: () => () => h(KeepAlive, () => visible.value ? h(child) : null),
    }))
    const pending = api.request(1, 10)
    visible.value = false
    await nextTick()
    resolve({ data: [{ id: 1 }], total: 1 })
    expect(await pending).toBeNull()
    expect(api.loading.value).toBe(false)
    expect(await api.request(1, 10)).toBeNull()
    visible.value = true
    await nextTick()
    expect(await api.request(1, 10)).toEqual([{ id: 2 }])
    wrapper.unmount()
    expect(await api.request(1, 10)).toBeNull()
    expect(dataSource).toHaveBeenCalledTimes(2)
  })

  it('cancels retry waits on scope disposal', async () => {
    vi.useFakeTimers()
    const dataSource = vi.fn().mockRejectedValue(new Error('retry'))
    const onError = vi.fn()
    const scope = effectScope()
    const api = scope.run(() => useRequest({ dataSource, onError, retries: 2, retryDelay: 100 }))!
    const pending = api.request(1, 10)
    await flushPromises()
    expect(vi.getTimerCount()).toBe(1)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(await pending).toBeNull()
    expect(onError).not.toHaveBeenCalled()
    expect(dataSource).toHaveBeenCalledTimes(1)
  })

  it('retains the final retry error and can retry successfully', async () => {
    vi.useFakeTimers()
    const error = new Error('retry exhausted')
    const dataSource = vi.fn().mockRejectedValue(error)
    const onError = vi.fn()
    const api = useRequest({ dataSource, onError, retries: 2, retryDelay: 10 })
    const pending = expect(api.request(1, 10)).rejects.toBe(error)
    await vi.runAllTimersAsync()
    await pending
    expect(dataSource).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    expect(api.loading.value).toBe(false)
    dataSource.mockResolvedValueOnce({ data: [{ id: 3 }], total: 1 })
    expect(await api.request(1, 10)).toEqual([{ id: 3 }])
  })

  it('returns default state', () => {
    const result = useRequest({})
    expect(result.data.value).toEqual([])
    expect(result.loading.value).toBe(false)
    expect(result.total.value).toBe(0)
    expect(result.hasSource.value).toBe(false)
  })

  it('hasSource is true when dataSource is provided', () => {
    const result = useRequest({ dataSource: vi.fn().mockResolvedValue({ data: [], total: 0 }) })
    expect(result.hasSource.value).toBe(true)
  })

  it('request returns empty array when no dataSource', async () => {
    const result = useRequest({})
    const d = await result.request(1, 10)
    expect(d).toEqual([])
  })

  it('request fetches paginated data', async () => {
    const dataSource = vi.fn().mockResolvedValue({ data: [{ id: 1 }], total: 1 })
    const result = useRequest({ dataSource })
    const d = await result.request(1, 10)
    expect(d).toEqual([{ id: 1 }])
    expect(result.total.value).toBe(1)
    expect(result.data.value).toEqual([{ id: 1 }])
  })

  it('request appends data when append is true', async () => {
    const dataSource = vi.fn().mockResolvedValue({ data: [{ id: 2 }], total: 2 })
    const result = useRequest({ dataSource })
    result.data.value = [{ id: 1 }] as any
    const d = await result.request(1, 10, true)
    expect(d).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('transformResponse that returns array is handled', async () => {
    const dataSource = vi.fn().mockResolvedValue([{ id: 1 }])
    const result = useRequest({ dataSource, transformResponse: res => res as any })
    const d = await result.request(1, 10)
    expect(d).toEqual([{ id: 1 }])
  })

  it('request uses transformRequest', async () => {
    const dataSource = vi.fn().mockResolvedValue({ data: [], total: 0 })
    const transformRequest = vi.fn().mockReturnValue({ custom: 'param' })
    const result = useRequest({ dataSource, transformRequest })
    await result.request(1, 10)
    expect(transformRequest).toHaveBeenCalledWith(1, 10, {})
  })

  it('request uses transformResponse', async () => {
    const dataSource = vi.fn().mockResolvedValue({ data: [{ id: 1 }], total: 1 })
    const transformResponse = vi.fn().mockReturnValue({ data: [{ id: 2 }], total: 1 })
    const result = useRequest({ dataSource, transformResponse })
    const d = await result.request(1, 10)
    expect(d).toEqual([{ id: 2 }])
  })

  it('request uses simple mode params', async () => {
    const dataSource = vi.fn().mockResolvedValue({ data: [{ id: 1 }], total: 1 })
    const result = useRequest({ dataSource, requestMode: 'simple' })
    await result.request(1, 10, false, { foo: 'bar' })
    expect(dataSource).toHaveBeenCalledWith({ foo: 'bar' }, expect.any(AbortSignal))
  })

  it('setLoading updates loading state', () => {
    const result = useRequest({})
    result.setLoading(true)
    expect(result.loading.value).toBe(true)
    result.setLoading(false)
    expect(result.loading.value).toBe(false)
  })

  it('setData replaces data and increments request ID', () => {
    const result = useRequest({})
    result.setData([{ id: 1 }])
    expect(result.data.value).toEqual([{ id: 1 }])
  })

  it('refresh returns empty when hasSource is false', async () => {
    const result = useRequest({})
    const d = await result.refresh(1, 10)
    expect(d).toEqual([])
  })

  it('refresh calls request when hasSource is true', async () => {
    const dataSource = vi.fn().mockResolvedValue({ data: [{ id: 1 }], total: 1 })
    const result = useRequest({ dataSource })
    const d = await result.refresh(1, 10)
    expect(d).toEqual([{ id: 1 }])
  })

  it('clearData resets data and total', () => {
    const result = useRequest({})
    result.total.value = 100
    result.data.value = [{ id: 1 }] as any
    result.clearData()
    expect(result.data.value).toEqual([])
    expect(result.total.value).toBe(0)
  })

  it('handles abort error gracefully', async () => {
    const dataSource = vi.fn().mockResolvedValue({ data: [{ id: 1 }], total: 1 })
    const result = useRequest({ dataSource })
    // Cancel first request by making a second one rapidly
    const p1 = result.request(1, 10)
    const p2 = result.request(1, 10)
    const [_d1, d2] = await Promise.all([p1, p2])
    expect(d2).toEqual([{ id: 1 }])
  })

  it('handles synchronous data source', async () => {
    const dataSource = vi.fn().mockReturnValue({ data: [{ id: 1 }], total: 1 })
    const result = useRequest({ dataSource })
    const d = await result.request(1, 10)
    expect(d).toEqual([{ id: 1 }])
  })

  it('handles error with onError callback', async () => {
    const onError = vi.fn()
    const dataSource = vi.fn().mockRejectedValue(new Error('test error'))
    const result = useRequest({ dataSource, onError })
    await expect(result.request(1, 10)).rejects.toThrow('test error')
    expect(onError).toHaveBeenCalled()
  })

  it('cancels outdated request when newer request is issued', async () => {
    let resolveSlow: (v: any) => void
    const slow = new Promise<any>((resolve) => {
      resolveSlow = resolve
    })
    const dataSource = vi.fn()
    dataSource.mockReturnValueOnce(slow)
    dataSource.mockReturnValueOnce(Promise.resolve({ data: [{ id: 2 }], total: 1 }))
    const result = useRequest({ dataSource })
    const p1 = result.request(1, 10)
    const p2 = result.request(1, 10)
    // Resolve the slow promise immediately so p1 can complete
    resolveSlow!({ data: [{ id: 1 }], total: 1 })
    const [_d1, d2] = await Promise.all([p1, p2])
    expect(d2).toEqual([{ id: 2 }])
  })

  it('cancelled request resolves with null sentinel and keeps latest data', async () => {
    let resolve1: any
    const p1 = new Promise<any>((resolve) => {
      resolve1 = resolve
    })
    const dataSource = vi.fn()
      .mockReturnValueOnce(p1)
      .mockReturnValueOnce(Promise.resolve({ data: [{ id: 2 }], total: 1 }))
    const result = useRequest({ dataSource })
    const r1 = result.request(1, 10)
    const r2 = result.request(1, 10)
    await r2
    resolve1!({ data: [{ id: 1 }], total: 1 })
    // <zh/> 被取消的旧请求以 null 哨兵结算（类型收窄：T[] | null），且不覆盖新请求写入的 data | <en/> Superseded request settles with the null sentinel (narrowed type: T[] | null) and never clobbers newer data
    const d1 = await r1
    expect(d1).toBeNull()
    expect(result.data.value).toEqual([{ id: 2 }])
  })

  it('resolves an empty page as a successful [] (distinguishable from cancellation)', async () => {
    const dataSource = vi.fn().mockResolvedValue({ data: [], total: 0 })
    const result = useRequest({ dataSource })
    const d = await result.request(1, 10)
    // <zh/> 空页是合法成功结果（[]），与"取消"（null）在语义上可区分 | <en/> An empty page is a legitimate success ([]), semantically distinct from cancellation (null)
    expect(d).toEqual([])
    expect(d).not.toBeNull()
    expect(result.total.value).toBe(0)
  })

  it('active request aborted via setData resolves null without clobbering external data', async () => {
    let resolve1!: (v: any) => void
    const p1 = new Promise<any>(resolve => (resolve1 = resolve))
    const dataSource = vi.fn().mockReturnValueOnce(p1)
    const result = useRequest({ dataSource })
    const pending = result.request(1, 10)
    result.setData([{ id: 9 }] as any)
    resolve1!({ data: [{ id: 1 }], total: 1 })
    const d = await pending
    // <zh/> setData 递增 requestId 并 abort——被取代路径返回 null，外部写入的数据不被覆盖 | <en/> setData bumps requestId and aborts — the superseded path resolves null and external data survives
    expect(d).toBeNull()
    expect(result.data.value).toEqual([{ id: 9 }])
  })

  it('computed opts memoizes when options are stable', () => {
    const dataSource = vi.fn().mockResolvedValue({ data: [], total: 0 })
    const result = useRequest(() => ({ dataSource }))
    expect(result.hasSource.value).toBe(true)
  })

  describe('timeout option', () => {
    it('rejects when request exceeds timeout', async () => {
      vi.useFakeTimers()
      const dataSource = vi.fn().mockImplementation(
        () => new Promise<any>(resolve => setTimeout(resolve, 200, { data: [{ id: 1 }], total: 1 })),
      )
      const result = useRequest({ dataSource, timeout: 10 })
      const promise = result.request(1, 10)
      vi.advanceTimersByTime(20)
      await expect(promise).rejects.toThrow('Request timed out')
      vi.useRealTimers()
    })

    it('resolves normally when timeout is 0 (no timeout)', async () => {
      const dataSource = vi.fn().mockResolvedValue({ data: [{ id: 1 }], total: 1 })
      const result = useRequest({ dataSource, timeout: 0 })
      const d = await result.request(1, 10)
      expect(d).toEqual([{ id: 1 }])
    })

    it('resolves within timeout when request is fast enough', async () => {
      const dataSource = vi.fn().mockResolvedValue({ data: [{ id: 1 }], total: 1 })
      const result = useRequest({ dataSource, timeout: 1000 })
      const d = await result.request(1, 10)
      expect(d).toEqual([{ id: 1 }])
    })

    it('aborts the request when timeout fires', async () => {
      vi.useFakeTimers()
      const dataSource = vi.fn().mockImplementation(
        (_params: any, signal: AbortSignal) => new Promise<any>((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          setTimeout(resolve, 200, { data: [{ id: 1 }], total: 1 })
        }),
      )
      const onError = vi.fn()
      const result = useRequest({ dataSource, timeout: 10, onError })
      const promise = result.request(1, 10)
      vi.advanceTimersByTime(20)
      await expect(promise).rejects.toThrow('Request timed out')
      expect(onError).toHaveBeenCalledTimes(1)
      expect(result.data.value).toEqual([])
      vi.useRealTimers()
    })

    it('treats timeout as a real error: throws and triggers onError', async () => {
      vi.useFakeTimers()
      const onError = vi.fn()
      // dataSource 不监听 abort 信号——超时 Error 独赢 race，必须以真实错误抛出而非归并为取消
      const dataSource = vi.fn().mockImplementation(
        () => new Promise<any>(resolve => setTimeout(resolve, 200, { data: [{ id: 1 }], total: 1 })),
      )
      const result = useRequest({ dataSource, timeout: 10, onError })
      const promise = result.request(1, 10)
      vi.advanceTimersByTime(20)
      await expect(promise).rejects.toThrow('Request timed out')
      expect(onError).toHaveBeenCalledTimes(1)
      // <zh/> loading 已由 finally 复位 | <en/> loading reset via finally
      expect(result.loading.value).toBe(false)
      vi.useRealTimers()
    })
  })

  describe('pagination paramKeys namespace', () => {
    /**
     * <zh/> 分页键为框架保留命名空间——searchParams 同名键视为冲突，分页值优先并告警。
     * <en/> Pagination keys are framework-reserved — same-named searchParams keys collide,
     * <en/> pagination wins with a warning.
     */
    it('sends custom page/size keys', async () => {
      const dataSource = vi.fn().mockResolvedValue({ data: [], total: 0 })
      const result = useRequest({ dataSource, paramKeys: { page: 'p', size: 's' } })
      await result.request(2, 20)
      expect(dataSource).toHaveBeenCalledWith({ p: 2, s: 20 }, expect.any(AbortSignal))
    })

    it('lets pagination win on collision and warns once', async () => {
      resetDevWarnCacheForTests()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const dataSource = vi.fn().mockResolvedValue({ data: [], total: 0 })
      const result = useRequest({ dataSource, paramKeys: { page: 'p', size: 's' } })
      await result.request(2, 20, false, { p: 'business', other: 1 })
      expect(dataSource).toHaveBeenCalledWith({ p: 2, s: 20, other: 1 }, expect.any(AbortSignal))
      expect(warnSpy.mock.calls.map(args => String(args[0])).filter(m => m.includes('"p"'))).toHaveLength(1)
      warnSpy.mockRestore()
    })

    it('names the size key when only it collides', async () => {
      resetDevWarnCacheForTests()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const dataSource = vi.fn().mockResolvedValue({ data: [], total: 0 })
      const result = useRequest({ dataSource, paramKeys: { page: 'p', size: 's' } })
      await result.request(2, 20, false, { s: 'business' })
      expect(dataSource).toHaveBeenCalledWith({ p: 2, s: 20 }, expect.any(AbortSignal))
      expect(warnSpy.mock.calls.map(args => String(args[0])).filter(m => m.includes('"s"'))).toHaveLength(1)
      warnSpy.mockRestore()
    })

    it('stays silent and keeps default keys without collision', async () => {
      resetDevWarnCacheForTests()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const dataSource = vi.fn().mockResolvedValue({ data: [], total: 0 })
      const result = useRequest({ dataSource })
      await result.request(1, 10, false, { q: 'x' })
      expect(dataSource).toHaveBeenCalledWith({ page: 1, size: 10, q: 'x' }, expect.any(AbortSignal))
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })
})
