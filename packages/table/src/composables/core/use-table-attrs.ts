import { computed } from 'vue'

/**
 * <zh/> 需要从 $attrs 中过滤的属性集合
 * <en/> Set of attributes to filter from $attrs
 *
 * @remarks
 * <zh/> 两类：
 * <zh/> 1. 事件处理器 — Vue 将 @event 规范化为 $attrs 中的 onEvent，透传会导致双重触发
 * <zh/> 2. 会覆盖模板显式绑定的属性 — 如 rowKey（用户传 row-key="id" 产生 $attrs.rowKey = "id"，会覆盖模板中 :row-key="rowKeyFn" 的函数绑定）
 * <en/> Two categories:
 * <en/> 1. Event handlers — Vue normalizes @event to onEvent in $attrs, passing through causes double triggering
 * <en/> 2. Properties that override explicit template bindings — e.g., rowKey (user passes row-key="id" produces $attrs.rowKey = "id", which overrides the :row-key="rowKeyFn" function binding in the template)
 */
const FILTERED_ATTRS = new Set([
  'onUpdate:currentPage',
  'onUpdate:current-page',
  'onUpdate:pageSize',
  'onUpdate:page-size',
  'onSelectionChange',
  'onSelect',
  'onSelectAll',
  'onRowClick',
  'onRowContextmenu',
  'onRowDblclick',
  'onCurrentChange',
  'onCellClick',
  'onCellDblclick',
  'onCellContextmenu',
  'onCellMouseEnter',
  'onCellMouseLeave',
  'onHeaderClick',
  'onHeaderContextmenu',
  'onHeaderDragend',
  'onSortChange',
  'onFilterChange',
  'onExpandChange',
  'onColumnSort',
  'onRowsRendered',
  'onEndReached',
  'onExpandedRowsChange',
  'onRowExpand',
  'onQuery',
  'onReset',
  'onScroll',
  'onDataChange',
  'onToggleColumnGroupCollapse',
  'rowkey',
  'height',
].map(p => p.toLowerCase()))

/**
 * <zh/> 判断属性名是否需要过滤
 * @param key - <zh/> 属性名（camelCase） | <en/> attribute name (camelCase)
 */
function isFiltered(key: string): boolean {
  return FILTERED_ATTRS.has(key.toLowerCase())
}

/**
 * <zh/> 从 $attrs 中过滤事件处理器和冲突属性，保留其余纯 attribute。
 *
 * <zh/> 本函数只负责「过滤」这一档，不决定去向：落到哪个元素由 `useRendererIntegration` 的第二档分流
 * <zh/> （保留键 `id` 之外的全部属性 → 表格根节点；分页开关由 `props.pagination` 注入分页器，
 * <zh/> 不再走 `$attrs`）。此前注释声称“透传到内部 ElTable / ElTableV2”，与实现不符，会误导后续接线者。
 *
 * <zh/> 利用 Vue 3.4+ computed 稳定性优化缓存。
 *
 * @param attrs - <zh/> 组件 $attrs | <en/> component $attrs
 * @returns <zh/> 过滤后的纯 attribute 对象（computed） | <en/> filtered pure attribute object (computed)
 *
 * <en/> Filter event handlers and conflicting attributes from $attrs, keeping the remaining pure attributes.
 *
 * <en/> This function owns the "filter" stage only and does not decide the destination: which element an
 * <en/> attribute lands on is the second stage inside `useRendererIntegration` (everything except the reserved
 * <en/> `id` key → the table root; pagination switches are injected from `props.pagination` and no longer
 * <en/> travel through `$attrs`). The previous note claiming passthrough “to internal ElTable / ElTableV2”
 * <en/> contradicted the implementation and misled whoever wired it up.
 *
 * <en/> Leverages Vue 3.4+ computed stability optimization for caching.
 */
export function useTableAttrs(attrs: Record<string, any>) {
  return computed((prev: Record<string, any> | undefined) => {
    const result: Record<string, any> = {}
    let changed = !prev
    let keyCount = 0
    for (const key in attrs) {
      if (!isFiltered(key)) {
        keyCount++
        result[key] = attrs[key]
        if (!changed && prev && prev[key] !== attrs[key]) {
          changed = true
        }
      }
    }
    if (!changed && prev && Object.keys(prev).length === keyCount) {
      return prev
    }
    return result
  })
}
