import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellEditEvent, CellEditingRequestEvent, CellEditingStartedEvent, CellEditingStoppedEvent, CellEditStopReason, CommitResult, EditConfig, EditingCellState, EditPersistPayload, FullRowEditEvent } from '../../types/edit'
import type { CellEditKernel } from '../editing/use-cell-edit-kernel'
import type { UseEditDirtyDeps } from '../editing/use-edit-dirty'
import type { UseEditorResolverReturn } from '../editing/use-editor-resolver'

import { computed, getCurrentScope, onScopeDispose } from 'vue'
import { createEditRaceProtection } from '../../utils/edit-race-protection'
import { useBatchCommit } from '../editing/use-batch-commit'
import { useCellEditApply } from '../editing/use-cell-edit-apply'
import { useCellEditBuffer } from '../editing/use-cell-edit-buffer'
import { useCellEditEvents } from '../editing/use-cell-edit-events'
import { useCellEditKernel } from '../editing/use-cell-edit-kernel'
import { useCellEditLifecycle } from '../editing/use-cell-edit-lifecycle'
import { useCellEditLocation } from '../editing/use-cell-edit-location'
import { useCellEditSession } from '../editing/use-cell-edit-session'
import { useCellEditValidation } from '../editing/use-cell-edit-validation'
import { useEditDirty } from '../editing/use-edit-dirty'

export type { ApplyChangeResult, ApplyChangeStatus } from '../editing/use-cell-edit-apply'

export interface UseCellEditOptions<T = any> {
  data: ComputedRef<T[]>
  columns: ComputedRef<ProcessedColumn[]>
  editConfig: ComputedRef<EditConfig | undefined>
  /** <zh/> 行唯一标识函数 getter——使用 getter 而非快照，支持运行时 rowKey 配置变更 | <en/> Row key function getter —uses getter instead of snapshot, supports runtime rowKey config changes */
  rowKeyFn?: () => (row: T) => string
  /** <zh/> 数据更新回调；source 省略时默认为'view-slice'，因 useCellEdit 操作的是可见数据（页切片/渲染数据），由编排器经 rowKey 合并回全量数据| <en/> Data update callback; source defaults to 'view-slice' when omitted, since useCellEdit operates on visible data (page slice / render data); the orchestrator merges it back into the full dataset by rowKey */
  onDataUpdate: (newData: T[], source?: 'full' | 'view-slice') => void
  onCellValueChanged?: (event: CellEditEvent<T>) => void
  onFullRowEditChanged?: (event: FullRowEditEvent<T>) => void
  onCellEditingStarted?: (event: CellEditingStartedEvent<T>) => void
  onCellEditingStopped?: (event: CellEditingStoppedEvent<T>) => void
  onBatchRecordChange?: (params: { rowKey: string | number, prop: string, newValue: any, oldValue: any }) => void
  onCellEditRequest?: (event: CellEditingRequestEvent<T>) => void
  /** <zh/> 编辑因行被删除或数据变更而被迫取消时触发 | <en/> Triggered when editing is forced to cancel due to row deletion or data change */
  onEditCancelled?: (payload: { reason: 'row-deleted' | 'data-changed' }) => void
  /**
   * <zh/> saveCells 悲观协议落库失败回调——编排器接 tableEmit('error', { code:'TABLE_EDIT_ROLLBACK' }) |
   * <en/> saveCells pessimistic failure callback — the orchestrator wires it to tableEmit('error', { code:'TABLE_EDIT_ROLLBACK' })
   */
  onRollback?: (info: { cause: unknown }) => void
  validateFn?: (params: {
    mode: 'cell' | 'row'
    rowIndex: number
    columnKey: string
    value: any
    values?: Record<string, any>
    /** <zh/> 行数据——供校验器解析 rowKey 作为错误键，缺省时回退 rowIndex（键域分裂风险） | <en/> Row data — lets the validator resolve rowKey as the error key; without it the key degrades to rowIndex (domain-split risk) */
    rowData?: unknown
  }) => Promise<boolean>
  interceptor?: import('../editing/use-interceptor').UseInterceptorReturn
  pushUndo?: (entry: import('./use-edit-undo').EditUndoEntry) => void
  /**
   * <zh/> 全行编辑模式下，单元格编辑值变更时调用，用于清除过期错误并触发单元格级重新校验
   * <en/> Called when cell edit value changes in full row edit mode, used to clear expired errors and trigger cell-level re-validation
   * @remarks
   * <zh/> 不在 useCellEdit 内部直接操作 errorMap，而是委托给调用方（table.vue），保持 useCellEdit 与 useCellValidate 的职责分离
   * <en/> Does not directly operate errorMap inside useCellEdit, but delegates to the caller (table.vue) to maintain separation of concerns between useCellEdit and useCellValidate
   */
  onEditingValueChange?: (params: { rowIndex: number, columnKey: string, value: any, rowData?: unknown }) => void
  /**
   * <zh/> notify 模式下校验失败时的通知回调——由调用方注入通知 UI（如 ElMessage）
   * <en/> Notification callback when validation fails in notify mode —the caller injects the notification UI (e.g. ElMessage)
   * @remarks
   * <zh/> 仅在 invalidEditValueMode='notify' 且校验失败时调用。调用方（编辑编排器）负责展示通知
   * <en/> Only called when invalidEditValueMode='notify' and validation fails. The caller (editing orchestrator) is responsible for displaying the notification
   */
  onNotifyValidationError?: (params: { rowIndex: number, columnKey: string, prop: string }) => void
  /** 编辑器解析 API —— 由调用方通过 options 注入 */
  editorResolver: UseEditorResolverReturn
}

export interface UseCellEditReturn<T = any> {
  editingCell: Ref<EditingCellState | null>
  editingValue: Ref<any>
  isEditing: ComputedRef<boolean>
  isCellEditing: (rowIndex: number, columnKey: string) => boolean
  startEditing: (params: {
    rowIndex: number
    prop: string
    columnKey: string
    value: any
  }) => Promise<void>
  stopEditing: (reason: CellEditStopReason, commit?: boolean) => void
  commitEditing: (reason?: CellEditStopReason) => Promise<CommitResult>
  cancelEditing: (reason?: CellEditStopReason) => void
  isColumnEditable: (col: ProcessedColumn) => boolean
  isFullRowEdit: ComputedRef<boolean>
  editingRowIndex: Ref<number | null>
  editingValues: Ref<Record<string, any>>
  getCellEditingValue: (columnKey: string) => unknown
  updateCellEditingValue: (columnKey: string, val: unknown) => void
  /** <zh/> 校验锁定标志（只读，外部勿写） | <en/> Validation lock flag (readonly, do not write externally) */
  validationBlocked: Readonly<Ref<boolean>>
  isCellDirty: (rowIndex: number, columnKey: string) => boolean
  /** <zh/> 持有脏记录的行键集合（rowKey 域）——供 RowViewModel 稀疏化 | <en/> Row keys holding dirty records — for the sparse RowViewModel */
  dirtyRowKeys: ShallowRef<ReadonlySet<string>>
  hasUnsavedChanges: () => boolean
  /**
   * 批量提交多个单元格变更（用于粘贴等场景），避免逐单元格触发数据更新
   * @param cells - 待提交的单元格列表
   * @param reason - 编辑停止原因
   */
  batchCommitCells: (cells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any }>, reason?: CellEditStopReason) => Promise<CommitResult>
  /**
   * <zh/> 悲观保存——批量写入并等待持久化确认，失败自动回滚。详见 saveCells 实现 |
   * <en/> Pessimistic save — batch-writes cells awaiting persistence confirmation with auto-rollback. See saveCells implementation
   */
  saveCells: (cells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any }>, options?: { persist?: (payload: EditPersistPayload<T>) => Promise<void> | void | boolean }) => Promise<CommitResult>
  validateCurrentValue: () => Promise<void>
}

/**
 * 单元格编辑 composable，管理编辑状态、值流转（valueParser、valueSetter）、Tab/Enter 导航与撤销栈。
 *
 * 职责拆分（Vue 最佳实践 composables.md：小而专注、可预测的 API）：
 * - 会话状态 → `use-cell-edit-session.ts`
 * - 会话机（准入/开停取消/编辑值读写） → `use-cell-edit-lifecycle.ts`
 * - 提交（单格 / 整行 + 拦截器裁决） → `use-cell-edit-kernel.ts`（统一入口 commitCellEdit，`use-cell-edit-commit.ts` 仅保留转发）
 * - 持久化（批量提交 / 悲观保存） → `use-cell-edit-persist.ts`
 * - 行重定位 → `use-cell-edit-location.ts`
 * - 校验相位 → `use-cell-edit-validation.ts`
 * - 值流转 → `use-cell-edit-apply.ts`
 * - 事件发射 → `use-cell-edit-events.ts`
 * - 脏标记追踪 → `use-edit-dirty.ts`
 * - 批量提交内核 → `use-batch-commit.ts`
 * - 纯函数工具 → `utils/edit-helpers.ts`
 * 本文件为 facade，只负责装配子模块并对外提供统一 API；不含任何编辑业务逻辑。
 *
 * @param options - 编辑配置
 * @returns 编辑状态与操作方法
 */
export function useCellEdit<T = any>(options: UseCellEditOptions<T>): UseCellEditReturn<T> {
  const {
    data,
    columns,
    editConfig,
    onDataUpdate,
    onCellValueChanged,
    onFullRowEditChanged,
    onCellEditingStarted,
    onCellEditingStopped,
    onBatchRecordChange,
    onCellEditRequest,
    onEditCancelled,
    onRollback,
    validateFn,
    interceptor,
    pushUndo,
    onEditingValueChange,
    onNotifyValidationError,
    editorResolver,
  } = options

  const {
    isColumnEditable,
  } = editorResolver

  /**
   * <zh/> 响应式 rowKey 函数——通过 getter 传入，支持运行时 rowKey 配置变更。
   * <zh/> 返回 null 表示未配置 rowKey，此时 dirty 追踪功能降级为不可用。
   *
   * <en/> Reactive rowKey function —passed in via getter, supports runtime rowKey config changes.
   * <en/> Returns null when rowKey is not configured, in which case dirty tracking degrades to unavailable.
   */
  const rowKey = computed<((row: T) => string) | null>(() => options.rowKeyFn?.() ?? null)

  /**
   * <zh/> 编辑会话状态子模块——纯代码拆分，行为与内联时一致；
   * <zh/> 解构保持同一引用，后续读写与原来完全等价。
   * <en/> Edit session state sub-module — pure code split, behavior identical to inline;
   * <en/> destructuring keeps the identical references, so later reads/writes are fully equivalent.
   */
  const session = useCellEditSession<T>({ onEditCancelled })

  const isFullRowEdit = computed(() => editConfig.value?.editType === 'fullRow')
  const isBatchEdit = computed(() => editConfig.value?.editType === 'batch')
  const isReadOnlyEdit = computed(() => editConfig.value?.editType === 'readOnly')

  /** <zh/> 值流转管线——按编辑模式分发变更并执行直接写入 | <en/> Value pipeline —routes changes by edit mode and performs direct writes */
  const apply = useCellEditApply<T>({
    isReadOnlyEdit,
    isBatchEdit,
    data,
    rowKey,
    onDataUpdate,
    onBatchRecordChange,
    onCellEditRequest,
  })

  const raceProtection = createEditRaceProtection<T>({
    dataRef: data,
    onDataChanged: session.cancelDueToDataChanged,
  })

  /**
   * <zh/> 行重定位子模块——纯代码拆分，行为与内联时一致。
   * <en/> Row-relocation sub-module — pure code split, behavior identical to inline.
   */
  const { resolveStaleIndex } = useCellEditLocation<T>({
    rowKey,
    editingRowKey: session.editingRowKey,
    editingRowRef: session.editingRowRef,
  })

  const dirtyDeps: UseEditDirtyDeps<T> = {
    data,
    columns,
    editConfig,
    rowKey,
    editingCell: session.editingCell,
    // <zh/> fullRow 编辑态——编辑缓冲不写 data，缺省时 fullRow 行脏标恒 false
    // <en/> fullRow editing state — without it the dirty marker is always false for fullRow rows
    fullRowEditing: {
      isFullRowEdit,
      editingRowIndex: session.editingRowIndex,
      editingValues: session.editingValues,
    },
  }
  const {
    dirtyCells,
    dirtyRowKeys,
    isCellDirty,
    recordOriginalValue,
    clearDirtyCell,
  } = useEditDirty(dirtyDeps)

  /**
   * <zh/> 事件发射子模块——纯代码拆分，行为与内联时一致；isCellDirty 就绪后装配。
   * <en/> Event-emit sub-module — pure code split, behavior identical to inline; assembled once isCellDirty is ready.
   */
  const events = useCellEditEvents<T>({
    data,
    columns,
    isFullRowEdit,
    editingCell: session.editingCell,
    editingRowIndex: session.editingRowIndex,
    editingValues: session.editingValues,
    onCellValueChanged,
    onCellEditingStopped,
    isColumnEditable,
    isCellDirty,
  })

  /**
   * <zh/> 提交相位延迟绑定器——会话机与提交相位互相依赖：
   * <zh/> 会话机在"切换单元格"时要先提交旧会话，提交相位在拦截器/校验裁决为拒时要取消会话。
   * <zh/> 二者无法按创建顺序直接互引，故会话机先建、提交相位后建，
   * <zh/> 会话机经此持有器在**调用时**（装配完成后的运行期）取用提交入口。
   * <zh/> 不变量：任何运行期调用发生时装配必已完成——getCommit 用显式断言代替非空断言，
   * <zh/> 装配顺序被破坏时此处 fail-fast 报错而非静默 TypeError。
   * <en/> Late-bound commit holder — the session machine and the commit phase depend on each other:
   * <en/> the machine must commit the previous session when switching cells, and the commit phase
   * <en/> must cancel the session when an interceptor / validation veto fires. Neither can be
   * <en/> created first with a direct reference, so the machine is built first, the commit phase
   * <en/> second, and the machine resolves the commit entry through this holder at **call time**
   * <en/> (runtime, after assembly completes).
   * <en/> Invariant: assembly always completes before any runtime call — getCommit fail-fasts with
   * <en/> an explicit error instead of a non-null assertion, so a broken assembly order fails loudly
   * <en/> instead of throwing a cryptic TypeError.
   */
  const commitHolder: { current: CellEditKernel | null } = { current: null }

  function getCommitPhase(): CellEditKernel {
    const commit = commitHolder.current
    if (!commit)
      throw new Error('[AdvTable] Commit phase accessed before editing assembly completed — the build order in use-cell-edit.ts was broken by a refactor.')
    return commit
  }

  /** <zh/> 会话机（准入 / 开停取消 / 编辑值读写） | <en/> Session machine (admission / open-stop-cancel / edit-value I/O) */
  const lifecycle = useCellEditLifecycle<T>({
    data,
    columns,
    editConfig,
    rowKey,
    session,
    isFullRowEdit,
    isColumnEditable,
    raceProtection,
    resolveStaleIndex,
    dirty: { dirtyCells, recordOriginalValue },
    events,
    interceptor,
    onCellEditingStarted,
    onCellEditingStopped,
    commitEditingInternal: (reason, skipPendingStartGate) => getCommitPhase().commitEditingInternal(reason, skipPendingStartGate),
  })

  /** <zh/> 编辑缓冲读写 + 实时校验 | <en/> Edit-buffer I/O + live validation */
  const buffer = useCellEditBuffer<T>({
    data,
    columns,
    session,
    isFullRowEdit,
    validateFn,
    onEditingValueChange,
  })

  const { handleValidationFailure, validateCellCommit } = useCellEditValidation<T>({
    validateFn,
    editConfig,
    raceProtection,
    editingRowKey: session.editingRowKey,
    validationBlocked: session.validationBlocked,
    cancelEditing: lifecycle.cancelEditing,
    onNotifyValidationError,
  })

  /** <zh/> 提交内核门面（单格 / 整行统一入口 + 拦截器裁决） | <en/> Commit kernel facade (unified cell / row entry + interceptor ruling) */
  const commit = useCellEditKernel<T>({
    data,
    columns,
    session,
    isFullRowEdit,
    isReadOnlyEdit,
    isBatchEdit,
    isColumnEditable,
    validation: { handleValidationFailure, validateCellCommit },
    events,
    apply,
    dirty: { clearDirtyCell },
    resolveStaleIndex,
    cancelEditing: lifecycle.cancelEditing,
    raceProtection,
    interceptor,
    validateFn,
    onDataUpdate,
    onFullRowEditChanged,
    pushUndo,
  })
  commitHolder.current = commit

  /** <zh/> 持久化相位（批量提交 / 悲观保存）——与 batch-commit 内核同文件，saveCells 内聚其中 | <en/> Persistence phase (batch commit / pessimistic save) — colocated with the batch-commit kernel; saveCells lives there */
  const persist = useBatchCommit<T>({
    data,
    columns,
    interceptor,
    validateFn,
    applyChange: apply.applyChange,
    clearDirtyCell,
    pushUndo,
    rowKey,
    onCellValueChanged,
    onEditCancelled,
    onRollback,
    isUnmounted: () => raceProtection.unmounted,
    onDataUpdate,
    editConfig,
  })

  // <zh/> 仅在存在活动 effect scope 时注册卸载守卫——裸调用场景（单测直连本组合式）
  // <zh/> 无作用域可绑定，注册会告警且无意义（与 use-column-sort 的实例守卫同一范式）。
  // <en/> Register the unmount guard only when an active effect scope exists — bare invocation
  // <en/> (unit tests calling this composable directly) has no scope to bind; registering would
  // <en/> warn pointlessly (same pattern as the instance guard in use-column-sort).
  if (getCurrentScope()) {
    onScopeDispose(() => {
      raceProtection.markUnmounted()
      session.resetEditingState()
    })
  }

  return {
    editingCell: session.editingCell,
    editingValue: session.editingValue,
    isEditing: lifecycle.isEditing,
    isCellEditing: lifecycle.isCellEditing,
    startEditing: lifecycle.startEditing,
    stopEditing: lifecycle.stopEditing,
    commitEditing: commit.commitEditing,
    cancelEditing: lifecycle.cancelEditing,
    isColumnEditable,
    isFullRowEdit,
    editingRowIndex: session.editingRowIndex,
    editingValues: session.editingValues,
    getCellEditingValue: buffer.getCellEditingValue,
    updateCellEditingValue: buffer.updateCellEditingValue,
    validationBlocked: session.validationBlocked,
    isCellDirty,
    dirtyRowKeys,
    hasUnsavedChanges: lifecycle.hasUnsavedChanges,
    batchCommitCells: persist.batchCommitCells,
    saveCells: persist.saveCells,
    validateCurrentValue: buffer.validateCurrentValue,
  }
}
