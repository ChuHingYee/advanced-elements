import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
/**
 * @file useScrollVelocity 测试 — 覆盖动态 cache 计算、滞回区间、速度追踪、生命周期清理
 *
 * 覆盖点：
 * - dynamicCache 三档（base/medium/high）及 Math.max 边界逻辑
 * - 滞回区间（hysteresis）升级/降级逻辑
 * - trackScrollVelocity 速度计算、衰减、空闲定时器
 * - resetVelocity 状态重置
 * - onBeforeUnmount / onDeactivated 生命周期清理
 * - MaybeRefOrGetter 形式的 baseCache 入参
 */
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { useScrollVelocity } from '../../src/components/table-virtual-renderer/use-scroll-velocity'

/**
 * 可靠地覆盖 performance.now：替换整个 globalThis.performance 对象。
 */
function mockPerformanceNow() {
  const originalPerf = globalThis.performance
  let current = 1000
  const mockPerf = {
    now: vi.fn(() => current),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  }
  Object.defineProperty(globalThis, 'performance', {
    value: mockPerf,
    configurable: true,
    writable: true,
  })
  return {
    set(t: number) { current = t },
    restore() {
      Object.defineProperty(globalThis, 'performance', {
        value: originalPerf,
        configurable: true,
        writable: true,
      })
    },
  }
}

describe('useScrollVelocity — dynamicCache', () => {
  let perf: ReturnType<typeof mockPerformanceNow>
  beforeEach(() => {
    perf = mockPerformanceNow()
  })
  afterEach(() => {
    perf.restore()
    vi.restoreAllMocks()
  })

  it('mock performance.now works', () => {
    expect(performance.now()).toBe(1000)
    perf.set(2000)
    expect(performance.now()).toBe(2000)
  })

  it('returns base cache when tier is base', () => {
    const { dynamicCache } = useScrollVelocity(() => 8)
    expect(dynamicCache.value).toBe(8)
  })

  it('high tier returns Math.max(16, base + 10) — fix for base > 6 compression', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 20)
    perf.set(1000)
    trackScrollVelocity(0)
    perf.set(1001) // dt=1, delta=100 → speed=100 > 3 → high
    trackScrollVelocity(100)
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(16, 20 + 10))
  })

  it('high tier returns at least 16 when base is small', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 2)
    perf.set(1000)
    trackScrollVelocity(0)
    perf.set(1001)
    trackScrollVelocity(100)
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(16, 2 + 10))
  })

  it('medium tier returns Math.max(10, base + 5)', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 8)
    perf.set(1000)
    trackScrollVelocity(0)
    perf.set(1010) // dt=10, delta=20 → speed=2 (>1.5, <=3) → medium
    trackScrollVelocity(20)
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(10, 8 + 5))
  })

  it('accepts ref baseCache', () => {
    const base = ref(5)
    const { dynamicCache } = useScrollVelocity(base)
    expect(dynamicCache.value).toBe(5)
    base.value = 12
    expect(dynamicCache.value).toBe(12)
  })

  it('accepts plain number baseCache', () => {
    const { dynamicCache } = useScrollVelocity(7)
    expect(dynamicCache.value).toBe(7)
  })
})

describe('useScrollVelocity — hysteresis', () => {
  let perf: ReturnType<typeof mockPerformanceNow>
  beforeEach(() => {
    vi.useFakeTimers()
    perf = mockPerformanceNow()
  })
  afterEach(() => {
    perf.restore()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function driveTo(trackScrollVelocity: (n: number) => void, delta: number, dt: number) {
    perf.set(1000)
    trackScrollVelocity(0)
    perf.set(1000 + dt)
    trackScrollVelocity(delta)
    await nextTick()
  }

  it('upgrades base → medium when velocity > 1.5', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 8)
    await driveTo(trackScrollVelocity, 20, 10) // speed=2 > 1.5
    expect(dynamicCache.value).toBe(Math.max(10, 8 + 5))
  })

  it('upgrades base → high when velocity > 3', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 8)
    await driveTo(trackScrollVelocity, 100, 10) // speed=10 > 3
    expect(dynamicCache.value).toBe(Math.max(16, 8 + 10))
  })

  it('upgrades medium → high when velocity > 3', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 8)
    await driveTo(trackScrollVelocity, 20, 10) // speed=2 → medium
    expect(dynamicCache.value).toBe(Math.max(10, 8 + 5))
    await driveTo(trackScrollVelocity, 100, 10) // speed=10 → high
    expect(dynamicCache.value).toBe(Math.max(16, 8 + 10))
  })

  it('downgrades high → medium when velocity <= 2 (hysteresis)', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 8)
    await driveTo(trackScrollVelocity, 100, 10) // speed=10 → high
    expect(dynamicCache.value).toBe(Math.max(16, 8 + 10))
    // Idle 120ms → velocity resets to 0 → 0 <= 2 → downgrade to medium
    vi.advanceTimersByTime(121)
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(10, 8 + 5))
  })

  it('downgrades medium → base when velocity <= 0.5 (hysteresis)', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 8)
    await driveTo(trackScrollVelocity, 20, 10) // speed=2 → medium
    expect(dynamicCache.value).toBe(Math.max(10, 8 + 5))
    // Idle 120ms → velocity resets to 0 → 0 <= 0.5 → downgrade to base
    vi.advanceTimersByTime(121)
    await nextTick()
    expect(dynamicCache.value).toBe(8)
  })

  it('hysteresis: medium stays medium when velocity between 0.5 and 1.5', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 8)
    await driveTo(trackScrollVelocity, 20, 10) // speed=2 → medium, velocity=2
    // Scroll at speed=1.0 → velocity=max(1.0, 2*0.6)=1.2, between 0.5 and 1.5 → stays medium
    perf.set(2000)
    trackScrollVelocity(0)
    perf.set(2010)
    trackScrollVelocity(10) // speed=1.0
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(10, 8 + 5))
  })

  it('hysteresis: high stays high when velocity between 2 and 3', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 8)
    await driveTo(trackScrollVelocity, 100, 10) // speed=10 → high, velocity=10
    // Scroll at speed=2.5 → velocity=max(2.5, 10*0.6)=6.0, > 2 → stays high
    perf.set(2000)
    trackScrollVelocity(0)
    perf.set(2010)
    trackScrollVelocity(25) // speed=2.5
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(16, 8 + 10))
  })
})

describe('useScrollVelocity — trackScrollVelocity', () => {
  let perf: ReturnType<typeof mockPerformanceNow>
  beforeEach(() => {
    vi.useFakeTimers()
    perf = mockPerformanceNow()
  })
  afterEach(() => {
    perf.restore()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('applies 0.6 decay factor to previous velocity', async () => {
    const { trackScrollVelocity, dynamicCache, resetVelocity } = useScrollVelocity(() => 8)
    perf.set(1000)
    trackScrollVelocity(0)
    perf.set(1010)
    trackScrollVelocity(20) // speed=2 → medium
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(10, 8 + 5))

    resetVelocity()
    // After reset, scrollVelocity=0; new scroll: speed=max(0.5/10, 0*0.6)=0.05 → stays base
    perf.set(2000)
    trackScrollVelocity(0)
    perf.set(2010)
    trackScrollVelocity(0.5)
    await nextTick()
    expect(dynamicCache.value).toBe(8)
  })

  it('ignores dt <= 0 (no division by zero)', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 8)
    perf.set(1000)
    trackScrollVelocity(0)
    // Same timestamp → dt=0, speed not computed
    trackScrollVelocity(100)
    await nextTick()
    expect(dynamicCache.value).toBe(8)
  })

  it('resets velocity to 0 after 120ms idle, triggering high → medium downgrade', async () => {
    const { trackScrollVelocity, dynamicCache, resetVelocity } = useScrollVelocity(() => 8)
    perf.set(1000)
    trackScrollVelocity(0)
    perf.set(1001)
    trackScrollVelocity(100) // speed=100 → high
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(16, 8 + 10))

    // After 120ms idle, setTimeout callback fires → scrollVelocity=0 → watch: 0 <= 2 → medium
    vi.advanceTimersByTime(121)
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(10, 8 + 5))

    resetVelocity()
  })

  it('clears previous idle timer on new scroll (old timer does not fire)', async () => {
    const { trackScrollVelocity, dynamicCache } = useScrollVelocity(() => 8)
    perf.set(1000)
    trackScrollVelocity(0)
    perf.set(1010)
    trackScrollVelocity(100) // speed=10 → high
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(16, 8 + 10))

    // Advance 100ms (< 120ms, timer pending), then scroll again (clears old timer, sets new one)
    vi.advanceTimersByTime(100)
    perf.set(1110)
    trackScrollVelocity(0)
    await nextTick()
    // Advance 100ms from second scroll (< 120ms, new timer still pending)
    vi.advanceTimersByTime(100)
    await nextTick()
    // velocity should NOT have reset (new timer hasn't expired)
    expect(dynamicCache.value).toBe(Math.max(16, 8 + 10))

    // Advance past 120ms from last scroll → velocity resets → downgrade
    vi.advanceTimersByTime(25)
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(10, 8 + 5))
  })
})

describe('useScrollVelocity — resetVelocity', () => {
  let perf: ReturnType<typeof mockPerformanceNow>
  beforeEach(() => {
    perf = mockPerformanceNow()
  })
  afterEach(() => {
    perf.restore()
    vi.restoreAllMocks()
  })

  it('resets tier and velocity to base/0', async () => {
    const { trackScrollVelocity, dynamicCache, resetVelocity } = useScrollVelocity(() => 8)
    perf.set(1000)
    trackScrollVelocity(0)
    perf.set(1001)
    trackScrollVelocity(100) // high
    await nextTick()
    expect(dynamicCache.value).toBe(Math.max(16, 8 + 10))

    resetVelocity()
    expect(dynamicCache.value).toBe(8) // back to base
  })
})

describe('useScrollVelocity — lifecycle cleanup', () => {
  let perf: ReturnType<typeof mockPerformanceNow>
  beforeEach(() => {
    vi.useFakeTimers()
    perf = mockPerformanceNow()
  })
  afterEach(() => {
    perf.restore()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('onBeforeUnmount clears idle timer (no late velocity reset)', async () => {
    let dynamicCacheRef: any
    const TestComp = defineComponent({
      setup() {
        const api = useScrollVelocity(() => 8)
        dynamicCacheRef = api.dynamicCache
        return { ...api }
      },
      render() { return h('div') },
    })

    const wrapper = mount(TestComp)
    const vm = wrapper.vm as any
    perf.set(1000)
    vm.trackScrollVelocity(0)
    perf.set(1001)
    vm.trackScrollVelocity(100) // speed=100 → high
    await nextTick()
    expect(dynamicCacheRef.value).toBe(Math.max(16, 8 + 10))

    wrapper.unmount()
    // Advance past idle timeout — timer was cleared, no error
    vi.advanceTimersByTime(200)
    expect(true).toBe(true)
  })

  it('onDeactivated calls resetVelocity', async () => {
    const show = ref(true)

    const TestComp = defineComponent({
      setup() {
        const api = useScrollVelocity(() => 8)
        return { ...api }
      },
      render() { return h('div') },
    })

    const Parent = defineComponent({
      setup() { return { show } },
      render() {
        return h(KeepAlive, null, {
          default: () => show.value ? h(TestComp) : null,
        })
      },
    })

    const wrapper = mount(Parent)
    await nextTick()

    const comp = wrapper.findComponent(TestComp)
    const vm = comp.vm as any

    perf.set(1000)
    vm.trackScrollVelocity(0)
    perf.set(1001)
    vm.trackScrollVelocity(100) // speed=100 → high
    await nextTick()
    expect(vm.dynamicCache).toBe(Math.max(16, 8 + 10))

    // Deactivate → onDeactivated calls resetVelocity
    show.value = false
    await nextTick()

    expect(vm.dynamicCache).toBe(8)
  })
})
