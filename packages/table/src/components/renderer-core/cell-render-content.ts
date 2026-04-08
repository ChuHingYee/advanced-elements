import type { CSSProperties, MaybeRefOrGetter, VNode } from 'vue'
import type { CellState } from '../../composables/view-model/use-row-view-model'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { TableContext, TreeApi, TreeRowMeta } from '../../types/config'
import type { Translator } from '../../types/translator'
import { h } from 'vue'
import { resolveCellValue } from '../../utils/value-pipeline'
import { renderCell as unifiedRenderCell } from '../cell-renderers/cell-renderer'
import RowActionBar from '../cell-renderers/row-action-bar.vue'
import { hasCustomRender, NO_TOOLTIP_VALUE_TYPES } from './render-helpers'

export interface CellRenderInput {
  col: LocalColumn
  colIndex: number
  columns: LocalColumn[]
  row: Record<string, any>
  rowIndex: number
  slots: Record<string, any>
  slotKey: string
  t: Translator | undefined
  ctx: TableContext | null | undefined

  showInlineHover: boolean
  hoverOptionTeleport: boolean
  /** <zh/> hoverRowKey/hoverLayerVisible 已移除——hover 由 CSS :hover 控制，不再通过 cellState 传递 | <en/> hoverRowKey/hoverLayerVisible removed — hover is controlled by CSS :hover, no longer passed via cellState */
  hoverRowKey?: string | null
  hoverLayerVisible?: boolean
  hoverOptionColumns: LocalColumn[]
  /** <zh/> hoverLayerCollapsed/hoverLayerStyle 由 RowActionBar 内部 inject 获取 | <en/> hoverLayerCollapsed/hoverLayerStyle are obtained via inject inside RowActionBar */
  hoverLayerCollapsed?: boolean
  hoverLayerStyle?: MaybeRefOrGetter<CSSProperties>
  /** <zh/> 切换折叠回调，inline 模式下作为 fallback 传给 RowActionBar | <en/> Toggle collapse callback, passed to RowActionBar as fallback in inline mode */
  onToggleCollapse?: (e: Event) => void
  rowKeyStr: string
  /** <zh/> 第一个非 selection 列的索引，由调用方预计算以避免每个单元格 O(colIndex) 扫描 | <en/> index of the first non-selection column, pre-computed by the caller to avoid O(colIndex) scans per cell */
  firstNormalColIndex?: number
  /** <zh/> 树形 API，供调用方在 cell 外部渲染缩进和展开按钮 | <en/> tree API for the caller to render indentation and expand buttons outside the cell */
  treeApi?: Pick<TreeApi, 'getTreeMeta' | 'treeEnabled' | 'toggleRowExpand'> | undefined
  /** <zh/> 是否禁用 tooltip——配合 hover 操作列使用，操作可见时禁用 tooltip 避免遮挡 | <en/> whether to disable the tooltip — used with the hover action column; disables the tooltip when actions are visible to avoid occlusion */
  tooltipDisabled?: boolean
  /** <zh/> cellState 由 RowViewModel 预计算，含 isHovered/isEditing/isDirty/isRangeSelected | <en/> cellState is pre-computed by RowViewModel, containing isHovered/isEditing/isDirty/isRangeSelected */
  cellState?: CellState
  /**
   * <zh/> 预解析的单元格值（热路径去重：工厂每格单次取值后透传，内容构建不再二次 resolve）。
   * <zh/> 以 `in` 判定是否提供（解析结果为 undefined 时同样复用，避免重复取值）。
   * <en/> Pre-resolved cell value (hot-path dedup: the factory resolves once per
   * <en/> cell and forwards it; content building no longer re-resolves). Presence is checked
   * <en/> via `in` (an undefined result is still reused, avoiding a second resolution).
   */
  cellData?: unknown
  /**
   * <zh/> hover 操作列渲染注入——默认 RowActionBar，测试/定制可覆盖，避免核心层硬编码具体业务组件
   * <en/> Hover-action render injection — defaults to RowActionBar, overridable for tests/customization
   */
  renderHoverActions?: (props: { visible: boolean, hoverOptionColumns: LocalColumn[], row: Record<string, any>, rowIndex: number }) => VNode
}

export interface CellRenderResult {
  cellContent: VNode | string
  shouldShowInline: boolean
  hoverInlineVNode?: VNode
  /** <zh/> 树形元信息，供调用方在 cell 外部渲染缩进和展开按钮 | <en/> tree metadata for the caller to render indentation and expand buttons outside the cell */
  treeMeta?: TreeRowMeta
  /** <zh/> 是否为第一个非 selection 列（树形缩进目标列） | <en/> whether it is the first non-selection column (the tree indentation target column) */
  isTreeTargetCol?: boolean
}

/**
 * <zh/> 构建单元格渲染内容，统一处理插槽渲染、溢出 tooltip、树形缩进和 hover 操作列。
 * <en/> Build cell render content, uniformly handling slot rendering, overflow tooltip, tree indentation and the hover action column.
 *
 * @param input - <zh/> 单元格渲染输入参数 | <en/> cell render input parameters
 * @returns <zh/> 包含原始内容 VNode、tooltip 包装、树形元信息等渲染结果 | <en/> render result including the raw content VNode, tooltip wrapper and tree metadata
 */
export function buildCellContent(input: CellRenderInput): CellRenderResult {
  // <zh/> 单次取值——工厂已预解析时直接复用（含 undefined 结果），否则本地解析一次，
  // <zh/> 后续 tooltip 与内容渲染共享同一份值，消除每格 2–3 次重复 resolveCellValue。
  // <en/> resolve once — reuse the factory-provided value when present (including an
  // <en/> undefined result); otherwise resolve locally once. The tooltip and content render
  // <en/> share it, eliminating 2–3 duplicate resolveCellValue calls per cell.
  const cellData = ('cellData' in input) ? input.cellData : resolveCellValue(input.row, input.col, input.rowIndex)
  const rawContent = unifiedRenderCell({
    column: input.col,
    columns: input.columns,
    columnIndex: input.colIndex,
    rowData: input.row,
    rowIndex: input.rowIndex,
    slots: input.slots,
    slotKey: input.slotKey,
    t: input.t,
    ctx: input.ctx,
    hoverOptionColumns: input.hoverOptionTeleport ? undefined : input.hoverOptionColumns,
    cellData,
  })

  const isCustom = hasCustomRender(input.col, input.slots, input.slotKey)
  const enableTooltip = input.col.ellipsis !== false
    && !isCustom
    && !NO_TOOLTIP_VALUE_TYPES.has(input.col.valueType ?? '')

  /**
   * <zh/> OverflowTooltipCell 降级为 span + 容器级事件委托。
   * <zh/> 性能收益：消除 N×M 个 Vue 组件实例与 N×M 个每格 mouseenter 闭包（含 tooltipCtx 对象分配），改为轻量原生 span 标记 + 容器 2 个委托监听器。
   * <zh/> 符合 Vue 最佳实践 perf-avoid-component-abstraction-in-lists：大列表中避免组件抽象与每格闭包开销，hover 时由 useOverflowTooltipDelegation 按需解析上下文。
   * <zh/> disabled 语义通过 `data-adv-tooltip-disabled` 标记传递，避免闭包捕获；行列定位复用 `data-adv-cell-row/col`。
   * <en/> OverflowTooltipCell is downgraded to a span + container-level delegation.
   * <en/> Perf gain: eliminates N×M Vue component instances and N×M per-cell mouseenter closures (incl. tooltipCtx allocations),
   * <en/> replaced by a lightweight marker span + 2 delegated container listeners.
   * <en/> Follows perf-avoid-component-abstraction-in-lists: context is resolved on demand by useOverflowTooltipDelegation at hover time.
   * <en/> Disabled semantics travel via `data-adv-tooltip-disabled`; row/col via `data-adv-cell-row/col`.
   */
  const cellContent: VNode | string = enableTooltip
    ? h('span', {
        'class': 'adv-table__cell--overflow',
        'data-adv-tooltip': 'overflow',
        'data-adv-tooltip-disabled': input.tooltipDisabled ? 'true' : undefined,
      }, rawContent)
    : rawContent

  const treeMeta = input.treeApi?.treeEnabled.value
    ? input.treeApi?.getTreeMeta(input.row)
    : undefined
  const isFirstNormalCol = input.firstNormalColIndex !== undefined
    ? input.colIndex === input.firstNormalColIndex
    : input.colIndex === 0 || input.columns.slice(0, input.colIndex).every(c => c.selection)
  const isTreeTargetCol = !!(treeMeta && isFirstNormalCol && input.treeApi?.treeEnabled.value)

  let shouldShowInline = false
  if (input.showInlineHover && !input.hoverOptionTeleport) {
    /**
     * <zh/> hover 移出 CellState 计算链——inline 模式下始终创建 RowActionBar VNode，
     * <zh/> 可见性由 bar 自身单源 computed（行 key == hoverRowKey，经 `--visible` /
     * <zh/> `data-hover-visible`）控制，而非 CSS :hover。hover 切换仅重渲染各行 bar 自身
     * <zh/> （模式隔离），避免 hoverRowKey 变化触发全表 O(rows×cols) VM 重算。
     * <zh/> inline 模式仅在 ElTable（默认渲染器）下使用，行数受分页限制，开销可控。
     * <en/> hover removed from CellState computation chain — inline mode always creates the RowActionBar VNode,
     * <en/> visibility governed by the bar's own single-source computed (row key == hoverRowKey, via
     * <en/> `--visible` / `data-hover-visible`), not CSS :hover. Hover switches only re-render each row's
     * <en/> bar (-pattern isolation), avoiding O(rows×cols) VM recompute on hoverRowKey change.
     * <en/> Inline mode is only used with ElTable (default renderer), row count is bounded by pagination, overhead is manageable.
     */
    shouldShowInline = input.hoverOptionColumns.length > 0
  }

  let hoverInlineVNode: VNode | undefined
  if (shouldShowInline) {
    /**
     * <zh/> collapsed 状态和 onToggleCollapse 均由 RowActionBar 通过 inject hoverApi 获取。
     * <zh/> 不在插槽内传递或读取这些响应式状态，消除 EP render effect 污染。
     * <en/> collapsed state and onToggleCollapse are both obtained by RowActionBar via inject hoverApi.
     * <en/> No passing or reading of these reactive states inside slots, eliminating EP render effect pollution.
     */
    const renderHover = input.renderHoverActions
      ?? ((p: { visible: boolean, hoverOptionColumns: LocalColumn[], row: Record<string, any>, rowIndex: number }) => h(RowActionBar, {
        visible: p.visible,
        hoverOptionColumns: p.hoverOptionColumns,
        row: p.row,
        rowIndex: p.rowIndex,
      }))
    hoverInlineVNode = renderHover({
      visible: true,
      hoverOptionColumns: input.hoverOptionColumns,
      row: input.row,
      rowIndex: input.rowIndex,
    })
  }

  return {
    cellContent,
    shouldShowInline,
    hoverInlineVNode,
    treeMeta: isTreeTargetCol ? treeMeta : undefined,
    isTreeTargetCol,
  }
}
