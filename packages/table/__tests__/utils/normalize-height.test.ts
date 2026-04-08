import { describe, expect, it, vi } from 'vitest'
import { resetDevWarnCacheForTests } from '../../src/utils/dev-warn'
import { normalizeTableHeight } from '../../src/utils/normalize-height'

describe('normalizeTableHeight', () => {
  it('passes through legal heights untouched', () => {
    expect(normalizeTableHeight(320)).toBe(320)
    expect(normalizeTableHeight('320px')).toBe('320px')
    expect(normalizeTableHeight('50vh')).toBe('50vh')
    expect(normalizeTableHeight('50%')).toBe('50%')
    expect(normalizeTableHeight('  320px  ')).toBe('  320px  ')
    expect(normalizeTableHeight('calc(100% - 10px)')).toBe('calc(100% - 10px)')
    expect(normalizeTableHeight(undefined)).toBeUndefined()
  })

  it('falls back to undefined with a one-time dev warning on illegal heights', () => {
    resetDevWarnCacheForTests()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normalizeTableHeight(-100)).toBeUndefined()
    expect(normalizeTableHeight(0)).toBeUndefined()
    expect(normalizeTableHeight('abc')).toBeUndefined()
    expect(normalizeTableHeight(Number.NaN)).toBeUndefined()
    // <zh/> 垃圾后缀不再被 parseFloat 静默接受 | <en/> Garbage suffixes are no longer silently accepted via parseFloat
    expect(normalizeTableHeight('50abc')).toBeUndefined()
    expect(normalizeTableHeight('0px')).toBeUndefined()
    expect(normalizeTableHeight('')).toBeUndefined()
    // <zh/> 同一非法值去重，不同值各自告警一次 | <en/> Same illegal value deduped, distinct values warn once each
    expect(normalizeTableHeight(-100)).toBeUndefined()
    const messages = warnSpy.mock.calls.map(args => String(args[0]))
    expect(messages.filter(m => m.includes('-100'))).toHaveLength(1)
    expect(messages.filter(m => m.includes('"abc"'))).toHaveLength(1)
    warnSpy.mockRestore()
  })
})
