import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useCellSpan } from '../../src/composables/data/use-cell-span'

const columns = [{ prop: 'a' }, { prop: 'b' }] as any
const rows = [{ a: 1, b: 2 }, { a: 3, b: 4 }, { a: 5, b: 6 }]

/**
 * <zh/> `useCellSpan` 输入消毒覆盖——声明式 ranges 非法起点跳过、函数式返回值钳制。
 * <zh/> 小数据走同步建图路径，断言无需等待 tick。
 * <en/> Input-sanitization coverage for `useCellSpan` — illegal declarative range origins are
 * <en/> skipped, function-style outputs are clamped. Small data takes the sync build path,
 * <en/> so assertions need no tick.
 */
describe('useCellSpan input sanitization', () => {
  it('skips ranges with negative origins without writing ghost keys', () => {
    const { spanMap } = useCellSpan({
      data: ref(rows),
      columns: ref(columns),
      ranges: ref([
        { row: -1, col: 0, rowspan: 2, colspan: 1 },
        { row: 0, col: -1, rowspan: 2, colspan: 1 },
        { row: 1, col: 1, rowspan: 0, colspan: 2 },
        { row: 0, col: 0, rowspan: 1, colspan: 2 },
      ]),
    })

    expect(spanMap.value.get('0-a')).toEqual({ rowspan: 1, colspan: 2, isOrigin: true })
    expect(spanMap.value.get('0-b')).toEqual({ rowspan: 0, colspan: 0, isOrigin: false })
    expect([...spanMap.value.keys()].some(k => k.startsWith('-1-') || k.startsWith('0--1'))).toBe(false)
  })

  it('clamps negative spans to hidden and non-finite spans to 1', () => {
    const { spanMap } = useCellSpan({
      data: ref(rows),
      columns: ref(columns),
      userSpanMethod: ref(({ rowIndex }) => {
        if (rowIndex === 0)
          return { rowspan: -2, colspan: 1 }
        if (rowIndex === 1)
          return { rowspan: Number.NaN, colspan: Number.POSITIVE_INFINITY }
        return undefined
      }),
    })

    expect(spanMap.value.get('0-a')).toEqual({ rowspan: 0, colspan: 1, isOrigin: false })
    expect(spanMap.value.get('1-a')).toEqual({ rowspan: 1, colspan: 1, isOrigin: true })
    // <zh/> 返回 undefined 的格子不写入映射 | <en/> Cells with undefined results leave no map entry
    expect(spanMap.value.get('2-a')).toBeUndefined()
  })
})
