import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useGridNavigation } from '../../src/composables/interaction/use-grid-navigation'
import { DEFAULT_RENDERER_CAPS, VIRTUAL_RENDERER_CAPS } from '../../src/types/renderer-caps'

/**
 * <zh/> 方向键网格导航测试——真实 DOM + 真实 focus()，断言 activeElement 迁移、
 * <zh/> 编辑器守卫、修饰键忽略、virtual 未渲染行的滚动委托与单次重试聚焦。
 *
 * <en/> Grid arrow-key navigation tests — real DOM with real focus(), asserting
 * <en/> activeElement migration, editor guard, modifier-key ignore, and the virtual path's
 * <en/> scroll delegation plus its single retry-focus.
 */
function buildGrid(rowCount: number, colCount: number): { container: HTMLElement, cells: HTMLElement[][] } {
  const container = document.createElement('div')
  const cells: HTMLElement[][] = []
  for (let r = 0; r < rowCount; r++) {
    cells[r] = []
    for (let c = 0; c < colCount; c++) {
      const span = document.createElement('span')
      span.setAttribute('data-adv-cell-row', String(r))
      span.setAttribute('data-adv-cell-col', String(c))
      container.appendChild(span)
      cells[r][c] = span
    }
  }
  document.body.appendChild(container)
  return { container, cells }
}

function pressKey(target: HTMLElement, key: string, init: KeyboardEventInit = {}): void {
  target.focus()
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
}

function setup(container: HTMLElement, over: Record<string, any> = {}) {
  const scrollToRow = vi.fn(() => true)
  const scrollToColumn = vi.fn(() => true)
  const containerRef = ref<HTMLElement | null>(container)
  const nav = useGridNavigation({
    containerRef,
    enabled: true,
    // <zh/> 能力查询取代模式判断——默认非行虚拟化，个别用例经 over 覆盖
    // <en/> Capability query replaces the mode check — non-virtualized by default, overridden per case
    caps: DEFAULT_RENDERER_CAPS,
    ...over,
    scrollToRow: () => scrollToRow,
    scrollToColumn: () => scrollToColumn,
  })
  return { nav, scrollToRow, scrollToColumn }
}

describe('useGridNavigation', () => {
  it('maps logical columns to DOM attributes for entry, arrows, Home and End', () => {
    const { container, cells } = buildGrid(2, 4)
    setup(container, { columnIndexes: () => [3, 1, 2], columnCount: 3, rowCount: 2 })
    pressKey(container, 'Tab')
    expect(document.activeElement).toBe(cells[0][3])
    pressKey(cells[0][3], 'ArrowRight')
    expect(document.activeElement).toBe(cells[0][1])
    pressKey(cells[0][1], 'End')
    expect(document.activeElement).toBe(cells[0][2])
    pressKey(cells[0][2], 'Home')
    expect(document.activeElement).toBe(cells[0][3])
  })

  it('passes DOM coordinates to range extension after logical navigation', () => {
    const { container, cells } = buildGrid(1, 4)
    const extendTo = vi.fn()
    setup(container, {
      columnIndexes: () => [3, 1, 2],
      columnCount: 3,
      rowCount: 1,
      keyboardRange: { extendTo, finishSelection: vi.fn() },
    })
    pressKey(cells[0][3], 'ArrowRight', { shiftKey: true })
    expect(extendTo.mock.calls).toEqual([
      [{ rowIndex: 0, columnIndex: 3 }],
      [{ rowIndex: 0, columnIndex: 1 }],
    ])
  })

  it('never scrolls beyond declared boundaries or from invalid coordinates', () => {
    const { container, cells } = buildGrid(2, 2)
    const s = setup(container, { caps: VIRTUAL_RENDERER_CAPS, columnCount: 2, rowCount: 2 })
    pressKey(cells[1][1], 'ArrowDown')
    pressKey(cells[1][1], 'ArrowRight')
    cells[0][0].setAttribute('data-adv-cell-row', 'NaN')
    pressKey(cells[0][0], 'ArrowDown')
    expect(s.scrollToRow).not.toHaveBeenCalled()
    expect(s.scrollToColumn).not.toHaveBeenCalled()
  })

  it('skips synthetic display rows on entry, arrows and table-edge jumps', () => {
    const { container, cells } = buildGrid(5, 1)
    setup(container, { rowCount: 5, columnCount: 1, isRowNavigable: (index: number) => index === 1 || index === 3 })
    pressKey(container, 'Tab')
    expect(document.activeElement).toBe(cells[1][0])
    pressKey(cells[1][0], 'ArrowDown')
    expect(document.activeElement).toBe(cells[3][0])
    pressKey(cells[3][0], 'Home', { ctrlKey: true })
    expect(document.activeElement).toBe(cells[1][0])
    pressKey(cells[1][0], 'End', { ctrlKey: true })
    expect(document.activeElement).toBe(cells[3][0])
  })

  it('leaves Tab alone in an empty grid and on reverse entry', () => {
    const { container } = buildGrid(0, 0)
    const s = setup(container, { caps: VIRTUAL_RENDERER_CAPS, rowCount: 0, columnCount: 0 })
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    container.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(s.scrollToRow).not.toHaveBeenCalled()
    const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    container.dispatchEvent(reverse)
    expect(reverse.defaultPrevented).toBe(false)
  })

  it('moves focus right / down / left / up via arrow keys', () => {
    const { container, cells } = buildGrid(3, 3)
    setup(container)

    pressKey(cells[1][1], 'ArrowRight')
    expect(document.activeElement).toBe(cells[1][2])

    pressKey(cells[1][2], 'ArrowDown')
    expect(document.activeElement).toBe(cells[2][2])

    pressKey(cells[2][2], 'ArrowLeft')
    expect(document.activeElement).toBe(cells[2][1])

    pressKey(cells[2][1], 'ArrowUp')
    expect(document.activeElement).toBe(cells[1][1])
  })

  it('prevents default only when navigation is handled', () => {
    const { container, cells } = buildGrid(2, 2)
    setup(container)

    const blocked = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    cells[0][0].focus()
    cells[0][0].dispatchEvent(blocked)
    expect(blocked.defaultPrevented).toBe(true)

    // <zh/> 边界外（row=-1）不处理 | <en/> out-of-bounds (row=-1) is not handled
    const atEdge = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
    cells[0][0].dispatchEvent(atEdge)
    expect(atEdge.defaultPrevented).toBe(false)
  })

  it('never hijacks keys while an editor/input owns focus', () => {
    const { container, cells } = buildGrid(2, 2)
    const input = document.createElement('input')
    container.appendChild(input)
    setup(container)

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    input.focus()
    input.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    void cells
  })

  it('ignores Shift+Arrow when no keyboard bridge is injected (no handler fighting)', () => {
    const { container, cells } = buildGrid(2, 2)
    setup(container)

    const shifted = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true })
    cells[0][0].focus()
    cells[0][0].dispatchEvent(shifted)
    expect(shifted.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(cells[0][0])
  })

  it('delegates scrolling and retries focus once for unrendered virtual rows', async () => {
    const { container, cells } = buildGrid(2, 2)
    // <zh/> 目标行(5)未在 DOM 中——行虚拟化窗口外
    // <en/> Target row (5) is not in the DOM — outside the row-virtualization window
    const s = setup(container, { caps: VIRTUAL_RENDERER_CAPS, scopeSelector: undefined })

    pressKey(cells[0][0], 'ArrowDown') // → row 1 exists
    expect(document.activeElement).toBe(cells[1][0])

    pressKey(cells[1][0], 'ArrowDown') // → row 2 missing
    await nextTick()
    await nextTick()

    // <zh/> 已委托滚动；目标行仍不存在（替身不渲染新行）→ 焦点保持原位，无异常
    // <en/> Scrolling was delegated; target row still absent (stub renders nothing) → focus unchanged, no crash
    expect(s.scrollToRow).toHaveBeenCalledWith(2)
    expect(document.activeElement).toBe(cells[1][0])
    void cells
  })

  it('navigates home to the first column of the current row', () => {
    const { container, cells } = buildGrid(2, 3)
    setup(container)

    pressKey(cells[1][2], 'Home')
    expect(document.activeElement).toBe(cells[1][0])
  })

  it('applies roving tabindex so the focused cell becomes the a11y tab stop', () => {
    const { container, cells } = buildGrid(2, 2)
    setup(container)
    expect(container.getAttribute('tabindex')).toBe('0')

    // <zh/> 从 (0,1) 用 ArrowDown 换行——2 列网格中 ArrowRight 会被钳制在原格，焦点不移动
    // <en/> ArrowDown moves rows from (0,1); ArrowRight would clamp in place in a 2-col grid so focus never moves
    pressKey(cells[0][1], 'ArrowDown')
    expect(document.activeElement).toBe(cells[1][1])
    expect(document.activeElement!.getAttribute('tabindex')).toBe('0')
    // <zh/> 旧焦点格必须交还 tabindex（不得残留 0 造成多个 Tab 停靠点）
    // <en/> the previous cell must hand back tabindex (never leave a second '0' tab stop)
    expect(cells[0][1].getAttribute('tabindex')).not.toBe('0')
  })

  it('shift+Arrow extends the range selection through the injected keyboard bridge', () => {
    const { container, cells } = buildGrid(3, 3)
    const extendTo = vi.fn()
    const finishSelection = vi.fn()
    const rangeSelection = { extendTo, finishSelection }
    const s = { ...setup(container, { keyboardRange: rangeSelection }) }
    void s

    cells[0][0].focus()
    cells[0][0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true }))
    expect(extendTo).toHaveBeenNthCalledWith(1, { rowIndex: 0, columnIndex: 0 })
    expect(extendTo).toHaveBeenNthCalledWith(2, { rowIndex: 1, columnIndex: 0 })
    expect(document.activeElement).toBe(cells[1][0])

    // <zh/> Shift 松开提交选区——keyup 需在容器子树上派发（捕获监听绑定于容器）
    // <en/> committing on Shift release — dispatch within the container subtree (capture listener bound on the container)
    cells[1][0].dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))
    expect(finishSelection).toHaveBeenCalled()
  })
})
