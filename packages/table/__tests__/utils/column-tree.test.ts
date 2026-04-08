import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import {
  buildFilteredTree,
  DEFAULT_COLUMN_WIDTH,
  extractLeafWidths,
  findColumnByKey,
  flattenLeafColumns,
  getLeafCount,
  validateColumns,
} from '../../src/utils/column-tree'
import { getColumnFixedGroup, isGroupColumn } from '../../src/utils/shared'

function createCol(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return {
    prop: '',
    label: '',
    ...overrides,
    hidden: false,
  } as unknown as ProcessedColumn
}

function createGroupCol(
  children: ProcessedColumn[],
  overrides: Partial<ProcessedColumn> = {},
): ProcessedColumn {
  return {
    ...createCol(overrides),
    children: children as any,
  } as unknown as ProcessedColumn
}

describe('column-tree', () => {
  describe('dEFAULT_COLUMN_WIDTH', () => {
    it('should be 150', () => {
      expect(DEFAULT_COLUMN_WIDTH).toBe(150)
    })
  })

  describe('isGroupColumn', () => {
    it('should return true for group column with children', () => {
      const col = createGroupCol([createCol()])
      expect(isGroupColumn(col)).toBe(true)
    })

    it('should return false for column without children', () => {
      const col = createCol()
      expect(isGroupColumn(col)).toBe(false)
    })

    it('should return false for column with empty children', () => {
      const col = createGroupCol([])
      expect(isGroupColumn(col)).toBe(false)
    })
  })

  describe('getLeafCount', () => {
    it('should return 0 for empty array', () => {
      expect(getLeafCount([])).toBe(0)
    })

    it('should return 1 for single leaf column', () => {
      const cols = [createCol()]
      expect(getLeafCount(cols)).toBe(1)
    })

    it('should count all leaf columns in group', () => {
      const cols = [
        createGroupCol([
          createCol(),
          createCol(),
        ]),
      ]
      expect(getLeafCount(cols)).toBe(2)
    })

    it('should count nested leaf columns', () => {
      const cols = [
        createGroupCol([
          createGroupCol([
            createCol(),
            createCol(),
          ]),
          createCol(),
        ]),
      ]
      expect(getLeafCount(cols)).toBe(3)
    })

    it('should ignore non-group columns', () => {
      const cols = [
        createCol(),
        createGroupCol([createCol()]),
        createCol(),
      ]
      expect(getLeafCount(cols)).toBe(3)
    })
  })

  describe('extractLeafWidths', () => {
    it('should return empty array for empty input', () => {
      expect(extractLeafWidths([])).toEqual([])
    })

    it('should use DEFAULT_COLUMN_WIDTH when width not specified', () => {
      const cols = [createCol()]
      expect(extractLeafWidths(cols)).toEqual([DEFAULT_COLUMN_WIDTH])
    })

    it('should use column width when specified', () => {
      const cols = [createCol({ width: 200 })]
      expect(extractLeafWidths(cols)).toEqual([200])
    })

    it('should extract widths from group columns', () => {
      const cols = [
        createGroupCol([
          createCol({ width: 100 }),
          createCol({ width: 150 }),
        ]),
      ]
      expect(extractLeafWidths(cols)).toEqual([100, 150])
    })

    it('should use DEFAULT_COLUMN_WIDTH for nested columns without width', () => {
      const cols = [
        createGroupCol([
          createGroupCol([createCol()]),
        ]),
      ]
      expect(extractLeafWidths(cols)).toEqual([DEFAULT_COLUMN_WIDTH])
    })

    it('should prefer getColumnWidth result over col.width when provided', () => {
      const cols = [
        createCol({ id: 'c1', width: 200 }),
        createCol({ id: 'c2', width: 100 }),
      ]
      const widths = extractLeafWidths(cols, col => (col as any).id === 'c1' ? 300 : undefined)
      expect(widths).toEqual([300, 100])
    })

    it('should pass getColumnWidth recursively to nested group columns', () => {
      const cols = [
        createGroupCol([
          createCol({ id: 'a', width: 200 }),
          createCol({ id: 'b', width: 150 }),
        ]),
      ]
      const widths = extractLeafWidths(cols, col => (col as any).width ? (col as any).width + 10 : undefined)
      expect(widths).toEqual([210, 160])
    })
  })

  describe('buildFilteredTree', () => {
    it('should return empty array for empty input', () => {
      expect(buildFilteredTree([])).toEqual([])
    })

    it('should pass through non-group columns', () => {
      const cols = [createCol({ prop: 'col1', hidden: false })]
      expect(buildFilteredTree(cols)).toEqual(cols)
    })

    it('should filter children based on columnGroupShow and collapse state', () => {
      const baseCol = createCol({ prop: 'base', hidden: false })
      const openCol = createCol({ prop: 'open', columnGroupShow: 'open' as const, hidden: false })
      const closedCol = createCol({ prop: 'closed', columnGroupShow: 'closed' as const, hidden: false })

      const groupCol = createGroupCol([baseCol, openCol, closedCol], { key: 'group', prop: 'group', hidden: false })

      const isCollapsedFn = (key: string) => key === 'group'

      const result = buildFilteredTree([groupCol], isCollapsedFn)

      expect(result[0].children).toHaveLength(2)
    })

    it('should show all children when columnGroupShow is undefined', () => {
      const child1 = createCol({ prop: 'child1', hidden: false })
      const child2 = createCol({ prop: 'child2', hidden: false })
      const groupCol = createGroupCol([child1, child2], { key: 'group' })

      const result = buildFilteredTree([groupCol])

      expect(result[0].children).toHaveLength(2)
    })

    it('should hide open children when collapsed', () => {
      const openChild = createCol({ prop: 'open', columnGroupShow: 'open' as const, hidden: false })
      const closedChild = createCol({ prop: 'closed', columnGroupShow: 'closed' as const, hidden: false })
      const groupCol = createGroupCol([openChild, closedChild], { key: 'group' })

      const isCollapsedFn = () => true
      const result = buildFilteredTree([groupCol], isCollapsedFn)

      expect(result[0].children).toHaveLength(1)
      expect((result[0].children as any)[0].prop).toBe('closed')
    })

    it('should hide closed children when expanded', () => {
      const openChild = createCol({ prop: 'open', columnGroupShow: 'open' as const, hidden: false })
      const closedChild = createCol({ prop: 'closed', columnGroupShow: 'closed' as const, hidden: false })
      const groupCol = createGroupCol([openChild, closedChild], { key: 'group' })

      const isCollapsedFn = () => false
      const result = buildFilteredTree([groupCol], isCollapsedFn)

      expect(result[0].children).toHaveLength(1)
      expect((result[0].children as any)[0].prop).toBe('open')
    })

    it('should handle nested groups', () => {
      const leaf1 = createCol({ prop: 'leaf1', hidden: false })
      const leaf2 = createCol({ prop: 'leaf2', hidden: false })
      const innerGroup = createGroupCol([leaf1], { key: 'inner' })
      const outerGroup = createGroupCol([innerGroup, leaf2], { key: 'outer' })

      const result = buildFilteredTree([outerGroup])

      expect(result[0].children).toHaveLength(2)
    })
  })

  /**
   * <zh/> 列展平单一真相
   * <zh/> 消费方分散从两处导入即成漂移源；现实现只存在于本文件。
   * <en/> Single source for column flattening — `utils/shared.ts` used to carry a
   * <en/> second equivalent implementation, so consumers importing from either site formed a drift
   * <en/> source; the implementation now lives only here.
   */
  describe('flattenLeafColumns', () => {
    it('returns flat columns as-is', () => {
      const cols = [{ prop: 'a', hidden: false }, { prop: 'b', hidden: false }]
      expect(flattenLeafColumns(cols)).toHaveLength(2)
    })

    it('flattens nested group columns', () => {
      const cols = [
        {
          prop: 'group1',
          children: [
            { prop: 'child1' },
            { prop: 'child2' },
          ],
          hidden: false,
        },
        { prop: 'leaf', hidden: false },
      ]
      const result = flattenLeafColumns(cols)
      expect(result).toHaveLength(3)
      expect(result[0].prop).toBe('child1')
      expect(result[1].prop).toBe('child2')
      expect(result[2].prop).toBe('leaf')
    })

    it('handles empty array', () => {
      expect(flattenLeafColumns([])).toEqual([])
    })

    it('treats a group with an empty children array as a leaf (isGroupColumn semantics)', () => {
      // <zh/> `isGroupColumn` 要求 children.length > 0，故空 children 的分组列按叶子输出——
      // <zh/> 合并前两处实现共用该判据，此断言把该边界钉死，防止未来任一处改判据造成漂移。
      // <en/> `isGroupColumn` requires children.length > 0, so a group with empty children is emitted
      // <en/> as a leaf — both implementations shared this predicate before the merge, and this pins
      // <en/> the edge so a future divergence in either copy becomes visible.
      const empty = { prop: 'emptyGroup', children: [], hidden: false }
      expect(flattenLeafColumns([empty])).toEqual([empty])
    })
  })

  describe('findColumnByKey', () => {
    it('should return undefined for empty array', () => {
      expect(findColumnByKey([], 'any')).toBeUndefined()
    })

    it('should find column by key', () => {
      const cols = [createCol({ key: 'col1' })]
      expect(findColumnByKey(cols, 'col1')).toBeDefined()
    })

    it('should find column by prop when key not present', () => {
      const cols = [createCol({ prop: 'col1', hidden: false })]
      expect(findColumnByKey(cols, 'col1')).toBeDefined()
    })

    it('should return undefined when not found', () => {
      const cols = [createCol({ key: 'col1' })]
      expect(findColumnByKey(cols, 'col2')).toBeUndefined()
    })

    it('should find column in nested groups', () => {
      const targetCol = createCol({ key: 'target' })
      const groupCol = createGroupCol([targetCol], { key: 'group' })
      const result = findColumnByKey([groupCol], 'target')

      expect(result).toBeDefined()
      expect(result?.key).toBe('target')
    })

    it('should search recursively through nested groups', () => {
      const deepCol = createCol({ key: 'deep' })
      const innerGroup = createGroupCol([deepCol], { key: 'inner' })
      const outerGroup = createGroupCol([innerGroup], { key: 'outer' })

      const result = findColumnByKey([outerGroup], 'deep')

      expect(result).toBeDefined()
      expect(result?.key).toBe('deep')
    })

    it('should return first match when there are duplicate keys', () => {
      const col1 = createCol({ key: 'duplicate' })
      const col2 = createCol({ key: 'duplicate' })
      const groupCol = createGroupCol([col1], { key: 'group' })

      const result = findColumnByKey([groupCol, col2], 'duplicate')

      expect(result).toBeDefined()
    })
  })

  describe('validateColumns', () => {
    it('returns empty array for valid columns', () => {
      const cols = [
        createCol({ prop: 'name' }),
        createCol({ prop: 'age' }),
      ]
      expect(validateColumns(cols)).toEqual([])
    })

    it('detects missing key on leaf column', () => {
      const cols = [createCol({ label: '无名列' })]
      const warnings = validateColumns(cols)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]!.code).toBe('TABLE_COLUMN_MISSING_KEY')
      expect(warnings[0]!.field).toBe('无名列')
    })

    it('detects duplicate keys', () => {
      const cols = [
        createCol({ prop: 'name' }),
        createCol({ key: 'name' }),
      ]
      const warnings = validateColumns(cols)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]!.code).toBe('TABLE_COLUMN_DUPLICATE_KEY')
      expect(warnings[0]!.field).toBe('name')
    })

    it('does not warn missing-key for group columns (identified by structure)', () => {
      const group = createGroupCol([createCol({ prop: 'child' })])
      // 分组列仅含 label、无 key
      delete (group as Record<string, unknown>).prop
      delete (group as Record<string, unknown>).key
      expect(validateColumns([group])).toEqual([])
    })

    // <zh/> selection/option 列由 ensureColumnIds 自动赋内置 key，属官方契约的免配 key 形态，
    // <zh/> 不应触发 TABLE_COLUMN_MISSING_KEY（回归：demo 基础用法误报警告）
    // <en/> selection/option columns get built-in keys from ensureColumnIds — sanctioned
    // <en/> keyless shapes that must NOT trigger TABLE_COLUMN_MISSING_KEY (regression: demo false warning)
    it('does not warn missing-key for selection column', () => {
      const sel = createCol({ label: '选择' }) as Record<string, unknown>
      delete sel.prop
      delete sel.key
      sel.selection = true
      expect(validateColumns([sel as any])).toEqual([])
    })

    it('does not warn missing-key for option (action) column', () => {
      const opt = createCol({ label: '操作' }) as Record<string, unknown>
      delete opt.prop
      delete opt.key
      opt.valueType = 'option'
      expect(validateColumns([opt as any])).toEqual([])
    })

    it('recurses into nested groups and reports deep missing keys', () => {
      const inner = createGroupCol([createCol({ label: '深层无名' })], { key: 'inner' })
      const outer = createGroupCol([inner], { key: 'outer' })
      const warnings = validateColumns([outer])
      expect(warnings).toHaveLength(1)
      expect(warnings[0]!.code).toBe('TABLE_COLUMN_MISSING_KEY')
    })

    it('does not warn when every leaf has a key', () => {
      const inner = createGroupCol([createCol({ prop: 'a' })], { key: 'inner' })
      const outer = createGroupCol([inner], { key: 'outer' })
      expect(validateColumns([outer])).toEqual([])
    })

    it('warns on non-positive width', () => {
      for (const width of [0, -50, Number.NaN]) {
        const warnings = validateColumns([createCol({ prop: 'w', width })])
        expect(warnings).toHaveLength(1)
        expect(warnings[0]!.code).toBe('TABLE_COLUMN_INVALID_WIDTH')
      }
    })

    it('does not warn on positive or absent width', () => {
      expect(validateColumns([createCol({ prop: 'a', width: 120 })])).toEqual([])
      expect(validateColumns([createCol({ prop: 'b' })])).toEqual([])
    })
  })

  describe('getColumnFixedGroup', () => {
    it('treats fixed:true as left (same caliber as drag guard and setting panel)', () => {
      expect(getColumnFixedGroup(createCol({ fixed: true } as any))).toBe('left')
      expect(getColumnFixedGroup(createCol({ fixed: 'left' } as any))).toBe('left')
      expect(getColumnFixedGroup(createCol({ fixed: 'right' } as any))).toBe('right')
      expect(getColumnFixedGroup(createCol({}))).toBe('normal')
      expect(getColumnFixedGroup(createCol({ fixed: undefined } as any))).toBe('normal')
    })
  })
})
