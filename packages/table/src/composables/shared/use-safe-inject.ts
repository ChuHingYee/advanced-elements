import type { InjectionKey } from 'vue'
import { inject } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> 安全注入——在开发模式下，当注入值为 undefined 时发出控制台警告
 *
 * <zh/> 保留 undefined 兜底以避免生产崩溃，仅 dev 警告提示组件使用上下文缺失。
 *
 * <en/> Safe inject — emits a console warning in dev mode when the injected value is undefined
 *
 * <en/> Keeps the undefined fallback to avoid production crashes, adding only a dev-mode
 * <en/> warning for missing component context.
 *
 * @param key - <zh/> InjectionKey | <en/> InjectionKey
 * @param componentName - <zh/> 调用方组件名，用于警告信息 | <en/> caller component name for the warning
 * @returns <zh/> 注入值（可能为 undefined） | <en/> injected value (may be undefined)
 */
export function useSafeInject<T>(key: InjectionKey<T>, componentName: string): T | undefined {
  const val = inject(key, undefined as unknown as T)
  if (isDev && val === undefined) {
    const keyDesc = typeof key === 'symbol' ? key.description : String(key)
    devWarn(
      `[AdvTable] ${componentName} injected undefined for "${keyDesc}". `
      + 'This component must be used inside <AdvTable>.',
    )
  }
  return val
}
