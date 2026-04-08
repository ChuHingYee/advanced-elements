import type { MaybeRefOrGetter } from 'vue'
import type { RendererCaps } from '../../types/renderer-caps'
import type { RendererScrollApi, ScrollTarget, ScrollToRowOptions } from '../../utils/table-drag'
import { toValue } from 'vue'
import { devWarn } from '../../utils/dev-warn'

/**
 * @file use-scroll-to-row-column.ts
 * @description
 * <zh/> 滚动定位策略统一 — 双渲染器 scrollTo 行为归一化，定位入参统一为 rowKey/columnKey 字符串。
 *
 * <zh/> **设计目标**：
 * <zh/> 1. 双渲染器（default / virtual）行为一致：同一签名 ScrollTarget / boolean 返回 / string key 定位
 * <zh/> 2. virtual 模式 behavior 隔离：ElTableV2 不支持 smooth，传入时 devWarn 提示忽略
 * <zh/> 3. 签名稳定：scrollToRow/scrollToColumn 保持原有签名
 *
 * <en/> Scroll-to strategy unification — dual-renderer scrollTo convergence with rowKey/columnKey string targeting.
 *
 * <en/> **Goals**:
 * <en/> 1. Dual renderers (default/virtual) behave consistently
 * <en/> 2. Virtual mode behavior isolation — ElTableV2 has no smooth support, warn when ignored
 * <en/> 3. Stable signatures — scrollToRow/scrollToColumn keep their signatures
 */

export interface UseScrollToRowColumnOptions {
  /**
   * <zh/> 渲染器能力表——滚动定位只查 `smoothScroll`（是否支持 behavior），不询问渲染模式布尔量。
   * <en/> Renderer capability table — scroll positioning queries `smoothScroll` only (whether behavior is
   * <en/> honored), never the render-mode boolean.
   */
  caps: MaybeRefOrGetter<Pick<RendererCaps, 'smoothScroll'>>
  /** <zh/> 获取当前活跃渲染器的滚动 API | <en/> Get the active renderer's scroll API */
  getScrollApi: () => RendererScrollApi | null | undefined
  /** <zh/> 表格实例 ID（用于日志区分，支持 ref 跟随运行时变更） | <en/> Table instance id for log distinction (accepts ref to follow runtime changes) */
  tableId?: MaybeRefOrGetter<string>
}

export interface UseScrollToRowColumnReturn {
  /** <zh/> 滚动到指定行 | <en/> Scroll to row */
  scrollToRow: (target: ScrollTarget, options?: ScrollToRowOptions) => boolean
  /** <zh/> 滚动到指定列 | <en/> Scroll to column */
  scrollToColumn: (target: ScrollTarget) => boolean
  /** <zh/> 统一入口：行/列双轴定位（AG Grid 风格） | <en/> Unified entry: row/column dual-axis positioning (AG Grid style) */
  scrollTo: (params: { row?: ScrollTarget, column?: ScrollTarget, rowOptions?: ScrollToRowOptions }) => boolean
}

/**
 * <zh/> 创建统一滚动定位 API
 * <en/> Create unified scroll positioning API
 */
export function useScrollToRowColumn(options: UseScrollToRowColumnOptions): UseScrollToRowColumnReturn {
  function warnBehaviorInVirtual(opts?: ScrollToRowOptions): void {
    // <zh/> 能力查询：不支持 behavior 的渲染器（行虚拟化）在收到非 'auto' behavior 时提示被忽略
    // <en/> Capability query: renderers without behavior support (row-virtualized) warn when a non-'auto'
    // <en/> behavior is passed
    const noSmoothScroll = !toValue(options.caps).smoothScroll
    if (noSmoothScroll && opts?.behavior && opts.behavior !== 'auto') {
      devWarn(
        `scrollToRow behavior "${opts.behavior}" is ignored in virtual mode (ElTableV2 scrollToRow has no smooth/instant support). `
        + 'Only align option is honored; behavior is forwarded only in default mode via scrollIntoView.',
      )
    }
  }

  function scrollToRow(target: ScrollTarget, opts?: ScrollToRowOptions): boolean {
    warnBehaviorInVirtual(opts)
    const api = options.getScrollApi()
    if (!api?.scrollToRow)
      return false
    return api.scrollToRow(target, opts)
  }

  function scrollToColumn(target: ScrollTarget): boolean {
    const api = options.getScrollApi()
    if (!api?.scrollToColumn)
      return false
    return api.scrollToColumn(target)
  }

  function scrollTo(params: { row?: ScrollTarget, column?: ScrollTarget, rowOptions?: ScrollToRowOptions }): boolean {
    let rowOk = true
    let colOk = true
    if (params.row !== undefined)
      rowOk = scrollToRow(params.row, params.rowOptions)
    if (params.column !== undefined)
      colOk = scrollToColumn(params.column)
    return rowOk && colOk
  }

  return {
    scrollToRow,
    scrollToColumn,
    scrollTo,
  }
}
