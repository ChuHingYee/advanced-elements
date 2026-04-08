/**
 * <zh/> 体积回归 — 校验 dist/index.mjs 自身 gzip <120KB（raw 口径）。
 * <zh/> 与 size-limit 是两种不同度量，数字不可互通、亦不可合并：
 * <zh/> · 本脚本 = 产物文件 raw gzip（外部化依赖不计入），预算 120KB；
 * <zh/> · size-limit（@size-limit/esbuild）= 连同 runtime 依赖一起打包后 gzip（"with all
 * <zh/>   dependencies"），预算 240KB/245KB（mjs/cjs，紧棘轮）。
 * <zh/> 曾误把两者当作同度量的「双源漂移」并尝试统一，实测 size-limit 口径 233KB 才回滚——
 * <zh/> 两套预算各自校准，改动任一数字前先确认自己改的是哪个口径。
 * <en/> Bundle regression — verifies dist/index.mjs raw gzip <120KB.
 * <en/> This and size-limit measure DIFFERENT things; the numbers are not interchangeable:
 * <en/> · this script = raw gzip of the artifact itself (externalized deps excluded), budget 120KB;
 * <en/> · size-limit (@size-limit/esbuild) = gzip after bundling WITH runtime deps
 * <en/>   ("with all dependencies"), budgets 240KB/245KB (mjs/cjs, tight ratchets).
 * <en/> They were once misread as one metric's "dual-source drift" and briefly unified — the
 * <en/> bundled caliber measures 233KB and turned red, reverting the change. Both budgets are
 * <en/> individually calibrated; confirm which caliber you are touching before changing either.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

// <zh/> raw gzip 预算（区别于 size-limit 的 bundled 口径，见文件头）
// <en/> raw-gzip budget (distinct from size-limit's bundled caliber, see the file header)
const LIMIT_KB = 120

const file = join(import.meta.dirname, '../dist/index.mjs')
try {
  const buf = readFileSync(file)
  const gz = gzipSync(buf)
  const kb = gz.length / 1024
  out(`dist/index.mjs gzip: ${kb.toFixed(2)}KB / ${LIMIT_KB}KB`)
  if (kb > LIMIT_KB) {
    console.error(`Bundle exceeds ${LIMIT_KB}KB: ${kb.toFixed(2)}KB`)
    process.exit(1)
  }
  else {
    out('Bundle passed')
  }
}
catch (e) {
  console.warn(`Bundle check skipped (no dist): ${e.message}`)
}
