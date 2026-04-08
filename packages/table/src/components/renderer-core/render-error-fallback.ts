import type { VNode } from 'vue'
import { h } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> 渲染单元格/表头错误降级 VNode
 * <en/> Render cell/header error fallback VNode
 *
 * @remarks
 * <zh/> 当 cellRenderer / headerCellRenderer / slot / format 抛错时，
 * <zh/> 由调用处 try/catch 捕获后调用此函数返回降级 VNode，
 * <zh/> 避免单个单元格渲染错误导致整表崩溃（onErrorCaptured 会卸载整表）。
 * <zh/>
 * <en/> When cellRenderer / headerCellRenderer / slot / format throws,
 * <en/> the call site's try/catch catches the error and calls this function to return a fallback VNode,
 * <en/> preventing a single cell render error from crashing the entire table (onErrorCaptured would unmount the whole table).
 *
 * @param error - <zh/> 捕获的错误对象 | <en/> caught error object
 * @param scope - <zh/> 错误发生的作用域标识，用于 dev 模式提示 | <en/> scope identifier where the error occurred, used for dev-mode hint
 * @returns <zh/> 降级 VNode | <en/> fallback VNode
 */
export function renderErrorFallback(error: unknown, scope: 'cell' | 'header' = 'cell'): VNode {
  // <zh/> 统一走 dev 通道（替代裸 console.error），调用方仍可经 error 事件观测
  // <en/> Unified dev channel (instead of raw console.error); callers can still observe via the error event
  if (isDev) {
    devWarn(`${scope === 'header' ? 'Header' : 'Cell'} render error:`, error)
  }

  return h(
    'span',
    {
      class: `adv-table__${scope}--error`,
      title: isDev ? (error instanceof Error ? error.message : String(error)) : '',
    },
    isDev ? '⚠' : '',
  )
}
