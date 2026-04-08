/**
 * <zh/> 列宽拖拽 Composable
 * <en/> Column resize composable
 *
 * @remarks
 * <zh/> 实现两种交互路径：
 * <zh/> 1. 鼠标拖拽（el-table 一致行为）：右边缘 8px 命中区，mousemove 移动 proxy 线，mouseup 提交新宽度
 * <zh/> 2. 键盘调整（a11y）：在表头获得焦点时按 Alt + ←/→ 以 10px 步长调整列宽
 * <en/> Implements two interaction paths:
 * <en/> 1. Mouse drag (consistent with el-table): 8px hit zone on right edge, mousemove moves proxy line, mouseup commits new width
 * <en/> 2. Keyboard adjustment (a11y): Alt + ←/→ with 10px step when header has focus
 *
 * <zh/> 关键设计点：
 * <zh/> - 起始宽度使用 DOM 实际 `getBoundingClientRect.width` 而非 `col.width`
 * <zh/> - 拖拽期间 cursor 跟随，document 级 mouseup 兜底
 * <zh/> - 卸载时 forceCleanup 兜底清理 document 全局监听
 * <en/> Key design points:
 * <en/> - Start width uses DOM actual `getBoundingClientRect.width` instead of `col.width`
 * <en/> - Cursor follows during drag, document-level mouseup as fallback
 * <en/> - forceCleanup on unmount to clean up global document listeners
 */
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import type { ProcessedColumn } from '../../types'
import { onBeforeUnmount, onDeactivated, reactive, toValue, watch } from 'vue'
import { ADV_TABLE_COLUMN_KEY_ATTR, clampMinWidth, DEFAULT_MIN_COLUMN_WIDTH } from '../../constants'
import { DEFAULT_COLUMN_WIDTH, findColumnByKey, traverseColumnTree } from '../../utils/column-tree'
import { rafSchedule } from '../../utils/raf'
import { useColumnResizeKeyResolver } from './use-column-resize-key-resolver'
import { useColumnResizeProxy } from './use-column-resize-proxy'

/**
 * <zh/> 拖拽手柄命中区宽度（px）
 * <en/> Resize handle hit zone (px)
 */
const RESIZE_HANDLE_HIT_ZONE = 8

/**
 * <zh/> 列 key 属性名——真源为 constants（与列拖拽同常量，见 ADV_TABLE_COLUMN_KEY_ATTR）
 * <en/> Column key attribute name — sourced from constants (same constant as column drag)
 */
const COLUMN_KEY_ATTR = ADV_TABLE_COLUMN_KEY_ATTR

/**
 * <zh/> 键盘调整列宽步长
 * <en/> Keyboard resize step (px)
 */
const KEYBOARD_RESIZE_STEP = 10

export interface UseColumnResizeOptions {
  minWidth?: number
  /** <zh/> 列 key 提取（调用方直传共享 getColumnKey） | <en/> Column key extractor (callers forward the shared getColumnKey) */
  getColumnKey: (col: ProcessedColumn) => string
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  /**
   * <zh/> 可选完整列树（含分组列）。传入时，拖拽分组表头右边缘将调整为该分组的最右叶子列，匹配 el-table 行为
   * <en/> Optional full column tree (including group columns). When provided, dragging the right edge of a group header cell will resize the rightmost leaf column of that group, matching el-table behavior
   */
  groupTree?: MaybeRefOrGetter<ProcessedColumn[]>
  onHeaderDragend?: (params: { columnKey: string, newWidth: number, oldWidth: number, event: MouseEvent | KeyboardEvent }) => void
  resizeProxyRef?: Ref<HTMLElement | undefined | null>
  resizable?: MaybeRefOrGetter<boolean | undefined>
  /**
   * <zh/> 当前模式 DOM 适配器——EP 内置表头单元格回退匹配经其解析（命名空间化）。
   * <zh/> 缺省时仅匹配自有表头类名。
   * <en/> Current-mode DOM adapter — resolves the built-in EP header-cell fallback match (namespace-aware).
   * <en/> Without it only the owned header class names match.
   */
  dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
}

/**
 * <zh/> 自有表头挂钩（生产实际渲染的口径，与 v2-header.tsx 一致）——EP 回退仅覆盖 EP 原生胞。
 * <en/> Owned header hooks (the caliber actually rendered in production, matching v2-header.tsx);
 * <en/> the EP fallback covers EP-native cells only.
 */
const OWNED_HEADER_CELL_SELECTORS = '.adv-table__v2-header-cell--leaf-span, .adv-table__v2-header-cell, .adv-table__v2-header-cell--framed'

/**
 * <zh/> 从事件 target 向上查找表头单元格包裹元素
 * <en/> Find header cell wrapper element from event target
 *
 * @remarks
 * <zh/> EP 内置表头单元格优先（经 DOM 适配器 `getHeaderCellSelector` 解析，命名空间化）——
 * <zh/> 原生叶表头保持逐元素一致；自定义表头（选择列/分组头）走自有挂钩
 * <zh/> （`OWNED_HEADER_CELL_SELECTORS`，v2-header 实际渲染口径）。
 * <zh/> 未传 dom 时跳过 EP 回退（仅自有类名）。
 * <en/> Built-in EP header cells first (resolved via the DOM adapter `getHeaderCellSelector`,
 * <en/> namespace-aware) — native leaf headers resolve exactly as before; custom headers
 * <en/> (selection/group) use the owned hooks (`OWNED_HEADER_CELL_SELECTORS`, the caliber
 * <en/> v2-header actually renders). Without dom the EP fallback is skipped.
 *
 * @param target - <zh/> 事件目标元素 | <en/> event target element
 * @param epHeaderCellSelector - <zh/> EP 内置表头单元格选择器（来自分支当前模式的 DOM 适配器，可空） | <en/> built-in EP header cell selector (from the current-mode DOM adapter, nullable)
 * @returns <zh/> 表头单元格包裹元素，未找到返回 null | <en/> header cell wrapper element, returns null if not found
 */
function findHeaderCellWrapper(target: HTMLElement, epHeaderCellSelector?: string): HTMLElement | null {
  if (epHeaderCellSelector) {
    const epCell = target.closest<HTMLElement>(epHeaderCellSelector)
    if (epCell)
      return epCell
  }
  return target.closest<HTMLElement>(OWNED_HEADER_CELL_SELECTORS)
}

/**
 * <zh/> 从事件 target 冒泡路径中提取列 key。
 * <zh/> 支持鼠标和键盘事件（target 都是 EventTarget，向上找最近的 [data-adv-table-column-key] 祖先）。
 *
 * @param event - <zh/> 鼠标或键盘事件 | <en/> mouse or keyboard event
 * @returns <zh/> 列 key 字符串，未找到返回 null | <en/> column key string, null if not found
 */
function getColumnKeyFromEvent(event: Event): string | null {
  const target = event.target as HTMLElement | null
  if (!target || typeof target.closest !== 'function')
    return null
  const el = target.closest<HTMLElement>(`[${COLUMN_KEY_ATTR}]`)
  if (!el)
    return null
  return el.getAttribute(COLUMN_KEY_ATTR)
}

/**
 * 列宽拖拽组合式函数
 * Composable for column resize
 *
 * 实现鼠标拖拽和键盘调整两种列宽交互方式。
 * @param options - 列宽调整配置
 * @returns 列宽调整状态和方法
 */
export function useColumnResize(options: UseColumnResizeOptions) {
  const { minWidth = DEFAULT_MIN_COLUMN_WIDTH, getColumnKey, columns, groupTree, onHeaderDragend, resizeProxyRef, resizable, dom } = options

  /**
   * <zh/> EP 内置表头单元格回退选择器——读取时求值，模式切换后即时生效。
   * <en/> Built-in EP header-cell fallback selector — evaluated lazily so mode switches take effect immediately.
   */
  const epHeaderCellSelector = (): string | undefined => toValue(dom)?.getHeaderCellSelector()

  const columnWidths = reactive<Record<string, number>>({})

  /**
   * <zh/> 子域装配（Vue 最佳实践 composables.md：职责下沉、接口显式）——
   * <zh/> key 解析收敛至 useColumnResizeKeyResolver，代理线视觉收敛至 useColumnResizeProxy；
   * <zh/> 主函数仅保留编排（命中判定/宽度提交/键盘 a11y/生命周期）。
   * <en/> Sub-domain assembly (composables.md: push responsibilities down, keep interfaces explicit)
   * <en/> key resolution lives in useColumnResizeKeyResolver, proxy visuals in useColumnResizeProxy;
   * <en/> this function keeps orchestration only (hit-testing/width commit/keyboard a11y/lifecycle).
   */
  const { resolveResizeTargetKey } = useColumnResizeKeyResolver({ getColumnKey, columns, groupTree })
  const {
    resizing,
    resizeProxyVisible,
    draggingColumnKey,
    getSession,
    setCursor,
    showProxy,
    moveProxy,
    takeProxyResult,
    hideProxy,
    clearGlobalVisual,
  } = useColumnResizeProxy({ resizeProxyRef })

  let cachedColumnKey: string | null = null
  let cachedRect: DOMRect | null = null

  /** 阻止文本选择和拖拽的捕获阶段 handler，避免属性赋值覆盖其他组件 handler */
  function suppressSelection(e: Event) {
    e.preventDefault()
  }
  function suppressDrag(e: Event) {
    e.preventDefault()
  }

  function getColumnWidth(col: ProcessedColumn): number {
    const key = getColumnKey(col)
    if (columnWidths[key] !== undefined)
      return columnWidths[key]
    return col.width ?? DEFAULT_COLUMN_WIDTH
  }

  function removeResizeListeners() {
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)
    document.body.classList.remove('adv-table-resizing', 'adv-table-resizing--col')
    document.removeEventListener('selectstart', suppressSelection, true)
    document.removeEventListener('dragstart', suppressDrag, true)
  }

  /**
   * <zh/> rAF 合并调度（共享工具）——mousemove 每帧最多处理一次，捕获最后一次事件对象
   * <en/> rAF-coalesced dispatch (shared util) — at most one header mousemove processed per frame, latest event wins
   */
  let latestHeaderMouseMoveEvent: MouseEvent | null = null
  const headerMouseMoveHandle = rafSchedule(() => {
    if (latestHeaderMouseMoveEvent)
      processHeaderMouseMove(latestHeaderMouseMoveEvent)
  })

  function handleHeaderMouseMove(event: MouseEvent) {
    if (resizing.value)
      return

    if (!toValue(resizable))
      return

    latestHeaderMouseMoveEvent = event
    headerMouseMoveHandle.schedule()
  }

  function processHeaderMouseMove(event: MouseEvent) {
    const rawColumnKey = getColumnKeyFromEvent(event)
    if (!rawColumnKey) {
      cachedColumnKey = null
      cachedRect = null
      if (draggingColumnKey.value) {
        setCursor('')
        draggingColumnKey.value = null
      }
      return
    }

    const targetColumnKey = resolveResizeTargetKey(rawColumnKey)
    if (!targetColumnKey) {
      cachedColumnKey = null
      cachedRect = null
      if (draggingColumnKey.value) {
        setCursor('')
        draggingColumnKey.value = null
      }
      return
    }

    let rect: DOMRect
    if (cachedColumnKey === rawColumnKey && cachedRect) {
      rect = cachedRect
    }
    else {
      const target = findHeaderCellWrapper(event.target as HTMLElement, epHeaderCellSelector())
      if (!target)
        return
      rect = target.getBoundingClientRect()
      cachedColumnKey = rawColumnKey
      cachedRect = rect
    }

    const isResizeHandleActive = rect.width > 12 && rect.right - event.clientX < RESIZE_HANDLE_HIT_ZONE

    setCursor(isResizeHandleActive ? 'col-resize' : '')
    draggingColumnKey.value = isResizeHandleActive ? targetColumnKey : null
  }

  function handleHeaderMouseOut(event: MouseEvent) {
    if (resizing.value)
      return

    if (!draggingColumnKey.value)
      return

    const relatedTarget = event.relatedTarget as HTMLElement | null
    if (relatedTarget) {
      const epCell = epHeaderCellSelector()
      // <zh/> 自有挂钩与 EP 回退同口径（见 OWNED_HEADER_CELL_SELECTORS） | <en/> Same caliber as OWNED_HEADER_CELL_SELECTORS plus the EP fallback
      const stillInHeader = relatedTarget.closest<HTMLElement>(
        epCell
          ? `${OWNED_HEADER_CELL_SELECTORS}, ${epCell}`
          : OWNED_HEADER_CELL_SELECTORS,
      )
      if (stillInHeader)
        return
    }

    setCursor('')
    draggingColumnKey.value = null
    cachedColumnKey = null
    cachedRect = null
  }

  function handleResizeStart(event: MouseEvent) {
    if (event.button !== 0)
      return

    if (!toValue(resizable))
      return

    const rawColumnKey = getColumnKeyFromEvent(event)
    if (!rawColumnKey)
      return

    if (resizing.value)
      return

    const targetColumnKey = resolveResizeTargetKey(rawColumnKey)
    if (!targetColumnKey)
      return

    if (getSession())
      removeResizeListeners()

    const headerCellEl = findHeaderCellWrapper(event.target as HTMLElement, epHeaderCellSelector())
    if (!headerCellEl)
      return

    const columnRect = headerCellEl.getBoundingClientRect()
    if (columnRect.width <= 12)
      return

    if (columnRect.right - event.clientX >= RESIZE_HANDLE_HIT_ZONE)
      return

    event.preventDefault()
    event.stopPropagation()

    const isGroupColumn = targetColumnKey !== rawColumnKey
    /**
     * 关键：使用 DOM 实际宽度（叶子列）或 col.width（分组代理列）。
     * 并通过 flexGrow 拉伸，col.width 与实际 DOM 宽度不一致，会导致：
     *   1) proxy 初始位置错位（停在 col.width 边界而非真实列右边缘）
     *   2) 拖拽 delta 计算错误（startColumnLeft + startWidth 偏离真实列边缘 → 新宽度不等于鼠标移动量）
     * 分组列代理场景：columnRect 是 group header 的 rect，width 是 group 宽度而非
     * rightmost leaf 的实际宽度，必须用 leaf 的 col.width 反推 leaf 左边缘。
     * Key: use DOM actual width for leaf columns, or col.width for group column delegation.
     */
    const leafColumn = findColumnByKey(toValue(columns), targetColumnKey)
    const colWidth = isGroupColumn
      ? (columnWidths[targetColumnKey] ?? leafColumn?.width ?? DEFAULT_COLUMN_WIDTH)
      : columnRect.width

    const proxyEl = resizeProxyRef?.value

    let startColumnLeft = 0
    let tableLeft = 0
    let minLeft = 0

    if (proxyEl) {
      const tableEl = proxyEl.closest('.adv-table-virtual-renderer')
      const tableRect = tableEl?.getBoundingClientRect()
      tableLeft = tableRect?.left ?? 0
      /**
       * 统一公式：startColumnLeft = columnRect.right - colWidth
       * 叶子列：columnRect.right - columnRect.width = columnRect.left（DOM 真实左边缘）
       * 分组列：columnRect.right - leafColWidth = rightmost leaf 真实左边缘
       * Unified formula for both leaf and group column scenarios.
       */
      startColumnLeft = columnRect.right - tableLeft - colWidth
      minLeft = startColumnLeft + minWidth
    }

    /** 直接用 columnRect.right（DOM 真实右边缘），不受 col.width / autoSize 影响（Use DOM real right edge, unaffected by col.width / autoSize） */
    showProxy(targetColumnKey, {
      columnKey: targetColumnKey,
      startX: event.clientX,
      startWidth: colWidth,
      startColumnLeft,
      tableLeft,
      minLeft,
    }, columnRect.right - tableLeft)

    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
    document.body.classList.add('adv-table-resizing', 'adv-table-resizing--col')
    document.addEventListener('selectstart', suppressSelection, true)
    document.addEventListener('dragstart', suppressDrag, true)
  }

  function handleResizeMove(event: MouseEvent) {
    moveProxy(event.clientX)
  }

  function handleResizeEnd(event: MouseEvent) {
    const result = takeProxyResult(minWidth)
    if (result) {
      const { session, newWidth } = result
      const { columnKey, startWidth } = session

      // <zh/> 零位移/无代理线时跳过提交——避免制造与真源等值的覆盖层条目。
      // <en/> Skip the commit on zero movement / missing proxy — avoids minting an overlay entry
      // <en/> equal to the source of truth.
      if (newWidth !== startWidth) {
        columnWidths[columnKey] = newWidth

        /**
         * 同步 col.width 到列对象，确保 useColumnState.getColumnState 能读取到调整后的宽度。
         * localColumns 是 shallowRef，属性突变不会触发响应式——
         * onHeaderDragend 回调由 table.vue 消费并触发 localColumns.value = [...] 重赋值。
         * Sync col.width to the column object so useColumnState.getColumnState reads
         * the adjusted width. localColumns is a shallowRef, so the mutation alone won't
         * trigger reactivity — the onHeaderDragend callback is consumed by table.vue
         * which triggers localColumns.value = [...] reassignment.
         */
        const cols = toValue(columns)
        // <zh/> 嵌套列（分组叶子）必须经 findColumnByKey 深查——顶层 find 命中失败会写丢列宽
        // <en/> Nested columns (group leaves) need findColumnByKey's deep search — a top-level find misses them and silently drops the width
        const col = findColumnByKey(cols, columnKey)
        if (col) {
          col.width = newWidth
        }

        if (onHeaderDragend) {
          onHeaderDragend({ columnKey, newWidth, oldWidth: startWidth, event })
        }
      }
    }

    hideProxy()
    cachedColumnKey = null
    cachedRect = null

    removeResizeListeners()
  }

  /**
   * <zh/> 清空拖拽宽度覆盖层（`columnWidths`）。
   *
   * <zh/> 宽度真源始终是 `col.width`（拖拽 / 键盘调整结束时写回）；本覆盖层只负责"下一次列配置
   * <zh/> 重算前即时生效"。因此**只清缓存、绝不回写 `col.width`**——`getColumnState` 读的正是
   * <zh/> `col.width`，置空会一并抹掉 props 声明的宽度与持久化的宽度。
   *
   * <en/> Clear the drag-width overlay (`columnWidths`). The width source of truth is always `col.width`
   * <en/> (written back when a drag/keyboard resize ends); this overlay only makes a width take effect
   * <en/> immediately, ahead of the next column-config recompute. It therefore **clears the cache only and
   * <en/> never writes `col.width` back** — `getColumnState` reads `col.width`, so blanking it would wipe
   * <en/> both the prop-declared width and the persisted one.
   */
  function resetColumnWidths() {
    for (const key of Object.keys(columnWidths)) {
      delete columnWidths[key]
    }
  }

  /**
   * <zh/> 列集合变化时清理已不存在的 key 覆盖——列被移除后同名 key 重新加入时，
   * <zh/> 旧拖拽宽度会经 `getColumnWidth` 复活（"幽灵列宽"）。
   * <en/> Prune overlay keys that no longer exist when the column set changes — otherwise a
   * <en/> column removed and re-added under the same key would resurrect its old drag width
   * <en/> through `getColumnWidth`.
   */
  watch(
    // <zh/> 以 join 后的字符串签名为源——数组引用每次都变，直接 watch 新数组会误判变更
    // <en/> Watch a joined string signature — a fresh array reference every time would false-positive
    () => {
      // <zh/> 全树 key（含分组叶子）：仅顶层 key 时，分组叶子增删后旧拖拽宽经 getColumnWidth 复活。
      // <en/> Full-tree keys (group leaves included): top-level keys alone resurrect stale drag widths.
      const keys: string[] = []
      traverseColumnTree(toValue(columns), (col) => {
        keys.push(getColumnKey(col))
      })
      return keys.join('\0')
    },
    (sig, prev) => {
      if (sig === prev)
        return
      const live = new Set(sig.split('\0'))
      for (const key of Object.keys(columnWidths)) {
        if (!live.has(key))
          delete columnWidths[key]
      }
    },
  )

  function forceCleanup() {
    if (typeof document === 'undefined')
      return
    headerMouseMoveHandle.cancel()
    if (getSession())
      removeResizeListeners()
    hideProxy()
    // 无论会话是否存在，都清理全局残留状态。
    // 场景：拖拽已结束（会话为 null），但组件在 body class 未清除时被卸载。
    // Always clean up global residual state regardless of session existence.
    clearGlobalVisual()
    document.body.classList.remove('adv-table-resizing', 'adv-table-resizing--col')
    document.removeEventListener('selectstart', suppressSelection, true)
    document.removeEventListener('dragstart', suppressDrag, true)
    clearCachedRect()
  }

  /**
   * <zh/> 清除缓存的列 rect，防止表格滚动后缓存变为脏数据导致拖拽代理线初始位置错位。
   * <zh/> 调用方应在 scroll 事件中调用此方法。
   * <en/> Clear cached column rect to prevent stale data after table scrolling causing drag proxy line initial position offset.
   * <en/> Caller should invoke this method on scroll events.
   */
  function clearCachedRect() {
    cachedColumnKey = null
    cachedRect = null
  }

  /**
   * 键盘 a11y 调整列宽
   * Keyboard-accessible column resize
   *
   * 表头获得焦点时按 Alt + ←/→ 以 KEYBOARD_RESIZE_STEP 步长调整列宽。
   * Alt + ArrowRight：加宽；Alt + ArrowLeft：收窄（受 minWidth 限制）。
   * 模拟键盘事件通过构造 MouseEvent 透传给 onHeaderDragend，保持下游事件类型一致。
   */
  function handleHeaderKeyDown(event: KeyboardEvent) {
    if (!event.altKey)
      return
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
      return

    if (!toValue(resizable))
      return

    const rawColumnKey = getColumnKeyFromEvent(event)
    if (!rawColumnKey)
      return

    const targetColumnKey = resolveResizeTargetKey(rawColumnKey)
    if (!targetColumnKey)
      return

    const leafColumn = findColumnByKey(toValue(columns), targetColumnKey)
    if (!leafColumn)
      return

    // <zh/> 与鼠标路径同口径：覆盖层 → 列宽 → 默认宽（auto 列首次按键不再从 minWidth 起跳）。
    // <en/> Same caliber as the mouse path: overlay → width → default (auto columns no longer jump from minWidth).
    const currentWidth = getColumnWidth(leafColumn)
    const delta = event.key === 'ArrowRight' ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP
    // <zh/> 键盘调整下限经 clampMinWidth 唯一出口 | <en/> keyboard floor via the single clampMinWidth outlet
    const newWidth = clampMinWidth(currentWidth + delta, minWidth)
    if (newWidth === currentWidth)
      return

    event.preventDefault()
    columnWidths[targetColumnKey] = newWidth
    leafColumn.width = newWidth
    onHeaderDragend?.({ columnKey: targetColumnKey, newWidth, oldWidth: currentWidth, event })
  }

  onBeforeUnmount(forceCleanup)

  onDeactivated(forceCleanup)

  return {
    columnWidths,
    resizing,
    resizeProxyVisible,
    getColumnWidth,
    handleHeaderMouseMove,
    handleHeaderMouseOut,
    handleHeaderKeyDown,
    handleResizeStart,
    resetColumnWidths,
    clearCachedRect,
  }
}
