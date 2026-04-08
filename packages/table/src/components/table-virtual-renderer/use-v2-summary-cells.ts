/**
 * <zh/> V2 汇总单元格 composable
 * <en/> V2 summary cells composable
 *
 * @remarks
 * <zh/> 职责单一：根据 V2 列配置和汇总数据，构建左/中/右三区域的汇总单元格数据。
 * <zh/> 通过 v2KeyToOriginalCol 映射保证 V2 列 key 与原始列 key 的一致性。
 * <zh/> 对齐策略（纯 CSS）：表体格与汇总格是两个内容相同的 flex 行，只要汇总格使用
 * <zh/> 与表头 v2-header 相同的 flex 模式（needsFixedWidth 决定 '0 0 auto' 或 '0 1 auto'），
 * <zh/> 浏览器 flexbox 会给出与表体逐像素一致的列宽——无需 JS 量宽、ResizeObserver 或任何同步逻辑。
 * <en/> Single responsibility: builds summary cell data for left/main/right regions based on V2 column config and summary data.
 * <en/> Uses v2KeyToOriginalCol mapping to ensure V2 column key consistency with original columns.
 * <en/> Alignment strategy (pure CSS): the body row and the summary row are two flex rows with
 * <en/> identical items; applying the same flex mode as the v2-header (decided by needsFixedWidth:
 * <en/> '0 0 auto' or '0 1 auto') makes the browser produce pixel-identical column widths
 * <en/> no JS measuring, ResizeObserver, or any sync logic.
 */
import type { ComputedRef, CSSProperties, VNode } from 'vue'
import { computed } from 'vue'
import { DEFAULT_COLUMN_WIDTH } from '../../utils/column-tree'
import { getColumnKey } from '../../utils/shared'

export interface SummaryCellItem {
  key: string
  value: string | VNode | undefined
  style: CSSProperties
}

export interface UseV2SummaryCellsDeps {
  /** <zh/> V2 key → 原始列映射 | <en/> V2 key → original column mapping */
  v2KeyToOriginalCol: ComputedRef<Map<string, any>>
  /** <zh/> 获取列的汇总值 | <en/> Get summary value for a column */
  getSummaryValue: (col: any) => string | VNode | undefined
  /** <zh/> 选择列（V2 格式） | <en/> Selection columns (V2 format) */
  selectionV2Columns: ComputedRef<any[]>
  /** <zh/> 普通列（V2 格式） | <en/> Normal columns (V2 format) */
  normalV2Columns: ComputedRef<any[]>
  /** <zh/> 固定列（V2 格式） | <en/> Fixed columns (V2 format) */
  fixedV2Columns: ComputedRef<any[]>
  /**
   * <zh/> 是否使用固定宽度模式——与表头 v2-header 的 needsFixedWidth 保持一致，
   * <zh/> 影响汇总格的 flex 属性（true 时 '0 0 auto'，false 时 '0 1 auto'）。
   * <en/> Whether fixed-width mode is used — must match the header's needsFixedWidth,
   * <en/> controls the summary cell's flex ('0 0 auto' when true, '0 1 auto' when false).
   */
  needsFixedWidth?: ComputedRef<boolean>
  /**
   * <zh/> 按原始列解析数值宽度——V2 列自身宽度缺失时的兜底，与表头 leafWidths / 表体 V2 列同源。
   * <zh/> 调用方通常传 getColumnWidth（拖拽宽 → 列宽 → 默认宽）。缺省取原始列 width/minWidth。
   * <en/> Fallback numeric width resolver used when the V2 column itself carries no width — shares the
   * <en/> same source as the header leafWidths and the body V2 columns. Callers usually pass
   * <en/> getColumnWidth (drag width → column width → default). Defaults to the original width/minWidth.
   */
  resolveColumnWidth?: (originalCol: any) => number | undefined
}

/**
 * <zh/> 构建 V2 汇总单元格数据
 * <en/> Build V2 summary cell data
 *
 * @param deps - <zh/> 依赖项 | <en/> Dependencies
 * @returns <zh/> 各区域汇总单元格 computed 与样式构建器 | <en/> computed summary cells per region and the style builder
 */
export function useV2SummaryCells(deps: UseV2SummaryCellsDeps) {
  const {
    v2KeyToOriginalCol,
    getSummaryValue,
    selectionV2Columns,
    normalV2Columns,
    fixedV2Columns,
    needsFixedWidth = computed(() => false) as ComputedRef<boolean>,
    resolveColumnWidth,
  } = deps

  /** <zh/> 通过 V2 key → 原始列映射查找 summary 值，保证 key 一致性 | <en/> Look up summary value via V2 key → original column mapping, ensuring key consistency */
  function getV2SummaryValue(v2Col: Record<string, any>): string | VNode | undefined {
    const originalCol = v2KeyToOriginalCol.value.get(getColumnKey(v2Col))
    return originalCol ? getSummaryValue(originalCol) : undefined
  }

  /**
   * <zh/> 生成与表头/表体列宽逐像素对齐的汇总格样式——必须与 EP `calcColumnStyle` 逐项等价，
   * <zh/> 只要「同一列的样式」与「所在 flex 行容器的宽度」两侧相同，浏览器布局结果必然相同。
   * <zh/> 1. 先展开用户列级 style（与 EP 相同，flex/width 随后覆盖用户值）；
   * <zh/> 2. flex 跟随表格自适应配置：props.fixed（needsFixedWidth）为 true 时强制 0/0，
   * <zh/>    否则透传列自身 flex（autoSize 列 flexGrow=1 参与等比拉伸），缺省 0/1；
   * <zh/> 3. width 取对应列宽：V2 列宽优先；V2 宽缺失时（理论上不应发生——V2 列工厂恒产出数值宽，
   * <zh/>    见 normal-v2-column.computeColumnWidth）用 resolveColumnWidth 按原始列同源解析，
   * <zh/>    绝不留空——空宽会把该格交给内容撑开（汇总值宽度），与表头标题宽度不一致而整行错位；
   * <zh/> 4. maxWidth/minWidth 条件透传；textAlign 跟随列 align（缺省 left，与表体一致）。
   * <zh/> 数值型属性交给 Vue 的 style 绑定自动补 px，与 EP 行为一致。
   * <en/> Build a summary cell style pixel-aligned with the header/body column widths — it must be
   * <en/> item-by-item equivalent to EP's `calcColumnStyle`: when both the per-column style and the
   * <en/> width of the enclosing flex row container match, the browser layout is necessarily identical.
   * <en/> 1. spread the user's per-column style first (same as EP; flex/width then override it);
   * <en/> 2. flex follows the adaptive config: forced 0/0 when props.fixed (needsFixedWidth) is true,
   * <en/>    otherwise the column's own flex (autoSize columns with flexGrow=1 stretch), default 0/1;
   * <en/> 3. width comes from the corresponding column: the V2 width first; when missing (should not
   * <en/>    happen — V2 column factories always emit numeric widths, see
   * <en/>    normal-v2-column.computeColumnWidth) resolve it from the original column via
   * <en/>    resolveColumnWidth. Never leave it empty: an empty width sizes the cell by its content
   * <en/>    (the summary value) rather than the header title, misaligning the whole row;
   * <en/> 4. maxWidth/minWidth passed through conditionally; textAlign follows column align (default left).
   * <en/> Numeric values rely on Vue's style binding to append px, same as EP's behavior.
   */
  function calcSummaryCellStyle(col: Record<string, any>): CSSProperties {
    const fixed = needsFixedWidth.value
    let rawWidth: number | string | undefined = col.width
    if (rawWidth == null) {
      const original = v2KeyToOriginalCol.value.get(getColumnKey(col))
      rawWidth = resolveColumnWidth?.(original)
        ?? original?.width
        ?? original?.minWidth
        ?? DEFAULT_COLUMN_WIDTH
    }
    // <zh/> 修复：数值宽度必须显式补 px（Vue :style 对数值不会自动补单位，导致 `width: 150` 被浏览器忽略）
    // <en/> Fix: numeric widths must be explicit px (Vue :style does not auto-append units, so `width: 150` is ignored by the browser)
    const width = typeof rawWidth === 'number' ? `${rawWidth}px` : rawWidth
    const toCssSize = (v: unknown): string | undefined => {
      if (v == null)
        return undefined
      return typeof v === 'number' ? `${v}px` : String(v)
    }
    const style: Record<string, any> = {
      ...(col.style ?? {}),
      flexGrow: fixed ? 0 : (col.flexGrow ?? 0),
      flexShrink: fixed ? 0 : (col.flexShrink ?? 1),
      flexBasis: 'auto',
      width,
    }
    if (!fixed) {
      const maxW = toCssSize(col.maxWidth)
      const minW = toCssSize(col.minWidth)
      if (maxW != null)
        style.maxWidth = maxW
      if (minW != null)
        style.minWidth = minW
    }
    style.textAlign = col.align ?? 'left'
    return style
  }

  /** <zh/> 生成 summary 单元格 | <en/> Build summary cells */
  function buildSummaryCells(cols: any[]): SummaryCellItem[] {
    return cols.map(col => ({
      key: getColumnKey(col),
      value: getV2SummaryValue(col),
      style: calcSummaryCellStyle(col),
    }))
  }

  const leftFixedV2Columns = computed(() =>
    fixedV2Columns.value.filter(col => col.fixed !== 'right'),
  )
  const rightFixedV2Columns = computed(() =>
    fixedV2Columns.value.filter(col => col.fixed === 'right'),
  )

  /** <zh/> 左固定区域 summary（仅当有 left-fixed 列时渲染） | <en/> Left-fixed area summary (rendered only when left-fixed columns exist) */
  const leftSummaryCells = computed<SummaryCellItem[]>(() =>
    buildSummaryCells(leftFixedV2Columns.value),
  )

  /** <zh/> 主区域 summary：selection 列 + normal 列（无 fixed 属性） | <en/> Main area summary: selection columns + normal columns (no fixed attribute) */
  const mainSummaryCells = computed<SummaryCellItem[]>(() =>
    buildSummaryCells([...selectionV2Columns.value, ...normalV2Columns.value]),
  )

  /** <zh/> 右固定区域 summary（仅当有 right-fixed 列时渲染） | <en/> Right-fixed area summary (rendered only when right-fixed columns exist) */
  const rightSummaryCells = computed<SummaryCellItem[]>(() =>
    buildSummaryCells(rightFixedV2Columns.value),
  )

  return {
    calcSummaryCellStyle,
    buildSummaryCells,
    getV2SummaryValue,
    leftFixedV2Columns,
    rightFixedV2Columns,
    leftSummaryCells,
    mainSummaryCells,
    rightSummaryCells,
  }
}
