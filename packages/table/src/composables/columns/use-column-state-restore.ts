import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { ColumnState, ColumnStatePersistence } from '../../types/column-state'
import type { SortState } from '../../types/sort'
import { nextTick, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { COLUMN_STATE_SCHEMA_VERSION, isValidColumnStateData } from './use-column-state-guards'

/**
 * <zh/> 列状态异步恢复依赖 | <en/> Column-state async-restore deps
 */
export interface UseColumnStateRestoreDeps {
  localColumns: Ref<ProcessedColumn[]>
  persistence: ComputedRef<ColumnStatePersistence | undefined>
  storage: ComputedRef<{ get: (key: string) => unknown, remove: (key: string) => unknown }>
  storageKey: ComputedRef<string>
  handleError: (phase: 'save' | 'restore' | 'remove', error: unknown) => void
  /** <zh/> 应用入口（宿主注入 apply 模块的 applyColumnState） | <en/> apply entry (the host injects the apply module's applyColumnState) */
  applyColumnState: (state: ColumnState[]) => void
  /** <zh/> 停用/卸载前的落盘句柄 | <en/> flush handle before deactivate/unmount */
  debouncedSave: { flush: () => void }
  setSorts: (sorts: SortState[]) => void
  resetColumns: () => void
  onResetColumnWidths?: () => void
  /** <zh/> 恢复期间跳过自动保存的共享标志（storage 模块持有） | <en/> shared skip-autosave flag during restore (owned by the storage module) */
  skipWatchSave: ShallowRef<boolean>
}

/**
 * <zh/> 列状态异步恢复——restoreState 代际守卫、损坏/非法/schema 不匹配数据的清理、
 * <zh/> 列未就绪时的 once watcher 等待，以及生命周期清理（停 watcher、推进代际、flush 落盘）。
 *
 * <zh/> 自 use-column-state.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），函数体逐字未改。
 * <en/> Column-state async restore — restoreState generation guard, cleanup of corrupted /
 * <en/> invalid / schema-mismatched data, the once watcher awaiting column readiness, and
 * <en/> lifecycle cleanup (stop watcher, bump generation, flush pending saves).
 *
 * <en/> Migrated verbatim from use-column-state.ts (COMPLEXITY-PLAN battle line 3, knife C),
 * <en/> function bodies unchanged.
 */
export function useColumnStateRestore(deps: UseColumnStateRestoreDeps) {
  const {
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
  } = deps

  // 异步恢复代际：scope 释放/deactivate 时推进，过期结果直接丢弃。
  // Restore generation: bumped on scope dispose/deactivate so stale results are dropped.
  let columnStateGeneration = 0

  /**
   * <zh/> 异步恢复失败的统一承接点——`handleError` 已派发 `onStorageError` 并遵守 errorStrategy；
   * <zh/> 本函数只负责阻止 Promise 拒绝从 onMounted / watch 这类**无调用方**的路径逃逸为
   * <zh/> unhandledrejection（与 `debouncedSave` 的 `.catch` 处理同构）。
   *
   * <en/> Unified sink for async-restore failures — `handleError` already dispatched `onStorageError`
   * and honoured errorStrategy; this only stops the rejection escaping as an unhandledrejection
   * from caller-less paths (onMounted / watch), mirroring `debouncedSave`'s `.catch` treatment.
   *
   * @param err - <zh/> 存储层抛出的原始错误 | <en/> raw error thrown by the storage layer
   */
  function sinkRestoreFailure(err: unknown): void {
    // <zh/> 仅 'throw' 策略下补可见性告警：'warn' / 'silent' 已由 handleError 内部告警，避免重复
    // <en/> Warn only under the 'throw' strategy: 'warn' / 'silent' already warned inside handleError
    if (isDev && (persistence.value?.errorStrategy ?? 'silent') === 'throw') {
      devWarn('[AdvTable] Column state restore failed (errorStrategy="throw" is not propagated on async restore):', err)
    }
  }

  async function restoreState(): Promise<void> {
    // 捕获 await 前的身份：key/adapter/generation。await 后逐项比对，
    // key 切换、adapter 切换、scope 释放后旧结果不再应用。
    const restoreKey = storageKey.value
    const restoreAdapter = storage.value
    const restoreGeneration = columnStateGeneration
    try {
      const raw = await restoreAdapter.get(restoreKey)
      if (restoreGeneration !== columnStateGeneration)
        return
      if (storageKey.value !== restoreKey || storage.value !== restoreAdapter)
        return
      if (raw == null)
        return

      let parsed: unknown
      try {
        parsed = JSON.parse(raw as string)
      }
      catch {
        // <zh/> 损坏 JSON 不应在存储中永留——否则每次挂载/激活都重复解析失败。
        // <zh/> 与 invalid-structure / schema 分支同路径清理。
        // <en/> Corrupted JSON must not stay in storage forever — it would re-fail on every
        // mount/activate. Same cleanup path as the invalid-structure / schema branches.
        if (isDev) {
          devWarn('[AdvTable] Stored column state is not valid JSON, discarding.')
        }
        try {
          await storage.value.remove(storageKey.value)
        }
        catch (err) {
          handleError('remove', err)
        }
        return
      }
      if (!isValidColumnStateData(parsed)) {
        if (isDev) {
          devWarn('[AdvTable] Stored column state has invalid structure, discarding.')
        }
        try {
          await storage.value.remove(storageKey.value)
        }
        catch (err) {
          handleError('remove', err)
        }
        return
      }

      // schema 版本校验：缺失字段按默认策略加载，存在且不匹配则重置 | Schema version validation: missing field treated as historical data (migration load), reset if present and mismatched
      const versionMismatch = parsed.some(
        s => s.schemaVersion !== undefined && s.schemaVersion !== COLUMN_STATE_SCHEMA_VERSION,
      )
      if (versionMismatch) {
        if (isDev) {
          devWarn('[AdvTable] Column state schema version mismatch, resetting to current layout.')
        }
        try {
          await storage.value.remove(storageKey.value)
        }
        catch (err) {
          handleError('remove', err)
        }
        return
      }

      // 应用前二次校验：解析/remove 等待期间 key/adapter/generation 可能已变化
      if (restoreGeneration !== columnStateGeneration)
        return
      if (storageKey.value !== restoreKey || storage.value !== restoreAdapter)
        return
      applyColumnState(parsed)
    }
    catch (err) {
      /**
       * <zh/> 不在此处 rethrow：`handleError` 已按 errorStrategy 派发 `onStorageError`
       * <zh/> （'throw' 时其内部抛出的异常也在此被接住），异步路径没有调用方承接拒绝，
       * <zh/> 继续向外抛会变成 unhandledrejection。
       * <en/> No rethrow here: `handleError` already dispatched `onStorageError` per errorStrategy
       * <en/> (including the throw it performs under 'throw'), and async paths have no caller to
       * <en/> receive the rejection — propagating it would surface as an unhandledrejection.
       */
      sinkRestoreFailure(err)
    }
  }

  /** <zh/> 等待列就绪的 once watcher 句柄（onMounted / onActivated 共用，见 restoreWhenColumnsReady） | <en/> Handle for the once watcher awaiting columns (shared by onMounted/onActivated, see restoreWhenColumnsReady) */
  let pendingWatchStop: (() => void) | null = null
  let _hasRestored = false

  /**
   * <zh/> 列未就绪时注册 once watcher 等列到达后恢复——onMounted 与 onActivated 共用。
   * <zh/> 两份拷贝曾各自漂移（KeepAlive 下 onMounted 先跑、onActivated 再跑同一分支）。
   * <en/> Registers a once watcher awaiting column arrival when columns aren't ready yet —
   * <en/> shared by onMounted and onActivated. The two copies used to drift independently
   * <en/> (under KeepAlive onMounted runs first, then onActivated re-enters the same branch).
   */
  function restoreWhenColumnsReady(): void {
    // <zh/> 注册前先停掉可能存在的旧 once watcher——KeepAlive 下 onMounted 与 onActivated
    // <zh/> 会先后进入本分支，不停旧的会让句柄被覆盖而丢失（stop1 只能靠 once 自停）。
    // <en/> Stop any existing once watcher first — under KeepAlive both onMounted and onActivated
    // reach this branch, and not stopping leaves the handle overwritten and lost.
    pendingWatchStop?.()
    const stop = watch(localColumns, (cols) => {
      if (cols.length > 0) {
        // <zh/> await 异步恢复完成后再标记，避免后续入口在 restore 未完成时跳过重复恢复
        // <en/> Await async restore completion before marking, so later entries don't skip a re-restore while in flight
        void restoreState().then(() => {
          _hasRestored = true
          pendingWatchStop = null
        })
      }
    }, { once: true })
    pendingWatchStop = stop
  }

  /** <zh/> 已恢复标记（onMounted / onActivated 防重入共用） | <en/> restored flag (re-entry guard shared by onMounted / onActivated) */
  function hasRestored(): boolean {
    return _hasRestored
  }

  /** <zh/> 手动置已恢复标记（宿主 onMounted/onActivated 完成恢复后调用） | <en/> Manually set the restored flag (host calls after onMounted/onActivated restore completes) */
  function markRestored(): void {
    _hasRestored = true
  }

  function cleanupColumnStateResources() {
    pendingWatchStop?.()
    pendingWatchStop = null
    // 推进代际：进行中的异步 restore 在 await 后会被丢弃，不再覆盖新布局
    columnStateGeneration++
    // <zh/> flush 而非 cancel——KeepAlive 停用/卸载前把防抖窗口内（≤300ms）的未落盘
    // <zh/> 变更立即写入存储，cancel 会直接丢弃这些变更（静默丢失用户的最后调整）。
    // <en/> flush instead of cancel — persist changes still inside the debounce window (≤300ms)
    // before KeepAlive deactivation/unmount; cancel silently dropped the user's latest
    // adjustments.
    debouncedSave.flush()
  }

  /**
   * 重置列状态到初始值，并清除持久化存储
   *
   * Reset column state to initial values and clear persisted storage
   */
  function resetColumnState(): void {
    // <zh/> 一并清空排序——覆盖列显隐/顺序/宽度与 sortState，防止残留 sort 经 autoSave
    // <zh/> watcher 重新写回存储：resetColumns 触发快照变化 → watcher 触发 → 残留 sort
    // <zh/> 持久化回去。_skipWatchSave 覆盖整个重置过程，nextTick 后解除（watcher 在本 flush 周期内触发）。
    // <en/> Clear sorts too — covers visibility/order/width and sortState, preventing residual
    // <en/> sortState from being re-persisted by the autoSave watcher (resetColumns changes the
    // <en/> snapshot → watcher fires → residual sort written back). _skipWatchSave covers the whole
    // <en/> reset and is released after nextTick (the watcher fires within this flush cycle).
    skipWatchSave.value = true
    try {
      setSorts([])
      /**
       * <zh/> 先清列宽覆盖层再重置列——否则 useColumnResize.columnWidths 中的拖拽值会继续
       * <zh/> 经 getColumnWidth 生效，使"重置列"在虚拟模式下宽不生效（列对象虽已换新，
       * <zh/> 覆盖层仍按 key 命中）。必须在 resetColumns() **之前**调用：重置后 columns
       * <zh/> 已是新对象，此处无需（也不应）再回写 col.width。
       * <zh/> 回调缺失时仅 dev 告警（行为不变），理由同 applyColumnState 处的不变量注释。
       * <en/> Clear the width overlay before resetting columns — otherwise drag widths still in
       * <en/> useColumnResize.columnWidths keep winning through getColumnWidth, so "reset columns"
       * <en/> does not reset widths in virtual mode (the overlay matches by key even after the
       * <en/> column objects are replaced). Must run **before** resetColumns(): afterwards the
       * <en/> columns are already new objects and no col.width write-back is needed.
       * <en/> A missing callback only warns in dev (behavior unchanged), same invariant rationale
       * <en/> as in applyColumnState.
       */
      if (onResetColumnWidths) {
        onResetColumnWidths()
      }
      else if (isDev) {
        devWarn(
          '[AdvTable] resetColumnState: resetting columns without onResetColumnWidths wired — '
          + 'stale drag widths in useColumnResize.columnWidths may survive the reset. '
          + 'Wire options.onResetColumnWidths (see use-adv-table-data-columns).',
        )
      }
      resetColumns()
      if (persistence.value?.enabled) {
        try {
          storage.value.remove(storageKey.value)
        }
        catch (err) {
          handleError('remove', err)
        }
      }
    }
    finally {
      void nextTick().then(() => {
        skipWatchSave.value = false
      })
    }
  }

  return {
    restoreState,
    restoreWhenColumnsReady,
    hasRestored,
    markRestored,
    resetColumnState,
    cleanupColumnStateResources,
  }
}
