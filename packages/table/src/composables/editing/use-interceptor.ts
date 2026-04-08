import type { InterceptorConfig, InterceptorEvent, InterceptorSlotParams } from '../../types/interceptor'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> useInterceptor 选项
 * <en/> useInterceptor options
 *
 * @remarks
 * <zh/> 拦截器配置项的获取函数。interceptorConfig 返回当前组件实例的拦截器配置对象，用于在 trigger 时检查实例级拦截器
 * <en/> Getter for interceptor config. interceptorConfig returns the current component instance's interceptor config object, used to check instance-level interceptors during trigger
 */
export interface UseInterceptorOptions {
  /** <zh/> 获取当前组件实例的拦截器配置 | <en/> Get current component instance's interceptor config */
  interceptorConfig: () => InterceptorConfig | undefined
}

/**
 * <zh/> useInterceptor 返回值
 * <en/> useInterceptor return value
 *
 * @remarks
 * <zh/> 拦截器管理 API，可拦截键盘、编辑、点击等事件。仅提供 trigger 触发拦截链路，检查实例级拦截器配置
 * <en/> Interceptor management API, can intercept keyboard, edit, click, etc. events. Only provides trigger to run the interceptor chain, checking instance-level interceptor config
 */
export interface UseInterceptorReturn {
  /**
   * <zh/> 触发指定事件的拦截链路。检查实例级拦截器配置，任一返回 true 则短路并阻止后续操作
   * <en/> Trigger the interceptor chain for the specified event. Checks instance-level interceptor config, any return true short-circuits and prevents subsequent operations
   *
   * @param event - <zh/> 拦截事件名 | <en/> interceptor event name
   * @param params - <zh/> 事件参数 | <en/> event params
   * @returns <zh/> 是否被拦截（true = 阻止后续操作） | <en/> whether intercepted (true = prevent subsequent operations)
   */
  trigger: <E extends InterceptorEvent>(event: E, params: InterceptorSlotParams<E>) => boolean
  /**
   * <zh/> 契约：handler 必须为**同步**函数——返回值中的 Promise 不会被 await，真值语义按对象本身判定；
   * <zh/> 需要异步裁决的拦截器请改用事件级 await（如 visibleMethod），勿在 trigger handler 内 await。
   * <en/> Contract: handlers must be **synchronous** — returned Promises are not awaited;
   * <en/> for async vetoes use event-level awaitables (e.g. visibleMethod), never await inside a trigger handler.
   */
}

/**
 * <zh/> 事件拦截器组合式函数（纯实例级，无全局状态）
 *
 * <zh/> 拦截器管理，可拦截键盘、编辑、点击等事件。
 * <zh/>   仅检查通过 interceptorConfig prop 传入的实例级拦截器。
 * <zh/>   无模块级共享状态，天然避免跨实例泄漏和内存安全问题。
 * <zh/>   全局配置通过 useAdvConfig config-provider 传入，符合 Vue 生态惯例。
 *
 * @param options - <zh/> 拦截器配置 | <en/> interceptor config
 * @returns <zh/> 拦截器 API | <en/> interceptor API
 *
 * <en/> Event interceptor composable (instance-level only, no global state)
 *
 * <en/> Interceptor management, can intercept keyboard, edit, click and other events.
 * <en/>   Only checks instance-level interceptors passed via interceptorConfig prop.
 * <en/>   No module-level shared state, naturally avoids cross-instance leakage and memory safety issues.
 * <en/>   Global config is passed via useAdvConfig config-provider, following Vue ecosystem conventions.
 */
export function useInterceptor(options: UseInterceptorOptions): UseInterceptorReturn {
  const { interceptorConfig } = options

  function trigger<E extends InterceptorEvent>(event: E, params: InterceptorSlotParams<E>): boolean {
    const slot = interceptorConfig()?.[event]
    // <zh/> 单函数与数组同形：数组按序执行，首个 true 截断（存量单函数语义不变）
    // <en/> Single functions and arrays share one shape: arrays run in order with first-true-wins truncation (stock single-function semantics unchanged)
    const handlers = (Array.isArray(slot) ? slot : slot ? [slot] : []) as ((p: typeof params) => boolean | void)[]
    for (const handler of handlers) {
      try {
        if (handler(params) === true)
          return true
      }
      catch (err) {
        // <zh/> 拦截器异常不再中断整条链也不上抛到触发方（如 context-menu 的 mid-await 状态半成品）；
        // <zh/> dev 可观测，按"未拦截"继续。
        // <en/> A throwing interceptor no longer breaks the chain nor propagates into the trigger
        // <en/> site (which could leave half-finished state, e.g. mid-await in context-menu);
        // <en/> it is observable via devWarn and treated as "not intercepted".
        if (isDev)
          devWarn(`[AdvTable] interceptor for "${String(event)}" threw; continuing the chain.`, err)
      }
    }
    return false
  }

  return { trigger }
}
