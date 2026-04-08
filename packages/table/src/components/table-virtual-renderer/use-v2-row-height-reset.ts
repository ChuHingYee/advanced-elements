/**
 * <zh/> V2 动态行高重测域——内容高度变化后主动重测的唯一出口
 * <zh/> EP 的动态网格（DynamicSizeGrid）只在行挂载时测量一次行高：自定义 cell 经异步回调
 * <zh/> （`setTimeout` / 数据请求回填）撑高内容、且 `data` 引用未变时，EP 不会重新测量，
 * <zh/> 下方行 `style.top` 残留旧值。全库此前从不主动调用 `resetAfterRowIndex`，此处集中收敛
 * <zh/> EP 原生重测入口的运行时探测，各调用点禁止散落 `(v2 as any)`，否则 EP 改名即静默失效。
 * <en/> V2 dynamic row-height remeasure domain — the single exit for proactive remeasurement
 * <en/> after content height changes . EP's dynamic grid (DynamicSizeGrid) measures each row
 * <en/> only once on mount: when a custom cell grows asynchronously (`setTimeout` / fetched data
 * <en/> backfill) without a `data` reference change, EP never remeasures and rows below keep stale
 * <en/> `style.top`. Nothing in the library called `resetAfterRowIndex` before; runtime probing of
 * <en/> EP's native remeasure entry converges here — scattered `(v2 as any)` probes at call sites
 * <en/> are forbidden, they would silently break on an EP rename.
 *
 * @remarks
 * <zh/> 探测顺序（每次调用时解析，实例在重挂载前后会变化，不可缓存）：
 * <zh/> 1. 实例直挂的 `resetAfterRowIndex`（未来 EP 若对外暴露时首选）；
 * <zh/> 2. 子树漫步：EP TableV2 内部 `TableGrid`（主表/左右固定表）各自 expose 了该方法，
 * <zh/> 从内部实例 `$subTree` 或公开 `$el.__vnode` 祖先链向上收集，命中多个则逐个调用
 * <zh/> （与 EP 内部 `resetAfterIndex` 全表调用三份网格的语义一致）；
 * <zh/> 3. 均未命中返回 false，调用方降级（dev 输出一次性可观测告警）。
 * <zh/> 固定行高网格（`gridInstanceKey === 'fixed'`）无缓存行高可清，直接 dev 告警并返回 false。
 * <en/> Resolution order (resolved per call — the instance changes across remounts, never cache it):
 * <en/> 1. a directly attached `resetAfterRowIndex` (preferred if EP ever exposes it);
 * <en/> 2. subtree walk: EP TableV2's internal `TableGrid`s (main/left/right) each expose the method;
 * <en/> collect them from the internal `$subTree` or up the public `$el.__vnode` ancestor chain and
 * <en/> invoke every hit (mirroring EP's internal `resetAfterIndex`, which resets all three grids);
 * <en/> 3. miss everywhere → false for callers to degrade (one dev-observable warning).
 * <en/> Fixed-height grids (`gridInstanceKey === 'fixed'`) cache no row heights: dev-warn and false.
 *
 * @remarks 失效预案 | Failure plan
 * <zh/> 本文件依赖 EP 内部实现，EP 升级即可能失效（探测全部 miss → 调用方降级 + 一次性告警，不会静默错行）。
 * <zh/> 若 EP 后续暴露官方重测 API，删除三路探测改为直调官方入口；升级前对照
 * <zh/> `EP-UPGRADE-CHECKLIST.md` 复核探测路径，勿在调用点散落新的 `(v2 as any)`。
 * <en/> This file depends on EP internals and may break on upgrade (a full miss degrades with a warning
 * <en/> rather than silently mis-positioning rows). If EP later exposes an official remeasure API, drop
 * <en/> the three probe paths and call it directly; re-check them against `EP-UPGRADE-CHECKLIST.md`.
 */
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/** <zh/> 行高重测不可用的原因——供生产期可观测性上报 | <en/> Why row-height reset is unavailable — for production observability */
export type V2RowHeightResetUnavailableReason = 'fixed-grid' | 'no-native-entry' | 'no-instance'

/** <zh/> 行高重测域依赖 | <en/> Row-height reset domain deps */
export interface UseV2RowHeightResetDeps {
  /** <zh/> 获取 ElTableV2 实例（每次调用时解析，重挂载安全） | <en/> Get the ElTableV2 instance (resolved per call, remount-safe) */
  getInstance: () => unknown
  /** <zh/> 是否处于动态网格（仅 dynamic 网格持有可清的行高缓存） | <en/> Whether the grid is dynamic (only dynamic grids hold clearable height caches) */
  isDynamic: () => boolean
  /**
   * <zh/> 重测不可用时的生产期回调（可选，不破坏既有调用）。
   * <zh/> 探测依赖 EP 内部入口（`$subTree`/`$el.__vnode`/`exposed.resetAfterRowIndex`），EP 升级改名后
   * <zh/> 此处 devWarn 仅开发期可见；需要生产期可观测请传入该回调并转接 `@error` 事件
   * <zh/>（建议码 `TABLE_RENDER_ERROR`，cause 附带 reason）。
   * <en/> Production callback when reset is unavailable (optional, non-breaking).
   * <en/> Probing relies on EP internals; devWarn alone is dev-only. Pass this callback and forward it to the
   * <en/> `@error` event (suggested code `TABLE_RENDER_ERROR` with the reason as cause) for prod observability.
   */
  onUnavailable?: (reason: V2RowHeightResetUnavailableReason) => void
  /**
   * <zh/> 真实重测钩子——推进网格重挂载代际，使已挂载行重新执行 EP 的 `onMounted` 实测；
   * <zh/> 缺省时 `refreshVirtualRowHeight` 退化为"仅提交 grid reset"（不再谎称已重测）。
   * <en/> Real remeasure hook — bumps the grid remount epoch so mounted rows re-run EP's
   * <en/> onMounted measurement; when absent, `refreshVirtualRowHeight` degrades to "reset submitted".
   */
  remeasure?: () => void
}

/** <zh/> 行高重测域返回 | <en/> Row-height reset domain return */
export interface UseV2RowHeightResetReturn {
  /**
   * <zh/> 透传 EP 原生 `resetAfterRowIndex(index, forceUpdate)`——清除 index 之后全部行的缓存行高。
   * <zh/> 不可用（固定网格/实例未就绪/EP 未暴露）时返回 false。
   * <en/> Pass through EP's native `resetAfterRowIndex(index, forceUpdate)` — drops cached row
   * <en/> heights after index. Returns false when unavailable (fixed grid / instance not ready /
   * <en/> not exposed by EP).
   */
  resetAfterRowIndex: (index?: number, forceUpdate?: boolean) => boolean
  /**
   * <zh/> 行高重测——先提交 EP grid reset，再使已挂载行重新挂载实测（EP 2.14 仅在行挂载时测量）。
   * <zh/> 仅提交成功且重测钩子已装配时返回 true。
   * <zh/> 默认从 0 行起全量重测（变更行位置未知时最稳妥）。
   * <en/> Row-height remeasure — submits the EP grid reset, then re-mounts rows so EP 2.14 (which
   * <en/> only measures on mount) re-measures them. True only when the reset was submitted AND a
   * <en/> remeasure hook is wired. Resets from row 0 by default.
   */
  refreshVirtualRowHeight: (index?: number) => boolean
  /** <zh/> 重测 API 当前是否可用（动态网格且能探测到 EP 原生入口） | <en/> Whether the reset API is currently available (dynamic grid with a reachable EP entry) */
  hasRowHeightResetApi: () => boolean
}

/** <zh/> 子树漫步最大深度（TableV2 → 主表 → TableGrid 仅 3 层，留足余量） | <en/> Subtree walk max depth (TableV2 → main table → TableGrid is 3 levels; keep headroom) */
const MAX_PROBE_DEPTH = 8
/** <zh/> 子树漫步最大访问节点数（防异常树形下失控） | <en/> Max visited nodes per walk (guards against runaway on abnormal trees) */
const MAX_PROBE_NODES = 200

/**
 * <zh/> 归一化行索引——非数值/NaN/负数回退 0，小数向下取整。
 * <en/> Normalize the row index — non-numbers/NaN/negatives fall back to 0, fractions floor.
 */
function normalizeRowIndex(index: unknown): number {
  const n = typeof index === 'number' ? Math.floor(index) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** <zh/> 单个 EP 原生重测入口 | <en/> A single EP native reset entry */
interface NativeResetTarget {
  reset: (index: number, forceUpdate: boolean) => void
}

/**
 * <zh/> 从 vnode 子树收集全部原生重测入口（主表 + 左右固定表）。
 * <en/> Collect every native reset entry from a vnode subtree (main + left/right fixed grids).
 */
function collectFromVNode(root: unknown): NativeResetTarget[] {
  const found: NativeResetTarget[] = []
  let visited = 0
  const stack: Array<{ node: unknown, depth: number }> = [{ node: root, depth: 0 }]
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!
    if (!node || typeof node !== 'object' || depth > MAX_PROBE_DEPTH || visited >= MAX_PROBE_NODES)
      continue
    visited++
    const vnode = node as Record<string, any>
    const exposedReset = vnode.component?.exposed?.resetAfterRowIndex
    if (typeof exposedReset === 'function') {
      const owner = vnode.component.exposed
      found.push({ reset: (index, forceUpdate) => owner.resetAfterRowIndex(index, forceUpdate) })
    }
    const componentSubTree = vnode.component?.subTree
    if (componentSubTree && typeof componentSubTree === 'object')
      stack.push({ node: componentSubTree, depth: depth + 1 })
    const children = vnode.children
    if (Array.isArray(children)) {
      for (const child of children)
        stack.push({ node: child, depth: depth + 1 })
    }
  }
  return found
}

/**
 * <zh/> 收集实例上全部可达的 EP 原生重测入口——直挂优先，其次子树漫步。
 * <en/> Collect every reachable EP native reset entry on the instance — direct first, subtree walk next.
 */
function collectNativeResets(instance: unknown): NativeResetTarget[] {
  if (!instance || typeof instance !== 'object')
    return []
  const host = instance as Record<string, any>
  if (typeof host.resetAfterRowIndex === 'function')
    return [{ reset: (index, forceUpdate) => host.resetAfterRowIndex(index, forceUpdate) }]
  const found: NativeResetTarget[] = []
  const internalSubTree = host.$?.subTree
  if (internalSubTree && typeof internalSubTree === 'object')
    found.push(...collectFromVNode(internalSubTree))
  if (found.length === 0) {
    const elVNode = host.$el?.__vnode
    if (elVNode && typeof elVNode === 'object')
      found.push(...collectFromVNode(elVNode))
  }
  return found
}

/**
 * <zh/> 创建 V2 行高重测域
 * <en/> Create the V2 row-height reset domain
 */
export function useV2RowHeightReset(deps: UseV2RowHeightResetDeps): UseV2RowHeightResetReturn {
  function resetAfterRowIndex(index: number = 0, forceUpdate: boolean = false): boolean {
    if (!deps.isDynamic()) {
      if (isDev) {
        devWarn(
          '[AdvTable] resetAfterRowIndex is a no-op on the fixed-height grid: '
          + 'row heights are constant and cache nothing. It only takes effect on the dynamic grid '
          + '(estimatedRowHeight set, or append slot / expanded detail rows present).',
        )
      }
      deps.onUnavailable?.('fixed-grid')
      return false
    }
    const instance = deps.getInstance()
    if (!instance) {
      deps.onUnavailable?.('no-instance')
      return false
    }
    const rowIndex = normalizeRowIndex(index)
    const targets = collectNativeResets(instance)
    if (targets.length === 0) {
      if (isDev) {
        devWarn(
          '[AdvTable] resetAfterRowIndex is unavailable: the ElTableV2 instance exposes no native '
          + 'reset entry (probed: direct resetAfterRowIndex, $subTree walk, $el.__vnode walk — EP version drift?). '
          + 'Row heights measured before async content growth are kept; '
          + 'call refreshVirtualRowHeight() again after the instance is mounted. '
          + 'See EP-UPGRADE-CHECKLIST.md.',
        )
      }
      deps.onUnavailable?.('no-native-entry')
      return false
    }
    for (const target of targets)
      target.reset(rowIndex, forceUpdate)
    // <zh/> 镜像 EP 内部 resetAfterIndex 的收尾：重测后整表 forceUpdate，促使 DynamicSizeGrid 按新高度重排
    // <en/> Mirror EP's internal resetAfterIndex epilogue: force-update the table after reset so DynamicSizeGrid reflows at the new heights
    const forceUpdateFn = (instance as Record<string, any>).$forceUpdate
    if (typeof forceUpdateFn === 'function')
      forceUpdateFn.call(instance)
    return true
  }

  /**
   * <zh/> 行高重测——先提交 EP grid reset，再推进重挂载代际使已挂载行真正重测。
   * <zh/> 无重测钩子（未装配）时返回 false：此时仅"提交了 reset"，不得谎称已重测。
   * <en/> Row-height remeasure — submit the EP grid reset, then bump the remount epoch so
   * <en/> mounted rows are genuinely re-measured. Without a remeasure hook it returns false:
   * <en/> only a reset was submitted, and the domain must not claim a remeasure happened.
   */
  function refreshVirtualRowHeight(index: number = 0): boolean {
    const submitted = resetAfterRowIndex(index, true)
    if (!submitted)
      return false
    if (!deps.remeasure) {
      if (isDev) {
        devWarn(
          '[AdvTable] refreshVirtualRowHeight only submitted a grid reset: no remeasure hook is wired, so '
          + 'EP 2.14 keeps the heights measured on row mount. Use a dynamic grid (estimatedRowHeight) and '
          + 'remount-affecting changes, or let the affected row leave and re-enter the render window.',
        )
      }
      return false
    }
    deps.remeasure()
    return true
  }

  function hasRowHeightResetApi(): boolean {
    if (!deps.isDynamic())
      return false
    const instance = deps.getInstance()
    return !!instance && collectNativeResets(instance).length > 0
  }

  return {
    resetAfterRowIndex,
    refreshVirtualRowHeight,
    hasRowHeightResetApi,
  }
}
