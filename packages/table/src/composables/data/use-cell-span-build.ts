import type { ColSpanCellsConfig, ProcessedColumn, RowSpanCellsConfig, SpanInfo, SpanRange } from '../../types'
import type { SpanLimitInfo } from './use-cell-span-types'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { applyColSpanPhase, resolveColSpanConfig } from './use-cell-span-col'
import { applyRowSpanPhase, resolveRowSpanConfig } from './use-cell-span-row'

/**
 * <zh/> span 建图公共层——规模上限/估算口径/声明式区域应用与 buildSpanMap 编排
 * <zh/> （自 use-cell-span.ts 原样迁出，COMPLEXITY-PLAN 战线三，刀法 A），主体逐字未改。
 * <en/> Span build commons — scale limit / estimate caliber / declarative-range application and
 * <en/> the buildSpanMap orchestration (migrated verbatim from use-cell-span.ts, COMPLEXITY-PLAN
 * <en/> battle line 3, knife A), bodies unchanged.
 */
export const SPAN_CELL_LIMIT = 500_000

/**
 * 默认延迟调度阈值（估算操作数）。Default deferral threshold in estimated ops.
 * 10k 行 x 2 列实测建图约 7.5ms，50k 预算覆盖常规大表同步路径，仅超限进入延迟。
 */
export const SPAN_DEFER_BUDGET = 50_000

/**
 * 轻量估算合并操作数（O(列数)，不扫描行），与 buildSpanMap 的超限口径一致。
 * Cheap span-op estimate in O(columns) without scanning rows, same caliber as the build limit.
 */
export function estimateSpanOps(
  dataLength: number,
  columns: ProcessedColumn[],
  rowSpanCells: RowSpanCellsConfig | undefined,
  colSpanCells: ColSpanCellsConfig | undefined,
  ranges: SpanRange[] | undefined,
): number {
  let rowSpanColumns = 0
  let colSpanColumnCount = 0
  for (const col of columns) {
    const prop = col.prop as string | undefined
    if (!prop)
      continue
    if (resolveRowSpanConfig(col, rowSpanCells))
      rowSpanColumns++
    if (resolveColSpanConfig(col, colSpanCells))
      colSpanColumnCount++
  }
  const rangesOps = ranges?.reduce((sum, r) => sum + Math.max(1, r.rowspan) * Math.max(1, r.colspan), 0) ?? 0
  return dataLength * (rowSpanColumns + colSpanColumnCount) + rangesOps
}

export function applyRanges(
  map: Map<string, SpanInfo>,
  columns: ProcessedColumn[],
  ranges: SpanRange[],
): void {
  for (const range of ranges) {
    const { row, col, rowspan, colspan } = range
    // <zh/> 非法起点直接跳过——负索引会写入 "-1-prop" 幽灵键污染映射（查询下标恒 ≥0，永不命中）
    // <en/> Skip illegal origins — negative indexes would write "-1-prop" ghost keys polluting the map (lookup indexes are always ≥0, never hit)
    if (row < 0 || col < 0)
      continue
    if (rowspan < 1 || colspan < 1)
      continue

    const startCol = columns[col]
    const startProp = startCol?.prop as string | undefined
    if (!startProp)
      continue

    const existingOrigin = map.get(`${row}-${startProp}`)
    if (existingOrigin && existingOrigin.isOrigin) {
      map.set(`${row}-${startProp}`, {
        rowspan: Math.max(existingOrigin.rowspan, rowspan),
        colspan: Math.max(existingOrigin.colspan, colspan),
        isOrigin: true,
      })
    }
    else if (!existingOrigin) {
      map.set(`${row}-${startProp}`, {
        rowspan,
        colspan,
        isOrigin: true,
      })
    }

    for (let ri = row; ri < row + rowspan; ri++) {
      for (let ci = col; ci < col + colspan; ci++) {
        if (ri === row && ci === col)
          continue

        const coveredCol = columns[ci]
        const coveredProp = coveredCol?.prop as string | undefined
        if (!coveredProp)
          continue

        map.set(`${ri}-${coveredProp}`, {
          rowspan: 0,
          colspan: 0,
          isOrigin: false,
        })
      }
    }
  }
}

export function buildSpanMap(
  data: any[],
  columns: ProcessedColumn[],
  rowSpanCells: RowSpanCellsConfig | undefined,
  colSpanCells: ColSpanCellsConfig | undefined,
  ranges: SpanRange[] | undefined,
  onSpanLimitExceeded?: (info: SpanLimitInfo) => void,
): Map<string, SpanInfo> {
  const map = new Map<string, SpanInfo>()

  if (ranges && ranges.length > 0) {
    applyRanges(map, columns, ranges)
  }

  const rowSpanColumns = columns.filter((col) => {
    const prop = col.prop as string | undefined
    if (!prop)
      return false
    const config = resolveRowSpanConfig(col, rowSpanCells)
    return !!config
  })

  const colSpanColumnCount = columns.filter((col) => {
    const prop = col.prop as string | undefined
    if (!prop)
      return false
    return !!resolveColSpanConfig(col, colSpanCells)
  }).length

  // 超限口径与 estimateSpanOps 同源（公式一致，行注释见该函数）.
  // Limit caliber shares its formula with estimateSpanOps.
  const rangesOps = ranges?.reduce((sum, r) => sum + Math.max(1, r.rowspan) * Math.max(1, r.colspan), 0) ?? 0
  const estimatedOps = data.length * (rowSpanColumns.length + colSpanColumnCount) + rangesOps
  if (estimatedOps >= SPAN_CELL_LIMIT) {
    if (isDev && typeof console !== 'undefined') {
      devWarn(
        `[AdvTable] Cell span skipped: estimated ${estimatedOps} operations exceed limit (${SPAN_CELL_LIMIT}).`
        + ` Consider reducing data size or disabling span for better performance.`,
      )
    }
    onSpanLimitExceeded?.({
      estimatedOps,
      limit: SPAN_CELL_LIMIT,
      source: 'spanConfig',
    })
    return map
  }

  applyRowSpanPhase(map, data, rowSpanColumns, rowSpanCells)
  applyColSpanPhase(map, data, columns, colSpanCells)

  return map
}
