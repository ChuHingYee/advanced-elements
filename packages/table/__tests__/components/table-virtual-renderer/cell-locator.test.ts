import { beforeEach, describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { createTableV2CellLocator } from '../../../src/components/renderer-core/cell-locator'
import { createVirtualDomAdapter } from '../../../src/components/renderer-core/virtual-dom-adapter'

/**
 * <zh/> 拖拽定位器由 DOM 适配器创建（`createVirtualDomAdapter(ns).createDragLocator(...)`），
 * <zh/> 不再从 `cell-locator` 直接导出——后者已收敛为仅含单元格定位器且无 EP 类名。
 * <en/> The drag locator is created by the DOM adapter
 * <en/> (`createVirtualDomAdapter(ns).createDragLocator(...)`) and is no longer exported directly from
 * <en/> `cell-locator`, which now holds only the cell locator and no EP class names.
 */
function dragLocator(tableId: string, namespace?: Parameters<typeof createVirtualDomAdapter>[0]) {
  return createVirtualDomAdapter(namespace).createDragLocator(tableId, undefined)
}

function createRowElement(key: string): HTMLElement {
  const tr = document.createElement('div')
  tr.setAttribute('data-adv-table-row-key', key)
  return tr
}

describe('createTableV2CellLocator', () => {
  describe('getRowIndex', () => {
    it('returns null when the cell has no closest [data-adv-table-row-key]', () => {
      const locator = createTableV2CellLocator(computed(() => new Map()))
      const orphan = document.createElement('div')
      expect(locator.getRowIndex(orphan)).toBeNull()
    })

    it('returns null when keyToIndex is undefined', () => {
      const locator = createTableV2CellLocator(undefined)
      const cell = document.createElement('div')
      const row = createRowElement('key1')
      row.append(cell)
      expect(locator.getRowIndex(cell)).toBeNull()
    })

    it('returns null when keyToIndex map is empty', () => {
      const locator = createTableV2CellLocator(computed(() => new Map()))
      const cell = document.createElement('div')
      const row = createRowElement('key1')
      row.append(cell)
      expect(locator.getRowIndex(cell)).toBeNull()
    })

    it('returns null when key is not found in keyToIndex map', () => {
      const keyToIndex = computed(() => new Map([['key2', 5]]))
      const locator = createTableV2CellLocator(keyToIndex)
      const cell = document.createElement('div')
      const row = createRowElement('unknown')
      row.append(cell)
      expect(locator.getRowIndex(cell)).toBeNull()
    })

    it('returns the correct row index from the keyToIndex map', () => {
      const keyToIndex = computed(() => new Map([['row-42', 3]]))
      const locator = createTableV2CellLocator(keyToIndex)
      const cell = document.createElement('div')
      const row = createRowElement('row-42')
      row.append(cell)
      expect(locator.getRowIndex(cell)).toBe(3)
    })

    it('returns render-data-domain index, not full-data-domain index (P0 fix)', () => {
      // Simulate page 2 of pagination: full data has 20 rows, but render data only has rows 10-19
      // The keyToIndex map should be built from render data (indices 0-9), not full data (indices 10-19)
      const keyToIndex = computed(() => new Map([
        ['row-10', 0],
        ['row-11', 1],
        ['row-12', 2],
      ]))
      const locator = createTableV2CellLocator(keyToIndex)
      const cell = document.createElement('div')
      const row = createRowElement('row-11')
      row.append(cell)
      // Should return 1 (render-data index), not 11 (full-data index)
      expect(locator.getRowIndex(cell)).toBe(1)
    })
  })

  describe('getColumnIndex', () => {
    it('returns index from data-adv-cell-col attribute', () => {
      const locator = createTableV2CellLocator(undefined)
      const target = document.createElement('div')
      target.setAttribute('data-adv-cell-col', '2')

      expect(locator.getColumnIndex(target)).toBe(2)
    })

    it('returns 0 for col 0', () => {
      const locator = createTableV2CellLocator(undefined)
      const target = document.createElement('div')
      target.setAttribute('data-adv-cell-col', '0')

      expect(locator.getColumnIndex(target)).toBe(0)
    })

    it('returns null when no attribute found', () => {
      const locator = createTableV2CellLocator(undefined)
      const target = document.createElement('div')

      expect(locator.getColumnIndex(target)).toBeNull()
    })

    it('returns null when element has no parent', () => {
      const locator = createTableV2CellLocator(undefined)
      const orphan = document.createElement('span')
      expect(locator.getColumnIndex(orphan)).toBeNull()
    })
  })
})

describe('virtualDomAdapter.createDragLocator', () => {
  const TABLE_ID = 'test-v2-table'
  const NS = 'el'

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('getRowContainer', () => {
    it('returns the correct DOM element', () => {
      document.body.innerHTML = `
        <div id="${TABLE_ID}">
          <div class="el-table-v2__body">
            <div><div></div></div>
          </div>
        </div>
      `
      const locator = dragLocator(TABLE_ID, NS)
      const container = locator.getRowContainer()
      expect(container).not.toBeNull()
    })

    it('returns null when not found', () => {
      const locator = dragLocator('non-existent', NS)
      expect(locator.getRowContainer()).toBeNull()
    })

    it('returns the inner layer whose direct children are rows (real Grid nesting)', () => {
      document.body.innerHTML = `
        <div id="${TABLE_ID}">
          <div class="el-table-v2__main">
            <div class="el-table-v2__body">
              <div class="test-window">
                <div class="test-inner">
                  <div class="el-table-v2__row"><span data-adv-table-row-key="k1"></span></div>
                  <div class="el-table-v2__row"><span data-adv-table-row-key="k2"></span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `
      const locator = dragLocator(TABLE_ID, NS)
      const container = locator.getRowContainer()
      expect(container).not.toBeNull()
      expect(container!.className).toBe('test-inner')
      expect(Array.from(container!.children).every(child => child.classList.contains('el-table-v2__row'))).toBe(true)
    })

    it('falls back to the empty inner layer when no rows are rendered', () => {
      document.body.innerHTML = `
        <div id="${TABLE_ID}">
          <div class="el-table-v2__main">
            <div class="el-table-v2__body">
              <div class="test-window"><div class="test-inner"></div></div>
            </div>
          </div>
        </div>
      `
      const locator = dragLocator(TABLE_ID, NS)
      expect(locator.getRowContainer()?.className).toBe('test-inner')
    })

    it('returns the scroll window (inner parent), not the main grid', () => {
      document.body.innerHTML = `
        <div id="${TABLE_ID}">
          <div class="el-table-v2__main">
            <div class="el-table-v2__body">
              <div class="test-window">
                <div class="test-inner">
                  <div class="el-table-v2__row"><span data-adv-table-row-key="k1"></span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `
      const locator = dragLocator(TABLE_ID, NS)
      expect(locator.getScrollContainer?.()?.className).toBe('test-window')
    })
  })

  describe('getCurrentRowKeys', () => {
    it('returns keys from data-adv-table-row-key on rows', () => {
      document.body.innerHTML = `
        <div id="${TABLE_ID}">
          <div class="el-table-v2__main">
            <div class="el-table-v2__row" data-adv-table-row-key="k1"></div>
            <div class="el-table-v2__row" data-adv-table-row-key="k2"></div>
          </div>
        </div>
      `
      const locator = dragLocator(TABLE_ID, NS)
      expect(locator.getCurrentRowKeys()).toEqual(['k1', 'k2'])
    })

    it('falls back to child marker when attribute is on inner element', () => {
      document.body.innerHTML = `
        <div id="${TABLE_ID}">
          <div class="el-table-v2__main">
            <div class="el-table-v2__row">
              <span data-adv-table-row-key="nested-key"></span>
            </div>
          </div>
        </div>
      `
      const locator = dragLocator(TABLE_ID, NS)
      expect(locator.getCurrentRowKeys()).toEqual(['nested-key'])
    })

    it('returns empty array when container not found', () => {
      const locator = dragLocator('non-existent', NS)
      expect(locator.getCurrentRowKeys()).toEqual([])
    })
  })

  describe('static selectors', () => {
    const locator = dragLocator(TABLE_ID, NS)

    it('getDragHandleSelector returns .adv-table__cell', () => {
      expect(locator.getDragHandleSelector()).toBe('.adv-table__cell')
    })

    it('getDraggableRowSelector uses namespace', () => {
      expect(locator.getDraggableRowSelector()).toBe('.el-table-v2__row')
    })

    it('getVisibleRowElements queries v2 rows inside the given container', () => {
      const container = document.createElement('div')
      container.innerHTML = '<div class="el-table-v2__row">a</div>'
        + '<div class="el-table-v2__row">b</div>'
        + '<div class="el-table__row">c</div>'
      // <zh/> 仅命中 v2 行：旧内联实现硬编码类名但至少限定了 v2，新方法经 getDraggableRowSelector 同口径
      const rows = locator.getVisibleRowElements(container)
      expect(rows).toHaveLength(2)
    })

    it('getAnimation returns 0', () => {
      expect(locator.getAnimation()).toBe(0)
    })

    it('getGhostClass returns undefined', () => {
      expect(locator.getGhostClass()).toBeUndefined()
    })
  })

  describe('namespace handling', () => {
    it('defaults to "el" when namespace is undefined', () => {
      const locator = dragLocator(TABLE_ID)
      expect(locator.getDraggableRowSelector()).toBe('.el-table-v2__row')
    })

    it('accepts a ref as namespace', () => {
      const ns = ref('custom')
      const locator = dragLocator(TABLE_ID, ns)
      expect(locator.getDraggableRowSelector()).toBe('.custom-table-v2__row')
    })
  })

  describe('dOM adapter selectors', () => {
    it('narrows reverse lookup to the main grid', () => {
      expect(createVirtualDomAdapter('el').getScopeSelector()).toBe('.el-table-v2__main')
    })

    it('reports the virtual-list scrollbar and no ElScrollbar wrap', () => {
      const spec = createVirtualDomAdapter('el').getBodyScrollbarSpec()
      expect(spec.virtualBar).toBe('.el-vl__vertical')
      expect(spec.scrollWrap).toBe('')
      expect(spec.customBar).toBeUndefined()
    })

    it('builds the row selector from the namespace', () => {
      expect(createVirtualDomAdapter('custom').getRowSelector()).toBe('.custom-table-v2__row')
    })
  })
})
