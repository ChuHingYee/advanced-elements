import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useRowGroup } from '../../src/composables/data/use-row-group'

interface TestRow {
  id: number
  name: string
  department: string
  team?: string
}

const testData: TestRow[] = [
  { id: 1, name: 'Alice', department: 'Engineering', team: 'Frontend' },
  { id: 2, name: 'Bob', department: 'Engineering', team: 'Backend' },
  { id: 3, name: 'Charlie', department: 'Design', team: 'UI' },
  { id: 4, name: 'David', department: 'Engineering', team: 'Frontend' },
  { id: 5, name: 'Eve', department: 'Design', team: 'UX' },
]

describe('useRowGroup', () => {
  describe('分组禁用时', () => {
    it('rowGroupConfig 为 undefined 时透传数据', () => {
      const { groupedData } = useRowGroup({
        rowGroupConfig: ref(undefined),
        data: ref(testData),
      })

      expect(groupedData.value).toHaveLength(5)
      expect(groupedData.value).toEqual(testData)
    })

    it('rowGroupConfig 为 null 时也透传数据', () => {
      const { groupedData } = useRowGroup({
        rowGroupConfig: ref(null as any),
        data: ref(testData),
      })

      expect(groupedData.value).toHaveLength(5)
    })
  })

  describe('单字段分组', () => {
    it('按部门分组生成分组头行', () => {
      const { groupedData } = useRowGroup({
        rowGroupConfig: ref({ field: 'department' }),
        data: ref(testData),
      })

      // 默认 defaultExpandAll=true: Engineering header + 3条数据 + Design header + 2条数据 = 7
      expect(groupedData.value).toHaveLength(7)

      const headerRows = groupedData.value.filter((r: any) => r.__isGroupHeader)
      expect(headerRows).toHaveLength(2)

      const engHeader = headerRows[0] as any
      expect(engHeader.__groupValue).toBe('Engineering')
      expect(engHeader.__groupCount).toBe(3)
      expect(engHeader.__groupExpanded).toBe(true)
      expect(engHeader.__groupField).toBe('department')

      const designHeader = headerRows[1] as any
      expect(designHeader.__groupValue).toBe('Design')
      expect(designHeader.__groupCount).toBe(2)
    })

    it('展开的分组在 header 后紧跟数据行', () => {
      const { groupedData } = useRowGroup({
        rowGroupConfig: ref({ field: 'department' }),
        data: ref(testData),
      })

      // Engineering header 后应为 Engineering 的数据
      expect((groupedData.value[0] as any).__isGroupHeader).toBe(true)
      expect((groupedData.value[0] as any).__groupValue).toBe('Engineering')
      // 随后是 3 条 Engineering 数据
      expect(groupedData.value[1]).toEqual(testData[0]) // Alice
      expect(groupedData.value[2]).toEqual(testData[1]) // Bob
      expect(groupedData.value[3]).toEqual(testData[3]) // David
    })
  })

  describe('toggleGroupExpand', () => {
    it('折叠分组后只保留分组头', () => {
      const { groupedData, rowGroupApi } = useRowGroup({
        rowGroupConfig: ref({ field: 'department' }),
        data: ref(testData),
      })

      // 默认展开: 7 行
      expect(groupedData.value).toHaveLength(7)

      rowGroupApi.toggleGroupExpand('Engineering')
      // Engineering 行被折叠：只保留 Engineering header，Design 组不变
      // Engineering header + Design header + Charlie + Eve = 4
      expect(groupedData.value).toHaveLength(4)
      expect((groupedData.value[0] as any).__groupValue).toBe('Engineering')
      expect((groupedData.value[0] as any).__groupExpanded).toBe(false)
      expect((groupedData.value[1] as any).__groupValue).toBe('Design')
    })

    it('再次切换可重新展开分组', () => {
      const { groupedData, rowGroupApi } = useRowGroup({
        rowGroupConfig: ref({ field: 'department' }),
        data: ref(testData),
      })

      rowGroupApi.toggleGroupExpand('Engineering')
      expect(groupedData.value).toHaveLength(4)

      rowGroupApi.toggleGroupExpand('Engineering')
      expect(groupedData.value).toHaveLength(7)
    })
  })

  describe('expandAllGroups / collapseAllGroups', () => {
    it('collapseAllGroups 折叠所有分组', () => {
      const { groupedData, rowGroupApi } = useRowGroup({
        rowGroupConfig: ref({ field: 'department' }),
        data: ref(testData),
      })

      // 默认: Engineering header + Alice + Bob + David + Design header + Charlie + Eve = 7
      expect(groupedData.value).toHaveLength(7)

      rowGroupApi.collapseAllGroups()
      // 折叠后: Engineering header + Design header = 2
      expect(groupedData.value).toHaveLength(2)
      groupedData.value.forEach((r: any) => {
        expect(r.__isGroupHeader).toBe(true)
        expect(r.__groupExpanded).toBe(false)
      })
    })

    it('expandAllGroups 展开所有分组', () => {
      const { groupedData, rowGroupApi } = useRowGroup({
        rowGroupConfig: ref({ field: 'department', defaultExpandAll: false }),
        data: ref(testData),
      })

      // 初始折叠
      expect(groupedData.value).toHaveLength(2)

      rowGroupApi.expandAllGroups()
      // 展开后: Engineering header + Alice + Bob + David + Design header + Charlie + Eve = 7
      expect(groupedData.value).toHaveLength(7)
    })

    it('expandAllGroups 在无配置时静默返回', () => {
      const { rowGroupApi } = useRowGroup({
        rowGroupConfig: ref(undefined),
        data: ref(testData),
      })

      expect(() => rowGroupApi.expandAllGroups()).not.toThrow()
    })
  })

  describe('defaultExpandAll', () => {
    it('defaultExpandAll: true 默认展开所有分组', () => {
      const { groupedData } = useRowGroup({
        rowGroupConfig: ref({ field: 'department', defaultExpandAll: true }),
        data: ref(testData),
      })

      // Engineering header + Alice + Bob + David + Design header + Charlie + Eve = 7
      expect(groupedData.value).toHaveLength(7)
    })

    it('defaultExpandAll: false 默认折叠所有分组', () => {
      const { groupedData } = useRowGroup({
        rowGroupConfig: ref({ field: 'department', defaultExpandAll: false }),
        data: ref(testData),
      })

      // 仅显示 2 个分组头行
      expect(groupedData.value).toHaveLength(2)
      groupedData.value.forEach((r: any) => {
        expect(r.__isGroupHeader).toBe(true)
      })
    })

    it('defaultExpandedGroupValues 只展开指定分组', () => {
      const { groupedData } = useRowGroup({
        rowGroupConfig: ref({
          field: 'department',
          defaultExpandAll: false,
          defaultExpandedGroupValues: ['Engineering'],
        }),
        data: ref(testData),
      })

      // Engineering header + Alice + Bob + David + Design header = 5
      expect(groupedData.value).toHaveLength(5)
      const engHeader = groupedData.value[0] as any
      expect(engHeader.__groupValue).toBe('Engineering')
      expect(engHeader.__groupExpanded).toBe(true)
    })
  })

  describe('isGroupHeaderRow', () => {
    it('判断 __isGroupHeader 标记', () => {
      const { rowGroupApi } = useRowGroup({
        rowGroupConfig: ref({ field: 'department' }),
        data: ref(testData),
      })

      expect(rowGroupApi.isGroupHeaderRow({ __isGroupHeader: true })).toBe(true)
      expect(rowGroupApi.isGroupHeaderRow({ __isGroupHeader: false })).toBe(false)
      expect(rowGroupApi.isGroupHeaderRow({})).toBe(false)
      expect(rowGroupApi.isGroupHeaderRow(null)).toBe(false)
      expect(rowGroupApi.isGroupHeaderRow(undefined)).toBe(false)
    })
  })

  describe('多字段分组', () => {
    it('按 department + team 多字段嵌套分组', () => {
      const { groupedData } = useRowGroup({
        rowGroupConfig: ref({ field: ['department', 'team'] }),
        data: ref(testData),
      })

      // 默认 defaultExpandAll=true，collectAllGroupValues 递归收集全部层级，
      // 所有分组（含 team 第二级）均展开：
      // E-header + F-header + Alice + David + B-header + Bob +
      // D-header + UI-header + Charlie + UX-header + Eve = 11
      expect(groupedData.value).toHaveLength(11)

      const headers = groupedData.value.filter((r: any) => r.__isGroupHeader) as any[]
      expect(headers).toHaveLength(6)
      // 第一级: Engineering, Design（均展开）
      expect(headers[0].__groupValue).toBe('Engineering')
      expect(headers[0].__groupField).toBe('department')
      expect(headers[0].__groupExpanded).toBe(true)
      // Engineering 展开, 其子分组 Frontend/Backend 也展开
      expect(headers[1].__groupValue).toBe('Frontend')
      expect(headers[1].__groupField).toBe('team')
      expect(headers[1].__groupExpanded).toBe(true)
      expect(headers[2].__groupValue).toBe('Backend')
      expect(headers[2].__groupField).toBe('team')
      expect(headers[2].__groupExpanded).toBe(true)
      expect(headers[3].__groupValue).toBe('Design')
      expect(headers[3].__groupField).toBe('department')
      expect(headers[3].__groupExpanded).toBe(true)
      expect(headers[4].__groupValue).toBe('UI')
      expect(headers[4].__groupField).toBe('team')
      expect(headers[4].__groupExpanded).toBe(true)
      expect(headers[5].__groupValue).toBe('UX')
      expect(headers[5].__groupField).toBe('team')
      expect(headers[5].__groupExpanded).toBe(true)
    })

    it('多字段分组的展开只影响该叶子分组', () => {
      const { groupedData, rowGroupApi } = useRowGroup({
        rowGroupConfig: ref({ field: ['department', 'team'] }),
        data: ref(testData),
      })

      expect(groupedData.value).toHaveLength(11)

      // 折叠 Frontend（第二级 fieldIndex=1）— 移除 Alice + David
      rowGroupApi.toggleGroupExpand('Frontend', 1)
      // Engineering + Backend + Design + UI + UX 分组头 + 其余数据行 = 9
      expect(groupedData.value).toHaveLength(9)
      expect(groupedData.value.some((r: any) => r.__isGroupHeader && r.__groupValue === 'Frontend')).toBe(true)
      expect(groupedData.value.some((r: any) => r.name === 'Alice')).toBe(false)
      expect(groupedData.value.some((r: any) => r.name === 'David')).toBe(false)
    })
  })

  describe('groupEnabled', () => {
    it('有配置时 groupEnabled 为 true', () => {
      const { rowGroupApi } = useRowGroup({
        rowGroupConfig: ref({ field: 'department' }),
        data: ref(testData),
      })

      expect(rowGroupApi.groupEnabled.value).toBe(true)
    })

    it('无配置时 groupEnabled 为 false', () => {
      const { rowGroupApi } = useRowGroup({
        rowGroupConfig: ref(undefined),
        data: ref(testData),
      })

      expect(rowGroupApi.groupEnabled.value).toBe(false)
    })
  })

  describe('groupFields', () => {
    it('字符串字段转为单元素数组', () => {
      const { rowGroupApi } = useRowGroup({
        rowGroupConfig: ref({ field: 'department' }),
        data: ref(testData),
      })

      expect(rowGroupApi.groupFields.value).toEqual(['department'])
    })

    it('数组字段直接透传', () => {
      const { rowGroupApi } = useRowGroup({
        rowGroupConfig: ref({ field: ['department', 'team'] }),
        data: ref(testData),
      })

      expect(rowGroupApi.groupFields.value).toEqual(['department', 'team'])
    })
  })

  describe('expandedGroupValues', () => {
    it('默认展开行为正确', () => {
      const { rowGroupApi } = useRowGroup({
        rowGroupConfig: ref({ field: 'department', defaultExpandAll: false }),
        data: ref(testData),
      })

      expect(rowGroupApi.expandedGroupValues.value.size).toBe(0)
    })
  })
})
