import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useSpanOverlay } from '../../src/composables/rendering/use-span-overlay'
import { useSpanStrategy } from '../../src/composables/rendering/use-span-strategy'

/**
 * <zh/> 合并策略单测——覆盖覆盖层开关与合成行 span/类名。
 * <en/> Span strategy tests — overlay gate and synthetic span/class.
 */
describe('useSpanOverlay', () => {
  const base = {
    spanEnabled: () => true,
    isDynamic: () => true,
    rowHeight: () => 40,
    getSpanInfo: () => ({ rowspan: 2, colspan: 2, isOrigin: true }),
  }

  it('returns undefined in warn-only mode', () => {
    const { getOverlayStyle } = useSpanOverlay({ ...base, spanDynamicMode: () => 'warn-only' })
    expect(getOverlayStyle(0, 'a')).toBeUndefined()
  })

  it('returns undefined when span or dynamic is off', () => {
    const off = useSpanOverlay({ ...base, spanEnabled: () => false, spanDynamicMode: () => 'rfc-overlay' })
    expect(off.getOverlayStyle(0, 'a')).toBeUndefined()
    const flat = useSpanOverlay({
      ...base,
      spanDynamicMode: () => 'rfc-overlay',
      getSpanInfo: () => ({ rowspan: 1, colspan: 1, isOrigin: true }),
    })
    expect(flat.getOverlayStyle(0, 'a')).toBeUndefined()
  })

  it('returns absolute style for span×dynamic origins', () => {
    const { getOverlayStyle } = useSpanOverlay({ ...base, spanDynamicMode: () => 'rfc-overlay' })
    expect(getOverlayStyle(0, 'a')).toMatchObject({ position: 'absolute', height: '80px', width: '200%' })
  })
})

describe('useSpanStrategy', () => {
  const detailRow = { __isDetailRow: true }
  const groupRow = { __isGroupHeader: true }
  const normalRow = { id: 1 }

  function setup() {
    return useSpanStrategy(
      {
        rowExpandApi: { expandEnabled: ref(true), isDetailRow: (r: any) => r.__isDetailRow === true },
        rowGroupApi: { groupEnabled: ref(true), isGroupHeaderRow: (r: any) => r.__isGroupHeader === true },
        selectionColumnCount: 1,
        normalColumnCount: 2,
      } as any,
      () => (params: any) => (params.columnIndex === 0 ? { rowspan: 2, colspan: 1 } : undefined),
      () => 'custom-row',
    )
  }

  it('classifies synthetic rows', () => {
    const api = setup()
    expect(api.getSyntheticRowType(detailRow)).toBe('detail')
    expect(api.getSyntheticRowType(groupRow)).toBe('groupHeader')
    expect(api.getSyntheticRowType(normalRow)).toBeNull()
  })

  it('spans detail rows across all columns', () => {
    const api = setup()
    expect(api.getSyntheticRowSpan(detailRow, 0)).toEqual({ rowspan: 1, colspan: 3 })
    expect(api.getSyntheticRowSpan(detailRow, 1)).toEqual({ rowspan: 0, colspan: 0 })
    expect(api.getSyntheticRowSpan(normalRow, 0)).toBeUndefined()
  })

  it('spans group headers past the selection column', () => {
    const api = setup()
    expect(api.getSyntheticRowSpan(groupRow, 1)).toEqual({ rowspan: 1, colspan: 2 })
    expect(api.getSyntheticRowSpan(groupRow, 2)).toEqual({ rowspan: 0, colspan: 0 })
    expect(api.getSyntheticRowSpan(groupRow, 0)).toEqual({ rowspan: 1, colspan: 1 })
  })

  it('merges user span method and row classes', () => {
    const api = setup()
    expect(api.mergedSpanMethod({ row: normalRow, column: {}, rowIndex: 0, columnIndex: 0 })).toEqual({ rowspan: 2, colspan: 1 })
    expect(api.mergedSpanMethod({ row: normalRow, column: {}, rowIndex: 0, columnIndex: 5 })).toEqual({ rowspan: 1, colspan: 1 })
    expect(api.mergedRowClassName({ row: detailRow, rowIndex: 0 })).toContain('adv-table__detail-row')
    expect(api.mergedRowClassName({ row: detailRow, rowIndex: 0 })).toContain('custom-row')
    expect(api.getSyntheticRowClass(groupRow)).toBe('adv-table__group-header-row')
    expect(api.getSyntheticRowClass(normalRow)).toBe('')
  })

  it('tolerates missing apis', () => {
    const api = useSpanStrategy({ selectionColumnCount: 0, normalColumnCount: 1 } as any)
    expect(api.getSyntheticRowType(normalRow)).toBeNull()
    expect(api.mergedSpanMethod({ row: normalRow, column: {}, rowIndex: 0, columnIndex: 0 })).toEqual({ rowspan: 1, colspan: 1 })
    expect(api.mergedRowClassName({ row: normalRow, rowIndex: 0 })).toBe('')
  })
})
