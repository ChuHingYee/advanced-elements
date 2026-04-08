import type { UseV2SummaryCellsDeps } from '../../../src/components/table-virtual-renderer/use-v2-summary-cells'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { useV2SummaryCells } from '../../../src/components/table-virtual-renderer/use-v2-summary-cells'

function createDeps(overrides: Partial<UseV2SummaryCellsDeps> = {}): UseV2SummaryCellsDeps {
  return {
    v2KeyToOriginalCol: computed(() => new Map()),
    getSummaryValue: () => undefined,
    selectionV2Columns: computed(() => []),
    normalV2Columns: computed(() => []),
    fixedV2Columns: computed(() => []),
    needsFixedWidth: computed(() => false),
    ...overrides,
  }
}

describe('useV2SummaryCells', () => {
  describe('calcSummaryCellStyle — mirrors EP calcColumnStyle', () => {
    it('fixed-width column: flexGrow 0 / flexShrink 1 defaults, numeric width passthrough', () => {
      const { calcSummaryCellStyle } = useV2SummaryCells(createDeps())
      // <zh/> EP 对每格统一施加 flexGrow(col.flexGrow ?? 0)/flexShrink(col.flexShrink ?? 1)/
      // <zh/> flexBasis auto/width(col.width)；数值交给 Vue style 绑定补 px
      // <en/> EP applies flexGrow(col.flexGrow ?? 0)/flexShrink(col.flexShrink ?? 1)/
      // <en/> flexBasis auto/width(col.width) on every cell; numerics get px via Vue style binding
      const style = calcSummaryCellStyle({ key: 'a', width: 120 })
      expect(style.flexGrow).toBe(0)
      expect(style.flexShrink).toBe(1)
      expect(style.flexBasis).toBe('auto')
      expect(style.width).toBe('120px')
      expect(style.textAlign).toBe('left')
    })

    it('autoSize column: flexGrow 1 participates in flex distribution, width never left empty', () => {
      const { calcSummaryCellStyle } = useV2SummaryCells(createDeps())
      // <zh/> autoSize 列（computeColumnWidth 产出 flexGrow=1 + minWidth 下限）——汇总格施加同一约束，
      // <zh/> flexbox 使两行列宽逐像素一致；即使 V2 宽缺失也不能留空，否则该格按汇总值文本撑开，
      // <zh/> 与按标题撑开的表头、按数据撑开的表体互不相同。
      // <en/> autoSize columns (computeColumnWidth yields flexGrow=1 + minWidth floor) — applying the
      // <en/> same constraints makes flexbox align both rows; even a missing V2 width must not stay
      // <en/> empty, or the cell sizes by its summary text versus the header's title / body's data.
      const style = calcSummaryCellStyle({ key: 'a', width: undefined, minWidth: 120, flexGrow: 1, flexShrink: 0 })
      expect(style.flexGrow).toBe(1)
      expect(style.flexShrink).toBe(0)
      expect(style.width).toBe('150px')
      expect(style.minWidth).toBe('120px')
    })

    it('user column style is spread first and overridden by flex/width (EP parity)', () => {
      const { calcSummaryCellStyle } = useV2SummaryCells(createDeps())
      const style = calcSummaryCellStyle({
        key: 'a',
        width: 100,
        style: { width: '999px', flexGrow: 9, background: 'red' },
      })
      // <zh/> EP 语义：column.style 先展开，flex/width 随后覆盖；无关属性保留
      // <en/> EP semantics: column.style spread first, flex/width override it; unrelated props kept
      expect(style.width).toBe('100px')
      expect(style.flexGrow).toBe(0)
      expect(style.background).toBe('red')
    })

    it('maxWidth/minWidth passed through conditionally, textAlign from col.align', () => {
      const { calcSummaryCellStyle } = useV2SummaryCells(createDeps())
      const style = calcSummaryCellStyle({ key: 'a', width: 100, maxWidth: 300, minWidth: 80, align: 'right' })
      expect(style.maxWidth).toBe('300px')
      expect(style.minWidth).toBe('80px')
      expect(style.textAlign).toBe('right')

      const minimal = calcSummaryCellStyle({ key: 'b', width: 100 })
      expect(minimal.maxWidth).toBeUndefined()
      expect(minimal.minWidth).toBeUndefined()
      expect(minimal.textAlign).toBe('left')
    })
  })

  describe('buildSummaryCells', () => {
    it('builds cells with EP-mirrored flex styles', () => {
      const { buildSummaryCells } = useV2SummaryCells(createDeps())
      const cols = [
        { key: 'a', width: 100, align: 'center' },
        { key: 'b', width: 200 },
      ]
      const cells = buildSummaryCells(cols)
      expect(cells).toHaveLength(2)
      expect(cells[0].key).toBe('a')
      expect(cells[0].style.width).toBe('100px')
      expect(cells[0].style.flexGrow).toBe(0)
      expect(cells[0].style.textAlign).toBe('center')
      expect(cells[1].key).toBe('b')
      expect(cells[1].style.width).toBe('200px')
      expect(cells[1].style.textAlign).toBe('left')
    })

    it('autoSize columns carry flexGrow so the summary row stretches like the body row', () => {
      const { buildSummaryCells } = useV2SummaryCells(createDeps())
      const cols = [
        { key: 'a', width: undefined, minWidth: 120, flexGrow: 1, flexShrink: 0 },
      ]
      const cells = buildSummaryCells(cols)
      expect(cells[0].style.flexGrow).toBe(1)
      expect(cells[0].style.minWidth).toBe('120px')
    })
  })

  describe('leftFixedV2Columns / rightFixedV2Columns', () => {
    it('partitions fixed columns into left and right', () => {
      const fixedV2Columns = computed(() => [
        { key: 'left1', fixed: 'left' },
        { key: 'left2', fixed: true },
        { key: 'right1', fixed: 'right' },
      ])
      const { leftFixedV2Columns, rightFixedV2Columns } = useV2SummaryCells(createDeps({
        fixedV2Columns,
      }))
      expect(leftFixedV2Columns.value).toHaveLength(2)
      expect(leftFixedV2Columns.value[0].key).toBe('left1')
      expect(leftFixedV2Columns.value[1].key).toBe('left2')
      expect(rightFixedV2Columns.value).toHaveLength(1)
      expect(rightFixedV2Columns.value[0].key).toBe('right1')
    })
  })

  describe('leftSummaryCells / mainSummaryCells / rightSummaryCells', () => {
    it('builds left cells from left-fixed columns', () => {
      const { leftSummaryCells } = useV2SummaryCells(createDeps({
        fixedV2Columns: computed(() => [
          { key: 'left1', fixed: 'left', width: 100 },
        ]),
      }))
      expect(leftSummaryCells.value).toHaveLength(1)
      expect(leftSummaryCells.value[0].style.width).toBe('100px')
    })

    it('builds main cells from selection + normal columns', () => {
      const { mainSummaryCells } = useV2SummaryCells(createDeps({
        selectionV2Columns: computed(() => [
          { key: 'sel1', width: 50 },
        ]),
        normalV2Columns: computed(() => [
          { key: 'col1', width: 100 },
          { key: 'col2', width: 200 },
        ]),
      }))
      expect(mainSummaryCells.value).toHaveLength(3)
      expect(mainSummaryCells.value[0].key).toBe('sel1')
      expect(mainSummaryCells.value[1].key).toBe('col1')
      expect(mainSummaryCells.value[2].key).toBe('col2')
    })

    it('builds right cells from right-fixed columns', () => {
      const { rightSummaryCells } = useV2SummaryCells(createDeps({
        fixedV2Columns: computed(() => [
          { key: 'right1', fixed: 'right', width: 120 },
        ]),
      }))
      expect(rightSummaryCells.value).toHaveLength(1)
      expect(rightSummaryCells.value[0].style.width).toBe('120px')
    })

    it('builds right cells from right-fixed columns with summary values', () => {
      const { rightSummaryCells } = useV2SummaryCells(createDeps({
        fixedV2Columns: computed(() => [
          { key: 'right1', fixed: 'right', width: 120 },
        ]),
        v2KeyToOriginalCol: computed(() => new Map([
          ['right1', { prop: 'right1', width: 120 }],
        ])),
        getSummaryValue: vi.fn(() => '999'),
      }))
      expect(rightSummaryCells.value).toHaveLength(1)
      expect(rightSummaryCells.value[0].style.width).toBe('120px')
      expect(rightSummaryCells.value[0].value).toBe('999')
    })

    it('does not include fixed columns in main cells', () => {
      const { mainSummaryCells } = useV2SummaryCells(createDeps({
        selectionV2Columns: computed(() => []),
        normalV2Columns: computed(() => [
          { key: 'col1', width: 100 },
        ]),
        fixedV2Columns: computed(() => [
          { key: 'fixed1', fixed: 'left', width: 80 },
          { key: 'fixed2', fixed: 'right', width: 120 },
        ]),
      }))
      expect(mainSummaryCells.value).toHaveLength(1)
      expect(mainSummaryCells.value[0].key).toBe('col1')
    })
  })

  describe('width fallback — always lands on a numeric width shared with header/body', () => {
    it('missing V2 width resolves via resolveColumnWidth, flex forced 0/0 when fixed', () => {
      const { calcSummaryCellStyle } = useV2SummaryCells(createDeps({
        needsFixedWidth: computed(() => true),
        v2KeyToOriginalCol: computed(() => new Map([
          ['a', { prop: 'a' }],
        ])),
        resolveColumnWidth: () => 150,
      }))
      // <zh/> V2 宽缺失时必须与 V2 列工厂（getColumnWidth）同源取数：留空会让该格按汇总值文本撑开，
      // <zh/> 而表头按标题文本、表体按数据撑开，三者必然互不相同。
      // <en/> A missing V2 width must resolve from the same source as the V2 column factory
      // <en/> (getColumnWidth): leaving it empty sizes the cell by its summary text while the header
      // <en/> sizes by its title and the body by its data — all three necessarily differ.
      const style = calcSummaryCellStyle({ key: 'a', width: undefined, flexGrow: 1, flexShrink: 0 })
      expect(style.width).toBe('150px')
      expect(style.flexGrow).toBe(0)
      expect(style.flexShrink).toBe(0)
      expect(style.flexBasis).toBe('auto')
      expect(style.textAlign).toBe('left')
    })

    it('missing V2 width resolves even when the table is not fixed (single-level header included)', () => {
      const { calcSummaryCellStyle } = useV2SummaryCells(createDeps({
        needsFixedWidth: computed(() => false),
        v2KeyToOriginalCol: computed(() => new Map([
          ['a', { prop: 'a' }],
        ])),
        resolveColumnWidth: () => 150,
      }))
      // <zh/> 与表头层级无关：任何留空的宽度都会让该格退化成内容宽度
      // <en/> Independent of header depth: any empty width degrades the cell to content-driven sizing
      const style = calcSummaryCellStyle({ key: 'a', width: undefined })
      expect(style.width).toBe('150px')
      expect(style.flexGrow).toBe(0)
      expect(style.flexShrink).toBe(1)
    })

    it('numeric V2 width wins over the resolver', () => {
      const resolveColumnWidth = vi.fn(() => 999)
      const { calcSummaryCellStyle } = useV2SummaryCells(createDeps({
        needsFixedWidth: computed(() => true),
        v2KeyToOriginalCol: computed(() => new Map([
          ['a', { prop: 'a' }],
        ])),
        resolveColumnWidth,
      }))
      const style = calcSummaryCellStyle({ key: 'a', width: 120 })
      expect(style.width).toBe('120px')
      expect(resolveColumnWidth).not.toHaveBeenCalled()
    })

    it('falls back to original width/minWidth/150 when no resolver is provided', () => {
      const { calcSummaryCellStyle } = useV2SummaryCells(createDeps({
        needsFixedWidth: computed(() => true),
        v2KeyToOriginalCol: computed(() => new Map([
          ['a', { prop: 'a', width: 110 }],
          ['b', { prop: 'b', minWidth: 90 }],
          ['c', { prop: 'c' }],
        ])),
      }))
      expect(calcSummaryCellStyle({ key: 'a', width: undefined }).width).toBe('110px')
      expect(calcSummaryCellStyle({ key: 'b', width: undefined }).width).toBe('90px')
      expect(calcSummaryCellStyle({ key: 'c', width: undefined }).width).toBe('150px')
    })
  })

  describe('maxWidth/minWidth — EP calcColumnStyle parity under fixed mode', () => {
    it('drops maxWidth/minWidth when the table is fixed (EP skips them under props.fixed)', () => {
      const { calcSummaryCellStyle } = useV2SummaryCells(createDeps({
        needsFixedWidth: computed(() => true),
      }))
      // <zh/> EP 仅在 `props.fixed === false` 时下发 maxWidth/minWidth；fixed 模式下这些限制不参与布局，
      // <zh/> 汇总必须同步跳过，否则固定/溢出行出现宽度分歧
      // <en/> EP emits maxWidth/minWidth only when `props.fixed === false`; those constraints take no
      // <en/> part in layout under fixed mode, so the summary must skip them too or fixed/overflowing
      // <en/> rows diverge in width
      const style = calcSummaryCellStyle({ key: 'a', width: 100, maxWidth: 300, minWidth: 80 })
      expect(style.width).toBe('100px')
      expect(style.maxWidth).toBeUndefined()
      expect(style.minWidth).toBeUndefined()
    })

    it('keeps maxWidth/minWidth when the table is not fixed', () => {
      const { calcSummaryCellStyle } = useV2SummaryCells(createDeps({
        needsFixedWidth: computed(() => false),
      }))
      const style = calcSummaryCellStyle({ key: 'a', width: 100, maxWidth: 300, minWidth: 80 })
      expect(style.maxWidth).toBe('300px')
      expect(style.minWidth).toBe('80px')
    })
  })

  describe('getV2SummaryValue', () => {
    it('looks up summary value via v2KeyToOriginalCol mapping', () => {
      const originalCol = { prop: 'price', width: 100 }
      const { getV2SummaryValue } = useV2SummaryCells(createDeps({
        v2KeyToOriginalCol: computed(() => new Map([['v2key1', originalCol]])),
        getSummaryValue: vi.fn(() => '¥1,234'),
      }))
      const result = getV2SummaryValue({ key: 'v2key1' })
      expect(result).toBe('¥1,234')
    })

    it('returns undefined when column not found in mapping', () => {
      const { getV2SummaryValue } = useV2SummaryCells(createDeps({
        v2KeyToOriginalCol: computed(() => new Map()),
        getSummaryValue: vi.fn(),
      }))
      const result = getV2SummaryValue({ key: 'unknown' })
      expect(result).toBeUndefined()
    })
  })
})
