/**
 * Tests for `scope-resolvers` — data/column scope resolution for export/print.
 */
import type { AdvColumn } from '../../src/types/column'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { resolveColumnsByMode, resolveDataByMode, resolveExportScope } from '../../src/utils/scope-resolvers'

interface Row {
  name: string
  age: number
}

function col(overrides: Partial<AdvColumn<Row>> = {}): AdvColumn<Row> {
  return { prop: 'name', label: 'Name', hidden: false, ...overrides } as AdvColumn<Row>
}

describe('resolveDataByMode', () => {
  const all = [{ name: 'a', age: 1 }, { name: 'b', age: 2 }, { name: 'c', age: 3 }]
  const current = [all[0]]
  const selected = [all[1]]
  const filtered = [all[0], all[2]]

  it('defaults to "all" when dataMode is undefined', () => {
    expect(resolveDataByMode(undefined, all, current, selected)).toEqual(all)
  })

  it('resolves "all" to full data', () => {
    expect(resolveDataByMode('all', all, current, selected)).toEqual(all)
  })

  it('resolves "current" to the current page data', () => {
    expect(resolveDataByMode('current', all, current, selected)).toEqual(current)
  })

  it('resolves "selected" to selected rows', () => {
    expect(resolveDataByMode('selected', all, current, selected)).toEqual(selected)
  })

  it('resolves "filtered" to filtered data when provided', () => {
    expect(resolveDataByMode('filtered', all, current, selected, filtered)).toEqual(filtered)
  })

  it('falls back to full data when "filtered" but no filteredData source provided', () => {
    expect(resolveDataByMode('filtered', all, current, selected)).toEqual(all)
  })

  it('supports getter sources (MaybeRefOrGetter)', () => {
    const allGetter = () => all
    const filteredRef = ref(filtered)
    expect(resolveDataByMode('filtered', allGetter, current, selected, filteredRef)).toEqual(filtered)
  })
})

describe('resolveColumnsByMode', () => {
  const visible = [col({ prop: 'name' })]
  const allCols = [col({ prop: 'name' }), col({ prop: 'age' }), col({ prop: 'nick', hidden: true })]

  it('defaults to visible columns when columnMode is undefined', () => {
    expect(resolveColumnsByMode(undefined, visible, allCols)).toEqual(visible)
  })

  it('resolves "visible" to visible columns', () => {
    expect(resolveColumnsByMode('visible', visible, allCols)).toEqual(visible)
  })

  it('resolves "all" to all columns', () => {
    expect(resolveColumnsByMode('all', visible, allCols)).toEqual(allCols)
  })
})

describe('resolveExportScope', () => {
  const visible = [col({ prop: 'name' })]
  const allCols = [col({ prop: 'name' }), col({ prop: 'age' })]
  const all = [{ name: 'a', age: 1 }, { name: 'b', age: 2 }]
  const current = [all[0]]
  const selected = [all[1]]

  function scope(columnMode: 'visible' | 'all' | undefined, dataMode: 'all' | 'filtered' | 'current' | 'selected' | undefined) {
    return resolveExportScope({
      columnMode,
      dataMode,
      visibleColumns: visible,
      allColumns: allCols,
      allData: all,
      currentData: current,
      selectedRows: selected,
    })
  }

  it('resolves columns and data in one call with the built-in caliber', () => {
    expect(scope('visible', 'current')).toEqual({ columns: visible, data: current })
    expect(scope('all', 'selected')).toEqual({ columns: allCols, data: selected })
    expect(scope(undefined, undefined)).toEqual({ columns: visible, data: all })
  })
})
