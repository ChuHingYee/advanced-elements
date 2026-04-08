import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import {
  buildSpanCellIndexMaps,
  createSpanCellProps,
  createSpanRowComponent,
  createStableSpanRowComponent,
} from '../../../src/components/table-virtual-renderer/span-row-renderer'

/**
 * <zh/> span 行渲染单测——覆盖索引映射分区与 cellProps 类名注入。
 * <en/> Span-row renderer tests — index map partitions and cellProps class injection.
 */
describe('buildSpanCellIndexMaps', () => {
  it('partitions fixed and fluid columns', () => {
    const cols = [
      { prop: 'l', fixed: 'left' },
      { prop: 'a' },
      { prop: 'b' },
      { prop: 'r', fixed: 'right' },
    ]
    const { colIndexMap, cellIndexToV2Index, firstMainCellIndex } = buildSpanCellIndexMaps(1, cols as any)
    expect(firstMainCellIndex).toBe(2)
    expect(colIndexMap.get('a')).toBe(2)
    expect(colIndexMap.get('l')).toBe(0)
    expect(colIndexMap.get('r')).toBe(4)
    expect(cellIndexToV2Index[2]).toBe(1)
  })

  it('handles columns without props', () => {
    const { colIndexMap } = buildSpanCellIndexMaps(0, [{}, { prop: 'a' }] as any)
    // <zh/> 无 prop 列仍占位，a 排在其后 | <en/> propless columns still occupy slots
    expect(colIndexMap.get('a')).toBe(1)
    expect(colIndexMap.has('')).toBe(false)
  })

  it('handles boolean fixed flags', () => {
    const { colIndexMap, firstMainCellIndex } = buildSpanCellIndexMaps(0, [
      { prop: 'l', fixed: true },
      { prop: 'a' },
    ] as any)
    expect(firstMainCellIndex).toBe(1)
    expect(colIndexMap.get('a')).toBe(1)
  })
})

describe('createSpanCellProps', () => {
  const cols = [{ prop: 'a' }, { prop: 'b', dataKey: 'b', key: 'b' }]

  it('returns undefined without span info', () => {
    expect(createSpanCellProps(undefined, cols)).toBeUndefined()
  })

  it('marks hidden and origin cells', () => {
    const cellProps = createSpanCellProps(
      (rowIndex: number, colKey: string) => {
        if (colKey === 'a')
          return { rowspan: 1, colspan: 1, isOrigin: false } as any
        return { rowspan: 2, colspan: 1, isOrigin: true } as any
      },
      cols,
    )!
    expect(cellProps({ rowData: {}, rowIndex: 0, column: { key: 'a' } })).toEqual({ class: expect.stringContaining('hidden') })
    const origin = cellProps({ rowData: {}, rowIndex: 0, column: { key: 'b' } }) as any
    expect(origin.class).toContain('origin')
  })

  it('returns empty for unknown columns and plain cells', () => {
    const cellProps = createSpanCellProps(() => undefined, cols)!
    expect(cellProps({ rowData: {}, rowIndex: 0, column: { key: 'a' } })).toEqual({})
    expect(createSpanCellProps(() => ({ rowspan: 1, colspan: 1, isOrigin: true }) as any, cols)!({
      rowData: {},
      rowIndex: 0,
      column: {},
    })).toEqual({})
  })
})

describe('createStableSpanRowComponent', () => {
  const baseCtx = (overrides: Record<string, any> = {}) => ({
    getSpanInfo: undefined,
    colIndexMap: new Map([['a', 0], ['b', 1]]),
    firstMainCellIndex: 0,
    rowHeight: 40,
    ...overrides,
  })

  function cells() {
    return [h('span', { class: 'c0', style: { width: '50px' } }, 'a'), h('span', 'b')]
  }

  it('passes cells through without span info', () => {
    const render = createStableSpanRowComponent(baseCtx)
    const out = render({ cells: cells(), rowIndex: 0, rowData: {} })
    expect(out).toHaveLength(2)
  })

  it('hides merged cells and marks origins', () => {
    const render = createStableSpanRowComponent(() => baseCtx({
      getSpanInfo: (rowIndex: number, colKey: string) => {
        if (colKey === 'a')
          return { rowspan: 1, colspan: 1, isOrigin: false }
        return { rowspan: 2, colspan: 1, isOrigin: true }
      },
    }))
    const out = render({ cells: cells(), rowIndex: 0, rowData: {} })
    expect((out[0] as any).props.class).toContain('hidden')
    expect((out[1] as any).props.style.height).toBe('80px')
  })

  it('merges colspan with comment placeholders', () => {
    const render = createStableSpanRowComponent(() => baseCtx({
      getSpanInfo: () => ({ rowspan: 1, colspan: 2, isOrigin: true }),
      getCellWidth: () => 60,
    }))
    const out = render({ cells: cells(), rowIndex: 0, rowData: {} })
    expect((out[0] as any).props.style.width).toBe('120px')
    expect(out[1]).toMatchObject({ type: Symbol.for('v-cmt') })
  })

  it('renders append rows through content', () => {
    const render = createStableSpanRowComponent(() => baseCtx({
      isAppendRow: (row: any) => row.append === true,
      renderAppendContent: () => [h('em', 'more')],
    }))
    const out = render({ cells: cells(), rowIndex: 0, rowData: { append: true } })
    expect((out[0] as any).children).toBeDefined()
  })

  it('returns cells when append has no content target', () => {
    const render = createStableSpanRowComponent(() => baseCtx({
      isAppendRow: () => true,
    }))
    expect(render({ cells: [], rowIndex: 0, rowData: {} })).toEqual([])
  })

  it('applies overlay styles for origins', () => {
    const render = createStableSpanRowComponent(() => baseCtx({
      getSpanInfo: () => ({ rowspan: 3, colspan: 1, isOrigin: true }),
      getOverlayStyle: () => ({ position: 'absolute' }),
    }))
    const out = render({ cells: cells(), rowIndex: 0, rowData: {} })
    expect((out[0] as any).props.style.position).toBe('absolute')
  })
})

describe('createSpanRowComponent', () => {
  it('bakes snapshot context', () => {
    const render = createSpanRowComponent(
      () => ({ rowspan: 1, colspan: 1, isOrigin: false }),
      0,
      [{ prop: 'a' }],
    )
    const out = render({ cells: [h('span', 'a')], rowIndex: 0, rowData: {} })
    expect(out).toHaveLength(1)
  })
})
