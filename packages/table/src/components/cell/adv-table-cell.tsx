/**
 * @component AdvTableCell
 * @displayName 单元格
 * @displayName Cell
 * @description <zh/> 统一单元格渲染入口（编辑触发/悬停操作/溢出提示装配） | <en/> Unified cell render entry (edit trigger / hover actions / overflow tooltip assembly)
 * @category 数据展示 | Data Display
 */
import type { PropType, VNode } from 'vue'
import type { CellState } from '../../composables/view-model/use-row-view-model'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { TableContext } from '../../types/config'
import type { Translator } from '../../types/translator'
import { defineComponent, h } from 'vue'
import { EMPTY_CELL_STATE } from '../../composables/view-model/use-row-view-model'
import { ADV_TABLE_ROW_KEY_ATTR } from '../../utils/table-drag'
import { renderCell as unifiedRenderCell } from '../cell-renderers/cell-renderer'
import { hasCustomRender, NO_TOOLTIP_VALUE_TYPES } from '../renderer-core/render-helpers'

/**
 * <zh/> AdvTableCell — first-class 单元格组件
 * <en/> AdvTableCell — first-class cell component
 *
 * @remarks
 * <zh/> 设计原理：
 * <zh/> EP 的 default 插槽函数运行在 ElTable 的 render effect 中，插槽内任何响应式读取都会注册到 ElTable 的 render effect，导致装饰态变化触发整表重渲染
 * <zh/> 将 cell 渲染责任提取为独立组件，装饰态通过 props 传入
 * <en/> Design principle:
 * <en/> EP's default slot function runs in ElTable's render effect, any reactive reads inside the slot register to ElTable's render effect, causing full table re-render on decoration state change
 * <en/> Extracts cell rendering responsibility into an independent component, decoration state passed via props
 *
 * <zh/> - Vue 的 shouldUpdateComponent 对 props 做浅比较
 * <zh/> - cellState 引用未变时跳过该 cell 的重渲染
 * <zh/> - class binding 完全声明式，符合 Vue 数据驱动原则
 * <en/> - Vue's shouldUpdateComponent does shallow comparison on props
 * <en/> - Skips cell re-render when cellState reference hasn't changed
 * <en/> - Class binding is fully declarative, following Vue's data-driven principle
 *
 * <zh/> 性能收益：
 * <zh/> - 装饰态变化不再触发 ElTable 重渲染
 * <zh/> - 仅受影响行的 AdvTableCell 重渲染（props cellState 引用变化）
 * <zh/> - 组件实例开销可控（函数式 render，无 reactive state）
 * <en/> Performance benefits:
 * <en/> - Decoration state changes no longer trigger ElTable re-render
 * <en/> - Only affected row's AdvTableCell re-renders (props cellState reference changes)
 * <en/> - Component instance overhead is controllable (functional render, no reactive state)
 *
 * <zh/> Vue 最佳实践：
 * <zh/> - reactivity.md: 使用 shallowRef 存储 cellState（opaque，不应被代理）
 * <zh/> - perf-avoid-component-abstraction-in-lists: 组件抽象在 cell 场景有价值（封装复杂行为 + shouldUpdateComponent 优化），不同于无意义的 wrapper 组件
 * <zh/> - sfc.md: 组件职责单一——只负责 cell 渲染
 * <en/> Vue best practices:
 * <en/> - reactivity.md: use shallowRef for cellState (opaque, should not be proxied)
 * <en/> - perf-avoid-component-abstraction-in-lists: component abstraction is valuable in cell scenarios (encapsulates complex behavior + shouldUpdateComponent optimization), unlike meaningless wrapper components
 * <en/> - sfc.md: single responsibility — only handles cell rendering
 */
export const AdvTableCell = defineComponent({
  name: 'AdvTableCell',
  props: {
    /** <zh/> 行数据 | <en/> Row data */
    row: { type: Object as PropType<Record<string, any>>, required: true },
    /** <zh/> 列配置 | <en/> Column config */
    col: { type: Object as PropType<LocalColumn>, required: true },
    /** <zh/> 行索引 | <en/> Row index */
    rowIndex: { type: Number, required: true },
    /** <zh/> 列索引 | <en/> Column index */
    colIndex: { type: Number, required: true },
    /** <zh/> 所有有效列（用于 cellRenderer 解析） | <en/> All valid columns (used for cellRenderer resolution) */
    columns: { type: Array as PropType<LocalColumn[]>, required: true },
    /** <zh/> 插槽集合 | <en/> Slot collection */
    slots: { type: Object as PropType<Record<string, any>>, required: true },
    /** <zh/> 插槽 key（列 key） | <en/> Slot key (column key) */
    slotKey: { type: String, required: true },
    /** <zh/> 翻译函数 | <en/> Translate function */
    t: { type: Function as PropType<() => Translator | undefined>, required: true },
    /** <zh/> 表格上下文 | <en/> Table context */
    ctx: { type: Object as PropType<TableContext | null | undefined>, default: undefined },
    /** <zh/> 行 key 字符串——用于 data-adv-table-row-key 属性 | <en/> Row key string — used for the data-adv-table-row-key attribute */
    rowKeyStr: { type: String, required: true },
    /** <zh/> 引用稳定的 cellState——由 RowViewModel 预计算，未变时复用引用 | <en/> Stable cellState reference — precomputed by RowViewModel, reference reused when unchanged */
    cellState: {
      type: Object as PropType<CellState>,
      default: () => EMPTY_CELL_STATE,
    },
    /** <zh/> 是否禁用 tooltip——配合 hover 操作列使用 | <en/> Whether tooltip is disabled — used together with the hover action column */
    tooltipDisabled: { type: Boolean, default: false },
  },
  setup(props) {
    /**
     * <zh/> 纯函数 render——无 reactive state，仅依赖 props
     * <en/> Pure function render — no reactive state, only depends on props
     *
     * @remarks
     * <zh/> class binding 完全声明式：isEditing → adv-table__cell--editing, isDirty → adv-table__cell--dirty, isRangeSelected → adv-table__cell--range-selected
     * <en/> Class binding is fully declarative: isEditing → adv-table__cell--editing, isDirty → adv-table__cell--dirty, isRangeSelected → adv-table__cell--range-selected
     *
     * <zh/> Vue 的 shouldUpdateComponent 对 props 做浅比较：
     * <zh/> - row 引用未变 → skip
     * <zh/> - col 引用未变 → skip
     * <zh/> - cellState 引用未变 → skip（核心优化）
     * <en/> Vue's shouldUpdateComponent does shallow comparison on props:
     * <en/> - row reference unchanged → skip
     * <en/> - col reference unchanged → skip
     * <en/> - cellState reference unchanged → skip (core optimization)
     */
    return () => {
      const { row, col, rowIndex, colIndex, columns, slots, slotKey, t, ctx, cellState } = props
      const state = cellState ?? EMPTY_CELL_STATE

      // 构建原始 cell 内容
      // Build raw cell content
      const rawContent = unifiedRenderCell({
        column: col,
        columns,
        columnIndex: colIndex,
        rowData: row,
        rowIndex,
        slots,
        slotKey,
        t: t(),
        ctx,
        hoverOptionColumns: undefined,
      })

      const isCustom = hasCustomRender(col, slots, slotKey)
      const enableTooltip = col.ellipsis !== false
        && !isCustom
        && !NO_TOOLTIP_VALUE_TYPES.has(col.valueType ?? '')

      // 声明式 class binding——完全数据驱动
      // Declarative class binding — fully data-driven
      const cellClass: string[] = [
        'adv-table__cell',
        'adv-table__drag-row-marker',
      ]
      if (state.isRangeSelected)
        cellClass.push('adv-table__cell--range-selected')
      if (state.isDirty)
        cellClass.push('adv-table__cell--dirty')
      if (state.isEditing)
        cellClass.push('adv-table__cell--editing')

      // <zh/> tooltip 包装：轻量标记 span，hover 上下文由容器级 useOverflowTooltipDelegation 按需解析，不再每格分配闭包/对象
      // <en/> Tooltip wrapping: lightweight marker span; hover context is resolved on demand by container-level useOverflowTooltipDelegation, no per-cell closures/objects
      const cellChildren: VNode | string = enableTooltip
        ? buildTooltipWrappedContent(rawContent, props.tooltipDisabled)
        : rawContent

      const ariaSelected = state.isRangeSelected ? 'true' : undefined

      return h('span', {
        'class': cellClass,
        [ADV_TABLE_ROW_KEY_ATTR]: props.rowKeyStr,
        'data-adv-cell-row': rowIndex,
        'data-adv-cell-col': colIndex,
        'role': 'gridcell',
        'aria-selected': ariaSelected,
        'aria-rowindex': rowIndex + 1,
        'aria-colindex': colIndex + 1,
      }, cellChildren)
    }
  },
})

/**
 * <zh/> 构建 tooltip 包装的 cell 内容——纯标记 span，无监听器/闭包。
 * <zh/> 上下文由容器级委托按行列索引回查数据区，避免 N×M 闭包 GC。
 * <en/> Build tooltip-wrapped cell content — pure marker span, no listeners/closures.
 * <en/> Context is resolved by container-level delegation via row/col indices, avoiding N×M closure GC.
 *
 * @param rawContent - <zh/> 原始单元格内容 | <en/> raw cell content
 * @param tooltipDisabled - <zh/> 是否禁用 tooltip | <en/> whether tooltip is disabled
 */
function buildTooltipWrappedContent(
  rawContent: VNode | string,
  tooltipDisabled?: boolean,
): VNode {
  return h('span', {
    'class': 'adv-table__cell--overflow',
    'data-adv-tooltip': 'overflow',
    'data-adv-tooltip-disabled': tooltipDisabled ? 'true' : undefined,
  }, rawContent)
}
