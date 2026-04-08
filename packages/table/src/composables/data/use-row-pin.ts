/**
 * @file use-row-pin.ts
 * @description
 * <zh/> 行 Pinning composable — 将指定行固定在顶部或底部，在虚拟滚动时始终可见。
 *
 * <zh/> **实现策略**：
 * <zh/> 1. 在数据管线末端（分页之后）从 visibleData 中提取 pinned 行
 * <zh/> 2. 从 visibleData 中移除 pinned 行，返回 unpinnedData
 * <zh/> 3. 渲染器将 pinned 行渲染为独立固定区域
 * <zh/>
 * <zh/> **数据流**：
 * <zh/> visibleData → splitPinnedRows → { topPinned, unpinned, bottomPinned }
 * <zh/> 渲染器: [topPinned 固定区] + [unpinned 可滚动区] + [bottomPinned 固定区]
 *
 * <en/> Row pinning composable — pins specified rows to top/bottom, always visible during virtual scrolling.
 *
 * <en/> **Implementation strategy**:
 * <en/> 1. Extract pinned rows from visibleData at the end of the pipeline (after pagination)
 * <en/> 2. Remove pinned rows from visibleData, returning unpinnedData
 * <en/> 3. Renderer renders pinned rows as independent fixed regions
 */
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { RowPinApi, RowPinConfig } from '../../types/config-tree'
import { computed, shallowRef, toValue, watch } from 'vue'
import { PINNED_ROWS_DEFAULT_LIMIT } from '../../constants'
import { useStableComputed } from '../../utils/composable-helpers'

export interface UseRowPinOptions<T = any> {
  /** <zh/> 行 Pinning 配置 | <en/> Row pinning config */
  rowPinConfig: MaybeRefOrGetter<RowPinConfig | undefined>
  /** <zh/> 可见数据（分页后） | <en/> Visible data (after pagination) */
  visibleData: MaybeRefOrGetter<T[]>
  /** <zh/> 行键函数 | <en/> Row key function */
  rowKeyFn: MaybeRefOrGetter<(row: T) => string>
  /**
   * <zh/> 固定行超限回调——顶部 + 底部合计超过上限时触发（进入超限态或超限量变化时各一次）。
   * <zh/> 调用方通常接 tableEmit('error', TABLE_PIN_LIMIT_EXCEEDED)。
   * <en/> Pinned-row over-limit callback — fires when the combined top/bottom count exceeds the cap
   * <en/> (once on entering the over-limit state and once per change while over).
   * <en/> Callers typically wire it to tableEmit('error', TABLE_PIN_LIMIT_EXCEEDED).
   */
  onPinLimitExceeded?: (info: { total: number, limit: number, truncatedTop: number, truncatedBottom: number }) => void
}

export interface UseRowPinReturn<T = any> {
  /** <zh/> 行 pinning 是否启用 | <en/> Whether row pinning is enabled */
  pinEnabled: ComputedRef<boolean>
  /** <zh/> 顶部固定行数据 | <en/> Top pinned row data */
  topPinnedRows: ComputedRef<T[]>
  /** <zh/> 底部固定行数据 | <en/> Bottom pinned row data */
  bottomPinnedRows: ComputedRef<T[]>
  /** <zh/> 未固定的可滚动数据 | <en/> Unpinned scrollable data */
  unpinnedData: ComputedRef<T[]>
  /** <zh/> 行 Pinning API | <en/> Row pinning API */
  rowPinApi: RowPinApi
}

/**
 * <zh/> 行 Pinning composable | <en/> Row pinning composable
 *
 * @param options - <zh/> 行 Pinning 配置和可见数据 | <en/> row pinning config and visible data
 * @returns <zh/> 固定行数据、未固定数据和 API | <en/> pinned row data, unpinned data and API
 */
export function useRowPin<T = any>(options: UseRowPinOptions<T>): UseRowPinReturn<T> {
  const { rowPinConfig, visibleData, rowKeyFn, onPinLimitExceeded } = options

  /**
   * <zh/> 固定行总数上限（顶部 + 底部）——rowPinConfig.maxPinnedRows 可配，非法值回退默认值。
   * <en/> Cap on the total pinned-row count (top + bottom) — overridable via
   * <en/> rowPinConfig.maxPinnedRows, falling back to the default on illegal values.
   */
  const pinLimit = computed(() => {
    const v = toValue(rowPinConfig)?.maxPinnedRows
    return typeof v === 'number' && Number.isFinite(v) && v > 0
      ? Math.floor(v)
      : PINNED_ROWS_DEFAULT_LIMIT
  })

  /**
   * <zh/> 固定行 keys 集合——运行时可动态变更 | <en/> Pinned row key sets — dynamically changeable at runtime
   */
  const topPinnedKeys = shallowRef<Set<string>>(new Set())
  const bottomPinnedKeys = shallowRef<Set<string>>(new Set())

  /**
   * <zh/> 运行时通过 API 新增（且不在配置数组中）的固定键——按插入序记录。
   * <zh/> 渲染顺序 = 配置序优先 + 运行时插入序兜底。仅按配置数组序渲染会使
   * <zh/> 运行时 pinRow 的键不在配置数组中 → 永不出现在固定区，但又被未固定清扫排除 → 行直接消失。
   * <en/> Keys added at runtime via API (absent from config arrays), recorded in insertion order.
   * <en/> Render order = config order first, then runtime insertion order. Rendering strictly by
   * <en/> config-array order leaves a runtime-pinned key missing from config neither rendered nor
   * <en/> kept in the unpinned sweep — the row vanishes entirely.
   */
  const runtimeAddedTopKeys = shallowRef<string[]>([])
  const runtimeAddedBottomKeys = shallowRef<string[]>([])

  /**
   * <zh/> pinning 是否启用——由"活跃集合"派生而非仅看配置数组长度。
   * <zh/> 纯运行时 pinRow 添加的键必须反映在 pinEnabled 中，否则固定区完全不渲染。
   * <zh/> 集合由下方 watcher 与配置保持同步，故集合尺寸同时覆盖配置与运行时两个来源。
   * <en/> Whether pinning is enabled — derived from the LIVE key sets instead of config-array lengths.
   * <en/> Keys added purely via runtime pinRow must be visible to pinEnabled, otherwise the
   * <en/> pinned regions never render. The sets are kept in sync with config by the watcher below,
   * <en/> so their sizes cover both the config source and the runtime source.
   */
  const pinEnabled = computed(() => {
    return topPinnedKeys.value.size > 0 || bottomPinnedKeys.value.size > 0
  })

  /**
   * <zh/> 稳定化的配置属性快照——避免父组件传递全新同值内联对象时触发不必要的 watcher 重置。
   * <en/> Stabilized config-property snapshot — prevents unnecessary watcher resets.
   */
  const trackedConfig = useStableComputed(() => {
    const config = toValue(rowPinConfig)
    if (!config)
      return null
    return {
      topKeys: config.topRowKeys,
      bottomKeys: config.bottomRowKeys,
    }
  })

  watch(
    trackedConfig,
    (tracked) => {
      if (!tracked) {
        topPinnedKeys.value = new Set()
        bottomPinnedKeys.value = new Set()
        return
      }
      const config = toValue(rowPinConfig)!
      const top = new Set((config.topRowKeys ?? []).map(k => String(k)))
      // 同一 rowKey 同时配 top/bottom 时去重（top 优先），与 API pinRow 跨侧移动语义一致
      const bottom = new Set<string>()
      for (const k of (config.bottomRowKeys ?? []).map(k => String(k))) {
        if (!top.has(k))
          bottom.add(k)
      }
      topPinnedKeys.value = top
      bottomPinnedKeys.value = bottom
    },
    { immediate: true },
  )

  /**
   * <zh/> 从 visibleData 中提取 pinned 行，返回 top/bottom/unpinned 三部分
   * <en/> Extract pinned rows from visibleData, returning top/bottom/unpinned
   */
  const splitResult = computed(() => {
    if (!pinEnabled.value) {
      return { top: [] as T[], bottom: [] as T[], unpinned: toValue(visibleData), truncatedTop: 0, truncatedBottom: 0, limit: pinLimit.value }
    }

    const data = toValue(visibleData)
    const keyResolver = toValue(rowKeyFn)
    const topKeys = topPinnedKeys.value
    const bottomKeys = bottomPinnedKeys.value

    const top: T[] = []
    const bottom: T[] = []
    const unpinned: T[] = []

    // <zh/> 渲染顺序：配置数组序优先，随后是运行时 API 新增键的插入序（集合成员校验去重，
    // <zh/> 保证已被移除/移动的键不会重复输出）。
    // <zh/> rowPinConfig 可能为 undefined：纯运行时 pinRow 使 pinEnabled=true 而配置缺位，
    // <zh/> 此处必须判空回退（`!` 断言会 TypeError 崩掉整条 renderData 链）。
    // <en/> Render order: config-array order first, then runtime-API-added keys in insertion
    // <en/> order (deduped via set-membership guards so removed/moved keys are not re-emitted).
    // <en/> rowPinConfig may be undefined: runtime-only pinRow flips pinEnabled=true with no
    // <en/> config present — null-safe fallback required here (a `!` assertion throws a
    // <en/> TypeError that breaks the whole renderData chain).
    const config = toValue(rowPinConfig)
    // 配置/运行时去重——同一 key 不得输出两次（pinRow 已配置 key 会导致固定区数量翻倍）
    const topKeyOrder = [...new Set([
      ...(config?.topRowKeys ?? []).map(k => String(k)),
      ...runtimeAddedTopKeys.value,
    ])]
    const bottomKeyOrder = [...new Set([
      ...(config?.bottomRowKeys ?? []).map(k => String(k)),
      ...runtimeAddedBottomKeys.value,
    ])]

    // 构建 key → row 映射
    const keyToRow = new Map<string, T>()
    for (const row of data) {
      const key = keyResolver(row)
      keyToRow.set(key, row)
    }

    // 按 topKeyOrder 顺序提取 top pinned 行
    for (const key of topKeyOrder) {
      const row = keyToRow.get(key)
      if (row && topKeys.has(key))
        top.push(row)
    }

    // 按 bottomKeyOrder 顺序提取 bottom pinned 行
    for (const key of bottomKeyOrder) {
      const row = keyToRow.get(key)
      if (row && bottomKeys.has(key))
        bottom.push(row)
    }

    // <zh/> 上限强制——顶部优先保留，超出部分截断。被截断的行必须回到 unpinned（可滚动区），
    // <zh/> 否则它们既不在固定区也不在滚动区 → 行直接消失（数据丢失级缺陷）。
    // <en/> Enforce the cap — top rows win, extras truncated. Truncated rows MUST fall back to
    // <en/> unpinned (scroll area); otherwise they vanish from both regions (data-loss-class defect).
    const limit = pinLimit.value
    let keptTop = top
    let keptBottom = bottom
    let truncatedTop = 0
    let truncatedBottom = 0
    if (top.length + bottom.length > limit) {
      keptTop = top.slice(0, limit)
      truncatedTop = top.length - keptTop.length
      keptBottom = bottom.slice(0, Math.max(0, limit - keptTop.length))
      truncatedBottom = bottom.length - keptBottom.length
    }
    const keptTopKeys = new Set(keptTop.map(row => keyResolver(row)))
    const keptBottomKeys = new Set(keptBottom.map(row => keyResolver(row)))

    // 未固定行（含被截断回落的行）
    for (const row of data) {
      const key = keyResolver(row)
      if (!keptTopKeys.has(key) && !keptBottomKeys.has(key))
        unpinned.push(row)
    }

    return { top: keptTop, bottom: keptBottom, unpinned, truncatedTop, truncatedBottom, limit }
  })

  /**
   * <zh/> 超限事件——进入超限态或超限量变化时通知一次；回到限内后重置，下次超限重新通知。
   * <zh/> 在 watcher（非 computed）中派发，避免渲染路径副作用。
   * <en/> Over-limit notification — fires on entering the over-limit state and on change while over;
   * <en/> resets once back within the limit. Dispatched from a watcher (never the render path).
   */
  watch(
    () => {
      const s = splitResult.value
      if (s.truncatedTop + s.truncatedBottom <= 0)
        return null
      return {
        total: s.top.length + s.bottom.length + s.truncatedTop + s.truncatedBottom,
        limit: s.limit,
        truncatedTop: s.truncatedTop,
        truncatedBottom: s.truncatedBottom,
      }
    },
    (info, prev) => {
      if (!info) {
        return
      }
      if (prev && prev.total === info.total && prev.limit === info.limit
        && prev.truncatedTop === info.truncatedTop && prev.truncatedBottom === info.truncatedBottom) {
        return
      }
      onPinLimitExceeded?.(info)
    },
    // <zh/> immediate 覆盖挂载即超限的场景；首值为 null（限内）时守卫直接返回，不误报
    // <en/> immediate covers mount-time over-limit; a null first value returns via the guard with no false alarm
    { immediate: true },
  )

  const topPinnedRows = computed(() => splitResult.value.top)
  const bottomPinnedRows = computed(() => splitResult.value.bottom)
  const unpinnedData = computed(() => splitResult.value.unpinned)

  // ── API 方法 ──

  /**
   * <zh/> 记录运行时新增键到指定侧的插入序列表（自动从对侧移除并去重）。
   * <zh/> 配置数组为基线——已在同侧配置中的键不再记录（配置序已覆盖），
   * <zh/> 避免同一固定行被输出两次。
   * <en/> Record a runtime-added key into the given side's ordered list (deduped, moved from the other side).
   * <en/> Config arrays are the baseline — keys already configured on the same side are not tracked.
   */
  function trackRuntimeAdded(key: string, position: 'top' | 'bottom'): void {
    const config = toValue(rowPinConfig)
    const sameSideConfig = position === 'top' ? config?.topRowKeys : config?.bottomRowKeys
    if (sameSideConfig?.map(k => String(k)).includes(key)) {
      // 已在配置中：清除可能残留的运行时记录（配置追平），不新增
      untrackRuntimeAdded(key)
      return
    }
    const oppositeList = position === 'top' ? runtimeAddedBottomKeys : runtimeAddedTopKeys
    const ownList = position === 'top' ? runtimeAddedTopKeys : runtimeAddedBottomKeys
    if (oppositeList.value.includes(key))
      oppositeList.value = oppositeList.value.filter(k => k !== key)
    if (!ownList.value.includes(key))
      ownList.value = [...ownList.value, key]
  }

  /**
   * <zh/> 从两侧运行时插入序列表中移除 | <en/> Remove a key from both runtime ordered lists
   */
  function untrackRuntimeAdded(key: string): void {
    runtimeAddedTopKeys.value = runtimeAddedTopKeys.value.filter(k => k !== key)
    runtimeAddedBottomKeys.value = runtimeAddedBottomKeys.value.filter(k => k !== key)
  }

  // 配置追平运行时记录即清除——动态加入相同配置 key 后 runtime 记录不再保留
  watch(
    () => {
      const config = toValue(rowPinConfig)
      return [...(config?.topRowKeys ?? []), ...(config?.bottomRowKeys ?? [])].map(k => String(k)).join(' ')
    },
    () => {
      const config = toValue(rowPinConfig)
      const configured = new Set([
        ...(config?.topRowKeys ?? []).map(k => String(k)),
        ...(config?.bottomRowKeys ?? []).map(k => String(k)),
      ])
      if (configured.size === 0)
        return
      const prune = (keys: string[]): string[] => keys.filter(k => !configured.has(k))
      const nextTop = prune(runtimeAddedTopKeys.value)
      const nextBottom = prune(runtimeAddedBottomKeys.value)
      if (nextTop.length !== runtimeAddedTopKeys.value.length)
        runtimeAddedTopKeys.value = nextTop
      if (nextBottom.length !== runtimeAddedBottomKeys.value.length)
        runtimeAddedBottomKeys.value = nextBottom
    },
  )

  function pinRow(rowKey: string | number, position: 'top' | 'bottom') {
    const key = String(rowKey)
    trackRuntimeAdded(key, position)
    if (position === 'top') {
      const keys = new Set(topPinnedKeys.value)
      keys.add(key)
      topPinnedKeys.value = keys
      // 从 bottom 中移除（不能同时在 top 和 bottom）
      if (bottomPinnedKeys.value.has(key)) {
        const bottomKeys = new Set(bottomPinnedKeys.value)
        bottomKeys.delete(key)
        bottomPinnedKeys.value = bottomKeys
      }
    }
    else {
      const keys = new Set(bottomPinnedKeys.value)
      keys.add(key)
      bottomPinnedKeys.value = keys
      // 从 top 中移除
      if (topPinnedKeys.value.has(key)) {
        const topKeys = new Set(topPinnedKeys.value)
        topKeys.delete(key)
        topPinnedKeys.value = topKeys
      }
    }
  }

  function unpinRow(rowKey: string | number) {
    const key = String(rowKey)
    untrackRuntimeAdded(key)
    if (topPinnedKeys.value.has(key)) {
      const keys = new Set(topPinnedKeys.value)
      keys.delete(key)
      topPinnedKeys.value = keys
    }
    if (bottomPinnedKeys.value.has(key)) {
      const keys = new Set(bottomPinnedKeys.value)
      keys.delete(key)
      bottomPinnedKeys.value = keys
    }
  }

  function isRowPinned(rowKey: string | number): boolean {
    const key = String(rowKey)
    return topPinnedKeys.value.has(key) || bottomPinnedKeys.value.has(key)
  }

  function clearPinnedRows() {
    runtimeAddedTopKeys.value = []
    runtimeAddedBottomKeys.value = []
    topPinnedKeys.value = new Set()
    bottomPinnedKeys.value = new Set()
  }

  const rowPinApi: RowPinApi = {
    pinEnabled,
    topPinnedRows,
    bottomPinnedRows,
    pinRow,
    unpinRow,
    isRowPinned,
    clearPinnedRows,
  }

  return {
    pinEnabled,
    topPinnedRows,
    bottomPinnedRows,
    unpinnedData,
    rowPinApi,
  }
}
