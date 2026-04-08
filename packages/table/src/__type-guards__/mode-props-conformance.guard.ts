import type { AdvTableProps } from '../types/table-props'

/**
 * <zh/> 模式判别联合门禁（编译期闸门，随 `npm run typecheck` 执行）
 *
 * <zh/> 锁定单模式专属 prop 的类型收窄：virtual 下传 `size`/`tableLayout`、
 * <zh/> default 下传 `estimatedRowHeight` 必须编译报错，不再是运行期静默忽略。
 * <zh/> 若门禁失败：说明判别联合被绕过（如字段被挪回基接口），禁止放宽本文件。
 * <en/> Mode-discriminated union gate (compile-time, runs with `npm run typecheck`).
 *
 * <en/> Pins single-mode prop narrowing: `size`/`tableLayout` under virtual and
 * <en/> `estimatedRowHeight` under default must be compile errors, never silent runtime ignores.
 */

type Expect<T extends true> = T
type IsNever<T> = [T] extends [never] ? true : false
type IsAssignable<From, To> = From extends To ? true : false

// 正向：同模式组合可编译；无 mode 的 size 落 default 分支
type _VirtualAcceptsEstimated = Expect<IsAssignable<{ mode: 'virtual', estimatedRowHeight: 100 }, AdvTableProps>>
type _DefaultAcceptsSize = Expect<IsAssignable<{ mode: 'default', size: 'small' }, AdvTableProps>>
type _BareSizeFallsToDefault = Expect<IsAssignable<{ size: 'small' }, AdvTableProps>>
// <zh/> 不传 mode（`mode?: undefined`，exactOptionalPropertyTypes 未开启故双侧可匹配）
// <en/> Without mode (`mode?: undefined`; exactOptionalPropertyTypes is off, so both sides match)
type _EmptyMatchesEither = Expect<IsAssignable<{ mode?: undefined }, AdvTableProps>>

// 负向：跨模式组合无成员可匹配（Extract 为 never）
type _RejectVirtualSize = Expect<IsNever<Extract<AdvTableProps, { mode: 'virtual', size: 'small' }>>>
type _RejectVirtualLayout = Expect<IsNever<Extract<AdvTableProps, { mode: 'virtual', tableLayout: 'fixed' }>>>
type _RejectDefaultEstimated = Expect<IsNever<Extract<AdvTableProps, { mode: 'default', estimatedRowHeight: 100 }>>>

// keyof 稳定：global-config 守卫依赖 `keyof AdvTableProps`，判别字段必须双侧声明（含 never 侧）
type _KeyofStable = Expect<IsNever<Exclude<'mode' | 'size' | 'tableLayout' | 'estimatedRowHeight', keyof AdvTableProps>>>

export type {
  _BareSizeFallsToDefault,
  _DefaultAcceptsSize,
  _EmptyMatchesEither,
  _KeyofStable,
  _RejectDefaultEstimated,
  _RejectVirtualLayout,
  _RejectVirtualSize,
  _VirtualAcceptsEstimated,
}
