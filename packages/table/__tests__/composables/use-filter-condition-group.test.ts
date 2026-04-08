/**
 * <zh/> useConditionGroup 单元测试 | <en/> useConditionGroup unit tests
 */
import type { ColumnFilterValue, NumberFilterValue, TextFilterValue } from '../../src/composables/data/use-column-filter'
import { describe, expect, it } from 'vitest'
import { computed, nextTick, shallowRef } from 'vue'
import { useConditionGroup } from '../../src/composables/features/use-filter-condition-group'

describe('useConditionGroup - text filter', () => {
  function setupText(initial: Partial<TextFilterValue> = {}) {
    const draft = shallowRef<ColumnFilterValue>({
      type: 'text',
      operator: 'contains',
      ...initial,
    } as TextFilterValue)
    const currentFilterType = computed(() => 'text' as const)
    const createDefaultCondition = () => ({ operator: 'contains' as const, value: undefined as string | undefined })
    const result = useConditionGroup(draft, 'text', createDefaultCondition, currentFilterType)
    return { draft, result }
  }

  it('needsInput returns true for non-blank operators', () => {
    const { result } = setupText()
    expect(result.needsInput.value).toBe(true)
  })

  it('needsInput returns false for blank operator', () => {
    const { result } = setupText({ operator: 'blank' })
    expect(result.needsInput.value).toBe(false)
  })

  it('needsInput returns false for notBlank operator', () => {
    const { result } = setupText({ operator: 'notBlank' })
    expect(result.needsInput.value).toBe(false)
  })

  it('hasSecondCondition returns false when value is empty', () => {
    const { result } = setupText({ operator: 'contains', value: '' })
    expect(result.hasSecondCondition.value).toBe(false)
  })

  it('hasSecondCondition returns false when value is undefined', () => {
    const { result } = setupText({ operator: 'contains' })
    expect(result.hasSecondCondition.value).toBe(false)
  })

  it('hasSecondCondition returns true when value is set', () => {
    const { result } = setupText({ operator: 'contains', value: 'test' })
    expect(result.hasSecondCondition.value).toBe(true)
  })

  it('hasSecondCondition returns false for blank operator even with value', () => {
    const { result } = setupText({ operator: 'blank', value: 'test' })
    expect(result.hasSecondCondition.value).toBe(false)
  })

  it('hasSecondCondition returns false when filterType does not match currentType', () => {
    const draft = shallowRef<ColumnFilterValue>({ type: 'text', operator: 'contains', value: 'test' } as TextFilterValue)
    const currentFilterType = computed(() => 'number' as const)
    const result = useConditionGroup(draft, 'text', () => ({ operator: 'contains' }), currentFilterType)
    expect(result.hasSecondCondition.value).toBe(false)
  })

  it('setOperator resets value and conditions for text', () => {
    const { draft, result } = setupText({ operator: 'contains', value: 'test', conditions: { logic: 'and', condition: { operator: 'equals', value: 'x' } } })
    result.setOperator('equals')
    expect((draft.value as TextFilterValue).operator).toBe('equals')
    expect((draft.value as TextFilterValue).value).toBeUndefined()
    expect((draft.value as TextFilterValue).conditions).toBeUndefined()
  })

  it('setConditionLogic updates conditions logic for text', () => {
    const { draft, result } = setupText({ operator: 'contains', value: 'test' })
    // hasSecondCondition is true, so conditions should be auto-created by watcher
    expect(result.hasSecondCondition.value).toBe(true)
    result.setConditionLogic('or')
    expect((draft.value as TextFilterValue).conditions?.logic).toBe('or')
  })

  it('setConditionLogic does nothing when conditions is undefined', () => {
    const { draft, result } = setupText({ operator: 'blank' })
    // blank operator means no second condition
    result.setConditionLogic('or')
    expect((draft.value as TextFilterValue).conditions).toBeUndefined()
  })

  it('setSecondOperator updates second condition operator for text', () => {
    const { draft, result } = setupText({ operator: 'contains', value: 'test' })
    result.setSecondOperator('equals')
    expect((draft.value as TextFilterValue).conditions?.condition.operator).toBe('equals')
  })

  it('setSecondOperator does nothing when conditions is undefined', () => {
    const { draft, result } = setupText({ operator: 'blank' })
    result.setSecondOperator('equals')
    expect((draft.value as TextFilterValue).conditions).toBeUndefined()
  })

  it('needsSecondInput returns false when no conditions', () => {
    const { result } = setupText({ operator: 'blank' })
    expect(result.needsSecondInput.value).toBe(false)
  })

  it('needsSecondInput returns true for non-blank second operator', () => {
    const { result } = setupText({ operator: 'contains', value: 'test' })
    result.setSecondOperator('equals')
    expect(result.needsSecondInput.value).toBe(true)
  })

  it('needsSecondInput returns false for blank second operator', () => {
    const { result } = setupText({ operator: 'contains', value: 'test' })
    result.setSecondOperator('blank')
    expect(result.needsSecondInput.value).toBe(false)
  })

  it('watcher adds conditions when hasSecondCondition becomes true', async () => {
    const draft = shallowRef<ColumnFilterValue>({ type: 'text', operator: 'contains' } as TextFilterValue)
    const currentFilterType = computed(() => 'text' as const)
    useConditionGroup(draft, 'text', () => ({ operator: 'contains' }), currentFilterType)
    expect((draft.value as TextFilterValue).conditions).toBeUndefined()
    // Set value — should trigger hasSecondCondition = true → watcher adds conditions
    draft.value = { ...draft.value, value: 'test' } as TextFilterValue
    await nextTick()
    expect((draft.value as TextFilterValue).conditions).toBeDefined()
    expect((draft.value as TextFilterValue).conditions?.logic).toBe('and')
  })

  it('watcher removes conditions when hasSecondCondition becomes false', async () => {
    const draft = shallowRef<ColumnFilterValue>({ type: 'text', operator: 'contains', value: 'test' } as TextFilterValue)
    const currentFilterType = computed(() => 'text' as const)
    useConditionGroup(draft, 'text', () => ({ operator: 'contains' }), currentFilterType)
    expect((draft.value as TextFilterValue).conditions).toBeDefined()
    // Clear value — should trigger hasSecondCondition = false → watcher removes conditions
    draft.value = { ...draft.value, value: '' } as TextFilterValue
    await nextTick()
    expect((draft.value as TextFilterValue).conditions).toBeUndefined()
  })

  it('watcher skips when filterType does not match currentType', async () => {
    const draft = shallowRef<ColumnFilterValue>({ type: 'text', operator: 'contains', value: 'test' } as TextFilterValue)
    const currentFilterType = computed(() => 'number' as const)
    useConditionGroup(draft, 'text', () => ({ operator: 'contains' }), currentFilterType)
    await nextTick()
    expect((draft.value as TextFilterValue).conditions).toBeUndefined()
  })
})

describe('useConditionGroup - number filter', () => {
  function setupNumber(initial: Partial<NumberFilterValue> = {}) {
    const draft = shallowRef<ColumnFilterValue>({
      type: 'number',
      operator: 'eq',
      ...initial,
    } as NumberFilterValue)
    const currentFilterType = computed(() => 'number' as const)
    const createDefaultCondition = () => ({ operator: 'eq' as const, value: undefined as number | undefined })
    const result = useConditionGroup(draft, 'number', createDefaultCondition, currentFilterType)
    return { draft, result }
  }

  it('needsInput returns true for non-blank operators', () => {
    const { result } = setupNumber()
    expect(result.needsInput.value).toBe(true)
  })

  it('needsInput returns false for blank operator', () => {
    const { result } = setupNumber({ operator: 'blank' })
    expect(result.needsInput.value).toBe(false)
  })

  it('hasSecondCondition returns true when value is set', () => {
    const { result } = setupNumber({ operator: 'eq', value: 10 })
    expect(result.hasSecondCondition.value).toBe(true)
  })

  it('hasSecondCondition returns true for between when min or max is set', () => {
    const { result } = setupNumber({ operator: 'between', min: 1, max: 10 })
    expect(result.hasSecondCondition.value).toBe(true)
  })

  it('hasSecondCondition returns true for between when only min is set', () => {
    const { result } = setupNumber({ operator: 'between', min: 1 })
    expect(result.hasSecondCondition.value).toBe(true)
  })

  it('hasSecondCondition returns false for between when min and max are undefined', () => {
    const { result } = setupNumber({ operator: 'between' })
    expect(result.hasSecondCondition.value).toBe(false)
  })

  it('hasSecondCondition returns false for blank operator', () => {
    const { result } = setupNumber({ operator: 'blank', value: 10 })
    expect(result.hasSecondCondition.value).toBe(false)
  })

  it('setOperator resets number draft completely', () => {
    const { draft, result } = setupNumber({ operator: 'eq', value: 10, min: 1, max: 5, conditions: { logic: 'and', condition: { operator: 'gt' } } })
    result.setOperator('gt')
    expect((draft.value as NumberFilterValue).operator).toBe('gt')
    expect((draft.value as NumberFilterValue).value).toBeUndefined()
    expect((draft.value as NumberFilterValue).min).toBeUndefined()
    expect((draft.value as NumberFilterValue).max).toBeUndefined()
    expect((draft.value as NumberFilterValue).conditions).toBeUndefined()
  })

  it('setConditionLogic updates conditions logic for number', () => {
    const { draft, result } = setupNumber({ operator: 'eq', value: 10 })
    result.setConditionLogic('or')
    expect((draft.value as NumberFilterValue).conditions?.logic).toBe('or')
  })

  it('setSecondOperator updates second condition operator for number', () => {
    const { draft, result } = setupNumber({ operator: 'eq', value: 10 })
    result.setSecondOperator('gt')
    expect((draft.value as NumberFilterValue).conditions?.condition.operator).toBe('gt')
  })

  it('needsSecondInput returns false when no conditions for number', () => {
    const { result } = setupNumber({ operator: 'blank' })
    expect(result.needsSecondInput.value).toBe(false)
  })

  it('needsSecondInput returns true for non-blank second operator for number', () => {
    const { result } = setupNumber({ operator: 'eq', value: 10 })
    result.setSecondOperator('gt')
    expect(result.needsSecondInput.value).toBe(true)
  })

  it('needsSecondInput returns false for blank second operator for number', () => {
    const { result } = setupNumber({ operator: 'eq', value: 10 })
    result.setSecondOperator('blank')
    expect(result.needsSecondInput.value).toBe(false)
  })

  it('watcher adds conditions for number when hasSecondCondition becomes true', async () => {
    const draft = shallowRef<ColumnFilterValue>({ type: 'number', operator: 'eq' } as NumberFilterValue)
    const currentFilterType = computed(() => 'number' as const)
    useConditionGroup(draft, 'number', () => ({ operator: 'eq' }), currentFilterType)
    expect((draft.value as NumberFilterValue).conditions).toBeUndefined()
    draft.value = { ...draft.value, value: 42 } as NumberFilterValue
    await nextTick()
    expect((draft.value as NumberFilterValue).conditions).toBeDefined()
  })

  it('watcher removes conditions for number when hasSecondCondition becomes false', async () => {
    const draft = shallowRef<ColumnFilterValue>({ type: 'number', operator: 'eq', value: 42 } as NumberFilterValue)
    const currentFilterType = computed(() => 'number' as const)
    useConditionGroup(draft, 'number', () => ({ operator: 'eq' }), currentFilterType)
    expect((draft.value as NumberFilterValue).conditions).toBeDefined()
    // Change to blank operator — hasSecondCondition becomes false
    draft.value = { ...draft.value, operator: 'blank' } as NumberFilterValue
    await nextTick()
    expect((draft.value as NumberFilterValue).conditions).toBeUndefined()
  })
})
