/**
 * <zh/> 生效预估行高纯决议（常驻动态行高）——决定 ElTableV2 是否启用动态行高测量。
 * <zh/> 规则（与 table-virtual-renderer.vue 渲染口径一致）：
 * <zh/> - 用户显式设置 estimatedRowHeight 时直接采用；
 * <zh/> - span 表恒走惰性路径（EP 动态网格裁切 rowspan），仅 append 插槽或实际展开的详情行强制进入；
 * <zh/> - 非 span 表能力就绪即常驻动态（append 插槽 / 展开能力 / 实际展开详情行任一），
 * <zh/>   展开/折叠只改变行内容，不再触发 fixed↔dynamic 网格翻转（翻转 = 整表重挂载 + 滚动跳动）；
 * <zh/> - 纯展示表（无 append、无展开能力、无详情行）保持固定行高，零测量开销。
 * <en/> Effective estimated-row-height resolver (resident dynamic grid) — decides
 * <en/> whether ElTableV2 enables dynamic row-height measurement. Rules (matching the
 * <en/> table-virtual-renderer.vue render caliber): explicit estimatedRowHeight wins; span tables stay
 * <en/> lazy except for append slots / actually-expanded detail rows; non-span tables stay resident
 * <en/> dynamic once variable heights are possible; pure display tables stay fixed.
 */
export interface EstimatedRowHeightInput {
  /** <zh/> 用户显式设置 | <en/> User-explicit value */
  estimatedRowHeight?: number | null
  /** <zh/> 合并单元格开关 | <en/> Span-enabled flag */
  spanEnabled?: boolean
  /** <zh/> append 插槽是否存在 | <en/> Whether the append slot exists */
  hasAppendSlot?: boolean
  /** <zh/> 是否具备展开能力（配置了展开行，与实际展开区分） | <en/> Whether expansion is configured */
  expandCapable?: boolean
  /** <zh/> 是否存在实际展开的详情行 | <en/> Whether any detail row is actually expanded */
  hasExpandDetailRows?: boolean
  /** <zh/> 行高（动态网格的测量回退值） | <en/> Row height (dynamic-grid measurement fallback) */
  rowHeight?: number
}

/**
 * <zh/> 纯 `px` 高度正则（只接受 px，vh/%/calc 交由 AutoResizer 实测）
 * <en/> Pure-`px` height regex (only px accepted; vh/%/calc are measured live by the AutoResizer)
 */
const PURE_PX_RE = /^(\d+(?:\.\d+)?)px$/i

/**
 * <zh/> 解析显式 px 高度——正数直接采用，纯 `px` 字符串解析数值；相对单位（vh/%/calc）与缺省返回 undefined，
 * <zh/> 调用方回退 AutoResizer 实测（与 default 模式 ElTable 直传语义对齐：显式值优先，相对值实测）。
 * <en/> Parse an explicit px height — positive numbers pass through, pure-`px` strings parse to numbers;
 * <en/> relative units (vh/%/calc) and missing values yield undefined so callers fall back to AutoResizer
 * <en/> measurement (aligned with default-mode ElTable passthrough: explicit wins, relative is measured).
 *
 * @param height - <zh/> 用户传入的 height（已归一化，非法值不会到此） | <en/> user-supplied height (normalized; illegal values never reach here)
 * @returns <zh/> 显式 px 高度，否则 undefined | <en/> explicit px height, otherwise undefined
 */
export function parseExplicitHeightPx(height: unknown): number | undefined {
  if (typeof height === 'number' && height > 0)
    return height
  if (typeof height === 'string') {
    const pxMatch = PURE_PX_RE.exec(height.trim())
    if (pxMatch) {
      const n = Number.parseFloat(pxMatch[1]!)
      if (n > 0)
        return n
    }
  }
  return undefined
}

/**
 * <zh/> 决议生效预估行高——返回 number 进入动态网格，undefined 保持固定行高。
 * <en/> Resolve the effective estimated row height — a number enters the dynamic grid,
 * <en/> undefined keeps fixed row heights.
 */
export function resolveEffectiveEstimatedRowHeight(input: EstimatedRowHeightInput): number | undefined {
  if (input.estimatedRowHeight != null)
    return input.estimatedRowHeight
  const rowHeight = input.rowHeight ?? 48
  if (input.spanEnabled) {
    if (input.hasAppendSlot || input.hasExpandDetailRows)
      return rowHeight
    return undefined
  }
  if (input.hasAppendSlot || input.expandCapable || input.hasExpandDetailRows)
    return rowHeight
  return undefined
}
