import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useUrlState } from '../../src/composables/data/use-url-state'

/**
 * useUrlState tests.
 * Router context is injected directly via the optional 3rd parameter —
 * no module mocking needed.
 */
const mockRouterReplace = vi.fn()
const mockRoute = {
  path: '/test',
  query: { p: '1', s: '10' },
}
const mockRouterContext = {
  router: { replace: mockRouterReplace },
  route: mockRoute,
}

describe('useUrlState composable', () => {
  beforeEach(() => {
    mockRouterReplace.mockClear()
  })

  describe('basic functionality', () => {
    it('should return setPageLog and initFromUrl functions', () => {
      const isManual = ref(false)

      const result = useUrlState({ enabled: false }, isManual)

      expect(typeof result.setPageLog).toBe('function')
      expect(typeof result.initFromUrl).toBe('function')
    })

    it('should return empty result from initFromUrl when disabled', () => {
      const isManual = ref(false)

      const { initFromUrl } = useUrlState({ enabled: false }, isManual)
      const result = initFromUrl()

      expect(result).toEqual({})
    })

    it('should parse page and size from URL query', () => {
      const isManual = ref(false)

      const { initFromUrl } = useUrlState({ enabled: true, pageKey: 'p', sizeKey: 's' }, isManual, mockRouterContext)
      const result = initFromUrl()

      // mockRouterContext has query: { p: '1', s: '10' }
      expect(result).toEqual({ page: 1, size: 10 })
    })

    it('should not throw when setPageLog is called without router', () => {
      const isManual = ref(false)

      const { setPageLog } = useUrlState({ enabled: true }, isManual)

      expect(() => setPageLog(1, 10)).not.toThrow()
    })
  })

  describe('reactive options', () => {
    it('should support getter functions for options', () => {
      const enabled = ref(false)
      const isManual = ref(false)

      const { initFromUrl } = useUrlState(
        {
          enabled: () => enabled.value,
          pageKey: () => 'page',
          sizeKey: () => 'limit',
        },
        isManual,
        mockRouterContext,
      )

      // disabled
      expect(initFromUrl()).toEqual({})

      // enable — reads from mockRouterContext query { p: '1', s: '10' }
      enabled.value = true
      // custom pageKey/sizeKey ('page'/'limit') don't match mock query keys ('p'/'s')
      expect(initFromUrl()).toEqual({ page: undefined, size: undefined })
    })

    it('should return empty result in manual mode', () => {
      const isManual = ref(true)

      const { initFromUrl } = useUrlState({ enabled: true }, isManual)
      const result = initFromUrl()

      expect(result).toEqual({})
    })

    it('should skip setPageLog in manual mode', () => {
      const isManual = ref(true)

      const { setPageLog } = useUrlState({ enabled: true }, isManual)

      // Should not throw; in manual mode, setPageLog is a no-op
      expect(() => setPageLog(2, 20)).not.toThrow()
    })

    it('should skip setPageLog when disabled', () => {
      const isManual = ref(false)

      const { setPageLog } = useUrlState({ enabled: false }, isManual)

      expect(() => setPageLog(2, 20)).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle invalid page param (non-numeric)', () => {
      const isManual = ref(false)
      // Use a route with non-numeric 'p' to test parsePositiveInt
      const ctx = { router: mockRouterContext.router, route: { path: '/test', query: { p: 'abc', s: '10' } } }
      const { initFromUrl } = useUrlState({ enabled: true, pageKey: 'p', sizeKey: 's' }, isManual, ctx)
      const result = initFromUrl()
      expect(result.page).toBeUndefined()
    })

    it('should handle negative page param', () => {
      const isManual = ref(false)
      const ctx = { router: mockRouterContext.router, route: { path: '/test', query: { p: '-1', s: '10' } } }
      const { initFromUrl } = useUrlState({ enabled: true, pageKey: 'p', sizeKey: 's' }, isManual, ctx)
      const result = initFromUrl()
      expect(result.page).toBeUndefined()
    })

    it('should handle zero page param', () => {
      const isManual = ref(false)
      const ctx = { router: mockRouterContext.router, route: { path: '/test', query: { p: '0', s: '10' } } }
      const { initFromUrl } = useUrlState({ enabled: true, pageKey: 'p', sizeKey: 's' }, isManual, ctx)
      const result = initFromUrl()
      expect(result.page).toBeUndefined()
    })

    it('should return empty when route is missing', () => {
      // Without router context and no getCurrentInstance mock, initFromUrl returns {}
      const isManual = ref(false)
      const { initFromUrl } = useUrlState({ enabled: true, pageKey: 'x', sizeKey: 'y' }, isManual)
      const result = initFromUrl()
      expect(result.page).toBeUndefined()
      expect(result.size).toBeUndefined()
    })

    it('setPageLog should work with valid router', async () => {
      const isManual = ref(false)
      const { setPageLog } = useUrlState({ enabled: true, pageKey: 'p', sizeKey: 's' }, isManual, mockRouterContext)
      setPageLog(2, 20)
      // setPageLog uses microtask debouncing — await flush before asserting
      await Promise.resolve()
      expect(mockRouterReplace).toHaveBeenCalledTimes(1)
      expect(mockRouterReplace).toHaveBeenCalledWith({
        path: '/test',
        query: expect.objectContaining({ p: '2', s: '20' }),
      })
    })

    it('setPageLog should preserve existing query params', async () => {
      const isManual = ref(false)
      const ctx = {
        router: { replace: mockRouterReplace },
        route: { path: '/list', query: { p: '1', s: '10', keyword: 'test' } },
      }
      const { setPageLog } = useUrlState({ enabled: true, pageKey: 'p', sizeKey: 's' }, isManual, ctx)
      setPageLog(3, 50)
      // setPageLog uses microtask debouncing — await flush before asserting
      await Promise.resolve()
      const callArgs = mockRouterReplace.mock.calls[0][0]
      expect(callArgs.query.keyword).toBe('test')
      expect(callArgs.query.p).toBe('3')
      expect(callArgs.query.s).toBe('50')
    })

    it('setPageLog should use custom pageKey and sizeKey', async () => {
      const isManual = ref(false)
      const ctx = {
        router: { replace: mockRouterReplace },
        route: { path: '/test', query: { page: '1', limit: '10' } },
      }
      const { setPageLog } = useUrlState({ enabled: true, pageKey: 'page', sizeKey: 'limit' }, isManual, ctx)
      setPageLog(5, 25)
      // setPageLog uses microtask debouncing — await flush before asserting
      await Promise.resolve()
      expect(mockRouterReplace).toHaveBeenCalledWith({
        path: '/test',
        query: expect.objectContaining({ page: '5', limit: '25' }),
      })
    })

    it('initFromUrl should handle float page value as invalid', () => {
      const isManual = ref(false)
      const ctx = { router: mockRouterContext.router, route: { path: '/test', query: { p: '3.5', s: '10' } } }
      const { initFromUrl } = useUrlState({ enabled: true, pageKey: 'p', sizeKey: 's' }, isManual, ctx)
      const result = initFromUrl()
      expect(result.page).toBeUndefined()
      expect(result.size).toBe(10)
    })

    it('initFromUrl should handle empty string params', () => {
      const isManual = ref(false)
      const ctx = { router: mockRouterContext.router, route: { path: '/test', query: { p: '', s: '' } } }
      const { initFromUrl } = useUrlState({ enabled: true, pageKey: 'p', sizeKey: 's' }, isManual, ctx)
      const result = initFromUrl()
      expect(result.page).toBeUndefined()
      expect(result.size).toBeUndefined()
    })

    it('initFromUrl should use custom pageKey and sizeKey', () => {
      const isManual = ref(false)
      const ctx = {
        router: mockRouterContext.router,
        route: { path: '/test', query: { page: '3', limit: '25' } },
      }
      const { initFromUrl } = useUrlState({ enabled: true, pageKey: 'page', sizeKey: 'limit' }, isManual, ctx)
      const result = initFromUrl()
      expect(result.page).toBe(3)
      expect(result.size).toBe(25)
    })
  })
})
