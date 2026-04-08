/**
 * <zh/> virtual 渲染器的汇总单元格域
 * <en/> Virtual-renderer summary-cell domain
 *
 * @remarks
 * <zh/> 职责单一：`useTableSummary`（默认合计/自定义 summaryMethod）→ `useV2SummaryCells`
 * <zh/> （按分区切分左/主/右汇总单元格）→ 主区汇总行显式宽度。
 * <zh/> 默认合计路径复用 Grand 原始聚合（sharedAggregates），单趟零重算；
 * <zh/> 自定义 summaryMethod 时不共享（用户函数自有数据源）。
 * <en/> Single responsibility: `useTableSummary` (default totals / custom summaryMethod) →
 * <en/> `useV2SummaryCells` (split left/main/right summary cells by partition) → explicit main-area
 * <en/> summary width. The default path reuses the grand raw aggregates (sharedAggregates) for a
 * <en/> single-pass, zero-recompute result; a custom summaryMethod opts out of the sharing.
 */
import type { ComputedRef, Ref } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { V2RendererProps } from './v2-renderer-props'
import { computed } from 'vue'
import { useTableSummary } from '../../composables/features/use-table-summary'
import { useV2SummaryCells } from './use-v2-summary-cells'

/** <zh/> 汇总单元格域依赖 | <en/> Summary-cell domain deps */
export interface UseV2SummaryDeps<T = any> {
  /** <zh/> 渲染器 props | <en/> renderer props */
  props: V2RendererProps<T>
  /** <zh/> 参与汇总的列（selection + normal） | <en/> columns participating in the summary (selection + normal) */
  summaryAllColumns: ComputedRef<any[]>
  /** <zh/> 合计标签 | <en/> total label */
  sumTextLocal: ComputedRef<string>
  /** <zh/> 是否需要计算汇总单元格 | <en/> whether summary cells need computing */
  needSummaryCellsV: ComputedRef<boolean>
  /** <zh/> Grand 原始聚合 | <en/> grand raw aggregates */
  grandRawAggregatesV: Ref<Record<string, unknown>> | ComputedRef<Record<string, unknown>>
  /** <zh/> V2 列 → 原始列映射 | <en/> V2 column → original column map */
  v2KeyToOriginalCol: ComputedRef<Map<string, any>>
  /** <zh/> selection V2 列 | <en/> selection V2 columns */
  selectionV2Columns: ComputedRef<any[]>
  /** <zh/> 非固定 V2 列 | <en/> non-fixed V2 columns */
  normalV2Columns: ComputedRef<any[]>
  /** <zh/> 固定 V2 列 | <en/> fixed V2 columns */
  fixedV2Columns: ComputedRef<any[]>
  /** <zh/> 是否需要固定宽度布局 | <en/> whether the fixed-width layout is required */
  needsFixedWidth: ComputedRef<boolean>
  /** <zh/> 列宽解析器 | <en/> column width resolver */
  getColumnWidth: (col: LocalColumn) => number
  /** <zh/> 国际化函数 | <en/> locale function */
  t: () => ((path: string) => string) | undefined
}

/**
 * <zh/> 创建汇总单元格域
 * <en/> Create the summary-cell domain
 */
export function useV2Summary<T = any>(deps: UseV2SummaryDeps<T>) {
  const {
    props,
    summaryAllColumns,
    sumTextLocal,
    needSummaryCellsV,
    grandRawAggregatesV,
    v2KeyToOriginalCol,
    selectionV2Columns,
    normalV2Columns,
    fixedV2Columns,
    needsFixedWidth,
    getColumnWidth,
    t,
  } = deps

  const { getSummaryValue } = useTableSummary({
    data: computed(() => (props.summaryData ?? props.data) as T[]),
    columns: summaryAllColumns,
    showSummary: needSummaryCellsV,
    sumText: sumTextLocal,
    summaryMethod: props.summaryMethod,
    t: t(),
    // <zh/> 默认合计直接格式化复用 Grand 原始聚合（单趟零重算；合成行过滤口径同步为叶子行）。
    // <zh/> 自定义 summaryMethod 时忽略本共享（用户函数自有数据源）。
    // <en/> the default footer formats the shared grand raw aggregates
    // <en/> (single-pass, zero recompute; synthetic-row filtering unifies on leaf rows).
    // <en/> Ignored when a custom summaryMethod is present.
    sharedAggregates: computed(() => (props.summaryMethod ? undefined : grandRawAggregatesV.value)),
  })

  const { leftSummaryCells, mainSummaryCells, rightSummaryCells } = useV2SummaryCells({
    v2KeyToOriginalCol,
    getSummaryValue,
    selectionV2Columns,
    normalV2Columns,
    fixedV2Columns,
    needsFixedWidth,
    // <zh/> 汇总宽必须与其被对齐的两侧（表头 leafWidths / 表体 V2 列宽）同源；
    // <zh/> V2 列宽恒为数值，此处兜底仅防御未产出宽度的列工厂。
    // <en/> The summary width must share the source of the two rows it aligns to (header leafWidths /
    // <en/> body V2 column widths); V2 widths are always numeric, this resolver is a defensive fallback
    // <en/> for factories that emit no width.
    resolveColumnWidth: col => getColumnWidth(col),
  })

  /**
   * <zh/> 主区域汇总行显式宽度——needsFixedWidth=true（列总宽>容器或存在固定列/多级表头）时
   * <zh/> 取 mainSummaryCells 宽度之和，避免外层 width:100% 限宽导致的单元格压缩与表体失配；
   * <zh/> 否则交由 CSS max-content/min-width 处理（autoSize 场景依赖 flex 分配）。
   * <en/> Main-area summary explicit width — when needsFixedWidth=true (total columns width > container
   * <en/> or fixed columns / multi-level header exist), sum mainSummaryCells widths to avoid the outer
   * <en/> width:100% clamping that compresses cells and misaligns with the body; otherwise leave to CSS
   * <en/> max-content/min-width (autoSize relies on flex distribution).
   */
  const summaryMainWidth = computed<number | undefined>(() => {
    if (!needsFixedWidth.value)
      return undefined
    let total = 0
    for (const cell of mainSummaryCells.value) {
      const w = (cell.style as Record<string, any>).width
      if (typeof w === 'number') {
        total += w
      }
      else if (typeof w === 'string') {
        const n = Number.parseInt(w, 10)
        if (Number.isNaN(n))
          return undefined
        total += n
      }
      else {
        return undefined
      }
    }
    return total > 0 ? total : undefined
  })

  return {
    getSummaryValue,
    leftSummaryCells,
    mainSummaryCells,
    rightSummaryCells,
    summaryMainWidth,
  }
}
