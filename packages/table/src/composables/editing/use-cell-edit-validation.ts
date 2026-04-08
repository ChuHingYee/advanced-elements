import type { ComputedRef, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CellEditStopReason, CommitResult, EditConfig } from '../../types/edit'
import type { EditRaceProtection } from '../../utils/edit-race-protection'
/**
 * <zh/> 单元格编辑校验依赖——均为调用方持有的状态与回调，子模块不自建状态
 * <en/> Cell-edit validation dependencies — state and callbacks owned by the caller, no state created here
 */
export interface CellEditValidationDeps<T = any> {
  /** <zh/> 异步校验函数 | <en/> Async validation function */
  validateFn?: (params: {
    mode: 'cell' | 'row'
    rowIndex: number
    columnKey: string
    value: any
    values?: Record<string, any>
    rowData?: unknown
  }) => Promise<boolean>
  /** <zh/> 编辑配置（含 invalidEditValueMode） | <en/> Edit config (incl. invalidEditValueMode) */
  editConfig: ComputedRef<EditConfig | undefined>
  /** <zh/> 竞态保护控制器 | <en/> Race protection controller */
  raceProtection: EditRaceProtection<T>
  /** <zh/> 正在编辑行的键（拒绝记录用） | <en/> Key of the row being edited (for rejection records) */
  editingRowKey: Ref<string | null>
  /** <zh/> block 模式锁定标志 | <en/> Block-mode lock flag */
  validationBlocked: Ref<boolean>
  /** <zh/> 取消会话（校验拒绝的 block/revert 路径） | <en/> Cancel the session (block/revert paths on validation rejection) */
  cancelEditing: (reason: CellEditStopReason) => void
  /** <zh/> notify 模式通知回调 | <en/> Notify-mode notification callback */
  onNotifyValidationError?: (params: { rowIndex: number, columnKey: string, prop: string }) => void
}

/**
 * <zh/> 编辑校验相位
 * <zh/> 含校验失败策略（block/revert/notify）与单格提交的异步校验相位（含竞态过期守卫）。
 * <en/> Edit validation phases.
 * <en/> Covers the validation-failure strategy (block/revert/notify) and the async validation
 * <en/> phase of single-cell commit (with race-expiry guards).
 */
export function useCellEditValidation<T = any>(deps: CellEditValidationDeps<T>) {
  const {
    validateFn,
    editConfig,
    raceProtection,
    editingRowKey,
    validationBlocked,
    cancelEditing,
    onNotifyValidationError,
  } = deps

  /**
   * <zh/> 校验失败时的处理——根据 invalidEditValueMode 配置决定行为
   * <en/> Handle validation failure —behavior depends on invalidEditValueMode config
   *
   * @param errorInfo - <zh/> 当前单元格/行的校验错误信息 | <en/> validation error info for the current cell/row
   * @param errorInfo.rowIndex - <zh/> 行索引 | <en/> row index
   * @param errorInfo.columnKey - <zh/> 列 key | <en/> column key
   * @param errorInfo.prop - <zh/> 字段名 | <en/> field name
   * @returns <zh/> true 表示中止提交（block/revert），false 表示继续提交（notify）
   * <en/> true means abort commit (block/revert), false means proceed with commit (notify)
   */
  function handleValidationFailure(errorInfo: {
    rowIndex: number
    columnKey: string
    prop: string
  }, reason?: CellEditStopReason): boolean {
    const mode = editConfig.value?.invalidEditValueMode ?? 'block'
    if (mode === 'block') {
      // <zh/> unmount 触发的提交（虚拟滚动行回收）被 block 拒绝时降级为取消——
      // <zh/> 编辑器已随行卸载，blocked 会话没有编辑器可解除（Escape/实时重校验均不可达），
      // <zh/> 外部点击经 useEditorBlur 反复重提 → 死锁。取消会话并通知，值不写入。
      // <en/> When an unmount-triggered commit (virtual-scroll row recycling) is refused in
      // <en/> block mode, downgrade to cancel — the editor is gone with the row, so a blocked
      // <en/> session has no editor to unlock it (Escape / live re-validation unreachable) and
      // <en/> outside clicks keep re-committing via useEditorBlur → deadlock. Cancel the
      // <en/> session and notify; the value is not written.
      if (reason === 'unmount') {
        validationBlocked.value = false
        cancelEditing('validationFailed')
        return true
      }
      validationBlocked.value = true
      return true
    }
    if (mode === 'revert') {
      cancelEditing('validationFailed')
      return true
    }
    // <zh/> notify 模式：显示错误通知但允许提交（不中止）
    // <en/> notify mode: show error notification but allow commit (don't abort)
    if (mode === 'notify' && onNotifyValidationError) {
      onNotifyValidationError(errorInfo)
    }
    return false
  }

  /**
   * <zh/> 单格提交——返回 CommitResult 使调用方可感知拦截器拒/校验拒/setter 拒写。
   * <zh/> 编辑会话因状态丢失而取消（行删除/列移除/race 过期）时返回空结果。
   * <en/> Single-cell commit — returns CommitResult exposing interceptor/validation/setter rejections.
   * <en/> Returns an empty result when the session was cancelled due to lost state (row deleted /
   * <en/> column removed / race expired).
   */
  /**
   * <zh/> 相位（提取）：单元格级校验——仅当列声明 editorRules 时执行。
   * <zh/> 返回 null 表示放行；否则返回中止用的 CommitResult（校验拒绝或竞态过期）。
   * <en/> Phase (extracted): cell-level validation — runs only when the column declares editorRules.
   * <en/> Returns null to proceed; otherwise the aborting CommitResult (validation rejection or stale race).
   */
  async function validateCellCommit(
    currentCell: { rowIndex: number, columnKey: string, prop: string },
    col: ProcessedColumn,
    parsedNewValue: unknown,
    currentData: T[],
    oldValue: unknown,
    reason: CellEditStopReason,
  ): Promise<CommitResult | null> {
    if (!validateFn || !col.editorRules)
      return null

    const versionBeforeAwait = raceProtection.version
    const valid = await validateFn({
      mode: 'cell',
      rowIndex: currentCell.rowIndex,
      columnKey: currentCell.columnKey,
      value: parsedNewValue,
      // <zh/> 传入行数据供校验器解析 rowKey——缺省时校验器回退用 rowIndex 作错误键，
      // <zh/> 与 UI 按 rowKey 匹配的域不一致，校验失败时错误显示不出来（键域分裂根因）。
      // <en/> Pass row data so the validator resolves the rowKey — without it the validator
      // <en/> falls back to using rowIndex as the error key, which mismatches the UI's rowKey
      // <en/> domain and makes commit-time validation errors invisible (key-domain split).
      rowData: currentData[currentCell.rowIndex],
    })
    if (raceProtection.isStale(versionBeforeAwait, currentData))
      return { applied: [], rejected: [] }
    /**
     * 校验通过即解锁——'block' 模式下用户改回合法值后再次提交时放行
     * Unblock on passing validation — in 'block' mode, re-submitting a valid value proceeds
     */
    if (valid) {
      validationBlocked.value = false
      return null
    }
    if (handleValidationFailure({
      rowIndex: currentCell.rowIndex,
      columnKey: currentCell.columnKey,
      prop: currentCell.prop,
    }, reason)) {
      return {
        applied: [],
        rejected: [{
          rowIndex: currentCell.rowIndex,
          prop: currentCell.prop,
          columnKey: currentCell.columnKey,
          oldValue,
          newValue: parsedNewValue,
          rowKey: editingRowKey.value ?? undefined,
          reason: 'validation',
        }],
      }
    }
    // <zh/> 'notify' 模式失败不阻断提交 | <en/> a 'notify'-mode failure does not block the commit
    return null
  }

  return { handleValidationFailure, validateCellCommit }
}

/** <zh/> useCellEditValidation 返回形状（供类型复用） | <en/> useCellEditValidation return shape (for type reuse) */
export type CellEditValidation<T = any> = ReturnType<typeof useCellEditValidation<T>>
