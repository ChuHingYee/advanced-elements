import { describe, expect, it } from 'vitest'
import { createStableSpanRowComponent } from '../../../src/components/table-virtual-renderer/span-row-renderer'

describe('stable SpanRow rowData passthrough', () => {
  it('forwards rowData to getSpanInfo for synthetic-row identity translation', () => {
    const seen: unknown[] = []
    const ctx = {
      getSpanInfo: (_rowIndex: number, _colKey: string, rowData?: unknown) => {
        seen.push(rowData)
        return undefined
      },
      colIndexMap: new Map([['name', 0]]),
      firstMainCellIndex: 0,
      rowHeight: 48,
    }
    const StableRow = createStableSpanRowComponent(() => ctx as any)
    const rowData = { id: 'grand-top' }
    const cells = [{ key: 'name', props: {} }] as any
    StableRow({ cells, rowIndex: 0, rowData, columns: [] })
    // <zh/> 行对象必须透传：合成行靠身份回退 undefined，缺参会按 grid 行号错位查表 | <en/> rowData must be forwarded: synthetic rows fall back by identity; a missing arg misaligns the grid-index lookup
    expect(seen).toEqual([rowData])
  })
})
