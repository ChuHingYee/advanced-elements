import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScrollToRowColumn } from '../../src/composables/scrolling/use-scroll-to-row-column'

/**
 * <zh/> 滚动定位单测——覆盖缺失 API、透传、双轴入口与虚拟 behavior 告警。
 * <en/> Scroll-to tests — missing api, delegation, dual-axis entry and virtual behavior warn.
 */
describe('useScrollToRowColumn', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false without a scroll api', () => {
    const api = useScrollToRowColumn({ caps: { smoothScroll: true }, getScrollApi: () => null })
    expect(api.scrollToRow('1')).toBe(false)
    expect(api.scrollToColumn('a')).toBe(false)
    expect(api.scrollTo({})).toBe(true)
  })

  it('delegates to the active renderer api', () => {
    const scrollToRow = vi.fn(() => true)
    const scrollToColumn = vi.fn(() => false)
    const api = useScrollToRowColumn({ caps: { smoothScroll: true }, getScrollApi: () => ({ scrollToRow, scrollToColumn }) as any })
    expect(api.scrollToRow('1', { align: 'top' } as any)).toBe(true)
    expect(scrollToRow).toHaveBeenCalledWith('1', { align: 'top' })
    expect(api.scrollToColumn('a')).toBe(false)
  })

  it('combines row and column in one call', () => {
    const api = useScrollToRowColumn({
      caps: { smoothScroll: true },
      getScrollApi: () => ({ scrollToRow: () => true, scrollToColumn: () => true }) as any,
    })
    expect(api.scrollTo({ row: '1', column: 'a' })).toBe(true)
    const failing = useScrollToRowColumn({
      caps: { smoothScroll: true },
      getScrollApi: () => ({ scrollToRow: () => false, scrollToColumn: () => true }) as any,
    })
    expect(failing.scrollTo({ row: '1', column: 'a' })).toBe(false)
  })

  it('warns on non-auto behavior without smooth support', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = useScrollToRowColumn({
      caps: { smoothScroll: false },
      getScrollApi: () => ({ scrollToRow: vi.fn(() => true) }) as any,
    })
    api.scrollToRow('1', { behavior: 'smooth' } as any)
    expect(warn).toHaveBeenCalled()
    warn.mockClear()
    api.scrollToRow('1', { behavior: 'auto' } as any)
    expect(warn).not.toHaveBeenCalled()
  })
})
