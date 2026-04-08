/**
 * <zh/> 命名空间别名覆盖检查 — SCSS 源码禁止硬编码 `var(--el-*)`（一律走 getCssVar* 助手）；
 * <zh/> TS/TSX/Vue 运行时字符串中的 `var(--el-*)` 必须在 `_namespace-aliases.scss` 登记别名。
 * <en/> Namespace-alias coverage check — hardcoded `var(--el-*)` is forbidden in SCSS sources
 * <en/> (use getCssVar* helpers); runtime `var(--el-*)` in TS/TSX/Vue must be aliased in
 * <en/> `_namespace-aliases.scss`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

const SRC_DIR = join(import.meta.dirname, '../src')
const ALIAS_FILE = join(SRC_DIR, 'style/_namespace-aliases.scss')

const RE_SCSS_HARDCODED = /var\(--el-[a-z][\w-]*/g
const RE_ALIAS_DECL = /--el-([a-z][\w-]*)\s*:/g
const RE_RUNTIME_VAR = /var\(--el-([a-z][\w-]*)/g
const RE_ALIAS_FILE_SELF = /_ep-classes\.scss$|_namespace-aliases\.scss$/
const RE_COMMENT_PREFIX = /^(?:\/\/|\*|\/\*|<!--)/
const RE_LINE_SPLIT = /\r?\n/

const COMMENT_ONLY_FILES = collect(['.scss']).filter(f => RE_ALIAS_FILE_SELF.test(f))

function collect(exts) {
  const out = []
  function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const q = join(d, e.name)
      if (e.isDirectory())
        walk(q)
      else if (exts.some(x => e.name.endsWith(x)))
        out.push(q)
    }
  }
  walk(SRC_DIR)
  return out
}

function isCommentLine(line) {
  return RE_COMMENT_PREFIX.test(line.trim())
}

function reportLines(file, re, onMatch) {
  for (const [i, line] of readFileSync(file, 'utf8').split(RE_LINE_SPLIT).entries()) {
    if (isCommentLine(line))
      continue
    for (const m of line.matchAll(re))
      onMatch(m, i + 1)
  }
}

// 别名表实际覆盖的 legacy 变量名 | legacy var names actually bridged by the alias table
const aliasSrc = readFileSync(ALIAS_FILE, 'utf8')
const aliased = new Set(Array.from(aliasSrc.matchAll(RE_ALIAS_DECL), m => m[1]))

const errors = []

// 规则 1：SCSS 源码零容忍（别名表自身除外）| Rule 1: zero tolerance in SCSS sources (alias table itself excluded)
for (const f of collect(['.scss'])) {
  if (COMMENT_ONLY_FILES.includes(f))
    continue
  reportLines(f, RE_SCSS_HARDCODED, (m, line) => {
    errors.push(`hardcoded \`${m[0]}\` — use getCssVar*/getCssVarWithDefault instead (${relative(SRC_DIR, f)}:${line})`)
  })
}

// 规则 2：运行时字符串必须已登记别名 | Rule 2: runtime strings must be registered as aliases
for (const f of collect(['.ts', '.tsx', '.vue'])) {
  reportLines(f, RE_RUNTIME_VAR, (m, line) => {
    if (!aliased.has(m[1]))
      errors.push(`unaliased runtime \`var(--el-${m[1]})\` — register it in style/_namespace-aliases.scss (${relative(SRC_DIR, f)}:${line})`)
  })
}

if (errors.length > 0) {
  for (const e of errors)
    console.error(e)
  console.error(`\ncheck-namespace-aliases failed: ${errors.length} problem(s)`)
  process.exit(1)
}
else {
  out(`namespace-aliases passed: ${aliased.size} legacy vars bridged, 0 hardcoded SCSS vars`)
}
