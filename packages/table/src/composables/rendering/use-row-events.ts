import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

/**
 * <zh/> ElTableV2 行事件 emit 回调
 * <en/> ElTableV2 row event emit callbacks
 */
export interface RowEventEmits<T = any> {
  /** <zh/> 行点击事件回调 | <en/> Row click event callback */
  onRowClick?: (params: { rowData: T, rowIndex: number, event: Event }) => void
  /** <zh/> 行右键菜单事件回调 | <en/> Row contextmenu event callback */
  onRowContextmenu?: (params: { rowData: T, rowIndex: number, event: Event }) => void
  /** <zh/> 行双击事件回调 | <en/> Row double-click event callback */
  onRowDblclick?: (params: { rowData: T, rowIndex: number, event: Event }) => void
  /** <zh/> 单元格点击事件回调（含列与列索引） | <en/> Cell click event callback (with column and column index) */
  onCellClick?: (params: { rowData: T, rowIndex: number, column: any, columnIndex: number, event: Event }) => void
  /** <zh/> 单元格双击事件回调（含列与列索引） | <en/> Cell double-click event callback (with column and column index) */
  onCellDblclick?: (params: { rowData: T, rowIndex: number, column: any, columnIndex: number, event: Event }) => void
  /** <zh/> 单元格右键菜单事件回调（含列与列索引） | <en/> Cell contextmenu event callback (with column and column index) */
  onCellContextmenu?: (params: { rowData: T, rowIndex: number, column: any, columnIndex: number, event: Event }) => void
  /** <zh/> 鼠标进入单元格（行）事件回调 | <en/> Cell (row) mouse-enter event callback */
  onCellMouseEnter?: (params: { rowData: T, rowIndex: number, event?: Event }) => void
  /** <zh/> 鼠标离开单元格（行）事件回调 | <en/> Cell (row) mouse-leave event callback */
  onCellMouseLeave?: () => void
  /** <zh/> 当前行变更事件回调（含新旧行） | <en/> Current-row change event callback (with new and old rows) */
  onCurrentChange?: (params: { currentRow: T, oldRow: T | null }) => void
}

/**
 * <zh/> 行事件处理器配置选项
 * <en/> Row event handler configuration options
 */
export interface UseRowEventHandlersOptions {
  /** <zh/> 是否有悬停操作列 | <en/> Whether there are hover option columns */
  hasHoverOptionColumns: MaybeRefOrGetter<boolean>
  /** <zh/> 悬停操作列配置数组 | <en/> Hover option column config array */
  hoverOptionColumns: MaybeRefOrGetter<any[]>
  /** <zh/> 鼠标进入行时的回调 | <en/> Callback when mouse enters a row */
  handleHoverRowEnter: (row: any, index: number) => void
  /** <zh/> 鼠标离开行时的回调 | <en/> Callback when mouse leaves a row */
  handleHoverRowLeave: () => void
  /** <zh/> 渲染列列表，用于从 cellClick 的 DOM 属性解析列索引 | <en/> Rendered column list, used to resolve column index from cellClick DOM attributes */
  displayColumns?: MaybeRefOrGetter<any[]>
}

/**
 * 生成 ElTable hover 事件处理器（Create ElTable hover event handlers）
 *
 * 处理器函数在 setup 阶段创建一次，computed 仅切换返回引用，避免每次求值创建新函数实例导致 v-on 重绑定
 */
export function useElTableHoverEvents(options: UseRowEventHandlersOptions) {
  const { hasHoverOptionColumns, handleHoverRowEnter, handleHoverRowLeave } = options

  const emptyHandlers: Record<string, ((...args: any[]) => void) | undefined> = {}

  const handlers: Record<string, ((...args: any[]) => void) | undefined> = {
    'cell-mouse-enter': (row: any, _column: unknown, _cell: HTMLElement, _event: Event) => {
      handleHoverRowEnter(row, -1)
    },
    'cell-mouse-leave': () => {
      handleHoverRowLeave()
    },
  }

  return computed(() => toValue(hasHoverOptionColumns) ? handlers : emptyHandlers)
}

/**
 * 生成 ElTableV2 行事件处理器（包含 hover + click/contextmenu/dblclick），
 * 将行事件转发为组件 emit
 * Create ElTableV2 row event handlers with hover + click/contextmenu/dblclick,
 * forwarding row events as component emits
 *
 * 处理器函数在 setup 阶段创建一次，hover 判断移入函数内部在事件触发时求值，
 * 避免 computed 依赖 hoverOptionColumns 导致每次列配置更新时重建所有函数实例
 *
 * @param options - 配置选项，包含 hoverOptionColumns、行进入/离开回调及 emit 回调
 */
export function useElTableV2RowEventHandlers<T>(options: UseRowEventHandlersOptions & { emit?: RowEventEmits<T> }) {
  const { hoverOptionColumns, handleHoverRowEnter, handleHoverRowLeave, displayColumns, emit } = options

  /** 从点击事件的 DOM 属性解析列索引和列对象 */
  function resolveClickedColumn(event: Event): { column: any, columnIndex: number } | null {
    const target = event.target as HTMLElement | null
    if (!target)
      return null
    const cell = target.closest<HTMLElement>('[data-adv-cell-col]')
    if (!cell)
      return null
    const colIdx = Number(cell.dataset.advCellCol)
    if (Number.isNaN(colIdx))
      return null
    const cols = toValue(displayColumns)
    if (!cols || colIdx < 0 || colIdx >= cols.length)
      return null
    return { column: cols[colIdx], columnIndex: colIdx }
  }

  /**
   * 鼠标进入行事件处理——触发悬停选项显示并转发 onCellMouseEnter
   * Handle mouseenter on a row: show hover options and forward onCellMouseEnter
   */
  function onMouseenter(params: { rowData: T, rowIndex: number, event?: Event }) {
    if (toValue(hoverOptionColumns).length > 0) {
      handleHoverRowEnter(params.rowData, params.rowIndex)
    }
    emit?.onCellMouseEnter?.(params)
  }

  /**
   * 鼠标离开行事件处理——隐藏悬停选项并转发 onCellMouseLeave
   * Handle mouseleave on a row: hide hover options and forward onCellMouseLeave
   */
  function onMouseleave() {
    if (toValue(hoverOptionColumns).length > 0) {
      handleHoverRowLeave()
    }
    emit?.onCellMouseLeave?.()
  }

  /**
   * 行点击事件处理——显示悬停选项、转发 onRowClick、发射 onCellClick
   * Handle click on a row: show hover options, forward onRowClick, emit onCellClick
   *
   * 点击编辑器内部（如下拉选项、日期面板）时不发射 cellClick，避免退出编辑状态。
   */
  function onClick(params: { rowData: T, rowIndex: number, event: Event, rowKey: any }) {
    if (toValue(hoverOptionColumns).length > 0) {
      handleHoverRowEnter(params.rowData, params.rowIndex)
    }
    emit?.onRowClick?.({ rowData: params.rowData, rowIndex: params.rowIndex, event: params.event })
    const resolved = resolveClickedColumn(params.event)
    if (resolved) {
      emit?.onCellClick?.({
        rowData: params.rowData,
        rowIndex: params.rowIndex,
        column: resolved.column,
        columnIndex: resolved.columnIndex,
        event: params.event,
      })
    }
  }

  /**
   * <zh/> 行右键菜单事件处理——转发 onRowContextmenu，发射 onCellContextmenu
   * <en/> Handle contextmenu on a row: forward onRowContextmenu, emit onCellContextmenu
   */
  function onContextmenu(params: { rowData: T, rowIndex: number, event: Event, rowKey: any }) {
    emit?.onRowContextmenu?.({ rowData: params.rowData, rowIndex: params.rowIndex, event: params.event })
    const resolved = resolveClickedColumn(params.event)
    if (resolved) {
      emit?.onCellContextmenu?.({
        rowData: params.rowData,
        rowIndex: params.rowIndex,
        column: resolved.column,
        columnIndex: resolved.columnIndex,
        event: params.event,
      })
    }
  }

  /**
   * 行双击事件处理——转发 onRowDblclick，发射 onCellDblclick
   * Handle dblclick on a row: forward onRowDblclick, emit onCellDblclick
   */
  function onDblclick(params: { rowData: T, rowIndex: number, event: Event, rowKey: any }) {
    emit?.onRowDblclick?.({ rowData: params.rowData, rowIndex: params.rowIndex, event: params.event })
    const resolved = resolveClickedColumn(params.event)
    if (resolved) {
      emit?.onCellDblclick?.({
        rowData: params.rowData,
        rowIndex: params.rowIndex,
        column: resolved.column,
        columnIndex: resolved.columnIndex,
        event: params.event,
      })
    }
  }

  const handlers = {
    onMouseenter,
    onMouseleave,
    onClick,
    onContextmenu,
    onDblclick,
  }

  return computed(() => handlers)
}
