/**
 * @file use-cell-span phase3 — uncovered branches
 * Covers: buildSpanMap with existing origin overwrite, watch skip on same refs,
 * spanMethod cache stability, spanFn with no info, getSpanInfo
 */
import type { ColSpanCellsConfig, ProcessedColumn, RowSpanCellsConfig, SpanRange } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { nextTick, ref, triggerRef } from 'vue'
import { useCellSpan } from '../../src/composables/data/use-cell-span'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, width: 100, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useCellSpan phase3 — spanMethod cache stability', () => {
  it('returns prev spanFn when spanMap reference is unchanged', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b')])
    const data = ref([{ a: 1, b: 2 }])
    const ranges = ref<SpanRange[] | undefined>([
      { row: 0, col: 0, rowspan: 1, colspan: 2 },
    ])

    const result = useCellSpan({
      columns: () => columns.value,
      data: () => data.value,
      rowSpanCells: () => undefined,
      colSpanCells: () => undefined,
      ranges: () => ranges.value,
    })

    // Access spanMethod to trigger computation
    const firstFn = result.spanMethod.value
    expect(firstFn).toBeDefined()

    // Access again - should return same reference (cache hit via __map)
    const secondFn = result.spanMethod.value
    expect(firstFn).toBe(secondFn)
  })

  it('returns undefined spanMethod when span is not enabled', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a')])
    const data = ref([{ a: 1 }])

    const result = useCellSpan({
      columns: () => columns.value,
      data: () => data.value,
      rowSpanCells: () => undefined,
      colSpanCells: () => undefined,
      ranges: () => undefined,
    })

    expect(result.spanMethod.value).toBeUndefined()
  })

  it('spanFn returns undefined for unknown column property', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a')])
    const data = ref([{ a: 1 }])
    const ranges = ref<SpanRange[] | undefined>([
      { row: 0, col: 0, rowspan: 1, colspan: 1 },
    ])

    const result = useCellSpan({
      columns: () => columns.value,
      data: () => data.value,
      rowSpanCells: () => undefined,
      colSpanCells: () => undefined,
      ranges: () => ranges.value,
    })

    const fn = result.spanMethod.value!
    // Column without property should return undefined
    expect(fn({ row: {}, column: { property: undefined }, rowIndex: 0, columnIndex: 0 })).toBeUndefined()
  })

  it('spanFn returns undefined for cell not in span map', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a')])
    const data = ref([{ a: 1 }])
    const ranges = ref<SpanRange[] | undefined>([
      { row: 0, col: 0, rowspan: 1, colspan: 1 },
    ])

    const result = useCellSpan({
      columns: () => columns.value,
      data: () => data.value,
      rowSpanCells: () => undefined,
      colSpanCells: () => undefined,
      ranges: () => ranges.value,
    })

    const fn = result.spanMethod.value!
    // Row 5 is not in any span range
    expect(fn({ row: {}, column: { property: 'a' }, rowIndex: 5, columnIndex: 0 })).toBeUndefined()
  })

  it('spanFn returns rowspan:0, colspan:0 for hidden cells', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b')])
    const data = ref([{ a: 1, b: 2 }])
    const ranges = ref<SpanRange[] | undefined>([
      { row: 0, col: 0, rowspan: 1, colspan: 2 },
    ])

    const result = useCellSpan({
      columns: () => columns.value,
      data: () => data.value,
      rowSpanCells: () => undefined,
      colSpanCells: () => undefined,
      ranges: () => ranges.value,
    })

    const fn = result.spanMethod.value!
    // Column 'b' (index 1) should be hidden (rowspan:0, colspan:0)
    // <zh/> 按行对象身份换算索引域——传数据源同一引用 | <en/> Index domains translate by row identity — pass the data source's own reference
    const info = fn({ row: data.value[0], column: { property: 'b' }, rowIndex: 0, columnIndex: 1 })
    expect(info).toEqual({ rowspan: 0, colspan: 0 })
  })

  it('spanFn returns actual span for origin cell', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b')])
    const data = ref([{ a: 1, b: 2 }])
    const ranges = ref<SpanRange[] | undefined>([
      { row: 0, col: 0, rowspan: 1, colspan: 2 },
    ])

    const result = useCellSpan({
      columns: () => columns.value,
      data: () => data.value,
      rowSpanCells: () => undefined,
      colSpanCells: () => undefined,
      ranges: () => ranges.value,
    })

    const fn = result.spanMethod.value!
    // Column 'a' (index 0) should be the origin
    // <zh/> 按行对象身份换算索引域——传数据源同一引用 | <en/> Index domains translate by row identity — pass the data source's own reference
    const info = fn({ row: data.value[0], column: { property: 'a' }, rowIndex: 0, columnIndex: 0 })
    expect(info).toEqual({ rowspan: 1, colspan: 2 })
  })
})

describe('useCellSpan phase3 — watch skip on same refs', () => {
  it('does not rebuild spanMap when all refs are the same', async () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a')])
    const data = ref([{ a: 1 }])
    const rowSpanCells = ref<RowSpanCellsConfig | undefined>(undefined)
    const colSpanCells = ref<ColSpanCellsConfig | undefined>(undefined)
    const ranges = ref<SpanRange[] | undefined>(undefined)

    const result = useCellSpan({
      columns: () => columns.value,
      data: () => data.value,
      rowSpanCells: () => rowSpanCells.value,
      colSpanCells: () => colSpanCells.value,
      ranges: () => ranges.value,
    })

    // spanEnabled should be false with no ranges
    expect(result.spanEnabled.value).toBe(false)

    // Trigger watch by setting ranges (watch has flush:'pre', needs nextTick)
    ranges.value = [{ row: 0, col: 0, rowspan: 1, colspan: 1 }]
    await nextTick()
    expect(result.spanEnabled.value).toBe(true)

    // Set same ref again - watch should skip rebuild
    const firstMap = result.spanMap.value
    // <zh/> 同引用赋值不触发 watch——用 triggerRef 显式触发，验证 prev 引用比较跳过重建
    // <en/> Same-ref assignment won't trigger the watch — use triggerRef to force it and verify the prev-reference check skips rebuild
    triggerRef(ranges)
    await nextTick()
    const secondMap = result.spanMap.value
    // Same ref assignment triggers watch but prev check should skip
    expect(firstMap).toBe(secondMap)
  })
})

describe('useCellSpan phase3 — overlapping ranges', () => {
  it('overwrites existing origin cell when new range covers it', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b'), makeCol('c')])
    const data = ref([{ a: 1, b: 2, c: 3 }])

    // Two overlapping ranges:
    // Range 1: cols 0-1 (a-b), colspan=2
    // Range 2: cols 0-2 (a-b-c), colspan=3
    const ranges = ref<SpanRange[] | undefined>([
      { row: 0, col: 0, rowspan: 1, colspan: 2 },
      { row: 0, col: 0, rowspan: 1, colspan: 3 },
    ])

    const result = useCellSpan({
      columns: () => columns.value,
      data: () => data.value,
      rowSpanCells: () => undefined,
      colSpanCells: () => undefined,
      ranges: () => ranges.value,
    })

    // The second range should overwrite the origin from the first
    const fn = result.spanMethod.value!
    // <zh/> 按行对象身份换算索引域——传数据源同一引用 | <en/> Index domains translate by row identity — pass the data source's own reference
    const originInfo = fn({ row: data.value[0], column: { property: 'a' }, rowIndex: 0, columnIndex: 0 })
    expect(originInfo).toBeDefined()
    expect(originInfo!.colspan).toBe(3) // Should reflect the wider range (Math.max)
  })
})

describe('useCellSpan phase3 — getSpanInfo direct call', () => {
  it('returns undefined for unknown row-colKey combination', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a')])
    const data = ref([{ a: 1 }])

    const result = useCellSpan({
      columns: () => columns.value,
      data: () => data.value,
      rowSpanCells: () => undefined,
      colSpanCells: () => undefined,
      ranges: () => undefined,
    })

    expect(result.getSpanInfo(99, 'unknown')).toBeUndefined()
  })

  it('returns span info for known cell', () => {
    const columns = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b')])
    const data = ref([{ a: 1, b: 2 }])
    const ranges = ref<SpanRange[] | undefined>([
      { row: 0, col: 0, rowspan: 1, colspan: 2 },
    ])

    const result = useCellSpan({
      columns: () => columns.value,
      data: () => data.value,
      rowSpanCells: () => undefined,
      colSpanCells: () => undefined,
      ranges: () => ranges.value,
    })

    const info = result.getSpanInfo(0, 'a')
    expect(info).toBeDefined()
    expect(info!.isOrigin).toBe(true)
    expect(info!.colspan).toBe(2)
  })
})
