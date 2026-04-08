import type { ProcessedColumn } from './column'
import type { CellEditStopReason } from './edit'
import type { ColumnMode, DataMode } from './scope'
import type { SortOrder } from './sort'

/**
 * <zh/> 拦截器事件名联合类型 — 由 {@link InterceptorConfig} 的 keys 自动派成，禁止手工维护
 *
 * <zh/> 从 `keyof InterceptorConfig<any>` 自动派生，新增/删除拦截事件仅需修改 {@link InterceptorConfig}。
 *
 * <en/> Interceptor event name union — derived from {@link InterceptorConfig} keys, do not maintain by hand
 *
 * <en/> Derived from `keyof InterceptorConfig<any>`; adding/removing interceptors only
 * <en/> requires editing {@link InterceptorConfig}.
 */
export type InterceptorEvent = keyof InterceptorConfig<any>

/** <zh/> 键盘事件拦截参数 | <en/> Keyboard event interceptor params */
export interface InterceptorKeydownParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  rowData: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn
  /** <zh/> 当前列索引 | <en/> Current column index */
  columnIndex: number
  /** <zh/> 键盘事件对象 | <en/> Keyboard event object */
  event: KeyboardEvent
}

/** <zh/> 清空编辑拦截参数 | <en/> Clear-edit interceptor params */
export interface InterceptorClearEditParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 当前编辑字段属性名 | <en/> Property name of the field being edited */
  prop: string
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn
  /** <zh/> 停止编辑原因 | <en/> Reason for stopping editing */
  reason: CellEditStopReason
}

/** <zh/> 显示菜单拦截参数 | <en/> Show-menu interceptor params */
export interface InterceptorShowMenuParams<T = any> {
  /** <zh/> 菜单区域：表头 / 表体 / 表尾 | <en/> Menu area: header / body / footer */
  area: 'header' | 'body' | 'footer'
  /** <zh/> 仅 body 区域可用——当前行数据 | <en/> Available in the body area only — current row data */
  row?: T
  /** <zh/> 仅 body 区域可用——当前行索引 | <en/> Available in the body area only — current row index */
  rowIndex?: number
  /** <zh/> 当前列配置 | <en/> Current column config */
  column?: ProcessedColumn
  /** <zh/> 当前列索引 | <en/> Current column index */
  columnIndex?: number
  /** <zh/> 鼠标事件对象 | <en/> Mouse event object */
  event: MouseEvent
}

/** <zh/> 导出拦截参数 | <en/> Export interceptor params */
export interface InterceptorExportParams {
  /** <zh/> 导出文件名 | <en/> Export filename */
  filename?: string
  /** <zh/> 列模式：仅可见列 / 全部列 | <en/> Column mode: visible columns only / all columns */
  columnMode?: ColumnMode
  /** <zh/> 数据模式：全部数据 / 筛选后全量 / 当前页 / 选中行 | <en/> Data mode: all data / full filtered result / current page / selected rows */
  dataMode?: DataMode
}

/** <zh/> 单元格点击拦截参数 | <en/> Cell-click interceptor params */
export interface InterceptorCellClickParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  rowData: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn
  /** <zh/> 当前列索引 | <en/> Current column index */
  columnIndex: number
  /** <zh/> 点击事件对象 | <en/> Click event object */
  event: Event
}

/** <zh/> 行点击拦截参数 | <en/> Row-click interceptor params */
export interface InterceptorRowClickParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  rowData: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 点击事件对象 | <en/> Click event object */
  event: Event
}

/** <zh/> 表头点击拦截参数 | <en/> Header-click interceptor params */
export interface InterceptorHeaderClickParams {
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn
  /** <zh/> 当前列索引 | <en/> Current column index */
  columnIndex: number
  /** <zh/> 点击事件对象 | <en/> Click event object */
  event: Event
}

/** <zh/> 排序变更拦截参数 | <en/> Sort-change interceptor params */
export interface InterceptorSortChangeParams {
  /** <zh/> 排序字段属性名 | <en/> Property name of the sorted field */
  prop: string | null
  /** <zh/> 排序顺序 | <en/> Sort order */
  order: SortOrder
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn | undefined
  /** <zh/> 是否按住 Shift 多列排序 | <en/> Whether the Shift key is held for multi-column sorting */
  shiftKey: boolean
}

/** <zh/> 编辑开始拦截参数 | <en/> Edit-start interceptor params */
export interface InterceptorEditStartParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 当前编辑字段属性名 | <en/> Property name of the field being edited */
  prop: string
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn
  /** <zh/> 当前单元格原始值 | <en/> Original value of the current cell */
  value: unknown
}

/** <zh/> 编辑停止拦截参数 | <en/> Edit-stop interceptor params */
export interface InterceptorEditStopParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 当前编辑字段属性名 | <en/> Property name of the field being edited */
  prop: string
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn
  /** <zh/> 停止编辑原因 | <en/> Reason for stopping editing */
  reason: CellEditStopReason
}

/** <zh/> 编辑提交拦截参数 | <en/> Edit-commit interceptor params */
export interface InterceptorEditCommitParams<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 当前编辑字段属性名 | <en/> Property name of the field being edited */
  prop: string
  /** <zh/> 当前列配置；运行时可能为 undefined（外部触发编辑时） | <en/> current column config; may be undefined at runtime (e.g. edit triggered externally) */
  column: ProcessedColumn | undefined
  /** <zh/> 编辑前的旧值 | <en/> Old value before editing */
  oldValue: unknown
  /** <zh/> 编辑后的新值 | <en/> New value after editing */
  newValue: unknown
  /** <zh/> 提交编辑原因 | <en/> Reason for committing the edit */
  reason: CellEditStopReason
}

/** <zh/> 拦截器各事件载荷的联合类型 | <en/> Union of interceptor event payloads */
export type InterceptorHandlerParams<T = any>
  = | InterceptorKeydownParams<T>
    | InterceptorClearEditParams<T>
    | InterceptorShowMenuParams<T>
    | InterceptorExportParams
    | InterceptorCellClickParams<T>
    | InterceptorRowClickParams<T>
    | InterceptorHeaderClickParams
    | InterceptorSortChangeParams
    | InterceptorEditStartParams<T>
    | InterceptorEditStopParams<T>
    | InterceptorEditCommitParams<T>

/** <zh/> 拦截器处理函数，返回 false 可阻止默认行为 | <en/> Interceptor handler; returning false prevents the default behavior */
export type InterceptorHandler<T = any> = (params: T) => boolean | void

/**
 * <zh/> 拦截器槽位——单处理器或处理器数组。数组按注册序执行，首个返回 true 即截断（阻止后续操作），多插件可叠加。
 * <en/> Interceptor slot — a single handler or an array of handlers. Arrays run in registration order with first-true-wins truncation, so multiple plugins compose.
 */
export type InterceptorSlot<H extends InterceptorHandler<any>> = H | H[]

/**
 * <zh/> 槽位首参提取——数组形态下取元素函数的首参，供 trigger 签名使用。
 * <en/> Slot first-param extraction — takes the element function's first param under the array form, for trigger signatures.
 */
export type InterceptorSlotParams<E extends InterceptorEvent> = Parameters<Extract<NonNullable<InterceptorConfig[E]>, (...args: any[]) => any>>[0]

/** <zh/> 拦截器事件配置表（事件名 → 槽位） | <en/> Interceptor event config map (event name → slot) */
export interface InterceptorConfig<T = any> {
  /** <zh/> 键盘按键按下时触发 | <en/> Triggered when a keyboard key is pressed */
  'event.keydown'?: InterceptorSlot<InterceptorHandler<InterceptorKeydownParams<T>>>
  /** <zh/> 清空单元格编辑时触发 | <en/> Triggered when the cell edit is cleared */
  'event.clearEdit'?: InterceptorSlot<InterceptorHandler<InterceptorClearEditParams<T>>>
  /** <zh/> 右键菜单弹出前触发 | <en/> Triggered before the context menu pops up */
  'event.showMenu'?: InterceptorSlot<InterceptorHandler<InterceptorShowMenuParams<T>>>
  /** <zh/> 导出操作执行前触发 | <en/> Triggered before the export operation executes */
  'event.export'?: InterceptorSlot<InterceptorHandler<InterceptorExportParams>>
  /** <zh/> 单元格单击时触发 | <en/> Triggered on a cell single click */
  'event.cellClick'?: InterceptorSlot<InterceptorHandler<InterceptorCellClickParams<T>>>
  /** <zh/> 单元格双击时触发 | <en/> Triggered on a cell double click */
  'event.cellDblclick'?: InterceptorSlot<InterceptorHandler<InterceptorCellClickParams<T>>>
  /** <zh/> 行单击时触发 | <en/> Triggered on a row single click */
  'event.rowClick'?: InterceptorSlot<InterceptorHandler<InterceptorRowClickParams<T>>>
  /** <zh/> 表头单击时触发 | <en/> Triggered on a header single click */
  'event.headerClick'?: InterceptorSlot<InterceptorHandler<InterceptorHeaderClickParams>>
  /** <zh/> 排序变更时触发 | <en/> Triggered when the sort changes */
  'event.sortChange'?: InterceptorSlot<InterceptorHandler<InterceptorSortChangeParams>>
  /** <zh/> 单元格进入编辑状态时触发 | <en/> Triggered when a cell enters the editing state */
  'edit.start'?: InterceptorSlot<InterceptorHandler<InterceptorEditStartParams<T>>>
  /** <zh/> 单元格退出编辑状态时触发 | <en/> Triggered when a cell exits the editing state */
  'edit.stop'?: InterceptorSlot<InterceptorHandler<InterceptorEditStopParams<T>>>
  /** <zh/> 单元格编辑提交时触发 | <en/> Triggered when a cell edit is committed */
  'edit.commit'?: InterceptorSlot<InterceptorHandler<InterceptorEditCommitParams<T>>>
}
