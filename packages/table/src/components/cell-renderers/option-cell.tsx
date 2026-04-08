/**
 * @component OptionCell
 * @displayName 操作单元格
 * @displayName Option Cell
 * @description <zh/> 行操作按钮组渲染（可见性按行判定） | <en/> Row action button group rendering (per-row visibility)
 * @category 数据展示 | Data Display
 */
import type { ActionConfig } from '../../types/column'
import { ElButton } from 'element-plus'
import { defineComponent, h } from 'vue'

/**
 * <zh/> action.visible 为函数时按行调用，否则取静态值；缺省视为可见
 * <en/> action.visible is called per row when it's a function, otherwise static value; defaults to visible
 */
function isActionVisible(action: ActionConfig, row: Record<string, unknown>, index: number): boolean {
  if (action.visible == null)
    return true
  if (typeof action.visible === 'function')
    return action.visible({ row, index })
  return action.visible
}

/**
 * <zh/> action.disabled 为函数时按行调用，否则取静态布尔值
 * <en/> action.disabled is called per row when it's a function, otherwise static boolean
 */
function isActionDisabled(action: ActionConfig, row: Record<string, unknown>, index: number): boolean {
  if (typeof action.disabled === 'function')
    return action.disabled({ row, index })
  return !!action.disabled
}

/**
 * <zh/> 操作列单元格组件——按行渲染可见的操作按钮
 * <en/> Action column cell component — renders visible action buttons per row
 *
 * @remarks
 * <zh/> 列配置 `hoverActions` 时由 `buildCellContent` 统一渲染 `RowActionBar`，
 * <zh/> 本组件仅负责非 hover 模式下的常规按钮渲染；按钮间自动插入分隔符。
 * <en/> When the column configures `hoverActions`, `buildCellContent` renders `RowActionBar` uniformly;
 * <en/> this component handles only regular buttons in non-hover mode; a divider is auto-inserted between buttons.
 *
 * @example
 * ```ts
 * {
 *   key: 'action',
 *   label: '操作',
 *   actions: [
 *     { label: '编辑', onClick: ({ row }) => handleEdit(row) },
 *     { label: '删除', type: 'danger', disabled: ({ row }) => row.status === 'locked' },
 *   ],
 * }
 * ```
 */
export const OptionCell = defineComponent({
  name: 'AdvOptionCell',
  props: {
    cellData: {
      type: [String, Number, Boolean, Object, Array],
      default: null,
    },
    rowData: {
      type: Object,
      required: true,
    },
    column: {
      type: Object,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const col = props.column as { actions?: ActionConfig[], hoverActions?: unknown }
      const actions = col.actions
      if (!actions?.length)
        return h('span')

      // hoverActions 模式：RowActionBar 由 buildCellContent 统一渲染，
      // OptionCell 仅渲染常规按钮（非 hover 模式）
      // In hoverActions mode: RowActionBar is rendered uniformly by buildCellContent,
      // OptionCell only renders regular buttons (non-hover mode)
      if (col.hoverActions)
        return h('span')

      const row = props.rowData as Record<string, unknown>
      const rowIndex = props.index

      const visibleActions = actions.filter(action => isActionVisible(action, row, rowIndex))
      if (!visibleActions.length)
        return h('span')

      return h(
        'div',
        { class: 'adv-table__option' },
        visibleActions.map((action, i) => [
          h(
            ElButton,
            {
              type: action.type ?? 'primary',
              size: action.size ?? 'small',
              link: action.link ?? true,
              disabled: isActionDisabled(action, row, rowIndex),
              icon: action.icon,
              ...action.buttonProps,
              onClick: (e: Event) => {
                e.stopPropagation()
                action.onClick?.({ row, index: rowIndex })
              },
            },
            () => action.label,
          ),
          i < visibleActions.length - 1
            ? h('span', { class: 'adv-table__option-divider' })
            : null,
        ]),
      )
    }
  },
})
