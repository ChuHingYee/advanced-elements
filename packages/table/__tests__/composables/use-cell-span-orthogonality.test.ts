/**
 * @file use-cell-span 正交性 — 行/列合并两阶段互不干扰（buildSpanMap 拆分守护）
 * Covers: row-only config produces no colspan>1 entries; col-only config produces no rowspan>1 entries
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useCellSpan } from '../../src/composables/data/use-cell-span'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useCellSpan orthogonality (row/column phase split guard)', () => {
  it('row-only config never emits colspan>1 entries', async () => {
    const data = [
      { dept: 'Eng', name: 'Alice' },
      { dept: 'Eng', name: 'Bob' },
      { dept: 'Sales', name: 'Cara' },
    ]
    const columns = [makeCol('dept'), makeCol('name')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
      rowSpanCells: () => ({ dept: true } as any),
    })
    await nextTick()
    const map = spanMap.value
    expect(map.get('0-dept')).toEqual({ rowspan: 2, colspan: 1, isOrigin: true })
    for (const info of map.values())
      expect(info.colspan).toBeLessThanOrEqual(1)
  })

  it('col-only config never emits rowspan>1 entries', async () => {
    const data = [{ a: 'x', b: 'x', c: 'y' }]
    const columns = [makeCol('a'), makeCol('b'), makeCol('c')]
    const { spanMap } = useCellSpan({
      data: () => data,
      columns: () => columns,
      colSpanCells: () => ({ a: true, b: true } as any),
    })
    await nextTick()
    const map = spanMap.value
    for (const info of map.values())
      expect(info.rowspan).toBeLessThanOrEqual(1)
  })
})
