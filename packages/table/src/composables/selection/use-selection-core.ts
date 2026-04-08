import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { SelectionMutationGuard } from './selection-mutation-guard'
import type { SelectionChangeMeta, SelectionChangeReason, UseSelectionStateEmits } from './selection-types'
import { computed, shallowRef, toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { createSelectionEmitGuard } from './selection-emit-guard'
import { createSafeEmits } from './selection-mutation-guard'

/**
 * <zh/> 选中状态核——唯一持有响应式状态与事件派发的一层
 * <en/> Selection state core — the only layer holding reactive state and event dispatch
 *
 * @remarks
 * <zh/> 职责：`selectedKeys` / `lastClickedKey` 两个 `shallowRef`、`selectedRows` 派生、
 * <zh/> `rowMap` 剪除 watcher、以及事件派发（含批处理压制）。
 * <zh/> 上层（可选择性 / 策略 / 批量 / 查询）全部为**纯工厂**，只消费本层暴露的能力，
 * <zh/> 从而形成单向依赖链，杜绝跨层反向引用。
 * <en/> Owns the two `shallowRef`s (`selectedKeys` / `lastClickedKey`), the `selectedRows`
 * <en/> derivation, the `rowMap` pruning watcher, and event dispatch (including batch
 * <en/> suppression). Every upper layer (eligibility / strategies / batch / query) is a
 * <en/> **pure factory** that only consumes what this layer exposes, producing a one-way
 * <en/> dependency chain with no reverse cross-layer references.
 */
export interface UseSelectionCoreDeps<T = any> {
  /** <zh/> 重入守卫 | <en/> Re-entrancy guard */
  guard: SelectionMutationGuard
  /** <zh/> 父级回调（未包装，本层负责包 safe） | <en/> Parent callbacks (unwrapped; this layer wraps them) */
  emits: UseSelectionStateEmits<T>
  /** <zh/> 行键函数 | <en/> row key function */
  rowKey: MaybeRefOrGetter<(row: T) => string>
  /** <zh/> 行映射（父级注入，O(1) 查找） | <en/> row map (injected by parent for O(1) lookups) */
  rowMap: MaybeRefOrGetter<Map<string, T>>
  /** <zh/> rowMap 变化时是否剪除失效键 | <en/> whether to prune stale keys on rowMap change */
  pruneOnRowMapChange?: MaybeRefOrGetter<boolean | undefined>
}

/** <zh/> 选中状态核返回 | <en/> Selection state core return */
export interface UseSelectionCoreReturn<T = any> {
  selectedKeys: ShallowRef<Set<string>>
  lastClickedKey: ShallowRef<string | null>
  /** <zh/> 守卫作用域（供上层批量入口复用） | <en/> Guard scope (reused by upper batch entry points) */
  withSelectionGuard: <R>(fn: () => R) => R
  isSelected: (row: T) => boolean
  getSelectedRows: () => T[]
  buildSelectionMeta: () => SelectionChangeMeta
  /** <zh/> 派发 selectionChange（含批处理压制） | <en/> Dispatch selectionChange (with batch suppression) */
  emitSelectionChange: (reason: SelectionChangeReason, row?: T) => void
  /** <zh/> 批量更新——回调内事件合并为一次 init 通知 | <en/> Batched update — inner events collapse into one init notice */
  batchSelectionUpdate: (fn: () => void) => void
}

/**
 * <zh/> 创建选中状态核
 * <en/> Create the selection state core
 */
export function useSelectionCore<T = any>(deps: UseSelectionCoreDeps<T>): UseSelectionCoreReturn<T> {
  const { guard, emits, rowKey, rowMap, pruneOnRowMapChange } = deps
  const { withSelectionGuard, isMutating } = guard

  const selectedKeys = shallowRef<Set<string>>(new Set())
  const lastClickedKey = shallowRef<string | null>(null)

  const safeEmits = createSafeEmits<T>(emits)

  /**
   * <zh/> 派发 selectionChange——键集与上次已派发者相同时跳过。
   * <zh/> 完整语义与正确性论证见 `selection-emit-guard`（纯工厂，本层只做接线）。
   * <en/> Dispatch selectionChange — skipped when the key set matches the last dispatched one.
   * <en/> Full semantics and correctness argument live in `selection-emit-guard` (a pure factory);
   * <en/> this layer only wires it.
   */
  const notifySelectionChange = createSelectionEmitGuard<T>({
    getKeys: () => selectedKeys.value,
    emit: (selection, meta) => safeEmits.onSelectionChange?.(selection, meta),
  }).notify

  /**
   * <zh/> 构造 selectionChange 的 meta 快照（selectedKeys 拷贝，count = keys.length）。
   * <zh/> 调用点须在 selectedKeys 更新后调用，以保证 keys 与已提交状态一致。
   * <en/> Build the selectionChange meta snapshot (a copy of selectedKeys, count = keys.length).
   * <en/> Call sites must invoke it after selectedKeys has been updated so keys match the committed state.
   */
  function buildSelectionMeta(): SelectionChangeMeta {
    const keys = [...selectedKeys.value]
    return { keys, count: keys.length }
  }

  const selectedRows = computed<T[]>((prev) => {
    const keys = selectedKeys.value
    const map = toValue(rowMap)
    const rows: T[] = []
    for (const key of keys) {
      const row = map.get(key)
      if (row)
        rows.push(row)
    }
    if (prev && prev.length === rows.length && prev.every((item, i) => item === rows[i]))
      return prev
    return rows
  })

  /**
   * <zh/> 行映射剪除回调——rowMap 引用变化（数据刷新/分页/排序）时同步剪除失效选中（flush sync 即时生效）
   * <en/> Row-map prune callback — prunes stale selection on rowMap reference change (data refresh/paging/sort), flush sync
   */
  function onRowMapChangedPruneSelection(newMap: Map<string, T>, oldMap: Map<string, T> | undefined): void {
    // 跳过选中操作期间的清理 | Skip cleanup during selection mutations
    if (isMutating())
      return

    // 跨页保留选中时跳过剪除（keepSelectionAcrossPages=true 走外部 selectionChange 同步）|
    // Skip pruning when keeping selection across pages (keepSelectionAcrossPages=true relies on external selectionChange sync)
    if (toValue(pruneOnRowMapChange) === false)
      return

    const currentKeys = selectedKeys.value
    if (currentKeys.size === 0)
      return

    if (!oldMap || oldMap.size === 0) {
      // <zh/> 初始加载：oldMap 为空时无法区分跨页幽灵键与无效键，严格按新数据剪除
      // <en/> Initial load: when oldMap is empty, cross-page ghosts and invalid keys are indistinguishable; prune strictly by newMap
      const newSet = new Set<string>()
      for (const key of currentKeys) {
        if (newMap.has(key))
          newSet.add(key)
      }
      if (newSet.size !== currentKeys.size) {
        const removedKeys = [...currentKeys].filter(k => !newSet.has(k))
        selectedKeys.value = newSet
        lastClickedKey.value = newSet.has(lastClickedKey.value as string) ? lastClickedKey.value : null
        if (removedKeys.length > 0) {
          notifySelectionChange(getSelectedRows(), buildSelectionMeta())
        }
      }
      return
    }

    const newSet = new Set<string>()
    for (const key of currentKeys) {
      if (newMap.has(key)) {
        newSet.add(key)
      }
      else if (!oldMap.has(key)) {
        newSet.add(key)
      }
    }
    if (newSet.size !== currentKeys.size) {
      const removedKeys = [...currentKeys].filter(k => !newSet.has(k))
      selectedKeys.value = newSet
      lastClickedKey.value = newSet.has(lastClickedKey.value as string) ? lastClickedKey.value : null
      /**
       * <zh/> 数据刷新导致行被剪除时补发 selectionChange——否则外部（受控/跨页）无法感知选中丢失，
       * <zh/> 服务端分页下跨页选择会被静默吞掉。
       * <en/> Emit selectionChange when pruning removed keys — otherwise external callers
       * <en/> (controlled/cross-page) never learn about the lost selection, and server-side
       * <en/> pagination silently drops cross-page selections.
       */
      if (removedKeys.length > 0) {
        notifySelectionChange(getSelectedRows(), buildSelectionMeta())
      }
    }
  }

  // <zh/> 点燃链：rowMap 变化 → 剪枝 selectedKeys 并派发 → use-table-selection 外部受控键 watcher 回写内部选中（数据刷新/翻页时依次点燃）
  // <en/> Ignition chain: rowMap change → prune selectedKeys + notify → use-table-selection controlled-keys watcher writes back
  watch(() => toValue(rowMap), onRowMapChangedPruneSelection, { flush: 'sync' })

  /**
   * <zh/> 安全行键——rowKey 抛错时 dev 告警并按无键处理（拒绝选中），不让整条派发链崩溃。
   * <en/> Safe row key — a throwing rowKey warns in dev and degrades to unkeyed (refuses
   * <en/> selection) instead of crashing the whole dispatch chain.
   */
  function safeRowKey(row: T): string | null {
    try {
      return toValue(rowKey)(row)
    }
    catch (err) {
      devWarn('[AdvTable] rowKey(row) threw; treating the row as unkeyed:', err)
      return null
    }
  }

  function isSelected(row: T): boolean {
    const key = safeRowKey(row)
    return key != null && selectedKeys.value.has(key)
  }

  function getSelectedRows(): T[] {
    return selectedRows.value
  }

  /**
   * <zh/> 批量事件压制深度——`batchSelectionUpdate` 回调内的 `emitSelectionChange` 只标记 dirty，
   * <zh/> 由最外层批处理在结尾统一派发一次，避免 N 行操作触发 N 次 O(n) 事件风暴。
   * <en/> Batched-emit suppression depth — `emitSelectionChange` calls inside `batchSelectionUpdate`
   * <en/> only mark dirty; the outermost batch flushes once at the end, avoiding N O(n) event
   * <en/> storms for N-row operations.
   */
  let emitSuspendDepth = 0
  let emitSuspendedDirty = false

  function emitSelectionChange(reason: SelectionChangeReason, row?: T) {
    // <zh/> 批处理压制中——仅标记 dirty，由 batchSelectionUpdate 结尾统一派发
    // <en/> Batch suppression active — only mark dirty; batchSelectionUpdate flushes at the end
    if (emitSuspendDepth > 0) {
      emitSuspendedDirty = true
      return
    }
    let selection = getSelectedRows()
    /**
     * <zh/> rows 仍全量构造（公开契约）；meta 为 next-major 懒 rows 的前向兼容载荷，
     * <zh/> key-only 消费方可先用 meta（keys 为 selectedKeys 快照，count = keys.length）。
     * <zh/> 仅 selectionChange 携带 meta，select/selectAll payload 不动（控制波及面）。
     * <en/> rows are still fully materialized (public contract); meta is the forward-compatible
     * <en/> payload for next-major lazy rows — key-only consumers can adopt meta first
     * <en/> (keys snapshots selectedKeys, count = keys.length).
     * <en/> Only selectionChange carries meta; select/selectAll payloads stay untouched (blast-radius control).
     */
    const meta = buildSelectionMeta()
    // <zh/> 跨页保持时 keys 全但 rows 仅本页——dev 提示消费 meta.keys 全量键，避免用 rows 导出丢数（零生产行为变更）
    // <en/> With cross-page persistence keys are complete but rows are current-page only — dev hint to consume meta.keys full keys to avoid data loss via rows export (zero production behavior change)
    if (selection.length !== meta.keys.length) {
      devWarn(
        '[AdvTable] selectionChange.rows only contains current-page rows while meta.keys holds the full cross-page key set. '
        + 'For cross-page export/submit, resolve rows via meta.keys instead of relying on rows length. | '
        + '跨页保持下 selectionChange.rows 仅含本页行，meta.keys 为全量键。跨页导出/提交请用 meta.keys 自拼全量行，不要直接信任 rows。',
      )
    }
    if (reason === 'select' && row !== undefined) {
      /**
       * Ensure the selection includes the row being toggled (only when selecting).
       * When data is refreshing, the row's key may not yet exist in rowMap,
       * causing getSelectedRows to miss it. We patch the selection here.
       * But when deselecting, the row was intentionally removed — don't re-add it.
       *
       * 确保选中事件包含正在操作的行（仅选中时）。数据刷新时该行的 key 可能
       * 尚未存在于 rowMap 中，导致 getSelectedRows 遗漏。取消选中时不应补回。
       */
      const rowKeyVal = safeRowKey(row)
      const selected = rowKeyVal != null && selectedKeys.value.has(rowKeyVal)
      if (selected && rowKeyVal != null) {
        const rowInSelection = selection.some(r => safeRowKey(r) === rowKeyVal)
        if (!rowInSelection)
          selection = [...selection, row]
      }

      notifySelectionChange(selection, meta)
      safeEmits.onSelect?.({ selection, row })
      safeEmits.onRowSelected?.({ row, selected })
    }
    else {
      notifySelectionChange(selection, meta)
    }
    if (reason === 'selectAll') {
      safeEmits.onSelectAll?.(selection)
    }
  }

  /**
   * <zh/> 批量选择更新——回调内所有单行切换的事件合并为结尾处的一次 `init` 通知。
   *
   * <zh/> 语义保证：回调内的状态演化与逐行调用完全一致（复用同一 handler），仅事件折叠——
   * <zh/> N 次 `selectionChange`/`select`/`rowSelected` 合并为 1 次 `selectionChange`。
   * <zh/> 回调内无任何实际派发企图时不产生事件；异常时仍先冲刷 dirty 再向外传播，避免状态与通知脱钩。
   * <en/> Batched selection update — all per-row toggle events inside the callback collapse into a
   * <en/> single trailing `init` notification.
   *
   * <en/> Semantic guarantee: state evolution inside the callback is identical to sequential calls
   * <en/> (same handlers reused), only events collapse — N `selectionChange`/`select`/`rowSelected`
   * <en/> become 1 `selectionChange`. No event fires when nothing attempted a dispatch; on exception
   * <en/> the dirty flag still flushes before rethrow to keep state and notifications in sync.
   *
   * @param fn - <zh/> 批量选择操作（如反选循环） | <en/> batched selection operations (e.g. invert loop)
   */
  function batchSelectionUpdate(fn: () => void): void {
    withSelectionGuard(() => {
      emitSuspendDepth++
      try {
        fn()
      }
      finally {
        emitSuspendDepth--
        if (emitSuspendDepth === 0) {
          const dirty = emitSuspendedDirty
          emitSuspendedDirty = false
          if (dirty)
            emitSelectionChange('init')
        }
      }
    })
  }

  return {
    selectedKeys,
    lastClickedKey,
    withSelectionGuard,
    isSelected,
    getSelectedRows,
    buildSelectionMeta,
    emitSelectionChange,
    batchSelectionUpdate,
  }
}
