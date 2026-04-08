import type { ShallowRef } from 'vue'
import type { EditingCellState } from '../../types/edit'
import { shallowRef } from 'vue'

/**
 * <zh/> 单元格编辑会话依赖——均为调用方持有的回调，子模块不自建回调
 * <en/> Cell-edit session dependencies — callbacks owned by the caller, none created here
 */
export interface CellEditSessionDeps {
  /** <zh/> 编辑因行被删除或数据变更而被迫取消时触发 | <en/> Triggered when editing is forced to cancel due to row deletion or data change */
  onEditCancelled?: (payload: { reason: 'row-deleted' | 'data-changed' }) => void
}

/**
 * <zh/> 编辑会话状态
 * <zh/> 持有单格/整行编辑共用的全部可变会话引用（编辑格、编辑值、行索引、行值表、
 * <zh/> 校验阻塞标志、行键、行引用）与重置/被迫取消出口；调用方解构后继续使用同一引用。
 * <en/> Edit session state.
 * <en/> Owns every mutable session ref shared by cell/row editing (editing cell/value, row index,
 * <en/> row values, validation-block flag, row key/ref) plus the reset/forced-cancel exits;
 * <en/> callers destructure and keep using the identical references.
 */
export function useCellEditSession<T = any>(deps: CellEditSessionDeps = {}): {
  editingCell: ShallowRef<EditingCellState | null>
  editingValue: ShallowRef<unknown>
  editingRowIndex: ShallowRef<number | null>
  editingValues: ShallowRef<Record<string, any>>
  validationBlocked: ShallowRef<boolean>
  editingRowKey: ShallowRef<string | null>
  editingRowRef: ShallowRef<T | null>
  resetEditingState: () => void
  cancelDueToRowDeleted: () => void
  cancelDueToDataChanged: () => void
} {
  const { onEditCancelled } = deps

  const editingCell = shallowRef<EditingCellState | null>(null)

  const editingValue = shallowRef<unknown>(null)

  const editingRowIndex = shallowRef<number | null>(null)

  const editingValues = shallowRef<Record<string, any>>({})

  const validationBlocked = shallowRef(false)

  const editingRowKey = shallowRef<string | null>(null)

  /**
   * <zh/> 编辑开始时的行对象引用——用于未配置 rowKey 时检测索引过期。
   * <zh/> 当 data 因排序/筛选/删除导致索引移位时，通过引用比较判断 currentIndex 是否仍指向原始行。
   *
   * <en/> Row object reference captured at edit start — used to detect index staleness when rowKey is not configured.
   * <en/> When data shifts due to sorting/filtering/deletion, reference comparison determines if currentIndex still points to the original row.
   */
  const editingRowRef = shallowRef<T | null>(null)

  /**
   * <zh/> 重置全部编辑状态——清除编辑单元格、编辑值、行索引、行键、行引用和校验阻塞标志。
   * <zh/> 用于 cancelEditing 拦截器阻止后清理、cancelEditing 最终清理、组件卸载时防御性清理。
   * <zh/> 对已为 null/{} 的字段赋值是 Vue ref 的 no-op（不触发响应式更新），可安全无条件调用。
   * <en/> Reset all editing state — clears editing cell, editing value, row index, row key, row ref and validation blocked flag.
   * <en/> Used for cleanup after cancelEditing interceptor block, cancelEditing final cleanup, and defensive cleanup on unmount.
   * <en/> Assigning to already null/{} fields is a Vue ref no-op (does not trigger reactivity), safe to call unconditionally.
   */
  function resetEditingState(): void {
    editingCell.value = null
    editingValue.value = null
    editingRowIndex.value = null
    editingValues.value = {}
    editingRowKey.value = null
    editingRowRef.value = null
    validationBlocked.value = false
  }

  /** <zh/> 编辑因行被删除而取消——重置状态并通知宿主 | <en/> Edit cancelled due to row deletion — reset state and notify host */
  function cancelDueToRowDeleted(): void {
    resetEditingState()
    onEditCancelled?.({ reason: 'row-deleted' })
  }

  /** <zh/> 编辑因数据变更（排序/筛选/分页）而取消——重置状态并通知宿主 | <en/> Edit cancelled due to data change (sort/filter/pagination) — reset state and notify host */
  function cancelDueToDataChanged(): void {
    resetEditingState()
    onEditCancelled?.({ reason: 'data-changed' })
  }

  return {
    editingCell,
    editingValue,
    editingRowIndex,
    editingValues,
    validationBlocked,
    editingRowKey,
    editingRowRef,
    resetEditingState,
    cancelDueToRowDeleted,
    cancelDueToDataChanged,
  }
}

/** <zh/> useCellEditSession 返回形状（供类型复用） | <en/> useCellEditSession return shape (for type reuse) */
export type CellEditSession<T = any> = ReturnType<typeof useCellEditSession<T>>
