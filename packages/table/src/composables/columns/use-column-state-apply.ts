import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { ApplyColumnStateOptions, ColumnState } from '../../types/column-state'
import { nextTick } from 'vue'
import { findColumnByKey, stableReorderByKey, traverseColumnTree } from '../../utils/column-tree'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { getColumnKey } from '../../utils/shared'
import { isValidColumnStateData } from './use-column-state-guards'

/**
 * <zh/> 列状态应用依赖 | <en/> Column-state apply deps
 */
export interface UseColumnStateApplyDeps {
  localColumns: Ref<ProcessedColumn[]>
  mode?: () => 'default' | 'virtual'
  onResetColumnWidths?: () => void
  touchColumns?: () => void
  setSorts: (sorts: import('../../types/sort').SortState[]) => void
  setColumns: (cols: ProcessedColumn[]) => void
  autoSaveEnabled: ComputedRef<boolean | undefined>
  skipWatchSave: ShallowRef<boolean>
  debouncedSave: { (): void, flush: () => void }
}

/**
 * <zh/> 列状态应用——warnOnUnknownColumnIds / applyColumnState / reorderColumns / resetColumnState。
 *
 * <zh/> 自 use-column-state.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C）；
 * <zh/> 唯一改动：`_skipWatchSave` 布尔讫值改为 `skipWatchSave.value`（shallowRef，storage 模块持有）。
 * <en/> Column-state apply — warnOnUnknownColumnIds / applyColumnState / reorderColumns / resetColumnState.
 *
 * <en/> Migrated verbatim from use-column-state.ts (COMPLEXITY-PLAN battle line 3, knife C);
 * <en/> sole change: `_skipWatchSave` boolean reads/writes become `skipWatchSave.value`
 * <en/> (a shallowRef owned by the storage module).
 */
export function useColumnStateApply(deps: UseColumnStateApplyDeps) {
  const {
    localColumns,
    mode: modeGetter,
    onResetColumnWidths,
    touchColumns,
    setSorts,
    setColumns,
    autoSaveEnabled,
    skipWatchSave,
    debouncedSave,
  } = deps

  /** 未知 colId 的 dev 告警（早退守卫替代 try→if→for→if 四层嵌套） */
  function warnOnUnknownColumnIds(state: ColumnState[]): void {
    if (!isDev)
      return
    for (const saved of state) {
      if (findColumnByKey(localColumns.value, saved.colId))
        continue
      devWarn(`[AdvTable] Column state references unknown colId "${saved.colId}", skipping.`)
    }
  }

  /**
   * 应用列状态：恢复宽度、隐藏、固定、排序和列顺序
   *
   * Apply column state: restore width, hidden, fixed, sort, and column order
   */
  function applyColumnState(
    state: ColumnState[] | null | undefined,
    applyOptions?: ApplyColumnStateOptions,
  ): void {
    if (!state || !Array.isArray(state)) {
      if (isDev && state !== undefined) {
        devWarn('[AdvTable] applyColumnState: expected ColumnState[], got', typeof state)
      }
      return
    }

    if (state.length === 0)
      return

    /**
     * <zh/> 字段级 schema 校验（与 restoreState 同源）——`applyColumnState` 是公开 API，
     * <zh/> 且命名视图（applyView）会把存储中的原始 JSON 直接喂入，非法项（`width: -5` /
     * <zh/> `width: "100"` / `fixed: "middle"`）会写出渲染死列或列宽累加失真。
     * <zh/> 采**整体拒绝**而非逐项丢弃：顺序 / 显隐 / 固定构成一致性快照，部分应用会让
     * <zh/> 列布局停在半迁移态（且 `reorderColumns` 的入参集合会被无声裁剪）。
     * <en/> Field-level schema validation (same source as restoreState) — `applyColumnState` is a
     * <en/> public API and named views (`applyView`) feed raw stored JSON straight in; invalid items
     * <en/> (`width: -5` / `width: "100"` / `fixed: "middle"`) would produce broken columns or
     * <en/> corrupt width accumulation. The whole payload is **rejected** instead of dropping items:
     * <en/> order/visibility/pinning form a consistency snapshot, and partial application leaves the
     * <en/> layout half-migrated (and would silently shrink the set handed to `reorderColumns`).
     */
    if (!isValidColumnStateData(state)) {
      if (isDev) {
        devWarn(
          '[AdvTable] applyColumnState: state failed field-level validation and was ignored. '
          + 'Expected ColumnState[] with a non-empty string colId, finite positive width, boolean hidden, '
          + 'fixed ∈ {\'left\', \'right\', true, false}, sort ∈ {\'ascending\', \'descending\', null}.',
        )
      }
      return
    }

    /** <zh/> 恢复状态期间跳过 deep watch 触发的冗余保存（即 isRestoring 守卫），恢复完成后手动触发一次 | <en/> Skip deep-watch save during restore (isRestoring guard), trigger once after restore */
    skipWatchSave.value = true
    try {
      const {
        applyOrder = true,
        applyWidth = true,
        applySort = true,
        applyHidden = true,
        applyFixed = true,
      } = applyOptions ?? {}

      /**
       * <zh/> 跨模式列宽语义一致性校验
       * <zh/> default 模式 width 基于 <table> 模型，virtual 模式基于 Grid 模型，
       * <zh/> 两者单位语义不同。若存储时的 mode 与当前 mode 不一致，则跳过 width 应用，
       * <zh/> 避免跨模式应用导致视觉跳变。无 mode 字段的数据照常应用。
       * <en/> Cross-mode width semantic consistency check.
       * <en/> default mode width is based on <table> layout, virtual mode on Grid layout,
       * <en/> the unit semantics differ. If the stored mode mismatches the current mode,
       * <en/> width application is skipped to avoid visual jump. Historical data (no mode field) is applied as usual.
       */
      const currentMode = modeGetter?.()
      const storedMode = state.find(s => s.mode !== undefined)?.mode
      let effectiveApplyWidth = applyWidth
      if (applyWidth && storedMode !== undefined && currentMode !== undefined && storedMode !== currentMode) {
        if (isDev) {
          devWarn(
            `[AdvTable] Column state mode mismatch: stored="${storedMode}", current="${currentMode}". Width application skipped to avoid visual jump.`,
          )
        }
        effectiveApplyWidth = false
      }

      const stateMap = new Map(state.map(s => [s.colId, s]))

      /**
       * <zh/> 恢复列宽前清空 useColumnResize.columnWidths 缓存——
       * <zh/> 否则 columnWidths[key] 中的旧拖拽值会遮蔽 applyColumnState 写入 col.width 的新值
       * <zh/> （getColumnWidth 优先读 columnWidths[key]）。
       * <zh/> 不变量：只要应用宽度就必须先清覆盖层。回调缺失时仅 dev 告警（行为不变），
       * <zh/> 使接线断裂（如新增渲染模式未接 onResetColumnWidths）在开发期可见，
       * <zh/> 而非以"设置没保存"的静默形式漏到生产。
       * <en/> Clear useColumnResize.columnWidths cache before restoring widths
       * <en/> otherwise stale drag values in columnWidths[key] shadow the new col.width
       * <en/> written by applyColumnState (getColumnWidth reads columnWidths[key] first).
       * <en/> Invariant: the overlay must be cleared whenever widths are applied. A missing
       * <en/> callback only warns in dev (behavior unchanged) so broken wiring surfaces
       * <en/> during development instead of leaking to production as "settings not saved".
       */
      if (effectiveApplyWidth) {
        if (onResetColumnWidths) {
          onResetColumnWidths()
        }
        else if (isDev) {
          devWarn(
            '[AdvTable] applyColumnState: restoring widths without onResetColumnWidths wired — '
            + 'stale drag widths in useColumnResize.columnWidths may shadow the restored col.width. '
            + 'Wire options.onResetColumnWidths (see use-adv-table-data-columns).',
          )
        }
      }

      traverseColumnTree(localColumns.value, (col) => {
        const key = getColumnKey(col)
        const saved = stateMap.get(key)
        if (!saved) {
          return
        }

        if (effectiveApplyWidth && typeof saved.width === 'number' && Number.isFinite(saved.width) && saved.width > 0)
          col.width = saved.width
        if (applyHidden && saved.hidden != null)
          col.hidden = saved.hidden
        if (applyFixed && saved.fixed != null)
          col.fixed = saved.fixed as ProcessedColumn['fixed']
      })

      if (touchColumns) {
        touchColumns()
      }
      else {
        localColumns.value = [...localColumns.value]
      }

      if (applySort) {
        const sortEntries = state
          .filter(s => s.sort != null)
          .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
          .map(s => ({ prop: s.colId, order: s.sort! }))

        if (sortEntries.length > 0) {
          setSorts(sortEntries)
        }
      }

      if (applyOrder) {
        const orderedIds = state.map(s => s.colId)
        reorderColumns(orderedIds)
      }

      warnOnUnknownColumnIds(state)
    }
    finally {
      /**
       * <zh/> 下一个微任务释放守卫——自动保存 watcher 为默认 flush:'pre'（微任务内执行），
       * <zh/> 同步复位会使本轮 restore 触发的 watcher 看到已复位的标志，冗余保存漏跳过。
       * <en/> Release the guard on the next microtask — the auto-save watcher runs with
       * <en/> default flush:'pre' (inside a microtask); a synchronous reset makes this
       * <en/> restore-triggered watcher see the flag already cleared and leak the redundant save.
       */
      void nextTick().then(() => {
        skipWatchSave.value = false
      })
      /**
       * 恢复完成后触发一次保存，确保存储与当前状态同步
       * Trigger one save after restore to keep storage in sync with current state
       */
      if (autoSaveEnabled.value) {
        debouncedSave()
      }
    }
  }

  /**
   * 根据给定的列 ID 顺序重排列
   *
   * 通过 setColumns API 走正规更新流程，同步 originColumns 并通知父组件。
   * Reorder columns according to the given column ID order.
   *
   * Uses the setColumns API to go through the standard update flow,
   * syncing originColumns and notifying the parent component.
   */
  function reorderColumns(orderedIds: string[]): void {
    const orderIndex = new Map(orderedIds.map((id, i) => [id, i]))
    const reordered = stableReorderByKey(localColumns.value, orderIndex)

    /**
     * 通过 setColumns 走正规更新流程而非直接修改 localColumns.value，
     * 确保 originColumns 同步更新、emitUpdate 通知父组件。
     * Use setColumns instead of directly mutating localColumns.value
     * to ensure originColumns is synced and emitUpdate notifies the parent.
     */
    setColumns(reordered)
  }

  return { applyColumnState, reorderColumns }
}
