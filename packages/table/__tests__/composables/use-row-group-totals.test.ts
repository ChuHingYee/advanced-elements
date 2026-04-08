import { describe, expect, it } from 'vitest'
import { useRowGroup } from '@/composables/data/use-row-group'

const data = [
  { dept: 'eng', name: 'a', qty: 2, price: 10 },
  { dept: 'eng', name: 'b', qty: 4, price: 20 },
  { dept: 'ops', name: 'c', qty: 8, price: 30 },
]

const columns = [
  { prop: 'dept', label: 'Dept' },
  { prop: 'name', label: 'Name' },
  { prop: 'qty', label: 'Qty' },
  { prop: 'price', label: 'Price' },
] as any[]

function groupValues(rows: any[]) {
  return rows.map((r) => {
    if (r.__isGroupHeader)
      return `H:${String(r.__groupValue)}`
    if (r.__isGroupTotalRow)
      return `T:${String(r.__groupValue)}:${r.__groupTotalPosition}`
    return `D:${r.name}`
  })
}

describe('useRowGroup groupTotalRow (AG Grid parity)', () => {
  it('inserts bottom totals per group with agg sums', () => {
    const { groupedData } = useRowGroup({
      rowGroupConfig: { field: 'dept' },
      data,
      columns,
      groupTotalRow: 'bottom',
      sumText: '合计',
    })
    expect(groupValues(groupedData.value)).toEqual([
      'H:eng',
      'D:a',
      'D:b',
      'T:eng:bottom',
      'H:ops',
      'D:c',
      'T:ops:bottom',
    ])
    const total = groupedData.value.find((r: any) => r.__isGroupTotalRow && r.__groupValue === 'eng') as any
    expect(total.qty).toBe(6)
    expect(total.price).toBe(30)
    expect(total.dept).toBe('Sub Total (eng)')
  })

  it('inserts top totals before children', () => {
    const { groupedData } = useRowGroup({
      rowGroupConfig: { field: 'dept' },
      data,
      columns,
      groupTotalRow: 'top',
      sumText: '合计',
    })
    expect(groupValues(groupedData.value)).toEqual([
      'H:eng',
      'T:eng:top',
      'D:a',
      'D:b',
      'H:ops',
      'T:ops:top',
      'D:c',
    ])
  })

  it('supports selective callback per group', () => {
    const { groupedData } = useRowGroup({
      rowGroupConfig: { field: 'dept' },
      data,
      columns,
      groupTotalRow: ({ node }) => (node.value === 'eng' ? 'bottom' : undefined),
      sumText: '合计',
    })
    expect(groupValues(groupedData.value)).toEqual([
      'H:eng',
      'D:a',
      'D:b',
      'T:eng:bottom',
      'H:ops',
      'D:c',
    ])
  })

  it('uses column aggFunc (avg) for totals', () => {
    const aggCols = [
      { prop: 'dept' },
      { prop: 'name' },
      { prop: 'qty', aggFunc: 'avg' },
    ] as any[]
    const { groupedData } = useRowGroup({
      rowGroupConfig: { field: 'dept' },
      data,
      columns: aggCols,
      groupTotalRow: 'bottom',
      sumText: '合计',
    })
    const total = groupedData.value.find((r: any) => r.__isGroupTotalRow && r.__groupValue === 'eng') as any
    expect(total.qty).toBe(3)
  })

  it('uses totalValueGetter for labels', () => {
    const { groupedData } = useRowGroup({
      rowGroupConfig: { field: 'dept' },
      data,
      columns,
      groupTotalRow: 'bottom',
      sumText: '合计',
      totalValueGetter: ({ value }) => `小计(${value})`,
    })
    const total = groupedData.value.find((r: any) => r.__isGroupTotalRow) as any
    expect(total.__totalLabel).toBe('小计(eng)')
    expect(total.dept).toBe('小计(eng)')
  })

  it('hides totals for collapsed groups', () => {
    const { groupedData } = useRowGroup({
      rowGroupConfig: { field: 'dept', defaultExpandAll: false },
      data,
      columns,
      groupTotalRow: 'bottom',
      sumText: '合计',
    })
    expect(groupValues(groupedData.value)).toEqual(['H:eng', 'H:ops'])
  })

  it('blanks header aggregates by default, keeps them with groupSuppressBlankHeader', () => {
    const config = { field: 'dept', aggregateColumns: [{ field: 'qty', agg: 'sum' as const }] }
    const blanked = useRowGroup({
      rowGroupConfig: config,
      data,
      columns,
      groupTotalRow: 'bottom',
      sumText: '合计',
    })
    const headerBlanked = blanked.groupedData.value.find((r: any) => r.__isGroupHeader && r.__groupValue === 'eng') as any
    expect(headerBlanked.__groupTotalVisible).toBe(true)
    expect(headerBlanked.__groupAggregates).toBe(undefined)

    const kept = useRowGroup({
      rowGroupConfig: config,
      data,
      columns,
      groupTotalRow: 'bottom',
      sumText: '合计',
      groupSuppressBlankHeader: true,
    })
    const headerKept = kept.groupedData.value.find((r: any) => r.__isGroupHeader && r.__groupValue === 'eng') as any
    expect(headerKept.__groupAggregates).toBeDefined()
  })

  it('marks sticky per suppressStickyTotalRow', () => {
    const sticky = useRowGroup({
      rowGroupConfig: { field: 'dept' },
      data,
      columns,
      groupTotalRow: 'bottom',
      sumText: '合计',
    })
    const t1 = sticky.groupedData.value.find((r: any) => r.__isGroupTotalRow) as any
    expect(t1.__sticky).toBe(true)

    const suppressed = useRowGroup({
      rowGroupConfig: { field: 'dept' },
      data,
      columns,
      groupTotalRow: 'bottom',
      sumText: '合计',
      suppressStickyTotalRow: 'group',
    })
    const t2 = suppressed.groupedData.value.find((r: any) => r.__isGroupTotalRow) as any
    expect(t2.__sticky).toBe(false)
  })

  it('supports nested groups with totals at each level', () => {
    const nested = [
      { dept: 'eng', team: 'a', qty: 1 },
      { dept: 'eng', team: 'a', qty: 2 },
      { dept: 'eng', team: 'b', qty: 4 },
    ]
    const cols = [{ prop: 'dept' }, { prop: 'team' }, { prop: 'qty' }] as any[]
    const { groupedData } = useRowGroup({
      rowGroupConfig: { field: ['dept', 'team'] },
      data: nested,
      columns: cols,
      groupTotalRow: 'bottom',
      sumText: '合计',
    })
    const kinds = groupedData.value.map((r: any) => {
      if (r.__isGroupHeader)
        return `H:${r.__groupField}=${String(r.__groupValue)}`
      if (r.__isGroupTotalRow)
        return `T:${r.__groupField}=${String(r.__groupValue)}`
      return `D:${r.qty}`
    })
    expect(kinds).toEqual([
      'H:dept=eng',
      'H:team=a',
      'D:1',
      'D:2',
      'T:team=a',
      'H:team=b',
      'D:4',
      'T:team=b',
      'T:dept=eng',
    ])
    const deptTotal = groupedData.value.find((r: any) => r.__isGroupTotalRow && r.__groupField === 'dept') as any
    expect(deptTotal.qty).toBe(7)
  })
})
