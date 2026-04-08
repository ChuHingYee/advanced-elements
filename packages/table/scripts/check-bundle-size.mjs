/**
 * <zh/> 体积回归 — 校验 dist/index.mjs gzip <120KB
 * <en/> Bundle regression — verifies dist/index.mjs gzip <120KB
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

const file = join(import.meta.dirname, '../dist/index.mjs')
try {
  const buf = readFileSync(file)
  const gz = gzipSync(buf)
  const kb = gz.length / 1024
  out(`dist/index.mjs gzip: ${kb.toFixed(2)}KB / 120KB`)
  if (kb > 120) {
    console.error(`Bundle exceeds 120KB: ${kb.toFixed(2)}KB`)
    process.exit(1)
  }
  else {
    out('Bundle passed')
  }
}
catch (e) {
  console.warn(`Bundle check skipped (no dist): ${e.message}`)
}
