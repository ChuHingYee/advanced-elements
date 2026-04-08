import type { TableContext } from '../../src/types/config'
/**
 * @file value-format 值格式化工具测试
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CURRENCY,
  formatDate,
  formatDigit,
  formatFromNow,
  formatMoney,
  formatPercent,
  getCurrency,
  getDayjsLocale,
  VALUE_TYPE_TEXT_FORMATTERS,
} from '../../src/utils/value-format'

describe('value-format', () => {
  describe('getCurrency', () => {
    it('returns default currency when context is null', () => {
      expect(getCurrency(null)).toEqual(DEFAULT_CURRENCY)
    })

    it('returns default currency when context is undefined', () => {
      expect(getCurrency()).toEqual(DEFAULT_CURRENCY)
    })

    it('returns context currency when available', () => {
      const ctx = { currency: { value: { symbol: '$', locale: 'en-US' } } } as unknown as TableContext
      expect(getCurrency(ctx)).toEqual({ symbol: '$', locale: 'en-US' })
    })
  })

  describe('getDayjsLocale', () => {
    it('returns zh-cn as default', () => {
      expect(getDayjsLocale()).toBe('zh-cn')
    })

    it('returns zh-cn when context is null', () => {
      expect(getDayjsLocale(null)).toBe('zh-cn')
    })

    it('returns context locale when available', () => {
      const ctx = { dayjsLocale: { value: 'en' } } as unknown as TableContext
      expect(getDayjsLocale(ctx)).toBe('en')
    })
  })

  describe('formatDate', () => {
    it('returns empty string for falsy value', () => {
      expect(formatDate(null, 'date')).toBe('')
      expect(formatDate(undefined, 'date')).toBe('')
      expect(formatDate('', 'date')).toBe('')
    })

    it('formats date value', () => {
      const result = formatDate('2024-01-15', 'date')
      expect(result).toBe('2024-01-15')
    })

    it('formats dateTime value', () => {
      const result = formatDate('2024-01-15 10:30:00', 'dateTime')
      expect(result).toBe('2024-01-15 10:30:00')
    })

    it('formats time value', () => {
      const result = formatDate('10:30:00', 'time')
      expect(result).toBe('10:30:00')
    })

    it('formats dateRange value', () => {
      const result = formatDate(['2024-01-01', '2024-12-31'], 'dateRange')
      expect(result).toBe('2024-01-01 ~ 2024-12-31')
    })

    it('formats year value', () => {
      const result = formatDate('2024', 'year')
      expect(result).toBe('2024')
    })

    it('returns String(value) for non-array range value', () => {
      const result = formatDate('not-an-array', 'dateRange')
      expect(result).toBe('not-an-array')
    })

    it('returns String(value) for invalid date', () => {
      const result = formatDate('invalid-date', 'date')
      expect(result).toBe('invalid-date')
    })
  })

  describe('formatMoney', () => {
    it('returns empty string for null/undefined', () => {
      expect(formatMoney(null)).toBe('')
      expect(formatMoney(undefined)).toBe('')
    })

    it('returns String(value) for NaN', () => {
      expect(formatMoney('not-a-number')).toBe('not-a-number')
    })

    it('formats number with default currency', () => {
      const result = formatMoney(1234.5)
      expect(result).toBe('¥1,234.50')
    })

    it('formats number with custom currency', () => {
      const ctx = { currency: { value: { symbol: '$', locale: 'en-US' } } } as unknown as TableContext
      const result = formatMoney(1234.5, ctx)
      expect(result).toBe('$1,234.50')
    })
  })

  describe('formatPercent', () => {
    it('returns empty string for null/undefined', () => {
      expect(formatPercent(null)).toBe('')
      expect(formatPercent(undefined)).toBe('')
    })

    it('returns String(value) for NaN', () => {
      expect(formatPercent('not-a-number')).toBe('not-a-number')
    })

    it('appends % suffix', () => {
      expect(formatPercent(0.25)).toBe('0.25%')
      expect(formatPercent(100)).toBe('100%')
      expect(formatPercent(0)).toBe('0%')
    })
  })

  describe('formatDigit', () => {
    it('returns empty string for null/undefined', () => {
      expect(formatDigit(null)).toBe('')
      expect(formatDigit(undefined)).toBe('')
    })

    it('returns String(value) for NaN', () => {
      expect(formatDigit('not-a-number')).toBe('not-a-number')
    })

    it('formats number with thousand separators', () => {
      expect(formatDigit(1234567)).toBe('1,234,567')
    })
  })

  describe('formatFromNow', () => {
    it('returns empty string for falsy value', () => {
      expect(formatFromNow(null)).toBe('')
      expect(formatFromNow('')).toBe('')
    })

    it('returns String(value) for invalid date', () => {
      const result = formatFromNow('not-a-date')
      expect(result).toBe('not-a-date')
    })
  })

  describe('vALUE_TYPE_TEXT_FORMATTERS', () => {
    it('has all required formatters', () => {
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('money')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('digit')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('percent')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('date')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('dateTime')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('time')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('dateRange')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('dateTimeRange')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('monthRange')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('year')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('yearRange')
      expect(VALUE_TYPE_TEXT_FORMATTERS).toHaveProperty('fromNow')
    })

    it('money formatter delegates to formatMoney', () => {
      expect(VALUE_TYPE_TEXT_FORMATTERS.money(1234.5)).toBe('¥1,234.50')
    })

    it('percent formatter delegates to formatPercent', () => {
      expect(VALUE_TYPE_TEXT_FORMATTERS.percent(0.25)).toBe('0.25%')
    })

    it('date formatter delegates to formatDate', () => {
      expect(VALUE_TYPE_TEXT_FORMATTERS.date('2024-01-15')).toBe('2024-01-15')
    })
  })
})
