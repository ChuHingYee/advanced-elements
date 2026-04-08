/**
 * <zh/> 异步功能域机制回归 — 加载一次、并发合并、失败重试、方法转接
 * <en/> Async feature mechanism regression — load-once, concurrent coalescing, failure retry, method forwarding
 */
import { describe, expect, it, vi } from 'vitest'
import { callWithImpl, createAsyncLoader } from '../../src/utils/async-feature'

describe('createAsyncLoader', () => {
  it('loads once across sequential calls', async () => {
    const importer = vi.fn(async () => ({ v: 1 }))
    const loader = createAsyncLoader(importer)
    expect(loader.loaded.value).toBe(false)
    const a = await loader.load()
    const b = await loader.load()
    expect(importer).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(loader.loaded.value).toBe(true)
    expect(loader.current.value).toBe(a)
  })

  it('coalesces concurrent loads', async () => {
    let calls = 0
    const importer = vi.fn(async () => {
      calls++
      await new Promise(r => setTimeout(r, 5))
      return { v: calls }
    })
    const loader = createAsyncLoader(importer)
    const [a, b] = await Promise.all([loader.load(), loader.load()])
    expect(importer).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
  })

  it('retries after failure', async () => {
    const importer = vi.fn()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce({ v: 2 })
    const loader = createAsyncLoader(importer)
    await expect(loader.load()).rejects.toThrow('chunk failed')
    expect(loader.loaded.value).toBe(false)
    const mod = await loader.load()
    expect(mod).toEqual({ v: 2 })
    expect(importer).toHaveBeenCalledTimes(2)
    expect(loader.loaded.value).toBe(true)
  })
})

describe('callWithImpl', () => {
  it('forwards args and unwraps async results', async () => {
    const loader = createAsyncLoader(async () => ({
      sum: async (a: number, b: number) => a + b,
    }))
    const sum = callWithImpl(loader.load, (impl, a: number, b: number) => impl.sum(a, b))
    await expect(sum(2, 3)).resolves.toBe(5)
  })

  it('propagates loader and method errors', async () => {
    const badLoader = createAsyncLoader(async () => {
      throw new Error('load failed')
    })
    const boom = callWithImpl(badLoader.load, (impl: { go: () => void }) => impl.go())
    await expect(boom()).rejects.toThrow('load failed')

    const okLoader = createAsyncLoader(async () => ({
      go: async () => {
        throw new Error('impl failed')
      },
    }))
    const go = callWithImpl(okLoader.load, impl => impl.go())
    await expect(go()).rejects.toThrow('impl failed')
  })
})
