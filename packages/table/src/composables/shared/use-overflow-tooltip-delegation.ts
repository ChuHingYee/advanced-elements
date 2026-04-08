import type { Ref } from 'vue'
import type { CellEnterContext, OverflowTooltipApi } from './use-overflow-tooltip'
import { onActivated, onBeforeUnmount, onDeactivated, toValue, watch } from 'vue'
import { findCellCoord } from '../../utils/dom-utils'

/**
 * <zh/> 溢出 tooltip 事件委托解析结果 | <en/> Overflow tooltip delegation resolved cell
 */
export interface TooltipDelegationCell {
  /** <zh/> 行数据 | <en/> Row data */
  row: unknown
  /** <zh/> 列配置 | <en/> Column config */
  column: unknown
  /** <zh/> 单元格值 | <en/> Cell value */
  cellValue: unknown
  /** <zh/> 列级 tooltipFormatter（可选） | <en/> Column-level tooltipFormatter (optional) */
  tooltipFormatter?: CellEnterContext['tooltipFormatter']
  /** <zh/> 是否禁用 tooltip | <en/> Whether tooltip is disabled */
  disabled: boolean
}

/**
 * <zh/> 溢出 tooltip 事件委托配置 | <en/> Overflow tooltip delegation options
 */
export interface UseOverflowTooltipDelegationOptions {
  /** <zh/> 表格容器 DOM 引用（委托锚点） | <en/> Table container DOM ref (delegation anchor) */
  containerRef: Ref<HTMLElement | null>
  /** <zh/> 共享 tooltip API | <en/> Shared tooltip API */
  api: OverflowTooltipApi
  /** <zh/> 按行列索引解析单元格上下文；返回 null 表示跳过 | <en/> Resolve cell context by row/col index; null to skip */
  resolveCell: (rowIndex: number, columnIndex: number) => TooltipDelegationCell | null
  /** <zh/> 是否启用委托监听，禁用时不绑定任何 DOM 监听器 | <en/> Whether to enable delegated listeners */
  enabled?: Ref<boolean> | (() => boolean) | boolean
}

/**
 * <zh/> 溢出 tooltip 事件委托——将 N×M 个每格 mouseenter 闭包降为容器上 2 个监听器。
 *
 * <zh/> 设计原理（Vue 最佳实践）：
 * <zh/> - composables.md：状态与副作用收敛到 composable，表现层仅保留 `data-adv-tooltip` 标记与行列坐标；
 * <zh/> - perf-avoid-component-abstraction-in-lists：大列表避免每格闭包/GC，hover 时按需解析上下文；
 * <zh/> - mouseover/mouseout 冒泡（mouseenter 不冒泡），通过 `closest` 定位 `.adv-table__cell--overflow` 锚点；
 * <zh/> - 行列坐标复用既有 `data-adv-cell-row/col`（cell-render-pipeline 统一盖章），不新增序列化开销；
 * <zh/> - mouseover 在格内子元素间移动会重复触发，用 `relatedTarget` 同格去重；
 * <zh/> - KeepAlive 失活/卸载时解绑并强制隐藏，避免残留 tooltip。
 *
 * <en/> Overflow tooltip event delegation — collapses N×M per-cell mouseenter closures into 2 container listeners.
 *
 * <en/> Design (Vue best practices):
 * <en/> - composables.md: state/side-effects live in the composable; render layer keeps only `data-adv-tooltip` markers + coordinates;
 * <en/> - perf-avoid-component-abstraction-in-lists: no per-cell closures/GC in large lists, context resolved on demand at hover time;
 * <en/> - mouseover/mouseout bubble (mouseenter does not), anchor located via `closest`;
 * <en/> - row/col coordinates reuse `data-adv-cell-row/col` stamps, zero extra serialization;
 * <en/> - same-cell moves deduped via `relatedTarget`;
 * <en/> - unbind + force-hide on unmount/deactivate to avoid stale tooltips.
 *
 * @param options - <zh/> 委托配置 | <en/> delegation options
 */
export function useOverflowTooltipDelegation(options: UseOverflowTooltipDelegationOptions): void {
  const { containerRef, api, resolveCell, enabled } = options

  function isEnabled(): boolean {
    if (enabled === undefined)
      return true
    return !!toValue(enabled)
  }

  function resolveAnchor(target: EventTarget | null): { anchor: HTMLElement, rowIndex: number, columnIndex: number } | null {
    if (!target || !(target as HTMLElement).closest)
      return null
    const el = target as HTMLElement
    const anchor = el.closest<HTMLElement>('.adv-table__cell--overflow')
    if (!anchor)
      return null
    const coord = findCellCoord(anchor)
    if (!coord)
      return null
    return { anchor, rowIndex: coord.rowIndex, columnIndex: coord.columnIndex }
  }

  function isSameCell(a: HTMLElement | null, b: EventTarget | null): boolean {
    if (!a || !b || !(b as HTMLElement).closest)
      return false
    const next = (b as HTMLElement).closest?.('.adv-table__cell--overflow')
    return next === a
  }

  function handleMouseOver(e: MouseEvent): void {
    const found = resolveAnchor(e.target)
    if (!found)
      return
    // <zh/> 格内子元素间移动去重，避免重复 scheduleShow | <en/> Dedup moves within the same cell to avoid repeated scheduleShow
    if (isSameCell(found.anchor, e.relatedTarget))
      return
    const cell = resolveCell(found.rowIndex, found.columnIndex)
    if (!cell)
      return
    // <zh/> disabled 优先读 DOM 标记（hover 操作列可见时渲染层已盖章），回退解析结果 | <en/> Disabled prefers the DOM marker (stamped at render when hover actions show), falls back to resolved value
    const disabledFromDom = found.anchor.getAttribute('data-adv-tooltip-disabled') === 'true'
    const ctx: CellEnterContext = {
      row: cell.row,
      column: cell.column,
      cellValue: cell.cellValue,
      tooltipFormatter: cell.tooltipFormatter,
    }
    api.onCellEnter(found.anchor, disabledFromDom || cell.disabled, ctx)
  }

  function handleMouseOut(e: MouseEvent): void {
    const found = resolveAnchor(e.target)
    if (!found)
      return
    // <zh/> 移到同格内子元素时不隐藏 | <en/> Keep visible when moving within the same cell
    if (isSameCell(found.anchor, e.relatedTarget))
      return
    api.onCellLeave()
  }

  let cleanup: (() => void) | null = null

  function bindEvents(el: HTMLElement): void {
    el.addEventListener('mouseover', handleMouseOver, true)
    el.addEventListener('mouseout', handleMouseOut, true)
    cleanup = () => {
      el.removeEventListener('mouseover', handleMouseOver, true)
      el.removeEventListener('mouseout', handleMouseOut, true)
    }
  }

  function unbindEvents(): void {
    cleanup?.()
    cleanup = null
  }

  watch(
    [containerRef, () => isEnabled()],
    ([el, on]) => {
      unbindEvents()
      if (el && on)
        bindEvents(el as HTMLElement)
      if (!on)
        api.forceHide()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    unbindEvents()
    api.forceHide()
  })

  onDeactivated(() => {
    unbindEvents()
    api.forceHide()
  })

  onActivated(() => {
    unbindEvents()
    const el = containerRef.value
    if (el && isEnabled())
      bindEvents(el)
  })
}
