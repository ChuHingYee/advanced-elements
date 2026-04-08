/**
 * <zh/> 编辑缓冲读写 composable
 * <en/> Edit-buffer I/O composable
 *
 * @remarks
 * <zh/> 职责单一：会话期间编辑缓冲值的**读写**与**实时校验**。
 * <zh/> 两处读写共用同一不变式——「行引用一致性守卫」：排序/筛选/分页/虚拟滚动行回收后，
 * <zh/> `editingRowRef` 与 `data[索引]` 不一致即判定索引过期，读返回 undefined、写直接丢弃，
 * <zh/> 避免把编辑值应用到错误的行。把这两半放在一起，守卫语义只需维护一处。
 * <en/> Single responsibility: **reading / writing** the edit buffer and **live validation** during a
 * <en/> session. Both halves share one invariant — the "row-reference consistency guard": after
 * <en/> sort/filter/pagination/virtual-scroll recycling, if `editingRowRef` no longer matches
 * <en/> `data[index]` the index is considered stale — reads return undefined and writes are dropped,
 * <en/> preventing edit values from landing on the wrong row. Keeping both halves together means the
 * <en/> guard semantics live in exactly one place.
 */
import type { ComputedRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellEditSession } from './use-cell-edit-session'
import { triggerRef } from 'vue'
import { findColumnByKey } from '../../utils/column-tree'

/** <zh/> 编辑缓冲依赖 | <en/> Edit-buffer deps */
export interface UseCellEditBufferDeps<T = any> {
  /** <zh/> 可见数据 | <en/> Visible data */
  data: ComputedRef<T[]>
  /** <zh/> 列配置 | <en/> Column configs */
  columns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 会话状态 | <en/> Session state */
  session: CellEditSession<T>
  /** <zh/> 是否整行编辑 | <en/> Whether full-row editing */
  isFullRowEdit: ComputedRef<boolean>
  /** <zh/> 异步校验函数 | <en/> Async validation function */
  validateFn?: (params: {
    mode: 'cell' | 'row'
    rowIndex: number
    columnKey: string
    value: any
    values?: Record<string, any>
    rowData?: unknown
  }) => Promise<boolean>
  /** <zh/> 编辑值变更回调（清除过期校验错误并重校验） | <en/> Editing-value-changed callback (clears stale errors and re-validates) */
  onEditingValueChange?: (params: { rowIndex: number, columnKey: string, value: any, rowData?: unknown }) => void
}

/** <zh/> 编辑缓冲返回 | <en/> Edit-buffer return */
export interface UseCellEditBufferReturn {
  /** <zh/> 读取编辑缓冲值（含行引用一致性守卫） | <en/> read an edit buffer value (with the row-reference consistency guard) */
  getCellEditingValue: (columnKey: string) => unknown
  /** <zh/> 写入编辑缓冲值（含行引用一致性守卫） | <en/> write an edit buffer value (with the row-reference consistency guard) */
  updateCellEditingValue: (columnKey: string, val: unknown) => void
  /** <zh/> 实时校验当前编辑值（不提交） | <en/> live-validate the current edit value (without committing) */
  validateCurrentValue: () => Promise<void>
}

/**
 * <zh/> 创建编辑缓冲读写与实时校验
 * <en/> Create the edit buffer I/O and live validation
 */
export function useCellEditBuffer<T = any>(deps: UseCellEditBufferDeps<T>): UseCellEditBufferReturn {
  const {
    data,
    columns,
    session,
    isFullRowEdit,
    validateFn,
    onEditingValueChange,
  } = deps

  const {
    editingCell,
    editingValue,
    editingRowIndex,
    editingValues,
    editingRowRef,
    validationBlocked,
  } = session

  function getCellEditingValue(columnKey: string): any {
    if (isFullRowEdit.value) {
      /**
       * <zh/> fullRow 模式下行回收或数据变化（排序/筛选、删除）后：
       * <zh/> editingRowRef 可能与 data[editingRowIndex] 不一致（索引移位）。
       * <zh/> 行引用不一致时返回 undefined，避免渲染器为错误的行使用过期编辑值。
       * <zh/> 行滚回视图后若引用一致则正常返回 editingValues 中的值。
       *
       * <en/> In fullRow mode, after row recycling or data changes (sort/filter/delete),
       * <en/> editingRowRef may be inconsistent with data[editingRowIndex] (index shift).
       * <en/> Returns undefined when row reference is inconsistent, preventing the renderer from using stale edit values for the wrong row.
       * <en/> When the row scrolls back into view and references match, returns the value from editingValues normally.
       */
      const rowIndex = editingRowIndex.value
      if (rowIndex != null && editingRowRef.value != null) {
        const currentRow = data.value[rowIndex]
        if (currentRow !== editingRowRef.value)
          return undefined
      }
      return editingValues.value[columnKey]
    }
    /**
     * <zh/> cell 模式行引用一致性守卫——排序/筛选/分页导致数据变化后，
     * <zh/> editingCell.rowIndex 可能已指向不同的行。通过 editingRowRef 引用比较检测索引过期，
     * <zh/> 引用不一致时返回 undefined，避免渲染器为错误的行使用过期编辑值。
     * <en/> Cell-mode row-reference consistency guard — after sort/filter/pagination shifts the data,
     * <en/> editingCell.rowIndex may point to a different row. Reference comparison via editingRowRef
     * <en/> detects index staleness; returns undefined when inconsistent, preventing the renderer from
     * <en/> using a stale edit value for the wrong row.
     */
    if (editingCell.value && editingRowRef.value != null) {
      const currentRow = data.value[editingCell.value.rowIndex]
      if (currentRow !== editingRowRef.value)
        return undefined
    }
    return editingValue.value
  }

  function updateCellEditingValue(columnKey: string, val: unknown): void {
    if (isFullRowEdit.value) {
      // 原地修改 + triggerRef，避免每次按键创建新对象增加 GC 压力
      // In-place mutation + triggerRef, avoids creating new objects per keystroke to reduce GC pressure
      editingValues.value[columnKey] = val
      triggerRef(editingValues)
      if (editingRowIndex.value !== null) {
        onEditingValueChange?.({ rowIndex: editingRowIndex.value, columnKey, value: val, rowData: editingRowRef.value ?? undefined })
      }
    }
    else {
      /**
       * <zh/> cell 模式行引用一致性守卫——排序/筛选/分页导致数据变化后，
       * <zh/> editingCell.rowIndex 可能已指向不同的行。通过 editingRowRef 引用比较检测索引过期，
       * <zh/> 引用不一致时丢弃此次更新，避免为错误的行写入编辑值。
       * <en/> Cell-mode row-reference consistency guard — after sort/filter/pagination shifts the data,
       * <en/> editingCell.rowIndex may point to a different row. Reference comparison via editingRowRef
       * <en/> detects index staleness; drops the update when inconsistent, preventing writes to the wrong row.
       */
      if (editingCell.value && editingRowRef.value != null) {
        const currentRow = data.value[editingCell.value.rowIndex]
        if (currentRow !== editingRowRef.value)
          return
      }
      editingValue.value = val
      // <zh/> cell 模式下也触发 onEditingValueChange——清除该单元格的校验错误并重新实时校验，
      // <zh/> 确保用户更正非法值后错误标记立即消除，无需等待提交
      // <en/> Also trigger onEditingValueChange in cell mode —clears the cell's validation error and re-validates in real-time,
      // <en/> ensuring error markers are removed immediately when the user corrects an invalid value, without waiting for commit
      if (editingCell.value) {
        onEditingValueChange?.({
          rowIndex: editingCell.value.rowIndex,
          columnKey,
          value: val,
          rowData: data.value[editingCell.value.rowIndex],
        })
      }
    }
  }

  /**
   * <zh/> 校验当前编辑中的单元格值（不提交），供编辑器 trigger: 'input'/'change' 时调用。
   * <zh/> 仅在单格编辑模式且有 editorRules 时生效。
   *
   * <en/> Validates the current editing cell value (without committing), called when editor trigger is 'input'/'change'.
   * <en/> Only effective in single-cell edit mode and when editorRules are present.
   */
  async function validateCurrentValue(): Promise<void> {
    const cell = editingCell.value
    if (!cell || !validateFn)
      return
    const col = findColumnByKey(columns.value, cell.columnKey)
    if (!col?.editorRules)
      return
    const valid = await validateFn({
      mode: 'cell',
      rowIndex: cell.rowIndex,
      columnKey: cell.columnKey,
      value: editingValue.value,
      // <zh/> 同 validateCellCommit：传行数据避免校验错误键回退为 rowIndex（键域分裂）
      // <en/> Same as validateCellCommit: pass row data so the error key does not degrade to rowIndex
      rowData: data.value[cell.rowIndex],
    })
    /**
     * <zh/> 实时校验通过即解锁 validationBlocked——'block' 模式下输入合法值即可解锁。
     * <zh/> 全表锁死，无需等待提交或 Escape。
     * <en/> Unlock validationBlocked when live validation passes —in 'block' mode a valid
     * <en/> input releases the table-wide lock without waiting for commit or Escape.
     */
    if (valid) {
      validationBlocked.value = false
    }
  }

  return {
    getCellEditingValue,
    updateCellEditingValue,
    validateCurrentValue,
  }
}
