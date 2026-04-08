/**
 * <zh/> 安全回归 — 单元格渲染 XSS 防护
 * <en/> Security regression — cell render XSS protection
 *
 * @remarks
 * <zh/> `resolveCellText` / `valueToText` 应对 `<script>` 等标签做转义，`cellRenderer` 返回的 `VNode` 不应 `innerHTML` 直接注入
 * <en/> `resolveCellText` / `valueToText` should escape `<script>` etc., `cellRenderer` VNode should not direct innerHTML
 */
import { describe, expect, it } from 'vitest'
import { escapeHtml } from '../../src/utils/print'
import { sanitizeUrl } from '../../src/utils/security'

describe('security xss', () => {
  it('escapeHtml escapes script tag', () => {
    const input = '<script>alert(1)</script>'
    const escaped = escapeHtml(input)
    expect(escaped).not.toContain('<script>')
    expect(escaped).toContain('&lt;script&gt;')
  })

  it('sanitizeUrl blocks javascript: protocol', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com')
    expect(sanitizeUrl('/relative/path')).toBe('/relative/path')
  })

  it('sanitizeUrl blocks data:/vbscript: executable protocols', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(sanitizeUrl('DATA:text/html;base64,PHNjcmlwdD4=')).toBe('')
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('')
    expect(sanitizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com')
  })

  it('value with html chars is escaped in print', () => {
    const val = '<b>bold</b>'
    const escaped = escapeHtml(val)
    expect(escaped).toBe('&lt;b&gt;bold&lt;/b&gt;')
  })
})
