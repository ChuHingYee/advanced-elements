import type { Component, DefineComponent } from 'vue'
import type { ProcessedColumn } from './column'
import type { AdvTableEmitsMap } from './table-emits'

/**
 * <zh/> 内置编辑器类型映射到 Element Plus 组件：
 * <en/> Built-in editor types mapped to Element Plus components:
 * <zh/>
 * - 'text' → ElInput
 * - 'number' → ElInputNumber
 * - 'select' → ElSelect + ElOption
 * - 'date' → ElDatePicker (type="date")
 * - 'datetime' → ElDatePicker (type="datetime")
 * - 'switch' → ElSwitch
 * - 'checkbox' → ElCheckbox
 * <en/>
 * - 'text' → ElInput
 * - 'number' → ElInputNumber
 * - 'select' → ElSelect + ElOption
 * - 'date' → ElDatePicker (type="date")
 * - 'datetime' → ElDatePicker (type="datetime")
 * - 'switch' → ElSwitch
 * - 'checkbox' → ElCheckbox
 *
 * <zh/> `(string & {})` 交叉类型允许任意字符串字面量，同时保留内置类型的自动补全。
 * <en/> The `(string & {})` intersection type allows arbitrary string literals while preserving autocomplete for built-in types.
 */
export type BuiltinCellEditorType
  = | 'text'
    | 'number'
    | 'select'
    | 'date'
    | 'datetime'
    | 'switch'
    | 'checkbox'

/**
 * <zh/> 单元格编辑器类型 — 内置编辑器类型或自定义字符串标识符。
 * <en/> Cell editor type — built-in editor type or custom string identifier.
 * <zh/> 内置编辑器由 BuiltinCellEditorType 枚举；自定义类型需通过
 * `registerCellEditor` 注册对应的组件后方可使用。
 * <en/> Built-in editors are enumerated by BuiltinCellEditorType; custom types must be registered
 * via `registerCellEditor` before use.
 */
export type CellEditorType = BuiltinCellEditorType | (string & {})

/**
 * <zh/> `cellEditorSelector` 的返回值 — 支持返回简单编辑器类型
 * <zh/> 或包含 component 和 params 的对象以获得更多控制。
 * <en/> Return value of `cellEditorSelector` — supports returning a simple editor type
 * or an object containing component and params for more control.
 *
 * @example
 * cellEditorSelector: ({ row }) => row.type === 'number' ? 'number' : 'text'
 * cellEditorSelector: ({ row }) => ({
 *   component: 'select',
 *   params: { options: row.type === 'country' ? countryOptions : cityOptions }
 * })
 */
export interface CellEditorSelectorResult {
  component: CellEditorType | string | Component
  /** <zh/> 覆盖此单元格的编辑器参数 | <en/> Overrides the editor params for this cell */
  params?: CellEditorParams | ((params: { row: any, rowIndex: number, column: any }) => CellEditorParams)
}

/**
 * <zh/> 传递给编辑器组件的参数
 * <zh/> 与 column.cellEditorParams 合并后作为 editorParams prop 传入。
 * <en/> Parameters passed to the editor component
 * Merged with column.cellEditorParams and passed in as the editorParams prop.
 */
export interface CellEditorParams {
  /** <zh/> 仅 'number' 编辑器有效 | <en/> Only for the 'number' editor */
  precision?: number
  /** <zh/> 仅 'number' 编辑器有效 | <en/> Only for the 'number' editor */
  step?: number
  /** <zh/> 仅 'number' 编辑器有效 | <en/> Only for the 'number' editor */
  min?: number
  /** <zh/> 仅 'number' 编辑器有效 | <en/> Only for the 'number' editor */
  max?: number
  /** <zh/> 仅 'select' 编辑器有效 | <en/> Only for the 'select' editor */
  options?: { label: string, value: any }[]
  filterable?: boolean
  multiple?: boolean
  placeholder?: string
  /** <zh/> 仅 'text' 编辑器有效 | <en/> Only for the 'text' editor */
  maxlength?: number
  /** <zh/> 仅 'text' 编辑器有效 | <en/> Only for the 'text' editor */
  textarea?: boolean
  /** <zh/> 是否使用弹窗模式展示编辑器 | <en/> Whether to show the editor in popup mode */
  popup?: boolean
  popupWidth?: number | string
  /** <zh/> 弹窗相对单元格的位置，默认 'over' | <en/> Popup position relative to cell, defaults to 'over' */
  popupPosition?: 'over' | 'under'
  /** <zh/> 透传给底层 Element Plus 组件的额外 props | <en/> Extra props passed through to the underlying Element Plus component */
  componentProps?: Record<string, any>
  /** <zh/> 仅 select 编辑器有效 | <en/> Only for the select editor */
  filterMethod?: 'contains' | 'startsWith' | 'exact'
}

/**
 * <zh/> 单元格编辑器校验规则
 * <zh/> 精神上类似 Element Plus Form 校验规则，但在单元格编辑器上下文中独立求值。
 * <en/> Cell editor validation rules
 * Spiritually similar to Element Plus Form validation rules, but evaluated independently in the cell editor context.
 */
export interface ColumnEditorRules {
  /** <zh/> true = 必填, string = 自定义消息 | <en/> true = required, string = custom message */
  required?: boolean | string
  min?: number | { value: number, message: string }
  max?: number | { value: number, message: string }
  minLength?: number | { value: number, message: string }
  maxLength?: number | { value: number, message: string }
  pattern?: RegExp | { regexp: RegExp, message: string }
  validator?: (value: any, rowData: any) => boolean | string | Promise<boolean | string>
  /**
   * <zh/> 校验触发时机（对标 Element Plus ElForm rules 的 trigger）
   * <en/> Validation trigger timing (mirrors Element Plus ElForm rules' trigger)
   * <zh/>
   * - 'blur': 编辑器失焦时校验（默认，与 ElForm 一致）
   * - 'change': 值变更时校验（select 切换、switch 翻转等）
   * - 'input': 每次输入时校验（实时反馈）
   * <en/>
   * - 'blur': validate on editor blur (default, same as ElForm)
   * - 'change': validate on value change (select switch, switch toggle, etc.)
   * - 'input': validate on every input (real-time feedback)
   */
  trigger?: 'blur' | 'change' | 'input'
}

/**
 * <zh/> 单元格编辑结束原因 — 描述退出编辑模式的触发方式。
 * <en/> Reason the cell edit ended — describes how edit mode was exited.
 * <zh/>
 * - 'tab': Tab 键导航到下一单元格
 * - 'enter': Enter 键提交并下移
 * - 'click': 点击其他单元格/区域
 * - 'escape': Escape 键取消编辑
 * - 'blur': 编辑器失去焦点
 * - 'api': 通过 API 编程式提交/取消
 * - 'validationFailed': 校验失败后自动关闭
 * - 'paste': 粘贴操作
 * - 'cut': 剪切操作
 * - 'home': Home 键导航
 * - 'end': End 键导航
 * - 'contextMenu': 右键菜单触发
 * <en/>
 * - 'tab': Tab key navigates to next cell
 * - 'enter': Enter key submits and moves down
 * - 'click': click other cell/area
 * - 'escape': Escape key cancels edit
 * - 'blur': editor loses focus
 * - 'api': programmatic submit/cancel via API
 * - 'validationFailed': auto-close after validation failure
 * - 'paste': paste operation
 * - 'cut': cut operation
 * - 'home': Home key navigation
 * - 'end': End key navigation
 * - 'contextMenu': right-click menu triggered
 */
export type CellEditStopReason = 'tab' | 'enter' | 'click' | 'escape' | 'blur' | 'api' | 'validationFailed' | 'paste' | 'cut' | 'home' | 'end' | 'contextMenu' | 'unmount'

/**
 * <zh/> 单元格级变更记录——提交结果对象中 applied/rejected 条目的公共形态
 * <en/> Cell-level change record — common shape of applied/rejected entries in commit results
 */
export interface CellChangeRecord {
  rowIndex: number
  prop: string
  columnKey: string
  oldValue: any
  newValue: any
  /** <zh/> 行唯一标识（rowKeyFn 可用时填充） | <en/> Row unique identifier (populated when rowKeyFn is available) */
  rowKey?: string | number
}

/**
 * <zh/> 变更被拒绝的原因分类
 * <zh/> - 'interceptor'：edit.commit 拦截器否决
 * <zh/> - 'setter-rejected'：列 valueSetter 拒写（返回 false）
 * <zh/> - 'validation'：editorRules 校验失败
 * <zh/> - 'persist-failed'：saveCells 悲观协议中持久化钩子失败，变更已回滚
 * <zh/> - 'concurrent-write'：回滚时该格已被并发写入覆盖，保留用户新值未还原
 * <en/> Rejection reason classification:
 * <en/> - 'interceptor': edit.commit interceptor veto
 * <en/> - 'setter-rejected': column valueSetter rejected the write (returned false)
 * <en/> - 'validation': editorRules validation failure
 * <en/> - 'persist-failed': saveCells pessimistic persist hook failed, changes rolled back
 * <en/> - 'concurrent-write': the cell was overwritten by a concurrent write during rollback; the user's newer value was kept
 */
export type CommitRejectReason = 'interceptor' | 'setter-rejected' | 'validation' | 'persist-failed' | 'concurrent-write'

/**
 * <zh/> 被拒绝的变更记录
 * <en/> Rejected change record
 *
 * <zh/> rejected = 拦截器拒 ∪ setter 拒写 ∪ 校验拒；值未变化的跳过不计入任何一侧
 * <en/> rejected = interceptor veto ∪ setter rejection ∪ validation failure; unchanged values are skipped and counted on neither side
 */
export interface CommitRejectedRecord extends CellChangeRecord {
  reason: CommitRejectReason
}

/**
 * <zh/> 提交结果对象——batchCommitCells / commitEditing / saveCells 的统一返回形态。
 * <zh/> 使调用方能感知部分成功（partial success）并按需自行补偿或回滚。
 * <en/> Commit result object — the uniform return shape of batchCommitCells / commitEditing / saveCells.
 * <en/> Lets callers perceive partial success and compensate or roll back as needed.
 */
export interface CommitResult {
  /** <zh/> 已成功应用到数据的变更 | <en/> Changes successfully applied to the data */
  applied: CellChangeRecord[]
  /** <zh/> 被拒绝的变更及其原因 | <en/> Rejected changes with reasons */
  rejected: CommitRejectedRecord[]
}

/**
 * <zh/> saveCells 持久化载荷——宿主据此落库；resolve 即确认，reject 或 resolve(false) 触发回滚
 * <en/> Persistence payload for saveCells — host persists it; resolving confirms, rejecting or resolving false triggers rollback
 */
export interface EditPersistPayload<T = any> {
  /** <zh/> 本次将应用的变更集 | <en/> The change set to be applied */
  changes: CellChangeRecord[]
  /** <zh/> 应用变更后的完整数据数组（copy-on-write 产物） | <en/> Full data array after applying (copy-on-write product) */
  newData: T[]
}

/**
 * <zh/> 单元格校验错误信息结构
 * <zh/> 当编辑器校验失败时，返回此结构的错误描述，
 * <zh/> 用于在 UI 上展示错误提示或在事件回调中处理。
 * <en/> Cell validation error info structure
 * When editor validation fails, returns an error description of this structure,
 * used to display error hints on the UI or handle in event callbacks.
 */
export interface ValidateError {
  rowIndex: number
  /**
   * <zh/> 行唯一标识，排序/筛选/分页后仍可定位行 | <en/> Row unique identifier, still locates the row after sort/filter/pagination
   * <zh/> 当 rowKeyFn 可用时由校验器填充，消费侧优先用此字段查找 | <en/> Populated by the validator when rowKeyFn is available; callers should prefer this field for lookup
   */
  rowKey?: string | number
  columnKey: string
  prop: string
  message: string
}

/**
 * <zh/> 编辑器生命周期钩子
 * <zh/> 自定义编辑器组件可选择实现这些方法
 * <en/> Editor lifecycle hooks
 * Custom editor components may optionally implement these methods
 */
export interface CellEditorLifecycle {
  /** <zh/> 编辑器挂载后调用。返回 true 取消编辑 | <en/> Called after editor mounts. Return true to cancel edit */
  isCancelBeforeStart?: () => boolean
  /** <zh/> 提交前调用。返回 true 取消提交（值将回退） | <en/> Called before submit. Return true to cancel submit (value will revert) */
  isCancelAfterEnd?: () => boolean
}

/**
 * <zh/> 表格级别编辑配置
 * <en/> Table-level edit configuration
 *
 * <zh/> 编辑模式关系矩阵：
 * <en/> Edit mode relationship matrix:
 * | editType    | 数据写入 | 事件回调           | 提交API            | 取消API            |
 * |-------------|---------|-------------------|-------------------|-------------------|
 * | undefined   | 直接写入 direct write  | cellValueChanged  | commitEditing     | cancelEditing     |
 * | 'fullRow'   | 直接写入 direct write  | fullRowEdit       | commitEditing     | cancelEditing     |
 * | 'batch'     | 缓冲写入 buffered write | onBatchRecordChange | commitBatchEdit | cancelBatchEdit   |
 * | 'readOnly'  | 不写入 no write    | cellEditRequest   | commitEditing     | cancelEditing     |
 */
export interface EditConfig {
  editType?: 'fullRow' | 'batch' | 'readOnly'

  /**
   * <zh/> 单表编辑器覆盖——仅作用于当前表格实例，不写入全局注册表；
   * <zh/> 字符串编辑器解析时优先级最高（单表 > 内置 > 全局自定义），缺省时走存量解析链。
   * <en/> Per-table editor overrides — scoped to this table instance only, never touches the global registry;
   * <en/> highest priority for string editor resolution (per-table > built-in > global custom), legacy chain when absent.
   * @example
   * ```ts
   * // <zh/> 单表定制 'my-date'，不污染其他表格 | <en/> Per-table 'my-date' without polluting other tables
   * { editors: { 'my-date': MyDateEditor } }
   * ```
   */
  editors?: Record<string, Component>

  /**
   * <zh/> 悲观提交持久化钩子（opt-in）——配置后 saveCells 启用悲观协议：
   * <zh/> 本地先行应用变更，随后 await 此钩子落库；钩子 reject 或 resolve(false) 时
   * <zh/> 自动还原快照并派发 TABLE_EDIT_ROLLBACK 错误事件，且本次操作不入撤销栈。
   * <en/> Pessimistic commit persistence hook (opt-in) — when configured, saveCells enables the
   * <en/> pessimistic protocol: changes apply locally first, then this hook persists them;
   * <en/> on rejection or resolve(false), the snapshot is auto-restored, TABLE_EDIT_ROLLBACK
   * <en/> is dispatched, and the operation never enters the undo stack.
   */
  onPersist?: (payload: EditPersistPayload) => Promise<void> | void | boolean

  /**
   * <zh/> 撤销/重做遇到无法应用条目（如 rowKey 未命中、行已删除）时的策略：
   * <zh/> - 'skip'（默认）：丢弃该条目并继续尝试下一条，死条目不得永久阻塞栈顶
   * <zh/> - 'block'：保留条目并中止本次 undo/redo（供需要显式提示用户的宿主选择）
   * <en/> Strategy when undo/redo hits an inapplicable entry (rowKey miss, row deleted, setter rejected):
   * <en/> - 'skip' (default): drop the entry and keep trying the next one — a dead entry must never
   * <en/>   block the stack top forever
   * <en/> - 'block': keep the entry and abort this undo/redo call (for hosts
   * <en/>   that want to prompt the user explicitly)
   */
  undoFailureStrategy?: 'skip' | 'block'

  /**
   * <zh/> 撤销/重做栈最大深度，默认 50；超出后最旧条目被淘汰（FIFO）。
   * <en/> Maximum undo/redo stack depth, default 50; oldest entries are evicted beyond the limit (FIFO).
   */
  undoMaxStackSize?: number

  /**
   * <zh/> 点击单元格外部区域时是否结束编辑（默认 false：保持编辑状态，仅 fullRow 模式恒定结束）。
   * <zh/> true 时外部点击提交当前编辑（走 stopEditing('blur', commit=true)）。
   * <en/> Whether clicking outside the cell ends editing (default false: editing is kept; fullRow mode always ends it).
   * <en/> When true, an outside click commits the active edit via stopEditing('blur', commit=true).
   */
  stopEditingWhenCellsLoseFocus?: boolean

  /** <zh/> 默认 false（需双击） | <en/> Defaults to false (double-click required) */
  singleClickEdit?: boolean

  /** <zh/> @see editType 需配合编辑模式使用才生效 | <en/> @see editType must be used with an edit mode to take effect */
  enterMovesDownAfterEdit?: boolean

  /**
   * <zh/> Tab 在可编辑单元格之间导航
   * <en/> Tab navigates between editable cells
   * <zh/>
   * - true: Tab/Shift+Tab 水平导航
   * - undefined / false: Tab 仅提交当前编辑
   * - 函数: 自定义导航目标，返回 null 表示不导航
   * <en/>
   * - true: Tab/Shift+Tab horizontal navigation
   * - undefined / false: Tab only submits current edit
   * - function: custom navigation target, return null means no navigation
   * <zh/> @see editType 需配合编辑模式使用才生效
   * <en/> @see editType must be used with an edit mode to take effect
   */
  tabToNextCell?: boolean | ((params: {
    rowIndex: number
    columnKey: string
    direction: 'next' | 'previous'
  }) => { rowIndex: number, columnKey: string, prop: string } | null)

  /**
   * <zh/> 返回 false 阻止单元格进入编辑模式
   * <en/> Return false to prevent the cell from entering edit mode
   */
  activeMethod?: (params: { row: any, rowIndex: number, column: any, prop: string }) => boolean

  /**
   * <zh/> 校验失败时的处理模式
   * <en/> Handling mode on validation failure
   * <zh/>
   * - 'revert': 回退到原始值
   * - 'block': 编辑器保持打开，阻止其他编辑操作（默认）
   * - 'notify': 显示错误但允许关闭编辑器
   * <en/>
   * - 'revert': revert to original value
   * - 'block': editor stays open, blocks other edit ops (default)
   * - 'notify': show error but allow closing the editor
   */
  invalidEditValueMode?: 'revert' | 'block' | 'notify'

  /** <zh/> F2 键触发编辑 @see editType 需配合编辑模式 | <en/> F2 key triggers edit @see editType must be used with an edit mode */
  enableCellEditingOnF2?: boolean

  /** <zh/> Backspace 键触发编辑 @see editType 需配合编辑模式 | <en/> Backspace key triggers edit @see editType must be used with an edit mode */
  enableCellEditingOnBackspace?: boolean

  /**
   * <zh/> Ctrl+C 复制，Ctrl+V 粘贴 TSV 数据，Ctrl+X 剪切
   * <en/> Ctrl+C copy, Ctrl+V paste TSV data, Ctrl+X cut
   * <zh/> @see editType 需配合编辑模式
   * <en/> @see editType must be used with an edit mode
   */
  enableClipboard?: boolean

  /**
   * <zh/> Ctrl+Z 撤销，Ctrl+Shift+Z 重做
   * <en/> Ctrl+Z undo, Ctrl+Shift+Z redo
   * <zh/> @see enableClipboard 需配合编辑模式
   * <en/> @see enableClipboard must be used with an edit mode
   */
  enableUndo?: boolean

  /**
   * <zh/> 编辑中的行/格添加 adv-table__cell--dirty CSS class
   * <en/> Add adv-table__cell--dirty CSS class to editing row/cell
   * <zh/> @see editType 需配合编辑模式
   * <en/> @see editType must be used with an edit mode
   */
  showStatus?: boolean

  /**
   * <zh/> 行级跨字段校验（仅 fullRow 模式生效）
   * <en/> Row-level cross-field validation (only effective in fullRow mode)
   */
  crossFieldValidator?: CrossFieldValidator<any>
}

/** <zh/> 行级跨字段校验上下文 | <en/> Row-level cross-field validation context */
export interface CrossFieldValidationContext<T = any> {
  values: Record<string, any>
  row: T
  rowIndex: number
}

/**
 * <zh/> 跨字段校验错误项
 * <en/> Cross-field validation error item
 * <zh/>
 * - string: 简单消息（关联到所有字段）
 * - { message, columnKey }: 结构化错误（仅关联到指定字段）
 * <en/>
 * - string: simple message (associated with all fields)
 * - { message, columnKey }: structured error (only associated with the specified field)
 */
export type CrossFieldError = string | { message: string, columnKey: string }

/** <zh/> 返回错误数组表示校验失败，返回 null/空数组表示通过 | <en/> Returning an error array means validation failed; null/empty array means passed */
export type CrossFieldValidator<T = any> = (
  ctx: CrossFieldValidationContext<T>,
) => CrossFieldError[] | null | Promise<CrossFieldError[] | null>

/** <zh/> 单元格编辑事件载荷 | <en/> Cell edit event payload */
export interface CellEditEvent<T = any> {
  row: T
  rowIndex: number
  prop: string
  column: ProcessedColumn | undefined
  oldValue: unknown
  newValue: unknown
  reason: CellEditStopReason
}

/**
 * <zh/> 单元格进入编辑模式时发出，在编辑器显示之前
 * <zh/> 单源派生自 {@link AdvTableEmitsMap}，避免与事件签名表 drift
 * <en/> Emitted when a cell enters edit mode, before the editor is shown
 * <en/> Single-sourced from {@link AdvTableEmitsMap} to avoid drift with the event signature map
 */
export type CellEditingStartedEvent<T = any> = AdvTableEmitsMap<T>['cellEditingStarted'][0]

/**
 * <zh/> 单元格退出编辑模式时发出，无论值是否变更
 * <zh/> 单源派生自 {@link AdvTableEmitsMap}，避免与事件签名表 drift
 * <en/> Emitted when a cell exits edit mode, regardless of whether the value changed
 * <en/> Single-sourced from {@link AdvTableEmitsMap} to avoid drift with the event signature map
 */
export type CellEditingStoppedEvent<T = any> = AdvTableEmitsMap<T>['cellEditingStopped'][0]

/**
 * <zh/> 只读编辑模式下用户提交编辑时发出
 * <zh/> 由父组件负责处理数据更新
 * <zh/> 单源派生自 {@link AdvTableEmitsMap}，避免与事件签名表 drift
 * <en/> Emitted when the user submits an edit in read-only edit mode
 * The parent component is responsible for handling the data update
 * <en/> Single-sourced from {@link AdvTableEmitsMap} to avoid drift with the event signature map
 */
export type CellEditingRequestEvent<T = any> = AdvTableEmitsMap<T>['cellEditingRequest'][0]

/**
 * <zh/> 每次全行编辑发出一个此事件，同时发出各个单元格的 cellValueChanged 事件
 * <zh/> 单源派生自 {@link AdvTableEmitsMap}，避免与事件签名表 drift
 * <en/> Emitted once per full-row edit, along with each cell's cellValueChanged event
 * <en/> Single-sourced from {@link AdvTableEmitsMap} to avoid drift with the event signature map
 */
export type FullRowEditEvent<T = any> = AdvTableEmitsMap<T>['fullRowEdit'][0]

/**
 * <zh/> 编辑器组件接口
 * <zh/> 所有内置和自定义单元格编辑器应符合此接口。
 * <zh/> 泛型参数 T 允许强类型行数据，默认 any。
 * <zh/> modelValue 类型由列编辑器运行时决定，使用 unknown 替代 any 强制消费方收窄。
 * <en/> Editor component interface
 * All built-in and custom cell editors should conform to this interface.
 * Generic parameter T allows strongly-typed row data, defaults to any.
 * The modelValue type is decided at runtime by the column editor; using unknown instead of any forces consumers to narrow.
 */
export interface CellEditorProps<T = any> {
  /** <zh/> 当前编辑值；类型由列编辑器运行时决定 | <en/> Current editing value; type decided at runtime by the column editor */
  modelValue: unknown
  /** <zh/> 当前行数据 | <en/> Current row data */
  row: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn
  /** <zh/> 编辑器参数（cellEditorParams 与选择器 params 合并后的结果） | <en/> Editor params (merged result of cellEditorParams and selector params) */
  editorParams: CellEditorParams
}

/**
 * <zh/> 编辑器组件必须暴露的方法
 * <en/> Methods the editor component must expose
 */
export interface CellEditorExpose {
  /** <zh/> 确保编辑器输入框获得焦点以便用户立即输入 | <en/> Ensure the editor input gets focus so the user can type immediately */
  focus: () => void
  /** <zh/> 在编辑结束时读取最终值，防止读取到过期值 | <en/> Read the final value at edit end, preventing stale value reads */
  getValue: () => any
  /** <zh/> 确保值通过校验后再提交编辑 | <en/> Ensure the value passes validation before submitting the edit */
  validate: () => boolean | string | Promise<boolean | string>
}

/**
 * <zh/> 通过 `registerCellEditor` 注册的组件应满足此类型
 * <en/> Components registered via `registerCellEditor` should satisfy this type
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import type { CellEditorProps, CellEditorExpose } from '../types/edit'
 * const props = defineProps<CellEditorProps>
 * const emit = defineEmits<{ 'update:modelValue': [value: any] }>
 * defineExpose<CellEditorExpose>({ focus, getValue, validate })
 * </script>
 * ```
 */
export type EditorComponent = DefineComponent<
  CellEditorProps,
  CellEditorExpose,
  any
>

/** <zh/> 当前正在编辑的单元格状态 | <en/> State of the cell currently being edited */
export interface EditingCellState {
  /** <zh/> 正在编辑的行索引 | <en/> Index of the row being edited */
  rowIndex: number
  /** <zh/> 正在编辑的列键 | <en/> Key of the column being edited */
  columnKey: string
  /** <zh/> 正在编辑的字段属性名 | <en/> Property name of the field being edited */
  prop: string
  /** <zh/> 进入编辑时的原始值，用于回滚与 dirty 判定 | <en/> Original value when editing started, used for rollback and dirty checks */
  oldValue: any
}
