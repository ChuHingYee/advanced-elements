import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { ActionConfig } from '../../types/column'
import { computed, toValue } from 'vue'
import { devWarn } from '../../utils/dev-warn'

/**
 * <zh/> 操作按钮组合式函数选项
 * <en/> Options for useOptionButtons composable
 */
export interface UseOptionButtonsOptions {
  /** <zh/> 按钮配置数组（可响应式，支持 ref / getter / 静态值） | <en/> Button config array (reactive, supports ref/getter/static value) */
  actions: MaybeRefOrGetter<ActionConfig[]>
  /** <zh/> 当前行数据（可响应式） | <en/> Current row data (reactive) */
  row: MaybeRefOrGetter<Record<string, unknown>>
  /** <zh/> 当前行索引（可响应式） | <en/> Current row index (reactive) */
  index: MaybeRefOrGetter<number>
}

/**
 * <zh/> 操作按钮组合式函数返回值
 * <en/> Return value of useOptionButtons composable
 */
export interface UseOptionButtonsReturn {
  /** <zh/> 可见按钮列表（按 visible 条件筛选后的计算属性） | <en/> Visible action list (filtered by visible condition) */
  visibleActions: ComputedRef<ActionConfig[]>
  /** <zh/> 判断按钮是否禁用——优先调用函数式 disabled 以支持动态逻辑 | <en/> Check if action is disabled — prefers function disabled for dynamic logic */
  isDisabled: (action: ActionConfig) => boolean
  /** <zh/> 处理按钮点击——阻止事件冒泡避免触发行事件，再执行 onClick | <en/> Handle button click — prevents event bubbling to avoid row event, then executes onClick */
  handleClick: (action: ActionConfig, event: Event) => void
}

/**
 * 操作列按钮 Composable——按 visible 条件筛选按钮并分发点击事件
 *
 * 将列配置中所有按钮的可见性判断与点击处理收敛到一处，
 * 避免每个按钮独立编写条件逻辑。
 *
 * @param options - 操作按钮配置 {@link UseOptionButtonsOptions}
 * @returns 按钮组合式函数接口 {@link UseOptionButtonsReturn}
 */
export function useOptionButtons(options: UseOptionButtonsOptions): UseOptionButtonsReturn {
  const { actions, row, index } = options

  const visibleActions = computed<ActionConfig[]>((prev) => {
    const rowData = toValue(row)
    const rowIndex = toValue(index)
    const result = toValue(actions).filter((action) => {
      if (action.visible == null)
        return true
      if (typeof action.visible === 'function') {
        // <zh/> 单按钮隔离：一个 visible 抛错按隐藏处理 + dev 告警，不拖累整列。
        // <en/> Per-button isolation: a throwing visible hides that button with a dev warning, never the whole column.
        try {
          return action.visible({ row: rowData, index: rowIndex })
        }
        catch (err) {
          devWarn('[AdvTable] option button visible() threw, hiding the button:', err)
          return false
        }
      }
      return action.visible
    })
    if (prev && prev.length === result.length && prev.every((item, i) => item === result[i]))
      return prev
    return result
  })

  /**
   * <zh/> 判断按钮是否禁用——优先调用函数式 disabled 以支持动态逻辑
   * @param action - <zh/> 按钮配置 | <en/> button config
   */
  function isDisabled(action: ActionConfig): boolean {
    if (typeof action.disabled === 'function') {
      // <zh/> 抛错按禁用处理，避免误点不可用操作。
      // <en/> A throwing predicate counts as disabled, so broken buttons stay unclickable.
      try {
        return action.disabled({ row: toValue(row), index: toValue(index) })
      }
      catch (err) {
        devWarn('[AdvTable] option button disabled() threw, treating as disabled:', err)
        return true
      }
    }
    return !!action.disabled
  }

  /**
   * <zh/> 处理按钮点击——阻止事件冒泡避免触发行事件，再执行 onClick
   * @param action - <zh/> 按钮配置 | <en/> button config
   * @param event - <zh/> 原始点击事件 | <en/> original click event
   */
  function handleClick(action: ActionConfig, event: Event) {
    event.stopPropagation()
    // <zh/> 禁用拦截：模板置灰未必拦得住 API 直调，此处再守一道。
    // <en/> Disabled guard: template graying cannot stop direct API calls, so guard here as well.
    if (isDisabled(action))
      return
    action.onClick?.({ row: toValue(row), index: toValue(index) })
  }

  return {
    visibleActions,
    isDisabled,
    handleClick,
  }
}
