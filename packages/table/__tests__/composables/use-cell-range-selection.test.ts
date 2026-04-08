/**
 * @file use-cell-range-selection 单元格范围选择 Composable 测试
 */
import type { ProcessedColumn } from '../../src/types'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createDefaultDomAdapter } from '../../src/components/renderer-core/default-dom-adapter'
import { createVirtualDomAdapter } from '../../src/components/renderer-core/virtual-dom-adapter'
import { useCellRangeSelection } from '../../src/composables/interaction/use-cell-range-selection'

/** <zh/> DOM 适配器——观察范围收窄选择器的来源（与生产同源，非 stub） | <en/> DOM adapter — source of the scope-narrowing selector (same as production, not a stub) */
const dom = createDefaultDomAdapter('el')

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
})

/** Create a mock cell element with data attributes */
function createCellEl(row: number, col: number, text = ''): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-adv-cell-row', String(row))
  el.setAttribute('data-adv-cell-col', String(col))
  el.textContent = text
  return el
}

describe('useCellRangeSelection', () => {
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
    const enabled = () => true
    return useCellRangeSelection({
      containerRef,
      dom,
      data,
      columns,
      enabled,
      ...overrides,
    })
  }

  /** Simulate mousedown on a cell element */
  function simulateMousedown(target: HTMLElement, button = 0) {
    const event = new MouseEvent('mousedown', { button, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: target })
    container.dispatchEvent(event)
    return event
  }

  /** Simulate mousemove on a target element */
  function simulateMousemove(target: HTMLElement) {
    const event = new MouseEvent('mousemove', { bubbles: true })
    Object.defineProperty(event, 'target', { value: target })
    document.dispatchEvent(event)
  }

  /** Simulate mouseup */
  function simulateMouseup() {
    const event = new MouseEvent('mouseup', { bubbles: true })
    document.dispatchEvent(event)
  }

  describe('coordinate guards', () => {
    it.each([
      [-1, 0],
      [3, 0],
      [0.5, 0],
      [Number.NaN, 0],
      [0, -1],
      [0, 3],
      [0, Number.POSITIVE_INFINITY],
    ])('ignores invalid keyboard coordinates (%s, %s)', (rowIndex, columnIndex) => {
      const rs = createRangeSelection()
      rs.extendTo({ rowIndex, columnIndex })
      expect(rs.isSelecting.value).toBe(false)
      expect(rs.currentRange.value).toBeNull()
    })

    it('rejects columns translated outside the cells domain for both input paths', () => {
      const rs = createRangeSelection({ columnIndexResolver: () => -1 })
      rs.extendTo({ rowIndex: 0, columnIndex: 0 })
      expect(rs.currentRange.value).toBeNull()
      const cell = createCellEl(0, 0)
      container.appendChild(cell)
      expect(simulateMousedown(cell).defaultPrevented).toBe(false)
      expect(rs.isSelecting.value).toBe(false)
    })

    it('does not extend a disabled selection', () => {
      const rs = createRangeSelection({ enabled: false })
      rs.extendTo({ rowIndex: 0, columnIndex: 0 })
      expect(rs.currentRange.value).toBeNull()
    })

    it('keeps display coordinates while excluding synthetic rows from payloads', () => {
      const rows = [data.value[0], { __isGrandTotalRow: true, name: 'Total' }, data.value[1]]
      const rs = createRangeSelection({ data: computed(() => rows) })
      rs.extendTo({ rowIndex: 0, columnIndex: 0 })
      rs.extendTo({ rowIndex: 2, columnIndex: 0 })
      rs.finishSelection()
      expect(rs.lastSelection.value?.rows).toEqual([rows[0], rows[2]])
      expect(rs.lastSelection.value?.tsv).toBe('Alice\nBob')
      expect(rs.lastSelection.value?.range.endRow).toBe(2)
      expect(rs.isCellSelected(2, 0)).toBe(true)
      expect(rs.isCellSelected(1, 0)).toBe(false)
    })
  })

  describe('initial state', () => {
    it('returns default values with no selection', () => {
      const rs = createRangeSelection()
      expect(rs.isSelecting.value).toBe(false)
      expect(rs.anchorCell.value).toBeNull()
      expect(rs.focusCell.value).toBeNull()
      expect(rs.currentRange.value).toBeNull()
      expect(rs.lastSelection.value).toBeNull()
    })

    it('isCellSelected returns false when no range', () => {
      const rs = createRangeSelection()
      expect(rs.isCellSelected(0, 0)).toBe(false)
      expect(rs.isCellSelected(1, 2)).toBe(false)
    })

    it('copySelectionToClipboard returns false when no selection', async () => {
      const rs = createRangeSelection()
      expect(await rs.copySelectionToClipboard()).toBe(false)
    })

    it('clearSelection is safe when no selection', () => {
      const rs = createRangeSelection()
      expect(() => rs.clearSelection()).not.toThrow()
    })
  })

  describe('computed range (normalizeRange)', () => {
    it('returns null when anchor is null', () => {
      const rs = createRangeSelection()
      rs.focusCell.value = { rowIndex: 2, columnIndex: 1 }
      expect(rs.currentRange.value).toBeNull()
    })

    it('returns null when focus is null', () => {
      const rs = createRangeSelection()
      rs.anchorCell.value = { rowIndex: 0, columnIndex: 0 }
      expect(rs.currentRange.value).toBeNull()
    })

    it('normalizes anchor > focus to correct range', () => {
      const rs = createRangeSelection()
      rs.anchorCell.value = { rowIndex: 2, columnIndex: 2 }
      rs.focusCell.value = { rowIndex: 0, columnIndex: 0 }
      expect(rs.currentRange.value).toEqual({
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 2,
      })
    })

    it('handles same start and end', () => {
      const rs = createRangeSelection()
      rs.anchorCell.value = { rowIndex: 1, columnIndex: 1 }
      rs.focusCell.value = { rowIndex: 1, columnIndex: 1 }
      expect(rs.currentRange.value).toEqual({
        startRow: 1,
        endRow: 1,
        startCol: 1,
        endCol: 1,
      })
    })
  })

  describe('isCellSelected', () => {
    it('returns true for cell within range', () => {
      const rs = createRangeSelection()
      rs.anchorCell.value = { rowIndex: 0, columnIndex: 0 }
      rs.focusCell.value = { rowIndex: 1, columnIndex: 1 }
      expect(rs.isCellSelected(0, 0)).toBe(true)
      expect(rs.isCellSelected(1, 1)).toBe(true)
      expect(rs.isCellSelected(0, 1)).toBe(true)
    })

    it('returns false for cell outside range', () => {
      const rs = createRangeSelection()
      rs.anchorCell.value = { rowIndex: 0, columnIndex: 0 }
      rs.focusCell.value = { rowIndex: 1, columnIndex: 1 }
      expect(rs.isCellSelected(2, 2)).toBe(false)
      expect(rs.isCellSelected(0, 2)).toBe(false)
    })
  })

  describe('clearSelection', () => {
    it('resets all state', () => {
      const rs = createRangeSelection()
      rs.anchorCell.value = { rowIndex: 0, columnIndex: 0 }
      rs.focusCell.value = { rowIndex: 1, columnIndex: 1 }
      rs.clearSelection()
      expect(rs.anchorCell.value).toBeNull()
      expect(rs.focusCell.value).toBeNull()
      expect(rs.lastSelection.value).toBeNull()
      expect(rs.currentRange.value).toBeNull()
    })
  })

  describe('handleMousedown', () => {
    it('ignores non-left button', () => {
      const rs = createRangeSelection()
      const el = createCellEl(1, 2)
      container.appendChild(el)
      simulateMousedown(el, 1)
      expect(rs.isSelecting.value).toBe(false)
    })

    it('ignores left button without data-adv-cell attributes', () => {
      const rs = createRangeSelection()
      const el = document.createElement('div')
      container.appendChild(el)
      const event = new MouseEvent('mousedown', { button: 0, bubbles: true })
      Object.defineProperty(event, 'target', { value: el })
      container.dispatchEvent(event)
      expect(rs.isSelecting.value).toBe(false)
    })

    it('ignores clicks on interactive elements', () => {
      const rs = createRangeSelection()
      const input = document.createElement('input')
      input.setAttribute('data-adv-cell-row', '0')
      input.setAttribute('data-adv-cell-col', '0')
      container.appendChild(input)
      simulateMousedown(input)
      expect(rs.isSelecting.value).toBe(false)
    })

    it('starts selection on valid cell mousedown', () => {
      const rs = createRangeSelection()
      const el = createCellEl(0, 0)
      container.appendChild(el)
      simulateMousedown(el)
      expect(rs.isSelecting.value).toBe(true)
      expect(rs.anchorCell.value).toEqual({ rowIndex: 0, columnIndex: 0 })
      expect(rs.focusCell.value).toEqual({ rowIndex: 0, columnIndex: 0 })
    })

    it('does not start when disabled', () => {
      const rs = createRangeSelection({ enabled: () => false })
      const el = createCellEl(0, 0)
      container.appendChild(el)
      simulateMousedown(el)
      expect(rs.isSelecting.value).toBe(false)
    })
  })

  /**
   * <zh/> MutationObserver 的观察范围收窄——选择器由 DOM 适配器供给。
   * <en/> MutationObserver scope narrowing — the selector comes from the DOM adapter.
   */
  describe('mutationObserver scope (adapter-supplied selector)', () => {
    it('narrows observation to the adapter-supplied body container', () => {
      const bodyWrapper = document.createElement('div')
      bodyWrapper.className = 'el-table__body-wrapper'
      container.appendChild(bodyWrapper)
      const cell = createCellEl(0, 0)
      bodyWrapper.appendChild(cell)

      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe')
      try {
        createRangeSelection()
        simulateMousedown(cell)

        const observedNodes = observeSpy.mock.calls.map(([node]) => node)
        expect(observedNodes).toContain(bodyWrapper)
        // <zh/> 命中 body wrapper 时不得退化为观察整个容器
        // <en/> When the body wrapper is found, observation must not degrade to the whole container
        expect(observedNodes).not.toContain(container)
      }
      finally {
        observeSpy.mockRestore()
      }
    })

    it('falls back to the container when no body container matches', () => {
      const cell = createCellEl(0, 0)
      container.appendChild(cell)

      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe')
      try {
        createRangeSelection()
        simulateMousedown(cell)

        const observedNodes = observeSpy.mock.calls.map(([node]) => node)
        expect(observedNodes).toContain(container)
      }
      finally {
        observeSpy.mockRestore()
      }
    })

    it('matches under a custom namespace via the virtual adapter', () => {
      /**
       * <zh/> 反向验证「硬编码 `.el-` 前缀」已消除：原实现硬编码 `.el-table-v2__body`，
       * <zh/> 自定义命名空间下必然落空 → 观察范围退化为整个容器。适配器按当前命名空间构造后应命中。
       * <en/> Reverse-checks that the hard-coded `.el-` prefix is gone: the previous implementation
       * <en/> hard-coded `.el-table-v2__body`, so a custom namespace always missed and observation
       * <en/> degraded to the whole container. The adapter builds from the current namespace, so it matches.
       */
      const customBody = document.createElement('div')
      customBody.className = 'custom-table-v2__body'
      container.appendChild(customBody)
      const cell = createCellEl(0, 0)
      customBody.appendChild(cell)

      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe')
      try {
        createRangeSelection({ dom: createVirtualDomAdapter('custom') })
        simulateMousedown(cell)

        const observedNodes = observeSpy.mock.calls.map(([node]) => node)
        expect(observedNodes).toContain(customBody)
        expect(observedNodes).not.toContain(container)
      }
      finally {
        observeSpy.mockRestore()
      }
    })
  })

  describe('handleMousemove + handleMouseup', () => {
    it('updates focus cell on mousemove', () => {
      const rs = createRangeSelection()
      const el1 = createCellEl(0, 0)
      const el2 = createCellEl(1, 1)
      container.appendChild(el1)
      container.appendChild(el2)

      simulateMousedown(el1)
      simulateMousemove(el2)
      expect(rs.focusCell.value).toEqual({ rowIndex: 1, columnIndex: 1 })
    })

    it('ignores mousemove when not selecting', () => {
      const rs = createRangeSelection()
      const el = createCellEl(0, 0)
      container.appendChild(el)
      simulateMousemove(el)
      expect(rs.focusCell.value).toBeNull()
    })

    it('does not update focus when cell is the same', () => {
      const rs = createRangeSelection()
      const el = createCellEl(0, 0)
      container.appendChild(el)
      simulateMousedown(el)
      const initialFocus = rs.focusCell.value
      simulateMousemove(el)
      expect(rs.focusCell.value).toBe(initialFocus)
    })

    it('completes selection on mouseup and calls onRangeSelected', () => {
      const onRangeSelected = vi.fn()
      const rs = createRangeSelection({ onRangeSelected })
      const el1 = createCellEl(0, 0)
      const el2 = createCellEl(2, 2)
      container.appendChild(el1)
      container.appendChild(el2)

      simulateMousedown(el1)
      simulateMousemove(el2)
      simulateMouseup()

      expect(rs.isSelecting.value).toBe(false)
      expect(rs.lastSelection.value).not.toBeNull()
      expect(rs.lastSelection.value?.range).toEqual({
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 2,
      })
      expect(onRangeSelected).toHaveBeenCalledOnce()
      expect(onRangeSelected.mock.calls[0][0].tsv).toContain('Alice')
    })

    it('mouseup without selection is safe', () => {
      const rs = createRangeSelection()
      expect(() => simulateMouseup()).not.toThrow()
      expect(rs.lastSelection.value).toBeNull()
    })
  })

  describe('extractRangeText / buildSelection', () => {
    it('extracts TSV text from range', () => {
      const rs = createRangeSelection()
      const el1 = createCellEl(0, 0)
      const el2 = createCellEl(2, 1)
      container.appendChild(el1)
      container.appendChild(el2)

      simulateMousedown(el1)
      simulateMousemove(el2)
      simulateMouseup()

      const tsv = rs.lastSelection.value?.tsv ?? ''
      expect(tsv).toContain('Alice')
      expect(tsv).toContain('25')
      expect(tsv).toContain('Bob')
      expect(tsv).toContain('30')
      expect(tsv).toContain('Charlie')
      expect(tsv).toContain('\n')
      expect(tsv).toContain('\t')
    })

    it('builds selection with correct rows and columns', () => {
      const rs = createRangeSelection()
      const el1 = createCellEl(0, 0)
      const el2 = createCellEl(1, 1)
      container.appendChild(el1)
      container.appendChild(el2)

      simulateMousedown(el1)
      simulateMousemove(el2)
      simulateMouseup()

      const sel = rs.lastSelection.value
      expect(sel?.rows).toHaveLength(2)
      expect(sel?.columns).toHaveLength(2)
    })
  })

  describe('copySelectionToClipboard', () => {
    it('copies TSV when lastSelection exists', async () => {
      const rs = createRangeSelection()
      rs.lastSelection.value = {
        start: { rowIndex: 0, columnIndex: 0 },
        end: { rowIndex: 1, columnIndex: 1 },
        range: { startRow: 0, endRow: 1, startCol: 0, endCol: 1 },
        rows: data.value.slice(0, 2),
        columns: columns.value.slice(0, 2) as any,
        tsv: 'Alice\t25\nBob\t30',
      }
      const result = await rs.copySelectionToClipboard()
      expect(result).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Alice\t25\nBob\t30')
    })

    it('copies TSV after real selection', async () => {
      const rs = createRangeSelection()
      const el1 = createCellEl(0, 0)
      const el2 = createCellEl(1, 1)
      container.appendChild(el1)
      container.appendChild(el2)

      simulateMousedown(el1)
      simulateMousemove(el2)
      simulateMouseup()

      const result = await rs.copySelectionToClipboard()
      expect(result).toBe(true)
    })
  })

  describe('enabled toggle', () => {
    it('can be disabled and re-enabled', () => {
      const enabledRef = ref(true)
      const rs = createRangeSelection({ enabled: enabledRef })

      const el = createCellEl(0, 0)
      container.appendChild(el)

      enabledRef.value = false
      simulateMousedown(el)
      expect(rs.isSelecting.value).toBe(false)

      enabledRef.value = true
      simulateMousedown(el)
      expect(rs.isSelecting.value).toBe(true)
    })
  })

  describe('handleWindowBlur', () => {
    it('cancels active selection on window blur', () => {
      const rs = createRangeSelection()
      const el = createCellEl(0, 0)
      container.appendChild(el)

      simulateMousedown(el)
      expect(rs.isSelecting.value).toBe(true)

      window.dispatchEvent(new Event('blur'))

      expect(rs.isSelecting.value).toBe(false)
    })
  })
})
