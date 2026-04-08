import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import type { ProcessedColumn } from '../../types'
import type { CellCoord } from '../../utils/dom-utils'
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, toValue, watch } from 'vue'
import { isAppendRowData } from '../../components/table-virtual-renderer/append-row-helpers'
import { serializeTsv } from '../../utils/context-menu-clipboard'
import { copyToClipboard } from '../../utils/copy'
import { findCellCoord } from '../../utils/dom-utils'
import { EP_ANY_CHECKABLE_SELECTOR, EP_ANY_SWITCH_SELECTOR } from '../../utils/ep-selectors'
import { rafSchedule } from '../../utils/raf'
import { resolveCellText } from '../../utils/resolve-cell-text'
import { neutralizeFormulaInjection } from '../../utils/security'
import { isSyntheticRow } from '../../utils/total-rows'

export type { CellCoord }

/**
 * <zh/> 单元格范围选择结果
 * <en/> Cell range selection result
 *
 * @remarks
 * <zh/> 包含选区起止坐标、归一化后的范围、选中的行/列数据，以及 TSV 格式的文本
 * <en/> Contains selection start/end coordinates, normalized range, selected rows/columns data, and TSV formatted text
 */
export interface CellRangeSelection<T = any> {
  /** <zh/> 选区起始单元格坐标 | <en/> Selection start cell coordinates */
  start: CellCoord
  /** <zh/> 选区结束单元格坐标 | <en/> Selection end cell coordinates */
  end: CellCoord
  /** <zh/> 归一化后的矩形范围（起始/结束行列号已排序） | <en/> Normalized rectangle range (start/end row/col sorted) */
  range: { startRow: number, endRow: number, startCol: number, endCol: number }
  /** <zh/> 选区内的行数据 | <en/> Row data within selection */
  rows: T[]
  /** <zh/> 选区内的列配置 | <en/> Column config within selection */
  columns: ProcessedColumn[]
  /** <zh/> 选区文本内容（Tab 分隔，行间换行） | <en/> Selection text content (Tab separated, newline between rows) */
  tsv: string
}

/**
 * <zh/> useCellRangeSelection 配置选项
 * <en/> useCellRangeSelection configuration options
 */
export interface UseCellRangeSelectionOptions<T> {
  /** <zh/> 表格容器 DOM 引用 | <en/> Table container DOM ref */
  containerRef: Ref<HTMLElement | null>
  /**
   * <zh/> 渲染器 DOM 适配器——MutationObserver 的观察范围收窄选择器由它供给
   * <zh/>（default / virtual 两种模式各返回自己的 body 容器选择器）。
   *
   * <zh/> 为什么必填：收窄范围来自 EP 内部结构（`.el-table__body-wrapper` / `.el-table-v2__body`），
   * <zh/> 属适配器职责。若在此处内联类名字符串，EP 升级或 `uiConfig.namespace` 自定义命名空间下
   * <zh/> 会静默失配（观察范围退化为整个容器，性能劣化且不易察觉）。
   * <en/> Renderer DOM adapter — supplies the MutationObserver scope-narrowing selector (each mode
   * <en/> returns its own body container selector).
   *
   * <en/> Why required: the narrowing selector is EP-internal structure
   * <en/> (`.el-table__body-wrapper` / `.el-table-v2__body`) and belongs to the adapter. Inlining a
   * <en/> class-name string here would silently miss after an EP upgrade or under a custom
   * <en/> `uiConfig.namespace` (observation silently degrades to the whole container — a perf
   * <en/> regression that is hard to notice).
   */
  dom: MaybeRefOrGetter<IRendererDomAdapter>
  /** <zh/> 表格行数据 | <en/> Table row data */
  data: ComputedRef<T[]>
  /** <zh/> 表格列配置 | <en/> Table column config */
  columns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 是否启用范围选择，禁用时不绑定任何 DOM 监听器。默认 true | <en/> Whether to enable range selection, when disabled no DOM listeners are bound. Default true */
  enabled: MaybeRefOrGetter<boolean>
  /** <zh/> 范围选择完成回调，每次鼠标松开时触发 | <en/> Range selection callback, triggered on each mouse release */
  onRangeSelected?: (selection: CellRangeSelection<T>) => void
  /**
   * <zh/> 列域翻译器：DOM attr 值（data-adv-cell-col，事件域 [selection, nonFixed, fixed]）→
   * <zh/> cells 域列索引（混合序去 selection，与 RowViewModel isCellSelected / extractRangeText
   * <zh/> 的列域一致）。缺省为恒等（default 模式两域同构；selection 格 attr=-1 域外直通）。
   * <en/> Column-domain translator: DOM attr value (data-adv-cell-col, the event domain
   * <en/> [selection, nonFixed, fixed]) → cells-domain column index (mixed order minus
   * <en/> selection, matching RowViewModel isCellSelected / extractRangeText). Defaults to
   * <en/> identity (the two domains are isomorphic in default mode; selection cells carry -1
   * <en/> and pass through as out-of-domain).
   */
  columnIndexResolver?: (attrCol: number) => number
}

const RANGE_SELECTED_CLASS = 'adv-table__cell--range-selected'

function normalizeRange(start: CellCoord, end: CellCoord) {
  return {
    startRow: Math.min(start.rowIndex, end.rowIndex),
    endRow: Math.max(start.rowIndex, end.rowIndex),
    startCol: Math.min(start.columnIndex, end.columnIndex),
    endCol: Math.max(start.columnIndex, end.columnIndex),
  }
}

function isInRect(row: number, col: number, range: { startRow: number, endRow: number, startCol: number, endCol: number }): boolean {
  return row >= range.startRow && row <= range.endRow
    && col >= range.startCol && col <= range.endCol
}

function isInRange(coord: CellCoord, range: { startRow: number, endRow: number, startCol: number, endCol: number }): boolean {
  return isInRect(coord.rowIndex, coord.columnIndex, range)
}

/**
 * 单元格范围选择 composable — 鼠标拖拽选择矩形区域，支持 TSV 复制与选区高亮。
 *
 * @param options - 范围选择配置
 * @returns 选区状态与判断方法
 */
export function useCellRangeSelection<T>(options: UseCellRangeSelectionOptions<T>) {
  const { containerRef, dom, data, columns, enabled, onRangeSelected, columnIndexResolver } = options

  /**
   * <zh/> cells 域列配置缓存——与 RowViewModel cells 数组同一过滤（去 selection 列），
   * <zh/> 保证矩形列轴 / TSV 列 / isCellSelected 三者同域。
   * <en/> Cells-domain column list cache — filtered exactly like the RowViewModel cells array
   * <en/> (selection excluded), keeping the rect column axis / TSV columns / isCellSelected in
   * <en/> one domain.
   */
  const cellsColumns = computed(() => columns.value.filter(c => (c as { selection?: boolean }).selection !== true))

  /** <zh/> attr 值 → cells 域索引（未提供翻译器时恒等） | <en/> attr value → cells-domain index (identity when no resolver) */
  function resolveAttrCol(attrCol: number): number {
    if (!columnIndexResolver)
      return attrCol
    return columnIndexResolver(attrCol)
  }

  function isDataRow(row: T | undefined): row is T {
    return row != null && !isSyntheticRow(row) && !isAppendRowData(row)
  }

  function isValidCoord(coord: CellCoord): boolean {
    return Number.isInteger(coord.rowIndex) && coord.rowIndex >= 0 && coord.rowIndex < data.value.length
      && Number.isInteger(coord.columnIndex) && coord.columnIndex >= 0 && coord.columnIndex < cellsColumns.value.length
      && isDataRow(data.value[coord.rowIndex])
  }

  /** <zh/> 从 DOM 元素解析坐标并翻译列域 | <en/> Resolve a coord from a DOM element and translate the column domain */
  function findTranslatedCoord(target: HTMLElement): CellCoord | null {
    const coord = findCellCoord(target)
    if (!coord)
      return null
    const translated = { rowIndex: coord.rowIndex, columnIndex: resolveAttrCol(coord.columnIndex) }
    return isValidCoord(translated) ? translated : null
  }

  const isSelecting = ref(false)
  const anchorCell = shallowRef<CellCoord | null>(null)
  const focusCell = shallowRef<CellCoord | null>(null)
  const currentRange = computed(() => {
    if (!anchorCell.value || !focusCell.value)
      return null
    return normalizeRange(anchorCell.value, focusCell.value)
  })

  const lastSelection = shallowRef<CellRangeSelection<T> | null>(null)

  let prevRenderedRange: { startRow: number, endRow: number, startCol: number, endCol: number } | null = null
  /**
   * <zh/> rAF 节流（共享工具）——mousemove 高频触发下每帧最多一次 renderSelection，取最后一次 range
   * <en/> rAF throttled (shared util) — at most one renderSelection per frame under high-frequency mousemove, latest range wins
   */
  let pendingRenderRange: { startRow: number, endRow: number, startCol: number, endCol: number } | null = null
  const renderHandle = rafSchedule(() => renderSelection(pendingRenderRange))

  function scheduleRenderSelection(range: { startRow: number, endRow: number, startCol: number, endCol: number } | null) {
    pendingRenderRange = range
    renderHandle.schedule()
  }

  function renderSelection(range: { startRow: number, endRow: number, startCol: number, endCol: number } | null) {
    const container = containerRef.value
    if (!container)
      return

    if (!range) {
      if (prevRenderedRange) {
        container.querySelectorAll<HTMLElement>(`.${RANGE_SELECTED_CLASS}`)
          .forEach(cell => cell.classList.remove(RANGE_SELECTED_CLASS))
        prevRenderedRange = null
      }
      return
    }

    /**
     * 批量标记选区：遍历所有带 data-adv-cell-row 的可见单元格，
     * 判断是否在选区内，比逐单元格 querySelector 更高效。
     * querySelector 复合属性选择器无法利用浏览器索引，退化为 O(n) DOM 遍历，
     * 对大选区（如 100×20=2000 格）首次渲染会严重卡顿。
     * 一次 querySelectorAll 遍历可见单元格，O(visible_cells) 开销。
     */
    container.querySelectorAll<HTMLElement>('[data-adv-cell-row]').forEach((cell) => {
      const r = Number(cell.getAttribute('data-adv-cell-row'))
      const c = resolveAttrCol(Number(cell.getAttribute('data-adv-cell-col')))
      if (Number.isNaN(r) || Number.isNaN(c))
        return
      if (isValidCoord({ rowIndex: r, columnIndex: c }) && isInRect(r, c, range)) {
        cell.classList.add(RANGE_SELECTED_CLASS)
      }
      else {
        cell.classList.remove(RANGE_SELECTED_CLASS)
      }
    })

    prevRenderedRange = range
  }

  let cellObserver: MutationObserver | null = null
  /**
   * <zh/> rAF 批处理（共享工具，可取消）——MutationObserver 回调中避免同步操作 DOM；
   * <zh/> 全量 set/remove 保证虚拟滚动下高亮与选区一致。
   * <en/> rAF-coalesced (shared util, cancelable) — avoids synchronous DOM ops inside MutationObserver
   * <en/> callbacks; full set/remove keeps highlights consistent with the range under virtual scrolling.
   */
  const observerHandle = rafSchedule(() => {
    const container = containerRef.value
    if (!container || !currentRange.value)
      return
    const range = currentRange.value
    container.querySelectorAll<HTMLElement>('[data-adv-cell-row]').forEach((cell) => {
      const r = Number(cell.getAttribute('data-adv-cell-row'))
      const c = resolveAttrCol(Number(cell.getAttribute('data-adv-cell-col')))
      if (Number.isNaN(r) || Number.isNaN(c))
        return
      if (isValidCoord({ rowIndex: r, columnIndex: c }) && isInRect(r, c, range)) {
        cell.classList.add(RANGE_SELECTED_CLASS)
      }
      else {
        cell.classList.remove(RANGE_SELECTED_CLASS)
      }
    })
  })

  function startCellObserver() {
    const container = containerRef.value
    if (!container || cellObserver)
      return

    cellObserver = new MutationObserver(() => {
      // <zh/> 使用 rAF 批处理，避免滚动期间高频回调阻塞主线程 | <en/> rAF batching keeps high-frequency callbacks off the main thread during scroll
      observerHandle.schedule()
    })

    /**
     * <zh/> 缩小 MutationObserver 观察范围——body 容器选择器由 DOM 适配器按渲染模式供给：
     * <zh/> el-table → `.el-table__body-wrapper`；el-table-v2 → `.el-table-v2__body`。
     * <zh/> 找到后仅观察其子树（范围远小于整个 container），未找到时回退到整个 container
     * <zh/>（兼容自定义渲染器）。本模块因此不持有任何 EP 类名字符串。
     *
     * <zh/> 相对原实现的行为改进（非等价迁移）：原代码硬编码 `.el-` 前缀逐一试查，
     * <zh/> `uiConfig.namespace` 自定义命名空间下两个查询全部落空 → 观察范围静默退化为整个容器；
     * <zh/> 改为适配器供给后按当前命名空间构造，自定义命名空间下同样命中。
     * <en/> Narrow the MutationObserver scope — the body container selector comes from the DOM adapter
     * <en/> per renderer mode: el-table → `.el-table__body-wrapper`; el-table-v2 → `.el-table-v2__body`.
     * <en/> Once found only its subtree is observed (far smaller than the whole container), falling back
     * <en/> to the container itself when absent (custom renderers). This module therefore holds no
     * <en/> EP class-name string.
     *
     * <en/> Behavioral improvement over the previous implementation (not an equivalent migration): the
     * <en/> previous code hard-coded the `.el-` prefix in both attempted queries, so under a custom
     * <en/> `uiConfig.namespace` both missed and the observation scope silently degraded to the whole
     * <en/> container. The adapter builds the selector from the current namespace, so it now matches.
     */
    const bodyWrapper = container.querySelector(toValue(dom).getBodySelector())
    cellObserver.observe(bodyWrapper ?? container, {
      childList: true,
      subtree: true,
    })
  }

  function stopCellObserver() {
    observerHandle.cancel()
    renderHandle.cancel()
    cellObserver?.disconnect()
    cellObserver = null
  }

  function isCellSelected(rowIndex: number, columnIndex: number): boolean {
    if (!currentRange.value || !isValidCoord({ rowIndex, columnIndex }))
      return false
    return isInRange({ rowIndex, columnIndex }, currentRange.value)
  }

  function extractRangeText(range: { startRow: number, endRow: number, startCol: number, endCol: number }): string {
    const lines: string[][] = []
    const cols = cellsColumns.value
    const tableData = data.value
    for (let r = range.startRow; r <= range.endRow; r++) {
      const row = tableData[r]
      if (!isDataRow(row))
        continue
      const cells: string[] = []
      for (let c = range.startCol; c <= range.endCol; c++) {
        const col = cols[c]
        if (!col)
          continue
        /** 显式处理 prop 为 null/undefined 的情况，避免 row[undefined] 访问 */
        const cellData = col.prop != null ? row[col.prop as keyof T] : undefined
        const text = resolveCellText({
          cellData,
          row: row as Record<string, unknown>,
          column: col,
          // ProcessedColumn is structurally compatible with AdvColumn for format callbacks
          columns: cols as unknown as import('../../types').AdvColumn[],
          index: r,
          columnIndex: c,
        })
        /**
         * <zh/> 安全契约：tsv 会经 Ctrl+C 流出到电子表格软件，与 CSV 导出同类出口。
         * <zh/> 在此中和公式注入，使 `cellRangeSelected` 事件的消费方也默认安全。
         * <en/> Security contract: tsv reaches spreadsheet apps via Ctrl+C — the same class of
         * <en/> exit as CSV export. Neutralizing here makes `cellRangeSelected` consumers safe by default.
         */
        cells.push(neutralizeFormulaInjection(text))
      }
      lines.push(cells)
    }
    // <zh/> 复用统一 TSV 序列化器——与剪贴板复制路径共用，避免分隔符语义漂移
    // <en/> Reuse the unified TSV serializer — shared with clipboard copy paths to avoid delimiter drift
    return serializeTsv(lines)
  }

  function buildSelection(range: { startRow: number, endRow: number, startCol: number, endCol: number }): CellRangeSelection<T> {
    const cols = cellsColumns.value
    const tableData = data.value
    const selectedRows = tableData.slice(range.startRow, range.endRow + 1).filter(isDataRow)
    const selectedCols = cols.slice(range.startCol, range.endCol + 1)
    const tsv = extractRangeText(range)

    const anchor = anchorCell.value
    const focus = focusCell.value

    return {
      start: anchor ?? { rowIndex: range.startRow, columnIndex: range.startCol },
      end: focus ?? { rowIndex: range.endRow, columnIndex: range.endCol },
      range,
      rows: selectedRows,
      columns: selectedCols,
      tsv,
    }
  }

  watch(currentRange, (range) => {
    // <zh/> rAF 节流：每帧最多执行一次 renderSelection，防止 mousemove 高频触发 DOM 查询
    // <en/> rAF throttled: at most one renderSelection per frame, guarding against mousemove DOM-query storms
    scheduleRenderSelection(range)
  })

  function handleMousedown(e: MouseEvent) {
    if (!toValue(enabled))
      return
    if (e.button !== 0)
      return
    const target = e.target as HTMLElement
    // <zh/> 控件点击互斥：命名空间无关的子串匹配（见 ep-selectors.ts 注记），任意前缀的 EP 勾选/开关控件均排除
    // <en/> Control-click exclusion: namespace-agnostic substring matching (see the ep-selectors.ts note); EP checkable/switch controls of any prefix are excluded
    if (target.closest(`input, textarea, select, button, .adv-table__cell--editing, ${EP_ANY_CHECKABLE_SELECTOR}, ${EP_ANY_SWITCH_SELECTOR}`))
      return

    const coord = findTranslatedCoord(target)
    if (!coord)
      return

    e.preventDefault()
    isSelecting.value = true
    anchorCell.value = coord
    focusCell.value = coord
    // 延迟绑定 mousemove/mouseup，避免全局常驻高频监听
    document.addEventListener('mousemove', handleMousemove, true)
    document.addEventListener('mouseup', handleMouseup, true)
    // 选择期间启动 MutationObserver，确保虚拟滚动新渲染的单元格也能正确标记
    startCellObserver()
  }

  function handleMousemove(e: MouseEvent) {
    if (!isSelecting.value)
      return
    const target = e.target as HTMLElement
    let coord = findTranslatedCoord(target)

    if (!coord) {
      const elFromPoint = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      if (elFromPoint) {
        coord = findTranslatedCoord(elFromPoint)
      }
    }

    if (!coord)
      return
    if (focusCell.value?.rowIndex === coord.rowIndex && focusCell.value?.columnIndex === coord.columnIndex)
      return
    focusCell.value = coord
  }

  function handleMouseup() {
    if (!isSelecting.value)
      return
    isSelecting.value = false
    // 选择结束，解绑临时监听器
    document.removeEventListener('mousemove', handleMousemove, true)
    document.removeEventListener('mouseup', handleMouseup, true)

    if (currentRange.value) {
      const selection = buildSelection(currentRange.value)
      lastSelection.value = selection
      onRangeSelected?.(selection)
    }
  }

  function handleWindowBlur() {
    if (isSelecting.value) {
      isSelecting.value = false
      document.removeEventListener('mousemove', handleMousemove, true)
      document.removeEventListener('mouseup', handleMouseup, true)
      stopCellObserver()
    }
  }

  function clearSelection() {
    renderSelection(null)
    anchorCell.value = null
    focusCell.value = null
    lastSelection.value = null
    /**
     * <zh/> 选区清空时停止观察——observer 生命周期与"存在选区"绑定，
     * <zh/> 选择结束后保持观察以跟踪虚拟滚动的新增/移除单元格。
     * <en/> Stop observing when the range is cleared — observer lifetime is tied to
     * <en/> "a range exists", keeping highlights in sync as virtual scrolling adds/removes cells.
     */
    stopCellObserver()
  }

  /**
   * <zh/> 选区存在期间保持 observer 存活——虚拟滚动下滚动操作会持续增删单元格，
   * <zh/> 仅拖拽期间观察会在 mouseup 后让高亮失活。
   * <en/> Keep the observer alive while a range exists — under virtual scrolling,
   * <en/> scroll operations keep adding/removing cells; observing only during drag
   * <en/> would leave highlights dead after mouseup.
   */
  watch(anchorCell, (anchor) => {
    if (anchor) {
      startCellObserver()
    }
  })

  async function copySelectionToClipboard(): Promise<boolean> {
    if (!lastSelection.value)
      return false
    return copyToClipboard(lastSelection.value.tsv)
  }

  let cleanup: (() => void) | null = null

  function bindEvents(el: HTMLElement) {
    el.addEventListener('mousedown', handleMousedown, true)
    if (typeof window !== 'undefined')
      window.addEventListener('blur', handleWindowBlur)
    cleanup = () => {
      el.removeEventListener('mousedown', handleMousedown, true)
      if (typeof window !== 'undefined')
        window.removeEventListener('blur', handleWindowBlur)
      // 确保选择过程中的临时监听器也被清理
      if (typeof document !== 'undefined') {
        document.removeEventListener('mousemove', handleMousemove, true)
        document.removeEventListener('mouseup', handleMouseup, true)
      }
    }
  }

  function unbindEvents() {
    if (cleanup) {
      cleanup()
      cleanup = null
    }
  }

  /** enabled 变化时动态绑定/解绑事件 */
  watch([containerRef, () => toValue(enabled)], ([el, isEnabled]) => {
    unbindEvents()
    stopCellObserver()
    prevRenderedRange = null
    if (el && isEnabled) {
      bindEvents(el)
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    unbindEvents()
    stopCellObserver()
    renderSelection(null)
  })

  onDeactivated(() => {
    unbindEvents()
    stopCellObserver()
    renderSelection(null)
  })

  /** KeepAlive 重新激活时重新绑定事件（watch immediate 仅在 setup 时触发一次，重新激活不会重跑） */
  onActivated(() => {
    const el = toValue(containerRef)
    const isEnabled = toValue(enabled)
    if (el && isEnabled)
      bindEvents(el)
  })

  /**
   * <zh/> 键盘扩展入口（Shift+Arrow）——以当前焦点为锚启动选区并将焦点格推进到 coord。
   * <zh/> 与鼠标路径共享 anchor/focus 状态与高亮渲染，保证两种输入方式的视觉一致。
   * <en/> Keyboard-extension entry (Shift+Arrow) — starts a selection anchored at the current
   * <en/> focus and advances the focus cell to `coord`. Shares anchor/focus state and highlight
   * <en/> rendering with the mouse path so both inputs look identical.
   */
  function extendTo(rawCoord: CellCoord): void {
    // <zh/> 键盘路径的坐标来自 DOM attr（事件域）——与鼠标路径同经翻译缝
    // <en/> keyboard-path coords come from DOM attrs (event domain) — same translation seam as the mouse path
    const coord = { rowIndex: rawCoord.rowIndex, columnIndex: resolveAttrCol(rawCoord.columnIndex) }
    if (!toValue(enabled) || !isValidCoord(coord))
      return
    if (!isSelecting.value) {
      isSelecting.value = true
      anchorCell.value = coord
      startCellObserver()
    }
    focusCell.value = coord
  }

  /**
   * <zh/> 键盘选择提交（Shift 松开时调用）——镜像 mouseup 尾段：落 lastSelection 并派发
   * <zh/> onRangeSelected。选区保持高亮直至 clearSelection（与鼠标行为一致）。
   * <en/> Keyboard-selection commit (called on Shift release) — mirrors the mouseup tail:
   * <en/> lands lastSelection and emits onRangeSelected. The range stays highlighted until
   * <en/> clearSelection (consistent with mouse behavior).
   */
  function finishSelection(): void {
    if (!isSelecting.value)
      return
    isSelecting.value = false
    if (currentRange.value) {
      const selection = buildSelection(currentRange.value)
      lastSelection.value = selection
      onRangeSelected?.(selection)
    }
  }

  return {
    isSelecting,
    anchorCell,
    focusCell,
    currentRange,
    lastSelection,
    isCellSelected,
    clearSelection,
    copySelectionToClipboard,
    extendTo,
    finishSelection,
  }
}
