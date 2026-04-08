import type { MaybeRefOrGetter } from 'vue'
import type { ProcessedColumn } from '../../types'
import { toValue, watch } from 'vue'
import { findColumnByKey } from '../../utils/column-tree'

function findRightmostLeafKey(node: ProcessedColumn, getColumnKey: (col: ProcessedColumn) => string): string | null {
  const children = node?.children
  if (Array.isArray(children) && children.length > 0) {
    const last = children.at(-1)
    if (last)
      return findRightmostLeafKey(last, getColumnKey)
    return null
  }
  if (!node)
    return null
  return getColumnKey(node)
}

export interface UseColumnResizeKeyResolverOptions {
  getColumnKey: (col: ProcessedColumn) => string
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  groupTree?: MaybeRefOrGetter<ProcessedColumn[]>
}

/**
 * <zh/> 列宽调整 key 解析 composable——维护列 key 到列节点的映射与叶子 key 集合，
 * <zh/> 并将分组表头 key 解析为其最右侧叶子列 key（列宽拖拽手柄落点）。
 * <en/> Column resize key resolver composable — maintains column-key-to-node maps and the leaf key set,
 * <en/> and resolves a group header key to its rightmost leaf column key (the resize handle target).
 *
 * @param options - <zh/> 解析选项（列 key 取值器、列树与可选分组树） | <en/> Resolver options (column key getter, columns and optional group tree)
 * @returns <zh/> key 映射、叶子 key 集合及重建/解析方法 | <en/> Key maps, leaf key set and rebuild/resolve functions
 */
export function useColumnResizeKeyResolver(options: UseColumnResizeKeyResolverOptions) {
  const { getColumnKey, columns, groupTree } = options

  const keyToColumnNode = new Map<string, ProcessedColumn>()
  const leafColumnKeySet = new Set<string>()

  /**
   * <zh/> 重建列键映射——copy-on-write：先在临时容器构建，成功后整体写入。
   * <zh/> 中途 `getColumnKey` 抛错时不会留下"半重建"的 Map（原子重建），
   * <zh/> 且容器引用保持稳定（外部持有的是同一个 Map/Set 实例）。
   * <en/> Rebuild the column-key map — copy-on-write: build into temporary containers, then commit.
   * <en/> A throwing `getColumnKey` mid-way never leaves a half-rebuilt map (atomic rebuild), and the
   * <en/> container references stay stable (callers hold the same Map/Set instances).
   */
  function rebuildColumnNodeMap(): void {
    const nextKeyToColumnNode = new Map<string, ProcessedColumn>()
    const nextLeafColumnKeySet = new Set<string>()
    const tree = groupTree ? toValue(groupTree) : null
    if (tree) {
      const stack = [...tree]
      while (stack.length > 0) {
        const node = stack.pop()!
        nextKeyToColumnNode.set(getColumnKey(node), node)
        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            stack.push(child)
          }
        }
      }
    }
    const cols = toValue(columns)
    for (const col of cols) {
      nextLeafColumnKeySet.add(getColumnKey(col))
    }
    keyToColumnNode.clear()
    for (const [key, node] of nextKeyToColumnNode) {
      keyToColumnNode.set(key, node)
    }
    leafColumnKeySet.clear()
    for (const key of nextLeafColumnKeySet) {
      leafColumnKeySet.add(key)
    }
  }

  // <zh/> 双源监听：leafColumnKeySet 取自 columns，columns 增删必须重建，否则 isLeafColumn 过期。
  // <en/> Watch both sources: leafColumnKeySet derives from columns, so column add/remove must rebuild it.
  if (groupTree) {
    watch([() => toValue(groupTree), () => toValue(columns)], rebuildColumnNodeMap, { immediate: true, flush: 'sync' })
  }
  else {
    watch(() => toValue(columns), rebuildColumnNodeMap, { immediate: true, flush: 'sync' })
  }

  function isLeafColumn(key: string): boolean {
    return leafColumnKeySet.has(key)
  }

  function dfsFindColumnNode(key: string): ProcessedColumn | null {
    const tree = groupTree ? toValue(groupTree) : null
    if (!tree)
      return null
    // <zh/> 复用 column-tree 的单一 DFS 实现，注入本 composable 选项内的 getColumnKey
    // <en/> Reuse column-tree's single DFS implementation, injecting this composable's option-provided getColumnKey
    return findColumnByKey(tree, key, getColumnKey) ?? null
  }

  function resolveResizeTargetKey(key: string): string | null {
    if (isLeafColumn(key))
      return key
    const found = keyToColumnNode.get(key) ?? dfsFindColumnNode(key)
    if (found) {
      const rightmost = findRightmostLeafKey(found, getColumnKey)
      if (rightmost)
        return rightmost
    }
    return null
  }

  return {
    keyToColumnNode,
    leafColumnKeySet,
    rebuildColumnNodeMap,
    isLeafColumn,
    resolveResizeTargetKey,
    dfsFindColumnNode,
  }
}
