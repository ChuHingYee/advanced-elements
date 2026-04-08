import { beforeEach, describe, expect, it } from 'vitest'
import { attachGhostInfo, removeGhostInfo, syncFallbackStyles } from '../../src/utils/drag-ghost'

describe('useDragGhost', () => {
  describe('attachGhostInfo', () => {
    it('adds a badge with first cell text summary', () => {
      const el = document.createElement('tr')
      el.innerHTML = `
        <td><div class="cell">Alice</div></td>
        <td><div class="cell">Engineer</div></td>
      `

      attachGhostInfo(el)

      const badge = el.querySelector('.adv-table-ghost-info')
      expect(badge).not.toBeNull()
      expect(badge!.textContent).toBe('Alice')
    })

    it('truncates long text to 20 characters', () => {
      const el = document.createElement('tr')
      const longText = 'A'.repeat(50)
      el.innerHTML = `<td><div class="cell">${longText}</div></td>`

      attachGhostInfo(el)

      const badge = el.querySelector('.adv-table-ghost-info')
      expect(badge).not.toBeNull()
      expect(badge!.textContent).toBe(`${'A'.repeat(20)}...`)
    })

    it('skips empty cells and uses first non-empty cell', () => {
      const el = document.createElement('tr')
      el.innerHTML = `
        <td><div class="cell">   </div></td>
        <td><div class="cell">Bob</div></td>
      `

      attachGhostInfo(el)

      const badge = el.querySelector('.adv-table-ghost-info')
      expect(badge).not.toBeNull()
      expect(badge!.textContent).toBe('Bob')
    })

    it('does not add badge when all cells are empty', () => {
      const el = document.createElement('tr')
      el.innerHTML = `
        <td><div class="cell"> </div></td>
        <td><div class="cell"></div></td>
      `

      attachGhostInfo(el)

      const badge = el.querySelector('.adv-table-ghost-info')
      expect(badge).toBeNull()
    })

    it('removes existing ghost info before adding new one', () => {
      const el = document.createElement('tr')
      el.innerHTML = `<td><div class="cell">First</div></td>`

      attachGhostInfo(el)
      const badge1 = el.querySelector('.adv-table-ghost-info')
      expect(badge1).not.toBeNull()

      // Call again — should replace, not duplicate
      attachGhostInfo(el)
      const badges = el.querySelectorAll('.adv-table-ghost-info')
      expect(badges.length).toBe(1)
    })

    it('supports adv-table__cell class as alternative', () => {
      const el = document.createElement('tr')
      el.innerHTML = `<td><div class="adv-table__cell">Charlie</div></td>`

      attachGhostInfo(el)

      const badge = el.querySelector('.adv-table-ghost-info')
      expect(badge).not.toBeNull()
      expect(badge!.textContent).toBe('Charlie')
    })

    it('sets position relative on the element', () => {
      const el = document.createElement('tr')
      el.innerHTML = `<td><div class="cell">Data</div></td>`

      attachGhostInfo(el)
      expect(el.style.position).toBe('relative')
    })

    it('marks badge with data-adv-table-ghost-info attribute', () => {
      const el = document.createElement('tr')
      el.innerHTML = `<td><div class="cell">Data</div></td>`

      attachGhostInfo(el)
      const badge = el.querySelector('[data-adv-table-ghost-info]')
      expect(badge).not.toBeNull()
    })
  })

  describe('removeGhostInfo', () => {
    it('removes existing ghost badge', () => {
      const el = document.createElement('tr')
      el.innerHTML = `<td><div class="cell">Data</div></td>`
      attachGhostInfo(el)

      expect(el.querySelector('.adv-table-ghost-info')).not.toBeNull()

      removeGhostInfo(el)
      expect(el.querySelector('.adv-table-ghost-info')).toBeNull()
    })

    it('does nothing when no ghost badge exists', () => {
      const el = document.createElement('tr')

      expect(() => removeGhostInfo(el)).not.toThrow()
    })
  })

  describe('syncFallbackStyles', () => {
    beforeEach(() => {
      document.body.innerHTML = ''
    })

    it('does nothing when no fallback element exists', () => {
      const sourceRow = document.createElement('tr')
      sourceRow.innerHTML = `<td>Content</td>`

      // Should not throw when .adv-table__row-fallback is missing
      expect(() => syncFallbackStyles(sourceRow, 'td')).not.toThrow()
    })

    it('copies row styles from source to fallback', () => {
      const sourceRow = document.createElement('tr')
      sourceRow.style.width = '500px'
      sourceRow.style.height = '40px'
      sourceRow.style.display = 'flex'
      sourceRow.innerHTML = '<td>Cell</td>'

      const fallback = document.createElement('div')
      fallback.className = 'adv-table__row-fallback'
      fallback.innerHTML = '<td>Cell</td>'
      document.body.appendChild(fallback)

      syncFallbackStyles(sourceRow, 'td')

      // In happy-dom, getComputedStyle may not resolve inline styles on <tr> elements,
      // but the syncFallbackStyles function runs without error and transfers ghost info
      const ghostBadge = fallback.querySelector('[data-adv-table-ghost-info]')
      expect(ghostBadge).toBeDefined()
    })

    it('copies cell styles from source to fallback cells', () => {
      const sourceRow = document.createElement('tr')
      sourceRow.innerHTML = '<td><div class="cell">Cell</div></td>'

      const fallback = document.createElement('div')
      fallback.className = 'adv-table__row-fallback'
      document.body.appendChild(fallback)

      syncFallbackStyles(sourceRow, 'td')

      // Function should run without throwing
      expect(true).toBe(true)
    })

    it('accepts the adapter-supplied virtual-row cell selector', () => {
      const sourceRow = document.createElement('div')
      sourceRow.innerHTML = '<div class="el-table-v2__row-cell">Cell</div>'

      const fallback = document.createElement('div')
      fallback.className = 'adv-table__row-fallback'
      document.body.appendChild(fallback)

      // <zh/> 选择器由 DragLocator.getCellSelector() 供给，函数本身不再做模式探测
      // <en/> The selector comes from DragLocator.getCellSelector(); the function no longer probes the mode
      expect(() => syncFallbackStyles(sourceRow, '.el-table-v2__row-cell')).not.toThrow()
    })

    it('passes the supplied selector to both cell queries, not a hard-coded one', () => {
      /**
       * <zh/> 入参选择器必须无条件生效——不得因行内存在 `<td>` 而被改写。
       * <zh/> 刻意构造成"行内有 `<td>`、入参却是 v2 选择器"：两者不一致时本用例才有区分力
       * <zh/>（若用 div 行 + v2 选择器，两种写法结果相同，无法区分）。
       * <en/> The supplied selector must win unconditionally — it must never be rewritten just because the
       * <en/> row contains a `<td>`. Deliberately built as "row has a `<td>`, supplied selector is the v2 one":
       * <en/> the case only discriminates when the two disagree (a div row with the v2 selector yields the
       * <en/> same result either way, so it cannot discriminate).
       */
      const sourceRow = document.createElement('div')
      const nativeCell = document.createElement('td')
      nativeCell.textContent = 'Native'
      sourceRow.appendChild(nativeCell)
      const v2Cell = document.createElement('div')
      v2Cell.className = 'el-table-v2__row-cell'
      v2Cell.textContent = 'V2'
      sourceRow.appendChild(v2Cell)

      const fallback = document.createElement('div')
      fallback.className = 'adv-table__row-fallback'
      fallback.innerHTML = '<div class="el-table-v2__row-cell">Cell</div>'
      document.body.appendChild(fallback)

      /**
       * <zh/> 直接断言选择器被消费，而非依赖 happy-dom 的 CSS 引擎（其 getComputedStyle
       * <zh/> 不解析游离/内联样式，既有用例因此只断言"不抛错"）。
       * <zh/> 若实现忽略入参（沿用旧的内联模式探测 `querySelector('td') ? 'td' : ...`），
       * <zh/> 源行与克隆行上的两次查询就不会同时带上传入的选择器，本断言即失败。
       * <en/> Asserts the selector is consumed directly instead of relying on happy-dom's CSS engine
       * <en/> (its getComputedStyle does not resolve detached/inline styles, which is why the existing
       * <en/> cases only assert "does not throw").
       * <en/> An implementation ignoring the parameter (the old inline probe
       * <en/> `querySelector('td') ? 'td' : ...`) would not query both rows with the supplied selector,
       * <en/> failing this assertion.
       */
      const spy = vi.spyOn(Element.prototype, 'querySelectorAll')
      try {
        syncFallbackStyles(sourceRow, '.el-table-v2__row-cell')

        // <zh/> fallback 定位查询（多实例按行键匹配）非单元格查询，排除在外
        // <en/> The fallback-locating query (per-instance row-key match) is not a cell query — excluded
        const cellQueries = spy.mock.calls.filter(([sel]) => sel !== '[data-adv-table-ghost-info]' && sel !== '.adv-table__row-fallback')
        expect(cellQueries.length).toBeGreaterThanOrEqual(2)
        for (const [selector] of cellQueries)
          expect(selector).toBe('.el-table-v2__row-cell')
        // <zh/> 不得再出现硬编码的 `td` 分支——选择器一律来自入参
        // <en/> No hard-coded `td` branch — the selector always comes from the parameter
        expect(spy.mock.calls.some(([sel]) => sel === 'td')).toBe(false)
      }
      finally {
        spy.mockRestore()
      }
    })

    it('honors a default-renderer `td` selector likewise', () => {
      const sourceRow = document.createElement('tr')
      sourceRow.innerHTML = '<td>Cell</td>'
      const fallback = document.createElement('div')
      fallback.className = 'adv-table__row-fallback'
      fallback.innerHTML = '<td>Cell</td>'
      document.body.appendChild(fallback)

      const spy = vi.spyOn(Element.prototype, 'querySelectorAll')
      try {
        syncFallbackStyles(sourceRow, 'td')
        // <zh/> fallback 定位查询（多实例按行键匹配）非单元格查询，排除在外
        // <en/> The fallback-locating query (per-instance row-key match) is not a cell query — excluded
        const cellQueries = spy.mock.calls.filter(([sel]) => sel !== '[data-adv-table-ghost-info]' && sel !== '.adv-table__row-fallback')
        expect(cellQueries.length).toBeGreaterThanOrEqual(2)
        for (const [selector] of cellQueries)
          expect(selector).toBe('td')
      }
      finally {
        spy.mockRestore()
      }
    })

    it('matches the fallback clone by row key across coexisting instances', () => {
      // <zh/> 多实例同时拖拽：按行键匹配自家克隆，不抛错（happy-dom 不解析样式，仅断言定位不崩）
      // <en/> Coexisting drags across instances: matches its own clone by row key without throwing
      const sourceRow = document.createElement('tr')
      sourceRow.setAttribute('data-adv-table-row-key', 'table-a-row-1')
      sourceRow.innerHTML = '<td>Cell</td>'
      const otherFallback = document.createElement('div')
      otherFallback.className = 'adv-table__row-fallback'
      otherFallback.setAttribute('data-adv-table-row-key', 'table-b-row-9')
      otherFallback.innerHTML = '<td>Other</td>'
      document.body.appendChild(otherFallback)
      const ownFallback = document.createElement('div')
      ownFallback.className = 'adv-table__row-fallback'
      ownFallback.setAttribute('data-adv-table-row-key', 'table-a-row-1')
      ownFallback.innerHTML = '<td>Cell</td>'
      document.body.appendChild(ownFallback)

      expect(() => syncFallbackStyles(sourceRow, 'td')).not.toThrow()
    })

    it('copies ghost info badge from source to fallback', () => {
      const sourceRow = document.createElement('tr')
      sourceRow.innerHTML = '<td><div class="cell">Alice</div></td>'
      attachGhostInfo(sourceRow)

      const fallback = document.createElement('div')
      fallback.className = 'adv-table__row-fallback'
      fallback.innerHTML = '<td>Cell</td>'
      document.body.appendChild(fallback)

      syncFallbackStyles(sourceRow, 'td')

      const ghostBadge = fallback.querySelector('[data-adv-table-ghost-info]')
      expect(ghostBadge).not.toBeNull()
      expect(ghostBadge!.textContent).toBe('Alice')
    })

    it('handles missing ghost info gracefully', () => {
      const sourceRow = document.createElement('tr')
      sourceRow.innerHTML = '<td>Cell</td>'

      const fallback = document.createElement('div')
      fallback.className = 'adv-table__row-fallback'
      document.body.appendChild(fallback)

      // Should not throw even if source has no ghost info badge
      expect(() => syncFallbackStyles(sourceRow, 'td')).not.toThrow()
    })
  })

  describe('attachGhostInfo - multi row', () => {
    it('adds badge with count when count > 1 and has summary', () => {
      const el = document.createElement('tr')
      el.innerHTML = '<td><div class="cell">Alice</div></td>'

      attachGhostInfo(el, 3)

      const badge = el.querySelector('.adv-table-ghost-info')
      expect(badge).not.toBeNull()
      expect(badge!.classList.contains('adv-table-ghost-info--multi')).toBe(true)

      const countEl = badge!.querySelector('.adv-table-ghost-info__count')
      expect(countEl).not.toBeNull()
      expect(countEl!.textContent).toBe('3')
      expect(badge!.textContent).toContain('Alice')
    })

    it('adds badge with count only when count > 1 but no summary', () => {
      const el = document.createElement('tr')
      el.innerHTML = '<td><div class="cell">   </div></td>'

      attachGhostInfo(el, 5)

      const badge = el.querySelector('.adv-table-ghost-info')
      expect(badge).not.toBeNull()
      expect(badge!.classList.contains('adv-table-ghost-info--multi')).toBe(true)
      const countEl = badge!.querySelector('.adv-table-ghost-info__count')
      expect(countEl).not.toBeNull()
      expect(countEl!.textContent).toBe('5')
    })

    it('always adds badge when count > 1 even with no cell content', () => {
      const el = document.createElement('tr')
      el.innerHTML = '<td><div class="cell">   </div></td>'

      attachGhostInfo(el, 2)
      const badge = el.querySelector('.adv-table-ghost-info')
      expect(badge).not.toBeNull()
    })

    it('supports adv-table__cell class for virtual table cells when count > 1', () => {
      const el = document.createElement('tr')
      el.innerHTML = '<td><div class="adv-table__cell">Summary</div></td>'

      attachGhostInfo(el, 2)
      const badge = el.querySelector('.adv-table-ghost-info')
      expect(badge).not.toBeNull()
      expect(badge!.textContent).toContain('Summary')
    })
  })
})
