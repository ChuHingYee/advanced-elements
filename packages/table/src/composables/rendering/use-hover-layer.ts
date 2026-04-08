/**
 * <zh/> Hover 操作层 Composable
 * <en/> Hover action layer composable
 * @remarks
 * <zh/> 抽离两个渲染器共享的 hover 行内层逻辑
 * <en/> Extracts hover inline layer logic shared by both renderers
 *
 * <zh/> Note: 悬浮按钮渲染在 cell 内部，鼠标在按钮上时仍在 cell 的 hover 范围内，
 * 所以不需要额外的 hover 追踪（hoverLayerHovered / 延迟隐藏 / 锚定元素），
 * 表格自带的行/cell 进入/离开事件已足够
 * <en/> Note: Floating buttons are rendered inside the cell, mouse on buttons is still within the cell's hover range,
 * so no additional hover tracking (hoverLayerHovered / delayed hide / anchor element) is needed,
 * the table's built-in row/cell enter/leave events are sufficient
 */
import type { ComputedRef, CSSProperties, MaybeRefOrGetter, Ref } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import type { RowKeyMeta } from '../../types/row-rect'
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, toValue } from 'vue'
import { rowKeyAttrSelector } from '../../utils/row-key-attr'
import { ADV_TABLE_ROW_KEY_ATTR } from '../../utils/table-drag'
import { useHoverMouseTracking } from './use-hover-mouse-tracking'
import { useRowKeyMetaResolver } from './use-row-key-meta-resolver'

/** <zh/> 带 cancel 方法的节流函数 | <en/> Throttled function with cancel capability */
export type ThrottledFn<T extends (...args: any[]) => any> = T & { cancel: () => void }

export interface UseHoverLayerStyleOptions {
  contentWidth: MaybeRefOrGetter<number>
  containerWidth: MaybeRefOrGetter<number>
}

/**
 * <zh/> Hover 层样式组合式函数
 * <en/> Composable for hover layer positioning style
 *
 * @remarks
 * <zh/> 计算 hover 层的绝对定位样式，使其在水平滚动时保持在可视区域内
 * <en/> Calculates hover layer's absolute positioning style, keeping it within the viewport during horizontal scrolling
 * @param options - <zh/> 样式配置 | <en/> style options
 * @returns <zh/> 滚动状态和样式 | <en/> scroll state and style
 */
export function useHoverLayerStyle(options: UseHoverLayerStyleOptions): {
  scrollLeft: Ref<number>
  hoverLayerStyle: ComputedRef<CSSProperties>
  handleScroll: ThrottledFn<(args: { scrollLeft: number }) => void>
} {
  const { contentWidth, containerWidth } = options

  const scrollLeft = ref(0)

  const hoverLayerStyle = computed<CSSProperties>((prev) => {
    const right = Math.max(0, toValue(contentWidth) - toValue(containerWidth) - scrollLeft.value)
    /**
     * <zh/> 限制 action bar 最大宽度为容器可视宽度，防止按钮过多时溢出到容器左边缘之外。
     * <zh/> action bar 的右边缘始终对齐容器可视区域右边缘（由 right 计算），
     * <zh/> 设置 maxInlineSize = containerWidth 后左边缘不会超出容器可视区域左边缘。
     * <zh/> 配合 CSS __btns 的 overflow-x: auto，超出部分在按钮区域内滚动。
     * <en/> Limit action bar max width to container visible width, preventing overflow beyond container's left edge when there are too many buttons.
     * <en/> The action bar's right edge is always aligned with the container's visible right edge (computed via right),
     * <en/> setting maxInlineSize = containerWidth ensures the left edge doesn't exceed the container's visible left edge.
     * <en/> Combined with CSS __btns overflow-x: auto, excess content scrolls within the button area.
     */
    const maxInlineSize = toValue(containerWidth)
    if (prev && prev.right === `${right}px` && prev.maxInlineSize === `${maxInlineSize}px`)
      return prev
    return {
      position: 'absolute',
      top: 0,
      height: '100%',
      right: `${right}px`,
      maxInlineSize: `${maxInlineSize}px`,
    }
  })

  let rafId: number | null = null
  let pendingScrollLeft = 0

  const originalHandleScroll = ({ scrollLeft: sl }: { scrollLeft: number }) => {
    pendingScrollLeft = sl
    rafId ??= requestAnimationFrame(() => {
      scrollLeft.value = pendingScrollLeft
      rafId = null
    })
  }

  const handleScroll = originalHandleScroll as ThrottledFn<typeof originalHandleScroll>
  handleScroll.cancel = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onBeforeUnmount(() => {
    handleScroll.cancel()
  })

  return {
    scrollLeft,
    hoverLayerStyle,
    handleScroll,
  }
}

export interface UseHoverLayerOptions {
  /** <zh/> 低性能档——为 true 时禁用 hover 鼠标追踪安装（performanceProfile=low 降档路径） | <en/> Low performance tier — disables hover mouse tracking installation (performanceProfile=low downgrade path) */
  lowPerformance?: MaybeRefOrGetter<boolean>
  /**
   * <zh/> 当前模式 DOM 适配器——行反查经其 `closestRow`，不再持有 EP 类名字面量。
   * <zh/> 内部链路（useRendererCommon）恒传；外部独立使用时缺省则两处回退查找优雅跳过（主 attr 路径不受影响）。
   * <en/> Current-mode DOM adapter — row reverse lookup goes through its `closestRow`.
   * <en/> Always provided via useRendererCommon internally; standalone external use without it
   * <en/> gracefully skips the two fallback lookups (primary attr paths unaffected).
   */
  dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
  hasHoverOptionColumns: MaybeRefOrGetter<boolean>
  /** 行键元数据（从 table.vue inject）（Row key metadata (injected from table.vue)） */
  rowKeyMeta?: MaybeRefOrGetter<RowKeyMeta>
  data?: MaybeRefOrGetter<readonly any[]>
  rowKey?: MaybeRefOrGetter<(row: any) => string>
  keepAlive?: MaybeRefOrGetter<boolean>
  /**
   * Whether the hover layer is rendered via Teleport (fixed positioning).
   * 悬浮按钮是否通过 Teleport 渲染（fixed 定位）。（When true, delayed hide is used so mouse can move from the row to the hover buttons.）
   * 开启时使用延迟隐藏，允许鼠标从行移动到悬浮按钮上。
   */
  isTeleport?: MaybeRefOrGetter<boolean | undefined>
  /**
   * Table container element ref for detecting mouse-leave.
   * 表格容器元素 ref，用于检测鼠标离开容器时隐藏 hover 层（两种模式共用）。
   */
  containerRef?: MaybeRefOrGetter<HTMLElement | null | undefined>
  handleScroll?: { cancel?: () => void }
  /**
   * <zh/> 滚动状态标志：滚动期间为 true，停止 150ms 后回落 false
   * <en/> Scroll state flag: true during scrolling, falls back to false 150ms after stopping
   * @remarks
   * <zh/> 由 useTeleportRowRect 的 wrappedHandleScroll 维护（两种渲染器共用），
   * 用于在快速滚动时抑制 handleHoverRowEnter / handleHoverRowLeave，
   * 避免频繁重算 RowViewModel 和不必要的 reactivity 级联
   * <en/> Maintained by useTeleportRowRect's wrappedHandleScroll (shared by both renderers),
   * used to suppress handleHoverRowEnter / handleHoverRowLeave during fast scrolling,
   * avoiding frequent RowViewModel recalculation and unnecessary reactivity cascading
   */
  isScrolling?: MaybeRefOrGetter<boolean>
}

/**
 * Hover 操作层组合式函数
 * Composable for hover option layer
 *
 * 管理行 hover 时操作按钮层的显示/隐藏、行锁定和 Teleport 模式下的延迟隐藏。
 * @param options - hover 层配置
 * @returns hover 层状态和方法
 */
export function useHoverLayer(options: UseHoverLayerOptions) {
  const {
    hasHoverOptionColumns,
    rowKeyMeta: providedRowKeyMeta,
    data: providedData,
    rowKey: providedRowKey,
    keepAlive,
    isTeleport,
    containerRef,
    handleScroll,
    isScrolling,
    lowPerformance,
    dom,
  } = options

  /**
   * <zh/> 行反查——经 DOM 适配器，不持有 EP 类名字面量。
   * <zh/> 未传 dom 时返回 null（调用方按“未命中”同等处理，行为与查找失败一致）。
   * <en/> Row reverse lookup — via the DOM adapter, no EP class-name literal.
   * <en/> Returns null without dom (callers treat it as a miss, identical to lookup failure).
   */
  function closestRowEl(el: Element): HTMLElement | null {
    return toValue(dom)?.closestRow(el) ?? null
  }

  /** <zh/> 未提供 isScrolling 时视为 false（不抑制 hover），toValue(undefined) 为 falsy | <en/> When isScrolling is not provided, treat as false (no hover suppression), toValue(undefined) is falsy */
  const scrolling = computed(() => toValue(isScrolling) === true)

  /**
   * <zh/> 行键元数据解析——优先使用注入的 rowKeyMeta，缺失时从 data 构建 fallback Map。
   * <zh/> 详见 use-row-key-meta-resolver.ts（含引用比较跳过 O(n) 重建与运行时断言）。
   *
   * <en/> Row key meta resolver — uses injected rowKeyMeta when available,
   * <en/> builds fallback Maps from data when missing.
   * <en/> See use-row-key-meta-resolver.ts (incl. reference comparison to skip O(n) rebuild and runtime assertion).
   */
  const { rowKeyToIndex, keyToRow, effectiveRowKey } = useRowKeyMetaResolver({
    rowKeyMeta: providedRowKeyMeta,
    data: providedData,
    rowKey: providedRowKey,
  })

  const hoverRowKey = ref<string | null>(null)
  const hoverRowIndex = ref<number>(-1)
  const hoverRowData = shallowRef<any>(null)
  const dismissedRowKeys = shallowRef<Set<string>>(new Set())
  const hoverLayerVisible = ref(false)
  const hoverLayerCollapsed = ref(false)

  let hideTimer: ReturnType<typeof setTimeout> | null = null
  /** Teleport 模式下隐藏延迟（ms）—— 留出鼠标从行移动到 Teleport 按钮层的时间 */
  const TELEPORT_HIDE_DELAY = 100

  const hoverLayerHovered = ref(false)

  /**
   * <zh/> 仅在有 hover 操作列时启用鼠标追踪，用于检测鼠标离开容器时隐藏 hover 层（两种模式共用）。
   * <en/> Enable mouse tracking only when hover option columns exist, used to detect
   * <en/> mouse leaving the container to hide the hover layer (shared by both modes).
   */
  const shouldTrackMouse = computed(() => toValue(hasHoverOptionColumns) && !toValue(lowPerformance))

  /**
   * <zh/> 鼠标追踪——检测鼠标离开容器时隐藏 hover 层，并记录视口坐标供滚动后重新发现 hover 行。
   * <zh/> 仅在有 hover 操作列时启用，详见 use-hover-mouse-tracking.ts。
   *
   * <en/> Mouse tracking — detects mouse leaving the container to hide the hover layer,
   * <en/> and records viewport coords for rediscovering the hover row after scroll.
   * <en/> Enabled only when hover option columns exist. See use-hover-mouse-tracking.ts.
   */
  const {
    lastMouseClientX,
    lastMouseClientY,
    startMouseTracking,
    stopMouseTracking,
  } = useHoverMouseTracking({
    containerRef,
    shouldTrack: shouldTrackMouse,
    /**
     * <zh/> 鼠标离开容器时仅当 hover 层可见才触发隐藏，避免无谓的状态写入。
     * <en/> Only trigger hide when the hover layer is visible, avoiding unnecessary state writes.
     */
    onContainerLeave: () => {
      if (hoverLayerVisible.value) {
        handleHoverRowLeave()
      }
    },
  })

  function clearHideTimer() {
    if (hideTimer != null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  function clearHoverLayerState() {
    hoverRowKey.value = null
    hoverRowIndex.value = -1
    hoverRowData.value = null
  }

  function hideHoverLayerImmediately() {
    clearHideTimer()
    hoverLayerVisible.value = false
    clearHoverLayerState()
    // <zh/> hover 层被卸载时 mouseleave 不会触发，标志必须在此复位，
    // <zh/> 否则下次 handleHoverRowLeave 的延迟隐藏分支永不执行（hover 层卡死）。
    // <en/> An unmounted hover layer won't fire mouseleave, so the flag must reset here —
    // <en/> otherwise the delayed-hide branch never runs again and the layer sticks.
    hoverLayerHovered.value = false
  }

  function isRowDismissed(key: string) {
    return dismissedRowKeys.value.has(key)
  }

  function pruneDismissedRowKeys() {
    if (dismissedRowKeys.value.size === 0)
      return

    const nextKeys = [...dismissedRowKeys.value].filter(key => rowKeyToIndex.value.has(key))
    if (nextKeys.length !== dismissedRowKeys.value.size) {
      dismissedRowKeys.value = new Set(nextKeys)
    }
  }

  function toggleHoverLayerCollapse(event: Event) {
    event.stopPropagation()
    hoverLayerCollapsed.value = !hoverLayerCollapsed.value
  }

  function syncHoverLayerState() {
    pruneDismissedRowKeys()

    if (!toValue(hasHoverOptionColumns)) {
      hideHoverLayerImmediately()
      return
    }

    if (hoverRowKey.value == null)
      return

    if (isRowDismissed(hoverRowKey.value)) {
      hideHoverLayerImmediately()
      return
    }

    const mapped = rowKeyToIndex.value.get(hoverRowKey.value)
    if (mapped == null) {
      hideHoverLayerImmediately()
      return
    }

    hoverRowIndex.value = mapped
    hoverRowData.value = keyToRow.value.get(hoverRowKey.value) ?? null
  }

  function resolveRowIndex(row: any, fallbackIndex = -1): number {
    if (fallbackIndex >= 0)
      return fallbackIndex

    const key = String(effectiveRowKey.value(row))
    const mapped = rowKeyToIndex.value.get(key)
    if (mapped != null)
      return mapped

    const currentData = toValue(providedData)
    if (!currentData)
      return -1
    const byRef = currentData.findIndex(item => item === row)
    if (byRef >= 0)
      return byRef

    return currentData.findIndex(item => String(effectiveRowKey.value(item)) === key)
  }

  function handleHoverRowEnter(row: any, fallbackIndex: number) {
    if (!toValue(hasHoverOptionColumns))
      return
    /**
     * <zh/> 滚动期间抑制 hover 状态更新
     * <en/> Suppress hover state updates during scrolling
     * @remarks
     * <zh/> 滚动时鼠标跨行会频繁触发 cell-mouse-enter，若每次都写入 hover 状态
     * 会引发不必要的 RowViewModel 重算。滚动停止 150ms 后 scrolling 回落 false，
     * 鼠标移动时 cell-mouse-enter 自然触发恢复 hover。
     * 注意：不抑制 EP 自身的 hover-row 类（EP 内部只重渲染 2 行，开销可控）
     * <en/> During scrolling, mouse crossing rows frequently triggers cell-mouse-enter. Writing hover state every time
     * would cause unnecessary RowViewModel recalculation. After scrolling stops for 150ms, scrolling falls back to false,
     * and cell-mouse-enter naturally triggers hover recovery on mouse movement.
     * Note: does not suppress EP's own hover-row class (EP only re-renders 2 rows internally, overhead is controllable)
     */
    if (scrolling.value)
      return

    clearHideTimer()

    const key = String(effectiveRowKey.value(row))
    if (isRowDismissed(key)) {
      hideHoverLayerImmediately()
      return
    }

    const resolvedIndex = resolveRowIndex(row, fallbackIndex)

    hoverRowKey.value = key
    hoverRowIndex.value = resolvedIndex
    hoverRowData.value = row
    hoverLayerVisible.value = true
  }

  function handleHoverRowLeave() {
    /**
     * <zh/> 滚动期间抑制 hover 状态更新（与 handleHoverRowEnter 对称）
     * <en/> Suppress hover state updates during scrolling (symmetric to handleHoverRowEnter)
     * @remarks
     * <zh/> 滚动时 cell-mouse-leave 频繁触发，若每次都调用 hideHoverLayerImmediately
     * 会设置 4 个响应式 ref，触发不必要的 reactivity 级联。
     * 滚动停止后由 cell-mouse-enter 自然恢复正确的 hover 状态
     * <en/> During scrolling, cell-mouse-leave fires frequently. Calling hideHoverLayerImmediately every time
     * would set 4 reactive refs, triggering unnecessary reactivity cascading.
     * After scrolling stops, cell-mouse-enter naturally restores the correct hover state
     */
    if (scrolling.value)
      return

    // In teleport mode, delay hiding so mouse can move from row to hover buttons
    if (toValue(isTeleport)) {
      clearHideTimer()
      hideTimer = setTimeout(() => {
        // Only hide if mouse is not on the teleport hover layer
        if (!hoverLayerHovered.value) {
          hoverLayerVisible.value = false
          /**
           * <zh/> 释放行数据对象引用，避免页面长时间无交互时单行数据被长期驻留。
           * <zh/> hoverRowKey/hoverRowIndex 为原始值（string/number）无内存开销故保留；
           * <zh/> hoverRowData 可在 syncHoverLayerState 中通过 hoverRowKey + keyToRow Map 重新解析恢复。
           * <en/> Release row data object reference to prevent single row data from lingering during long idle periods.
           * <en/> hoverRowKey/hoverRowIndex are primitives (string/number) with no memory cost so they're kept;
           * <en/> hoverRowData can be re-resolved in syncHoverLayerState via hoverRowKey + keyToRow Map.
           */
          hoverRowData.value = null
        }
        hideTimer = null
      }, TELEPORT_HIDE_DELAY)
      return
    }

    // Non-teleport mode: hide immediately (buttons are inline, mouse is truly leaving)
    hideHoverLayerImmediately()
  }

  let hoverLayerActiveRow: HTMLElement | null = null
  const HOVER_LAYER_ACTIVE_CLASS = 'adv-table__row--hover-layer-active'

  function findRowElementByKey(rowKey: string): HTMLElement | null {
    const container = toValue(containerRef)
    if (!container)
      return null
    /** <zh/> 行 key 标记打在单元格上，需向上找到行元素；选择器经 rowKeyAttrSelector 构造 | <en/> Row-key markers live on cells, so walk up to the row element; selectors are built via rowKeyAttrSelector */
    const cell = container.querySelector<HTMLElement>(rowKeyAttrSelector(rowKey))
    if (!cell)
      return null
    /** <zh/> 经 DOM 适配器反查行元素 | <en/> Row reverse lookup via the DOM adapter */
    return closestRowEl(cell)
  }

  function activateRowHoverClass(rowKey: string) {
    deactivateRowHoverClass()
    const rowEl = findRowElementByKey(rowKey)
    if (rowEl) {
      rowEl.classList.add(HOVER_LAYER_ACTIVE_CLASS)
      hoverLayerActiveRow = rowEl
    }
  }

  function deactivateRowHoverClass() {
    if (hoverLayerActiveRow) {
      hoverLayerActiveRow.classList.remove(HOVER_LAYER_ACTIVE_CLASS)
      hoverLayerActiveRow = null
    }
  }

  /**
   * Teleport 模式下鼠标进入悬浮按钮层时调用。
   * 1. 恢复 hover 层显示（若因定时器隐藏）
   * 2. 给对应行添加 hover 样式（弥补 Teleport 导致 CSS :hover 失效）
   *
   * Called when mouse enters the teleported hover layer.
   * Re-shows hover layer + adds hover class to the row (compensates for lost CSS :hover).
   */
  function handleHoverLayerEnter() {
    hoverLayerHovered.value = true
    clearHideTimer()
    /**
     * 延迟隐藏后 hoverRowData 被置为 null（见 handleHoverRowLeave 的 teleport 分支），
     * 需在此处重解析以恢复渲染数据——渲染器以 `hoverLayerVisible && !!hoverRowData` 守卫，
     * 若不重解析，hover 层虽 visible=true 但因 hoverRowData=null 不显示。
     *
     * After delayed hide, hoverRowData is set to null (see handleHoverRowLeave teleport branch).
     * Re-resolve here to restore render data — the renderer guards on `hoverLayerVisible && !!hoverRowData`,
     * without re-resolving the layer would be visible=true but not shown due to hoverRowData=null.
     */
    syncHoverLayerState()
    /** 行状态仍有效但 hover 层已隐藏时，恢复显示 */
    if (!hoverLayerVisible.value && hoverRowKey.value != null) {
      hoverLayerVisible.value = true
    }
    /** 给对应行添加 hover 样式 */
    if (hoverRowKey.value != null) {
      activateRowHoverClass(hoverRowKey.value)
    }
  }

  /** <zh/> 应在 teleport 模式下由 hover 层的 @mouseleave 调用 | <en/> Should be called from the hover layer's @mouseleave in teleport mode */
  function handleHoverLayerLeave() {
    hoverLayerHovered.value = false
    deactivateRowHoverClass()
    hideHoverLayerImmediately()
  }

  /**
   * <zh/> 滚动停止后重新发现鼠标下方的行并更新 hover 状态。
   * <zh/> Teleport 模式下中键/滚轮滚动后，hoverRowKey 仍指向滚动前的行（isScrolling 守卫阻止了更新），
   * <zh/> 导致 RowActionBar 定位到错误位置或随行滚出可视区域而隐藏。此方法用最近一次鼠标视口坐标
   * <zh/> 通过 elementFromPoint 找到当前鼠标下方的行单元格，直接更新 hover 状态（绕过 scrolling 守卫），
   * <zh/> 随后 useTeleportRowRect 的 updateTeleportRowRect 即可定位到正确的行。
   * <zh/> 调用时机：useTeleportRowRect 的 settle timer 中、isScrolling 置 false 之前，
   * <zh/> 此时 RowActionBar 仍为 visibility:hidden + pointer-events:none，elementFromPoint 会穿透它落到行单元格上。
   * <en/> Re-discovers the row under the cursor after scrolling stops and updates hover state.
   * <en/> In Teleport mode, after middle-button/wheel scroll, hoverRowKey still points to the pre-scroll row
   * <en/> (the isScrolling guard prevented updates), causing RowActionBar to position incorrectly or hide when
   * <en/> the row scrolls out of view. This method uses the last mouse viewport coords with elementFromPoint to
   * <en/> find the row cell currently under the cursor and directly updates hover state (bypassing the scrolling guard),
   * <en/> so the subsequent updateTeleportRowRect in useTeleportRowRect positions the bar at the correct row.
   * <en/> Call timing: inside useTeleportRowRect's settle timer, before isScrolling is set to false, while RowActionBar
   * <en/> still has visibility:hidden + pointer-events:none so elementFromPoint passes through it to the row cell.
   */
  function rediscoverHoverAfterScroll() {
    if (!toValue(hasHoverOptionColumns))
      return
    const container = toValue(containerRef)
    if (!container)
      return
    const x = lastMouseClientX.value
    const y = lastMouseClientY.value
    // <zh/> 尚未收到 mousemove（初值 -1）即发生滚动 → 旧 hover 已不可信，直接隐藏（与"鼠标离开容器隐藏"对齐），
    // <zh/> 而非保留陈旧 hover。
    // <en/> Scroll settled with no mousemove yet (initial -1): the stale hover is untrustworthy — hide it
    // <en/> (aligned with "hide when the mouse leaves the container") instead of keeping it.
    if (x < 0 || y < 0) {
      hideHoverLayerImmediately()
      return
    }
    const rect = container.getBoundingClientRect()
    /** 鼠标已离开容器 → 隐藏 hover 层，交由后续 mousemove 自然恢复 */
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      hideHoverLayerImmediately()
      return
    }
    /** SSR / 非浏览器环境无 document */
    if (typeof document === 'undefined')
      return
    const el = document.elementFromPoint(x, y)
    if (!el)
      return

    /**
     * <zh/> 两步查找行 key：先直接在祖先链中找 [ADV_TABLE_ROW_KEY_ATTR]，
     * <zh/> 若失败则经 DOM 适配器找到行容器，再在行内 querySelector 查找。
     * <zh/>
     * <zh/> 为什么需要两步：
     * <zh/> ADV_TABLE_ROW_KEY_ATTR 设在 span.adv-table__cell 上，它是 td > .cell > span 结构中
     * <zh/> 最内层的子元素。当鼠标位于 td 的 padding 区域或 .cell div 本身时，
     * <zh/> elementFromPoint 返回 td 或 .cell，closest 只搜索祖先链，
     * <zh/> 而 span 是它们的后代而非祖先，因此 closest 返回 null，
     * <zh/> 导致 rediscoverHoverAfterScroll 错误地调用 hideHoverLayerImmediately，
     * <zh/> RowActionBar 永久隐藏，直到用户手动移动鼠标到另一行才能恢复。
     * <zh/>
     * <en/> Two-step row key lookup: first try closest [ADV_TABLE_ROW_KEY_ATTR] on ancestors,
     * <en/> if that fails, find the row container via the DOM adapter, then querySelector within it.
     * <en/>
     * <en/> Why two steps are needed:
     * <en/> ADV_TABLE_ROW_KEY_ATTR is set on span.adv-table__cell, the innermost child in td > .cell > span.
     * <en/> When the mouse is over td's padding area or the .cell div itself,
     * <en/> elementFromPoint returns td or .cell, and closest only searches ancestors,
     * <en/> but span is their descendant, not ancestor, so closest returns null,
     * <en/> causing rediscoverHoverAfterScroll to erroneously call hideHoverLayerImmediately,
     * <en/> permanently hiding RowActionBar until the user manually moves the mouse to another row.
     */
    let cell = (el as HTMLElement).closest<HTMLElement>(`[${ADV_TABLE_ROW_KEY_ATTR}]`)
    if (!cell || !container.contains(cell)) {
      /**
       * <zh/> 回退：经 DOM 适配器找到行容器，再在行内 querySelector 查找带 [ADV_TABLE_ROW_KEY_ATTR] 的元素。
       * <zh/> querySelector 搜索所有后代，不受祖先/后代关系限制。
       * <en/> Fallback: find the row container via the DOM adapter, then querySelector within it
       * <en/> for [ADV_TABLE_ROW_KEY_ATTR]. querySelector searches all descendants.
       */
      const rowEl = closestRowEl(el as HTMLElement)
      if (rowEl && container.contains(rowEl)) {
        cell = rowEl.querySelector<HTMLElement>(`[${ADV_TABLE_ROW_KEY_ATTR}]`)
      }
    }

    /** <zh/> 鼠标在表头/非行区域 → 无可重新发现的行 | <en/> Cursor over the header/non-row area → no re-discoverable row */
    if (!cell || !container.contains(cell)) {
      hideHoverLayerImmediately()
      return
    }
    const key = cell.getAttribute(ADV_TABLE_ROW_KEY_ATTR)
    if (!key)
      return
    if (isRowDismissed(key)) {
      hideHoverLayerImmediately()
      return
    }
    const row = keyToRow.value.get(key)
    if (!row)
      return
    const idx = rowKeyToIndex.value.get(key) ?? -1
    clearHideTimer()
    hoverRowKey.value = key
    hoverRowIndex.value = idx
    hoverRowData.value = row
    hoverLayerVisible.value = true
  }

  function cleanupHoverLayerResources() {
    stopMouseTracking()
    clearHideTimer()
    hideHoverLayerImmediately()
    handleScroll?.cancel?.()
  }

  onBeforeUnmount(cleanupHoverLayerResources)

  onDeactivated(() => {
    cleanupHoverLayerResources()
  })

  /**
   * <zh/> KeepAlive 重新激活时恢复鼠标追踪。
   * <zh/> onDeactivated 已通过 cleanupHoverLayerResources 移除了 useMouseInElement、
   * <zh/> window mousemove 监听和 isOutside watcher。但 setup 不会重跑，
   * <zh/> shouldTrackMouse 的值也未变化，因此 watch 不会重新触发。
   * <zh/> 必须在 onActivated 中手动恢复鼠标追踪，否则 hover 层将永久失效。
   *
   * <zh/> 同时恢复 dismissedRowKeys 修剪与 hover 状态同步——
   * <zh/> onDeactivated 期间行可能被删除或数据变更，pruneDismissedRowKeys 清理无效 key，
   * <zh/> syncHoverLayerState 重新解析 hoverRowData 以确保恢复后 hover 层能正确显示。
   *
   * <en/> Restore mouse tracking when KeepAlive re-activates.
   * <en/> onDeactivated removed useMouseInElement, window mousemove listener,
   * <en/> and isOutside watcher via cleanupHoverLayerResources. But setup doesn't re-run,
   * <en/> and shouldTrackMouse value hasn't changed, so the watch won't re-trigger.
   * <en/> Must manually restore mouse tracking in onActivated, otherwise hover layer is permanently broken.
   *
   * <en/> Also restore dismissedRowKeys pruning and hover state sync
   * <en/> rows may have been deleted or data changed during onDeactivated; pruneDismissedRowKeys clears stale keys,
   * <en/> syncHoverLayerState re-resolves hoverRowData so the hover layer displays correctly after reactivation.
   */
  onActivated(() => {
    if (shouldTrackMouse.value) {
      startMouseTracking()
    }
    /** <zh/> 恢复 dismissed 修剪与 hover 状态同步 | <en/> Restore dismissed pruning and hover state sync */
    pruneDismissedRowKeys()
    syncHoverLayerState()
  })

  return {
    rowKeyToIndex,
    hoverRowKey,
    hoverRowIndex,
    hoverRowData,
    dismissedRowKeys,
    hoverLayerVisible,
    hoverLayerKeepAlive: computed(() => toValue(keepAlive) ?? true),
    hoverLayerCollapsed,
    hideHoverLayerImmediately,
    isRowDismissed,
    toggleHoverLayerCollapse,
    syncHoverLayerState,
    handleHoverRowEnter,
    handleHoverRowLeave,
    handleHoverLayerEnter,
    handleHoverLayerLeave,
    rediscoverHoverAfterScroll,
  }
}
