/**
 * <zh/> 环境检测工具函数：统一判断当前运行环境是否为开发模式。
 * <zh/> 同时兼容 Node.js（process.env.NODE_ENV）与浏览器打包器（import.meta.env.DEV）。
 * <zh/> import.meta 在 CJS 产物中会被替换为空对象，因此必须使用可选链访问，避免空指针。
 *
 * <en/> Environment-detection helpers: uniformly decide whether the current runtime is dev mode.
 * <en/> Compatible with both Node.js (process.env.NODE_ENV) and browser bundlers (import.meta.env.DEV).
 * <en/> import.meta is replaced with an empty object in CJS output, so it must be accessed
 * <en/> via optional chaining to avoid null pointer errors.
 */

declare const process: { env: { NODE_ENV?: string } } | undefined

/**
 * <zh/> 当前是否为开发环境。
 * <en/> Whether the current environment is development.
 *
 * <zh/> Node.js / Webpack 通过 process.env.NODE_ENV !== 'production' 判断；
 * <zh/> 浏览器（Vite dev）通过 import.meta.env.DEV 判断；
 * <zh/> 两者都不可用（如浏览器原生 ESM 无打包器）则回退为 false。
 * <en/> In Node.js / Webpack it is decided by process.env.NODE_ENV !== 'production';
 * <en/> in the browser (Vite dev) by import.meta.env.DEV;
 * <en/> falls back to false when neither is available (e.g. browser native ESM without bundler).
 */
export const isDev: boolean = (
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : false
) || Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)

/**
 * <zh/> 是否浏览器环境（SSR 守卫）| <en/> Whether browser environment (SSR guard)
 */
export const isBrowser: boolean = typeof window !== 'undefined' && typeof document !== 'undefined'
