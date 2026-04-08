import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useElTableV2RowEventHandlers } from '../../src/composables/rendering/use-row-events'

describe('use-row-events phase2 — resolveClickedColumn', () => {
  it('resolves column from DOM data attribute', () => {
    const displayColumns = ref([{ prop: 'name' }, { prop: 'age' }])
    const onCellClick = vi.fn()
    const result = useElTableV2RowEventHandlers({
      hasHoverOptionColumns: ref(false),
      hoverOptionColumns: ref([]),
      handleHoverRowEnter: vi.fn(),
      handleHoverRowLeave: vi.fn(),
      displayColumns,
      emit: { onCellClick },
    })

    const cell = document.createElement('td')
    cell.setAttribute('data-adv-cell-col', '1')
    const event = { target: cell } as unknown as Event

    result.value.onClick?.({
      rowData: { name: 'Alice', age: 25 },
      rowIndex: 0,
      event,
      rowKey: '1',
    })

    expect(onCellClick).toHaveBeenCalledWith({
      rowData: { name: 'Alice', age: 25 },
      rowIndex: 0,
      column: { prop: 'age' },
      columnIndex: 1,
      event,
    })
  })

  it('returns null when target is null', () => {
    const onCellClick = vi.fn()
    const result = useElTableV2RowEventHandlers({
      hasHoverOptionColumns: ref(false),
      hoverOptionColumns: ref([]),
      handleHoverRowEnter: vi.fn(),
      handleHoverRowLeave: vi.fn(),
      displayColumns: ref([{ prop: 'name' }]),
      emit: { onCellClick },
    })

    const event = { target: null } as unknown as Event

    result.value.onClick?.({
      rowData: { name: 'Alice' },
      rowIndex: 0,
      event,
      rowKey: '1',
    })

    // onCellClick should not be called because column couldn't be resolved
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('returns null when no cell ancestor found', () => {
    const onCellClick = vi.fn()
    const result = useElTableV2RowEventHandlers({
      hasHoverOptionColumns: ref(false),
      hoverOptionColumns: ref([]),
      handleHoverRowEnter: vi.fn(),
      handleHoverRowLeave: vi.fn(),
      displayColumns: ref([{ prop: 'name' }]),
      emit: { onCellClick },
    })

    const div = document.createElement('div')
    const event = { target: div } as unknown as Event

    result.value.onClick?.({
      rowData: { name: 'Alice' },
      rowIndex: 0,
      event,
      rowKey: '1',
    })

    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('returns null when colIdx is NaN', () => {
    const onCellClick = vi.fn()
    const result = useElTableV2RowEventHandlers({
      hasHoverOptionColumns: ref(false),
      hoverOptionColumns: ref([]),
      handleHoverRowEnter: vi.fn(),
      handleHoverRowLeave: vi.fn(),
      displayColumns: ref([{ prop: 'name' }]),
      emit: { onCellClick },
    })

    const cell = document.createElement('td')
    cell.setAttribute('data-adv-cell-col', 'abc')
    const event = { target: cell } as unknown as Event

    result.value.onClick?.({
      rowData: { name: 'Alice' },
      rowIndex: 0,
      event,
      rowKey: '1',
    })

    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('returns null when colIdx is out of range', () => {
    const onCellClick = vi.fn()
    const result = useElTableV2RowEventHandlers({
      hasHoverOptionColumns: ref(false),
      hoverOptionColumns: ref([]),
      handleHoverRowEnter: vi.fn(),
      handleHoverRowLeave: vi.fn(),
      displayColumns: ref([{ prop: 'name' }]),
      emit: { onCellClick },
    })

    const cell = document.createElement('td')
    cell.setAttribute('data-adv-cell-col', '99')
    const event = { target: cell } as unknown as Event

    result.value.onClick?.({
      rowData: { name: 'Alice' },
      rowIndex: 0,
      event,
      rowKey: '1',
    })

    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('returns null when displayColumns is empty', () => {
    const onCellClick = vi.fn()
    const result = useElTableV2RowEventHandlers({
      hasHoverOptionColumns: ref(false),
      hoverOptionColumns: ref([]),
      handleHoverRowEnter: vi.fn(),
      handleHoverRowLeave: vi.fn(),
      displayColumns: ref([]),
      emit: { onCellClick },
    })

    const cell = document.createElement('td')
    cell.setAttribute('data-adv-cell-col', '0')
    const event = { target: cell } as unknown as Event

    result.value.onClick?.({
      rowData: { name: 'Alice' },
      rowIndex: 0,
      event,
      rowKey: '1',
    })

    expect(onCellClick).not.toHaveBeenCalled()
  })
})

describe('use-row-events phase2 — onDblclick with column resolution', () => {
  it('resolves column on dblclick', () => {
    const onCellDblclick = vi.fn()
    const onRowDblclick = vi.fn()
    const displayColumns = ref([{ prop: 'name' }, { prop: 'age' }])
    const result = useElTableV2RowEventHandlers({
      hasHoverOptionColumns: ref(false),
      hoverOptionColumns: ref([]),
      handleHoverRowEnter: vi.fn(),
      handleHoverRowLeave: vi.fn(),
      displayColumns,
      emit: { onCellDblclick, onRowDblclick },
    })

    const cell = document.createElement('td')
    cell.setAttribute('data-adv-cell-col', '0')
    const event = { target: cell } as unknown as Event

    result.value.onDblclick?.({
      rowData: { name: 'Alice', age: 25 },
      rowIndex: 0,
      event,
      rowKey: '1',
    })

    expect(onRowDblclick).toHaveBeenCalled()
    expect(onCellDblclick).toHaveBeenCalledWith({
      rowData: { name: 'Alice', age: 25 },
      rowIndex: 0,
      column: { prop: 'name' },
      columnIndex: 0,
      event,
    })
  })

  it('does not fire onCellDblclick when column cannot be resolved', () => {
    const onCellDblclick = vi.fn()
    const onRowDblclick = vi.fn()
    const result = useElTableV2RowEventHandlers({
      hasHoverOptionColumns: ref(false),
      hoverOptionColumns: ref([]),
      handleHoverRowEnter: vi.fn(),
      handleHoverRowLeave: vi.fn(),
      displayColumns: ref([{ prop: 'name' }]),
      emit: { onCellDblclick, onRowDblclick },
    })

    const event = { target: null } as unknown as Event

    result.value.onDblclick?.({
      rowData: { name: 'Alice' },
      rowIndex: 0,
      event,
      rowKey: '1',
    })

    expect(onRowDblclick).toHaveBeenCalled()
    expect(onCellDblclick).not.toHaveBeenCalled()
  })
})

describe('use-row-events phase2 — onCurrentChange', () => {
  it('forwards onRowClick without hover columns', () => {
    const onRowClick = vi.fn()
    const result = useElTableV2RowEventHandlers({
      hasHoverOptionColumns: ref(false),
      hoverOptionColumns: ref([]),
      handleHoverRowEnter: vi.fn(),
      handleHoverRowLeave: vi.fn(),
      emit: { onRowClick },
    })

    const mockEvent = {} as Event
    result.value.onClick?.({
      rowData: { id: 1 },
      rowIndex: 0,
      event: mockEvent,
      rowKey: '1',
    })

    expect(onRowClick).toHaveBeenCalledWith({
      rowData: { id: 1 },
      rowIndex: 0,
      event: mockEvent,
    })
  })
})
