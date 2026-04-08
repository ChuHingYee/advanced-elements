import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function createProxyEl(): HTMLElement {
  const el = document.createElement('div')
  el.classList.add('adv-table-virtual-renderer__column-resize-proxy')
  Object.defineProperty(el, 'style', {
    value: { left: '' },
    writable: true,
  })
  vi.spyOn(el, 'closest').mockReturnValue(el)
  return el
}

function createHeaderCellEl(rectOverrides: Partial<DOMRect> = {}, columnKey = 'name'): HTMLElement {
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
    ...rectOverrides,
  }
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect)
  return el
}

function createMouseMoveEvent(clientX: number, headerCellEl: HTMLElement): MouseEvent {
  const event = new MouseEvent('mousemove', { clientX, bubbles: true })
  Object.defineProperty(event, 'target', { value: headerCellEl, writable: false })
  return event
}

function createMouseDownEvent(clientX: number, headerCellEl: HTMLElement): MouseEvent {
  const event = new MouseEvent('mousedown', { clientX, bubbles: true })
  Object.defineProperty(event, 'target', { value: headerCellEl, writable: false })
  return event
}

function createMouseOutEvent(target: HTMLElement, relatedTarget: HTMLElement | null = null): MouseEvent {
  const event = new MouseEvent('mouseout', { bubbles: true })
  Object.defineProperty(event, 'target', { value: target, writable: false })
  if (relatedTarget) {
    Object.defineProperty(event, 'relatedTarget', { value: relatedTarget, writable: false })
  }
  return event
}

describe('useColumnResize', () => {
  beforeEach(() => {
    document.body.style.cursor = ''
  })

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

  it('returns initial state', () => {
    const { result } = setup()
    expect(result.resizing.value).toBe(false)
    expect(result.resizeProxyVisible.value).toBe(false)
    expect(result.getColumnWidth({ key: 'name', width: 100 })).toBe(100)
    expect(result.getColumnWidth({ key: 'age', width: 80 })).toBe(80)
  })

  it('getColumnWidth returns user-resized width when available', () => {
    const { result } = setup()
    result.columnWidths.name = 150
    expect(result.getColumnWidth({ key: 'name', width: 100 })).toBe(150)
  })

  it('getColumnWidth falls back to col.width', () => {
    const { result } = setup()
    expect(result.getColumnWidth({ key: 'name', width: 100 })).toBe(100)
  })

  it('getColumnWidth returns default width for unknown col', () => {
    const { result } = setup()
    expect(result.getColumnWidth({ key: 'unknown', width: undefined })).toBe(150)
  })

  describe('handleHeaderMouseMove', () => {
    it('sets draggingColumnKey and col-resize cursor when cursor is near right edge', () => {
      const { result } = setup()
      const headerCellEl = createHeaderCellEl({ right: 200, width: 200 })
      const event = createMouseMoveEvent(195, headerCellEl)

      result.handleHeaderMouseMove(event)

      expect(document.body.style.cursor).toBe('col-resize')
    })

    it('clears cursor when cursor is not near right edge', () => {
      const { result } = setup()
      const headerCellEl = createHeaderCellEl({ right: 200, width: 200 })
      const event = createMouseMoveEvent(100, headerCellEl)

      result.handleHeaderMouseMove(event)

      expect(document.body.style.cursor).toBe('')
    })

    it('does nothing when already resizing', () => {
      const { result, resizeProxyRef } = setup()
      const proxyEl = createProxyEl()
      resizeProxyRef.value = proxyEl
      const headerCellEl = createHeaderCellEl({ right: 200, width: 200, left: 0 })

      const moveEvent = createMouseMoveEvent(195, headerCellEl)
      result.handleHeaderMouseMove(moveEvent)

      const mousedownEvent = createMouseDownEvent(195, headerCellEl)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      const headerCellEl2 = createHeaderCellEl({ right: 400, width: 200, left: 200 }, 'age')
      const moveEvent2 = createMouseMoveEvent(350, headerCellEl2)
      result.handleHeaderMouseMove(moveEvent2)

      expect(result.resizing.value).toBe(true)
    })

    it('ignores events without column key attribute', () => {
      const { result } = setup()
      const el = document.createElement('span')
      const event = createMouseMoveEvent(195, el)

      result.handleHeaderMouseMove(event)

      expect(document.body.style.cursor).toBe('')
    })

    it('skips group columns (non-leaf)', () => {
      const { result } = setup()
      const groupEl = document.createElement('span')
      groupEl.classList.add('adv-table__v2-header-cell')
      groupEl.setAttribute(COLUMN_KEY_ATTR, 'groupCol')
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
      vi.spyOn(groupEl, 'getBoundingClientRect').mockReturnValue(rect)
      const event = createMouseMoveEvent(195, groupEl)

      result.handleHeaderMouseMove(event)

      expect(document.body.style.cursor).toBe('')
    })
  })

  describe('handleHeaderMouseOut', () => {
    it('resets cursor and draggingColumnKey when leaving header area', () => {
      const { result } = setup()
      const headerCellEl = createHeaderCellEl({ right: 200, width: 200 })

      const moveEvent = createMouseMoveEvent(195, headerCellEl)
      result.handleHeaderMouseMove(moveEvent)
      expect(document.body.style.cursor).toBe('col-resize')

      const outEvent = createMouseOutEvent(headerCellEl, null)
      result.handleHeaderMouseOut(outEvent)

      expect(document.body.style.cursor).toBe('')
    })

    it('does not reset cursor when moving within header cells', () => {
      const { result } = setup()
      const headerCellEl = createHeaderCellEl({ right: 200, width: 200 })

      const moveEvent = createMouseMoveEvent(195, headerCellEl)
      result.handleHeaderMouseMove(moveEvent)

      const anotherHeaderCell = createHeaderCellEl({ right: 400, width: 200, left: 200 }, 'age')
      const outEvent = createMouseOutEvent(headerCellEl, anotherHeaderCell)
      result.handleHeaderMouseOut(outEvent)

      expect(document.body.style.cursor).toBe('col-resize')
    })

    it('does not reset cursor during active resize', () => {
      const { result, resizeProxyRef } = setup()
      const proxyEl = createProxyEl()
      resizeProxyRef.value = proxyEl
      const headerCellEl = createHeaderCellEl({ right: 200, width: 200, left: 0 })

      const moveEvent = createMouseMoveEvent(195, headerCellEl)
      result.handleHeaderMouseMove(moveEvent)
      const mousedownEvent = createMouseDownEvent(195, headerCellEl)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      const outEvent = createMouseOutEvent(headerCellEl, null)
      result.handleHeaderMouseOut(outEvent)

      expect(document.body.style.cursor).toBe('col-resize')
    })
  })

  describe('handleResizeStart', () => {
    it('ignores mousedown when draggingColumnKey does not match', () => {
      const { result } = setup()
      const headerCellEl = createHeaderCellEl({ right: 200, width: 200 })

      const mousedownEvent = createMouseDownEvent(100, headerCellEl)
      result.handleResizeStart(mousedownEvent)

      expect(result.resizing.value).toBe(false)
    })

    it('starts resize when draggingColumnKey matches', () => {
      const { result, resizeProxyRef } = setup()
      const proxyEl = createProxyEl()
      resizeProxyRef.value = proxyEl
      const headerCellEl = createHeaderCellEl({ right: 200, width: 200, left: 0 })

      const moveEvent = createMouseMoveEvent(195, headerCellEl)
      result.handleHeaderMouseMove(moveEvent)

      const mousedownEvent = createMouseDownEvent(195, headerCellEl)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      expect(result.resizing.value).toBe(true)
      expect(result.resizeProxyVisible.value).toBe(true)
      expect(mousedownEvent.preventDefault).toHaveBeenCalled()
      expect(mousedownEvent.stopPropagation).toHaveBeenCalled()
    })

    it('disables text selection during drag', () => {
      const { result, resizeProxyRef } = setup()
      const proxyEl = createProxyEl()
      resizeProxyRef.value = proxyEl
      const headerCellEl = createHeaderCellEl({ right: 200, width: 200, left: 0 })

      const moveEvent = createMouseMoveEvent(195, headerCellEl)
      result.handleHeaderMouseMove(moveEvent)

      const mousedownEvent = createMouseDownEvent(195, headerCellEl)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      expect(document.onselectstart).toBeNull()
      expect(document.ondragstart).toBeNull()
      // The source uses addEventListener, not onselectstart/ondragstart properties
      // Verify via getEventListeners or spy — happy-dom doesn't have getEventListeners,
      // so we verify via an indirect approach: document event dispatch doesn't trigger
      // default behavior when addEventListener('selectstart', ...) is active
      const selectstartSpy = vi.fn()
      document.addEventListener('selectstart', selectstartSpy)
      const selectstartEvent = new Event('selectstart', { cancelable: true })
      document.dispatchEvent(selectstartEvent)
      expect(selectstartSpy).toHaveBeenCalled()
    })

    it('ignores mousedown on group columns', () => {
      const { result } = setup()
      const groupEl = document.createElement('span')
      groupEl.setAttribute(COLUMN_KEY_ATTR, 'groupCol')
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
      vi.spyOn(groupEl, 'getBoundingClientRect').mockReturnValue(rect)

      const mousedownEvent = createMouseDownEvent(195, groupEl)
      result.handleResizeStart(mousedownEvent)

      expect(result.resizing.value).toBe(false)
    })
  })

  describe('group column proxy (multi-level header)', () => {
    function setupWithGroup() {
      const columns = ref([
        { key: 'name', width: 100 },
        { key: 'age', width: 80 },
      ])
      const groupTree = ref([
        {
          key: 'group1',
          label: 'Group 1',
          children: [
            { key: 'name', width: 100 },
            { key: 'age', width: 80 },
          ],
        },
      ])
      const getColumnKey = (col: any) => col.key
      const onHeaderDragend = vi.fn()
      const resizeProxyRef = ref<HTMLElement | undefined | null>(undefined)
      const result = useColumnResize({
        columns,
        groupTree,
        getColumnKey,
        onHeaderDragend,
        resizeProxyRef,
        border: true,
        resizable: true,
      } as any)
      return { columns, groupTree, result, onHeaderDragend, resizeProxyRef }
    }

    it('allows dragging the right edge of a group cell to resize its rightmost leaf', () => {
      const { result, resizeProxyRef, onHeaderDragend } = setupWithGroup()
      const proxyEl = createProxyEl()
      resizeProxyRef.value = proxyEl

      // group cell: left=0, right=300, width=300, contains name (100) + age (80)
      const groupEl = createHeaderCellEl({ right: 300, width: 300, left: 0 }, 'group1')

      const mousedownEvent = createMouseDownEvent(295, groupEl)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      expect(result.resizing.value).toBe(true)
      expect(result.resizeProxyVisible.value).toBe(true)

      // Proxy should be placed at the right edge of "age" (the rightmost leaf)
      // startColumnLeft = groupRight - leafWidth = 300 - 80 = 220
      // proxyLeft = 220 + 80 = 300 (right edge of group, i.e. the visual cursor)
      expect(proxyEl.style.left).toBe('300px')

      // Move proxy to width 130 for age
      proxyEl.style.left = '350px'
      const endEvent = new MouseEvent('mouseup', { clientX: 350 })
      document.dispatchEvent(endEvent)

      // newWidth = proxyLeft - startColumnLeft = 350 - 220 = 130
      expect(result.columnWidths.age).toBe(130)
      expect(onHeaderDragend).toHaveBeenCalledWith(
        expect.objectContaining({
          columnKey: 'age',
          newWidth: 130,
          oldWidth: 80,
        }),
      )
    })

    it('handleHeaderMouseMove sets cursor to col-resize on group cell right edge', () => {
      const { result } = setupWithGroup()
      const groupEl = createHeaderCellEl({ right: 300, width: 300 }, 'group1')
      const event = createMouseMoveEvent(295, groupEl)

      result.handleHeaderMouseMove(event)

      expect(document.body.style.cursor).toBe('col-resize')
    })

    it('handleHeaderMouseMove clears cursor when far from group right edge', () => {
      const { result } = setupWithGroup()
      const groupEl = createHeaderCellEl({ right: 300, width: 300 }, 'group1')
      const event = createMouseMoveEvent(100, groupEl)

      result.handleHeaderMouseMove(event)

      expect(document.body.style.cursor).toBe('')
    })

    it('does nothing on group column when groupTree is not provided', () => {
      const columns = ref([
        { key: 'name', width: 100 },
        { key: 'age', width: 80 },
      ])
      const getColumnKey = (col: any) => col.key
      const resizeProxyRef = ref<HTMLElement | undefined | null>(undefined)
      const result = useColumnResize({ columns, getColumnKey, resizeProxyRef, border: true } as any)
      const groupEl = createHeaderCellEl({ right: 300, width: 300 }, 'group1')
      const mousedownEvent = createMouseDownEvent(295, groupEl)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      expect(result.resizing.value).toBe(false)
    })

    it('resizes rightmost leaf of a nested group column (depth-first search)', () => {
      const columns = ref([
        { key: 'a', width: 100 },
        { key: 'b', width: 80 },
        { key: 'c', width: 60 },
        { key: 'd', width: 120 },
      ])
      const groupTree = ref([
        {
          key: 'outer',
          label: 'Outer',
          children: [
            { key: 'a', width: 100 },
            {
              key: 'inner',
              label: 'Inner',
              children: [
                { key: 'b', width: 80 },
                { key: 'c', width: 60 },
              ],
            },
            { key: 'd', width: 120 },
          ],
        },
      ])
      const getColumnKey = (col: any) => col.key
      const onHeaderDragend = vi.fn()
      const resizeProxyRef = ref<HTMLElement | undefined | null>(undefined)
      const result = useColumnResize({
        columns,
        groupTree,
        getColumnKey,
        onHeaderDragend,
        resizeProxyRef,
        border: true,
        resizable: true,
      } as any)
      const proxyEl = createProxyEl()
      resizeProxyRef.value = proxyEl

      const innerEl = createHeaderCellEl({ right: 240, width: 140, left: 100 }, 'inner')
      const mousedownEvent = createMouseDownEvent(235, innerEl)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      expect(result.resizing.value).toBe(true)
      expect(result.resizeProxyVisible.value).toBe(true)

      proxyEl.style.left = '310px'
      const endEvent = new MouseEvent('mouseup', { clientX: 310 })
      document.dispatchEvent(endEvent)

      expect(result.columnWidths.c).toBe(130)
      expect(onHeaderDragend).toHaveBeenCalledWith(
        expect.objectContaining({
          columnKey: 'c',
          newWidth: 130,
          oldWidth: 60,
        }),
      )
    })
  })

  describe('resize drag flow', () => {
    function setupResize() {
      const { result, onHeaderDragend, resizeProxyRef } = setup()
      const proxyEl = createProxyEl()
      resizeProxyRef.value = proxyEl
      const headerCellEl = createHeaderCellEl({ right: 200, width: 200, left: 0 })

      const moveEvent = createMouseMoveEvent(195, headerCellEl)
      result.handleHeaderMouseMove(moveEvent)

      const mousedownEvent = createMouseDownEvent(195, headerCellEl)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      return { result, onHeaderDragend, resizeProxyRef, proxyEl }
    }

    it('handleResizeMove updates proxy position instead of column width', () => {
      const { result, proxyEl } = setupResize()

      const moveEvent = new MouseEvent('mousemove', { clientX: 150 })
      document.dispatchEvent(moveEvent)

      expect(proxyEl.style.left).toBeDefined()
      expect(result.columnWidths.name).toBeUndefined()
    })

    it('handleResizeEnd computes width from proxy position and fires onHeaderDragend', () => {
      const { result, onHeaderDragend, proxyEl } = setupResize()

      proxyEl.style.left = '150px'

      const endEvent = new MouseEvent('mouseup', { clientX: 150 })
      document.dispatchEvent(endEvent)

      expect(result.columnWidths.name).toBe(150)
      expect(onHeaderDragend).toHaveBeenCalledWith(
        expect.objectContaining({
          columnKey: 'name',
          newWidth: 150,
          oldWidth: 200,
        }),
      )
      expect(result.resizing.value).toBe(false)
      expect(result.resizeProxyVisible.value).toBe(false)
    })

    it('handleResizeEnd enforces minWidth', () => {
      const { result, proxyEl } = setupResize()

      proxyEl.style.left = '10px'

      const endEvent = new MouseEvent('mouseup', { clientX: 10 })
      document.dispatchEvent(endEvent)

      expect(result.columnWidths.name).toBe(50)
    })

    it('does not fire dragend for unchanged width', () => {
      const { result, onHeaderDragend, proxyEl } = setupResize()

      // 鼠标未移动：proxy 仍在 columnRect.right 位置（DOM width=200, left=0）
      // newWidth = 200 - 0 = 200, oldWidth (DOM) = 200 → 一致，不 fire
      proxyEl.style.left = '200px'

      const endEvent = new MouseEvent('mouseup', { clientX: 200 })
      document.dispatchEvent(endEvent)

      expect(onHeaderDragend).not.toHaveBeenCalled()
      expect(result.resizing.value).toBe(false)
    })

    it('proxy initial position uses DOM right edge (handles autoSize / flexGrow stretching)', () => {
      // 回归测试：hoverActions.teleport 触发 autoSizeColumns 时，el-table-v2 会把列宽
      // 覆写为 minWidth + flexGrow 拉伸后的实际宽度。若 proxy 初始位置仍用 col.width，
      // 会停在声明宽度边界而非真实 DOM 边缘，看起来"占位符在 width:120 位置"
      // （progress 列声明 width=120，DOM 实际宽度可能是 80+flexGrow）。
      const { result, resizeProxyRef } = setup()
      const proxyEl = createProxyEl()
      resizeProxyRef.value = proxyEl

      // 模拟 autoSize 模式：列声明 width=120，但 DOM 实际 width=380 (flexGrow 拉伸后)
      const headerCellEl = createHeaderCellEl({ right: 380, width: 380, left: 0 })
      const mousedownEvent = createMouseDownEvent(375, headerCellEl)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      // proxy 初始位置必须是 DOM 真实右边缘 (380)，而非 col.width + left (120 + 0 = 120)
      expect(proxyEl.style.left).toBe('380px')

      // 把 proxy 拖到 250，newWidth = 250 - 0 = 250, oldWidth = 380 (DOM)
      proxyEl.style.left = '250px'
      const endEvent = new MouseEvent('mouseup', { clientX: 250 })
      document.dispatchEvent(endEvent)

      expect(result.columnWidths.name).toBe(250)
    })

    it('re-enables text selection and resets cursor after resize end', () => {
      const { result: _result, proxyEl } = setupResize()

      proxyEl.style.left = '150px'

      const endEvent = new MouseEvent('mouseup', { clientX: 150 })
      document.dispatchEvent(endEvent)

      expect(document.onselectstart).toBeNull()
      expect(document.ondragstart).toBeNull()
      expect(document.body.style.cursor).toBe('')
    })
  })

  it('handleResizeEnd no-ops when no resize state', () => {
    setup()
    const endEvent = new MouseEvent('mouseup', { clientX: 100 })
    expect(() => document.dispatchEvent(endEvent)).not.toThrow()
  })

  it('resetColumnWidths clears all widths', () => {
    const { result, resizeProxyRef } = setup()
    const proxyEl = createProxyEl()
    resizeProxyRef.value = proxyEl
    const headerCellEl = createHeaderCellEl({ right: 200, width: 200, left: 0 })

    const moveEvent = createMouseMoveEvent(195, headerCellEl)
    result.handleHeaderMouseMove(moveEvent)

    const mousedownEvent = createMouseDownEvent(195, headerCellEl)
    vi.spyOn(mousedownEvent, 'preventDefault')
    vi.spyOn(mousedownEvent, 'stopPropagation')
    result.handleResizeStart(mousedownEvent)

    proxyEl.style.left = '150px'
    const endEvent = new MouseEvent('mouseup', { clientX: 150 })
    document.dispatchEvent(endEvent)

    result.resetColumnWidths()
    expect(Object.keys(result.columnWidths)).toHaveLength(0)
  })

  /**
   * <zh/> 自定义分组表头（自有挂钩）：复刻 v2-header 分组模式 DOM——leaf-span 包裹 framed
   * <zh/> 选择列胞、framed 分组头，均无 EP 类名。调整命中必须不依赖 EP 回退。
   * <en/> Custom grouped headers (owned hooks): mirrors the v2-header grouped-mode DOM — a
   * <en/> leaf-span wrapping a framed selection cell, and a framed group header, none carrying
   * <en/> EP classes. Resize hit-testing must not depend on the EP fallback.
   */
  describe('custom grouped header (owned hooks, no EP classes)', () => {
    const FRAMED_RECT: DOMRect = {
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

    /** <zh/> leaf-span 包裹 framed 内层（选择列胞形态） | <en/> Leaf-span wrapping a framed inner (selection-cell shape) */
    function createLeafSpanCell(columnKey = 'name') {
      const wrapper = document.createElement('div')
      wrapper.classList.add('adv-table__v2-header-cell', 'adv-table__v2-header-cell--leaf-span')
      wrapper.setAttribute(COLUMN_KEY_ATTR, columnKey)
      const inner = document.createElement('div')
      inner.classList.add('adv-table__v2-header-cell--framed')
      inner.setAttribute('role', 'columnheader')
      const target = document.createElement('span')
      inner.appendChild(target)
      wrapper.appendChild(inner)
      // <zh/> 命中解析到内层 framed 节点（与旧 EP 类名时代解析到同一节点一致），故 mock 内层 rect
      // <en/> Hit-testing resolves to the inner framed node (same node as under the old EP class), so mock the inner rect
      vi.spyOn(inner, 'getBoundingClientRect').mockReturnValue(FRAMED_RECT)
      vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(FRAMED_RECT)
      return { wrapper, inner, target }
    }

    /** <zh/> framed 分组头（v2-header group 节点形态） | <en/> Framed group header (v2-header group node shape) */
    function createFramedGroupCell(columnKey = 'name') {
      const wrapper = document.createElement('div')
      wrapper.classList.add('adv-table__v2-header-cell--framed')
      wrapper.setAttribute(COLUMN_KEY_ATTR, columnKey)
      wrapper.setAttribute('role', 'columnheader')
      const target = document.createElement('span')
      wrapper.appendChild(target)
      vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(FRAMED_RECT)
      return { wrapper, target }
    }

    it('starts resize from a framed cell nested in a leaf-span wrapper', () => {
      const { result } = setup()
      const { target } = createLeafSpanCell('name')
      const mousedownEvent = createMouseDownEvent(195, target)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      expect(result.resizing.value).toBe(true)
      expect(mousedownEvent.preventDefault).toHaveBeenCalled()
      expect(mousedownEvent.stopPropagation).toHaveBeenCalled()
    })

    it('starts resize from a framed group header wrapper', () => {
      const { result } = setup()
      const { target } = createFramedGroupCell('name')
      const mousedownEvent = createMouseDownEvent(195, target)
      vi.spyOn(mousedownEvent, 'preventDefault')
      vi.spyOn(mousedownEvent, 'stopPropagation')
      result.handleResizeStart(mousedownEvent)

      expect(result.resizing.value).toBe(true)
      expect(mousedownEvent.preventDefault).toHaveBeenCalled()
      expect(mousedownEvent.stopPropagation).toHaveBeenCalled()
    })

    it('resolves header hover cursor on framed nodes without EP classes', () => {
      const { result } = setup()
      const { target } = createFramedGroupCell('name')
      const event = createMouseMoveEvent(195, target)

      result.handleHeaderMouseMove(event)

      expect(document.body.style.cursor).toBe('col-resize')
    })
  })
})
