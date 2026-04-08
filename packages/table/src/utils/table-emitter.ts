import type { ComputedRef } from 'vue'
import type { AdvTableEmitFn, AdvTableEmitsMap } from '../types'

/**
 * <zh/> TableEmitter — 自动将 tableId 拼接为事件末位参数的代理 emit 工具。
 * <zh/> 消除各子编排器中 30+ 处 `emit('xxx', payload, tableId.value)` 的手工拼接。
 *
 * <zh/> 用法：
 * <zh/> - `tableEmit('pageChange', page, size)` → 等价于 `emit('pageChange', page, size, tableId.value)`
 * <zh/> - `tableEmit('cellClick', payload)` → 等价于 `emit('cellClick', payload, tableId.value)`
 *
 * <en/> TableEmitter — auto-appends tableId as the trailing argument to every event emission.
 * <en/> Eliminates 30+ hand-written `emit('xxx', payload, tableId.value)` concatenations across sub-orchestrators.
 *
 * <en/> Usage:
 * <en/> - `tableEmit('pageChange', page, size)` → equivalent to `emit('pageChange', page, size, tableId.value)`
 * <en/> - `tableEmit('cellClick', payload)` → equivalent to `emit('cellClick', payload, tableId.value)`
 */
export type TableEmitter = <K extends keyof AdvTableEmitsMap<any>>(
  event: K,
  ...args: OmitTableId<AdvTableEmitsMap<any>[K]>
) => void

/** <zh/> 除去元组末位（tableId）的辅助类型 | <en/>Helper type that removes the trailing tableId from a tuple */
type OmitTableId<T extends unknown[]> = T extends [...infer Rest, any] ? Rest : never

/**
 * <zh/> 创建已绑定 tableId 的 emit 代理
 * <en/> Create an emit proxy pre-bound with tableId
 */
export function createTableEmitter(
  rawEmit: AdvTableEmitFn,
  tableId: ComputedRef<string>,
): TableEmitter {
  return ((event: string, ...args: any[]) => {
    rawEmit(event as keyof AdvTableEmitsMap<any>, ...args, tableId.value)
  }) as TableEmitter
}
