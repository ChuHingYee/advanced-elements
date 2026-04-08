import { describe, expect, it } from 'vitest'
import { buildSparklinePoints, renderSparkline, toNumberSeries } from '../../src/utils/sparkline'

/**
 * <zh/> Sparkline 纯函数契约测试——几何归一化、退化序列、非数值剔除与 VNode 结构。
 * <en/> Sparkline pure-function contract tests — geometry normalization, degenerate series,
 * <en/> non-numeric filtering and VNode structure.
 */
describe('toNumberSeries', () => {
  it('keeps only finite numbers', () => {
    expect(toNumberSeries([1, 'x', 2.5, null, Number.NaN, 3])).toEqual([1, 2.5, 3])
  })
  it('returns an empty array for non-array cell data', () => {
    expect(toNumberSeries('1,2,3')).toEqual([])
    expect(toNumberSeries(undefined)).toEqual([])
  })
})

describe('buildSparklinePoints', () => {
  it('normalizes values into the padded box', () => {
    const points = buildSparklinePoints([0, 10], 100, 20)
    expect(points).toBe('2.00,18.00 98.00,2.00')
  })

  it('degenerates to the vertical midline for an all-equal series', () => {
    const points = buildSparklinePoints([5, 5, 5], 96, 24)
    expect(points).toBe('2.00,12.00 48.00,12.00 94.00,12.00')
  })

  it('returns empty for fewer than two points', () => {
    expect(buildSparklinePoints([1])).toBe('')
    expect(buildSparklinePoints([])).toBe('')
  })
})

describe('renderSparkline', () => {
  it('renders an svg polyline for a valid series', () => {
    const node = renderSparkline([1, 2, 3], { width: 60, height: 20 })
    expect(typeof node).toBe('object')
    const vnode = node as any
    expect(vnode.type).toBe('svg')
    expect(JSON.stringify(vnode.props)).toContain('viewBox')
  })

  it('falls back to an empty string when data is insufficient', () => {
    expect(renderSparkline([7])).toBe('')
    expect(renderSparkline(undefined)).toBe('')
  })
})
