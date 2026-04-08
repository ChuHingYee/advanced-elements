/**
 * @file notification.ts
 * @description
 * <zh/> 表格通知通道抽象——消除 composable 对 ElMessage 的硬依赖，
 * <zh/> 消费方可通过 globalConfig.notify 注入自定义通知实现。
 *
 * <en/> Table notification channel abstraction — eliminates hard dependency
 * <en/> on ElMessage in composables. Consumers can inject custom notification
 * <en/> implementations via globalConfig.notify.
 */

import { ElMessage } from 'element-plus'

/**
 * <zh/> 表格通知类型 | <en/> Table notification type
 */
export type TableNotificationType = 'success' | 'warning' | 'error' | 'info'

/**
 * <zh/> 通知通道函数——由消费方注入自定义实现 | <en/> Notification channel function — consumer injects custom implementation
 *
 * @param type - <zh/> 通知类型 | <en/> notification type
 * @param message - <zh/> 通知消息 | <en/> notification message
 * @param source - <zh/> 通知来源标识（'editing' | 'copy' | 'print' | 'import' | 'export'） | <en/> source identifier
 */
export type NotifyFn = (type: TableNotificationType, message: string, source: string) => void

/**
 * <zh/> 默认通知通道——直接使用 ElMessage，行为与原代码完全一致
 *
 * <zh/> 设计决策：使用静态导入而非动态导入——通知是同步行为，不应有 microtask 延迟。
 * <zh/> SSR 场景下 ElMessage 自身有 DOM 守卫，调用不会崩溃但不会显示——与原代码行为一致。
 * <zh/> 额外 try/catch 作为安全网：若 ElMessage 在某些环境抛出异常，降级到 console。
 *
 * <en/> Default notification channel — uses ElMessage directly, behavior identical to original code
 * <en/> Design decision: static import instead of dynamic — notifications are synchronous, no microtask delay.
 * <en/> Under SSR, ElMessage has its own DOM guard; calls won't crash but won't display — same as original.
 * <en/> Additional try/catch as a safety net: if ElMessage throws in some environments, degrade to console.
 *
 * @returns NotifyFn
 */
export function createDefaultNotify(): NotifyFn {
  return (type, message, _source) => {
    try {
      ElMessage({ message, type })
    }
    catch {
      // <zh/> SSR 或 ElMessage 未注册时的降级——统一走 console.warn（no-console 仅放行 warn/error）
      // <en/> Fallback for SSR or unregistered ElMessage — unified via console.warn (no-console allows warn/error only)

      const fn = type === 'error' ? console.error : console.warn
      fn(`[AdvTable] ${message}`)
    }
  }
}

/**
 * <zh/> 从全局配置创建通知通道——未配置时降级到默认通道 | <en/> Create notify from global config, fallback to default
 *
 * @param globalTableConfig - <zh/> 全局表格配置对象 | <en/> global table config object
 * @returns NotifyFn
 */
export function resolveNotify(globalTableConfig: Record<string, any> | undefined): NotifyFn {
  const injected = globalTableConfig?.notify as NotifyFn | undefined
  return injected ?? createDefaultNotify()
}
