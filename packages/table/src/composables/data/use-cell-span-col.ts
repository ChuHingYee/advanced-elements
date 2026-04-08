import type { ColSpanCellsConfig, ColumnColSpanConfig, ProcessedColumn, SpanInfo } from '../../types'

/**
 * <zh/> 列合并族——resolve/查找表/单行链式扫描与列合并阶段（自 use-cell-span.ts 原样迁出，
 * <zh/> COMPLEXITY-PLAN 战线三，刀法 A），主体逐字未改。
 * <en/> Column-span family — resolve/lookup/single-row chain scan and the column-span phase
 * <en/> (migrated verbatim from use-cell-span.ts, COMPLEXITY-PLAN battle line 3, knife A), bodies unchanged.
 */
export function resolveColSpanCompare(
  config: ColumnColSpanConfig,
  _prop: string | undefined,
): (row: any, leftColProp: string, currentColProp: string) => boolean {
  if (typeof config === 'function')
    return config
  return (row: any, leftColProp: string, currentColProp: string) => row[leftColProp] === row[currentColProp]
}

export function resolveColSpanConfig(
  col: ProcessedColumn,
  colSpanCells: ColSpanCellsConfig | undefined,
): ColumnColSpanConfig | undefined {
  const prop = col.prop as string | undefined
  return col.colSpan ?? (prop ? colSpanCells?.[prop] : undefined)
}

/** <zh/> 列合并查找表：colProp → 列序号 + 行内比较器 | <en/> Column-span lookup: colProp → column index + in-row comparator */
export type ColSpanLookup = Map<string, { index: number, compare: (row: any, leftColProp: string, currentColProp: string) => boolean }>

/**
 * <zh/> 构建列合并查找表（由 applyColSpanPhase 编排）
 * <en/> Build the column-span lookup
 */
export function buildColSpanLookup(
  columns: ProcessedColumn[],
  colSpanCells: ColSpanCellsConfig | undefined,
): ColSpanLookup {
  const colSpanLookup: ColSpanLookup = new Map()
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx]!
    const colProp = col.prop as string | undefined
    if (!colProp)
      continue
    const colSpanConfig: ColumnColSpanConfig | undefined = resolveColSpanConfig(col, colSpanCells)
    if (!colSpanConfig)
      continue
    colSpanLookup.set(colProp, {
      index: colIdx,
      compare: resolveColSpanCompare(colSpanConfig, colProp),
    })
  }
  return colSpanLookup
}

/**
 * <zh/> 单行列合并：链式扫描，4 处落链条件归一为 flushChain（`colIdx - start > 1` 与 `end - start >= 1` 同值，已逐处验算等价）
 * <en/> Single-row column span: chain scan with the 4 chain-close conditions unified into flushChain (verified equivalent case by case)
 */
export function applySingleRowColSpan(
  map: Map<string, SpanInfo>,
  row: any,
  rowIdx: number,
  columns: ProcessedColumn[],
  colSpanLookup: ColSpanLookup,
): void {
  let chainStartColIdx: number | null = null
  let chainStartProp: string | null = null
  const flushChain = (endColIdx: number): void => {
    if (chainStartColIdx !== null && endColIdx - chainStartColIdx >= 1)
      applyColSpan(map, rowIdx, columns, chainStartColIdx, chainStartProp!, endColIdx)
  }
  const resetChain = (): void => {
    chainStartColIdx = null
    chainStartProp = null
  }
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx]!
    const colProp = col.prop as string | undefined
    if (!colProp) {
      flushChain(colIdx - 1)
      resetChain()
      continue
    }
    const colSpanEntry = colSpanLookup.get(colProp)
    const existingInfo = map.get(`${rowIdx}-${colProp}`)
    if (existingInfo && !existingInfo.isOrigin) {
      flushChain(colIdx - 1)
      resetChain()
      continue
    }
    if (colSpanEntry) {
      if (chainStartColIdx !== null) {
        if (!colSpanEntry.compare(row, chainStartProp!, colProp)) {
          flushChain(colIdx - 1)
          chainStartColIdx = colIdx
          chainStartProp = colProp
        }
      }
      else {
        chainStartColIdx = colIdx
        chainStartProp = colProp
      }
    }
    else {
      flushChain(colIdx - 1)
      resetChain()
    }
  }
  flushChain(columns.length - 1)
}

/**
 * <zh/> 列合并阶段：建表后逐行应用（由 buildSpanMap 编排；空表直接返回）
 * <en/> Column-span phase: build the lookup then apply row by row (orchestrated by buildSpanMap; no-op when empty)
 */
export function applyColSpanPhase(
  map: Map<string, SpanInfo>,
  data: any[],
  columns: ProcessedColumn[],
  colSpanCells: ColSpanCellsConfig | undefined,
): void {
  const colSpanLookup = buildColSpanLookup(columns, colSpanCells)
  if (colSpanLookup.size === 0)
    return
  for (let rowIdx = 0; rowIdx < data.length; rowIdx++)
    applySingleRowColSpan(map, data[rowIdx]!, rowIdx, columns, colSpanLookup)
}

export function applyColSpan(
  map: Map<string, SpanInfo>,
  rowIdx: number,
  columns: ProcessedColumn[],
  startColIdx: number,
  startColProp: string,
  endColIdx: number,
): void {
  const colspan = endColIdx - startColIdx + 1
  if (colspan <= 1)
    return

  const existingOrigin = map.get(`${rowIdx}-${startColProp}`)
  if (existingOrigin && existingOrigin.isOrigin) {
    map.set(`${rowIdx}-${startColProp}`, { ...existingOrigin, colspan })
  }
  else if (!existingOrigin) {
    map.set(`${rowIdx}-${startColProp}`, {
      rowspan: 1,
      colspan,
      isOrigin: true,
    })
  }

  for (let ci = startColIdx + 1; ci <= endColIdx; ci++) {
    const prop = columns[ci]!.prop as string | undefined
    if (!prop)
      continue

    const existingHidden = map.get(`${rowIdx}-${prop}`)
    if (existingHidden) {
      if (existingHidden.isOrigin && (existingHidden.rowspan > 1 || existingHidden.colspan > 1)) {
        // <zh/> 已有真实合并起点（rowSpan/colSpan>1）时保留，避免 colSpan 隐藏覆盖行合并起点
        // <en/> Preserve real span origin (rowSpan/colSpan>1); don't overwrite with colSpan hidden
        continue
      }
      if (!existingHidden.isOrigin)
        continue
    }
    // <zh/> 无记录或为 1x1 占位起点时按 colSpan 隐藏处理
    // <en/> No record or 1x1 placeholder origin → mark as colSpan hidden
    if (!existingHidden) {
      map.set(`${rowIdx}-${prop}`, {
        rowspan: 0,
        colspan: 0,
        isOrigin: false,
      })
    }
    else if (existingHidden.isOrigin) {
      map.set(`${rowIdx}-${prop}`, {
        rowspan: 0,
        colspan: 0,
        isOrigin: false,
      })
    }
  }
}
