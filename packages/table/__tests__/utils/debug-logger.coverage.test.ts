import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createDebugLogger } from '../../src/utils/debug-logger'

/**
 * <zh/> debug-logger 覆盖测试——验证配置解析、门控、计时与域绑定。
 * <en/> debug-logger coverage tests — config resolution, gating, timing, and scoping.
 */
describe('createDebugLogger coverage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>
  // <zh/> 保存原始 performance，每测例后恢复，避免污染全局。
  // <en/> Save the original performance; restore after each test to avoid leaking globals.
  let originalPerformance: typeof globalThis.performance

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    originalPerformance = globalThis.performance
    logSpy.mockClear()
    warnSpy.mockClear()
    errorSpy.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    globalThis.performance = originalPerformance
    vi.unstubAllGlobals()
  })

  /**
   * <zh/> 以纯对象替换 globalThis.performance，便于断言 mark/measure 调用。
   * <en/> Replace globalThis.performance with a plain mock to assert mark/measure calls.
   */
  function stubPerformance(mock: Record<string, unknown>) {
    Object.defineProperty(globalThis, 'performance', {
      value: mock,
      configurable: true,
      writable: true,
    })
  }

  /**
   * <zh/> 配置解析与 isEnabled。
   * <en/> Config resolution and isEnabled.
   */
  describe('config resolution', () => {
    it('undefined resolves to disabled / <zh/> undefined 解析为禁用', () => {
      const logger = createDebugLogger(undefined, 't1')
      expect(logger.isEnabled.value).toBe(false)
      logger.log('data', 'msg')
      expect(logSpy).not.toHaveBeenCalled()
    })

    it('boolean true enables / <zh/> 布尔 true 表示启用', () => {
      const logger = createDebugLogger(true, 't1')
      expect(logger.isEnabled.value).toBe(true)
      logger.log('data', 'hello')
      expect(logSpy).toHaveBeenCalledTimes(1)
    })

    it('boolean false disables / <zh/> 布尔 false 表示禁用', () => {
      const logger = createDebugLogger(false, 't1')
      expect(logger.isEnabled.value).toBe(false)
      logger.log('data', 'hello')
      expect(logSpy).not.toHaveBeenCalled()
    })

    it('object passthrough preserves flags / <zh/> 对象透传保留开关', () => {
      const enabled = createDebugLogger({ enabled: true }, 't1')
      expect(enabled.isEnabled.value).toBe(true)
      const disabled = createDebugLogger({ enabled: false }, 't1')
      expect(disabled.isEnabled.value).toBe(false)
      const noFlag = createDebugLogger({}, 't1')
      expect(noFlag.isEnabled.value).toBe(false)
    })

    it('supports ref and getter configs / <zh/> 支持 ref 与 getter 配置', () => {
      const refLogger = createDebugLogger(ref({ enabled: true }), 't1')
      expect(refLogger.isEnabled.value).toBe(true)
      const getterLogger = createDebugLogger(() => true, 't1')
      expect(getterLogger.isEnabled.value).toBe(true)
      const falseGetter = createDebugLogger(() => false, 't1')
      expect(falseGetter.isEnabled.value).toBe(false)
    })
  })

  /**
   * <zh/> log 门控：禁用、空域、包含/排除。
   * <en/> log gating: disabled, empty domains, included/excluded.
   */
  describe('log gating', () => {
    it('disabled log stays silent / <zh/> 禁用时 log 静默', () => {
      const logger = createDebugLogger({ enabled: false }, 't1')
      logger.log('data', 'msg')
      expect(logSpy).not.toHaveBeenCalled()
    })

    it('omitted domains logs all / <zh/> 未传 domains 时全域输出', () => {
      const logger = createDebugLogger({ enabled: true }, 't1')
      logger.log('edit', 'msg')
      expect(logSpy).toHaveBeenCalledTimes(1)
    })

    it('empty domains logs all / <zh/> 空数组 domains 时全域输出', () => {
      const logger = createDebugLogger({ enabled: true, domains: [] }, 't1')
      logger.log('render', 'msg')
      expect(logSpy).toHaveBeenCalledTimes(1)
    })

    it('included domain logs / <zh/> 命中域时输出', () => {
      const logger = createDebugLogger({ enabled: true, domains: ['data'] }, 't1')
      logger.log('data', 'msg')
      expect(logSpy).toHaveBeenCalledTimes(1)
    })

    it('excluded domain stays silent / <zh/> 非命中域时静默', () => {
      const logger = createDebugLogger({ enabled: true, domains: ['data'] }, 't1')
      logger.log('edit', 'msg')
      expect(logSpy).not.toHaveBeenCalled()
    })
  })

  /**
   * <zh/> warn 门控与 log 一致。
   * <en/> warn gating matches log.
   */
  describe('warn gating', () => {
    it('disabled warn stays silent / <zh/> 禁用时 warn 静默', () => {
      const logger = createDebugLogger(false, 't1')
      logger.warn('data', 'msg')
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('enabled warn logs / <zh/> 启用时 warn 输出', () => {
      const logger = createDebugLogger({ enabled: true }, 't1')
      logger.warn('selection', 'msg', { a: 1 })
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0][3]).toBe('msg')
    })

    it('excluded domain warn stays silent / <zh/> 非命中域 warn 静默', () => {
      const logger = createDebugLogger({ enabled: true, domains: ['edit'] }, 't1')
      logger.warn('data', 'msg')
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('included domain warn logs / <zh/> 命中域 warn 输出', () => {
      const logger = createDebugLogger({ enabled: true, domains: ['edit'] }, 't1')
      logger.warn('edit', 'msg')
      expect(warnSpy).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * <zh/> error 即使禁用也输出，但仍受域过滤约束。
   * <en/> error outputs even when disabled, but still honors domain filter.
   */
  describe('error gating', () => {
    it('error outputs when disabled / <zh/> 禁用时 error 仍输出', () => {
      const logger = createDebugLogger({ enabled: false }, 't1')
      logger.error('data', 'boom')
      expect(errorSpy).toHaveBeenCalledTimes(1)
    })

    it('error outputs for undefined config / <zh/> undefined 配置下 error 仍输出', () => {
      const logger = createDebugLogger(undefined, 't1')
      logger.error('data', 'boom')
      expect(errorSpy).toHaveBeenCalledTimes(1)
    })

    it('error silent on excluded domain / <zh/> 非命中域 error 静默', () => {
      const logger = createDebugLogger({ enabled: false, domains: ['edit'] }, 't1')
      logger.error('data', 'boom')
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('error silent on excluded domain when enabled / <zh/> 启用但域排除时 error 静默', () => {
      const logger = createDebugLogger({ enabled: true, domains: ['edit'] }, 't1')
      logger.error('data', 'boom')
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('error logs on included domain / <zh/> 命中域 error 输出', () => {
      const logger = createDebugLogger({ enabled: false, domains: ['data'] }, 't1')
      logger.error('data', 'boom')
      expect(errorSpy).toHaveBeenCalledTimes(1)
    })

    it('error logs for empty domains / <zh/> 空 domains 时 error 输出', () => {
      const logger = createDebugLogger({ enabled: false, domains: [] }, 't1')
      logger.error('render', 'boom')
      expect(errorSpy).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * <zh/> 前缀与样式：首参包含 tableId 与域。
   * <en/> Prefix and style: first args contain tableId and domain.
   */
  describe('prefix and style', () => {
    it('log prefix contains tableId and domain / <zh/> log 前缀包含表 ID 与域', () => {
      const logger = createDebugLogger({ enabled: true }, 't-prefix')
      logger.log('data', 'hello', { x: 1 })
      expect(logSpy).toHaveBeenCalledTimes(1)
      const args = logSpy.mock.calls[0]
      expect(String(args[0])).toContain('t-prefix')
      expect(String(args[0])).toContain('data')
      // <zh/> data 域颜色；第三参固定，第四参为消息正文。
      // <en/> data domain color; third arg fixed, fourth is the message body.
      expect(String(args[1])).toContain('#42b883')
      expect(args[2]).toBe('color: inherit;')
      expect(args[3]).toBe('hello')
      expect(args[4]).toEqual({ x: 1 })
    })

    it('warn prefix contains tableId and domain / <zh/> warn 前缀包含表 ID 与域', () => {
      const logger = createDebugLogger({ enabled: true }, 'warn-table')
      logger.warn('edit', 'careful')
      const args = warnSpy.mock.calls[0]
      expect(String(args[0])).toContain('warn-table')
      expect(String(args[0])).toContain('edit')
      expect(String(args[1])).toContain('#e67e22')
    })

    it('error prefix contains tableId and domain / <zh/> error 前缀包含表 ID 与域', () => {
      const logger = createDebugLogger({ enabled: false }, 'err-table')
      logger.error('lifecycle', 'bad')
      const args = errorSpy.mock.calls[0]
      expect(String(args[0])).toContain('err-table')
      expect(String(args[0])).toContain('lifecycle')
    })
  })

  /**
   * <zh/> time 早退与成功路径。
   * <en/> time early-returns and success path.
   */
  describe('time', () => {
    it('early-returns when disabled / <zh/> 禁用时直接返回', () => {
      const mark = vi.fn()
      stubPerformance({ mark } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: false, perf: true }, 't1')
      logger.time('data', 'sort')
      expect(mark).not.toHaveBeenCalled()
    })

    it('early-returns when perf false / <zh/> perf 关闭时直接返回', () => {
      const mark = vi.fn()
      stubPerformance({ mark } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true, perf: false }, 't1')
      logger.time('data', 'sort')
      expect(mark).not.toHaveBeenCalled()
    })

    it('early-returns when perf omitted / <zh/> 未传 perf 时直接返回', () => {
      const mark = vi.fn()
      stubPerformance({ mark } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true }, 't1')
      logger.time('data', 'sort')
      expect(mark).not.toHaveBeenCalled()
    })

    it('early-returns on excluded domain / <zh/> 非命中域时直接返回', () => {
      const mark = vi.fn()
      stubPerformance({ mark } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true, perf: true, domains: ['edit'] }, 't1')
      logger.time('data', 'sort')
      expect(mark).not.toHaveBeenCalled()
    })

    it('early-returns when performance undefined / <zh/> 无 performance 时静默返回', () => {
      Object.defineProperty(globalThis, 'performance', {
        value: undefined,
        configurable: true,
        writable: true,
      })
      const logger = createDebugLogger({ enabled: true, perf: true }, 't1')
      expect(() => logger.time('data', 'sort')).not.toThrow()
    })

    it('marks start on success / <zh/> 成功时打点 start', () => {
      const mark = vi.fn()
      stubPerformance({ mark } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true, perf: true }, 'my-table')
      logger.time('data', 'sort')
      expect(mark).toHaveBeenCalledTimes(1)
      expect(mark).toHaveBeenCalledWith('advtable:my-table:data:sort:start')
    })
  })

  /**
   * <zh/> timeEnd 早退、成功、空结果与异常路径。
   * <en/> timeEnd early-returns, success, empty-result, and catch paths.
   */
  describe('timeEnd', () => {
    it('early-returns when disabled / <zh/> 禁用时直接返回', () => {
      const mark = vi.fn()
      const measure = vi.fn()
      stubPerformance({ mark, measure } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: false, perf: true }, 't1')
      logger.timeEnd('data', 'sort')
      expect(mark).not.toHaveBeenCalled()
      expect(measure).not.toHaveBeenCalled()
      expect(logSpy).not.toHaveBeenCalled()
    })

    it('early-returns when perf false / <zh/> perf 关闭时直接返回', () => {
      const mark = vi.fn()
      stubPerformance({ mark } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true, perf: false }, 't1')
      logger.timeEnd('data', 'sort')
      expect(mark).not.toHaveBeenCalled()
      expect(logSpy).not.toHaveBeenCalled()
    })

    it('early-returns on excluded domain / <zh/> 非命中域时直接返回', () => {
      const mark = vi.fn()
      stubPerformance({ mark } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true, perf: true, domains: ['edit'] }, 't1')
      logger.timeEnd('data', 'sort')
      expect(mark).not.toHaveBeenCalled()
      expect(logSpy).not.toHaveBeenCalled()
    })

    it('early-returns when performance undefined / <zh/> 无 performance 时静默返回', () => {
      Object.defineProperty(globalThis, 'performance', {
        value: undefined,
        configurable: true,
        writable: true,
      })
      const logger = createDebugLogger({ enabled: true, perf: true }, 't1')
      expect(() => logger.timeEnd('data', 'sort')).not.toThrow()
      expect(logSpy).not.toHaveBeenCalled()
    })

    it('success with history clears measures then logs / <zh/> 有历史记录时先清理再输出', () => {
      const mark = vi.fn()
      const measure = vi.fn()
      const clearMarks = vi.fn()
      const clearMeasures = vi.fn()
      const getEntriesByName = vi
        .fn()
        .mockReturnValueOnce([{ duration: 1 }])
        .mockReturnValueOnce([{ duration: 12.345 }])
      stubPerformance({ mark, measure, getEntriesByName, clearMarks, clearMeasures } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true, perf: true }, 't1')
      logger.timeEnd('data', 'sort')
      expect(mark).toHaveBeenCalledWith('advtable:t1:data:sort:end')
      expect(clearMeasures).toHaveBeenCalledWith('advtable:t1:data:sort')
      expect(measure).toHaveBeenCalledWith('advtable:t1:data:sort', 'advtable:t1:data:sort:start', 'advtable:t1:data:sort:end')
      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(String(logSpy.mock.calls[0][3])).toContain('sort')
      expect(String(logSpy.mock.calls[0][3])).toContain('ms')
      expect(clearMarks).toHaveBeenCalledWith('advtable:t1:data:sort:start')
      expect(clearMarks).toHaveBeenCalledWith('advtable:t1:data:sort:end')
    })

    it('success without history skips clearMeasures / <zh/> 无历史记录时跳过清理', () => {
      const mark = vi.fn()
      const measure = vi.fn()
      const clearMarks = vi.fn()
      const clearMeasures = vi.fn()
      const getEntriesByName = vi
        .fn()
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ duration: 7.891 }])
      stubPerformance({ mark, measure, getEntriesByName, clearMarks, clearMeasures } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true, perf: true }, 't1')
      logger.timeEnd('data', 'sort')
      expect(clearMeasures).not.toHaveBeenCalled()
      expect(measure).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(clearMarks).toHaveBeenCalledTimes(2)
    })

    it('empty measure result logs nothing / <zh/> 无测量结果时不输出', () => {
      const mark = vi.fn()
      const measure = vi.fn()
      const clearMarks = vi.fn()
      const clearMeasures = vi.fn()
      const getEntriesByName = vi.fn().mockReturnValue([])
      stubPerformance({ mark, measure, getEntriesByName, clearMarks, clearMeasures } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true, perf: true }, 't1')
      logger.timeEnd('data', 'sort')
      expect(measure).toHaveBeenCalledTimes(1)
      expect(logSpy).not.toHaveBeenCalled()
      expect(clearMarks).not.toHaveBeenCalled()
    })

    it('measure throw stays silent / <zh/> 测量抛错时静默', () => {
      const mark = vi.fn()
      const measure = vi.fn().mockImplementation(() => {
        throw new Error('no such mark')
      })
      const clearMarks = vi.fn()
      const clearMeasures = vi.fn()
      const getEntriesByName = vi.fn().mockReturnValue([])
      stubPerformance({ mark, measure, getEntriesByName, clearMarks, clearMeasures } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true, perf: true }, 't1')
      expect(() => logger.timeEnd('data', 'sort')).not.toThrow()
      expect(logSpy).not.toHaveBeenCalled()
    })
  })

  /**
   * <zh/> scoped 绑定透传到对应域方法。
   * <en/> Scoped bindings forward to the matching domain methods.
   */
  describe('scoped', () => {
    it('scoped log/warn forward with bound domain / <zh/> 域内 log/warn 透传', () => {
      const logger = createDebugLogger({ enabled: true }, 'scoped-table')
      const scoped = logger.scoped('data')
      scoped.log('hello')
      scoped.warn('careful')
      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(String(logSpy.mock.calls[0][0])).toContain('scoped-table')
      expect(String(logSpy.mock.calls[0][0])).toContain('data')
      expect(String(warnSpy.mock.calls[0][0])).toContain('data')
    })

    it('scoped error outputs even when disabled / <zh/> 禁用时域内 error 仍输出', () => {
      const logger = createDebugLogger({ enabled: false }, 'scoped-table')
      const scoped = logger.scoped('edit')
      scoped.error('boom')
      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(String(errorSpy.mock.calls[0][0])).toContain('edit')
    })

    it('scoped excluded domain stays silent / <zh/> 域外 scoped 调用静默', () => {
      const logger = createDebugLogger({ enabled: true, domains: ['data'] }, 't1')
      const scoped = logger.scoped('edit')
      scoped.log('hello')
      expect(logSpy).not.toHaveBeenCalled()
    })

    it('scoped time/timeEnd forward to performance / <zh/> 域内计时透传', () => {
      const mark = vi.fn()
      const measure = vi.fn()
      const clearMarks = vi.fn()
      const clearMeasures = vi.fn()
      const getEntriesByName = vi
        .fn()
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ duration: 3.21 }])
      stubPerformance({ mark, measure, getEntriesByName, clearMarks, clearMeasures } as unknown as Record<string, unknown>)
      const logger = createDebugLogger({ enabled: true, perf: true }, 't-scope')
      const scoped = logger.scoped('render')
      scoped.time('paint')
      expect(mark).toHaveBeenCalledWith('advtable:t-scope:render:paint:start')
      scoped.timeEnd('paint')
      expect(measure).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(String(logSpy.mock.calls[0][0])).toContain('render')
    })
  })
})
