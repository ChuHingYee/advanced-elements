/**
 * <zh/> 拖拽实现——useDragOrchestrator 的重量体，拖拽门控开启时动态加载。
 * <en/> Drag implementation — the heavy body of useDragOrchestrator, loaded when the drag gate opens.
 *
 * @remarks
 * <zh/> 壳自持 dragLocator（同步计算）与 isRowDragging（同步状态）；行/列拖拽的生命周期
 * <zh/> 由壳经 destroy/suspend/resume 转发（此处传 autoLifecycle: false 关闭自注册）。
 * <en/> The shell owns dragLocator (sync computed) and isRowDragging (sync status); row/column
 * <en/> drag lifecycles forward via destroy/suspend/resume (autoLifecycle: false disables self-registration here).
 */
import type { ComputedRef, Ref } from 'vue'
import type { DragLocator } from '../../types/drag-locator'
import type { UseDragOrchestratorOptions } from './use-drag-orchestrator'
import { toValue } from 'vue'
import { createTableEmitter } from '../../utils/table-emitter'
import { useColumnDrag } from '../columns/use-column-drag'
import { useRowDrag } from '../interaction/use-row-drag'

/**
 * <zh/> 拖拽实现输入——与 UseDragOrchestratorOptions 同形，另收壳计算的定位器 | <en/> Drag implementation input — same shape as UseDragOrchestratorOptions, plus the shell-computed locator
 */
export interface DragImplOptions<T> extends UseDragOrchestratorOptions<T> {
  /** <zh/> 壳计算的拖拽定位器（单源，行拖与渲染共用） | <en/> Shell-computed drag locator (single source shared by row drag and rendering) */
  dragLocator: ComputedRef<DragLocator>
}

/**
 * <zh/> 拖拽实现返回——状态与生命周期句柄，供壳转发 | <en/> Drag implementation return — state and lifecycle handles for shell forwarding
 */
export interface DragImplReturn {
  /** <zh/> 行拖拽进行中（壳镜像之） | <en/> Row drag in progress (mirrored by the shell) */
  isRowDragging: Ref<boolean>
  /** <zh/> 永久销毁（组件卸载） | <en/> Permanent destroy (unmount) */
  destroy: () => void
  /** <zh/> 暂态挂起（失活） | <en/> Transient suspend (deactivate) */
  suspend: () => void
  /** <zh/> 重新激活 | <en/> Resume (activate) */
  resume: () => void
}

/**
 * <zh/> 创建拖拽实现 | <en/> Create the drag implementation
 *
 * @param options - <zh/> 与壳同形 + 定位器 | <en/> Same shape as the shell plus the locator
 * @returns <zh/> 状态与生命周期句柄 | <en/> state and lifecycle handles
 */
export function createDragImpl<T>(options: DragImplOptions<T>): DragImplReturn {
  const {
    caps,
    dom,
    tableId,
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
    isEditing,
    onEditConflict,
    dragLocator,
  } = options

  const tableEmit = createTableEmitter(emit, tableId)

  const rowDrag = useRowDrag({
    tableId: tableId.value,
    rowDraggable: () => mergedRowConfig.value.rowDraggable ?? false,
    rowDragHandle: () => mergedRowConfig.value.rowDragHandle ?? '',
    fullData: tableData,
    rowKey: rowKeyFn,
    getRowMap: () => rowKeyMeta.value.keyToRow,
    onDataReorder: reorderData,
    dragLocator,
    caps,
    dom,
    /**
     * <zh/> fallback 克隆样式同步——只问行索引域能力，不问渲染模式：composed（default）的 `<tr>`
     * <zh/> 离开 `<table>` 即失布局上下文需同步，unpinned（virtual）的 div 行自带样式跳过。
     * <en/> Fallback-clone style sync — asks only the row-index-domain capability, never the render mode:
     * <en/> composed (default) `<tr>` rows lose their layout context outside `<table>` and need the sync,
     * <en/> unpinned (virtual) div rows carry their own styles and skip it.
     */
    syncFallbackStyle: () => toValue(caps).rowIndexDomain === 'composed',
    suppressMoveWhenRowDragging: () => mergedRowConfig.value.suppressMoveWhenRowDragging ?? false,
    // <zh/> 以 getter 形式传入，useRowDrag 在调用时取值，配置变更后生效
    // <en/> Passed as getters; useRowDrag reads them at call time so later config changes take effect
    isRowValidDropPosition: () => mergedRowConfig.value.isRowValidDropPosition,
    beforeDrag: () => mergedRowConfig.value.beforeDrag,
    onRowDragStart: (context) => { tableEmit('rowDragStart', context) },
    onRowDragEnd: (context) => { tableEmit('rowDragEnd', context) },
    onDragError: (err, _phase) => {
      tableEmit('error', {
        code: 'TABLE_ROW_DRAG_FAILED',
        severity: 'warn',
        cause: err,
      })
    },
    // <zh/> 有编辑会话时拖拽禁用——窄探测器透传，调用时取值 | <en/> disable while editing — narrow probe, read at call time
    isEditing,
    onEditConflict,
    // <zh/> 生命周期由壳转发，此处不自注册 | <en/> Lifecycles forwarded by the shell, no self-registration here
    autoLifecycle: false,
  })

  const columnDrag = useColumnDrag({
    columnDraggable: () => mergedColumnConfig.value.columnDraggable ?? false,
    columns: localColumns,
    // <zh/> 仅更新列配置——columnMoved 事件由 useColumnsOrchestrator 的顺序 watcher 统一发出，避免双发
    // <en/> Only update the column config — the columnMoved event is emitted once by useColumnsOrchestrator's order watcher
    onColumnsReordered: (newColumns) => {
      setColumns(newColumns)
    },
    getColumnDragContainer: () => activeRenderer.value?.getColumnDragContainer?.() ?? null,
    getRenderedColumnKeys: () => activeRenderer.value?.getRenderedColumnKeys?.() ?? [],
    getDefaultColumnDragHandle: () => activeRenderer.value?.getDefaultColumnDragHandle?.() ?? '.cell',
    getColumnDraggableSelector: () => activeRenderer.value?.getColumnDraggableSelector?.() ?? 'th',
    tableId: tableId.value,
    // <zh/> 观察目标经 DOM 适配器命名空间化解析 | <en/> Observe targets resolved namespace-aware via the DOM adapter
    dom,
    // <zh/> 生命周期由壳转发，此处不自注册 | <en/> Lifecycles forwarded by the shell, no self-registration here
    autoLifecycle: false,
  })

  return {
    isRowDragging: rowDrag.isRowDragging,
    destroy: () => {
      rowDrag.destroyRowDrag()
      columnDrag.destroy()
    },
    suspend: () => {
      rowDrag.destroyRowDrag()
      columnDrag.suspend()
    },
    resume: () => {
      rowDrag.syncDrags()
      columnDrag.resume()
    },
  }
}
