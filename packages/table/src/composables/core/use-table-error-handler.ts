/**
 * <zh/> 表格错误处理器子 composable | <en/> Table error handler sub-composable
 *
 * <zh/> 从 useAdvTableCore 拆分，封装 createTableErrorHandler。
 * <zh/> 接收 i18n 翻译函数 t，使错误消息与建议可通过国际化系统解析。
 * <en/> Extracted from useAdvTableCore, wraps createTableErrorHandler.
 * <en/> Accepts i18n translation function t so error messages and suggestions are resolved via the i18n system.
 */
import type { MaybeRefOrGetter } from 'vue'
import type { AdvTableEmitFn } from '../../types'
import type { ErrorTranslateFn } from '../../utils/error-handler'
import { createTableErrorHandler } from '../../utils/error-handler'

export interface UseTableErrorHandlerReturn {
  handleError: ReturnType<typeof createTableErrorHandler>
}

export function useTableErrorHandler(
  emit: AdvTableEmitFn,
  tableId: MaybeRefOrGetter<string | undefined>,
  t?: ErrorTranslateFn,
): UseTableErrorHandlerReturn {
  const handleError = createTableErrorHandler(emit, { tableId, t })
  return { handleError }
}
