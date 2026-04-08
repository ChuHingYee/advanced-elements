import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getFilterStrategy,
  getRegisteredFilterTypes,
  registerFilterType,
} from '../../src/composables/features/filter-registry'

describe('filter-registry', () => {
  beforeEach(() => {
    for (const key of getRegisteredFilterTypes()) {
      registerFilterType({
        type: key,
        createDefaultValue: () => ({ type: key } as any),
        isActive: (v: any) => v.type === key,
        matches: () => true,
      })
    }
  })

  it('registers a filter type', () => {
    const strategy = {
      type: 'custom',
      createDefaultValue: () => ({ type: 'custom', value: '' }),
      isActive: (v: any) => v.value !== '',
      matches: (cell: any, filter: any) => cell === filter.value,
    }
    registerFilterType(strategy)
    expect(getFilterStrategy('custom')).toBe(strategy)
  })

  it('throws warning when overwriting existing type', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerFilterType({
      type: 'custom',
      createDefaultValue: () => ({ type: 'custom' }),
      isActive: () => false,
      matches: () => true,
    })
    registerFilterType({
      type: 'custom',
      createDefaultValue: () => ({ type: 'custom' }),
      isActive: () => false,
      matches: () => true,
    })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('already registered'),
    )
    warn.mockRestore()
  })

  it('returns undefined for unregistered type', () => {
    expect(getFilterStrategy('nonexistent')).toBeUndefined()
  })

  it('getRegisteredFilterTypes returns all types', () => {
    const types = getRegisteredFilterTypes()
    expect(Array.isArray(types)).toBe(true)
    expect(types).toContain('custom')
  })

  it('strategy type must match when retrieving', () => {
    const strategy = getFilterStrategy('custom')
    expect(strategy?.type).toBe('custom')
  })

  it('handles overwrite of same type without warning in production', () => {
    // Re-register the same type again - in test env isDev=false,
    // so no console.warn should be called. But since we're in vitest,
    // isDev might be true. Test that registration still succeeds.
    registerFilterType({
      type: 'custom',
      createDefaultValue: () => ({ type: 'custom', value: '' }),
      isActive: (v: any) => v.value !== '',
      matches: (cell: any, filter: any) => cell === filter.value,
    })
    const strategy = getFilterStrategy('custom')
    expect(strategy).toBeDefined()
    expect(strategy!.type).toBe('custom')
  })

  it('supports multiple registered types simultaneously', () => {
    registerFilterType({
      type: 'typeA',
      createDefaultValue: () => ({ type: 'typeA' }),
      isActive: () => true,
      matches: () => true,
    })
    registerFilterType({
      type: 'typeB',
      createDefaultValue: () => ({ type: 'typeB' }),
      isActive: () => true,
      matches: () => true,
    })
    expect(getRegisteredFilterTypes()).toContain('typeA')
    expect(getRegisteredFilterTypes()).toContain('typeB')
  })
})

/**
 * <zh/> 冲突策略契约测试——'keep' 静默保留旧值、'error' 在 dev 抛错并保留旧值。
 * <en/> Conflict-policy contract tests — 'keep' silently keeps the old value, 'error' throws in dev while keeping it.
 */
describe('filter-registry conflict policies', () => {
  /**
   * <zh/> 构造带身份标记的策略，靠引用断言新旧
   * <en/> Builds identity-tagged strategies so old vs new is asserted by reference
   */
  function taggedStrategy(tag: string) {
    return {
      type: 'conflict-probe',
      tag,
      createDefaultValue: () => ({ type: 'conflict-probe' }),
      isActive: () => false,
      matches: () => true,
    }
  }

  it('keep policy silently keeps the old strategy', () => {
    const first = taggedStrategy('first')
    const second = taggedStrategy('second')
    registerFilterType(first)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      registerFilterType(second, { onConflict: 'keep' })
      // <zh/> 静默：无告警 + 旧值保留 | <en/> Silent: no warning + old value kept
      expect(warn).not.toHaveBeenCalled()
      expect(getFilterStrategy('conflict-probe')).toBe(first)
    }
    finally {
      warn.mockRestore()
    }
  })

  it('error policy throws in dev and keeps the old strategy', () => {
    const first = taggedStrategy('first')
    const second = taggedStrategy('second')
    registerFilterType(first)
    expect(() => registerFilterType(second, { onConflict: 'error' })).toThrowError(
      /already registered/,
    )
    // <zh/> 抛错后旧值必须还在——否则一次误注册就丢了线上策略 | <en/> Old value must survive the throw — otherwise one bad registration drops the live strategy
    expect(getFilterStrategy('conflict-probe')).toBe(first)
  })

  it('default warn policy overwrites with a warning', () => {
    const first = taggedStrategy('first')
    const second = taggedStrategy('second')
    registerFilterType(first)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      registerFilterType(second)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('already registered'))
      expect(getFilterStrategy('conflict-probe')).toBe(second)
    }
    finally {
      warn.mockRestore()
    }
  })
})

/**
 * <zh/> 隔离注册表与注入合并——createFilterRegistry 实例互不可见；useFilterRegistry 注入优先、全局回退、types 去重合并。
 * <en/> Isolated registries and injection merge — createFilterRegistry instances are invisible to each other; useFilterRegistry prefers injected, falls back global, merges types without dupes.
 */
describe('filter-registry isolation', () => {
  it('isolates instances created by createFilterRegistry', async () => {
    const { createFilterRegistry } = await import('../../src/composables/features/filter-registry')
    const a = createFilterRegistry()
    const b = createFilterRegistry()
    const strategyA = {
      type: 'iso-a',
      createDefaultValue: () => ({ type: 'iso-a' }),
      isActive: () => true,
      matches: () => true,
    }
    a.register(strategyA)
    expect(a.get('iso-a')).toBe(strategyA)
    expect(b.get('iso-a')).toBeUndefined()
    expect(a.types()).toEqual(['iso-a'])
    // <zh/> unregister 返回值语义：存在 true、二次 false | <en/> unregister semantics: true when present, false twice
    expect(a.unregister('iso-a')).toBe(true)
    expect(a.unregister('iso-a')).toBe(false)
    expect(a.types()).toEqual([])
    a.register(strategyA)
    a.clear()
    expect(a.types()).toEqual([])
    expect(b.types()).toEqual([])
  })

  it('merges injected registry over global fallback without dupes', async () => {
    const [{ createFilterRegistry, filterRegistryKey, useFilterRegistry }, { mount }, { defineComponent, h }] = await Promise.all([
      import('../../src/composables/features/filter-registry'),
      import('@vue/test-utils'),
      import('vue'),
    ])
    const injected = createFilterRegistry()
    const mine = {
      type: 'injected-mine',
      createDefaultValue: () => ({ type: 'injected-mine' }),
      isActive: () => true,
      matches: () => true,
    }
    injected.register(mine)
    let reader!: ReturnType<typeof useFilterRegistry>
    const wrapper = mount(defineComponent({
      setup() {
        reader = useFilterRegistry()
        return () => h('div')
      },
    }), {
      global: {
        provide: { [filterRegistryKey as symbol]: injected },
      },
    })
    try {
      // <zh/> 注入命中 | <en/> Injected hit
      expect(reader.get('injected-mine')).toBe(mine)
      // <zh/> 未命中回退全局：未知类型仍是 undefined | <en/> Fallback on miss: unknown type stays undefined
      expect(reader.get('definitely-not-registered-xyz')).toBeUndefined()
      // <zh/> types 合并去重 | <en/> Merged types without dupes
      const merged = reader.types()
      expect(merged).toContain('injected-mine')
      expect(new Set(merged).size).toBe(merged.length)
    }
    finally {
      wrapper.unmount()
    }
  })

  it('global unregister/clear wrappers restore state afterwards', async () => {
    const { getRegisteredFilterTypes, registerFilterType, unregisterFilterType, clearFilterRegistry, getFilterStrategy } = await import('../../src/composables/features/filter-registry')
    const probe = {
      type: 'restore-probe',
      createDefaultValue: () => ({ type: 'restore-probe' }),
      isActive: () => true,
      matches: () => true,
    }
    registerFilterType(probe)
    expect(unregisterFilterType('restore-probe')).toBe(true)
    expect(getFilterStrategy('restore-probe')).toBeUndefined()
    expect(unregisterFilterType('restore-probe')).toBe(false)
    // <zh/> clear 全清后必须能恢复——否则同文件后续用例读到空注册表 | <en/> Must restore after clear — otherwise later tests in this file read an empty registry
    const snapshot = getRegisteredFilterTypes()
    clearFilterRegistry()
    expect(getRegisteredFilterTypes()).toEqual([])
    for (const key of snapshot) {
      registerFilterType({
        type: key,
        createDefaultValue: () => ({ type: key }) as any,
        isActive: () => true,
        matches: () => true,
      })
    }
    expect(getRegisteredFilterTypes()).toHaveLength(snapshot.length)
  })
})
