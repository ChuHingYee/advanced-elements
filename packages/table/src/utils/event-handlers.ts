import type { ProcessedColumn } from '../types'
import { getColumnKey } from './shared'

/**
 * <zh/> 索引映射集合，提供行 key 和列 key 到索引的快速查询。
 * <en/> Index map collection providing fast row-key/column-key → index lookups.
 */
export interface IndexMaps {
  /** <zh/> 行 key → 行索引 | <en/> row key → row index */
  rowIndexMap: Map<string, number>
  /** <zh/> 列 key → 列索引 | <en/> column key → column index */
  columnIndexMap: Map<string, number>
}

/**
 * <zh/> 行解析器，根据行数据获取唯一 key。
 * <en/> Row resolver that derives a unique key from row data.
 */
export interface RowResolver {
  /** <zh/> 从行数据中提取 key 值 | <en/> extract the key value from row data */
  getRowKey: (row: Record<string, unknown>) => string
}

/**
 * <zh/> 事件处理器上下文，使用 getter 函数获取最新响应式值。
 * <en/> Event-handler context that uses getter functions to read the latest reactive values.
 */
export interface EventHandlerContext {
  getRowResolver: () => RowResolver
  getIndexMaps: () => IndexMaps
}

/**
 * <zh/> 创建返回格式化数据的行事件处理器。
 * <en/> Create row event handlers that return formatted data.
 *
 * @typeParam T - <zh/> 行数据类型，默认 Record<string, unknown> | <en/> row data type, default Record<string, unknown>
 *
 * @example
 * const handlers = createRowEventHandlers({ getRowResolver, getIndexMaps })
 * handlers.rowClick(rowData, event)
 * // => { rowData, rowIndex, event }
 */
export function createRowEventHandlers<T = any>(ctx: EventHandlerContext) {
  /**
   * <zh/> 根据行数据获取其在列表中的索引。
   * <en/> Get the row's index in the list from its data.
   * @param row - <zh/> 行数据 | <en/> row data
   * @returns <zh/> 行索引，未找到返回 -1 | <en/> row index, -1 if not found
   */
  function getRowIndex(row: Record<string, unknown>): number {
    const key = ctx.getRowResolver().getRowKey(row)
    const maps = ctx.getIndexMaps()
    return maps.rowIndexMap.get(key) ?? -1
  }

  /**
   * <zh/> 根据列数据获取其在列表中的索引。
   * <en/> Get the column's index in the list from its config.
   * @param col - <zh/> 列定义 | <en/> column definition
   * @returns <zh/> 列索引，未找到返回 -1 | <en/> column index, -1 if not found
   */
  function getCellIndex(col: ProcessedColumn): number {
    const key = getColumnKey(col)
    const maps = ctx.getIndexMaps()
    return maps.columnIndexMap.get(key) ?? -1
  }

  return {
    /**
     * <zh/> 行点击事件。
     * <en/> Row click event.
     * @param row - <zh/> 行数据 | <en/> row data
     * @param event - <zh/> 原生事件对象 | <en/> native event object
     */
    rowClick: (row: T, event: Event) => ({
      rowData: row,
      rowIndex: getRowIndex(row as Record<string, unknown>),
      event,
    }),

    /**
     * <zh/> 行右键菜单事件。
     * <en/> Row context-menu event.
     * @param row - <zh/> 行数据 | <en/> row data
     * @param event - <zh/> 原生事件对象 | <en/> native event object
     */
    rowContextmenu: (row: T, event: Event) => ({
      rowData: row,
      rowIndex: getRowIndex(row as Record<string, unknown>),
      event,
    }),

    /**
     * <zh/> 行双击事件。
     * <en/> Row double-click event.
     * @param row - <zh/> 行数据 | <en/> row data
     * @param event - <zh/> 原生事件对象 | <en/> native event object
     */
    rowDblclick: (row: T, event: Event) => ({
      rowData: row,
      rowIndex: getRowIndex(row as Record<string, unknown>),
      event,
    }),

    /**
     * <zh/> 单元格点击事件。
     * <en/> Cell click event.
     * @param row - <zh/> 行数据 | <en/> row data
     * @param col - <zh/> 列定义 | <en/> column definition
     * @param event - <zh/> 原生事件对象 | <en/> native event object
     */
    cellClick: (row: T, col: ProcessedColumn, event: Event) => ({
      rowData: row,
      rowIndex: getRowIndex(row as Record<string, unknown>),
      column: col,
      columnIndex: getCellIndex(col),
      event,
    }),

    /**
     * <zh/> 单元格双击事件。
     * <en/> Cell double-click event.
     * @param row - <zh/> 行数据 | <en/> row data
     * @param col - <zh/> 列定义 | <en/> column definition
     * @param event - <zh/> 原生事件对象 | <en/> native event object
     */
    cellDblclick: (row: T, col: ProcessedColumn, event: Event) => ({
      rowData: row,
      rowIndex: getRowIndex(row as Record<string, unknown>),
      column: col,
      columnIndex: getCellIndex(col),
      event,
    }),

    /**
     * <zh/> 单元格右键菜单事件。
     * <en/> Cell context-menu event.
     * @param row - <zh/> 行数据 | <en/> row data
     * @param col - <zh/> 列定义 | <en/> column definition
     * @param event - <zh/> 原生事件对象 | <en/> native event object
     */
    cellContextmenu: (row: T, col: ProcessedColumn, event: Event) => ({
      rowData: row,
      rowIndex: getRowIndex(row as Record<string, unknown>),
      column: col,
      columnIndex: getCellIndex(col),
      event,
    }),

    /**
     * <zh/> 鼠标移入单元格事件。
     * <en/> Cell mouse-enter event.
     * @param row - <zh/> 行数据 | <en/> row data
     * @param event - <zh/> 原生事件对象 | <en/> native event object
     */
    cellMouseEnter: (row: T, event: Event) => ({
      rowData: row,
      rowIndex: getRowIndex(row as Record<string, unknown>),
      event,
    }),

    /**
     * <zh/> 表头点击事件。
     * <en/> Header click event.
     * @param col - <zh/> 列定义 | <en/> column definition
     * @param event - <zh/> 原生事件对象 | <en/> native event object
     */
    headerClick: (col: ProcessedColumn, event: Event) => ({
      column: col,
      columnIndex: getCellIndex(col),
      event,
    }),

    /**
     * <zh/> 表头右键菜单事件。
     * <en/> Header context-menu event.
     * @param col - <zh/> 列定义 | <en/> column definition
     * @param event - <zh/> 原生事件对象 | <en/> native event object
     */
    headerContextmenu: (col: ProcessedColumn, event: Event) => ({
      column: col,
      columnIndex: getCellIndex(col),
      event,
    }),

    /**
     * <zh/> 表头拖拽调整列宽结束事件。
     * <en/> Header column-resize drag-end event.
     * @param newWidth - <zh/> 调整后的新宽度 | <en/> new width after resize
     * @param oldWidth - <zh/> 调整前的旧宽度 | <en/> old width before resize
     * @param col - <zh/> 列定义 | <en/> column definition
     * @param event - <zh/> 鼠标或键盘事件对象 | <en/> mouse or keyboard event object
     */
    headerDragend: (newWidth: number, oldWidth: number, col: ProcessedColumn, event: MouseEvent | KeyboardEvent) => ({
      column: col,
      columnIndex: getCellIndex(col),
      newWidth,
      oldWidth,
      event,
    }),
  }
}

export type RowEventHandlers = ReturnType<typeof createRowEventHandlers>
