/**
 * <zh/> v2-emit-adapter 事件适配器单测：行/单元格/表头事件的透传、append 屏蔽、索引归一与滚动抑制
 * <en/> Unit tests for the v2-emit-adapter: passthrough, append suppression, index normalization and scroll suppression
 */
import type { V2EmitAdapterDeps } from '../../../src/components/table-virtual-renderer/v2-emit-adapter'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createAppendRowData } from '../../../src/components/table-virtual-renderer/append-row-helpers'
import { createV2EmitAdapter } from '../../../src/components/table-virtual-renderer/v2-emit-adapter'

/** <zh/> 构造适配器：默认带 -1 偏移的业务索引映射 | <en/> Build adapter: business-index mapping with -1 offset by default */
function setupAdapter(overrides?: Partial<V2EmitAdapterDeps>) {
  const emit = vi.fn()
  const adapter = createV2EmitAdapter({
    emit,
    isScrolling: ref(false),
    allVirtualLeafColumns: () => [],
    resolveBusinessRowIndex: (_rowData, epRowIndex) => epRowIndex - 1,
    ...overrides,
  })
  return { emit, adapter }
}

// <zh/> 行点击事件适配 | <en/> Row click event adaptation
describe('createV2EmitAdapter rowEmit.onRowClick', () => {
  // <zh/> 正常透传并归一业务行索引 | <en/> Normal passthrough with normalized business row index
  it('forwards normalized rowIndex on normal rows', () => {
    const { emit, adapter } = setupAdapter()
    const rowData = { id: 'r1' }
    const event = new Event('click')
    adapter.rowEmit.onRowClick({ rowData, rowIndex: 3, event })
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('rowClick', { rowData, rowIndex: 2, event })
  })
  // <zh/> append 合成行不对外触发 | <en/> Append synthetic rows never emit
  it('suppresses append rows', () => {
    const { emit, adapter } = setupAdapter()
    adapter.rowEmit.onRowClick({ rowData: createAppendRowData(), rowIndex: 3, event: new Event('click') })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 业务索引解析为 undefined 时丢弃 | <en/> Discards events whose business index resolves to undefined
  it('suppresses events with undefined business index', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: () => undefined })
    adapter.rowEmit.onRowClick({ rowData: { id: 'r1' }, rowIndex: 3, event: new Event('click') })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 无解析器时原样透传 EP 行索引 | <en/> Passes raw EP row index through when no resolver is provided
  it('passes raw epRowIndex through when resolver is absent', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: undefined })
    const rowData = { id: 'r1' }
    const event = new Event('click')
    adapter.rowEmit.onRowClick({ rowData, rowIndex: 3, event })
    expect(emit).toHaveBeenCalledWith('rowClick', { rowData, rowIndex: 3, event })
  })
})

// <zh/> 行右键事件适配 | <en/> Row contextmenu event adaptation
describe('createV2EmitAdapter rowEmit.onRowContextmenu', () => {
  // <zh/> 正常透传并归一业务行索引 | <en/> Normal passthrough with normalized business row index
  it('forwards normalized rowIndex on normal rows', () => {
    const { emit, adapter } = setupAdapter()
    const rowData = { id: 'r1' }
    const event = new Event('contextmenu')
    adapter.rowEmit.onRowContextmenu({ rowData, rowIndex: 3, event })
    expect(emit).toHaveBeenCalledWith('rowContextmenu', { rowData, rowIndex: 2, event })
  })
  // <zh/> append 合成行不对外触发 | <en/> Append synthetic rows never emit
  it('suppresses append rows', () => {
    const { emit, adapter } = setupAdapter()
    adapter.rowEmit.onRowContextmenu({ rowData: createAppendRowData(), rowIndex: 3, event: new Event('contextmenu') })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 业务索引解析为 undefined 时丢弃 | <en/> Discards events whose business index resolves to undefined
  it('suppresses events with undefined business index', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: () => undefined })
    adapter.rowEmit.onRowContextmenu({ rowData: { id: 'r1' }, rowIndex: 3, event: new Event('contextmenu') })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 无解析器时原样透传 EP 行索引 | <en/> Passes raw EP row index through when no resolver is provided
  it('passes raw epRowIndex through when resolver is absent', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: undefined })
    const rowData = { id: 'r1' }
    const event = new Event('contextmenu')
    adapter.rowEmit.onRowContextmenu({ rowData, rowIndex: 3, event })
    expect(emit).toHaveBeenCalledWith('rowContextmenu', { rowData, rowIndex: 3, event })
  })
})

// <zh/> 行双击事件适配 | <en/> Row double-click event adaptation
describe('createV2EmitAdapter rowEmit.onRowDblclick', () => {
  // <zh/> 正常透传并归一业务行索引 | <en/> Normal passthrough with normalized business row index
  it('forwards normalized rowIndex on normal rows', () => {
    const { emit, adapter } = setupAdapter()
    const rowData = { id: 'r1' }
    const event = new Event('dblclick')
    adapter.rowEmit.onRowDblclick({ rowData, rowIndex: 3, event })
    expect(emit).toHaveBeenCalledWith('rowDblclick', { rowData, rowIndex: 2, event })
  })
  // <zh/> append 合成行不对外触发 | <en/> Append synthetic rows never emit
  it('suppresses append rows', () => {
    const { emit, adapter } = setupAdapter()
    adapter.rowEmit.onRowDblclick({ rowData: createAppendRowData(), rowIndex: 3, event: new Event('dblclick') })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 业务索引解析为 undefined 时丢弃 | <en/> Discards events whose business index resolves to undefined
  it('suppresses events with undefined business index', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: () => undefined })
    adapter.rowEmit.onRowDblclick({ rowData: { id: 'r1' }, rowIndex: 3, event: new Event('dblclick') })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 无解析器时原样透传 EP 行索引 | <en/> Passes raw EP row index through when no resolver is provided
  it('passes raw epRowIndex through when resolver is absent', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: undefined })
    const rowData = { id: 'r1' }
    const event = new Event('dblclick')
    adapter.rowEmit.onRowDblclick({ rowData, rowIndex: 3, event })
    expect(emit).toHaveBeenCalledWith('rowDblclick', { rowData, rowIndex: 3, event })
  })
})

// <zh/> 当前行变更事件适配（无索引归一，仅 append 屏蔽） | <en/> Current-change adaptation (no index normalization, append suppression only)
describe('createV2EmitAdapter rowEmit.onCurrentChange', () => {
  // <zh/> 正常透传当前行与旧行 | <en/> Normal passthrough of current and old rows
  it('forwards currentRow and oldRow on normal rows', () => {
    const { emit, adapter } = setupAdapter()
    const currentRow = { id: 'cur' }
    const oldRow = { id: 'old' }
    adapter.rowEmit.onCurrentChange({ currentRow, oldRow })
    expect(emit).toHaveBeenCalledWith('currentChange', { currentRow, oldRow })
  })
  // <zh/> currentRow 为 append 合成行时丢弃 | <en/> Discards events whose currentRow is an append row
  it('suppresses events with an append currentRow', () => {
    const { emit, adapter } = setupAdapter()
    adapter.rowEmit.onCurrentChange({ currentRow: createAppendRowData(), oldRow: { id: 'old' } })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> oldRow 为 append 合成行时丢弃 | <en/> Discards events whose oldRow is an append row
  it('suppresses events with an append oldRow', () => {
    const { emit, adapter } = setupAdapter()
    adapter.rowEmit.onCurrentChange({ currentRow: { id: 'cur' }, oldRow: createAppendRowData() })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 双端皆为 append 时丢弃 | <en/> Discards events when both rows are append rows
  it('suppresses events when both rows are append rows', () => {
    const { emit, adapter } = setupAdapter()
    adapter.rowEmit.onCurrentChange({ currentRow: createAppendRowData(), oldRow: createAppendRowData() })
    expect(emit).not.toHaveBeenCalled()
  })
})

// <zh/> 单元格点击事件适配 | <en/> Cell click event adaptation
describe('createV2EmitAdapter rowEmit.onCellClick', () => {
  // <zh/> 正常透传并归一业务行索引 | <en/> Normal passthrough with normalized business row index
  it('forwards normalized rowIndex on normal rows', () => {
    const { emit, adapter } = setupAdapter()
    const rowData = { id: 'r1' }
    adapter.rowEmit.onCellClick({ rowData, rowIndex: 3 })
    expect(emit).toHaveBeenCalledWith('cellClick', { rowData, rowIndex: 2 })
  })
  // <zh/> append 合成行不对外触发 | <en/> Append synthetic rows never emit
  it('suppresses append rows', () => {
    const { emit, adapter } = setupAdapter()
    adapter.rowEmit.onCellClick({ rowData: createAppendRowData(), rowIndex: 3 })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 业务索引解析为 undefined 时丢弃 | <en/> Discards events whose business index resolves to undefined
  it('suppresses events with undefined business index', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: () => undefined })
    adapter.rowEmit.onCellClick({ rowData: { id: 'r1' }, rowIndex: 3 })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 无解析器时原样透传 EP 行索引 | <en/> Passes raw EP row index through when no resolver is provided
  it('passes raw epRowIndex through when resolver is absent', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: undefined })
    const rowData = { id: 'r1' }
    adapter.rowEmit.onCellClick({ rowData, rowIndex: 3 })
    expect(emit).toHaveBeenCalledWith('cellClick', { rowData, rowIndex: 3 })
  })
  // <zh/> 透传其余载荷字段并以归一索引覆盖 rowIndex | <en/> Spreads remaining payload fields while overriding rowIndex with the normalized index
  it('spreads extra payload fields and overrides rowIndex', () => {
    const { emit, adapter } = setupAdapter()
    const rowData = { id: 'r1' }
    const column = { key: 'name' }
    adapter.rowEmit.onCellClick({ rowData, rowIndex: 5, column } as any)
    expect(emit).toHaveBeenCalledWith('cellClick', { rowData, rowIndex: 4, column })
  })
})

// <zh/> 单元格双击事件适配 | <en/> Cell double-click event adaptation
describe('createV2EmitAdapter rowEmit.onCellDblclick', () => {
  // <zh/> 正常透传并归一业务行索引 | <en/> Normal passthrough with normalized business row index
  it('forwards normalized rowIndex on normal rows', () => {
    const { emit, adapter } = setupAdapter()
    const rowData = { id: 'r1' }
    adapter.rowEmit.onCellDblclick({ rowData, rowIndex: 3 })
    expect(emit).toHaveBeenCalledWith('cellDblclick', { rowData, rowIndex: 2 })
  })
  // <zh/> append 合成行不对外触发 | <en/> Append synthetic rows never emit
  it('suppresses append rows', () => {
    const { emit, adapter } = setupAdapter()
    adapter.rowEmit.onCellDblclick({ rowData: createAppendRowData(), rowIndex: 3 })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 业务索引解析为 undefined 时丢弃 | <en/> Discards events whose business index resolves to undefined
  it('suppresses events with undefined business index', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: () => undefined })
    adapter.rowEmit.onCellDblclick({ rowData: { id: 'r1' }, rowIndex: 3 })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 无解析器时原样透传 EP 行索引 | <en/> Passes raw EP row index through when no resolver is provided
  it('passes raw epRowIndex through when resolver is absent', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: undefined })
    const rowData = { id: 'r1' }
    adapter.rowEmit.onCellDblclick({ rowData, rowIndex: 3 })
    expect(emit).toHaveBeenCalledWith('cellDblclick', { rowData, rowIndex: 3 })
  })
  // <zh/> 透传其余载荷字段并以归一索引覆盖 rowIndex | <en/> Spreads remaining payload fields while overriding rowIndex with the normalized index
  it('spreads extra payload fields and overrides rowIndex', () => {
    const { emit, adapter } = setupAdapter()
    const rowData = { id: 'r1' }
    const column = { key: 'name' }
    adapter.rowEmit.onCellDblclick({ rowData, rowIndex: 5, column } as any)
    expect(emit).toHaveBeenCalledWith('cellDblclick', { rowData, rowIndex: 4, column })
  })
})

// <zh/> 单元格右键事件适配 | <en/> Cell contextmenu event adaptation
describe('createV2EmitAdapter rowEmit.onCellContextmenu', () => {
  // <zh/> 正常透传并归一业务行索引 | <en/> Normal passthrough with normalized business row index
  it('forwards normalized rowIndex on normal rows', () => {
    const { emit, adapter } = setupAdapter()
    const rowData = { id: 'r1' }
    adapter.rowEmit.onCellContextmenu({ rowData, rowIndex: 3 })
    expect(emit).toHaveBeenCalledWith('cellContextmenu', { rowData, rowIndex: 2 })
  })
  // <zh/> append 合成行不对外触发 | <en/> Append synthetic rows never emit
  it('suppresses append rows', () => {
    const { emit, adapter } = setupAdapter()
    adapter.rowEmit.onCellContextmenu({ rowData: createAppendRowData(), rowIndex: 3 })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 业务索引解析为 undefined 时丢弃 | <en/> Discards events whose business index resolves to undefined
  it('suppresses events with undefined business index', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: () => undefined })
    adapter.rowEmit.onCellContextmenu({ rowData: { id: 'r1' }, rowIndex: 3 })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 无解析器时原样透传 EP 行索引 | <en/> Passes raw EP row index through when no resolver is provided
  it('passes raw epRowIndex through when resolver is absent', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: undefined })
    const rowData = { id: 'r1' }
    adapter.rowEmit.onCellContextmenu({ rowData, rowIndex: 3 })
    expect(emit).toHaveBeenCalledWith('cellContextmenu', { rowData, rowIndex: 3 })
  })
  // <zh/> 透传其余载荷字段并以归一索引覆盖 rowIndex | <en/> Spreads remaining payload fields while overriding rowIndex with the normalized index
  it('spreads extra payload fields and overrides rowIndex', () => {
    const { emit, adapter } = setupAdapter()
    const rowData = { id: 'r1' }
    const column = { key: 'name' }
    adapter.rowEmit.onCellContextmenu({ rowData, rowIndex: 5, column } as any)
    expect(emit).toHaveBeenCalledWith('cellContextmenu', { rowData, rowIndex: 4, column })
  })
})

// <zh/> 单元格移入事件适配（含滚动抑制） | <en/> Cell mouse-enter adaptation (with scroll suppression)
describe('createV2EmitAdapter rowEmit.onCellMouseEnter', () => {
  // <zh/> 正常透传并归一业务行索引 | <en/> Normal passthrough with normalized business row index
  it('forwards normalized rowIndex on normal rows', () => {
    const { emit, adapter } = setupAdapter()
    const rowData = { id: 'r1' }
    const event = new Event('mouseenter')
    adapter.rowEmit.onCellMouseEnter({ rowData, rowIndex: 3, event })
    expect(emit).toHaveBeenCalledWith('cellMouseEnter', { rowData, rowIndex: 2, event })
  })
  // <zh/> append 合成行不对外触发 | <en/> Append synthetic rows never emit
  it('suppresses append rows', () => {
    const { emit, adapter } = setupAdapter()
    adapter.rowEmit.onCellMouseEnter({ rowData: createAppendRowData(), rowIndex: 3, event: new Event('mouseenter') })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 业务索引解析为 undefined 时丢弃 | <en/> Discards events whose business index resolves to undefined
  it('suppresses events with undefined business index', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: () => undefined })
    adapter.rowEmit.onCellMouseEnter({ rowData: { id: 'r1' }, rowIndex: 3, event: new Event('mouseenter') })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 无解析器时原样透传 EP 行索引 | <en/> Passes raw EP row index through when no resolver is provided
  it('passes raw epRowIndex through when resolver is absent', () => {
    const { emit, adapter } = setupAdapter({ resolveBusinessRowIndex: undefined })
    const rowData = { id: 'r1' }
    const event = new Event('mouseenter')
    adapter.rowEmit.onCellMouseEnter({ rowData, rowIndex: 3, event })
    expect(emit).toHaveBeenCalledWith('cellMouseEnter', { rowData, rowIndex: 3, event })
  })
  // <zh/> 滚动期间抑制转发 | <en/> Suppresses forwarding while scrolling
  it('suppresses forwarding while isScrolling is true', () => {
    const { emit, adapter } = setupAdapter({ isScrolling: ref(true) })
    adapter.rowEmit.onCellMouseEnter({ rowData: { id: 'r1' }, rowIndex: 3, event: new Event('mouseenter') })
    expect(emit).not.toHaveBeenCalled()
  })
  // <zh/> 非滚动期间正常转发 | <en/> Forwards normally while isScrolling is false
  it('forwards while isScrolling is false', () => {
    const { emit, adapter } = setupAdapter({ isScrolling: ref(false) })
    const rowData = { id: 'r1' }
    const event = new Event('mouseenter')
    adapter.rowEmit.onCellMouseEnter({ rowData, rowIndex: 3, event })
    expect(emit).toHaveBeenCalledWith('cellMouseEnter', { rowData, rowIndex: 2, event })
  })
})

// <zh/> 单元格移出事件适配（含滚动抑制） | <en/> Cell mouse-leave adaptation (with scroll suppression)
describe('createV2EmitAdapter rowEmit.onCellMouseLeave', () => {
  // <zh/> 非滚动期间正常转发 | <en/> Forwards normally while isScrolling is false
  it('forwards while isScrolling is false', () => {
    const { emit, adapter } = setupAdapter({ isScrolling: ref(false) })
    adapter.rowEmit.onCellMouseLeave()
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('cellMouseLeave')
  })
  // <zh/> 滚动期间抑制转发 | <en/> Suppresses forwarding while scrolling
  it('suppresses forwarding while isScrolling is true', () => {
    const { emit, adapter } = setupAdapter({ isScrolling: ref(true) })
    adapter.rowEmit.onCellMouseLeave()
    expect(emit).not.toHaveBeenCalled()
  })
})

// <zh/> 表头拖拽结束事件适配（统一列索引域） | <en/> Header drag-end adaptation (unified column index domain)
describe('createV2EmitAdapter headerEmit.onHeaderDragend', () => {
  /** <zh/> 统一索引域叶子列 | <en/> Leaf columns of the unified index domain */
  function setupHeader() {
    const colA = { key: 'a' } as any
    const colB = { key: 'b' } as any
    const { emit, adapter } = setupAdapter({ allVirtualLeafColumns: () => [colA, colB] as any })
    return { emit, adapter, colA, colB }
  }
  // <zh/> 命中列时解析出统一域列索引 | <en/> Resolves the unified-domain column index for a matching column
  it('resolves columnIndex for a matching column', () => {
    const { emit, adapter } = setupHeader()
    const event = new MouseEvent('mouseup')
    adapter.headerEmit.onHeaderDragend({ column: { key: 'b' }, columnKey: 'b', newWidth: 120, oldWidth: 100, event })
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('headerDragend', {
      column: { key: 'b' },
      columnIndex: 1,
      newWidth: 120,
      oldWidth: 100,
      event,
    })
  })
  // <zh/> 缺列时列索引为 -1 | <en/> Reports columnIndex -1 when no column is provided
  it('reports columnIndex -1 when column is absent', () => {
    const { emit, adapter } = setupHeader()
    const event = new MouseEvent('mouseup')
    adapter.headerEmit.onHeaderDragend({ column: undefined, columnKey: 'missing', newWidth: 120, oldWidth: 100, event })
    expect(emit).toHaveBeenCalledWith('headerDragend', {
      column: undefined,
      columnIndex: -1,
      newWidth: 120,
      oldWidth: 100,
      event,
    })
  })
  // <zh/> 未知列时列索引为 -1 | <en/> Reports columnIndex -1 for an unknown column
  it('reports columnIndex -1 for an unknown column', () => {
    const { emit, adapter } = setupHeader()
    const event = new MouseEvent('mouseup')
    adapter.headerEmit.onHeaderDragend({ column: { key: 'zzz' }, columnKey: 'zzz', newWidth: 120, oldWidth: 100, event })
    expect(emit).toHaveBeenCalledWith('headerDragend', {
      column: { key: 'zzz' },
      columnIndex: -1,
      newWidth: 120,
      oldWidth: 100,
      event,
    })
  })
})
