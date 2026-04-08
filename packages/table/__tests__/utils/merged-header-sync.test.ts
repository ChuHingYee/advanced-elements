import { describe, expect, it } from 'vitest'
import { detectMergedHeaderDesync, HEADER_STYLE_DESYNC_TOLERANCE, isGroupHeaderDesynced } from '../../src/utils/merged-header-sync'

describe('merged-header-sync', () => {
  it('exposes a 1px tolerance matching the smallest visible border-rounding unit', () => {
    expect(HEADER_STYLE_DESYNC_TOLERANCE).toBe(1)
  })

  it('returns empty when header and body widths align', () => {
    expect(detectMergedHeaderDesync([
      { headerWidth: 150, bodyWidth: 150 },
      { headerWidth: 200, bodyWidth: 200 },
    ])).toEqual([])
  })

  it('ignores sub-pixel rounding drift within tolerance', () => {
    expect(detectMergedHeaderDesync([
      { headerWidth: 150.6, bodyWidth: 150 },
    ])).toEqual([])
  })

  it('flags columns whose drift exceeds tolerance with their indexes', () => {
    expect(detectMergedHeaderDesync([
      { headerWidth: 150, bodyWidth: 150 },
      { headerWidth: 144, bodyWidth: 150 },
      { headerWidth: 200, bodyWidth: 206 },
    ])).toEqual([1, 2])
  })

  it('skips non-finite and non-positive measurements instead of flagging', () => {
    expect(detectMergedHeaderDesync([
      { headerWidth: Number.NaN, bodyWidth: 150 },
      { headerWidth: 0, bodyWidth: 150 },
      { headerWidth: 150, bodyWidth: Number.POSITIVE_INFINITY },
    ])).toEqual([])
  })

  it('returns empty for empty input and invalid tolerance', () => {
    expect(detectMergedHeaderDesync([])).toEqual([])
    expect(detectMergedHeaderDesync([{ headerWidth: 100, bodyWidth: 150 }], Number.NaN)).toEqual([])
    expect(detectMergedHeaderDesync([{ headerWidth: 100, bodyWidth: 150 }], -1)).toEqual([])
  })

  it('treats a group width equal to its leaves sum as aligned', () => {
    expect(isGroupHeaderDesynced(300, [150, 150])).toBe(false)
  })

  it('flags a group width drifting from its leaves sum', () => {
    expect(isGroupHeaderDesynced(294, [150, 150])).toBe(true)
  })

  it('returns false for degenerate group inputs instead of flagging', () => {
    expect(isGroupHeaderDesynced(0, [150])).toBe(false)
    expect(isGroupHeaderDesynced(300, [])).toBe(false)
    expect(isGroupHeaderDesynced(Number.NaN, [150])).toBe(false)
    expect(isGroupHeaderDesynced(300, [Number.NaN])).toBe(false)
  })
})
