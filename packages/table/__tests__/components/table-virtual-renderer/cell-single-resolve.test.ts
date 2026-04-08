import type { AdvColumn } from '@/types/column'
import { describe, expect, it, vi } from 'vitest'
import { renderCell } from '@/components/cell-renderers/cell-renderer'
import { buildCellContent } from '@/components/renderer-core/cell-render-content'

const baseCellOpts = {
  rowIndex: 0,
  columnIndex: 0,
  slots: {} as Record<string | symbol, (...args: unknown[]) => any>,
  slotKey: 'name',
}

describe('2-3 hot-path single resolve (phase 2)', () => {
  it('renderCell reuses provided cellData without invoking valueGetter', () => {
    const valueGetter = vi.fn(({ row }: any) => row.price * 2)
    const column = { prop: 'price', valueGetter } as unknown as AdvColumn
    const rowData = { price: 21 }
    const result = renderCell({ ...baseCellOpts, column, rowData, cellData: 42 })
    expect(result).toBe('42')
    expect(valueGetter).not.toHaveBeenCalled()
  })

  it('renderCell falls back to valueGetter when cellData absent', () => {
    const valueGetter = vi.fn(({ row }: any) => row.price * 2)
    const column = { prop: 'price', valueGetter } as unknown as AdvColumn
    const rowData = { price: 21 }
    const result = renderCell({ ...baseCellOpts, column, rowData })
    expect(result).toBe('42')
    expect(valueGetter).toHaveBeenCalledTimes(1)
  })

  it('buildCellContent shares one resolution between tooltip and content', () => {
    const valueGetter = vi.fn(({ row }: any) => row.price * 2)
    const col = {
      prop: 'price',
      valueGetter,
      ellipsis: true,
    } as unknown as Parameters<typeof buildCellContent>[0]['col']
    const input = {
      col,
      colIndex: 0,
      columns: [col],
      row: { price: 10 },
      rowIndex: 0,
      slots: {},
      slotKey: 'price',
      t: undefined,
      ctx: null,
      showInlineHover: false,
      hoverOptionTeleport: false,
      hoverOptionColumns: [],
      rowKeyStr: 'k1',
    } as unknown as Parameters<typeof buildCellContent>[0]
    buildCellContent(input)
    // tooltip + content 共享同一次取值：仅 1 次 valueGetter 调用
    expect(valueGetter).toHaveBeenCalledTimes(1)
  })

  it('buildCellContent with pre-resolved cellData skips valueGetter entirely', () => {
    const valueGetter = vi.fn(({ row }: any) => row.price * 2)
    const col = {
      prop: 'price',
      valueGetter,
      ellipsis: true,
    } as unknown as Parameters<typeof buildCellContent>[0]['col']
    const input = {
      col,
      colIndex: 0,
      columns: [col],
      row: { price: 10 },
      rowIndex: 0,
      slots: {},
      slotKey: 'price',
      t: undefined,
      ctx: null,
      showInlineHover: false,
      hoverOptionTeleport: false,
      hoverOptionColumns: [],
      rowKeyStr: 'k1',
      cellData: 20,
    } as unknown as Parameters<typeof buildCellContent>[0]
    const out = buildCellContent(input)
    expect(valueGetter).not.toHaveBeenCalled()
    expect(out.cellContent).toBeDefined()
  })
})
