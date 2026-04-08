/**
 * <zh/> 值流转管线 composable
 * <en/> Value-pipeline composable
 *
 * @remarks
 * <zh/> 职责单一：按编辑模式（readOnly/batch/setter/直写）将单元格变更路由到对应写入策略，
 * <zh/> 并对直写场景执行「浅拷贝数组 + 替换目标行引用」的数据更新。状态编排（start/stop/commit）
 * <zh/> 仍由 use-cell-edit.ts 负责，本模块只负责「变更如何落地」。
 * <en/> Single responsibility: routes a cell change to the matching write strategy by edit mode
 * <en/> (readOnly/batch/setter/direct), and for direct writes performs the shallow-copy-array +
 * <en/> replace-target-row data update. State orchestration (start/stop/commit) stays in use-cell-edit.ts;
 * <en/> this module only decides how a change lands.
 */
import type { ComputedRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellEditingRequestEvent, CellEditStopReason } from '../../types/edit'
import { devWarn } from '../../utils/dev-warn'
import { replaceRowInArray } from '../../utils/edit-helpers'
import { isDev } from '../../utils/env'

/**
 * <zh/> applyChange 结果状态——取代原 boolean 返回的三重语义：
 * <zh/> - readOnly：已通过 onCellEditRequest 通知宿主，数据未变更
 * <zh/> - batch：已记录到 pendingChanges，数据未变更
 * <zh/> - setter：valueSetter 已执行（可能未实际变更行）
 * <zh/> - unhandled：未处理，调用方需走 applyDirectUpdate
 * <en/> applyChange result status — replaces the boolean's 3-way meaning:
 * <en/> - readOnly: host notified via onCellEditRequest, data unchanged
 * <en/> - batch: recorded to pendingChanges, data unchanged
 * <en/> - setter: valueSetter executed (row may not have changed)
 * <en/> - unhandled: not handled, caller must apply a direct update
 */
export type ApplyChangeStatus = 'readOnly' | 'batch' | 'setter' | 'unhandled'

/** <zh/> applyChange 结果对象 | <en/> applyChange result object */
export interface ApplyChangeResult {
  status: ApplyChangeStatus
  /** <zh/> 是否已处理（readOnly/batch/setter 为 true） | <en/> whether handled (true for readOnly/batch/setter) */
  handled: boolean
  /**
   * <zh/> 变更是否已实际应用到数据
   * <zh/> setter 拒写（valueSetter 返回 false）时为 false，调用方据此跳过 emit/undo
   * <en/> Whether the change was actually applied to the data
   * <en/> false when a setter rejects the write (valueSetter returns false); callers skip emit/undo accordingly
   */
  applied: boolean
}

/** <zh/> applyChange 的统一入参 | <en/> Unified params for applyChange */
export interface ApplyChangeParams<T = any> {
  row: T
  rowIndex: number
  prop: string
  column: ProcessedColumn
  oldValue: any
  newValue: any
  reason: CellEditStopReason
}

/** <zh/> 值流转管线依赖 | <en/> Value-pipeline dependencies */
export interface UseCellEditApplyDeps<T = any> {
  isReadOnlyEdit: ComputedRef<boolean>
  isBatchEdit: ComputedRef<boolean>
  data: ComputedRef<T[]>
  /** <zh/> 响应式 rowKey 函数（未配置时为 null，batch 模式依赖它定位行） | <en/> Reactive rowKey function (null when unconfigured; batch mode relies on it to locate the row) */
  rowKey: ComputedRef<((row: T) => string) | null>
  onDataUpdate: (newData: T[], source?: 'full' | 'view-slice') => void
  onBatchRecordChange?: (params: { rowKey: string | number, prop: string, newValue: any, oldValue: any }) => void
  onCellEditRequest?: (event: CellEditingRequestEvent<T>) => void
}

export interface UseCellEditApplyReturn<T = any> {
  applyChange: (params: ApplyChangeParams<T>) => ApplyChangeResult
  applyDirectUpdate: (rowIndex: number, prop: string, newValue: any) => void
}

/**
 * <zh/> 创建值流转管线——按编辑模式分发变更并执行直写
 * <en/> Create the value pipeline — routes changes by edit mode and performs direct writes
 */
export function useCellEditApply<T = any>(deps: UseCellEditApplyDeps<T>): UseCellEditApplyReturn<T> {
  const {
    isReadOnlyEdit,
    isBatchEdit,
    data,
    rowKey,
    onDataUpdate,
    onBatchRecordChange,
    onCellEditRequest,
  } = deps

  /** <zh/> readOnly 模式策略——仅通知宿主，不写数据 | <en/> readOnly strategy — notify host only, no data write */
  function applyReadOnlyChange(params: ApplyChangeParams<T>): ApplyChangeResult {
    if (onCellEditRequest) {
      onCellEditRequest({
        row: params.row,
        rowIndex: params.rowIndex,
        prop: params.prop,
        column: params.column,
        oldValue: params.oldValue,
        newValue: params.newValue,
        reason: params.reason,
      })
    }
    return { status: 'readOnly', handled: true, applied: false }
  }

  /** <zh/> batch 模式策略——仅记录挂起变更 | <en/> batch strategy — record pending change only */
  function applyBatchChange(params: ApplyChangeParams<T>): ApplyChangeResult {
    if (!rowKey.value) {
      if (isDev) {
        devWarn(
          '[AdvTable] batch 编辑模式（editConfig.mode="batch"）要求配置 row-key，否则变更无法按行定位提交，已降级为直写模式。',
          'Batch edit mode requires a row-key to locate rows on commit; fell back to direct write.',
        )
      }
      return { status: 'unhandled', handled: false, applied: false }
    }
    if (onBatchRecordChange) {
      onBatchRecordChange({ rowKey: rowKey.value(params.row), prop: params.prop, newValue: params.newValue, oldValue: params.oldValue })
    }
    return { status: 'batch', handled: true, applied: false }
  }

  /** <zh/> valueSetter 策略——执行用户 setter 并同步行引用 | <en/> valueSetter strategy — run user setter and sync row reference */
  function applySetterChange(params: ApplyChangeParams<T>): ApplyChangeResult {
    const { row, rowIndex, column, oldValue, newValue } = params
    const success = column.valueSetter({ row, column, rowIndex, newValue, oldValue })
    if (success) {
      /**
       * <zh/> 与 applyDirectUpdate 对称：浅拷贝数组 + 替换目标行引用。
       * <zh/> 使用 { ...row } 确保行引用更新，触发行级 reactivity。
       *
       * <en/> Symmetric with applyDirectUpdate: shallow copy array + replace target row reference.
       * <en/> { ...row } ensures the row reference is updated, triggering row-level reactivity.
       */
      const currentData = data.value
      onDataUpdate(replaceRowInArray(currentData, rowIndex, { ...row } as T))
      return { status: 'setter', handled: true, applied: true }
    }
    /**
     * <zh/> valueSetter 拒写（返回 false）——变更未应用，标记 applied:false
     * <zh/> 上游据此跳过 emitCellValueChanged 和 pushUndo，避免「事件已发、数据未变」的假成功
     * <en/> valueSetter rejected the write (returned false) — change not applied, mark applied:false
     * <en/> Callers skip emitCellValueChanged and pushUndo to avoid a false success where events fire but data is unchanged
     */
    return { status: 'setter', handled: true, applied: false }
  }

  /**
   * <zh/> 变更分发门面——按编辑模式路由到对应策略。
   * <zh/> 返回结果对象而非 boolean：调用方据此区分 readOnly（不发射事件）、
   * <zh/> batch（不入 undo 栈）、setter（可能已 mutation 行）与 unhandled（需直写）。
   * <en/> Change dispatch facade — routes to a strategy by edit mode.
   * <en/> Returns a result object instead of boolean, letting callers distinguish readOnly
   * <en/> (no event), batch (no undo), setter (row may be mutated) and unhandled (direct write).
   */
  function applyChange(params: ApplyChangeParams<T>): ApplyChangeResult {
    if (isReadOnlyEdit.value)
      return applyReadOnlyChange(params)
    if (isBatchEdit.value)
      return applyBatchChange(params)
    if (params.column.valueSetter)
      return applySetterChange(params)
    return { status: 'unhandled', handled: false, applied: false }
  }

  function applyDirectUpdate(rowIndex: number, prop: string, newValue: any): void {
    const currentData = data.value
    // Note: dynamic property spread on generic T
    const updatedRow = { ...(currentData[rowIndex] as Record<string, unknown>), [prop]: newValue } as T
    /**
     * <zh/> 原地替换行对象 + 浅拷贝数组，避免 .map 遍历全量元素。
     * <zh/> shallowRef 通过引用比较检测变更，新数组引用即可触发响应式更新。
     *
     * <en/> In-place row replacement + shallow array copy, avoids .map traversing all elements.
     * <en/> shallowRef detects changes via reference comparison; a new array reference triggers reactive updates.
     */
    onDataUpdate(replaceRowInArray(currentData, rowIndex, updatedRow))
  }

  return {
    applyChange,
    applyDirectUpdate,
  }
}
