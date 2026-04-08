/**
 * <zh/> 列分类 — 从 use-table-data-pipeline 抽取，降低主文件 300 行
 * <en/> Column classification to reduce main file by 300 lines
 *
 * <zh/> 下游由 `useColumnCategorization`（columns）包一层 computed（syncKey/teleport 派生），不要在此加响应式逻辑。
 * <en/> Downstream `useColumnCategorization` (columns) wraps this in computed (syncKey/teleport derivations) — keep this file free of reactivity.
 */
import type { ProcessedColumn } from '../../types'

export interface ColumnClassification {
  selection: ProcessedColumn[]
  normal: ProcessedColumn[]
  leafColumns: ProcessedColumn[]
  visibleTree: ProcessedColumn[]
  hoverOptionColumns: ProcessedColumn[]
  displayNormalColumns: ProcessedColumn[]
  hasTeleport: boolean
  hasFixed: boolean
  allKeepAlive: boolean
  hasFilterableColumns: boolean
  hasSortableColumns: boolean
}

interface ClassifyAccumulator {
  selection: ProcessedColumn[]
  normal: ProcessedColumn[]
  leafColumns: ProcessedColumn[]
  hoverOptionColumns: ProcessedColumn[]
  displayNormalColumns: ProcessedColumn[]
  hasTeleport: boolean
  hasFixed: boolean
  allKeepAlive: boolean
  hasFilterableColumns: boolean
  hasSortableColumns: boolean
}

function isGroupColumn(col: ProcessedColumn): boolean {
  return !!(col as unknown as { children?: unknown[] }).children?.length
}

function classifyLeafColumn(col: ProcessedColumn, acc: ClassifyAccumulator): ProcessedColumn {
  const isHover = col.valueType === 'option' && !!col.hoverActions
  if (!isHover) {
    acc.displayNormalColumns.push(col)
    return col
  }
  const hoverActions = col.hoverActions as Record<string, unknown> | undefined
  if ((hoverActions as Record<string, unknown>)?.keepAlive === false)
    acc.allKeepAlive = false
  const isTeleportTrue = typeof hoverActions === 'object' && (hoverActions as Record<string, unknown>).teleport === true
  if (isTeleportTrue) {
    acc.hasTeleport = true
    acc.hoverOptionColumns.push(col)
    return col
  }
  const effectiveCol = { ...col, width: 1, label: '' } as ProcessedColumn
  acc.hoverOptionColumns.push(effectiveCol)
  return effectiveCol
}

function processTree(cols: ProcessedColumn[], parentVisible: boolean, acc: ClassifyAccumulator): ProcessedColumn[] | null {
  const result: ProcessedColumn[] = []
  for (const col of cols) {
    const isHidden = col.hidden === true
    const isVisible = parentVisible && !isHidden && !col.selection
    if (col.fixed)
      acc.hasFixed = true
    if (isGroupColumn(col) && (col as unknown as { children: ProcessedColumn[] }).children) {
      const filteredChildren = processTree((col as unknown as { children: ProcessedColumn[] }).children, isVisible, acc)
      if (filteredChildren && filteredChildren.length > 0)
        result.push({ ...col, children: filteredChildren } as ProcessedColumn)
      continue
    }
    if (!isHidden)
      acc.leafColumns.push(col)
    if (col.selection) {
      if (isVisible)
        result.push(col)
      acc.selection.push(col)
    }
    else if (isVisible) {
      if (col.filter !== false && col.valueType !== 'option')
        acc.hasFilterableColumns = true
      if (col.sortable)
        acc.hasSortableColumns = true
      const effectiveCol = classifyLeafColumn(col, acc)
      result.push(effectiveCol)
      acc.normal.push(effectiveCol)
    }
  }
  return result.length > 0 ? result : null
}

/**
 * <zh/> 对列树执行单次 DFS 分类——拆分选择列/普通列/叶子列/可见树及渲染能力标记（teleport、fixed、keepAlive 等）。
 * <en/> Classify the column tree in a single DFS pass — split selection/normal/leaf columns and the visible
 * <en/> tree plus rendering capability flags (teleport, fixed, keepAlive, etc.).
 *
 * @param columns - <zh/> 处理后的完整列树（含分组节点） | <en/> Processed column tree including group nodes
 * @returns <zh/> 各分类桶与能力标记的聚合结果 | <en/> Aggregated classification buckets and capability flags
 */
export function classifyColumns(columns: ProcessedColumn[]): ColumnClassification {
  const acc: ClassifyAccumulator = {
    selection: [],
    normal: [],
    leafColumns: [],
    hoverOptionColumns: [],
    displayNormalColumns: [],
    hasTeleport: false,
    hasFixed: false,
    allKeepAlive: true,
    hasFilterableColumns: false,
    hasSortableColumns: false,
  }
  const tree = processTree(columns, true, acc)
  return {
    selection: acc.selection,
    normal: acc.normal,
    leafColumns: acc.leafColumns,
    visibleTree: tree ?? [],
    hoverOptionColumns: acc.hoverOptionColumns,
    displayNormalColumns: acc.displayNormalColumns,
    hasTeleport: acc.hasTeleport,
    hasFixed: acc.hasFixed,
    allKeepAlive: acc.allKeepAlive,
    hasFilterableColumns: acc.hasFilterableColumns,
    hasSortableColumns: acc.hasSortableColumns,
  }
}

/**
 * <zh/> 浅比较两份列分类结果（各桶长度与能力标记），用于数据管线脏检查、避免无谓重渲染。
 * <en/> Shallow-compare two column classifications (bucket lengths and capability flags) for pipeline
 * <en/> dirty checks, avoiding needless re-renders.
 *
 * @param a - <zh/> 分类结果 A | <en/> Classification A
 * @param b - <zh/> 分类结果 B | <en/> Classification B
 * @returns <zh/> 两者是否等价 | <en/> Whether the two classifications are equivalent
 */
export function isColumnClassificationEqual(a: ColumnClassification, b: ColumnClassification): boolean {
  if (a.selection.length !== b.selection.length
    || a.normal.length !== b.normal.length
    || a.leafColumns.length !== b.leafColumns.length
    || a.visibleTree.length !== b.visibleTree.length
    || a.hoverOptionColumns.length !== b.hoverOptionColumns.length
    || a.displayNormalColumns.length !== b.displayNormalColumns.length
    || a.hasTeleport !== b.hasTeleport
    || a.hasFixed !== b.hasFixed
    || a.allKeepAlive !== b.allKeepAlive
    || a.hasFilterableColumns !== b.hasFilterableColumns
    || a.hasSortableColumns !== b.hasSortableColumns) {
    return false
  }
  return a.normal.every((col, i) => col === b.normal[i])
    && a.selection.every((col, i) => col === b.selection[i])
    && a.leafColumns.every((col, i) => col === b.leafColumns[i])
    && a.visibleTree.every((col, i) => col === b.visibleTree[i])
    && a.hoverOptionColumns.every((col, i) => col === b.hoverOptionColumns[i])
    && a.displayNormalColumns.every((col, i) => col === b.displayNormalColumns[i])
}
