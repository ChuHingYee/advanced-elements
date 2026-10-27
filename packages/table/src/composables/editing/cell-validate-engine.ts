/**
 * <zh/> 单元格校验引擎（纯函数层）——async-validator 懒加载适配、ColumnEditorRules →
 * <zh/> async-validator 规则转换与单值校验。
 *
 * <zh/> 自 use-cell-validate.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 A 纯函数下沉），
 * <zh/> 主体逐字未改。
 * <en/> Cell-validation engine (pure layer) — lazy async-validator loading, the
 * <en/> ColumnEditorRules → async-validator rule conversion and single-value validation.
 *
 * <en/> Migrated verbatim from use-cell-validate.ts (COMPLEXITY-PLAN battle line 3, knife A).
 */
import type { ColumnEditorRules } from '../../types/edit'

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
/**
 * <zh/> crossFieldValidator 抛出值的统一消息化——Error 取 message，非 Error 字符串原样保留
 * <zh/> （用户自定义文案不被通用消息吞掉），其余兜底通用文案。
 * <en/> Normalize a thrown crossFieldValidator value — Error.message wins, non-Error strings are
 * <en/> preserved verbatim (custom copy must not be swallowed by the generic message), anything else
 * <en/> falls back to the generic copy.
 */
export function crossFieldThrownMessage(err: unknown): string {
  if (err instanceof Error)
    return err.message
  if (typeof err === 'string' && err.length > 0)
    return err
  return 'Cross-field validation failed'
}

export async function getSchemaCtor(): Promise<SchemaConstructor> {
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
export function toAsyncValidatorRules(rules: ColumnEditorRules, prop: string): AsyncValidatorRule[] {
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
export async function validateValue(
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
