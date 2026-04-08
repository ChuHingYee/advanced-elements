import { afterEach, describe, expect, it, vi } from 'vitest'
import { compareSortValues } from '../../src/utils/sort-comparator'

/**
 * <zh/> `compareSortValues` 全分支覆盖——null 归一、Date/数字/字符串三通道、乘数归一，
 * <zh/> 以及无 Intl 环境的回退路径（经模块隔离动态导入，避免污染 collator 缓存）。
 * <en/> Full-branch coverage for `compareSortValues` — null unification, Date/number/string
 * <en/> channels, multiplier normalization, and the no-Intl fallback (via isolated dynamic
 * <en/> imports so the collator cache is never poisoned).
 */
describe('compareSortValues', () => {
  describe('null and undefined always sort last, independent of direction', () => {
    it.each([
      [1, 'ascending'],
      [-1, 'descending'],
    ])('returns 0 for two nullish values (multiplier %i)', (multiplier) => {
      expect(compareSortValues(null, null, multiplier)).toBe(0)
      expect(compareSortValues(undefined, undefined, multiplier)).toBe(0)
      expect(compareSortValues(null, undefined, multiplier)).toBe(0)
    })

    it.each([[1], [-1]])('nullish vs value is direction-independent (multiplier %i)', (multiplier) => {
      expect(compareSortValues(null, { id: 1 }, multiplier)).toBe(1)
      expect(compareSortValues({ id: 1 }, null, multiplier)).toBe(-1)
      expect(compareSortValues(undefined, 0, multiplier)).toBe(1)
      expect(compareSortValues(0, undefined, multiplier)).toBe(-1)
    })
  })

  describe('date pairs compare by timestamp', () => {
    const earlier = new Date(2020, 0, 1)
    const later = new Date(2020, 0, 2)

    it('orders by time in ascending mode', () => {
      expect(compareSortValues(earlier, later, 1)).toBeLessThan(0)
      expect(compareSortValues(later, earlier, 1)).toBeGreaterThan(0)
    })

    it('flips in descending mode and ties equal instants', () => {
      expect(compareSortValues(earlier, later, -1)).toBeGreaterThan(0)
      expect(compareSortValues(new Date(2020, 0, 1), new Date(2020, 0, 1), 1)).toBe(0)
    })

    it('falls back to locale-aware string comparison for Date/string mixes', () => {
      // <zh/> 混合不断言日期语义，只锁定"走字符串分支、有确定序" | <en/> Mixes assert no date semantics, only "string branch with a deterministic order"
      expect(compareSortValues(new Date(2020, 5, 15), '1999-01-01', 1)).toBeGreaterThan(0)
    })
  })

  describe('numbers use arithmetic subtraction with a NaN guard', () => {
    it('orders numbers and flips with direction', () => {
      expect(compareSortValues(1, 2, 1)).toBeLessThan(0)
      expect(compareSortValues(2, 1, 1)).toBeGreaterThan(0)
      expect(compareSortValues(2, 1, -1)).toBeLessThan(0)
      expect(compareSortValues(5, 5, 1)).toBe(0)
    })

    it('treats NaN as equal instead of leaking NaN', () => {
      expect(compareSortValues(Number.NaN, 1, 1)).toBe(0)
      expect(compareSortValues(1, Number.NaN, 1)).toBe(0)
      expect(compareSortValues(Number.NaN, Number.NaN, -1)).toBe(0)
    })
  })

  describe('multiplier is normalized to ±1', () => {
    it.each([[0], [Number.NaN], [Number.POSITIVE_INFINITY], [2]])('clamps %s to ascending', (multiplier) => {
      expect(compareSortValues(1, 2, multiplier)).toBeLessThan(0)
      expect(compareSortValues(2, 1, multiplier)).toBeGreaterThan(0)
    })
  })

  describe('strings prefer Intl.Collator', () => {
    it('orders locale-aware and flips with direction', () => {
      expect(compareSortValues('apple', 'banana', 1)).toBeLessThan(0)
      expect(compareSortValues('banana', 'apple', 1)).toBeGreaterThan(0)
      expect(compareSortValues('banana', 'apple', -1)).toBeLessThan(0)
      expect(compareSortValues('same', 'same', 1)).toBe(0)
    })

    it('stringifies objects instead of throwing', () => {
      expect(compareSortValues({}, {}, 1)).toBe(0)
    })
  })

  describe('without Intl (isolated module instances)', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('falls back to lexicographic comparison when Intl is unavailable', async () => {
      vi.resetModules()
      vi.stubGlobal('Intl', undefined)
      const fresh = await import('../../src/utils/sort-comparator')
      expect(fresh.compareSortValues('b', 'a', 1)).toBeGreaterThan(0)
      expect(fresh.compareSortValues('a', 'b', 1)).toBeLessThan(0)
      expect(fresh.compareSortValues('a', 'a', 1)).toBe(0)
    })

    it('falls back when Collator construction throws', async () => {
      vi.resetModules()
      vi.stubGlobal('Intl', {
        Collator: class {
          constructor() {
            throw new Error('restricted ICU')
          }
        },
      } as any)
      const fresh = await import('../../src/utils/sort-comparator')
      expect(fresh.compareSortValues('b', 'a', 1)).toBeGreaterThan(0)
    })
  })
})
