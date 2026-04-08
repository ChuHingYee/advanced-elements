/**
 * <zh/> 可视化构建入口 — 置 ANALYZE=1 后调用 rolldown，跨平台（免 cross-env 依赖）。
 * <en/> Visualized build entry — sets ANALYZE=1 then invokes rolldown, cross-platform (no cross-env needed).
 *
 * @remarks
 * <zh/> rolldown.config.mjs 检测到 ANALYZE 即注入 rollup-plugin-visualizer（treemap + gzip），
 * <zh/> 产物为 dist/stats.html（gitignored、不发布）。默认 `build` 与 CI 不受影响。
 * <en/> rolldown.config.mjs injects rollup-plugin-visualizer (treemap + gzip) when ANALYZE is set;
 * <en/> output is dist/stats.html (gitignored, never published). Default `build` and CI are unaffected.
 *
 * @example
 * pnpm analyze:visualizer
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import process from 'node:process'

const ROOT = join(import.meta.dirname, '..')

process.env.ANALYZE = '1'
const r = spawnSync('rolldown', ['-c'], { cwd: ROOT, stdio: 'inherit', shell: true })
process.exitCode = typeof r.status === 'number' ? r.status : 1
