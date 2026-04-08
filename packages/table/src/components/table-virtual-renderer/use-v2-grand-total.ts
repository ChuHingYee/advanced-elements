/**
 * <zh/> virtual 渲染器的 Grand Total 域
 * <en/> Virtual-renderer grand-total domain
 *
 * @remarks
 * <zh/> 职责单一：Grand Total（对齐 AG Grid grandTotalRow）的**位置决议 → 聚合 → 合成行 → 数据拼接 →
 * <zh/> 固定条带合并 → 高度换算**。四种落位：
 * <zh/> - `top` / `pinnedTop`：粘性时渲染顶部条带 / 并入 fixed-data 顶部，非粘性降级为数据首行；
 * <zh/> - `bottom` / `pinnedBottom`：粘性时走 footer slot / 并入底部条带，非粘性降级为数据末行。
 * <zh/> 合计行恒不参与 stripe/highlight，且 append 合成行恒居数据末尾。
 * <en/> Single responsibility: the grand total (aligned with AG Grid grandTotalRow) pipeline
 * <en/> **position resolution → aggregation → synthetic rows → data splicing → pinned-strip merge →
 * <en/> height math**. Four placements:
 * <en/> - `top` / `pinnedTop`: sticky renders a top strip / merges into fixed-data head; non-sticky
 * <en/>   degrades to the data head;
 * <en/> - `bottom` / `pinnedBottom`: sticky uses the footer slot / merges into the bottom strip;
 * <en/>   non-sticky degrades to the data tail.
 * <en/> Total rows never take part in stripe/highlight, and the append synthetic row is always last.
 */
import type { ComputedRef } from 'vue'
import type { V2RendererProps } from './v2-renderer-props'
import { computed } from 'vue'
import { useGrandTotalCore } from '../../composables/features/use-grand-total-core'
import { DEFAULT_ROW_HEIGHT } from '../../constants'
import { tf } from '../../utils/locale-fallback'
import { resolveColumnProp } from '../../utils/shared'
import {
  buildGrandTotalRow,
  resolveLabelProp,
} from '../../utils/total-rows'

/** <zh/> Grand Total 域依赖 | <en/> Grand-total domain deps */
export interface UseV2GrandTotalDeps<T = any> {
  /** <zh/> 渲染器 props | <en/> renderer props */
  props: V2RendererProps<T>
  /** <zh/> 用户固定的顶部行（未启用时为空） | <en/> user-pinned top rows (empty when pinning is off) */
  topPinnedRows: ComputedRef<any[]>
  /** <zh/> 用户固定的底部行（未启用时为空） | <en/> user-pinned bottom rows (empty when pinning is off) */
  bottomPinnedRows: ComputedRef<any[]>
  /** <zh/> 是否存在 append 插槽 | <en/> whether the append slot exists */
  hasAppendSlot: ComputedRef<boolean>
  /** <zh/> append 合成行数据 | <en/> append synthetic row data */
  appendRowData: unknown
  /** <zh/> 国际化函数（合计标签回退，未配置时返回 undefined） | <en/> locale function (total label fallback; undefined when unconfigured) */
  t: () => ((path: string) => string) | undefined
}

/**
 * <zh/> 创建 Grand Total 域
 * <en/> Create the grand-total domain
 */
export function useV2GrandTotal<T = any>(deps: UseV2GrandTotalDeps<T>) {
  const { props, topPinnedRows, bottomPinnedRows, hasAppendSlot, appendRowData, t } = deps

  const summaryAllColumns = computed(() => [
    ...props.selectionColumns,
    ...props.normalColumns,
  ])

  /**
   * <zh/> Grand 聚合列描述——经 `resolveColumnProp` 归一（认 `property` 别名，**与 default 模式同口径**）。
   * <zh/> 位置/标签/聚合 wiring 收敛至 useGrandTotalCore。
   * <en/> Grand aggregate column descriptors — normalized via `resolveColumnProp` (accepts the
   * <en/> `property` alias, **same caliber as default mode**). Position/label/aggregation wiring
   * <en/> converges in useGrandTotalCore.
   */
  const grandAggColumnsV = computed(() =>
    summaryAllColumns.value.map(col => ({ prop: resolveColumnProp(col), aggFunc: col.aggFunc })),
  )
  /**
   * <zh/> Grand 位置/标签/聚合——经双侧共享内核（useGrandTotalCore）决议，口径与 default 模式同源。
   * <zh/> 此前本侧直取 `col.prop` 而 default 侧经 `resolveColumnProp`：同一份 columns 在两种模式下
   * <zh/> 给出不同合计值（`property` 别名列在 virtual 下漏聚合）——已收敛为同一口径。
   * <zh/> sumText 回退改用 `||`（与 default 一致）：`''` 空串此前被当作"已配置"从而吞掉默认标签。
   * <zh/> 解构别名保持下游（拼接/条带/高度）零改动。
   * <zh/> **声明序约束**：必须排在 `grandAggColumnsV` 之后——内核的 deferred 聚合在装配时
   * <zh/> 即时求值列定义（`watch(..., { immediate: true })`），前向引用会抛 TDZ。
   * <zh/> 同时所有派生（footer/条带/拼接）必须排在其后，保持单一向下数据流。
   * <en/> Grand position/label/aggregation — resolved via the shared cross-mode core
   * <en/> (useGrandTotalCore), same source as default mode. This side previously read `col.prop`
   * <en/> directly while default used `resolveColumnProp`, so the SAME columns produced different
   * <en/> totals per mode (`property`-aliased columns were skipped in virtual) — now converged.
   * <en/> The sumText fallback also switches to `||` (matching default): an empty string was
   * <en/> previously treated as "configured", swallowing the default label.
   * <en/> Destructure aliases keep downstream (splicing/strips/heights) untouched.
   * <en/> **Declaration-order constraint**: must come after `grandAggColumnsV` — the core's
   * <en/> deferred aggregation evaluates the columns eagerly at setup
   * <en/> (`watch(..., { immediate: true })`), so a forward reference throws a TDZ error.
   * <en/> All derivations (footer/strips/splicing) must likewise come after it, keeping a
   * <en/> single downward data flow.
   */
  const {
    grandPosition: grandPositionV,
    grandSticky: grandStickyV,
    grandLabel: grandLabelV,
    grandAggregates: grandRawAggregatesV,
    isSummaryCalculating: isSummaryCalculatingV,
  } = useGrandTotalCore({
    showSummary: () => props.showSummary,
    grandTotalRow: () => props.grandTotalRow,
    suppressStickyTotalRow: () => props.suppressStickyTotalRow,
    sumText: () => props.sumText || tf(t(), 'table.summary', '合计'),
    totalValueGetter: () => props.totalValueGetter,
    sourceRows: () => props.summaryData ?? props.data ?? [],
    aggColumns: () => grandAggColumnsV.value,
  })

  const showFooterSummaryV = computed(() =>
    grandPositionV.value === 'bottom' && grandStickyV.value,
  )
  const sumTextLocal = computed(() => grandLabelV.value)

  const grandLabelPropV = computed(() =>
    // <zh/> 同 default 侧：逐元素窄化，见 use-default-grand.ts 注释
    // <en/> Same as the default side: per-element narrowing, see the use-default-grand.ts note
    resolveLabelProp(summaryAllColumns.value.map(col => ({ prop: col.prop as string | undefined }))),
  )
  function makeGrandRowV(kind: 'pinnedTop' | 'topScroll' | 'bottomScroll' | 'pinnedBottom') {
    const position = kind === 'bottomScroll'
      ? 'bottom' as const
      : kind === 'topScroll' ? 'top' as const : kind
    // <zh/> 滚动行恒非粘性，固定行粘性由调用方的前置条件保证（pinnedTop/pinnedBottom 仅 sticky 时构建）
    // <en/> Scrolling rows are never sticky; pinned rows are only built when sticky (guarded by callers)
    const sticky = kind === 'pinnedTop' || kind === 'pinnedBottom'
    return buildGrandTotalRow(grandRawAggregatesV.value, {
      position,
      label: grandLabelV.value,
      sticky,
      labelProp: grandLabelPropV.value,
      rowKey: `__grandTotal__${kind}`,
    })
  }
  /**
   * <zh/> Grand pinnedTop 行——合并入 fixed-data 顶部（用户固定行之前）
   * <en/> Grand pinnedTop row — merged at the head of fixed-data (before user pinned rows)
   */
  const grandPinnedTopRowV = computed(() =>
    grandPositionV.value === 'pinnedTop' && grandStickyV.value ? makeGrandRowV('pinnedTop') : null,
  )
  /**
   * <zh/> Grand pinnedBottom 行——合并入底部固定条带末尾（用户固定行之后，footer 汇总之上/替代）
   * <en/> Grand pinnedBottom row — merged at the end of the bottom pinned strip (after user pinned rows)
   */
  const grandPinnedBottomRowV = computed(() =>
    grandPositionV.value === 'pinnedBottom' && grandStickyV.value ? makeGrandRowV('pinnedBottom') : null,
  )
  /**
   * <zh/> Grand 滚动行（top 非粘性降级 / bottom 非粘性降级 / pinned 非粘性降级）——拼入数据首/末
   * <en/> Grand scrolling rows (non-sticky degradations) — spliced at data head/tail
   */
  const grandTopScrollRowV = computed(() => {
    if (grandPositionV.value == null || grandStickyV.value)
      return null
    // <zh/> 非粘性时 top/pinnedTop 降级为数据首行
    // <en/> Non-sticky top/pinnedTop degrades to data head
    if (grandPositionV.value === 'top' || grandPositionV.value === 'pinnedTop')
      return makeGrandRowV('topScroll')
    return null
  })
  const grandBottomScrollRowV = computed(() => {
    if (grandPositionV.value == null || grandStickyV.value)
      return null
    if (grandPositionV.value === 'bottom' || grandPositionV.value === 'pinnedBottom')
      return makeGrandRowV('bottomScroll')
    return null
  })
  const dataWithAppend = computed<T[]>((prev) => {
    const gt = grandTopScrollRowV.value as unknown as T | null
    const gb = grandBottomScrollRowV.value as unknown as T | null
    if (!hasAppendSlot.value && !gt && !gb)
      return props.data
    // <zh/> 顺序：[Grand top滚动? ...数据... Grand bottom滚动? ...append?]，append 恒居末尾
    // <en/> Order: [grand top scroll? ...data... grand bottom scroll? ...append?], append always last
    const next = [...(gt ? [gt] : []), ...props.data, ...(gb ? [gb] : [])]
    if (hasAppendSlot.value)
      next.push(appendRowData as unknown as T)
    if (prev && prev.length === next.length && prev.every((item, i) => item === next[i]))
      return prev
    return next
  })
  /**
   * <zh/> Grand top 顶部条带是否展示——top 粘性时独立渲染于表头之下（横向平移同步，与 pin 条带同机制）
   * <en/> Whether the grand top strip shows — sticky top renders below the header (translate sync, same mechanism as pin strips)
   */
  const showGrandTopStripV = computed(() =>
    grandPositionV.value === 'top' && grandStickyV.value,
  )

  /**
   * <zh/> 合并后的顶部固定行——Grand pinnedTop 置于用户固定行之前（AG Grid 顺序：总计行在最外）
   * <en/> Merged top pinned rows — grand pinnedTop goes before user pinned rows (AG Grid order: totals outermost)
   */
  const mergedTopPinnedRowsV = computed<any[]>(() => {
    const gpt = grandPinnedTopRowV.value
    if (!gpt)
      return topPinnedRows.value
    return [gpt, ...topPinnedRows.value]
  })
  /**
   * <zh/> 合并后的底部固定行——Grand pinnedBottom 置于用户固定行之后
   * <en/> Merged bottom pinned rows — grand pinnedBottom goes after user pinned rows
   */
  const mergedBottomPinnedRowsV = computed<any[]>(() => {
    const gpb = grandPinnedBottomRowV.value
    if (!gpb)
      return bottomPinnedRows.value
    return [...bottomPinnedRows.value, gpb]
  })
  const stripRowHeight = computed(() => Number(props.rowHeight) || DEFAULT_ROW_HEIGHT)
  const bottomStripHeight = computed(() => mergedBottomPinnedRowsV.value.length * stripRowHeight.value)
  /**
   * <zh/> 顶部 Grand 条带高度——top 粘性时占用布局高度，ElTableV2 高度需相应扣减
   * <en/> Grand top strip height — occupies layout height when sticky top shows; ElTableV2 height is reduced accordingly
   */
  const grandTopStripHeightV = computed(() =>
    showGrandTopStripV.value ? (props.footerHeight ?? 40) : 0,
  )

  // <zh/> 固定行上限已在数据源头强制（use-row-pin 按 rowPinConfig.maxPinnedRows 截断，
  // <zh/> 超出部分移回滚动区并派发 TABLE_PIN_LIMIT_EXCEEDED），此处不再重复告警——
  // <zh/> 源头截断后本处计数恒 ≤ 上限（+ 至多 2 行 Grand 合计行），旧的软上限 watcher 会误报，已移除。
  // <en/> The pinned-row cap is enforced at the data source (use-row-pin truncates per
  // <en/> rowPinConfig.maxPinnedRows, moving extras back to the scroll area with a
  // <en/> TABLE_PIN_LIMIT_EXCEEDED event) — no duplicate warning here. Post-truncation this
  // <en/> count never exceeds the cap (plus at most 2 grand-total rows), so the legacy
  // <en/> soft-limit watcher would false-alarm and has been removed.

  /**
   * <zh/> 汇总单元格是否需要计算——footer 或顶部条带任一可见时计算（两者共享同一 Grand 聚合值）
   * <en/> Whether summary cells need computing — when either the footer or the top strip is visible (both share the same grand aggregates)
   */
  const needSummaryCellsV = computed(() =>
    showFooterSummaryV.value || showGrandTopStripV.value,
  )

  /** <zh/> 含底部条带的表尾高度（底部条带恒渲染于 footer slot 内，无分区/层级问题） | <en/> Footer height including bottom strips (always rendered inside the footer slot — no partition/level concerns) */
  const footerHeightWithPinBottom = computed(() => {
    const summaryH = showFooterSummaryV.value ? (props.footerHeight ?? 40) : 0
    // <zh/> bottomStripHeight 已含 Grand pinnedBottom 行高 | <en/> bottomStripHeight already includes the grand pinnedBottom row height
    const pinH = bottomStripHeight.value
    return summaryH + pinH
  })

  return {
    grandPositionV,
    showFooterSummaryV,
    showGrandTopStripV,
    isSummaryCalculatingV,
    grandTopStripHeightV,
    dataWithAppend,
    mergedTopPinnedRowsV,
    mergedBottomPinnedRowsV,
    bottomStripHeight,
    grandRawAggregatesV,
    needSummaryCellsV,
    summaryAllColumns,
    sumTextLocal,
    footerHeightWithPinBottom,
  }
}
