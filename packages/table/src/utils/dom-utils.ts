/**
 * <zh/> DOM 工具函数，查找单元格坐标等。
 * <en/> DOM helpers for locating cell coordinates, etc.
 */

/**
 * <zh/> 单元格坐标，包含行索引和列索引。
 * <en/> Cell coordinate, containing the row and column indexes.
 */
export interface CellCoord {
  rowIndex: number
  columnIndex: number
}

/**
 * <zh/> 从 DOM 元素向上查找最近的单元格坐标（data-adv-cell-row / data-adv-cell-col）。
 * <en/> Walk up the DOM from an element to find the nearest cell coordinate (data-adv-cell-row / data-adv-cell-col).
 * @param target - <zh/> 起始 DOM 元素 | <en/> starting DOM element
 * @returns <zh/> 单元格坐标，未找到时返回 null | <en/> cell coordinate, null if not found
 */
export function findCellCoord(target: HTMLElement): CellCoord | null {
  const el = target.closest<HTMLElement>('[data-adv-cell-row][data-adv-cell-col]')
  if (!el)
    return null
  const rowAttr = el.getAttribute('data-adv-cell-row')
  const colAttr = el.getAttribute('data-adv-cell-col')
  if (rowAttr == null || colAttr == null)
    return null
  return { rowIndex: Number(rowAttr), columnIndex: Number(colAttr) }
}

/**
 * <zh/> 反向定位：(rowIndex, columnIndex) → 单元格元素。
 *
 * <zh/> 两种渲染模式的每个单元格都带有 data-adv-cell-row/col 属性（cell-render-pipeline 统一盖章），
 * <zh/> 故单一属性选择器即可跨模式命中。virtual 模式的钉住条带（top/bottom pinned strips）与汇总区
 * <zh/> 会复制同属性内容到主网格之外——通过 `scopeSelector` 将查询域收窄到主网格（如 '.el-table-v2__main'）。
 *
 * <en/> Reverse lookup: (rowIndex, columnIndex) → the cell element.
 *
 * <en/> Every cell in both render modes is stamped with data-adv-cell-row/col (unified in
 * <en/> cell-render-pipeline), so one attribute selector hits across modes. The virtual mode's
 * <en/> pinned strips and summary area duplicate the same attributes OUTSIDE the main grid —
 * <en/> narrow the query domain via `scopeSelector` (e.g. '.el-table-v2__main').
 */
export function findCellElement(
  container: HTMLElement,
  rowIndex: number,
  columnIndex: number,
  scopeSelector?: string,
): HTMLElement | null {
  const root = (scopeSelector ? container.querySelector<HTMLElement>(scopeSelector) : null) ?? container
  return root.querySelector<HTMLElement>(
    `[data-adv-cell-row="${rowIndex}"][data-adv-cell-col="${columnIndex}"]`,
  )
}
