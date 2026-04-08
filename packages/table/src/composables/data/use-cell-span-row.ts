import type { ColumnRowSpanConfig, ProcessedColumn, RowSpanCellsConfig, SpanInfo } from '../../types'

/**
 * <zh/> 行合并族——resolve/grouping/compare 链与行合并阶段（自 use-cell-span.ts 原样迁出，
 * <zh/> COMPLEXITY-PLAN 战线三，刀法 A 纯函数下沉），主体逐字未改。
 * <en/> Row-span family — resolve/grouping/compare chains and the row-span phase (migrated verbatim
 * <en/> from use-cell-span.ts, COMPLEXITY-PLAN battle line 3, knife A), bodies unchanged.
 */
export function resolveRowSpanCompare(
  config: ColumnRowSpanConfig,
  prop: string | undefined,
): (a: any, b: any) => boolean {
  if (typeof config === 'function')
    return config
  return (a: any, b: any) => a[prop!] === b[prop!]
}

export function buildRowSpanMapByGrouping(
  data: any[],
  colProp: string,
): Map<string, SpanInfo> {
  const result = new Map<string, SpanInfo>()

  if (data.length === 0)
    return result

  let chainStart = 0
  let chainStartValue = data[0]?.[colProp]

  for (let i = 1; i <= data.length; i++) {
    const currentValue = i < data.length ? data[i]?.[colProp] : undefined
    const isSame = i < data.length && currentValue === chainStartValue

    if (!isSame) {
      const rowspan = i - chainStart
      if (rowspan > 1) {
        result.set(`${chainStart}-${colProp}`, {
          rowspan,
          colspan: 1,
          isOrigin: true,
        })
        for (let j = chainStart + 1; j < i; j++) {
          result.set(`${j}-${colProp}`, {
            rowspan: 0,
            colspan: 0,
            isOrigin: false,
          })
        }
      }
      if (i < data.length) {
        chainStart = i
        chainStartValue = currentValue
      }
    }
  }

  return result
}

export function resolveRowSpanConfig(
  col: ProcessedColumn,
  rowSpanCells: RowSpanCellsConfig | undefined,
): ColumnRowSpanConfig | undefined {
  const prop = col.prop as string | undefined
  return col.spanRows ?? (prop ? rowSpanCells?.[prop] : undefined)
}

/**
 * <zh/> 行合并：grouping 相等分支（由 applyRowSpanPhase 编排）
 * <en/> Row span: grouping-equality branch
 */
export function applyRowSpanByGrouping(
  map: Map<string, SpanInfo>,
  data: any[],
  colProp: string,
): void {
  const groupedMap = buildRowSpanMapByGrouping(data, colProp)
  for (const [key, value] of groupedMap) {
    if (!map.has(key))
      map.set(key, value)
  }
}

/**
 * <zh/> 行合并：compare 链分支（由 applyRowSpanPhase 编排）
 * <en/> Row span: compare-chain branch
 */
export function applyRowSpanByCompare(
  map: Map<string, SpanInfo>,
  data: any[],
  colProp: string,
  compare: (a: any, b: any) => boolean,
): void {
  if (data.length === 0)
    return
  let chainStart = 0
  for (let i = 1; i <= data.length; i++) {
    const isSame = i < data.length && compare(data[i - 1]!, data[i]!)
    if (!isSame) {
      const rowspan = i - chainStart
      if (rowspan > 1) {
        const key = `${chainStart}-${colProp}`
        if (!map.has(key))
          map.set(key, { rowspan, colspan: 1, isOrigin: true })
        for (let j = chainStart + 1; j < i; j++) {
          const hiddenKey = `${j}-${colProp}`
          if (!map.has(hiddenKey))
            map.set(hiddenKey, { rowspan: 0, colspan: 0, isOrigin: false })
        }
      }
      chainStart = i
    }
  }
}

/**
 * <zh/> 行合并阶段：逐列按配置分发 grouping/compare（由 buildSpanMap 编排）
 * <en/> Row-span phase: per-column dispatch to grouping/compare by config (orchestrated by buildSpanMap)
 */
export function applyRowSpanPhase(
  map: Map<string, SpanInfo>,
  data: any[],
  rowSpanColumns: ProcessedColumn[],
  rowSpanCells: RowSpanCellsConfig | undefined,
): void {
  for (const col of rowSpanColumns) {
    const colProp = col.prop as string
    const rowSpanConfig = resolveRowSpanConfig(col, rowSpanCells)
    if (!rowSpanConfig)
      continue
    if (rowSpanConfig === true)
      applyRowSpanByGrouping(map, data, colProp)
    else
      applyRowSpanByCompare(map, data, colProp, resolveRowSpanCompare(rowSpanConfig, colProp))
  }
}
