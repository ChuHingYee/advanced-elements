/**
 * <zh/> 双引擎渲染器统一接口——抽取 default/virtual 两模式的公共契约，消除模板 `v-if="mode"` 硬分支
 * <en/> Dual-engine renderer unified interface — extracts the common contract of default/virtual modes, eliminating `v-if="mode"` hard branches
 *
 * @remarks
 * <zh/> 架构目标：新增功能仅需实现此接口，`table.vue` 经 `rendererAdapter.component` 单点分发，无需双改
 * <zh/> 当前两渲染器已通过 `defineExpose({ scrollToRow, scrollToColumn, ... })` 隐式实现此契约，本文件显式化以便 `vue-tsc` 契约锚定
 * <zh/> `rowIndex` 域约定：default 为 `pinnedDisplayData` 域（含固定行偏移），virtual 为 `virtualData` 域（不含 pin），跨 pin 调用方需经 `rowKey` 转换
 *
 * <zh/> `rowIndex` 域约定：统一 unpinned 基准 + 身份换算——default 的 composed 交错仅为渲染装配细节，
 * <zh/> 逻辑层一律用 unpinned 行号，跨 pin 调用方经 adapter `toRenderIndex/toRowKey`（rowKey 转换）
 *
 * <en/> Architecture goal: new features only need to implement this interface; `table.vue` dispatches via `rendererAdapter.component` single point, no dual edits
 * <en/> Both renderers currently expose `defineExpose({ scrollToRow, scrollToColumn, ... })` implicitly implementing this contract; this file makes it explicit for `vue-tsc` anchoring
 * <en/> `rowIndex` domain: unified unpinned base plus identity conversion — default's composed interleave is a render-assembly detail only;
 * <en/> logic layers always use unpinned indexes, cross-pin callers convert via adapter `toRenderIndex/toRowKey` (rowKey conversion)
 */

import type { RendererInteractionDomain, ScrollTarget, ScrollToRowOptions } from '../utils/table-drag'

/** <zh/> 渲染器实例契约——双渲染器经 defineExpose 隐式实现的统一接口（滚动/行高/自愈） | <en/> Renderer instance contract — unified interface both renderers implement via defineExpose (scroll/row-height/reconcile) */
export interface ITableRenderer {
  getInteractionDomain?: () => RendererInteractionDomain
  /** <zh/> 滚动到指定行（rowKey 字符串）| <en/> Scroll to row by rowKey string */
  scrollToRow: (target: ScrollTarget, options?: ScrollToRowOptions) => boolean
  /** <zh/> 滚动到指定列（columnKey 字符串）| <en/> Scroll to column by columnKey string */
  scrollToColumn: (target: ScrollTarget) => boolean
  /** <zh/> 重置列宽拖拽缓存（virtual 专用，default 空实现）| <en/> Reset column resize cache (virtual only, default no-op) */
  resetColumnWidths?: () => void
  /** <zh/> 手动触发虚拟滚动自愈（virtual 专用）| <en/> Manually trigger virtual scroll reconcile (virtual only) */
  reconcileScroll?: () => void
  /**
   * <zh/> 透传 EP 原生行高重测（virtual 动态网格专用）——自定义 cell 异步撑高（`data` 引用未变）
   * <zh/> 后调用，清除 index 之后全部行的缓存行高并重排；固定网格/default 模式/实例未就绪时返回 false
   * <en/> Pass-through EP native row-height reset (virtual dynamic grid only) — call after async
   * <en/> cell-content growth (no `data` reference change) to drop cached heights after index and reflow;
   * <en/> false on fixed grids / default mode / unready instances
   */
  resetAfterRowIndex?: (index?: number, forceUpdate?: boolean) => boolean
  /**
   * <zh/> 便捷重测（virtual 动态网格专用）——`resetAfterRowIndex(index, true)`，默认从 0 行起全量重测
   * <en/> Convenience remeasure (virtual dynamic grid only) — `resetAfterRowIndex(index, true)`, resetting everything from row 0 by default
   */
  refreshVirtualRowHeight?: (index?: number) => boolean
}

/**
 * <zh/> 合并单元格与动态行高共存策略（特性开关 `spanDynamicMode` 的取值域）
 * <en/> Span vs dynamic row height coexistence strategy (value domain of the `spanDynamicMode` flag)
 *
 * @remarks
 * <zh/> 当前 `spanEnabled && dynamicGrid`（append/expand 触发）在 `table-virtual-renderer.vue:548` 仅 dev 警告
 * <zh/> 长期方案：origin 格绝对定位覆盖层（RFC），使 `rowspan*rowHeight` 不依赖 `getBoundingClientRect` 测量
 * <en/> Currently `spanEnabled && dynamicGrid` (triggered by append/expand) only warns in dev at `table-virtual-renderer.vue:548`
 * <en/> Long-term: absolutely-positioned origin overlay (RFC) so `rowspan*rowHeight` does not rely on `getBoundingClientRect`
 *
 * <zh/> - `'warn-only'`（默认）：零行为变更，仅告警；`useSpanOverlay.getOverlayStyle` 不生效。
 * <zh/> - `'rfc-overlay'`：virtual 侧 origin 格改走 `useSpanOverlay.getOverlayStyle` 绝对定位覆盖层，
 * <zh/>   替代 `rowspan × rowHeight` 估算；default 模式不受影响。
 * <en/> - `'warn-only'` (default): zero behavior change, warn only; `useSpanOverlay.getOverlayStyle` stays inert.
 * <en/> - `'rfc-overlay'`: virtual origin cells take the `useSpanOverlay.getOverlayStyle` absolute overlay
 * <en/>   instead of the `rowspan × rowHeight` estimate; default mode unaffected.
 */
export type SpanDynamicCoexistence = 'warn-only' | 'rfc-overlay'
