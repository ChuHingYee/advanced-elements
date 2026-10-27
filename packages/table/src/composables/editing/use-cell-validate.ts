/**
 * <zh/> 单元格校验 Composable
 * <en/> Cell validation composable
 *
 * @remarks
 * <zh/> 使用 async-validator 对列级 `editorRules` 校验单元格编辑值。async-validator 经构建 external 复用宿主副本（见 rolldown.config.mjs），动态 import 懒加载，零包体积增量。
 * 支持三种校验粒度：单格、行级、全表
 * <en/> Uses async-validator to validate cell edit values against column-level `editorRules`. It stays external in the build (see rolldown.config.mjs) so the dynamic import reuses the host copy with zero bundle growth.
 * Supports three validation granularities: single cell, row-level, full table
 *
 * <zh/>
 * - 内部使用 Map 存储（key = `${rowIndex}:${columnKey}`）实现 O(1) 查找和更新，公开 errors 为 ValidateError[] 用于模板渲染和 provide/inject
 * - 竞态防护：使用 epoch 计数器 + isValidatingAll 标志标记校验纪元。validateAll/clearErrors 递增 epoch；validateAll 进入时置 isValidatingAll = true，
 *   validateCell/validateCrossField 在 isValidatingAll 期间跳过写入，避免批量重建覆盖并发结果。上游编辑状态机保证同一单元格不会并发校验，因此无需 per-cell 粒度防护
 *
 * <en/>
 * - Uses Map internally (key = `${rowIndex}:${columnKey}`) for O(1) lookup and update, exposes errors as ValidateError[] for template rendering and provide/inject
 * - Race protection: uses epoch counter + isValidatingAll flag to mark validation epochs. validateAll/clearErrors increment epoch;
 *   validateCell/validateCrossField skip writes during isValidatingAll to avoid batch rebuild overwriting concurrent results.
 *   The upstream edit state machine ensures no concurrent validation on the same cell, so per-cell granularity protection is not needed
 */

import type { ProcessedColumn } from '../../types'
import type { CrossFieldError } from '../../types/edit'
import type { UseCellValidateOptions, UseCellValidateReturn } from './cell-validate-types'
import { findColumnByKey, traverseLeafColumns } from '../../utils/column-tree'
import { getColumnKey } from '../../utils/shared'
import { createCellValidateBulk } from './cell-validate-bulk'
import { crossFieldThrownMessage, validateValue } from './cell-validate-engine'
import { useCellValidateStore } from './cell-validate-store'

// <zh/> 契约类型自子模块 re-export，既有导入路径零变化 | <en/> Contracts re-exported; import paths unchanged
export type { UseCellValidateOptions, UseCellValidateReturn } from './cell-validate-types'

/**
 * 单元格校验组合式函数
 *
 * @example
 * ```ts
 * const validate = useCellValidate({
 *   columns: effectiveColumns,
 *   data: visibleData,
 * })
 *
 * const valid = await validate.validateCell(0, 'name', 'John', row)
 * if (!valid) return
 * ```
 */
export function useCellValidate<T = any>(options: UseCellValidateOptions<T>): UseCellValidateReturn<T> {
  const { columns, data, crossFieldValidator: crossFieldValidatorGetter, rowKeyFn: rowKeyFnGetter } = options
  // <zh/> 错误存储（errorMap/epoch/clear 族）自 cell-validate-store.ts 拆出（刀法 C）
  // <en/> The error store (errorMap/epoch/clear family) split into cell-validate-store.ts (knife C)
  const {
    errors,
    errorMap,
    epoch,
    isValidatingAll,
    resolveRowKey,
    errorKey,
    syncErrors,
    applyCellResult,
    clearErrors,
    getCellError,
    clearRowCrossFieldErrors,
    clearRowErrors,
    clearCellError,
  } = useCellValidateStore<T>({ rowKeyFnGetter })

  function findColumn(columnKey: string): ProcessedColumn | undefined {
    return findColumnByKey(columns.value, columnKey)
  }

  async function validateCell(
    rowIndex: number,
    columnKey: string,
    value: unknown,
    rowData?: unknown,
  ): Promise<boolean> {
    const col = findColumn(columnKey)
    if (!col?.editorRules)
      return true

    /**
     * <zh/> validateAll 进行中：仍求真值（供提交门控使用），但跳过 errorMap 写入——
     * <zh/> 最终由 validateAll 的批量重建覆盖，避免并发写入被吞或残留。
     * <en/> While validateAll runs: still compute the real verdict (commit gates depend on it),
     * <en/> but skip errorMap writes — validateAll's batch rebuild is the single writer.
     */
    const skipWrite = isValidatingAll.value > 0

    const epochAtCall = epoch.value
    const message = await validateValue(value, col.editorRules, col.prop ?? columnKey, rowData)

    /** validateAll/clearErrors 在 await 期间递增了 epoch，当前结果已过期 */
    if (epochAtCall !== epoch.value)
      return true

    if (skipWrite)
      return !message

    const rowKey = resolveRowKey(rowIndex, rowData)
    applyCellResult(rowIndex, rowKey, columnKey, col.prop ?? columnKey, message)
    return !message
  }

  async function validateRow(
    rowIndex: number,
    values: Record<string, unknown>,
  ): Promise<boolean> {
    const row = data.value[rowIndex]
    if (!row)
      return true

    const tasks: Promise<boolean>[] = []

    const leafCols: ProcessedColumn[] = []
    traverseLeafColumns(columns.value as unknown as Array<ProcessedColumn & { children?: ProcessedColumn[] }>, (c) => {
      leafCols.push(c as ProcessedColumn)
    })
    for (const col of leafCols) {
      // 不再要求 col.cellEditor 显式存在——与 use-editor-resolver 的 isColumnEditable 一致，
      // 接受通过 valueType 推断编辑器的列参与行级校验
      // No longer require explicit col.cellEditor — consistent with use-editor-resolver's isColumnEditable,
      // accepting columns with inferred editors via valueType in row-level validation
      if (!col.editable || !col.editorRules)
        continue
      const cKey = getColumnKey(col)
      if (!(cKey in values))
        continue
      tasks.push(validateCell(rowIndex, cKey, values[cKey], row))
    }

    const results = await Promise.all(tasks)
    return results.every(Boolean)
  }

  // <zh/> 分批并发上限收敛于 constants，与 Phase B 共用同一值
  // <en/> The batch concurrency limit converges in constants, shared with Phase B

  // <zh/> 全表批量校验族自 cell-validate-bulk.ts 拆出（刀法 C）
  // <en/> The full-table bulk validation family split into cell-validate-bulk.ts (knife C)
  const bulk = createCellValidateBulk<T>({
    data,
    columns,
    epoch,
    errorMap,
    resolveRowKey,
    errorKey,
    crossFieldValidatorGetter,
    onBulkStarted: () => {
      isValidatingAll.value++
    },
    onBulkSettled: () => {
      isValidatingAll.value = Math.max(0, isValidatingAll.value - 1)
    },
    syncErrors,
  })
  const { validateAll } = bulk

  async function validateCrossField(
    rowIndex: number,
    values: Record<string, unknown>,
  ): Promise<boolean> {
    const crossFieldValidator = crossFieldValidatorGetter?.()
    if (!crossFieldValidator)
      return true

    const row = data.value[rowIndex]
    if (!row)
      return true

    /** validateAll 正在进行中：仍求真值，跳过 errorMap 写入（同 validateCell） */
    const skipWrite = isValidatingAll.value > 0

    const epochAtCall = epoch.value

    let errorMessages: CrossFieldError[] = []
    try {
      errorMessages = await crossFieldValidator({ values, row, rowIndex }) ?? []
    }
    catch (err: unknown) {
      // <zh/> 用户自定义 crossFieldValidator 抛异常——捕获并作为校验错误写入，防止异常冒泡到 validateFn 调用链；
      // <zh/> 非 Error 抛出（throw 'boom'）保留原字符串，避免自定义文案被通用消息吞掉
      // <en/> User-defined crossFieldValidator threw — catch and write as a validation error, preventing the exception from bubbling up the validateFn call chain;
      // <en/> non-Error throws (throw 'boom') keep their string so custom copy is not swallowed by the generic message
      errorMessages = [crossFieldThrownMessage(err)]
    }

    if (epochAtCall !== epoch.value)
      return true
    if (errorMessages.length === 0) {
      if (!skipWrite)
        syncErrors()
      return true
    }
    /** 批量重建期间跳过写入，仅返回真值 */
    if (skipWrite)
      return false

    for (let i = 0; i < errorMessages.length; i++) {
      const item = errorMessages[i]
      const rk = resolveRowKey(rowIndex, row)
      if (typeof item === 'string') {
        // 简单消息：关联到 __row__（所有字段可见）
        const crossFieldKey = errorKey(rk, `__row__:${i}`)
        errorMap.set(crossFieldKey, { rowIndex, rowKey: rk, columnKey: '__row__', prop: '__crossField__', message: item })
      }
      else {
        // 结构化错误：仅关联到指定字段 | Structured error: only associated with the specified field
        const crossFieldKey = errorKey(rk, `${item.columnKey}:${i}`)
        errorMap.set(crossFieldKey, { rowIndex, rowKey: rk, columnKey: item.columnKey, prop: '__crossField__', message: item.message })
      }
    }
    syncErrors()
    return false
  }

  return {
    errors,
    validateCell,
    validateRow,
    validateAll,
    clearErrors,
    getCellError,
    validateCrossField,
    clearRowCrossFieldErrors,
    clearRowErrors,
    clearCellError,
  }
}
