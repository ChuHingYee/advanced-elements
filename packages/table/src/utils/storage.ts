/**
 * <zh/> Web Storage 访问的包内唯一通道（持久化策略·静态守卫覆盖点）。
 * <zh/> 包内除默认适配器实现外，任何功能路径不得直连 Web Storage。
 * <en/> The in-package single gateway to Web Storage (persistence strategy, static guard coverage point).
 * <en/> No feature path within this package may directly access Web Storage except the default adapter implementation.
 */
import type { AdvTableStorageAdapter } from '../types/column-state'

/**
 * <zh/> Web Storage 可用性探测——SSR / 隐私模式下 localStorage 可能未定义或访问即抛错，
 * <zh/> 此时降级返回 null，使默认适配器静默空转而非每次调用都产生错误噪音。
 * <en/> Web Storage availability probe — in SSR / privacy mode localStorage may be undefined
 * <en/> or throw on access; returns null so the default adapter silently no-ops
 * <en/> instead of producing error noise on every call in storage-less environments.
 */
export function getWebStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  }
  catch {
    return null
  }
}

/**
 * <zh/> sessionStorage 可用性探测——与 localStorage 对称，SSR/隐私模式下静默降级
 * <en/> sessionStorage availability probe — symmetric to localStorage, silent in SSR/privacy mode
 */
export function getSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  }
  catch {
    return null
  }
}

/**
 * <zh/> 默认 localStorage 存储适配器（带 SSR/隐私模式探测 + 异常静默降级）。
 * <zh/> 值域为 string，序列化职责上移至消费方。
 * <en/> Default localStorage storage adapter (SSR / privacy-mode probing + silent degradation).
 * <en/> String-valued; serialization responsibility is lifted to consumers.
 */
export const localStorageAdapter: AdvTableStorageAdapter = {
  get: (key: string): string | null => {
    try {
      const storage = getWebStorage()
      return storage ? storage.getItem(key) : null
    }
    catch {
      return null
    }
  },
  set: (key: string, value: string): void => {
    try {
      getWebStorage()?.setItem(key, value)
    }
    catch {
      // QuotaExceededError / SecurityError in privacy mode — silent degrade (mirrors get)
    }
  },
  remove: (key: string): void => {
    try {
      getWebStorage()?.removeItem(key)
    }
    catch {
      // Privacy mode / storage disabled — silent degrade
    }
  },
}

/**
 * <zh/> sessionStorage 适配器——与 localStorageAdapter 对称，供 rowExpand persistence 复用
 * <en/> sessionStorage adapter — symmetric to localStorageAdapter, for rowExpand persistence
 */
export const sessionStorageAdapter: AdvTableStorageAdapter = {
  get: (key: string): string | null => {
    try {
      const storage = getSessionStorage()
      return storage ? storage.getItem(key) : null
    }
    catch {
      return null
    }
  },
  set: (key: string, value: string): void => {
    try {
      getSessionStorage()?.setItem(key, value)
    }
    catch {
      // QuotaExceededError / SecurityError — silent degrade
    }
  },
  remove: (key: string): void => {
    try {
      getSessionStorage()?.removeItem(key)
    }
    catch {
      // storage disabled — silent degrade
    }
  },
}
