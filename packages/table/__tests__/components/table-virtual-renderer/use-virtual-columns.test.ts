/**
 * <zh/> useVirtualColumns 单元测试 | <en/> useVirtualColumns unit tests
 */
import type { ProcessedColumn } from '../../../src/types'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { hasFixedColumns, partitionColumnsByFixed, useVirtualColumns } from '../../../src/components/table-virtual-renderer/use-virtual-columns'

function makeColumn(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return {
    prop: 'col',
    label: 'Column',
    width: 100,
    hidden: false,
    ...overrides,
  } as ProcessedColumn
}

describe('hasFixedColumns', () => {
  it('returns false for empty array', () => {
    expect(hasFixedColumns([])).toBe(false)
  })

  it('returns false for columns without fixed', () => {
    expect(hasFixedColumns([makeColumn({ prop: 'a' }), makeColumn({ prop: 'b' })])).toBe(false)
  })

  it('returns true for column with fixed left', () => {
    expect(hasFixedColumns([makeColumn({ prop: 'a', fixed: 'left' })])).toBe(true)
  })

  it('returns true for column with fixed right', () => {
    expect(hasFixedColumns([makeColumn({ prop: 'a', fixed: 'right' })])).toBe(true)
  })

  it('returns true for group column with fixed child', () => {
    const group = makeColumn({
      prop: 'group',
      children: [makeColumn({ prop: 'child', fixed: 'left' })],
    } as any)
    expect(hasFixedColumns([group])).toBe(true)
  })

  it('returns false for group column without fixed children', () => {
    const group = makeColumn({
      prop: 'group',
      children: [makeColumn({ prop: 'child1' }), makeColumn({ prop: 'child2' })],
    } as any)
    expect(hasFixedColumns([group])).toBe(false)
  })
})

describe('partitionColumnsByFixed', () => {
  it('returns all as main when no fixed columns', () => {
    const cols = [makeColumn({ prop: 'a' }), makeColumn({ prop: 'b' })]
    const result = partitionColumnsByFixed(cols)
    expect(result.main).toEqual(cols)
    expect(result.left).toEqual([])
    expect(result.right).toEqual([])
  })

  it('partitions simple left/right/main columns', () => {
    const cols = [
      makeColumn({ prop: 'a', fixed: 'left' }),
      makeColumn({ prop: 'b' }),
      makeColumn({ prop: 'c', fixed: 'right' }),
    ]
    const result = partitionColumnsByFixed(cols)
    expect(result.left).toHaveLength(1)
    expect(result.left[0].prop).toBe('a')
    expect(result.main).toHaveLength(1)
    expect(result.main[0].prop).toBe('b')
    expect(result.right).toHaveLength(1)
    expect(result.right[0].prop).toBe('c')
  })

  it('partitions group column with mixed fixed children', () => {
    const group = makeColumn({
      prop: 'group',
      fixed: 'left',
      children: [
        makeColumn({ prop: 'child1', fixed: 'left' }),
        makeColumn({ prop: 'child2', fixed: 'right' }),
        makeColumn({ prop: 'child3' }),
      ],
    } as any)
    const result = partitionColumnsByFixed([group])
    expect(result.left).toHaveLength(1)
    expect(result.left[0].children).toHaveLength(1)
    expect(result.left[0].children[0].prop).toBe('child1')
    expect(result.right).toHaveLength(1)
    expect(result.right[0].children[0].prop).toBe('child2')
    expect(result.main).toHaveLength(1)
    expect(result.main[0].children[0].prop).toBe('child3')
  })

  it('partitions group column with fixed right and mixed children', () => {
    const group = makeColumn({
      prop: 'group',
      fixed: 'right',
      children: [
        makeColumn({ prop: 'child1', fixed: 'left' }),
        makeColumn({ prop: 'child2', fixed: 'right' }),
        makeColumn({ prop: 'child3' }),
      ],
    } as any)
    const result = partitionColumnsByFixed([group])
    expect(result.right).toHaveLength(1)
    expect(result.right[0].children[0].prop).toBe('child2')
    expect(result.left).toHaveLength(1)
    expect(result.left[0].children[0].prop).toBe('child1')
    expect(result.main).toHaveLength(1)
    expect(result.main[0].children[0].prop).toBe('child3')
  })

  it('partitions non-fixed group column with mixed fixed children', () => {
    const group = makeColumn({
      prop: 'group',
      children: [
        makeColumn({ prop: 'child1', fixed: 'left' }),
        makeColumn({ prop: 'child2', fixed: 'right' }),
        makeColumn({ prop: 'child3' }),
      ],
    } as any)
    const result = partitionColumnsByFixed([group])
    expect(result.left).toHaveLength(1)
    expect(result.left[0].children[0].prop).toBe('child1')
    expect(result.right).toHaveLength(1)
    expect(result.right[0].children[0].prop).toBe('child2')
    expect(result.main).toHaveLength(1)
    expect(result.main[0].children[0].prop).toBe('child3')
  })
})

describe('useVirtualColumns', () => {
  it('returns normalized columns with ids', () => {
    const cols = [makeColumn({ prop: 'a' }), makeColumn({ prop: 'b' })]
    const { normalizedColumns } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: () => 100,
    })
    expect(normalizedColumns.value).toHaveLength(2)
  })

  it('partitions columns by fixed direction', () => {
    const cols = [
      makeColumn({ prop: 'a', fixed: 'left' }),
      makeColumn({ prop: 'b' }),
      makeColumn({ prop: 'c', fixed: 'right' }),
    ]
    const { partitionedColumns } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: () => 100,
    })
    expect(partitionedColumns.value.left).toHaveLength(1)
    expect(partitionedColumns.value.main).toHaveLength(1)
    expect(partitionedColumns.value.right).toHaveLength(1)
  })

  it('computes mainRawColumns, leftRawColumns, rightRawColumns', () => {
    const cols = [
      makeColumn({ prop: 'a', fixed: 'left' }),
      makeColumn({ prop: 'b' }),
    ]
    const { mainRawColumns, leftRawColumns, rightRawColumns } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: () => 100,
    })
    expect(mainRawColumns.value).toHaveLength(1)
    expect(leftRawColumns.value).toHaveLength(1)
    expect(rightRawColumns.value).toHaveLength(0)
  })

  it('filters collapsed columns via isCollapsed', () => {
    const cols = [
      makeColumn({ prop: 'a' }),
      makeColumn({ prop: 'b', children: [makeColumn({ prop: 'b1' }), makeColumn({ prop: 'b2' })] } as any),
    ]
    const { mainFiltered } = useVirtualColumns({
      columns: () => cols,
      isCollapsed: (key: string) => key === 'b',
      getColumnWidth: () => 100,
    })
    // b is collapsed, so its children should be filtered out
    expect(mainFiltered.value).toHaveLength(2)
  })

  it('computes depth for each partition', () => {
    const cols = [
      makeColumn({ prop: 'a' }),
      makeColumn({ prop: 'b', children: [makeColumn({ prop: 'b1' })] } as any),
    ]
    const { mainDepth } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: () => 100,
    })
    expect(mainDepth.value).toBe(2)
  })

  it('computes leaf widths', () => {
    const cols = [
      makeColumn({ prop: 'a', width: 100 }),
      makeColumn({ prop: 'b', width: 200 }),
    ]
    const { mainLeafWidths } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: col => col.width ?? 100,
    })
    expect(mainLeafWidths.value).toEqual([100, 200])
  })

  it('computes leaf columns', () => {
    const cols = [
      makeColumn({ prop: 'a' }),
      makeColumn({ prop: 'b', children: [makeColumn({ prop: 'b1' }), makeColumn({ prop: 'b2' })] } as any),
    ]
    const { mainLeaves } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: () => 100,
    })
    expect(mainLeaves.value).toHaveLength(3)
  })

  it('computes allLeaves combining all partitions', () => {
    const cols = [
      makeColumn({ prop: 'a', fixed: 'left' }),
      makeColumn({ prop: 'b' }),
      makeColumn({ prop: 'c', fixed: 'right' }),
    ]
    const { allLeaves } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: () => 100,
    })
    expect(allLeaves.value).toHaveLength(3)
  })

  it('computes preparedColumns with all properties', () => {
    const cols = [
      makeColumn({ prop: 'a' }),
      makeColumn({ prop: 'b', fixed: 'left' }),
    ]
    const { preparedColumns } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: () => 100,
    })
    expect(preparedColumns.value.mainFiltered).toBeDefined()
    expect(preparedColumns.value.leftFiltered).toBeDefined()
    expect(preparedColumns.value.rightFiltered).toBeDefined()
    expect(preparedColumns.value.mainLeafWidths).toBeDefined()
    expect(preparedColumns.value.leftLeafWidths).toBeDefined()
    expect(preparedColumns.value.rightLeafWidths).toBeDefined()
    expect(preparedColumns.value.mainLeaves).toBeDefined()
    expect(preparedColumns.value.leftLeaves).toBeDefined()
    expect(preparedColumns.value.rightLeaves).toBeDefined()
    expect(preparedColumns.value.allLeaves).toBeDefined()
    expect(preparedColumns.value.maxDepth).toBe(1)
  })

  it('returns same reference for preparedColumns when inputs do not change', () => {
    const cols = [makeColumn({ prop: 'a' })]
    const { preparedColumns } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: () => 100,
    })
    const first = preparedColumns.value
    // Access again — should return the same reference (computed memoization)
    expect(preparedColumns.value).toBe(first)
  })

  it('updates when columns change reactively', () => {
    const colsRef = ref([makeColumn({ prop: 'a' })])
    const { normalizedColumns } = useVirtualColumns({
      columns: () => colsRef.value,
      getColumnWidth: () => 100,
    })
    expect(normalizedColumns.value).toHaveLength(1)
    colsRef.value = [makeColumn({ prop: 'a' }), makeColumn({ prop: 'b' })]
    expect(normalizedColumns.value).toHaveLength(2)
  })

  it('computes leftDepth and rightDepth', () => {
    const cols = [
      makeColumn({ prop: 'a', fixed: 'left', children: [makeColumn({ prop: 'a1' }), makeColumn({ prop: 'a2' })] } as any),
      makeColumn({ prop: 'b', fixed: 'right' }),
    ]
    const { leftDepth, rightDepth } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: () => 100,
    })
    expect(leftDepth.value).toBe(2)
    expect(rightDepth.value).toBe(1)
  })

  it('computes leftLeafWidths and rightLeafWidths', () => {
    const cols = [
      makeColumn({ prop: 'a', fixed: 'left', width: 120 }),
      makeColumn({ prop: 'b', fixed: 'right', width: 80 }),
    ]
    const { leftLeafWidths, rightLeafWidths } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: col => col.width ?? 100,
    })
    expect(leftLeafWidths.value).toEqual([120])
    expect(rightLeafWidths.value).toEqual([80])
  })

  it('computes leftLeaves and rightLeaves', () => {
    const cols = [
      makeColumn({ prop: 'a', fixed: 'left' }),
      makeColumn({ prop: 'b', fixed: 'right' }),
    ]
    const { leftLeaves, rightLeaves } = useVirtualColumns({
      columns: () => cols,
      getColumnWidth: () => 100,
    })
    expect(leftLeaves.value).toHaveLength(1)
    expect(rightLeaves.value).toHaveLength(1)
  })
})
