import type { TreeConfig, TreeRowMeta } from '../../types/config'
import { collectKeys, createTreeVisitGuard, normalizeTreeKey, rowMetaKey } from './use-tree-data-utils'

/**
 * <zh/> 树形展平与查找族——自 use-tree-data.ts 拆出（COMPLEXITY-PLAN 战线三，刀法 A 纯函数
 * <zh/> 下沉：原闭包内函数均以显式参数传入，无捕获依赖），主体逐字未改。
 * <en/> Tree flatten &amp; lookup family — split out of use-tree-data.ts (COMPLEXITY-PLAN battle
 * <en/> line 3, knife A: the former closures all take explicit args, no captures), bodies unchanged.
 */

/**
 * <zh/> 迭代展平树形数据，同时构建元信息映射。
 * <zh/> 使用栈替代递归，避免深层嵌套时栈溢出。
 * <zh/> 从 prevMeta 保留 loading/loaded 状态，确保懒加载状态跨重算保持一致。
 *
 * <en/> Iteratively flatten tree data, building metadata mapping simultaneously.
 * Uses a stack instead of recursion to avoid stack overflow on deeply nested trees.
 * Preserves loading/loaded state from prevMeta, ensuring lazy-load state consistency across recomputes.
 */
export function flattenTreeRowsIterative<T>(
  data: T[],
  expandedKeys: Set<string | number>,
  config: TreeConfig,
  keyFn: (row: T) => string | number,
  metaMap: WeakMap<object, TreeRowMeta>,
  keyToRow: Map<string | number, T>,
): T[] {
  const childrenKey = config.children ?? 'children'
  const indentUnit = config.indent ?? 20
  const hasChildrenFieldName = config.hasChildren

  const result: T[] = []
  /** 栈项：{ row, level, parentKey } */
  const stack: Array<{ row: T, level: number, parentKey: string | number | null }> = []

  // 根节点倒序入栈，保证出栈时正序 | Root nodes pushed in reverse order for correct sequential processing
  for (let i = data.length - 1; i >= 0; i--) {
    stack.push({ row: data[i], level: 0, parentKey: null })
  }

  const shouldVisit = createTreeVisitGuard(keyFn)
  while (stack.length > 0) {
    const { row, level, parentKey } = stack.pop()!
    /** 环形数据防护：已访问过的行跳过整棵子树，避免死循环 */
    if (!shouldVisit(row))
      continue
    const key = keyFn(row)
    const normalizedKey = normalizeTreeKey(key)
    const children = (row as Record<string, unknown>)[childrenKey]
    const hasChildren = Array.isArray(children) && children.length > 0
    const isExpanded = expandedKeys.has(normalizedKey) || expandedKeys.has(key)
    const prevMeta = metaMap.get(rowMetaKey(row))
    const isLoading = prevMeta?.loading ?? false

    /**
     * <zh/> 懒加载可展开判断：
     * - 配置了 hasChildren 字段名时，仅该字段为 true 的节点可懒加载展开
     * - 未配置时，loadData 存在即视为所有节点可展开
     * <en/> Lazy-load expandable check:
     * - When hasChildren field name is configured, only nodes with that field true can be lazily loaded
     * - When not configured, loadData existence means all nodes are expandable
     */
    const hasLazyChildren = hasChildrenFieldName
      ? (row as Record<string, unknown>)[hasChildrenFieldName] === true
      : !!config.loadData

    const meta: TreeRowMeta = {
      level,
      hasChildren: hasChildren || hasLazyChildren,
      expanded: isExpanded,
      parentKey,
      indentPx: level * indentUnit,
      /**
       * <zh/> loaded 判断：
       * - 已有实际子节点 → loaded
       * - 不可懒加载（叶节点） → loaded
       * - 可懒加载且已展开过 → 从 prevMeta 读取已加载状态
       * <en/> loaded check:
       * - Has actual child nodes → loaded
       * - Not lazily loadable (leaf node) → loaded
       * - Lazily loadable and previously expanded → read loaded state from prevMeta
       */
      loaded: hasChildren || !hasLazyChildren || (prevMeta?.loaded ?? false),
      loading: isLoading,
    }

    metaMap.set(rowMetaKey(row), meta)
    /** 覆盖 keyToRow 中的条目（buildFullKeyToRow 已填充，此处同值覆盖无副作用） */
    keyToRow.set(normalizedKey, row)
    result.push(row)

    if (hasChildren && isExpanded && Array.isArray(children)) {
      // 子节点倒序入栈，保证出栈时正序 | Children pushed in reverse order for correct sequential processing
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ row: children[i], level: level + 1, parentKey: normalizedKey })
      }
    }
  }

  return result
}

/** <zh/> 在嵌套数据中按 key 查找行对象（迭代栈，避免深层递归溢出） | <en/> Find a row object by key in nested data (iterative stack, no deep recursion) */
export function findRowByKey<T>(rows: T[], targetKey: string | number, keyFn: (row: T) => string | number, childrenKey: string): T | undefined {
  const normalizedTarget = normalizeTreeKey(targetKey)
  const shouldVisit = createTreeVisitGuard(keyFn)
  const stack: T[] = [...rows]
  while (stack.length > 0) {
    const row = stack.pop()!
    if (!shouldVisit(row))
      continue
    if (normalizeTreeKey(keyFn(row)) === normalizedTarget)
      return row
    const children = (row as Record<string, unknown>)[childrenKey]
    if (Array.isArray(children) && children.length > 0) {
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i] as T)
      }
    }
  }
  return undefined
}

/** <zh/> 在嵌套数据中按 key 查找从根到目标的祖先键路径（迭代栈，避免深层递归溢出） | <en/> Find the root-to-target ancestor key path by key in nested data (iterative stack, no deep recursion) */
export function findAncestorPath<T>(rows: T[], targetKey: string | number, keyFn: (row: T) => string | number, childrenKey: string): Array<string | number> {
  const normalizedTarget = normalizeTreeKey(targetKey)
  const shouldVisit = createTreeVisitGuard(keyFn)
  const stack: Array<{ row: T, ancestors: Array<string | number> }> = rows.map(row => ({ row, ancestors: [] }))
  while (stack.length > 0) {
    const { row, ancestors } = stack.pop()!
    if (!shouldVisit(row))
      continue
    if (normalizeTreeKey(keyFn(row)) === normalizedTarget)
      return ancestors
    const children = (row as Record<string, unknown>)[childrenKey]
    if (Array.isArray(children) && children.length > 0) {
      const key = keyFn(row)
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ row: children[i] as T, ancestors: [...ancestors, key] })
      }
    }
  }
  return []
}

export function initExpandedKeys<T>(config: TreeConfig, data: T[], keyFn: (row: T) => string | number): Set<string | number> {
  if (config.defaultExpandAll) {
    return collectKeys(data, config.children ?? 'children', keyFn)
  }
  return new Set<string | number>((config.defaultExpandedRowKeys ?? []).map(normalizeTreeKey))
}
