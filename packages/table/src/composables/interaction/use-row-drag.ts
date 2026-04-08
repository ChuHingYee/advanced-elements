/** ElTableV2 无内建拖拽支持，需要自定义拖拽逻辑 */
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import type { DragLocator } from '../../types/drag-locator'
import type { RendererCaps } from '../../types/renderer-caps'
import type { SortableEndEvent } from './row-drag-regimes'
import { computed, onActivated, onBeforeUnmount, onDeactivated, shallowRef, toValue, watch } from 'vue'
import { useDraggable } from 'vue-draggable-plus'
import { devWarn } from '../../utils/dev-warn'
import { attachGhostInfo, removeGhostInfo, syncFallbackStyles } from '../../utils/drag-ghost'
import { createDragIndicatorManager } from '../../utils/drag-indicator'
import { isBrowser } from '../../utils/env'
import { rafSchedule } from '../../utils/raf'
import { calcDropPosition, calcVirtualTargetKey, rollbackDomOrder } from '../../utils/row-drag-utils'
import { readRowKeyAttr } from '../../utils/row-key-attr'
import { createDragGuardSession } from './row-drag-guard'
import { createDragContainerLifecycle } from './row-drag-lifecycle'
import {
  checkDropValidity,
  createDragGestureState,
  endDefaultDrag,
  endSuppressMoveDrag,
  endVirtualDrag,
  performVirtualReorder,
} from './row-drag-regimes'

/** 判断行是否可放置到目标位置的回调类型 | Row drop-position validity callback type */
export type RowDropValidator<T> = (context: {
  sourceRow: T
  targetRow: T
  position: 'before' | 'after'
}) => boolean

/** beforeDrag 取消守卫回调类型 | beforeDrag cancel-guard callback type */
export type RowBeforeDrag<T> = (context: {
  sourceRow: T
  sourceIndex: number
  targetRow: T
  targetIndex: number
  fullData: T[]
}) => Promise<boolean> | boolean

export interface UseRowDragOptions<T> {
  rowDraggable: boolean | MaybeRefOrGetter<boolean>
  rowDragHandle?: string | MaybeRefOrGetter<string>
  fullData: Ref<T[]>
  rowKey: Ref<(row: T) => string>
  getRowMap: () => Map<string, T>
  onDataReorder: (rows: T[]) => void
  dragLocator: DragLocator | MaybeRefOrGetter<DragLocator>
  /**
   * <zh/> 渲染器能力表——行拖拽只问行索引域（`rowIndexDomain`），不问渲染模式。
   * <zh/> 该能力决定拖拽提交体制（unpinned 按 rowKey 映射提交、composed 按 evt 索引提交）
   * <zh/> 与暂态监听挂载（unpinned 需额外挂 mouseup/scroll）。
   * <en/> Renderer capability table — row drag only asks the row-index domain
   * <en/> (`rowIndexDomain`), never the render mode. It decides the commit regime
   * <en/> (unpinned commits via rowKey mapping, composed by evt index) and transient listener binding.
   */
  caps: MaybeRefOrGetter<Pick<RendererCaps, 'rowIndexDomain'>>
  tableId?: string
  /**
   * <zh/> 当前模式 DOM 适配器——透传至拖拽容器生命周期做观察目标解析。
   * <en/> Current-mode DOM adapter — forwarded to the drag-container lifecycle.
   */
  dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
  /**
   * <zh/> 起拖时把源行样式同步到 body 上的 fallback 克隆行——`<tr>` 离开 `<table>` 即失表格布局上下文，
   * <zh/> 单元格宽度全丢故克隆行无样式；div 行自带样式无需同步。调用时取值，模式切换后即生效。
   * <en/> Sync source-row styles onto the body-level fallback clone at drag start — a `<tr>` outside
   * <en/> `<table>` loses its table layout context and every cell width with it, so the clone looks
   * <en/> unstyled; div rows carry their own styles and skip the sync. Read at call time so mode switches apply.
   */
  syncFallbackStyle?: boolean | MaybeRefOrGetter<boolean>
  /**
   * 拖拽时禁止行实时移动，仅显示插入指示线，松开后才执行重排
   * During drag, disable real-time row movement; only show the insertion indicator, reorder after release
   */
  suppressMoveWhenRowDragging?: boolean | MaybeRefOrGetter<boolean>
  /** 判断行是否可放置到目标位置，返回 false 时显示无效放置反馈 */
  isRowValidDropPosition?: MaybeRefOrGetter<RowDropValidator<T> | undefined>
  /** 返回 false 取消拖拽重排 */
  beforeDrag?: MaybeRefOrGetter<RowBeforeDrag<T> | undefined>
  /**
   * 行拖拽开始回调
   * Row drag start callback
   */
  onRowDragStart?: (context: { sourceRow: T, sourceIndex: number, event: DragEvent }) => void
  /** 行拖拽结束回调，@param context.targetRow - 目标行数据，未命中时为 null */
  onRowDragEnd?: (context: { sourceRow: T, sourceIndex: number, targetRow: T | null, targetIndex: number, event: DragEvent }) => void
  /**
   * <zh/> 拖拽流程错误回调——beforeDrag 异常或拒绝后回滚失败时通过此回调透出错误
   * <en/> Drag flow error callback — surfaces errors when beforeDrag throws or rollback fails after rejection
   */
  onDragError?: (err: unknown, phase: 'beforeDrag' | 'commit') => void
  /**
   * <zh/> 编辑会话探测——有未提交编辑/进行中会话时拖拽禁用：
   * <zh/> 返回 true 即拒绝本次拖拽手势并经 `onEditConflict` 提示用户先完成编辑，避免重排覆盖未提交值或行索引错位。
   * <en/> Editing-session probe — row drag is disabled while it returns true:
   * <en/> a true value rejects the gesture and prompts via `onEditConflict` to finish editing first.
   */
  isEditing?: MaybeRefOrGetter<boolean>
  /**
   * <zh/> 编辑冲突提示——拖拽因编辑会话被拒绝时调用（用户可见提示由调用方下发，本模块另附一条 devWarn）。
   * <en/> Edit-conflict hook — called when a drag is rejected due to an active editing session.
   */
  onEditConflict?: () => void
  /**
   * <zh/> 自动注册生命周期（卸载/失活/激活）——延迟初始化（setup 之后创建）时传 false，由壳在 setup 期转发
   * <en/> Auto-register lifecycle (unmount/deactivate/activate) — pass false for deferred post-setup init; the shell forwards from setup
   * @default true
   */
  autoLifecycle?: boolean
}

/**
 * <zh/> 行拖拽 composable——覆盖 default（SortableJS 实时移动）、suppressMove（指示线 + 松手落位）与 virtual（行虚拟化委托重排）三种体制，
 * <zh/> 含 beforeDrag 异步守卫、数据新鲜度检查与 DOM 回滚。
 * <en/> Row drag composable — covers three regimes: default (SortableJS live movement), suppressMove
 * <en/> (indicator line, reorder on release) and virtual (row-virtualization delegated reorder), with the
 * <en/> beforeDrag async guard, data freshness check and DOM rollback.
 *
 * @param options - <zh/> 拖拽开关、数据/行键、拖拽定位器与事件回调 | <en/> Drag switches, data/row key, drag locator and callbacks
 * @returns <zh/> 拖拽初始化/销毁/同步方法与拖拽中状态 | <en/> Init/destroy/sync methods and the is-row-dragging state
 */
export function useRowDrag<T>(options: UseRowDragOptions<T>) {
  const {
    rowDraggable,
    rowDragHandle,
    fullData,
    rowKey,
    onDataReorder,
    dragLocator: dragLocatorOption,
    tableId,
    syncFallbackStyle = false,
    suppressMoveWhenRowDragging: suppressMoveOption,
    isRowValidDropPosition,
    beforeDrag,
    onRowDragStart,
    onRowDragEnd,
    onDragError,
    isEditing,
    onEditConflict,
  } = options

  /**
   * <zh/> 有编辑会话时拖拽禁用——读取调用方下发的窄探测器，异常时按"无编辑"放行，避免误杀拖拽。
   * <en/> Disable row drag while editing — reads the narrow probe from the caller; fail-open on read errors.
   */
  function isEditActive(): boolean {
    try {
      return !!toValue(isEditing ?? false)
    }
    catch {
      return false
    }
  }

  /**
   * <zh/> 编辑冲突统一处理——devWarn（排障）+ onEditConflict（用户可见提示由调用方下发）。
   * <en/> Unified edit-conflict handling — devWarn for triage plus onEditConflict for user-visible notice.
   */
  function notifyEditConflict(): void {
    devWarn(
      '[AdvTable] Row drag rejected: an editing session is active — please finish (submit/cancel) editing before dragging. | '
      + '行拖拽已拒绝：当前有进行中的编辑会话，请先完成（提交/取消）编辑后再拖拽。',
    )
    try {
      onEditConflict?.()
    }
    catch {
      // <zh/> 提示通道异常不得中断拖拽守卫 | <en/> Notice-channel errors must not break the drag guard
    }
  }

  let rowCleanup: (() => void) | null = null

  /**
   * <zh/> 行拖拽进行中标志——虚拟滚动失步看门狗在拖拽期间暂停检测：
   * <zh/> SortableJS 会临时打乱 body 行的 DOM 顺序，rows[0] 读到的 style.top 是假象而非真失步。
   * <en/> Row-drag-in-progress flag — the virtual-scroll desync watchdog pauses while dragging:
   * <en/> SortableJS temporarily shuffles body-row DOM order, so style.top read from rows[0] is an artifact, not a real desync.
   */
  const isRowDragging = shallowRef(false)

  /**
   * <zh/> 拖拽状态唯一收敛点——isRowDragging 与 body 拖拽 class 必须同置同清。
   * <zh/> 置 true 时按虚拟/非虚拟挂 adv-table-resizing（虚拟多挂 --row）；置 false 时幂等移除两者。
   * <zh/> try/finally 保证标志与样式其一抛出时另一仍被清理（finally 语义）。
   * <en/> Single convergence point for drag state — isRowDragging and the body drag classes
   * <en/> must be set/cleared together. True adds adv-table-resizing (plus --row when virtual);
   * <en/> false idempotently removes both. try/finally guarantees the other is still cleaned up
   * <en/> if one throws (finally semantics).
   */
  function setDragging(active: boolean, virtual = false): void {
    // <zh/> SSR 无 document.body，直接维护标志位 | <en/> No document.body in SSR, maintain the flag only
    if (!isBrowser) {
      isRowDragging.value = active
      return
    }
    if (active) {
      try {
        isRowDragging.value = true
      }
      finally {
        if (virtual)
          document.body.classList.add('adv-table-resizing', 'adv-table-resizing--row')
        else
          document.body.classList.add('adv-table-resizing')
      }
      return
    }
    try {
      isRowDragging.value = false
    }
    finally {
      document.body.classList.remove('adv-table-resizing', 'adv-table-resizing--row')
    }
  }

  const resolvedDragLocator = computed<DragLocator>(() => toValue(dragLocatorOption))

  /**
   * <zh/> 拖拽回调统一在调用时取值——避免 setup 阶段一次性解引用导致配置变更后仍使用旧函数
   * <en/> Drag callbacks are read at call time — avoids using stale functions after config changes
   */
  const isRowValidDropPositionFn = computed<RowDropValidator<T> | undefined>(() => toValue(isRowValidDropPosition))
  const beforeDragFn = computed<RowBeforeDrag<T> | undefined>(() => toValue(beforeDrag))

  function getRowContainer(): HTMLElement | null {
    return resolvedDragLocator.value?.getRowContainer?.() ?? null
  }

  function getCurrentRowKeys(): string[] {
    return resolvedDragLocator.value.getCurrentRowKeys()
  }

  function getCurrentRowEntries(): Array<{ element: HTMLElement | null, key: string | null }> {
    const entries = resolvedDragLocator.value.getCurrentRowEntries?.()
    if (entries)
      return entries
    return getCurrentRowKeys().map(key => ({ element: null, key }))
  }

  function isSuppressMove(): boolean {
    return !!toValue(suppressMoveOption)
  }

  function getRowMap(): Map<string, T> | undefined {
    return options.getRowMap?.()
  }

  function getLiveData(): T[] {
    return fullData.value
  }

  const lifecycle = createDragContainerLifecycle({
    enabled: rowDraggable,
    tableId,
    getContainer: getRowContainer,
    onContainerReady: setupDraggable,
    beforeInit: () => rowCleanup?.(),
    dom: options.dom,
  })

  function initRowDrag() {
    lifecycle.init()
  }

  function destroyRowDrag() {
    lifecycle.destroy()
    rowCleanup?.()
    rowCleanup = null
  }

  function syncDrags() {
    destroyRowDrag()
    initRowDrag()
  }

  function setupDraggable(container: HTMLElement) {
    const dragLoc = resolvedDragLocator.value
    const handle = toValue(rowDragHandle) || dragLoc.getDragHandleSelector()
    const draggableSelector = dragLoc.getDraggableRowSelector()

    /**
     * <zh/> 行索引域能力查询——能力表优先，不再以 `getAnimation() === 0`
     * <zh/> 这类 DOM 启发值推断模式。该值决定提交体制与暂态监听挂载，是本函数内唯一的模式相关语义点。
     * <en/> Row-index-domain capability query — capability table first, no longer inferred from a DOM
     * <en/> heuristic such as `getAnimation() === 0`. It decides the commit regime and transient listener
     * <en/> binding, and is the single mode-related semantic point here.
     */
    const rowVirtualized = toValue(options.caps).rowIndexDomain === 'unpinned'

    const dragIndicator = createDragIndicatorManager(() => dragLoc, getRowContainer)

    const session = createDragGuardSession()
    const gesture = createDragGestureState()

    function refreshVisibleRowCache() {
      // <zh/> 可见行查询收敛至 DragLocator.getVisibleRowElements——本模块不再拼接行类名（含命名空间），default/virtual 双模式同口径
      // <en/> Visible-row lookup converges in DragLocator.getVisibleRowElements — no row class-name concatenation here (namespace included); same caliber in both modes
      const dragLoc = resolvedDragLocator.value
      const scrollContainer = dragLoc.getScrollContainer?.()
      if (!scrollContainer) {
        gesture.cachedVisibleRows = null
        return
      }
      gesture.cachedVisibleRows = dragLoc.getVisibleRowElements(scrollContainer)
    }

    /** <zh/> rAF 合并版 refreshVisibleRowCache（共享工具）——每帧最多执行一次 DOM 查询 | <en/> rAF-coalesced refreshVisibleRowCache (shared util) — at most one DOM query per frame */
    const throttledRefreshVisibleRowCache = rafSchedule(refreshVisibleRowCache)

    function detachTransientDragListeners(): void {
      document.removeEventListener('mouseup', handleVirtualMouseUp)
      if (typeof window !== 'undefined')
        window.removeEventListener('blur', handleDragAbort)
      document.removeEventListener('pointercancel', handleDragAbort)
      document.removeEventListener('lostpointercapture', handleDragAbort)
      if (typeof document !== 'undefined' && document.documentElement)
        document.documentElement.removeEventListener('mouseleave', handleDragAbort)
      const scrollContainer = resolvedDragLocator.value.getScrollContainer?.()
      if (scrollContainer)
        scrollContainer.removeEventListener('scroll', throttledRefreshVisibleRowCache.schedule)
    }

    /**
     * <zh/> 挂载拖拽暂态监听——先解绑防重入；行虚拟化时挂 mouseup/scroll，
     * <zh/> blur/pointercancel/lostpointercapture/mouseleave 在每次拖拽手势内常挂。
     * <en/> Attach transient drag listeners — detach first against re-entry; mouseup/scroll are bound only
     * <en/> when rows are virtualized, while blur/pointercancel/lostpointercapture/mouseleave ride every gesture.
     */
    function attachTransientDragListeners(rowVirtualizedDrag: boolean): void {
      detachTransientDragListeners()
      if (rowVirtualizedDrag) {
        document.addEventListener('mouseup', handleVirtualMouseUp)
        const scrollContainer = resolvedDragLocator.value.getScrollContainer?.()
        if (scrollContainer)
          scrollContainer.addEventListener('scroll', throttledRefreshVisibleRowCache.schedule, { passive: true })
      }
      if (typeof window !== 'undefined')
        window.addEventListener('blur', handleDragAbort)
      document.addEventListener('pointercancel', handleDragAbort)
      document.addEventListener('lostpointercapture', handleDragAbort)
      if (typeof document !== 'undefined' && document.documentElement)
        document.documentElement.addEventListener('mouseleave', handleDragAbort)
    }

    function handleDragAbort(): void {
      if (!isRowDragging.value)
        return
      try {
        gesture.dragCancelled = true
        session.version++
        session.committing = false
        if (gesture.dragContainerEl && gesture.dragItemEl && gesture.dragSourceIndex !== undefined)
          rollbackDomOrder({ from: gesture.dragContainerEl, item: gesture.dragItemEl }, gesture.dragSourceIndex)
        dragIndicator.clearDropTarget()
        dragIndicator.removeIndicator()
        dragIndicator.clearAllDragClasses()
        if (gesture.dragItemEl) {
          gesture.dragItemEl.classList.remove('adv-table__row--no-drop')
          removeGhostInfo(gesture.dragItemEl)
        }
        gesture.cachedVisibleRows = null
        gesture.virtualDragSourceKey = ''
        gesture.lastTargetKey = ''
        gesture.reorderProcessed = false
      }
      finally {
        detachTransientDragListeners()
        throttledRefreshVisibleRowCache.cancel()
        gesture.dragContainerEl = null
        gesture.dragItemEl = null
        gesture.dragSourceIndex = undefined
        setDragging(false)
      }
    }

    /**
     * <zh/> 虚拟表格 mouseup 处理器。由 onStart 注册，onEnd 虚拟路径负责移除
     * <en/> Virtual table mouseup handler. Registered by onStart, removed by onEnd virtual path
     * @remarks
     * <zh/> 若 onEnd 触发后 mouseup 仍未触发（如 ESC 取消），监听器在 onEnd 中被显式移除
     * <en/> If mouseup hasn't been triggered after onEnd (e.g., ESC cancel), the listener is explicitly removed in onEnd
     */

    function handleVirtualMouseUp(e: MouseEvent) {
      if (!isRowDragging.value || !gesture.virtualDragSourceKey || gesture.reorderProcessed) {
        setDragging(false)
        return
      }

      const targetKey = calcVirtualTargetKey(
        e.clientY,
        resolvedDragLocator.value,
        fullData.value,
        rowKey.value,
        gesture.cachedVisibleRows,
      )

      // <zh/> 根据鼠标在目标行内的相对位置计算 before/after
      // <en/> Derive before/after from the cursor position inside the target row
      let targetSemantics: 'before' | 'after' = gesture.dropPosition || 'after'
      const targetRowEl = gesture.cachedVisibleRows?.find(row => readRowKeyAttr(row) === targetKey)
      if (targetRowEl)
        targetSemantics = calcDropPosition(e.clientY, targetRowEl)

      const getKeyFn = rowKey.value
      const currentFullData = fullData.value
      const handled = performVirtualReorder({
        session,
        getBeforeDrag: () => beforeDragFn.value,
        getRowMap,
        sourceKey: gesture.virtualDragSourceKey,
        targetKey,
        currentFullData,
        getLiveData,
        getKeyFn,
        targetSemantics,
        dragEvent: e,
        dragRefs: {
          get container() { return gesture.dragContainerEl },
          get item() { return gesture.dragItemEl },
        },
        rollbackDomOrder,
        onDataReorder,
        onRowDragEnd,
        onGuardError: onDragError,
        markReordered: () => {
          gesture.reorderProcessed = true
        },
      })

      if (handled) {
        gesture.reorderProcessed = true
      }

      setDragging(false)
    }

    function buildRegimeBase() {
      return {
        gesture,
        session,
        getBeforeDrag: () => beforeDragFn.value,
        getLiveData,
        getKeyFn: () => rowKey.value,
        getRowMap,
        onDataReorder,
        onRowDragEnd,
        onDragError,
      }
    }

    const { pause, destroy } = useDraggable(container, {
      handle,
      draggable: draggableSelector,
      animation: dragLoc.getAnimation(),
      ghostClass: dragLoc.getGhostClass(),
      chosenClass: 'adv-table__row--chosen',
      dragClass: 'adv-table__row--drag',
      fallbackClass: 'adv-table__row-fallback',
      forceFallback: true,
      fallbackOnBody: true,

      onMove(evt, originalEvent) {
        // <zh/> 有编辑会话时拖拽禁用——直接拒绝移动，提示只在 onStart 发一次避免 mousemove 刷屏
        // <en/> Disabled while editing — reject moves here; the notice fires once in onStart to avoid mousemove spam
        if (isEditActive())
          return false
        const draggedEl = evt.dragged
        const relatedEl = evt.related

        if (!relatedEl) {
          dragIndicator.clearDropTarget()
          dragIndicator.removeIndicator()
          gesture.lastTargetKey = ''
          return true
        }

        if (draggedEl === relatedEl) {
          draggedEl.classList.add('adv-table__row--no-drop')
          dragIndicator.clearDropTarget()
          dragIndicator.removeIndicator()
          gesture.lastTargetKey = ''
          return false
        }

        draggedEl.classList.remove('adv-table__row--no-drop')

        if (isSuppressMove()) {
          // 禁止 SortableJS 移动行，仅显示插入指示线 | Disable SortableJS row movement, only show insert indicator line
          const position = calcDropPosition((originalEvent as MouseEvent).clientY, relatedEl) // Note: SortableJS MoveEvent.originalEvent 类型为 Event，运行时为 MouseEvent
          gesture.dropPosition = position

          // <zh/> 行 key 读取收口至 readRowKeyAttr
          // <en/> Row-key reads go through readRowKeyAttr
          const sourceKey = readRowKeyAttr(draggedEl) || ''
          const targetKey = readRowKeyAttr(relatedEl) || ''

          const isValid = checkDropValidity(isRowValidDropPositionFn.value, getRowMap, sourceKey, targetKey, position)

          // 清除旧的高亮 | Clear old highlight
          dragIndicator.clearDropTarget()

          // 定位指示线 | Position the indicator
          dragIndicator.positionIndicator(relatedEl, position, !isValid)

          // 无效放置时给目标行添加样式 | Add style to the target row on invalid drop
          if (!isValid) {
            relatedEl.classList.add('adv-table__row--invalid-drop')
          }

          gesture.lastTargetKey = targetKey
          dragIndicator.trackTarget(relatedEl)

          // 返回 false 阻止 SortableJS 移动 DOM | Return false to prevent SortableJS from moving DOM
          return false
        }

        dragIndicator.setDropTarget(relatedEl)

        // <zh/> 非 suppressMove 体制同样记录 dropPosition，供虚拟模式 onEnd 落点使用
        // <en/> Non-suppressMove regime also records dropPosition, consumed by the virtual onEnd drop
        gesture.dropPosition = calcDropPosition((originalEvent as MouseEvent).clientY, relatedEl)

        gesture.lastTargetKey = readRowKeyAttr(relatedEl) || ''

        return true
      },

      onStart: (evt) => {
        // <zh/> 有编辑会话时拖拽禁用——起手即拒绝：提示一次并标记取消，onEnd 幂等清理不提交
        // <en/> Disabled while editing — reject at gesture start: notify once and mark cancelled for a no-commit onEnd
        if (isEditActive()) {
          notifyEditConflict()
          gesture.dragCancelled = true
          gesture.reorderProcessed = false
          return
        }
        gesture.originalKeys = getCurrentRowKeys()
        // DOM 顺序快照（含 synthetic）：Sortable 索引映射到本数组再取业务 key
        gesture.originalEntries = getCurrentRowEntries()
        setDragging(true, rowVirtualized)
        gesture.reorderProcessed = false
        session.version++
        gesture.dragCancelled = false
        // 保存容器和拖拽元素引用，供 beforeDrag 异步拒绝后的 DOM 回滚使用 | Save container and drag element refs for DOM rollback after beforeDrag async rejection
        // currentTarget 在事件传播完成后为 null（W3C 规范），无法在异步回调中使用 | currentTarget is null after event propagation completes (W3C spec), cannot be used in async callbacks
        gesture.dragContainerEl = container
        gesture.dragItemEl = evt.item as HTMLElement
        gesture.dragSourceIndex = evt.oldIndex

        const oldIdx = evt.oldIndex
        let currentSourceKey = ''
        if (oldIdx !== undefined && gesture.originalEntries.length > oldIdx) {
          currentSourceKey = gesture.originalEntries[oldIdx]?.key ?? ''
          const sourceRow = currentSourceKey ? (getRowMap()?.get(currentSourceKey) || null) : null
          if (sourceRow) {
            attachGhostInfo(evt.item)
          }
        }

        if (rowVirtualized && currentSourceKey) {
          gesture.virtualDragSourceKey = currentSourceKey
          refreshVisibleRowCache()
        }

        // <zh/> 暂态监听与 mouseup 同一注册表：virtual 才挂 mouseup/scroll，blur/pointercancel/lostpointercapture/mouseleave 每次手势常挂 | <en/> Transient listeners share the mouseup registry: mouseup/scroll only for virtual, while blur/pointercancel/lostpointercapture/mouseleave ride every gesture
        attachTransientDragListeners(rowVirtualized && !!currentSourceKey)

        // <zh/> 调用时取值——getter 形式传入时模式切换后即生效，setup 期解引用会固化旧值
        // <en/> Read at call time — a getter stays correct across mode switches; dereferencing at setup would pin a stale value
        if (toValue(syncFallbackStyle)) {
          /**
           * <zh/> 单元格选择器由 DOM 适配器供给——本模块不持有任何 EP 类名字符串。
           * <zh/> 适配器未提供时回退为原生 `td`（default 渲染器的行单元格）。
           * <en/> The cell selector comes from the DOM adapter — this module holds no EP class-name string.
           * <en/> Falls back to native `td` (the default renderer's row cell) when the adapter omits it.
           */
          syncFallbackStyles(evt.item, resolvedDragLocator.value.getCellSelector?.() ?? 'td')
        }

        if (onRowDragStart) {
          if (oldIdx !== undefined && gesture.originalEntries.length > oldIdx) {
            const sourceKey = gesture.originalEntries[oldIdx]?.key ?? ''
            const sourceRow = getRowMap()?.get(sourceKey) || null
            if (sourceRow) {
              onRowDragStart({
                sourceRow,
                sourceIndex: oldIdx,
                // Note: SortableJS emits MouseEvent types, runtime DragEvent
                event: evt as unknown as DragEvent,
              })
            }
          }
        }
      },

      onEnd: (evt) => {
        // <zh/> 无条件先摘暂态监听：五条结束分支（commit / cancel / suppressMove / virtual / default）共享，
        // <zh/> 解绑是幂等的，重复调用安全。此前仅 cancel 与 virtual 分支解绑，其余三条泄漏全局监听。
        // <en/> Always detach transient listeners first: shared by all end branches, idempotent and safe.
        detachTransientDragListeners()
        dragIndicator.clearDropTarget()
        dragIndicator.removeIndicator()
        evt.item.classList.remove('adv-table__row--no-drop')
        removeGhostInfo(evt.item)

        setDragging(false)

        if (session.committing) {
          rollbackDomOrder(evt, evt.oldIndex)
          return
        }

        /**
         * <zh/> 失焦/取消兜底（handleDragAbort）已回滚 DOM 并清理状态，迟到的 onEnd 只做幂等清理、不再提交。
         * <zh/> default 体制按 evt 索引提交且不读 lastTargetKey，无法自行规避 abort 后的误提交，必须在此拦截。
         * <en/> The blur/cancel fallback (handleDragAbort) already rolled the DOM back and cleared state, so a late
         * <en/> onEnd only performs idempotent cleanup without committing. The default regime commits by evt index and
         * <en/> never reads lastTargetKey, so it cannot self-guard — the late commit must be intercepted here.
         */
        if (gesture.dragCancelled) {
          gesture.dragCancelled = false
          setDragging(false)
          return
        }

        if (isSuppressMove() && !rowVirtualized) {
          endSuppressMoveDrag(evt as SortableEndEvent, {
            ...buildRegimeBase(),
            getDropValidator: () => isRowValidDropPositionFn.value,
            clearAllDragClasses: () => dragIndicator.clearAllDragClasses(),
          })
          return
        }
        if (rowVirtualized) {
          endVirtualDrag(evt as SortableEndEvent, {
            ...buildRegimeBase(),
            isSuppressMove,
            clearAllDragClasses: () => dragIndicator.clearAllDragClasses(),
            detachTransientListeners: detachTransientDragListeners,
            convergeDragEnd: () => setDragging(false),
            cancelVisibleRowRefresh: () => throttledRefreshVisibleRowCache.cancel(),
          })
          return
        }
        endDefaultDrag(evt as SortableEndEvent, {
          ...buildRegimeBase(),
          getCurrentRowKeys,
        })
      },
    })
    rowCleanup = () => {
      /**
       * <zh/> 暂态监听与 rAF 无条件清理：解绑/取消是幂等的，不受 dragging 标志影响。
       * <zh/> 此前被 `isRowDragging` 门控，正常结束的拖拽（onEnd 已置 false）走不到解绑，
       * <zh/> 且旧闭包的 handler 引用只有旧 detach 能摘除，随 syncDrags 重建线性累积。
       * <en/> Transient listeners and rAF are cleaned unconditionally: detach/cancel are idempotent
       * <en/> and independent of the dragging flag.
       */
      detachTransientDragListeners()
      throttledRefreshVisibleRowCache.cancel()
      if (isRowDragging.value) {
        dragIndicator.removeIndicator()
        gesture.cachedVisibleRows = null
        gesture.virtualDragSourceKey = ''
        gesture.lastTargetKey = ''
        gesture.reorderProcessed = false
        session.committing = false
        // <zh/> 经唯一收敛点复位标志与 body class | <en/> Reset flag and body classes via the single convergence point
        setDragging(false)
      }
      // 先 destroy SortableJS 实例（移除 DOM 事件监听器），再 pause | Destroy SortableJS instance first (removes DOM event listeners), then pause
      destroy()
      pause()
    }
  }

  watch(
    [() => toValue(rowDraggable), () => toValue(rowDragHandle), resolvedDragLocator],
    () => syncDrags(),
    { flush: 'post', immediate: true },
  )

  if (options.autoLifecycle ?? true) {
    onBeforeUnmount(() => {
      lifecycle.dispose()
      rowCleanup?.()
      rowCleanup = null
      document.body.classList.remove('adv-table-resizing', 'adv-table-resizing--row')
    })

    onDeactivated(() => {
      destroyRowDrag()
      document.body.classList.remove('adv-table-resizing', 'adv-table-resizing--row')
    })

    /** KeepAlive 重新激活时重新初始化行拖拽（watch immediate 仅在 setup 时触发一次，重新激活不会重跑） */
    onActivated(() => {
      syncDrags()
    })
  }

  return {
    initRowDrag,
    destroyRowDrag,
    syncDrags,
    isRowDragging,
  }
}
