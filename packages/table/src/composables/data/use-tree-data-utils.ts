import { toRaw } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> 树形数据键与收集纯函数——自 use-tree-data.ts 拆出（COMPLEXITY-PLAN 战线三，刀法 A），
 * <zh/> 主体逐字未改。
 * <en/> Tree-data key &amp; collection pure helpers — split out of use-tree-data.ts
 * <en/> (COMPLEXITY-PLAN battle line 3, knife A), bodies unchanged.
 */

/**
 * <zh/> dev-only 树懒加载错误提示（loadChildren 内部吞掉取消类错误并返回布尔，此为池化路径的最后防线）
 * <en/> Dev-only tree lazy-load error hint (loadChildren swallows cancellation errors and returns boolean;
 * <en/> this is the last line of defense for the pooled path)
 */
export function devTreeWarn(error: unknown): void {
  if (isDev)
    devWarn('[AdvTable] expandAll lazy-load task failed:', error)
}

/**
 * <zh/> 是否为取消类错误——loadData 遵守 signal 时被取代/卸载/deactivate 会 reject AbortError，
 * <zh/> 此类错误应静默返回 false，而非上浮为 unhandled rejection。
 * <en/> Whether the error is cancellation-shaped — a signal-abiding loadData rejects with
 * <en/> AbortError on supersede/unmount/deactivate; swallow those as `false` instead of
 * <en/> letting them surface as unhandled rejections.
 */
export function isAbortError(error: unknown): boolean {
  if (error == null || typeof error !== 'object')
    return false
  const err = error as { name?: unknown, code?: unknown }
  return err.name === 'AbortError' || err.code === 20
}

/**
 * <zh/> 元数据 WeakMap 的统一键——行对象可能以响应式代理形式传入（如 default 模式经 ElTable 槽位渲染），
 * WeakMap 引用相等性要求以原始对象为键。
 * <en/> Unified key for the metadata WeakMap — row objects may arrive as reactive proxies (e.g. default mode via ElTable slots);
 * WeakMap reference identity requires using the raw (unwrapped) object as the key.
 */
export function rowMetaKey(row: unknown): object {
  return toRaw(row) as object
}

/** <zh/> 公开 key 入口归一化：树展开状态只存 string | <en/> Normalize public keys to string */
export function normalizeTreeKey(key: string | number): string {
  return String(key)
}

/**
 * <zh/> 树遍历访问守卫——脏数据 / 异步增量合并可能产生父子环（A.children 含 A 自身或祖先），
 * <zh/> 无 visited 集合的 DFS 会死循环卡死页面。以对象身份 + 归一化 key 双重去重，
 * <zh/> 防"同对象自环"与"异对象同 key 环"；命中重复时 dev 告警并跳过子树。
 * <en/> Tree-walk visit guard — dirty data / incremental async merges can introduce
 * <en/> parent-child cycles and hang a visited-less DFS forever. Dedupes by both object
 * <en/> identity and normalized key, dev-warns and skips the subtree on repeats.
 */
export function createTreeVisitGuard<T>(keyFn: (row: T) => string | number): (row: T) => boolean {
  const seenObjects = new WeakSet<object>()
  const seenKeys = new Set<string | number>()
  return (row: T): boolean => {
    if (typeof row === 'object' && row !== null) {
      const raw = toRaw(row) as object
      if (seenObjects.has(raw))
        return false
      seenObjects.add(raw)
    }
    const k = normalizeTreeKey(keyFn(row))
    if (seenKeys.has(k)) {
      if (isDev)
        devWarn('[useTreeData] 检测到重复行 key，已跳过子树以避免死循环：', k)
      return false
    }
    seenKeys.add(k)
    return true
  }
}

/** <zh/> 迭代收集所有节点的 key，避免深层嵌套时递归栈溢出 | <en/> Iteratively collect all node keys to avoid deep-recursion stack overflow */
export function collectKeys<T>(
  data: T[],
  childrenKey: string,
  keyFn: (row: T) => string | number,
): Set<string | number> {
  const keys = new Set<string | number>()
  const shouldVisit = createTreeVisitGuard(keyFn)
  const stack: T[] = [...data]
  while (stack.length > 0) {
    const row = stack.pop()!
    if (!shouldVisit(row))
      continue
    keys.add(normalizeTreeKey(keyFn(row)))
    const children = (row as Record<string, unknown>)[childrenKey]
    if (Array.isArray(children)) {
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i])
      }
    }
  }
  return keys
}

/**
 * <zh/> 迭代遍历整棵树，填充 keyToRow（包括折叠子树中的行）。
 * <zh/> 确保后代/祖先查找对未展平的行也能 O(1) 命中，避免退化到全树搜索。
 *
 * <en/> Iteratively walk the entire tree, populating keyToRow (including rows in collapsed subtrees).
 * <en/> Ensures descendant/ancestor lookups hit O(1) for non-flattened rows, avoiding full-tree search fallback.
 */
export function buildFullKeyToRow<T>(
  data: T[],
  childrenKey: string,
  keyFn: (row: T) => string | number,
  keyToRow: Map<string | number, T>,
): void {
  const shouldVisit = createTreeVisitGuard(keyFn)
  const stack: T[] = [...data]
  while (stack.length > 0) {
    const row = stack.pop()!
    if (!shouldVisit(row))
      continue
    keyToRow.set(normalizeTreeKey(keyFn(row)), row)
    const children = (row as Record<string, unknown>)[childrenKey]
    if (Array.isArray(children)) {
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i])
      }
    }
  }
}
