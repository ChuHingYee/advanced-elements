import { describe, expect, it } from 'vitest'
import {
  buildGrandTotalRow,
  buildGroupTotalRow,
  filterLeafDataRows,
  isGrandTotalRow,
  isGroupTotalRow,
  isSyntheticRow,
  resolveGrandTotalPosition,
  resolveGroupTotalPosition,
  resolveLabelProp,
  resolveTotalLabel,
  resolveTotalSticky,
} from '@/utils/total-rows'

describe('resolveGrandTotalPosition', () => {
  it('explicit grandTotalRow wins over showSummary', () => {
    expect(resolveGrandTotalPosition(true, 'top')).toBe('top')
    expect(resolveGrandTotalPosition(false, 'pinnedBottom')).toBe('pinnedBottom')
  })

  it('showSummary=true falls back to bottom', () => {
    expect(resolveGrandTotalPosition(true, undefined)).toBe('bottom')
  })

  it('returns undefined when disabled', () => {
    expect(resolveGrandTotalPosition(false, undefined)).toBe(undefined)
    expect(resolveGrandTotalPosition(undefined, undefined)).toBe(undefined)
  })
})

describe('resolveGroupTotalPosition', () => {
  const node = { level: 0, field: 'dept', value: 'eng', key: 'k', rowCount: 3 }

  it('passes strings through', () => {
    expect(resolveGroupTotalPosition('top', node)).toBe('top')
    expect(resolveGroupTotalPosition('bottom', node)).toBe('bottom')
  })

  it('supports selective callbacks', () => {
    expect(resolveGroupTotalPosition(params => (params.node.value === 'eng' ? 'bottom' : undefined), node)).toBe('bottom')
    expect(resolveGroupTotalPosition(() => undefined, node)).toBe(undefined)
  })

  it('skips groups whose callback throws', () => {
    expect(resolveGroupTotalPosition(() => {
      throw new Error('x')
    }, node)).toBe(undefined)
  })

  it('returns undefined when unset', () => {
    expect(resolveGroupTotalPosition(undefined, node)).toBe(undefined)
  })
})

describe('resolveTotalLabel', () => {
  it('uses totalValueGetter first', () => {
    expect(resolveTotalLabel(
      { level: -1, value: undefined, isGrandTotal: true },
      () => 'Grand Total',
      '合计',
    )).toBe('Grand Total')
    expect(resolveTotalLabel(
      { level: 0, value: 'eng', field: 'dept', isGrandTotal: false },
      params => `Sub Total (${params.value})`,
      '合计',
    )).toBe('Sub Total (eng)')
  })

  it('falls back to sumText for grand and Sub Total for groups', () => {
    expect(resolveTotalLabel({ level: -1, value: undefined, isGrandTotal: true }, undefined, '合计')).toBe('合计')
    expect(resolveTotalLabel({ level: 1, value: 'x', field: 'f', isGrandTotal: false }, undefined, '合计')).toBe('Sub Total (x)')
  })

  it('falls back when totalValueGetter throws or returns empty', () => {
    expect(resolveTotalLabel(
      { level: -1, value: undefined, isGrandTotal: true },
      () => { throw new Error('bad') },
      '合计',
    )).toBe('合计')
  })
})

describe('resolveTotalSticky', () => {
  it('sticky by default', () => {
    expect(resolveTotalSticky('grand', undefined)).toBe(true)
    expect(resolveTotalSticky('group', false)).toBe(true)
  })

  it('true suppresses all', () => {
    expect(resolveTotalSticky('grand', true)).toBe(false)
    expect(resolveTotalSticky('group', true)).toBe(false)
  })

  it('kind-scoped suppression', () => {
    expect(resolveTotalSticky('grand', 'grand')).toBe(false)
    expect(resolveTotalSticky('group', 'grand')).toBe(true)
    expect(resolveTotalSticky('group', 'group')).toBe(false)
    expect(resolveTotalSticky('grand', 'group')).toBe(true)
  })
})

describe('synthetic row markers', () => {
  it('guards detect grand/group rows', () => {
    const grand = buildGrandTotalRow({ qty: 6 }, { position: 'bottom', label: '合计', sticky: true, labelProp: 'name', rowKey: 'g' })
    const group = buildGroupTotalRow({ qty: 6 }, {
      position: 'bottom',
      field: 'dept',
      value: 'eng',
      level: 0,
      groupKey: 'k',
      label: 'Sub',
      sticky: true,
      labelProp: 'name',
      rowKey: 't',
    })
    expect(isGrandTotalRow(grand)).toBe(true)
    expect(isGroupTotalRow(group)).toBe(true)
    expect(isSyntheticRow(grand)).toBe(true)
    expect(isSyntheticRow(group)).toBe(true)
    expect(isSyntheticRow({ qty: 1 })).toBe(false)
    expect(isSyntheticRow({ __isGroupHeader: true })).toBe(true)
    expect(isSyntheticRow({ __isDetailRow: true })).toBe(true)
  })

  it('label lands on the label prop', () => {
    const grand = buildGrandTotalRow({ qty: 6 }, { position: 'top', label: 'Grand Total', sticky: true, labelProp: 'name', rowKey: 'g' })
    expect((grand as Record<string, unknown>).name).toBe('Grand Total')
    expect((grand as Record<string, unknown>).qty).toBe(6)
  })
})

describe('filterLeafDataRows / resolveLabelProp', () => {
  it('excludes all synthetic rows', () => {
    const rows = [
      { id: 1 },
      { __isGroupHeader: true },
      { __isDetailRow: true },
      { __isGrandTotalRow: true },
      { __isGroupTotalRow: true },
      { id: 2 },
    ]
    expect(filterLeafDataRows(rows)).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('resolves first prop column as label prop', () => {
    expect(resolveLabelProp([{}, { prop: 'a' }, { prop: 'b' }])).toBe('a')
    expect(resolveLabelProp([{}])).toBe(undefined)
  })
})
