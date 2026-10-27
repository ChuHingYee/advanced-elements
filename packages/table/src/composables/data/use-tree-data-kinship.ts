import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { TreeConfig, TreeRowMeta } from '../../types/config'
import { toValue } from 'vue'
import { findAncestorPath, findRowByKey } from './use-tree-data-flatten'
import { createTreeVisitGuard, normalizeTreeKey, rowMetaKey } from './use-tree-data-utils'

/**
 * <zh/> 亲缘查询依赖 | <en/> Kinship-query deps
 */
export interface UseTreeDataKinshipDeps<T> {
  treeConfig: MaybeRefOrGetter<TreeConfig | undefined>
  data: MaybeRefOrGetter<T[]>
  rowKeyFn: MaybeRefOrGetter<(row: T) => string>
  treeRevision: ShallowRef<number>
  /** <zh/> key → 行对象映射（含折叠子树，由展平层维护） | <en/> key→row map (incl. collapsed subtrees, maintained by the flatten layer) */
  keyToRow: Map<string | number, T>
  metaMap: WeakMap<object, TreeRowMeta>
}

/**
 * <zh/> 后代/祖先查询——带令牌校验的双缓存（getDescendantKeys / getAncestorKeys）。
 *
 * <zh/> 自 use-tree-data.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），函数体逐字未改。
 * <en/> Descendant/ancestor queries — dual caches with token validation (getDescendantKeys / getAncestorKeys).
 *
 * <en/> Migrated verbatim from use-tree-data.ts (COMPLEXITY-PLAN battle line 3, knife C),
 * <en/> function bodies unchanged.
 */
export function useTreeDataKinship<T>(deps: UseTreeDataKinshipDeps<T>) {
  const { treeConfig, data, rowKeyFn, treeRevision, keyToRow, metaMap } = deps

  /**
   * <zh/> 后代/祖先缓存——令牌与 `keyToRow` 的重建条件**同源**（数据引用 / childrenKey / rowKeyFn），
   * <zh/> 并额外纳入 `treeRevision`（懒加载经 `row[childrenKey] = children` 原地写入子节点，
   * <zh/> 上述三者都不变，仅 revision 递增）。
   *
   * <zh/> 为何不用 `flattenedData.value` 作令牌：树形分支每次重算都返回**新数组**，
   * <zh/> 展开/折叠（可见性变化，不改变后代关系）也会产生新引用 → 缓存被无谓清空，
   * <zh/> 命中率趋近于 0，级联选择/全选每次都重走整棵子树。
   *
   * <en/> Descendant/ancestor cache — the token shares its source with `keyToRow`'s rebuild
   * <en/> condition (data ref / childrenKey / rowKeyFn) plus `treeRevision` (lazy loading writes
   * <en/> children in place via `row[childrenKey] = children`, leaving the other three unchanged
   * <en/> while bumping the revision).
   *
   * <en/> Why not key on `flattenedData.value`: the tree branch returns a **new array** on every
   * <en/> recompute, and expanding/collapsing (a visibility change that does not alter descendant
   * <en/> relations) also produces a fresh reference — so the cache was needlessly cleared, its hit
   * <en/> rate approached zero, and cascade selection / select-all re-walked whole subtrees each time.
   */
  let cachedDescendantsRev: unknown = null
  let cachedDescendantsRows: unknown = null
  let cachedDescendantsChildrenKey: unknown = null
  let cachedDescendantsKeyFn: unknown = null
  const descendantCache = new Map<string | number, Set<string | number>>()
  const ancestorCache = new Map<string | number, string[]>()

  function ensureCacheValid() {
    const rev = treeRevision.value
    const rows = toValue(data)
    const childrenKey = toValue(treeConfig)?.children ?? 'children'
    const keyFn = toValue(rowKeyFn)
    if (
      cachedDescendantsRev !== rev
      || cachedDescendantsRows !== rows
      || cachedDescendantsChildrenKey !== childrenKey
      || cachedDescendantsKeyFn !== keyFn
    ) {
      descendantCache.clear()
      ancestorCache.clear()
      cachedDescendantsRev = rev
      cachedDescendantsRows = rows
      cachedDescendantsChildrenKey = childrenKey
      cachedDescendantsKeyFn = keyFn
    }
  }

  function getDescendantKeys(rowKey: string | number): Set<string | number> {
    const config = toValue(treeConfig)
    if (!config)
      return new Set()

    ensureCacheValid()
    const normalizedKey = normalizeTreeKey(rowKey)
    const cached = descendantCache.get(normalizedKey) ?? descendantCache.get(rowKey)
    if (cached)
      return cached

    const keyFn = toValue(rowKeyFn)
    const childrenKey = config.children ?? 'children'
    const result = new Set<string | number>()

    /** 优先从 keyToRow Map 查找（O(1)），回退到全树搜索（首次 flatten 前调用场景） */
    const target = keyToRow.get(normalizedKey) ?? keyToRow.get(rowKey) ?? findRowByKey(toValue(data), normalizedKey, keyFn, childrenKey)
    if (!target) {
      descendantCache.set(normalizedKey, result)
      return result
    }

    // 迭代遍历后代（访问守卫防环形数据死循环）
    const shouldVisit = createTreeVisitGuard(keyFn)
    // 起点自身先标记已访问，避免其经环回到自己时被重复展开
    shouldVisit(target)
    const stack: T[] = [target]
    let isFirstPop = true
    while (stack.length > 0) {
      const row = stack.pop()!
      // 首弹为起点本身（已预标记，跳过守卫）；后续弹栈一律过守卫，自环/回环即被拦截
      if (!isFirstPop && !shouldVisit(row))
        continue
      isFirstPop = false
      const children = (row as Record<string, unknown>)[childrenKey]
      if (!Array.isArray(children))
        continue
      for (let i = children.length - 1; i >= 0; i--) {
        result.add(normalizeTreeKey(keyFn(children[i])))
        stack.push(children[i])
      }
    }
    descendantCache.set(normalizedKey, result)
    return result
  }

  function getAncestorKeys(rowKey: string | number): string[] {
    const config = toValue(treeConfig)
    if (!config)
      return []

    ensureCacheValid()
    const normalizedKey = normalizeTreeKey(rowKey)
    const cached = ancestorCache.get(normalizedKey) ?? ancestorCache.get(rowKey)
    if (cached)
      return cached

    const keyFn = toValue(rowKeyFn)
    const childrenKey = config.children ?? 'children'
    const result: string[] = []

    /** 优先从 keyToRow Map 查找（O(1)），回退到全树搜索 */
    const target = keyToRow.get(normalizedKey) ?? keyToRow.get(rowKey) ?? findRowByKey(toValue(data), normalizedKey, keyFn, childrenKey)
    if (!target) {
      ancestorCache.set(normalizedKey, result)
      return result
    }

    let current = metaMap.get(rowMetaKey(target))
    while (current?.parentKey != null) {
      result.push(String(current.parentKey))
      /** 通过 keyToRow Map O(1) 获取父行，替代 findRowByKey 全树搜索 */
      const parentRow = keyToRow.get(normalizeTreeKey(current.parentKey)) ?? keyToRow.get(current.parentKey) ?? findRowByKey(toValue(data), current.parentKey, keyFn, childrenKey)
      if (!parentRow)
        break
      current = metaMap.get(rowMetaKey(parentRow))
    }
    if (result.length === 0) {
      /**
       * <zh/> 折叠子树回退——meta 仅在展平可见路径写入，折叠中的行无 meta，
       * <zh/> 上方循环直接落空。此时在全量嵌套数据中按路径重查（O(n)，命中 ancestorCache 后不再重算），
       * <zh/> 使折叠态 selectRowByKey/级联删除仍能冒泡到父。目标不存在时返回 []（语义不变）。
       * <en/> folded-subtree fallback — meta is only written on flattened visible paths, so folded
       * <en/> rows miss it and the loop above yields nothing. Re-resolve by path over the full nested
       * <en/> data (O(n), cached in ancestorCache afterwards) so folded selectRowByKey/cascade removal
       * <en/> still bubbles to the parent. Absent targets still return [] (semantics unchanged).
       */
      const fallback = findAncestorPath(toValue(data), normalizedKey, keyFn, childrenKey)
      // <zh/> 与上方 meta 链同序（近亲优先）：路径为根→叶，需反转 | <en/> Same order as the meta chain above (nearest first): the path is root→leaf, reverse it
      for (let i = fallback.length - 1; i >= 0; i--)
        result.push(String(fallback[i]))
    }
    ancestorCache.set(normalizedKey, result)
    return result
  }

  return { getDescendantKeys, getAncestorKeys }
}
