/**
 * Tests for useTableSummary composable
 *
 * Covers: summaryData computed, summaryValueMap, getSummaryValue,
 * showSummary toggle, custom summaryMethod, automatic sum, stability optimization.
 */
import type { VNode } from 'vue'
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTableSummary } from '../../src/composables/features/use-table-summary'

function createCol(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return { prop: 'val', label: 'Value', ...overrides, hidden: false } as unknown as ProcessedColumn
}

describe('useTableSummary', () => {
  describe('基础功能 / basic initialization', () => {
    it('showSummary=false 时返回空对象', () => {
      const result = useTableSummary({
        data: ref([{ val: 10 }]),
        columns: ref([createCol()]),
        showSummary: ref(false),
      })
      expect(result.summaryData.value).toEqual({})
    })

    it('showSummary 从 false 变为 true 时重新计算', () => {
      const showSummary = ref(false)
      const result = useTableSummary({
        data: ref([{ val: 10 }]),
        columns: ref([createCol()]),
        showSummary,
      })
      expect(result.summaryData.value).toEqual({})
      showSummary.value = true
      expect(result.summaryData.value.val).toBe('合计')
    })

    it('第一列显示默认 sumText（"合计"）', () => {
      const result = useTableSummary({
        data: ref([{ val: 10 }]),
        columns: ref([createCol({ prop: 'val', hidden: false })]),
        showSummary: ref(true),
      })
      expect(result.summaryData.value.val).toBe('合计')
    })

    it('自定义 sumText', () => {
      const result = useTableSummary({
        data: ref([{ val: 10 }]),
        columns: ref([createCol({ prop: 'val', hidden: false })]),
        showSummary: ref(true),
        sumText: ref('小计'),
      })
      expect(result.summaryData.value.val).toBe('小计')
    })

    it('多列自动求和（数值列）', () => {
      const result = useTableSummary({
        data: ref([
          { a: 10, b: 20 },
          { a: 5, b: 5 },
        ]),
        columns: ref([
          createCol({ prop: 'a', hidden: false }),
          createCol({ prop: 'b', hidden: false }),
        ]),
        showSummary: ref(true),
        sumText: ref('小计'),
      })
      expect(result.summaryData.value.a).toBe('小计')
      expect(result.summaryData.value.b).toBe('25')
    })

    it('非数值列求和为空字符串', () => {
      const result = useTableSummary({
        data: ref([{ name: 'Alice' }, { name: 'Bob' }]),
        columns: ref([createCol({ prop: 'name', hidden: false }), createCol({ prop: 'val', hidden: false })]),
        showSummary: ref(true),
      })
      expect(result.summaryData.value.name).toBe('合计')
      expect(result.summaryData.value.val).toBe('')
    })

    it('naN 值不参与求和', () => {
      // First column always gets sumText, second column sums numeric values
      const result = useTableSummary({
        data: ref([{ a: Number.NaN, b: 10 }]),
        columns: ref([createCol({ prop: 'a', hidden: false }), createCol({ prop: 'b', hidden: false })]),
        showSummary: ref(true),
      })
      expect(result.summaryData.value.a).toBe('合计')
      expect(result.summaryData.value.b).toBe('10')
    })

    it('混合 null 和数值 — 第一列是 sumText', () => {
      const result = useTableSummary({
        data: ref([{ a: null, b: 5 }, { a: 3, b: undefined }]),
        columns: ref([createCol({ prop: 'a', hidden: false }), createCol({ prop: 'b', hidden: false })]),
        showSummary: ref(true),
      })
      expect(result.summaryData.value.a).toBe('合计')
      expect(result.summaryData.value.b).toBe('5')
    })
  })

  describe('custom summaryMethod', () => {
    it('使用自定义合计方法', () => {
      const summaryMethod = vi.fn(() => ['Total', '100'])
      const result = useTableSummary({
        data: ref([{ a: 1, b: 2 }]),
        columns: ref([createCol({ prop: 'a', hidden: false }), createCol({ prop: 'b', hidden: false })]),
        showSummary: ref(true),
        summaryMethod,
      })
      expect(result.summaryData.value.a).toBe('Total')
      expect(result.summaryData.value.b).toBe('100')
      expect(summaryMethod).toHaveBeenCalledTimes(1)
    })

    it('summaryMethod 返回 undefined 的列跳过', () => {
      const summaryMethod = () => ['Total', undefined]
      const result = useTableSummary({
        data: ref([{ a: 1, b: 2 }]),
        columns: ref([createCol({ prop: 'a', hidden: false }), createCol({ prop: 'b', hidden: false })]),
        showSummary: ref(true),
        summaryMethod: summaryMethod as any,
      })
      expect(result.summaryData.value.a).toBe('Total')
      expect(result.summaryData.value.b).toBeUndefined()
    })

    it('summaryMethod 可以返回 VNode', () => {
      const vnode = { type: 'span', props: {} } as unknown as VNode
      const summaryMethod = () => [vnode, '10']
      const result = useTableSummary({
        data: ref([{ a: 1, b: 2 }]),
        columns: ref([createCol({ prop: 'a', hidden: false }), createCol({ prop: 'b', hidden: false })]),
        showSummary: ref(true),
        summaryMethod,
      })
      expect(result.summaryData.value.a).toBe(vnode)
    })
  })

  describe('稳定性 / stability', () => {
    it('数据不变时 summaryData 返回同一引用', () => {
      const data = ref([{ val: 10 }])
      const result = useTableSummary({
        data,
        columns: ref([createCol()]),
        showSummary: ref(true),
      })
      const r1 = result.summaryData.value
      const r2 = result.summaryData.value
      expect(r1).toBe(r2)
    })

    it('getSummaryValue 按 columnKey 查找', () => {
      const result = useTableSummary({
        data: ref([{ a: 10 }]),
        columns: ref([createCol({ prop: 'a', hidden: false })]),
        showSummary: ref(true),
      })
      expect(result.getSummaryValue(createCol({ prop: 'a', hidden: false }))).toBe('合计')
      expect(result.getSummaryValue(createCol({ prop: 'nonexistent', hidden: false }))).toBeUndefined()
    })
  })

  describe('summaryValueMap via getSummaryValue', () => {
    it('getSummaryValue 能获取第一列 sumText', () => {
      const result = useTableSummary({
        data: ref([{ a: 10, b: 20 }]),
        columns: ref([createCol({ prop: 'a', hidden: false }), createCol({ prop: 'b', hidden: false })]),
        showSummary: ref(true),
      })
      expect(result.getSummaryValue(createCol({ prop: 'a', hidden: false }))).toBe('合计')
      expect(result.getSummaryValue(createCol({ prop: 'b', hidden: false }))).toBe('20')
    })
  })

  describe('无 prop 的列', () => {
    it('无 prop 的列不参与计算', () => {
      const result = useTableSummary({
        data: ref([{ val: 10 }]),
        columns: ref([
          { label: 'No Prop' } as unknown as ProcessedColumn,
          createCol({ prop: 'val', hidden: false }),
        ]),
        showSummary: ref(true),
      })
      // First column has no prop - skipped for sum and summaryValueMap
      expect(result.summaryData.value.val).toBe('合计')
    })

    it('列全是无 prop 时返回空但不会报错', () => {
      const result = useTableSummary({
        data: ref([{ val: 10 }]),
        columns: ref([{ label: 'A' } as unknown as ProcessedColumn, { label: 'B' } as unknown as ProcessedColumn]),
        showSummary: ref(true),
      })
      expect(result.summaryData.value).toEqual({})
    })
  })

  describe('summaryMethod 的 prev 稳定性', () => {
    it('summaryMethod 结果不变时返回同一引用', () => {
      const summaryMethod = () => ['Total', '100']
      const data = ref([{ a: 1, b: 2 }])
      const result = useTableSummary({
        data,
        columns: ref([createCol({ prop: 'a', hidden: false }), createCol({ prop: 'b', hidden: false })]),
        showSummary: ref(true),
        summaryMethod,
      })
      const r1 = result.summaryData.value
      const r2 = result.summaryData.value
      expect(r1).toBe(r2)
    })
  })

  describe('sumText fallback', () => {
    it('uses sumText when provided', () => {
      const result = useTableSummary({
        data: ref([{ val: 10 }]),
        columns: ref([createCol()]),
        showSummary: ref(true),
        sumText: ref('总计'),
      })
      expect(result.summaryData.value.val).toBe('总计')
    })

    it('uses t function when sumText not provided', () => {
      const t = vi.fn(() => 'Summary')
      const result = useTableSummary({
        data: ref([{ val: 10 }]),
        columns: ref([createCol()]),
        showSummary: ref(true),
        t,
      })
      expect(result.summaryData.value.val).toBe('Summary')
      expect(t).toHaveBeenCalledWith('table.summary')
    })
  })
})
