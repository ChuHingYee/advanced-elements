import type { UseV2ScrollApiReturn } from '../../../src/components/table-virtual-renderer/use-v2-scroll-api'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useV2ScrollTo } from '../../../src/components/table-virtual-renderer/use-v2-scroll-to'

/**
 * <zh/> 构造默认依赖 | <en/> Build default deps
 */
function createDeps(overrides: {
  keyToIndex?: Array<[string, number]>
  rows?: Array<{ key: string }>
  columns?: Array<{ width?: unknown, fixed?: unknown }>
  offsets?: number[]
  colKeyToIndex?: Array<[string, number]>
  scrollTop?: number
} = {}) {
  const {
    keyToIndex = [['r1', 0], ['r2', 1], ['r3', 2]],
    rows = [{ key: 'r1' }, { key: 'r2' }, { key: 'r3' }],
    columns = [{ width: 100 }, { width: 120 }, { width: 140 }],
    offsets = [0, 100, 220],
    colKeyToIndex = [['c1', 0], ['c2', 1], ['c3', 2]],
    scrollTop = 55,
  } = overrides

  const virtualKeyToIndex = computed(() => new Map<string, number>(keyToIndex))
  const dataWithAppend = computed(() => rows)
  const v2Columns = computed(() => columns)
  const v2ColumnOffsetCache = computed(() => ({
    offsets,
    keyToIndex: new Map<string, number>(colKeyToIndex),
  }))
  const currentScrollTop = ref(scrollTop)
  const v2ScrollApi = {
    scrollToRow: vi.fn(() => true),
    scrollTo: vi.fn(() => true),
    scrollToTop: vi.fn(() => true),
    hasScrollToTop: vi.fn(() => true),
    hasApi: vi.fn(() => true),
  } satisfies UseV2ScrollApiReturn

  const api = useV2ScrollTo({
    virtualKeyToIndex,
    dataWithAppend,
    v2Columns,
    v2ColumnOffsetCache,
    currentScrollTop,
    v2ScrollApi,
  })

  return { api, v2ScrollApi, currentScrollTop }
}

describe('useV2ScrollTo', () => {
  /**
   * <zh/> 非 auto behavior 仍委托，仅告警后忽略 | <en/> Non-auto behavior still delegates after warning
   */
  it('delegates scrollToRow even with non-auto behavior (devWarn path)', () => {
    /** <zh/> 压住控制台告警输出 | <en/> Silence console warning output */
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { api, v2ScrollApi } = createDeps()
      expect(api.scrollToRow('r2', { behavior: 'smooth' })).toBe(true)
      expect(v2ScrollApi.scrollToRow).toHaveBeenCalledWith(1, 'auto')
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  /**
   * <zh/> 未知行键返回 false 且不委托 | <en/> Unknown row key returns false without delegation
   */
  it('returns false for a missing row key (resolveRowIndex -1 branch)', () => {
    const { api, v2ScrollApi } = createDeps()
    expect(api.scrollToRow('missing')).toBe(false)
    expect(v2ScrollApi.scrollToRow).not.toHaveBeenCalled()
  })

  /**
   * <zh/> 索引越界返回 false 且不委托 | <en/> Out-of-range index returns false without delegation
   */
  it('returns false when the resolved index is out of range', () => {
    const { api, v2ScrollApi } = createDeps({
      keyToIndex: [['r-stale', 9]],
      rows: [{ key: 'r1' }, { key: 'r2' }],
    })
    expect(api.scrollToRow('r-stale')).toBe(false)
    expect(v2ScrollApi.scrollToRow).not.toHaveBeenCalled()
  })

  /**
   * <zh/> 有效行默认对齐 auto | <en/> Valid row uses default align auto
   */
  it('delegates valid rows with default align auto', () => {
    const { api, v2ScrollApi } = createDeps()
    expect(api.scrollToRow('r1')).toBe(true)
    expect(v2ScrollApi.scrollToRow).toHaveBeenCalledWith(0, 'auto')
  })

  /**
   * <zh/> 有效行透传自定义对齐 | <en/> Valid row forwards custom align
   */
  it('delegates valid rows with a custom align', () => {
    const { api, v2ScrollApi } = createDeps()
    expect(api.scrollToRow('r3', { align: 'center' })).toBe(true)
    expect(v2ScrollApi.scrollToRow).toHaveBeenCalledWith(2, 'center')
  })

  /**
   * <zh/> 固定列直接返回 true，不调用 scrollTo | <en/> Fixed column returns true without calling scrollTo
   */
  it('returns true for fixed columns without calling scrollTo', () => {
    const { api, v2ScrollApi } = createDeps({
      columns: [{ width: 100, fixed: true }, { width: 120 }, { width: 140 }],
    })
    expect(api.scrollToColumn('c1')).toBe(true)
    expect(v2ScrollApi.scrollTo).not.toHaveBeenCalled()
  })

  /**
   * <zh/> 未知列键返回 false | <en/> Unknown column key returns false
   */
  it('returns false for a missing column key', () => {
    const { api, v2ScrollApi } = createDeps()
    expect(api.scrollToColumn('missing')).toBe(false)
    expect(v2ScrollApi.scrollTo).not.toHaveBeenCalled()
  })

  /**
   * <zh/> 列索引越界返回 false | <en/> Column index out of range returns false
   */
  it('returns false when the column index exceeds the column count', () => {
    const { api, v2ScrollApi } = createDeps({
      columns: [{ width: 100 }],
      offsets: [0],
      colKeyToIndex: [['c-stale', 5]],
    })
    expect(api.scrollToColumn('c-stale')).toBe(false)
    expect(v2ScrollApi.scrollTo).not.toHaveBeenCalled()
  })

  /**
   * <zh/> 普通列按前缀和计算 scrollLeft 并保留 scrollTop | <en/> Normal column scrolls with prefix-sum offset and current scrollTop
   */
  it('scrolls normal columns with offsets[i] and current scrollTop', () => {
    const { api, v2ScrollApi } = createDeps({ scrollTop: 77 })
    expect(api.scrollToColumn('c3')).toBe(true)
    expect(v2ScrollApi.scrollTo).toHaveBeenCalledWith({ scrollLeft: 220, scrollTop: 77 })
  })
})
