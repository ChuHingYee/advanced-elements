import type { ProcessedColumn } from '../types'
import type { BuiltinCellEditorType, CellEditStopReason, EditConfig } from '../types/edit'

/**
 * <zh/> 将编辑器发出的 reason 字符串映射为 CellEditStopReason。
 * <en/> Map the editor's emitted reason string to a CellEditStopReason.
 *
 * <zh/> 编辑器组件使用语义化 reason（如 'shift-tab'），而 composable 内部使用标准化的 CellEditStopReason 枚举。
 * <en/> Editor components emit semantic reasons (e.g. 'shift-tab'), while the composable internally uses the standardized CellEditStopReason enum.
 *
 * @example
 * mapEditorReasonToStopReason('shift-tab') // => 'tab'
 * mapEditorReasonToStopReason('enter')     // => 'enter'
 * mapEditorReasonToStopReason(undefined)   // => 'click'
 */
export function mapEditorReasonToStopReason(reason?: string): CellEditStopReason {
  if (!reason)
    return 'click'
  if (reason === 'tab' || reason === 'shift-tab')
    return 'tab'
  if (reason === 'enter')
    return 'enter'
  if (reason === 'escape')
    return 'escape'
  /**
   * <zh/> V2：编辑器因虚拟滚动行回收而卸载——提交但不触发导航（导航分支只认 tab/enter 原始 reason）。
   * <zh/> 约束：'unmount' 必须直达提交管线以支持降级取消；映射为 'click' 即丢失语义，block 校验拒绝 unmount 提交时
   * <zh/> 会留下无编辑器的 blocked 会话（死锁）。
   * <en/> V2: the editor unmounts due to virtual-scroll row recycling — commit without navigation
   * <en/> (the navigation branch only matches the raw tab/enter reasons). Constraint: 'unmount'
   * <en/> must reach the commit pipeline to support the cancel downgrade; mapping it to 'click'
   * <en/> loses the semantics and a block-mode validation rejection of an unmount commit leaves
   * <en/> a blocked session with no editor (deadlock).
   */
  if (reason === 'unmount')
    return 'unmount'
  return 'click'
}

/**
 * <zh/> 浅拷贝数组并在指定索引处替换目标行（避免 .map 遍历全量元素）。
 * <zh/> shallowRef 通过引用比较检测变更，新数组引用即可触发响应式更新。
 * <en/> Shallow-copy an array and replace the row at the given index (avoids .map traversing all elements).
 * <en/> shallowRef detects changes via reference comparison; a new array reference triggers reactive updates.
 */
export function replaceRowInArray<T>(data: T[], index: number, newRow: T): T[] {
  const newData = data.slice()
  newData[index] = newRow
  return newData
}

/**
 * <zh/> createStopEditingHandler 所需的最小编辑 API 子集，降低耦合度。
 * <en/> Minimal edit-API subset required by createStopEditingHandler, reducing coupling.
 */
interface StopEditingEditApi {
  /** <zh/> 停止编辑并传递停止原因和是否提交 | <en/> stop editing and pass the stop reason and whether to commit */
  stopEditing?: (reason: CellEditStopReason, commit?: boolean) => void
  /** <zh/> 查找下一个可编辑单元格（支持方向与垂直导航） | <en/> find the next editable cell (supports direction and vertical navigation) */
  findNextEditableCell?: (fromRowIndex: number, fromColumnKey: string, direction?: 'next' | 'previous', vertical?: boolean) => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 查找当前行第一个可编辑单元格 | <en/> find the first editable cell in the current row */
  findFirstEditableCell?: (rowIndex: number) => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 查找当前行最后一个可编辑单元格 | <en/> find the last editable cell in the current row */
  findLastEditableCell?: (rowIndex: number) => { rowIndex: number, columnKey: string, prop: string } | null
  /** <zh/> 启动编辑并传入行列定位参数 | <en/> start editing with the row/column location params */
  startEditing?: (params: { rowIndex: number, prop: string, columnKey: string, value: any }) => void
  /** <zh/> 当前编辑行索引（响应式 ref），用于判断全行编辑模式 | <en/> current editing-row index (reactive ref), used to detect whole-row edit mode */
  editingRowIndex?: { value: number | null | undefined }
}

/**
 * <zh/> 创建编辑停止处理器——统一 Tab/Enter/Home/End 导航逻辑，消除 normal-column.tsx 和 normal-v2-column.tsx 之间的重复导航代码。
 * <en/> Create the stop-editing handler — unifies Tab/Enter/Home/End navigation, removing duplicate navigation code between normal-column.tsx and normal-v2-column.tsx.
 *
 * <zh/> 根据不同的停止原因（reason）执行对应的导航行为：tab/shift-tab 横向跳格、enter 垂直跳格、home/end 行首/行尾、其他原因仅停止不导航。在全行编辑模式下返回 undefined，不处理 blur 停止逻辑。
 * <en/> Performs navigation by stop reason: tab/shift-tab move horizontally, enter moves vertically, home/end jump to row start/end, other reasons only stop without navigation. Returns undefined in whole-row edit mode, skipping blur-stop handling.
 *
 * @param params - <zh/> 处理器参数对象 | <en/> handler parameter object
 * @param params.editApi - <zh/> 编辑 API 子集，提供 stopEditing、导航查找、启动编辑等方法 | <en/> edit-API subset providing stopEditing, navigation lookup, startEditing, etc.
 * @param params.editConfig - <zh/> 编辑配置，控制 tabToNextCell / enterMovesDownAfterEdit 开关 | <en/> edit config controlling the tabToNextCell / enterMovesDownAfterEdit switches
 * @param params.rowIndex - <zh/> 当前编辑行索引 | <en/> current editing-row index
 * @param params.columnKey - <zh/> 当前编辑列的 key | <en/> current editing-column key
 * @param params.row - <zh/> 当前行数据，用于传递 value 到下一个编辑器 | <en/> current row data, used to pass value to the next editor
 * @returns <zh/> 停止编辑的回调函数 (commit, reason?) => void，或 undefined（全行编辑模式） | <en/> the stop-editing callback (commit, reason?) => void, or undefined (whole-row edit mode)
 *
 * @example
 * const handler = createStopEditingHandler({
 *   editApi,
 *   editConfig: props.editConfig,
 *   rowIndex: $index,
 *   columnKey: colKey,
 *   row,
 * })
 */
export function createStopEditingHandler(params: {
  editApi: StopEditingEditApi
  editConfig: EditConfig | undefined
  rowIndex: number
  columnKey: string
  row: Record<string, any>
}): ((commit: boolean, reason?: string) => void) | undefined {
  const { editApi, editConfig, rowIndex, columnKey, row } = params

  /** <zh/> 全行编辑模式下单个编辑器 blur 不触发 stopEditing，编辑结束由 header 按钮或程序化 stopEditing 控制 | <en/> In whole-row edit mode a single editor's blur does not trigger stopEditing; editing ends via the header button or programmatic stopEditing */
  if (editApi.editingRowIndex?.value != null)
    return undefined

  return (commit: boolean, reason?: string) => {
    const stopReason = mapEditorReasonToStopReason(reason)
    editApi.stopEditing?.(stopReason, commit)

    if (!commit || !editApi.findNextEditableCell || !editApi.startEditing)
      return

    const isTab = reason === 'tab' || reason === 'shift-tab'
    const isEnter = reason === 'enter'

    if (isTab && editConfig?.tabToNextCell) {
      const next = editApi.findNextEditableCell(
        rowIndex,
        columnKey,
        reason === 'shift-tab' ? 'previous' : 'next',
        false,
      )
      if (next) {
        editApi.startEditing({
          rowIndex: next.rowIndex,
          prop: next.prop,
          columnKey: next.columnKey,
          value: row[next.prop as string],
        })
      }
    }
    else if (isEnter && editConfig?.enterMovesDownAfterEdit) {
      const next = editApi.findNextEditableCell(rowIndex, columnKey, 'next', true)
      if (next) {
        editApi.startEditing({
          rowIndex: next.rowIndex,
          prop: next.prop,
          columnKey: next.columnKey,
          value: row[next.prop as string],
        })
      }
    }
    else if (reason === 'home' && editApi.findFirstEditableCell) {
      const target = editApi.findFirstEditableCell(rowIndex)
      if (target) {
        editApi.startEditing({
          rowIndex: target.rowIndex,
          prop: target.prop,
          columnKey: target.columnKey,
          value: row[target.prop as string],
        })
      }
    }
    else if (reason === 'end' && editApi.findLastEditableCell) {
      const target = editApi.findLastEditableCell(rowIndex)
      if (target) {
        editApi.startEditing({
          rowIndex: target.rowIndex,
          prop: target.prop,
          columnKey: target.columnKey,
          value: row[target.prop as string],
        })
      }
    }
  }
}

/**
 * <zh/> 解析单元格编辑值：存在列级 valueParser 时交由业务转换，否则原样透传。纯函数，供单格提交 / 整行提交 / 批量提交三处复用，避免值解析逻辑发散与行为不一致。
 * <en/> Parse a cell edit value: when a column-level valueParser exists it is delegated to the business transform, otherwise the value passes through as-is. A pure function reused by single-cell / whole-row / batch commit to avoid diverging parse logic and inconsistent behavior.
 *
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 * @param column - <zh/> 目标列配置（含可选 valueParser） | <en/> target column config (with optional valueParser)
 * @param ctx - <zh/> 解析上下文：行数据、行索引、原始输入值、旧值 | <en/> parse context: row data, row index, raw input value, old value
 * @param ctx.row - <zh/> 行数据 | <en/> row data
 * @param ctx.rowIndex - <zh/> 行索引 | <en/> row index
 * @param ctx.newValue - <zh/> 原始输入值 | <en/> raw input value
 * @param ctx.oldValue - <zh/> 旧值 | <en/> old value
 * @returns <zh/> 解析后的新值 | <en/> parsed new value
 */
export function parseCellEditValue<T>(
  column: ProcessedColumn,
  ctx: { row: T, rowIndex: number, newValue: unknown, oldValue: unknown },
): unknown {
  return column.valueParser
    ? column.valueParser({ row: ctx.row, column, rowIndex: ctx.rowIndex, newValue: ctx.newValue, oldValue: ctx.oldValue })
    : ctx.newValue
}

/**
 * <zh/> dirtyCells 键分隔符——使用 \u0001（SOH）避免与 rowKey / columnKey 中的常规字符冲突。dirtyCells 以 `${rowKey}${DIRTY_KEY_SEP}${columnKey}` 为键，确保排序/筛选/分页后脏标记跟随物理行而非可见索引。
 * <en/> dirtyCells key separator — uses \u0001 (SOH) to avoid colliding with regular characters in rowKey / columnKey. dirtyCells keys as `${rowKey}${DIRTY_KEY_SEP}${columnKey}`, so after sort/filter/pagination the dirty mark follows the physical row rather than the visible index.
 */
export const DIRTY_KEY_SEP = '\u0001'

//  Editor inference (merged from editor-inference.ts)

const VALUE_TYPE_TO_EDITOR: Record<string, BuiltinCellEditorType> = {
  text: 'text',
  textarea: 'text',
  money: 'number',
  digit: 'number',
  percent: 'number',
  date: 'date',
  dateTime: 'datetime',
  select: 'select',
  radio: 'select',
  checkbox: 'checkbox',
  switch: 'switch',
}

/** <zh/> 根据 valueType 推断内置编辑器类型 | <en/> Infer the built-in editor type from valueType */
export function inferEditorFromValueType(valueType: string | undefined): BuiltinCellEditorType | undefined {
  if (!valueType)
    return undefined
  return VALUE_TYPE_TO_EDITOR[valueType]
}
