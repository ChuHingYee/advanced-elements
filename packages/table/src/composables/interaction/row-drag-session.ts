import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { DragLocator } from '../../types/drag-locator'
import type { RowBeforeDrag, RowDropValidator, UseRowDragOptions } from './use-row-drag-types'
import { toValue } from 'vue'
import { useDraggable } from 'vue-draggable-plus'
import { createDragIndicatorManager } from '../../utils/drag-indicator'
import { createDragGuardSession } from './row-drag-guard'
import { createDragGestureState } from './row-drag-regimes'
import { createRowDragCallbacks } from './row-drag-sortable-callbacks'
import { createRowDragTransientListeners } from './row-drag-transient-listeners'

/**
 * <zh/> 行拖拽会话依赖 | <en/> Row-drag session deps
 */
export interface RowDragSessionDeps<T> {
  resolvedDragLocator: ComputedRef<DragLocator>
  rowDragHandle: UseRowDragOptions<T>['rowDragHandle']
  caps: UseRowDragOptions<T>['caps']
  rowKey: Ref<(row: T) => string>
  fullData: Ref<T[]>
  onDataReorder: (rows: T[]) => void
  onRowDragStart?: UseRowDragOptions<T>['onRowDragStart']
  onRowDragEnd?: UseRowDragOptions<T>['onRowDragEnd']
  onDragError?: UseRowDragOptions<T>['onDragError']
  isRowValidDropPositionFn: ComputedRef<RowDropValidator<T> | undefined>
  beforeDragFn: ComputedRef<RowBeforeDrag<T> | undefined>
  getCurrentRowKeys: () => string[]
  getCurrentRowEntries: () => Array<{ element: HTMLElement | null, key: string | null }>
  getRowMap: () => Map<string, T> | undefined
  getLiveData: () => T[]
  isEditActive: () => boolean
  notifyEditConflict: () => void
  isSuppressMove: () => boolean
  setDragging: (active: boolean, virtual?: boolean) => void
  isRowDragging: { value: boolean }
  syncFallbackStyle: MaybeRefOrGetter<boolean | undefined> | boolean | undefined
  /** <zh/> 会话清理句柄回填（宿主持有以 destroy/pause） | <en/> cleanup handle backfill (host holds it for destroy/pause) */
  setRowCleanup: (fn: (() => void) | null) => void
}

/**
 * <zh/> 行拖拽会话——SortableJS 装配（setupDraggable）：指示线管理、守卫会话、暂态监听
 * <zh/> （含虚拟 mouseup 提交与 abort 兜底）与实例清理。
 *
 * <zh/> 自 use-row-drag.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改；
 * <zh/> 三回调经 row-drag-sortable-callbacks 工厂注入。
 * <en/> Row-drag session — the SortableJS assembly (setupDraggable): indicator management, guard
 * <en/> session, transient listeners (incl. the virtual mouseup commit and abort fallback) and
 * <en/> instance cleanup.
 *
 * <en/> Migrated verbatim from use-row-drag.ts (COMPLEXITY-PLAN battle line 3, knife C);
 * <en/> the three callbacks inject via the row-drag-sortable-callbacks factory.
 */
export function createRowDragSession<T>(deps: RowDragSessionDeps<T>) {
  const {
    resolvedDragLocator,
    rowDragHandle,
    caps,
    rowKey,
    fullData,
    onDataReorder,
    onRowDragStart,
    onRowDragEnd,
    onDragError,
    isRowValidDropPositionFn,
    beforeDragFn,
    getCurrentRowKeys,
    getCurrentRowEntries,
    getRowMap,
    getLiveData,
    isEditActive,
    notifyEditConflict,
    isSuppressMove,
    setDragging,
    isRowDragging,
    syncFallbackStyle,
    setRowCleanup,
  } = deps

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
    const rowVirtualized = toValue(caps).rowIndexDomain === 'unpinned'

    const dragIndicator = createDragIndicatorManager(() => dragLoc, () => deps.resolvedDragLocator.value.getRowContainer?.() ?? null)

    const session = createDragGuardSession()
    const gesture = createDragGestureState()

    // <zh/> 暂态监听器族自 row-drag-transient-listeners.ts 拆出（刀法 C）
    // <en/> The transient-listener family split into row-drag-transient-listeners.ts (knife C)
    const {
      refreshVisibleRowCache,
      throttledRefreshVisibleRowCache,
      detachTransientDragListeners,
      attachTransientDragListeners,
    } = createRowDragTransientListeners<T>({
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
    })

    const { onMove, onStart, onEnd } = createRowDragCallbacks<T>({
      container,
      rowVirtualized,
      gesture,
      session,
      dragIndicator,
      refreshVisibleRowCache,
      throttledRefreshVisibleRowCache,
      attachTransientDragListeners,
      detachTransientDragListeners,
      setDragging,
      isRowDragging,
      isEditActive,
      notifyEditConflict,
      isSuppressMove,
      isRowValidDropPositionFn,
      beforeDragFn,
      getCurrentRowKeys,
      getCurrentRowEntries,
      getRowMap,
      getLiveData,
      rowKey,
      fullData,
      onDataReorder,
      onRowDragStart,
      onRowDragEnd,
      onDragError,
      syncFallbackStyle,
      resolvedDragLocator,
    })

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
      onMove,
      onStart,
      onEnd,
    })
    const rowCleanup = () => {
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
    setRowCleanup(rowCleanup)
  }
  return { setupDraggable }
}
