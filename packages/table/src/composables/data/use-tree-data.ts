import type { TreeRowMeta } from '../../types/config'
import type { UseTreeDataOptions, UseTreeDataReturn } from './use-tree-data-types'
import { computed, shallowRef, toValue, watch } from 'vue'
import { flattenTreeRowsIterative, initExpandedKeys } from './use-tree-data-flatten'
import { useTreeDataKinship } from './use-tree-data-kinship'
import { useTreeDataLoad } from './use-tree-data-load'
import { buildFullKeyToRow, collectKeys, rowMetaKey } from './use-tree-data-utils'

// <zh/> 契约类型自 use-tree-data-types.ts 拆出（刀法 C），re-export 保既有导入路径零变化
// <en/> Contract types split into use-tree-data-types.ts (knife C); re-export keeps every existing import path unchanged
export type { UseTreeDataOptions, UseTreeDataReturn } from './use-tree-data-types'

/**
 * <zh/> 树形数据 composable（编排器）— 将嵌套树形数据展平为带缩进元信息的行数组，
 * <zh/> 管理展开/折叠状态、异步加载与父子选中联动。
 *
 * <zh/> 子域拆分（COMPLEXITY-PLAN 战线三，刀法 A+C）：utils 纯键函数 / flatten 展平与查找 /
 * <zh/> load 懒加载引擎 / kinship 亲缘查询缓存；本文件只做装配、展开初始化 watch 与展平 computed。
 *
 * @param options - <zh/> 树形配置 | <en/> tree config
 * @returns <zh/> 树形状态与操作方法 | <en/> tree state and operation methods
 *
 * <en/> Tree data composable (orchestrator) — flattens nested tree data into row arrays with
 * <en/> indent metadata, manages expand/collapse state, async loading, and parent-child
 * <en/> selection linkage.
 *
 * <en/> Sub-domain split (COMPLEXITY-PLAN battle line 3, knives A+C): utils pure key helpers /
 * <en/> flatten &amp; lookup / load lazy-load engine / kinship query caches; this file only
 * <en/> assembles, runs the expansion-init watches and owns the flatten computed.
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

  function collectAllKeys(rows: T[]): Set<string | number> {
    const config = toValue(treeConfig)
    if (!config)
      return new Set()
    return collectKeys(rows, config.children ?? 'children', toValue(rowKeyFn))
  }

  // <zh/> 懒加载引擎（loadChildren/toggle/expand/collapse/expandAll）自 use-tree-data-load.ts 拆出（刀法 C）
  // <en/> Lazy-load engine (loadChildren/toggle/expand/collapse/expandAll) split into use-tree-data-load.ts (knife C)
  const {
    toggleRowExpand,
    expandRow,
    collapseRow,
    expandAll,
    collapseAll,
  } = useTreeDataLoad<T>({
    treeConfig,
    data,
    rowKeyFn,
    expandedRowKeys,
    bumpTreeRevision,
    metaMap,
    loadingRows,
    keyToRow,
  })

  // <zh/> 亲缘查询（后代/祖先缓存）自 use-tree-data-kinship.ts 拆出（刀法 C）
  // <en/> Kinship queries (descendant/ancestor caches) split into use-tree-data-kinship.ts (knife C)
  const { getDescendantKeys, getAncestorKeys } = useTreeDataKinship<T>({
    treeConfig,
    data,
    rowKeyFn,
    treeRevision,
    keyToRow,
    metaMap,
  })

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
