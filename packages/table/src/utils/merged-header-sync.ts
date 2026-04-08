/**
 * @file merged-header-sync.ts
 * @description
 * <zh/> 合并表头样式失步检测 — 检测合并/分组表头 DOM 几何与期望几何不一致的失步情况。
 *
 * <zh/> 背景：virtual 模式的多级表头（v2-header.tsx）按 `leafWidths` 计算分组头宽度
 * （分组宽 = 其叶子宽之和），表体 V2 列按同一 `getColumnWidth` 装配；default 模式的
 * 分组头由 ElTable 按列配置原生渲染。列拖拽 / 折叠 / 自适应拉伸 / 弹层关闭 / KeepAlive
 * 复活等事件后，EP 内部的表头行宽（`width - vScrollbarSize`）与表体列宽可能短暂分叉，
 * 表现为「分组头宽度 ≠ 其叶子和」或「表头格与同列首行体格像素错位」（>1px 即肉眼可见
 * 的边框/底色错位）。此时与虚拟滚动失步同理：以体格实测为准回写表头即可零跳变自愈。
 *
 * <zh/> 检测方式：调用方传入同一列序下「表头格实测宽」与「体格实测宽」（分组头传其跨度内
 * 体格和），差值超过容差（默认 1px，边框取整的最小可见单位）即判定失步。
 * 本模块只做纯判定（零 DOM 访问），DOM 读取与回写由 `use-header-style-reconcile` 承载，
 * 与 `utils/virtual-scroll-sync.ts`（滚动失步纯判定）保持同一拆分口径。
 *
 * <en/> Merged-header style desync detection — detects when merged/grouped header DOM
 * <en/> geometry diverges from the expected geometry.
 *
 * <en/> Background: virtual-mode multi-level headers (v2-header.tsx) size group headers
 * <en/> from `leafWidths` (group width = sum of its leaves) while body V2 columns assemble
 * <en/> from the same `getColumnWidth`; default-mode group headers render natively from the
 * <en/> column config. After column resize / collapse / stretch / overlay close / KeepAlive
 * <en/> reactivation, EP's header-row width (`width - vScrollbarSize`) can briefly fork from
 * <en/> the body column widths — visible as "group width ≠ sum of its leaves" or "header cell
 * <en/> vs first body cell pixel drift" (>1px shows as border/background seams). Like virtual
 * <en/> scroll desync, healing rewrites the header from the measured body with zero jump.
 *
 * <en/> Detection: callers pass same-order "measured header widths" vs "measured body widths"
 * <en/> (group headers pass the spanned body sum); a gap beyond tolerance (default 1px, the
 * <en/> smallest visible unit after border rounding) counts as desync. This module is pure
 * <en/> detection (zero DOM access); DOM reads/writes live in `use-header-style-reconcile`,
 * <en/> mirroring the `utils/virtual-scroll-sync.ts` (scroll desync pure detection) split.
 */

/** <zh/> 表头样式失步容差（px）——边框取整后的最小可见单位 | <en/> Header-style desync tolerance (px) — smallest visible unit after border rounding */
export const HEADER_STYLE_DESYNC_TOLERANCE = 1

/**
 * <zh/> 单列失步快照——同一列序下表头格与体格的实测宽 | <en/> Per-column desync snapshot — measured header vs body widths in the same column order
 */
export interface MergedHeaderWidthSnapshot {
  /** <zh/> 表头格实测宽（offsetWidth / rect.width，px） | <en/> Measured header cell width (offsetWidth / rect.width, px) */
  headerWidth: number
  /** <zh/> 同列体格实测宽（首行体格，px；分组头为其跨度内体格和） | <en/> Same-column body width (first body row, px; group headers pass the spanned body sum) */
  bodyWidth: number
}

/**
 * <zh/> 检测合并表头宽度是否失步
 * <en/> Detect whether merged-header widths are desynced
 *
 * @param snapshots - <zh/> 同一列序的表头/体格宽度快照 | <en/> header/body width snapshots in the same column order
 * @param tolerance - <zh/> 容差（px，默认 1） | <en/> tolerance (px, defaults to 1)
 * @returns <zh/> 失步的列下标（空数组 = 对齐） | <en/> desynced column indexes (empty = aligned)
 */
export function detectMergedHeaderDesync(
  snapshots: MergedHeaderWidthSnapshot[],
  tolerance: number = HEADER_STYLE_DESYNC_TOLERANCE,
): number[] {
  if (!Array.isArray(snapshots) || snapshots.length === 0)
    return []
  if (!Number.isFinite(tolerance) || tolerance < 0)
    return []
  const miss: number[] = []
  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i]!
    if (!Number.isFinite(s.headerWidth) || !Number.isFinite(s.bodyWidth))
      continue
    if (s.headerWidth <= 0 || s.bodyWidth <= 0)
      continue
    if (Math.abs(s.headerWidth - s.bodyWidth) > tolerance)
      miss.push(i)
  }
  return miss
}

/**
 * <zh/> 检测分组头宽度是否等于其叶子宽之和（期望几何自洽性）
 * <en/> Detect whether a group header width equals the sum of its leaf widths (expected-geometry consistency)
 *
 * @param groupWidth - <zh/> 分组头实测宽（px） | <en/> measured group header width (px)
 * @param leafWidths - <zh/> 其跨度内叶子实测宽（px） | <en/> measured leaf widths within its span (px)
 * @param tolerance - <zh/> 容差（px，默认 1） | <en/> tolerance (px, defaults to 1)
 * @returns <zh/> true = 失步 | <en/> true = desynced
 */
export function isGroupHeaderDesynced(
  groupWidth: number,
  leafWidths: number[],
  tolerance: number = HEADER_STYLE_DESYNC_TOLERANCE,
): boolean {
  if (!Number.isFinite(groupWidth) || groupWidth <= 0)
    return false
  if (!Array.isArray(leafWidths) || leafWidths.length === 0)
    return false
  if (!leafWidths.every(Number.isFinite))
    return false
  if (!Number.isFinite(tolerance) || tolerance < 0)
    return false
  const sum = leafWidths.reduce((a, b) => a + b, 0)
  return Math.abs(groupWidth - sum) > tolerance
}
