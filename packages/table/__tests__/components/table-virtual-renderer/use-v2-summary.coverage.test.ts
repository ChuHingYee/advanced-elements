import type { UseV2SummaryDeps } from '../../../src/components/table-virtual-renderer/use-v2-summary'
import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { useV2Summary } from '../../../src/components/table-virtual-renderer/use-v2-summary'

/** <zh/> 2 行 2 列最小数据 | <en/> Minimal 2-row, 2-col data */
const rows = [{ a: 1, b: 2 }, { a: 3, b: 4 }]

/** <zh/> 参与汇总的原始列 | <en/> Original columns participating in the summary */
const originalColumns = [
  { key: 'a', prop: 'a' },
  { key: 'b', prop: 'b' },
]

/** <zh/> 用例配置 | <en/> Per-case options */
interface HarnessOptions {
  /** <zh/> 是否需要固定宽度布局 | <en/> whether the fixed-width layout is required */
  needsFixedWidth?: boolean
  /** <zh/> 主区普通列原始宽度（按序对应 a/b） | <en/> raw widths of main-area normal columns (ordered a/b) */
  normalWidths?: unknown[]
  /** <zh/> 自定义汇总方法 | <en/> custom summary method */
  summaryMethod?: (params: { columns: any[], data: any[] }) => (string | any)[]
  /** <zh/> Grand 原始聚合 | <en/> grand raw aggregates */
  grandRaw?: Record<string, unknown>
}

function createDeps(options: HarnessOptions = {}): UseV2SummaryDeps {
  const {
    needsFixedWidth = true,
    normalWidths = [100, 200],
    summaryMethod,
    grandRaw = {},
  } = options
  const keys = ['a', 'b']
  // <zh/> V2 列宽直传（含字符串/非法值），由汇总样式原样承载后交 summaryMainWidth 解析
  // <en/> V2 widths pass through as-is (incl. strings/illegal values); the summary style carries
  // <en/> them verbatim for summaryMainWidth to parse
  const normalV2Columns = computed(() =>
    normalWidths.map((width, i) => ({ key: keys[i], width }) as any),
  )
  return {
    props: { data: rows, summaryMethod } as any,
    summaryAllColumns: computed(() => originalColumns as any[]),
    sumTextLocal: computed(() => '合计'),
    needSummaryCellsV: computed(() => true),
    grandRawAggregatesV: computed(() => grandRaw),
    v2KeyToOriginalCol: computed(() => new Map<string, any>([
      ['a', originalColumns[0]],
      ['b', originalColumns[1]],
    ])),
    selectionV2Columns: computed(() => []),
    normalV2Columns,
    fixedV2Columns: computed(() => []),
    needsFixedWidth: computed(() => needsFixedWidth),
    getColumnWidth: (col: any) => col?.width ?? col?.minWidth ?? 150,
    t: () => undefined,
  }
}

describe('useV2Summary — summaryMainWidth', () => {
  it('needsFixedWidth=false 时返回 undefined（交由 CSS 处理） | returns undefined when not fixed (CSS handles it)', () => {
    // <zh/> 即使主区单元格有宽度，非固定模式也不下发显式宽度
    // <en/> Even with sized main cells, unfixed mode emits no explicit width
    const { mainSummaryCells, summaryMainWidth } = useV2Summary(createDeps({ needsFixedWidth: false }))
    expect(mainSummaryCells.value).toHaveLength(2)
    expect(summaryMainWidth.value).toBeUndefined()
  })

  it('数值宽度求和 | sums numeric widths', () => {
    // <zh/> V2 数值宽经样式转为 '100px' 形式，解析后累加
    // <en/> Numeric V2 widths become '100px'-style strings and are parsed then summed
    const { summaryMainWidth } = useV2Summary(createDeps({ normalWidths: [100, 200] }))
    expect(summaryMainWidth.value).toBe(300)
  })

  it('字符串宽度解析求和 | parses and sums string widths', () => {
    // <zh/> '120px' 风格字符串按 parseInt 解析
    // <en/> '120px'-style strings are parsed via parseInt
    const { summaryMainWidth } = useV2Summary(createDeps({ normalWidths: ['120px', '80px'] }))
    expect(summaryMainWidth.value).toBe(200)
  })

  it('naN 字符串宽度返回 undefined | returns undefined on NaN string width', () => {
    // <zh/> 'auto' 无法解析为数字，整行宽度不可信则放弃
    // <en/> 'auto' parses to NaN, so the whole row width is dropped as untrustworthy
    const { summaryMainWidth } = useV2Summary(createDeps({ normalWidths: ['120px', 'auto'] }))
    expect(summaryMainWidth.value).toBeUndefined()
  })

  it('无可用宽度的单元格返回 undefined | returns undefined when a cell has no usable width', () => {
    // <zh/> 非数字非字符串宽度（防御分支）直接放弃
    // <en/> A neither-number-nor-string width (defensive branch) drops the total
    const { summaryMainWidth } = useV2Summary(createDeps({ normalWidths: [100, {}] }))
    expect(summaryMainWidth.value).toBeUndefined()
  })

  it('主区无单元格时 total=0 返回 undefined | returns undefined when the main area is empty (total 0)', () => {
    // <zh/> 空主区累加为 0，按无效处理
    // <en/> An empty main area totals 0, treated as invalid
    const { mainSummaryCells, summaryMainWidth } = useV2Summary(createDeps({ normalWidths: [] }))
    expect(mainSummaryCells.value).toHaveLength(0)
    expect(summaryMainWidth.value).toBeUndefined()
  })
})

describe('useV2Summary — sharedAggregates 两侧 | both sides of sharedAggregates', () => {
  it('无 summaryMethod 时复用 Grand 原始聚合（零重算） | reuses grand raw aggregates without summaryMethod (zero recompute)', () => {
    // <zh/> b 列数据合计为 6，但共享聚合给出 20——断言 20 即证明走了共享路径而非重算
    // <en/> Column b sums to 6 from data, but shared aggregates say 20 — asserting 20 proves
    // <en/> the shared path instead of recomputation
    const { getSummaryValue } = useV2Summary(createDeps({ grandRaw: { a: 999, b: 20 } }))
    expect(getSummaryValue(originalColumns[1] as any)).toBe('20')
    expect(getSummaryValue(originalColumns[0] as any)).toBe('合计')
  })

  it('有 summaryMethod 时不共享聚合（用户函数自有数据源） | skips sharing with summaryMethod (user fn owns its source)', () => {
    // <zh/> 即使 Grand 聚合存在且冲突，结果仍完全来自 summaryMethod
    // <en/> Even with conflicting grand aggregates present, results come solely from summaryMethod
    const { getSummaryValue } = useV2Summary(createDeps({
      grandRaw: { a: 999, b: 20 },
      summaryMethod: () => ['custom-first', 'custom-b'],
    }))
    expect(getSummaryValue(originalColumns[0] as any)).toBe('custom-first')
    expect(getSummaryValue(originalColumns[1] as any)).toBe('custom-b')
  })
})
