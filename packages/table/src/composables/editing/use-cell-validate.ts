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

import type { ComputedRef, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { ColumnEditorRules, CrossFieldError, CrossFieldValidator, ValidateError } from '../../types/edit'
import { shallowRef } from 'vue'
import { VALIDATE_BATCH_SIZE } from '../../constants'
import { findColumnByKey, traverseLeafColumns } from '../../utils/column-tree'
import { getColumnKey } from '../../utils/shared'
import { resolveCellValue } from '../../utils/value-pipeline'

/**
 * <zh/> async-validator 规则描述接口
 * <en/> async-validator rule description interface
 *
 * @remarks
 * <zh/> 将 ColumnEditorRules 转换为 async-validator 可识别的规则格式，
 * 支持 required、type、min/max、pattern 等标准校验规则，以及自定义 asyncValidator 异步校验器
 * <en/> Converts ColumnEditorRules to async-validator recognisable rule format,
 * supports required, type, min/max, pattern and other standard validation rules, and custom asyncValidator
 */
interface AsyncValidatorRule {
  required?: boolean
  type?: string
  min?: number
  max?: number
  pattern?: RegExp
  message?: string
  asyncValidator?: (rule: AsyncValidatorRule & { rowData?: unknown }, value: unknown) => Promise<void>
  rowData?: unknown
}

/**
 * <zh/> async-validator Schema 实例接口 | <en/> async-validator Schema instance interface
 */
interface SchemaInstance {
  validate: (data: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<unknown>
}

/**
 * <zh/> async-validator Schema 构造函数类型 | <en/> async-validator Schema constructor type
 */
type SchemaConstructor = new (descriptor: Record<string, AsyncValidatorRule[]>) => SchemaInstance

/** async-validator Schema 构造函数的懒加载缓存 */
let SchemaCtor: SchemaConstructor | null = null

/**
 * 懒加载获取 async-validator Schema 构造函数
 *
 * 避免在模块初始化时直接依赖 async-validator，支持 tree-shaking 按需加载。
 * async-validator 已随 element-plus 打包，零包体积增量。
 */
async function getSchemaCtor(): Promise<SchemaConstructor> {
  if (!SchemaCtor) {
    SchemaCtor = ((await import('async-validator')).default as SchemaConstructor)
  }
  return SchemaCtor
}

/**
 * <zh/> 将 ColumnEditorRules 转换为 async-validator 规则数组 | <en/> 将 ColumnEditorRules convert为 async-validator 规则array
 *
 * <zh/> 支持 required、min/max（数字）、minLength/maxLength（字符串长度）、pattern（正则）、validator（自定义）五种校验类型。 | <en/> supports required、min/max（number）、minLength/maxLength（stringlength）、pattern（regex）、validator（自defines）五种validatetype。
 * <zh/> 其中 min/max/minLength/maxLength/pattern 支持对象语法（{ value, message }）和简写语法。 | <en/> 其中 min/max/minLength/maxLength/pattern supportsobject语法（{ value, message }）和简写语法。
 *
 * @param rules - <zh/> 列编辑规则配置 | <en/> column edit rules configuration
 * @param prop - <zh/> 字段名，用于生成默认错误提示文案 | <en/> field name，used to generate default error messages
 * @returns <zh/> async-validator 规则数组 | <en/> async-validator rules array
 */
function toAsyncValidatorRules(rules: ColumnEditorRules, prop: string): AsyncValidatorRule[] {
  const result: AsyncValidatorRule[] = []

  if (rules.required) {
    result.push({
      required: true,
      message: typeof rules.required === 'string' ? rules.required : `${prop} is required`,
    })
  }

  if (rules.min !== undefined) {
    const minRule = typeof rules.min === 'object' ? rules.min : null
    const minVal = minRule ? minRule.value : rules.min as number
    const minMsg = minRule ? minRule.message : `${prop} must be at least ${minVal}`
    result.push({ type: 'number', min: minVal, message: minMsg })
  }

  if (rules.max !== undefined) {
    const maxRule = typeof rules.max === 'object' ? rules.max : null
    const maxVal = maxRule ? maxRule.value : rules.max as number
    const maxMsg = maxRule ? maxRule.message : `${prop} must be at most ${maxVal}`
    result.push({ type: 'number', max: maxVal, message: maxMsg })
  }

  if (rules.minLength !== undefined) {
    const minRule = typeof rules.minLength === 'object' ? rules.minLength : null
    const minVal = minRule ? minRule.value : rules.minLength as number
    const minMsg = minRule ? minRule.message : `${prop} must be at least ${minVal} characters`
    result.push({ type: 'string', min: minVal, message: minMsg })
  }

  if (rules.maxLength !== undefined) {
    const maxRule = typeof rules.maxLength === 'object' ? rules.maxLength : null
    const maxVal = maxRule ? maxRule.value : rules.maxLength as number
    const maxMsg = maxRule ? maxRule.message : `${prop} must be at most ${maxVal} characters`
    result.push({ type: 'string', max: maxVal, message: maxMsg })
  }

  if (rules.pattern !== undefined) {
    const patternRule = typeof rules.pattern === 'object' && 'regexp' in rules.pattern ? rules.pattern : null
    const regexp = patternRule ? patternRule.regexp : rules.pattern as RegExp
    const patternMsg = patternRule ? patternRule.message : `${prop} does not match the required pattern`
    result.push({ pattern: regexp, message: patternMsg })
  }

  if (rules.validator) {
    result.push({
      asyncValidator: async (_rule: AsyncValidatorRule & { rowData?: unknown }, value: unknown) => {
        const validResult = await rules.validator!(value, _rule.rowData)
        if (validResult === true || validResult === undefined)
          return
        if (typeof validResult === 'string')
          throw new Error(validResult)
        throw new Error(`${prop} validation failed`)
      },
    })
  }

  return result
}

/**
 * <zh/> 执行单个值的校验 | <en/> 执rowsinglevalue的validate
 *
 * <zh/> 使用 async-validator 对值执行列级 editorRules 校验。 | <en/> using async-validator 对value执rowcolumn级 editorRules validate。
 * <zh/> 校验通过返回 null，失败返回错误消息字符串。 | <en/> validateviareturns null，failurereturnserror消息string。
 *
 * @param value - <zh/> 待校验的单元格值 | <en/> cell value to validate
 * @param rules - <zh/> 列编辑规则 | <en/> column edit rules
 * @param prop - <zh/> 字段名，用于生成默认错误提示和 async-validator descriptor key | <en/> field name，used to generate default error messages和 async-validator descriptor key
 * @param rowData - <zh/> 行数据，传递给自定义校验器（validator）的第三个参数 | <en/> row data，passed to custom validator（validator）的third parameter
 * @returns <zh/> 校验通过返回 null，否则返回错误消息 | <en/> returns null on validation success，otherwise returns error message
 */
async function validateValue(
  value: unknown,
  rules: ColumnEditorRules,
  prop: string,
  rowData?: unknown,
): Promise<string | null> {
  const asyncValidatorRules = toAsyncValidatorRules(rules, prop)

  // <zh/> 仅给自定义校验器规则附加 rowData。若给所有规则统一附加 rowData，
  // 会破坏 async-validator 对 `{ required: true }` 单一 key 规则的识别（type-agnostic required 校验器），
  // 导致其被当作 string 校验器执行，误判数字等非字符串合法值（如年龄 3 提示"不能为空"）。
  // <en/> Attach rowData only to custom-validator rules. Attaching it to every rule would break
  // async-validator's single-key detection for `{ required: true }` (the type-agnostic required validator),
  // making it run as the string validator and wrongly reject valid non-string values (e.g. age 3 → "required").
  const rulesWithRowData = asyncValidatorRules.map(r =>
    r.asyncValidator ? { ...r, rowData } : r,
  )

  const Schema = await getSchemaCtor()
  const descriptor: Record<string, AsyncValidatorRule[]> = { [prop]: rulesWithRowData }
  const schema = new Schema(descriptor)

  try {
    await schema.validate({ [prop]: value }, { suppressWarning: true })
    return null
  }
  catch (err: unknown) {
    const validationError = err as { errors?: Array<{ message?: string }>, message?: string } | null
    if (validationError?.errors && validationError.errors.length > 0)
      return validationError.errors[0].message || `${prop} validation failed`
    return validationError?.message || `${prop} validation failed`
  }
}

/**
 * <zh/> useCellValidate 配置选项 | <en/> useCellValidate configuration options
 *
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface UseCellValidateOptions<T = any> {
  /** 列定义，用于查找列级 editorRules */
  columns: ComputedRef<ProcessedColumn[]>
  /**
   * 可见数据，用于行级/全表校验时获取行数据进行跨字段传参
   * Visible data, used to fetch row data for cross-field params during row-level/full-table validation
   */
  data: ComputedRef<T[]> | ShallowRef<T[]>
  /** 跨字段校验器 getter，用于行内多字段联合校验（如开始日期 ≤ 结束日期） */
  crossFieldValidator?: () => CrossFieldValidator<T> | undefined
  /**
   * <zh/> 行键函数，用于将 rowIndex 转为 rowKey 作为 errorMap 键，排序/筛选/分页后仍可定位错误
   * <en/> Row key function, converts rowIndex to rowKey for errorMap key, still locates errors after sort/filter/pagination
   */
  rowKeyFn?: () => ((row: T) => string) | undefined
}

/**
 * useCellValidate 返回值
 */
export interface UseCellValidateReturn<T = any> {
  /** 校验错误列表，以 shallowRef 暴露用于模板渲染和 provide/inject */
  errors: ShallowRef<ValidateError[]>
  /** 单字段校验 — 校验一个单元格的编辑值，通过返回 true，失败返回 false 并写入 errors */
  validateCell: (rowIndex: number, columnKey: string, value: unknown, rowData?: unknown) => Promise<boolean>
  /** 行级校验 — 校验行内所有可编辑字段，全部通过返回 true */
  validateRow: (rowIndex: number, values: Record<string, unknown>) => Promise<boolean>
  /** <zh/> 全表校验 — 校验所有行的所有可编辑字段，分批并发执行避免阻塞 UI | <en/> Validate the whole table — validates every editable field of all rows in concurrent batches to avoid blocking the UI */
  validateAll: (dataOverride?: T[]) => Promise<boolean>
  /**
   * 清除校验错误 — 可定向清除（按行/按列）或全量清除
   * Clear validation errors — can clear targeted (by row/column) or clear all
   */
  clearErrors: (target?: { rowIndex?: number, columnKey?: string }) => void
  /** 获取指定单元格的错误消息，O(1) Map 查找 */
  getCellError: (rowIndex: number, columnKey: string, rowData?: unknown) => string | undefined
  /**
   * 行级跨字段校验 — 用于行内多字段联合校验（如依赖字段比较）
   * Row-level cross-field validation — for intra-row multi-field joint validation (e.g. dependent field comparison)
   */
  validateCrossField: (rowIndex: number, values: Record<string, unknown>) => Promise<boolean>
  /** 清除指定行的跨字段校验错误（不递增 epoch），在行级校验流程开始前调用 */
  clearRowCrossFieldErrors: (rowIndex: number, rowData?: unknown) => void
  /** 清除指定行的所有校验错误（不递增 epoch），在行级校验流程开始前调用 */
  clearRowErrors: (rowIndex: number, rowData?: unknown) => void
  /** 清除指定单元格的校验错误（不递增 epoch），全行编辑模式下单元格值变更时调用 */
  clearCellError: (rowIndex: number, columnKey: string, rowData?: unknown) => void
}

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

  /**
   * <zh/> 从 rowIndex 推导 rowKey——优先使用 rowKeyFn，不可用时回退到 rowIndex。
   *
   * <zh/> **键域统一为 string**：错误键与 UI 匹配（`cell-edit-trigger` 用 `rowKeyFn(row)` 求值后
   * <zh/> 与 `error.rowKey` 做 `===` 比较）必须在同一键域。此前回退分支返回 number，且错误键是
   * <zh/> `string | number`，一旦某条错误的 rowKey 为 number 就会比较失败，错误提示静默丢失。
   * <en/> Derive rowKey from rowIndex — prefers rowKeyFn, falls back to rowIndex.
   *
   * <en/> **The key domain is uniformly string**: the error key and the UI matcher (which compares
   * <en/> `rowKeyFn(row)` against `error.rowKey` with `===` in `cell-edit-trigger`) must share one domain.
   * <en/> The fallback branch used to return a number and the error key was `string | number`, so any error
   * <en/> carrying a numeric rowKey silently failed the comparison and never displayed.
   */
  function resolveRowKey(rowIndex: number, rowData?: unknown): string {
    const fn = rowKeyFnGetter?.()
    if (fn && rowData != null)
      return String(fn(rowData as T))
    return String(rowIndex)
  }

  function errorKey(rowKey: string | number, columnKey: string): string {
    return `${rowKey}:${columnKey}`
  }

  const errorMap = new Map<string, ValidateError>()

  /** 公开错误列表——从 Map 同步，供模板渲染和 provide/inject 消费 */
  const errors = shallowRef<ValidateError[]>([])

  /** 校验纪元 — validateAll/clearErrors 递增，validateCell 在 await 后检查是否过期 */
  let epoch = 0

  /**
   * validateAll 进行中标志 — 阻止 validateCell/validateCrossField 在 validateAll 期间写入 errorMap，
   *  避免 validateAll 最终 errorMap.clear 批量重建覆盖并发写入的结果残留或丢失
   */
  let isValidatingAll = false

  function syncErrors(): void {
    errors.value = Array.from(errorMap.values())
  }

  function findColumn(columnKey: string): ProcessedColumn | undefined {
    return findColumnByKey(columns.value, columnKey)
  }

  /** <zh/> 原子更新单个单元格的错误状态——O(1) Map 操作；rowKey 键域统一为 string（B11） | <en/> Atomically update one cell error state — O(1) Map op; rowKey domain uniformly string (B11) */
  function applyCellResult(
    rowIndex: number,
    rowKey: string,
    columnKey: string,
    prop: string,
    message: string | null,
  ): void {
    const key = errorKey(rowKey, columnKey)
    if (message) {
      errorMap.set(key, { rowIndex, rowKey, columnKey, prop, message })
      syncErrors()
    }
    else if (errorMap.has(key)) {
      errorMap.delete(key)
      syncErrors()
    }
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
    const skipWrite = isValidatingAll

    const epochAtCall = epoch
    const message = await validateValue(value, col.editorRules, col.prop ?? columnKey, rowData)

    /** validateAll/clearErrors 在 await 期间递增了 epoch，当前结果已过期 */
    if (epochAtCall !== epoch)
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

  async function validateAll(dataOverride?: T[]): Promise<boolean> {
    const epochAtStart = ++epoch
    const rows = dataOverride ?? data.value
    isValidatingAll = true

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
      isValidatingAll = false
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
      if (epoch !== epochAtStart)
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
        // <zh/> 用户自定义 crossFieldValidator 抛异常——捕获并作为校验错误记录，防止异常中断全表校验
        // <en/> User-defined crossFieldValidator threw — catch and record as a validation error, preventing the exception from aborting full-table validation
        errorMessages = [err instanceof Error ? err.message : 'Cross-field validation failed']
      }
      if (epoch !== epochAtStart)
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

  function clearErrors(target?: { rowIndex?: number, columnKey?: string }): void {
    epoch++
    // 仅全量清除时重置 isValidatingAll（调用方明确放弃整轮校验，含进行中的 validateAll）。
    // 定向清除不触碰该标志，避免误中止 validateAll 的批量重建。
    // Only a full clear resets isValidatingAll (the caller abandons the whole round,
    // including an in-flight validateAll). Targeted clears leave it untouched so they
    // cannot abort validateAll's batch rebuild.
    if (!target) {
      isValidatingAll = false
      errorMap.clear()
      syncErrors()
      return
    }

    /** 按 target 条件删除 Map 条目——O(n) 遍历 key，但 Map.delete 本身 O(1) */
    const keysToDelete: string[] = []
    for (const [key, err] of errorMap) {
      if (target.rowIndex !== undefined && err.rowIndex !== target.rowIndex)
        continue
      if (target.columnKey !== undefined && err.columnKey !== target.columnKey)
        continue
      keysToDelete.push(key)
    }
    if (keysToDelete.length > 0) {
      for (const key of keysToDelete) {
        errorMap.delete(key)
      }
      syncErrors()
    }
  }

  /** O(1) Map 查找替代 Array.find 的 O(n) 扫描；跨字段错误按 `__row__:i` 键存储，查询时展开匹配 */
  function getCellError(rowIndex: number, columnKey: string, rowData?: unknown): string | undefined {
    const rk = resolveRowKey(rowIndex, rowData)
    const direct = errorMap.get(errorKey(rk, columnKey))
    if (direct)
      return direct.message
    if (columnKey.startsWith('__row__')) {
      const prefix = `${rk}:__row__:`
      for (const [key, err] of errorMap) {
        if (key.startsWith(prefix) && err.rowKey === rk) {
          return err.message
        }
      }
    }
    return undefined
  }

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
    const skipWrite = isValidatingAll

    const epochAtCall = epoch

    let errorMessages: CrossFieldError[] = []
    try {
      errorMessages = await crossFieldValidator({ values, row, rowIndex }) ?? []
    }
    catch (err: unknown) {
      // <zh/> 用户自定义 crossFieldValidator 抛异常——捕获并作为校验错误写入，防止异常冒泡到 validateFn 调用链
      // <en/> User-defined crossFieldValidator threw — catch and write as a validation error, preventing the exception from bubbling up the validateFn call chain
      errorMessages = [err instanceof Error ? err.message : 'Cross-field validation failed']
    }

    if (epochAtCall !== epoch)
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

  /**
   * 清除指定行的跨字段校验错误（不递增 epoch，避免干扰并发校验守卫）
   *
   * 在行级校验流程开始前调用，确保上次残留的跨字段错误不会影响本次校验结果。
   * 与 clearErrors 不同，此方法仅清除 prop === '__crossField__' 的条目，
   * 不触碰单字段校验错误，也不递增 epoch。
   */
  function clearRowCrossFieldErrors(rowIndex: number, rowData?: unknown): void {
    const rk = resolveRowKey(rowIndex, rowData)
    let changed = false
    for (const [key, err] of errorMap) {
      if ((err.rowKey ?? err.rowIndex) === rk && err.prop === '__crossField__') {
        errorMap.delete(key)
        changed = true
      }
    }
    if (changed)
      syncErrors()
  }

  function clearRowErrors(rowIndex: number, rowData?: unknown): void {
    const rk = resolveRowKey(rowIndex, rowData)
    let changed = false
    for (const [key, err] of errorMap) {
      if ((err.rowKey ?? err.rowIndex) === rk) {
        errorMap.delete(key)
        changed = true
      }
    }
    if (changed)
      syncErrors()
  }

  function clearCellError(rowIndex: number, columnKey: string, rowData?: unknown): void {
    const rk = resolveRowKey(rowIndex, rowData)
    const key = errorKey(rk, columnKey)
    if (errorMap.has(key)) {
      errorMap.delete(key)
      syncErrors()
    }
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
