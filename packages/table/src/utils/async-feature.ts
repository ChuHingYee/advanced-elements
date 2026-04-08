/**
 * <zh/> 异步功能域机制——同步壳 + 异步实现：setup 期返回同形契约，重量实现按门控或首次调用动态加载。
 * <en/> Async feature mechanism — sync shell + async implementation: setup returns the same-shaped contract
 * <en/> while heavy implementations load on gate or first use.
 *
 * @remarks
 * <zh/> 加载一次、并发合并、失败可重试（失败清缓存，下次调用重新加载）。
 * <zh/> 壳必须自持 setup 期资源（状态 ref、生命周期转发）；实现内不得依赖 setup 上下文。
 * <zh/> 与管线动态升级同一原则：setup 之外的自注册静默失效（见 composable-disposal 契约测试）。
 * <en/> Loads once, coalesces concurrent calls, retries after failure (failed loads clear the cache).
 * <en/> Shells own setup-time resources (status refs, lifecycle forwarding); implementations must not
 * <en/> rely on the setup context. Same principle as pipeline dynamic upgrades: post-setup
 * <en/> self-registration silently no-ops (see the composable-disposal contract tests).
 *
 * @example
 * ```ts
 * const loader = createAsyncLoader(() => import('./export-impl'))
 * const exportExcel = (...args) => loader.load().then(m => m.createExportImpl(opts).exportExcel(...args))
 * ```
 */
import type { Ref } from 'vue'
import { shallowRef } from 'vue'

/**
 * <zh/> 异步加载器——load 合并并发、失败可重试 | <en/> Async loader — coalesces concurrent loads, retries after failure
 */
export interface AsyncLoader<T> {
  /** <zh/> 加载（多次调用合并为一次在途请求） | <en/> Load (concurrent calls coalesce into one in-flight request) */
  load: () => Promise<T>
  /** <zh/> 是否已加载成功 | <en/> Whether loaded successfully */
  loaded: Ref<boolean>
  /** <zh/> 已加载的实现（未加载为 null，供生命周期转发） | <en/> Loaded implementation (null until loaded, for lifecycle forwarding) */
  current: Ref<T | null>
}

/**
 * <zh/> 创建异步加载器 | <en/> Create an async loader
 *
 * @param importer - <zh/> 动态 import 函数 | <en/> dynamic import function
 * @returns <zh/> 加载器 | <en/> loader
 */
export function createAsyncLoader<T>(importer: () => Promise<T>): AsyncLoader<T> {
  let cached: Promise<T> | null = null
  const loaded = shallowRef(false)
  const current = shallowRef<T | null>(null)
  function load(): Promise<T> {
    if (!cached) {
      cached = importer().then(
        (mod) => {
          loaded.value = true
          current.value = mod
          return mod
        },
        (err: unknown) => {
          cached = null
          throw err
        },
      )
    }
    return cached
  }
  return { load, loaded, current }
}

/**
 * <zh/> 在实现上调用方法——把壳方法转接到异步实现，参数与返回值（解包后）保持同形。
 * <en/> Invoke a method on the implementation — forwards a shell method to the async implementation,
 * <en/> keeping args and (unwrapped) return shape identical.
 *
 * @param load - <zh/> 加载器 load | <en/> loader load function
 * @param invoke - <zh/> 在实现上执行调用 | <en/> invocation against the implementation
 * @returns <zh/> 与实现同形（异步化）的方法 | <en/> same-shaped (async) method
 */
export function callWithImpl<T, A extends unknown[], R>(
  load: () => Promise<T>,
  invoke: (impl: T, ...args: A) => R,
): (...args: A) => Promise<Awaited<R>> {
  return ((...args: A) => load().then(impl => invoke(impl, ...args))) as unknown as (...args: A) => Promise<Awaited<R>>
}
