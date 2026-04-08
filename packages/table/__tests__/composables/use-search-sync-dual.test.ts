import { describe, expect, it } from 'vitest'
import { nextTick, ref, shallowRef, watch } from 'vue'
import { useSearchSync } from '../../src/composables/features/use-search-sync'

/**
 * 同一 `searchValues` model 被多个表格实例共享时的 ping-pong 复现。
 * 每次 `useSearchSync` 调用 = 一个表格实例的同步通道（demo 4.7 为 Default + Virtual 双绑定）。
 */
describe('useSearchSync 多实例共享', () => {
  it('两个实例各自初始化列默认值后收敛，不再互相回写', async () => {
    const model = ref<Record<string, unknown>>({})
    const a = shallowRef<Record<string, unknown>>({})
    const b = shallowRef<Record<string, unknown>>({})
    useSearchSync(a, model)
    useSearchSync(b, model)

    // 模拟两个实例挂载时各自套用列 search.defaultValue
    a.value = { gender: 'male', status: 'active' }
    await nextTick()
    b.value = { gender: 'male', status: 'active' }
    await nextTick()

    // 收敛后继续推进 tick：写入数不得再增长（增长即 ping-pong 未断）
    let writes = 0
    const stop = watch(model, () => {
      writes++
    })
    for (let i = 0; i < 20; i++)
      await nextTick()
    stop()

    expect(writes).toBe(0)
    expect(model.value).toEqual({ gender: 'male', status: 'active' })
  })

  it('共享 model 下单侧变更仍能同步到另一侧（不被幂等闸门吞掉）', async () => {
    const model = ref<Record<string, unknown>>({ gender: 'male' })
    const a = shallowRef<Record<string, unknown>>({ gender: 'male' })
    const b = shallowRef<Record<string, unknown>>({ gender: 'male' })
    useSearchSync(a, model)
    useSearchSync(b, model)

    // 外部（表单）变更 → 两个实例都应收到
    model.value = { gender: 'female' }
    await nextTick()
    expect(a.value).toEqual({ gender: 'female' })
    expect(b.value).toEqual({ gender: 'female' })

    // 实例 A 内部检索变更 → model 与实例 B 都应收到
    a.value = { gender: 'female', status: 'active' }
    await nextTick()
    expect(model.value).toEqual({ gender: 'female', status: 'active' })
    expect(b.value).toEqual({ gender: 'female', status: 'active' })
  })

  it('model 为 undefined 时不向外写（未绑定场景保持静默）', async () => {
    const model = ref<Record<string, unknown> | undefined>(undefined)
    const a = shallowRef<Record<string, unknown>>({ name: 'x' })
    useSearchSync(a, model)

    a.value = { name: 'y' }
    await nextTick()
    expect(model.value).toBeUndefined()
  })
})
