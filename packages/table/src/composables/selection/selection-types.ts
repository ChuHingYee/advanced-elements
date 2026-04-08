import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type { TreeApi } from '../../types/config'

export type SelectionChangeReason = 'select' | 'selectAll' | 'init' | 'clear'

/**
 * <zh/> toggleRowSelection 事件选项
 * <en/> Toggle row selection event options
 */
export interface ToggleRowEventOptions {
  /** <zh/> Ctrl/Meta key: 切换单行选中，不影响其他选中行 | <en/> Ctrl/Meta key: toggle single row without affecting other selections */
  ctrlKey?: boolean
  /** <zh/> Shift key: 从上次点击的锚点行范围选择到当前行 | <en/> Shift key: range select from last clicked row anchor to this row */
  shiftKey?: boolean
}

/**
 * useSelectionState 选项
 */
export interface UseSelectionStateOptions<T = any> {
  rowKey: MaybeRefOrGetter<(row: T) => string>
  allData: MaybeRefOrGetter<T[]>
  /**
   * 外部 rowMap（由父级注入，用于 O(1) 查找，必填）
   * External rowMap (injected by parent for O(1) lookups, required)
   */
  rowMap: MaybeRefOrGetter<Map<string, T>>
  selectableFn?: MaybeRefOrGetter<((row: T, index: number) => boolean) | undefined>
  selectionMode?: MaybeRefOrGetter<'single' | 'multiple'>
  rowMultiSelectWithClick?: MaybeRefOrGetter<boolean | undefined>
  /** 树形 API — 提供父子关系遍历能力，不传则无树形联动 */
  treeApi?: MaybeRefOrGetter<TreeApi | undefined>
  /**
   * 外部 keyToIndex Map（由父级注入，用于 shift 选择中的 O(1) 查找）
   * External keyToIndex Map (injected by parent for O(1) lookups in shift-select)
   */
  keyToIndexMap?: MaybeRefOrGetter<Map<string, number>>
  /**
   * <zh/> Shift 范围计算的数据域——调用方传入**作用域有序数据**（Shift 范围按此切片，不可见行不被误选）。
   * <zh/> 默认回退 `allData`（保持直接复用者的既有行为）。
   * <en/> Data domain for Shift range computation — callers pass the **scope-ordered** dataset (Shift ranges slice it; invisible rows are never picked up).
   * <en/> Falls back to `allData` when omitted (preserves existing behavior for direct consumers).
   */
  shiftScopeData?: MaybeRefOrGetter<T[]>
  /**
   * <zh/> rowMap 变化时是否剪除不在新数据中的选中行（默认 true）。
   * <zh/> 跨页保留选中时置为 false（见 RowConfig.keepSelectionAcrossPages）。
   * <en/> Whether to prune selected rows missing from the new rowMap (default true).
   * <en/> Set to false to keep selection across pages (see RowConfig.keepSelectionAcrossPages).
   */
  pruneOnRowMapChange?: MaybeRefOrGetter<boolean | undefined>
}

/**
 * <zh/> selectionChange 轻量元信息——与全量 rows 并行传递的 key 快照。
 * <zh/> rows 仍全量构造（公开契约）；meta 为 next-major 懒 rows 的前向兼容载荷，key-only 消费方可先用 meta。
 * <en/> Lightweight selectionChange meta — a key snapshot passed alongside the full rows.
 * <en/> rows are still fully materialized (public contract); meta is the forward-compatible payload
 * <en/> for next-major lazy rows — key-only consumers can adopt meta first.
 */
export interface SelectionChangeMeta {
  /** <zh/> 选中 key 快照 | <en/> Snapshot of selected keys */
  keys: string[]
  /** <zh/> 选中数量（= keys.length） | <en/> Selected count (= keys.length) */
  count: number
}

export interface UseSelectionStateEmits<T = any> {
  /** <zh/> 选中集合变更事件回调（附带 key 快照元信息） | <en/> Selection change callback (with optional key-snapshot meta) */
  onSelectionChange?: (selection: T[], meta?: SelectionChangeMeta) => void
  /** <zh/> 单行选中/取消选中事件回调 | <en/> Single row select/deselect event callback */
  onSelect?: (payload: { selection: T[], row: T }) => void
  /** <zh/> 全选/取消全选事件回调 | <en/> Select-all / unselect-all event callback */
  onSelectAll?: (selection: T[]) => void
  /**
   * 行选中/取消选中时触发。
   * 仅单行切换时触发；批量操作（全选/清空）不触发。
   * Triggered when a row is selected/deselected.
   * Only triggered on single-row toggle; batch operations (select-all/clear) do not trigger.
   */
  onRowSelected?: (payload: { row: T, selected: boolean }) => void
}

export interface CheckStatus {
  /** <zh/> 可见的可选中行是否全部选中 | <en/> Whether all selectable rows in view are selected */
  isAllSelected: boolean
  /** <zh/> 是否处于半选（部分选中）状态 | <en/> Whether the selection is indeterminate (partially selected) */
  isIndeterminate: boolean
}

/**
 * <zh/> useSelectionState 返回值 | <en/> useSelectionState return value
 */
export interface UseSelectionStateReturn<T = any> {
  /** <zh/> 选中行 key 集合 | <en/> Set of selected row keys */
  selectedKeys: ShallowRef<Set<string>>
  /**
   * 最后点击的行键（用于 shift 点击范围选择的锚点）
   * Last clicked row key (for shift-click range selection anchor)
   */
  lastClickedKey: ShallowRef<string | null>
  /** <zh/> 判断行是否选中 | <en/> Whether a row is selected */
  isSelected: (row: T) => boolean
  /** <zh/> 切换行选中状态（可指定目标态、忽略 selectable 及事件修饰选项） | <en/> Toggle row selection (explicit target state, selectable override and event-modifier options) */
  toggleRowSelection: (row: T, selected?: boolean, ignoreSelectable?: boolean, options?: ToggleRowEventOptions) => void
  /** <zh/> 可见行的全选/取消全选切换 | <en/> Toggle between select-all and deselect-all for the visible rows */
  toggleAllSelection: (visibleRows: T[]) => void
  /** <zh/> 选中全部可见行 | <en/> Select all visible rows */
  selectAll: (visibleRows: T[]) => void
  /** <zh/> 取消指定可见行的选中（保留不可见行的选中） | <en/> Deselect the given visible rows (keeping off-view selections) */
  clearVisibleRows: (visibleRows: T[]) => void
  /** <zh/> 清空全部选中 | <en/> Clear the entire selection */
  clearSelection: () => void
  /** <zh/> 批量设置行的选中状态 | <en/> Batch set the selected state of rows */
  setSelection: (rows: T[], selected?: boolean) => void
  /** <zh/> 获取当前选中行数组 | <en/> Get the current selected rows array */
  getSelectedRows: () => T[]
  /** <zh/> 按外部 key 初始化选中状态 | <en/> Initialize selection state from external keys */
  initSelectionByKeys: (keys: (string | number)[]) => void
  /** <zh/> 计算可见行的全选/半选状态 | <en/> Compute all-selected/indeterminate status for the visible rows */
  getCheckStatus: (visibleRows: T[], selectableFn?: (row: T, index: number) => boolean) => CheckStatus
  /** <zh/> 按行 key 选中或取消选中 | <en/> Select or deselect a row by key */
  selectRowByKey: (key: string | number, selected?: boolean) => void
  /** <zh/> 按行 key 判断是否选中 | <en/> Whether a row key is selected */
  isSelectedByKey: (key: string | number) => boolean
  /** <zh/> 获取选中 key 数组 | <en/> Get the array of selected keys */
  getSelectedKeys: () => string[]
  /** <zh/> 获取选中行数量 | <en/> Get the selected row count */
  getSelectedCount: () => number
  /** <zh/> 用给定行整体替换选中集合 | <en/> Replace the whole selection with the given rows */
  replaceSelection: (rows: T[]) => void
  /** <zh/> 遍历选中的行及其 key | <en/> Iterate over selected rows and their keys */
  forEachSelected: (callback: (row: T, key: string) => void) => void
  /** <zh/> 获取选中行在完整数据中的索引数组 | <en/> Get indices of selected rows within the full data */
  getSelectedIndices: (allData: T[]) => number[]
  /**
   * 设置最后点击的行键（用于 shift 点击锚点）
   * Set last clicked row key (for shift-click anchor)
   */
  setLastClickedKey: (key: string | null) => void
  /**
   * <zh/> 批量选中/取消选中多行（按 key）。
   * <zh/> 当 selected=true 时为**替换语义**：用传入的 keys 替换整个选中集（传空数组即清空选中）。
   * <zh/> 当 selected=false 时为**追加取消语义**：仅取消传入的 keys，不影响其他已选中行。
   * <zh/> 当 selected=undefined 时为**切换语义**：逐个切换传入的 keys 的选中状态。
   * <en/> Batch select/deselect rows by key.
   * <en/> When selected=true: **replace semantics** — replaces the entire selection with the given keys (empty array = clear).
   * <en/> When selected=false: **additive deselect** — only removes the given keys.
   * <en/> When selected=undefined: **toggle** — toggles each key individually.
   * @param keys - <zh/> 行 key 数组（string | number） | <en/> row key array（string | number）
   * @param selected - <zh/> true 替换选中集，false 取消选中，undefined 切换 | <en/> true replace selection, false deselect, undefined toggle
   */
  selectRowsByKeys: (keys: (string | number)[], selected?: boolean) => void
  /**
   * <zh/> 批量选择更新——回调内事件合并为一次 `init` 通知（见 batchSelectionUpdate 实现注释）。
   * <en/> Batched selection update — events inside the callback collapse into one `init` notice
   * <en/> (see the batchSelectionUpdate implementation comment).
   */
  batchSelectionUpdate: (fn: () => void) => void
}
