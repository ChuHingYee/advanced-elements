import type { ComponentPublicInstance, ComputedRef, MaybeRefOrGetter, Ref, ShallowUnwrapRef } from 'vue'
import type { NormalizedRowKey, ProcessedColumn, TableRowKey } from '../../types'
import type {
  ApplyColumnStateOptions,
  ColumnState,
  ColumnStatePersistence,
} from '../../types/column-state'
import type { PrintConfig, TreeRowMeta } from '../../types/config'
import type { RowExpandApi, RowGroupApi } from '../../types/config-tree'
import type { ContextMenuParams } from '../../types/context-menu'
import type { CellEditStopReason } from '../../types/edit'
import type { ColumnFilterValue } from '../../types/filter'
import type { SortOrder } from '../../types/sort'
import type { ScrollTarget, ScrollToRowOptions } from '../../utils/table-drag'
import type { ApplyTransactionResult, DataTransactionOps, UseApplyDataTransactionReturn } from '../data/use-apply-data-transaction'
import type { UseTreeDataReturn } from '../data/use-tree-data'
import type { TableExportCsvOptions, TableExportOptions } from '../features/use-table-export'
import type { ToggleRowEventOptions, UseSelectionStateReturn } from '../selection/use-selection-state'
import { computed } from 'vue'
import { markRawTyped } from '../../utils/shared'
import { useNamedViews } from './use-named-views'

/**
 * <zh/> 树形展开 API 投影——与 useTreeData 返回类型对齐
 * <en/> Tree expand API projection — aligned with useTreeData return type
 */
export type UseTableApiTreeExpandOptions<T = any> = Pick<
  UseTreeDataReturn<T>,
  'toggleRowExpand' | 'expandRow' | 'collapseRow' | 'expandAll' | 'collapseAll' | 'getTreeMeta'
>

/**
 * <zh/> 行展开 API 投影——与 useRowExpand 返回类型对齐
 * <en/> Row expand API projection — aligned with useRowExpand return type
 */
export type UseTableApiRowExpandOptions = Pick<
  RowExpandApi,
  'toggleRowExpand' | 'expandDetailRow' | 'collapseDetailRow' | 'expandAllDetailRows' | 'collapseAllDetailRows'
>

/**
 * <zh/> 行分组 API 投影——与 useRowGroup 返回类型对齐
 * <en/> Row group API projection — aligned with useRowGroup return type
 */
export type UseTableApiRowGroupExpandOptions = Pick<
  RowGroupApi,
  'toggleGroupExpand' | 'expandAllGroups' | 'collapseAllGroups'
>

/**
 * <zh/> 行 Pinning API 投影——仅暴露命令式操作，响应式状态经渲染器消费 | <en/> Row pinning API projection — imperative ops only; reactive state is consumed via renderers
 */
export interface UseTableApiRowPinOptions {
  pinRow: (rowKey: TableRowKey, position: 'top' | 'bottom') => void
  unpinRow: (rowKey: TableRowKey) => void
  isRowPinned: (rowKey: TableRowKey) => boolean
  clearPinnedRows: () => void
}

export interface UseTableApiDataColumnsOptions<T> {
  refresh: () => Promise<void>
  loading: Ref<boolean>
  setLoading: (val: boolean) => void
  /**
   * <zh/> 数据回写——remote/manual 场景由父组件回写；携带 requestId 时旧序号写入被丢弃
   * <en/> Data write-back — parent writes back in remote/manual scenarios; a carried requestId drops stale writes
   */
  setResponseData: (data: T[], requestId?: number) => void
  getPagination: () => { currentPage: number, pageSize: number, total: number }
  /**
   * <zh/> 置页并触发副作用（remote 重取 / manual 通知 / client 纠偏）——显式命名，
   * <zh/> 与纯状态 `pagination.setCurrentPage` 区分（同名异义曾导致 double-fetch）。
   * <en/> Set page and fire side effects (remote refetch / manual notify / client
   * <en/> correction) — named explicitly to differ from the pure-state
   * <en/> `pagination.setCurrentPage` (the shared name once caused double-fetch bugs).
   */
  setCurrentPageAndRefetch: (page: number) => void
  setPageSizeAndRefetch: (size: number) => void
  getFullData: () => T[]
  effectiveColumns: () => ProcessedColumn[]
  visibleData: () => T[]
  /** <zh/> AG 风格增量事务（add/update/remove）；不支持消费方否决（模板 return false 生产不生效），补偿走 `rollbackLast` | <en/> AG-style incremental transaction (add/update/remove); no consumer-side veto (template return false never vetoes in production), compensate via `rollbackLast` */
  applyTransaction: UseApplyDataTransactionReturn<T>['applyTransaction']
  /**
   * <zh/> 回滚最近一次已提交事务（公开）：宿主异步落库失败后手动还原表格数据。
   * <en/> Roll back the last committed transaction (public): manual restore after failed async host persistence.
   */
  rollbackLast: () => boolean
  /** <zh/> 最终渲染数据（Row Pinning 启用时排除 pinned 行） | <en/> Final render data (pinned rows excluded when Row Pinning enabled) */
  renderData: () => T[]
  setFilter: (columnKey: string, value: ColumnFilterValue) => void
  resetColumnFilter: (columnKey: string) => void
  resetAllFilters: () => void
  getFilterValue: (columnKey: string) => ColumnFilterValue | undefined
  isColumnFiltered: (columnKey: string) => boolean
  hasActiveFilter: Ref<boolean>
  hasActiveQuickFilter: Ref<boolean>
  toggleSort: (prop: string, event?: { shiftKey?: boolean }) => void
  setSort: (prop: string, order: SortOrder) => void
  setSorts: (sorts: Array<{ prop: string, order: SortOrder }>) => void
  clearSort: () => void
  getSortOrder: (prop: string) => SortOrder
  getSortIndex: (prop: string) => number
  getColumnState: () => ColumnState[]
  applyColumnState: (state: ColumnState[] | null | undefined, options?: ApplyColumnStateOptions) => void
  resetColumnState: () => void
  treeApi: UseTableApiTreeExpandOptions<T>
  rowExpandApi: UseTableApiRowExpandOptions
  rowGroupApi: UseTableApiRowGroupExpandOptions
  rowPinApi: UseTableApiRowPinOptions
}

export interface UseTableApiSelectionOptions<T> {
  selectionState: UseSelectionStateReturn<T>
  toggleAllSelection: () => void
  /** <zh/> 反选当前页可见行 | <en/> Invert selection over visible rows */
  invertSelection: () => void
  selectAll: () => void
  /**
   * <zh/> 全选全部筛选结果（跨页）——virtual 下表头全选即此语义；default 下请按需改用 `selectAllOnCurrentPage`
   * <en/> Select all filtered rows (cross-page) — this is the virtual-mode header select-all semantic; prefer `selectAllOnCurrentPage` under default mode
   */
  selectAllFiltered: () => void
  /**
   * <zh/> 取消全选全部筛选结果（跨页，与 `selectAllFiltered` 同作用域，不随模式变化）
   * <en/> Deselect all filtered rows (cross-page, same scope as `selectAllFiltered`, mode-independent)
   */
  deselectAllFiltered: () => void
  /**
   * <zh/> 全选当前页（恒为当前页，不随模式变化）——default 下表头全选即此语义
   * <en/> Select all rows on the current page (always the current page regardless of mode) — this is the default-mode header select-all semantic
   */
  selectAllOnCurrentPage: () => void
  /**
   * <zh/> 取消全选当前页（恒为当前页，与 `selectAllOnCurrentPage` 同作用域，不随模式变化）
   * <en/> Deselect all rows on the current page (always the current page, same scope as `selectAllOnCurrentPage`, mode-independent)
   */
  deselectAllOnCurrentPage: () => void
  getSelectedIndices: () => number[]
  refreshSelection: () => void
  setCurrentRow: (row: T) => void
  getCurrentRow: () => T | null
  getCurrentPageData: () => T[]
}

/**
 * <zh/> 单行选中选项对象式——唯一形态
 * <en/> Object-form single-row selection options — the only form
 */
export interface ToggleRowSelectionOptions extends ToggleRowEventOptions {
  /** <zh/> 强制选中/取消选中，undefined 时 toggle | <en/> Force select/deselect, toggles when undefined */
  selected?: boolean
  /** <zh/> 是否跳过 selectable 检查，如 checkbox 点击 | <en/> Whether to skip the selectable check, e.g. checkbox clicks */
  ignoreSelectable?: boolean
}

export interface UseTableApiFeaturesOptions<T = any> {
  getQueryFormModel: () => Record<string, unknown>
  setQueryFormModel: (model: Record<string, unknown>) => void
  /** <zh/> 内部——搜索表单组件实例（跨组件联动用），外部请用 setQueryFormModel | <en/> Internal — search form instance (for cross-component wiring); external callers use setQueryFormModel */
  tableSearchRef: Ref<ComponentPublicInstance | null>
  /**
   * <zh/> Excel 导出选项——精确已知字段 + 开放扩展（底层 xlsx 透传参数等未知键仍可编译），
   * <zh/> 列类型随表格泛型 T 传导；默认 T = any 保持既往调用点不变
   * <en/> Excel export options — precise known fields + open extension (unknown passthrough keys still compile),
   * <en/> with the column type carried by the table generic T; the T = any default keeps existing call sites unchanged
   */
  exportExcel: (options?: TableExportOptions<T> & Record<string, unknown>) => Promise<boolean>
  /** <zh/> CSV 导出选项（同上精确 + 开放）。true=成功，false=被拦截或失败 | <en/> CSV export options (same precise + open treatment). true = success, false = intercepted or failed */
  exportCsv: (options?: TableExportCsvOptions<T> & Record<string, unknown>) => Promise<boolean>
  print: (options?: Partial<PrintConfig>) => Promise<void>
  triggerImport: () => void
  /** <zh/> 内部——导入进行中标记（按钮 loading 联动用），外部只读勿写 | <en/> Internal — import-in-flight flag (for button loading); external read-only */
  importing: Ref<boolean>
}

export interface UseTableApiSharedEditingOptions {
  startEditing: (params: { rowIndex: number, prop: string, columnKey: string, value: unknown }) => Promise<void>
  stopEditing: (reason: CellEditStopReason, commit?: boolean) => void
  /** <zh/> 更新编辑中单元格的值（挂载级真实改值入口） | <en/> Update the value of the cell being edited (mount-level real-mutation entry) */
  updateCellEditingValue: (columnKey: string, val: unknown) => void
  /** <zh/> 读取编辑中单元格的值 | <en/> Read the value of the cell being edited */
  getCellEditingValue: (columnKey: string) => unknown
  commitBatchEdit: () => Promise<void>
  cancelBatchEdit: () => void
  hasPendingChanges: Ref<boolean>
  batchHasPending: Ref<boolean>
  /** <zh/> 内部——批量暂存 Map（直接改写绕过校验入口；外部编排请走 commitBatchEdit/cancelBatchEdit） | <en/> Internal — batch staging Map (direct writes bypass validation; external orchestration use commitBatchEdit/cancelBatchEdit) */
  batchPendingChanges: Ref<Map<TableRowKey, Record<string, any>>>
  submitEdit: () => Promise<void>
  discardEdit: () => void
  validate: () => Promise<boolean>
  /**
   * <zh/> 行级校验——`rowIndex` 必须为 renderData 域（`RenderDataIndex`，pin 启用时已剔除固定行，运行时即 number）。
   * <zh/> 手持 visibleData 域索引时，先经 `toRenderDataIndex(visibleIndex, topPinnedCount, renderRowCount)` 换算
   * <zh/> （指向固定行返回 undefined）；误传 visibleData 域索引会静默校验到相邻行（dev 下有误用提示）。
   * <en/> Row validation — `rowIndex` must be renderData-domain (`RenderDataIndex`, pinned rows excluded when pinning is on; a plain number at runtime).
   * <en/> Holding a visibleData-domain index? Convert first via `toRenderDataIndex(...)` (undefined for pinned rows);
   * <en/> a raw visibleData index silently validates the neighboring row (with a dev misuse hint).
   */
  validateRow: (rowIndex: number) => Promise<boolean>
  clearValidate: (target?: { rowIndex?: number, columnKey?: string }) => void
  undo: () => boolean
  redo: () => boolean
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  hasUnsavedChanges: () => boolean
}

export interface UseTableApiContextMenuOptions<T> {
  showContextMenu: (params: ContextMenuParams<T>) => Promise<void>
  hideContextMenu: () => void
}

/**
 * <zh/> 滚动定位域——委托当前活跃渲染器实现，未就绪或目标不存在时返回 false
 * <en/> Scroll domain — delegates to the active renderer; returns false when not ready or target missing
 */
export interface UseTableApiScrollOptions {
  scrollToRow: (target: import('../../utils/table-drag').ScrollTarget, options?: import('../../utils/table-drag').ScrollToRowOptions) => boolean
  scrollToColumn: (target: import('../../utils/table-drag').ScrollTarget) => boolean
}

/**
 * <zh/> 动态行高重测域——委托当前活跃渲染器实现；非动态网格/default 模式/未就绪时返回 false
 * <en/> Dynamic row-height reset domain — delegates to the active renderer; false when off the dynamic grid, in default mode, or not ready
 */
export interface UseTableApiRowHeightOptions {
  resetAfterRowIndex: (index?: number, forceUpdate?: boolean) => boolean
  refreshVirtualRowHeight: (index?: number) => boolean
}

export interface UseTableApiOptions<T> {
  dataColumns: UseTableApiDataColumnsOptions<T>
  selection: UseTableApiSelectionOptions<T>
  features: UseTableApiFeaturesOptions<T>
  sharedEditing: UseTableApiSharedEditingOptions
  contextMenu: UseTableApiContextMenuOptions<T>
  scroll?: UseTableApiScrollOptions
  /** <zh/> 动态行高重测（virtual 动态网格专用） | <en/> Dynamic row-height reset (virtual dynamic grid only) */
  rowHeight?: UseTableApiRowHeightOptions
  /** <zh/> 表格实例 ID——支持 ref/getter，跟随运行时变更 | <en/> Table instance id — accepts ref/getter to follow runtime changes */
  tableId?: MaybeRefOrGetter<string>
  getRowKey: (row: T) => string
  setQuickFilter: (text: string) => void
  getQuickFilter: () => string
  /**
   * <zh/> 持久化配置（列状态自动持久化与命名视图共用）。
   * <zh/> 命名视图经统一适配器读写；读取未命中时回退默认 localStorage（读路径兜底，写入恒走注入适配器）。
   * <en/> Persistence config (shared by column-state auto-persistence and named views).
   * <en/> Named views are read/written via the unified adapter; on miss, falls back to default localStorage (read-path fallback; writes always go through the injected adapter).
   */
  persistence?: ComputedRef<ColumnStatePersistence | undefined>
}

export interface UseTableApiReturn<T> {
  refresh: () => Promise<void>
  loading: Ref<boolean>
  setLoading: (val: boolean) => void
  /**
   * <zh/> 数据回写（manual/远程模式的核心回写通道）——父组件在 `request` 事件中取数后调用，
   * <zh/> 并**必须回显** payload 的 `requestId`：旧序号的写入会被丢弃，避免先发后到覆盖新页。
   *
   * <zh/> 写入路由：配置了 `request.source` 时写远程响应数据，否则写 `v-model:data` 模型。
   * <zh/> 接受写入后会复位 `loading`（manual 模式下 loading 由本调用或 `v-model:data` 回写结束）。
   *
   * <en/> Data write-back (the core write-back channel in manual/remote mode) — the parent calls it after
   * <en/> fetching inside the `request` event and **must echo** the payload's `requestId`: stale ids are
   * <en/> dropped so a late-arriving older response never overwrites a newer page.
   *
   * <en/> Write route: writes the remote response data when `request.source` is configured, otherwise the
   * <en/> `v-model:data` model. An accepted write resets `loading` (in manual mode loading ends via this
   * <en/> call or a `v-model:data` write-back).
   */
  setResponseData: (data: T[], requestId?: number) => void
  getPagination: () => { currentPage: number, pageSize: number, total: number }
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  getFullData: () => T[]
  getCurrentPageData: () => T[]
  /**
   * <zh/> 应用一次增量数据事务（AG Grid applyTransaction 心智）：
   * <zh/> add 追加 / update 按行键整行替换（保持位置）/ remove 按行键移除。
   * <zh/> **不支持消费方否决**：`@before-data-change` 的返回值在生产环境不参与判定（Vue emit 返回 void，
   * <zh/> 监听器 `return false` 无法回传）；`beforeHook` 是内部注入点，未暴露为公共 API。
   * <zh/> 需要「先校验再写入」的消费方请自行在调用前判断，或在写入后用公开的 `rollbackLast` 补偿。
   * <zh/> 写入后派发 dataChange/afterDataChange。
   * <zh/> @returns 成功返回计数；被内部守卫拒绝或竞态失败返回 null
   * <en/> Apply one incremental data transaction (AG Grid applyTransaction semantics):
   * <en/> add appends / update replaces whole rows by rowKey (position preserved) / remove deletes by rowKey.
   * <en/> **Consumer-side veto is not supported**: the `@before-data-change` return value never takes part
   * <en/> in the decision in production (Vue emit returns void, so a listener's `return false` cannot
   * <en/> propagate); `beforeHook` is an internal injection point and is not part of the public API.
   * <en/> Consumers needing validate-then-write should check before calling, or compensate after the write
   * <en/> with the public `rollbackLast`. Emits dataChange/afterDataChange after the write.
   * <en/> @returns counters on success; null when an internal guard refused or a race was lost.
   */
  applyTransaction: (op: DataTransactionOps<T>, reason?: string) => Promise<ApplyTransactionResult | null>
  /**
   * <zh/> 回滚最近一次已提交事务（公开） | <en/> Roll back the last committed transaction (public)
   */
  rollbackLast: () => boolean
  clearSelection: () => void
  /** <zh/> 单行选中（对象式唯一形态；Shift 锚点跨页/排序后失效时退化为单行，见 selection-strategies） | <en/> Toggle single-row selection (object form, the only form; Shift anchor degrades to single-row once invalidated by paging/sort, see selection-strategies) */
  toggleRowSelection: (row: T, options?: ToggleRowSelectionOptions) => void
  toggleAllSelection: () => void
  /** <zh/> 反选当前页可见行 | <en/> Invert selection over visible rows */
  invertSelection: () => void
  selectAll: () => void
  setCurrentRow: (row: T) => void
  refreshSelection: () => void
  setSelection: (rows: T[], selected?: boolean) => void
  /**
   * <zh/> 当前页选中行——跨页保持下仅含本页行，全量键经 `getSelectedKeys()` / `selectionChange` 的 `meta.keys` 获取 | <en/> Current-page selected rows — under cross-page persistence only the current page; full keys via `getSelectedKeys()` / `selectionChange` meta.keys
   */
  getSelectedRows: () => T[]
  getCurrentRow: () => T | null
  initSelectionByKeys: (keys: (TableRowKey)[]) => void
  /**
   * <zh/> 全选全部筛选结果（跨页）——virtual 下表头全选即此语义；default 下请按需改用 `selectAllOnCurrentPage`
   * <en/> Select all filtered rows (cross-page) — this is the virtual-mode header select-all semantic; prefer `selectAllOnCurrentPage` under default mode
   */
  selectAllFiltered: () => void
  /**
   * <zh/> 取消全选全部筛选结果（跨页，与 `selectAllFiltered` 同作用域，不随模式变化）
   * <en/> Deselect all filtered rows (cross-page, same scope as `selectAllFiltered`, mode-independent)
   */
  deselectAllFiltered: () => void
  /**
   * <zh/> 全选当前页（恒为当前页，不随模式变化）——default 下表头全选即此语义
   * <en/> Select all rows on the current page (always the current page regardless of mode) — this is the default-mode header select-all semantic
   */
  selectAllOnCurrentPage: () => void
  /**
   * <zh/> 取消全选当前页（恒为当前页，与 `selectAllOnCurrentPage` 同作用域，不随模式变化）
   * <en/> Deselect all rows on the current page (always the current page, same scope as `selectAllOnCurrentPage`, mode-independent)
   */
  deselectAllOnCurrentPage: () => void
  deselectAll: () => void
  selectRowByKey: (key: TableRowKey, selected?: boolean) => void
  selectRowsByKeys: (keys: (TableRowKey)[], selected?: boolean) => void
  isSelectedByKey: (key: TableRowKey) => boolean
  getSelectedKeys: () => NormalizedRowKey[]
  getSelectedCount: () => number
  replaceSelection: (rows: T[]) => void
  forEachSelected: (callback: (row: T, key: string) => void) => void
  getSelectedIndices: () => number[]
  getQueryFormModel: () => Record<string, unknown>
  setQueryFormModel: (model: Record<string, unknown>) => void
  /** <zh/> 内部——搜索表单组件实例（跨组件联动用），外部请用 setQueryFormModel | <en/> Internal — search form instance (for cross-component wiring); external callers use setQueryFormModel */
  tableSearchRef: Ref<ComponentPublicInstance | null>
  /** <zh/> Excel 导出选项（精确已知字段 + 开放扩展，见 UseTableApiFeaturesOptions.exportExcel）。true=成功，false=被拦截或失败 | <en/> Excel export options (precise known fields + open extension, see UseTableApiFeaturesOptions.exportExcel). true = success, false = intercepted or failed */
  exportExcel: (options?: TableExportOptions<T> & Record<string, unknown>) => Promise<boolean>
  /** <zh/> CSV 导出选项（同上） | <en/> CSV export options (same as above) */
  exportCsv: (options?: TableExportCsvOptions<T> & Record<string, unknown>) => Promise<boolean>
  print: (options?: Partial<PrintConfig>) => Promise<void>
  triggerImport: () => void
  /** <zh/> 内部——导入进行中标记（按钮 loading 联动用），外部只读勿写 | <en/> Internal — import-in-flight flag (for button loading); external read-only */
  importing: Ref<boolean>
  setFilter: (columnKey: string, value: ColumnFilterValue) => void
  resetColumnFilter: (columnKey: string) => void
  resetAllFilters: () => void
  getFilterValue: (columnKey: string) => ColumnFilterValue | undefined
  isColumnFiltered: (columnKey: string) => boolean
  hasActiveFilter: Ref<boolean>
  hasActiveQuickFilter: Ref<boolean>
  setQuickFilter: (text: string) => void
  getQuickFilter: () => string
  toggleSort: (prop: string, event?: { shiftKey?: boolean }) => void
  setSort: (prop: string, order: SortOrder) => void
  setSorts: (sorts: Array<{ prop: string, order: SortOrder }>) => void
  clearSort: () => void
  getSortOrder: (prop: string) => SortOrder
  getSortIndex: (prop: string) => number
  startEditing: (params: { rowIndex: number, prop: string, columnKey: string, value: unknown }) => Promise<void>
  stopEditing: (reason: CellEditStopReason, commit?: boolean) => void
  /** <zh/> 更新编辑中单元格的值（挂载级真实改值入口） | <en/> Update the value of the cell being edited (mount-level real-mutation entry) */
  updateCellEditingValue: (columnKey: string, val: unknown) => void
  /** <zh/> 读取编辑中单元格的值 | <en/> Read the value of the cell being edited */
  getCellEditingValue: (columnKey: string) => unknown
  commitBatchEdit: () => Promise<void>
  cancelBatchEdit: () => void
  hasPendingChanges: Ref<boolean>
  batchHasPending: Ref<boolean>
  /** <zh/> 内部——批量暂存 Map（直接改写绕过校验入口；外部编排请走 commitBatchEdit/cancelBatchEdit） | <en/> Internal — batch staging Map (direct writes bypass validation; external orchestration use commitBatchEdit/cancelBatchEdit) */
  batchPendingChanges: Ref<Map<TableRowKey, Record<string, any>>>
  submitEdit: () => Promise<void>
  discardEdit: () => void
  getRowKey: (row: T) => string
  validate: () => Promise<boolean>
  /**
   * <zh/> 行级校验——`rowIndex` 必须为 renderData 域（`RenderDataIndex`）；visibleData 域索引须经 `toRenderDataIndex` 换算。
   * <en/> Row validation — `rowIndex` must be renderData-domain (`RenderDataIndex`); convert visibleData-domain indices via `toRenderDataIndex`.
   */
  validateRow: (rowIndex: number) => Promise<boolean>
  clearValidate: (target?: { rowIndex?: number, columnKey?: string }) => void
  showContextMenu: (params: ContextMenuParams<T>) => Promise<void>
  hideContextMenu: () => void
  undo: () => boolean
  redo: () => boolean
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  hasUnsavedChanges: () => boolean
  getColumnState: () => ColumnState[]
  applyColumnState: (state: ColumnState[] | null | undefined, options?: ApplyColumnStateOptions) => void
  resetColumnState: () => void
  /**
   * <zh/> 当前渲染域数据（renderData，Row Pinning 启用时已剔除 pinned 行）。
   * <zh/> 本接口已声明，`ref<TableExpose<T>>` 消费者类型层面可见。
   * <en/> Current render-domain data (renderData; pinned rows excluded when Row Pinning is on).
   * <en/> Declared in this interface, visible to `ref<TableExpose<T>>` consumers at the type level.
   */
  getRenderData: () => T[]
  /**
   * <zh/> 命名列视图——将列顺序/宽度/显隐/排序持久化为命名视图（localStorage 存储）。
   * <zh/> 本接口已声明（同 getRenderData）。
   * <en/> Named column views — persist column order/width/visibility/sort under a name
   * <en/> (localStorage-backed). Declared in this interface.
   */
  saveView: (name: string) => void
  /** <zh/> 应用命名视图（存在返回 true） | <en/> Apply a named view (true when it exists) */
  applyView: (name: string) => boolean
  /** <zh/> 列出已保存视图名 | <en/> List saved view names */
  getSavedViews: () => string[]
  /** <zh/> 删除命名视图（返回是否存在） | <en/> Delete a named view (true when it existed) */
  deleteView: (name: string) => boolean
  toggleTreeNodeExpand: (rowKey: TableRowKey) => void
  expandTreeNode: (rowKey: TableRowKey) => void
  collapseTreeNode: (rowKey: TableRowKey) => void
  expandAllTreeNodes: () => void
  collapseAllTreeNodes: () => void
  getTreeMeta: (row: any) => TreeRowMeta | undefined
  toggleDetailRowExpand: (rowKey: TableRowKey) => void
  expandDetailRow: (rowKey: TableRowKey) => void
  collapseDetailRow: (rowKey: TableRowKey) => void
  expandAllDetailRows: () => void
  collapseAllDetailRows: () => void
  toggleGroupExpand: (groupValue: unknown, fieldIndex?: number) => void
  expandAllGroups: () => void
  collapseAllGroups: () => void
  /**
   * <zh/> 行固定域——本接口已声明，`ref<TableExpose<T>>` 消费者类型层面可见
   * <en/> Row pinning domain — declared in this interface, visible to `ref<TableExpose<T>>`
   * <en/> consumers at the type level
   */
  pinRow: (rowKey: TableRowKey, position: 'top' | 'bottom') => void
  /** <zh/> 解除行固定 | <en/> Unpin a row */
  unpinRow: (rowKey: TableRowKey) => void
  /** <zh/> 查询行是否固定 | <en/> Whether a row is pinned */
  isRowPinned: (rowKey: TableRowKey) => boolean
  /** <zh/> 清空全部固定行 | <en/> Clear all pinned rows */
  clearPinnedRows: () => void
  /**
   * <zh/> 滚动到指定行——参数为行键（rowKey 字符串）；
   * <zh/> align: 'auto'（默认，仅不可见时滚动）| 'start' | 'center' | 'end'
   * <en/> Scroll to a row — target is a row key (rowKey string);
   * <en/> align: 'auto' (default, scrolls only when out of view) | 'start' | 'center' | 'end'
   */
  scrollToRow: (target: ScrollTarget, options?: ScrollToRowOptions) => boolean
  /**
   * <zh/> 水平滚动到指定列——参数为列键（columnKey 字符串）；固定列恒可见直接返回 true
   * <en/> Scroll horizontally to a column — target is a column key (columnKey string); fixed columns are always visible (returns true)
   */
  scrollToColumn: (target: ScrollTarget) => boolean
  /**
   * <zh/> 透传 EP 原生行高重测（virtual 动态网格专用）——自定义 cell 异步撑高后调用，
   * <zh/> 清除 index 之后全部行的缓存行高并重排；不可用时返回 false
   * <en/> Pass-through EP native row-height reset (virtual dynamic grid only) — call after async
   * <en/> cell-content growth to drop cached heights after index and reflow; false when unavailable
   */
  resetAfterRowIndex: (index?: number, forceUpdate?: boolean) => boolean
  /**
   * <zh/> 便捷重测（virtual 动态网格专用）——`resetAfterRowIndex(index, true)`，默认从 0 行起全量重测
   * <en/> Convenience remeasure (virtual dynamic grid only) — `resetAfterRowIndex(index, true)`, resetting everything from row 0 by default
   */
  refreshVirtualRowHeight: (index?: number) => boolean
}

/**
 * <zh/> 仅域内使用、不进公开 expose 的内部成员（白名单差集）。
 * <zh/> 运行时剔除见 `AdvTable.vue`，契约闸门见 `__type-guards__/api-contract.keys.ts`。
 * <en/> Internal-only members excluded from the public expose (allow-list delta).
 */
export type InternalExposeKey = 'batchPendingChanges' | 'importing' | 'tableSearchRef'

export interface TableExpose<T> extends Omit<UseTableApiReturn<T>, InternalExposeKey> {
  version: string
  tableRootRef: Ref<HTMLElement | null>
}

/**
 * <zh/> 消费者侧组件实例类型：Vue 3 对 `defineExpose` 返回值使用 `proxyRefs`，
 * <zh/> 经模板 ref 拿到的实例顶层 Ref 已被解包——`table.value.loading` 是 `boolean` 而非 `Ref<boolean>`。
 * <zh/> 消费方请用 `ref<TableInstanceExpose<Row>>()` 标注；`TableExpose` 仅为编写侧形状
 * <zh/>（供 `defineExpose({...api} satisfies TableExpose<T>)` 锚定），不要直接用于标注模板 ref。
 * <en/> Consumer-side instance type: Vue 3 `proxyRefs`-unwraps top-level Refs from
 * <en/> `defineExpose`, so `table.value.loading` is a `boolean`, not a `Ref<boolean>`.
 * <en/> Annotate template refs with `ref<TableInstanceExpose<Row>>()`; `TableExpose` is the
 * <en/> authoring shape only (anchoring `defineExpose({...api} satisfies TableExpose<T>)`).
 */
export type TableInstanceExpose<T = any> = ShallowUnwrapRef<TableExpose<T>>

/**
 * <zh/> AdvTable 表格 API 聚合 composable——将列、选择、功能、编辑、右键菜单、滚动、持久化等
 * <zh/> 15 个 API 分组合并为组件 `defineExpose` 所需的统一 API 对象。
 * <en/> Aggregated table API composable for AdvTable — merges 15 API groups (columns, selection, features,
 * <en/> editing, context menu, scrolling, persistence, etc.) into the unified API object exposed via `defineExpose`.
 *
 * @param options - <zh/> 各 API 分组的组合依赖与配置 getter | <en/> Composition deps and config getters of the API groups
 * @returns <zh/> 合并后的表格公共 API 对象 | <en/> The merged public table API object
 */
export function useTableApi<T>(options: UseTableApiOptions<T>): UseTableApiReturn<T> {
  const { dataColumns: dc, selection: sel, features: feat, sharedEditing: edit, contextMenu: ctx, scroll, rowHeight, getRowKey, setQuickFilter, getQuickFilter, persistence } = options

  /**
   * <zh/> 对象式单形态——解构后调用内部 4 参实现
   * <en/> Object-only single form — destructured onto the internal 4-param implementation
   */
  function toggleRowSelectionApi(row: T, options?: ToggleRowSelectionOptions): void {
    const { selected, ignoreSelectable, ...rest } = options ?? {}
    sel.selectionState.toggleRowSelection(row, selected, ignoreSelectable, rest)
  }

  /**
   * <zh/> 对象式单形态——直达编辑链（返回 promise：首调用含编辑链加载，await 后会话必已打开）
   * <en/> Object-only single form — straight through to the editing chain (returns a promise: the first call includes chain load; the session is open once awaited)
   */
  function startEditingApi(params: { rowIndex: number, prop: string, columnKey: string, value: any }): Promise<void> {
    return edit.startEditing(params) as Promise<void>
  }

  const dataAndPaginationApi = {
    refresh: dc.refresh,
    loading: dc.loading,
    setLoading: dc.setLoading,
    setResponseData: dc.setResponseData,
    getPagination: dc.getPagination,
    // <zh/> 对外 API 名保持 `setCurrentPage`（公开契约），内部走副作用版显式命名
    // <en/> Public API keeps the `setCurrentPage` name (public contract), wired to the explicitly-named effect version
    // <zh/> 对外 API 名保持 `setPageSize`（公开契约），内部走副作用版显式命名
    // <en/> Public API keeps the `setPageSize` name (public contract), wired to the explicitly-named effect version
    setCurrentPage: dc.setCurrentPageAndRefetch,
    setPageSize: dc.setPageSizeAndRefetch,
    getFullData: dc.getFullData,
    getRenderData: dc.renderData,
    applyTransaction: dc.applyTransaction,
    rollbackLast: dc.rollbackLast,
    getCurrentPageData: sel.getCurrentPageData,
  }

  const selectionApi = {
    clearSelection: sel.selectionState.clearSelection,
    toggleRowSelection: toggleRowSelectionApi,
    toggleAllSelection: sel.toggleAllSelection,
    // <zh/> 反选——实现在选择编排器（持有 visibleData 与 selectionState） | <en/> invert — implemented in the selection orchestrator (owns visibleData & selectionState)
    invertSelection: sel.invertSelection,
    selectAll: sel.selectAll,
    setCurrentRow: sel.setCurrentRow,
    refreshSelection: sel.refreshSelection,
    setSelection: sel.selectionState.setSelection,
    getSelectedRows: sel.selectionState.getSelectedRows,
    getCurrentRow: sel.getCurrentRow,
    initSelectionByKeys: sel.selectionState.initSelectionByKeys,
    selectAllFiltered: sel.selectAllFiltered,
    deselectAllFiltered: sel.deselectAllFiltered,
    selectAllOnCurrentPage: sel.selectAllOnCurrentPage,
    deselectAllOnCurrentPage: sel.deselectAllOnCurrentPage,
    deselectAll: sel.selectionState.clearSelection,
    selectRowByKey: sel.selectionState.selectRowByKey,
    selectRowsByKeys: sel.selectionState.selectRowsByKeys,
    isSelectedByKey: sel.selectionState.isSelectedByKey,
    getSelectedKeys: sel.selectionState.getSelectedKeys,
    getSelectedCount: sel.selectionState.getSelectedCount,
    replaceSelection: sel.selectionState.replaceSelection,
    forEachSelected: sel.selectionState.forEachSelected,
    getSelectedIndices: sel.getSelectedIndices,
  }

  const searchApi = {
    getQueryFormModel: feat.getQueryFormModel,
    setQueryFormModel: feat.setQueryFormModel,
    tableSearchRef: feat.tableSearchRef,
  }

  const exportImportApi = {
    exportExcel: feat.exportExcel,
    exportCsv: feat.exportCsv,
    print: feat.print,
    triggerImport: feat.triggerImport,
    importing: feat.importing,
  }

  const filterApi = {
    setFilter: dc.setFilter,
    resetColumnFilter: dc.resetColumnFilter,
    resetAllFilters: dc.resetAllFilters,
    getFilterValue: dc.getFilterValue,
    isColumnFiltered: dc.isColumnFiltered,
    hasActiveFilter: dc.hasActiveFilter,
    hasActiveQuickFilter: dc.hasActiveQuickFilter,
    setQuickFilter,
    getQuickFilter,
  }

  const sortApi = {
    toggleSort: dc.toggleSort,
    setSort: dc.setSort,
    setSorts: dc.setSorts,
    clearSort: dc.clearSort,
    getSortOrder: dc.getSortOrder,
    getSortIndex: dc.getSortIndex,
  }

  const editApi = {
    startEditing: startEditingApi,
    stopEditing: edit.stopEditing,
    updateCellEditingValue: edit.updateCellEditingValue,
    getCellEditingValue: edit.getCellEditingValue,
    commitBatchEdit: edit.commitBatchEdit,
    cancelBatchEdit: edit.cancelBatchEdit,
    hasPendingChanges: edit.hasPendingChanges,
    batchHasPending: edit.batchHasPending,
    batchPendingChanges: edit.batchPendingChanges,
    submitEdit: edit.submitEdit,
    discardEdit: edit.discardEdit,
    getRowKey,
  }

  const validationApi = {
    validate: edit.validate,
    validateRow: edit.validateRow,
    clearValidate: edit.clearValidate,
  }

  const contextMenuApi = {
    showContextMenu: ctx.showContextMenu,
    hideContextMenu: ctx.hideContextMenu,
  }

  const undoRedoApi = {
    undo: edit.undo,
    redo: edit.redo,
    canUndo: edit.canUndo,
    canRedo: edit.canRedo,
    hasUnsavedChanges: edit.hasUnsavedChanges,
  }

  const columnStateApi = {
    getColumnState: dc.getColumnState,
    applyColumnState: dc.applyColumnState,
    resetColumnState: dc.resetColumnState,
  }

  /**
   * <zh/> 命名视图预设——独立功能域（自带 cache/代际/适配器链），此处只做装配 spread。
   * <en/> Named view presets — an independent feature domain (own cache/generation/adapter chain);
   * <en/> this site only assembles the spread.
   */
  const viewPresetsApi = useNamedViews({
    tableId: options.tableId,
    persistence: computed(() => persistence?.value),
    getColumnState: dc.getColumnState,
    applyColumnState: dc.applyColumnState,
  })

  const treeExpandApi = {
    toggleTreeNodeExpand: dc.treeApi.toggleRowExpand,
    expandTreeNode: dc.treeApi.expandRow,
    collapseTreeNode: dc.treeApi.collapseRow,
    expandAllTreeNodes: dc.treeApi.expandAll,
    collapseAllTreeNodes: dc.treeApi.collapseAll,
    getTreeMeta: dc.treeApi.getTreeMeta,
  }

  const rowExpandApi = {
    toggleDetailRowExpand: dc.rowExpandApi.toggleRowExpand,
    expandDetailRow: dc.rowExpandApi.expandDetailRow,
    collapseDetailRow: dc.rowExpandApi.collapseDetailRow,
    expandAllDetailRows: dc.rowExpandApi.expandAllDetailRows,
    collapseAllDetailRows: dc.rowExpandApi.collapseAllDetailRows,
  }

  const groupExpandApi = {
    toggleGroupExpand: dc.rowGroupApi.toggleGroupExpand,
    expandAllGroups: dc.rowGroupApi.expandAllGroups,
    collapseAllGroups: dc.rowGroupApi.collapseAllGroups,
  }

  const rowPinApi = {
    pinRow: dc.rowPinApi.pinRow,
    unpinRow: dc.rowPinApi.unpinRow,
    isRowPinned: dc.rowPinApi.isRowPinned,
    clearPinnedRows: dc.rowPinApi.clearPinnedRows,
  }

  const scrollApi = {
    scrollToRow: scroll?.scrollToRow ?? (() => false),
    scrollToColumn: scroll?.scrollToColumn ?? (() => false),
  }

  const rowHeightApi = {
    resetAfterRowIndex: rowHeight?.resetAfterRowIndex ?? (() => false),
    refreshVirtualRowHeight: rowHeight?.refreshVirtualRowHeight ?? (() => false),
  }

  return markRawTyped({
    ...dataAndPaginationApi,
    ...selectionApi,
    ...searchApi,
    ...exportImportApi,
    ...filterApi,
    ...sortApi,
    ...editApi,
    ...validationApi,
    ...contextMenuApi,
    ...undoRedoApi,
    ...columnStateApi,
    ...viewPresetsApi,
    ...treeExpandApi,
    ...rowExpandApi,
    ...groupExpandApi,
    ...rowPinApi,
    ...scrollApi,
    ...rowHeightApi,
  })
}
