import { describe, expect, it } from 'vitest'
import { isShorthandRowSpanConfig, pickSpanPart } from '../../src/utils/span-config-helpers'

describe('isShorthandRowSpanConfig', () => {
  it('returns false for non-object values', () => {
    expect(isShorthandRowSpanConfig(null)).toBe(false)
    expect(isShorthandRowSpanConfig(undefined)).toBe(false)
    expect(isShorthandRowSpanConfig('foo')).toBe(false)
    expect(isShorthandRowSpanConfig(123)).toBe(false)
    expect(isShorthandRowSpanConfig(true)).toBe(false)
  })

  it('returns true for plain object without rows/cols/ranges keys (shorthand form)', () => {
    expect(isShorthandRowSpanConfig({})).toBe(true)
    expect(isShorthandRowSpanConfig({ a: 1 })).toBe(true)
    expect(isShorthandRowSpanConfig({ '*': ['name'] })).toBe(true)
  })

  it('returns false when "rows" key is present (full form)', () => {
    expect(isShorthandRowSpanConfig({ rows: {} })).toBe(false)
  })

  it('returns false when "cols" key is present (full form)', () => {
    expect(isShorthandRowSpanConfig({ cols: {} })).toBe(false)
  })

  it('returns false when "ranges" key is present (full form)', () => {
    expect(isShorthandRowSpanConfig({ ranges: [] })).toBe(false)
  })

  it('returns false when all full-form keys are present', () => {
    expect(isShorthandRowSpanConfig({ rows: {}, cols: {}, ranges: [] })).toBe(false)
  })
})

describe('pickSpanPart', () => {
  it('returns undefined when config is undefined', () => {
    expect(pickSpanPart(undefined, 'rows')).toBeUndefined()
    expect(pickSpanPart(undefined, 'cols')).toBeUndefined()
    expect(pickSpanPart(undefined, 'ranges')).toBeUndefined()
  })

  it('returns the rows part for shorthand config', () => {
    const shorthand = { '*': ['name'] } as any
    expect(pickSpanPart(shorthand, 'rows')).toBe(shorthand)
  })

  it('returns undefined for cols/ranges parts when config is shorthand', () => {
    const shorthand = { '*': ['name'] } as any
    expect(pickSpanPart(shorthand, 'cols')).toBeUndefined()
    expect(pickSpanPart(shorthand, 'ranges')).toBeUndefined()
  })

  it('extracts rows from full-form config', () => {
    const rows = { '*': ['name'] }
    const config = { rows, cols: {}, ranges: [] }
    expect(pickSpanPart(config, 'rows')).toBe(rows)
  })

  it('extracts cols from full-form config', () => {
    const cols = { name: ['age'] }
    const config = { rows: {}, cols, ranges: [] }
    expect(pickSpanPart(config, 'cols')).toBe(cols)
  })

  it('extracts ranges from full-form config', () => {
    const ranges = [{ start: [0, 0], end: [1, 1] }]
    const config = { rows: {}, cols: {}, ranges }
    expect(pickSpanPart(config, 'ranges')).toBe(ranges)
  })

  it('returns undefined for missing part in full-form config', () => {
    const config = { rows: { '*': ['name'] } }
    expect(pickSpanPart(config, 'cols')).toBeUndefined()
    expect(pickSpanPart(config, 'ranges')).toBeUndefined()
  })
})
