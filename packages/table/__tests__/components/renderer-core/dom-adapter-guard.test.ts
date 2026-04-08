import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDefaultDomAdapter } from '../../../src/components/renderer-core/default-dom-adapter'
import { assertDomContract } from '../../../src/components/renderer-core/dom-contract'
import { createVirtualDomAdapter } from '../../../src/components/renderer-core/virtual-dom-adapter'
import { mountTable } from '../__harness__/mount-table'

/**
 * <zh/> EP 升级守护测试——断言 DOM 适配器的选择器在**当前** Element Plus 版本下
 * <zh/> 确实命中真实渲染产物。EP 大版本升级若改动类名或结构层级，本文件即失败，
 * <zh/> 从而把破坏点收敛到两个适配器实现，而不是散落在各 hook 与渲染器中静默失效。
 *
 * <zh/> 覆盖范围：静态选择器（body/行/反查作用域）、拖拽定位器的 DOM 查询（行容器/行键集合）、
 * <zh/> 以及单元格定位器对真实渲染行的解析能力。
 *
 * <zh/> **为何显式挂到 document**：拖拽定位器按绝对选择器查询（`#tableId …`），
 * <zh/> 而 `@vue/test-utils` 的 `mount()` 默认返回游离元素（`document.contains(root) === false`），
 * <zh/> 绝对查询将恒为 null——这是测试环境差异，不是选择器失效。故显式 append，结束再卸载。
 *
 * <en/> EP upgrade guard test — asserts the DOM adapter selectors actually match real render
 * <en/> output under the **current** Element Plus version. If an EP major upgrade renames classes or
 * <en/> restructures the DOM, this file fails, keeping the breakage inside the two adapter
 * <en/> implementations instead of silently failing across hooks and renderers.
 *
 * <en/> Coverage: static selectors (body/row/scope), the drag locator's DOM queries (row container /
 * <en/> current row keys), and the cell locator's parsing of a real rendered row.
 *
 * <en/> **Why explicitly attached to the document**: drag locators query by absolute selector
 * <en/> (`#tableId …`), while `@vue/test-utils`' `mount()` returns a detached element by default
 * <en/> (`document.contains(root) === false`), making absolute queries always null — a test-environment
 * <en/> difference, not a broken selector. Hence the explicit append, unmounted at the end.
 */
async function mountAttached(mode: 'default' | 'virtual') {
  const mounted = await mountTable({ mode })
  const root = mounted.wrapper.element as HTMLElement
  document.body.appendChild(root)
  return { ...mounted, root }
}

/**
 * <zh/> 取表格根的真实 id——拖拽定位器的作用域是 `#tableId`。
 *
 * <zh/> 注意 `wrapper.element` 是 VTU 的容器 div（无 id、无 class），**不是** AdvTable 根；
 * <zh/> 必须从渲染产物中取 `.adv-table` 的真实 id，断言才覆盖 `#tableId` 作用域路径
 * <zh/> （空串 id 拼出非法选择器，属用例作用域根错误，与实现无关）。
 *
 * <en/> Resolve the table root's real id — the drag locator is scoped by `#tableId`.
 *
 * <en/> Note `wrapper.element` is VTU's container div (no id, no class), **not** the AdvTable root;
 * <en/> the real id must come from the rendered `.adv-table` for the assertion to cover the
 * <en/> `#tableId` scope path (an empty id builds an invalid selector — a wrong test scope root).
 */
function tableIdOf(root: HTMLElement): string {
  return root.querySelector<HTMLElement>('.adv-table')?.id ?? ''
}

describe('dOM adapter — EP upgrade guard', () => {
  it('default adapter selectors match real ElTable output', async () => {
    const { wrapper, root } = await mountAttached('default')
    try {
      const dom = createDefaultDomAdapter('el')

      // <zh/> 契约断言一次列出全部失配选择器（fail-fast），替代逐个 not.toBeNull
      // <en/> Contract assertion lists every miss at once (fail-fast) instead of one-by-one not.toBeNull
      expect(() => assertDomContract(root, [dom.getBodySelector(), dom.getRowSelector()], 'default-adapter')).not.toThrow()
      const firstRow = root.querySelector<HTMLElement>(dom.getRowSelector())
      expect(firstRow, `row selector "${dom.getRowSelector()}" must match`).not.toBeNull()

      const locator = dom.createDragLocator(tableIdOf(root), undefined)
      expect(locator.getRowContainer(), 'drag row container must resolve').not.toBeNull()
      expect(locator.getCurrentRowKeys().length, 'drag locator must read rendered row keys').toBeGreaterThan(0)

      /**
       * <zh/> 单元格选择器（`utils/drag-ghost` 的 fallback 样式同步依赖）必须在真实行内命中。
       * <en/> The cell selector (relied on by `utils/drag-ghost` fallback style sync) must match inside a
       * <en/> real row — previously it was hard-coded in `drag-ghost.ts`, so an EP rename
       * <en/> would fail silently.
       */
      const cellSelector = locator.getCellSelector?.()
      expect(cellSelector, 'drag locator must supply a cell selector').toBeDefined()
      expect(firstRow!.querySelector(cellSelector!), `cell selector "${cellSelector}" must match`).not.toBeNull()

      // <zh/> 单元格定位器：真实 <tr> 的行索引应可解析（tbody 内序号）
      // <en/> Cell locator: a real <tr>'s row index must resolve (its ordinal within tbody)
      const cellLocator = dom.createCellLocator()
      const td = firstRow!.querySelector('td')
      if (td)
        expect(cellLocator.getRowIndex(td as HTMLElement)).not.toBeNull()
    }
    finally {
      wrapper.unmount()
    }
  })

  it('virtual adapter selectors match real ElTableV2 output', async () => {
    const { wrapper, root } = await mountAttached('virtual')
    try {
      const dom = createVirtualDomAdapter('el')

      const scope = dom.getScopeSelector()
      expect(scope, 'virtual adapter must narrow reverse lookup').toBeDefined()
      expect(() => assertDomContract(root, [scope!, dom.getBodySelector(), dom.getRowSelector()], 'virtual-adapter')).not.toThrow()

      const locator = dom.createDragLocator(tableIdOf(root), undefined)
      expect(locator.getRowContainer(), 'v2 drag row container must resolve').not.toBeNull()

      /**
       * <zh/> v2 的单元格选择器是命名空间化的 `__row-cell`，须能命中原生渲染的行单元格。
       * <en/> The v2 cell selector is the namespace-aware `__row-cell` and must match natively rendered cells.
       */
      const cellSelector = locator.getCellSelector?.()
      expect(cellSelector, 'v2 drag locator must supply a cell selector').toBeDefined()
      const v2Row = root.querySelector(dom.getRowSelector())
      expect(v2Row!.querySelector(cellSelector!), `cell selector "${cellSelector}" must match`).not.toBeNull()

      /**
       * <zh/> 行虚拟化下 DOM 仅含窗口行，`getCurrentRowKeys` 至少应能读到已渲染行的键；
       * <zh/> 空窗口（容器未测量）在 happy-dom 下也可能发生，故此处只断言返回数组以验证查询路径可用。
       * <en/> Under row virtualization the DOM holds only window rows; `getCurrentRowKeys` should read the
       * <en/> rendered keys. An empty window is possible in happy-dom (unmeasured container), so only the
       * <en/> query path is asserted here.
       */
      expect(Array.isArray(locator.getCurrentRowKeys())).toBe(true)
    }
    finally {
      wrapper.unmount()
    }
  })

  /**
   * <zh/> 命名空间化守护——单元格选择器曾硬编码 `.el-` 前缀（default 分支为 `'td'` 不受影响，
   * <zh/> virtual 分支必然失配）。断言适配器按当前命名空间构造，使 `uiConfig.namespace` 自定义命名空间下同样命中。
   * <en/> Namespace guard — the cell selector used to hard-code the `.el-` prefix (the default branch's
   * <en/> `'td'` was unaffected, the virtual branch always missed). Asserts the adapter builds from the
   * <en/> current namespace so a custom `uiConfig.namespace` also matches.
   */
  it('cell selectors are namespace-aware (no hard-coded .el- prefix)', () => {
    expect(createVirtualDomAdapter('el').createDragLocator('t', undefined).getCellSelector?.())
      .toBe('.el-table-v2__row-cell')
    expect(createVirtualDomAdapter('custom').createDragLocator('t', undefined).getCellSelector?.())
      .toBe('.custom-table-v2__row-cell')
    // <zh/> default 模式是原生 `<td>`，与命名空间无关
    // <en/> The default mode is a native `<td>`, independent of the namespace
    expect(createDefaultDomAdapter('el').createDragLocator('t', undefined).getCellSelector?.()).toBe('td')
    expect(createDefaultDomAdapter('custom').createDragLocator('t', undefined).getCellSelector?.()).toBe('td')
  })

  it('scope selector is namespace-aware (namespace-holding)', () => {
    // <zh/> getScopeSelector 曾返回静态 `.el-table-v2__main` 常量，自定义命名空间下反查失配
    expect(createVirtualDomAdapter('el').getScopeSelector()).toBe('.el-table-v2__main')
    expect(createVirtualDomAdapter('custom').getScopeSelector()).toBe('.custom-table-v2__main')
    expect(createDefaultDomAdapter('custom').getScopeSelector()).toBeUndefined()
  })

  it('row/header selectors are namespace-aware (namespace-holding)', () => {
    expect(createDefaultDomAdapter('custom').closestRow).toBeDefined()
    expect(createDefaultDomAdapter('custom').getHeaderSelector()).toBe('.custom-table__header-wrapper')
    expect(createDefaultDomAdapter('custom').getHeaderCellSelector()).toBe('.custom-table__cell')
    expect(createVirtualDomAdapter('custom').getHeaderSelector()).toBe('.custom-table-v2__header')
    expect(createVirtualDomAdapter('custom').getHeaderCellSelector()).toBe('.custom-table-v2__header-cell')
    // <zh/> closestRow 在游离元素上返回 null，不抛错
    // <en/> closestRow returns null (no throw) on detached elements
    const detached = document.createElement('div')
    expect(createDefaultDomAdapter('el').closestRow(detached)).toBeNull()
  })

  /**
   * <zh/> 滚动条规格的命名空间化守护——`scrollWrap`/`customBar`/`virtualBar` 曾用静态
   * <zh/> `.el-scrollbar__*` / `.el-vl__*` 字面量，而同一文件其余选择器均已命名空间化：
   * <zh/> 自定义 `uiConfig.namespace` 下滚动条规格静默失配——`table-renderer` 的滚动回退到
   * <zh/> `overflow: hidden` 的 body 包装层，滚动与悬浮层夹取无声失效。
   * <en/> Namespace guard for the scrollbar spec — `scrollWrap`/`customBar`/`virtualBar` used to be static
   * <en/> `.el-scrollbar__*` / `.el-vl__*` literals while every other selector in the same file was
   * <en/> namespace-aware: a custom `uiConfig.namespace` silently mismatched, letting the renderer's scroll
   * <en/> fall back to the `overflow: hidden` body wrapper and quietly break scrolling and hover clamping.
   */
  it('scrollbar spec is namespace-aware (namespace-holding)', () => {
    expect(createDefaultDomAdapter('el').getBodyScrollbarSpec()).toEqual({
      virtualBar: undefined,
      scrollWrap: '.el-scrollbar__wrap',
      customBar: '.el-scrollbar__bar.is-vertical',
    })
    expect(createDefaultDomAdapter('custom').getBodyScrollbarSpec()).toEqual({
      virtualBar: undefined,
      scrollWrap: '.custom-scrollbar__wrap',
      customBar: '.custom-scrollbar__bar.is-vertical',
    })
    expect(createVirtualDomAdapter('custom').getBodyScrollbarSpec()).toEqual({
      virtualBar: '.custom-vl__vertical',
      scrollWrap: '',
      customBar: undefined,
    })
  })

  /**
   * <zh/> tableId 非法字符守护——作用域不再拼接 `#id` 选择器，改由 `getElementById` 解析根元素，
   * <zh/> 故 `#123 table` 这类非法选择器不再中断拖拽/滚动链路。
   * <en/> tableId special-character guard — the scope no longer builds a `#id` selector but resolves the
   * <en/> root via `getElementById`, so an illegal selector such as `#123 table` no longer breaks the
   * <en/> drag/scroll chain (it previously threw `SyntaxError`).
   */
  it('resolves row containers for ids that are not legal CSS selectors', () => {
    const root = document.createElement('div')
    root.id = '123 table'
    const bodyWrapper = document.createElement('div')
    bodyWrapper.className = 'el-table__body-wrapper'
    const tbody = document.createElement('tbody')
    const row = document.createElement('tr')
    row.className = 'el-table__row'
    row.setAttribute('data-adv-table-row-key', 'k1')
    tbody.append(row)
    bodyWrapper.append(tbody)
    root.append(bodyWrapper)
    document.body.append(root)
    try {
      const locator = createDefaultDomAdapter('el').createDragLocator(root.id, undefined)
      expect(locator.getRowContainer()).toBe(tbody)
      expect(locator.getCurrentRowKeys()).toEqual(['k1'])
    }
    finally {
      root.remove()
    }
  })
})

/**
 * <zh/> composables 与渲染器层 EP 持有禁令（namespace-holding; dom-convergence）——hook 与渲染器不得持有 `.el-*` 字符串，
 * <zh/> 一律经 `IRendererDomAdapter` 方法查询；渲染器层另禁 `utils/ep-selectors` 静态常量导入
 * <zh/> （命名空间化构造器只能活在适配器实现内）。注释行豁免。
 * <en/> EP holding ban for composables and the renderer layer (namespace-holding + dom-convergence).
 */
interface EpHoldingViolation { file: string, line: number, text: string }

function scanEpHoldings(srcDir: string): EpHoldingViolation[] {
  const results: EpHoldingViolation[] = []
  const literalPattern = /\.el-table|\.el-vl__|\.el-scrollbar/
  // <zh/> 静态常量导入（`EP_*_SELECTOR`）与命名空间化构造器（`epXxx(`）统一经适配器，渲染器层禁直接引用
  const staticImportPattern = /from\s+['"][^'"]*utils\/ep-selectors['"]/

  function isCommentLine(trimmed: string): boolean {
    return trimmed.startsWith('//')
      || trimmed.startsWith('*')
      || trimmed.startsWith('/*')
      || trimmed.startsWith('<!--')
  }

  function scanFile(fullPath: string, relativePath: string, forbidStaticImport: boolean): void {
    const content = fs.readFileSync(fullPath, 'utf-8')
    content.split('\n').forEach((line, idx) => {
      const trimmed = line.trim()
      if (isCommentLine(trimmed))
        return
      const codePart = line.split('//')[0] ?? ''
      if (literalPattern.test(codePart)) {
        results.push({ file: relativePath, line: idx + 1, text: trimmed.slice(0, 160) })
        return
      }
      if (forbidStaticImport && staticImportPattern.test(codePart)) {
        results.push({ file: relativePath, line: idx + 1, text: trimmed.slice(0, 160) })
      }
    })
  }

  function walkDir(dir: string, forbidStaticImport: boolean, extensions: string[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walkDir(fullPath, forbidStaticImport, extensions)
        continue
      }
      if (!extensions.some(ext => entry.name.endsWith(ext)))
        continue
      scanFile(fullPath, path.relative(srcDir, fullPath).split(path.sep).join('/'), forbidStaticImport)
    }
  }

  walkDir(path.join(srcDir, 'composables'), false, ['.ts'])
  // <zh/> dom-convergence:渲染器层（含 .vue/.tsx）禁字面量＋禁 ep-selectors 静态导入
  walkDir(path.join(srcDir, 'components', 'table-renderer'), true, ['.ts', '.vue', '.tsx'])
  walkDir(path.join(srcDir, 'components', 'table-virtual-renderer'), true, ['.ts', '.vue', '.tsx'])
  return results
}

describe('dom adapter — composables literal ban (namespace-holding)', () => {
  it('holds no .el-* class-name literals in src/composables code', () => {
    // <zh/> 本文件位于 __tests__/components/renderer-core/，到包根 src 需上三层
    const srcDir = path.resolve(__dirname, '../../../src')
    const violations = scanEpHoldings(srcDir).filter(v => v.file.startsWith('composables/'))
    if (violations.length > 0) {
      const details = violations.map(v => `  ${v.file}:${v.line} -> ${v.text}`).join('\n')
      console.error(`\n[dom-adapter-literal-ban] Violations (${violations.length}):\n${details}`)
    }
    expect(violations, 'New .el-* literals in composables. Query through IRendererDomAdapter instead.').toEqual([])
  })

  it('holds no EP literals or ep-selectors imports in the renderer layer (dom-convergence)', () => {
    const srcDir = path.resolve(__dirname, '../../../src')
    const violations = scanEpHoldings(srcDir).filter(v => v.file.startsWith('components/table-renderer/') || v.file.startsWith('components/table-virtual-renderer/'))
    if (violations.length > 0) {
      const details = violations.map(v => `  ${v.file}:${v.line} -> ${v.text}`).join('\n')
      console.error(`\n[dom-adapter-renderer-ban] Violations (${violations.length}):\n${details}`)
    }
    expect(violations, 'New EP holdings in the renderer layer. Query through IRendererDomAdapter instead.').toEqual([])
  })
})
