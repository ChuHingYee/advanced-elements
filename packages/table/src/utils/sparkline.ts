import type { VNode } from 'vue'
import { h } from 'vue'

/**
 * @file sparkline.ts
 * @description
 * <zh/> 迷你趋势图（sparkline）纯计算 + VNode 构造——供 `valueType: 'sparkline'` 列渲染。
 *
 * <zh/> 设计要点：
 * <zh/> 1. 几何计算独立为纯函数（buildSparklinePoints），可直接单测；
 * <zh/> 2. 数值归一化到 [pad, size-pad] 区间，全等值序列退化为中线；
 * <zh/> 3. 非数值项剔除后不足 2 个点时不渲染（调用方得到空串/VNode 由上层兜底）。
 *
 * <en/> Sparkline pure geometry + VNode construction — for `valueType: 'sparkline'` columns.
 *
 * <en/> Design notes:
 * <en/> 1. Geometry is an isolated pure function (buildSparklinePoints), directly unit-testable;
 * <en/> 2. Values normalize into [pad, size-pad]; an all-equal series degrades to the midline;
 * <en/> 3. Fewer than 2 numeric points renders nothing (caller falls back).
 */

/** <zh/> sparkline 渲染选项 | <en/> Sparkline rendering options */
export interface SparklineOptions {
  /** <zh/> 宽度（px），默认 96 | <en/> width in px, default 96 */
  width?: number
  /** <zh/> 高度（px），默认 24 | <en/> height in px, default 24 */
  height?: number
  /** <zh/> 折线颜色，默认 Element Plus 主色 | <en/> stroke color, defaults to EP primary */
  color?: string
}

const DEFAULT_WIDTH = 96
const DEFAULT_HEIGHT = 24
const PAD = 2

/**
 * <zh/> 从任意单元格数据中提取有效数值序列（非有限数剔除）。
 * <en/> Extract the valid numeric series from arbitrary cell data (non-finite values dropped).
 */
export function toNumberSeries(cellData: unknown): number[] {
  if (!Array.isArray(cellData))
    return []
  return cellData.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
}

/**
 * <zh/> 计算折线 points 字符串（SVG polyline 格式 "x1,y1 x2,y2 ..."）。
 * <zh/> 全等值序列退化为垂直中线的水平线段。
 * <en/> Compute the SVG polyline points string ("x1,y1 x2,y2 ...").
 * <en/> An all-equal series degrades to a horizontal segment on the vertical midline.
 */
export function buildSparklinePoints(
  values: readonly number[],
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
): string {
  if (values.length < 2)
    return ''

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const innerW = width - PAD * 2
  const innerH = height - PAD * 2

  const step = values.length > 1 ? innerW / (values.length - 1) : 0
  const parts: string[] = []
  for (let i = 0; i < values.length; i++) {
    const x = (PAD + step * i).toFixed(2)
    const y = span === 0 ? (height / 2).toFixed(2) : (PAD + innerH - ((values[i]! - min) / span) * innerH).toFixed(2)
    parts.push(`${x},${y}`)
  }
  return parts.join(' ')
}

/**
 * <zh/> 构造 sparkline VNode——点数不足时返回空字符串节点占位。
 * <en/> Build the sparkline VNode — returns an empty-string node when there are too few points.
 */
export function renderSparkline(cellData: unknown, options?: SparklineOptions): VNode | string {
  const values = toNumberSeries(cellData)
  if (values.length < 2)
    return ''

  const width = options?.width ?? DEFAULT_WIDTH
  const height = options?.height ?? DEFAULT_HEIGHT
  const points = buildSparklinePoints(values, width, height)

  return h('svg', {
    'class': 'adv-table__sparkline',
    width,
    height,
    'viewBox': `0 0 ${width} ${height}`,
    'aria-hidden': 'true',
  }, [
    h('polyline', {
      points,
      'fill': 'none',
      'stroke': options?.color ?? 'var(--el-color-primary)',
      'stroke-width': 1.5,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }),
  ])
}
