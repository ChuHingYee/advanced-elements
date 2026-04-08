import type { RenderDataIndex, VisibleDataIndex } from '../types/config-tree'

/**
 * <zh/> 行索引域换算（rowPin 双域）——visibleData 域（含固定行）→ renderData 域（剔除固定行）。
 *
 * <zh/> 域布局：`visibleData = [顶部固定行(topPinnedCount)…, 滚动行(renderRowCount)…, 底部固定行…]`。
 * <zh/> 指向固定行的 visible 索引无法换算，返回 undefined（调用方须处理，而非静默验错行）。
 * <en/> Row-index domain conversion (rowPin dual domains) — visibleData domain (with pinned rows) → renderData domain (pinned rows excluded).
 *
 * <en/> Layout: `visibleData = [top pins(topPinnedCount)…, scroll rows(renderRowCount)…, bottom pins…]`.
 * <en/> A visible index pointing at a pinned row cannot convert — returns undefined (callers must handle it instead of silently validating the wrong row).
 */
export function toRenderDataIndex(
  visibleIndex: number,
  topPinnedCount: number,
  renderRowCount: number,
): RenderDataIndex | undefined {
  if (!Number.isInteger(visibleIndex) || visibleIndex < 0)
    return undefined
  const renderIndex = visibleIndex - Math.max(0, topPinnedCount)
  if (renderIndex < 0 || renderIndex >= renderRowCount)
    return undefined
  return renderIndex as RenderDataIndex
}

/**
 * <zh/> 行索引域换算——renderData 域 → visibleData 域（顶部固定行偏移）。
 * <en/> Row-index domain conversion — renderData domain → visibleData domain (top-pin offset).
 */
export function toVisibleDataIndex(
  renderIndex: number,
  topPinnedCount: number,
): VisibleDataIndex | undefined {
  if (!Number.isInteger(renderIndex) || renderIndex < 0)
    return undefined
  return (renderIndex + Math.max(0, topPinnedCount)) as VisibleDataIndex
}
