/**
 * @file use-tree-data phase2 — 补充分支覆盖
 * Covers: treeConfig variants, expandAll, collapseAll, toggleExpand, flattenedData, childKey
 */
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useTreeData } from '../../src/composables/data/use-tree-data'

describe('useTreeData phase2 — basic tree', () => {
  it('returns flat data when tree is not enabled', () => {
    const data = ref([{ id: 1, name: 'Alice' }])
    const { flattenedData, treeEnabled } = useTreeData({
      treeConfig: () => undefined,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })
    expect(treeEnabled.value).toBe(false)
    expect(flattenedData.value).toEqual(data.value)
  })

  it('flattens tree data when enabled', () => {
    const data = ref([
      { id: 1, name: 'Parent', children: [
        { id: 2, name: 'Child 1' },
        { id: 3, name: 'Child 2' },
      ] },
    ])
    const { flattenedData, treeEnabled } = useTreeData({
      treeConfig: () => ({ children: 'children' } as any),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })
    expect(treeEnabled.value).toBe(true)
    // Only parent is visible initially (children are collapsed)
    expect(flattenedData.value).toHaveLength(1)
    expect(flattenedData.value[0].name).toBe('Parent')
  })
})

describe('useTreeData phase2 — expand/collapse', () => {
  it('expandAll expands all nodes', () => {
    const data = ref([
      { id: 1, name: 'Parent', children: [
        { id: 2, name: 'Child 1', children: [
          { id: 4, name: 'Grandchild' },
        ] },
        { id: 3, name: 'Child 2' },
      ] },
    ])
    const { flattenedData, expandAll } = useTreeData({
      treeConfig: () => ({ children: 'children' } as any),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expandAll()
    expect(flattenedData.value).toHaveLength(4)
  })

  it('collapseAll collapses all nodes', () => {
    const data = ref([
      { id: 1, name: 'Parent', children: [
        { id: 2, name: 'Child 1' },
      ] },
    ])
    const { flattenedData, expandAll, collapseAll } = useTreeData({
      treeConfig: () => ({ children: 'children' } as any),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expandAll()
    expect(flattenedData.value).toHaveLength(2)
    collapseAll()
    expect(flattenedData.value).toHaveLength(1)
  })

  it('toggleRowExpand toggles individual node', async () => {
    const data = ref([
      { id: 1, name: 'Parent', children: [
        { id: 2, name: 'Child 1' },
      ] },
    ])
    const { flattenedData, toggleRowExpand, expandedRowKeys } = useTreeData({
      treeConfig: () => ({ children: 'children' } as any),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(flattenedData.value).toHaveLength(1)
    expect(expandedRowKeys.value.has('1')).toBe(false)

    await toggleRowExpand(1)
    expect(expandedRowKeys.value.has('1')).toBe(true)
    expect(flattenedData.value).toHaveLength(2)

    await toggleRowExpand(1)
    expect(expandedRowKeys.value.has('1')).toBe(false)
    expect(flattenedData.value).toHaveLength(1)
  })
})

describe('useTreeData phase2 — defaultExpandAll', () => {
  it('expands all nodes on init when defaultExpandAll is true', () => {
    const data = ref([
      { id: 1, name: 'Parent', children: [
        { id: 2, name: 'Child 1' },
      ] },
    ])
    const { flattenedData } = useTreeData({
      treeConfig: () => ({ children: 'children', defaultExpandAll: true } as any),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(flattenedData.value).toHaveLength(2)
  })
})

describe('useTreeData phase2 — custom children key', () => {
  it('uses custom children key', () => {
    const data = ref([
      { id: 1, name: 'Parent', items: [
        { id: 2, name: 'Child 1' },
      ] },
    ])
    const { flattenedData, expandAll } = useTreeData({
      treeConfig: () => ({ children: 'items' } as any),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expandAll()
    expect(flattenedData.value).toHaveLength(2)
    expect(flattenedData.value[1].name).toBe('Child 1')
  })
})

describe('useTreeData phase2 — defaultExpandedRowKeys', () => {
  it('expands nodes matching defaultExpandedRowKeys', () => {
    const data = ref([
      { id: 1, name: 'Parent', children: [
        { id: 2, name: 'Child 1', children: [
          { id: 3, name: 'Grandchild' },
        ] },
      ] },
    ])
    const { flattenedData } = useTreeData({
      treeConfig: () => ({
        children: 'children',
        defaultExpandedRowKeys: [1],
      } as any),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    // Parent is expanded, child 1 is visible but not expanded
    expect(flattenedData.value).toHaveLength(2)
    expect(flattenedData.value[1].name).toBe('Child 1')
  })
})

describe('useTreeData phase2 — indent', () => {
  it('calculates indent level for flattened rows', () => {
    const data = ref([
      { id: 1, name: 'Parent', children: [
        { id: 2, name: 'Child', children: [
          { id: 3, name: 'Grandchild' },
        ] },
      ] },
    ])
    const { flattenedData, expandAll, getTreeMeta } = useTreeData({
      treeConfig: () => ({ children: 'children' } as any),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expandAll()
    const rows = flattenedData.value
    expect(getTreeMeta(rows[0])?.level).toBe(0)
    expect(getTreeMeta(rows[1])?.level).toBe(1)
    expect(getTreeMeta(rows[2])?.level).toBe(2)
  })
})
