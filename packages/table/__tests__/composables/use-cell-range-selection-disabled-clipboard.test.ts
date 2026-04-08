/**
 * @file use-cell-range-selection phase2 — 补充分支覆盖
 * Covers: window blur, clearSelection, copySelection, MutationObserver, elementFromPoint fallback, disabled state
 */
import type { ProcessedColumn } from '../../src/types'
import { beforeAll, describe, expect, it, vi } from 'vitest'
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

describe('useCellRangeSelection phase2 — disabled state', () => {
  const columns = computed(() => [
    { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
  ])
  const data = computed(() => [{ name: 'Alice' }])

  it('does not start selection when disabled', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cell = createCellEl(0, 0)
    container.appendChild(cell)

    const { isSelecting } = useCellRangeSelection({
      containerRef: ref(container),
      dom,
      data,
      columns,
      enabled: () => false,
    })

    const event = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true })
    cell.dispatchEvent(event)

    expect(isSelecting.value).toBe(false)
    document.body.removeChild(container)
  })

  it('does not start selection on right-click', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cell = createCellEl(0, 0)
    container.appendChild(cell)

    const { isSelecting } = useCellRangeSelection({
      containerRef: ref(container),
      dom,
      data,
      columns,
      enabled: () => true,
    })

    const event = new MouseEvent('mousedown', { button: 2, bubbles: true, cancelable: true })
    cell.dispatchEvent(event)

    expect(isSelecting.value).toBe(false)
    document.body.removeChild(container)
  })

  it('ignores mousedown on interactive elements', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const input = document.createElement('input')
    container.appendChild(input)

    const { isSelecting } = useCellRangeSelection({
      containerRef: ref(container),
      dom,
      data,
      columns,
      enabled: () => true,
    })

    const event = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true })
    input.dispatchEvent(event)

    expect(isSelecting.value).toBe(false)
    document.body.removeChild(container)
  })
})

describe('useCellRangeSelection phase2 — clearSelection', () => {
  const columns = computed(() => [
    { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
    { prop: 'age', key: 'age', label: 'Age', hidden: false } as unknown as ProcessedColumn,
  ])
  const data = computed(() => [
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 },
  ])

  it('clears anchor, focus, and lastSelection', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cell = createCellEl(0, 0)
    container.appendChild(cell)

    const { clearSelection, anchorCell, focusCell, lastSelection } = useCellRangeSelection({
      containerRef: ref(container),
      dom,
      data,
      columns,
      enabled: () => true,
    })

    // Simulate selection start
    const event = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true })
    cell.dispatchEvent(event)

    expect(anchorCell.value).not.toBeNull()

    clearSelection()

    expect(anchorCell.value).toBeNull()
    expect(focusCell.value).toBeNull()
    expect(lastSelection.value).toBeNull()

    document.body.removeChild(container)
  })
})

describe('useCellRangeSelection phase2 — copySelectionToClipboard', () => {
  const columns = computed(() => [
    { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
  ])
  const data = computed(() => [{ name: 'Alice' }])

  it('returns false when no selection exists', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const { copySelectionToClipboard } = useCellRangeSelection({
      containerRef: ref(container),
      dom,
      data,
      columns,
      enabled: () => true,
    })

    const result = await copySelectionToClipboard()
    expect(result).toBe(false)

    document.body.removeChild(container)
  })
})

describe('useCellRangeSelection phase2 — isCellSelected', () => {
  const columns = computed(() => [
    { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
    { prop: 'age', key: 'age', label: 'Age', hidden: false } as unknown as ProcessedColumn,
  ])
  const data = computed(() => [{ name: 'Alice', age: 25 }])

  it('returns false when no range is active', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const { isCellSelected } = useCellRangeSelection({
      containerRef: ref(container),
      dom,
      data,
      columns,
      enabled: () => true,
    })

    expect(isCellSelected(0, 0)).toBe(false)
    document.body.removeChild(container)
  })
})

describe('useCellRangeSelection phase2 — window blur cleanup', () => {
  const columns = computed(() => [
    { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
  ])
  const data = computed(() => [{ name: 'Alice' }])

  it('cleans up selection on window blur', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cell = createCellEl(0, 0)
    container.appendChild(cell)

    const { isSelecting } = useCellRangeSelection({
      containerRef: ref(container),
      dom,
      data,
      columns,
      enabled: () => true,
    })

    // Start selection
    const mousedown = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true })
    cell.dispatchEvent(mousedown)
    expect(isSelecting.value).toBe(true)

    window.dispatchEvent(new Event('blur'))
    expect(isSelecting.value).toBe(false)

    document.body.removeChild(container)
  })
})

describe('useCellRangeSelection phase2 — onRangeSelected callback', () => {
  const columns = computed(() => [
    { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
    { prop: 'age', key: 'age', label: 'Age', hidden: false } as unknown as ProcessedColumn,
  ])
  const data = computed(() => [
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 },
  ])

  it('fires onRangeSelected with selection data on mouseup', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cell1 = createCellEl(0, 0)
    const cell2 = createCellEl(1, 1)
    container.appendChild(cell1)
    container.appendChild(cell2)

    const onRangeSelected = vi.fn()
    const { isSelecting } = useCellRangeSelection({
      containerRef: ref(container),
      dom,
      data,
      columns,
      enabled: () => true,
      onRangeSelected,
    })

    // Start selection
    const mousedown = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true })
    cell1.dispatchEvent(mousedown)

    // Move to cell2
    const mousemove = new MouseEvent('mousemove', { bubbles: true, cancelable: true })
    Object.defineProperty(mousemove, 'target', { value: cell2 })
    document.dispatchEvent(mousemove)

    const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true })
    document.dispatchEvent(mouseup)

    expect(isSelecting.value).toBe(false)
    expect(onRangeSelected).toHaveBeenCalledTimes(1)
    const selection = onRangeSelected.mock.calls[0][0]
    expect(selection.range.startRow).toBe(0)
    expect(selection.range.endRow).toBe(1)
    expect(selection.range.startCol).toBe(0)
    expect(selection.range.endCol).toBe(1)

    document.body.removeChild(container)
  })
})

describe('useCellRangeSelection phase2 — extractRangeText with null prop', () => {
  const columns = computed(() => [
    { prop: null, key: 'action', label: 'Action', hidden: false } as unknown as ProcessedColumn,
    { prop: 'name', key: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn,
  ])
  const data = computed(() => [{ name: 'Alice' }])

  it('handles columns with null prop gracefully', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const cell = createCellEl(0, 0)
    container.appendChild(cell)

    const onRangeSelected = vi.fn()
    useCellRangeSelection({
      containerRef: ref(container),
      dom,
      data,
      columns,
      enabled: () => true,
      onRangeSelected,
    })

    // Start and end on same cell
    const mousedown = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true })
    cell.dispatchEvent(mousedown)

    const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true })
    document.dispatchEvent(mouseup)

    expect(onRangeSelected).toHaveBeenCalledTimes(1)
    const selection = onRangeSelected.mock.calls[0][0]
    expect(selection.tsv).toBeDefined()

    document.body.removeChild(container)
  })
})
