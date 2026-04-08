import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useUrlState } from '../../src/composables/data/use-url-state'

describe('useUrlState', () => {
  const mockRouter = {
    replace: vi.fn(),
  }
  const mockRoute = {
    path: '/test',
    query: { p: '2', s: '20' },
  }
  const isManual = ref(false)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads from URL on init', () => {
    const { initFromUrl } = useUrlState({ enabled: true }, isManual, {
      router: mockRouter,
      route: mockRoute,
    })
    const result = initFromUrl()
    expect(result).toEqual({ page: 2, size: 20 })
  })

  it('writes changes to URL', async () => {
    const { setPageLog } = useUrlState({ enabled: true }, isManual, {
      router: mockRouter,
      route: mockRoute,
    })
    setPageLog(3, 50)
    // setPageLog uses microtask debouncing — await flush before asserting
    await Promise.resolve()
    // Duplicate keys in object literal: last one wins
    expect(mockRouter.replace).toHaveBeenCalledWith({
      path: '/test',
      query: { p: '3', s: '50' },
    })
  })

  it('custom key names', async () => {
    const { initFromUrl, setPageLog } = useUrlState({
      enabled: true,
      pageKey: 'page',
      sizeKey: 'size',
    }, isManual, {
      router: mockRouter,
      route: { path: '/test', query: { page: '3', size: '15' } },
    })
    expect(initFromUrl()).toEqual({ page: 3, size: 15 })

    // Wait for isInitializing guard to reset (initFromUrl sets it, microtask clears it)
    await Promise.resolve()

    setPageLog(4, 25)
    // setPageLog uses microtask debouncing — await flush before asserting
    await Promise.resolve()
    expect(mockRouter.replace).toHaveBeenCalledWith({
      path: '/test',
      query: { page: '4', size: '25' },
    })
  })

  it('disabled mode', () => {
    const { initFromUrl, setPageLog } = useUrlState({ enabled: false }, isManual, {
      router: mockRouter,
      route: mockRoute,
    })
    expect(initFromUrl()).toEqual({})
    setPageLog(1, 10)
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('missing params fallback', () => {
    const { initFromUrl } = useUrlState({ enabled: true }, isManual, {
      router: mockRouter,
      route: { path: '/test', query: {} },
    })
    const result = initFromUrl()
    expect(result.page).toBeUndefined()
    expect(result.size).toBeUndefined()
  })

  it('no router: gracefully degrades', () => {
    const { initFromUrl, setPageLog } = useUrlState({ enabled: true }, isManual)
    expect(initFromUrl()).toEqual({})
    setPageLog(1, 10)
    // no throw
  })

  it('invalid URL params return undefined', () => {
    const { initFromUrl } = useUrlState({ enabled: true }, isManual, {
      router: mockRouter,
      route: { path: '/test', query: { p: 'abc', s: '-1' } },
    })
    const result = initFromUrl()
    expect(result.page).toBeUndefined()
    expect(result.size).toBeUndefined()
  })

  it('isManual skips URL operations', () => {
    const manual = ref(true)
    const { initFromUrl, setPageLog } = useUrlState({ enabled: true }, manual, {
      router: mockRouter,
      route: mockRoute,
    })
    expect(initFromUrl()).toEqual({})
    setPageLog(1, 10)
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('uses default keys when not specified', () => {
    const { initFromUrl } = useUrlState({ enabled: true }, isManual, {
      router: mockRouter,
      route: { path: '/test', query: { p: '5', s: '25' } },
    })
    const result = initFromUrl()
    expect(result).toEqual({ page: 5, size: 25 })
  })
})
