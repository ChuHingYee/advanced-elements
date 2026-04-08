import { describe, expect, it, vi } from 'vitest'
import { useV2RowHeightReset } from '../../../src/components/table-virtual-renderer/use-v2-row-height-reset'
import { resetDevWarnCacheForTests } from '../../../src/utils/dev-warn'

/** <zh/> 构造直挂原生入口的实例 | <en/> Build an instance with a directly attached native entry */
function makeDirectInstance() {
  return {
    resetAfterRowIndex: vi.fn(),
    $forceUpdate: vi.fn(),
  }
}

/** <zh/> 构造组件 vnode（exposed 携带原生入口） | <en/> Build a component vnode (exposed carries the native entry) */
function makeGridVNode(reset: (...args: any[]) => void) {
  return {
    component: {
      exposed: { resetAfterRowIndex: reset },
      subTree: null,
    },
    children: [],
  }
}

describe('useV2RowHeightReset', () => {
  it('delegates to the directly attached native entry and force-updates', () => {
    const instance = makeDirectInstance()
    const api = useV2RowHeightReset({ getInstance: () => instance, isDynamic: () => true })

    expect(api.hasRowHeightResetApi()).toBe(true)
    expect(api.resetAfterRowIndex(3)).toBe(true)
    expect(instance.resetAfterRowIndex).toHaveBeenCalledWith(3, false)
    expect(instance.$forceUpdate).toHaveBeenCalledTimes(1)
  })

  it('refreshVirtualRowHeight resets with forceUpdate from row 0 by default', () => {
    const instance = makeDirectInstance()
    const remeasure = vi.fn()
    const api = useV2RowHeightReset({ getInstance: () => instance, isDynamic: () => true, remeasure })

    expect(api.refreshVirtualRowHeight()).toBe(true)
    expect(instance.resetAfterRowIndex).toHaveBeenCalledWith(0, true)
    // EP 2.14 只在行挂载时测量 → 必须推进重挂载代际使行真正重测
    expect(remeasure).toHaveBeenCalledTimes(1)
    expect(api.refreshVirtualRowHeight(5)).toBe(true)
    expect(instance.resetAfterRowIndex).toHaveBeenCalledWith(5, true)
    expect(remeasure).toHaveBeenCalledTimes(2)
  })

  it('未装配重测钩子时 refreshVirtualRowHeight 返回 false（不谎称已重测）', () => {
    const instance = makeDirectInstance()
    const api = useV2RowHeightReset({ getInstance: () => instance, isDynamic: () => true })

    expect(api.refreshVirtualRowHeight()).toBe(false)
    // reset 仍已提交——只是没有真正重测
    expect(instance.resetAfterRowIndex).toHaveBeenCalledWith(0, true)
  })

  it('normalizes invalid row indexes to a safe value', () => {
    const instance = makeDirectInstance()
    const api = useV2RowHeightReset({ getInstance: () => instance, isDynamic: () => true })

    api.resetAfterRowIndex(-5)
    expect(instance.resetAfterRowIndex).toHaveBeenLastCalledWith(0, false)
    api.resetAfterRowIndex(2.9)
    expect(instance.resetAfterRowIndex).toHaveBeenLastCalledWith(2, false)
    api.resetAfterRowIndex(Number.NaN)
    expect(instance.resetAfterRowIndex).toHaveBeenLastCalledWith(0, false)
  })

  it('resolves the instance per call (remount-safe, never cached)', () => {
    const first = makeDirectInstance()
    const second = makeDirectInstance()
    let current: unknown = first
    const api = useV2RowHeightReset({ getInstance: () => current, isDynamic: () => true })

    expect(api.resetAfterRowIndex(0)).toBe(true)
    expect(first.resetAfterRowIndex).toHaveBeenCalledTimes(1)
    current = second
    expect(api.resetAfterRowIndex(0)).toBe(true)
    expect(second.resetAfterRowIndex).toHaveBeenCalledTimes(1)
    expect(first.resetAfterRowIndex).toHaveBeenCalledTimes(1)
  })

  it('no-ops with a dev warning on the fixed-height grid', () => {
    resetDevWarnCacheForTests()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const getInstance = vi.fn(() => makeDirectInstance())
    try {
      const api = useV2RowHeightReset({ getInstance, isDynamic: () => false })

      expect(api.hasRowHeightResetApi()).toBe(false)
      expect(api.resetAfterRowIndex(0)).toBe(false)
      expect(api.refreshVirtualRowHeight()).toBe(false)
      // 固定行高网格不触碰实例（无缓存可清，连探测都不必做）
      // Fixed grids never touch the instance: nothing is cached, so not even a probe is needed
      expect(getInstance).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('fixed-height grid'))
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  it('returns false without throwing when the instance is missing', () => {
    const api = useV2RowHeightReset({ getInstance: () => null, isDynamic: () => true })
    expect(api.hasRowHeightResetApi()).toBe(false)
    expect(api.resetAfterRowIndex(0)).toBe(false)
    expect(api.refreshVirtualRowHeight()).toBe(false)
  })

  it('warns observably when no native entry is reachable', () => {
    resetDevWarnCacheForTests()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const api = useV2RowHeightReset({ getInstance: () => ({}), isDynamic: () => true })
      expect(api.hasRowHeightResetApi()).toBe(false)
      expect(api.resetAfterRowIndex(0)).toBe(false)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unavailable'))
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  it('walks the internal $subTree and resets every grid (main + fixed)', () => {
    const mainReset = vi.fn()
    const fixedReset = vi.fn()
    const instance = {
      $: {
        subTree: {
          component: null,
          children: [makeGridVNode(mainReset), makeGridVNode(fixedReset)],
        },
      },
      $forceUpdate: vi.fn(),
    }
    const api = useV2RowHeightReset({ getInstance: () => instance, isDynamic: () => true })

    expect(api.hasRowHeightResetApi()).toBe(true)
    expect(api.resetAfterRowIndex(2, true)).toBe(true)
    expect(mainReset).toHaveBeenCalledWith(2, true)
    expect(fixedReset).toHaveBeenCalledWith(2, true)
    expect(instance.$forceUpdate).toHaveBeenCalledTimes(1)
  })

  it('falls back to the public $el.__vnode ancestor chain', () => {
    const gridReset = vi.fn()
    const instance = {
      $el: { __vnode: makeGridVNode(gridReset) },
      $forceUpdate: vi.fn(),
    }
    const api = useV2RowHeightReset({ getInstance: () => instance, isDynamic: () => true })

    expect(api.resetAfterRowIndex(0)).toBe(true)
    expect(gridReset).toHaveBeenCalledWith(0, false)
  })

  it('prefers the direct entry and skips the subtree walk', () => {
    const direct = vi.fn()
    const nested = vi.fn()
    const instance = {
      resetAfterRowIndex: direct,
      $: { subTree: makeGridVNode(nested) },
      $forceUpdate: vi.fn(),
    }
    const api = useV2RowHeightReset({ getInstance: () => instance, isDynamic: () => true })

    expect(api.resetAfterRowIndex(1)).toBe(true)
    expect(direct).toHaveBeenCalledWith(1, false)
    expect(nested).not.toHaveBeenCalled()
  })

  // <zh/> S-03：锁定"探测失败 → 返回 false → 上报 reason"的行为契约。
  // <zh/> `onUnavailable` 即生产期上报钩子（`use-v2-grid-core.ts` 将其转接为
  // <zh/> `rendererError` → `TABLE_ROW_HEIGHT_RESET_UNAVAILABLE`，`{ reason }` 进 `cause`），
  // <zh/> 此处在域层锁定 reason 三分支，EP 升级漂移时此处先红灯。
  // <en/> S-03: lock the "probe miss → false → report reason" contract.
  // <en/> `onUnavailable` is the production reporting hook (forwarded by `use-v2-grid-core.ts`
  // <en/> to `rendererError` → `TABLE_ROW_HEIGHT_RESET_UNAVAILABLE` with `{ reason }` as cause);
  // <en/> the three reason branches are locked here at the domain level so EP upgrade drift
  // <en/> turns this file red first.
  it('reports fixed-grid via onUnavailable without touching the instance', () => {
    const onUnavailable = vi.fn()
    const getInstance = vi.fn(() => makeDirectInstance())
    const api = useV2RowHeightReset({ getInstance, isDynamic: () => false, onUnavailable })

    expect(api.hasRowHeightResetApi()).toBe(false)
    expect(api.resetAfterRowIndex(0)).toBe(false)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
    expect(onUnavailable).toHaveBeenCalledWith('fixed-grid')
    // 固定网格无缓存可清，连探测都不必做
    expect(getInstance).not.toHaveBeenCalled()
  })

  it('reports no-instance via onUnavailable when the instance is missing', () => {
    const onUnavailable = vi.fn()
    const api = useV2RowHeightReset({ getInstance: () => null, isDynamic: () => true, onUnavailable })

    expect(api.hasRowHeightResetApi()).toBe(false)
    expect(api.resetAfterRowIndex(0)).toBe(false)
    expect(api.refreshVirtualRowHeight()).toBe(false)
    expect(onUnavailable).toHaveBeenCalledWith('no-instance')
  })

  it('reports no-native-entry via onUnavailable when no native entry is reachable', () => {
    resetDevWarnCacheForTests()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onUnavailable = vi.fn()
    const remeasure = vi.fn()
    try {
      const api = useV2RowHeightReset({ getInstance: () => ({}), isDynamic: () => true, onUnavailable, remeasure })

      expect(api.hasRowHeightResetApi()).toBe(false)
      expect(api.resetAfterRowIndex(0)).toBe(false)
      expect(onUnavailable).toHaveBeenCalledWith('no-native-entry')
      // reset 未提交 → 不得推进重测，更不得谎称已重测
      expect(api.refreshVirtualRowHeight()).toBe(false)
      expect(remeasure).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unavailable'))
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  it('never calls onUnavailable on the success path', () => {
    const onUnavailable = vi.fn()
    const instance = makeDirectInstance()
    const api = useV2RowHeightReset({ getInstance: () => instance, isDynamic: () => true, onUnavailable })

    expect(api.resetAfterRowIndex(0)).toBe(true)
    expect(api.hasRowHeightResetApi()).toBe(true)
    expect(onUnavailable).not.toHaveBeenCalled()
  })
})
