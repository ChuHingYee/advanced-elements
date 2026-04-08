import type { ToggleRowEventOptions, UseSelectionStateEmits, UseSelectionStateOptions, UseSelectionStateReturn } from './selection-types'
import { toValue } from 'vue'
import { createSelectionBatch } from './selection-batch'
import { createSelectionEligibility } from './selection-eligibility'
import { createSelectionMutationGuard } from './selection-mutation-guard'
import { createSelectionQuery } from './selection-query'
import { createSelectionStrategies } from './selection-strategies'
import { useSelectionCore } from './use-selection-core'

// <zh/> 公开类型转出——门面单点导入（类型真源见 ./selection-types）| <en/> Public type re-exports for single-point facade imports (sourced from ./selection-types)

/**
 * <zh/> 选中状态门面——装配六个内聚层，并持有唯一的策略分发入口
 * <en/> Selection-state facade — assembles six cohesive layers and owns the single dispatch entry point
 *
 * @remarks
 * <zh/> 分层与依赖方向（**严格单向，无环**）：
 * <zh/> ```
 * <zh/>   selection-mutation-guard（守卫：可重入深度 + 监听器吞错）
 * <zh/>          ↓
 * <zh/>   use-selection-core  （唯一响应式层：selectedKeys / 派生 / 剪除 watcher / 事件派发）
 * <zh/>          ↓
 * <zh/>   selection-eligibility（纯：可选择性判定 + 树形级联开关）
 * <zh/>   selection-query      （纯：只读派生）
 * <zh/>          ↓
 * <zh/>   selection-strategies （纯：单击 / Ctrl / Shift / toggle / 树形 五种语义）
 * <zh/>          ↓
 * <zh/>   selection-batch      （纯：全选 / 清空 / 受控设置 / 按 key 批量写入）
 * <zh/>          ↓
 * <zh/>   本门面（toggleRowSelection 分发 + 对外契约）
 * <zh/> ```
 * <zh/> 只有 `use-selection-core` 与门面是 composable（前者持有 `computed`/`watch`），
 * <zh/> 其余四层为**纯工厂**——无响应式状态、无生命周期，按 Vue 最佳实践不加 `use*` 前缀。
 *
 * <en/> Layering and dependency direction (**strictly one-way, acyclic**):
 * <en/> ```
 * <en/>   selection-mutation-guard (re-entrant depth + listener error swallowing)
 * <en/>          ↓
 * <en/>   use-selection-core  (only reactive layer: selectedKeys / derivations / pruning watcher / dispatch)
 * <en/>          ↓
 * <en/>   selection-eligibility (pure: eligibility + tree-cascade switch)
 * <en/>   selection-query      (pure: read-only derivations)
 * <en/>          ↓
 * <en/>   selection-strategies (pure: click / Ctrl / Shift / toggle / tree semantics)
 * <en/>          ↓
 * <en/>   selection-batch      (pure: select-all / clear / controlled set / bulk writes by key)
 * <en/>          ↓
 * <en/>   this facade (toggleRowSelection dispatch + public contract)
 * <en/> ```
 * <en/> Only `use-selection-core` and this facade are composables (the former owns
 * <en/> `computed`/`watch`); the other four are **pure factories** — no reactive state, no
 * <en/> lifecycle, hence no `use*` prefix, per Vue best practice.
 */
export function useSelectionState<T = any>(
  options: UseSelectionStateOptions<T>,
  emits: UseSelectionStateEmits<T> = {},
): UseSelectionStateReturn<T> {
  const { rowKey, allData, rowMap, selectableFn, selectionMode, rowMultiSelectWithClick, treeApi, keyToIndexMap, shiftScopeData, pruneOnRowMapChange } = options

  // ── L0 守卫 ── | guard
  const guard = createSelectionMutationGuard()

  // ── L1 状态核（唯一持有响应式状态）── | state core (the only reactive layer)
  const core = useSelectionCore<T>({ guard, emits, rowKey, rowMap, pruneOnRowMapChange })
  const { selectedKeys, lastClickedKey, withSelectionGuard, emitSelectionChange } = core

  // ── L2 选择资格 ── | eligibility
  const eligibility = createSelectionEligibility<T>({ rowKey, allData, rowMap, selectableFn, keyToIndexMap, treeApi })
  const { isRowSelectable, isTreeCascadeEnabled } = eligibility

  // ── L3 交互策略 ── | interaction strategies
  const strategies = createSelectionStrategies<T>({
    selectedKeys,
    lastClickedKey,
    emitSelectionChange,
    eligibility,
    rowKey,
    allData,
    shiftScopeData,
    rowMap,
    selectableFn,
    keyToIndexMap,
    treeApi,
  })
  const { handleSingleSelect, handleCtrlSelect, handleShiftSelect, handleDefaultToggle, handleTreeToggle } = strategies

  // ── L4 只读查询 ── | read-only query
  const query = createSelectionQuery<T>({ selectedKeys, rowKey, rowMap, selectableFn })

  // ── L5 批量操作 ── | batch operations
  const batch = createSelectionBatch<T>({
    selectedKeys,
    lastClickedKey,
    withSelectionGuard,
    emitSelectionChange,
    eligibility,
    query,
    handleTreeToggle,
    rowKey,
    rowMap,
    selectableFn,
    selectionMode,
    treeApi,
  })

  /**
   * 切换行选中状态——根据 modifier keys 和 selection mode 分发到具体策略。
   * Toggle row selection — dispatch to specific strategy based on modifier keys and selection mode.
   * @param row - <zh/> 目标行 | <en/> target row
   * @param [selected] - <zh/> 强制选中/取消选中，undefined 时 toggle | <en/> force select/deselect; toggles when undefined
   * @param [ignoreSelectable] - <zh/> 是否跳过 selectable 检查（如 checkbox 点击） | <en/> whether to skip the selectable check (e.g. checkbox click)
   * @param [eventOptions] - <zh/> 事件选项（Ctrl/Shift 键状态） | <en/> event options (Ctrl/Shift key state)
   */
  function toggleRowSelection(row: T, selected?: boolean, ignoreSelectable?: boolean, eventOptions?: ToggleRowEventOptions) {
    withSelectionGuard(() => {
      const currentRowKey = toValue(rowKey)
      const key = currentRowKey(row)
      const wasSelected = selectedKeys.value.has(key)
      const shouldSelect = selected ?? !wasSelected

      /**
       * 对于 shift+点击，将逐行可选性检查延迟到下方的范围循环
       * For shift+click, defer per-row selectability check to the range loop below
       */
      if (!eventOptions?.ctrlKey && !eventOptions?.shiftKey) {
        if (!isRowSelectable(row, key, shouldSelect, ignoreSelectable))
          return
      }

      const currentMode = toValue(selectionMode)
      /**
       * <zh/> single 模式必须优先于 ctrl/shift 分支判定——否则 ctrl/shift+点击会绕过单选约束
       * <zh/> 选中多行（"击穿"）。single 模式下任何点击都走单选策略。
       * <en/> Single mode must be checked before the ctrl/shift branches — otherwise
       * <en/> ctrl/shift+click would bypass the single-selection constraint and select
       * <en/> multiple rows. Any click in single mode goes through the single strategy.
       */
      if (currentMode === 'single' && shouldSelect) {
        return handleSingleSelect(row, key)
      }

      if (eventOptions?.ctrlKey) {
        return handleCtrlSelect(row, key, shouldSelect, ignoreSelectable)
      }

      if (eventOptions?.shiftKey) {
        return handleShiftSelect(row, key, shouldSelect, ignoreSelectable)
      }

      /**
       * <zh/> rowMultiSelectWithClick 为 false 且 selected 为 undefined（行点击，非 checkbox 点击）时， | <en/> When rowMultiSelectWithClick is false and selected is undefined (row click, not checkbox click),
       * <zh/> 清除之前所有选中项，仅选中当前行。 | <en/> clear all previous selections and select only the current row.
       */
      const currentRowMultiSelectWithClick = toValue(rowMultiSelectWithClick)
      if (selected === undefined && currentRowMultiSelectWithClick === false) {
        return handleSingleSelect(row, key)
      }

      if (isTreeCascadeEnabled()) {
        return handleTreeToggle(row, key, shouldSelect, ignoreSelectable)
      }

      return handleDefaultToggle(row, key, shouldSelect, wasSelected)
    })
  }

  function setLastClickedKey(key: string | null): void {
    lastClickedKey.value = key
  }

  return {
    selectedKeys,
    isSelected: core.isSelected,
    toggleRowSelection,
    toggleAllSelection: batch.toggleAllSelection,
    selectAll: batch.selectAll,
    clearSelection: batch.clearSelection,
    clearVisibleRows: batch.clearVisibleRows,
    setSelection: batch.setSelection,
    getSelectedRows: core.getSelectedRows,
    initSelectionByKeys: batch.initSelectionByKeys,
    getCheckStatus: query.getCheckStatus,
    selectRowByKey: batch.selectRowByKey,
    selectRowsByKeys: batch.selectRowsByKeys,
    isSelectedByKey: query.isSelectedByKey,
    getSelectedKeys: query.getSelectedKeys,
    getSelectedCount: query.getSelectedCount,
    replaceSelection: batch.replaceSelection,
    forEachSelected: query.forEachSelected,
    getSelectedIndices: query.getSelectedIndices,
    lastClickedKey,
    setLastClickedKey,
    batchSelectionUpdate: core.batchSelectionUpdate,
  }
}

export type {
  CheckStatus,
  SelectionChangeMeta,
  SelectionChangeReason,
  ToggleRowEventOptions,
  UseSelectionStateEmits,
  UseSelectionStateOptions,
  UseSelectionStateReturn,
} from './selection-types'
