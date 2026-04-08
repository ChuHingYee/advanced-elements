/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { ADV_TABLE_ROW_KEY_ATTR } from '../../src/constants'
import { readRowKeyAttr, rowKeyAttrSelector } from '../../src/utils/row-key-attr'

/**
 * <zh/> 行 key 读取收口回归。
 *
 * <zh/> 该模式此前在 4 文件 8 处独立书写（`getAttribute(ATTR) || querySelector('[ATTR]')?.getAttribute(ATTR)`），
 * <zh/> 属性名字面量另有 7+ 处硬编码。行 key 域一旦变更，漏改的那处表现为**拖拽错位 / 定位跳行**——
 * <zh/> 不报错、只错位，排查成本极高。故把「自身 → 后代」的解析顺序与常量取值钉死在此。
 * <en/> Row-key read consolidation regression .
 *
 * <en/> The pattern used to be hand-written in 8 places across 4 files, with the attribute literal
 * <en/> hardcoded in 7+ more. When the row-key domain changes, a missed site shows up as **drag
 * <en/> misalignment / locate jumping to the wrong row** — silent and expensive to diagnose. So the
 * <en/> "self, then descendant" resolution order and the constant are pinned here.
 */
describe('readRowKeyAttr', () => {
  it('reads the marker from the element itself (default renderer puts it on <tr>)', () => {
    const tr = document.createElement('tr')
    tr.setAttribute(ADV_TABLE_ROW_KEY_ATTR, 'r1')
    expect(readRowKeyAttr(tr)).toBe('r1')
  })

  it('falls back to the first descendant carrying the marker (virtual renderer puts it on a cell)', () => {
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    td.setAttribute(ADV_TABLE_ROW_KEY_ATTR, 'r2')
    tr.appendChild(td)
    expect(readRowKeyAttr(tr)).toBe('r2')
  })

  it('prefers the element over a descendant when both carry a marker', () => {
    const tr = document.createElement('tr')
    tr.setAttribute(ADV_TABLE_ROW_KEY_ATTR, 'own')
    const td = document.createElement('td')
    td.setAttribute(ADV_TABLE_ROW_KEY_ATTR, 'nested')
    tr.appendChild(td)
    expect(readRowKeyAttr(tr)).toBe('own')
  })

  it('returns null (not an empty string) when no marker exists', () => {
    // <zh/> 调用方据此区分「没有标记」与「标记值为空串」——行 key 允许为空串时语义不同。
    // <en/> Callers rely on distinguishing "no marker" from "marker is the empty string" — those
    // <en/> differ in meaning since an empty row key is technically allowed.
    expect(readRowKeyAttr(document.createElement('tr'))).toBeNull()
    const empty = document.createElement('tr')
    empty.setAttribute(ADV_TABLE_ROW_KEY_ATTR, '')
    expect(readRowKeyAttr(empty)).toBe('')
  })

  it('returns null for a null/undefined element instead of throwing', () => {
    expect(readRowKeyAttr(null)).toBeNull()
    expect(readRowKeyAttr(undefined)).toBeNull()
  })

  it('honours a custom attribute name', () => {
    const el = document.createElement('div')
    el.setAttribute('data-custom-key', 'k1')
    expect(readRowKeyAttr(el, 'data-custom-key')).toBe('k1')
    expect(readRowKeyAttr(el)).toBeNull()
  })

  it('resolves the marker through a self-closing ancestor (summary rows render <td/>)', () => {
    // <zh/> 合计行等场景下候选祖先可能是自闭合标签，故必须用 querySelector 而非 firstElementChild。
    // <en/> For summary rows the candidate ancestor can be a void tag, so this must use
    // <en/> querySelector rather than firstElementChild.
    const host = document.createElement('div')
    host.innerHTML = '<span data-adv-table-row-key="r9"></span>'
    expect(readRowKeyAttr(host)).toBe('r9')
  })
})

describe('rowKeyAttrSelector', () => {
  it('builds an exact-match selector from the constant', () => {
    expect(rowKeyAttrSelector('r1')).toBe(`[${ADV_TABLE_ROW_KEY_ATTR}="r1"]`)
  })

  it('escapes quotes and backslashes so data-derived keys cannot break out of the selector', () => {
    // <zh/> rowKey 来自使用者数据，含引号时若不转义会抛 SyntaxError 或误匹配他人行。
    // <en/> rowKey comes from consumer data; an unescaped quote would throw SyntaxError or match the
    // <en/> wrong row.
    const selector = rowKeyAttrSelector('a"b')
    expect(() => document.querySelector(selector)).not.toThrow()
    expect(selector).not.toBe(`[${ADV_TABLE_ROW_KEY_ATTR}="a"b"]`)
  })

  it('supports a custom attribute name', () => {
    expect(rowKeyAttrSelector('k', 'data-x')).toBe('[data-x="k"]')
  })
})
