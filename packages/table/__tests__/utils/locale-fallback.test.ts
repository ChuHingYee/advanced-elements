import { describe, expect, it, vi } from 'vitest'
import { tf } from '../../src/utils/locale-fallback'

describe('tf', () => {
  it('returns the translated text when t is provided', () => {
    const t = vi.fn((key: string) => `T:${key}`)

    expect(tf(t, 'table.copy.success', '复制成功')).toBe('T:table.copy.success')
    expect(t).toHaveBeenCalledTimes(1)
    expect(t).toHaveBeenCalledWith('table.copy.success')
  })

  it('falls back to the Chinese literal when t is undefined', () => {
    expect(tf(undefined, 'table.copy.success', '复制成功')).toBe('复制成功')
  })

  it('falls back to the Chinese literal when t returns a non-string (missing key)', () => {
    const t = vi.fn(() => undefined as unknown as string)

    expect(tf(t, 'table.summary', '合计')).toBe('合计')
  })

  it('prefers the translated text over the fallback in both directions', () => {
    const t = (key: string) => (key === 'table.filter.and' ? 'AND' : 'MISSING')

    expect(tf(t, 'table.filter.and', '且')).toBe('AND')
    // 未提供 t 时始终是回退文案，保证裸用工具函数的场景不出现 undefined
    // Without t the fallback text always wins, so bare util usage never renders undefined
    expect(tf(undefined, 'table.filter.and', '且')).toBe('且')
  })
})
