import { describe, expect, it, vi } from 'vitest'
import { createConcurrencyPool } from '../../src/utils/concurrency-pool'

/**
 * <zh/> 并发池单测——覆盖限流、错误隔离与空队列。
 * <en/> Concurrency-pool tests — limit, error isolation and empty queue.
 */
describe('createConcurrencyPool', () => {
  it('runs all tasks and never rejects on task error', async () => {
    const { runAll } = createConcurrencyPool({ limit: 2 })
    const order: number[] = []
    const onError = vi.fn()
    await runAll(
      [1, 2, 3].map(n => async () => {
        order.push(n)
        if (n === 2)
          throw new Error('boom')
      }),
      onError,
    )
    expect(order.sort()).toEqual([1, 2, 3])
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][1]).toBe(1)
  })

  it('respects limit 1 with serial execution', async () => {
    const { runAll } = createConcurrencyPool({ limit: 1 })
    const running: number[] = []
    let max = 0
    let cur = 0
    await runAll([1, 2, 3, 4].map(() => async () => {
      cur++
      max = Math.max(max, cur)
      await new Promise(r => setTimeout(r, 5))
      running.push(1)
      cur--
    }))
    expect(running).toHaveLength(4)
    expect(max).toBe(1)
  })

  it('clamps invalid limit to 1 and handles empty queue', async () => {
    const { runAll } = createConcurrencyPool({ limit: 0 })
    await expect(runAll([])).resolves.toBeUndefined()
    const { runAll: dft } = createConcurrencyPool()
    await expect(dft([])).resolves.toBeUndefined()
  })

  it('caps workers at queue length', async () => {
    const { runAll } = createConcurrencyPool({ limit: 10 })
    const done: number[] = []
    await runAll([1, 2].map(n => async () => {
      done.push(n)
    }))
    expect(done.sort()).toEqual([1, 2])
  })
})
