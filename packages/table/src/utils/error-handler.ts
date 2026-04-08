/**
 * <zh/> 表格统一错误处理工厂
 *
 * <zh/> 使用方式：在 composable 中注入 `handleError`，调用 `handleError('TABLE_XXX', { cause, field })`，
 * <zh/> 工厂会自动：
 * <zh/> 1. 从 {@link TABLE_ERROR_CODES} 取出 severity 与默认 suggestion
 * <zh/> 2. 按 severity 决定是否进入 `error` 事件流（info 不进入，warn/error 进入）
 * <zh/> 3. 按 severity + isDev 决定 console 输出（error 永远输出，warn 仅 dev 输出，info 仅 dev 输出）
 *
 * <en/> Unified table error-handling factory
 *
 * <en/> Usage: inject `handleError` in composables, call `handleError('TABLE_XXX', { cause, field })`,
 * <en/> the factory will automatically:
 * <en/> 1. Pull severity and default suggestion from {@link TABLE_ERROR_CODES}
 * <en/> 2. Decide whether to flow through `error` event (info: no; warn/error: yes)
 * <en/> 3. Decide console output by severity + isDev (error: always; warn: dev-only; info: dev-only)
 */
import type { MaybeRefOrGetter } from 'vue'
import type { TableError, TableErrorCode } from '../types/error'
import type { AdvTableEmitFn } from '../types/events'
import { toValue } from 'vue'
import { TABLE_ERROR_CODES } from '../types/error'
import { isDev } from './env'

/**
 * <zh/> i18n 翻译函数类型——与 useAdvLocale 返回的 t 函数签名一致
 * <en/> i18n translation function type — matches the t function returned by useAdvLocale
 */
export type ErrorTranslateFn = (path: string, params?: Record<string, any>) => string

export interface TableErrorHandlerOptions {
  /**
   * <zh/> 表格实例标识，用于多实例日志区分——支持 ref/getter 惰性求值，
   * <zh/> 运行时变更 tableId（uiConfig.tableId）后日志前缀与 error 事件参数即时跟随
   * <en/> Table instance id for multi-instance log distinction — accepts ref/getter for lazy
   * <en/> evaluation, so runtime tableId changes (uiConfig.tableId) take effect immediately
   */
  tableId?: MaybeRefOrGetter<string | undefined>
  /** <zh/> 是否启用 dev console 输出（默认跟随 isDev） | <en/> Whether to enable dev console output (defaults to isDev) */
  enableDevLog?: boolean
  /**
   * <zh/> i18n 翻译函数——传入后错误消息与建议将通过 i18n 解析，支持多语言切换。
   * <zh/> 未传入时回退到 TABLE_ERROR_CODES 中的硬编码中文默认值。
   *
   * <en/> i18n translation function — when provided, error messages and suggestions are resolved via i18n, supporting multi-language switching.
   * <en/> Falls back to hardcoded Chinese defaults in TABLE_ERROR_CODES when not provided.
   */
  t?: ErrorTranslateFn
}

export interface TableErrorHandler {
  /**
   * <zh/> 派发结构化错误
   * @param code - <zh/> 错误码，必须是 {@link TableErrorCode} 之一
   * @param extra - <zh/> 额外字段（cause/field/suggestion），suggestion 未提供时使用默认值
   *
   * <en/> Dispatch a structured error
   * @param code - error code, must be one of {@link TableErrorCode}
   * @param extra - extra fields (cause/field/suggestion); suggestion defaults if omitted
   */
  (code: TableErrorCode, extra?: Pick<TableError, 'cause' | 'field' | 'suggestion'>): void

  /**
   * <zh/> dev-only 警告，仅 console 输出，不进入 error 事件流。
   * <zh/> 用于开发期提示（如配置冲突、缺失字段等），生产环境静默。
   *
   * <en/> dev-only warning, console output only, does NOT enter the error event stream.
   * <en/> Used for development-time hints (e.g. config conflicts, missing fields), silent in production.
   */
  devWarn: (message: string, ...args: unknown[]) => void
}

/**
 * <zh/> 创建表格错误处理器实例
 *
 * <zh/> 单一表格实例内共享同一个 handler，避免重复创建闭包。
 * <zh/> handler 内部无状态，可在多个 composable 间安全传递。
 *
 * <en/> Create a table error handler instance
 *
 * <en/> A single table instance should share one handler to avoid duplicate closures.
 * <en/> The handler is stateless and safe to pass across composables.
 *
 * @example
 * ```ts
 * const handleError = createTableErrorHandler(emitFn, { tableId: tableId.value })
 * // 替换 console.warn
 * handleError('TABLE_EXPORT_FAILED', { cause: err })
 * ```
 */
export function createTableErrorHandler(
  emit: AdvTableEmitFn,
  options: TableErrorHandlerOptions = {},
): TableErrorHandler {
  const enableDevLog = options.enableDevLog ?? isDev
  /**
   * <zh/> tableId 惰性求值——创建期快照会在 uiConfig.tableId 运行时变更后输出旧前缀，
   * <zh/> 故每次派发时经 toValue 读取当前值（字符串直传场景 toValue 零开销透传）
   * <en/> Lazy tableId evaluation — a creation-time snapshot keeps emitting a stale prefix after
   * <en/> a runtime uiConfig.tableId change, so the current value is read via toValue per dispatch
   * <en/> (toValue passes plain strings through with zero overhead)
   */
  const resolveTableId = (): string | undefined => toValue(options.tableId)

  const handleError = function handleError(code, extra) {
    const tableIdPrefix = resolveTableId() ? `[AdvTable:${resolveTableId()}]` : '[AdvTable]'
    /** <zh/> 表格实例 ID，附加到 error 事件末位参数 | <en/> Table instance ID, appended as trailing arg of error event */
    const tid = resolveTableId()
    const meta = TABLE_ERROR_CODES[code]
    if (!meta) {
      // 防御：调用方传入了未注册的 code（理论 TS 应拦截，运行时兜底）。
      // 未知码永不静默：生产亦 console.error（拼写错在生产必须可见），且不进入 error 事件流
      // （未知码无 severity/文案，进事件流会破坏消费方的 code 穷举）。
      // Defensive: callers passing an unregistered code (TS should intercept; runtime fallback).
      // Unknown codes are never silent: console.error even in production (a misspelled code must be
      // visible), without entering the error event stream (no severity/copy; it would break consumer
      // code exhaustiveness).
      if (typeof console === 'undefined') {
        return
      }
      console.error(`${tableIdPrefix} Unknown table error code: ${String(code)}`, extra)
      return
    }

    // 通过 i18n 解析错误消息与建议；未配置 i18n 时回退到 TABLE_ERROR_CODES 中的硬编码默认值
    // Resolve error message and suggestion via i18n; fall back to hardcoded defaults in TABLE_ERROR_CODES when i18n is not configured
    const messagePath = `error.${code}.message`
    const suggestionPath = `error.${code}.suggestion`
    const i18nMessage = options.t ? options.t(messagePath) : messagePath
    const i18nSuggestion = options.t ? options.t(suggestionPath) : suggestionPath
    const message = i18nMessage === messagePath ? meta.message : i18nMessage
    const defaultSuggestion = i18nSuggestion === suggestionPath ? meta.suggestion : i18nSuggestion

    const error: TableError = {
      code,
      severity: meta.severity,
      field: extra?.field,
      suggestion: extra?.suggestion ?? defaultSuggestion,
      cause: extra?.cause,
    }

    // console 输出策略
    // - error: 永远输出（生产事故需可观测）
    // - warn: 仅 dev 输出
    // - info: 仅 dev 输出
    if (enableDevLog || meta.severity === 'error') {
      const logFn = meta.severity === 'error' ? console.error : console.warn
      const detail = error.cause != null ? `\n  cause: ${error.cause}` : ''
      logFn(`${tableIdPrefix} ${message} [${code}]${detail}\n  suggestion: ${error.suggestion}`)
    }

    // 事件流策略
    // - info: 不进入 error 事件（如 mode 切换是通知，非错误）
    // - warn / error: 进入 error 事件
    if (meta.severity !== 'info') {
      emit('error', error, tid)
    }
  } as TableErrorHandler

  handleError.devWarn = (message, ...args) => {
    if (enableDevLog && typeof console !== 'undefined') {
      const tid = resolveTableId()
      console.warn(`${tid ? `[AdvTable:${tid}]` : '[AdvTable]'} ${message}`, ...args)
    }
  }

  return handleError
}
