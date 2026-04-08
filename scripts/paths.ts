import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * <zh/> 仓库根目录解析——必须用 `import.meta` 系 API：本仓 `type` 为 ESM 语义，
 * <zh/> `__dirname` 在原生 Node ESM 下未定义（曾导致 docsRoot 多跳一级）。
 * <en/> Resolve repo roots — must use `import.meta`-based APIs: this repo resolves
 * <en/> scripts as ESM, where `__dirname` is undefined under native Node (it once
 * <en/> made docsRoot resolve one level too high).
 */
const here = typeof import.meta.dirname === 'string'
  ? import.meta.dirname
  : dirname(fileURLToPath(import.meta.url))

/** <zh/> 仓库根目录 | <en/> repository root directory */
export const projRoot = resolve(here, '..')
/** <zh/> packages 目录 | <en/> packages directory */
export const pkgRoot = resolve(projRoot, 'packages')
/** <zh/> docs 目录 | <en/> docs directory */
export const docsRoot = resolve(projRoot, 'docs')
