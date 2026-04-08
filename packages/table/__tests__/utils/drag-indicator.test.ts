/**
 * <zh/> drag-indicator 单元测试 | <en/> drag-indicator unit tests
 */
import type { DragLocator } from '../../src/types/drag-locator'
import { describe, expect, it, vi } from 'vitest'
import { createDragIndicatorManager } from '../../src/utils/drag-indicator'

function createMockLocator(container: HTMLElement | null = null): DragLocator {
  return {
    getRowContainer: () => container,
    getCurrentRowKeys: () => [],
    getDragHandleSelector: () => '.handle',
    getDraggableRowSelector: () => '.row',
    getVisibleRowElements: container => Array.from(container.querySelectorAll<HTMLElement>('.row')),
    getAnimation: () => 0,
    getGhostClass: () => undefined,
    getInsertIndicatorContainer: () => container,
  }
}

describe('createDragIndicatorManager', () => {
  it('positionIndicator creates and positions indicator element', () => {
    const container = document.createElement('div')
    const row = document.createElement('div')
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, bottom: 100, right: 200, width: 200, height: 100, x: 0, y: 0, toJSON: () => {} } as DOMRect)
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: 10, left: 0, bottom: 40, right: 200, width: 200, height: 30, x: 0, y: 10, toJSON: () => {} } as DOMRect)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ position: 'relative' } as CSSStyleDeclaration)

    const manager = createDragIndicatorManager(() => createMockLocator(container), () => container)
    manager.positionIndicator(row, 'before', false)

    expect(container.querySelector('.adv-table-row-drop-indicator')).toBeTruthy()
  })

  it('positionIndicator positions after row for "after" position', () => {
    const container = document.createElement('div')
    const row = document.createElement('div')
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, bottom: 100, right: 200, width: 200, height: 100, x: 0, y: 0, toJSON: () => {} } as DOMRect)
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: 10, left: 0, bottom: 40, right: 200, width: 200, height: 30, x: 0, y: 10, toJSON: () => {} } as DOMRect)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ position: 'relative' } as CSSStyleDeclaration)

    const manager = createDragIndicatorManager(() => createMockLocator(container), () => container)
    manager.positionIndicator(row, 'after', false)

    const indicator = container.querySelector('.adv-table-row-drop-indicator') as HTMLElement
    expect(indicator).toBeTruthy()
    expect(indicator.style.top).toBe('40px')
  })

  it('positionIndicator sets static container to relative', () => {
    const container = document.createElement('div')
    const row = document.createElement('div')
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, bottom: 100, right: 200, width: 200, height: 100, x: 0, y: 0, toJSON: () => {} } as DOMRect)
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: 10, left: 0, bottom: 40, right: 200, width: 200, height: 30, x: 0, y: 10, toJSON: () => {} } as DOMRect)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ position: 'static' } as CSSStyleDeclaration)

    const manager = createDragIndicatorManager(() => createMockLocator(container), () => container)
    manager.positionIndicator(row, 'before', false)

    expect(container.style.position).toBe('relative')
  })

  it('positionIndicator toggles invalid class', () => {
    const container = document.createElement('div')
    const row = document.createElement('div')
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, bottom: 100, right: 200, width: 200, height: 100, x: 0, y: 0, toJSON: () => {} } as DOMRect)
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: 10, left: 0, bottom: 40, right: 200, width: 200, height: 30, x: 0, y: 10, toJSON: () => {} } as DOMRect)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ position: 'relative' } as CSSStyleDeclaration)

    const manager = createDragIndicatorManager(() => createMockLocator(container), () => container)
    manager.positionIndicator(row, 'before', true)

    const indicator = container.querySelector('.adv-table-row-drop-indicator') as HTMLElement
    expect(indicator.classList.contains('adv-table-row-drop-indicator--invalid')).toBe(true)
  })

  it('positionIndicator does nothing when no indicator container', () => {
    const row = document.createElement('div')
    const manager = createDragIndicatorManager(() => createMockLocator(null), () => null)
    // <zh/> 防御性空操作：无容器时静默返回，不抛错
    // <en/> Defensive no-op: silently returns without a container, never throws
    expect(() => manager.positionIndicator(row, 'before', false)).not.toThrow()
  })

  it('removeIndicator removes the indicator element', () => {
    const container = document.createElement('div')
    const row = document.createElement('div')
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, bottom: 100, right: 200, width: 200, height: 100, x: 0, y: 0, toJSON: () => {} } as DOMRect)
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: 10, left: 0, bottom: 40, right: 200, width: 200, height: 30, x: 0, y: 10, toJSON: () => {} } as DOMRect)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ position: 'relative' } as CSSStyleDeclaration)

    const manager = createDragIndicatorManager(() => createMockLocator(container), () => container)
    manager.positionIndicator(row, 'before', false)
    expect(container.querySelector('.adv-table-row-drop-indicator')).toBeTruthy()

    manager.removeIndicator()
    expect(container.querySelector('.adv-table-row-drop-indicator')).toBeNull()
  })

  it('removeIndicator is safe when no indicator exists', () => {
    const manager = createDragIndicatorManager(() => createMockLocator(null), () => null)
    expect(() => manager.removeIndicator()).not.toThrow()
  })

  it('clearInvalidDropClass removes invalid-drop class from rows', () => {
    const container = document.createElement('div')
    const row1 = document.createElement('div')
    row1.className = 'adv-table__row--invalid-drop'
    container.appendChild(row1)

    const manager = createDragIndicatorManager(() => createMockLocator(container), () => container)
    manager.clearInvalidDropClass()

    expect(row1.classList.contains('adv-table__row--invalid-drop')).toBe(false)
  })

  it('clearInvalidDropClass is safe when no container', () => {
    const manager = createDragIndicatorManager(() => createMockLocator(null), () => null)
    expect(() => manager.clearInvalidDropClass()).not.toThrow()
  })

  it('clearDropTarget removes drop-target class from last target', () => {
    const container = document.createElement('div')
    const row = document.createElement('div')

    const manager = createDragIndicatorManager(() => createMockLocator(container), () => container)
    manager.setDropTarget(row)
    expect(row.classList.contains('adv-table__row--drop-target')).toBe(true)

    manager.clearDropTarget()
    expect(row.classList.contains('adv-table__row--drop-target')).toBe(false)
  })

  it('clearDropTarget is safe when no last target', () => {
    const manager = createDragIndicatorManager(() => createMockLocator(null), () => null)
    expect(() => manager.clearDropTarget()).not.toThrow()
  })

  it('setDropTarget clears previous target before setting new one', () => {
    const container = document.createElement('div')
    const row1 = document.createElement('div')
    const row2 = document.createElement('div')

    const manager = createDragIndicatorManager(() => createMockLocator(container), () => container)
    manager.setDropTarget(row1)
    expect(row1.classList.contains('adv-table__row--drop-target')).toBe(true)

    manager.setDropTarget(row2)
    expect(row1.classList.contains('adv-table__row--drop-target')).toBe(false)
    expect(row2.classList.contains('adv-table__row--drop-target')).toBe(true)
  })

  it('trackTarget sets lastDropTarget without adding class', () => {
    const container = document.createElement('div')
    const row = document.createElement('div')

    const manager = createDragIndicatorManager(() => createMockLocator(container), () => container)
    manager.trackTarget(row)
    expect(row.classList.contains('adv-table__row--drop-target')).toBe(false)
    // But clearDropTarget should still work
    manager.clearDropTarget()
  })

  it('clearAllDragClasses removes all drag-related classes', () => {
    const container = document.createElement('div')
    const row1 = document.createElement('div')
    row1.className = 'adv-table__row--no-drop adv-table__row--drop-target adv-table__row--chosen adv-table__row--drag adv-table__row--invalid-drop'
    container.appendChild(row1)

    const manager = createDragIndicatorManager(() => createMockLocator(container), () => container)
    manager.clearAllDragClasses()

    expect(row1.classList.contains('adv-table__row--no-drop')).toBe(false)
    expect(row1.classList.contains('adv-table__row--drop-target')).toBe(false)
    expect(row1.classList.contains('adv-table__row--chosen')).toBe(false)
    expect(row1.classList.contains('adv-table__row--drag')).toBe(false)
    expect(row1.classList.contains('adv-table__row--invalid-drop')).toBe(false)
  })

  it('clearAllDragClasses is safe when no container', () => {
    const manager = createDragIndicatorManager(() => createMockLocator(null), () => null)
    expect(() => manager.clearAllDragClasses()).not.toThrow()
  })
})
