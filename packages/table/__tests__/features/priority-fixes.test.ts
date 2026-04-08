import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ref } from 'vue'
import { partitionColumnsByFixed } from '../../src/components/table-virtual-renderer/use-virtual-columns'
import { useColumnSort } from '../../src/composables/data/use-column-sort'
import { useTableDataPipeline } from '../../src/composables/data/use-table-data-pipeline'
/**
 * <zh/> 高/中优先级修复项的专项回归测试：
 * sanitizeUrl / shallowEqual 收口 / raf 工具 / maxSortColumns / undoMaxStackSize / CSV 负数豁免。
 * <en/> Focused regression tests for the high/medium-priority fixes:
 * sanitizeUrl / shallowEqual consolidation / raf utils / maxSortColumns / undoMaxStackSize / CSV numeric exemption.
 */
import { useEditUndo } from '../../src/composables/editing/use-edit-undo'
import { shallowEqual } from '../../src/utils/equality'
import { rafSchedule, rafThrottle } from '../../src/utils/raf'
import { sanitizeUrl } from '../../src/utils/security'
import { buildDefaultSummaryRow } from '../../src/utils/summary-defaults'

// security.sanitizeUrl
describe('security.sanitizeUrl', () => {
  it('allows whitelisted protocols', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com')
    expect(sanitizeUrl('http://example.com/a')).toBe('http://example.com/a')
    expect(sanitizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(sanitizeUrl('tel:+8613800000000')).toBe('tel:+8613800000000')
  })

  it('allows relative URLs without scheme', () => {
    expect(sanitizeUrl('/path/to')).toBe('/path/to')
    expect(sanitizeUrl('./rel')).toBe('./rel')
    expect(sanitizeUrl('#anchor')).toBe('#anchor')
    expect(sanitizeUrl('?q=1')).toBe('?q=1')
    expect(sanitizeUrl('plain-text')).toBe('plain-text')
  })

  it('blocks executable protocols (case-insensitive)', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('JaVaScRiPt:alert(1)')).toBe('')
    expect(sanitizeUrl('data:text/html,<script>')).toBe('')
    expect(sanitizeUrl('vbscript:msgbox')).toBe('')
  })

  it('handles non-string and empty inputs', () => {
    expect(sanitizeUrl(undefined)).toBe('')
    expect(sanitizeUrl(null)).toBe('')
    expect(sanitizeUrl(123)).toBe('')
    expect(sanitizeUrl('')).toBe('')
    expect(sanitizeUrl('   ')).toBe('')
  })
})

// equality.shallowEqual (consolidated implementation)
describe('equality.shallowEqual (consolidated)', () => {
  it('primitives short-circuit via ===', () => {
    expect(shallowEqual(1, 1)).toBe(true)
    expect(shallowEqual('a', 'a')).toBe(true)
    expect(shallowEqual(1, '1')).toBe(false)
    expect(shallowEqual(null, null)).toBe(true)
  })

  it('compares arrays element-wise by reference', () => {
    const shared = { x: 1 }
    expect(shallowEqual([shared, 2], [shared, 2])).toBe(true)
    expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(shallowEqual([1], [2])).toBe(false)
    // 数组 vs 对象 | array vs object
    expect(shallowEqual([1], { 0: 1 })).toBe(false)
  })

  it('distinguishes own-key presence ({a:undefined} vs {})', () => {
    expect(shallowEqual({ a: undefined }, {})).toBe(false)
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(shallowEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
  })
})

// utils/raf — rafSchedule & rafThrottle
describe('utils/raf', () => {
  let rafCallbacks: Map<number, FrameRequestCallback>

  beforeEach(() => {
    rafCallbacks = new Map()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = rafCallbacks.size + 1 + Math.floor(Math.random() * 1000)
      rafCallbacks.set(id, cb)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function flushFrame() {
    const cbs = [...rafCallbacks.entries()]
    rafCallbacks.clear()
    for (const [, cb] of cbs)
      cb(16)
  }

  it('rafSchedule coalesces repeated schedules into one flush; cancel drops pending', () => {
    const spy = vi.fn()
    const handle = rafSchedule(spy)

    handle.schedule()
    handle.schedule()
    handle.schedule()
    expect(rafCallbacks.size).toBe(1)

    flushFrame()
    expect(spy).toHaveBeenCalledTimes(1)

    // cancel 后不再执行 | no execution after cancel
    handle.schedule()
    handle.cancel()
    flushFrame()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('rafThrottle runs at most once per frame with latest args; cancel works', () => {
    const spy = vi.fn()
    const [throttled, cancel] = rafThrottle((a: number, b: number) => spy(a, b))

    throttled(1, 1)
    throttled(2, 2)
    throttled(3, 4)
    expect(rafCallbacks.size).toBe(1)

    flushFrame()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(3, 4)

    cancel()
    throttled(5, 5)
    cancel()
    flushFrame()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

// use-column-sort maxSortColumns
describe('useColumnSort maxSortColumns', () => {
  function makeCols(props: string[]) {
    return props.map(p => ({ prop: p, key: p })) as any[]
  }
  const base = { data: [] as any[], columns: makeCols(['a', 'b', 'c']) }

  it('evicts the oldest column FIFO when exceeding the cap', () => {
    const sort = useColumnSort({ ...base, maxSortColumns: 2 })
    sort.toggleSort('a')
    sort.toggleSort('b', { shiftKey: true })
    expect(sort.sortState.value.map(s => s.prop)).toEqual(['a', 'b'])

    sort.toggleSort('c', { shiftKey: true })
    expect(sort.sortState.value.map(s => s.prop)).toEqual(['b', 'c'])
  })

  it('cap of 1 disables multi-sort effectively', () => {
    const sort = useColumnSort({ ...base, maxSortColumns: 1 })
    sort.toggleSort('a')
    sort.toggleSort('b', { shiftKey: true })
    expect(sort.sortState.value.map(s => s.prop)).toEqual(['b'])
  })

  it('unlimited by default (backward compatible)', () => {
    const sort = useColumnSort(base)
    for (const p of ['a', 'b', 'c'])
      sort.toggleSort(p, { shiftKey: true })
    expect(sort.sortState.value.length).toBe(3)
  })
})

// use-edit-undo reactive maxStackSize getter
describe('useEditUndo maxStackSize via getter', () => {
  function entry(i: number) {
    return {
      type: 'cell' as const,
      rowIndex: i,
      rowKey: `k${i}`,
      changes: [{ prop: 'v', oldValue: 0, newValue: i }],
      timestamp: i,
    } as any
  }

  it('respects stack depth supplied as a getter (FIFO eviction)', () => {
    const undo = useEditUndo<any>({
      data: [] as any[],
      onDataUpdate: vi.fn(),
      maxStackSize: () => 2,
    })
    undo.pushUndo(entry(1))
    undo.pushUndo(entry(2))
    undo.pushUndo(entry(3))
    expect(undo.undoStack.value.length).toBe(2)
    expect(undo.undoStack.value[0].timestamp).toBe(2)
  })

  it('defaults to 50 when getter returns undefined', () => {
    const undo = useEditUndo<any>({
      data: [] as any[],
      onDataUpdate: vi.fn(),
      maxStackSize: () => undefined,
    })
    for (let i = 0; i < 55; i++)
      undo.pushUndo(entry(i))
    expect(undo.undoStack.value.length).toBe(50)
  })
})

// export-csv: numeric values exempt from formula neutralization
describe('exportCsv numeric formula-exemption', () => {
  let lastBlobParts: any[]

  beforeEach(() => {
    lastBlobParts = []
    class MockBlob {
      parts: any[]
      constructor(parts: any[]) {
        this.parts = parts
        lastBlobParts = parts
      }
    }
    vi.stubGlobal('Blob', MockBlob as any)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const link = { href: '', download: '', click: () => {} }
    vi.stubGlobal('document', {
      createElement: () => link,
      body: { appendChild: () => {}, removeChild: () => {} },
    } as any)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps negative numbers intact while still neutralizing formulas', async () => {
    const { exportCsv } = await import('../../src/utils/export-csv')
    exportCsv({
      data: [
        { v: -123 },
        { v: '=CMD|"/c calc"!A1' },
        { v: '+30' },
        { v: -0.5 },
        { v: '1e-3' },
      ],
      columns: [{ prop: 'v', label: 'V', hidden: false }] as any,
    })

    const content = String(lastBlobParts[0])
    const lines = content.split('\r\n').slice(1)
    expect(lines[0]).toBe('-123')
    // 含引号的公式串：中和前缀 + 引号包裹转义 | quoted formula: `'` prefix + quote escaping
    expect(lines[1]).toBe(`"'=CMD|""/c calc""!A1"`)
    expect(lines[2]).toBe('+30')
    expect(lines[3]).toBe('-0.5')
    expect(lines[4]).toBe('1e-3')
  })
})

// use-column-sort: setSorts shares the multi-sort cap/dedupe
// (historical defect: programmatic setSorts bypassed maxSortColumns)
describe('useColumnSort setSorts cap/dedupe', () => {
  function makeCols(props: string[]) {
    return props.map(p => ({ prop: p, key: p })) as any[]
  }
  const base = { data: [] as any[], columns: makeCols(['a', 'b', 'c', 'd']) }

  it('setSorts trims to the last `max` entries (FIFO) instead of bypassing the cap', () => {
    const sort = useColumnSort({ ...base, maxSortColumns: 2 })
    sort.setSorts([
      { prop: 'a', order: 'ascending' },
      { prop: 'b', order: 'descending' },
      { prop: 'c', order: 'ascending' },
    ] as any)
    expect(sort.sortState.value.map(s => s.prop)).toEqual(['b', 'c'])
  })

  it('setSorts dedupes by key keeping the last declaration', () => {
    const sort = useColumnSort({ ...base })
    sort.setSorts([
      { prop: 'a', order: 'ascending' },
      { prop: 'a', order: 'descending' },
      { prop: 'b', order: 'ascending' },
    ] as any)
    expect(sort.sortState.value.map(s => `${s.prop}:${s.order}`)).toEqual(['a:descending', 'b:ascending'])
  })

  it('click path and programmatic path converge under the same cap', () => {
    const viaClick = useColumnSort({ ...base, maxSortColumns: 2 })
    viaClick.toggleSort('a')
    viaClick.toggleSort('b', { shiftKey: true })
    viaClick.toggleSort('c', { shiftKey: true })

    const viaApi = useColumnSort({ ...base, maxSortColumns: 2 })
    viaApi.setSorts([
      { prop: 'a', order: 'ascending' },
      { prop: 'b', order: 'descending' },
      { prop: 'c', order: 'ascending' },
    ] as any)

    expect(viaClick.sortState.value.map(s => s.prop)).toEqual(viaApi.sortState.value.map(s => s.prop))
  })
})

// partitionColumnsByFixed: fixed-group duplication regression
// (historical defect: a fixed:'left'|'right' group whose children all
//  resolved to main still pushed a full-children clone into the strip)
describe('partitionColumnsByFixed fixed-group duplication regression', () => {
  function leaf(prop: string, extra: Record<string, unknown> = {}) {
    return { key: prop, prop, label: prop, hidden: false, ...extra } as any
  }

  function collectLeaves(cols: any[], acc: string[] = []): string[] {
    for (const c of cols) {
      if (c.children?.length)
        collectLeaves(c.children, acc)
      else if (c.prop)
        acc.push(c.prop)
    }
    return acc
  }

  it('drops the left clone when a left-fixed group owns no left children', () => {
    const group = leaf('g', { fixed: 'left', children: [leaf('x'), leaf('y')] })
    const r = partitionColumnsByFixed([group])

    expect(r.left).toHaveLength(0)
    expect(r.right).toHaveLength(0)
    expect(r.main).toHaveLength(1)
    expect(r.main[0].children!.map((c: any) => c.prop)).toEqual(['x', 'y'])
    // 同一组列在结果中只出现一次，叶子不重复 | the group renders exactly once, leaves are unique
    expect(collectLeaves([...r.main, ...r.left, ...r.right])).toEqual(['x', 'y'])
  })

  it('keeps one clone per region that actually holds children (mixed case)', () => {
    const group = leaf('g', {
      fixed: 'left',
      children: [leaf('c1', { fixed: 'left' }), leaf('m1'), leaf('r1', { fixed: 'right' })],
    })
    const r = partitionColumnsByFixed([group])

    expect(r.left[0].children!.map((c: any) => c.prop)).toEqual(['c1'])
    expect(r.main[0].children!.map((c: any) => c.prop)).toEqual(['m1'])
    expect(r.right[0].children!.map((c: any) => c.prop)).toEqual(['r1'])
    // <zh/> 叶子收集按 DOM 渲染顺序 left → main → right（与固定区分区渲染次序一致）
    // <en/> Leaf collection follows DOM render order left → main → right (matching fixed-region render order)
    expect(collectLeaves([...r.left, ...r.main, ...r.right])).toEqual(['c1', 'm1', 'r1'])
  })

  it('mirrors the fix for right-fixed groups', () => {
    const group = leaf('g', { fixed: 'right', children: [leaf('x'), leaf('y')] })
    const r = partitionColumnsByFixed([group])

    expect(r.right).toHaveLength(0)
    expect(r.main[0].children!.map((c: any) => c.prop)).toEqual(['x', 'y'])
    expect(collectLeaves([...r.main, ...r.left, ...r.right])).toEqual(['x', 'y'])
  })

  it('still clones plain leaf fixed columns as before', () => {
    const r = partitionColumnsByFixed([leaf('l', { fixed: 'left' }), leaf('m')])
    expect(r.left.map(c => c.prop)).toEqual(['l'])
    expect(r.main.map(c => c.prop)).toEqual(['m'])
  })
})

// buildDefaultSummaryRow — shared default-summary single source of truth
describe('buildDefaultSummaryRow', () => {
  // [selection-like, qty, name, selection-like] — mirrors real column layouts
  const cols = [{}, { prop: 'qty' }, { prop: 'name' }, {}]

  it('sumText lands on the first prop column; other prop columns get numeric sums', () => {
    const rows = [
      { qty: 2, name: 'a' },
      { qty: 3.5, name: 'b' },
    ]
    // <zh/> 契约修订：与全部存量汇总用例及文档对齐——首 prop 列恒显 sumText 占位，
    // <zh/> 数值和落在其余 prop 列（qty 为首 prop 列，故显示合计而非自身求和）
    // <en/> Contract revision aligned with all legacy summary suites and docs — the first prop
    // <en/> column always shows sumText; numeric sums land on the OTHER prop columns (qty is the
    // <en/> first prop column here, so it shows the placeholder rather than its own total)
    expect(buildDefaultSummaryRow(cols, rows, '合计')).toEqual(['', '合计', '', ''])
  })

  it('ignores non-number / NaN / missing cells; all-invalid columns stay blank', () => {
    const rows = [
      { qty: '12', name: Number.NaN }, // numeric strings are NOT summed (typeof guard)
      { name: undefined },
    ]
    // <zh/> 契约修订：首 prop 列的 sumText 占位在无任何有效数值时依然保留
    // <en/> Contract revision: the first prop column keeps its sumText placeholder even with zero valid numbers
    expect(buildDefaultSummaryRow(cols, rows as any, '合计')).toEqual(['', '合计', '', ''])
  })

  it('renders sumText even with empty data', () => {
    expect(buildDefaultSummaryRow(cols, [], 'Sum')).toEqual(['', 'Sum', '', ''])
  })

  it('returns an empty array aligned to zero columns', () => {
    expect(buildDefaultSummaryRow([], [{ a: 1 }], 'S')).toEqual([])
  })
})

// pipeline renderData ↔ rowPin domain contract
// (the editing chain now consumes renderData; these cases lock the
//  domain split the renderer wiring depends on)
describe('pipeline renderData/rowPin domain contract', () => {
  function createPinPipeline(data: any[], pin: any) {
    return useTableDataPipeline({
      localColumns: ref([{ key: 'id', prop: 'id', label: 'ID', hidden: false }] as any[]),
      pipelineData: ref(data),
      tableData: ref(data),
      selectableFn: ref(undefined),
      isClientPagination: ref(false),
      currentPage: ref(1),
      pageSize: ref(20),
      rowKeyFn: () => (row: any) => row.id, // getter 形态：pipeline 内部经 toValue 解包 | getter form: unwrapped via toValue inside the pipeline
      rowPinConfig: () => pin,
    } as any)
  }

  it('visibleData retains pinned rows while renderData extracts them', () => {
    const data = [{ id: 'p1' }, { id: 'm' }, { id: 'b1' }]
    const p = createPinPipeline(data, { topRowKeys: ['p1'], bottomRowKeys: ['b1'] })

    expect(p.visibleData.value.map((r: any) => r.id)).toEqual(['p1', 'm', 'b1'])
    expect(p.renderData.value.map((r: any) => r.id)).toEqual(['m'])
    expect(p.rowPinApi.topPinnedRows.value.map((r: any) => r.id)).toEqual(['p1'])
    expect(p.rowPinApi.bottomPinnedRows.value.map((r: any) => r.id)).toEqual(['b1'])
  })

  it('renderData passes through visibleData by reference when pin is disabled', () => {
    const p = createPinPipeline([{ id: 'a' }], {})
    expect(p.renderData.value).toBe(p.visibleData.value)
  })
})
