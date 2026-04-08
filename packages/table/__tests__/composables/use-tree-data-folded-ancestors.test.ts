import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useTreeData } from '../../src/composables/data/use-tree-data'

function setupFoldedTree() {
  const data = ref([
    { id: 1, name: 'Parent', children: [
      { id: 2, name: 'Child', children: [
        { id: 4, name: 'Grandchild' },
      ] },
      { id: 3, name: 'Child 2' },
    ] },
  ])
  const api = useTreeData({
    treeConfig: () => ({ children: 'children' } as any),
    data,
    rowKeyFn: () => (r: any) => r.id,
  })
  return { data, api }
}

describe('useTreeData folded getAncestorKeys fallback', () => {
  it('resolves ancestors of folded rows via the full nested path', () => {
    const { api } = setupFoldedTree()
    // <zh/> 默认折叠：展平仅含根，孙行无 meta | <en/> Folded by default: flatten holds only the root, the grandchild has no meta
    expect(api.flattenedData.value).toHaveLength(1)
    expect(api.getAncestorKeys(4)).toEqual(['2', '1'])
    expect(api.getAncestorKeys(2)).toEqual(['1'])
    expect(api.getAncestorKeys(1)).toEqual([])
  })

  it('still returns [] for absent keys', () => {
    const { api } = setupFoldedTree()
    expect(api.getAncestorKeys(999)).toEqual([])
  })

  it('expanded rows keep the meta fast path with identical results', () => {
    const { api } = setupFoldedTree()
    api.expandAll()
    expect(api.flattenedData.value).toHaveLength(4)
    expect(api.getAncestorKeys(4)).toEqual(['2', '1'])
  })
})
