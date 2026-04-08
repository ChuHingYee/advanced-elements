import type { Ref } from 'vue'
import type { DragLocator } from '../../types/drag-locator'
import type { SortableEndEvent } from './row-drag-regimes'
import type { RowBeforeDrag, RowDropValidator, UseRowDragOptions } from './use-row-drag-types'
import { toValue } from 'vue'
import { attachGhostInfo, removeGhostInfo, syncFallbackStyles } from '../../utils/drag-ghost'
import { calcDropPosition, rollbackDomOrder } from '../../utils/row-drag-utils'
import { readRowKeyAttr } from '../../utils/row-key-attr'
import { checkDropValidity, endDefaultDrag, endSuppressMoveDrag, endVirtualDrag } from './row-drag-regimes'

/**
 * <zh/> SortableJS 回调上下文——onMove/onStart/onEnd 闭包依赖的全集（按原推断定型） | <en/> SortableJS callback context — the full closure dependency set of onMove/onStart/onEnd (typed as inferred)
 */
export interface RowDragCallbackCtx<T> {
  container: HTMLElement
  rowVirtualized: boolean
  gesture: import('./row-drag-regimes').DragGestureState & Record<string, any>
  session: import('./row-drag-guard').DragGuardSession
  dragIndicator: import('../../utils/drag-indicator').DragIndicatorManager
  refreshVisibleRowCache: () => void
  throttledRefreshVisibleRowCache: { schedule: () => void, cancel: () => void }
  attachTransientDragListeners: (rowVirtualizedDrag: boolean) => void
  detachTransientDragListeners: () => void
  setDragging: (active: boolean, virtual?: boolean) => void
  isRowDragging: { value: boolean }
  isEditActive: () => boolean
  notifyEditConflict: () => void
  isSuppressMove: () => boolean
  isRowValidDropPositionFn: { value: RowDropValidator<T> | undefined }
  beforeDragFn: { value: RowBeforeDrag<T> | undefined }
  getCurrentRowKeys: () => string[]
  getCurrentRowEntries: () => Array<{ element: HTMLElement | null, key: string | null }>
  getRowMap: () => Map<string, T> | undefined
  getLiveData: () => T[]
  rowKey: Ref<(row: T) => string>
  fullData: Ref<T[]>
  onDataReorder: (rows: T[]) => void
  onRowDragStart?: UseRowDragOptions<T>['onRowDragStart']
  onRowDragEnd?: UseRowDragOptions<T>['onRowDragEnd']
  onDragError?: UseRowDragOptions<T>['onDragError']
  syncFallbackStyle: import('vue').MaybeRefOrGetter<boolean | undefined> | boolean | undefined
  resolvedDragLocator: { value: DragLocator }
}

/**
 * <zh/> SortableJS 回调工厂——onMove/onStart/onEnd 三回调与 buildRegimeBase。
 *
 * <zh/> 自 use-row-drag.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），函数体逐字未改；
 * <zh/> 闭包依赖经 ctx 显式下发。
 * <en/> SortableJS callback factories — the onMove/onStart/onEnd callbacks and buildRegimeBase.
 *
 * <en/> Migrated verbatim from use-row-drag.ts (COMPLEXITY-PLAN battle line 3, knife C),
 * <en/> function bodies unchanged; closure deps passed explicitly via ctx.
 */
export function createRowDragCallbacks<T>(ctx: RowDragCallbackCtx<T>) {
  const {
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
    onDataReorder,
    onRowDragStart,
    onRowDragEnd,
    onDragError,
    syncFallbackStyle,
    resolvedDragLocator,
  } = ctx

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

  const onMove = (evt: any, originalEvent: Event) => {
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
  }

  const onStart = (evt: any) => {
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
  }

  const onEnd = (evt: any) => {
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
  }
  return { onMove, onStart, onEnd }
}
