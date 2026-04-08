/**
 * Tests for synthetic-row stable keys — RowViewModel prevRowMap keying.
 */
import { describe, expect, it } from 'vitest'
import { getSyntheticRowKind, getSyntheticRowStableKey, isSyntheticRow } from '../../src/utils/synthetic-row'

describe('getSyntheticRowStableKey', () => {
  it('prefers the preassigned AUTO_KEY identity over the index', () => {
    const row = { __isDetailRow: true, __adv_table_auto_key: '__detail__rk1' }
    expect(isSyntheticRow(row)).toBe(true)
    expect(getSyntheticRowStableKey(row, 0)).toBe('__synthetic____detail__rk1')
    // <zh/> 索引漂移不改变键
    // <en/> Index drift never changes the key
    expect(getSyntheticRowStableKey(row, 7)).toBe('__synthetic____detail__rk1')
  })

  it('keys group headers by their hierarchical auto key', () => {
    const row = { __isGroupHeader: true, __adv_table_auto_key: '0__f__v' }
    expect(getSyntheticRowStableKey(row, 3)).toBe('__synthetic__0__f__v')
  })

  it('falls back to kind:index for rows without preassigned identity', () => {
    const row = { __isGrandTotalRow: true }
    expect(getSyntheticRowStableKey(row, 5)).toBe('__synthetic__grand-total:5')
  })

  it('distinguishes kinds sharing the same index', () => {
    expect(getSyntheticRowKind({ __isDetailRow: true })).toBe('detail')
    expect(getSyntheticRowKind({ __isGroupHeader: true })).toBe('group-header')
    expect(getSyntheticRowKind({ __isGrandTotalRow: true })).toBe('grand-total')
    expect(getSyntheticRowKind({ __isGroupTotalRow: true })).toBe('group-total')
    expect(getSyntheticRowKind({})).toBe('unknown')
  })
})
