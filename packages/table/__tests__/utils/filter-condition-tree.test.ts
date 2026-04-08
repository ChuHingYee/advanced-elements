import type { GroupFilterValue } from '../../src/composables/data/use-column-filter'
import { describe, expect, it } from 'vitest'
import { registerBuiltinFilterTypes } from '../../src/composables/features/builtin-filters'
import { getFilterStrategy } from '../../src/composables/features/filter-registry'
import {
  conditionGroup,
  conditionLeaf,
  evaluateConditionTree,
} from '../../src/utils/filter-condition-tree'

/**
 * <zh/> 条件树求值器 + 'group' 策略契约测试——把同列多条件 AND/OR 从两槽硬编码
 * <zh/> 提升为任意深度嵌套树（对齐 AG Grid 的 condition1/2/operator 能力）。
 *
 * <en/> Condition-tree evaluator + 'group' strategy contract tests — lifts same-column
 * <en/> multi-condition AND/OR beyond the two-slot model to arbitrary nesting (parity with
 * <en/> AG Grid's condition1/condition2/operator capability).
 */
registerBuiltinFilterTypes()

const leaf = (v: boolean) => conditionLeaf(() => v)

describe('evaluateConditionTree', () => {
  it('short-circuits AND on first false and OR on first true', () => {
    const calls: string[] = []
    const andNode = conditionGroup('and', [
      leaf(true),
      {
        kind: 'leaf',
        test: () => {
          calls.push('a')
          return false
        },
      },
      {
        kind: 'leaf',
        test: () => {
          calls.push('b')
          return true
        },
      },
    ])
    expect(evaluateConditionTree(andNode)).toBe(false)
    expect(calls).toEqual(['a']) // 第三个叶子未被求值（短路）| third leaf never evaluated

    const orNode = conditionGroup('or', [
      leaf(false),
      {
        kind: 'leaf',
        test: () => {
          calls.push('c')
          return true
        },
      },
      {
        kind: 'leaf',
        test: () => {
          throw new Error('should not evaluate')
        },
      },
    ])
    expect(evaluateConditionTree(orNode)).toBe(true)
    expect(calls).toEqual(['a', 'c'])
  })

  it('handles nested groups and empty groups (vacuously true)', () => {
    const nested = conditionGroup('and', [
      leaf(true),
      conditionGroup('or', [leaf(false), leaf(true)]),
      conditionGroup('and', []),
    ])
    expect(evaluateConditionTree(nested)).toBe(true)

    expect(evaluateConditionTree(conditionGroup('and', []))).toBe(true)
  })

  it('treats a throwing leaf as a miss instead of crashing the evaluation', () => {
    const throwing = conditionLeaf(() => {
      throw new Error('bad row')
    })
    expect(evaluateConditionTree(conditionGroup('and', [leaf(true), throwing]))).toBe(false)
    expect(evaluateConditionTree(conditionGroup('or', [leaf(false), throwing]))).toBe(false)
    expect(evaluateConditionTree(throwing)).toBe(false)
  })
})

describe('\'group\' filter strategy', () => {
  const strategy = getFilterStrategy('group')!

  it('is registered with a default empty-and value', () => {
    expect(strategy).toBeDefined()
    expect(strategy.createDefaultValue()).toEqual({ type: 'group', logic: 'and', conditions: [] })
    expect(strategy.isActive(strategy.createDefaultValue() as any)).toBe(false)
  })

  it('judges every child against the SAME cell value by its own strategy', () => {
    const value: GroupFilterValue = {
      type: 'group',
      logic: 'and',
      conditions: [
        { type: 'number', operator: 'gt', value: 5 },
        { type: 'number', operator: 'lt', value: 100 },
      ],
    }
    expect(strategy.matches(10, value as any)).toBe(true)
    expect(strategy.matches(3, value as any)).toBe(false)
    expect(strategy.matches(500, value as any)).toBe(false)
  })

  it('supports OR logic and nested groups', () => {
    const value: GroupFilterValue = {
      type: 'group',
      logic: 'or',
      conditions: [
        { type: 'number', operator: 'lt', value: 0 },
        {
          type: 'group',
          logic: 'and',
          conditions: [
            { type: 'number', operator: 'gt', value: 100 },
            { type: 'number', operator: 'lt', value: 200 },
          ],
        },
      ],
    }
    expect(strategy.matches(-5, value as any)).toBe(true)
    expect(strategy.matches(150, value as any)).toBe(true)
    expect(strategy.matches(50, value as any)).toBe(false)
    expect(strategy.matches(500, value as any)).toBe(false)
  })

  it('isActive when ANY child is active', () => {
    const inactive: GroupFilterValue = {
      type: 'group',
      logic: 'and',
      conditions: [
        { type: 'text', operator: 'contains' }, // 无值 → 未激活 | no value → inactive
        { type: 'group', logic: 'and', conditions: [] }, // 空组 → 未激活 | empty → inactive
      ],
    }
    const active: GroupFilterValue = {
      type: 'group',
      logic: 'and',
      conditions: [{ type: 'number', operator: 'gt', value: 1 }],
    }
    expect(strategy.isActive(inactive as any)).toBe(false)
    expect(strategy.isActive(active as any)).toBe(true)
  })

  it('treats a malformed conditions array as vacuously true in matches', () => {
    expect(strategy.matches(42, { type: 'group', logic: 'and' } as any)).toBe(true)
  })
})
