import type { DragGuardSession } from './row-drag-guard'
import type { RowBeforeDrag, RowDropValidator } from './use-row-drag'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { reorderFullDataByMove, reorderFullDataByVisibleOrder, rollbackDomOrder } from '../../utils/row-drag-utils'
import { buildKeyToIndexMap } from '../../utils/shared'
import { runBeforeDragGuard } from './row-drag-guard'

/**
 * <zh/> SortableJS onEnd 事件的最小结构——vue-draggable-plus 未导出精确事件类型，
 * <zh/> 拆分后的体制函数以该结构签名接收 evt，替代原先内联推断。
 * <en/> Minimal shape of the SortableJS onEnd event — vue-draggable-plus exports no precise
 * <en/> event type; the extracted regime functions take this signature instead of inline inference.
 */
export interface SortableEndEvent {
  /** <zh/> 被拖拽元素 | <en/> dragged element */
  item: HTMLElement
  /** <zh/> 来源容器 | <en/> source container */
  from: HTMLElement
  oldIndex?: number
  newIndex?: number
}

export interface DragGestureState {
  originalKeys: string[]
  /** DOM 顺序快照（含 synthetic 行，key 为 null）：Sortable 索引先映射到本数组再取业务 key */
  originalEntries: Array<{ element: HTMLElement | null, key: string | null }>
  lastTargetKey: string
  dropPosition: 'before' | 'after'
  reorderProcessed: boolean
  virtualDragSourceKey: string
  cachedVisibleRows: HTMLElement[] | null
  dragContainerEl: HTMLElement | null
  dragItemEl: HTMLElement | null
  dragSourceIndex: number | undefined
  dragCancelled: boolean
}

export function createDragGestureState(): DragGestureState {
  return {
    originalKeys: [],
    originalEntries: [],
    lastTargetKey: '',
    dropPosition: 'before',
    reorderProcessed: false,
    virtualDragSourceKey: '',
    cachedVisibleRows: null,
    dragContainerEl: null,
    dragItemEl: null,
    dragSourceIndex: undefined,
    dragCancelled: false,
  }
}

/**
 * <zh/> 按 DOM 索引取业务 key：先定位到含 synthetic 的 entries 数组，再取业务 key。
 * <zh/> synthetic 行（key 为 null）返回 ''，调用方按无效源/目标处理。
 * <en/> Business key by DOM index: locate the entries array (including synthetics) first, then take the business key.
 * <en/> Synthetic rows (null key) yield ''; callers treat them as invalid source/target.
 */
export function keyAtDomIndex(
  entries: Array<{ element: unknown, key: string | null }>,
  index: number | undefined,
): string {
  if (index === undefined || index < 0 || index >= entries.length)
    return ''
  return entries[index]?.key ?? ''
}

export type RowDragEndEmit<T> = (context: {
  sourceRow: T
  sourceIndex: number
  targetRow: T | null
  targetIndex: number
  event: DragEvent
}) => void

export interface PerformVirtualReorderArgs<T> {
  session: DragGuardSession
  beforeDrag?: RowBeforeDrag<T>
  getBeforeDrag?: () => RowBeforeDrag<T> | undefined
  getRowMap?: () => Map<string, T> | undefined
  sourceKey: string
  targetKey: string
  currentFullData: T[]
  /** Live data reader for the guard freshness check (must track the source ref, not the snapshot). 新鲜度检查用实时数据. */
  getLiveData: () => T[]
  getKeyFn: (row: T) => string
  targetSemantics: 'before' | 'after'
  dragEvent?: DragEvent | MouseEvent
  /** Live drag element refs for guard-rejection DOM rollback (read at reject time). 回滚用元素引用. */
  dragRefs: { container: HTMLElement | null, item: HTMLElement | null }
  rollbackDomOrder: (locator: { from: HTMLElement, item: HTMLElement }, index: number) => void
  onDataReorder: (rows: T[]) => void
  onRowDragEnd?: RowDragEndEmit<T>
  onGuardError?: (err: unknown, phase: 'beforeDrag' | 'commit') => void
  markReordered: () => void
}

/**
 * <zh/> 虚拟模式行拖拽落位——在完整数据上执行重排；注册了 beforeDrag 时经异步守卫（含数据新鲜度检查与 DOM 回滚），否则直接重排。
 * <en/> Virtual-mode row drag drop — reorders the full dataset; goes through the async beforeDrag guard
 * <en/> (with freshness check and DOM rollback) when registered, otherwise reorders directly.
 *
 * @param args - <zh/> 重排依赖（会话、源/目标 key、数据与回调） | <en/> Reorder deps (session, source/target keys, data and callbacks)
 * @returns <zh/> 是否已发起重排（含守卫异步发起）；参数无效时为 false | <en/> Whether the reorder was initiated (incl. async guard start); false on invalid args
 */
export function performVirtualReorder<T>(args: PerformVirtualReorderArgs<T>): boolean {
  const {
    session,
    getRowMap,
    sourceKey,
    targetKey,
    currentFullData,
    getLiveData,
    getKeyFn,
    targetSemantics,
    dragEvent,
    dragRefs,
    rollbackDomOrder,
    onDataReorder,
    onRowDragEnd,
    onGuardError,
    markReordered,
  } = args
  if (!targetKey || targetKey === sourceKey)
    return false

  const keyToIndex = buildKeyToIndexMap(currentFullData, getKeyFn)
  const sourceIdx = keyToIndex.get(sourceKey)
  const targetIdx = keyToIndex.get(targetKey)
  if (sourceIdx === undefined || targetIdx === undefined)
    return false

  const sourceRow = getRowMap?.()?.get(sourceKey) ?? null
  const targetRow = getRowMap?.()?.get(targetKey) ?? null

  if ((args.getBeforeDrag ? args.getBeforeDrag() : args.beforeDrag) && sourceRow && targetRow) {
    markReordered()
    runBeforeDragGuard({
      session,
      getBeforeDrag: () => args.getBeforeDrag ? args.getBeforeDrag() : args.beforeDrag,
      ctx: { sourceRow, sourceIndex: sourceIdx, targetRow, targetIndex: targetIdx, fullData: currentFullData },
      getCurrentData: getLiveData,
      onCommit: () => {
        const newData = reorderFullDataByMove(currentFullData, sourceKey, targetKey, keyToIndex, targetSemantics)
        onDataReorder(newData)
        if (onRowDragEnd && sourceRow) {
          onRowDragEnd({ sourceRow, sourceIndex: sourceIdx, targetRow, targetIndex: targetIdx, event: dragEvent as DragEvent })
        }
      },
      onReject: () => {
        /** beforeDrag 返回 false 时回滚 DOM 顺序——使用 onStart 保存的引用，避免 currentTarget 已为 null. */
        if (dragRefs.container && dragRefs.item)
          rollbackDomOrder({ from: dragRefs.container, item: dragRefs.item }, sourceIdx)
      },
      onError: onGuardError,
    })
    return true
  }

  const newData = reorderFullDataByMove(currentFullData, sourceKey, targetKey, keyToIndex, targetSemantics)
  onDataReorder(newData)
  if (onRowDragEnd && sourceRow) {
    onRowDragEnd({ sourceRow, sourceIndex: sourceIdx, targetRow, targetIndex: targetIdx, event: dragEvent as DragEvent })
  }
  return true
}

/**
 * Drop-validity check, pure code motion from use-row-drag.ts checkDropValidity.
 * Without a validator every position is valid; rows missing from the map abstain.
 * 放置有效性检查,纯搬移.
 */
export function checkDropValidity<T>(
  validator: RowDropValidator<T> | undefined,
  getRowMap: (() => Map<string, T> | undefined) | undefined,
  sourceKey: string,
  targetKey: string,
  position: 'before' | 'after',
): boolean {
  if (!validator)
    return true
  const rowMap = getRowMap?.()
  const sourceRow = rowMap?.get(sourceKey)
  const targetRow = rowMap?.get(targetKey)
  if (!sourceRow || !targetRow)
    return true
  return validator({ sourceRow, targetRow, position })
}

export interface RegimeBaseDeps<T> {
  gesture: DragGestureState
  session: DragGuardSession
  beforeDrag?: RowBeforeDrag<T>
  getBeforeDrag?: () => RowBeforeDrag<T> | undefined
  getLiveData: () => T[]
  getKeyFn: () => (row: T) => string
  getRowMap?: () => Map<string, T> | undefined
  onDataReorder: (rows: T[]) => void
  onRowDragEnd?: RowDragEndEmit<T>
  onDragError?: (err: unknown, phase: 'beforeDrag' | 'commit') => void
}

export interface DefaultRegimeDeps<T> extends RegimeBaseDeps<T> {
  getCurrentRowKeys: () => string[]
}

export interface SuppressMoveRegimeDeps<T> extends RegimeBaseDeps<T> {
  dropValidator?: RowDropValidator<T>
  getDropValidator?: () => RowDropValidator<T> | undefined
  clearAllDragClasses: () => void
}

export interface VirtualRegimeDeps<T> extends RegimeBaseDeps<T> {
  isSuppressMove: () => boolean
  clearAllDragClasses: () => void
  detachTransientListeners: () => void
  convergeDragEnd: () => void
  cancelVisibleRowRefresh: () => void
}

/** <zh/> suppressMove 体制：DOM 已回滚为原序，按指示线位置一次性重排 | <en/> suppressMove regime: DOM rolled back; reorder once by indicator position */
export function endSuppressMoveDrag<T>(evt: SortableEndEvent, deps: SuppressMoveRegimeDeps<T>): void {
  const { gesture, session, getLiveData, getKeyFn, getRowMap, onDataReorder, onRowDragEnd, onDragError } = deps
  rollbackDomOrder(evt, evt.oldIndex!)
  deps.clearAllDragClasses()

  const sourceKey = keyAtDomIndex(gesture.originalEntries.length > 0 ? gesture.originalEntries : gesture.originalKeys.map(key => ({ element: null, key })), evt.oldIndex!)
  const targetKey = gesture.lastTargetKey
  gesture.lastTargetKey = ''
  if (!sourceKey || !targetKey || sourceKey === targetKey)
    return

  // 检查放置有效性 | Check drop validity
  const position = gesture.dropPosition
  if (!checkDropValidity(deps.getDropValidator ? deps.getDropValidator() : deps.dropValidator, getRowMap, sourceKey, targetKey, position))
    return

  const currentFullData = getLiveData()
  const keyFn = getKeyFn()
  const keyToIndex = buildKeyToIndexMap(currentFullData, keyFn)
  const sourceIdx = keyToIndex.get(sourceKey)
  const targetIdx = keyToIndex.get(targetKey)
  if (sourceIdx === undefined || targetIdx === undefined)
    return

  const rowMap = getRowMap?.()
  const sourceRow = rowMap?.get(sourceKey) ?? null
  const targetRow = rowMap?.get(targetKey) ?? null
  if (!sourceRow || !targetRow)
    return

  const commit = () => {
    const newData = reorderFullDataByMove(currentFullData, sourceKey, targetKey, keyToIndex, gesture.dropPosition)
    onDataReorder(newData)
  }

  if (deps.getBeforeDrag ? deps.getBeforeDrag() : deps.beforeDrag) {
    runBeforeDragGuard({
      session,
      getBeforeDrag: () => deps.getBeforeDrag ? deps.getBeforeDrag() : deps.beforeDrag,
      ctx: { sourceRow, sourceIndex: sourceIdx, targetRow, targetIndex: targetIdx, fullData: currentFullData },
      getCurrentData: getLiveData,
      onCommit: () => {
        if (onRowDragEnd) {
          onRowDragEnd({ sourceRow, sourceIndex: sourceIdx, targetRow, targetIndex: targetIdx, event: evt as unknown as DragEvent })
        }
        commit()
      },
      useCommitFlag: true,
      onError: onDragError,
    })
    return
  }

  if (onRowDragEnd) {
    onRowDragEnd({ sourceRow, sourceIndex: sourceIdx, targetRow, targetIndex: targetIdx, event: evt as unknown as DragEvent })
  }
  commit()
}

/** <zh/> virtual 体制：回滚 DOM、按 mouseup/落点结果补一次虚拟重排，并复位窗口缓存状态 | <en/> virtual regime: roll back DOM, finish the pending virtual reorder, reset window caches */
export function endVirtualDrag<T>(evt: SortableEndEvent, deps: VirtualRegimeDeps<T>): void {
  const { gesture, session, getLiveData, getKeyFn, getRowMap, onDataReorder, onRowDragEnd, onDragError } = deps
  rollbackDomOrder(evt, evt.oldIndex!)
  deps.clearAllDragClasses()

  if (!gesture.reorderProcessed && gesture.lastTargetKey) {
    const sourceKey = keyAtDomIndex(gesture.originalEntries.length > 0 ? gesture.originalEntries : gesture.originalKeys.map(key => ({ element: null, key })), evt.oldIndex!)
    if (sourceKey && gesture.lastTargetKey !== sourceKey) {
      // suppressMove 模式下虚拟表格也使用 dropPosition | Virtual table also uses dropPosition in suppressMove mode
      const semantics = deps.isSuppressMove() ? gesture.dropPosition : 'after'
      performVirtualReorder({
        session,
        getBeforeDrag: () => deps.getBeforeDrag ? deps.getBeforeDrag() : deps.beforeDrag,
        getRowMap,
        sourceKey,
        targetKey: gesture.lastTargetKey,
        currentFullData: getLiveData(),
        getLiveData,
        getKeyFn: getKeyFn(),
        targetSemantics: semantics,
        dragEvent: evt as unknown as DragEvent,
        dragRefs: {
          get container() { return gesture.dragContainerEl },
          get item() { return gesture.dragItemEl },
        },
        rollbackDomOrder,
        onDataReorder,
        onRowDragEnd,
        onGuardError: onDragError,
        markReordered: () => { gesture.reorderProcessed = true },
      })
      gesture.reorderProcessed = true
    }
  }

  // <zh/> 经同一注册表移除 mouseup/scroll 与 blur/pointer 兜底监听（onEnd 公共清理已解绑一次，此处幂等复调） | <en/> Remove mouseup/scroll and blur/pointer fallback listeners via the shared registry (onEnd common cleanup already detached once; this idempotent re-call is safe)
  deps.detachTransientListeners()
  // <zh/> 经 setDragging 收敛拖拽标志与 body class | <en/> Converge the drag flag and body classes via setDragging
  deps.convergeDragEnd()
  deps.cancelVisibleRowRefresh()
  gesture.cachedVisibleRows = null
  gesture.virtualDragSourceKey = ''
  gesture.lastTargetKey = ''
}

/** <zh/> default 体制：解析源/目标行 → 目标未命中早退 → beforeDrag 守卫或同步按 DOM 序提交 | <en/> default regime: resolve rows → early-exit on missing target → guard or sync commit by DOM order */
export function endDefaultDrag<T>(evt: SortableEndEvent, deps: DefaultRegimeDeps<T>): void {
  const { gesture, session, getLiveData, getKeyFn, getRowMap, getCurrentRowKeys, onDataReorder, onRowDragEnd, onDragError } = deps
  const { oldIndex, newIndex } = evt
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex)
    return

  if (gesture.originalKeys.length === 0) {
    if (isDev) {
      devWarn('[useRowDrag] originalKeys 为空，拖拽实例可能已被重建')
    }
    rollbackDomOrder(evt, oldIndex)
    return
  }

  const keyFn = getKeyFn()
  const currentFullData = getLiveData()
  const rowMap = getRowMap?.()
  const keyToRow = rowMap ?? new Map(currentFullData.map(row => [keyFn(row), row] as const))
  const domEntries = gesture.originalEntries.length > 0
    ? gesture.originalEntries
    : gesture.originalKeys.map(key => ({ element: null, key }))
  let sourceRow: T | null = null
  let sourceKey = ''
  if (oldIndex !== undefined) {
    sourceKey = keyAtDomIndex(domEntries, oldIndex)
  }
  if (sourceKey) {
    sourceRow = keyToRow.get(sourceKey) ?? null
  }
  if (!sourceRow) {
    if (isDev) {
      devWarn('[useRowDrag] 无法获取拖拽源行数据，回滚 DOM 顺序')
    }
    rollbackDomOrder(evt, oldIndex)
    return
  }

  const visibleKeys = getCurrentRowKeys()
  let targetRow: T | null = null
  let targetKey = ''
  if (newIndex !== undefined) {
    targetKey = keyAtDomIndex(domEntries, newIndex)
  }
  if (targetKey && targetKey !== sourceKey) {
    targetRow = keyToRow.get(targetKey) ?? null
  }
  gesture.lastTargetKey = ''
  rollbackDomOrder(evt, oldIndex)

  /**
   * <zh/> 目标行未命中（newIndex 越界 / 拖拽期间数据被外部替换导致 key 查不到 /
   * <zh/> 目标即源行）时无可执行的重排：禁止以 `targetRow!` 将 null 断言为非空喂给
   * <zh/> beforeDrag 回调（违反 RowBeforeDrag 的类型契约），且禁止 commit 按 DOM 顺序
   * <zh/> 覆写数据；仅按 onRowDragEnd 契约透出 targetRow=null 后终止，
   * <zh/> DOM 已在上方回滚，无副作用残留。
   * <en/> When no valid target row resolves (newIndex out of range / data replaced mid-drag
   * <en/> so the key lookup misses / target equals source), there is no reorder to perform:
   * <en/> never assert null into the non-null beforeDrag contract via `targetRow!`, and never
   * <en/> let the commit overwrite data by DOM order; only surface
   * <en/> onRowDragEnd(targetRow=null) per its documented contract and stop; the DOM is
   * <en/> already rolled back above, leaving no side effects.
   */
  if (!targetRow) {
    if (onRowDragEnd) {
      onRowDragEnd({ sourceRow, sourceIndex: oldIndex, targetRow: null, targetIndex: newIndex, event: evt as unknown as DragEvent })
    }
    return
  }

  if (deps.getBeforeDrag ? deps.getBeforeDrag() : deps.beforeDrag) {
    runBeforeDragGuard({
      session,
      getBeforeDrag: () => deps.getBeforeDrag ? deps.getBeforeDrag() : deps.beforeDrag,
      ctx: { sourceRow, sourceIndex: oldIndex, targetRow, targetIndex: newIndex, fullData: currentFullData },
      getCurrentData: getLiveData,
      onCommit: () => {
        if (onRowDragEnd) {
          onRowDragEnd({ sourceRow, sourceIndex: oldIndex, targetRow, targetIndex: newIndex, event: evt as unknown as DragEvent })
        }
        const newData = reorderFullDataByVisibleOrder(currentFullData, visibleKeys, keyFn, keyToRow)
        onDataReorder(newData)
      },
      onReject: () => {
        if (isDev) {
          // <zh/> 该分支覆盖两种中止：beforeDrag 返回 false / 数据新鲜度守卫拦截
          // <en/> This branch covers both aborts: beforeDrag returned false / freshness guard tripped
          devWarn('[useRowDrag] 重排已取消：beforeDrag 拒绝，或校验期间数据已变化')
        }
      },
      useCommitFlag: true,
      onError: onDragError,
    })
    return
  }

  if (onRowDragEnd) {
    onRowDragEnd({ sourceRow, sourceIndex: oldIndex, targetRow, targetIndex: newIndex, event: evt as unknown as DragEvent })
  }
  const newData = reorderFullDataByVisibleOrder(currentFullData, visibleKeys, keyFn, keyToRow)
  onDataReorder(newData)
}
