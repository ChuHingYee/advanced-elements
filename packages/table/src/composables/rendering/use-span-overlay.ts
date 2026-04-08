/**
 * <zh/> 合并单元格 × 动态行高 覆盖层（RFC 占位）
 * <en/> Span × dynamic row height overlay (RFC placeholder)
 *
 * @remarks
 * <zh/> 背景：virtual 模式 `spanEnabled && effectiveEstimatedRowHeight!=null`（append/expand 触发 DynamicSizeGrid）时
 * <zh/> `EP .is-dynamic .el-table-v2__row { overflow: hidden }` 会裁切 `rowspan>1` 的 origin 格
 * <zh/> 当前仅 `table-virtual-renderer.vue:548` `dev` 警告，短期不保证视觉正确
 * <zh/> 长期方案（另行 RFC）：origin 格用 `position: absolute` 覆盖层脱离 Grid 行盒，`height = rowspan * rowHeight` 直设
 * <zh/> 不依赖 `getBoundingClientRect` 测量，避免 `Fixed→Dynamic` 网格切换与 `gridInstanceKey` 重挂载抖动
 * <zh/> 本文件为占位，导出 `useSpanOverlay` 空实现以便 `useVirtualSpan` 后续接入
 *
 * <en/> Background: virtual `spanEnabled && effectiveEstimatedRowHeight!=null` (append/expand → DynamicSizeGrid)
 * <en/> `EP .is-dynamic .el-table-v2__row { overflow:hidden }` clips `rowspan>1` origin cells
 * <en/> Currently only `table-virtual-renderer.vue:548` dev warn, short-term visually unsupported
 * <en/> Long-term (separate RFC): origin cells as `position:absolute` overlay detached from Grid row box, `height=rowspan*rowHeight` directly
 * <en/> No `getBoundingClientRect` measurement, avoids `Fixed→Dynamic` grid switch & `gridInstanceKey` remount jitter
 * <en/> This file is a placeholder, exporting a no-op `useSpanOverlay` for future `useVirtualSpan` integration
 */

export interface UseSpanOverlayOptions {
  /** <zh/> 是否启用合并 | <en/> Whether span is enabled */
  spanEnabled: () => boolean
  /** <zh/> 是否动态行高 | <en/> Whether dynamic row height */
  isDynamic: () => boolean
  /** <zh/> 行高 | <en/> Row height */
  rowHeight: () => number
  /** <zh/> 查询合并信息 | <en/> Query span info */
  getSpanInfo: (rowIndex: number, colKey: string, rowData?: unknown) => { rowspan: number, colspan: number, isOrigin: boolean } | undefined
  /**
   * <zh/> 共存策略（特性开关）——默认 `'warn-only'` 时 `getOverlayStyle` 恒返回 undefined；
   * <zh/> `'rfc-overlay'` 时才对 span×dynamic 的 origin 格返回 absolute 覆盖层样式。
   * <en/> Coexistence strategy (flag) — `'warn-only'` (default) keeps `getOverlayStyle` always undefined;
   * <en/> only `'rfc-overlay'` returns the absolute overlay style for span×dynamic origins.
   */
  spanDynamicMode?: () => import('../../types/renderer-interface').SpanDynamicCoexistence | undefined
}

/**
 * <zh/> 合并单元格覆盖层 composable（最小接线）——span×dynamic 场景下为 origin 格提供 absolute 样式。
 * <zh/> 默认 `spanDynamicMode:'warn-only'` 时恒返回 undefined；`'rfc-overlay'` 时启用覆盖层。
 * <en/> Span overlay composable (minimal wiring) — provides absolute styles for origin cells under span×dynamic.
 * <en/> Default `spanDynamicMode:'warn-only'` always returns undefined; `'rfc-overlay'` enables the overlay.
 *
 * @param options - <zh/> 合并/动态行高开关与合并信息查询 | <en/> Span/dynamic switches and span-info query
 * @returns <zh/> 覆盖层样式解析方法 | <en/> The overlay style resolver
 */
export function useSpanOverlay(options: UseSpanOverlayOptions) {
  const { spanEnabled, isDynamic, rowHeight, getSpanInfo, spanDynamicMode } = options

  /**
   * <zh/> 覆盖层样式——仅在 `rfc-overlay` + span×dynamic 时对 origin 格返回 absolute 样式
   * <en/> Overlay style — returns absolute style for origin cells only under `rfc-overlay` + span×dynamic
   */
  function getOverlayStyle(rowIndex: number, colKey: string, rowData?: unknown): Record<string, string> | undefined {
    if ((spanDynamicMode?.() ?? 'warn-only') !== 'rfc-overlay')
      return undefined
    if (!spanEnabled() || !isDynamic()) {
      return undefined
    }
    const info = getSpanInfo(rowIndex, colKey, rowData)
    if (!info?.isOrigin || (info.rowspan <= 1 && info.colspan <= 1)) {
      return undefined
    }
    const h = rowHeight()
    return {
      position: 'absolute',
      height: `${info.rowspan * h}px`,
      width: `${info.colspan * 100}%`,
      zIndex: '1',
      background: 'var(--el-table-tr-bg-color, var(--el-bg-color, #fff))',
      overflow: 'visible',
    }
  }

  return { getOverlayStyle, enabled: () => (spanDynamicMode?.() ?? 'warn-only') === 'rfc-overlay' && spanEnabled() && isDynamic() }
}
