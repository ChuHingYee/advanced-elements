/**
 * <zh/> 单元格编辑会话机 composable
 * <en/> Cell-edit session machine composable
 *
 * @remarks
 * <zh/> 职责单一：编辑会话的**生命周期**——准入判定（校验锁 / same_row / same_cell / 拦截器 /
 * <zh/> activeMethod）、开会话（单格 / 整行）、停会话（提交或取消）、会话期间的编辑值读写与实时校验。
 * <zh/> 会话持有的**状态引用**在 `use-cell-edit-session.ts`，会话的**结算**在
 * <zh/> `use-cell-edit-commit.ts`，批量/持久化写入在 `use-cell-edit-persist.ts`。
 * <en/> Single responsibility: the edit session **lifecycle** — admission checks (validation lock /
 * <en/> same_row / same_cell / interceptor / activeMethod), opening a session (cell / row), stopping
 * <en/> it (commit or cancel), and reading / writing edit values plus live validation while it is open.
 * <en/> The session's **state refs** live in `use-cell-edit-session.ts`, its **settlement** in
 * <en/> `use-cell-edit-commit.ts`, and batch / persistence writes in `use-cell-edit-persist.ts`.
 */
import type { ComputedRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type {
  CellEditingStartedEvent,
  CellEditingStoppedEvent,
  CellEditStopReason,
  CommitResult,
  EditConfig,
} from '../../types/edit'
import type { InterceptorEditStartParams } from '../../types/interceptor'
import type { EditRaceProtection } from '../../utils/edit-race-protection'
import type { CellEditEvents } from './use-cell-edit-events'
import type { CellEditSession } from './use-cell-edit-session'
import type { UseEditDirtyReturn } from './use-edit-dirty'
import type { UseInterceptorReturn } from './use-interceptor'
import { computed, watch } from 'vue'
import { findColumnByKey, traverseLeafColumns } from '../../utils/column-tree'
import { getColumnKey } from '../../utils/shared'
import { resolveCellValue } from '../../utils/value-pipeline'

/** <zh/> 编辑准入判定结果 | <en/> Edit admission verdict */
export interface EditStartCheckResult {
  /** <zh/> 是否允许开始 | <en/> whether starting is allowed */
  allowed: boolean
  /** <zh/> 拒绝原因（allowed=false 时给出） | <en/> rejection reason (given when allowed is false) */
  reason?: 'validation_blocked' | 'same_row' | 'same_cell' | 'intercepted' | 'active_method_denied'
  /** <zh/> 允许但需先提交当前会话 | <en/> allowed, but the current session must be committed first */
  needsCommit?: boolean
}

/** <zh/> 会话机依赖——均为调用方持有的状态与回调，子模块不自建状态 | <en/> Session-machine deps — state and callbacks owned by the caller, nothing created here */
export interface UseCellEditLifecycleDeps<T = any> {
  /** <zh/> 可见数据 | <en/> Visible data */
  data: ComputedRef<T[]>
  /** <zh/> 列配置 | <en/> Column configs */
  columns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 编辑配置 | <en/> Edit config */
  editConfig: ComputedRef<EditConfig | undefined>
  /** <zh/> 响应式 rowKey 函数（未配置时为 null） | <en/> Reactive rowKey function (null when unconfigured) */
  rowKey: ComputedRef<((row: T) => string) | null>
  /** <zh/> 会话状态 | <en/> Session state */
  session: CellEditSession<T>
  /** <zh/> 是否整行编辑 | <en/> Whether full-row editing */
  isFullRowEdit: ComputedRef<boolean>
  /** <zh/> 列可编辑判定 | <en/> Column-editable predicate */
  isColumnEditable: (col: ProcessedColumn) => boolean
  /** <zh/> 竞态保护控制器 | <en/> Race protection controller */
  raceProtection: EditRaceProtection<T>
  /** <zh/> 索引过期重定位 | <en/> Stale-index relocation */
  resolveStaleIndex: (currentData: T[], currentIndex: number) => number
  /** <zh/> 脏标记追踪 | <en/> Dirty tracking */
  dirty: Pick<UseEditDirtyReturn, 'dirtyCells' | 'recordOriginalValue'>
  /** <zh/> 事件发射相位 | <en/> Event-emit phase */
  events: Pick<CellEditEvents<T>, 'buildStopParams' | 'emitCellStopped' | 'emitRowCellsStopped'>
  /** <zh/> 事件拦截器 | <en/> Event interceptor */
  interceptor?: UseInterceptorReturn
  /** <zh/> 编辑开始回调 | <en/> Editing-started callback */
  onCellEditingStarted?: (event: CellEditingStartedEvent<T>) => void
  /**
   * <zh/> 编辑停止回调——仅作为"是否注册了停止监听"的开关使用（停止事件由事件相位发射）。
   * <zh/> 保留原 `cancelEditing` 的外层判空：两处 emit 内部虽已各有判空，外层判空可避免无监听时的
   * <zh/> 行查找开销，且与拆分前逐字等价（diff 可审计）。
   * <en/> Editing-stopped callback — used only as a "is a stop listener registered" switch (the stop
   * <en/> events themselves are emitted by the event phase). Keeps the original outer null check of
   * <en/> `cancelEditing`: both emits already guard internally, but the outer check avoids the row
   * <en/> lookup cost with no listener and stays verbatim-equivalent to the pre-split code (auditable diff).
   */
  onCellEditingStopped?: (event: CellEditingStoppedEvent<T>) => void
  /**
   * <zh/> 提交入口——延迟绑定：提交相位与会话机互相依赖（提交需要 cancelEditing，
   * <zh/> 会话机需要提交当前会话），由 facade 在两模块创建后接线。
   * <en/> Commit entry — late-bound: the commit phase and the session machine depend on each other
   * <en/> (commit needs cancelEditing, the machine needs to commit the current session), so the
   * <en/> facade wires them once both modules exist.
   */
  commitEditingInternal: (reason?: CellEditStopReason, skipPendingStartGate?: boolean) => Promise<CommitResult>
}

/**
 * <zh/> 会话机返回——与行类型无关（会话机只搬运行列坐标与编辑值，不消费行内容），故非泛型。
 * <en/> Session-machine return — row-type agnostic (the machine only carries row/column coordinates
 * <en/> and edit values, never row content), hence non-generic.
 */
export interface UseCellEditLifecycleReturn {
  /** <zh/> 是否存在活跃会话 | <en/> whether a session is active */
  isEditing: ComputedRef<boolean>
  /** <zh/> 开启会话（异步：准入 → 必要时提交旧会话 → 建立新会话） | <en/> open a session (async: admission → commit the previous one if needed → establish the new one) */
  startEditing: (params: { rowIndex: number, prop: string, columnKey: string, value: unknown }) => Promise<void>
  /** <zh/> 停止会话（commit=true 走提交，否则取消） | <en/> stop the session (commit=true commits, otherwise cancels) */
  stopEditing: (reason: CellEditStopReason, commit?: boolean) => void
  /** <zh/> 取消会话（丢弃编辑值） | <en/> cancel the session (discards edit values) */
  cancelEditing: (reason?: CellEditStopReason) => void
  /** <zh/> 指定单元格是否处于编辑态 | <en/> whether the given cell is being edited */
  isCellEditing: (rowIndex: number, columnKey: string) => boolean
  /** <zh/> 是否存在未保存变更（活跃会话或脏记录） | <en/> whether unsaved changes exist (active session or dirty records) */
  hasUnsavedChanges: () => boolean
}

/**
 * <zh/> 创建编辑会话机——数据变化守卫、准入、开/停/取消
 * <en/> Create the edit session machine — data-change guard, admission, open/stop/cancel
 *
 * @remarks
 * <zh/> 编辑缓冲的读写与实时校验在 `use-cell-edit-buffer.ts`（同一行引用一致性守卫的两侧）。
 * <en/> Edit-buffer I/O and live validation live in `use-cell-edit-buffer.ts` (the two sides of the
 * <en/> same row-reference consistency guard).
 */
export function useCellEditLifecycle<T = any>(deps: UseCellEditLifecycleDeps<T>): UseCellEditLifecycleReturn {
  const {
    data,
    columns,
    editConfig,
    rowKey,
    session,
    isFullRowEdit,
    isColumnEditable,
    raceProtection,
    resolveStaleIndex,
    dirty,
    events,
    interceptor,
    onCellEditingStarted,
    onCellEditingStopped,
    commitEditingInternal,
  } = deps

  const {
    editingCell,
    editingValue,
    editingRowIndex,
    editingValues,
    editingRowKey,
    editingRowRef,
    validationBlocked,
    resetEditingState,
    cancelDueToDataChanged,
  } = session
  const { dirtyCells, recordOriginalValue } = dirty
  const { emitCellStopped, emitRowCellsStopped, buildStopParams } = events

  const isEditing = computed(() => {
    if (isFullRowEdit.value)
      return editingRowIndex.value !== null
    return editingCell.value !== null
  })

  /**
   * <zh/> 数据变化守卫——按"行身份优先迁移、不可定位才取消"处理：
   * <zh/> - resolveStaleIndex（rowKey/行引用）重定位成功 → 迁移编辑索引并刷新行引用；
   * <zh/> - 不可定位（行被删除/过滤）→ 取消会话并经 onEditCancelled 通知宿主。
   * <zh/> 约束：排序/筛选/分页/外部替换数据后，同索引错误行不渲染编辑器（无幽灵编辑器），
   * <zh/> 新编辑不受 same_cell/same_row 误拒。
   * <zh/> 自身提交的写回不触发取消：提交流程同步完成 reset 后，watch 才在 flush 阶段执行
   * <zh/> （Vue watch 默认非 sync，不会在 applyDirectUpdate 的同步写回瞬间中断提交）。
   * <en/> Data-change guard — relocate by row identity first, cancel only when the row
   * <en/> can no longer be located:
   * <en/> - resolveStaleIndex (rowKey / row reference) succeeds → migrate the editing index and
   * <en/>   refresh the row reference;
   * <en/> - otherwise (row deleted/filtered out) → cancel the session and notify the host via
   * <en/>   onEditCancelled.
   * <en/> Invariant: after sort/filter/pagination/external replacement, the wrong row at the
   * <en/> same index never renders an editor (no ghost editor) and new edits are never rejected
   * <en/> by same_cell/same_row.
   * <en/> Write-backs from our own commit do not cancel: the commit flow finishes its reset
   * <en/> synchronously before the watcher runs in the flush phase (Vue watch is not sync by
   * <en/> default, so applyDirectUpdate's synchronous write never interrupts a commit).
   */
  /**
   * <zh/> 数据变更守卫回调——data 引用变化时按行身份重定位编辑位，行已消失则取消会话并通知宿主
   * <en/> Data-change guard callback — relocates the editing slot by row identity on data change, cancels with host notice when the row is gone
   */
  function onDataChangedRelocateOrCancel(newData: typeof data.value, oldData: typeof data.value | undefined): void {
    if (newData === oldData || !isEditing.value)
      return
    const currentIndex = isFullRowEdit.value
      ? editingRowIndex.value
      : editingCell.value?.rowIndex ?? null
    if (currentIndex == null)
      return
    const relocated = resolveStaleIndex(newData, currentIndex)
    if (relocated < 0) {
      cancelDueToDataChanged()
      return
    }
    if (relocated !== currentIndex) {
      if (isFullRowEdit.value) {
        editingRowIndex.value = relocated
      }
      else if (editingCell.value) {
        editingCell.value = { ...editingCell.value, rowIndex: relocated }
      }
    }
    editingRowRef.value = newData[relocated] ?? null
  }

  watch(data, onDataChangedRelocateOrCancel)

  function hasUnsavedChanges(): boolean {
    if (isEditing.value)
      return true
    if (dirtyCells.value.size > 0)
      return true
    return false
  }

  function isCellEditing(rowIndex: number, columnKey: string): boolean {
    if (isFullRowEdit.value) {
      if (editingRowIndex.value !== rowIndex)
        return false
      const col = findColumnByKey(columns.value, columnKey)
      return !!(col && isColumnEditable(col))
    }
    if (!editingCell.value)
      return false
    return editingCell.value.rowIndex === rowIndex
      && editingCell.value.columnKey === columnKey
  }

  function canStartEditing(params: { rowIndex: number, columnKey: string, prop: string }): EditStartCheckResult {
    if (validationBlocked.value) {
      return { allowed: false, reason: 'validation_blocked' }
    }

    if (editingRowIndex.value !== null && editingRowIndex.value === params.rowIndex) {
      return { allowed: false, reason: 'same_row' }
    }

    if (editingCell.value
      && editingCell.value.rowIndex === params.rowIndex
      && editingCell.value.columnKey === params.columnKey) {
      return { allowed: false, reason: 'same_cell' }
    }

    /**
     * <zh/> 门控检查（拦截器 + activeMethod）对任何新编辑会话生效——包括切换单元格场景；
     * <zh/> 检查位于已有编辑活动早退分支之前，保证 Tab/Enter 切换时新目标仍经 edit.start 拦截器与 activeMethod 准入。
     * <en/> Gate checks (interceptor + activeMethod) apply to ANY new edit session — including cell switches.
     * <en/> They run before the "already editing" early-return branch, so Tab/Enter switching
     * <en/> into a new cell still passes the edit.start interceptor and activeMethod admission.
     */
    if (interceptor) {
      const row = data.value[params.rowIndex]
      const col = findColumnByKey(columns.value, params.columnKey)
      if (row && col) {
        const startParams: InterceptorEditStartParams<T> = {
          row,
          rowIndex: params.rowIndex,
          prop: params.prop,
          column: col,
          value: resolveCellValue(row, col, params.rowIndex),
        }
        if (interceptor.trigger('edit.start', startParams)) {
          return { allowed: false, reason: 'intercepted' }
        }
      }
    }

    /** activeMethod 检查——返回 false 时阻止进入编辑模式 */
    if (editConfig.value?.activeMethod) {
      const row = data.value[params.rowIndex]
      const col = findColumnByKey(columns.value, params.columnKey)
      if (row && col) {
        if (!editConfig.value.activeMethod({ row, rowIndex: params.rowIndex, column: col, prop: params.prop })) {
          return { allowed: false, reason: 'active_method_denied' }
        }
      }
    }

    if (editingCell.value || editingRowIndex.value !== null) {
      return { allowed: true, needsCommit: true }
    }

    return { allowed: true }
  }

  /**
   * <zh/> 前置检查阶段——等待竞态锁、校验编辑准入条件、必要时提交当前编辑。
   * <zh/> 返回 true 表示可以进入执行阶段，false 表示应中止。
   *
   * <en/> Preparation phase —awaits race-protection locks, checks edit admission, commits current edit if needed.
   * <en/> Returns true to proceed to execution phase, false to abort.
   */
  async function prepareStartEditing(
    params: { rowIndex: number, prop: string, columnKey: string, value: unknown },
    previous: Promise<void> | null,
  ): Promise<boolean> {
    if (previous)
      await previous
    if (raceProtection.unmounted)
      return false

    // 等待前一次 stopEditing 触发的 commit 完成 | Wait for the previous stopEditing-triggered commit to complete
    if (raceProtection.pendingCommit)
      await raceProtection.pendingCommit

    const check = canStartEditing(params)
    if (!check.allowed)
      return false
    if (check.needsCommit) {
      await commitEditingInternal('click', true)
      if (validationBlocked.value || isEditing.value)
        return false
    }

    raceProtection.bumpVersion()
    return true
  }

  /**
   * <zh/> 执行阶段——根据编辑模式设置编辑状态并派发 onCellEditingStarted 回调。
   *
   * <en/> Execution phase —sets editing state based on edit mode and dispatches onCellEditingStarted callbacks.
   */
  function executeStartEditing(
    params: { rowIndex: number, prop: string, columnKey: string, value: unknown },
  ): void {
    if (isFullRowEdit.value) {
      const row = data.value[params.rowIndex]
      if (!row)
        return
      const values: Record<string, any> = {}

      // 分组列必须展平到叶子列，否则子列跳过编辑缓冲；
      // valueGetter-only 无 prop/valueSetter 不可持久化，不进入缓冲，避免假成功
      traverseLeafColumns(columns.value as unknown as Array<ProcessedColumn & { children?: ProcessedColumn[] }>, (col) => {
        const c = col as unknown as ProcessedColumn
        const cKey = getColumnKey(c)
        if (isColumnEditable(c) && (c.prop != null || (c as unknown as { valueSetter?: unknown }).valueSetter)) {
          values[cKey] = resolveCellValue(row, c, params.rowIndex)
        }
      })

      editingCell.value = null
      editingValue.value = null
      editingRowIndex.value = params.rowIndex
      editingValues.value = values
      editingRowKey.value = rowKey.value ? rowKey.value(row) : null
      editingRowRef.value = row ?? null

      for (const [cKey, val] of Object.entries(values)) {
        recordOriginalValue(params.rowIndex, cKey, val)
      }
    }
    else {
      const row = data.value[params.rowIndex]
      const col = findColumnByKey(columns.value, params.columnKey)
      if (!col)
        return
      const cellValue = row ? resolveCellValue(row, col, params.rowIndex) : params.value
      editingCell.value = {
        rowIndex: params.rowIndex,
        columnKey: params.columnKey,
        prop: params.prop,
        oldValue: cellValue,
      }
      editingValue.value = cellValue
      editingRowKey.value = rowKey.value && row ? rowKey.value(row) : null
      editingRowRef.value = row ?? null

      recordOriginalValue(params.rowIndex, params.columnKey, cellValue)
    }

    if (onCellEditingStarted) {
      const row = data.value[params.rowIndex]
      if (row) {
        if (isFullRowEdit.value) {
          traverseLeafColumns(columns.value as unknown as Array<ProcessedColumn & { children?: ProcessedColumn[] }>, (col) => {
            const c = col as unknown as ProcessedColumn
            if (isColumnEditable(c) && (c.prop != null || (c as unknown as { valueSetter?: unknown }).valueSetter)) {
              onCellEditingStarted({
                row,
                rowIndex: params.rowIndex,
                prop: c.prop as string,
                column: c,
                value: resolveCellValue(row, c, params.rowIndex),
              })
            }
          })
        }
        else {
          const col = findColumnByKey(columns.value, params.columnKey)
          onCellEditingStarted({
            row,
            rowIndex: params.rowIndex,
            prop: params.prop,
            column: col,
            value: editingValue.value,
          })
        }
      }
    }
  }

  async function startEditing(params: {
    rowIndex: number
    prop: string
    columnKey: string
    value: unknown
  }): Promise<void> {
    const previous = raceProtection.pendingStart
    let release!: () => void
    const own: Promise<void> = new Promise<void>((resolve) => {
      release = resolve
    })
    raceProtection.pendingStart = own

    try {
      const canProceed = await prepareStartEditing(params, previous)
      if (!canProceed)
        return

      executeStartEditing(params)
    }
    finally {
      release()
      // <zh/> 必须清空 pendingStart——否则该已决议的 Promise 永久残留，
      // <zh/> commitEditing 的排队门控会让每次提交都多付一个微任务时延，
      // <zh/> 破坏无校验列"同步提交"的既有契约（回归教训：哨兵引用用完即清）。
      // <zh/> 但只能清"自己的"哨兵：若后来者 B 已把自己的 pendingStart 写入，
      // <zh/> 无条件置 null 会让排在 B 之后的 C 读到 null 而绕过排队，
      // <zh/> B/C 并发通过准入造成双会话/双 started 事件（引用相等才清）。
      // <en/> pendingStart MUST be cleared — otherwise the resolved promise lingers forever and
      // <en/> commitEditing's queue gate pays one extra microtask on every commit, breaking the
      // <en/> legacy "synchronous commit for rule-less columns" contract (lesson: clear sentinel refs).
      // <en/> But only clear OUR OWN sentinel: if a later caller B has already installed its own
      // <en/> pendingStart, unconditionally nulling it lets a third caller C read null and skip
      // <en/> the queue behind B — B/C then pass admission concurrently (double session / double
      // <en/> started events). Clear only on reference equality.
      if (raceProtection.pendingStart === own)
        raceProtection.pendingStart = null
    }
  }

  function stopEditing(reason: CellEditStopReason, commit = true): void {
    if (!isEditing.value)
      return

    if (commit) {
      // <zh/> 幂等闸门：本会话已有在途提交时，不直接丢弃本次提交——记录重提交请求，
      // <zh/> 在途提交落定后若会话仍活跃，用最新会话值再跑一次提交（多次到达合并为一次）。
      // <zh/> 直接丢弃会导致两次 Enter/blur 之间变更的编辑值永不落库。
      // <en/> Idempotence gate: when a commit for this session is already in flight, do NOT
      // <en/> drop this stop — record a restop request so that, once the in-flight commit
      // <en/> settles with the session still active, the commit re-runs with the latest
      // <en/> session value (multiple arrivals coalesce into one). Dropping it outright
      // <en/> would lose edits made between the two stops forever.
      if (raceProtection.pendingCommit) {
        raceProtection.restopRequested = reason
        return
      }
      const pending = commitEditingInternal(reason)
      raceProtection.pendingCommit = pending
      pending.finally(() => {
        raceProtection.pendingCommit = null
        const restop = raceProtection.restopRequested
        raceProtection.restopRequested = null
        if (restop && isEditing.value && !raceProtection.unmounted)
          stopEditing(restop as CellEditStopReason, true)
      })
    }
    else {
      cancelEditing(reason)
    }
  }

  function cancelEditing(reason: CellEditStopReason = 'api'): void {
    validationBlocked.value = false

    if (interceptor) {
      const stopParams = buildStopParams(reason)
      if (stopParams && interceptor.trigger('edit.stop', stopParams)) {
        resetEditingState()
        return
      }
    }

    raceProtection.bumpVersion()

    if (onCellEditingStopped) {
      if (isFullRowEdit.value && editingRowIndex.value !== null) {
        const row = data.value[editingRowIndex.value]
        if (row) {
          emitRowCellsStopped(editingRowIndex.value, row, [], reason)
        }
      }
      else if (editingCell.value) {
        const cell = editingCell.value
        const col = findColumnByKey(columns.value, cell.columnKey)
        emitCellStopped(cell, col, cell.oldValue, cell.oldValue, reason)
      }
    }

    resetEditingState()
  }

  return {
    isEditing,
    startEditing,
    stopEditing,
    cancelEditing,
    isCellEditing,
    hasUnsavedChanges,
  }
}

/** <zh/> useCellEditLifecycle 返回形状（供类型复用） | <en/> useCellEditLifecycle return shape (for type reuse) */
export type CellEditLifecycle = ReturnType<typeof useCellEditLifecycle>
