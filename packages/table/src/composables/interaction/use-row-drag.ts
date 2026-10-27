/** <zh/> ElTableV2 无内建拖拽支持，需要自定义拖拽逻辑（编排器） | <en/> ElTableV2 has no built-in drag; custom drag logic (orchestrator) */
import type { DragLocator } from '../../types/drag-locator'
import type { RowBeforeDrag, RowDropValidator, UseRowDragOptions } from './use-row-drag-types'
import { computed, onActivated, onBeforeUnmount, onDeactivated, shallowRef, toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isBrowser } from '../../utils/env'
import { createDragContainerLifecycle } from './row-drag-lifecycle'
import { createRowDragSession } from './row-drag-session'

// <zh/> 契约类型自 use-row-drag-types.ts 拆出并 re-export，既有导入路径零变化
// <en/> Contracts split into use-row-drag-types.ts and re-exported; import paths unchanged
export type { RowBeforeDrag, RowDropValidator, UseRowDragOptions } from './use-row-drag-types'

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

  // <zh/> SortableJS 会话（setupDraggable + 三回调）自 row-drag-session.ts 拆出（刀法 C）
  // <en/> The SortableJS session (setupDraggable + the three callbacks) split into row-drag-session.ts (knife C)
  let rowCleanupFromSession: (() => void) | null = null
  const { setupDraggable } = createRowDragSession<T>({
    resolvedDragLocator,
    rowDragHandle,
    caps: options.caps,
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
    setRowCleanup: (fn) => {
      rowCleanupFromSession = fn
    },
  })

  const lifecycle = createDragContainerLifecycle({
    enabled: rowDraggable,
    tableId,
    getContainer: getRowContainer,
    onContainerReady: setupDraggable,
    beforeInit: () => rowCleanupFromSession?.(),
    dom: options.dom,
  })

  function initRowDrag() {
    lifecycle.init()
  }

  function destroyRowDrag() {
    lifecycle.destroy()
    rowCleanupFromSession?.()
    rowCleanupFromSession = null
  }

  function syncDrags() {
    destroyRowDrag()
    initRowDrag()
  }

  watch(
    [() => toValue(rowDraggable), () => toValue(rowDragHandle), resolvedDragLocator],
    () => syncDrags(),
    { flush: 'post', immediate: true },
  )

  if (options.autoLifecycle ?? true) {
    onBeforeUnmount(() => {
      lifecycle.dispose()
      rowCleanupFromSession?.()
      rowCleanupFromSession = null
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
