import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { UserSpanMethod } from './use-cell-span-types'
import { computed, toValue } from 'vue'

/**
 * <zh/> default 模式合并方法依赖——用户函数与内部 span 叠加所需的全部输入
 * <en/> Default-mode merged-span-method deps — all inputs needed to overlay the user function over the internal span
 */
export interface MergedSpanMethodDeps {
  /** <zh/> 用户函数式 spanMethod | <en/> User function-style spanMethod */
  userSpanMethod: MaybeRefOrGetter<UserSpanMethod | undefined>
  /** <zh/> 内部 span 方法（声明式 spanConfig 产物） | <en/> Internal span method (built from declarative spanConfig) */
  internalSpanMethod: MaybeRefOrGetter<UserSpanMethod | undefined>
}

/**
 * <zh/> 两种模式均完整支持单元格合并，但机制不同：
 * <zh/>   • default 模式：通过 ElTable 的 span-method prop（返回 { rowspan, colspan }）
 * <zh/>   • virtual 模式：通过 getSpanInfo 查询 spanMap（VNode 改写方式）
 * <zh/> 用户函数式 spanMethod 在两种模式下均已生效：
 * <zh/>   • default 模式：下方用户函数优先、返回 undefined 时回退内部
 * <zh/>   • virtual 模式：useCellSpan 的 userSpanMethod 参数已将其叠加到 spanMap → getSpanInfo
 *
 * <zh/> 本函数不感知渲染模式：其产物仅经 `defaultRendererProps['span-method']` 下发给 default 渲染器，
 * <zh/> 虚拟渲染器从不读取该 prop（合并走 getSpanInfo 路径）。原先内联的 `if (isVirtual) return undefined`
 * <zh/> 与 props 分流的模式判定重复，属冗余模式判断，已移除。
 * <en/> Both modes fully support cell merging, but with different mechanisms:
 * <en/>   • default mode: via ElTable's span-method prop (returns { rowspan, colspan })
 * <en/>   • virtual mode: via getSpanInfo querying spanMap (VNode rewrite approach)
 * <en/> User function-style spanMethod is effective in both modes:
 * <en/>   • default: user function first below, falling back to internal when it returns undefined
 * <en/>   • virtual: already overlaid onto spanMap by useCellSpan's userSpanMethod param → getSpanInfo
 *
 * <en/> This function is mode-agnostic: its result is handed only to the default renderer via
 * <en/> `defaultRendererProps['span-method']`; the virtual renderer never reads that prop (merging goes
 * <en/> through the getSpanInfo path). The former inline `if (isVirtual) return undefined` duplicated the
 * <en/> props-split mode decision and was a redundant mode check, so it has been removed.
 *
 * <zh/> 自 use-cell-span.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改。
 * <en/> Migrated verbatim from use-cell-span.ts (COMPLEXITY-PLAN battle line 3, knife C), body unchanged.
 */
export function createMergedSpanMethod(deps: MergedSpanMethodDeps): ComputedRef<UserSpanMethod | undefined> {
  return computed(() => {
    const userFn = toValue(deps.userSpanMethod)
    const internalFn = toValue(deps.internalSpanMethod)
    // <zh/> 无任何合并配置时返回 undefined | <en/> Return undefined when no span config
    if (!userFn || !internalFn)
      return userFn ?? internalFn
    // <zh/> 两者都存在时：用户函数优先，返回 undefined 时回退到内部 | <en/> Both present: user function first, fallback to internal when undefined
    return (params: { row: any, column: any, rowIndex: number, columnIndex: number }) =>
      userFn(params) ?? internalFn(params)
  })
}
