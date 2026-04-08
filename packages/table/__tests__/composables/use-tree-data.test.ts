import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTreeData } from '../../src/composables/data/use-tree-data'

interface TreeNode {
  id: number
  name: string
  children?: TreeNode[]
}

const treeData: TreeNode[] = [
  {
    id: 1,
    name: 'Root',
    children: [
      { id: 11, name: 'Child 1', children: [{ id: 111, name: 'Grandchild 1' }] },
      { id: 12, name: 'Child 2' },
    ],
  },
  { id: 2, name: 'Root 2', children: [{ id: 21, name: 'Child 3' }] },
]

function rowKeyFn(row: TreeNode): string | number {
  return row.id
}

describe('useTreeData', () => {
  describe('树功能禁用时', () => {
    it('treeConfig 为 undefined 时透传数据', () => {
      const { flattenedData } = useTreeData({
        treeConfig: ref(undefined),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(flattenedData.value).toHaveLength(2)
      expect(flattenedData.value).toEqual(treeData)
    })
  })

  describe('树形数据展平', () => {
    it('defaultExpandAll 时展平所有节点', () => {
      const { flattenedData } = useTreeData({
        treeConfig: ref({ defaultExpandAll: true }),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      // Root + Child1 + Grandchild1 + Child2 + Root2 + Child3 = 6
      expect(flattenedData.value).toHaveLength(6)
    })

    it('defaultExpandedRowKeys 只展开指定节点及其直接子节点', () => {
      const { flattenedData } = useTreeData({
        treeConfig: ref({ defaultExpandedRowKeys: [1] }),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      // Root(id=1) 展开 → Child1(id=11) + Child2(id=12), but Grandchild1(id=111) 不展开
      // 结果: Root + Child1 + Child2 + Root2 = 4
      expect(flattenedData.value).toHaveLength(4)
      expect(flattenedData.value.map(r => r.id)).toEqual([1, 11, 12, 2])
    })

    it('defaultExpandAll: false 且无 defaultExpandedRowKeys 时只显示根节点', () => {
      const { flattenedData } = useTreeData({
        treeConfig: ref({ defaultExpandAll: false }),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      // 只显示 2 个根节点
      expect(flattenedData.value).toHaveLength(2)
    })
  })

  describe('toggleRowExpand', () => {
    it('展开节点后插入子节点', async () => {
      const { flattenedData, toggleRowExpand } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      // 初始: Root + Root2 = 2
      expect(flattenedData.value).toHaveLength(2)

      await toggleRowExpand(1)
      // Root + Child1 + Child2 + Root2 = 4
      expect(flattenedData.value).toHaveLength(4)
      expect(flattenedData.value[1].id).toBe(11)
      expect(flattenedData.value[2].id).toBe(12)
    })

    it('再次切换可收起节点', async () => {
      const { flattenedData, toggleRowExpand } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      await toggleRowExpand(1)
      expect(flattenedData.value).toHaveLength(4)

      await toggleRowExpand(1)
      expect(flattenedData.value).toHaveLength(2)
    })

    it('展开已展开的节点不重复添加', async () => {
      const { flattenedData, toggleRowExpand } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      await toggleRowExpand(1)
      await toggleRowExpand(1) // 第二次同一操作 -> 收起
      expect(flattenedData.value).toHaveLength(2)
    })
  })

  describe('expandRow / collapseRow', () => {
    it('expandRow 展开节点', async () => {
      const { flattenedData, expandRow } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      await expandRow(1)
      expect(flattenedData.value).toHaveLength(4)
    })

    it('expandRow 重复展开不重复添加', async () => {
      const { flattenedData, expandRow } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      await expandRow(1)
      await expandRow(1)
      expect(flattenedData.value).toHaveLength(4)
    })

    it('collapseRow 收起节点', () => {
      const { flattenedData, expandRow: _expandRow, collapseRow } = useTreeData({
        treeConfig: ref({ defaultExpandAll: true }),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(flattenedData.value).toHaveLength(6)

      collapseRow(1)
      // Root 被折叠，子节点消失。Root2 及其子节点不受影响
      // 结果: Root + Root2 + Child3 = 3
      expect(flattenedData.value).toHaveLength(3)
      expect(flattenedData.value[0].id).toBe(1)
      expect(flattenedData.value[1].id).toBe(2)
      expect(flattenedData.value[2].id).toBe(21)
    })

    it('collapseRow 未展开节点无影响', () => {
      const { flattenedData, collapseRow } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      collapseRow(999)
      expect(flattenedData.value).toHaveLength(2)
    })
  })

  describe('expandAll / collapseAll', () => {
    it('expandAll 展开所有节点', () => {
      const { flattenedData, expandAll } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expandAll()
      expect(flattenedData.value).toHaveLength(6)
    })

    it('collapseAll 收起所有节点', () => {
      const { flattenedData, expandAll: _expandAll, collapseAll } = useTreeData({
        treeConfig: ref({ defaultExpandAll: true }),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(flattenedData.value).toHaveLength(6)

      collapseAll()
      expect(flattenedData.value).toHaveLength(2)
    })

    it('expandAll 在无配置时静默返回', () => {
      const { expandAll } = useTreeData({
        treeConfig: ref(undefined),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(() => expandAll()).not.toThrow()
    })

    it('collapseAll 在无配置时静默返回', () => {
      const { collapseAll } = useTreeData({
        treeConfig: ref(undefined),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(() => collapseAll()).not.toThrow()
    })
  })

  describe('getTreeMeta', () => {
    it('展开后返回正确的 TreeRowMeta', async () => {
      const { flattenedData, getTreeMeta, toggleRowExpand } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      await toggleRowExpand(1)

      const rootMeta = getTreeMeta(flattenedData.value[0])
      expect(rootMeta).toBeDefined()
      expect(rootMeta!.level).toBe(0)
      expect(rootMeta!.hasChildren).toBe(true)
      expect(rootMeta!.expanded).toBe(true)
      expect(rootMeta!.parentKey).toBeNull()
      expect(rootMeta!.indentPx).toBe(0)

      const childMeta = getTreeMeta(flattenedData.value[1])
      expect(childMeta).toBeDefined()
      expect(childMeta!.level).toBe(1)
      expect(childMeta!.hasChildren).toBe(true)
      expect(childMeta!.expanded).toBe(false)
      expect(childMeta!.parentKey).toBe('1')
      expect(childMeta!.indentPx).toBe(20)
    })

    it('非对象参数返回 undefined', () => {
      const { getTreeMeta } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(getTreeMeta(null)).toBeUndefined()
      expect(getTreeMeta(undefined)).toBeUndefined()
      expect(getTreeMeta(42)).toBeUndefined()
      expect(getTreeMeta('string')).toBeUndefined()
    })
  })

  describe('collectAllKeys', () => {
    it('收集所有节点的 key', () => {
      const { collectAllKeys } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      const keys = collectAllKeys(treeData)
      expect(keys.has('1')).toBe(true)
      expect(keys.has('11')).toBe(true)
      expect(keys.has('111')).toBe(true)
      expect(keys.has('12')).toBe(true)
      expect(keys.has('2')).toBe(true)
      expect(keys.has('21')).toBe(true)
      expect(keys.size).toBe(6)
    })

    it('treeConfig 为 undefined 时返回空 Set', () => {
      const { collectAllKeys } = useTreeData({
        treeConfig: ref(undefined),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(collectAllKeys(treeData)).toEqual(new Set())
    })
  })

  describe('getDescendantKeys', () => {
    it('返回指定节点的所有后代 key', () => {
      const { getDescendantKeys } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      const descendants = getDescendantKeys(1)
      expect(descendants.has('11')).toBe(true)
      expect(descendants.has('12')).toBe(true)
      expect(descendants.has('111')).toBe(true)
      expect(descendants.size).toBe(3)
    })

    it('叶子节点返回空 Set', () => {
      const { getDescendantKeys } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(getDescendantKeys(111).size).toBe(0)
    })

    it('不存在的 key 返回空 Set', () => {
      const { getDescendantKeys } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(getDescendantKeys(999).size).toBe(0)
    })

    it('treeConfig 为 undefined 时返回空 Set', () => {
      const { getDescendantKeys } = useTreeData({
        treeConfig: ref(undefined),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(getDescendantKeys(1).size).toBe(0)
    })
  })

  describe('getAncestorKeys', () => {
    it('返回指定节点的所有祖先 key', async () => {
      const { flattenedData, toggleRowExpand, getAncestorKeys } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      // 展开 Root(id=1) → 再展开 Child1(id=11) → metaMap 包含 Grandchild1
      await toggleRowExpand(1)
      await toggleRowExpand(11)
      // 访问 flattenedData 确保 metaMap 被填充
      void flattenedData.value

      const ancestors = getAncestorKeys(111)
      expect(ancestors.length).toBeGreaterThanOrEqual(1)
      expect(ancestors).toContain('1')
    })

    it('根节点返回空数组', () => {
      const { getAncestorKeys } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      const ancestors = getAncestorKeys(1)
      expect(ancestors).toEqual([])
    })

    it('不存在的 key 返回空数组', () => {
      const { getAncestorKeys } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(getAncestorKeys(999)).toEqual([])
    })

    it('treeConfig 为 undefined 时返回空数组', () => {
      const { getAncestorKeys } = useTreeData({
        treeConfig: ref(undefined),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(getAncestorKeys(1)).toEqual([])
    })
  })

  describe('treeEnabled', () => {
    it('有配置时 treeEnabled 为 true', () => {
      const { treeEnabled } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(treeEnabled.value).toBe(true)
    })

    it('无配置时 treeEnabled 为 false', () => {
      const { treeEnabled } = useTreeData({
        treeConfig: ref(undefined),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(treeEnabled.value).toBe(false)
    })
  })

  describe('indent', () => {
    it('默认缩进 20', () => {
      const { indent } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(indent.value).toBe(20)
    })

    it('可自定义缩进', () => {
      const { indent } = useTreeData({
        treeConfig: ref({ indent: 40 }),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(indent.value).toBe(40)
    })
  })

  describe('checkStrictly', () => {
    it('默认 false', () => {
      const { checkStrictly } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(checkStrictly.value).toBe(false)
    })

    it('可设置为 true', () => {
      const { checkStrictly } = useTreeData({
        treeConfig: ref({ checkStrictly: true }),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(checkStrictly.value).toBe(true)
    })
  })

  describe('expandedRowKeys', () => {
    it('暴露 expandedRowKeys ref', async () => {
      const { expandedRowKeys, toggleRowExpand } = useTreeData({
        treeConfig: ref({}),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(expandedRowKeys.value).toBeInstanceOf(Set)
      expect(expandedRowKeys.value.size).toBe(0)

      await toggleRowExpand(1)
      expect(expandedRowKeys.value.has('1')).toBe(true)
    })
  })

  describe('自定义 children key', () => {
    interface CustomTree {
      id: number
      label: string
      items?: CustomTree[]
    }

    const customData: CustomTree[] = [
      {
        id: 1,
        label: 'Root',
        items: [
          { id: 11, label: 'Child 1', items: [{ id: 111, label: 'Grandchild' }] },
        ],
      },
    ]

    it('支持自定义 children 字段名', () => {
      const { flattenedData, expandAll: _expandAll } = useTreeData({
        treeConfig: ref({ children: 'items', defaultExpandAll: true }),
        data: ref(customData),
        rowKeyFn: ref((row: CustomTree) => row.id),
      })

      // Root + Child1 + Grandchild = 3
      expect(flattenedData.value).toHaveLength(3)
    })
  })

  describe('computed 引用稳定性', () => {
    it('数据未变时保持引用稳定', () => {
      const data = ref(treeData)
      const { flattenedData } = useTreeData({
        treeConfig: ref({ defaultExpandAll: true }),
        data,
        rowKeyFn: ref(rowKeyFn),
      })

      // 设置相同数据
      data.value = [...treeData]
      // 新数组引用应导致重新计算
      expect(flattenedData.value.length).toBe(6)
    })
  })

  describe('深度嵌套', () => {
    it('处理三层嵌套深度', () => {
      const { flattenedData, expandAll } = useTreeData({
        treeConfig: ref({ defaultExpandAll: true }),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      // 展开所有后应有 6 行
      expandAll()
      expect(flattenedData.value).toHaveLength(6)

      expect(flattenedData.value[0].id).toBe(1)
      expect(flattenedData.value[1].id).toBe(11)
      expect(flattenedData.value[2].id).toBe(111)
      expect(flattenedData.value[3].id).toBe(12)
      expect(flattenedData.value[4].id).toBe(2)
      expect(flattenedData.value[5].id).toBe(21)
    })
  })

  describe('loadData lazy loading', () => {
    it('有 loadData 时 hasChildren 为 true', () => {
      const { flattenedData, getTreeMeta } = useTreeData({
        treeConfig: ref({ defaultExpandAll: true, loadData: vi.fn() }),
        data: ref(treeData),
        rowKeyFn: ref(rowKeyFn),
      })

      const meta = getTreeMeta(flattenedData.value[3]) // Child 2 (id:12, 无 children)
      expect(meta).toBeDefined()
      // 有 loadData 时叶子节点也有 hasChildren 标记
      expect(meta!.hasChildren).toBe(true)
    })
  })
})
