import type { ComputedRef, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { ApplyColumnStateOptions, ColumnState, ColumnStatePersistence } from '../../types/column-state'
import type { SortState } from '../../types/sort'

/**
 * <zh/> `useColumnState` 的选项与返回契约——自 use-column-state.ts 拆出（COMPLEXITY-PLAN 战线三，
 * <zh/> 刀法 C）；use-column-state.ts re-export 本文件，既有导入路径零变化。
 * <en/> Options and return contracts of `useColumnState` — split out of use-column-state.ts
 * <en/> (COMPLEXITY-PLAN battle line 3, knife C); use-column-state.ts re-exports this file,
 * <en/> keeping every existing import path unchanged.
 */
export interface UseColumnStateOptions {
  /** <zh/> 响应式列定义 | <en/> Reactive column definitions */
  localColumns: Ref<ProcessedColumn[]>
  /** <zh/> 当前排序状态 | <en/> Current sort state */
  sortState: Ref<SortState[]>
  /** <zh/> 重置列到初始状态的回调 | <en/> Callback to reset columns to initial state */
  resetColumns: () => void
  /**
   * <zh/> 设置列配置的回调（来自 useColumns.setColumns），同步 originColumns 并 emit 更新
   * <en/> Callback to set columns (from useColumns.setColumns), syncs originColumns and emits update
   */
  setColumns: (cols: ProcessedColumn[]) => void
  /**
   * <zh/> 触发 localColumns 重渲染的回调（来自 useColumns.touchColumns），
   * <zh/> 在列对象属性突变后调用以刷新渲染，但不同步 originColumns 也不 emit。
   * <zh/> 可选：缺省时回退到 `localColumns.value = [...localColumns.value]` 重赋值。
   * <en/> Re-render trigger callback (from useColumns.touchColumns),
   * called after mutating column properties to refresh rendering without
   * syncing originColumns or emitting updates. Optional — falls back to a
   * `localColumns.value = [...localColumns.value]` reassign when omitted.
   */
  touchColumns?: () => void
  /**
   * 设置排序状态的回调
   * Callback for setting sort state
   */
  setSorts: (sorts: SortState[]) => void
  /**
   * 持久化配置
   * Persistence config
   */
  persistence: ComputedRef<ColumnStatePersistence | undefined>
  /**
   * <zh/> 表格唯一标识 getter——用于推导持久化 storageKey。
   * <zh/> 以 getter 传入（而非字符串快照）使 `uiConfig.tableId` 运行时变更后 `storageKey` 随之更新，
   * <zh/> 与本文件 `mode` 的 getter 约定一致。
   * <en/> Unique table ID getter — used to derive the persistence storageKey.
   * Passed as a getter (rather than a string snapshot) so `storageKey` follows runtime
   * `uiConfig.tableId` changes, consistent with this file's `mode` getter convention.
   */
  tableId: () => string
  /**
   * <zh/> 当前渲染模式 getter——用于在 columnState 中记录 mode 字段，
   * <zh/> apply 时若 mode 不一致则跳过 width 应用，避免 default/virtual 跨模式列宽语义不一致导致的视觉跳变
   * <en/> Current render mode getter — used to record the mode field in columnState,
   * on apply, if mode mismatches, width application is skipped to avoid visual jump from default/virtual cross-mode width semantics mismatch
   */
  mode?: () => 'default' | 'virtual'
  /**
   * <zh/> 重置列宽拖拽缓存的回调——applyColumnState 恢复列宽前调用，清空 useColumnResize.columnWidths 中的陈旧拖拽值
   * <zh/> 避免 columnWidths[key] 遮蔽 applyColumnState 写入 col.width 的新值
   * <en/> Callback to reset column resize cache — called before applying column widths in applyColumnState,
   * clearing stale drag widths from useColumnResize.columnWidths
   * prevents columnWidths[key] from shadowing the new col.width written by applyColumnState
   */
  onResetColumnWidths?: () => void
}

/**
 * useColumnState 返回值
 *
 * UseColumnState return value
 */
export interface UseColumnStateReturn {
  /**
   * 获取当前列状态（宽度/隐藏/固定/排序）
   * Get current column state (width/hidden/fixed/sort)
   */
  getColumnState: () => ColumnState[]
  /**
   * 应用列状态，支持选择性恢复宽度/排序/顺序
   * Apply column state, supports selectively restoring width/sort/order
   */
  applyColumnState: (state: ColumnState[] | null | undefined, options?: ApplyColumnStateOptions) => void
  /**
   * 重置列状态为初始值，同时清除持久化存储
   * Reset column state to initial values and clear persisted storage
   */
  resetColumnState: () => void
}
