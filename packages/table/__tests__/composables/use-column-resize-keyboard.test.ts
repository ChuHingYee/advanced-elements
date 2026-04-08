import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useColumnResize } from '../../src/composables/columns/use-column-resize'

// Must use vi.hoisted to ensure global mock is applied before module imports
const __rAF = vi.hoisted(() => {
  let rafId = 0
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0)
    return ++rafId
  }) as typeof globalThis.requestAnimationFrame
  globalThis.cancelAnimationFrame = (() => {}) as typeof globalThis.cancelAnimationFrame
})
void __rAF

const COLUMN_KEY_ATTR = 'data-adv-table-column-key'

function createHeaderCellEl(columnKey = 'name'): HTMLElement {
  const el = document.createElement('span')
  // <zh/> 生产口径自有类（use-column-resize OWNED_HEADER_CELL_SELECTORS） | <en/> Production-caliber owned class
  el.classList.add('adv-table__v2-header-cell')
  el.setAttribute(COLUMN_KEY_ATTR, columnKey)
  const rect: DOMRect = {
    x: 0,
    y: 0,
    width: 200,
    height: 40,
    top: 0,
    right: 200,
    bottom: 40,
    left: 0,
    toJSON: () => ({}),
  }
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect)
  return el
}

function createKeyboardEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  const el = createHeaderCellEl('name')
  return {
    altKey: true,
    key: 'ArrowRight',
    preventDefault: vi.fn(),
    target: el,
    ...overrides,
  } as any
}

describe('useColumnResize phase3', () => {
  afterEach(() => {
    document.body.style.cursor = ''
    document.onselectstart = null
    document.ondragstart = null
  })

  function setup() {
    const columns = ref([
      { key: 'name', width: 100 },
      { key: 'age', width: 80 },
    ])
    const getColumnKey = (col: any) => col.key
    const onHeaderDragend = vi.fn()
    const resizeProxyRef = ref<HTMLElement | undefined | null>(undefined)
    const result = useColumnResize({ columns, getColumnKey, onHeaderDragend, resizeProxyRef, border: true, resizable: true } as any)
    return { columns, result, onHeaderDragend, resizeProxyRef }
  }

  describe('handleHeaderKeyDown', () => {
    it('returns early without altKey', () => {
      const { result } = setup()
      const event = createKeyboardEvent({ altKey: false })
      result.handleHeaderKeyDown(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('returns early with wrong key', () => {
      const { result } = setup()
      const event = createKeyboardEvent({ key: 'Tab' })
      result.handleHeaderKeyDown(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('returns early when no column key on target', () => {
      const { result } = setup()
      const el = document.createElement('span')
      el.classList.add('adv-table__v2-header-cell')
      const event = createKeyboardEvent({ target: el })
      result.handleHeaderKeyDown(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('returns early when column key does not match any leaf column', () => {
      const { result } = setup()
      const el = createHeaderCellEl('unknown')
      const event = createKeyboardEvent({ target: el })
      result.handleHeaderKeyDown(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('resizes column with ArrowRight', () => {
      const { result, onHeaderDragend } = setup()
      const event = createKeyboardEvent({ key: 'ArrowRight' })
      result.handleHeaderKeyDown(event)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(result.columnWidths.name).toBe(110)
      expect(onHeaderDragend).toHaveBeenCalledWith(
        expect.objectContaining({ columnKey: 'name', newWidth: 110, oldWidth: 100 }),
      )
    })

    it('resizes column with ArrowLeft', () => {
      const { result, onHeaderDragend } = setup()
      const event = createKeyboardEvent({ key: 'ArrowLeft' })
      result.handleHeaderKeyDown(event)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(result.columnWidths.name).toBe(90)
      expect(onHeaderDragend).toHaveBeenCalledWith(
        expect.objectContaining({ columnKey: 'name', newWidth: 90, oldWidth: 100 }),
      )
    })

    it('does not resize below minWidth', () => {
      const columns = ref([{ key: 'name', width: 15 }])
      const getColumnKey = (col: any) => col.key
      const result = useColumnResize({ columns, getColumnKey, border: true, resizable: true } as any)
      const event = createKeyboardEvent({ key: 'ArrowLeft' })
      result.handleHeaderKeyDown(event)
      expect(result.columnWidths.name).toBe(50)
    })

    it('returns early when newWidth equals currentWidth at minWidth', () => {
      const columns = ref([{ key: 'name', width: 50, minWidth: 50 }])
      const getColumnKey = (col: any) => col.key
      const result = useColumnResize({ columns, getColumnKey, border: true, resizable: true } as any)
      const event = createKeyboardEvent({ key: 'ArrowLeft' })
      result.handleHeaderKeyDown(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })
})
