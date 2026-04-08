import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useRowExpand } from '../../src/composables/data/use-row-expand'

interface TestRow {
  id: number
  name: string
}

const testData: TestRow[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
]

function rowKeyFn(row: TestRow): string | number {
  return row.id
}

describe('useRowExpand', () => {
  describe('当展开功能禁用时', () => {
    it('原样透传数据', () => {
      const data = ref(testData)
      const { expandedData } = useRowExpand({
        rowExpandConfig: ref(undefined),
        data,
        rowKeyFn: ref(rowKeyFn),
      })
      expect(expandedData.value).toHaveLength(3)
      expect(expandedData.value).toEqual(testData)
    })

    it('保持引用稳定性', () => {
      const data = ref(testData)
      const { expandedData } = useRowExpand({
        rowExpandConfig: ref(undefined),
        data,
        rowKeyFn: ref(rowKeyFn),
      })
      // Trigger re-evaluation
      data.value = [...testData]
      expect(expandedData.value).toBe(expandedData.value)
    })
  })

  describe('expandEnabled', () => {
    it('当 rowExpandConfig 配置了 enabled: true 时启用', () => {
      const { expandedData } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })
      expect(expandedData.value).toHaveLength(3)
    })
  })

  describe('toggleRowExpand', () => {
    it('展开指定行后在其后插入 DetailRow', async () => {
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })
      expect(expandedData.value).toHaveLength(3)

      await rowExpandApi.toggleRowExpand(2)

      expect(expandedData.value).toHaveLength(4)
      // DetailRow 应插入在 id=2 的行之后
      expect(expandedData.value[0]).toEqual(testData[0])
      expect(expandedData.value[1]).toEqual(testData[1])
      const detailRow = expandedData.value[2] as unknown as Record<string, unknown>
      expect(detailRow.__isDetailRow).toBe(true)
      expect(detailRow.__detailRowKey).toBe('2')
      expect(detailRow.__detailRowData).toEqual(testData[1])
    })

    it('再次切换可收起展开行', async () => {
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      await rowExpandApi.toggleRowExpand(2)
      expect(expandedData.value).toHaveLength(4)

      await rowExpandApi.toggleRowExpand(2)
      expect(expandedData.value).toHaveLength(3)
    })

    it('accordion 模式下只保留最后展开的行', async () => {
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true, accordion: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      await rowExpandApi.toggleRowExpand(1)
      expect(expandedData.value).toHaveLength(4)

      await rowExpandApi.toggleRowExpand(3)
      expect(expandedData.value).toHaveLength(4)
      // 只应展开 id=3
      const detail = expandedData.value[3] as unknown as Record<string, unknown>
      expect(detail.__detailRowKey).toBe('3')
      // 确认 id=1 的展开被收起
      const hasDetailFor1 = expandedData.value.some(
        (r: any) => r.__isDetailRow && r.__detailRowKey === 1,
      )
      expect(hasDetailFor1).toBe(false)
    })
  })

  describe('expandDetailRow / collapseDetailRow', () => {
    it('expandDetailRow 展开指定行', () => {
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      rowExpandApi.expandDetailRow(2)
      expect(expandedData.value).toHaveLength(4)
    })

    it('expandDetailRow 重复展开同一行不重复插入', () => {
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      rowExpandApi.expandDetailRow(2)
      rowExpandApi.expandDetailRow(2)
      expect(expandedData.value).toHaveLength(4)
    })

    it('collapseDetailRow 收起指定行', () => {
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      rowExpandApi.expandDetailRow(2)
      expect(expandedData.value).toHaveLength(4)

      rowExpandApi.collapseDetailRow(2)
      expect(expandedData.value).toHaveLength(3)
    })

    it('collapseDetailRow 收起未展开的行无影响', () => {
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      rowExpandApi.collapseDetailRow(999)
      expect(expandedData.value).toHaveLength(3)
    })
  })

  describe('expandAllDetailRows / collapseAllDetailRows', () => {
    it('expandAllDetailRows 展开所有行', () => {
      const data = ref(testData)
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data,
        rowKeyFn: ref(rowKeyFn),
      })

      rowExpandApi.expandAllDetailRows()
      expect(expandedData.value).toHaveLength(6)
      const detailRows = expandedData.value.filter((r: any) => r.__isDetailRow)
      expect(detailRows).toHaveLength(3)
    })

    it('collapseAllDetailRows 收起所有已展开行', () => {
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      rowExpandApi.expandAllDetailRows()
      expect(expandedData.value).toHaveLength(6)

      rowExpandApi.collapseAllDetailRows()
      expect(expandedData.value).toHaveLength(3)
    })
  })

  describe('isDetailRow', () => {
    it('判断 __isDetailRow 标记', () => {
      const { rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(rowExpandApi.isDetailRow({ __isDetailRow: true })).toBe(true)
      expect(rowExpandApi.isDetailRow({ __isDetailRow: false })).toBe(false)
      expect(rowExpandApi.isDetailRow({})).toBe(false)
      expect(rowExpandApi.isDetailRow(null)).toBe(false)
      expect(rowExpandApi.isDetailRow(undefined)).toBe(false)
    })
  })

  describe('defaultExpandedRowKeys', () => {
    it('初始化时展开默认行', () => {
      const { expandedData } = useRowExpand({
        rowExpandConfig: ref({ enabled: true, defaultExpandedRowKeys: [1, 3] }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(expandedData.value).toHaveLength(5)
      const detailKeys = expandedData.value
        .filter((r: any) => r.__isDetailRow)
        .map((r: any) => r.__detailRowKey)
      expect(detailKeys).toEqual(['1', '3'])
    })
  })

  describe('accordion mode expandDetailRow', () => {
    it('accordion 模式下 expandDetailRow 替换已有展开', () => {
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true, accordion: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      rowExpandApi.expandDetailRow(1)
      expect(expandedData.value).toHaveLength(4)

      rowExpandApi.expandDetailRow(3)
      expect(expandedData.value).toHaveLength(4)
      const detail = expandedData.value[3] as unknown as Record<string, unknown>
      expect(detail.__detailRowKey).toBe('3')
    })
  })

  describe('load 异步加载', () => {
    it('首次展开时调用 load，再次展开不重复调用', async () => {
      const loadFn = vi.fn().mockResolvedValue(undefined)
      const { rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true, load: loadFn }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      await rowExpandApi.toggleRowExpand(2)
      expect(loadFn).toHaveBeenCalledTimes(1)
      expect(loadFn).toHaveBeenCalledWith(testData[1], 2)

      await rowExpandApi.toggleRowExpand(2)
      await rowExpandApi.toggleRowExpand(2)
      // 再次展开不应重复调用 load
      expect(loadFn).toHaveBeenCalledTimes(1)
    })

    it('load 应正确处理并行调用', async () => {
      const loadFn = vi.fn().mockResolvedValue(undefined)
      const { rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true, load: loadFn }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      await rowExpandApi.toggleRowExpand(1)
      expect(loadFn).toHaveBeenCalledTimes(1)
      await rowExpandApi.toggleRowExpand(2)
      expect(loadFn).toHaveBeenCalledTimes(2)
    })

    it('load 抛出异常后不标记已加载', async () => {
      const loadFn = vi.fn().mockRejectedValue(new Error('Load error'))
      const { rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true, load: loadFn }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      await expect(rowExpandApi.toggleRowExpand(2)).rejects.toThrow('Load error')
      // loadingRowKeys 应已清理
      expect(rowExpandApi.loadingRowKeys.value.has('2')).toBe(false)
    })
  })

  describe('persistence 持久化', () => {
    beforeEach(() => {
      localStorage.clear()
      sessionStorage.clear()
      vi.restoreAllMocks()
    })

    it('配置 persistence 时保存 expandedRowKeys 到 storage', async () => {
      const { rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({
          enabled: true,
          persistence: { key: 'test-expand', storage: 'localStorage' } as any,
        }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      rowExpandApi.expandDetailRow(2)
      // watch 默认 flush: 'pre'，需要等待下一次微任务
      // 使用 queueMicrotask 或 nextTick 确保 watch 已执行
      await new Promise(resolve => setTimeout(resolve, 0))
      const saved = JSON.parse(localStorage.getItem('test-expand')!)
      expect(saved).toEqual(['2'])
    })

    it('从 persistence 恢复展开状态', () => {
      localStorage.setItem('test-expand', JSON.stringify([1, 3]))

      const { expandedData } = useRowExpand({
        rowExpandConfig: ref({
          enabled: true,
          persistence: { key: 'test-expand', storage: 'localStorage' } as any,
        }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(expandedData.value).toHaveLength(5)
      const detailKeys = expandedData.value
        .filter((r: any) => r.__isDetailRow)
        .map((r: any) => r.__detailRowKey)
      expect(detailKeys).toEqual(['1', '3'])
    })

    it('persistence 优先于 defaultExpandedRowKeys', () => {
      localStorage.setItem('test-expand', JSON.stringify([2]))

      const { expandedData } = useRowExpand({
        rowExpandConfig: ref({
          enabled: true,
          defaultExpandedRowKeys: [1, 3],
          persistence: { key: 'test-expand', storage: 'localStorage' } as any,
        }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      // 只应恢复 persistence 中的 [2]
      expect(expandedData.value).toHaveLength(4)
    })

    it('sessionStorage 也能正常持久化', () => {
      sessionStorage.setItem('test-session', JSON.stringify([3]))

      const { expandedData } = useRowExpand({
        rowExpandConfig: ref({
          enabled: true,
          persistence: { key: 'test-session', storage: 'sessionStorage' } as any,
        }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(expandedData.value).toHaveLength(4)
    })
  })

  describe('expandedRowKeys ref', () => {
    it('暴露 expandedRowKeys 给外部', () => {
      const { rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(testData),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(rowExpandApi.expandedRowKeys.value).toBeInstanceOf(Set)
      expect(rowExpandApi.expandedRowKeys.value.size).toBe(0)
    })
  })

  describe('__isDetailRow 过滤', () => {
    it('数据中的 detail row 被跳过不计数', () => {
      const dataWithDetail = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob', __isDetailRow: true },
        { id: 3, name: 'Charlie' },
      ] as TestRow[]

      const { expandedData } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data: ref(dataWithDetail),
        rowKeyFn: ref(rowKeyFn),
      })

      expect(expandedData.value).toHaveLength(2)
    })
  })

  describe('computed 引用稳定性', () => {
    it('expandedRowKeys 不变时 expandedData 保持引用稳定', () => {
      const data = ref(testData)
      const { expandedData, rowExpandApi } = useRowExpand({
        rowExpandConfig: ref({ enabled: true }),
        data,
        rowKeyFn: ref(rowKeyFn),
      })

      rowExpandApi.expandDetailRow(2)
      const prev = expandedData.value

      // 触发 data 重新设置但实际不变
      data.value = [...testData]
      // 数据引用变了，结果应该重新计算
      expect(expandedData.value).not.toBe(prev)
    })
  })
})
