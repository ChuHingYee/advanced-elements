/**
 * <zh/> 筛选条件组 composable — 管理 text/number 筛选的复合条件（And/Or）逻辑
 * <en/> Filter condition group composable — manages compound condition (And/Or) logic for text/number filters
 *
 * @remarks
 * <zh/> 从 column-filter-form.vue 拆出，职责单一：
 * <zh/> - 判断是否需要输入框（blank/notBlank 运算符无需输入）
 * <zh/> - 判断是否需要第二条件
 * <zh/> - 设置运算符 / 条件逻辑 / 第二运算符
 * <zh/> - 监听条件显隐变化自动增删 conditions 结构
 * <en/> Extracted from column-filter-form.vue, single responsibility:
 * <en/> - Determines if input is needed (blank/notBlank operators don't need input)
 * <en/> - Determines if second condition is needed
 * <en/> - Sets operator / condition logic / second operator
 * <en/> - Listens to condition visibility changes and auto adds/removes conditions structure
 */
import type { ComputedRef, ShallowRef } from 'vue'
import type { ColumnFilterType, ColumnFilterValue, NumberCondition, NumberFilterValue, NumberOperator, TextCondition, TextFilterValue, TextOperator } from '../../types/filter'
import { computed, watch } from 'vue'

const BLANK_OPERATORS = new Set(['blank', 'notBlank'])

export interface UseConditionGroupReturn {
  needsInput: ComputedRef<boolean>
  hasSecondCondition: ComputedRef<boolean>
  setOperator: (operator: string) => void
  setConditionLogic: (logic: 'and' | 'or') => void
  setSecondOperator: (operator: string) => void
  needsSecondInput: ComputedRef<boolean>
}

/**
 * <zh/> 筛选条件组 composable——管理 text/number 筛选复合条件（And/Or）的结构与显隐联动，详见文件头说明。
 * <en/> Filter condition group composable — manages the compound (And/Or) condition structure and
 * <en/> visibility linkage for text/number filters; see the file header for details.
 *
 * @param draft - <zh/> 正在编辑的筛选草稿值 | <en/> Draft filter value being edited
 * @param filterType - <zh/> 本条件组所属筛选类型（text/number） | <en/> Filter type this group belongs to (text/number)
 * @param createDefaultCondition - <zh/> 创建该类型默认条件的工厂 | <en/> Factory creating the default condition of this type
 * @param currentFilterType - <zh/> 当前激活的筛选类型（ref 或 getter） | <en/> Current active filter type (ref or getter)
 * @returns <zh/> 条件输入显隐状态与运算符/逻辑设置方法集 | <en/> Condition input visibility flags and operator/logic setters
 */
export function useConditionGroup<C>(
  draft: ShallowRef<ColumnFilterValue>,
  filterType: ColumnFilterType,
  createDefaultCondition: () => C,
  currentFilterType: ComputedRef<ColumnFilterType> | (() => ColumnFilterType),
): UseConditionGroupReturn {
  /** 将 currentFilterType 统一为 getter 函数 */
  const getCurrentType = typeof currentFilterType === 'function'
    ? currentFilterType
    : () => currentFilterType.value

  const needsInput = computed(() => {
    if (filterType === 'text') {
      const operator = (draft.value as TextFilterValue).operator
      return !BLANK_OPERATORS.has(operator)
    }
    if (filterType === 'number') {
      const operator = (draft.value as NumberFilterValue).operator
      return !BLANK_OPERATORS.has(operator)
    }
    // 仅 text/number 支持复合条件：其余类型无第二条件输入
    return false
  })

  const hasSecondCondition = computed(() => {
    if (getCurrentType() !== filterType)
      return false
    if (filterType === 'text') {
      const textDraft = draft.value as TextFilterValue
      if (BLANK_OPERATORS.has(textDraft.operator))
        return false
      return textDraft.value !== undefined && textDraft.value !== ''
    }
    if (filterType === 'number') {
      const numberDraft = draft.value as NumberFilterValue
      if (BLANK_OPERATORS.has(numberDraft.operator))
        return false
      if (numberDraft.operator === 'between')
        return numberDraft.min !== undefined || numberDraft.max !== undefined
      return numberDraft.value !== undefined
    }
    // date/enum/group 不支持复合第二条件
    return false
  })

  function setOperator(operator: string) {
    if (filterType === 'number') {
      const numberDraft = draft.value as NumberFilterValue
      draft.value = { ...numberDraft, operator: operator as NumberOperator, value: undefined, min: undefined, max: undefined, conditions: undefined }
    }
    else if (filterType === 'text') {
      const textDraft = draft.value as TextFilterValue
      draft.value = { ...textDraft, operator: operator as TextOperator, value: undefined, conditions: undefined }
    }
    // 其余类型由各表单直写 draft，不经此通道
  }

  function setConditionLogic(logic: 'and' | 'or') {
    if (filterType === 'text') {
      const textDraft = draft.value as TextFilterValue
      if (textDraft.conditions) {
        draft.value = { ...textDraft, conditions: { ...textDraft.conditions, logic } }
      }
    }
    else if (filterType === 'number') {
      const numberDraft = draft.value as NumberFilterValue
      if (numberDraft.conditions) {
        draft.value = { ...numberDraft, conditions: { ...numberDraft.conditions, logic } }
      }
    }
  }

  function setSecondOperator(operator: string) {
    if (filterType === 'text') {
      const textDraft = draft.value as TextFilterValue
      if (textDraft.conditions) {
        draft.value = {
          ...textDraft,
          conditions: {
            ...textDraft.conditions,
            condition: { ...createDefaultCondition(), operator: operator as TextOperator },
          },
        }
      }
    }
    else if (filterType === 'number') {
      const numberDraft = draft.value as NumberFilterValue
      if (numberDraft.conditions) {
        draft.value = {
          ...numberDraft,
          conditions: {
            ...numberDraft.conditions,
            condition: { ...createDefaultCondition(), operator: operator as NumberOperator },
          },
        }
      }
    }
  }

  const needsSecondInput = computed(() => {
    if (filterType === 'text') {
      const textDraft = draft.value as TextFilterValue
      if (!textDraft.conditions)
        return false
      return !BLANK_OPERATORS.has(textDraft.conditions.condition.operator)
    }
    if (filterType === 'number') {
      const numberDraft = draft.value as NumberFilterValue
      if (!numberDraft.conditions)
        return false
      return !BLANK_OPERATORS.has(numberDraft.conditions.condition.operator)
    }
    return false
  })

  watch(hasSecondCondition, (show) => {
    if (getCurrentType() !== filterType)
      return
    if (filterType !== 'text' && filterType !== 'number')
      return
    if (filterType === 'text') {
      const textDraft = draft.value as TextFilterValue
      if (show && !textDraft.conditions) {
        draft.value = {
          ...textDraft,
          conditions: { logic: 'and', condition: createDefaultCondition() as unknown as TextCondition },
        }
      }
      else if (!show && textDraft.conditions) {
        const { conditions, ...rest } = textDraft
        draft.value = rest as TextFilterValue
      }
    }
    else {
      const numberDraft = draft.value as NumberFilterValue
      if (show && !numberDraft.conditions) {
        draft.value = {
          ...numberDraft,
          conditions: { logic: 'and', condition: createDefaultCondition() as unknown as NumberCondition },
        }
      }
      else if (!show && numberDraft.conditions) {
        const { conditions, ...rest } = numberDraft
        draft.value = rest as NumberFilterValue
      }
    }
  }, { immediate: true })

  return {
    needsInput,
    hasSecondCondition,
    setOperator,
    setConditionLogic,
    setSecondOperator,
    needsSecondInput,
  }
}
