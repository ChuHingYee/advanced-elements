/**
 * <zh/> virtual 渲染器的 props 类型收口
 * <en/> Virtual-renderer props type collection point
 *
 * @remarks
 * <zh/> `VirtualRendererProps` 只描述渲染器公共契约；`table.vue` 还会向本渲染器下发
 * <zh/> V2 专属字段（行高、表头高度、列分组折叠、滚动条预留宽度等），这些字段原先只存在于
 * <zh/> `table-virtual-renderer.vue` 的内联 props 类型里。拆分后各子模块都需要读取它们，
 * <zh/> 若各模块自行 `as any` 断言或重复内联，字段改名就会静默失配——故在此单一收口。
 * <en/> `VirtualRendererProps` only describes the renderer's public contract; `table.vue` also passes
 * <en/> V2-specific fields (row height, header height, column-group collapse, scrollbar gutter, …)
 * <en/> that used to live solely in `table-virtual-renderer.vue`'s inline props type. After the split
 * <en/> every sub-module reads them; per-module `as any` casts or duplicated inline types would make a
 * <en/> field rename fail silently — hence this single collection point.
 */
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { VirtualRendererProps } from '../../types/renderer'

/**
 * <zh/> 虚拟渲染器实际接收的 props（公共契约 + V2 专属字段，均已在组件内 withDefaults 兜底）
 * <en/> Props the virtual renderer actually receives (public contract + V2-specific fields, all defaulted in the component)
 */
export interface V2RendererProps<T = any> extends VirtualRendererProps<T> {
  /** <zh/> 原始列配置（列分组折叠时查找原始列） | <en/> Original column config (used to find original columns during column group collapse) */
  originalColumns?: LocalColumn[]
  /** <zh/> 判断列是否可折叠 | <en/> Whether the column is collapsible */
  canCollapse?: (col: LocalColumn) => boolean
  /** <zh/> 判断指定列是否已折叠 | <en/> Whether the specified column is collapsed */
  isCollapsed?: (columnKey: string) => boolean
  /** <zh/> 表头单元格高度（px） | <en/> Header cell height (px) */
  headerCellHeight: number
  /** <zh/> 浮动筛选行高度（px） | <en/> Floating filter row height (px) */
  floatingFilterHeight: number
  /** <zh/> 行高（px） | <en/> Row height (px) */
  rowHeight: number
  /** <zh/> 是否根据内容自动计算列宽 | <en/> Whether to auto-size columns based on content */
  autoSizeColumns?: boolean
  /** <zh/> EP 垂直滚动条预留宽度（px），未配置时取 EP 默认 6 | <en/> Reserved vertical scrollbar width (px), defaults to EP's 6 when unconfigured */
  vScrollbarSize?: number
}
