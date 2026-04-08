/**
 * <zh/> AdvTable 事件载荷类型定义
 *
 * <zh/> 本文件中的所有事件类型均从 {@link AdvTableEmitsMap}（types/table-emits.ts）派生，
 * <zh/> 不再手工维护字段定义。修改事件签名时只需更新 AdvTableEmitsMap，本文件自动同步。
 *
 * <en/> AdvTable event payload type definitions
 *
 * <en/> All event types in this file are derived from {@link AdvTableEmitsMap} (types/table-emits.ts).
 * <en/> No field definitions are maintained by hand — updating AdvTableEmitsMap automatically syncs this file.
 */
import type { AdvTableEmitsMap } from './table-emits'

// ─── 编辑事件（从 edit.ts 重导出，edit.ts 中已派生自 AdvTableEmitsMap 实现单源化）
// ─── Edit events (re-exported from edit.ts; edit.ts derives them from AdvTableEmitsMap for single-source)

export type {
  CellEditingRequestEvent,
  CellEditingStartedEvent,
  CellEditingStoppedEvent,
  CellEditStopReason,
  FullRowEditEvent,
} from './edit'

// ─── 行级事件载荷 | Row-level event payloads ───
// ─── 这些事件的 AdvTableEmitsMap 元组首元素是 params 对象，直接索引即可派生 ───

/** <zh/> 行点击事件载荷 | <en/> Row click event payload */
export type RowClickEvent<T = any> = AdvTableEmitsMap<T>['rowClick'][0]

/** <zh/> 行右键菜单事件载荷 | <en/> Row contextmenu event payload */
export type RowContextmenuEvent<T = any> = AdvTableEmitsMap<T>['rowContextmenu'][0]

/** <zh/> 行双击事件载荷 | <en/> Row double-click event payload */
export type RowDblclickEvent<T = any> = AdvTableEmitsMap<T>['rowDblclick'][0]

/** <zh/> 行拖拽开始事件载荷 | <en/> Row drag-start event payload */
export type RowDragStartEvent<T = any> = AdvTableEmitsMap<T>['rowDragStart'][0]

/** <zh/> 行拖拽结束事件载荷 | <en/> Row drag-end event payload */
export type RowDragEndEvent<T = any> = AdvTableEmitsMap<T>['rowDragEnd'][0]

// ─── 单元格事件载荷 | Cell-level event payloads ───

/** <zh/> 单元格点击事件载荷 | <en/> Cell click event payload */
export type CellClickEvent<T = any> = AdvTableEmitsMap<T>['cellClick'][0]

/** <zh/> 单元格双击事件载荷 | <en/> Cell double-click event payload */
export type CellDblclickEvent<T = any> = AdvTableEmitsMap<T>['cellDblclick'][0]

/** <zh/> 单元格右键菜单事件载荷 | <en/> Cell contextmenu event payload */
export type CellContextmenuEvent<T = any> = AdvTableEmitsMap<T>['cellContextmenu'][0]

/** <zh/> 鼠标进入单元格事件载荷 | <en/> Cell mouse-enter event payload */
export type CellMouseEnterEvent<T = any> = AdvTableEmitsMap<T>['cellMouseEnter'][0]

/** <zh/> 单元格值变更事件载荷 | <en/> Cell value change event payload */
export type CellValueChangedEvent<T = any> = AdvTableEmitsMap<T>['cellValueChanged'][0]

/** <zh/> 单元格聚焦事件载荷 | <en/> Cell focus event payload */
export type CellFocusedEvent<T = any> = AdvTableEmitsMap<T>['cellFocused'][0]

/**
 * <zh/> 单元格键盘事件载荷（统一 cellKeyDown / cellKeyPress / cellKeyUp 三者形状相同）
 * <en/> Cell keyboard event payload (unifies cellKeyDown / cellKeyPress / cellKeyUp — identical shape)
 */
export type CellKeyboardEvent<T = any> = AdvTableEmitsMap<T>['cellKeyDown'][0]

// ─── 表头事件载荷 | Header event payloads ───

/** <zh/> 表头点击事件载荷 | <en/> Header click event payload */
export type HeaderClickEvent<T = any> = AdvTableEmitsMap<T>['headerClick'][0]

/** <zh/> 表头右键菜单事件载荷 | <en/> Header contextmenu event payload */
export type HeaderContextmenuEvent<T = any> = AdvTableEmitsMap<T>['headerContextmenu'][0]

/** <zh/> 列宽拖拽调整结束事件载荷 | <en/> Column resize end event payload */
export type HeaderDragendEvent<T = any> = AdvTableEmitsMap<T>['headerDragend'][0]

// ─── 选择事件载荷 | Selection event payloads ───
// ─── 这些事件的 AdvTableEmitsMap 元组使用展开参数（非 params 对象），
// ─── 因此逐字段从元组索引派生，字段类型自动跟随 AdvTableEmitsMap 变更 ───

/** <zh/> 选择集合变更事件载荷 | <en/> Selection set change event payload */
export interface SelectionChangeEvent<T = any> {
  selection: AdvTableEmitsMap<T>['selectionChange'][0]
  tableId: AdvTableEmitsMap<T>['selectionChange'][1]
}

/** <zh/> 单选变更事件载荷 | <en/> Single-select change event payload */
export interface SelectEvent<T = any> {
  selection: AdvTableEmitsMap<T>['select'][0]['selection']
  row: AdvTableEmitsMap<T>['select'][0]['row']
  tableId: AdvTableEmitsMap<T>['select'][1]
}

/** <zh/> 全选 / 取消全选事件载荷 | <en/> Select-all / deselect-all event payload */
export interface SelectAllEvent<T = any> {
  selection: AdvTableEmitsMap<T>['selectAll'][0]
  tableId: AdvTableEmitsMap<T>['selectAll'][1]
}

/** <zh/> 行选中状态变更事件载荷 | <en/> Row selected state change event payload */
export interface RowSelectedEvent<T = any> {
  row: AdvTableEmitsMap<T>['rowSelected'][0]['row']
  selected: AdvTableEmitsMap<T>['rowSelected'][0]['selected']
  tableId: AdvTableEmitsMap<T>['rowSelected'][1]
}

// ─── 其他事件载荷 | Other event payloads ───

/** <zh/> 当前行切换事件载荷 | <en/> Current row change event payload */
export interface CurrentChangeEvent<T = any> {
  currentRow: AdvTableEmitsMap<T>['currentChange'][0]['currentRow']
  oldRow: AdvTableEmitsMap<T>['currentChange'][0]['oldRow']
  tableId: AdvTableEmitsMap<T>['currentChange'][1]
}

/** <zh/> 排序变更事件载荷 | <en/> Sort change event payload */
export type SortChangeEvent<T = any> = AdvTableEmitsMap<T>['sortChange'][0]

/** <zh/> 筛选变更事件载荷 | <en/> Filter change event payload */
export type FilterChangeEvent<T = any> = AdvTableEmitsMap<T>['filterChange'][0]

/** <zh/> 列可见性变更事件载荷 | <en/> Column visibility change event payload */
export type ColumnVisibleEvent<T = any> = AdvTableEmitsMap<T>['columnVisible'][0]

/** <zh/> 列顺序变更事件载荷 | <en/> Column order change event payload */
export type ColumnMovedEvent<T = any> = AdvTableEmitsMap<T>['columnMoved'][0]

/** <zh/> 数据变更事件载荷 | <en/> Data change event payload */
export type DataChangeEvent<T = any> = AdvTableEmitsMap<T>['dataChange'][0]

/** <zh/> 滚动事件载荷 | <en/> Scroll event payload */
export type ScrollEvent<T = any> = AdvTableEmitsMap<T>['scroll'][0]

// ─── 事件名与 emit 函数类型 | Event name & emit function types ───

/**
 * <zh/> AdvTable 全部事件名联合类型 — 由 {@link AdvTableEmitsMap} 自动推导，禁止手工维护
 *
 * <zh/> 泛型参数 T 允许语义化使用（如 `AdvTableEventName<UserRow>`），
 * <zh/> 默认 any。事件名集合本身不随 T 变化。
 *
 * <en/> Union type of all AdvTable event names — derived from {@link AdvTableEmitsMap}, do not maintain by hand
 *
 * <en/> Generic parameter T allows semantic usage (e.g. `AdvTableEventName<UserRow>`),
 * <en/> defaults to any. The event name set itself does not vary with T.
 */
export type AdvTableEventName<T = any> = keyof AdvTableEmitsMap<T>

/**
 * <zh/> AdvTable emit 函数类型 — 事件名受 {@link AdvTableEventName} 约束，避免拼写错误
 * <en/> AdvTable emit function type — event name is constrained by {@link AdvTableEventName} to prevent typos
 *
 * @remarks
 * <zh/> table.vue 中 defineEmits 返回的 emit 函数是按事件名分别签名的 intersection 类型，
 * <zh/> 传入 useAdvTable 时需使用双步断言 `emit as unknown as AdvTableEmitFn`
 * <zh/> （Vue 类型系统的限制，无法自动推断到本类型；避免直接 as any 以保留形状约束）。
 * <zh/> 注意：需要事件名→载荷关联约束的调用方请使用 `TableEmitter`
 * <zh/>（见 `utils/table-emitter.ts`，`OmitTableId` 去尾 + 泛型分发），本类型仅为与 Vue
 * <zh/> `defineEmits` 交集类型兼容的宽松原始通道；`...args: any[]` 为有意保留（各事件元组
 * <zh/> 尾部 tableId 在原始通道与代理通道中的有无不同，统一收窄会误伤 30+ 调用点）。
 * <en/> Note: callers needing event→payload correlation should use `TableEmitter`
 * <en/> (see `utils/table-emitter.ts`, `OmitTableId` tail-trim + generic dispatch); this type is
 * <en/> intentionally the loose raw channel compatible with Vue's `defineEmits` intersection.
 * <en/> `...args: any[]` is deliberate (the trailing tableId differs between raw and proxy
 * <en/> channels; unifying the narrowing would break 30+ call sites).
 * <zh/> 渲染器事件转发专用类型见 composables/rendering/use-table-renderer-events.ts 中的
 * <zh/> AdvTableForwardEmitFn（事件名收敛为 AdvTableForwardedEvent 子集、参数为 unknown[]），
 * <zh/> 三者职责不同，勿混用。
 *
 * <en/> The emit function returned by defineEmits in table.vue is an intersection type
 * <en/> with per-event signatures; passing it into useAdvTable requires the double-step
 * <en/> assertion `emit as unknown as AdvTableEmitFn` (a limitation of Vue's type system
 * <en/> that cannot infer this type automatically; avoid a direct `as any` to keep shape
 * <en/> constraints). The renderer-forwarding-specific type lives in
 * <en/> composables/rendering/use-table-renderer-events.ts (event names narrowed to the
 * <en/> AdvTableForwardedEvent subset, args as unknown[]) — the two have distinct roles.
 */
export type AdvTableEmitFn = (event: AdvTableEventName, ...args: any[]) => void
