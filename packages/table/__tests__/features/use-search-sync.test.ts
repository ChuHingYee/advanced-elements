import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useSearchSync } from '../../src/composables/features/use-search-sync'

/**
 * <zh/> 搜索双向同步单测——覆盖双向回写、幂等闸门与锁窗口暂存。
 * <en/> Search-sync tests — two-way write-back, idempotence gate and lock-window queueing.
 */
async function flush(times = 3) {
  for (let i = 0; i < times; i++)
    await nextTick()
}

describe('useSearchSync', () => {
  it('mirrors internal edits to the external model', async () => {
    const params = ref<Record<string, unknown>>({ name: 'a' })
    const model = ref<Record<string, unknown> | undefined>({ name: 'a' })
    useSearchSync(params as any, model)
    params.value = { name: 'b' }
    await flush()
    expect(model.value).toEqual({ name: 'b' })
  })

  it('mirrors external model edits inward', async () => {
    const params = ref<Record<string, unknown>>({ name: 'a' })
    const model = ref<Record<string, unknown> | undefined>({ name: 'a' })
    useSearchSync(params as any, model)
    model.value = { name: 'c' }
    await flush()
    expect(params.value).toEqual({ name: 'c' })
  })

  it('short-circuits equal-content writes (idempotence gate)', async () => {
    const params = ref<Record<string, unknown>>({ name: 'a' })
    const model = ref<Record<string, unknown> | undefined>({ name: 'a' })
    useSearchSync(params as any, model)
    const before = model.value
    params.value = { name: 'a' }
    await flush()
    expect(model.value).toBe(before)
  })

  it('ignores internal edits while model is undefined', async () => {
    const params = ref<Record<string, unknown>>({ name: 'a' })
    const model = ref<Record<string, unknown> | undefined>(undefined)
    useSearchSync(params as any, model)
    params.value = { name: 'b' }
    await flush()
    expect(model.value).toBeUndefined()
    expect(params.value).toEqual({ name: 'b' })
  })

  it('queues external writes arriving inside the lock window', async () => {
    const params = ref<Record<string, unknown>>({ name: 'a' })
    const model = ref<Record<string, unknown> | undefined>({ name: 'a' })
    useSearchSync(params as any, model)
    // <zh/> 同一 tick 内双向写入竞态：内部写先持锁，外部写暂存后补刷，最终收敛不死循环
    // <en/> same-tick two-way race: inner write locks first, outer write queued then flushed, converges
    params.value = { name: 'b' }
    model.value = { name: 'd' }
    await flush(5)
    expect(params.value).toEqual(model.value)
  })

  it('converges when one model is shared (no ping-pong livelock)', async () => {
    const params = ref<Record<string, unknown>>({ name: 'a' })
    const model = ref<Record<string, unknown> | undefined>({ name: 'a' })
    useSearchSync(params as any, model)
    params.value = { name: 'z' }
    await flush(6)
    expect(params.value).toEqual({ name: 'z' })
    expect(model.value).toEqual({ name: 'z' })
  })
})
