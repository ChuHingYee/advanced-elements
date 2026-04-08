import { describe, expect, it, vi } from 'vitest'
import { useV2ScrollApi } from '../../../src/components/table-virtual-renderer/use-v2-scroll-api'
import {
  EP_TABLE_V2_BODY_SELECTOR,
  EP_TABLE_V2_HEADER_CELL_SELECTOR,
  EP_TABLE_V2_HEADER_ROW_SELECTOR,
  EP_TABLE_V2_HEADER_SELECTOR,
  EP_TABLE_V2_MAIN_SELECTOR,
  EP_TABLE_V2_ROW_SELECTOR,
} from '../../../src/utils/ep-selectors'

describe('useV2ScrollApi', () => {
  it('delegates to the instance APIs when present', () => {
    const scrollTo = vi.fn()
    const scrollToRow = vi.fn()
    const api = useV2ScrollApi(() => ({ scrollTo, scrollToRow }))

    expect(api.hasApi()).toBe(true)
    expect(api.scrollTo({ scrollLeft: 10, scrollTop: 20 })).toBe(true)
    expect(scrollTo).toHaveBeenCalledWith({ scrollLeft: 10, scrollTop: 20 })
    expect(api.scrollToRow(5, 'center')).toBe(true)
    expect(scrollToRow).toHaveBeenCalledWith(5, 'center')
  })

  it('returns false without throwing when the instance or methods are missing', () => {
    expect(useV2ScrollApi(() => null).hasApi()).toBe(false)
    expect(useV2ScrollApi(() => null).scrollTo({ scrollLeft: 0, scrollTop: 0 })).toBe(false)
    expect(useV2ScrollApi(() => null).scrollToRow(0)).toBe(false)
    expect(useV2ScrollApi(() => ({})).scrollToRow(0)).toBe(false)
  })

  it('resolves the instance per call (remount-safe, never cached)', () => {
    const first = { scrollToRow: vi.fn() }
    const second = { scrollToRow: vi.fn() }
    let current: unknown = first
    const api = useV2ScrollApi(() => current)

    expect(api.scrollToRow(1)).toBe(true)
    expect(first.scrollToRow).toHaveBeenCalledTimes(1)
    current = second
    expect(api.scrollToRow(2)).toBe(true)
    expect(second.scrollToRow).toHaveBeenCalledTimes(1)
    expect(first.scrollToRow).toHaveBeenCalledTimes(1)
  })

  /**
   * <zh/> `scrollToTop` 收口回归——此前 `use-scroll-reconcile.ts` 自带一处内联
   * <zh/> `typeof v2.scrollToTop !== 'function'` 探针，EP 改名时该处会与本文件的探针**分别**失效，
   * <zh/> 形成两个回归点。现本文件是唯一探针位置，故此处钉死其行为。
   * <en/> `scrollToTop` consolidation regression — `use-scroll-reconcile.ts` used
   * <en/> to carry its own inline `typeof v2.scrollToTop !== 'function'` probe, so an EP rename would
   * <en/> break that site independently of this one, leaving two regression points. This file is now
   * <en/> the only probe location, so pin its behaviour here.
   */
  it('probes scrollToTop through the same centralized layer', () => {
    const scrollToTop = vi.fn()
    const api = useV2ScrollApi(() => ({ scrollTo }))

    expect(api.hasScrollToTop()).toBe(false)
    expect(api.scrollToTop(120)).toBe(false)
    expect(scrollToTop).not.toHaveBeenCalled()

    const withTop = useV2ScrollApi(() => ({ scrollTo, scrollToTop }))
    expect(withTop.hasScrollToTop()).toBe(true)
    expect(withTop.scrollToTop(120)).toBe(true)
    expect(scrollToTop).toHaveBeenCalledWith(120)
  })

  it('scrollToTop degrades to false without throwing on a null instance', () => {
    expect(useV2ScrollApi(() => null).hasScrollToTop()).toBe(false)
    expect(useV2ScrollApi(() => null).scrollToTop(0)).toBe(false)
  })

  it('phase 2-4: EP selectors stay centralized (no scattered literals)', () => {
    expect(EP_TABLE_V2_ROW_SELECTOR).toBe('.el-table-v2__row')
    expect(EP_TABLE_V2_BODY_SELECTOR).toBe('.el-table-v2__body')
    expect(EP_TABLE_V2_MAIN_SELECTOR).toBe('.el-table-v2__main')
    expect(EP_TABLE_V2_HEADER_ROW_SELECTOR).toBe('.el-table-v2__header-row')
    expect(EP_TABLE_V2_HEADER_SELECTOR).toBe('.el-table-v2__header')
    expect(EP_TABLE_V2_HEADER_CELL_SELECTOR).toBe('.el-table-v2__header-cell')
  })
})
