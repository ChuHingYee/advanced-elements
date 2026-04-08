/**
 * @file use-tree-data phase3 — async loadData, getDescendantKeys, getAncestorKeys
 * Covers: loadData lazy loading, expandRow, collapseRow, findRowByKey fallback, unmount guards
 */
import type { TreeConfig } from '../../src/types/config'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useTreeData } from '../../src/composables/data/use-tree-data'

describe('useTreeData phase3 — async loadData', () => {
  it('loadData loads children on expand', async () => {
    const data = ref([{ id: 1, name: 'Parent' }])
    const loadData = vi.fn().mockResolvedValue([
      { id: 2, name: 'Child 1' },
      { id: 3, name: 'Child 2' },
    ])
    const config: TreeConfig = { children: 'children', loadData }

    const { flattenedData, toggleRowExpand, expandedRowKeys } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(flattenedData.value).toHaveLength(1)

    await toggleRowExpand(1)
    expect(loadData).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      1,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(expandedRowKeys.value.has('1')).toBe(true)
    expect(flattenedData.value).toHaveLength(3)
  })

  it('loadData is not called again after loaded', async () => {
    const data = ref([{ id: 1, name: 'Parent' }])
    const loadData = vi.fn().mockResolvedValue([{ id: 2, name: 'Child' }])
    const config: TreeConfig = { children: 'children', loadData }

    const { toggleRowExpand, flattenedData } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    // Access flattenedData to populate metaMap and keyToRow
    expect(flattenedData.value).toHaveLength(1)

    await toggleRowExpand(1)
    await toggleRowExpand(1) // collapse
    await toggleRowExpand(1) // expand again

    expect(loadData).toHaveBeenCalledTimes(1)
  })

  it('hasChildren field controls which nodes can lazy load', async () => {
    const data = ref([
      { id: 1, name: 'Parent', hasKids: true },
      { id: 2, name: 'Leaf', hasKids: false },
    ])
    const loadData = vi.fn().mockResolvedValue([])
    const config: TreeConfig = { children: 'children', loadData, hasChildren: 'hasKids' }

    const { getTreeMeta, flattenedData } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    const parentMeta = getTreeMeta(flattenedData.value[0])
    const leafMeta = getTreeMeta(flattenedData.value[1])

    expect(parentMeta?.hasChildren).toBe(true)
    expect(leafMeta?.hasChildren).toBe(false)
  })

  it('expandRow expands without toggling', async () => {
    const data = ref([{ id: 1, name: 'Parent', children: [{ id: 2, name: 'Child' }] }])
    const config: TreeConfig = { children: 'children' }

    const { flattenedData, expandRow, expandedRowKeys } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(flattenedData.value).toHaveLength(1)
    await expandRow(1)
    expect(expandedRowKeys.value.has('1')).toBe(true)
    expect(flattenedData.value).toHaveLength(2)

    // Calling expandRow again should be a no-op
    await expandRow(1)
    expect(expandedRowKeys.value.has('1')).toBe(true)
  })

  it('collapseRow collapses without toggling', async () => {
    const data = ref([{ id: 1, name: 'Parent', children: [{ id: 2, name: 'Child' }] }])
    const config: TreeConfig = { children: 'children', defaultExpandAll: true }

    const { flattenedData, collapseRow, expandedRowKeys } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(flattenedData.value).toHaveLength(2)
    collapseRow(1)
    expect(expandedRowKeys.value.has('1')).toBe(false)
    expect(flattenedData.value).toHaveLength(1)

    // Calling collapseRow again should be a no-op
    collapseRow(1)
    expect(expandedRowKeys.value.has('1')).toBe(false)
  })

  it('getDescendantKeys returns all descendant keys', () => {
    const data = ref([
      { id: 1, name: 'Parent', children: [
        { id: 2, name: 'Child 1', children: [
          { id: 3, name: 'Grandchild' },
        ] },
        { id: 4, name: 'Child 2' },
      ] },
    ])
    const config: TreeConfig = { children: 'children', defaultExpandAll: true }

    const { getDescendantKeys } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    const descendants = getDescendantKeys(1)
    expect(descendants.size).toBe(3)
    expect(descendants.has('2')).toBe(true)
    expect(descendants.has('3')).toBe(true)
    expect(descendants.has('4')).toBe(true)
  })

  it('getDescendantKeys returns empty set for non-existent key', () => {
    const data = ref([{ id: 1, name: 'Parent' }])
    const config: TreeConfig = { children: 'children' }

    const { getDescendantKeys } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    const descendants = getDescendantKeys(999)
    expect(descendants.size).toBe(0)
  })

  it('getDescendantKeys returns empty set when tree not enabled', () => {
    const data = ref([{ id: 1, name: 'Parent' }])

    const { getDescendantKeys } = useTreeData({
      treeConfig: () => undefined,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(getDescendantKeys(1).size).toBe(0)
  })

  it('getAncestorKeys returns all ancestor keys', () => {
    const data = ref([
      { id: 1, name: 'Root', children: [
        { id: 2, name: 'Mid', children: [
          { id: 3, name: 'Leaf' },
        ] },
      ] },
    ])
    const config: TreeConfig = { children: 'children', defaultExpandAll: true }

    const { getAncestorKeys, flattenedData } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    // Access flattenedData to populate metaMap and keyToRow
    expect(flattenedData.value).toHaveLength(3)

    const ancestors = getAncestorKeys(3)
    expect(ancestors).toEqual(['2', '1'])
  })

  it('getAncestorKeys returns empty array for root node', () => {
    const data = ref([{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }])
    const config: TreeConfig = { children: 'children', defaultExpandAll: true }

    const { getAncestorKeys, flattenedData } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    // Access flattenedData to populate metaMap
    expect(flattenedData.value).toHaveLength(2)
    expect(getAncestorKeys(1)).toEqual([])
  })

  it('getAncestorKeys returns empty array for non-existent key', () => {
    const data = ref([{ id: 1, name: 'Root' }])
    const config: TreeConfig = { children: 'children' }

    const { getAncestorKeys } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(getAncestorKeys(999)).toEqual([])
  })

  it('getAncestorKeys returns empty array when tree not enabled', () => {
    const data = ref([{ id: 1, name: 'Root' }])

    const { getAncestorKeys } = useTreeData({
      treeConfig: () => undefined,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(getAncestorKeys(1)).toEqual([])
  })

  it('collectAllKeys returns empty set when tree not enabled', () => {
    const data = ref([{ id: 1, name: 'Root' }])

    const { collectAllKeys } = useTreeData({
      treeConfig: () => undefined,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(collectAllKeys(data.value).size).toBe(0)
  })

  it('expandAll returns early when tree not enabled', () => {
    const data = ref([{ id: 1, name: 'Root' }])

    const { expandAll, expandedRowKeys } = useTreeData({
      treeConfig: () => undefined,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expandAll()
    expect(expandedRowKeys.value.size).toBe(0)
  })

  it('indent computed returns config indent or default 20', () => {
    const data = ref([{ id: 1, name: 'Root' }])

    const { indent: indentDefault } = useTreeData({
      treeConfig: () => ({ children: 'children' }),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })
    expect(indentDefault.value).toBe(20)

    const { indent: indentCustom } = useTreeData({
      treeConfig: () => ({ children: 'children', indent: 30 }),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })
    expect(indentCustom.value).toBe(30)
  })

  it('checkStrictly computed returns config value or default false', () => {
    const data = ref([{ id: 1, name: 'Root' }])

    const { checkStrictly: strictDefault } = useTreeData({
      treeConfig: () => ({ children: 'children' }),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })
    expect(strictDefault.value).toBe(false)

    const { checkStrictly: strictTrue } = useTreeData({
      treeConfig: () => ({ children: 'children', checkStrictly: true }),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })
    expect(strictTrue.value).toBe(true)
  })

  it('getTreeMeta returns undefined for non-object input', () => {
    const data = ref([{ id: 1, name: 'Root' }])

    const { getTreeMeta } = useTreeData({
      treeConfig: () => ({ children: 'children' }),
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(getTreeMeta(null)).toBeUndefined()
    expect(getTreeMeta(undefined)).toBeUndefined()
    expect(getTreeMeta('string')).toBeUndefined()
    expect(getTreeMeta(123)).toBeUndefined()
  })

  it('toggleRowExpand still expands when loadData returns non-array', async () => {
    const data = ref([{ id: 1, name: 'Parent' }])
    const loadData = vi.fn().mockResolvedValue(null)
    const config: TreeConfig = { children: 'children', loadData }

    const { toggleRowExpand, expandedRowKeys } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    await toggleRowExpand(1)
    // loadData returned null (not array), but loadChildren still returns true
    // so the row IS expanded, just without children data
    expect(expandedRowKeys.value.has('1')).toBe(true)
  })

  it('toggleRowExpand returns early for non-existent rowKey', async () => {
    const data = ref([{ id: 1, name: 'Parent' }])
    const loadData = vi.fn().mockResolvedValue([])
    const config: TreeConfig = { children: 'children', loadData }

    const { toggleRowExpand, expandedRowKeys } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    await toggleRowExpand(999)
    expect(expandedRowKeys.value.has('999')).toBe(false)
  })

  it('clears loading after loadData resolves even when a mid-load recompute occurred', async () => {
    const data = ref([{ id: 1, name: 'Parent' }])
    let resolveLoad!: (v: any[]) => void
    const loadPromise = new Promise<any[]>((resolve) => {
      resolveLoad = resolve
    })
    const loadData = vi.fn().mockReturnValue(loadPromise)
    const config: TreeConfig = { children: 'children', loadData }

    const { toggleRowExpand, flattenedData, getTreeMeta } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(flattenedData.value).toHaveLength(1)

    const togglePromise = toggleRowExpand(1)

    // 模拟渲染器在 loading 期间重渲染：重算 flattenedData/metaMap 会替换 meta 对象
    // Simulate a renderer re-render while loading is in flight: recomputing flattenedData/metaMap replaces the meta entry
    await nextTick()
    const loadingMeta = getTreeMeta(flattenedData.value[0])
    expect(loadingMeta?.loading).toBe(true)

    resolveLoad([{ id: 2, name: 'Child' }])
    await togglePromise

    const settledMeta = getTreeMeta(flattenedData.value[0])
    expect(settledMeta?.loading).toBe(false)
    expect(settledMeta?.loaded).toBe(true)
  })
})

describe('useTreeData with late-arriving data (request data source)', () => {
  const lateTreeData = [
    {
      id: '1',
      name: 'Root1',
      children: [
        {
          id: '1-1',
          name: 'Child1',
          children: [
            { id: '1-1-1', name: 'GrandChild' },
          ],
        },
        { id: '1-2', name: 'Child2' },
      ],
    },
    {
      id: '2',
      name: 'Root2',
      children: [
        { id: '2-1', name: 'Child3' },
      ],
    },
  ]

  it('defaultExpandAll is applied when data arrives after setup', async () => {
    const data = ref<any[]>([])
    const config: TreeConfig = {
      children: 'children',
      defaultExpandAll: true,
    }

    const { flattenedData } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(flattenedData.value).toHaveLength(0)

    // 模拟 request 数据到达：data 从空变为非空
    // Simulate request data arriving: data goes from empty to non-empty
    data.value = lateTreeData
    await nextTick()

    expect(flattenedData.value).toHaveLength(6)
  })

  it('defaultExpandedRowKeys is applied for keys that arrive later', async () => {
    const data = ref<any[]>([])
    const config: TreeConfig = {
      children: 'children',
      defaultExpandedRowKeys: ['1'],
    }

    const { flattenedData } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(flattenedData.value).toHaveLength(0)

    data.value = lateTreeData
    await nextTick()

    // 仅 '1' 展开 → Root1 + Child1 + Child2 + Root2 = 4；GrandChild 在折叠的 Child1 下
    // Only '1' expanded -> Root1 + Child1 + Child2 + Root2 = 4; GrandChild stays under collapsed Child1
    expect(flattenedData.value).toHaveLength(4)
  })

  it('sync data + defaultExpandAll still expands all', () => {
    const data = ref<any[]>(lateTreeData)
    const config: TreeConfig = {
      children: 'children',
      defaultExpandAll: true,
    }

    const { flattenedData } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(flattenedData.value).toHaveLength(6)
  })

  it('does not re-apply defaultExpandAll on data refresh after manual collapse', async () => {
    const data = ref<any[]>(lateTreeData)
    const config: TreeConfig = {
      children: 'children',
      defaultExpandAll: true,
    }

    const { flattenedData, collapseRow } = useTreeData({
      treeConfig: () => config,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })

    expect(flattenedData.value).toHaveLength(6)

    collapseRow('1')
    // 可见：Root1（折叠）+ Root2 + Child3 = 3
    // Visible: Root1 (collapsed) + Root2 + Child3 = 3
    expect(flattenedData.value).toHaveLength(3)

    // 数据刷新（新引用）不应重新展开全部
    // Data refresh (new reference) should not re-expand everything
    data.value = [...lateTreeData]
    await nextTick()
    expect(flattenedData.value).toHaveLength(3)
  })
})
