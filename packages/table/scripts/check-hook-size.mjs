/**
 * <zh/> Hook 体积棘轮（R-8）——src/composables 超 300 行文件数只减不增。
 * <en/> Hook size ratchet (R-8) — the count of >300-line files under src/composables only goes down.
 *
 * @remarks
 * <zh/> 取代旧版「BASELINE 豁免名单 + warn-only」：名单快照会陈旧（2026-09 快照 42 个，
 * <zh/> 2026-10 实测已 52 个，越界全程无告警），且豁免文件可无限增长。棘轮语义：
 * <zh/> · 超限文件数 > 棘轮值 → error（CI 红）；
 * <zh/> · < 棘轮值 → 提示收紧（还债进度的锁定是刻意行为，与 lint:check 棘轮同一治理模式）；
 * <zh/> · 拆分配方：同名拆为 `-core` + `-helpers`，或抽纯函数（编辑域 9 件套是完整先例）。
 * <zh/> excessLines 仅信息上报（计入记分卡）不设门禁——避免对豁免文件加注释这类
 * <zh/> 无关行数变化误伤。
 * <en/> Replaces the old "BASELINE exempt list + warn-only" gate: snapshot lists go stale
 * <en/> (42 entries from the 2026-09 snapshot vs 52 actually oversized by 2026-10, all growth
 * <en/> silent) and exempt files could grow unbounded. Ratchet semantics:
 * <en/> · oversized count > ratchet value → error (CI red);
 * <en/> · < ratchet value → tighten prompt (locking in paydown is deliberate, same governance
 * <en/> model as the lint:check ratchet);
 * <en/> · split recipe: same-name `-core` + `-helpers` split, or extract pure functions (the
 * <en/> editing domain's nine-piece split is the full precedent).
 * <en/> excessLines is informational only (feeds the scorecard) — not gated, so unrelated line
 * <en/> churn (comments on exempt files) never false-flags.
 *
 * @example
 * node scripts/check-hook-size.mjs            // 检查 | check
 * node scripts/check-hook-size.mjs --set      // 把当前实测写入棘轮（首次/刻意收紧用）| write current measurement into the ratchet
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src/composables')
const RATCHET_FILE = join(import.meta.dirname, 'hook-size-ratchet.json')
const THRESHOLD_LINES = 300
const SET_MODE = process.argv.includes('--set')

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory())
      walk(p, acc)
    else if (entry.endsWith('.ts'))
      acc.push(p)
  }
  return acc
}

const measured = { oversizedFiles: 0, excessLines: 0, totalComposables: 0, excessByFile: [] }
for (const file of walk(SRC)) {
  const lines = readFileSync(file, 'utf-8').split('\n').length
  measured.totalComposables++
  if (lines > THRESHOLD_LINES) {
    measured.oversizedFiles++
    measured.excessLines += lines - THRESHOLD_LINES
    measured.excessByFile.push([file.slice(SRC.length + 1), lines])
  }
}

if (SET_MODE) {
  writeFileSync(RATCHET_FILE, `${JSON.stringify({ oversizedFiles: measured.oversizedFiles }, null, 2)}\n`)
  out(`[hook-size] ratchet set: oversizedFiles=${measured.oversizedFiles} (excessLines=${measured.excessLines}, informational)`)
  process.exit(0)
}

let ratchet
try {
  ratchet = JSON.parse(readFileSync(RATCHET_FILE, 'utf-8'))
}
catch (e) {
  console.error(`[hook-size] cannot read ${RATCHET_FILE} (run with --set to create): ${e.message}`)
  process.exit(1)
}
if (typeof ratchet.oversizedFiles !== 'number') {
  console.error(`[hook-size] ${RATCHET_FILE} must contain { "oversizedFiles": <number> }`)
  process.exit(1)
}

// <zh/> 存量超限清单（可见性；只读信息，不再是豁免名单）| <en/> oversized inventory (visibility only, no longer an exemption list)
for (const [rel, lines] of measured.excessByFile.sort((a, b) => b[1] - a[1])) {
  console.warn(`[hook-size] oversized: ${rel}: ${lines} lines (+${lines - THRESHOLD_LINES})`)
}

out(`[hook-size] oversized ${measured.oversizedFiles}/${measured.totalComposables} files (ratchet ${ratchet.oversizedFiles}), excess ${measured.excessLines} lines (informational)`)

if (measured.oversizedFiles > ratchet.oversizedFiles) {
  console.error(
    `[hook-size] DEBT GREW: ${measured.oversizedFiles} oversized > ratchet ${ratchet.oversizedFiles}. `
    + `Split the offender(s) into a same-name -core + -helpers pair or extract pure functions (R-8); `
    + `raising the ratchet requires justification in review.`,
  )
  process.exit(1)
}
if (measured.oversizedFiles < ratchet.oversizedFiles) {
  out(`[hook-size] debt shrank: tighten scripts/hook-size-ratchet.json to { "oversizedFiles": ${measured.oversizedFiles} } to lock the gain`)
}

out('Hook size ratchet passed')
