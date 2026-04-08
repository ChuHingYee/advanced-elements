import type { ProcessedColumn } from '../../src/types'
/**
 * Tests for parseCellEditValue (提取的纯函数)
 *
 * Covers: 无 valueParser 时原样透传；存在 valueParser 时交由业务转换；
 * valueParser 收到的上下文（row/column/rowIndex/oldValue/newValue）完整正确。
 */
import { describe, expect, it } from 'vitest'
import { parseCellEditValue } from '../../src/utils/edit-helpers'

function makeColumn(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return { prop: 'x', label: 'x', ...overrides } as unknown as ProcessedColumn
}

describe('parseCellEditValue', () => {
  it('returns raw value when no valueParser is present', () => {
    const col = makeColumn()
    expect(parseCellEditValue(col, { row: {} as Record<string, unknown>, rowIndex: 0, newValue: 5, oldValue: 1 })).toBe(5)
  })

  it('applies column.valueParser when present', () => {
    const col = makeColumn({
      valueParser: ({ newValue }) => Number(newValue) * 2,
    } as Partial<ProcessedColumn>)
    expect(parseCellEditValue(col, { row: {} as Record<string, unknown>, rowIndex: 0, newValue: '3', oldValue: 0 })).toBe(6)
  })

  it('passes the full context to valueParser', () => {
    const ctx = { row: { id: 1 }, rowIndex: 2, newValue: 'a', oldValue: 'b' }
    let received: Record<string, unknown> | undefined
    const col = makeColumn({
      valueParser: (p: Record<string, unknown>) => {
        received = p
        return p.newValue
      },
    } as Partial<ProcessedColumn>)

    parseCellEditValue(col, ctx)

    expect(received).toBeDefined()
    expect(received!.row).toBe(ctx.row)
    expect(received!.rowIndex).toBe(2)
    expect(received!.column).toBe(col)
    expect(received!.oldValue).toBe('b')
    expect(received!.newValue).toBe('a')
  })
})
