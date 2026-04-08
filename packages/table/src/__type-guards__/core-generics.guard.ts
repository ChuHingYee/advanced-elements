import type { UseAdvTableCoreReturn } from '../composables/core/use-adv-table-core'
import type { CellContext, CellRendererParams, RowCommonParams } from '../types/column'

/**
 * <zh/> 核心域泛型穿透门禁（编译期闸门，随 `npm run typecheck` 执行）
 *
 * <zh/> 锁定 `UseAdvTableCoreReturn<T>` 的 T 真实穿透：rowKeyFn/selectableFn 必须随行类型变化，
 * <zh/> 而非退化为 `(row: any)`。正向调用保证可用性；`@ts-expect-error` 负向行保证严格性——
 * <zh/> 若实现退化为 any，负向行不再报错，门禁转而因“未使用的 ts-expect-error”而失败。
 * <en/> Core-domain generics gate (compile-time, runs with `npm run typecheck`).
 *
 * <en/> Pins real T flow through `UseAdvTableCoreReturn<T>`: rowKeyFn/selectableFn must vary
 * <en/> with the row type instead of degrading to `(row: any)`. Positive calls guard usability;
 * <en/> the `@ts-expect-error` negative lines guard strictness — if the implementation degrades
 * <en/> to any, a negative line stops erroring and the gate fails on the unused directive instead.
 */
interface GateRow {
  id: number
  name: string
}

type IsAny<T> = 0 extends (1 & T) ? true : false
type IsTypedRow<T> = IsAny<T> extends true ? false : [T] extends [GateRow] ? [GateRow] extends [T] ? true : false : false

export const cellRowGenericsGate: [
  IsTypedRow<RowCommonParams<GateRow>['rowData']>,
  IsTypedRow<CellRendererParams<GateRow>['rowData']>,
  IsTypedRow<CellContext<GateRow>['rowData']>,
  IsAny<RowCommonParams['rowData']>,
  IsAny<CellRendererParams['rowData']>,
] = [true, true, true, true, true]

export function assertCoreGenericsFlow(core: UseAdvTableCoreReturn<GateRow>): string {
  // @ts-expect-error <zh/> 异构行必须被拒绝 | <en/> Alien rows must be rejected
  const alienRowKey: (row: { alien: boolean }) => string = core.rowKeyFn.value
  void alienRowKey

  // @ts-expect-error <zh/> 异构行必须被拒绝（含 index 参数形态） | <en/> Alien rows must be rejected (including the indexed form)
  const alienSelectable: ((row: { alien: boolean }, index: number) => boolean) | undefined = core.selectableFn.value
  void alienSelectable

  return core.rowKeyFn.value({ id: 1, name: 'gate' })
}
