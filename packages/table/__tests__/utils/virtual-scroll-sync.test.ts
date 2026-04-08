import { describe, expect, it } from 'vitest'
import { detectVirtualScrollDesync, findVirtualScrollWindow } from '../../src/utils/virtual-scroll-sync'

describe('virtual-scroll-sync', () => {
  const ROW_HEIGHT = 48

  /**
   * 健康状态：网格在可视窗口上下各渲染 cache 行（默认 2 行），
   * 首行偏移恒 ≤ domScrollTop，末行底边恒 ≥ 视口底部。
   */
  function healthySnapshot(overrides: Partial<Parameters<typeof detectVirtualScrollDesync>[0]> = {}) {
    // scrolled so that row 10 is at the top: domScrollTop = 480
    // cache 2 rows above → first rendered row 8 at top 384
    // cache 2 rows below the stop index → last row bottom well past the viewport bottom
    const domScrollTop = 480
    const clientHeight = 720
    return {
      domScrollTop,
      clientHeight,
      firstRowTop: domScrollTop - 96, // row 8 (2 rows of cache above)
      lastRowTop: domScrollTop + 720, // covers viewport + cache below
      lastRowHeight: ROW_HEIGHT,
      ...overrides,
    }
  }

  it('should return null for a healthy synchronized state', () => {
    expect(detectVirtualScrollDesync(healthySnapshot(), ROW_HEIGHT)).toBeNull()
  })

  it('should return null at the top of the table (no scroll)', () => {
    expect(detectVirtualScrollDesync(healthySnapshot({ domScrollTop: 0, firstRowTop: 0 }), ROW_HEIGHT)).toBeNull()
  })

  it('should return null at the bottom of the table (max scroll)', () => {
    const totalHeight = 480 + 720 + 96
    expect(detectVirtualScrollDesync(
      healthySnapshot({ domScrollTop: totalHeight - 720, lastRowTop: totalHeight - 48, lastRowHeight: ROW_HEIGHT }),
      ROW_HEIGHT,
    )).toBeNull()
  })

  it('should detect top blank when the render window is shifted down by 3 rows (10→13 case)', () => {
    // 原本展示 10-25，弹窗关闭后内部滚动状态前进 3 行：首行偏移 480+144-96=528，DOM 仍为 480
    const snapshot = healthySnapshot({ firstRowTop: 480 + 144 - 96 })
    expect(detectVirtualScrollDesync(snapshot, ROW_HEIGHT)).toBe('top')
  })

  it('should detect top blank for larger desync bands', () => {
    const snapshot = healthySnapshot({ firstRowTop: 480 + 480 - 96 })
    expect(detectVirtualScrollDesync(snapshot, ROW_HEIGHT)).toBe('top')
  })

  it('should detect bottom blank when the render window is shifted up', () => {
    // 内部滚动状态落后 3 行：末行底边距视口底部 96px
    const snapshot = healthySnapshot({ lastRowTop: 480 + 720 - 144 - 48, lastRowHeight: ROW_HEIGHT })
    expect(detectVirtualScrollDesync(snapshot, ROW_HEIGHT)).toBe('bottom')
  })

  it('should not flag top drift within the cache margin', () => {
    // <zh/> 2 行上移失步：首行仍落在视口内，不产生顶部空白，不应误报
    const topTolerated = healthySnapshot({ firstRowTop: 480 + 96 - 96 })
    expect(detectVirtualScrollDesync(topTolerated, ROW_HEIGHT)).toBeNull()
  })

  it('should flag bottom drift of 2 rows (48px blank band at the viewport bottom)', () => {
    const bottomTolerated = healthySnapshot({ lastRowTop: 480 + 720 - 96 - 48, lastRowHeight: ROW_HEIGHT })
    expect(detectVirtualScrollDesync(bottomTolerated, ROW_HEIGHT)).toBe('bottom')
  })

  it('should consider the last row height when measuring the bottom edge', () => {
    // 动态行高：末行高度 96，底边仍覆盖视口
    const snapshot = healthySnapshot({ lastRowTop: 480 + 768 - 96, lastRowHeight: 96 })
    expect(detectVirtualScrollDesync(snapshot, ROW_HEIGHT)).toBeNull()
  })

  it('should return null for invalid inputs', () => {
    expect(detectVirtualScrollDesync(healthySnapshot(), 0)).toBeNull()
    expect(detectVirtualScrollDesync(healthySnapshot(), Number.NaN)).toBeNull()
    expect(detectVirtualScrollDesync(healthySnapshot({ domScrollTop: Number.NaN }), ROW_HEIGHT)).toBeNull()
    expect(detectVirtualScrollDesync(healthySnapshot({ clientHeight: 0 }), ROW_HEIGHT)).toBeNull()
  })

  describe('findVirtualScrollWindow', () => {
    // jsdom 不做布局计算，scrollHeight 恒等于 clientHeight，需手动模拟真实布局值
    function makeScrollable(el: HTMLElement, scrollHeight: number) {
      Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
    }

    function makeWrapper() {
      const wrapper = document.createElement('div')
      wrapper.style.height = '470px'
      wrapper.style.overflow = 'visible'
      // 不可滚动：scrollHeight === clientHeight
      const nonScrollable = document.createElement('div')
      nonScrollable.style.height = '470px'
      nonScrollable.style.overflow = 'hidden'
      wrapper.appendChild(nonScrollable)
      // 真正可滚动的 window：scrollHeight > clientHeight
      const windowEl = document.createElement('div')
      windowEl.style.height = '470px'
      windowEl.style.overflow = 'hidden'
      makeScrollable(windowEl, 96000)
      const inner = document.createElement('div')
      inner.style.height = '96000px'
      windowEl.appendChild(inner)
      wrapper.appendChild(windowEl)
      const scrollbar = document.createElement('div')
      scrollbar.style.height = '6px'
      wrapper.appendChild(scrollbar)
      return { wrapper, windowEl, inner }
    }

    it('should find the scrollable window inside the body wrapper', () => {
      const { wrapper, windowEl } = makeWrapper()
      expect(findVirtualScrollWindow(wrapper)).toBe(windowEl)
    })

    it('should return null when nothing is scrollable', () => {
      const wrapper = document.createElement('div')
      const fixed = document.createElement('div')
      fixed.style.height = '470px'
      fixed.style.overflow = 'hidden'
      wrapper.appendChild(fixed)
      expect(findVirtualScrollWindow(wrapper)).toBeNull()
    })

    it('should ignore the wrapper itself and nested row divs', () => {
      const { wrapper, windowEl, inner } = makeWrapper()
      const row = document.createElement('div')
      row.style.height = '48px'
      inner.appendChild(row)
      expect(findVirtualScrollWindow(wrapper)).toBe(windowEl)
    })

    it('should return the cached window on repeat calls', () => {
      const { wrapper, windowEl } = makeWrapper()
      expect(findVirtualScrollWindow(wrapper)).toBe(windowEl)
      expect(findVirtualScrollWindow(wrapper)).toBe(windowEl)
    })

    it('should invalidate the cache when the window leaves the DOM', () => {
      const { wrapper, windowEl } = makeWrapper()
      expect(findVirtualScrollWindow(wrapper)).toBe(windowEl)
      // EP 重建网格：旧滚动容器被移除，替换为新容器
      wrapper.removeChild(windowEl)
      const replacement = document.createElement('div')
      replacement.style.height = '470px'
      replacement.style.overflow = 'hidden'
      makeScrollable(replacement, 48000)
      replacement.appendChild(document.createElement('div'))
      wrapper.appendChild(replacement)
      expect(findVirtualScrollWindow(wrapper)).toBe(replacement)
    })

    it('should re-discover a scrollable node that appeared after a null result', () => {
      const wrapper = document.createElement('div')
      const fixed = document.createElement('div')
      fixed.style.height = '470px'
      fixed.style.overflow = 'hidden'
      wrapper.appendChild(fixed)
      // 首次无滚动内容 → null 不缓存
      expect(findVirtualScrollWindow(wrapper)).toBeNull()
      // 数据加载后出现可滚动节点，应能被发现
      const windowEl = document.createElement('div')
      windowEl.style.height = '470px'
      windowEl.style.overflow = 'hidden'
      makeScrollable(windowEl, 96000)
      wrapper.appendChild(windowEl)
      expect(findVirtualScrollWindow(wrapper)).toBe(windowEl)
    })
  })
})
