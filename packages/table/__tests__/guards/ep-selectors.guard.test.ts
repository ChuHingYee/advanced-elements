import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EP_EXPAND_ICON_CLASS,
  EP_EXPAND_ICON_EXPANDED_CLASS,
  EP_INDENT_CLASS,
  EP_ROW_SELECTOR,
  EP_TABLE_BODY_WRAPPER_SELECTOR,
  EP_TABLE_HEADER_WRAPPER_SELECTOR,
  EP_TABLE_ROW_SELECTOR,
  EP_TABLE_V2_BODY_SELECTOR,
  EP_TABLE_V2_HEADER_CELL_SELECTOR,
  EP_TABLE_V2_HEADER_ROW_SELECTOR,
  EP_TABLE_V2_HEADER_SELECTOR,
  EP_TABLE_V2_MAIN_SELECTOR,
  EP_TABLE_V2_ROW_CELL_SELECTOR,
  EP_TABLE_V2_ROW_SELECTOR,
  epIcon,
  epScrollbarVerticalBar,
  epScrollbarWrap,
  epTableBodyWrapper,
  epTableExpandIcon,
  epTableExpandIconExpanded,
  epTableExpandIconPlaceholder,
  epTableHeaderCell,
  epTableHeaderWrapper,
  epTableIndent,
  epTableRow,
  epTableV2Body,
  epTableV2Header,
  epTableV2HeaderCell,
  epTableV2HeaderRow,
  epTableV2Main,
  epTableV2Row,
  epTableV2RowCell,
  epVlVertical,
} from '../../src/utils/ep-selectors'

/**
 * <zh/> EP 选择器守卫——JS 侧 DOM 查询是 EP 非公开 API 的唯一耦合点（见 CODE-REVIEW 维度八）。
 * <zh/> 三层断言，全部只读、零运行时影响：
 * <zh/> ① **同源性**：静态常量必须等于命名空间构造器 `('el')` 的输出，杜绝"改一处漏一处"；
 * <zh/> ② **存在性（仅布局关键类）**：参与几何/滚动查询的类名必须在**当前** EP 版本 dist CSS 中存在
 * <zh/>    （改名即本测试失败，把静默失效变为 CI 失败）；
 * <zh/> ③ **形状**：自定义命名空间（`uiConfig.namespace`）下构造器形状正确。
 * <zh/>
 * <zh/> **为何 ② 有排除清单**：EP 部分类名"被渲染但无样式规则"（如 `el-table-v2__body` 是虚拟列表
 * <zh/> wrapper、`el-table__indent` 仅由 EP 渲染后交由本库 SCSS 定宽），dist CSS 里查不到并非改名。
 * <zh/> 这类类名的存在性由 EP 源码 `ns.e("…")` 渲染路径保证，其渲染命中另有对拍守护
 * <zh/> （`__tests__/components/renderer-core/dom-adapter-guard.test.ts` 对真实渲染产物断言）。
 * <zh/>
 * <en/> EP selector guard — JS-side DOM queries are the only coupling to EP's private API (see CODE-REVIEW dimension 8).
 * <en/> Three read-only layers, zero runtime impact:
 * <en/> ① **single source**: static constants equal the namespace builders `('el')` (no partial edits);
 * <en/> ② **existence (layout-critical classes only)**: classes used for geometry/scroll queries must exist in
 * <en/>    the current EP dist CSS — a rename fails this test, turning silent breakage into CI failure;
 * <en/> ③ **shape**: builders keep the right shape under a custom `uiConfig.namespace`.
 * <en/>
 * <en/> **Why ② carries an exclusion list**: some EP classes are rendered without any CSS rule (e.g.
 * <en/> `el-table-v2__body` is the virtual-list wrapper, `el-table__indent` is emitted by EP and sized by this
 * <en/> library's SCSS), so absence from dist CSS does not imply a rename. Their existence is guaranteed by EP's
 * <en/> `ns.e("…")` render path, and real-render matching is guarded separately by
 * <en/> `__tests__/components/renderer-core/dom-adapter-guard.test.ts` (asserts against actual render output).
 */

const require = createRequire(import.meta.url)
const epCssPath = join(dirname(require.resolve('element-plus/package.json')), 'dist', 'index.css')
const epCss = readFileSync(epCssPath, 'utf8')

/**
 * <zh/> EP 已渲染但无样式规则的类名（不参与 CSS 存在性断言）：
 * <zh/> - `.el-table-v2__body`：EP `table-grid.mjs` 以 `ns.e("body")` 渲染，是虚拟列表 wrapper（overflow: visible）
 * <zh/> - `.el-table__indent`：EP `table config.mjs` 以 `ns.e("indent")` 渲染，宽度由本库 SCSS 定
 * <en/> EP-rendered but unstyled class names (excluded from the CSS existence assertion):
 * <en/> - `.el-table-v2__body`: rendered by EP `table-grid.mjs` via `ns.e("body")`; it is the virtual-list
 * <en/>   wrapper (overflow: visible)
 * <en/> - `.el-table__indent`: rendered by EP `table config.mjs` via `ns.e("indent")`; its width comes from this
 * <en/>   library's SCSS
 */
const RENDERED_BUT_UNSTYLED = new Set([
  EP_TABLE_V2_BODY_SELECTOR,
  `.${EP_INDENT_CLASS}`,
])

/** <zh/> 参与布局/滚动几何查询的类名——这些的 EP 改名会直接破坏表格交互 | <en/> Classes used for layout/scroll geometry — an EP rename here visibly breaks table interaction */
const LAYOUT_CRITICAL = [
  EP_TABLE_ROW_SELECTOR,
  EP_TABLE_V2_ROW_SELECTOR,
  EP_TABLE_BODY_WRAPPER_SELECTOR,
  EP_TABLE_HEADER_WRAPPER_SELECTOR,
  EP_TABLE_V2_MAIN_SELECTOR,
  EP_TABLE_V2_ROW_CELL_SELECTOR,
  EP_TABLE_V2_HEADER_ROW_SELECTOR,
  EP_TABLE_V2_HEADER_SELECTOR,
  EP_TABLE_V2_HEADER_CELL_SELECTOR,
  epTableHeaderCell('el'),
  epScrollbarWrap('el'),
  epScrollbarVerticalBar('el'),
  epVlVertical('el'),
  `.${EP_EXPAND_ICON_CLASS}`,
  `.${EP_EXPAND_ICON_EXPANDED_CLASS}`,
]

/** <zh/> 从选择器串中提取类 token（`.a.b` → [`.a`, `.b`]） | <en/> Extract class tokens from a selector string */
function classTokens(selector: string): string[] {
  return selector.match(/\.[\w-]+/g) ?? []
}

describe('ep-selectors guard', () => {
  it('static constants share a source with the namespace builders', () => {
    expect(EP_TABLE_ROW_SELECTOR).toBe(epTableRow('el'))
    expect(EP_TABLE_V2_ROW_SELECTOR).toBe(epTableV2Row('el'))
    expect(EP_TABLE_V2_BODY_SELECTOR).toBe(epTableV2Body('el'))
    expect(EP_TABLE_BODY_WRAPPER_SELECTOR).toBe(epTableBodyWrapper('el'))
    expect(EP_TABLE_HEADER_WRAPPER_SELECTOR).toBe(epTableHeaderWrapper('el'))
    expect(EP_TABLE_V2_MAIN_SELECTOR).toBe(epTableV2Main('el'))
    expect(EP_TABLE_V2_ROW_CELL_SELECTOR).toBe(epTableV2RowCell('el'))
    expect(EP_TABLE_V2_HEADER_ROW_SELECTOR).toBe(epTableV2HeaderRow('el'))
    expect(EP_TABLE_V2_HEADER_SELECTOR).toBe(epTableV2Header('el'))
    expect(EP_TABLE_V2_HEADER_CELL_SELECTOR).toBe(epTableV2HeaderCell('el'))
    expect(EP_ROW_SELECTOR).toBe(`${EP_TABLE_V2_ROW_SELECTOR}, ${EP_TABLE_ROW_SELECTOR}`)
  })

  it('layout-critical classes exist in the current EP dist CSS', () => {
    const missing = new Set<string>()
    for (const selector of LAYOUT_CRITICAL) {
      for (const token of classTokens(selector)) {
        // <zh/> `.is-vertical` 等通用状态类放宽：非 EP 前缀的类不参与断言
        // <en/> Generic state classes like `.is-vertical` are relaxed: non-EP-prefixed classes are not asserted
        if (!token.startsWith('.el-'))
          continue
        if (!epCss.includes(token))
          missing.add(`${selector} → ${token}`)
      }
    }
    expect([...missing], `EP renamed layout-critical classes (absent from ${epCssPath}): ${[...missing].join(', ')}`).toEqual([])
  })

  it('unstyled-but-rendered classes are excluded by an explicit, still-valid list', () => {
    // <zh/> 排除清单本身也要与 EP 事实一致：这些类确实不在 dist CSS（若 EP 后续补了样式，断言会失败以提醒移除排除项）
    // <en/> The exclusion list must itself stay truthful: these classes are really absent from dist CSS; if EP
    // <en/> later styles them, this assertion fails and asks for the exclusion to be dropped
    for (const selector of RENDERED_BUT_UNSTYLED) {
      for (const token of classTokens(selector)) {
        if (!token.startsWith('.el-'))
          continue
        expect(epCss, `${token} is now styled by EP — drop it from RENDERED_BUT_UNSTYLED`).not.toContain(token)
      }
    }
  })

  it('custom namespaces keep the builder shape', () => {
    expect(epTableRow('foo')).toBe('.foo-table__row')
    expect(epTableV2Row('foo')).toBe('.foo-table-v2__row')
    expect(epTableV2Body('foo')).toBe('.foo-table-v2__body')
    expect(epScrollbarWrap('foo')).toBe('.foo-scrollbar__wrap')
  })

  it('class-emission builders share the static snapshots under the default namespace', () => {
    // <zh/> 发类构造器（无前导点）与静态常量同源：默认命名空间下二者拼出的类名一致；
    // <zh/> 自定义命名空间下构造器跟随（静态常量恒为 el- 前缀，禁止新代码引用）。
    // <en/> Class-emission builders (no leading dot) share the static snapshots: identical class
    // <en/> names under the default namespace; builders follow custom namespaces (the statics stay
    // <en/> el-prefixed forever — new code must not reference them).
    expect(`.${epTableExpandIcon('el')}`).toBe(`.${EP_EXPAND_ICON_CLASS}`)
    expect(`.${epTableExpandIconExpanded('el')}`).toBe(`.${EP_EXPAND_ICON_EXPANDED_CLASS}`)
    expect(`.${epTableIndent('el')}`).toBe(`.${EP_INDENT_CLASS}`)
    expect(epTableExpandIcon('foo')).toBe('foo-table__expand-icon')
    expect(epTableExpandIconExpanded('foo')).toBe('foo-table__expand-icon--expanded')
    expect(epTableExpandIconPlaceholder('foo')).toBe('foo-table__expand-icon--placeholder')
    expect(epTableIndent('foo')).toBe('foo-table__indent')
    expect(epIcon('foo')).toBe('foo-icon')
  })
})
