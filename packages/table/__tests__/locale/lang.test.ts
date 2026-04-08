import { describe, expect, it } from 'vitest'
import { en } from '../../src/locale/lang/en'
import { zhCn } from '../../src/locale/lang/zh-cn'

describe('locale language packs', () => {
  describe('en', () => {
    it('has correct name', () => {
      expect(en.name).toBe('en')
    })

    it('has table section', () => {
      expect(en.table).toBeDefined()
      expect(en.table.query).toBe('Search')
      expect(en.table.refresh).toBe('Refresh')
    })

    it('has form section', () => {
      expect(en.form).toBeDefined()
      expect(en.form.expand).toBe('Expand')
      expect(en.form.inputPlaceholder).toBe('Please enter')
    })

    it('has edit section', () => {
      expect(en.edit).toBeDefined()
      expect(en.edit.edit).toBe('Edit')
      expect(en.edit.required).toBe('Required')
    })

    it('has polling config', () => {
      expect(en.table.polling.start).toBe('Start Polling')
      expect(en.table.polling.stop).toBe('Stop Polling')
    })

    it('has copy config', () => {
      expect(en.table.copy.success).toBe('Copied')
      expect(en.table.copy.fail).toBe('Copy failed, please copy manually')
    })

    it('has filter config', () => {
      expect(en.table.filter.eq).toBe('=')
      expect(en.table.filter.contains).toBe('Contains')
      expect(en.table.filter.between).toBe('Range')
    })

    it('has export config', () => {
      expect(en.table.export.title).toBe('Export Excel')
      expect(en.table.export.csvTitle).toBe('Export CSV')
    })
  })

  describe('zhCn', () => {
    it('has correct name', () => {
      expect(zhCn.name).toBe('zh-cn')
    })

    it('has currency config', () => {
      expect(zhCn.currency).toBeDefined()
      expect(zhCn.currency?.symbol).toBe('¥')
      expect(zhCn.currency?.locale).toBe('zh-CN')
    })

    it('has table section in Chinese', () => {
      expect(zhCn.table).toBeDefined()
      expect(zhCn.table.query).toBe('查询')
      expect(zhCn.table.refresh).toBe('刷新')
    })

    it('has form section in Chinese', () => {
      expect(zhCn.form).toBeDefined()
      expect(zhCn.form.expand).toBe('展开')
    })

    it('has edit section in Chinese', () => {
      expect(zhCn.edit).toBeDefined()
      expect(zhCn.edit.cancel).toBe('取消')
      expect(zhCn.edit.confirm).toBe('确定')
    })

    it('has all expected sections', () => {
      expect(zhCn.table.columnSetting).toBe('列设置')
      expect(zhCn.table.export.title).toBe('导出 Excel')
      expect(zhCn.table.export.csvTitle).toBe('导出 CSV')
      expect(zhCn.table.filter.contains).toBe('包含')
      expect(zhCn.form.selectPlaceholder).toBe('请选择')
    })
  })

  describe('cross-lang structure', () => {
    it('both have same top-level keys', () => {
      const enKeys = Object.keys(en).filter(k => k !== 'currency')
      const zhKeys = Object.keys(zhCn).filter(k => k !== 'currency')
      expect(enKeys).toEqual(zhKeys)
    })
  })
})
