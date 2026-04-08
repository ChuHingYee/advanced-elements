/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useCellEvents } from '../../src/composables/rendering/use-cell-events'

describe('useCellEvents', () => {
  const mockLocator = {
    getRowIndex: (el: HTMLElement) => {
      const idx = el.getAttribute('data-row-index')
      return idx !== null ? Number(idx) : null
    },
    getColumnIndex: (el: HTMLElement) => {
      const idx = el.getAttribute('data-col-index')
      return idx !== null ? Number(idx) : null
    },
  }

  const mockColumns = computed(() => [
    { prop: 'name', hidden: false },
    { prop: 'age', hidden: false },
  ])

  const mockData = computed(() => [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
  ])

  let onCellFocused: any
  let onCellKeyDown: any
  let onCellKeyPress: any
  let onCellKeyUp: any
  let onCellClick: any
  let onCellDblclick: any
  let onCellContextmenu: any

  beforeEach(() => {
    onCellFocused = vi.fn()
    onCellKeyDown = vi.fn()
    onCellKeyPress = vi.fn()
    onCellKeyUp = vi.fn()
    onCellClick = vi.fn()
    onCellDblclick = vi.fn()
    onCellContextmenu = vi.fn()
  })

  function createEvents(container: HTMLElement | null = document.createElement('div')) {
    return useCellEvents({
      containerRef: ref(container),
      columns: mockColumns,
      data: mockData,
      locator: mockLocator,
      onCellFocused,
      onCellKeyDown,
      onCellKeyPress,
      onCellKeyUp,
      onCellClick,
      onCellDblclick,
      onCellContextmenu,
    })
  }

  function triggerFocusin(el: HTMLElement, rowIndex: number, colIndex: number) {
    el.setAttribute('data-row-index', String(rowIndex))
    el.setAttribute('data-col-index', String(colIndex))
    const evt = new Event('focusin', { bubbles: true, cancelable: true })
    el.dispatchEvent(evt)
  }

  it('initializes with focusedCell null', () => {
    const { focusedCell } = createEvents()
    expect(focusedCell.value).toBeNull()
  })

  it('handles focusin event and calls onCellFocused', () => {
    const container = document.createElement('div')
    createEvents(container)

    triggerFocusin(container, 0, 1)

    expect(onCellFocused).toHaveBeenCalledWith({
      rowData: mockData.value[0],
      rowIndex: 0,
      column: mockColumns.value[1],
      columnIndex: 1,
      event: expect.any(Event),
    })
  })

  it('ignores focusin when row/col index is out of bounds', () => {
    const container = document.createElement('div')
    createEvents(container)

    triggerFocusin(container, 99, 0)
    expect(onCellFocused).not.toHaveBeenCalled()
  })

  it('ignores focusin when locator returns null', () => {
    const container = document.createElement('div')
    createEvents(container)

    const cell = document.createElement('td')
    container.appendChild(cell)
    cell.dispatchEvent(new Event('focusin', { bubbles: true }))
    expect(onCellFocused).not.toHaveBeenCalled()
  })

  it('calls onCellKeyDown when cell is focused', () => {
    const container = document.createElement('div')
    const { focusedCell } = createEvents(container)

    focusedCell.value = { rowIndex: 1, columnIndex: 0 }
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(onCellKeyDown).toHaveBeenCalledWith({
      rowData: mockData.value[1],
      rowIndex: 1,
      column: mockColumns.value[0],
      columnIndex: 0,
      event: expect.any(KeyboardEvent),
    })
  })

  it('calls onCellKeyPress when cell is focused', () => {
    const container = document.createElement('div')
    const { focusedCell } = createEvents(container)

    focusedCell.value = { rowIndex: 0, columnIndex: 0 }
    container.dispatchEvent(new KeyboardEvent('keypress', { key: 'a', bubbles: true }))

    expect(onCellKeyPress).toHaveBeenCalledOnce()
  })

  it('calls onCellKeyUp when cell is focused', () => {
    const container = document.createElement('div')
    const { focusedCell } = createEvents(container)

    focusedCell.value = { rowIndex: 0, columnIndex: 0 }
    container.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))

    expect(onCellKeyUp).toHaveBeenCalledOnce()
  })

  it('does not call keyboard handlers when no cell is focused', () => {
    const container = document.createElement('div')
    createEvents(container)

    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onCellKeyDown).not.toHaveBeenCalled()
  })

  it('handles containerRef change correctly', async () => {
    const containerRef = ref<HTMLElement | null>(null)
    useCellEvents({
      containerRef,
      columns: mockColumns,
      data: mockData,
      locator: mockLocator,
      onCellFocused,
    })

    const newContainer = document.createElement('div')
    containerRef.value = newContainer
    await nextTick()

    triggerFocusin(newContainer, 0, 0)
    expect(onCellFocused).toHaveBeenCalledOnce()
  })

  it('cleans up when containerRef set to null', async () => {
    const container = document.createElement('div')
    const containerRef = ref(container)
    const { focusedCell: _focusedCell } = useCellEvents({
      containerRef,
      columns: mockColumns,
      data: mockData,
      locator: mockLocator,
      onCellFocused,
    })

    triggerFocusin(container, 0, 0)
    expect(onCellFocused).toHaveBeenCalledTimes(1)

    containerRef.value = null as unknown as HTMLDivElement
    await nextTick()

    triggerFocusin(container, 1, 0)
    expect(onCellFocused).toHaveBeenCalledTimes(1)
  })

  describe('mouse event delegation', () => {
    it('calls onCellClick when clicking a cell with data attributes', () => {
      const container = document.createElement('div')
      createEvents(container)

      const cell = document.createElement('span')
      cell.setAttribute('data-adv-cell-row', '0')
      cell.setAttribute('data-adv-cell-col', '1')
      container.appendChild(cell)

      cell.dispatchEvent(new Event('click', { bubbles: true }))

      expect(onCellClick).toHaveBeenCalledWith({
        rowData: mockData.value[0],
        rowIndex: 0,
        column: mockColumns.value[1],
        columnIndex: 1,
        event: expect.any(Event),
      })
    })

    it('calls onCellDblclick when double-clicking a cell', () => {
      const container = document.createElement('div')
      createEvents(container)

      const cell = document.createElement('span')
      cell.setAttribute('data-adv-cell-row', '1')
      cell.setAttribute('data-adv-cell-col', '0')
      container.appendChild(cell)

      cell.dispatchEvent(new Event('dblclick', { bubbles: true }))

      expect(onCellDblclick).toHaveBeenCalledWith({
        rowData: mockData.value[1],
        rowIndex: 1,
        column: mockColumns.value[0],
        columnIndex: 0,
        event: expect.any(Event),
      })
    })

    it('calls onCellContextmenu when right-clicking a cell', () => {
      const container = document.createElement('div')
      createEvents(container)

      const cell = document.createElement('span')
      cell.setAttribute('data-adv-cell-row', '0')
      cell.setAttribute('data-adv-cell-col', '0')
      container.appendChild(cell)

      cell.dispatchEvent(new Event('contextmenu', { bubbles: true }))

      expect(onCellContextmenu).toHaveBeenCalledWith({
        rowData: mockData.value[0],
        rowIndex: 0,
        column: mockColumns.value[0],
        columnIndex: 0,
        event: expect.any(Event),
      })
    })

    it('does not call onCellClick when clicking outside cell', () => {
      const container = document.createElement('div')
      createEvents(container)

      container.dispatchEvent(new Event('click', { bubbles: true }))
      expect(onCellClick).not.toHaveBeenCalled()
    })

    it('finds cell from nested element via data-adv-cell-row/col', () => {
      const container = document.createElement('div')
      createEvents(container)

      const cell = document.createElement('span')
      cell.setAttribute('data-adv-cell-row', '0')
      cell.setAttribute('data-adv-cell-col', '0')
      container.appendChild(cell)

      const nested = document.createElement('em')
      cell.appendChild(nested)

      nested.dispatchEvent(new Event('click', { bubbles: true }))

      expect(onCellClick).toHaveBeenCalledWith({
        rowData: mockData.value[0],
        rowIndex: 0,
        column: mockColumns.value[0],
        columnIndex: 0,
        event: expect.any(Event),
      })
    })

    it('ignores click when row index is out of bounds', () => {
      const container = document.createElement('div')
      createEvents(container)

      const cell = document.createElement('span')
      cell.setAttribute('data-adv-cell-row', '99')
      cell.setAttribute('data-adv-cell-col', '0')
      container.appendChild(cell)

      cell.dispatchEvent(new Event('click', { bubbles: true }))
      expect(onCellClick).not.toHaveBeenCalled()
    })

    it('does not register click listener when onCellClick is not provided', () => {
      const container = document.createElement('div')
      const addSpy = vi.spyOn(container, 'addEventListener')
      useCellEvents({
        containerRef: ref(container),
        columns: mockColumns,
        data: mockData,
        locator: mockLocator,
        onCellFocused,
      })

      // <zh/> 未提供回调就不应注册监听，而非注册空函数占位
      // <en/> No callback means no listener registered, not a no-op placeholder
      expect(addSpy.mock.calls.some(args => args[0] === 'click')).toBe(false)
      addSpy.mockRestore()

      const cell = document.createElement('span')
      cell.setAttribute('data-adv-cell-row', '0')
      cell.setAttribute('data-adv-cell-col', '0')
      container.appendChild(cell)

      expect(() => cell.dispatchEvent(new Event('click', { bubbles: true }))).not.toThrow()
    })
  })
})
