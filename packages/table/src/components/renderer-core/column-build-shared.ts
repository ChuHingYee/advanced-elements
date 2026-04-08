/**
 * <zh/> 双端列构建共享谓词。teleport 判定（`valueType === 'option' && hoverActions`）与行尾
 * <zh/> hover 规则必须单点定义：两端各算一次会让 `fixed` 偏移在渲染侧与事件侧错位。
 * <en/> Shared column-build predicates for the default and virtual column builders. Both the
 * <en/> teleport predicate and the inline-hover rule must be defined once: computing them
 * <en/> twice lets the `fixed` offset drift between the render and event sides.
 */

import type { ProcessedColumn } from '../../types'

/**
 * Whether a column is a teleport-rendered hover action column, excluded from the inline
 * column list while teleport hover is active. 是否为 teleport 悬浮操作列,teleport 生效时不内联渲染.
 *
 * valueType/hoverActions live on the runtime column object (declared on AdvColumn, omitted from
 * the processed type), so they are read through a local structural view.
 */
export function isTeleportHoverColumn(col: ProcessedColumn): boolean {
  // Truthy check mirrors the four inlined sites exactly (empty arrays stay truthy).
  // 真值判定与原四处内联完全一致(空数组仍为真值).
  const view = col as { valueType?: unknown, hoverActions?: unknown }
  return view.valueType === 'option' && !!view.hoverActions
}

/**
 * Whether the inline hover cell marker applies: only the last normal column while hover
 * option columns exist. 行尾 hover 标记是否生效:仅末列普通列且存在 hover 操作列时.
 */
export function shouldShowInlineHover(colIndex: number, normalCount: number, hasHover: boolean): boolean {
  return hasHover && normalCount > 0 && colIndex === normalCount - 1
}

/**
 * <zh/> 事件/渲染统一列域过滤（单一源）：teleport 生效时剔除 teleport 悬浮操作列，
 * <zh/> 未生效时原样返回同一引用。渲染侧（normal-v2-column）与事件侧
 * <zh/>（allVirtualLeafColumns / useVirtualRenderer displayColumns）必须共用本函数，
 * <zh/> 不得各自另算一次，否则 data-adv-cell-col 索引与事件解析错位。
 * <en/> Single-source column-domain filter .
 */
export function filterTeleportHoverColumns<T extends ProcessedColumn>(cols: readonly T[], isTeleport: boolean | undefined): T[] {
  if (!isTeleport)
    return cols as T[]
  return cols.filter(col => !isTeleportHoverColumn(col))
}

/**
 * <zh/> autoSize 拉伸参与列的下限宽度
 * <en/> Lower-bound width for a column participating in autoSize stretch
 *
 * @remarks
 * <zh/> 取值规则：`minWidth` 与 `width` 同在取较大值，只一者取该值，皆无则返回 undefined
 * <zh/> 由调用方按渲染器口径兜底（default 交 ElTable 自动计算；virtual 必须下发数值默认宽，否则三行错位）。
 * <zh/> 守卫：非有限 number（undefined / string / NaN）一律视为"无 minWidth 约束"，避免 `Math.max(x, NaN)` 产出 `width: NaNpx`。
 * <en/> Rule: with both `minWidth` and `width` present, take the larger; with one, take it; with neither, return undefined
 * <en/> and let the caller fall back per renderer (default → ElTable auto; virtual → numeric default, else rows drift).
 * <en/> Guard: non-finite numbers (undefined / string / NaN) are treated as "no minWidth constraint" to avoid `Math.max(x, NaN)` yielding `width: NaNpx`.
 *
 * @returns <zh/> 下限宽度；undefined 表示该列无任何宽度约束 | <en/> the lower-bound width, or undefined when no constraint
 */
export function resolveStretchLowerBound(col: ProcessedColumn): number | undefined {
  // <zh/> 非有限 number（undefined / string / NaN）一律不参与下限计算，避免 Math.max 产出 NaN
  // <en/> Non-finite numbers (undefined / string / NaN) never take part, keeping Math.max NaN-free
  const rawMin = col.minWidth
  const min = typeof rawMin === 'number' && Number.isFinite(rawMin) ? rawMin : undefined
  const width = typeof col.width === 'number' && Number.isFinite(col.width) ? col.width : undefined
  if (min !== undefined && width !== undefined)
    return Math.max(width, min)
  return min ?? width
}
