/**
 * <zh/> 注释规范 CI 校验 — 覆盖源码完整性与 COMMENT_CONVENTIONS.md 的可机器判定条目。
 * <en/> Comment convention CI check — covers source integrity and the machine-checkable items
 * <en/> of COMMENT_CONVENTIONS.md.
 *
 * @remarks
 * <zh/> 分级设计（避免一次性把历史欠账变成 CI 红灯）：
 * <zh/> • 阻断级（error，当前已全仓通过）：R1 编码损坏 U+FFFD；R2 记录型标记（形如 P0-7）。
 * <zh/> • 报告级（warn，默认不阻断，`--strict` 升级为 error）：R3 单语行内注释；R4 类型定义缺 JSDoc；
 * <zh/>   R5 组件缺头部块；R6 头部块缺 @displayName/@description；R9 测试编号族标签；
 * <zh/>   R10 JSDoc 块单语；R11 .tsx 缺头部块；R12 头部块缺 @category。
 * <zh/> R2 之所以可立即设为阻断级：全仓记录型标记已清理完毕，此规则用于防止其回归——
 * <zh/> 该类标记把"某次重构的临时编号"写进注释，编号在任务结束后即失效，属纯噪声。
 * <en/> Tiered design (so historical debt never turns CI red in one shot):
 * <en/> • Blocking (error, currently passing repo-wide): R1 encoding corruption U+FFFD;
 * <en/>   R2 record-style markers (shaped like P0-7).
 * <en/> • Reporting (warn by default, promoted to error with `--strict`): R3 single-language inline
 * <en/>   comments; R4 type declarations missing JSDoc; R5 components missing a header block;
 * <en/>   R6 header block missing @displayName/@description; R9 test rule-number labels;
 * <en/>   R10 single-language JSDoc blocks; R11 .tsx files missing a header block;
 * <en/>   R12 header block missing @category.
 * <en/> R2 can be blocking immediately because record-style markers have been fully removed repo-wide;
 * <en/> the rule exists to prevent their return — such markers embed a transient refactor ticket id
 * <en/> that becomes meaningless once the task closes, i.e. pure noise.
 *
 * @example
 * node scripts/check-comment-convention.mjs          // 报告级不阻断 | reporting only
 * node scripts/check-comment-convention.mjs --strict  // 全部规则阻断 | all rules block
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

const STRICT = process.argv.includes('--strict')
const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')
const TESTS = join(ROOT, '__tests__')
const ALLOW = [/^\/\/\s*@ts-/, /^\/\/\s*eslint-disable/, /^\/\/\s*──/, /^\/\/\s*global/]

/** <zh/> 相对仓库根的路径，便于人读（置于模块作用域，供各 scan 函数前向引用） | <en/> repo-root-relative path for readability (module scope, so every scan may reference it ahead) */
const rel = p => p.slice(ROOT.length + 1)

/** <zh/> 带注释的源码扩展名（ts/tsx/vue） | <en/> Commented source extensions (ts/tsx/vue) */
const COMMENTED_EXT_RE = /\.(ts|tsx|vue)$/
/** <zh/> 目录遍历纳入的扩展名（额外含样式） | <en/> Extensions collected while walking (styles included) */
const WALK_EXT_RE = /\.(ts|tsx|vue|scss)$/
/** <zh/> 纯类型文件 | <en/> Type-only file */
const TS_EXT_RE = /\.ts$/
/** <zh/> 首个 JSDoc 块 | <en/> Leading JSDoc block */
const JSDOC_BLOCK_RE = /\/\*\*[\s\S]*?\*\//
/** <zh/> 首个 HTML 注释块（.vue 文件头按规范用 <!-- -->，见 COMMENT_CONVENTIONS §3.1） | <en/> Leading HTML comment block (.vue headers use <!-- --> per COMMENT_CONVENTIONS §3.1) */
const HTML_BLOCK_RE = /<!--[\s\S]*?-->/

/**
 * <zh/> 记录型标记：形如 P0-1 / P1-1.1 / P2-3，无论是否带括号包裹。
 * <en/> Record-style marker: shaped like P0-1 / P1-1.1 / P2-3, with or without wrapping parentheses.
 */
const RECORD_MARKER = /\bP[0-3]-\d+(?:\.\d+)?\b/

/** <zh/> 类型声明起始行 | <en/> Type declaration opening line */
const TYPE_DECL = /^export\s+(?:declare\s+)?(?:interface|type)\s+\w/

/**
 * <zh/> 记录性措辞——注释记录"改过什么 / 属于哪次任务"而非"当前契约是什么"。
 * <zh/> 这类信息随代码演进立即失效，且把评审过程写进源码，对读者是纯噪声。
 * <en/> Record-type wording — comments that record *what was changed / which task it belonged to*
 * <en/> instead of *what the contract is now*. Such notes expire the moment the code moves on and
 * <en/> write the review process into the source: pure noise for readers.
 */
const RECORD_PHRASES = [
  '旧实现',
  '此前版本',
  '历史遗留',
  // <zh/> 仅匹配"本轮 + 动作"的任务口吻；"本轮遍历"等指代本次循环的写法是合法的，不算记录性
  // <en/> match only the task-flavoured "本轮 + action"; "本轮遍历" (this pass) is legitimate and exempt
  '本轮新增',
  '本轮修复',
  '本轮改动',
  '本次修复',
  '早期实现',
  '原来此处',
  '之前的实现',
  '老实现',
]

/**
 * <zh/> 空想式措辞——对未发生情形的推测（"若未来…则需…"）。契约应陈述现状，
 * <zh/> 未来条件分支应在其真正成立时再写入。
 * <en/> Speculative wording — guessing at scenarios that have not happened ("if in future … then …").
 * <en/> A comment should state the present contract; a future conditional belongs there only when it
 * <en/> actually holds.
 */
const SPECULATIVE_PHRASES = ['若未来', '将来若', '如果将来', '未来若', '届时若']

/** <zh/> 单个 JSDoc 块的告警阈值（行数）——超过即疑似过度叙述 | <en/> per-JSDoc warning threshold (lines) — beyond this the block likely over-narrates */
const JSDOC_MAX_LINES = 25

const findings = { r1: [], r2: [], r3: [], r4: [], r5: [], r6: [], r7: [], r8: [], r9: [], r10: [], r11: [], r12: [] }

/**
 * <zh/> R9 测试编号族标签（报告级）——D1 清理后防回归：`__tests__` 内标题/注释不得再出现
 * <zh/> `(R1)` / `(R-3)` / `(A1)` / `(A6 runtime)` / `COL-1` / `T1` / `TOP-1` / `Stage1` / `阶段 2` 类临时编号。
 * <zh/> 括号内编号后接单词边界即命中（覆盖 `(A6 runtime)` 类"编号 + 说明"写法）。
 * <zh/> 仅扫 `__tests__`（源码侧 `A1` 多为 Excel 坐标如 `utils/security.ts`，`R\d` 多为设计引用如 `ADR/R3`，误报高故不限源码）。
 * <zh/> 白名单：路径含 `security` / `xlsx` 的文件豁免 `A1`（Excel 单元格坐标）。
 * <en/> R9 test rule-number labels (reporting) — post-D1 regression guard: no `(R1)` / `(R-3)` /
 * <en/> `(A1)` / `(A6 runtime)` / `COL-1` / `T1` / `TOP-1` / `Stage1` style transient ids in `__tests__` titles/comments.
 * <en/> An id followed by a word boundary inside brackets hits (covers `(A6 runtime)`-style "id + gloss" labels).
 * <en/> Tests only (bare `A1` in src is usually an Excel coordinate; allowlisted anyway).
 */
const RULE_NUMBER = /[([（](R-?\d|A\d+|COL-\d+|T\d+|TOP-\d+|Stage\d+)\b|R-\d+|COL-\d+|TOP-\d+|Stage\d+|阶段\s*\d+/
const R9_ALLOW = [/security/, /xlsx/]
function scanRuleNumbers(files) {
  for (const file of files) {
    if (!file.startsWith(TESTS))
      continue
    if (R9_ALLOW.some(r => r.test(rel(file))))
      continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, idx) => {
      // <zh/> 小写变量名 r1/p1/t1（单测局部变量）豁免——仅大写族命中
      // <en/> lowercase r1/p1/t1 locals exempt — uppercase family only
      const m = line.match(RULE_NUMBER)
      if (m)
        findings.r9.push(`${rel(file)}:${idx + 1}  ${m[0]}`)
    })
  }
}

/**
 * <zh/> R10 JSDoc 块双语配对（报告级）——含 `<zh/>` 的文档块必须含 `<en/>`。
 * <en/> R10 JSDoc bilingual pairing (reporting) — a doc block carrying `<zh/>` must also carry `<en/>`.
 */
function scanJsDocBilingual(files) {
  for (const file of files) {
    if (!COMMENTED_EXT_RE.test(file))
      continue
    if (file.startsWith(TESTS))
      continue
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim().startsWith('/**'))
        continue
      let end = i
      while (end < lines.length && !lines[end].includes('*/')) end++
      const block = lines.slice(i, Math.min(end + 1, lines.length)).join('\n')
      if (block.includes('<zh/>') && !block.includes('<en/>'))
        findings.r10.push(`${rel(file)}:${i + 1}`)
      i = end
    }
  }
}

/**
 * <zh/> R11 .tsx 缺头部块（报告级）+ R12 头部块缺 @category（报告级）。
 * <zh/> R5/R6 仅覆盖 .vue；.tsx 组件（SelectionColumn 等）同等要求 @component 头部块。
 * <en/> R11 .tsx files missing a header block (reporting) + R12 header block missing @category (reporting).
 */
function scanTsxHeader(files) {
  for (const file of files) {
    if (!file.endsWith('.tsx'))
      continue
    const head = readFileSync(file, 'utf8').split('\n').slice(0, 60).join('\n')
    const block = head.match(JSDOC_BLOCK_RE)
    if (!block || !block[0].includes('@component')) {
      findings.r11.push(rel(file))
      continue
    }
    if (!block[0].includes('@category'))
      findings.r12.push(`${rel(file)}  missing @category`)
  }
  // <zh/> R12 同查 .vue 头部块缺 @category（HTML 头与 JSDoc 头任一含 @component 即为头部块） | <en/> R12 also checks .vue header blocks for @category (either HTML or JSDoc style carrying @component counts)
  for (const file of files) {
    if (!file.endsWith('.vue'))
      continue
    const head = readFileSync(file, 'utf8').split('\n').slice(0, 80).join('\n')
    const blocks = [head.match(HTML_BLOCK_RE)?.[0], head.match(JSDOC_BLOCK_RE)?.[0]].filter(Boolean)
    const header = blocks.find(b => b.includes('@component'))
    if (header && !header.includes('@category'))
      findings.r12.push(`${rel(file)}  missing @category`)
  }
}

function walk(dir, out = []) {
  if (!existsSync(dir))
    return out
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory())
      walk(p, out)
    else if (WALK_EXT_RE.test(e))
      out.push(p)
  }
  return out
}

/**
 * <zh/> R1 编码完整性 + R2 记录型标记 —— 逐行扫描，两者都作用于 src 与 __tests__。
 * <en/> R1 encoding integrity + R2 record markers — line scan across src and __tests__.
 */
function scanIntegrity(files) {
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')
    let corrupted = false
    lines.forEach((line, idx) => {
      if (line.includes('\uFFFD')) {
        findings.r1.push(`${rel(file)}:${idx + 1}`)
        corrupted = true
      }
    })
    void corrupted
    lines.forEach((line, idx) => {
      const m = line.match(RECORD_MARKER)
      if (m)
        findings.r2.push(`${rel(file)}:${idx + 1}  ${m[0]}`)
    })
  }
}

/**
 * <zh/> R3 单语行内注释 —— 承载 `<zh/>` 的 `//` 注释**块**内必须出现 `<en/>`。
 * <en/> R3 single-language inline comment — a `//` comment **block** carrying `<zh/>` must also
 * <en/> contain `<en/>`.
 *
 * @remarks
 * <zh/> 「块」= 由连续 `//` 行组成的注释组；判定时向**前与向后**双向扫描该块
 * <zh/> （遇非 `//` 行、白名单行或文件边界即停止）。
 * <zh/> 早期实现只向前看 3 行，导致规范推荐的"多行 zh 块 + 多行 en 块"写法
 * <zh/> 被大面积误报（除最后一行 zh 外全部命中），使该指标失去参考价值。
 * <en/> A "block" is a run of consecutive `//` lines; the check scans it in **both** directions
 * <en/> (stopping at a non-`//` line, an allowlisted line, or the file boundary).
 * <en/> The earlier implementation only looked 3 lines ahead, so the convention's own recommended
 * <en/> shape ("multi-line zh block + multi-line en block") was massively misreported (every zh line
 * <en/> except the last one hit), which rendered the metric useless.
 */
function scanInlineBilingual(files) {
  for (const file of files) {
    if (!COMMENTED_EXT_RE.test(file))
      continue
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line.startsWith('//') || ALLOW.some(r => r.test(line)))
        continue
      if (!line.includes('<zh/>'))
        continue

      let hasEn = line.includes('<en/>')
      for (let j = i + 1; !hasEn && j < lines.length; j++) {
        const nxt = lines[j].trim()
        if (!nxt.startsWith('//') || ALLOW.some(r => r.test(nxt)))
          break
        if (nxt.includes('<en/>'))
          hasEn = true
      }
      for (let j = i - 1; !hasEn && j >= 0; j--) {
        const prv = lines[j].trim()
        if (!prv.startsWith('//') || ALLOW.some(r => r.test(prv)))
          break
        if (prv.includes('<en/>'))
          hasEn = true
      }

      if (!hasEn)
        findings.r3.push(`${rel(file)}:${i + 1}`)
    }
  }
}

/**
 * <zh/> R4 类型定义缺 JSDoc —— 仅作用于 `src/types` 下的导出 interface/type。
 * <en/> R4 type declarations missing JSDoc — only exported interface/type under `src/types`.
 */
function scanTypeJsDoc(files) {
  for (const file of files) {
    if (!file.includes(`${join('src', 'types')}`) || !TS_EXT_RE.test(file))
      continue
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!TYPE_DECL.test(lines[i].trim()))
        continue
      // <zh/> 向上跳过空行，取最近的非空行；以 `*/` 结尾即视为有 JSDoc
      // <en/> Skip blank lines upward and take the nearest non-empty line; ending with `*/` means JSDoc
      let j = i - 1
      while (j >= 0 && lines[j].trim() === '') j--
      if (j < 0 || !lines[j].trim().endsWith('*/'))
        findings.r4.push(`${rel(file)}:${i + 1}`)
    }
  }
}

/**
 * <zh/> R5/R6 组件头部注释块 —— 取文件头部 80 行内的块注释（.vue 接受 HTML 头与 JSDoc 头任一，
 * <zh/> 含 `@component` 即视为头部块，R5），并进一步含 `@displayName` 与 `@description`（R6）。
 * <en/> R5/R6 component header block — take a block comment within the first 80 lines (either the
 * <en/> HTML header or a JSDoc header for .vue; containing `@component` counts as the header, R5),
 * <en/> then require `@displayName` and `@description` (R6).
 */
function scanComponentHeader(files) {
  for (const file of files) {
    if (!file.endsWith('.vue'))
      continue
    const head = readFileSync(file, 'utf8').split('\n').slice(0, 80).join('\n')
    // <zh/> 两种头部写法任一含 @component 即认可（HTML 头优先，符合 §3.1）；脚本内普通 JSDoc 不得冒充头部块
    // <en/> Either header style counts when it carries @component (HTML first, per §3.1); ordinary JSDoc inside <script> must not pass as the header
    const blocks = [head.match(HTML_BLOCK_RE)?.[0], head.match(JSDOC_BLOCK_RE)?.[0]].filter(Boolean)
    const header = blocks.find(b => b.includes('@component'))
    if (!header) {
      findings.r5.push(rel(file))
      continue
    }
    const missing = []
    if (!header.includes('@displayName'))
      missing.push('@displayName')
    if (!header.includes('@description'))
      missing.push('@description')
    if (missing.length > 0)
      findings.r6.push(`${rel(file)}  missing ${missing.join(' + ')}`)
  }
}

/**
 * <zh/> R7 记录性措辞（阻断）——注释应陈述**当前契约**，不记录改过什么、属于哪次任务。
 * <en/> R7 record-type wording (blocking) — comments state the **current contract**, not what changed or which task it belonged to.
 */
function scanRecordPhrases(files) {
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, idx) => {
      const hit = RECORD_PHRASES.find(p => line.includes(p))
      if (hit)
        findings.r7.push(`${rel(file)}:${idx + 1}  ${hit}`)
    })
  }
}

/**
 * <zh/> R8 过度叙述（报告级）——空想式措辞，以及超长 JSDoc 块（疑似生成式文档腔）。
 * <en/> R8 over-narration (reporting) — speculative wording and oversized JSDoc blocks (likely generated-doc tone).
 */
function scanSlop(files) {
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, idx) => {
      const hit = SPECULATIVE_PHRASES.find(p => line.includes(p))
      if (hit)
        findings.r8.push(`${rel(file)}:${idx + 1}  ${hit}`)
    })
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim().startsWith('/**'))
        continue
      let end = i
      while (end < lines.length && !lines[end].trim().endsWith('*/'))
        end++
      /**
       * <zh/> 两处豁免，避免把规范**要求**的详尽文档误判为过度叙述：
       * <zh/> 1. 文件头部 JSDoc（首个块）——规范鼓励的文件级说明；
       * <zh/> 2. `src/types/**`——对外 Props/类型文档，规范 §4 / §12 要求枚举值中英分列、
       *    `@remarks` 与 `@default` 齐全，篇幅长属预期。
       * <en/> Two exemptions, so that documentation the convention **requires** is not flagged as
       * <en/> over-narration:
       * <en/> 1. the leading file-level JSDoc (first block) — encouraged by the convention;
       * <en/> 2. `src/types/**` — public props/type docs, where §4 / §12 require zh+en enum listings,
       *    `@remarks` and `@default`; long blocks are expected there.
       */
      const isPublicTypeDoc = file.includes(`${join('src', 'types')}`)
      if (i > 0 && !isPublicTypeDoc && end - i + 1 > JSDOC_MAX_LINES)
        findings.r8.push(`${rel(file)}:${i + 1}  jsdoc ${end - i + 1} lines > ${JSDOC_MAX_LINES}`)
      i = end
    }
  }
}

const srcFiles = walk(SRC)
const testFiles = walk(TESTS)

scanIntegrity([...srcFiles, ...testFiles])
scanRecordPhrases([...srcFiles, ...testFiles])
scanSlop(srcFiles)
scanInlineBilingual(srcFiles)
scanTypeJsDoc(srcFiles)
scanComponentHeader(srcFiles)
scanRuleNumbers(testFiles)
scanJsDocBilingual(srcFiles)
scanTsxHeader(srcFiles)

const BLOCKING = [
  ['r1', 'U+FFFD encoding corruption'],
  ['r2', 'record-style marker (P0-x/P1-x/P2-x/P3-x)'],
  ['r7', 'record-type wording — describe the contract, not what changed / which task'],
]
const REPORTING = [
  ['r3', 'inline // <zh/> without sibling <en/> within 3 lines'],
  ['r4', 'exported interface/type under src/types without JSDoc'],
  ['r5', '.vue component missing a @component header block'],
  ['r6', '.vue component header block missing @displayName/@description'],
  ['r8', 'over-narration — speculative wording or oversized JSDoc block'],
  ['r9', 'test rule-number label (R-x/Ax/COL-x/Tx/TOP-x/Stagex) — use semantic names'],
  ['r10', '/** */ JSDoc block with <zh/> but no <en/>'],
  ['r11', '.tsx file missing a @component header block'],
  ['r12', 'component header block missing @category'],
]

let failed = false
for (const [key, label] of BLOCKING) {
  const hits = findings[key]
  if (hits.length === 0)
    continue
  failed = true
  console.error(`Comment convention FAILED [${key}] ${label} — ${hits.length} occurrence(s):`)
  for (const h of hits.slice(0, 20)) console.error(`  ${h}`)
  if (hits.length > 20)
    console.error(`  … and ${hits.length - 20} more`)
}

let warned = 0
for (const [key, label] of REPORTING) {
  const hits = findings[key]
  if (hits.length === 0)
    continue
  warned += hits.length
  const stream = STRICT ? console.error : console.warn
  stream(`Comment convention ${STRICT ? 'FAILED' : 'WARN'} [${key}] ${label} — ${hits.length} occurrence(s):`)
  for (const h of hits) stream(`  ${h}`)
  if (hits.length > 10)
    stream(`  … and ${hits.length - 10} more`)
}
if (STRICT && warned > 0)
  failed = true

if (failed) {
  console.error('Comment convention check failed. See COMMENT_CONVENTIONS.md.')
  process.exitCode = 1
}
else if (warned > 0) {
  out(`Comment convention passed (blocking rules clean; ${warned} report-only item(s), run --strict for full enforcement)`)
}
else {
  out('Comment convention passed (all rules clean)')
}
