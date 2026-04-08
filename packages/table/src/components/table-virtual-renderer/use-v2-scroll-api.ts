/**
 * <zh/> ElTableV2 程序化滚动 API 收敛层
 * <zh/> scrollTo/scrollToRow 在运行时存在，但 EP 的组件实例类型未声明——各调用点禁止散落
 * <zh/> `(v2 as any)` 探测，否则 EP 改名即静默失效且无法单点回归。此处集中做运行时探测，
 * <zh/> 不可用时返回 false 由调用方降级（注意：禁止用 DOM scrollLeft 降级，EP 程序化滚动
 * <zh/> 状态不同步，直接写 DOM 会导致内外状态分裂）。
 * <en/> Centralized ElTableV2 programmatic-scroll API probing.
 * <en/> scrollTo/scrollToRow exist at runtime but are missing from EP's component instance types —
 * <en/> scattered `(v2 as any)` probes at call sites are forbidden: they silently break
 * <en/> on an EP rename with no single regression point. Probing is centralized here; unavailability
 * <en/> returns false for callers to degrade (never fall back to DOM scrollLeft — EP's programmatic
 * <en/> scroll state would desync from direct DOM writes).
 */
export interface ElTableV2ScrollApi {
  scrollTo?: (options: { scrollLeft?: number, scrollTop?: number }) => void
  scrollToRow?: (rowIndex: number, align?: 'auto' | 'start' | 'center' | 'end') => void
  /**
   * <zh/> 单轴滚动快捷方法——同样未在 EP 实例类型中声明，但运行时存在。
   * <zh/> 收口于此的原因：`use-scroll-reconcile` 原先自带一处 `typeof v2.scrollToTop !== 'function'`
   * <zh/> 内联探针，EP 改名时该处会与本文件的探针**分别**失效，形成两个回归点。
   * <en/> Single-axis scroll shortcut — also undeclared in EP's instance types but present at runtime.
   * <en/> Lives here because `use-scroll-reconcile` used to carry its own inline
   * <en/> `typeof v2.scrollToTop !== 'function'` probe, so an EP rename would break that site
   * <en/> independently of this one, leaving two regression points.
   */
  scrollToTop?: (top: number) => void
}

export interface UseV2ScrollApiReturn {
  /** <zh/> 程序化滚动，未可用返回 false | <en/> Programmatic scroll, false when unavailable */
  scrollTo: (options: { scrollLeft: number, scrollTop: number }) => boolean
  /** <zh/> 按渲染索引滚动到行，未可用返回 false | <en/> Scroll to a row by render index, false when unavailable */
  scrollToRow: (rowIndex: number, align?: 'auto' | 'start' | 'center' | 'end') => boolean
  /** <zh/> 滚动到指定 scrollTop，未可用返回 false | <en/> Scroll to a scrollTop, false when unavailable */
  scrollToTop: (top: number) => boolean
  /** <zh/> `scrollToTop` 是否可用 | <en/> Whether `scrollToTop` is available */
  hasScrollToTop: () => boolean
  /** <zh/> 任一滚动 API 是否可用 | <en/> Whether any scroll API is available */
  hasApi: () => boolean
}

/**
 * <zh/> 创建 V2 滚动 API 探针——每次调用时探测（实例在重挂载前后会变化，不可缓存）。
 * <en/> Create the V2 scroll API probe — resolved per call (the instance changes across remounts, never cache it).
 */
export function useV2ScrollApi(getInstance: () => unknown): UseV2ScrollApiReturn {
  function resolve(): ElTableV2ScrollApi | null {
    const instance = getInstance() as ElTableV2ScrollApi | null
    return instance ?? null
  }

  return {
    scrollTo(options) {
      const v2 = resolve()
      if (!v2 || typeof v2.scrollTo !== 'function')
        return false
      v2.scrollTo(options)
      return true
    },
    scrollToRow(rowIndex, align = 'auto') {
      const v2 = resolve()
      if (!v2 || typeof v2.scrollToRow !== 'function')
        return false
      v2.scrollToRow(rowIndex, align)
      return true
    },
    scrollToTop(top) {
      const v2 = resolve()
      if (!v2 || typeof v2.scrollToTop !== 'function')
        return false
      v2.scrollToTop(top)
      return true
    },
    hasScrollToTop() {
      const v2 = resolve()
      return !!v2 && typeof v2.scrollToTop === 'function'
    },
    hasApi() {
      const v2 = resolve()
      return !!v2 && (typeof v2.scrollTo === 'function' || typeof v2.scrollToRow === 'function')
    },
  }
}
