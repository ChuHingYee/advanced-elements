import type { TableProps } from 'element-plus'
import type { ComputedRef, VNode } from 'vue'
import type { RowPinApi } from '../../types/config-tree'
import type { DefaultRendererProps } from '../../types/renderer'
import { computed } from 'vue'
import { useGrandTotalCore } from '../../composables/features/use-grand-total-core'
import { DEFAULT_ROW_HEIGHT } from '../../constants'
import { tf } from '../../utils/locale-fallback'
import { resolveColumnProp } from '../../utils/shared'
import { buildDefaultSummaryRow } from '../../utils/summary-defaults'
import {
  buildGrandTotalRow,
  isGrandTotalRow,
  isGroupTotalRow,
  resolveLabelProp,
} from '../../utils/total-rows'

/**
 * Default-mode grand-total and row-pinning display domain, pure code motion from
 * table-renderer.vue
 * default 模式 Grand 合计与行固定显示域,纯搬移自 table-renderer.vue,零行为变更.
 */
export interface UseDefaultGrandOptions {
  props: DefaultRendererProps
  rowPinApi: RowPinApi | undefined
}

export interface UseDefaultGrandReturn {
  grandPosition: ComputedRef<unknown>
  grandSticky: ComputedRef<unknown>
  grandLabel: ComputedRef<string>
  showFooterSummary: ComputedRef<boolean>
  // <zh/> EP 公开类型直引——`TableProps<any>['summaryMethod']`，模板绑定不再需要 as any
  // <en/> EP public type, referenced directly — `TableProps<any>['summaryMethod']`, no as-any at the template binding
  wrappedSummaryMethod: ComputedRef<TableProps<any>['summaryMethod'] | undefined>
  pinEnabled: ComputedRef<boolean>
  topPinnedRowsC: ComputedRef<any[]>
  bottomPinnedRowsC: ComputedRef<any[]>
  pinnedDisplayData: ComputedRef<any[]>
  pinTopCount: ComputedRef<number>
  resolvePinnedRowStyle: (params: { row: any, rowIndex: number }) => Record<string, string | number>
}

/**
 * <zh/> default 模式 Grand 合计与行固定显示域 composable
 * <en/> Default-mode grand-total and row-pinning display domain composable — pure code motion from
 * <en/> table-renderer.vue
 *
 * @param options - <zh/> 含组件 props 与行固定 API 的选项对象 | <en/> options object containing component props and the row-pin API
 * @returns <zh/> Grand 合计位置/标签、包装后的 summaryMethod 与行固定显示派生值 | <en/> grand total position/label, wrapped summary method and row-pinning display derived values
 */
export function useDefaultGrand(options: UseDefaultGrandOptions): UseDefaultGrandReturn {
  const { props, rowPinApi } = options

  //  Grand Total 合成行（default 模式）— 对齐 AG Grid grandTotalRow
  //  Grand total synthetic rows (default mode)
  /**
   * Grand 聚合列描述——取 leafColumns 的 prop + aggFunc（选择列无 prop 自动跳过）.
   * Grand aggregate column descriptors.
   */
  const grandAggColumns = computed(() =>
    props.leafColumns.map(col => ({
      prop: resolveColumnProp(col),
      aggFunc: col.aggFunc,
    })),
  )
  /**
   * Grand 位置/标签/聚合——经双侧共享内核（useGrandTotalCore）决议，口径与 virtual 模式同源。
   * 聚合列归一保留本侧口径（resolveColumnProp，认 `property` 别名），sumText 回退保留 `||` 算子。
   * **声明序约束**：必须排在 `grandAggColumns` 之后——内核的 deferred 聚合在装配时
   * 即时求值列定义（`watch(..., { immediate: true })`），前向引用会抛 TDZ。
   * 同时所有派生（footer 展示/summaryMethod/合成行）必须排在其后，保持单一向下数据流。
   * Grand position/label/aggregation — resolved via the shared cross-mode core
   * (useGrandTotalCore), same caliber as virtual mode. Column normalization keeps this
   * side's caliber (resolveColumnProp, accepting the `property` alias); the sumText
   * fallback keeps the `||` operator.
   * **Declaration-order constraint**: must come after `grandAggColumns` — the core's
   * deferred aggregation evaluates the columns eagerly at setup
   * (`watch(..., { immediate: true })`), so a forward reference throws a TDZ error.
   * All derivations (footer visibility/summaryMethod/synthetic rows) must likewise come
   * after it, keeping a single downward data flow.
   */
  const {
    grandPosition,
    grandSticky,
    grandLabel,
    grandAggregates: grandRawAggregates,
  } = useGrandTotalCore({
    showSummary: () => props.showSummary,
    grandTotalRow: () => props.grandTotalRow,
    suppressStickyTotalRow: () => props.suppressStickyTotalRow,
    sumText: () => props.sumText || tf(props.t, 'table.summary', '合计'),
    totalValueGetter: () => props.totalValueGetter,
    sourceRows: () => props.summaryData ?? props.data ?? [],
    aggColumns: () => grandAggColumns.value,
  })

  /**
   * footer 是否展示——仅 Grand bottom 粘性时走 ElTable 原生表尾；
   * bottom 非粘性降级为滚动数据末行（与 AG Grid suppressStickyTotalRow 一致），其余位置均不占用 footer.
   * Whether the footer shows — only sticky grand-bottom uses the native footer.
   */
  const showFooterSummary = computed(() =>
    grandPosition.value === 'bottom' && grandSticky.value,
  )
  /**
   * 包装 summaryMethod——统一汇总口径为"分页前全量数据"：
   * ① 用户提供 summaryMethod 时，将 summaryData（全量）作为 data 参数传入，而非仅当前页；
   * ② 用户未提供 summaryMethod 时，不再回退到 ElTable 内建合计（其只能计算绑定 data=当前页），
   *    改用与 virtual 模式共享的默认合计算法对全量数据求和（utils/summary-defaults 单一真相，
   *    含列 aggFunc：sum/avg/min/max/count/first/last/自定义）。
   * 约束：无自定义 method 时 default/virtual 模式必须统一口径，禁止 default 算当前页、virtual 算全量的口径分裂。
   * AG Grid 对齐：footer 标签经 totalValueGetter 决议（Grand Total），默认回退 sumText。
   *
   * Wrap summaryMethod — unify the aggregation caliber to "full data before pagination" (see source for details).
   * Constraint: without a custom method, default/virtual modes must share one caliber.
   */
  const wrappedSummaryMethod = computed(() => {
    if (!showFooterSummary.value)
      return undefined
    if (props.summaryMethod) {
      // <zh/> 经 any[] 形参桥接——EP 的 TableColumnCtx[] 可传入 any[]，无需断言；用户函数返回体已是 (string|VNode)[]
      // <en/> Bridged via any[] params — EP's TableColumnCtx[] flows into any[] with no assertion; user functions already return (string|VNode)[]
      const userMethod = props.summaryMethod
      if (!props.summaryData) {
        return (params: { columns: any[], data: any[] }): (string | VNode)[] =>
          userMethod({ columns: params.columns, data: params.data })
      }
      return (params: { columns: any[], data: any[] }): (string | VNode)[] =>
        userMethod({ columns: params.columns, data: props.summaryData! })
    }
    if (!props.summaryData)
      return undefined
    return (params: { columns: any[], data: any[] }): (string | VNode)[] =>
      buildDefaultSummaryRow(
        params.columns.map((col: any) => ({
          // <zh/> 数据字段域：合计按 prop 键控，统一走 resolveColumnProp
          // <en/> Data-field domain: summaries keyed by prop, unified via resolveColumnProp
          prop: resolveColumnProp(col),
          aggFunc: col.aggFunc,
        })),
        props.summaryData!,
        grandLabel.value,
      )
  })

  //  行固定（Row Pinning）— default 模式 sticky 行实现
  //  Row pinning — default-mode sticky-row implementation

  /**
   * 组合显示数据：[顶部固定行 ... 可滚动行 ... 底部固定行]。
   * 作为单一数组交给 ElTable，保证 DOM 行序与数组索引一致。未启用时零开销透传。
   * Composed display data: [top pinned ... scrollable ... bottom pinned], one array for ElTable.
   */
  const pinEnabled = computed(() => rowPinApi?.pinEnabled.value ?? false)
  const topPinnedRowsC = computed<any[]>(() => (pinEnabled.value ? rowPinApi!.topPinnedRows.value : []))
  const bottomPinnedRowsC = computed<any[]>(() => (pinEnabled.value ? rowPinApi!.bottomPinnedRows.value : []))

  //  Grand Total 合成行（default 模式）— 对齐 AG Grid grandTotalRow
  //  Grand total synthetic rows (default mode)
  const grandLabelProp = computed(() =>
    // <zh/> ProcessedColumn['prop'] 在 T=any 下求值为 any，整数组直传会触发弱类型检查；
    // <zh/> 此处逐元素窄化为 string|undefined（标签仅认字符串），不断言整个数组
    // <en/> ProcessedColumn['prop'] evaluates to any under T=any, tripping the weak-type check on
    // <en/> direct array passing; narrow per element to string|undefined (labels only take strings)
    resolveLabelProp(props.leafColumns.map(col => ({ prop: col.prop as string | undefined }))),
  )
  function makeGrandRow(kind: 'pinnedTop' | 'top' | 'bottomScroll' | 'pinnedBottom') {
    const position = kind === 'bottomScroll'
      ? 'bottom' as const
      : kind === 'top' ? 'top' as const : kind
    return buildGrandTotalRow(grandRawAggregates.value, {
      position,
      label: grandLabel.value,
      sticky: kind === 'bottomScroll' ? false : grandSticky.value,
      labelProp: grandLabelProp.value,
      rowKey: `__grandTotal__${kind}`,
    })
  }
  const grandPinnedTopRow = computed(() =>
    grandPosition.value === 'pinnedTop' && grandSticky.value && grandPosition.value != null ? makeGrandRow('pinnedTop') : null,
  )
  const grandTopRow = computed(() => {
    if (grandPosition.value == null)
      return null
    if (grandPosition.value === 'top')
      return makeGrandRow('top')
    // pinnedTop 非粘性降级为滚动首行 | Non-sticky pinnedTop degrades to a scrolling first row
    if (grandPosition.value === 'pinnedTop' && !grandSticky.value)
      return { ...makeGrandRow('top'), __sticky: false }
    return null
  })
  const grandBottomScrollRow = computed(() => {
    if (grandPosition.value == null)
      return null
    if (grandPosition.value === 'bottom' && !grandSticky.value)
      return makeGrandRow('bottomScroll')
    // pinnedBottom 非粘性降级为滚动末行 | Non-sticky pinnedBottom degrades to a scrolling last row
    if (grandPosition.value === 'pinnedBottom' && !grandSticky.value)
      return { ...makeGrandRow('bottomScroll'), __sticky: false }
    return null
  })
  const grandPinnedBottomRow = computed(() =>
    grandPosition.value === 'pinnedBottom' && grandSticky.value ? makeGrandRow('pinnedBottom') : null,
  )

  /**
   * 组合显示数据：[Grand pinnedTop? ... 顶部固定行 ... Grand top? ... 可滚动行（含分组小计）... Grand bottom滚动? ... 底部固定行 ... Grand pinnedBottom?]。
   * 作为单一数组交给 ElTable，保证 DOM 行序与数组索引一致。无 Grand 行时零开销透传。
   * Composed display data with grand rows interleaved, one array for ElTable.
   */
  const pinnedDisplayData = computed<any[]>(() => {
    const topPinned = pinEnabled.value ? topPinnedRowsC.value : []
    const bottomPinned = pinEnabled.value ? bottomPinnedRowsC.value : []
    const gpt = grandPinnedTopRow.value
    const gt = grandTopRow.value
    const gbs = grandBottomScrollRow.value
    const gpb = grandPinnedBottomRow.value
    if (!gpt && !gt && !gbs && !gpb) {
      if (!pinEnabled.value)
        return props.data
      return [...topPinned, ...props.data, ...bottomPinned]
    }
    return [
      ...(gpt ? [gpt] : []),
      ...topPinned,
      ...(gt ? [gt] : []),
      ...props.data,
      ...(gbs ? [gbs] : []),
      ...bottomPinned,
      ...(gpb ? [gpb] : []),
    ]
  })
  const pinTopCount = computed(() => topPinnedRowsC.value.length + (grandPinnedTopRow.value ? 1 : 0))

  /**
   * 固定行/合计行内联样式——tr 级 position:sticky + 按行索引累加偏移，实现多行堆叠固定。
   * 行高取 rowHeight prop（缺省 48）；内容换行导致实际更高时可能轻微重叠，属 v1 已知限制。
   * Chromium/Firefox 支持 tr sticky；Safari 不支持时优雅降级为普通行。
   *
   * Pinned/total-row inline styles — tr-level position:sticky with per-index cumulative offsets.
   * @remarks 命名与 virtual 模式 PinStripRow 对称：virtual 用组件 PinStripRow，default 用函数 resolvePinnedRowStyle.
   */
  const PINNED_BG = 'var(--el-table-tr-bg-color, var(--el-bg-color, #fff))'
  function resolvePinnedRowStyle({ row, rowIndex }: { row: any, rowIndex: number }): Record<string, string | number> {
    // 合计行优先判定（不依赖 pinEnabled）| Total rows first (independent of pinEnabled)
    if (isGrandTotalRow(row) || isGroupTotalRow(row)) {
      if (!row.__sticky)
        return {}
      const rowHeight = Number(props.rowHeight) || DEFAULT_ROW_HEIGHT
      // Grand 顶部系（pinnedTop/top）参与顺序堆叠，与用户固定行同层.
      // Grand top family (pinnedTop/top) joins the sequential stack.
      if (isGrandTotalRow(row) && (row.__grandPosition === 'pinnedTop' || row.__grandPosition === 'top')) {
        return {
          'position': 'sticky',
          'top': `${rowIndex * rowHeight}px`,
          'z-index': 3,
          'background': PINNED_BG,
        }
      }
      // Grand pinnedBottom 参与底部顺序堆叠 | Grand pinnedBottom joins the bottom sequential stack
      if (isGrandTotalRow(row) && row.__grandPosition === 'pinnedBottom') {
        const totalLen = pinnedDisplayData.value.length
        return {
          'position': 'sticky',
          'bottom': `${(totalLen - rowIndex - 1) * rowHeight}px`,
          'z-index': 3,
          'background': PINNED_BG,
        }
      }
      // 分组小计：top 吸顶 / bottom 吸底，层级低于固定行.
      // Group totals: top docks top / bottom docks bottom, below pinned rows.
      if (isGroupTotalRow(row)) {
        if (row.__groupTotalPosition === 'top') {
          return {
            'position': 'sticky',
            'top': '0px',
            'z-index': 2,
            'background': PINNED_BG,
          }
        }
        return {
          'position': 'sticky',
          'bottom': '0px',
          'z-index': 2,
          'background': PINNED_BG,
        }
      }
      return {}
    }
    if (!pinEnabled.value)
      return {}
    const topCount = pinTopCount.value
    const bottomStickyCount = bottomPinnedRowsC.value.length + (grandPinnedBottomRow.value ? 1 : 0)
    const totalLen = pinnedDisplayData.value.length
    const isTop = rowIndex < topCount
    const isBottom = !isTop && rowIndex >= totalLen - bottomStickyCount
    if (!isTop && !isBottom)
      return {}
    const rowHeight = Number(props.rowHeight) || DEFAULT_ROW_HEIGHT
    if (isTop) {
      return {
        'position': 'sticky',
        'top': `${rowIndex * rowHeight}px`,
        'z-index': 3,
        'background': 'var(--el-table-tr-bg-color, var(--el-bg-color, #fff))',
      }
    }
    // 底部偏移按距数组末尾距离计算，天然包含 Grand pinnedBottom 的占位.
    // Bottom offset from the array end, naturally accounting for the grand pinnedBottom slot.
    return {
      'position': 'sticky',
      'bottom': `${(totalLen - rowIndex - 1) * rowHeight}px`,
      'z-index': 3,
      'background': 'var(--el-table-tr-bg-color, var(--el-bg-color, #fff))',
    }
  }

  return {
    grandPosition,
    grandSticky,
    grandLabel,
    showFooterSummary,
    wrappedSummaryMethod,
    pinEnabled,
    topPinnedRowsC,
    bottomPinnedRowsC,
    pinnedDisplayData,
    pinTopCount,
    resolvePinnedRowStyle,
  }
}
