import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue'
import type { TreeConfig, TreeRowMeta } from '../../types/config'
import { computed, onDeactivated, onUnmounted, shallowRef, toRaw, toValue, watch } from 'vue'
import { createConcurrencyPool } from '../../utils/concurrency-pool'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> dev-only 树懒加载错误提示（loadChildren 内部吞掉取消类错误并返回布尔，此为池化路径的最后防线）
 * <en/> Dev-only tree lazy-load error hint (loadChildren swallows cancellation errors and returns boolean;
 * <en/> this is the last line of defense for the pooled path)
 */
function devTreeWarn(error: unknown): void {
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
function isAbortError(error: unknown): boolean {
  if (error == null || typeof error !== 'object')
    return false
  const err = error as { name?: unknown, code?: unknown }
  return err.name === 'AbortError' || err.code === 20
}

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

/**
 * <zh/> 元数据 WeakMap 的统一键——行对象可能以响应式代理形式传入（如 default 模式经 ElTable 槽位渲染），
 * WeakMap 引用相等性要求以原始对象为键。
 * <en/> Unified key for the metadata WeakMap — row objects may arrive as reactive proxies (e.g. default mode via ElTable slots);
 * WeakMap reference identity requires using the raw (unwrapped) object as the key.
 */
function rowMetaKey(row: unknown): object {
  return toRaw(row) as object
}

/** <zh/> 公开 key 入口归一化：树展开状态只存 string | <en/> Normalize public keys to string */
function normalizeTreeKey(key: string | number): string {
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
function createTreeVisitGuard<T>(keyFn: (row: T) => string | number): (row: T) => boolean {
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
function collectKeys<T>(
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
function buildFullKeyToRow<T>(
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

/**
 * <zh/> 迭代展平树形数据，同时构建元信息映射。
 * <zh/> 使用栈替代递归，避免深层嵌套时栈溢出。
 * <zh/> 从 prevMeta 保留 loading/loaded 状态，确保懒加载状态跨重算保持一致。
 *
 * <en/> Iteratively flatten tree data, building metadata mapping simultaneously.
 * <en/> Uses a stack instead of recursion to avoid stack overflow on deeply nested trees.
 * <en/> Preserves loading/loaded state from prevMeta, ensuring lazy-load state consistency across recomputes.
 */
function flattenTreeRowsIterative<T>(
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
     * <zh/> - 配置了 hasChildren 字段名时，仅该字段为 true 的节点可懒加载展开
     * <zh/> - 未配置时，loadData 存在即视为所有节点可展开
     * <en/> Lazy-load expandable check:
     * <en/> - When hasChildren field name is configured, only nodes with that field true can be lazily loaded
     * <en/> - When not configured, loadData existence means all nodes are expandable
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
       * <zh/> - 已有实际子节点 → loaded
       * <zh/> - 不可懒加载（叶节点） → loaded
       * <zh/> - 可懒加载且已展开过 → 从 prevMeta 读取已加载状态
       * <en/> loaded check:
       * <en/> - Has actual child nodes → loaded
       * <en/> - Not lazily loadable (leaf node) → loaded
       * <en/> - Lazily loadable and previously expanded → read loaded state from prevMeta
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

/**
 * <zh/> 树形数据 composable — 将嵌套树形数据展平为带缩进元信息的行数组，
 * <zh/> 管理展开/折叠状态、异步加载与父子选中联动。
 *
 * @param options - <zh/> 树形配置 | <en/> tree config
 * @returns <zh/> 树形状态与操作方法 | <en/> tree state and operation methods
 *
 * <en/> Tree data composable — flattens nested tree data into row arrays with indent metadata,
 * <en/> manages expand/collapse state, async loading, and parent-child selection linkage.
 */
export function useTreeData<T = any>(options: UseTreeDataOptions<T>): UseTreeDataReturn<T> {
  const { treeConfig, data, rowKeyFn } = options

  const treeEnabled = computed(() => toValue(treeConfig) != null)
  const indent = computed(() => toValue(treeConfig)?.indent ?? 20)
  const checkStrictly = computed(() => toValue(treeConfig)?.checkStrictly ?? false)
  const expandedRowKeys = shallowRef<Set<string | number>>(new Set())

  /**
   * <zh/> request 数据源晚到时是否已把默认展开应用到非空数据——避免数据刷新时覆盖用户手动展开状态
   * <en/> Whether default expansion has been applied to a non-empty dataset — prevents clobbering manual expansion on data refresh
   */
  let defaultsAppliedToData = false

  /**
   * <zh/> 树形状态版本号 — 每次树状态变化（展开/折叠/loading）时递增。
   * <zh/> 作为 flattenedData 和 getTreeMeta 的响应式依赖，
   * <zh/> 确保 loading 等非数据级变化也能触发渲染器重绘。
   *
   * <en/> Tree state revision number — incremented on every tree state change (expand/collapse/loading).
   * <en/> Serves as a reactive dependency for flattenedData and getTreeMeta,
   * <en/> ensuring non-data-level changes like loading state trigger renderer re-renders.
   */
  const treeRevision = shallowRef(0)
  function bumpTreeRevision() {
    treeRevision.value++
  }

  /** 用 WeakMap 存储树形元数据，避免修改响应式原始数据对象 */
  const metaMap = new WeakMap<object, TreeRowMeta>()
  /** <zh/> 正在懒加载的行对象集合——WeakMap 不可遍历，用 Set 追踪 loading 行以便批量清理 | <en/> Row objects currently loading — WeakMap is not iterable, track loading rows in a Set for bulk cleanup */
  const loadingRows = new Set<object>()
  /** key → 行对象映射，供 getAncestorKeys/getDescendantKeys 做 O(1) 查找，替代 findRowByKey 全树搜索 */
  const keyToRow = new Map<string | number, T>()

  /**
   * 组件卸载标志——防止 loadChildren 异步回调在 unmount/deactivated 后写入数据。
   * Component unmount flag — prevents loadChildren async callbacks from writing data after unmount/deactivated.
   */
  let isUnmounted = false
  /** loadChildren 的 AbortController 映射，按 rowKey 维度取消未完成的懒加载请求 */
  const loadChildrenAbortControllers = new Map<string | number, AbortController>()

  onUnmounted(() => {
    isUnmounted = true
    loadChildrenAbortControllers.forEach(controller => controller.abort())
    loadChildrenAbortControllers.clear()
  })

  onDeactivated(() => {
    /**
     * KeepAlive 切换时取消未完成的懒加载请求，防止数据写入 deactivated 组件。
     * 不重置 isUnmounted——reactivated 后允许新的 loadChildren 调用。
     * 同时清除所有 loading 标志并 bump——否则 abort 后 loading 图标永久卡死
     * （loadChildren 的 finally 只清理当前请求的 meta，此处 abort 了全部请求）。
     * Cancel in-flight lazy-load requests on KeepAlive switch, preventing data
     * writes into a deactivated component. isUnmounted is NOT reset — new
     * loadChildren calls are allowed after reactivation. Also clears every
     * loading flag and bumps the revision — otherwise aborted requests leave
     * the loading icon permanently stuck (loadChildren's finally only clears
     * the meta of the request it started).
     */
    loadChildrenAbortControllers.forEach(controller => controller.abort())
    loadChildrenAbortControllers.clear()
    if (loadingRows.size > 0) {
      for (const row of loadingRows) {
        const meta = metaMap.get(row)
        if (meta)
          meta.loading = false
      }
      loadingRows.clear()
      bumpTreeRevision()
    }
  })

  /** <zh/> 在嵌套数据中按 key 查找行对象（迭代栈，避免深层递归溢出） | <en/> Find a row object by key in nested data (iterative stack, no deep recursion) */
  function findRowByKey(rows: T[], targetKey: string | number, keyFn: (row: T) => string | number, childrenKey: string): T | undefined {
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
  function findAncestorPath(rows: T[], targetKey: string | number, keyFn: (row: T) => string | number, childrenKey: string): Array<string | number> {
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

  function initExpandedKeys(config: TreeConfig, data: T[], keyFn: (row: T) => string | number): Set<string | number> {
    if (config.defaultExpandAll) {
      return collectKeys(data, config.children ?? 'children', keyFn)
    }
    return new Set<string | number>((config.defaultExpandedRowKeys ?? []).map(normalizeTreeKey))
  }

  /**
   * <zh/> treeConfig watch 精细化 — 仅在影响展开状态初始化的属性变化时重置 expandedRowKeys。
   * <zh/> 其他属性（indent/loadData 等）变化仅通过 treeRevision 驱动重绘，不重置展开状态。
   *
   * <en/> Refined treeConfig watch — only resets expandedRowKeys when properties affecting
   * <en/> expansion initialization change. Other properties (indent/loadData etc.) only
   * <en/> trigger re-render via treeRevision without resetting expansion state.
   */
  watch(
    () => {
      const config = toValue(treeConfig)
      return {
        defaultExpandAll: config?.defaultExpandAll,
        defaultExpandedRowKeys: config?.defaultExpandedRowKeys,
        childrenKey: config?.children ?? 'children',
      }
    },
    (val) => {
      const config = toValue(treeConfig)
      if (!config)
        return
      const rows = toValue(data)
      const keyFn = toValue(rowKeyFn)
      expandedRowKeys.value = initExpandedKeys(
        { ...config, defaultExpandAll: val.defaultExpandAll, defaultExpandedRowKeys: val.defaultExpandedRowKeys, children: val.childrenKey },
        rows,
        keyFn,
      )
      // 配置初始化时数据已非空 → 默认展开已生效，标记防止数据 watch 重复应用
      defaultsAppliedToData = rows.length > 0
      bumpTreeRevision()
    },
    { immediate: true },
  )

  /**
   * <zh/> 数据到达时应用默认展开。
   * <zh/> request 数据源在配置 watch 初始化（immediate）时数据仍为空，collectKeys 得到空集；
   * <zh/> 数据首次非空后再应用一次 defaultExpandAll，避免树形默认折叠。
   * <zh/> 仅在首次非空时应用，之后的数据刷新（分页/搜索）不覆盖用户手动展开状态。
   *
   * <en/> Apply default expansion when data arrives.
   * <en/> With a request source the data is empty when the config watch initializes (immediate),
   * <en/> so collectKeys produces an empty set; re-apply defaultExpandAll once data first becomes non-empty.
   * <en/> Only applied on the first non-empty arrival; later refreshes (pagination/search) do not clobber manual expansion.
   */
  watch(
    () => toValue(data),
    (rows) => {
      const config = toValue(treeConfig)
      if (!config || defaultsAppliedToData || rows.length === 0 || !config.defaultExpandAll)
        return
      defaultsAppliedToData = true
      expandedRowKeys.value = initExpandedKeys(config, rows, toValue(rowKeyFn))
      bumpTreeRevision()
    },
  )

  /**
   * <zh/> 展平后的数据 — 依赖 treeRevision 确保 loading 状态变化触发重算。
   * <zh/> 树形分支不再使用 prev 短路，保证 metaMap 每次重算时都被重建。
   * <zh/> 非树形分支保留 prev 短路以优化性能。
   *
   * <en/> Flattened data — depends on treeRevision to ensure loading state changes trigger recompute.
   * <en/> Tree branch no longer uses prev short-circuit, guaranteeing metaMap is rebuilt on every recompute.
   * <en/> Non-tree branch retains prev short-circuit for performance.
   */
  let cachedKeyToRowRows: T[] | null = null
  let cachedKeyToRowChildrenKey = ''
  let cachedKeyToRowKeyFn: ((row: T) => string | number) | null = null
  const flattenedData = computed<T[]>((prev) => {
    const config = toValue(treeConfig)
    const rows = toValue(data)
    const keyFn = toValue(rowKeyFn)
    // 读取 treeRevision 建立响应式依赖 — loading 状态变化时驱动重算
    // Read treeRevision to establish reactive dependency — drives recompute on loading state change
    void treeRevision.value

    if (!config) {
      if (prev && prev === rows)
        return prev
      return rows
    }

    const keys = expandedRowKeys.value
    const childrenKey = config.children ?? 'children'

    /**
     * <zh/> 先全量填充 keyToRow（含折叠子树），确保后代/祖先查找 O(1) 命中。
     * <zh/> 仅当数据引用或 childrenKey 变化时重建，避免每次展开/收起触发 O(n) 全量遍历。
     * <en/> First populate keyToRow fully (including collapsed subtrees),
     * <en/> ensuring O(1) descendant/ancestor lookups. Only rebuild when data ref or childrenKey changes,
     * <en/> avoiding O(n) full walk on every expand/collapse.
     */
    if (cachedKeyToRowRows !== rows || cachedKeyToRowChildrenKey !== childrenKey || cachedKeyToRowKeyFn !== keyFn) {
      keyToRow.clear()
      buildFullKeyToRow(rows, childrenKey, keyFn, keyToRow)
      cachedKeyToRowRows = rows
      cachedKeyToRowChildrenKey = childrenKey
      cachedKeyToRowKeyFn = keyFn
    }

    const result = flattenTreeRowsIterative(rows, keys, config, keyFn, metaMap, keyToRow)

    return result
  })

  /**
   * <zh/> 获取树形元数据 — 门控：未启用树形时直接返回 undefined，避免不必要的 WeakMap 查找。
   * <zh/> 读取 treeRevision 建立响应式依赖，确保 loading 状态变化触发调用方重绘。
   *
   * <en/> Get tree metadata — gated: returns undefined immediately when tree is not enabled,
   * <en/> avoiding unnecessary WeakMap lookups.
   * <en/> Reads treeRevision to establish reactive dependency, ensuring loading state changes trigger caller re-render.
   */
  function getTreeMeta(row: any): TreeRowMeta | undefined {
    if (!treeEnabled.value)
      return undefined
    // 读取 treeRevision 建立响应式依赖 — loading 状态变化时驱动调用方重绘
    // Read treeRevision to establish reactive dependency — drives caller re-render on loading state change
    void treeRevision.value
    if (row == null || typeof row !== 'object')
      return undefined
    return metaMap.get(rowMetaKey(row))
  }

  async function loadChildren(rowKey: string | number): Promise<boolean> {
    const normalizedKey = normalizeTreeKey(rowKey)
    const config = toValue(treeConfig)
    if (!config?.loadData)
      return true

    /** <zh/> 卸载后直接返回，防止异步回调写入已销毁组件状态 | <en/> Return early after unmount to prevent async callbacks from writing state of a destroyed component */
    if (isUnmounted)
      return false

    const keyFn = toValue(rowKeyFn)
    const childrenKey = config.children ?? 'children'
    const row = keyToRow.get(normalizedKey) ?? keyToRow.get(rowKey) ?? findRowByKey(toValue(data), normalizedKey, keyFn, childrenKey)
    if (!row)
      return false

    const meta = metaMap.get(rowMetaKey(row))
    if (!meta || meta.loaded || meta.loading || !meta.hasChildren)
      return true

    /** 取消同一 rowKey 的前一次未完成请求 */
    const prevController = loadChildrenAbortControllers.get(normalizedKey) ?? loadChildrenAbortControllers.get(rowKey)
    prevController?.abort()

    const controller = new AbortController()
    loadChildrenAbortControllers.set(normalizedKey, controller)

    meta.loading = true
    loadingRows.add(rowMetaKey(row))
    // 触发 treeRevision 递增，使渲染器感知 loading 状态变化并重绘 loading 图标
    // Bump treeRevision so renderers pick up the loading state change and redraw the loading icon
    bumpTreeRevision()

    try {
      // 对外 loadData 回调拿到**原始类型**的 key（rowKeyFn 返回什么就是什么），
      // 内部状态仍只存归一化 string
      const children = await config.loadData(row, keyFn(row), { signal: controller.signal })
      /** 卸载、deactivated 或被新请求取消：丢弃结果，不写入数据 */
      if (isUnmounted || controller.signal.aborted)
        return false
      if (Array.isArray(children)) {
        /**
         * 直接 mutation row[childrenKey]——树形懒加载语义需要：
         * row 是 finalDisplayData 中的元素引用，与 pipelineData 中的元素共享同一引用。
         * mutation 后 expandedRowKeys 变化会触发 flattenedData computed 重算，
         * 重新遍历时读取到新的 children。
         *
         * 用户数据不可变场景（Object.freeze/Pinia readonly）：catch TypeError 并回滚
         * expandedRowKeys，不标记 loaded，允许用户处理不可变数据后重新展开。
         */
        try {
          (row as Record<string, unknown>)[childrenKey] = children
        }
        catch (error) {
          if (isDev) {
            devWarn('[useTreeData] loadChildren 写入 children 失败，数据可能为只读对象：', error)
          }
          // 回滚：从 expandedRowKeys 中移除该 key | Rollback: remove key from expandedRowKeys
          if (expandedRowKeys.value.has(normalizedKey)) {
            const keys = new Set(expandedRowKeys.value)
            keys.delete(normalizedKey)
            expandedRowKeys.value = keys
          }
          // 不标记 loaded，允许用户处理不可变数据后重新展开 | Don't mark loaded, allow user to process immutable data and re-expand
          return false
        }
        /**
         * <zh/> 写入成功后标记 loaded——必须取 metaMap 中的当前 meta（loading bump 触发重算会替换 meta 对象，函数起始捕获的 meta 引用可能已过期）
         * <en/> After successful write mark loaded — must read the current meta from metaMap (the loading bump triggers a recompute that replaces the meta object, so the meta reference captured at function start may be stale)
         */
        const currentMeta = metaMap.get(rowMetaKey(row))
        if (currentMeta)
          currentMeta.loaded = true
        /** 将新加载的 children 加入 keyToRow 缓存，减少后续 findRowByKey fallback */
        for (const child of children) {
          keyToRow.set(normalizeTreeKey(keyFn(child)), child)
        }
      }
    }
    catch (error) {
      /**
       * <zh/> 取消类错误（被同 key 新请求取代 / 卸载 / deactivate）静默返回 false。
       * <zh/> 非取消错误继续上抛，保留调用方 await 感知真实失败的能力。
       * <en/> Cancellation-shaped errors (superseded by a newer request / unmounted /
       * <en/> deactivated) resolve to `false` silently. Genuine errors still propagate
       * <en/> so awaiting callers can observe real failures.
       */
      if (isUnmounted || controller.signal.aborted || isAbortError(error))
        return false
      throw error
    }
    finally {
      /**
       * <zh/> 清除 loading——取 metaMap 中的当前 meta，避免写入已过期对象导致 loading 永不清除
       * <en/> Clear loading — read the current meta from metaMap to avoid writing to a stale object leaving loading stuck
       */
      const currentMeta = metaMap.get(rowMetaKey(row))
      if (currentMeta)
        currentMeta.loading = false
      loadingRows.delete(rowMetaKey(row))
      /**
       * <zh/> 仅当映射仍指向本次控制器时删除——无条件 delete 会误删同 key 后续请求的控制器记录，
       * <zh/> 使其在 deactivate/unmount 时漏取消。
       * <en/> Only delete when the map still points at this controller — an unconditional
       * <en/> delete would drop the record of a newer same-key request, leaking it past
       * <en/> deactivate/unmount cancellation.
       */
      if (loadChildrenAbortControllers.get(normalizedKey) === controller)
        loadChildrenAbortControllers.delete(normalizedKey)
      if (loadChildrenAbortControllers.get(rowKey) === controller)
        loadChildrenAbortControllers.delete(rowKey)
      // loading 结束后再次 bump，使渲染器清除 loading 图标
      // Bump again after loading ends so renderers clear the loading icon
      bumpTreeRevision()
    }
    return true
  }

  async function toggleRowExpand(rowKey: string | number): Promise<void> {
    const normalizedKey = normalizeTreeKey(rowKey)
    if (expandedRowKeys.value.has(normalizedKey)) {
      const keys = new Set(expandedRowKeys.value)
      keys.delete(normalizedKey)
      expandedRowKeys.value = keys
      return
    }
    const success = await loadChildren(normalizedKey)
    if (!success)
      return
    /**
     * <zh/> 不变量：await 之后必须重读最新 Set 再合并。
     * <zh/> await 前快照、await 后直接写回会使加载期间用户收起的兄弟节点
     * <zh/> 或 collapseAll 被旧快照静默撤销（陈旧快照覆写）。
     * <en/> Invariant: after the await, re-read the LATEST set before merging.
     * <en/> Writing back a pre-await snapshot verbatim silently reverts sibling
     * <en/> collapses / collapseAll that happened during loading (stale-snapshot clobber).
     */
    const keys = new Set(expandedRowKeys.value)
    keys.add(normalizedKey)
    expandedRowKeys.value = keys
  }

  async function expandRow(rowKey: string | number): Promise<void> {
    const normalizedKey = normalizeTreeKey(rowKey)
    if (expandedRowKeys.value.has(normalizedKey))
      return
    const success = await loadChildren(normalizedKey)
    if (!success)
      return
    const keys = new Set(expandedRowKeys.value)
    keys.add(normalizedKey)
    expandedRowKeys.value = keys
  }

  function collapseRow(rowKey: string | number): void {
    const normalizedKey = normalizeTreeKey(rowKey)
    if (!expandedRowKeys.value.has(normalizedKey))
      return
    const keys = new Set(expandedRowKeys.value)
    keys.delete(normalizedKey)
    expandedRowKeys.value = keys
  }

  function collectAllKeys(data: T[]): Set<string | number> {
    const config = toValue(treeConfig)
    if (!config)
      return new Set()
    return collectKeys(data, config.children ?? 'children', toValue(rowKeyFn))
  }

  function expandAll(): void {
    const config = toValue(treeConfig)
    if (!config)
      return
    expandedRowKeys.value = collectAllKeys(toValue(data))
    /**
     * <zh/> 懒加载节点逐个触发 loadChildren——仅加 key 会让 UI 显示"已展开的空节点"。
     * <zh/> loadChildren 内部按 meta.loaded/loading/hasChildren 门控，重复调用无副作用。
     * <en/> Trigger loadChildren for lazy-loaded nodes — adding keys alone would render
     * <en/> "expanded empty nodes". loadChildren gates on meta.loaded/loading/hasChildren,
     * <en/> so repeated calls are harmless.
     */
    if (config.loadData) {
      /**
       * <zh/> 并发池化批量懒加载（limit=4 平衡吞吐与压力）——逐键 fire-and-forget
       * <zh/> 在大量懒加载节点时形成对后端的雷群冲击，约束经由并发池收敛。
       * <en/> Pooled batch lazy-loading (limit=4 balances throughput and load) — per-key
       * <en/> fire-and-forget causes thundering-herd bursts with many lazy nodes; constrain via pool.
       */
      const { runAll } = createConcurrencyPool({ limit: 4 })
      void runAll(
        Array.from(expandedRowKeys.value, key => () => loadChildren(key)),
        error => devTreeWarn(error),
      )
    }
  }

  function collapseAll(): void {
    expandedRowKeys.value = new Set()
  }

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

  return {
    flattenedData,
    getTreeMeta,
    toggleRowExpand,
    expandRow,
    collapseRow,
    expandAll,
    collapseAll,
    expandedRowKeys,
    treeEnabled,
    indent,
    collectAllKeys,
    getDescendantKeys,
    getAncestorKeys,
    checkStrictly,
  }
}
