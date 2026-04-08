/**
 * @file total-rows.ts
 * @description
 * <zh/> Grand Total / Group Total 合成行工具——对齐 AG Grid aggregation-total-rows：
 * <zh/> grandTotalRow（top/bottom/pinnedTop/pinnedBottom）、groupTotalRow（top/bottom/回调）、
 * <zh/> totalValueGetter、groupSuppressBlankHeader、suppressStickyTotalRow。
 * <zh/> 本文件仅含纯函数（行标记、位置决议、标签决议、粘性决议、合成行工厂），
 * <zh/> 不依赖 Vue，可被管线 composable 与渲染器双向复用。
 *
 * <en/> Grand / group total synthetic-row utilities — aligned with AG Grid aggregation-total-rows:
 * <en/> grandTotalRow (top/bottom/pinnedTop/pinnedBottom), groupTotalRow (top/bottom/callback),
 * <en/> totalValueGetter, groupSuppressBlankHeader, suppressStickyTotalRow.
 * <en/> Pure functions only (row markers, position/label/sticky resolvers, row factories),
 * <en/> no Vue dependency, shared by pipeline composables and renderers.
 */

import type {
  GrandTotalRowPosition,
  GroupTotalRowNode,
  GroupTotalRowOption,
  GroupTotalRowPosition,
  SuppressStickyTotalRow,
  TotalValueGetter,
  TotalValueGetterParams,
} from '../types/config-options'
import { AUTO_KEY_NAME } from './normalize-row-key'
import { isSyntheticRow } from './synthetic-row'

/** <zh/> Grand Total 合成行标记键 | <en/> Grand total synthetic-row marker key */
export const GRAND_TOTAL_MARKER = '__isGrandTotalRow'
/** <zh/> 分组小计合成行标记键 | <en/> Group total synthetic-row marker key */
export const GROUP_TOTAL_MARKER = '__isGroupTotalRow'
/** <zh/> 分组头行标记键（复用行分组约定） | <en/> Group header marker key (reuses row-group convention) */
export const GROUP_HEADER_MARKER = '__isGroupHeader'
/** <zh/> 展开详情行标记键 | <en/> Detail row marker key */
export const DETAIL_ROW_MARKER = '__isDetailRow'

/**
 * <zh/> Grand Total 合成行——以原始聚合值直接落字段，复用普通单元格渲染（含 format/valueGetter）
 * <en/> Grand total synthetic row — raw aggregate values land on fields directly, reusing normal cell rendering (incl. format/valueGetter)
 */
export interface GrandTotalRow {
  [GRAND_TOTAL_MARKER]: true
  /** <zh/> 总计位置（top/bottom/pinnedTop/pinnedBottom）| <en/> Total position */
  __grandPosition: GrandTotalRowPosition
  /** <zh/> 标签文本（totalValueGetter 或 sumText 决议结果）| <en/> Label text (totalValueGetter or sumText resolution) */
  __totalLabel: string
  /** <zh/> 是否粘性（suppressStickyTotalRow 决议结果）| <en/> Whether sticky (suppressStickyTotalRow resolution) */
  __sticky: boolean
  /** <zh/> 允许聚合字段落键 | <en/> Allows aggregate fields */
  [key: string]: any
}

/**
 * <zh/> 分组小计合成行——以原始聚合值直接落字段，复用普通单元格渲染
 * <en/> Group total synthetic row — raw aggregate values land on fields directly, reusing normal cell rendering
 */
export interface GroupTotalRow {
  [GROUP_TOTAL_MARKER]: true
  /** <zh/> 小计位置（top/bottom）| <en/> Total position */
  __groupTotalPosition: GroupTotalRowPosition
  /** <zh/> 所属分组字段 | <en/> Owning group field */
  __groupField: string
  /** <zh/> 所属分组字段值 | <en/> Owning group field value */
  __groupValue: unknown
  /** <zh/> 所属分组层级 | <en/> Owning group level */
  __groupLevel: number
  /** <zh/> 所属分组唯一键 | <en/> Owning group unique key */
  __groupKey: string
  /** <zh/> 标签文本 | <en/> Label text */
  __totalLabel: string
  /** <zh/> 是否粘性 | <en/> Whether sticky */
  __sticky: boolean
  [key: string]: any
}

/**
 * <zh/> 判断是否为 Grand Total 合成行
 * <en/> Whether the row is a grand total synthetic row
 */
export function isGrandTotalRow(row: unknown): row is GrandTotalRow {
  return row != null && (row as Record<string, unknown>)[GRAND_TOTAL_MARKER] === true
}

/**
 * <zh/> 判断是否为分组小计合成行
 * <en/> Whether the row is a group total synthetic row
 */
export function isGroupTotalRow(row: unknown): row is GroupTotalRow {
  return row != null && (row as Record<string, unknown>)[GROUP_TOTAL_MARKER] === true
}

/**
 * <zh/> 判断是否为合成行（组头/详情/总计任一）——聚合口径需排除此类行，避免重复累计
 * <zh/> 单一源复出自 `synthetic-row.ts`，此处 re-export 保持聚合调用方导入路径不变
 * <zh/> @deprecated 请从 `synthetic-row.ts` 直接导入，本转发将在下个大版本移除
 * <en/> Whether the row is any synthetic row (header/detail/total) — re-exported from `synthetic-row.ts` (single source)
 * <en/> @deprecated Import directly from `synthetic-row.ts`; this forward will be removed in the next major
 */
export { isSyntheticRow }

/**
 * <zh/> 过滤叶子数据行——排除全部合成行（含组头/详情/总计），供 Grand/Group 聚合使用
 * <en/> Filter leaf data rows — excludes all synthetic rows (headers/details/totals) for grand/group aggregation
 */
export function filterLeafDataRows<T>(rows: readonly T[]): T[] {
  const out: T[] = []
  for (const row of rows) {
    if (!isSyntheticRow(row))
      out.push(row)
  }
  return out
}

/**
 * <zh/> 决议 Grand Total 位置——显式 grandTotalRow 优先，否则 showSummary=true 回退 'bottom'
 * <en/> Resolve grand total position — explicit grandTotalRow wins, otherwise showSummary=true falls back to 'bottom'
 */
export function resolveGrandTotalPosition(
  showSummary: boolean | undefined,
  grandTotalRow: GrandTotalRowPosition | undefined,
): GrandTotalRowPosition | undefined {
  if (grandTotalRow)
    return grandTotalRow
  if (showSummary)
    return 'bottom'
  return undefined
}

/**
 * <zh/> 决议分组小计位置——字符串透传，回调按分组逐个决议，异常时跳过该分组
 * <en/> Resolve group total position — strings pass through, callbacks resolve per group, exceptions skip the group
 */
export function resolveGroupTotalPosition(
  option: GroupTotalRowOption | undefined,
  node: GroupTotalRowNode,
): GroupTotalRowPosition | undefined {
  if (!option)
    return undefined
  if (typeof option === 'string')
    return option
  try {
    return option({ node })
  }
  catch {
    return undefined
  }
}

/**
 * <zh/> 决议合计标签——totalValueGetter 优先（异常时回退默认），默认 Grand 显示 sumText，分组显示 `Sub Total (${value})`
 * <en/> Resolve total label — totalValueGetter first (fallback on exception), default grand shows sumText, groups show `Sub Total (${value})`
 */
export function resolveTotalLabel(
  params: TotalValueGetterParams,
  totalValueGetter: TotalValueGetter | undefined,
  sumText: string,
): string {
  if (totalValueGetter) {
    try {
      const custom = totalValueGetter(params)
      if (typeof custom === 'string' && custom.length > 0)
        return custom
    }
    catch {
      // <zh/> 回退默认标签 | <en/> Fall back to default label
    }
  }
  if (params.isGrandTotal)
    return sumText
  return `Sub Total (${String(params.value)})`
}

/**
 * <zh/> 决议合计行是否粘性——默认粘性，suppressStickyTotalRow 可按 kind 取消
 * <en/> Resolve whether a total row is sticky — sticky by default, suppressStickyTotalRow cancels per kind
 */
export function resolveTotalSticky(
  kind: 'grand' | 'group',
  suppress: SuppressStickyTotalRow | undefined,
): boolean {
  if (suppress === true)
    return false
  if (suppress === 'grand')
    return kind !== 'grand'
  if (suppress === 'group')
    return kind !== 'group'
  return true
}

/**
 * <zh/> 构建 Grand Total 合成行——聚合原始值直接落字段（复用单元格 format），标签列由调用方按首 prop 列覆盖
 * <en/> Build a grand total synthetic row — raw aggregates land on fields (reusing cell format), label column overwritten by caller on the first prop column
 */
export function buildGrandTotalRow(
  aggregates: Record<string, unknown>,
  options: {
    position: GrandTotalRowPosition
    label: string
    sticky: boolean
    labelProp?: string
    rowKey: string
  },
): GrandTotalRow {
  const row: GrandTotalRow = {
    [GRAND_TOTAL_MARKER]: true,
    __grandPosition: options.position,
    __totalLabel: options.label,
    __sticky: options.sticky,
    ...aggregates,
    [AUTO_KEY_NAME]: options.rowKey,
  }
  if (options.labelProp)
    (row as Record<string, unknown>)[options.labelProp] = options.label
  return row
}

/**
 * <zh/> 构建分组小计合成行——聚合原始值直接落字段，标签列覆盖为小计标签
 * <en/> Build a group total synthetic row — raw aggregates land on fields, label column overwritten with the total label
 */
export function buildGroupTotalRow(
  aggregates: Record<string, unknown>,
  options: {
    position: GroupTotalRowPosition
    field: string
    value: unknown
    level: number
    groupKey: string
    label: string
    sticky: boolean
    labelProp?: string
    rowKey: string
  },
): GroupTotalRow {
  const row: GroupTotalRow = {
    [GROUP_TOTAL_MARKER]: true,
    __groupTotalPosition: options.position,
    __groupField: options.field,
    __groupValue: options.value,
    __groupLevel: options.level,
    __groupKey: options.groupKey,
    __totalLabel: options.label,
    __sticky: options.sticky,
    ...aggregates,
    [AUTO_KEY_NAME]: options.rowKey,
  }
  if (options.labelProp)
    (row as Record<string, unknown>)[options.labelProp] = options.label
  return row
}

/**
 * <zh/> 首标签列 prop——规范口径：首个含 prop 的列承载合计标签
 * <en/> First label column prop — canonical caliber: the first prop-bearing column carries the total label
 */
export function resolveLabelProp(columns: readonly { prop?: string }[]): string | undefined {
  for (const col of columns) {
    if (col?.prop)
      return col.prop
  }
  return undefined
}
