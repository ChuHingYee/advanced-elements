import type { ComputedRef, Ref } from 'vue'
import type { GrandTotalRowPosition, SuppressStickyTotalRow, TotalValueGetter } from '../../types/config-options'
import type { DefaultSummaryColumnLike } from '../../utils/summary-defaults'
import type { UseDeferredAggregatesReturn } from './use-async-summary'
import { computed } from 'vue'
import {
  resolveGrandTotalPosition,
  resolveTotalLabel,
  resolveTotalSticky,
} from '../../utils/total-rows'
import { useDeferredRawAggregates } from './use-async-summary'

/**
 * <zh/> Grand Total 共享内核——default / virtual 双渲染器的位置决议 → 标签 → 聚合唯一来源。
 *
 * <zh/> 对拍单测（`__tests__/components/parity/summary.parity.test.ts`）事后发现。本 core 收敛
 * <zh/> "算什么"，渲染拼接（pinnedDisplayData 交错 vs dataWithAppend/条带/高度）仍归各渲染器。
 * <zh/> **两侧口径已收敛**：聚合列归一统一走 `resolveColumnProp`（认 `property` 别名）、sumText
 * <zh/> 回退统一走 `||`。此前 default/virtual 各用一套，同一份 columns 在两种模式下会给出不同合计值
 * <zh/> （对拍单测只锁"同输入同输出"，未覆盖口径差本身，故漏洞存续至今）。
 * <en/> Grand-total shared core — the single source of position → label → aggregation for the
 * <en/> default / virtual renderers. Both previously held line-by-line identical wiring, so
 * <en/> threshold/gating/label changes had to land twice and silent forks were only caught after
 * <en/> the fact by the parity test. This core converges "what to compute"; render splicing
 * <en/> (pinnedDisplayData interleave vs dataWithAppend/strips/heights) stays with each renderer.
 * <en/> **Both calibers are now converged**: column normalization uniformly uses `resolveColumnProp`
 * <en/> (accepts the `property` alias) and the sumText fallback uniformly uses `||`. Each side
 * <en/> previously had its own, so the SAME columns could yield different totals per mode — the
 * <en/> parity test only pinned "same input → same output within a mode", never the cross-mode gap.
 */
export interface UseGrandTotalCoreDeps {
  /** <zh/> 是否展示汇总（未设 grandTotalRow 时回退 bottom） | <en/> Whether summaries show (falls back to bottom without grandTotalRow) */
  showSummary: () => boolean | undefined
  /** <zh/> Grand Total 落位（显式优先） | <en/> Grand-total placement (explicit wins) */
  grandTotalRow: () => GrandTotalRowPosition | undefined
  /** <zh/> 粘性合计行抑制 | <en/> Sticky total suppression */
  suppressStickyTotalRow: () => SuppressStickyTotalRow | undefined
  /** <zh/> 合计标签（调用方已按各自算子回退） | <en/> Total label (callers apply their own fallback operator) */
  sumText: () => string
  /** <zh/> 合计标签自定义 | <en/> Total label customization */
  totalValueGetter: () => TotalValueGetter | undefined
  /** <zh/> 待聚合源行（调用方已做 summaryData ?? data） | <en/> Source rows (callers apply summaryData ?? data) */
  sourceRows: () => readonly any[]
  /** <zh/> 聚合列描述（调用方已按各自口径归一） | <en/> Aggregate columns (callers normalize per their own caliber) */
  aggColumns: () => ReadonlyArray<DefaultSummaryColumnLike & { prop?: string }>
  /** <zh/> 异步阈值（行×列）透传，缺省 SUMMARY_ASYNC_THRESHOLD——超大表可调优 | <en/> Async threshold (rows×cols) passthrough, defaults to SUMMARY_ASYNC_THRESHOLD — tunable for huge tables */
  summaryAsyncThreshold?: () => number | undefined
  /** <zh/> 异步推迟开关透传 | <en/> Async deferral switch passthrough */
  summaryAsyncEnabled?: () => boolean | undefined
  /** <zh/> 异步聚合失败回调透传 | <en/> Async-aggregation failure callback passthrough */
  onSummaryError?: (err: unknown) => void
}

export interface UseGrandTotalCoreReturn {
  /** <zh/> Grand 落位（null/undefined 即不计算） | <en/> Grand placement (null/undefined disables computation) */
  grandPosition: ComputedRef<GrandTotalRowPosition | undefined>
  /** <zh/> 是否粘性 | <en/> Whether sticky */
  grandSticky: ComputedRef<boolean>
  /** <zh/> 合计标签 | <en/> Total label */
  grandLabel: ComputedRef<string>
  /** <zh/> 原始聚合（prop 键控；与 useDeferredRawAggregates 同形态） | <en/> Raw aggregates (prop-keyed; same shape as useDeferredRawAggregates) */
  grandAggregates: UseDeferredAggregatesReturn['aggregates']
  /** <zh/> 是否正在后台计算 | <en/> Whether a background pass is pending */
  isSummaryCalculating: Ref<boolean>
}

export function useGrandTotalCore(deps: UseGrandTotalCoreDeps): UseGrandTotalCoreReturn {
  const grandPosition = computed(() =>
    resolveGrandTotalPosition(deps.showSummary(), deps.grandTotalRow()),
  )
  const grandSticky = computed(() =>
    resolveTotalSticky('grand', deps.suppressStickyTotalRow()),
  )
  const grandLabel = computed(() =>
    resolveTotalLabel(
      { level: -1, value: undefined, field: undefined, isGrandTotal: true },
      deps.totalValueGetter(),
      deps.sumText(),
    ),
  )
  const { aggregates: grandAggregates, isCalculating: isSummaryCalculating } = useDeferredRawAggregates({
    rows: () => {
      if (grandPosition.value == null)
        return []
      // <zh/> 透传原数组引用：useDeferredRawAggregates 内部对异步快照自行拷贝
      // <zh/> 此处若拷贝会导致 watch 身份抖动 | <en/> Pass the original array through (as both sides did):
      // <en/> useDeferredRawAggregates copies async snapshots itself; copying here would jitter watch identity
      return (deps.sourceRows() ?? [])
    },
    columns: () => deps.aggColumns(),
    threshold: deps.summaryAsyncThreshold?.(),
    enabled: deps.summaryAsyncEnabled ? () => deps.summaryAsyncEnabled?.() ?? true : undefined,
    onError: deps.onSummaryError,
  })

  return {
    grandPosition,
    grandSticky,
    grandLabel,
    grandAggregates,
    isSummaryCalculating,
  }
}
