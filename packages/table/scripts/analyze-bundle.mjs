/**
 * <zh/> 产物构成分析 — 解析 dist 输出 chunk 明细、首屏/懒加载划分、模块归因与外部依赖断言。
 * <en/> Bundle composition analysis — chunk listing, initial/lazy split, module attribution and external-dependency assertions for dist output.
 *
 * @remarks
 * <zh/> 模块归因基于各 chunk 的 `.map`（`mappings` 按 VLQ 解码统计每源 segment 数，
 * <zh/> 以 segment 占比估算字节数；属近似值，.min 产物注释已剥离故以 token 为口径）。
 * <zh/> 未打入断言双保险：源码用到的重依赖必须在产物中以裸说明符出现（外部化），
 * <zh/> 且任何 `.map` 的 `sources` 不得含其 `node_modules/<pkg>` 路径（未内联实现）。
 * <zh/> dist 缺失时静默跳过（与 check-bundle-size 一致，dev 未构建不断 CI）。
 * <en/> Module attribution reuses each chunk's `.map` (VLQ-decoded `mappings` segment counts per source;
 * <en/> byte shares are estimates in post-minification token terms, as comments are stripped).
 * <en/> External assertions are two-sided: heavy deps used in src must surface as bare specifiers in dist
 * <en/> (externalized), and no `.map` `sources` may contain their `node_modules/<pkg>` paths (not inlined).
 * <en/> Skips quietly when dist is absent (same as check-bundle-size; unbuilt dev never breaks CI).
 *
 * @example
 * node scripts/analyze-bundle.mjs                  // 控制台表格 | console tables
 * node scripts/analyze-bundle.mjs --json reports/bundle.json  // 附带机器可读报告 | also writes a machine-readable report
 * node scripts/analyze-bundle.mjs --html dist/bundle-report.html  // 可视化报告（概览/TreeMap/TreeGraph/重复包） | visual report (overview/treemap/treegraph/duplicates)
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'
import { renderHtmlReport } from './bundle-report-html.mjs'

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁；`out` 之名已被下方 JSON 报告对象占用，故此处用 outLine）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate; `out` is taken by the JSON report object below, hence outLine)
const outLine = msg => process.stdout.write(`${msg}\n`)

const ROOT = join(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const SRC = join(ROOT, 'src')

/** <zh/> 重依赖守卫：源码一旦 import 即必须外部化，绝不允许实现代码进包 | <en/> Heavy-dep guard: once imported in src, must stay external; implementation code must never enter the bundle */
const GUARDED = ['lodash-es', 'dayjs', 'xlsx', 'async-validator', 'vue-draggable-plus', 'nanoid']

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** <zh/> 源码扩展名 | <en/> Source extensions */
const SOURCE_EXT_RE = /\.(ts|tsx|vue)$/
/** <zh/> 源码静态 import（排除 import type） | <en/> Static imports in src (excluding import type) */
const SRC_STATIC_IMPORT_RE = /\bimport(?!\s+type\b)[\s\S]*?from\s*['"]([^'"]+)['"]/g
/** <zh/> 源码动态 import | <en/> Dynamic imports in src */
const SRC_DYNAMIC_IMPORT_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/g
/** <zh/> 产物裸说明符（静态 from 双/单引号、动态 import 引号与模板字符串） | <en/> Bare specifiers in output (static from quotes, dynamic import quotes and template literals) */
const DIST_BARE_RES = [
  /\bfrom"([^"]+)"/g,
  /\bfrom'([^']+)'/g,
  /import\(\s*"([^"]+)"\s*\)/g,
  /import\(\s*'([^']+)'\s*\)/g,
  /\bfrom`([^`$]+)`/g,
  /import\(\s*`([^`$]+)`\s*\)/g,
]
/** <zh/> 反斜杠归一 | <en/> Backslash normalization */
const BACKSLASH_RE = /\\/g
/** <zh/> node_modules 包路径捕获 | <en/> node_modules package path capture */
const NODE_MODULES_RE = /node_modules\/(.+?)(?:\/|$)/

/**
 * <zh/> 解码单 segment 的 VLQ 字段 | <en/> Decode one segment's VLQ fields
 */
function decodeVlq(s) {
  const out = []
  let v = 0
  let shift = 0
  for (const ch of s) {
    const d = B64.indexOf(ch)
    if (d < 0)
      continue
    v |= (d & 31) << shift
    if (d & 32) {
      shift += 5
    }
    else {
      const neg = v & 1
      v >>= 1
      out.push(neg ? -v : v)
      v = 0
      shift = 0
    }
  }
  return out
}

/**
 * <zh/> 统计 mappings 中每个源的 segment 数（源索引跨行累计，生成列按行重置） | <en/> Count segments per source in mappings (source index accumulates across lines, generated column resets per line)
 */
function countSegmentsBySource(mappings, sourceCount) {
  const counts = Array.from({ length: sourceCount }).fill(0)
  let src = 0
  for (const line of String(mappings ?? '').split(';')) {
    if (!line)
      continue
    for (const seg of line.split(',')) {
      if (!seg)
        continue
      const f = decodeVlq(seg)
      if (f.length >= 2) {
        src += f[1]
        if (src >= 0 && src < sourceCount)
          counts[src]++
      }
    }
  }
  return counts
}

/** <zh/> 源码目录递归收集 ts/vue/tsx（跳过 node_modules 与隐藏目录） | <en/> Recursively collect ts/vue/tsx under a dir (skips node_modules and dot-dirs) */
function walkSources(dir, out = []) {
  if (!existsSync(dir))
    return out
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.'))
      continue
    const p = join(dir, e)
    if (statSync(p).isDirectory())
      walkSources(p, out)
    else if (SOURCE_EXT_RE.test(e))
      out.push(p)
  }
  return out
}

/** <zh/> 源码实际 import 的裸包（静态 + 动态，含子路径如 dayjs/plugin/relativeTime） | <en/> Bare packages actually imported in src (static + dynamic, incl. subpaths like dayjs/plugin/relativeTime) */
function scanSrcImports() {
  const used = new Set()
  for (const file of walkSources(SRC)) {
    const content = readFileSync(file, 'utf-8')
    for (const re of [SRC_STATIC_IMPORT_RE, SRC_DYNAMIC_IMPORT_RE]) {
      re.lastIndex = 0
      for (let m = re.exec(content); m !== null; m = re.exec(content)) {
        const spec = m[1]
        if (!spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('node:'))
          used.add(spec)
      }
    }
  }
  return used
}

/** <zh/> 产物 chunk 中的裸说明符（静态 from + 动态 import，含压缩后的模板字符串形态） | <en/> Bare specifiers in output chunks (static from + dynamic import, incl. minified template-literal forms) */
function scanDistImports(code) {
  const found = new Set()
  // <zh/> 压缩产物里的动态 import 常为模板字符串 import(`xlsx`)（无占位符时等价于裸说明符），已并入 DIST_BARE_RES | <en/> Dynamic imports in minified output are often template literals like import(`xlsx`) (equal to a bare specifier when placeholder-free), covered by DIST_BARE_RES
  for (const re of DIST_BARE_RES) {
    re.lastIndex = 0
    for (let m = re.exec(code); m !== null; m = re.exec(code)) {
      const spec = m[1]
      if (!spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('node:') && !spec.startsWith('#'))
        found.add(spec)
    }
  }
  return found
}

/** <zh/> 包名归一：@scope/pkg 取前两段，子路径折叠到根包 | <en/> Normalize to root package: two segments for scopes, subpaths fold to the root */
function rootPkg(spec) {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

function kb(n) {
  return `${(n / 1024).toFixed(1)}KB`
}

if (!existsSync(DIST)) {
  console.warn('Bundle analysis skipped (no dist — run build first)')
  process.exit(0)
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
const allowedRoots = new Set([
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
  'async-validator',
])

const esmChunks = readdirSync(DIST)
  .filter(f => f.endsWith('.mjs') && !f.endsWith('.map'))
  .map(f => ({ name: f, path: join(DIST, f) }))
  .filter(f => statSync(f.path).isFile())

if (esmChunks.length === 0) {
  console.warn('Bundle analysis skipped (no .mjs chunks in dist)')
  process.exit(0)
}

// <zh/> chunk 体积（raw + gzip） | <en/> Chunk sizes (raw + gzip)
const chunks = esmChunks.map((c) => {
  const buf = readFileSync(c.path)
  const code = buf.toString('utf-8')
  return { ...c, bytes: buf.length, gzip: gzipSync(buf).length, code }
})
const chunkByName = new Map(chunks.map(c => [c.name, c]))

// <zh/> 首屏/懒加载划分：从 index.mjs 静态 import 传递闭包为首屏，动态 import 为懒加载 | <en/> Initial/lazy split: transitive static-import closure from index.mjs is initial, dynamic imports are lazy
const entry = chunkByName.get('index.mjs') ?? chunks[0]
const staticRe = /\bfrom"\.\/([^"]+)"|\bfrom'\.\/([^']+)'/g
const dynamicRe = /import\(\s*["']\.\/([^"']+)["']\s*\)/g
function relDeps(code, re) {
  const out = new Set()
  re.lastIndex = 0
  for (let m = re.exec(code); m !== null; m = re.exec(code)) out.add(m[1] ?? m[2])
  return out
}
const syncSet = new Set([entry.name])
const lazySet = new Set()
{
  const queue = [entry]
  while (queue.length > 0) {
    const cur = queue.pop()
    for (const dep of relDeps(cur.code, staticRe)) {
      if (chunkByName.has(dep) && !syncSet.has(dep)) {
        syncSet.add(dep)
        queue.push(chunkByName.get(dep))
      }
    }
    for (const dep of relDeps(cur.code, dynamicRe)) {
      if (chunkByName.has(dep) && !syncSet.has(dep))
        lazySet.add(dep)
    }
  }
}
for (const c of chunks) {
  if (!syncSet.has(c.name) && !lazySet.has(c.name))
    lazySet.add(c.name)
}
const sum = names => [...names].reduce((a, n) => a + chunkByName.get(n).bytes, 0)
const sumGz = names => [...names].reduce((a, n) => a + chunkByName.get(n).gzip, 0)

// <zh/> 模块归因：逐 chunk 解 map，按 segment 占比分摊字节 | <en/> Module attribution: decode each chunk map, share bytes by segment proportion
const modules = new Map()
const nodeModulesHits = new Map()
/** <zh/> 每 chunk 的模块表（供 HTML 报告） | <en/> Per-chunk module tables (for the HTML report) */
const chunkModules = new Map()
/** <zh/> 模块源码片段（截断，node_modules 除外，供模块详情） | <en/> Truncated module sources (excl. node_modules, for module details) */
const moduleSources = new Map()
/** <zh/> node_modules 包明细（重复包判定用） | <en/> node_modules package details (for duplicate detection) */
const dupPkgs = new Map()
/** <zh/> 源码片段截断行数 | <en/> Source snippet truncation lines */
const SOURCE_SNIPPET_LINES = 80
for (const c of chunks) {
  const mapPath = `${c.path}.map`
  if (!existsSync(mapPath))
    continue
  let map
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf-8'))
  }
  catch {
    continue
  }
  const sources = map.sources ?? []
  if (sources.length === 0)
    continue
  const counts = countSegmentsBySource(map.mappings, sources.length)
  const total = counts.reduce((a, b) => a + b, 0) || 1
  const mapDir = dirname(mapPath)
  sources.forEach((s, i) => {
    if (s == null || counts[i] === 0)
      return
    const abs = resolve(mapDir, String(s).replace(BACKSLASH_RE, '/'))
    const rel = relative(ROOT, abs).replace(BACKSLASH_RE, '/')
    const share = counts[i] / total
    const prev = modules.get(rel) ?? { bytes: 0, chunks: new Set() }
    prev.bytes += c.bytes * share
    prev.chunks.add(c.name)
    modules.set(rel, prev)
    let cm = chunkModules.get(c.name)
    if (!cm) {
      cm = new Map()
      chunkModules.set(c.name, cm)
    }
    cm.set(rel, (cm.get(rel) ?? 0) + c.bytes * share)
    const content = map.sourcesContent?.[i]
    if (typeof content === 'string' && !moduleSources.has(rel) && !rel.startsWith('node_modules/')) {
      const lines = content.split('\n')
      moduleSources.set(rel, lines.length > SOURCE_SNIPPET_LINES
        ? `${lines.slice(0, SOURCE_SNIPPET_LINES).join('\n')}\n…（以下 ${lines.length - SOURCE_SNIPPET_LINES} 行已截断）`
        : content)
    }
    const nm = rel.match(NODE_MODULES_RE)
    if (nm) {
      const p = rootPkg(nm[1])
      nodeModulesHits.set(p, (nodeModulesHits.get(p) ?? 0) + c.bytes * share)
      let d = dupPkgs.get(p)
      if (!d) {
        d = { bytes: 0, chunks: new Set(), paths: new Set() }
        dupPkgs.set(p, d)
      }
      d.bytes += c.bytes * share
      d.chunks.add(c.name)
      d.paths.add(rel.slice(0, rel.indexOf(nm[1]) + nm[1].length))
    }
  })
}
const topModules = Array.from(modules.entries(), ([file, v]) => ({ file, bytes: Math.round(v.bytes), share: v.bytes / entry.bytes, chunks: [...v.chunks] }))
  .sort((a, b) => b.bytes - a.bytes)

// <zh/> 外部依赖断言 | <en/> External-dependency assertions
const srcImports = scanSrcImports()
const distBare = new Set()
for (const c of chunks) {
  for (const s of scanDistImports(c.code)) distBare.add(s)
}
const distRoots = new Set(Array.from(distBare, rootPkg))
const failures = []
const guardReport = []
for (const g of GUARDED) {
  const usedInSrc = [...srcImports].some(s => s === g || s.startsWith(`${g}/`))
  if (!usedInSrc) {
    guardReport.push({ pkg: g, usedInSrc: false, external: null, bundled: false })
    continue
  }
  const external = [...distBare].some(s => s === g || s.startsWith(`${g}/`))
  const bundledBytes = [...nodeModulesHits.entries()]
    .filter(([p]) => p === g || p.startsWith(`${g}/`))
    .reduce((a, [, b]) => a + b, 0)
  guardReport.push({ pkg: g, usedInSrc: true, external, bundled: bundledBytes > 1 })
  if (!external)
    failures.push(`${g} 在源码中有 import，但产物里没有对应的外部引用（可能被打进包）`)
  if (bundledBytes > 1)
    failures.push(`${g} 的实现代码被打进包（map 归因约 ${kb(bundledBytes)}）`)
}
const unexpected = [...distRoots].filter(r => !allowedRoots.has(r))
if (unexpected.length > 0)
  failures.push(`产物出现 package.json 未声明的外部依赖：${unexpected.join(', ')}`)

// <zh/> 控制台输出 | <en/> Console output
outLine(`Bundle composition — ${pkg.name} v${pkg.version} (${chunks.length} ESM chunks)`)
outLine('')
outLine('Chunks (ESM):')
for (const c of [...chunks].sort((a, b) => b.bytes - a.bytes)) {
  const kind = c.name === entry.name ? 'entry' : syncSet.has(c.name) ? 'sync ' : 'lazy '
  outLine(`  [${kind}] ${c.name}  ${kb(c.bytes)} raw / ${kb(c.gzip)} gzip`)
}
outLine(`  initial (entry + sync closure): ${kb(sum(syncSet))} raw / ${kb(sumGz(syncSet))} gzip — ${syncSet.size} file(s)`)
outLine(`  lazy (dynamic): ${kb(sum(lazySet))} raw / ${kb(sumGz(lazySet))} gzip — ${lazySet.size} file(s)`)
outLine('')
outLine('Top modules in entry closure (segment-share estimate, post-minification tokens):')
for (const m of topModules.filter(m => m.chunks.includes(entry.name)).slice(0, 20)) {
  outLine(`  ${(m.share * 100).toFixed(1).padStart(5)}%  ${kb(m.bytes).padStart(8)}  ${m.file}`)
}
outLine('')
outLine('External assertions:')
for (const g of guardReport) {
  if (!g.usedInSrc) {
    outLine(`  (skip) ${g.pkg} — 源码未引用`)
    continue
  }
  outLine(`  ${g.external && !g.bundled ? 'PASS' : 'FAIL'} ${g.pkg} — 外部引用：${g.external ? '有' : '无'}，实现打入：${g.bundled ? '有' : '无'}`)
}
if (nodeModulesHits.size > 0) {
  outLine('node_modules sources in maps (should be empty for a clean external build):')
  for (const [p, b] of [...nodeModulesHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10))
    outLine(`  ${kb(b)}  ${p}`)
}
else {
  outLine('node_modules sources in maps: none — 上游依赖零打入')
}

const jsonIdx = process.argv.indexOf('--json')
if (jsonIdx >= 0 && process.argv[jsonIdx + 1]) {
  const out = {
    package: pkg.name,
    version: pkg.version,
    entry: entry.name,
    chunks: chunks.map(c => ({
      name: c.name,
      kind: c.name === entry.name ? 'entry' : syncSet.has(c.name) ? 'sync' : 'lazy',
      bytes: c.bytes,
      gzip: c.gzip,
    })),
    initial: { bytes: sum(syncSet), gzip: sumGz(syncSet), files: [...syncSet] },
    lazy: { bytes: sum(lazySet), gzip: sumGz(lazySet), files: [...lazySet] },
    topModules: topModules.slice(0, 50),
    externals: { bare: [...distBare].sort(), guard: guardReport },
    nodeModulesSources: Array.from(nodeModulesHits.entries(), ([p, bytes]) => ({ pkg: p, bytes: Math.round(bytes) })),
  }
  writeFileSync(resolve(process.cwd(), process.argv[jsonIdx + 1]), `${JSON.stringify(out, null, 2)}\n`)
  outLine(`\nJSON report written to ${process.argv[jsonIdx + 1]}`)
}

const htmlIdx = process.argv.indexOf('--html')
if (htmlIdx >= 0) {
  const flag = process.argv[htmlIdx + 1]
  const htmlPath = flag && !flag.startsWith('-') ? resolve(process.cwd(), flag) : join(DIST, 'bundle-report.html')
  const report = {
    package: pkg.name,
    version: pkg.version,
    generatedAt: new Date().toISOString(),
    entry: entry.name,
    totals: {
      jsBytes: chunks.reduce((a, c) => a + c.bytes, 0),
      jsGzip: chunks.reduce((a, c) => a + c.gzip, 0),
      initialBytes: sum(syncSet),
      initialGzip: sumGz(syncSet),
      lazyBytes: sum(lazySet),
      lazyGzip: sumGz(lazySet),
      chunkCount: chunks.length,
      moduleCount: modules.size,
      dupCount: Array.from(dupPkgs.values(), d => d.paths.size).filter(n => n > 1).length,
    },
    chunks: chunks.map(c => ({
      name: c.name,
      kind: c.name === entry.name ? 'entry' : syncSet.has(c.name) ? 'sync' : 'lazy',
      bytes: c.bytes,
      gzip: c.gzip,
      modules: Array.from(chunkModules.get(c.name) ?? [], ([file, bytes]) => ({ file, bytes: Math.round(bytes) }))
        .sort((a, b) => b.bytes - a.bytes),
    })),
    initial: { bytes: sum(syncSet), gzip: sumGz(syncSet), files: [...syncSet] },
    lazy: { bytes: sum(lazySet), gzip: sumGz(lazySet), files: [...lazySet] },
    duplicates: Array.from(dupPkgs.entries(), ([p, d]) => ({
      pkg: p,
      bytes: Math.round(d.bytes),
      copies: d.paths.size,
      paths: [...d.paths].sort(),
      chunks: [...d.chunks].sort(),
    })).sort((a, b) => b.bytes - a.bytes),
    externals: { guard: guardReport },
    sources: Object.fromEntries(moduleSources),
  }
  writeFileSync(htmlPath, renderHtmlReport(report))
  outLine(`\nHTML report written to ${htmlPath}`)
}

if (failures.length > 0) {
  console.error('\nBundle analysis FAILED:')
  for (const f of failures) console.error(`  ${f}`)
  process.exitCode = 1
}
else {
  outLine('\nBundle analysis passed (externals clean)')
}
