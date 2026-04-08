import { describe, expect, it } from 'vitest'
import { resolvePath, useAdvLocale } from '../../src/locale/index'
import { en } from '../../src/locale/lang/en'
import { zhCn } from '../../src/locale/lang/zh-cn'

describe('locale', () => {
  describe('resolvePath', () => {
    it('should resolve nested path', () => {
      expect(resolvePath(zhCn, 'table.query')).toBe('查询')
    })

    it('should resolve deeply nested path', () => {
      expect(resolvePath(zhCn, 'table.copy.success')).toBe('复制成功')
    })

    it('should return path when key not found', () => {
      expect(resolvePath(zhCn, 'table.nonexistent')).toBe('table.nonexistent')
    })

    it('should resolve english locale', () => {
      expect(resolvePath(en, 'table.query')).toBe('Search')
      expect(resolvePath(en, 'table.copy.success')).toBe('Copied')
    })

    it('should return path when locale is null', () => {
      // <zh/> 任务 3-5：locale 为 null 时回退英文
      // <en/> Task 3-5: fallback to English when locale is null
      expect(resolvePath(null as any, 'table.query')).toBe('Search')
    })

    it('should return path when path is empty', () => {
      expect(resolvePath(zhCn, '')).toBe('')
    })
  })

  describe('language data', () => {
    it('should have zhCn with correct name', () => {
      expect(zhCn.name).toBe('zh-cn')
    })

    it('should have zhCn currency config', () => {
      expect(zhCn.currency).toEqual({ symbol: '¥', locale: 'zh-CN' })
    })

    it('should have en with correct name', () => {
      expect(en.name).toBe('en')
    })

    it('should have currency in en locale (aligned with zh-cn)', () => {
      expect(en.currency).toBeDefined()
      expect(en.currency?.symbol).toBe('$')
      expect(en.currency?.locale).toBe('en-US')
    })
  })

  describe('useAdvLocale', () => {
    it('should export as function', () => {
      expect(typeof useAdvLocale).toBe('function')
    })
  })
})
