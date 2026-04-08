#!/usr/bin/env node
/**
 * <zh/> play dev 前置自检：确保 dev 链路上仍经 dist 解析的包产物存在。
 *
 * <zh/> play 的组件/样式导入已由 vite alias + tsconfig paths 直连各包 src（见 play/vite.config.ts），
 * <zh/> 无需 dist；唯一例外是 vite.config.ts 自身在 Node 侧 `import { AdvancedElementsResolver }
 * <zh/> from '@advanced-elements/resolvers'`——Node 经过 exports，只能解析 dist。
 * <zh/> 缺失时自动补构建一次（tsc，秒级），避免新手 clone 后首跑 vite 直接崩。
 *
 * <en/> Pre-dev self-check for play: ensure dist artifacts still resolved via dist on the dev path exist.
 *
 * <en/> Component/style imports in play link each package's src directly through vite aliases +
 * <en/> tsconfig paths (see play/vite.config.ts), so no dist is needed — except vite.config.ts itself,
 * <en/> which imports { AdvancedElementsResolver } from '@advanced-elements/resolvers' on the Node
 * <en/> side, where only dist resolves through exports. Build it automatically when missing (tsc,
 * <en/> seconds) so a fresh clone doesn't crash vite on first run.
 *
 * @returns <zh/> 退出码：0 就绪 / 1 补构建失败 | <en/> exit code: 0 ready, 1 bootstrap build failed
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const here = typeof import.meta.dirname === 'string'
  ? import.meta.dirname
  : dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const IS_WINDOWS = process.platform === 'win32'

const REQUIRED = [
  'packages/resolvers/dist/index.js',
]

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁，与 fix-deps.mjs 一致）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate, same as fix-deps.mjs)
const out = msg => process.stdout.write(`${msg}\n`)

const missing = REQUIRED.filter(rel => !existsSync(join(ROOT, rel)))
if (missing.length === 0) {
  process.exit(0)
}

out(`[ensure-play-deps] 缺失产物，补构建: ${missing.join(', ')}`)
out('[ensure-play-deps] Missing artifacts, bootstrapping a build...')
const r = spawnSync(IS_WINDOWS ? 'pnpm.cmd' : 'pnpm', ['--filter', '@advanced-elements/resolvers', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: IS_WINDOWS,
})
process.exit(r.status ?? 1)
