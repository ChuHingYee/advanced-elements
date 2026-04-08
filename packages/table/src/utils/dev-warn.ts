/**
 * @file dev-warn.ts
 * @description
 * <zh/> 开发期警告收敛工具——全库 dev-only 裸 `console.warn` 的唯一出口，实现日志通道收敛。
 *
 * <zh/> **设计原则**：
 * <zh/> 1. 运行时短路零日志开销（`isDev` 为运行时布尔，非常量，打包后调用保留但提前返回，非零体积）
 * <zh/> 2. 统一前缀 `[AdvTable]` 便于浏览器控制台过滤
 * <zh/> 3. 同一警告点仅告警一次（按消息去重），避免运行时刷屏
 * <zh/> 4. 纯同步、零依赖，可在任意工具函数/组合式内直接调用
 *
 * <en/> Dev-only warning convergence — the single exit for all dev-only `console.warn` calls
 * <en/> library-wide, implementing log channel convergence.
 *
 * <en/> **Design principles**:
 * <en/> 1. Zero log overhead via runtime short-circuit (`isDev` is a runtime boolean, not a constant; calls remain after bundling but return early)
 * <en/> 2. Unified `[AdvTable]` prefix for browser console filtering
 * <en/> 3. Each warning site warns at most once (deduped by message) to avoid runtime spam
 * <en/> 4. Pure sync, zero deps — callable from any utility function / composable
 */
import { isDev } from './env'

/** <zh/> 已告警消息缓存（按消息去重） | <en/> Already-warned message cache (deduped by message) */
const warnedMessages = new Set<string>()

/**
 * <zh/> 输出开发期警告——运行时短路，生产无日志输出但调用保留；同一消息仅告警一次。
 * <en/> Emit a dev-only warning — runtime short-circuit, no production output but calls remain; each message warns once.
 *
 * @param message - <zh/> 警告消息 | <en/> warning message
 * @param args - <zh/> 附加参数 | <en/> additional arguments
 */
export function devWarn(message: string, ...args: unknown[]): void {
  if (!isDev)
    return
  if (warnedMessages.has(message))
    return
  warnedMessages.add(message)
  if (typeof console !== 'undefined') {
    console.warn(`[AdvTable] ${message}`, ...args)
  }
}

/**
 * <zh/> 输出开发期警告（无去重）——每次调用都输出，适用于需要重复告警的场景。
 * <en/> Emit a dev-only warning (no dedup) — fires every call, for cases needing repeated warnings.
 *
 * @param message - <zh/> 警告消息 | <en/> warning message
 * @param args - <zh/> 附加参数 | <en/> additional arguments
 */
export function devWarnRepeat(message: string, ...args: unknown[]): void {
  if (!isDev)
    return
  if (typeof console !== 'undefined') {
    console.warn(`[AdvTable] ${message}`, ...args)
  }
}

/** <zh/> 测试辅助——清空去重缓存 | <en/> Test helper — clear the dedupe cache */
export function resetDevWarnCacheForTests(): void {
  warnedMessages.clear()
}
