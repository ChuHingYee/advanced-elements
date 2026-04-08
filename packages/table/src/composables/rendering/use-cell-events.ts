/**
 * <zh/> 单元格聚焦、键盘和鼠标事件 composable
 * <en/> Cell focus, keyboard and mouse events composable
 *
 * @remarks
 * <zh/> 使用事件委托 + data-adv-cell-row/col 属性定位，将 N*3 个监听器降为 3 个。
 * DOM 定位逻辑（行列索引）通过 CellLocator 策略注入，不内嵌不同渲染器的 DOM 结构知识
 * <en/> Uses event delegation + data-adv-cell-row/col attribute positioning, reducing N*3 listeners to 3.
 * DOM positioning logic (row/column index) is injected via CellLocator strategy, not embedded with renderer-specific DOM knowledge
 */
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellLocator } from '../../types/cell-locator'
import { onActivated, onBeforeUnmount, onDeactivated, shallowRef, toValue, watch } from 'vue'
import { findCellCoord } from '../../utils/dom-utils'

/**
 * <zh/> 单元格聚焦事件负载
 * <en/> Cell focused event payload
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface CellFocusedEventPayload<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  rowData: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn
  /** <zh/> 当前列索引 | <en/> Current column index */
  columnIndex: number
  /** <zh/> 原生聚焦事件对象 | <en/> Native focus event object */
  event: FocusEvent
}

/**
 * <zh/> 单元格键盘事件负载
 * <en/> Cell keyboard event payload
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface CellKeyboardEventPayload<T = any> {
  /** <zh/> 当前行数据 | <en/> Current row data */
  rowData: T
  /** <zh/> 当前行索引 | <en/> Current row index */
  rowIndex: number
  /** <zh/> 当前列配置 | <en/> Current column config */
  column: ProcessedColumn
  /** <zh/> 当前列索引 | <en/> Current column index */
  columnIndex: number
  /** <zh/> 原生键盘事件对象 | <en/> Native keyboard event object */
  event: KeyboardEvent
}

/**
 * <zh/> 单元格鼠标事件负载
 * <en/> Cell mouse event payload
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface CellMouseEventPayload<T = any> {
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
 * <zh/> 单元格事件组合式函数配置选项
 * <en/> Cell events composable configuration options
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface UseCellEventsOptions<T = any> {
  /** <zh/> 表格容器 DOM 引用 | <en/> Table container DOM ref */
  containerRef: Ref<HTMLElement | null>
  /** <zh/> 列配置计算属性 | <en/> Column config computed ref */
  columns: ComputedRef<any[]>
  /** <zh/> 表格数据计算属性 | <en/> Table data computed ref */
  data: ComputedRef<T[]>
  /** <zh/> 单元格行列定位器 | <en/> Cell row/column locator */
  locator: CellLocator
  /** <zh/> 是否启用单元格事件监听，禁用时不会绑定任何 DOM 监听器。默认 true | <en/> Whether to enable cell event listeners, when disabled no DOM listeners are bound. Default true */
  enabled?: MaybeRefOrGetter<boolean>
  /** <zh/> 单元格聚焦事件回调 | <en/> Cell focused event callback */
  onCellFocused?: (payload: CellFocusedEventPayload<T>) => void
  /** <zh/> 单元格 keydown 事件回调 | <en/> Cell keydown event callback */
  onCellKeyDown?: (payload: CellKeyboardEventPayload<T>) => void
  /** <zh/> 单元格 keypress 事件回调 | <en/> Cell keypress event callback */
  onCellKeyPress?: (payload: CellKeyboardEventPayload<T>) => void
  /** <zh/> 单元格 keyup 事件回调 | <en/> Cell keyup event callback */
  onCellKeyUp?: (payload: CellKeyboardEventPayload<T>) => void
  /** 单元格 click 事件回调 */
  onCellClick?: (payload: CellMouseEventPayload<T>) => void
  /** 单元格 dblclick 事件回调 */
  onCellDblclick?: (payload: CellMouseEventPayload<T>) => void
  /** 单元格 contextmenu 事件回调 */
  onCellContextmenu?: (payload: CellMouseEventPayload<T>) => void
}

/**
 * 单元格事件组合式函数
 *
 * 在表格容器上使用事件委托监听单元格交互，降低 DOM 监听器数量。
 * @param options - 事件配置
 * @returns 聚焦单元格引用
 */
export function useCellEvents<T = any>(options: UseCellEventsOptions<T>) {
  const {
    containerRef,
    columns,
    data,
    locator,
    enabled,
    onCellFocused,
    onCellKeyDown,
    onCellKeyPress,
    onCellKeyUp,
    onCellClick,
    onCellDblclick,
    onCellContextmenu,
  } = options

  /** 当前聚焦单元格位置（Currently focused cell position） */
  const focusedCell = shallowRef<{ rowIndex: number, columnIndex: number } | null>(null)

  /**
   * 构建事件负载对象
   * Build event payload with row/column data and indices
   *
   * @param rowIndex - 行索引（Row index）
   * @param columnIndex - 列索引（Column index）
   * @param event - 原生事件对象（Native event）
   * @returns 事件负载（Event payload）
   */
  function buildPayload(rowIndex: number, columnIndex: number, event: Event) {
    const rowData = data.value[rowIndex]
    const column = columns.value[columnIndex]
    return { rowData, rowIndex, column, columnIndex, event }
  }

  function handleFocusin(e: FocusEvent) {
    const target = e.target as HTMLElement
    const rowIndex = locator.getRowIndex(target)
    if (rowIndex === null || rowIndex < 0 || rowIndex >= data.value.length)
      return

    const columnIndex = locator.getColumnIndex(target)
    if (columnIndex === null || columnIndex < 0 || columnIndex >= columns.value.length)
      return

    focusedCell.value = { rowIndex, columnIndex }
    onCellFocused?.(buildPayload(rowIndex, columnIndex, e) as CellFocusedEventPayload<T>)
  }

  /**
   * <zh/> 焦点离开单元格时清理 focusedCell，避免键盘事件转发到陈旧坐标。
   * <zh/> focusout 在 focusin 之前触发（DOM 规范），使用 relatedTarget 判断焦点去向。
   * <zh/> 焦点移出表格容器或移到非单元格元素时清除聚焦状态。
   * <en/> Clear focusedCell when focus leaves a cell, preventing keyboard events from forwarding to stale coordinates.
   * <en/> focusout fires before focusin (DOM spec), uses relatedTarget to determine focus destination.
   * <en/> Clears focus state when focus moves outside the table container or to a non-cell element.
   */
  function handleFocusout(e: FocusEvent) {
    const related = e.relatedTarget as HTMLElement | null
    // <zh/> 焦点移出容器或移到非单元格元素时清除 | <en/> Clear when focus leaves container or moves to a non-cell element
    // <zh/> 必须显式判"未解析到行"：getRowIndex 返回 number|null，而第 0 行的返回值 0 是假值，
    // <zh/> 真值判断会把第 0 行当成"未找到"，导致首行的 focusedCell 被误清、键盘导航从首行起步失效。
    // <en/> Must explicitly test for "row not resolved": getRowIndex returns number|null and row 0
    // <en/> yields the falsy 0 — a truthiness check treats the first row as "not found", wrongly
    // <en/> clearing focusedCell and breaking keyboard navigation that starts on the first row.
    const relatedRowIndex = related ? locator.getRowIndex(related) : null
    if (relatedRowIndex === null || relatedRowIndex < 0) {
      focusedCell.value = null
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!focusedCell.value)
      return
    onCellKeyDown?.(buildPayload(focusedCell.value.rowIndex, focusedCell.value.columnIndex, e) as CellKeyboardEventPayload<T>)
  }

  function handleKeyPress(e: KeyboardEvent) {
    if (!focusedCell.value)
      return
    onCellKeyPress?.(buildPayload(focusedCell.value.rowIndex, focusedCell.value.columnIndex, e) as CellKeyboardEventPayload<T>)
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (!focusedCell.value)
      return
    onCellKeyUp?.(buildPayload(focusedCell.value.rowIndex, focusedCell.value.columnIndex, e) as CellKeyboardEventPayload<T>)
  }

  /**
   * <zh/> 统一的单元格坐标解析：优先使用注入的 locator 策略，
   * fallback 到通用 data-adv-cell-row/col 属性查找。
   * 确保所有事件类型（focus/keyboard/mouse）使用一致的定位逻辑。
   * <en/> Unified cell coordinate resolution: prioritizes injected locator strategy,
   * falls back to generic data-adv-cell-row/col attribute lookup.
   * Ensures all event types (focus/keyboard/mouse) use consistent positioning logic.
   */
  function resolveCellCoord(target: HTMLElement): { rowIndex: number, columnIndex: number } | null {
    const rowIndex = locator.getRowIndex(target)
    const columnIndex = locator.getColumnIndex(target)
    if (rowIndex !== null && columnIndex !== null) {
      return { rowIndex, columnIndex }
    }
    return findCellCoord(target)
  }

  function handleCellClick(e: Event) {
    const cellInfo = resolveCellCoord(e.target as HTMLElement)
    if (!cellInfo)
      return
    const { rowIndex, columnIndex } = cellInfo
    if (rowIndex < 0 || rowIndex >= data.value.length || columnIndex < 0 || columnIndex >= columns.value.length)
      return
    onCellClick?.(buildPayload(rowIndex, columnIndex, e) as CellMouseEventPayload<T>)
  }

  function handleCellDblclick(e: Event) {
    const cellInfo = resolveCellCoord(e.target as HTMLElement)
    if (!cellInfo)
      return
    const { rowIndex, columnIndex } = cellInfo
    if (rowIndex < 0 || rowIndex >= data.value.length || columnIndex < 0 || columnIndex >= columns.value.length)
      return
    onCellDblclick?.(buildPayload(rowIndex, columnIndex, e) as CellMouseEventPayload<T>)
  }

  function handleCellContextmenu(e: Event) {
    const cellInfo = resolveCellCoord(e.target as HTMLElement)
    if (!cellInfo)
      return
    const { rowIndex, columnIndex } = cellInfo
    if (rowIndex < 0 || rowIndex >= data.value.length || columnIndex < 0 || columnIndex >= columns.value.length)
      return
    onCellContextmenu?.(buildPayload(rowIndex, columnIndex, e) as CellMouseEventPayload<T>)
  }

  let cleanup: (() => void) | null = null

  function bindEvents(el: HTMLElement) {
    el.addEventListener('focusin', handleFocusin, true)
    el.addEventListener('focusout', handleFocusout, true)
    el.addEventListener('keydown', handleKeyDown, true)
    el.addEventListener('keypress', handleKeyPress, true)
    el.addEventListener('keyup', handleKeyUp, true)

    if (onCellClick)
      el.addEventListener('click', handleCellClick, true)
    if (onCellDblclick)
      el.addEventListener('dblclick', handleCellDblclick, true)
    if (onCellContextmenu)
      el.addEventListener('contextmenu', handleCellContextmenu, true)

    cleanup = () => {
      el.removeEventListener('focusin', handleFocusin, true)
      el.removeEventListener('focusout', handleFocusout, true)
      el.removeEventListener('keydown', handleKeyDown, true)
      el.removeEventListener('keypress', handleKeyPress, true)
      el.removeEventListener('keyup', handleKeyUp, true)
      el.removeEventListener('click', handleCellClick, true)
      el.removeEventListener('dblclick', handleCellDblclick, true)
      el.removeEventListener('contextmenu', handleCellContextmenu, true)
    }
  }

  function unbindEvents() {
    if (cleanup) {
      cleanup()
      cleanup = null
    }
  }

  /**
   * <zh/> enabled / containerRef 变化时动态绑定/解绑事件
   * <zh/> 回调函数（onCellClick 等）为 setup 时解构的 const 引用，不会变化，
   * <zh/> 无需作为 watch 源——移除后减少 3 个无效依赖追踪点
   * <en/> Re-bind/unbind events when enabled / containerRef changes
   * <en/> Callback functions (onCellClick etc.) are const references destructured at setup time, never change,
   * <en/> no need to be watch sources — removing them eliminates 3 unnecessary dependency tracking points
   */
  watch(
    [containerRef, () => toValue(enabled)],
    ([el, isEnabled]) => {
      unbindEvents()
      if (el && isEnabled !== false)
        bindEvents(el)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    unbindEvents()
  })

  onDeactivated(() => {
    unbindEvents()
  })

  /** KeepAlive 重新激活时重新绑定事件（watch immediate 仅在 setup 时触发一次，重新激活不会重跑） */
  onActivated(() => {
    unbindEvents()
    const el = toValue(containerRef)
    const isEnabled = toValue(enabled)
    if (el && isEnabled !== false)
      bindEvents(el)
  })

  return { focusedCell }
}
