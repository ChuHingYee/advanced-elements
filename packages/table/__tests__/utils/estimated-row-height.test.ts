import { describe, expect, it } from 'vitest'
import { parseExplicitHeightPx, resolveEffectiveEstimatedRowHeight } from '@/utils/estimated-row-height'

describe('2-2 resident dynamic row height (phase 2)', () => {
  it('explicit estimatedRowHeight always wins', () => {
    expect(resolveEffectiveEstimatedRowHeight({
      estimatedRowHeight: 60,
      spanEnabled: false,
      hasAppendSlot: false,
      expandCapable: false,
      hasExpandDetailRows: false,
      rowHeight: 48,
    })).toBe(60)
  })

  it('non-span tables stay resident-dynamic once expand is capable (no flip on expand/collapse)', () => {
    const base = {
      estimatedRowHeight: undefined,
      spanEnabled: false,
      hasAppendSlot: false,
      rowHeight: 48,
    }
    // 能力就绪即动态——实际展开与否不改变网格类型
    expect(resolveEffectiveEstimatedRowHeight({ ...base, expandCapable: true, hasExpandDetailRows: false })).toBe(48)
    expect(resolveEffectiveEstimatedRowHeight({ ...base, expandCapable: true, hasExpandDetailRows: true })).toBe(48)
  })

  it('pure display tables stay fixed with zero measurement cost', () => {
    expect(resolveEffectiveEstimatedRowHeight({
      estimatedRowHeight: undefined,
      spanEnabled: false,
      hasAppendSlot: false,
      expandCapable: false,
      hasExpandDetailRows: false,
      rowHeight: 48,
    })).toBeUndefined()
  })

  it('append slot forces dynamic grid in both span and non-span tables', () => {
    expect(resolveEffectiveEstimatedRowHeight({
      estimatedRowHeight: undefined,
      spanEnabled: false,
      hasAppendSlot: true,
      expandCapable: false,
      hasExpandDetailRows: false,
      rowHeight: 48,
    })).toBe(48)
    expect(resolveEffectiveEstimatedRowHeight({
      estimatedRowHeight: undefined,
      spanEnabled: true,
      hasAppendSlot: true,
      expandCapable: false,
      hasExpandDetailRows: false,
      rowHeight: 48,
    })).toBe(48)
  })

  it('pure span tables stay lazy (EP clips rowspan in dynamic grids)', () => {
    expect(resolveEffectiveEstimatedRowHeight({
      estimatedRowHeight: undefined,
      spanEnabled: true,
      hasAppendSlot: false,
      expandCapable: true,
      hasExpandDetailRows: false,
      rowHeight: 48,
    })).toBeUndefined()
    // 实际展开才强制进入（伴随 span×dynamic 告警）
    expect(resolveEffectiveEstimatedRowHeight({
      estimatedRowHeight: undefined,
      spanEnabled: true,
      hasAppendSlot: false,
      expandCapable: true,
      hasExpandDetailRows: true,
      rowHeight: 48,
    })).toBe(48)
  })
})

describe('parseExplicitHeightPx', () => {
  it('adopts positive numbers as-is', () => {
    expect(parseExplicitHeightPx(400)).toBe(400)
    expect(parseExplicitHeightPx(320.5)).toBe(320.5)
  })

  it('parses pure px strings', () => {
    expect(parseExplicitHeightPx('400px')).toBe(400)
    expect(parseExplicitHeightPx(' 320.5px ')).toBe(320.5)
  })

  it('rejects non-positive and garbage values', () => {
    expect(parseExplicitHeightPx(0)).toBeUndefined()
    expect(parseExplicitHeightPx(-10)).toBeUndefined()
    expect(parseExplicitHeightPx('0px')).toBeUndefined()
    expect(parseExplicitHeightPx('50abc')).toBeUndefined()
    expect(parseExplicitHeightPx('')).toBeUndefined()
  })

  it('leaves relative units and missing values to the AutoResizer', () => {
    expect(parseExplicitHeightPx(undefined)).toBeUndefined()
    expect(parseExplicitHeightPx('50vh')).toBeUndefined()
    expect(parseExplicitHeightPx('100%')).toBeUndefined()
    expect(parseExplicitHeightPx('calc(100vh - 200px)')).toBeUndefined()
  })
})
