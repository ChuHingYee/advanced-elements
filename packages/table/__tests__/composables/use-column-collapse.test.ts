import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { useColumnCollapse } from '../../src/composables/columns/use-column-collapse'

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

describe('useColumnCollapse', () => {
  const columns = [
    createGroupCol(
      [
        createCol({ prop: 'child1', columnGroupShow: 'open' as const, hidden: false }),
        createCol({ prop: 'child2', columnGroupShow: 'closed' as const, hidden: false }),
        createCol({ prop: 'child3', columnGroupShow: 'open' as const, hidden: false }),
      ],
      { key: 'group1', prop: 'group1', label: 'Group 1', hidden: false },
    ),
    createCol({ prop: 'normal', label: 'Normal Column', hidden: false }),
  ]

  function create(options?: { columns?: ProcessedColumn[] }) {
    return useColumnCollapse({
      columns: () => options?.columns ?? columns,
    })
  }

  describe('canCollapse', () => {
    it('should return false for non-group columns', () => {
      const { canCollapse } = create({ columns: [createCol()] })
      expect(canCollapse(createCol())).toBe(false)
    })

    it('should return false for group column without children', () => {
      const { canCollapse } = create()
      expect(canCollapse(createGroupCol([]))).toBe(false)
    })

    it('should return false for group column without columnGroupShow children', () => {
      const { canCollapse } = create({ columns: [createGroupCol([createCol()])] })
      expect(canCollapse(createGroupCol([createCol()]))).toBe(false)
    })

    it('should return true for group column with columnGroupShow children', () => {
      const { canCollapse } = create()
      expect(canCollapse(columns[0] as unknown as ProcessedColumn)).toBe(true)
    })
  })

  describe('isCollapsed', () => {
    it('should return false for undefined state', () => {
      const { isCollapsed } = create()
      expect(isCollapsed('nonexistent')).toBe(false)
    })

    it('should return true when column is collapsed', () => {
      const { isCollapsed, toggleCollapse } = create()
      toggleCollapse('group1')
      expect(isCollapsed('group1')).toBe(true)
    })

    it('should return false when column is expanded', () => {
      const { isCollapsed, toggleCollapse } = create()
      toggleCollapse('group1')
      toggleCollapse('group1')
      expect(isCollapsed('group1')).toBe(false)
    })
  })

  describe('toggleCollapse', () => {
    it('should toggle collapse state', () => {
      const { toggleCollapse, isCollapsed } = create()

      toggleCollapse('group1')
      expect(isCollapsed('group1')).toBe(true)

      toggleCollapse('group1')
      expect(isCollapsed('group1')).toBe(false)
    })

    it('should start collapsed when toggled first time', () => {
      const { toggleCollapse, isCollapsed } = create()

      toggleCollapse('new-group')
      expect(isCollapsed('new-group')).toBe(true)
    })

    it('should increment version on toggle', () => {
      const { toggleCollapse, collapsedVersion } = create()
      const initial = collapsedVersion.value

      toggleCollapse('group1')
      expect(collapsedVersion.value).toBe(initial + 1)
    })
  })

  describe('effectiveColumns', () => {
    it('should return original columns when not collapsed', () => {
      const { effectiveColumns } = create()
      expect(effectiveColumns.value).toHaveLength(2)
    })

    it('should filter open children when expanded', () => {
      const { effectiveColumns } = create()
      const groupCol = effectiveColumns.value[0] as unknown as ProcessedColumn
      expect((groupCol.children as any).length).toBeGreaterThan(0)
    })

    it('should show closed children when collapsed', () => {
      const { effectiveColumns, toggleCollapse } = create()

      toggleCollapse('group1')
      const groupCol = effectiveColumns.value[0] as unknown as ProcessedColumn

      expect(groupCol.children).toHaveLength(1)
      expect((groupCol.children as any)[0].prop).toBe('child2')
    })

    it('should include children without columnGroupShow regardless of collapse state', () => {
      const cols = [
        createGroupCol(
          [
            createCol({ prop: 'always-visible', columnGroupShow: undefined, hidden: false }),
            createCol({ prop: 'show-when-open', columnGroupShow: 'open' as const, hidden: false }),
          ],
          { key: 'group' },
        ),
      ]
      const { effectiveColumns, isCollapsed: _isCollapsed } = create({ columns: cols })

      expect((effectiveColumns.value[0].children as any)).toHaveLength(2)
    })
  })

  describe('collapsedState', () => {
    it('should be reactive', () => {
      const { collapsedState, toggleCollapse } = create()

      toggleCollapse('test-group')
      expect(collapsedState.value['test-group']).toBe(true)
    })

    it('should track multiple column states', () => {
      const { collapsedState, toggleCollapse } = create()

      toggleCollapse('group1')
      toggleCollapse('group2')

      expect(collapsedState.value.group1).toBe(true)
      expect(collapsedState.value.group2).toBe(true)
    })
  })

  describe('seedDefaultCollapsed', () => {
    it('should seed key-less groups by resolved key (internal id), without cross-pollution', () => {
      // <zh/> 生产链路 ensureColumnIds 会给无 key 组分配内部 ID；seed 必须与 buildFilteredTree
      // <zh/> 同口径（getColumnKey），否则多组共用 '' 互相污染。
      // <en/> The production chain assigns internal ids to key-less groups; seeding must use the same
      // <en/> caliber as buildFilteredTree (getColumnKey), or groups share the '' bucket and pollute each other.
      const cols = [
        createGroupCol(
          [createCol({ prop: 'a1', columnGroupShow: 'open' as const, hidden: false })],
          { label: 'Alpha', collapsed: true } as Partial<ProcessedColumn>,
        ),
        createGroupCol(
          [createCol({ prop: 'b1', columnGroupShow: 'open' as const, hidden: false })],
          { label: 'Beta' } as Partial<ProcessedColumn>,
        ),
      ]
      // <zh/> 模拟 ensureColumnIds 后的形态：删掉空串 prop（空串会遮蔽内部 ID），仅内部 ID 不同
      // <en/> Simulate post-ensureColumnIds shape: drop the empty-string prop (it shadows the
      // <en/> internal id), leaving distinct internal ids only
      for (const [i, id] of ['Alpha-0', 'Beta-1'].entries()) {
        const col = cols[i] as unknown as Record<string, unknown>
        delete col.prop
        delete col.key
        col.__advTableColumnId = id
      }
      const { isCollapsed } = create({ columns: cols })
      expect(isCollapsed('Alpha-0')).toBe(true)
      expect(isCollapsed('Beta-1')).toBe(false)
    })
  })

  describe('collapsedVersion', () => {
    it('should start at 0', () => {
      const { collapsedVersion } = create()
      expect(collapsedVersion.value).toBe(0)
    })

    it('should increment on each toggle', () => {
      const { collapsedVersion, toggleCollapse } = create()

      toggleCollapse('g1')
      expect(collapsedVersion.value).toBe(1)

      toggleCollapse('g2')
      expect(collapsedVersion.value).toBe(2)

      toggleCollapse('g1')
      expect(collapsedVersion.value).toBe(3)
    })
  })
})
