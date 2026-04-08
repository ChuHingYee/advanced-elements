import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useDraggable } from 'vue-draggable-plus'
import { useRowDrag } from '../../src/composables/interaction/use-row-drag'
import { DEFAULT_RENDERER_CAPS } from '../../src/types/renderer-caps'

/**
 * <zh/> `syncFallbackStyle` 调用时取值回归——default 的 `<tr>` 克隆行必须同步样式，
 * <zh/> 开关以 getter 传入时模式切换后即生效；此前实现在 setup 期解引用，
 * <zh/> 传函数恒为 truthy，等价于常开。
 * <en/> Call-time `syncFallbackStyle` regression — default `<tr>` clones must sync styles,
 * <en/> and a getter must take effect after mode switches; the old setup-time read treated
 * <en/> any function as truthy, i.e. always-on.
 */
const mockedUseDraggable = useDraggable as unknown as {
  mockImplementation: (fn: (...args: any[]) => { pause: () => void, destroy: () => void }) => void
}

function buildHarness(syncFlag: () => boolean) {
  document.body.innerHTML = ''
  const container = document.createElement('div')
  document.body.appendChild(container)

  const rowEl = document.createElement('tr')
  rowEl.setAttribute('data-adv-table-row-key', 'k1')
  rowEl.innerHTML = '<td><div class="cell">Alice</div></td>'

  const fallback = document.createElement('tr')
  fallback.className = 'adv-table__row-fallback'
  fallback.setAttribute('data-adv-table-row-key', 'k1')
  fallback.innerHTML = '<td>Cell</td>'
  document.body.appendChild(fallback)

  const fullData = ref([{ id: 'k1', name: 'Alice' }])
  const rowKey = ref((row: any) => row.id)
  const dragLocator = {
    getRowContainer: () => container,
    getCurrentRowKeys: () => ['k1'],
    getCurrentRowEntries: (): Array<{ element: HTMLElement, key: string | null }> => [{ element: rowEl, key: 'k1' }],
    getDragHandleSelector: () => '.drag-handle',
    getDraggableRowSelector: () => 'tr',
    getVisibleRowElements: (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('tr')),
    getAnimation: () => 150,
    getGhostClass: () => 'adv-table__row--ghost',
    getScrollContainer: () => null,
    getCellSelector: () => 'td',
  }

  let captured: { onStart?: (evt: any) => void } = {}
  mockedUseDraggable.mockImplementation((...args: any[]) => {
    captured = (args[1] ?? {}) as { onStart?: (evt: any) => void }
    return { pause: vi.fn(), destroy: vi.fn() }
  })

  const result = useRowDrag({
    rowDraggable: true,
    fullData: fullData as any,
    rowKey: rowKey as any,
    getRowMap: () => new Map([['k1', fullData.value[0]]]),
    onDataReorder: vi.fn(),
    dragLocator: dragLocator as any,
    tableId: 'sync-test-table',
    caps: DEFAULT_RENDERER_CAPS,
    syncFallbackStyle: syncFlag as any,
  })
  return { result, captured: () => captured, rowEl, fallback }
}

describe('useRowDrag syncFallbackStyle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('syncs source styles onto the fallback clone when the getter returns true', async () => {
    const { result, captured, rowEl, fallback } = buildHarness(() => true)
    try {
      await nextTick()
      await nextTick()
      expect(captured().onStart).toBeDefined()
      captured().onStart!({ item: rowEl, oldIndex: 0 })
      // <zh/> 源行徽标与同步无关，恒应存在（对照组） | <en/> The source badge is sync-independent (control)
      expect(rowEl.querySelector('[data-adv-table-ghost-info]')).not.toBeNull()
      const badge = fallback.querySelector('[data-adv-table-ghost-info]')
      expect(badge).not.toBeNull()
      expect(badge!.textContent).toBe('Alice')
    }
    finally {
      result.destroyRowDrag()
    }
  })

  it('skips the sync when the getter returns false', async () => {
    const { result, captured, rowEl, fallback } = buildHarness(() => false)
    try {
      await nextTick()
      await nextTick()
      captured().onStart!({ item: rowEl, oldIndex: 0 })
      expect(rowEl.querySelector('[data-adv-table-ghost-info]')).not.toBeNull()
      expect(fallback.querySelector('[data-adv-table-ghost-info]')).toBeNull()
    }
    finally {
      result.destroyRowDrag()
    }
  })

  it('reads the getter at call time, not at setup time', async () => {
    let flag = false
    const { result, captured, fallback } = buildHarness(() => flag)
    try {
      await nextTick()
      await nextTick()
      const rowEl = document.createElement('tr')
      rowEl.setAttribute('data-adv-table-row-key', 'k1')
      rowEl.innerHTML = '<td><div class="cell">Alice</div></td>'
      flag = true
      captured().onStart!({ item: rowEl, oldIndex: 0 })
      expect(fallback.querySelector('[data-adv-table-ghost-info]')).not.toBeNull()
    }
    finally {
      result.destroyRowDrag()
    }
  })
})
