import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useScrollReconcile } from '../../src/components/table-virtual-renderer/use-scroll-reconcile'

/**
 * <zh/> 拖拽暂停语义——skipWatchdog 为 true（含行拖拽中）时，
 * <zh/> 单次 reconcile 不得触碰宿主（DOM 读数在拖拽中为假象）。
 * <en/> Drag-pause semantics — with skipWatchdog true (incl. mid-row-drag),
 * <en/> a single reconcile must never touch the host (DOM readings are artifacts mid-drag).
 */
function createReconcile(skip: boolean) {
  const host = vi.fn(() => null)
  const api = useScrollReconcile({
    host,
    rowHeight: () => 48,
    measuredWidth: ref(800),
    measuredHeight: ref(400),
    data: () => [],
    skipWatchdog: () => skip,
  })
  return { api, host }
}

function flushRaf(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      setTimeout(resolve, 20)
      return
    }
    requestAnimationFrame(() => {
      setTimeout(resolve, 0)
    })
  })
}

describe('useScrollReconcile drag pause', () => {
  it('does not touch the host when skipped', async () => {
    const { api, host } = createReconcile(true)
    api.scheduleReconcile()
    await flushRaf()
    await flushRaf()
    expect(host).not.toHaveBeenCalled()
  })

  it('reads the host when not skipped', async () => {
    const { api, host } = createReconcile(false)
    api.scheduleReconcile()
    await flushRaf()
    await flushRaf()
    expect(host).toHaveBeenCalled()
  })
})

describe('useScrollReconcile scroll-settle capture', () => {
  /**
   * <zh/> 搭建带根/滚动子节点的 DOM——滚动不冒泡，根上 capture 监听必须截获后代滚动
   * <en/> Build root/scroller DOM — scroll never bubbles, so the root capture listener must intercept descendant scrolling
   */
  function createRootHost() {
    const root = document.createElement('div')
    const scroller = document.createElement('div')
    root.appendChild(scroller)
    document.body.appendChild(root)
    const host = vi.fn(() => ({ $el: root }) as any)
    return { root, scroller, host }
  }

  function createSettleReconcile(host: () => any, skip: boolean) {
    return useScrollReconcile({
      host,
      rowHeight: () => 48,
      measuredWidth: ref(800),
      measuredHeight: ref(400),
      data: () => [],
      skipWatchdog: () => skip,
    })
  }

  it('schedules a reconcile after scroll settles (demo silent-rewrite path)', async () => {
    const { root, scroller, host } = createRootHost()
    try {
      const api = createSettleReconcile(host, false)
      // <zh/> 首次调度完成挂载捕获器（onMounted 在单测 setup 外不执行，走调度入口幂等挂载）
      // <en/> The first schedule attaches the capture listener (onMounted never runs outside a setup, so attach via the scheduling entry)
      api.scheduleReconcile()
      await flushRaf()
      host.mockClear()
      // <zh/> 模拟"EP 监听被阻断的直写"：事件照常派发，capture 监听独立感知
      // <en/> Simulate the "blocked-EP direct write": the event still dispatches, the capture listener senses it independently
      scroller.dispatchEvent(new Event('scroll', { bubbles: false }))
      // <zh/> 静默期内零检测开销：防抖窗口（120ms）未到，不碰宿主
      // <en/> Zero detection cost inside the settle window: the debounce window (120ms) has not elapsed, the host stays untouched
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(host).not.toHaveBeenCalled()
      // <zh/> settle 后单次验证运行（连带刷新对齐基线）
      // <en/> The single post-settle check runs (refreshing the alignment baseline along the way)
      await new Promise(resolve => setTimeout(resolve, 250))
      await flushRaf()
      await flushRaf()
      expect(host).toHaveBeenCalled()
    }
    finally {
      root.remove()
    }
  }, 10000)

  it('ignores scroll events when skipped', async () => {
    const { root, scroller, host } = createRootHost()
    try {
      const api = createSettleReconcile(host, true)
      api.scheduleReconcile()
      await flushRaf()
      scroller.dispatchEvent(new Event('scroll', { bubbles: false }))
      await new Promise(resolve => setTimeout(resolve, 250))
      await flushRaf()
      expect(host).not.toHaveBeenCalled()
    }
    finally {
      root.remove()
    }
  }, 10000)
})
