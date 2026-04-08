import type { ComputedRef, Ref } from 'vue'
import type { DragLocator } from '../../types/drag-locator'
import type { RowBeforeDrag } from './use-row-drag-types'
import { removeGhostInfo } from '../../utils/drag-ghost'
import { rafSchedule } from '../../utils/raf'
import { calcDropPosition, calcVirtualTargetKey, rollbackDomOrder } from '../../utils/row-drag-utils'
import { readRowKeyAttr } from '../../utils/row-key-attr'
import { performVirtualReorder } from './row-drag-regimes'

/**
 * <zh/> 行拖拽暂态监听器依赖 | <en/> Row-drag transient-listener deps
 */
export interface RowDragTransientListenersDeps<T> {
  resolvedDragLocator: ComputedRef<DragLocator>
  gesture: import('./row-drag-regimes').DragGestureState & Record<string, any>
  session: import('./row-drag-guard').DragGuardSession
  dragIndicator: import('../../utils/drag-indicator').DragIndicatorManager
  setDragging: (active: boolean, virtual?: boolean) => void
  isRowDragging: { value: boolean }
  beforeDragFn: { value: RowBeforeDrag<T> | undefined }
  rowKey: Ref<(row: T) => string>
  fullData: Ref<T[]>
  getRowMap: () => Map<string, T> | undefined
  getLiveData: () => T[]
  onDataReorder: (rows: T[]) => void
  onRowDragEnd?: import('./use-row-drag-types').UseRowDragOptions<T>['onRowDragEnd']
  onDragError?: import('./use-row-drag-types').UseRowDragOptions<T>['onDragError']
}

/**
 * <zh/> 行拖拽暂态监听器族——可见行缓存（rAF 合并刷新）、暂态监听挂/摘（mouseup/scroll/blur/
 * <zh/> pointercancel/lostpointercapture/mouseleave）、abort 兜底回滚与虚拟 mouseup 提交。
 *
 * <zh/> 自 row-drag-session.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），函数体逐字未改。
 * <en/> The row-drag transient-listener family — the visible-row cache (rAF-coalesced refresh),
 * <en/> transient listener attach/detach (mouseup/scroll/blur/pointercancel/lostpointercapture/
 * <en/> mouseleave), the abort fallback rollback and the virtual mouseup commit.
 *
 * <en/> Migrated verbatim from row-drag-session.ts (COMPLEXITY-PLAN battle line 3, knife C).
 */
export function createRowDragTransientListeners<T>(deps: RowDragTransientListenersDeps<T>) {
  const {
    resolvedDragLocator,
    gesture,
    session,
    dragIndicator,
    setDragging,
    isRowDragging,
    beforeDragFn,
    rowKey,
    fullData,
    getRowMap,
    getLiveData,
    onDataReorder,
    onRowDragEnd,
    onDragError,
  } = deps

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

  // <zh/> onMove/onStart/onEnd 三回调自 row-drag-sortable-callbacks.ts 拆出（刀法 C）
  // <en/> The onMove/onStart/onEnd callbacks split into row-drag-sortable-callbacks.ts (knife C)

  return {
    refreshVisibleRowCache,
    throttledRefreshVisibleRowCache,
    detachTransientDragListeners,
    attachTransientDragListeners,
    handleDragAbort,
    handleVirtualMouseUp,
  }
}
