/**
 * Tests for `use-interceptor` — instance-level interceptor handlers.
 */
import type { InterceptorConfig } from '../../src/types/interceptor'
import { describe, expect, it, vi } from 'vitest'
import { useInterceptor } from '../../src/composables/editing/use-interceptor'

describe('use-interceptor', () => {
  describe('useInterceptor', () => {
    it('returns false when no handler is registered for the event', () => {
      const { trigger } = useInterceptor({ interceptorConfig: () => undefined })
      expect(trigger('event.rowClick', { rowData: {}, rowIndex: 0, event: new Event('click') })).toBe(false)
    })

    it('returns true when instance handler returns true', () => {
      const handler = vi.fn(() => true) as any
      const config: InterceptorConfig = { 'event.rowClick': handler }
      const { trigger } = useInterceptor({ interceptorConfig: () => config })
      const result = trigger('event.rowClick', { rowData: {}, rowIndex: 0, event: new Event('click') })
      expect(handler).toHaveBeenCalledTimes(1)
      expect(result).toBe(true)
    })

    it('returns false when instance handler returns false', () => {
      const handler = vi.fn(() => false) as any
      const config: InterceptorConfig = { 'event.rowClick': handler }
      const { trigger } = useInterceptor({ interceptorConfig: () => config })
      expect(trigger('event.rowClick', { rowData: {}, rowIndex: 0, event: new Event('click') })).toBe(false)
    })

    it('returns false when instance handler returns undefined (void)', () => {
      const handler = vi.fn(() => undefined) as any
      const config: InterceptorConfig = { 'event.rowClick': handler }
      const { trigger } = useInterceptor({ interceptorConfig: () => config })
      expect(trigger('event.rowClick', { rowData: {}, rowIndex: 0, event: new Event('click') })).toBe(false)
    })

    it('re-checks the config getter on each trigger (reactive read)', () => {
      let cfg: InterceptorConfig | undefined
      const { trigger } = useInterceptor({ interceptorConfig: () => cfg })
      expect(trigger('event.rowClick', { rowData: {}, rowIndex: 0, event: new Event('click') })).toBe(false)

      const handler = vi.fn(() => true) as any
      cfg = { 'event.rowClick': handler }
      expect(trigger('event.rowClick', { rowData: {}, rowIndex: 0, event: new Event('click') })).toBe(true)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('runs handler arrays in order with first-true-wins truncation', () => {
      const order: string[] = []
      const first = vi.fn((): void => {
        order.push('first')
      }) as any
      const second = vi.fn(() => true) as any
      const third = vi.fn((): void => {
        order.push('third')
      }) as any
      const config: InterceptorConfig = { 'event.rowClick': [first, second, third] }
      const { trigger } = useInterceptor({ interceptorConfig: () => config })
      expect(trigger('event.rowClick', { rowData: {}, rowIndex: 0, event: new Event('click') })).toBe(true)
      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
      expect(third).not.toHaveBeenCalled()
      expect(order).toEqual(['first'])
    })

    it('array of all-non-true handlers returns false and runs all', () => {
      const first = vi.fn(() => undefined) as any
      const second = vi.fn(() => false) as any
      const config: InterceptorConfig = { 'event.rowClick': [first, second] }
      const { trigger } = useInterceptor({ interceptorConfig: () => config })
      expect(trigger('event.rowClick', { rowData: {}, rowIndex: 0, event: new Event('click') })).toBe(false)
      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
    })

    it('returns false when no handler at all is registered', () => {
      const { trigger } = useInterceptor({ interceptorConfig: () => undefined })
      const result = trigger('event.export', { filename: 'test' })
      expect(result).toBe(false)
    })

    it('passes params to the handler', () => {
      const handler = vi.fn(() => true) as any
      const config: InterceptorConfig = { 'event.rowClick': handler }
      const { trigger } = useInterceptor({ interceptorConfig: () => config })
      const event = new Event('click')
      const params = { rowData: { id: 1 }, rowIndex: 0, event }
      trigger('event.rowClick', params)
      expect(handler).toHaveBeenCalledWith(params)
    })

    it('supports all InterceptorEvent keys without type errors', () => {
      const handler = vi.fn(() => false) as any
      const { trigger } = useInterceptor({
        interceptorConfig: () => ({
          'event.keydown': handler,
          'event.clearEdit': handler,
          'event.showMenu': handler,
          'event.export': handler,
          'event.cellClick': handler,
          'event.cellDblclick': handler,
          'event.rowClick': handler,
          'event.headerClick': handler,
          'event.sortChange': handler,
          'edit.start': handler,
          'edit.stop': handler,
          'edit.commit': handler,
        }),
      })
      // Just verify all event keys compile and are routed through
      expect(() => trigger('event.keydown', {} as any)).not.toThrow()
      expect(() => trigger('edit.commit', {} as any)).not.toThrow()
    })
  })
})
