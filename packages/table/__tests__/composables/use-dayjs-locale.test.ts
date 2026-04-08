import { describe, expect, it, vi } from 'vitest'
import { registerDayjsLocaleMap, useDayjsLocale } from '../../src/composables/locale/use-dayjs-locale'

// vi.mock is hoisted to top, so use vi.hoisted for the mock implementation
const mockUseGlobalConfig = vi.hoisted(() => vi.fn(() => ({
  value: { locale: { name: 'en' } },
})))

vi.mock('element-plus', () => ({
  useGlobalConfig: mockUseGlobalConfig,
}))

describe('use-dayjs-locale', () => {
  describe('useDayjsLocale', () => {
    it('should return dayjsLocaleName ref', () => {
      const result = useDayjsLocale()
      expect(result.dayjsLocaleName).toBeDefined()
    })

    it('should map en locale to en', () => {
      const result = useDayjsLocale()
      expect(result.dayjsLocaleName.value).toBe('en')
    })

    it('maps en-us to en locale', () => {
      mockUseGlobalConfig.mockReturnValue({ value: { locale: { name: 'en-us' } } })
      const { dayjsLocaleName } = useDayjsLocale()
      expect(dayjsLocaleName.value).toBe('en')
      mockUseGlobalConfig.mockReturnValue({ value: { locale: { name: 'en' } } })
    })

    it('falls back to zh-cn when locale name is undefined', () => {
      mockUseGlobalConfig.mockReturnValue({ value: { locale: { name: undefined } } })
      const { dayjsLocaleName } = useDayjsLocale()
      expect(dayjsLocaleName.value).toBe('zh-cn')
      mockUseGlobalConfig.mockReturnValue({ value: { locale: { name: 'en' } } })
    })

    it('falls back to zh-cn when locale is null', () => {
      mockUseGlobalConfig.mockReturnValue({ value: { locale: null } })
      const { dayjsLocaleName } = useDayjsLocale()
      expect(dayjsLocaleName.value).toBe('zh-cn')
      mockUseGlobalConfig.mockReturnValue({ value: { locale: { name: 'en' } } })
    })
  })

  describe('registerDayjsLocaleMap', () => {
    it('should add new locale mappings', () => {
      expect(() => {
        registerDayjsLocaleMap({ 'ja': 'ja', 'ja-jp': 'ja' })
      }).not.toThrow()
    })

    it('should allow adding multiple locales', () => {
      expect(() => {
        registerDayjsLocaleMap({ fr: 'fr', de: 'de' })
      }).not.toThrow()
    })
  })

  describe('registerDayjsLocaleMap - duplicates and overrides', () => {
    it('last registered mapping wins for same key', () => {
      registerDayjsLocaleMap({ 'test-key': 'first' })
      registerDayjsLocaleMap({ 'test-key': 'second' })
      // <zh/> 用唯一键断言，避免污染全局映射影响其他用例
      // <en/> Unique key keeps the global map clean for other tests
      mockUseGlobalConfig.mockReturnValue({ value: { locale: { name: 'test-key' } } })
      try {
        expect(useDayjsLocale().dayjsLocaleName.value).toBe('second')
      }
      finally {
        mockUseGlobalConfig.mockReturnValue({ value: { locale: { name: 'en' } } })
      }
    })
  })

  describe('registerDayjsLocaleMap - edge cases', () => {
    it('handles empty map', () => {
      expect(() => registerDayjsLocaleMap({})).not.toThrow()
    })

    it('handles override of existing mapping', () => {
      registerDayjsLocaleMap({ en: 'en-us' })
      registerDayjsLocaleMap({ en: 'en' })
      // <zh/> 覆盖后恢复默认值，避免污染后续用例
      // <en/> Restores the default after overriding, keeping later tests clean
      mockUseGlobalConfig.mockReturnValue({ value: { locale: { name: 'en' } } })
      expect(useDayjsLocale().dayjsLocaleName.value).toBe('en')
    })
  })
})
