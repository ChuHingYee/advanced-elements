import type { TableError, TableErrorCode } from '../../src/types/error'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTableErrorHandler } from '../../src/utils/error-handler'

function createEmit() {
  return vi.fn()
}

describe('createTableErrorHandler', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  describe('handleError', () => {
    it('emits error event for warn severity and logs via console.warn when dev mode enabled', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { tableId: 't1', enableDevLog: true })

      handler('TABLE_SORT_WORKER_FAILED', { cause: new Error('boom') })

      expect(emit).toHaveBeenCalledTimes(1)
      const [event, payload, tid] = emit.mock.calls[0]
      expect(event).toBe('error')
      expect(payload.code).toBe('TABLE_SORT_WORKER_FAILED')
      expect(payload.severity).toBe('warn')
      expect(payload.cause).toBeInstanceOf(Error)
      expect(payload.suggestion).toBeDefined()
      expect(tid).toBe('t1')
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('emits error event and uses console.error for error severity even when dev mode disabled', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: false })

      handler('TABLE_REQUEST_FAILED')

      expect(emit).toHaveBeenCalledTimes(1)
      expect(emit.mock.calls[0][1].severity).toBe('error')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('does not emit error event for info severity', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: true })

      handler('TABLE_MODE_SWITCHED', { cause: { from: 'default', to: 'virtual' } })

      expect(emit).not.toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalled()
    })

    it('does not log when severity is warn and dev mode disabled', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: false })

      handler('TABLE_SORT_WORKER_FAILED')

      expect(emit).toHaveBeenCalledTimes(1)
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('does not log when severity is info and dev mode disabled', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: false })

      handler('TABLE_MODE_SWITCHED')

      expect(emit).not.toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('uses default suggestion from TABLE_ERROR_CODES when not provided', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: true })

      handler('TABLE_EXPORT_FAILED')

      const payload: TableError = emit.mock.calls[0][1]
      expect(payload.suggestion).toBe('检查导出权限、文件写入或磁盘空间。')
    })

    it('uses caller-provided suggestion over default', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: true })

      handler('TABLE_EXPORT_FAILED', { suggestion: 'custom suggestion' })

      const payload: TableError = emit.mock.calls[0][1]
      expect(payload.suggestion).toBe('custom suggestion')
    })

    it('passes through field from extra', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: true })

      handler('TABLE_EDIT_VALIDATION_FAILED', { field: 'age' })

      const payload: TableError = emit.mock.calls[0][1]
      expect(payload.field).toBe('age')
    })

    it('omits cause detail in log when cause is null/undefined', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: true })

      handler('TABLE_REQUEST_FAILED')

      const logged = consoleErrorSpy.mock.calls[0][0] as string
      expect(logged).not.toContain('cause:')
    })

    it('includes cause detail in log when cause is provided', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: true })

      handler('TABLE_REQUEST_FAILED', { cause: 'network down' })

      const logged = consoleErrorSpy.mock.calls[0][0] as string
      expect(logged).toContain('cause: network down')
    })

    it('skips tableId prefix when not provided', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: true })

      handler('TABLE_REQUEST_FAILED')

      const logged = consoleErrorSpy.mock.calls[0][0] as string
      expect(logged.startsWith('[AdvTable] ')).toBe(true)
      expect(logged).not.toContain('[AdvTable:')
    })

    it('skips emit and logs console.error for unknown error code (runtime fallback)', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: true })

      // Cast to bypass TS - testing runtime fallback for unregistered codes
      handler('UNKNOWN_CODE' as TableErrorCode, { cause: 'x' })

      expect(emit).not.toHaveBeenCalled()
      // <zh/> 未知码永不静默：console.error（production-visible），不进 error 事件流
      // <en/> Unknown codes are never silent: console.error (production-visible), never in the error stream
      expect(consoleErrorSpy).toHaveBeenCalled()
      const logged = consoleErrorSpy.mock.calls[0][0] as string
      expect(logged).toContain('Unknown table error code')
    })

    it('still logs console.error for unknown error code when dev mode disabled', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: false })

      handler('UNKNOWN_CODE' as TableErrorCode)

      expect(emit).not.toHaveBeenCalled()
      // <zh/> 拼错的 code 在生产必须可见 | <en/> A misspelled code must be visible in production
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe('devWarn', () => {
    it('logs warning when dev mode enabled', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { tableId: 't1', enableDevLog: true })

      handler.devWarn('some warning', { extra: 1 })

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      const [message, ...args] = consoleWarnSpy.mock.calls[0]
      expect(message).toContain('[AdvTable:t1]')
      expect(message).toContain('some warning')
      expect(args).toEqual([{ extra: 1 }])
    })

    it('does not log when dev mode disabled', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: false })

      handler.devWarn('some warning')

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe('i18n integration', () => {
    it('uses i18n translations when t function is provided', () => {
      const emit = createEmit()
      const mockT = vi.fn((path: string) => {
        if (path === 'error.TABLE_EXPORT_FAILED.message')
          return 'Data export failed (EN)'
        if (path === 'error.TABLE_EXPORT_FAILED.suggestion')
          return 'Check export permissions (EN)'
        return path
      })
      const handler = createTableErrorHandler(emit, { enableDevLog: true, t: mockT })

      handler('TABLE_EXPORT_FAILED')

      const payload: TableError = emit.mock.calls[0][1]
      expect(payload.suggestion).toBe('Check export permissions (EN)')
      const logged = consoleErrorSpy.mock.calls[0][0] as string
      expect(logged).toContain('Data export failed (EN)')
    })

    it('falls back to hardcoded defaults when i18n key is not found', () => {
      const emit = createEmit()
      // Simulate a locale that does not have the error section — t returns the path itself
      const mockT = vi.fn((path: string) => path)
      const handler = createTableErrorHandler(emit, { enableDevLog: true, t: mockT })

      handler('TABLE_EXPORT_FAILED')

      const payload: TableError = emit.mock.calls[0][1]
      expect(payload.suggestion).toBe('检查导出权限、文件写入或磁盘空间。')
    })

    it('falls back to hardcoded defaults when t function is not provided', () => {
      const emit = createEmit()
      const handler = createTableErrorHandler(emit, { enableDevLog: true })

      handler('TABLE_EXPORT_FAILED')

      const payload: TableError = emit.mock.calls[0][1]
      expect(payload.suggestion).toBe('检查导出权限、文件写入或磁盘空间。')
    })

    it('caller-provided suggestion takes priority over i18n suggestion', () => {
      const emit = createEmit()
      const mockT = vi.fn((path: string) => {
        if (path === 'error.TABLE_EXPORT_FAILED.suggestion')
          return 'i18n suggestion'
        return path
      })
      const handler = createTableErrorHandler(emit, { enableDevLog: true, t: mockT })

      handler('TABLE_EXPORT_FAILED', { suggestion: 'caller suggestion' })

      const payload: TableError = emit.mock.calls[0][1]
      expect(payload.suggestion).toBe('caller suggestion')
    })
  })
})
