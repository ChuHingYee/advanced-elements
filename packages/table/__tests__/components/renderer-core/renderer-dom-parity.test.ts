import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createDefaultDomAdapter } from '../../../src/components/renderer-core/default-dom-adapter'
import { createVirtualDomAdapter } from '../../../src/components/renderer-core/virtual-dom-adapter'
import { useScrollReconcile } from '../../../src/components/table-virtual-renderer/use-scroll-reconcile'
import { mountTable } from '../__harness__/mount-table'

/**
 * <zh/> dom-convergence 渲染器层 DOM 收敛对等回归——迁移前后默认命名空间下行为逐字一致，
 * <zh/> 自定义命名空间下由“静默失配”变为“命中”（旧静态常量必然失配）。
 * <en/> dom-convergence renderer-layer DOM convergence parity — identical behavior under the default
 * <en/> namespace before/after migration; custom namespaces go from silent miss to hit.
 */

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

function mockLayout(el: HTMLElement, props: Partial<Record<'clientHeight' | 'scrollHeight' | 'scrollTop', number>>): void {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(el, key, { value, configurable: true, writable: true })
  }
}

describe('renderer-dom parity (dom-convergence)', () => {
  describe('getHeaderRowSelector', () => {
    it('matches the pre-migration selectors under the default namespace', () => {
      expect(createDefaultDomAdapter('el').getHeaderRowSelector()).toBe('.el-table__header-wrapper thead tr')
      expect(createVirtualDomAdapter('el').getHeaderRowSelector()).toBe('.el-table-v2__header-row')
    })

    it('is namespace-aware (old statics always missed)', () => {
      expect(createDefaultDomAdapter('custom').getHeaderRowSelector()).toBe('.custom-table__header-wrapper thead tr')
      expect(createVirtualDomAdapter('custom').getHeaderRowSelector()).toBe('.custom-table-v2__header-row')
    })
  })

  describe('mounted tables resolve adapter selectors (default namespace)', () => {
    it('default mode: header row resolves via the adapter', async () => {
      const mounted = await mountTable({ mode: 'default' })
      const root = mounted.wrapper.element as HTMLElement
      document.body.appendChild(root)
      try {
        const dom = createDefaultDomAdapter('el')
        expect(root.querySelector(dom.getHeaderRowSelector())).not.toBeNull()
        expect(root.querySelector(dom.getBodySelector())).not.toBeNull()
      }
      finally {
        mounted.wrapper.unmount()
        root.remove()
      }
      await nextTick()
    })

    it('virtual mode: header row resolves via the adapter', async () => {
      const mounted = await mountTable({ mode: 'virtual' })
      const root = mounted.wrapper.element as HTMLElement
      document.body.appendChild(root)
      try {
        const dom = createVirtualDomAdapter('el')
        expect(root.querySelector(dom.getHeaderRowSelector())).not.toBeNull()
        expect(root.querySelector(dom.getBodySelector())).not.toBeNull()
      }
      finally {
        mounted.wrapper.unmount()
        root.remove()
      }
      await nextTick()
    })
  })

  describe('scroll-reconcile via dom (dom-convergence)', () => {
    /**
     * <zh/> 构造 bottom 失步 DOM（镜像 virtual-scroll-sync.test.ts 口径）：
     * <zh/> domScrollTop=480、末行底边 1056 < 视口底部 1200 → 判定 'bottom' → 回写 scrollToTop(480)。
     * <en/> Builds a bottom-desync DOM: domScrollTop=480, last-row bottom 1056 < viewport bottom 1200.
     */
    function makeDesyncDom(ns: string) {
      const root = document.createElement('div')
      const main = document.createElement('div')
      main.className = `${ns}-table-v2__main`
      const bodyWrapper = document.createElement('div')
      bodyWrapper.className = `${ns}-table-v2__body`
      const win = document.createElement('div')
      const firstRow = document.createElement('div')
      firstRow.className = `${ns}-table-v2__row`
      firstRow.style.top = '384px'
      firstRow.style.height = '48px'
      const lastRow = document.createElement('div')
      lastRow.className = `${ns}-table-v2__row`
      lastRow.style.top = '1008px'
      lastRow.style.height = '48px'
      win.append(firstRow, lastRow)
      bodyWrapper.appendChild(win)
      main.appendChild(bodyWrapper)
      root.appendChild(main)
      mockLayout(bodyWrapper, { clientHeight: 400 })
      mockLayout(win, { clientHeight: 720, scrollHeight: 2000, scrollTop: 480 })
      return root
    }

    function makeReconcile(ns: string, root: HTMLElement, dom?: ReturnType<typeof createVirtualDomAdapter>) {
      const scrollToTop = vi.fn()
      const api = useScrollReconcile({
        host: () => ({ scrollToTop, $el: root }),
        rowHeight: () => 48,
        measuredWidth: ref(800),
        measuredHeight: ref(400),
        data: () => [],
        skipWatchdog: () => false,
        ...(dom ? { dom } : {}),
      })
      return { api, scrollToTop }
    }

    it('heals bottom desync through the adapter (default namespace)', async () => {
      const root = makeDesyncDom('el')
      const { api, scrollToTop } = makeReconcile('el', root, createVirtualDomAdapter('el'))
      api.scheduleReconcile()
      await flushRaf()
      await flushRaf()
      expect(scrollToTop).toHaveBeenCalledWith(480)
    })

    it('heals through a custom-namespace adapter (old statics missed)', async () => {
      const root = makeDesyncDom('x')
      const { api, scrollToTop } = makeReconcile('x', root, createVirtualDomAdapter('x'))
      api.scheduleReconcile()
      await flushRaf()
      await flushRaf()
      expect(scrollToTop).toHaveBeenCalledWith(480)
    })

    it('skips DOM detection gracefully without dom (no throw, no write)', async () => {
      const root = makeDesyncDom('el')
      const { api, scrollToTop } = makeReconcile('el', root)
      api.scheduleReconcile()
      await flushRaf()
      await flushRaf()
      expect(scrollToTop).not.toHaveBeenCalled()
    })
  })
})
