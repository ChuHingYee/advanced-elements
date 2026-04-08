import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { AdvTableEmitFn, ProcessedColumn } from '../../types'
import type { ColumnConfig, RowConfig } from '../../types/config'
import type { ColumnContext, RendererContext, RowContext } from '../../types/orchestrator-context'
import type { AdvTableProps } from '../../types/table-props'
import { useElementSize } from '@vueuse/core'
import { computed, ref, toValue, watch } from 'vue'
import { isAppendRowData } from '../../components/table-virtual-renderer/append-row-helpers'
import { devWarn } from '../../utils/dev-warn'
import { getColumnKey } from '../../utils/shared'
import { createTableEmitter } from '../../utils/table-emitter'
import { isSyntheticRow } from '../../utils/total-rows'
import { useCellRangeSelection } from '../interaction/use-cell-range-selection'
import { useDragOrchestrator } from '../interaction/use-drag-orchestrator'
import { useModifierKeyTracker } from '../interaction/use-modifier-key-tracker'
import { useRenderErrorBoundary } from '../rendering/use-render-error-boundary'
import { useGridNavigation } from './use-grid-navigation'

/**
 * <zh/> 交互编排器输入
 *
 * <zh/> 通过 extends 组合三个窄域接口（RowContext / ColumnContext / RendererContext），
 * <zh/> 使行/列/渲染器依赖一目了然；下方按域分区声明交互编排器专有字段。
 *
 * <en/> Interaction orchestrator input.
 *
 * <en/> Composes three narrow domain interfaces via extends (RowContext / ColumnContext / RendererContext),
 * <en/> making row/column/renderer dependencies explicit; interaction-specific fields are declared below grouped by domain.
 */
export interface UseInteractionOrchestratorOptions<T> {
  // ── 行上下文（显式组合替代 extends，恢复 IDE 跳转；字段与 RowContext<T> 同构） ──
  /** <zh/> 行键函数 | <en/> Row key function */
  rowKeyFn: RowContext<T>['rowKeyFn']
  /** <zh/> 表格行数据 | <en/> Table row data */
  tableData: RowContext<T>['tableData']
  /** <zh/> 行键元信息 | <en/> Row key metadata */
  rowKeyMeta: RowContext<T>['rowKeyMeta']
  // ── 列上下文（字段与 ColumnContext 同构） ──
  /** <zh/> 本地处理后的列集合 | <en/> Locally processed column collection */
  localColumns: ColumnContext['localColumns']
  /** <zh/> 列更新器 | <en/> Column updater */
  setColumns: ColumnContext['setColumns']
  // ── 渲染器上下文（字段与 RendererContext 同构） ──
  /** <zh/> 表格实例标识 | <en/> Table instance identifier */
  tableId: RendererContext['tableId']
  /** <zh/> 渲染器能力表 | <en/> Renderer capability table */
  caps: RendererContext['caps']
  /** <zh/> 渲染器 DOM 适配器 | <en/> Renderer DOM adapter */
  dom: RendererContext['dom']
  /** <zh/> 活动渲染器实例引用 | <en/> Active renderer instance reference */
  activeRenderer: RendererContext['activeRenderer']
  // ── 核心配置 | Core config ──
  mergedSizeConfig: ComputedRef<{ rowHeight: number }>
  mergedRowConfig: ComputedRef<RowConfig<T>>
  mergedColumnConfig: ComputedRef<ColumnConfig<T>>

  // ── 交互域 | Interaction domain ──
  /** <zh/> 范围选择配置 | <en/> Range selection config */
  rangeSelection: MaybeRefOrGetter<AdvTableProps<T>['rangeSelection']>
  reorderData: (newData: T[]) => void

  // ── 数据管线 | Data pipeline ──
  /**
   * <zh/> 渲染域数据（pin 启用时已剔除固定行）——**交互域解析 DOM 行列坐标的唯一行域**。
   *
   * <zh/> 为什么不是 `visibleData`：交互域消费的 `data-adv-cell-row` / `rowIndex` 全部来自渲染器
   * <zh/> 实际绘制的行，而 `visibleData` 是 pin 前的分页切片；两者在 Row Pinning 启用时相差固定行数，
   * <zh/> 用 `visibleData[rowIndex]` 会解析到相邻若干行之外的行（错行滚动/错行 TSV）。
   * <zh/> 行虚拟化渲染器的事件域即 `renderData`（== virtualData）；default 渲染器恒有 DOM 元素命中，
   * <zh/> 不经由此处的下标解析。口径归属见 `docs/ownership-matrix.md`。
   *
   * <en/> Render-domain data (pinned rows removed when pinning is on) — the **single row domain** for
   * <en/> resolving DOM row/column coordinates inside the interaction domain.
   *
   * <en/> Why not `visibleData`: every `data-adv-cell-row` / `rowIndex` consumed here comes from the rows the
   * <en/> renderer actually drew, whereas `visibleData` is the pre-pin page slice; with Row Pinning enabled they
   * <en/> differ by the pinned-row count, so `visibleData[rowIndex]` resolves to a row several positions away
   * <en/> (wrong-row scrolling / wrong-row TSV). For a row-virtualized renderer the event domain IS `renderData`
   * <en/> (== virtualData); the default renderer always hits a DOM element and never resolves through this index.
   * <en/> Caliber ownership: see `docs/ownership-matrix.md`.
   */
  renderData: ComputedRef<T[]>
  effectiveColumns: Ref<ProcessedColumn[]>

  // ── 事件 | Events ──
  emit: AdvTableEmitFn
  /**
   * <zh/> 编辑会话探测——透传至拖拽编排，有会话时禁用行拖拽 | <en/> Editing-session probe — forwarded to drag orchestration
   */
  isEditing?: MaybeRefOrGetter<boolean>
  /**
   * <zh/> 编辑冲突提示 | <en/> Edit-conflict hook
   */
  onEditConflict?: () => void
}

/**
 * <zh/> 交互编排——键盘导航、错误边界、容器可见性，并委托拖拽与范围选择给专用编排器。
 *
 * <en/> Interaction orchestration — keyboard navigation, error boundary, container visibility,
 * <en/> delegating drag and range selection to dedicated orchestrators.
 * @remarks
 * <zh/> 拆分后职责更清晰：拖拽逻辑见 {@linkcode useDragOrchestrator}，范围选择见 {@linkcode useRangeSelectionOrchestrator}。
 * <en/> Responsibilities are clearer after splitting: drag logic in {@linkcode useDragOrchestrator}, range selection in {@linkcode useRangeSelectionOrchestrator}.
 */
export type UseInteractionOrchestratorReturn = ReturnType<typeof useInteractionOrchestrator<any>>

/**
 * <zh/> 交互编排 composable——汇聚键盘导航、错误边界、容器可见性/尺寸，并委托拖拽与范围选择给专用编排器。
 * <en/> Interaction orchestration composable — unifies keyboard navigation, error boundary and container
 * <en/> visibility/size, delegating drag and range selection to dedicated orchestrators.
 *
 * @param options - <zh/> 行/列/渲染器上下文与交互配置的窄切片 | <en/> Row/column/renderer context and interaction config slices
 * @returns <zh/> 交互域状态与方法集合（拖拽、范围选择、键盘导航等） | <en/> Interaction-domain state and methods (drag, range selection, keyboard navigation, etc.)
 */
export function useInteractionOrchestrator<T>(options: UseInteractionOrchestratorOptions<T>) {
  const {
    caps,
    dom,
    tableId,
    mergedSizeConfig,
    mergedRowConfig,
    mergedColumnConfig,
    rangeSelection,
    tableData,
    rowKeyFn,
    rowKeyMeta,
    reorderData,
    localColumns,
    setColumns,
    activeRenderer,
    renderData,
    effectiveColumns,
    emit,
    isEditing,
    onEditConflict,
  } = options

  const tableEmit = createTableEmitter(emit, tableId)

  const { tableRootRef: _tableRootRef, shiftKeyPressed, noSelectClass } = useModifierKeyTracker()

  const { hasError: rendererHasError, errorInfo: rendererErrorInfo, reset: resetRendererError } = useRenderErrorBoundary({
    onError: e => tableEmit('error', e),
  })

  /**
   * <zh/> 错误边界自动恢复：数据引用变化（刷新/分页/reload）时重置兜底态，
   * <zh/> 消除"一次渲染异常永久置换兜底 UI"的锁死路径。
   * <zh/> 注意：之前使用 `rows.length > 0` 守卫，导致空数据+渲染错误时不恢复——
   * <zh/> 现改为引用变化检测，包括从有数据到空数据的场景。
   * <en/> Auto-recover the error boundary: reset the fallback state on data reference
   * <en/> changes (refresh/pagination/reload), removing the permanent-fallback lockout.
   * <en/> Note: previously used `rows.length > 0` guard which prevented recovery on empty data + render error
   * <en/> now uses reference change detection, including the case of data transitioning to empty.
   */
  watch(
    () => renderData.value,
    (rows, prevRows) => {
      // 数据引用变化时重置——包括从有数据到空数据的场景
      // Reset on data reference change — including the case of data transitioning to empty
      if (rows !== prevRows && rendererHasError.value) {
        resetRendererError()
      }
    },
  )

  const rendererErrorText = computed(() => {
    const cause = rendererErrorInfo.value?.cause
    if (cause instanceof Error)
      return cause.message
    return cause == null ? '' : String(cause)
  })

  const { width: containerWidth } = useElementSize(_tableRootRef)

  const _deactivatedOverride = ref(false)

  const isContainerVisible = computed(() => containerWidth.value > 0 && !_deactivatedOverride.value)

  /**
   * <zh/> 切换 deactivated 状态——封装内部 ref 的修改，避免外部直接操作 ref.value
   * <zh/> 用于 KeepAlive onActivated/onDeactivated 时控制容器可见性
   * <en/> Toggle deactivated state — encapsulates internal ref mutation, avoiding external direct ref.value manipulation
   * <en/> Used by KeepAlive onActivated/onDeactivated to control container visibility
   * @param value - <zh/> true 表示进入 deactivated（视为不可见），false 表示恢复 | <en/> true for deactivated (treat as invisible), false to restore
   */
  function setDeactivated(value: boolean) {
    _deactivatedOverride.value = value
  }

  // <zh/> 不再将 props 全量传递给子编排器，仅传递所需字段
  // <en/> No longer passes full props to child orchestrators, only the needed fields
  const { dragLocator, isRowDragging } = useDragOrchestrator<T>({
    caps,
    dom,
    tableId,
    mergedSizeConfig,
    mergedRowConfig,
    mergedColumnConfig,
    tableData,
    rowKeyFn,
    rowKeyMeta,
    reorderData,
    localColumns,
    setColumns,
    activeRenderer,
    emit,
    // <zh/> 有编辑会话时拖拽禁用——窄探测器透传 | <en/> disable drag while editing — narrow probe passthrough
    isEditing,
    onEditConflict,
  })

  // <zh/> 内联范围选择逻辑（原 use-range-selection-orchestrator 薄包装已移除）
  // <en/> Inlined range selection logic (former use-range-selection-orchestrator thin wrapper removed)
  const isRangeSelectionEnabled = computed(() => {
    const rs = toValue(rangeSelection)
    if (rs === true)
      return true
    if (rs && typeof rs === 'object')
      return rs.enabled === true
    return false
  })

  const rangeSelectionAutoCopy = computed(() => {
    const rs = toValue(rangeSelection)
    if (rs && typeof rs === 'object')
      return rs.autoCopy ?? false
    return false
  })

  /**
   * <zh/> v2 事件域列序 → cells 域列索引的映射表（仅 virtual 模式需要）。
   *
   * <zh/> 该解析在拖框选区期间按"每个 mousemove × 每个可见单元格"频率被调用，
   * <zh/> 原实现每次执行 3 次 filter + 1 次 findIndex（4 次全数组遍历）——50 列 × 40 可见行的
   * <zh/> 一次拖选即产生每帧上万次遍历。改为按列配置缓存映射，列配置变化时才重算，
   * <zh/> resolver 退化为一次 Map 查找。
   *
   * <en/> Map from the v2 EVENT-domain column order to cells-domain column indices (virtual mode only).
   *
   * <en/> This resolver runs at "one call per mousemove × per visible cell" frequency while
   * <en/> drag-selecting; the previous implementation performed 3 filters + 1 findIndex (4 full
   * <en/> array traversals) per call — tens of thousands of traversals per frame for 50 columns ×
   * <en/> 40 visible rows. The mapping is now cached against the column config and recomputed only
   * <en/> when columns change, reducing the resolver to a single Map lookup.
   */
  const interactionDomain = computed(() => {
    const domain = activeRenderer.value?.getInteractionDomain?.()
    // <zh/> virtual（columnDomain: 'event'）下渲染器未就绪/方法缺失时，整条翻译链退化为
    // <zh/> caps 兜底分支且行域同时错位——这正是范围选择「拖拽无反应且无任何报错」的
    // <zh/> 第一现场，dev 必须可见；default（'cells'）两域恒等，兜底即正确路径，不告警。
    // <en/> In virtual mode (columnDomain: 'event'), a missing renderer/method degrades the whole
    // <en/> translation chain to the caps fallback with a misaligned row domain — the first scene
    // <en/> of range selection "drag does nothing, no console output"; dev must see it. In default
    // <en/> mode ('cells') the domains are isomorphic and the fallback IS the correct path.
    if (!domain && toValue(caps).columnDomain === 'event')
      devWarn('[AdvTable] virtual interaction domain unavailable (renderer not ready?) — range selection falls back to caps.columnDomain; expect no highlight until the renderer mounts.', { tableId: tableId.value })
    return domain
  })
  const interactionRows = computed(() => (interactionDomain.value?.rows ?? renderData.value) as T[])
  const interactionColumns = computed(() => interactionDomain.value?.columns ?? effectiveColumns.value.filter(c => c.selection !== true))
  const interactionColumnIndexes = computed(() => {
    if (interactionDomain.value)
      return interactionDomain.value.columnIndexes
    const cols = interactionColumns.value
    if (toValue(caps).columnDomain === 'cells')
      return cols.map((_, index) => index)
    const order = [...effectiveColumns.value.filter(c => c.selection === true), ...cols.filter(c => !c.fixed), ...cols.filter(c => c.fixed)]
    const byKey = new Map(order.map((col, index) => [getColumnKey(col), index]))
    return cols.map(col => byKey.get(getColumnKey(col)) ?? -1)
  })

  const virtualColumnIndexMap = computed<Map<number, number> | null>(() => {
    if (interactionDomain.value)
      return new Map(interactionColumnIndexes.value.map((attr, index) => [attr, index]))
    // <zh/> 能力查询：事件域列序与 cells 域不同构时需 key 映射翻译；
    // <zh/> 同构返回 null（调用方恒等）。
    // <en/> Capability query: translate via key map when the event-domain column order is not
    // <en/> isomorphic to the cells domain; null means isomorphic (callers use identity).
    if (toValue(caps).columnDomain === 'cells')
      return null
    const cellsCols = effectiveColumns.value.filter(c => c.selection !== true)
    const cellsIndexByKey = new Map<string, number>()
    cellsCols.forEach((col, index) => cellsIndexByKey.set(getColumnKey(col), index))
    const selectionCols = effectiveColumns.value.filter(c => c.selection === true)
    const nonFixed = cellsCols.filter(c => !c.fixed)
    const fixed = cellsCols.filter(c => c.fixed)
    const attrOrder = [...selectionCols, ...nonFixed, ...fixed]
    const map = new Map<number, number>()
    attrOrder.forEach((col, attrCol) => {
      map.set(attrCol, cellsIndexByKey.get(getColumnKey(col)) ?? -1)
    })
    return map
  })

  const {
    isSelecting: isRangeSelecting,
    currentRange: rangeSelectionRange,
    isCellSelected: isCellInRangeSelection,
    copySelectionToClipboard,
    lastSelection: rangeLastSelection,
    extendTo: extendRangeSelectionTo,
    finishSelection: finishRangeSelection,
  } = useCellRangeSelection<T>({
    containerRef: _tableRootRef,
    // <zh/> 观察范围收窄选择器由 DOM 适配器供给（本编排器不持有 EP 类名字符串）
    // <en/> The scope-narrowing selector comes from the DOM adapter (this orchestrator holds no EP class-name string)
    dom,
    // <zh/> 范围选择的行域必须是渲染域（DOM 单元格坐标由渲染器产出）——pin 启用时 visibleData 会错行
    // <en/> The range-selection row domain must be the render domain (DOM cell coords come from the renderer)
    // <en/> visibleData would resolve to the wrong rows when pinning is on
    data: interactionRows,
    columns: interactionColumns,
    /**
     * <zh/> v2 列域翻译器——v2 的 data-adv-cell-col 是事件域 [selection, nonFixed, fixed]
     * <zh/> （与 default 事件载荷跨模式一致），而范围选择的矩形列轴 / isCellSelected /
     * <zh/> TSV 列需要 cells 域（混合序去 selection，与 RowViewModel 一致）。default 两域
     * <zh/> 同构（selection 格 attr=-1），恒等即可；v2 经由列 key 映射翻译。
     * <zh/> 未命中（如 teleport hover 列的边缘组合）返回 -1 = 域外，优雅降级不高亮。
     * <en/> v2 column-domain translator — v2's data-adv-cell-col is the EVENT domain
     * <en/> [selection, nonFixed, fixed] (kept cross-mode consistent with default event
     * <en/> payloads), while the range rect axis / isCellSelected / TSV columns need the cells
     * <en/> domain (mixed order minus selection, matching the RowViewModel). In default mode the
     * <en/> two domains are isomorphic (selection cells carry -1) so identity suffices; v2 maps
     * <en/> through the column key. Misses (edge combos like teleport hover columns) return
     * <en/> -1 = out of domain, degrading gracefully to no highlight.
     */
    columnIndexResolver: (attrCol: number): number => {
      if (attrCol < 0)
        return -1
      const map = virtualColumnIndexMap.value
      if (!map)
        return attrCol
      const cellsCol = map.get(attrCol)
      // <zh/> 未命中即 -1 = 域外：mousedown 的 isValidCoord 直接判负，拖拽静默无法开始。
      // <zh/> 这是「拖拽完全无反应、控制台无提示」的直接机理，dev 必须暴露 attrCol / map 规模 /
      // <zh/> interactionDomain 就绪状态，便于定位列集不同源（selection/fixed/teleport/分组列）。
      // <en/> A miss returns -1 = out of domain: mousedown's isValidCoord rejects outright and the
      // <en/> drag silently never starts. This is the direct mechanism behind "drag does nothing,
      // <en/> no console output"; dev must surface attrCol / map size / interactionDomain readiness
      // <en/> to locate column-set divergence (selection/fixed/teleport/grouped columns).
      if (cellsCol === undefined) {
        devWarn(`[AdvTable] range selection column translation miss: attrCol=${attrCol} mapSize=${map.size} domainReady=${!!interactionDomain.value}`, { tableId: tableId.value })
        return -1
      }
      return cellsCol
    },
    enabled: isRangeSelectionEnabled,
    onRangeSelected(selection) {
      tableEmit('cellRangeSelected', selection)
      if (rangeSelectionAutoCopy.value)
        copySelectionToClipboard()
    },
  })

  // <zh/> 方向键网格导航——委托容器捕获监听，滚动跟随经 activeRenderer 的 scrollToRow/Column。
  // <zh/> virtual 主网格查询域收窄，避免钉住条带/汇总区的同属性单元格被误命中。
  // <en/> Grid arrow-key navigation — delegated capture listener on the root; scroll-follow goes
  // <en/> through activeRenderer's scrollToRow/scrollToColumn. The virtual main-grid scope selector
  // <en/> narrows reverse lookup so pinned-strip/summary duplicates cannot be hit.
  useGridNavigation({
    containerRef: _tableRootRef,
    enabled: true,
    caps,
    // <zh/> 声明式行列数——End/PageDown 钳制走派生值，不再全量查询 DOM
    // <en/> Declarative row/column counts — End/PageDown clamping uses derived values instead of full DOM queries
    columnCount: () => interactionColumns.value.length,
    columnIndexes: interactionColumnIndexes,
    isRowNavigable: (index) => {
      const row = interactionRows.value[index]
      return row != null && !isSyntheticRow(row) && !isAppendRowData(row)
    },
    // <zh/> 行数与行解析同取渲染域——坐标来自渲染器绘制的行，与 renderData 同域
    // <en/> Row count and row resolution share the render domain — coords come from the drawn rows
    rowCount: () => interactionRows.value.length,
    // <zh/> 键盘导航按坐标滚动——此处将渲染域坐标翻译为 rowKey/columnKey 字符串后委托渲染器，
    // <zh/> 公共滚动 API 仅接受字符串键（number 索引已移除）。
    // <en/> Keyboard navigation scrolls by coord — translate render-domain coords into
    // <en/> rowKey/columnKey strings before delegating to the renderer; the public scroll API
    // <en/> accepts string keys only (number indices are gone).
    scrollToRow: () => {
      const renderer = activeRenderer.value
      if (!renderer?.scrollToRow)
        return undefined
      return (rowIndex: number) => {
        const row = interactionRows.value[rowIndex]
        if (row == null)
          return false
        return renderer.scrollToRow!(rowKeyFn.value(row))
      }
    },
    scrollToColumn: () => {
      const renderer = activeRenderer.value
      if (!renderer?.scrollToColumn)
        return undefined
      return (columnIndex: number) => {
        const col = interactionColumns.value[columnIndex]
        if (col == null)
          return false
        return renderer.scrollToColumn!(getColumnKey(col))
      }
    },
    // <zh/> 作用域选择器由 DOM 适配器供给——本编排器不再持有任何 EP 类名字符串
    // <en/> The scope selector comes from the DOM adapter — this orchestrator holds no EP class-name string
    scopeSelector: () => toValue(dom).getScopeSelector(),
    // <zh/> Shift+Arrow 键盘范围扩展——复用鼠标路径的 anchor/focus 状态与提交管线；
    // <zh/> 提交后按 autoCopy 配置自动复制（与鼠标路径的 autoCopy 行为对齐）
    // <en/> Shift+Arrow keyboard range extension — reuses the mouse path's anchor/focus state and
    // <en/> commit pipeline; after commit, copies automatically per autoCopy (aligned with the
    // <en/> mouse path's autoCopy behavior)
    keyboardRange: {
      extendTo: extendRangeSelectionTo,
      finishSelection: () => {
        finishRangeSelection()
        if (rangeSelectionAutoCopy.value)
          void copySelectionToClipboard()
      },
    },
  })

  /**
   * <zh/> 重置交互暂态——模式切换/卸载时的唯一写入口，收敛跨域直写。
   * <zh/> 写权归交互域所有，外部不得直接写 `shiftKeyPressed/isRangeSelecting`。
   * <en/> Reset interaction transient state — the single write entry for mode-switch/unmount, converging cross-domain writes.
   * <en/> Write ownership belongs to the interaction domain; outsiders must not write `shiftKeyPressed/isRangeSelecting` directly.
   */
  function resetInteractionState(): void {
    shiftKeyPressed.value = false
    if (isRangeSelecting.value)
      isRangeSelecting.value = false
  }

  return {
    dragLocator,
    /** <zh/> 行拖拽进行中（虚拟滚动看门狗据此暂停，见 useRowDrag） | <en/> Row drag in progress (the virtual-scroll watchdog pauses on it, see useRowDrag) */
    isRowDragging,
    tableRootRef: _tableRootRef,
    shiftKeyPressed,
    noSelectClass,
    rendererHasError,
    rendererErrorInfo,
    rendererErrorText,
    /** <zh/> 重置渲染错误边界（供 `#error` 插槽 `reset` 透出，用户重试后恢复渲染） | <en/> Reset the render error boundary (exposed as the `#error` slot `reset` for user retry) */
    resetRendererError,
    containerWidth,
    isContainerVisible,
    setDeactivated,
    resetInteractionState,
    isRangeSelecting,
    rangeLastSelection,
    rangeSelectionRange,
    isCellInRangeSelection,
    copySelectionToClipboard,
  }
}
