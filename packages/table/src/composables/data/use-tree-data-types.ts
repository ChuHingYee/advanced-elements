import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue'
import type { TreeConfig, TreeRowMeta } from '../../types/config'

/**
 * <zh/> `useTreeData` 的选项与返回契约——自 use-tree-data.ts 拆出（COMPLEXITY-PLAN 战线三，
 * <zh/> 刀法 C）；use-tree-data.ts re-export 本文件，既有导入路径零变化。
 * <en/> Options and return contracts of `useTreeData` — split out of use-tree-data.ts
 * <en/> (COMPLEXITY-PLAN battle line 3, knife C); use-tree-data.ts re-exports this file,
 * <en/> keeping every existing import path unchanged.
 */
export interface UseTreeDataOptions<T = any> {
  /** <zh/> 树形配置 | <en/> Tree config */
  treeConfig: MaybeRefOrGetter<TreeConfig | undefined>
  /** <zh/> 数据源 | <en/> Data source */
  data: MaybeRefOrGetter<T[]>
  /** <zh/> 行键函数 | <en/> Row key function */
  rowKeyFn: MaybeRefOrGetter<(row: T) => string>
}

export interface UseTreeDataReturn<T = any> {
  /** <zh/> 展平后的数据 | <en/> Flattened data */
  flattenedData: ComputedRef<T[]>
  /** <zh/> 获取树形元数据 | <en/> Get tree metadata */
  getTreeMeta: (row: any) => TreeRowMeta | undefined
  /** <zh/> 切换行展开/折叠（异步懒加载时返回 Promise） | <en/> Toggle row expand/collapse (returns Promise for async lazy-load) */
  toggleRowExpand: (rowKey: string | number) => Promise<void>
  /** <zh/> 展开指定行（异步懒加载时返回 Promise） | <en/> Expand specified row (returns Promise for async lazy-load) */
  expandRow: (rowKey: string | number) => Promise<void>
  /** <zh/> 折叠指定行 | <en/> Collapse specified row */
  collapseRow: (rowKey: string | number) => void
  /** <zh/> 展开所有行 | <en/> Expand all rows */
  expandAll: () => void
  /** <zh/> 折叠所有行 | <en/> Collapse all rows */
  collapseAll: () => void
  /** <zh/> 已展开的行 key 集合 | <en/> Expanded row keys set */
  expandedRowKeys: ShallowRef<Set<string | number>>
  /** <zh/> 是否启用树形模式 | <en/> Whether tree mode is enabled */
  treeEnabled: ComputedRef<boolean>
  /** <zh/> 缩进宽度 | <en/> Indent width */
  indent: ComputedRef<number>
  /** <zh/> 收集所有 key | <en/> Collect all keys */
  collectAllKeys: (data: T[]) => Set<string | number>
  /** <zh/> 获取后代 key | <en/> Get descendant keys */
  getDescendantKeys: (rowKey: string | number) => Set<string | number>
  /** <zh/> 获取祖先 key | <en/> Get ancestor keys */
  getAncestorKeys: (rowKey: string | number) => string[]
  checkStrictly: ComputedRef<boolean>
}
