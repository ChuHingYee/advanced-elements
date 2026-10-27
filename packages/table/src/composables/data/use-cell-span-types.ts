import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue'
import type { ColSpanCellsConfig, ProcessedColumn, RowSpanCellsConfig, SpanInfo, SpanRange } from '../../types'
import type { SpanResult } from '../rendering/use-span-strategy'

/**
 * <zh/> `useCellSpan` 契约类型——自 use-cell-span.ts 拆出（COMPLEXITY-PLAN 战线三，刀法 C）；
 * <zh/> use-cell-span.ts re-export 本文件，既有导入路径零变化。
 * <en/> Contract types of `useCellSpan` — split out of use-cell-span.ts (COMPLEXITY-PLAN battle line 3, knife C);
 * <en/> use-cell-span.ts re-exports this file, keeping every existing import path unchanged.
 */
export interface UseCellSpanOptions {
  data: MaybeRefOrGetter<any[]>
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  rowSpanCells?: MaybeRefOrGetter<RowSpanCellsConfig | undefined>
  colSpanCells?: MaybeRefOrGetter<ColSpanCellsConfig | undefined>
  ranges?: MaybeRefOrGetter<SpanRange[] | undefined>
  /**
   * <zh/> 用户提供的函数式 spanMethod。若提供，其结果会叠加到 spanMap，
   * <zh/> 使虚拟模式下的 getSpanInfo 也能反映函数式 spanMethod（否则虚拟模式仅 spanConfig 生效）。
   * <zh/> 与 spanConfig 共存时，函数式 spanMethod 按单元格优先（与 default 模式 mergedSpanMethod 的 userFn ?? internalFn 语义一致）。
   *
   * <en/> User-provided function-style spanMethod. When provided, its results are overlaid onto spanMap,
   * <en/> so getSpanInfo in virtual mode also reflects the function-style spanMethod (otherwise virtual mode only honors spanConfig).
   * <en/> When coexisting with spanConfig, the function-style spanMethod takes precedence per cell
   * <en/> (consistent with default-mode mergedSpanMethod's userFn ?? internalFn semantics).
   */
  userSpanMethod?: MaybeRefOrGetter<UserSpanMethod | undefined>
  /**
   * <zh/> 单元格合并计算因数据规模超限被跳过时的回调（生产环境降级通知）。
   * <zh/> 触发场景：估算操作数（行数 × 列数）超过 SPAN_CELL_LIMIT，已静默跳过合并计算。
   *
   * <en/> Callback invoked when cell span computation is skipped due to scale exceeding limit (production degradation notification).
   * <en/> Triggered when: estimated operations (rows × cols) exceed SPAN_CELL_LIMIT, span computation silently skipped.
   */
  onSpanLimitExceeded?: (info: SpanLimitInfo) => void
  /**
   * <zh/> 延迟调度阈值——估算操作数超过此值时，经 requestIdleCallback/setTimeout 延迟建图，
   * <zh/> 首帧先渲染无合并，完成后一次性提交，避免大数据阻塞首帧。默认 50000。
   * <zh/> 小表恒走同步路径。
   *
   * <en/> Deferral threshold — builds exceeding this estimated op count are deferred through
   * <en/> requestIdleCallback/setTimeout: first paint renders unmerged, then a single swap lands.
   * <en/> Defaults to 50000. Small tables always take the sync path, identical to history.
   */
  deferThreshold?: MaybeRefOrGetter<number>
}

export interface SpanLimitInfo {
  /** <zh/> 估算操作数 | <en/> Estimated operations */
  estimatedOps: number
  /** <zh/> 上限阈值 | <en/> Limit threshold */
  limit: number
  /** <zh/> 触发来源：'spanConfig'（声明式 spanConfig）或 'functionStyle'（函数式 spanMethod） | <en/> Trigger source: 'spanConfig' (declarative) or 'functionStyle' (function-style spanMethod) */
  source: 'spanConfig' | 'functionStyle'
}

/**
 * <zh/> 用户函数式 spanMethod 类型——返回体复用渲染域 `SpanResult`，与
 * <zh/> `rendering/use-span-strategy.ts` 的同名类型同构归一，避免两处内联结构漂移。
 * <en/> User function-style spanMethod type — reuses the render-domain `SpanResult`, unified
 * <en/> with the same-named type in `rendering/use-span-strategy.ts`.
 */
export type UserSpanMethod = (params: { row: any, column: any, rowIndex: number, columnIndex: number }) => SpanResult | undefined

export interface UseCellSpanReturn {
  readonly spanMap: ShallowRef<Map<string, SpanInfo>>
  readonly spanEnabled: ComputedRef<boolean>
  readonly spanMethod: ComputedRef<UserSpanMethod | undefined>
  readonly getSpanInfo: (rowIndex: number, colKey: string) => SpanInfo | undefined
  /** <zh/> 延迟建图进行中（首帧无合并态） | <en/> Deferred build in flight (first paint renders unmerged) */
  readonly isSpanPending: ComputedRef<boolean>
}
