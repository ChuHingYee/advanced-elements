import type { DragLocator } from '../../src/types/drag-locator'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calcDropPosition, calcVirtualTargetKey, createDropIndicator, reorderFullDataByMove, reorderFullDataByVisibleOrder, rollbackDomOrder } from '../../src/utils/row-drag-utils'

describe('row-drag-utils', () => {
  describe('reorderFullDataByVisibleOrder', () => {
    const getKey = (row: { id: string }) => row.id

    it('should return original data when visibleKeys is empty', () => {
      const data = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
      const result = reorderFullDataByVisibleOrder(data, [], getKey)
      expect(result).toBe(data)
    })

    it('should reorder visible rows by DOM order', () => {
      const data = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
      ]
      // DOM order changed: Bob, Alice, Charlie
      const result = reorderFullDataByVisibleOrder(data, ['2', '1', '3'], getKey)
      expect(result.map(r => r.id)).toEqual(['2', '1', '3'])
    })

    it('should preserve invisible rows at their original positions', () => {
      const data = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
        { id: '3', name: 'Charlie' },
        { id: '4', name: 'David' },
      ]
      // Only rows 1, 3 are visible and reordered
      const result = reorderFullDataByVisibleOrder(data, ['3', '1'], getKey)
      // Row 2 and 4 stay in place; rows 1, 3 are swapped
      expect(result.map(r => r.id)).toEqual(['3', '2', '1', '4'])
    })

    it('should use provided keyToRow map', () => {
      const data = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
      const keyToRow = new Map([
        ['1', data[0]!],
        ['2', data[1]!],
      ])
      const result = reorderFullDataByVisibleOrder(data, ['2', '1'], getKey, keyToRow)
      expect(result.map(r => r.id)).toEqual(['2', '1'])
    })

    it('should return original data when cursor remains 0 (no visible rows matched)', () => {
      const data = [{ id: '1', name: 'A' }]
      // visibleKeys contains keys not in data
      const result = reorderFullDataByVisibleOrder(data, ['99'], getKey)
      expect(result).toBe(data)
    })

    it('should return original data when cursor does not match visibleKeys length', () => {
      const data = [{ id: '1', name: 'A' }]
      // One row in data, but visibleKeys claims 2 — second key missing in rowMap
      const result = reorderFullDataByVisibleOrder(data, ['1', 'missing'], getKey)
      // cursor=1 but visibleKeys.length=2 → returns original
      expect(result).toBe(data)
    })
  })

  describe('reorderFullDataByMove', () => {
    const data = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
      { id: '4', name: 'David' },
    ]
    const keyToIndex = new Map([
      ['1', 0],
      ['2', 1],
      ['3', 2],
      ['4', 3],
    ])

    it('should move source row before target row', () => {
      const result = reorderFullDataByMove(data, '4', '1', keyToIndex, 'before')
      expect(result.map(r => r.id)).toEqual(['4', '1', '2', '3'])
    })

    it('should move source row after target row', () => {
      const result = reorderFullDataByMove(data, '1', '3', keyToIndex, 'after')
      expect(result.map(r => r.id)).toEqual(['2', '3', '1', '4'])
    })

    it('should return original data when source equals target', () => {
      const result = reorderFullDataByMove(data, '1', '1', keyToIndex)
      expect(result).toBe(data)
    })

    it('should return original data when source key not found', () => {
      const result = reorderFullDataByMove(data, '99', '1', keyToIndex)
      expect(result).toBe(data)
    })

    it('should return original data when target key not found', () => {
      const result = reorderFullDataByMove(data, '1', '99', keyToIndex)
      expect(result).toBe(data)
    })

    it('should default to before semantics', () => {
      const result = reorderFullDataByMove(data, '4', '2', keyToIndex)
      expect(result.map(r => r.id)).toEqual(['1', '4', '2', '3'])
    })

    it('should handle move from earlier to later index (target - 1 adjustment)', () => {
      // sourceIdx=0, targetIdx=3, after removal target becomes 2
      const result = reorderFullDataByMove(data, '1', '4', keyToIndex, 'after')
      expect(result.map(r => r.id)).toEqual(['2', '3', '4', '1'])
    })

    it('should handle move from later to earlier index', () => {
      // sourceIdx=3, targetIdx=0, before
      const result = reorderFullDataByMove(data, '4', '1', keyToIndex, 'before')
      expect(result.map(r => r.id)).toEqual(['4', '1', '2', '3'])
    })
  })

  describe('createDropIndicator', () => {
    it('should create a div with adv-table-row-drop-indicator class', () => {
      const el = createDropIndicator()
      expect(el).toBeInstanceOf(HTMLElement)
      expect(el.className).toBe('adv-table-row-drop-indicator')
    })

    it('should contain line and arrow children', () => {
      const el = createDropIndicator()
      const line = el.querySelector('.adv-table-row-drop-indicator__line')
      const arrow = el.querySelector('.adv-table-row-drop-indicator__arrow')
      expect(line).not.toBeNull()
      expect(arrow).not.toBeNull()
    })
  })

  describe('calcDropPosition', () => {
    it('should return "before" when mouse is above row center', () => {
      const row = {
        getBoundingClientRect: () => ({ top: 100, height: 40, bottom: 140, left: 0, right: 0, width: 0, x: 0, y: 100, toJSON: () => ({}) }),
      } as HTMLElement
      const result = calcDropPosition(110, row)
      expect(result).toBe('before')
    })

    it('should return "after" when mouse is below row center', () => {
      const row = {
        getBoundingClientRect: () => ({ top: 100, height: 40, bottom: 140, left: 0, right: 0, width: 0, x: 0, y: 100, toJSON: () => ({}) }),
      } as HTMLElement
      const result = calcDropPosition(130, row)
      expect(result).toBe('after')
    })

    it('should return "before" when mouse is exactly at center (boundary)', () => {
      const row = {
        getBoundingClientRect: () => ({ top: 100, height: 40, bottom: 140, left: 0, right: 0, width: 0, x: 0, y: 100, toJSON: () => ({}) }),
      } as HTMLElement
      // center = 100 + 40/2 = 120, mouseY < center → before
      const result = calcDropPosition(119, row)
      expect(result).toBe('before')
    })
  })

  describe('rollbackDomOrder', () => {
    it('should move item back to original index when displaced', () => {
      const parent = document.createElement('div')
      const item = document.createElement('div')
      const sibling = document.createElement('div')
      parent.appendChild(sibling)
      parent.appendChild(item)
      // item is at index 1, but should be at index 0
      rollbackDomOrder({ from: parent, item }, 0)
      expect(parent.children[0]).toBe(item)
      expect(parent.children[1]).toBe(sibling)
    })

    it('should append item when oldIndex >= children length', () => {
      const parent = document.createElement('div')
      const item = document.createElement('div')
      const first = document.createElement('div')
      parent.appendChild(first)
      parent.appendChild(item)
      // oldIndex=5 is out of range, item should be appended
      rollbackDomOrder({ from: parent, item }, 5)
      expect(parent.children[1]).toBe(item)
      expect(parent.children.length).toBe(2)
    })

    it('should do nothing when oldIndex is undefined', () => {
      const parent = document.createElement('div')
      const item = document.createElement('div')
      parent.appendChild(item)
      rollbackDomOrder({ from: parent, item }, undefined)
      expect(parent.children.length).toBe(1)
      expect(parent.children[0]).toBe(item)
    })

    it('should do nothing when item is already at original position', () => {
      const parent = document.createElement('div')
      const item = document.createElement('div')
      parent.appendChild(item)
      rollbackDomOrder({ from: parent, item }, 0)
      expect(parent.children[0]).toBe(item)
    })
  })

  describe('calcVirtualTargetKey', () => {
    function createDragLocator(overrides: Partial<DragLocator> = {}): DragLocator {
      return {
        getRowContainer: () => null,
        getCurrentRowKeys: () => [],
        getDragHandleSelector: () => '.handle',
        getDraggableRowSelector: () => 'tr',
        getVisibleRowElements: container => Array.from(container.querySelectorAll<HTMLElement>('tr')),
        getAnimation: () => 150,
        getGhostClass: () => 'ghost',
        getScrollContainer: vi.fn(() => ({
          getBoundingClientRect: () => ({ top: 0, bottom: 480, left: 0, right: 800, width: 800, height: 480, x: 0, y: 0, toJSON: () => ({}) }),
          scrollTop: 0,
        } as HTMLElement)),
        getRowHeight: vi.fn(() => 48),
        getInsertIndicatorContainer: () => null,
        ...overrides,
      }
    }

    const data = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ]
    const getKey = (row: { id: string }) => row.id

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should return empty string when scrollContainer is null', () => {
      const dragLoc = createDragLocator({ getScrollContainer: () => null })
      const result = calcVirtualTargetKey(100, dragLoc, data, getKey, null)
      expect(result).toBe('')
    })

    it('should return empty string when mouseY is above scroll container', () => {
      const dragLoc = createDragLocator()
      const result = calcVirtualTargetKey(-10, dragLoc, data, getKey, null)
      expect(result).toBe('')
    })

    it('should return empty string when mouseY is below scroll container', () => {
      const dragLoc = createDragLocator()
      const result = calcVirtualTargetKey(500, dragLoc, data, getKey, null)
      expect(result).toBe('')
    })

    it('should calculate target key using rowHeight when available', () => {
      const dragLoc = createDragLocator()
      // mouseY=100, rect.top=0, scrollTop=0 → absoluteY=100, rowHeight=48 → idx=2 (100/48=2.08)
      const result = calcVirtualTargetKey(100, dragLoc, data, getKey, null)
      expect(result).toBe('3')
    })

    it('should clamp index to data bounds', () => {
      const dragLoc = createDragLocator({
        getScrollContainer: vi.fn(() => ({
          getBoundingClientRect: () => ({ top: 0, bottom: 2000, left: 0, right: 800, width: 800, height: 2000, x: 0, y: 0, toJSON: () => ({}) }),
          scrollTop: 0,
        } as HTMLElement)),
      })
      // mouseY=1000, rect.top=0, scrollTop=0 → absoluteY=1000, rowHeight=48 → idx=20, clamped to 2
      const result = calcVirtualTargetKey(1000, dragLoc, data, getKey, null)
      expect(result).toBe('3')
    })

    it('should clamp index to 0 when mouseY is negative within container', () => {
      const dragLoc = createDragLocator()
      // mouseY inside container but negative absoluteY after subtraction
      // rect.top=0, so absoluteY = mouseY - 0 + 0 = mouseY
      // If mouseY is 10 → idx = 10/48 = 0
      const result = calcVirtualTargetKey(10, dragLoc, data, getKey, null)
      expect(result).toBe('1')
    })

    it('should use cached visible rows when rowHeight is not available', () => {
      const dragLoc = createDragLocator({ getRowHeight: () => 0 })
      const row1 = document.createElement('div')
      row1.setAttribute('data-adv-table-row-key', '1')
      Object.defineProperty(row1, 'offsetTop', { value: 0, configurable: true })
      Object.defineProperty(row1, 'offsetHeight', { value: 48, configurable: true })
      const row2 = document.createElement('div')
      row2.setAttribute('data-adv-table-row-key', '2')
      Object.defineProperty(row2, 'offsetTop', { value: 48, configurable: true })
      Object.defineProperty(row2, 'offsetHeight', { value: 48, configurable: true })
      // mouseY=50 → absoluteY=50 → row2 (offsetTop=48, height=48, 48<=50<96)
      const result = calcVirtualTargetKey(50, dragLoc, data, getKey, [row1, row2])
      expect(result).toBe('2')
    })

    it('should return empty string when no cached rows and no rowHeight', () => {
      const dragLoc = createDragLocator({ getRowHeight: () => 0 })
      const result = calcVirtualTargetKey(50, dragLoc, data, getKey, null)
      expect(result).toBe('')
    })

    it('should return empty string when cached rows is empty', () => {
      const dragLoc = createDragLocator({ getRowHeight: () => 0 })
      const result = calcVirtualTargetKey(50, dragLoc, data, getKey, [])
      expect(result).toBe('')
    })

    it('should return lastKey when mouseY is beyond all cached rows', () => {
      const dragLoc = createDragLocator({
        getRowHeight: () => 0,
        getScrollContainer: vi.fn(() => ({
          getBoundingClientRect: () => ({ top: 0, bottom: 2000, left: 0, right: 800, width: 800, height: 2000, x: 0, y: 0, toJSON: () => ({}) }),
          scrollTop: 0,
        } as HTMLElement)),
      })
      const row1 = document.createElement('div')
      row1.setAttribute('data-adv-table-row-key', '1')
      Object.defineProperty(row1, 'offsetTop', { value: 0, configurable: true })
      Object.defineProperty(row1, 'offsetHeight', { value: 48, configurable: true })
      // mouseY=500 → beyond all rows, falls through, lastKey='1'
      const result = calcVirtualTargetKey(500, dragLoc, data, getKey, [row1])
      expect(result).toBe('1')
    })

    it('should use firstRowHeight fallback when no row has data-adv-table-row-key attr', () => {
      const dragLoc = createDragLocator({ getRowHeight: () => 0 })
      const row1 = document.createElement('div')
      Object.defineProperty(row1, 'offsetTop', { value: 0, configurable: true })
      Object.defineProperty(row1, 'offsetHeight', { value: 48, configurable: true })
      // mouseY=50, no key attr on any row, falls through to firstRowHeight fallback
      // absoluteY=50, firstRowHeight=48, idx=50/48=1, clamped to data.length-1=2
      const result = calcVirtualTargetKey(50, dragLoc, data, getKey, [row1])
      expect(result).toBe('2')
    })

    it('should find key via querySelector when row does not have direct attr', () => {
      const dragLoc = createDragLocator({ getRowHeight: () => 0 })
      const row1 = document.createElement('div')
      Object.defineProperty(row1, 'offsetTop', { value: 0, configurable: true })
      Object.defineProperty(row1, 'offsetHeight', { value: 48, configurable: true })
      const inner = document.createElement('span')
      inner.setAttribute('data-adv-table-row-key', 'inner-key')
      row1.appendChild(inner)
      // mouseY=10, absoluteY=10, row1 covers 0-48, 10 is in range
      const result = calcVirtualTargetKey(10, dragLoc, data, getKey, [row1])
      expect(result).toBe('inner-key')
    })
  })
})
