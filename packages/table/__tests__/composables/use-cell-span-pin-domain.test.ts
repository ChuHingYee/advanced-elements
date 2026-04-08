import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useCellSpan } from '../../src/composables/data/use-cell-span'

// <zh/> 行对象身份必须跨"管线域 → composed 域"保持——pin/grand 行与滚动行是同一引用，仅位置不同
// <en/> Row identity must hold across the pipeline → composed domains — pinned/grand rows share references with scrolled rows, differing only in position
const pinnedRow = { g: 'P', name: 'Pinned' }
const rowB = { g: 'X', name: 'B' }
const rowC = { g: 'X', name: 'C' }
const rowD = { g: 'Y', name: 'D' }
const grandRow = { g: 'TOTAL', name: 'Grand', __grandPosition: 'bottom' }

// <zh/> spanMap 建在 unpinned 域 [B, C, D]；B-C 按 g 值合并 | <en/> spanMap is built on the unpinned domain [B, C, D]; B-C merge on g
const unpinned = [rowB, rowC, rowD]
const columns = [
  { prop: 'g', label: 'G', spanRows: true, hidden: false },
  { prop: 'name', label: 'Name', hidden: false },
] as ProcessedColumn[]

function spanParams(row: any, rowIndex: number, column: any = { property: 'g' }) {
  return { row, column, rowIndex, columnIndex: 0 }
}

describe('useCellSpan — unified index domain (span×pin)', () => {
  it('translates composed-domain indexes by row identity', async () => {
    const { spanMethod } = useCellSpan({
      columns: () => columns,
      data: () => unpinned,
    })
    await nextTick()
    const fn = spanMethod.value!
    expect(fn).toBeDefined()

    // <zh/> composed 域模拟：[pinned(A@0), B@1, C@2, D@3, grand@4] | <en/> Simulated composed domain
    // <zh/> pin 条带行无映射 → undefined（ElTable 取默认 {1,1}，不参与合并）
    // <en/> Pinned strip rows miss the map → undefined (ElTable defaults to {1,1}; strips never merge)
    expect(fn(spanParams(pinnedRow, 0))).toBeUndefined()
    // <zh/> 滚动行按身份换算：B 为 2 格合并起点，C 被隐藏，D 无合并
    // <en/> Scrolled rows translate by identity: B origins a 2-row merge, C is hidden, D has no merge
    expect(fn(spanParams(rowB, 1))).toEqual({ rowspan: 2, colspan: 1 })
    expect(fn(spanParams(rowC, 2))).toEqual({ rowspan: 0, colspan: 0 })
    expect(fn(spanParams(rowD, 3))).toBeUndefined()
    // <zh/> grand 合计行无映射 → undefined，不会吞掉滚动行的合并，也不会自己起合并
    // <en/> Grand total rows miss the map → undefined: neither swallowing scrolled merges nor starting their own
    expect(fn(spanParams(grandRow, 4))).toBeUndefined()
  })

  it('stays identical when pin is off (composed === unpinned)', async () => {
    const all = [pinnedRow, rowB, rowC, rowD]
    const { spanMethod } = useCellSpan({
      columns: () => columns,
      data: () => all,
    })
    await nextTick()
    const fn = spanMethod.value!
    // <zh/> 无 pin 时 composed 即 unpinned：P 单行无合并，B 起点合并 2 格，C 隐藏
    // <en/> Without pin, composed === unpinned: P has no merge, B origins a 2-row merge, C is hidden
    expect(fn(spanParams(pinnedRow, 0))).toBeUndefined()
    expect(fn(spanParams(rowB, 1))).toEqual({ rowspan: 2, colspan: 1 })
    expect(fn(spanParams(rowC, 2))).toEqual({ rowspan: 0, colspan: 0 })
  })

  it('supports ProcessedColumn-shaped column objects (prop)', async () => {
    const { spanMethod } = useCellSpan({
      columns: () => columns,
      data: () => unpinned,
    })
    await nextTick()
    const fn = spanMethod.value!
    expect(fn(spanParams(rowB, 1, { prop: 'g' }))).toEqual({ rowspan: 2, colspan: 1 })
    expect(fn(spanParams(rowB, 1, {}))).toBeUndefined()
  })
})
