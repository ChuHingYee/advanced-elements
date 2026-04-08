/**
 * <zh/> CellLocator — 抽象的"从 DOM 单元格定位行列索引"策略接口
 *
 * <zh/> 每种渲染模式（ElTable / ElTableV2 / 未来模式）各自实现此接口，
 * <zh/> useCellEvents 通过依赖注入使用，不再内嵌不同渲染器的 DOM 结构知识。
 *
 * <en/> CellLocator — abstract strategy interface for locating row/column indices from DOM cells
 *
 * <en/> Each rendering mode (ElTable / ElTableV2 / future modes) implements this interface,
 * <en/> useCellEvents uses it via dependency injection, no longer embedding DOM structure knowledge of different renderers.
 *
 * @interface CellLocator
 */
export interface CellLocator {
  /**
   * <zh/> 从单元格元素获取行索引
   *
   * <zh/> 根据渲染器的 DOM 结构，从 cell 元素向上遍历或查找 data 属性，
   * <zh/> 返回该单元格所在的行索引（从 0 开始）。查找失败时返回 null。
   *
   * @param cell - <zh/> 单元格 DOM 元素 | <en/> cell DOM element
   * @returns <zh/> 行索引，未找到时返回 null | <en/> row index, null if not found
   */
  getRowIndex: (cell: HTMLElement) => number | null

  /**
   * <zh/> 从单元格元素获取列索引
   *
   * <zh/> 根据渲染器的 DOM 结构，从 cell 元素向上遍历或查找 data 属性，
   * <zh/> 返回该单元格所在的列索引（从 0 开始）。查找失败时返回 null。
   *
   * @param cell - <zh/> 单元格 DOM 元素 | <en/> cell DOM element
   * @returns <zh/> 列索引，未找到时返回 null | <en/> column index, null if not found
   */
  getColumnIndex: (cell: HTMLElement) => number | null
}
