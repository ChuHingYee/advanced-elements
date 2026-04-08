import { beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { createElTableCellLocator } from '../../../src/components/renderer-core/cell-locator'
import { createDefaultDomAdapter } from '../../../src/components/renderer-core/default-dom-adapter'

/**
 * <zh/> 拖拽定位器由 DOM 适配器创建（`createDefaultDomAdapter(ns).createDragLocator(...)`），
 * <zh/> 不再从 `cell-locator` 直接导出——后者已收敛为仅含单元格定位器且无 EP 类名。
 * <en/> The drag locator is created by the DOM adapter
 * <en/> (`createDefaultDomAdapter(ns).createDragLocator(...)`) and is no longer exported directly from
 * <en/> `cell-locator`, which now holds only the cell locator and no EP class names.
 */
function dragLocator(tableId: string, namespace?: Parameters<typeof createDefaultDomAdapter>[0]) {
  return createDefaultDomAdapter(namespace).createDragLocator(tableId, undefined)
}

describe('createElTableCellLocator', () => {
  const locator = createElTableCellLocator()

  describe('getRowIndex', () => {
    it('returns null when cell has no closest <tr>', () => {
      const orphan = document.createElement('td')
      expect(locator.getRowIndex(orphan)).toBeNull()
    })

    it('returns index within <tbody> when available', () => {
      const tbody = document.createElement('tbody')
      const tr0 = document.createElement('tr')
      const tr1 = document.createElement('tr') // target
      const tr2 = document.createElement('tr')
      tbody.append(tr0, tr1, tr2)
      const td = document.createElement('td')
      tr1.append(td)

      expect(locator.getRowIndex(td)).toBe(1)
    })

    it('returns index within <table> when no <tbody> exists', () => {
      const table = document.createElement('table')
      const tr0 = document.createElement('tr')
      const tr1 = document.createElement('tr') // target
      table.append(tr0, tr1)
      const td = document.createElement('td')
      tr1.append(td)

      expect(locator.getRowIndex(td)).toBe(1)
    })

    it('returns null when cell is not inside any table structure', () => {
      const div = document.createElement('div')
      const tr = document.createElement('tr')
      div.append(tr)
      const td = document.createElement('td')
      tr.append(td)

      expect(locator.getRowIndex(td)).toBeNull()
    })
  })

  describe('getColumnIndex', () => {
    it('returns cellIndex for TD elements', () => {
      const tr = document.createElement('tr')
      tr.append(document.createElement('td'))
      tr.append(document.createElement('td')) // target
      tr.append(document.createElement('td'))
      const td = tr.children[1] as HTMLTableCellElement

      expect(locator.getColumnIndex(td)).toBe(1)
    })

    it('returns null for non-TD elements', () => {
      const div = document.createElement('div')
      expect(locator.getColumnIndex(div)).toBeNull()
    })
  })
})

describe('defaultDomAdapter.createDragLocator', () => {
  const TABLE_ID = 'test-table'
  const NS = 'el'

  /**
   * Helper: build DOM tree with createElement/appendChild so happy-dom
   * constructs the tree correctly (innerHTML string parsing may not work).
   */
  function mountTableHTML(variant: 'basic' | 'custom-ns' | 'keys' | 'marker-fallback' | 'mixed-keys') {
    const root = document.createElement('div')
    root.id = TABLE_ID
    document.body.append(root)

    const wrapper = document.createElement('div')
    if (variant === 'custom-ns') {
      wrapper.className = 'custom-table__body-wrapper'
    }
    else {
      wrapper.className = 'el-table__body-wrapper'
    }
    root.append(wrapper)

    const tbody = document.createElement('tbody')
    wrapper.append(tbody)

    if (variant === 'keys' || variant === 'mixed-keys') {
      const addRow = (key: string | null) => {
        const tr = document.createElement('tr')
        tr.className = 'el-table__row'
        if (key) {
          tr.setAttribute('data-adv-table-row-key', key)
        }
        tbody.append(tr)
      }
      addRow('key1')
      if (variant === 'keys') {
        addRow('key2')
        addRow('key3')
      }
      if (variant === 'mixed-keys') {
        addRow(null) // row without key
      }
    }

    if (variant === 'marker-fallback') {
      const addRowWithChildMarker = (key: string) => {
        const tr = document.createElement('tr')
        tr.className = 'el-table__row'
        const td = document.createElement('td')
        const span = document.createElement('span')
        span.setAttribute('data-adv-table-row-key', key)
        td.append(span)
        tr.append(td)
        tbody.append(tr)
      }
      addRowWithChildMarker('keyA')
      addRowWithChildMarker('keyB')
    }
  }

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('getRowContainer', () => {
    it('returns the tbody element', () => {
      mountTableHTML('basic')
      const locator = dragLocator(TABLE_ID, NS)
      const container = locator.getRowContainer()
      expect(container).not.toBeNull()
      expect(container!.tagName).toBe('TBODY')
    })

    it('returns null when container not found', () => {
      const locator = dragLocator('non-existent', NS)
      expect(locator.getRowContainer()).toBeNull()
    })

    it('uses custom namespace', () => {
      mountTableHTML('custom-ns')
      const locator = dragLocator(TABLE_ID, 'custom')
      expect(locator.getRowContainer()).not.toBeNull()
    })
  })

  describe('getCurrentRowKeys', () => {
    it('returns row keys from data-adv-table-row-key attributes', () => {
      mountTableHTML('keys')
      const locator = dragLocator(TABLE_ID, NS)
      expect(locator.getCurrentRowKeys()).toEqual(['key1', 'key2', 'key3'])
    })

    it('falls back to marker element when attribute is on child', () => {
      mountTableHTML('marker-fallback')
      const locator = dragLocator(TABLE_ID, NS)
      expect(locator.getCurrentRowKeys()).toEqual(['keyA', 'keyB'])
    })

    it('skips rows without a key', () => {
      mountTableHTML('mixed-keys')
      const locator = dragLocator(TABLE_ID, NS)
      expect(locator.getCurrentRowKeys()).toEqual(['key1'])
    })

    it('returns empty array when container not found', () => {
      const locator = dragLocator('non-existent', NS)
      expect(locator.getCurrentRowKeys()).toEqual([])
    })
  })

  describe('static selectors', () => {
    const locator = dragLocator(TABLE_ID, NS)

    it('getDragHandleSelector returns td (native HTML, not EP .cell)', () => {
      expect(locator.getDragHandleSelector()).toBe('td')
    })

    it('getDraggableRowSelector uses namespace', () => {
      expect(locator.getDraggableRowSelector()).toBe('.el-table__row')
    })

    it('getVisibleRowElements queries rows inside the given container', () => {
      const container = document.createElement('div')
      container.innerHTML = '<table><tbody>'
        + '<tr class="el-table__row"><td>a</td></tr>'
        + '<tr class="el-table__row"><td>b</td></tr>'
        + '</tbody></table>'
      const rows = locator.getVisibleRowElements(container)
      expect(rows).toHaveLength(2)
      expect(rows[0]).toBe(container.querySelectorAll('.el-table__row')[0])
    })

    it('getAnimation returns 150', () => {
      expect(locator.getAnimation()).toBe(150)
    })

    it('getGhostClass returns adv-table__row--ghost', () => {
      expect(locator.getGhostClass()).toBe('adv-table__row--ghost')
    })
  })

  describe('namespace handling', () => {
    it('defaults to "el" when namespace is undefined', () => {
      const locator = dragLocator(TABLE_ID)
      expect(locator.getDraggableRowSelector()).toBe('.el-table__row')
    })

    it('defaults to "el" when namespace is a ref with undefined value', () => {
      const nsRef = ref(undefined)
      const locator = dragLocator(TABLE_ID, nsRef)
      expect(locator.getDraggableRowSelector()).toBe('.el-table__row')
    })
  })

  describe('dOM adapter selectors', () => {
    const elAdapter = createDefaultDomAdapter('el')

    it('has no narrowed scope selector (single table container)', () => {
      expect(elAdapter.getScopeSelector()).toBeUndefined()
    })

    it('reports ElScrollbar wrap and no virtual-list bar', () => {
      const spec = elAdapter.getBodyScrollbarSpec()
      expect(spec.virtualBar).toBeUndefined()
      expect(spec.scrollWrap).toBe('.el-scrollbar__wrap')
      expect(spec.customBar).toBe('.el-scrollbar__bar.is-vertical')
    })

    it('builds the row/body selectors from the namespace', () => {
      const custom = createDefaultDomAdapter('custom')
      expect(custom.getRowSelector()).toBe('.custom-table__row')
      expect(custom.getBodySelector()).toBe('.custom-table__body-wrapper')
    })

    it('defaults the body selector to the el namespace', () => {
      expect(elAdapter.getBodySelector()).toBe('.el-table__body-wrapper')
      expect(elAdapter.getRowSelector()).toBe('.el-table__row')
    })
  })
})
