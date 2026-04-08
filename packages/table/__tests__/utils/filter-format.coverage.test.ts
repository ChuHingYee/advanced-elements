/**
 * <zh/> filter-format 覆盖补充测试——补齐 formatFilterCondition / registerFilterTextFormatter 未覆盖分支
 * <en/> filter-format coverage supplement — covers uncovered branches of formatFilterCondition / registerFilterTextFormatter
 */
import { describe, expect, it } from 'vitest'
import { formatFilterCondition, registerFilterTextFormatter } from '../../src/utils/filter-format'

// <zh/> 与 use-column-filter.test.ts 中的 describe 名区分，避免标题碰撞 | <en/> Distinct from the describe name in use-column-filter.test.ts to avoid title collision
describe('filter-format coverage supplement', () => {
  // <zh/> 操作符标签解析：t 命中与回退 | <en/> Operator label resolution: t hit vs fallback
  describe('resolveOpLabel branches', () => {
    // <zh/> t 返回翻译文案时直接采用 | <en/> Uses translated string when t returns a non-key value
    it('uses t translation when it differs from the key', () => {
      const tHit = (key: string) => key === 'table.filter.contains' ? '包含-HIT' : key
      expect(formatFilterCondition({ type: 'text', operator: 'contains', value: 'hi' }, undefined, tHit)).toBe('包含-HIT hi')
    })

    // <zh/> 数字操作符同样走 t 命中分支 | <en/> Number operator also takes the t-hit branch
    it('uses t translation for number operators', () => {
      const tHit = (key: string) => key === 'table.filter.gt' ? '大于-HIT' : key
      expect(formatFilterCondition({ type: 'number', operator: 'gt', value: 5 }, undefined, tHit)).toBe('大于-HIT 5')
    })

    // <zh/> t 原样返回 key 时回退英文 | <en/> Falls back to English when t returns the key itself
    it('falls back to English when t returns the key itself', () => {
      const tIdentity = (key: string) => key
      expect(formatFilterCondition({ type: 'text', operator: 'contains', value: 'hi' }, undefined, tIdentity)).toBe('Contains hi')
      expect(formatFilterCondition({ type: 'number', operator: 'gt', value: 5 }, undefined, tIdentity)).toBe('Greater than 5')
    })

    // <zh/> 未注入 t 时回退英文常量 | <en/> Falls back to English constants when t is missing
    it('falls back to English without t', () => {
      expect(formatFilterCondition({ type: 'text', operator: 'contains', value: 'hi' })).toBe('Contains hi')
    })

    // <zh/> 未知操作符回退为操作符本身 | <en/> Unknown operator falls back to the operator itself
    it('returns the operator itself for unknown ops', () => {
      expect(formatFilterCondition({ type: 'text', operator: 'mysteryOp' as any, value: 'x' })).toBe('mysteryOp x')
      expect(formatFilterCondition({ type: 'number', operator: 'mysteryOp' as any, value: 5 })).toBe('mysteryOp 5')
    })

    // <zh/> 空文本值直接返回空串 | <en/> Empty text value returns empty string
    it('returns empty for empty text value', () => {
      expect(formatFilterCondition({ type: 'text', operator: 'contains', value: '' })).toBe('')
      expect(formatFilterCondition({ type: 'text', operator: 'contains', value: undefined })).toBe('')
    })
  })

  // <zh/> 文本双条件 and/or 与空组合 | <en/> Text dual conditions with and/or logic and empty combos
  describe('text second condition', () => {
    // <zh/> 双条件非空时用 andLabel 连接 | <en/> Joins both non-empty parts with the and label
    it('joins both parts with and logic', () => {
      expect(formatFilterCondition({
        type: 'text',
        operator: 'contains',
        value: 'hello',
        conditions: { logic: 'and', condition: { operator: 'equals', value: 'world' } },
      })).toBe('Contains hello 且 Equals world')
    })

    // <zh/> 双条件非空时用 orLabel 连接 | <en/> Joins both non-empty parts with the or label
    it('joins both parts with or logic', () => {
      expect(formatFilterCondition({
        type: 'text',
        operator: 'contains',
        value: 'hello',
        conditions: { logic: 'or', condition: { operator: 'equals', value: 'world' } },
      })).toBe('Contains hello 或 Equals world')
    })

    // <zh/> 主条件为空时仅返回次条件 | <en/> Returns only the secondary part when primary is empty
    it('returns secondary when primary is empty', () => {
      expect(formatFilterCondition({
        type: 'text',
        operator: 'contains',
        value: '',
        conditions: { logic: 'and', condition: { operator: 'equals', value: 'fallback' } },
      })).toBe('Equals fallback')
    })

    // <zh/> 次条件为空时仅返回主条件 | <en/> Returns only the primary part when secondary is empty
    it('returns primary when secondary is empty', () => {
      expect(formatFilterCondition({
        type: 'text',
        operator: 'contains',
        value: 'hello',
        conditions: { logic: 'and', condition: { operator: 'equals', value: undefined } },
      })).toBe('Contains hello')
    })

    // <zh/> 双空时返回空串 | <en/> Returns empty string when both parts are empty
    it('returns empty when both parts are empty', () => {
      expect(formatFilterCondition({
        type: 'text',
        operator: 'contains',
        value: '',
        conditions: { logic: 'or', condition: { operator: 'equals', value: '' } },
      })).toBe('')
    })
  })

  // <zh/> 数字格式化：blank / between / 空值 | <en/> Number formatting: blank / between / empty value
  describe('number formatting', () => {
    // <zh/> blank 与 notBlank 直接返回标签 | <en/> blank and notBlank return their labels directly
    it('formats blank and notBlank labels', () => {
      expect(formatFilterCondition({ type: 'number', operator: 'blank' })).toBe('Is blank')
      expect(formatFilterCondition({ type: 'number', operator: 'notBlank' })).toBe('Is not blank')
    })

    // <zh/> blank 标签同样支持 t 翻译 | <en/> blank labels also honor t translation
    it('translates blank labels via t', () => {
      const tHit = (key: string) => key === 'table.filter.blank' ? '为空-HIT' : key
      expect(formatFilterCondition({ type: 'number', operator: 'blank' }, undefined, tHit)).toBe('为空-HIT')
    })

    // <zh/> between 双空返回空串 | <en/> between with both bounds null returns empty
    it('returns empty for between with both bounds null', () => {
      expect(formatFilterCondition({ type: 'number', operator: 'between' })).toBe('')
      expect(formatFilterCondition({ type: 'number', operator: 'between', min: undefined, max: undefined })).toBe('')
    })

    // <zh/> between 单边用问号占位 | <en/> between with one bound uses question-mark placeholders
    it('formats partial between with placeholders', () => {
      expect(formatFilterCondition({ type: 'number', operator: 'between', min: 10 })).toBe('10 ~ ?')
      expect(formatFilterCondition({ type: 'number', operator: 'between', max: 20 })).toBe('? ~ 20')
      expect(formatFilterCondition({ type: 'number', operator: 'between', min: 10, max: 20 })).toBe('10 ~ 20')
    })

    // <zh/> 非 between 无值返回空串，有值拼接标签 | <en/> Non-between without value is empty, with value joins the label
    it('returns empty for null value and label plus value otherwise', () => {
      expect(formatFilterCondition({ type: 'number', operator: 'eq' })).toBe('')
      expect(formatFilterCondition({ type: 'number', operator: 'eq', value: undefined })).toBe('')
      expect(formatFilterCondition({ type: 'number', operator: 'gt', value: 5 })).toBe('Greater than 5')
    })
  })

  // <zh/> 数字双条件逻辑与空组合 | <en/> Number dual-condition logic and empty combos
  describe('number second condition', () => {
    // <zh/> 双条件非空时 and 连接 | <en/> Joins both non-empty number parts with and
    it('joins both number parts with and logic', () => {
      expect(formatFilterCondition({
        type: 'number',
        operator: 'gt',
        value: 10,
        conditions: { logic: 'and', condition: { operator: 'lt', value: 20 } },
      })).toBe('Greater than 10 且 Less than 20')
    })

    // <zh/> 双条件非空时 or 连接 | <en/> Joins both non-empty number parts with or
    it('joins both number parts with or logic', () => {
      expect(formatFilterCondition({
        type: 'number',
        operator: 'gt',
        value: 10,
        conditions: { logic: 'or', condition: { operator: 'lt', value: 20 } },
      })).toBe('Greater than 10 或 Less than 20')
    })

    // <zh/> 主空返回次条件 | <en/> Returns secondary when number primary is empty
    it('returns secondary when number primary is empty', () => {
      expect(formatFilterCondition({
        type: 'number',
        operator: 'gt',
        conditions: { logic: 'and', condition: { operator: 'lt', value: 20 } },
      })).toBe('Less than 20')
    })

    // <zh/> 次空返回主条件 | <en/> Returns primary when number secondary is empty
    it('returns primary when number secondary is empty', () => {
      expect(formatFilterCondition({
        type: 'number',
        operator: 'gt',
        value: 10,
        conditions: { logic: 'and', condition: { operator: 'lt' } },
      })).toBe('Greater than 10')
    })

    // <zh/> 双空返回空串 | <en/> Returns empty when both number parts are empty
    it('returns empty when both number parts are empty', () => {
      expect(formatFilterCondition({
        type: 'number',
        operator: 'gt',
        conditions: { logic: 'or', condition: { operator: 'lt' } },
      })).toBe('')
    })
  })

  // <zh/> 日期格式化各分支 | <en/> Date formatting branches
  describe('date formatting', () => {
    // <zh/> between 双空返回空串 | <en/> between with no dates returns empty
    it('returns empty for date between without dates', () => {
      expect(formatFilterCondition({ type: 'date', operator: 'between' })).toBe('')
    })

    // <zh/> between 单边与双边占位 | <en/> between partial and full date ranges
    it('formats partial and full date between ranges', () => {
      expect(formatFilterCondition({ type: 'date', operator: 'between', startDate: '2024-01-01' })).toBe('2024-01-01 ~ ?')
      expect(formatFilterCondition({ type: 'date', operator: 'between', endDate: '2024-12-31' })).toBe('? ~ 2024-12-31')
      expect(formatFilterCondition({ type: 'date', operator: 'between', startDate: '2024-01-01', endDate: '2024-12-31' })).toBe('2024-01-01 ~ 2024-12-31')
    })

    // <zh/> before 有值拼接、无值置空 | <en/> before with value joins label, without value is empty
    it('formats before with and without value', () => {
      expect(formatFilterCondition({ type: 'date', operator: 'before', value: '2024-06-01' })).toBe('早于 2024-06-01')
      expect(formatFilterCondition({ type: 'date', operator: 'before' })).toBe('')
    })

    // <zh/> after 有值拼接、无值置空 | <en/> after with value joins label, without value is empty
    it('formats after with and without value', () => {
      expect(formatFilterCondition({ type: 'date', operator: 'after', value: '2024-06-01' })).toBe('晚于 2024-06-01')
      expect(formatFilterCondition({ type: 'date', operator: 'after' })).toBe('')
    })

    // <zh/> before/after 标签支持 t 翻译 | <en/> before/after labels honor t translation
    it('translates before and after labels via t', () => {
      const tHit = (key: string) => {
        if (key === 'table.filter.before')
          return 'BEFORE-HIT'
        if (key === 'table.filter.after')
          return 'AFTER-HIT'
        return key
      }
      expect(formatFilterCondition({ type: 'date', operator: 'before', value: '2024-06-01' }, undefined, tHit)).toBe('BEFORE-HIT 2024-06-01')
      expect(formatFilterCondition({ type: 'date', operator: 'after', value: '2024-06-01' }, undefined, tHit)).toBe('AFTER-HIT 2024-06-01')
    })

    // <zh/> 默认操作符直接回显 value，缺省为空串 | <en/> Default operators echo value or empty string
    it('echoes value for default date operators', () => {
      expect(formatFilterCondition({ type: 'date', operator: 'today', value: '2024-01-01' })).toBe('2024-01-01')
      expect(formatFilterCondition({ type: 'date', operator: 'today' })).toBe('')
      expect(formatFilterCondition({ type: 'date', operator: 'thisWeek', value: 'week-1' })).toBe('week-1')
    })
  })

  // <zh/> 枚举格式化：空选、标签映射、无选项拼接 | <en/> Enum formatting: empty, label mapping, plain join
  describe('enum formatting', () => {
    // <zh/> 空选返回空串 | <en/> Empty selection returns empty string
    it('returns empty for empty selection', () => {
      expect(formatFilterCondition({ type: 'enum', selected: [] })).toBe('')
      expect(formatFilterCondition({ type: 'enum', selected: undefined as any })).toBe('')
    })

    // <zh/> 有选项时映射标签，未命中回退 String(s) | <en/> Maps labels with options, unmapped falls back to String(s)
    it('maps labels with enumOptions and falls back for unmapped values', () => {
      expect(formatFilterCondition(
        { type: 'enum', selected: [1, 2, 99] },
        [{ label: 'One', value: 1 }, { label: 'Two', value: 2 }],
      )).toBe('One, Two, 99')
    })

    // <zh/> 无选项时直接拼接 | <en/> Joins raw values when no options are given
    it('joins raw values without options', () => {
      expect(formatFilterCondition({ type: 'enum', selected: ['a', 'b'] })).toBe('a, b')
      expect(formatFilterCondition({ type: 'enum', selected: ['a', 'b'] }, [])).toBe('a, b')
    })
  })

  // <zh/> 条件组格式化：空组、单项、多项括号 | <en/> Group formatting: empty, single, multi with parens
  describe('group formatting', () => {
    // <zh/> 空条件组返回空串 | <en/> Empty group returns empty string
    it('returns empty for empty group conditions', () => {
      expect(formatFilterCondition({ type: 'group', logic: 'and', conditions: [] })).toBe('')
    })

    // <zh/> 单个有效条件不加括号 | <en/> Single valid part returns without parens
    it('returns single part without parens', () => {
      const result = formatFilterCondition({
        type: 'group',
        logic: 'and',
        conditions: [{ type: 'text', operator: 'contains', value: 'hi' }],
      })
      expect(result).toBe('Contains hi')
    })

    // <zh/> 多条件仅一项有效时同样不加括号 | <en/> Multi conditions with one valid part skip parens
    it('returns single valid part without parens when others are empty', () => {
      const result = formatFilterCondition({
        type: 'group',
        logic: 'and',
        conditions: [
          { type: 'text', operator: 'contains', value: 'hi' },
          { type: 'text', operator: 'contains', value: '' },
        ],
      })
      expect(result).toBe('Contains hi')
    })

    // <zh/> 多项 and 加括号连接 | <en/> Multiple and parts join with parens
    it('joins multiple parts with and and parens', () => {
      expect(formatFilterCondition({
        type: 'group',
        logic: 'and',
        conditions: [
          { type: 'text', operator: 'contains', value: 'a' },
          { type: 'text', operator: 'contains', value: 'b' },
        ],
      })).toBe('(Contains a 且 Contains b)')
    })

    // <zh/> 多项 or 加括号连接 | <en/> Multiple or parts join with parens
    it('joins multiple parts with or and parens', () => {
      expect(formatFilterCondition({
        type: 'group',
        logic: 'or',
        conditions: [
          { type: 'text', operator: 'contains', value: 'a' },
          { type: 'text', operator: 'contains', value: 'b' },
        ],
      })).toBe('(Contains a 或 Contains b)')
    })

    // <zh/> 连接词支持 t 翻译 | <en/> Group connectors honor t translation
    it('translates group connectors via t', () => {
      const tHit = (key: string) => {
        if (key === 'table.filter.and')
          return 'AND-HIT'
        if (key === 'table.filter.or')
          return 'OR-HIT'
        return key
      }
      expect(formatFilterCondition({
        type: 'group',
        logic: 'and',
        conditions: [
          { type: 'text', operator: 'contains', value: 'a' },
          { type: 'text', operator: 'contains', value: 'b' },
        ],
      }, undefined, tHit)).toBe('(Contains a AND-HIT Contains b)')
    })

    // <zh/> 全部为空的子条件返回空串 | <en/> All-empty parts return empty string
    it('returns empty when all group parts are empty', () => {
      expect(formatFilterCondition({
        type: 'group',
        logic: 'and',
        conditions: [
          { type: 'text', operator: 'contains', value: '' },
          { type: 'enum', selected: [] },
        ],
      })).toBe('')
    })
  })

  // <zh/> 注册表：自定义类型与未知类型 | <en/> Registry: custom type and unknown type
  describe('formatter registry', () => {
    // <zh/> 注册自定义类型后可格式化 | <en/> Custom registered type formats as defined
    it('formats via a custom registered formatter', () => {
      registerFilterTextFormatter('coverage-custom-type', () => 'CUSTOM-COVERAGE')
      expect(formatFilterCondition({ type: 'coverage-custom-type' as any })).toBe('CUSTOM-COVERAGE')
    })

    // <zh/> 未知类型与空输入返回空串 | <en/> Unknown type and empty input return empty string
    it('returns empty for unknown type and undefined input', () => {
      expect(formatFilterCondition({ type: 'no-such-filter-type' as any })).toBe('')
      expect(formatFilterCondition(undefined)).toBe('')
    })
  })
})
