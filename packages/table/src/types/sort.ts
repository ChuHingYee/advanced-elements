/**
 * <zh/> 排序状态类型——领域类型下沉。
 * <zh/> 此处为唯一真源，hook 内转出以便排序消费者单点导入。
 * <en/> Sort state type — domain type sunk to the type layer.
 * <en/> Single source of truth here; re-exported from the hook for single-point imports.
 */

/**
 * <zh/> 排序方向——升序 / 降序 / 空（无排序）。
 *
 * <zh/> 本别名是排序方向的**唯一命名真源**。此前该联合在 14 个文件里内联书写
 * <zh/> 26 次（`table-emits` / `use-table-api` / `use-column-sort` / `config-api` / `column-state` /
 * <zh/> `interceptor` / `use-adv-table-data-columns` / `use-table-data-pipeline` / `use-table-request` /
 * <zh/> `render-helpers` / `column-renderer` / `v2-header` 等）。内联的代价是**改排序语义要改十几处**，
 * <zh/> 且 TS 无法对「排序方向」做统一收窄——调用方只能拿到一个匿名联合，编辑器补全与错误信息都无法
 * <zh/> 指向一个具名概念。凡涉及排序方向的签名一律引用本别名。
 *
 * <en/> Sort direction — ascending / descending / null (unsorted).
 *
 * <en/> This alias is the single **named** source of truth for sort direction . The
 * <en/> union used to be inlined 26 times across 14 files (`table-emits` / `use-table-api` /
 * <en/> `use-column-sort` / `config-api` / `column-state` / `interceptor` / `use-adv-table-data-columns` /
 * <en/> `use-table-data-pipeline` / `use-table-request` / `render-helpers` / `column-renderer` /
 * <en/> `v2-header`, …). The cost of inlining: changing the sort semantics means editing a dozen
 * <en/> places, and TypeScript cannot narrow "sort direction" uniformly — callers only see an anonymous
 * <en/> union, so completion and diagnostics never point at a named concept. Every signature involving
 * <en/> sort direction references this alias.
 */
export type SortOrder = 'ascending' | 'descending' | null

/** <zh/> 单列排序状态 | <en/> Single-column sort state */
export interface SortState {
  /** <zh/> 列属性名或列标识 | <en/> Column property name or identifier */
  prop: string
  /** <zh/> 排序方向：升序、降序或空（无排序） | <en/> Sort direction: ascending, descending, or null (no sort) */
  order: SortOrder
  /** <zh/> 列主键（columnKey），内部统一以它匹配列；prop 为列的属性名，两者并存 | <en/> Column primary key — internal matching is unified on it; prop is the column property name, both coexist */
  columnKey?: string
}
