import type { ProcessedColumn } from '../../src/types'
import type { IndexMaps, RowResolver } from '../../src/utils/event-handlers'
import { describe, expect, it } from 'vitest'
import {
  createRowEventHandlers,

} from '../../src/utils/event-handlers'

function makeContext(rowKey: (row: Record<string, unknown>) => string, maps: IndexMaps) {
  const resolver: RowResolver = { getRowKey: rowKey }
  return {
    getRowResolver: () => resolver,
    getIndexMaps: () => maps,
  }
}

// 事件对象不参与断言，用最小桩避免依赖具体 DOM Event 实现
const fakeEvent = { type: 'click' } as unknown as Event

describe('createRowEventHandlers', () => {
  const maps: IndexMaps = {
    rowIndexMap: new Map([['1', 0], ['2', 1]]),
    columnIndexMap: new Map([['name', 0], ['age', 1]]),
  }

  it('rowClick 透传 rowData 并通过 rowKey 解析 rowIndex', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const row = { id: 2 }
    const result = handlers.rowClick(row, fakeEvent)

    expect(result.rowData).toBe(row)
    expect(result.rowIndex).toBe(1)
    expect(result.event).toBe(fakeEvent)
  })

  it('cellClick 透传列定义并返回解析后的 columnIndex', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const col = { key: 'age' } as unknown as ProcessedColumn
    const result = handlers.cellClick({ id: 1 }, col, fakeEvent)

    expect(result.column).toBe(col)
    expect(result.columnIndex).toBe(1)
    expect(result.rowIndex).toBe(0)
  })

  it('headerClick 仅返回列与 columnIndex', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const col = { key: 'name' } as unknown as ProcessedColumn
    const result = handlers.headerClick(col, fakeEvent)

    expect(result.column).toBe(col)
    expect(result.columnIndex).toBe(0)
  })

  it('未命中索引时返回 -1 而不抛错', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const result = handlers.rowClick({ id: 999 }, fakeEvent)

    expect(result.rowIndex).toBe(-1)
    expect(result.rowData).toEqual({ id: 999 })
  })

  it('headerDragend 透传宽度与列并解析 columnIndex', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const col = { key: 'name' } as unknown as ProcessedColumn
    const result = handlers.headerDragend(200, 100, col, fakeEvent as MouseEvent)

    expect(result.column).toBe(col)
    expect(result.columnIndex).toBe(0)
    expect(result.newWidth).toBe(200)
    expect(result.oldWidth).toBe(100)
  })

  it('rowContextmenu 透传 rowData 并返回 rowIndex', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const row = { id: 1 }
    const result = handlers.rowContextmenu(row, fakeEvent)

    expect(result.rowData).toBe(row)
    expect(result.rowIndex).toBe(0)
    expect(result.event).toBe(fakeEvent)
  })

  it('rowDblclick 透传 rowData 并返回 rowIndex', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const row = { id: 2 }
    const result = handlers.rowDblclick(row, fakeEvent)

    expect(result.rowData).toBe(row)
    expect(result.rowIndex).toBe(1)
    expect(result.event).toBe(fakeEvent)
  })

  it('cellDblclick 透传列定义并返回解析后的 columnIndex', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const col = { key: 'name' } as unknown as ProcessedColumn
    const result = handlers.cellDblclick({ id: 1 }, col, fakeEvent)

    expect(result.column).toBe(col)
    expect(result.columnIndex).toBe(0)
    expect(result.rowIndex).toBe(0)
  })

  it('cellContextmenu 透传列定义并返回解析后的 columnIndex', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const col = { key: 'age' } as unknown as ProcessedColumn
    const result = handlers.cellContextmenu({ id: 2 }, col, fakeEvent)

    expect(result.column).toBe(col)
    expect(result.columnIndex).toBe(1)
    expect(result.rowIndex).toBe(1)
  })

  it('cellMouseEnter 透传 rowData 并返回 rowIndex', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const row = { id: 1 }
    const result = handlers.cellMouseEnter(row, fakeEvent)

    expect(result.rowData).toBe(row)
    expect(result.rowIndex).toBe(0)
    expect(result.event).toBe(fakeEvent)
  })

  it('headerContextmenu 透传列与 columnIndex', () => {
    const handlers = createRowEventHandlers(makeContext(row => String(row.id), maps))
    const col = { key: 'age' } as unknown as ProcessedColumn
    const result = handlers.headerContextmenu(col, fakeEvent)

    expect(result.column).toBe(col)
    expect(result.columnIndex).toBe(1)
    expect(result.event).toBe(fakeEvent)
  })
})
