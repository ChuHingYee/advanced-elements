import type { CellRangeSelection } from '../composables/interaction/use-cell-range-selection'
import type { SelectionChangeMeta } from '../composables/selection/selection-types'
import type { ProcessedColumn } from './column'
import type { ContextMenuClickEvent } from './context-menu'
import type { CellEditStopReason } from './edit'
import type { TableError } from './error'
import type { ColumnFilterValue } from './filter'
import type { TableRequestPayload } from './request'
/**
 * <zh/> AdvTable 事件签名表 — 作为 table.vue 的 defineEmits 与 composable 端类型的单一真相源
 *
 * <zh/> 本文件提供 AdvTableEmitsMap（type 别名）作为唯一的类型真相源，
 * <zh/> table.vue 的 defineEmits 与所有 composable 均直接引用本类型。
 * <zh/> AdvTableEventName 由本表通过 keyof 自动推导。
 *
 * <en/> AdvTable event signature map — single source of truth for table.vue's defineEmits and composable-side types
 *
 * <en/> This file provides AdvTableEmitsMap (type alias) as the sole type source of truth.
 * <en/> Both table.vue's defineEmits and all composables reference this type directly.
 * <en/> AdvTableEventName is derived from this map via keyof.
 */
import type { SortOrder, SortState } from './sort'

/**
 * <zh/> 单元格交互事件载荷——统一 cellClick / cellDblclick / cellContextmenu 的事件参数结构
 * <en/> Cell interaction event payload — unifies the parameter structure for cellClick / cellDblclick / cellContextmenu
 *
 * @remarks
 * <zh/> 该结构供 table-emits.ts、table-renderer.vue、table-virtual-renderer.vue 三处共用，
 * <zh/> 约束：字段变更必须三处同步，遗漏即口径分裂；共享类型单点维护。
 * <en/> This structure is shared by table-emits.ts, table-renderer.vue and table-virtual-renderer.vue.
 * <en/> Constraint: field changes must sync across all three, omission splits the contract; single-source maintenance via the shared type.
 */
export interface CellInteractionPayload<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  rowData: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn
  /** <zh/> 当前列索引 | <en/> Current column index */
  columnIndex: number
  /** <zh/> 原生事件对象 | <en/> Native event object */
  event: Event
}

/**
 * <zh/> AdvTable 全部事件的参数签名表 — table.vue defineEmits 与 composable 端的单一真相源
 * <zh/> - key 为事件名（camelCase）
 * <zh/> - value 为该事件的参数元组类型
 * <zh/> - 新增/删除事件只需修改本表，table.vue 的 defineEmits 与所有 composable 自动同步
 * <zh/> - 修改本表后，AdvTableEventName（types/events.ts）自动同步
 * <zh/> - 使用 type 别名（非 interface）以满足 Vue defineEmits 的 Record<string, unknown[]> 约束
 *
 * <en/> Parameter signature map for all AdvTable events — single source of truth for defineEmits and composables
 * <en/> - key: event name (camelCase)
 * <en/> - value: tuple type of that event's arguments
 * <en/> - adding/removing an event only requires editing this map; table.vue's defineEmits and all composables sync automatically
 * <en/> - after editing this map, AdvTableEventName (types/events.ts) syncs automatically
 * <en/> - uses type alias (not interface) to satisfy Vue defineEmits' Record<string, unknown[]> constraint
 */
export interface AdvTableEmitsMap<T = any> {
  /** <zh/> 分页变更事件 | <en/> Pagination change event */
  pageChange: [page: number, size: number, tableId: string]
  /** <zh/> 结构化错误事件 | <en/> Structured error event */
  error: [error: TableError, tableId: string]
  /** <zh/> 搜索查询事件 | <en/> Search query event */
  query: [params: Record<string, unknown>, tableId: string]
  /** <zh/> 搜索重置事件 | <en/> Search reset event */
  reset: [tableId: string]
  /** <zh/> 数据请求事件（手动请求模式时触发） | <en/> Data request event (triggered in manual request mode) */
  request: [payload: TableRequestPayload, tableId: string]
  /** <zh/> 强制刷新事件 | <en/> Force refresh event */
  refresh: [tableId: string]
  /**
   * <zh/> 选择项变更事件
   * <zh/> 单选/多选模式下，选中项变化时触发；`meta.keys` 为全量选中键（含跨页保持的他页键），跨页导出/提交请以它为准
   * <zh/> 订阅指南：单次行切换会连发 selectionChange + select + rowSelected——只关心结果集订本事件即可，三者全订会付三倍 handler 成本
   * <en/> Selection change event
   * <en/> Triggered when the selection changes in single/multi mode; `meta.keys` holds the full key set (including cross-page keys), use it for cross-page export/submit
   * <en/> Subscription guide: one row toggle fires selectionChange + select + rowSelected together — subscribe to this one only for the result set; subscribing to all three triples handler cost
   */
  selectionChange: [rows: T[], meta: SelectionChangeMeta, tableId: string]
  /**
   * <zh/> 行选中事件
   * <zh/> 与 {@link selectionChange} / {@link selectAll} / {@link rowSelected} 对称——末位独立参数为 `tableId`，便于多表场景区分事件来源。
   * <en/> Row select event
   * <en/> Symmetric with {@link selectionChange} / {@link selectAll} / {@link rowSelected} — the trailing `tableId` arg disambiguates event source in multi-table scenarios.
   */
  select: [payload: { selection: T[], row: T }, tableId: string]
  /**
   * <zh/> 全选事件
   * <zh/> 末位 `tableId` 与其他选择事件对称。
   * <en/> Select-all event
   * <en/> Trailing `tableId` mirrors other selection events.
   */
  selectAll: [selection: T[], tableId: string]
  /**
   * <zh/> 排序变更事件
   * <zh/> 末位 `tableId` 与其他事件对称。
   * <en/> Sort change event
   * <en/> Trailing `tableId` mirrors other events.
   */
  sortChange: [params: { sortState: SortState[], prop: string | null, order: SortOrder, column: ProcessedColumn | undefined, columns: (ProcessedColumn | undefined)[] }, tableId: string]
  /**
   * <zh/> 筛选变更事件——与 {@link sortChange} 对称的筛选状态通知。
   * <zh/> 内部筛选实质变更后发射（跳过初始化与 noop→真实 composable 升级等值替换）；
   * <zh/> 受控模式（传入 `filterModel`）下，消费方在监听器中回写等值模型会被内容等值守卫跳过，不形成回环。
   * <en/> Filter change event — filter-state notification symmetric with {@link sortChange}.
   * <en/> Fires after substantive internal filter changes (skips init and content-equal
   * <en/> noop→real composable upgrades); in controlled mode (`filterModel` provided), writing an
   * <en/> equal model back inside the listener is skipped by the content-equality guard — no loop.
   */
  filterChange: [params: { filterState: Record<string, ColumnFilterValue> }, tableId: string]
  /** <zh/> 行点击事件 | <en/> Row click event */
  rowClick: [params: { rowData: T, rowIndex: number, event: Event }, tableId: string]
  /** <zh/> 行右键菜单事件 | <en/> Row context-menu event */
  rowContextmenu: [params: { rowData: T, rowIndex: number, event: Event }, tableId: string]
  /** <zh/> 行双击事件 | <en/> Row double-click event */
  rowDblclick: [params: { rowData: T, rowIndex: number, event: Event }, tableId: string]
  /** <zh/> 当前行变更事件 | <en/> Current row change event */
  currentChange: [payload: { currentRow: T, oldRow: T | null }, tableId: string]
  /** <zh/> 鼠标进入单元格事件 | <en/> Cell mouse-enter event */
  cellMouseEnter: [params: { rowData: T, rowIndex: number, event?: Event }, tableId: string]
  /** <zh/> 鼠标离开单元格事件 | <en/> Cell mouse-leave event */
  cellMouseLeave: [tableId: string]
  /** <zh/> 单元格点击事件 | <en/> Cell click event */
  cellClick: [params: CellInteractionPayload<T>, tableId: string]
  /** <zh/> 单元格双击事件 | <en/> Cell double-click event */
  cellDblclick: [params: CellInteractionPayload<T>, tableId: string]
  /** <zh/> 单元格右键菜单事件 | <en/> Cell context-menu event */
  cellContextmenu: [params: CellInteractionPayload<T>, tableId: string]
  /** <zh/> 表头点击事件 | <en/> Header click event */
  headerClick: [params: { column: ProcessedColumn, columnIndex: number, event: Event }, tableId: string]
  /** <zh/> 表头右键菜单事件 | <en/> Header context-menu event */
  headerContextmenu: [params: { column: ProcessedColumn, columnIndex: number, event: Event }, tableId: string]
  /** <zh/> 列宽拖拽调整结束事件 | <en/> Column resize end event */
  headerDragend: [params: { column?: ProcessedColumn, columnIndex: number, newWidth: number, oldWidth: number, event: MouseEvent | KeyboardEvent }, tableId: string]
  /** <zh/> 表格滚动事件 | <en/> Table scroll event */
  scroll: [params: { scrollLeft: number, scrollTop: number }, tableId: string]
  /** <zh/> 数据变更事件（内部数据管线处理完成后触发）| <en/> Data change event (triggered after internal data pipeline completes) */
  dataChange: [params: { reason: string, data: T[] }, tableId: string]
  /**
   * <zh/> 数据变更前钩子——在数据写入 tableData 之前触发，**仅作通知，不可否决**。
   * <zh/> Vue SFC emit 返回 void，模板监听器的 `return false` 在生产环境不参与判定；
   * <zh/> 内部 `beforeHook` 注入点未暴露为公共 API，因此消费方没有可用的写入前否决通道。
   * <zh/> 需要校验请在调用 `applyTransaction` 前自行判断，或写入后用 `rollbackLast` 补偿。
   * <zh/> 适用场景：脏检查、权限校验、数据预处理器；大数据事务可经 silentMiddle 跳过本事件与 after。
   * <en/> Before-data-change hook — fired before write, **notification only, no veto**.
   * <en/> Vue SFC emit returns void, so a template listener's `return false` never participates in the
   * <en/> production decision; the internal `beforeHook` injection point is not part of the public API,
   * <en/> so consumers have no pre-write veto channel. Validate before calling `applyTransaction`, or
   * <en/> compensate after the write with `rollbackLast`.
   */
  beforeDataChange: [params: { reason: string, oldData: T[], newData: T[] }, tableId: string]
  /**
   * <zh/> 数据变更后钩子——在数据写入 tableData 并完成管线重算后触发
   * <zh/> 适用场景：数据审计日志、外部状态同步、派生数据更新
   * <en/> After-data-change hook — fired after data is written to tableData and the pipeline has recomputed
   * <en/> Use cases: data audit logging, external state sync, derived data updates
   */
  afterDataChange: [params: { reason: string, data: T[], oldData: T[] }, tableId: string]
  /** <zh/> 单元格值变更事件 | <en/> Cell value change event */
  cellValueChanged: [params: { row: T, rowIndex: number, prop: string, column: ProcessedColumn | undefined, oldValue: unknown, newValue: unknown, reason: CellEditStopReason }, tableId: string]
  /** <zh/> 单元格编辑开始事件 | <en/> Cell editing started event */
  cellEditingStarted: [params: { row: T, rowIndex: number, prop: string, column: ProcessedColumn | undefined, value: unknown }, tableId: string]
  /** <zh/> 单元格编辑结束事件 | <en/> Cell editing stopped event */
  cellEditingStopped: [params: { row: T, rowIndex: number, prop: string, column: ProcessedColumn | undefined, oldValue: unknown, newValue: unknown, reason: CellEditStopReason }, tableId: string]
  /** <zh/> 单元格编辑请求事件（click-to-edit 模式） | <en/> Cell editing request event (click-to-edit mode) */
  cellEditingRequest: [params: { row: T, rowIndex: number, prop: string, column: ProcessedColumn | undefined, oldValue: unknown, newValue: unknown, reason: CellEditStopReason }, tableId: string]
  /** <zh/> 整行编辑提交事件 | <en/> Full-row edit submit event */
  fullRowEdit: [params: { row: T, rowIndex: number, changes: { prop: string, column: ProcessedColumn | undefined, oldValue: unknown, newValue: unknown }[], reason: CellEditStopReason }, tableId: string]
  /**
   * <zh/> 编辑会话被取消事件——数据变化（排序/筛选/分页/外部替换）导致编辑行不可定位时派发。
   * <zh/> reason: 'row-deleted'（行被删除）| 'data-changed'（数据变更且行不可重定位）。
   * <en/> Cell editing session cancelled event — dispatched when the editing row can no longer be
   * <en/> located after a data change (sort/filter/pagination/external replacement).
   * <en/> reason: 'row-deleted' (the row was removed) | 'data-changed' (data changed and the row
   * <en/> could not be relocated).
   */
  cellEditingCancelled: [params: { reason: 'row-deleted' | 'data-changed' }, tableId: string]
  /** <zh/> 跨字段校验错误事件 | <en/> Cross-field validation error event */
  crossFieldValidateError: [params: { rowIndex: number, errors: string[] }, tableId: string]
  /** <zh/> 批量编辑待提交状态变化 | <en/> Batch-edit pending-submit state change */
  batchPendingChange: [hasPending: boolean, tableId: string]
  /**
   * <zh/> 行选中状态变更事件
   * <zh/> 末位 `tableId` 与其他选择事件对称。
   * <en/> Row selected state change event
   * <en/> Trailing `tableId` mirrors other selection events.
   */
  rowSelected: [payload: { row: T, selected: boolean }, tableId: string]
  /** <zh/> 模型更新完成事件（编辑提交后触发） | <en/> Model update complete event (triggered after edit submission) */
  modelUpdated: [tableId: string]
  /** <zh/> 表格初始化完成事件（渲染器挂载后触发） | <en/> Table init complete event (triggered after renderer mount) */
  gridReady: [tableId: string]
  /** <zh/> 列显隐变更事件 | <en/> Column show/hide change event */
  columnVisible: [payload: { columnKey: string, visible: boolean }, tableId: string]
  /** <zh/> 列拖动排序事件 | <en/> Column drag-sort event */
  columnMoved: [payload: { columns: ProcessedColumn[] }, tableId: string]
  /** <zh/> 行拖拽开始事件 | <en/> Row drag-start event */
  rowDragStart: [payload: { sourceRow: T, sourceIndex: number, event: DragEvent }, tableId: string]
  /** <zh/> 行拖拽结束事件（含放置目标信息） | <en/> Row drag-end event (includes drop target info) */
  rowDragEnd: [payload: { sourceRow: T, sourceIndex: number, targetRow: T | null, targetIndex: number, event: DragEvent }, tableId: string]
  /** <zh/> 单元格聚焦事件 | <en/> Cell focus event */
  cellFocused: [params: { rowData: T, rowIndex: number, column: ProcessedColumn, columnIndex: number, event: FocusEvent }, tableId: string]
  /** <zh/> 单元格键盘按下事件 | <en/> Cell key-down event */
  cellKeyDown: [params: { rowData: T, rowIndex: number, column: ProcessedColumn, columnIndex: number, event: KeyboardEvent }, tableId: string]
  /** <zh/> 单元格键盘按键事件 | <en/> Cell key-press event */
  cellKeyPress: [params: { rowData: T, rowIndex: number, column: ProcessedColumn, columnIndex: number, event: KeyboardEvent }, tableId: string]
  /** <zh/> 单元格键盘释放事件 | <en/> Cell key-up event */
  cellKeyUp: [params: { rowData: T, rowIndex: number, column: ProcessedColumn, columnIndex: number, event: KeyboardEvent }, tableId: string]
  /** <zh/> 右键菜单点击事件 | <en/> Context-menu click event */
  contextMenuClick: [params: ContextMenuClickEvent<T>, tableId: string]
  /** <zh/> 数据导入事件 | <en/> Data import event */
  dataImport: [params: { rows: T[], mode: 'append' | 'replace' }, tableId: string]
  /** <zh/> 单元格范围选择完成事件 | <en/> Cell range selection complete event */
  cellRangeSelected: [params: CellRangeSelection<T>, tableId: string]
  /** <zh/> 行展开事件 | <en/> Row expand event */
  rowExpand: [params: { row: T, rowKey: string | number, expanded: boolean }, tableId: string]
  /** <zh/> 行折叠事件 | <en/> Row collapse event */
  rowCollapse: [params: { row: T, rowKey: string | number }, tableId: string]
  /** <zh/> 搜索字段值变更事件（任意字段值变化时触发，不限于提交） | <en/> Search field value change event (triggered on any field change, not just submit) */
  searchChange: [payload: { key: string, val: unknown, formModel: Record<string, unknown> }, tableId: string]
  /** <zh/> 虚拟滚动到底部事件（仅 virtual 模式触发） | <en/> Virtual scroll end-reached event (virtual mode only) */
  endReached: [remainDistance: number, tableId: string]
  /** <zh/> 虚拟滚动行渲染完成事件（仅 virtual 模式触发） | <en/> Virtual scroll rows-rendered event (virtual mode only) */
  rowsRendered: [params: { rowCacheStart: number, rowCacheEnd: number, rowVisibleStart: number, rowVisibleEnd: number }, tableId: string]
}
