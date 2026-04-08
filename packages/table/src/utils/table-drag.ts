import type { ProcessedColumn } from '../types'
import { ADV_TABLE_INTERNAL_COLUMN_ID } from '../constants'

// <zh/> 以下常量真源为 constants/index.ts，此处转出作为拖拽/滚动域的正式入口 |
// <en/> The following constants are sourced from constants/index.ts and re-exported here as the canonical entry for the drag/scroll domain
export {
  ADV_TABLE_COLUMN_KEY_ATTR,
  ADV_TABLE_INTERNAL_COLUMN_ID,
  ADV_TABLE_OPTION_COLUMN_KEY,
  ADV_TABLE_ROW_KEY_ATTR,
  ADV_TABLE_SELECTION_COLUMN_KEY,
} from '../constants'

/** <zh/> 渲染器需实现的拖拽能力契约 | <en/> Drag-capability contract that a renderer must implement */
export interface TableDragHost {
  getColumnDragContainer: () => HTMLElement | null
  getRowDragContainer: () => HTMLElement | null
  getRenderedColumnKeys: () => string[]
  getRenderedRowKeys: () => string[]
  getDefaultColumnDragHandle: () => string
  getDefaultRowDragHandle: () => string
  /** <zh/> 列拖拽时 SortableJS 的 draggable 选择器，匹配列容器的直接子元素 | <en/> SortableJS draggable selector for column drag, matching direct children of the column container */
  getColumnDraggableSelector: () => string
}

/**
 * <zh/> 滚动定位目标——行键/列键（string）。number 索引在排序/分页/筛选下失真，统一使用字符串键定位。
 * <en/> Scroll target — row/column key (string). Number indices distort under sorting/pagination/filtering; always target by string key.
 */
export type ScrollTarget = string

/**
 * <zh/> scrollToRow 对齐策略——与 AG Grid ensureIndexVisible 的对齐语义对齐：
 * <zh/> 'auto' 仅在不可见时滚动（默认），'start'/'center'/'end' 强制对齐。
 * <en/> Alignment strategy for scrollToRow — mirrors AG Grid ensureIndexVisible semantics:
 * <en/> 'auto' scrolls only when out of view (default); 'start'/'center'/'end' force alignment.
 */
export interface ScrollToRowOptions {
  align?: 'auto' | 'start' | 'center' | 'end'
  /**
   * <zh/> 平滑滚动（仅 default 渲染器的 scrollIntoView 支持；virtual 模式的
   * <zh/> ElTableV2 scrollToRow 无此能力，该标志被忽略）
   * <en/> Smooth scrolling (only the default renderer's scrollIntoView supports it; the virtual
   * <en/> mode's ElTableV2 scrollToRow has no such capability — the flag is ignored)
   */
  behavior?: 'auto' | 'smooth' | 'instant'
}

/** <zh/> 渲染器滚动定位能力契约（可选实现，未实现时 API 返回 false） | <en/> Renderer scroll-positioning contract (optional; API returns false when unimplemented) */
export interface RendererScrollApi {
  scrollToRow: (target: ScrollTarget, options?: ScrollToRowOptions) => boolean
  scrollToColumn: (target: ScrollTarget) => boolean
}

/**
 * <zh/> 渲染器动态行高重测能力契约（可选实现，未实现或非动态网格时表级 API 返回 false）
 * <en/> Renderer dynamic row-height reset contract (optional; table-level API returns false when unimplemented or off the dynamic grid)
 */
export interface RendererRowHeightApi {
  /**
   * <zh/> 透传 EP 原生 `resetAfterRowIndex`——清除 index 之后全部行的缓存行高并重排
   * <en/> Pass through EP's native `resetAfterRowIndex` — drops cached row heights after index and reflows
   */
  resetAfterRowIndex?: (index?: number, forceUpdate?: boolean) => boolean
  /**
   * <zh/> 便捷重测——`resetAfterRowIndex(index, true)`，异步内容撑高后的推荐调用
   * <en/> Convenience remeasure — `resetAfterRowIndex(index, true)`, the recommended call after async content growth
   */
  refreshVirtualRowHeight?: (index?: number) => boolean
}

/** <zh/> 渲染器对外暴露接口 | <en/> Renderer's publicly exposed interface */
export interface RendererInteractionDomain {
  rows: readonly unknown[]
  columns: ProcessedColumn[]
  columnIndexes: number[]
}

export interface TableRendererExpose extends TableDragHost, RendererRowHeightApi {
  getInteractionDomain?: () => RendererInteractionDomain
  /**
   * <zh/> 重置列宽拖拽缓存——仅虚拟模式存在，default 模式无此方法
   * <en/> Reset column resize drag cache — only exists in virtual mode, not in default mode
   */
  resetColumnWidths?: () => void
  /**
   * <zh/> 滚动定位到指定行/列（渲染数据域 rowKey/columnKey） | <en/> Scroll to a row/column by render-domain rowKey/columnKey
   */
  scrollToRow?: (target: ScrollTarget, options?: ScrollToRowOptions) => boolean
  scrollToColumn?: (target: ScrollTarget) => boolean
}

/**
 * <zh/> 确保列对象拥有内部 ID，供 getColumnKey 兜底使用。当列缺少 key/prop 时，写入 ADV_TABLE_INTERNAL_COLUMN_ID。
 * <en/> Ensure a column object owns an internal ID, used as a fallback by getColumnKey. When a column lacks key/prop, write ADV_TABLE_INTERNAL_COLUMN_ID.
 *
 * @param column - <zh/> 待处理的列配置对象 | <en/> column config object to process
 * @param fallbackKey - <zh/> 兜底使用的 key 值 | <en/> fallback key value
 * @returns <zh/> 确保包含内部 ID 的列对象（若无 key/prop 则返回新对象） | <en/> column object guaranteed to contain the internal ID (a new object when key/prop is absent)
 */
export function ensureInternalColumnId(
  column: ProcessedColumn,
  fallbackKey: string,
): ProcessedColumn {
  if (column.key != null || column.prop != null || (column as Record<string, unknown>)[ADV_TABLE_INTERNAL_COLUMN_ID]) {
    return column
  }

  return {
    ...column,
    [ADV_TABLE_INTERNAL_COLUMN_ID]: fallbackKey,
  } as ProcessedColumn
}

/**
 * <zh/> 从容器子节点中提取带有指定 data 属性的 key 值列表，用于获取已渲染的列/行 key 顺序。
 * <en/> Extract the key-value list of child nodes carrying a given data attribute, used to get the rendered column/row key order.
 *
 * @param container - <zh/> 容器 DOM 元素（可为 null） | <en/> container DOM element (may be null)
 * @param attributeName - <zh/> 用于标记的 data 属性名，如 ADV_TABLE_COLUMN_KEY_ATTR | <en/> data attribute name used for marking, e.g. ADV_TABLE_COLUMN_KEY_ATTR
 * @returns <zh/> 提取到的 key 字符串数组，按子节点顺序排列 | <en/> extracted key string array, in child-node order
 */
export function getMarkedChildKeys(
  container: HTMLElement | null,
  attributeName: string,
): string[] {
  if (!container)
    return []

  return Array.from(container.children)
    .map((child) => {
      const marker = (child as HTMLElement).querySelector(`[${attributeName}]`) as HTMLElement | null
      return marker?.getAttribute(attributeName) ?? ''
    })
    .filter((key): key is string => key.length > 0)
}
