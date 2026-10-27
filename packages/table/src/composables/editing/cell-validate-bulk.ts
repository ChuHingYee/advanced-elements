import type { ComputedRef, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CrossFieldError, CrossFieldValidator, ValidateError } from '../../types/edit'
import { VALIDATE_BATCH_SIZE } from '../../constants'
import { traverseLeafColumns } from '../../utils/column-tree'
import { getColumnKey } from '../../utils/shared'
import { resolveCellValue } from '../../utils/value-pipeline'
import { crossFieldThrownMessage, validateValue } from './cell-validate-engine'

/**
 * <zh/> 全表批量校验依赖 | <en/> Full-table bulk validation deps
 */
export interface CellValidateBulkDeps<T = any> {
  data: ComputedRef<T[]> | ShallowRef<T[]>
  columns: ComputedRef<ProcessedColumn[]>
  /** <zh/> 校验纪元（store 持有的 { value } 标志） | <en/> validation epoch (the store-held { value } flag) */
  epoch: { value: number }
  errorMap: Map<string, ValidateError>
  resolveRowKey: (rowIndex: number, rowData?: unknown) => string
  errorKey: (rowKey: string | number, columnKey: string) => string
  crossFieldValidatorGetter?: () => CrossFieldValidator<T> | undefined
  /** <zh/> 批量重建结束回调（宿主复位 isValidatingAll） | <en/> bulk-rebuild settled callback (the host resets isValidatingAll) */
  onBulkSettled?: () => void
  /** <zh/> 批量重建开始回调（宿主置位 isValidatingAll） | <en/> bulk-rebuild started callback (the host sets isValidatingAll) */
  onBulkStarted?: () => void
  /** <zh/> 错误列表同步（errors shallowRef 归宿主存储） | <en/> error-list sync (errors shallowRef lives in the host store) */
  syncErrors: () => void
}

/**
 * <zh/> 全表批量校验——validateAll 编排（epoch 竞态守卫 + errorMap 批量重建）、
 * <zh/> collectPendingValidations、runBatchedValidations、runCrossFieldValidations、pushCrossFieldError。
 *
 * <zh/> 自 use-cell-validate.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改。
 * <en/> Full-table bulk validation — the validateAll orchestration (epoch race guard + errorMap
 * <en/> batch rebuild), collectPendingValidations, runBatchedValidations, runCrossFieldValidations
 * <en/> and pushCrossFieldError.
 *
 * <en/> Migrated verbatim from use-cell-validate.ts (COMPLEXITY-PLAN battle line 3, knife C).
 */
export function createCellValidateBulk<T = any>(deps: CellValidateBulkDeps<T>) {
  const {
    data,
    columns,
    epoch,
    errorMap,
    resolveRowKey,
    errorKey,
    crossFieldValidatorGetter,
    onBulkSettled,
    onBulkStarted,
    syncErrors,
  } = deps

  async function validateAll(dataOverride?: T[]): Promise<boolean> {
    const epochAtStart = ++epoch.value
    const rows = dataOverride ?? data.value
    onBulkStarted!()

    try {
      const allErrors: ValidateError[] = []
      const pending = collectPendingValidations(rows)
      const stale = await runBatchedValidations(pending, allErrors, epochAtStart)
      if (stale)
        return true
      const crossStale = await runCrossFieldValidations(allErrors, epochAtStart, rows)
      if (crossStale)
        return true

      /** 批量重建 Map 并同步到 errors */
      errorMap.clear()
      for (const err of allErrors) {
        // <zh/> B11：键域统一为 string（number 回退分支显式转换，与 UI 的 === 比较同域） | <en/> B11: string key domain (explicit conversion on the numeric fallback, same domain as the UI === comparison)
        errorMap.set(errorKey(String(err.rowKey ?? err.rowIndex), err.columnKey), err)
      }
      syncErrors()
      return allErrors.length === 0
    }
    finally {
      onBulkSettled!()
    }
  }

  /** <zh/> 收集待校验单元格（早退守卫替代深层嵌套） | <en/> Collect cells pending validation (early-exit guards instead of deep nesting) */
  function collectPendingValidations(rows: T[]): { rowIndex: number, col: ProcessedColumn, cKey: string, value: unknown, row: T }[] {
    const pending: { rowIndex: number, col: ProcessedColumn, cKey: string, value: unknown, row: T }[] = []
    const leafCols: ProcessedColumn[] = []
    traverseLeafColumns(columns.value as unknown as Array<ProcessedColumn & { children?: ProcessedColumn[] }>, (c) => {
      leafCols.push(c as ProcessedColumn)
    })
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]
      for (const col of leafCols) {
        if (!col.editorRules || col.prop == null)
          continue
        const cKey = getColumnKey(col)
        // 走 valueGetter 取值，与编辑时校验保持一致
        const value = resolveCellValue(row, col, rowIndex)
        pending.push({ rowIndex, col, cKey, value, row })
      }
    }
    return pending
  }

  /** 分批并发校验：返回 true 表示已被新 epoch 取代 */
  async function runBatchedValidations(
    pending: { rowIndex: number, col: ProcessedColumn, cKey: string, value: unknown, row: T }[],
    allErrors: ValidateError[],
    epochAtStart: number,
  ): Promise<boolean> {
    for (let i = 0; i < pending.length; i += VALIDATE_BATCH_SIZE) {
      const batch = pending.slice(i, i + VALIDATE_BATCH_SIZE)
      await Promise.all(
        batch.map(({ rowIndex, col, cKey, value, row }) =>
          validateValue(value, col.editorRules!, col.prop!, row).then((message) => {
            if (message) {
              const rk = resolveRowKey(rowIndex, row)
              allErrors.push({ rowIndex, rowKey: rk, columnKey: cKey, prop: col.prop!, message })
            }
          }),
        ),
      )
      if (epoch.value !== epochAtStart)
        return true
    }
    return false
  }

  /** 跨字段校验：返回 true 表示已被新 epoch 取代 */
  async function runCrossFieldValidations(allErrors: ValidateError[], epochAtStart: number, rows: T[]): Promise<boolean> {
    // 跨字段校验——与行级校验保持一致，确保全表校验时跨字段约束也被检测
    const crossFieldValidator = crossFieldValidatorGetter?.()
    if (!crossFieldValidator)
      return false
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]
      let errorMessages: CrossFieldError[] = []
      try {
        errorMessages = await crossFieldValidator({ values: row as Record<string, unknown>, row, rowIndex }) ?? []
      }
      catch (err: unknown) {
        // <zh/> 用户自定义 crossFieldValidator 抛异常——捕获并作为校验错误记录，防止异常中断全表校验；
        // <zh/> 非 Error 抛出（throw 'boom'）保留原字符串
        // <en/> User-defined crossFieldValidator threw — catch and record as a validation error, preventing the exception from aborting full-table validation;
        // <en/> non-Error throws (throw 'boom') keep their string
        errorMessages = [crossFieldThrownMessage(err)]
      }
      if (epoch.value !== epochAtStart)
        return true
      if (errorMessages.length === 0)
        continue
      const rk = resolveRowKey(rowIndex, row)
      for (let i = 0; i < errorMessages.length; i++)
        pushCrossFieldError(allErrors, errorMessages[i]!, rowIndex, rk, i)
    }
    return false
  }

  /** 单条跨字段错误入列（string 与对象两种形态） */
  function pushCrossFieldError(allErrors: ValidateError[], item: CrossFieldError, rowIndex: number, rk: string | number, i: number): void {
    if (typeof item === 'string') {
      allErrors.push({ rowIndex, rowKey: rk, columnKey: `__row__:${i}`, prop: '__crossField__', message: item })
      return
    }
    allErrors.push({ rowIndex, rowKey: rk, columnKey: item.columnKey, prop: '__crossField__', message: item.message })
  }

  return { validateAll }
}
