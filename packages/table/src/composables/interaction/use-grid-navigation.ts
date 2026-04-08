import type { MaybeRefOrGetter, Ref } from 'vue'
import type { RendererCaps } from '../../types/renderer-caps'
import type { CellCoord } from '../../utils/dom-utils'
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, toValue, watch } from 'vue'
import { findCellCoord, findCellElement } from '../../utils/dom-utils'

/**
 * <zh/> 网格方向键导航（最小可用焦点模型）。
 *
 * <zh/> 补齐 AG Grid / VXE 的核心交互缺口：单元格同时提供 Tab 编辑链与方向键网格焦点模型，两者互补。
 * <zh/> 实现：容器捕获阶段监听 ArrowUp/Down/Left/Right → 从 document.activeElement 解析当前
 * <zh/> data-adv-cell-* 坐标 → 反查目标单元格元素并 .focus。焦点真实移动后，既有
 * <zh/> focusin 管线自动派发 cellFocused 事件——零新增事件代码。
 * <zh/> 滚动跟随：default 模式 scrollIntoView(nearest)；virtual 模式委托渲染器 scrollToRow/
 * <zh/> scrollToColumn（目标行未渲染时先滚动、多级重试聚焦：nextTick × 2 + rAF 兜底）。
 * <zh/> 守卫：编辑器内（input/textarea/contenteditable 聚焦时）不劫持按键；修饰键组合不劫持，
 * <zh/> 为未来的 Shift+Arrow 范围扩展预留。
 *
 * <en/> Grid arrow-key navigation (minimal viable focus model).
 *
 * <en/> Fills the AG Grid/VXE core-interaction gap: cells provide both the Tab editing
 * <en/> chain and the arrow-key grid focus model, complementing each other. Implementation: a capture-phase keydown on the
 * <en/> container resolves the current data-adv-cell-* coordinate from document.activeElement,
 * <en/> reverse-locates the target cell element and calls .focus. Real focus movement makes the
 * <en/> existing focusin pipeline emit cellFocused automatically — zero new event code.
 * <en/> Scroll-follow: default mode uses scrollIntoView(nearest); virtual mode delegates to the
 * <en/> renderer's scrollToRow/scrollToColumn (scroll first when the row is not rendered, multi-level
 * <en/> focus retries: nextTick x2 + rAF fallback).
 * <en/> Guards: never hijacks keys while an editor owns focus (input/textarea/contenteditable);
 * <en/> modifier combos are ignored, reserved for future Shift+Arrow range extension.
 */
export interface UseGridNavigationOptions {
  /** <zh/> 事件委托容器（adv-table 根元素） | <en/> delegation container (the adv-table root element) */
  containerRef: Ref<HTMLElement | null>
  /** <zh/> 功能开关 | <en/> feature switch */
  enabled?: MaybeRefOrGetter<boolean>
  /**
   * <zh/> 渲染器能力表——滚动跟随只查 `scrollFollow`，不询问渲染模式布尔量。
   * <en/> Renderer capability table — scroll-follow queries `scrollFollow` only, never the render-mode boolean.
   */
  caps: MaybeRefOrGetter<Pick<RendererCaps, 'scrollFollow'>>
  /** <zh/> 行虚拟化时的滚动跟随（activeRenderer.scrollToRow） | <en/> scroll-follow under row virtualization (activeRenderer.scrollToRow) */
  scrollToRow?: MaybeRefOrGetter<((target: number) => boolean) | undefined>
  /** <zh/> 行虚拟化时的滚动跟随（activeRenderer.scrollToColumn） | <en/> scroll-follow under row virtualization (activeRenderer.scrollToColumn) */
  scrollToColumn?: MaybeRefOrGetter<((target: number) => boolean) | undefined>
  /**
   * <zh/> 主网格查询域选择器——将反向查找收窄到主网格，
   * <zh/> 避免钉住条带/汇总区复制属性造成的误命中（由 DOM 适配器供给）
   * <en/> main-grid scope selector — narrows reverse lookup so pinned-strip/summary duplicates
   * <en/> cannot be hit (supplied by the DOM adapter)
   */
  scopeSelector?: MaybeRefOrGetter<string | undefined>
  /** <zh/> 范围选择键盘扩展（Shift+Arrow）——来自 useCellRangeSelection | <en/> range-selection keyboard extension (Shift+Arrow) — from useCellRangeSelection */
  keyboardRange?: {
    extendTo: (coord: CellCoord) => void
    finishSelection: () => void
  }
  /**
   * <zh/> 列数（声明式首选）——传入后 End/PageDown 钳制不再全量查询 DOM
   * <en/> Column count (declarative preferred) — End/PageDown clamping skips full DOM queries when provided
   */
  columnCount?: MaybeRefOrGetter<number>
  /**
   * <zh/> 行数（声明式首选）——传入后 PageDown/PageUp 翻页不再依赖 DOM 探测
   * <en/> Row count (declarative preferred) — PageDown/PageUp paging skips DOM probing when provided
   */
  rowCount?: MaybeRefOrGetter<number>
  columnIndexes?: MaybeRefOrGetter<readonly number[]>
  isRowNavigable?: (rowIndex: number) => boolean
}

export interface UseGridNavigationReturn {
  /** <zh/> 供测试与调试：解析下一次导航的目标坐标 | <en/> for tests/debug: resolve the next navigation target coord */
  resolveNextCoord: (current: CellCoord, key: string) => CellCoord
}

const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== 'function')
    return false
  if (el.isContentEditable)
    return true
  return el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]') != null
}

/**
 * <zh/> 方向键网格导航 composable——在容器捕获阶段监听方向键/Home/End/PageUp/PageDown，驱动单元格焦点移动与滚动跟随（详见文件头说明）。
 * <en/> Arrow-key grid navigation composable — listens at the container capture phase for arrow/Home/End/Page
 * <en/> keys, driving cell focus movement with scroll following (see the file header for details).
 *
 * @param options - <zh/> 导航依赖（委托容器、功能开关、渲染器能力与滚动委托、行列数等） | <en/> Navigation deps (delegation container, feature switch, renderer caps and scroll delegation, row/column counts, etc.)
 * @returns <zh/> 含 resolveNextCoord（供测试与调试解析目标坐标） | <en/> Includes resolveNextCoord for tests/debug target-coord resolution
 */
export function useGridNavigation(options: UseGridNavigationOptions): UseGridNavigationReturn {
  let boundEl: HTMLElement | null = null

  function resolveNextCoord(current: CellCoord, key: string): CellCoord {
    const attrs = logicalColumns()
    const currentAttr = current.columnIndex
    const currentLogical = attrs ? attrs.indexOf(currentAttr) : currentAttr
    const width = attrs ? attrs.length : undefined
    const nextLogical = (delta: number) => clampLogicalColumn(currentLogical + delta)
    switch (key) {
      case 'ArrowUp': {
        const row = skipToNavigableRow(current.rowIndex - 1, -1)
        return row == null ? current : { rowIndex: row, columnIndex: currentAttr }
      }
      case 'ArrowDown': {
        const row = skipToNavigableRow(current.rowIndex + 1, 1)
        return row == null ? current : { rowIndex: row, columnIndex: currentAttr }
      }
      case 'ArrowLeft':
        return { rowIndex: current.rowIndex, columnIndex: attrForLogicalColumn(nextLogical(-1)) }
      case 'ArrowRight':
        return { rowIndex: current.rowIndex, columnIndex: attrForLogicalColumn(nextLogical(1)) }
      case 'Home':
        return { rowIndex: current.rowIndex, columnIndex: attrForLogicalColumn(0) }
      case 'End':
        // <zh/> End 需要行内列数——声明式 columnCount 优先，否则由调用方以"目标元素是否存在"自然钳制
        // <en/> End needs the row's column count — declarative columnCount first, else naturally clamped by "target exists"
        return { rowIndex: current.rowIndex, columnIndex: attrForLogicalColumn(width == null ? Number.MAX_SAFE_INTEGER : width - 1) }
      case 'PageUp':
        // <zh/> 上翻一页（10 行启发值）；声明式 rowCount 到顶钳制
        // <en/> Page up (10-row heuristic); clamped to top with declarative rowCount
        return { rowIndex: Math.max(0, current.rowIndex - 10), columnIndex: currentAttr }
      case 'PageDown':
        // <zh/> 下翻一页（10 行启发值）；声明式 rowCount 到底钳制，未提供时由未命中即停兜底
        // <en/> Page down (10-row heuristic); clamped to bottom with declarative rowCount, else miss-stop fallback
        return { rowIndex: current.rowIndex + 10, columnIndex: currentAttr }
      default:
        return current
    }
  }

  /** <zh/> roving tabindex：焦点格 tabindex=0，其余恢复 -1（无障碍网格入口） | <en/> roving tabindex: focused cell gets tabindex=0, others restored to -1 (a11y grid entry) */
  let rovingCell: HTMLElement | null = null

  function applyRovingTabindex(el: HTMLElement | null): void {
    if (rovingCell && rovingCell !== el)
      rovingCell.setAttribute('tabindex', '-1')
    rovingCell = el
    if (rovingCell)
      rovingCell.setAttribute('tabindex', '0')
  }

  function handleFocusIn(event: FocusEvent): void {
    const el = event.target as HTMLElement | null
    if (el && typeof el.closest === 'function' && el.closest('[data-adv-cell-row][data-adv-cell-col]'))
      applyRovingTabindex(el)
  }

  /**
   * <zh/> End 键的行内列数探测——按同 rowIndex 的属性全量查询取最大 col+1。
   * <zh/> 不能用 closest('[data-adv-cell-row]') 找"行容器"：该属性与列属性盖在同一个
   * <zh/> 单元格元素上，closest 会命中自身导致只统计到 1 列。
   * <en/> Resolve End's in-row column count — scoped query over all cells sharing the rowIndex,
   * <en/> taking max col + 1. Do NOT use closest('[data-adv-cell-row]') to find a "row wrapper":
   * <en/> the row attribute lives on the SAME element as the column attribute, so closest hits the
   * <en/> cell itself and under-counts to a single column.
   */
  function resolveRowColumnCount(current: CellCoord): number {
    // <zh/> 声明式列数优先，避免虚拟窗口外全量 querySelectorAll 竞态与开销
    // <en/> Prefer declarative column count to avoid full querySelectorAll races/cost outside the virtual window
    const declared = toValue(options.columnCount)
    if (typeof declared === 'number' && Number.isFinite(declared) && declared > 0)
      return Math.floor(declared)
    const container = options.containerRef.value
    if (!container)
      return 0
    const root = (toValue(options.scopeSelector) ? container.querySelector<HTMLElement>(toValue(options.scopeSelector)!) : null) ?? container
    let max = -1
    for (const el of root.querySelectorAll<HTMLElement>(`[data-adv-cell-row="${current.rowIndex}"][data-adv-cell-col]`)) {
      const v = Number(el.getAttribute('data-adv-cell-col'))
      if (Number.isFinite(v) && v > max)
        max = v
    }
    return max + 1
  }

  function useVirtualizedScroll(): boolean {
    // <zh/> 能力查询：需滚动跟随时委托渲染器 | <en/> Capability query: delegate to the renderer when scroll-follow is required
    return toValue(options.caps).scrollFollow
  }

  /** <zh/> 声明式列域（逻辑序 → DOM attr 序）；未声明时为 null（两域同构） | <en/> declarative column domain (logical → DOM attr order); null when undeclared (isomorphic domains) */
  function logicalColumns(): readonly number[] | null {
    const declared = toValue(options.columnIndexes)
    return Array.isArray(declared) ? declared : null
  }

  /** <zh/> 行索引是否落在声明的行域内 | <en/> whether a row index lies inside the declared row domain */
  function isInDeclaredRows(rowIndex: number): boolean {
    if (rowIndex < 0)
      return false
    const declaredRows = toValue(options.rowCount)
    if (typeof declaredRows === 'number' && Number.isFinite(declaredRows) && rowIndex >= Math.floor(declaredRows))
      return false
    return true
  }

  /** <zh/> 沿方向跳过合成行；无可用行返回 null | <en/> skip synthetic rows along a direction; null when none available */
  function skipToNavigableRow(rowIndex: number, step: 1 | -1): number | null {
    let index = rowIndex
    while (isInDeclaredRows(index)) {
      if (!options.isRowNavigable || options.isRowNavigable(index))
        return index
      index += step
    }
    return null
  }

  /** <zh/> 逻辑列序 → DOM attr 列 | <en/> logical column ordinal → DOM attr column */
  function attrForLogicalColumn(logicalIndex: number): number {
    const cols = logicalColumns()
    if (!cols)
      return logicalIndex
    return cols[logicalIndex] ?? -1
  }

  /** <zh/> 逻辑列钳制；域未声明时按声明列数钳制 | <en/> clamp a logical column; falls back to the declared column count */
  function clampLogicalColumn(logicalIndex: number): number {
    const cols = logicalColumns()
    const declared = toValue(options.columnCount)
    const upper = cols
      ? cols.length - 1
      : (typeof declared === 'number' && Number.isFinite(declared) && declared > 0 ? Math.floor(declared) - 1 : Number.MAX_SAFE_INTEGER)
    return Math.min(Math.max(logicalIndex, 0), upper)
  }

  function focusCoord(coord: CellCoord, retries = 2): void {
    const container = options.containerRef.value
    if (!container)
      return
    const el = findCellElement(container, coord.rowIndex, coord.columnIndex, toValue(options.scopeSelector))
    if (el) {
      // <zh/> 先滚后焦：nearest 保证不产生多余滚动；preventScroll 避免与浏览器原生滚动冲突。
      // <zh/> roving 显式应用——不依赖宿主是否为 programmatic focus 派发 focusin（环境差异）。
      // <en/> Scroll before focus: nearest avoids redundant scrolling; preventScroll avoids native-scroll
      // <en/> conflicts. Roving is applied EXPLICITLY — never rely on the host dispatching focusin
      // <en/> for programmatic focus (environment-dependent).
      if (!useVirtualizedScroll())
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      applyRovingTabindex(el)
      el.focus({ preventScroll: true })
      return
    }

    // <zh/> 目标未渲染（virtual 化窗口外）→ 委托渲染器滚动后重试：前两次走 nextTick（小跳转首帧即达），
    // <zh/> 最后一次改走 rAF——跨数千行的大数据跳转首帧（nextTick）可能仍未渲染，单次 nextTick 即永久失焦。
    // <en/> Target not rendered (outside the virtualized window) → delegate scrolling and retry: the first
    // <en/> passes ride nextTick (short jumps land on the first frame); the last pass rides rAF — a
    // <en/> thousands-of-rows jump may still be unrendered on the first frame, where a single nextTick
    // <en/> retry used to lose focus permanently.
    if (retries > 0 && useVirtualizedScroll()) {
      toValue(options.scrollToRow)?.(coord.rowIndex)
      toValue(options.scrollToColumn)?.(coord.columnIndex)
      const again = () => focusCoord(coord, retries - 1)
      if (retries === 1 && typeof requestAnimationFrame === 'function')
        requestAnimationFrame(again)
      else
        void nextTick(again)
    }
  }

  /** <zh/> Shift 松开 → 提交键盘范围选区（镜像 mouseup 尾段） | <en/> Shift release → commit the keyboard range selection (mirrors the mouseup tail) */
  function handleKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Shift')
      options.keyboardRange?.finishSelection()
  }

  function handleKeyDown(event: KeyboardEvent): void {
    // <zh/> Tab-on-container：容器自身获得焦点（无障碍入口）时，Tab 聚焦首格而非离开
    // <en/> Tab on the container itself (a11y entry) focuses the first cell instead of leaving
    const targetEl = event.target as HTMLElement | null
    const isForwardTab = event.key === 'Tab' && !event.shiftKey
    if (isForwardTab && targetEl && options.containerRef.value && targetEl === options.containerRef.value) {
      const firstRow = skipToNavigableRow(0, 1)
      if (firstRow == null)
        return
      event.preventDefault()
      focusCoord({ rowIndex: firstRow, columnIndex: attrForLogicalColumn(0) })
      return
    }

    if (!NAV_KEYS.has(event.key))
      return
    if (isEditableTarget(event.target))
      return

    // SSR 环境无 document，直接退出键盘导航
    // Without document in SSR, exit keyboard navigation directly
    if (typeof document === 'undefined')
      return
    const active = document.activeElement as HTMLElement | null
    const current = active ? findCellCoord(active) : null
    // <zh/> 焦点不在任何单元格上时不启动导航（保持行为可预测）
    // <en/> Do not start navigating while focus sits outside any cell (predictable behavior)
    if (!current)
      return

    // <zh/> Shift+Arrow 需要注入键盘桥接；未注入时忽略（不与潜在的其他处理器抢按键）
    // <zh/> Ctrl/⌘+Home/End 为表格级跳转，显式放行；其余修饰键组合不劫持
    // <en/> Shift+Arrow requires the injected keyboard bridge; ignored without one (never fights other handlers)
    // <en/> Ctrl/Cmd+Home/End are table-level jumps and pass explicitly; other modifier combos are ignored
    const isJumpToEdge = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && (event.key === 'Home' || event.key === 'End')
    if (event.shiftKey) {
      if (!options.keyboardRange)
        return
    }
    else if (!isJumpToEdge && (event.ctrlKey || event.metaKey || event.altKey)) {
      return
    }

    let next = resolveNextCoord(current, event.key)
    if (isJumpToEdge) {
      // <zh/> 跳转首/末行首列；声明式 rowCount 到界钳制
      // <en/> Jump to the first/last row first column; clamped with declarative rowCount
      const declaredRows = toValue(options.rowCount)
      const firstRow = skipToNavigableRow(0, 1)
      const lastCandidate = typeof declaredRows === 'number' && Number.isFinite(declaredRows) && declaredRows > 0
        ? Math.floor(declaredRows) - 1
        : current.rowIndex
      const lastRow = lastCandidate >= 0 ? skipToNavigableRow(lastCandidate, -1) : null
      next = { rowIndex: event.key === 'Home' ? (firstRow ?? 0) : (lastRow ?? current.rowIndex), columnIndex: attrForLogicalColumn(0) }
    }
    else if ((event.key === 'Home' || event.key === 'End') && !event.shiftKey) {
      if (logicalColumns()) {
        next = { rowIndex: current.rowIndex, columnIndex: attrForLogicalColumn(event.key === 'Home' ? 0 : (logicalColumns()!.length - 1)) }
      }
      else {
        const colCount = resolveRowColumnCount(current)
        if (colCount === 0)
          return
        next = { rowIndex: current.rowIndex, columnIndex: Math.min(next.columnIndex, colCount - 1) }
      }
    }
    else if ((event.key === 'PageUp' || event.key === 'PageDown') && !event.shiftKey) {
      // <zh/> 翻页到底/到顶钳制；虚拟窗口外由 focusCoord 的滚动重试兜底
      // <en/> Clamp paging to top/bottom; outside the virtual window focusCoord scroll-retry covers it
      const declaredRows = toValue(options.rowCount)
      if (typeof declaredRows === 'number' && Number.isFinite(declaredRows) && declaredRows > 0) {
        const lastRow = Math.floor(declaredRows) - 1
        next = { rowIndex: Math.min(Math.max(next.rowIndex, 0), lastRow), columnIndex: next.columnIndex }
      }
      else if (next.rowIndex < 0) {
        return
      }
    }

    if (!event.shiftKey) {
      if (next === current || next.rowIndex < 0 || next.columnIndex < 0 || !isInDeclaredRows(next.rowIndex))
        return

      event.preventDefault()
      focusCoord(next)
      return
    }

    // <zh/> Shift+Arrow：扩展范围选择——锚定当前格并推进焦点格；DOM 焦点同步移动以保持
    // <zh/> 键盘可达性与滚动跟随。目标不存在（virtual 窗口外）则不推进。
    // <en/> Shift+Arrow: extend the range selection — anchor at the current cell and advance the
    // <en/> focus cell; DOM focus moves in sync for a11y and scroll-follow. Skip when the target
    // <en/> does not exist (outside the virtualized window).
    if (next.rowIndex < 0 || next.columnIndex < 0)
      return
    const container = options.containerRef.value
    if (!container || !findCellElement(container, next.rowIndex, next.columnIndex, toValue(options.scopeSelector)))
      return

    event.preventDefault()
    options.keyboardRange!.extendTo(current)
    options.keyboardRange!.extendTo(next)
    focusCoord(next)
  }

  function bind(el: HTMLElement | null): void {
    if (boundEl === el)
      return
    if (boundEl) {
      boundEl.removeEventListener('keydown', handleKeyDown, true)
      boundEl.removeEventListener('keyup', handleKeyUp, true)
      boundEl.removeEventListener('focusin', handleFocusIn, true)
    }
    boundEl = el
    if (boundEl) {
      boundEl.addEventListener('keydown', handleKeyDown, true)
      boundEl.addEventListener('keyup', handleKeyUp, true)
      boundEl.addEventListener('focusin', handleFocusIn, true)
      // <zh/> 无障碍网格入口：容器可聚焦，Tab 进入后由 keydown 分支跳到首格（roving tabindex 接管）
      // <en/> 1y grid entry: the container is focusable; Tab lands here and the keydown branch jumps to the first cell (roving tabindex takes over)
      if (!boundEl.hasAttribute('tabindex'))
        boundEl.setAttribute('tabindex', '0')
    }
  }

  watch(
    [options.containerRef, () => toValue(options.enabled)],
    ([el, enabled]) => bind(enabled ? el : null),
    { immediate: true },
  )

  onBeforeUnmount(() => bind(null))
  onDeactivated(() => bind(null))
  onActivated(() => {
    const el = options.containerRef.value
    if (el && toValue(options.enabled))
      bind(el)
  })

  return { resolveNextCoord }
}
