import type { GroupAggregateColumnSpec } from '../../src/types/config-tree'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useRowGroup } from '../../src/composables/data/use-row-group'
import { computeGroupAggregates, getGroupAggregateKey } from '../../src/utils/group-aggregates'

/**
 * <zh/> 分组聚合测试——sum/avg/min/max 数值口径与汇总行一致
 * <zh/> （仅 typeof 'number' 且非 NaN 参与；无可数值为 null；avg 分母为有效个数）。
 *
 * <en/> Group aggregation tests — sum/avg/min/max with the same numeric caliber as summary rows
 * <en/> (only typeof 'number' non-NaN cells count; null when no valid numbers; avg divides by the valid count).
 */
interface SalesRow {
  region: string
  amount: number
  units?: number
}

const rows: SalesRow[] = [
  { region: 'east', amount: 10, units: 2 },
  { region: 'east', amount: 20 },
  { region: 'west', amount: -5, units: 4 },
  { region: 'west', amount: 5, units: Number.NaN },
]

describe('computeGroupAggregates', () => {
  it('computes sum / avg / min / max over valid numbers only', () => {
    const specs: GroupAggregateColumnSpec[] = [
      { field: 'amount', agg: 'sum' },
      { field: 'amount', agg: 'avg' },
      { field: 'amount', agg: 'min' },
      { field: 'amount', agg: 'max' },
    ]
    const east = computeGroupAggregates(rows.filter(r => r.region === 'east'), specs)
    expect(east[getGroupAggregateKey('amount', 'sum')]).toBe(30)
    expect(east[getGroupAggregateKey('amount', 'avg')]).toBe(15)
    expect(east[getGroupAggregateKey('amount', 'min')]).toBe(10)
    expect(east[getGroupAggregateKey('amount', 'max')]).toBe(20)
  })

  it('treats missing fields and NaN as non-numeric; avg divides by the VALID count', () => {
    const west = computeGroupAggregates(rows.filter(r => r.region === 'west'), [
      { field: 'units', agg: 'sum' },
      { field: 'units', agg: 'avg' },
      // <zh/> 全部非数值的声明 → null（区别于合法 0）
      { field: 'nonexistent', agg: 'max' },
    ])
    expect(west[getGroupAggregateKey('units', 'sum')]).toBe(4)
    expect(west[getGroupAggregateKey('units', 'avg')]).toBe(4)
    expect(west[getGroupAggregateKey('nonexistent', 'max')]).toBeNull()
  })

  it('returns an empty table for empty groups or empty specs', () => {
    expect(computeGroupAggregates([], [{ field: 'a', agg: 'sum' }])).toEqual({})
    expect(computeGroupAggregates(rows, [])).toEqual({})
  })
})

describe('useRowGroup aggregateColumns', () => {
  it('attaches __groupAggregates to header rows and stays reactive to config changes', async () => {
    const config = ref<any>({
      field: 'region',
      defaultExpandAll: true,
      aggregateColumns: [
        { field: 'amount', agg: 'sum' },
        { field: 'amount', agg: 'max' },
      ],
    })
    const data = ref<SalesRow[]>(rows)
    const { groupedData } = useRowGroup<SalesRow>({ rowGroupConfig: config, data })

    const headers = groupedData.value.filter(r => (r as any).__isGroupHeader) as any[]
    expect(headers).toHaveLength(2)

    const east = headers.find(h => h.__groupValue === 'east')
    expect(east.__groupAggregates).toEqual({
      'amount:sum': 30,
      'amount:max': 20,
    })

    // <zh/> 配置变更 → 头行聚合随之更新 | <en/> config change → header aggregates update
    config.value = { ...config.value, aggregateColumns: [{ field: 'amount', agg: 'min' }] }
    await Promise.resolve()
    await Promise.resolve()
    const headersAfter = groupedData.value.filter(r => (r as any).__isGroupHeader) as any[]
    expect(headersAfter[0].__groupAggregates).toEqual({ 'amount:min': 10 })
  })

  it('omits __groupAggregates entirely when no aggregateColumns configured', () => {
    const { groupedData } = useRowGroup<SalesRow>({
      rowGroupConfig: ref({ field: 'region', defaultExpandAll: true }),
      data: ref(rows),
    })
    const headers = groupedData.value.filter(r => (r as any).__isGroupHeader) as any[]
    for (const h of headers)
      expect('__groupAggregates' in h).toBe(false)
  })
})
