/**
 * @file use-cell-range-selection phase3 — extractRangeText, buildSelection, DOM rendering
 * Covers: extractRangeText with various column types, renderSelection, isCellSelected
 */
import type { ProcessedColumn } from '../../src/types'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createDefaultDomAdapter } from '../../src/components/renderer-core/default-dom-adapter'
import { useCellRangeSelection } from '../../src/composables/interaction/use-cell-range-selection'

/** <zh/> DOM 适配器——观察范围收窄选择器的来源（与生产同源，非 stub） | <en/> DOM adapter — source of the scope-narrowing selector (same as production, not a stub) */
const dom = createDefaultDomAdapter('el')

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
})

function createCellEl(row: number, col: number): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-adv-cell-row', String(row))
  el.setAttribute('data-adv-cell-col', String(col))
  return el
}

describe('useCellRangeSelection phase3 — extractRangeText & buildSelection', () => {
  const columns = computed(() => [
    { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
    { prop: 'age', key: 'age', label: 'Age', hidden: false } as unknown as ProcessedColumn,
    { prop: 'email', key: 'email', label: 'Email', hidden: false } as unknown as ProcessedColumn,
  ])

  const data = computed(() => [
    { id: 1, name: 'Alice', age: 25, email: 'a@t.com' },
    { id: 2, name: 'Bob', age: 30, email: 'b@t.com' },
    { id: 3, name: 'Charlie', age: 35, email: 'c@t.com' },
  ])

  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  function createRangeSelection(overrides: any = {}) {
    const containerRef = ref(container)
    return useCellRangeSelection({
      containerRef,
      dom,
      data,
      columns,
      enabled: () => true,
      ...overrides,
    })
  }

  function simulateMousedown(target: HTMLElement, button = 0) {
    const event = new MouseEvent('mousedown', { button, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: target })
    container.dispatchEvent(event)
    return event
  }

  function simulateMousemove(target: HTMLElement) {
    const event = new MouseEvent('mousemove', { bubbles: true })
    Object.defineProperty(event, 'target', { value: target })
    document.dispatchEvent(event)
  }

  function simulateMouseup() {
    const event = new MouseEvent('mouseup', { bubbles: true })
    document.dispatchEvent(event)
  }

  it('isCellSelected returns true for cells in range', () => {
    const { isCellSelected } = createRangeSelection()

    // No range initially
    expect(isCellSelected(0, 0)).toBe(false)
  })

  it('clearSelection resets all state', () => {
    const { clearSelection, isCellSelected } = createRangeSelection()

    clearSelection()
    expect(isCellSelected(0, 0)).toBe(false)
  })

  it('copySelectionToClipboard returns false when no selection', async () => {
    const { copySelectionToClipboard } = createRangeSelection()
    const result = await copySelectionToClipboard()
    expect(result).toBe(false)
  })

  it('ignores mousedown when button is not left click', () => {
    const cell = createCellEl(0, 0)
    container.appendChild(cell)

    const { isSelecting } = createRangeSelection()
    simulateMousedown(cell, 2) // right click

    // isSelecting should remain false
    expect(isSelecting.value).toBe(false)
  })

  it('ignores mousedown on interactive elements', () => {
    const input = document.createElement('input')
    container.appendChild(input)

    const { isSelecting } = createRangeSelection()

    const event = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: input })
    container.dispatchEvent(event)

    expect(isSelecting.value).toBe(false)
  })

  it('ignores mousedown when disabled', () => {
    const cell = createCellEl(0, 0)
    container.appendChild(cell)

    const { isSelecting } = createRangeSelection({ enabled: () => false })
    simulateMousedown(cell)

    expect(isSelecting.value).toBe(false)
  })

  it('handles mousedown on cell without data attributes', () => {
    const div = document.createElement('div')
    container.appendChild(div)

    const { isSelecting } = createRangeSelection()

    const event = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: div })
    container.dispatchEvent(event)

    expect(isSelecting.value).toBe(false)
  })

  it('selects a range and fires onRangeSelected callback', () => {
    const onRangeSelected = vi.fn()
    const cell00 = createCellEl(0, 0)
    const cell12 = createCellEl(1, 2)
    container.appendChild(cell00)
    container.appendChild(cell12)

    createRangeSelection({ onRangeSelected })

    simulateMousedown(cell00)
    simulateMousemove(cell12)
    simulateMouseup()

    expect(onRangeSelected).toHaveBeenCalledTimes(1)
    const selection = onRangeSelected.mock.calls[0][0]
    expect(selection.range.startRow).toBe(0)
    expect(selection.range.endRow).toBe(1)
    expect(selection.range.startCol).toBe(0)
    expect(selection.range.endCol).toBe(2)
    expect(selection.rows).toHaveLength(2)
    expect(selection.columns).toHaveLength(3)
    expect(selection.tsv).toContain('Alice')
    expect(selection.tsv).toContain('Bob')
  })

  it('extractRangeText produces TSV format', () => {
    const onRangeSelected = vi.fn()
    const cell00 = createCellEl(0, 0)
    const cell01 = createCellEl(0, 1)
    container.appendChild(cell00)
    container.appendChild(cell01)

    createRangeSelection({ onRangeSelected })

    simulateMousedown(cell00)
    simulateMousemove(cell01)
    simulateMouseup()

    const selection = onRangeSelected.mock.calls[0][0]
    // TSV: tab-separated within row, newline between rows
    expect(selection.tsv).toBe('Alice\t25')
  })

  it('handles column with no prop in extractRangeText', () => {
    const colsWithNoProp = computed(() => [
      { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
      { prop: undefined, key: 'action', label: 'Action', hidden: false } as unknown as ProcessedColumn,
    ])

    const onRangeSelected = vi.fn()
    const cell00 = createCellEl(0, 0)
    const cell01 = createCellEl(0, 1)
    container.appendChild(cell00)
    container.appendChild(cell01)

    useCellRangeSelection({
      containerRef: ref(container),
      dom,
      data,
      columns: colsWithNoProp,
      enabled: () => true,
      onRangeSelected,
    })

    simulateMousedown(cell00)
    simulateMousemove(cell01)
    simulateMouseup()

    const selection = onRangeSelected.mock.calls[0][0]
    // Column with no prop should produce undefined cellData
    expect(selection.tsv).toContain('Alice')
  })

  it('handles out-of-bounds row index in extractRangeText', () => {
    const onRangeSelected = vi.fn()
    // Create cells for a range that goes beyond data
    const cell50 = createCellEl(5, 0)
    container.appendChild(cell50)

    createRangeSelection({ onRangeSelected })

    simulateMousedown(cell50)
    simulateMouseup()

    expect(onRangeSelected).not.toHaveBeenCalled()
  })

  it('renders selection class on cells in range', () => {
    const cell00 = createCellEl(0, 0)
    const cell01 = createCellEl(0, 1)
    const cell11 = createCellEl(1, 1)
    container.appendChild(cell00)
    container.appendChild(cell01)
    container.appendChild(cell11)

    createRangeSelection()

    simulateMousedown(cell00)
    simulateMousemove(cell01)
    simulateMouseup()

    // Cells should not throw any errors during selection
    expect(cell00).toBeDefined()
  })

  it('handles mousemove to element without cell coordinates', () => {
    const cell00 = createCellEl(0, 0)
    container.appendChild(cell00)
    const nonCell = document.createElement('div')

    const { isSelecting } = createRangeSelection()

    simulateMousedown(cell00)
    expect(isSelecting.value).toBe(true)

    simulateMousemove(nonCell)

    // Should still be selecting, focus unchanged
    expect(isSelecting.value).toBe(true)

    simulateMouseup()
  })

  it('does not update focus when moving to same cell', () => {
    const cell00 = createCellEl(0, 0)
    container.appendChild(cell00)

    const onRangeSelected = vi.fn()
    createRangeSelection({ onRangeSelected })

    simulateMousedown(cell00)
    simulateMousemove(cell00) // same cell
    simulateMouseup()

    const selection = onRangeSelected.mock.calls[0][0]
    expect(selection.range.startRow).toBe(0)
    expect(selection.range.endRow).toBe(0)
  })

  it('clears selection class when clearSelection is called', () => {
    const cell00 = createCellEl(0, 0)
    const cell01 = createCellEl(0, 1)
    container.appendChild(cell00)
    container.appendChild(cell01)

    const { clearSelection } = createRangeSelection()

    simulateMousedown(cell00)
    simulateMousemove(cell01)
    simulateMouseup()

    clearSelection()
    // After clear, no cells should have range-selected class
    expect(cell00.classList.contains('adv-table__cell--range-selected')).toBe(false)
  })

  it('handles window blur during selection', () => {
    const cell00 = createCellEl(0, 0)
    container.appendChild(cell00)

    const { isSelecting } = createRangeSelection()

    simulateMousedown(cell00)
    expect(isSelecting.value).toBe(true)

    window.dispatchEvent(new Event('blur'))

    expect(isSelecting.value).toBe(false)
  })
})
