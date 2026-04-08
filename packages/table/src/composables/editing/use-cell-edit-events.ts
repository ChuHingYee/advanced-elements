import type { ComputedRef, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type {
  CellEditEvent,
  CellEditingStoppedEvent,
  CellEditStopReason,
  EditingCellState,
  FullRowEditEvent,
} from '../../types/edit'
import type { InterceptorEditStopParams } from '../../types/interceptor'
import { findColumnByKey } from '../../utils/column-tree'
import { getColumnKey } from '../../utils/shared'
import { resolveCellValue } from '../../utils/value-pipeline'

/**
 * <zh/> 单元格编辑事件发射依赖——均为调用方持有的状态与回调，子模块不自建状态
 * <en/> Cell-edit event-emit dependencies — state and callbacks owned by the caller, no state created here
 */
export interface CellEditEventsDeps<T = any> {
  /** <zh/> 可见数据 | <en/> Visible data */
  data: ComputedRef<T[]>
  /** <zh/> 列配置 | <en/> Column configs */
  columns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 是否整行编辑 | <en/> Whether full-row editing */
  isFullRowEdit: ComputedRef<boolean>
  /** <zh/> 当前编辑格 | <en/> Current editing cell */
  editingCell: Ref<EditingCellState | null>
  /** <zh/> 整行编辑行索引 | <en/> Full-row editing row index */
  editingRowIndex: Ref<number | null>
  /** <zh/> 整行编辑值表 | <en/> Full-row editing values */
  editingValues: Ref<Record<string, any>>
  /** <zh/> 值变更回调 | <en/> Value-changed callback */
  onCellValueChanged?: (event: CellEditEvent<T>) => void
  /** <zh/> 编辑停止回调 | <en/> Editing-stopped callback */
  onCellEditingStopped?: (event: CellEditingStoppedEvent<T>) => void
  /** <zh/> 列是否可编辑判定 | <en/> Column-editable predicate */
  isColumnEditable: (col: ProcessedColumn) => boolean
  /** <zh/> 单元格脏标判定 | <en/> Cell-dirty predicate */
  isCellDirty: (rowIndex: number, columnKey: string) => boolean
}

/**
 * <zh/> 编辑事件发射相位
 * <zh/> 含值变更双通道发射（表格级 + 列级）、单格停止、全行停止（空变更收敛 N→1）三出口。
 * <en/> Edit event-emit phase.
 * <en/> Covers dual-channel value-changed emit (table + column), single-cell stopped,
 * <en/> and full-row stopped (empty-changes convergence N→1).
 */
export function useCellEditEvents<T = any>(deps: CellEditEventsDeps<T>) {
  const {
    data,
    columns,
    isFullRowEdit,
    editingCell,
    editingRowIndex,
    editingValues,
    onCellValueChanged,
    onCellEditingStopped,
    isColumnEditable,
    isCellDirty,
  } = deps

  /**
   * <zh/> 统一发射单元格值变更回调——同时通知表格级和列级监听 | <en/> Emit cell value changed callbacks — notifies both table-level and column-level listeners
   */
  function emitCellValueChanged(
    row: T,
    rowIndex: number,
    prop: string,
    column: ProcessedColumn | undefined,
    oldValue: any,
    newValue: any,
    reason: CellEditStopReason,
  ): void {
    if (onCellValueChanged) {
      onCellValueChanged({ row, rowIndex, prop, column, oldValue, newValue, reason })
    }
    if (column?.onCellValueChanged) {
      column.onCellValueChanged({ row, rowIndex, column, oldValue, newValue })
    }
  }

  /** <zh/> 发射单格编辑停止事件 | <en/> Emit cell editing stopped event for single-cell mode */
  function emitCellStopped(
    cell: EditingCellState,
    column: ProcessedColumn | undefined,
    oldValue: any,
    newValue: any,
    reason: CellEditStopReason,
  ): void {
    if (!onCellEditingStopped)
      return
    const row = data.value[cell.rowIndex]
    if (!row)
      return
    onCellEditingStopped({
      row,
      rowIndex: cell.rowIndex,
      prop: cell.prop,
      column,
      oldValue,
      newValue,
      reason,
    })
  }

  /**
   * <zh/> 构建编辑停止拦截器参数 | <en/> Build edit stop interceptor params
   * @returns <zh/> 拦截器参数，无活跃编辑时返回 null | <en/> interceptor params, or null when no active edit
   */
  function buildStopParams(reason: CellEditStopReason): InterceptorEditStopParams<T> | null {
    if (isFullRowEdit.value && editingRowIndex.value !== null) {
      const row = data.value[editingRowIndex.value]
      if (!row)
        return null
      return {
        row,
        rowIndex: editingRowIndex.value,
        prop: '',
        column: columns.value[0],
        reason,
      }
    }
    if (editingCell.value) {
      const cell = editingCell.value
      const col = findColumnByKey(columns.value, cell.columnKey)
      const row = data.value[cell.rowIndex]
      if (!row || !col)
        return null
      return {
        row,
        rowIndex: cell.rowIndex,
        prop: cell.prop,
        column: col,
        reason,
      }
    }
    return null
  }

  /**
   * <zh/> 发射全行编辑停止事件——遍历所有可编辑列 | <en/> Emit row editing stopped events — iterate all editable columns
   *
   * @remarks
   * <zh/> changes 为空时（取消场景），oldValue/newValue 均回退到当前行值
   * <en/> When changes is empty (cancel scenario), oldValue/newValue fall back to current row value
   */
  function emitRowCellsStopped(
    rowIndex: number,
    row: T,
    changes: FullRowEditEvent['changes'],
    reason: CellEditStopReason,
  ): void {
    if (!onCellEditingStopped)
      return
    /**
     * <zh/> 空变更收敛——changes 为空（纯取消/无脏值）时不再逐"参与编辑列"发 stopped，
     * <zh/> 仅对脏列 + 当前活跃编辑列发射，消除 fullRow 取消场景的 N 列事件风暴
     * <zh/> （每列 oldValue===newValue 的无效载荷）。有实际变更时保持逐变更列发射。
     * <en/> Empty-changes convergence — with no applied changes (pure cancel / nothing dirty),
     * <en/> stop emitting per participating column; only DIRTY columns plus the actively edited
     * <en/> column get an event, eliminating the N-column event storm of fullRow cancels
     * <en/> (payloads where oldValue === newValue). With real changes, behavior is unchanged.
     */
    let allowOnly: Set<string> | null = null
    if (changes.length === 0) {
      allowOnly = new Set<string>()
      for (const col of columns.value) {
        const cKey = getColumnKey(col)
        if (isCellDirty(rowIndex, cKey))
          allowOnly.add(cKey)
      }
      if (editingCell.value?.columnKey)
        allowOnly.add(editingCell.value.columnKey)
      /**
       * <zh/> fullRow 兜底——该模式 editingCell 恒为 null（行级会话），纯取消时
       * <zh/> 补发首个参与列的单事件，保证消费方仍能收到一次终止信号（风暴 N→1）。
       * <en/> fullRow fallback — `editingCell` is always null there (row-level session);
       * <en/> on a pure cancel, emit ONE event for the first participating column so consumers
       * <en/> still receive a terminal signal (storm reduced from N to 1).
       */
      if (allowOnly.size === 0 && isFullRowEdit.value && editingRowIndex.value !== null) {
        const firstParticipating = columns.value.find(
          col =>
            isColumnEditable(col)
            && (col.prop != null || col.valueGetter)
            && getColumnKey(col) in editingValues.value,
        )
        if (firstParticipating)
          allowOnly.add(getColumnKey(firstParticipating))
      }
    }
    for (const col of columns.value) {
      if (!isColumnEditable(col) || (col.prop == null && !col.valueGetter))
        continue
      const cKey = getColumnKey(col)
      if (!(cKey in editingValues.value))
        continue
      if (allowOnly && !allowOnly.has(cKey))
        continue
      const change = changes.find(c => c.prop === col.prop)
      const fallbackVal = resolveCellValue(row as Record<string, unknown>, col, rowIndex)
      onCellEditingStopped({
        row,
        rowIndex,
        prop: col.prop as string,
        column: col,
        oldValue: change?.oldValue ?? fallbackVal,
        newValue: change?.newValue ?? fallbackVal,
        reason,
      })
    }
  }

  return {
    emitCellValueChanged,
    emitCellStopped,
    buildStopParams,
    emitRowCellsStopped,
  }
}

/** <zh/> useCellEditEvents 返回形状（供类型复用） | <en/> useCellEditEvents return shape (for type reuse) */
export type CellEditEvents<T = any> = ReturnType<typeof useCellEditEvents<T>>
