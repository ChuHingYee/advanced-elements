/**
 * <zh/> 列状态管理 Composable（编排器）
 * <en/> Column state composable (orchestrator)
 *
 * @remarks
 * <zh/> 管理列的宽度、隐藏、固定和排序状态的持久化。支持自动保存到 localStorage 或自定义存储适配器，并提供防抖、错误策略和选择性恢复能力。
 * <zh/> 子域拆分（COMPLEXITY-PLAN 战线三，刀法 A+C）：guards 纯 schema 守卫 / storage 持久化胶水 /
 * <zh/> apply 应用与重置 / restore 异步恢复与生命周期清理；本文件只做装配与快照监听。
 * <en/> Manages column width, hidden, fixed, and sort state persistence. Supports auto-saving to localStorage or a custom storage adapter, with debounce, error strategy, and selective restore capabilities.
 * <en/> Sub-domain split (COMPLEXITY-PLAN battle line 3, knives A+C): guards pure schema guards / storage persistence glue / apply &amp; reset / restore async restore &amp; lifecycle cleanup; this file only assembles and watches the snapshot.
 */
import type { ColumnState } from '../../types/column-state'
import type { UseColumnStateOptions, UseColumnStateReturn } from './use-column-state-types'
import { computed, nextTick, onActivated, onDeactivated, onMounted, onScopeDispose, watch } from 'vue'
import { traverseColumnTree } from '../../utils/column-tree'
import { getColumnKey } from '../../utils/shared'
import { useColumnStateApply } from './use-column-state-apply'
import { COLUMN_STATE_SCHEMA_VERSION } from './use-column-state-guards'
import { useColumnStateRestore } from './use-column-state-restore'
import { useColumnStateStorage } from './use-column-state-storage'

// <zh/> 公开纯守卫自 guards 模块 re-export，既有导入路径（测试/use-named-views）零变化
// <en/> Public pure guard re-exported from the guards module; existing import paths (tests/use-named-views) unchanged
export { isValidColumnStateData } from './use-column-state-guards'
export type { UseColumnStateOptions, UseColumnStateReturn } from './use-column-state-types'

/**
 * <zh/> useColumnState 配置选项
 * <en/> UseColumnState configuration options
 */
/**
 * 列状态管理组合式函数
 *
 * 管理列的宽度、隐藏、固定和排序状态的持久化。
 * 支持自动保存到 localStorage 或自定义存储适配器，提供防抖、错误策略和选择性恢复能力。
 *
 * Column state management composable
 *
 * Manages column width, hidden, fixed, and sort state persistence.
 * Supports auto-saving to localStorage or a custom storage adapter,
 * with debounce, error strategy, and selective restore capabilities.
 *
 * @param options - 配置选项
 * @returns 列状态管理接口
 */
export function useColumnState(options: UseColumnStateOptions): UseColumnStateReturn {
  const {
    localColumns,
    sortState,
    resetColumns,
    setColumns,
    touchColumns,
    setSorts,
    persistence,
    tableId,
    mode: modeGetter,
    onResetColumnWidths,
  } = options

  /**
   * 获取当前列的宽度、隐藏、固定和排序状态
   *
   * Get current column width, hidden, fixed, and sort states
   */
  function getColumnState(): ColumnState[] {
    const states: ColumnState[] = []
    const include = persistence.value?.include
    /**
     * <zh/> 记录当前渲染模式，apply 时用于跨模式一致性校验。
     * <zh/> default 模式 width 基于 <table> 模型，virtual 模式基于 Grid 模型，单位语义不同，
     * <zh/> 跨模式应用 width 会导致视觉跳变
     * <en/> Record current render mode for cross-mode consistency check on apply.
     * default mode width is based on <table> layout, virtual mode on Grid layout, semantics differ,
     * cross-mode width application causes visual jump
     */
    const currentMode = modeGetter?.()

    traverseColumnTree(localColumns.value, (col) => {
      const key = getColumnKey(col)
      const sortEntry = sortState.value.find(s => (s.columnKey ?? s.prop) === key)

      const entry: ColumnState = { colId: key, schemaVersion: COLUMN_STATE_SCHEMA_VERSION }

      if (!include || include.includes('width'))
        entry.width = col.width
      if (!include || include.includes('hidden'))
        entry.hidden = col.hidden
      if (!include || include.includes('fixed'))
        entry.fixed = col.fixed
      if (!include || include.includes('sort'))
        entry.sort = sortEntry?.order ?? null
      if (!include || include.includes('sortIndex'))
        entry.sortIndex = sortEntry ? sortState.value.indexOf(sortEntry) : undefined
      if ((!include || include.includes('mode')) && currentMode !== undefined)
        entry.mode = currentMode

      states.push(entry)
    })

    return states
  }

  // <zh/> 持久化胶水（storage/key 推导/错误策略/防抖落盘/跳过保存标志）自 use-column-state-storage.ts 拆出（刀法 C）
  // <en/> Persistence glue (storage/key derivation/error strategy/debounced save/skip flag) split into use-column-state-storage.ts (knife C)
  const {
    storage,
    storageKey,
    handleError,
    autoSaveEnabled,
    skipWatchSave,
    debouncedSave,
  } = useColumnStateStorage({ persistence, tableId, getColumnState })

  // <zh/> 应用与重置（applyColumnState/reorderColumns/resetColumnState）自 use-column-state-apply.ts 拆出（刀法 C）
  // <en/> Apply &amp; reset (applyColumnState/reorderColumns/resetColumnState) split into use-column-state-apply.ts (knife C)
  const { applyColumnState } = useColumnStateApply({
    localColumns,
    mode: modeGetter,
    onResetColumnWidths,
    touchColumns,
    setSorts,
    setColumns,
    autoSaveEnabled,
    skipWatchSave,
    debouncedSave,
  })

  /**
   * <zh/> 仅监听需要持久化的列属性快照，替代 deep: true 全量遍历。
   * <zh/> **注意**：localColumns 是 shallowRef，computed 仅在数组引用变化时重算，
   * <zh/> 直接修改 col.width / col.hidden / col.fixed 属性不会触发 computed（需调用 touchColumns 刷新引用）。
   * <zh/> computed 内部的 prev 内容比较确保引用相同时返回旧引用，避免不必要 watch 触发。
   * <zh/> 防抖（300ms）进一步缓解高频变更。_skipWatchSave 用于跳过
   * <zh/> applyColumnState 自身修改触发的冗余保存。
   * <en/> Only watch snapshots of persistable column properties, replacing deep: true full traversal.
   * **Note**: localColumns is shallowRef, computed only re-evaluates when the array reference changes;
   * directly mutating col.width / col.hidden / col.fixed does NOT trigger computed (call touchColumns to refresh the reference).
   * The internal prev content comparison ensures the old reference is returned when unchanged, avoiding unnecessary watch triggers.
   * Debounce (300ms) further mitigates high-frequency changes. _skipWatchSave skips
   * redundant saves triggered by applyColumnState's own modifications.
   */
  const columnStateSnapshot = computed((prev: Array<Record<string, unknown>> | undefined) => {
    const include = persistence.value?.include
    // 使用 traverseColumnTree 遍历全树（含子列），与 getColumnState 保持一致
    // Use traverseColumnTree to traverse the full tree (including sub-columns), consistent with getColumnState
    const next: Array<Record<string, unknown>> = []
    traverseColumnTree(localColumns.value, (col) => {
      const key = getColumnKey(col)
      const snap: Record<string, unknown> = { key }
      if (!include || include.includes('width'))
        snap.width = col.width
      if (!include || include.includes('hidden'))
        snap.hidden = col.hidden
      if (!include || include.includes('fixed'))
        snap.fixed = col.fixed
      next.push(snap)
    })
    // 内容比较：仅当 key/width/hidden/fixed 变更时返回新引用，避免每次重算触发 watch | Content comparison: only return new reference when key/width/hidden/fixed change, avoiding watch trigger on every recompute
    if (prev && prev.length === next.length) {
      let same = true
      for (let i = 0; i < next.length; i++) {
        if (prev[i]?.key !== next[i]?.key
          || prev[i]?.width !== next[i]?.width
          || prev[i]?.hidden !== next[i]?.hidden
          || prev[i]?.fixed !== next[i]?.fixed) {
          same = false
          break
        }
      }
      if (same)
        return prev
    }
    return next
  })
  watch(
    [columnStateSnapshot, sortState],
    () => {
      if (skipWatchSave.value)
        return
      if (autoSaveEnabled.value) {
        debouncedSave()
      }
    },
  )

  // <zh/> 异步恢复与生命周期清理自 use-column-state-restore.ts 拆出（刀法 C）
  // <en/> Async restore &amp; lifecycle cleanup split into use-column-state-restore.ts (knife C)
  const {
    restoreState,
    resetColumnState,
    restoreWhenColumnsReady,
    hasRestored,
    markRestored,
    cleanupColumnStateResources,
  } = useColumnStateRestore({
    localColumns,
    persistence,
    storage,
    storageKey,
    handleError,
    applyColumnState,
    debouncedSave,
    setSorts,
    resetColumns,
    onResetColumnWidths,
    skipWatchSave,
  })

  onMounted(async () => {
    if (!persistence.value?.enabled || persistence.value?.autoRestore === false)
      return

    await nextTick()

    if (localColumns.value.length > 0) {
      // <zh/> await restoreState 确保异步恢复完成后再标记 _hasRestored，
      // <zh/> 避免 onActivated 在恢复未完成时跳过重复恢复逻辑
      // <en/> await restoreState to ensure async restore completes before marking _hasRestored,
      // preventing onActivated from skipping re-restore logic while restore is in-flight
      await restoreState()
      markRestored()
      return
    }

    restoreWhenColumnsReady()
  })

  onScopeDispose(cleanupColumnStateResources)

  onDeactivated(() => {
    cleanupColumnStateResources()
  })

  /**
   * <zh/> KeepAlive 重新激活时恢复列状态 watcher 与持久化保存逻辑
   * <zh/> onDeactivated 清理了 pendingWatchStop 和 debouncedSave，
   * <zh/> onActivated 需要在条件满足时重新启动恢复流程
   * <en/> Restore column-state watcher and persistence save logic on KeepAlive reactivation.
   * onDeactivated cleaned up pendingWatchStop and debouncedSave;
   * onActivated needs to re-initiate the restore flow when conditions are met.
   */
  onActivated(async () => {
    if (!persistence.value?.enabled || persistence.value?.autoRestore === false)
      return

    // 已恢复过且列已加载——无需重复恢复
    // Already restored and columns loaded — no need to re-restore
    if (hasRestored() && localColumns.value.length > 0)
      return

    await nextTick()

    if (localColumns.value.length > 0) {
      if (!hasRestored()) {
        await restoreState()
        markRestored()
      }
      return
    }

    // 列尚未加载，重新注册 once watcher 等待列加载后恢复
    // Columns not yet loaded, re-register once watcher to wait for columns
    // <zh/> 与 onMounted 分支共用 restoreWhenColumnsReady（单一实现，内部先停旧句柄）
    // <en/> Shared with the onMounted branch via restoreWhenColumnsReady (single implementation; stops the old handle internally)
    restoreWhenColumnsReady()
  })

  return {
    getColumnState,
    applyColumnState,
    resetColumnState,
  }
}
