import { describe, expect, it, vi } from 'vitest'
import {
  getFilterStrategy,
  registerFilterType,
} from '../../src/composables/features/filter-registry'

vi.mock('../../src/utils/env', () => ({
  isDev: false,
  isBrowser: true,
}))

/**
 * <zh/> 生产环境冲突策略——'error' 不抛错静默保留旧值，默认 'warn' 通道同样静默覆盖。
 * <zh/> 注意：本文件整体 mock env 为生产模式，不可与 dev 断言同文件。
 * <en/> Production conflict policies — 'error' keeps the old value silently without throwing,
 * <en/> and the default 'warn' channel is equally silent. The whole file mocks env as production;
 * <en/> dev assertions must not live here.
 */
describe('filter-registry production policies', () => {
  it('error policy keeps the old strategy without throwing in production', () => {
    const first = {
      type: 'prod-probe',
      createDefaultValue: () => ({ type: 'prod-probe' }),
      isActive: () => false,
      matches: () => true,
    }
    const second = {
      type: 'prod-probe',
      createDefaultValue: () => ({ type: 'prod-probe' }),
      isActive: () => true,
      matches: () => true,
    }
    registerFilterType(first)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(() => registerFilterType(second, { onConflict: 'error' })).not.toThrow()
      expect(warn).not.toHaveBeenCalled()
      // <zh/> 生产误配 'error' 也不丢线上策略 | <en/> A misconfigured 'error' in prod must not drop the live strategy
      expect(getFilterStrategy('prod-probe')).toBe(first)
    }
    finally {
      warn.mockRestore()
    }
  })

  it('default warn policy overwrites silently in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      registerFilterType({
        type: 'prod-probe',
        createDefaultValue: () => ({ type: 'prod-probe' }),
        isActive: () => true,
        matches: () => true,
      })
      expect(warn).not.toHaveBeenCalled()
      expect(getFilterStrategy('prod-probe')?.isActive({} as any)).toBe(true)
    }
    finally {
      warn.mockRestore()
    }
  })
})
