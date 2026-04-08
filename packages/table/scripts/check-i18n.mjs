/**
 * <zh/> i18n 完整性校验 — 对比 zh-cn / en 键集合，并扫描源码中的中文回退散点
 * <en/> i18n completeness check — compares zh-cn / en key sets and scans source for Chinese fallback literals
 *
 * @remarks
 * <zh/> 键缺失会导致 `i18n.t('table.xxx')` 回退原文，需 CI 阻断
 * <en/> Missing keys cause `i18n.t('table.xxx')` fallback, CI should block
 *
 * <zh/> 两项源码级检查（均为 fail-fast）：
 * <zh/> 1. `tf(t, '<key>', '中文')` 的 key 必须存在于 zh-cn / en 键集合——写错键等于静默回退中文
 * <zh/> 2. 禁止绕过 `tf()` 直写 `?? '中文'` / `|| '中文'`——回退文案必须可检索、可审计
 * <en/> Two source-level checks (both fail-fast):
 * <en/> 1. The key of `tf(t, '<key>', 'Chinese')` must exist in the zh-cn / en key sets — a wrong key
 * <en/>    silently falls back to Chinese
 * <en/> 2. Bypassing `tf()` with a bare `?? 'Chinese'` / `|| 'Chinese'` is forbidden — fallback text must
 * <en/>    be greppable and auditable
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

/** <zh/> 可扫描的源码扩展名 | <en/> Source extensions eligible for scanning */
const SOURCE_EXT_RE = /\.(ts|tsx|vue)$/

const zhMod = await import(pathToFileURL(join(import.meta.dirname, '../src/locale/lang/zh-cn.ts')).href)
const enMod = await import(pathToFileURL(join(import.meta.dirname, '../src/locale/lang/en.ts')).href)
const errorMod = await import(pathToFileURL(join(import.meta.dirname, '../src/types/error.ts')).href)

function flatKeys(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v))
      flatKeys(v, path, out)
    else out.add(path)
  }
  return out
}

const zhKeys = flatKeys(zhMod.zhCn ?? zhMod.default ?? zhMod)
const enKeys = flatKeys(enMod.en ?? enMod.default ?? enMod)

let errors = 0
for (const k of zhKeys) {
  if (!enKeys.has(k)) {
    console.error(`missing en: ${k}`)
    errors++
  }
}
for (const k of enKeys) {
  if (!zhKeys.has(k)) {
    console.error(`missing zh: ${k}`)
    errors++
  }
}

// ── error code 与 locale 对齐 | Error-code / locale alignment ────────────────
// <zh/> TABLE_ERROR_CODES 的每个 code 必须在 zh/en 都有 error.{CODE}.message + .suggestion，
// <zh/> 否则 error-handler 会静默回退到硬编码中文（英文环境仍显示中文且无告警）。
// <en/> Every code in TABLE_ERROR_CODES must have error.{CODE}.message + .suggestion in both
// <en/> locales; otherwise error-handler silently falls back to hardcoded Chinese.
const TABLE_ERROR_CODES = errorMod.TABLE_ERROR_CODES ?? errorMod.default?.TABLE_ERROR_CODES ?? {}
for (const code of Object.keys(TABLE_ERROR_CODES)) {
  for (const sub of ['message', 'suggestion']) {
    const key = `error.${code}.${sub}`
    if (!zhKeys.has(key)) {
      console.error(`missing zh locale for error code: ${key}`)
      errors++
    }
    if (!enKeys.has(key)) {
      console.error(`missing en locale for error code: ${key}`)
      errors++
    }
  }
}

// ── 源码级检查 | Source-level checks ──────────────────────────────────────

const SRC_DIR = join(import.meta.dirname, '../src')
/** <zh/> locale 定义自身含中文，排除扫描 | <en/> locale definitions inherently contain Chinese, excluded */
const EXCLUDED_DIRS = new Set([join(SRC_DIR, 'locale')])

function collectSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(full))
        collectSourceFiles(full, out)
    }
    else if (SOURCE_EXT_RE.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

/** <zh/> 注释/文档行不参与回退扫描 | <en/> Comment/doc lines are skipped by the fallback scan */
function isCommentLine(line) {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('<!--')
}

/** <zh/> 匹配 `tf(<t>, '<key>'` 的 locale 键 | <en/> Matches the locale key of `tf(<t>, '<key>'` */
const TF_CALL_RE = /\btf\([^,]*,\s*'([^']+)'/g
/** <zh/> 匹配绕过 tf 的中文回退字面量 | <en/> Matches Chinese fallback literals bypassing tf */
const BARE_FALLBACK_RE = /(\?\?|\|\|)\s*'([^'\u4E00-\u9FFF]*[\u4E00-\u9FFF][^']*)'/g

for (const file of collectSourceFiles(SRC_DIR)) {
  const rel = relative(SRC_DIR, file)
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    if (isCommentLine(line))
      return
    for (const m of line.matchAll(TF_CALL_RE)) {
      const key = m[1]
      if (!zhKeys.has(key) || !enKeys.has(key)) {
        console.error(`tf() locale key not registered in both locales: ${key} (${rel}:${index + 1})`)
        errors++
      }
    }
    for (const m of line.matchAll(BARE_FALLBACK_RE)) {
      console.error(`hardcoded Chinese fallback "${m[2]}" — use tf(t, '<locale.key>', '${m[2]}') instead (${rel}:${index + 1})`)
      errors++
    }
  })
}

if (errors > 0) {
  console.error(`\ni18n failed: ${errors} problem(s)`)
  process.exit(1)
}
else {
  out(`i18n passed: ${zhKeys.size} keys`)
}
