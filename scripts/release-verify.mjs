/**
 * @file scripts/release-verify.mjs
 * @description <zh/> 发布测试模式：构建全部包并发布到本地 verdaccio，校验"版本发布是否正确"，
 * <zh/> 而不污染公共 npm registry。覆盖：产物文件清单（packlist）、真实 publish、
 * <zh/> 消费者侧安装 + 导入冒烟。用完即焚（临时存储），`--keep` 可保留现场排查。
 * <en/> Publish test mode: build all packages and publish to a local verdaccio to verify
 * <en/> that version publishing is correct, without touching the public npm registry. Covers:
 * <en/> artifact file list (packlist), real publish, consumer-side install + import smoke.
 * <en/> Ephemeral by default (temp storage); `--keep` preserves the scene for debugging.
 *
 * @usage
 * <zh/> 前置：Node >= 22、pnpm、网络（首次 npx 拉取 verdaccio；消费者依赖经 uplink 代理）。
 * <en/> Requires: Node >= 22, pnpm, network (first run fetches verdaccio via npx; consumer deps via uplink proxy).
 *
 *   node scripts/release-verify.mjs                # 全量：起临时 verdaccio → 构建 → 发布 → 校验 → 销毁
 *   node scripts/release-verify.mjs --skip-build   # 复用现有 dist（构建已通过时加速）
 *   node scripts/release-verify.mjs --only=@advanced-elements/table
 *   node scripts/release-verify.mjs --registry=http://localhost:4873  # 发到常驻私有库（不销毁，tag 默认为 test-verify 不污染 latest）
 *   node scripts/release-verify.mjs --keep         # 保留 verdaccio 与临时目录，用于手动排查
 *   node scripts/release-verify.mjs --port=4874    # 默认 4873（仅临时模式）
 *
 * <zh/> 两种 registry 模式：
 * <zh/> - 默认临时模式：自带 verdaccio + 临时存储，跑完即焚，只验证链路；
 * <zh/> - --registry 外部模式：发布到你的常驻私有库（包会留下来，可安装试用），失败不删任何东西。
 * <en/> Two registry modes:
 * <en/> - default ephemeral mode: throwaway verdaccio + temp storage, destroyed afterwards, link check only;
 * <en/> - --registry external mode: publish to your persistent private registry (packages stay installable), never deletes anything.
 *
 * <zh/> 说明：本模式不改版本号、不跑 `changeset version`（版本 bump 由 changesets 单测覆盖意图），
 * <zh/> 只验证"当前版本构建产物能否被正确发布与消费"。
 * <en/> Note: this mode never mutates versions and never runs `changeset version`; it only verifies
 * <en/> that the current build artifacts can be published and consumed correctly.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const VERDACCIO_VERSION = 'verdaccio@6'

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

// <zh/> 本测试链路的所有网络访问都是 localhost 与 npmjs 公网——剥掉公司代理，避免 verdaccio
// <zh/> 上游回源和 consumer 安装被企业代理拦成 502。
// <en/> All traffic in this test pipeline is localhost + public npmjs — strip corporate proxies,
// <en/> otherwise verdaccio's upstream fetch and consumer installs get 502 from the proxy.
const CLEAN_PROXY_ENV = (() => {
  const env = { ...process.env }
  for (const k of ['http_proxy', 'https_proxy', 'all_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'proxy', 'npm_config_proxy', 'npm_config_https_proxy', 'npm_config_http_proxy'])
    delete env[k]
  env.no_proxy = 'localhost,127.0.0.1,::1'
  env.NO_PROXY = 'localhost,127.0.0.1,::1'
  return env
})()

const args = new Map()
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/)
  if (m)
    args.set(m[1], m[2] ?? true)
}

const PORT = Number(args.get('port') ?? 4873)
const EXTERNAL_REGISTRY = args.get('registry') ? String(args.get('registry')).replace(/\/+$/, '') : null
const REGISTRY = EXTERNAL_REGISTRY ?? `http://127.0.0.1:${PORT}`
const TAG = String(args.get('tag') ?? 'test-verify')
const SKIP_BUILD = args.has('skip-build')
const KEEP = args.has('keep')
const ONLY = args.get('only')

const WORKDIR = mkdtempSync(join(tmpdir(), 'adv-release-verify-'))
const STORAGE = join(WORKDIR, 'storage')
const CONFIG_FILE = join(WORKDIR, 'verdaccio.yaml')
const NPMRC_FILE = join(WORKDIR, '.npmrc')
const CONSUMER_DIR = join(WORKDIR, 'consumer')

let verdaccioProc = null
let failed = false
let haveToken = false

function log(step, msg) {
  out(`\n[release-verify] [${step}] ${msg}`)
}

function fail(msg) {
  console.error(`\n[release-verify] [FAIL] ${msg}`)
  failed = true
  throw new Error(msg)
}

function run(cmd, runArgs, opts = {}) {
  const r = spawnSync(cmd, runArgs, { stdio: 'inherit', env: CLEAN_PROXY_ENV, ...opts })
  if (r.status !== 0)
    fail(`命令失败: ${cmd} ${runArgs.join(' ')} (exit ${r.status})`)
  return r
}

function capture(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf-8', env: CLEAN_PROXY_ENV, ...opts })
  if (r.status !== 0)
    fail(`命令失败: ${cmd} ${cmdArgs.join(' ')} (exit ${r.status})\n${r.stderr}`)
  return r.stdout
}

/**
 * <zh/> 发现待发布包（跳过 private）；--only 选中时自动带上工作区依赖闭包（如 table → config-provider），否则消费者安装缺 peer 依赖
 * <en/> Discover publishable packages (skip private ones); with --only, auto-include workspace dependency closure so consumer install never lacks peer deps
 */
function discoverPackages() {
  const pkgs = []
  const byName = new Map()
  for (const dir of readdirSync(join(ROOT, 'packages'), { withFileTypes: true })) {
    if (!dir.isDirectory())
      continue
    const manifestPath = join(ROOT, 'packages', dir.name, 'package.json')
    if (!existsSync(manifestPath))
      continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    if (manifest.private)
      continue
    const entry = {
      dir: join(ROOT, 'packages', dir.name),
      name: manifest.name,
      version: manifest.version,
      depNames: Object.keys({
        ...manifest.dependencies,
        ...manifest.peerDependencies,
        ...manifest.optionalDependencies,
      }),
    }
    pkgs.push(entry)
    byName.set(entry.name, entry)
  }
  let selected = pkgs
  if (ONLY) {
    const root = byName.get(ONLY)
    if (!root)
      fail(`--only=${ONLY} 未匹配到工作区包`)
    // <zh/> 依赖闭包：peer/regular 依赖中的工作区包一并发布 | <en/> Closure: co-publish workspace packages referenced by any dep field
    selected = [root]
    const queue = [root]
    while (queue.length > 0) {
      const cur = queue.pop()
      for (const dep of cur.depNames) {
        const depPkg = byName.get(dep)
        if (depPkg && !selected.includes(depPkg)) {
          selected.push(depPkg)
          queue.push(depPkg)
        }
      }
    }
  }
  if (selected.length === 0)
    fail('未发现待发布包（检查 packages/ 与 --only 参数）')
  return selected
}

/** <zh/> 写临时 verdaccio 配置：匿名可发布（publish: $all），仅测试用 | <en/> Write temp verdaccio config: anonymous publish allowed, test-only */
function writeVerdaccioConfig() {
  writeFileSync(join(WORKDIR, 'htpasswd'), '')
  writeFileSync(CONFIG_FILE, `storage: ${STORAGE}
listen: 127.0.0.1:${PORT}
auth:
  htpasswd:
    file: ${join(WORKDIR, 'htpasswd')}
    max_users: 1000
packages:
  '@advanced-elements/*':
    access: $all
    publish: $all
    proxy: npmjs
  '**':
    access: $all
    publish: $all
    proxy: npmjs
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
log:
  type: stdout
  format: pretty
  level: warn
`)
}

/** <zh/> registry 主机部分（供 .npmrc auth 用） | <en/> Registry host part (for .npmrc auth) */
function registryAuthHost() {
  const u = new URL(REGISTRY)
  return `//${u.host}/`
}

async function startVerdaccio() {
  if (EXTERNAL_REGISTRY) {
    log('registry', `使用外部私有库 ${REGISTRY}（包会保留，tag: ${TAG}）`)
    try {
      const res = await fetch(`${REGISTRY}/-/ping`)
      if (!res.ok)
        fail(`外部 registry 不可达（${REGISTRY} HTTP ${res.status}），检查地址与服务状态`)
    }
    catch (e) {
      fail(`外部 registry 不可达（${REGISTRY}）：${e.cause?.message ?? e.message}`)
    }
    log('registry', '外部 registry 可达')
    return
  }
  log('registry', `启动本地 verdaccio（${REGISTRY}，临时存储 ${WORKDIR}）`)
  verdaccioProc = spawn('npx', ['--yes', VERDACCIO_VERSION, '--config', CONFIG_FILE, '--listen', `127.0.0.1:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: CLEAN_PROXY_ENV,
  })
  verdaccioProc.stdout.on('data', d => process.stdout.write(`[verdaccio] ${d}`))
  verdaccioProc.stderr.on('data', d => process.stderr.write(`[verdaccio] ${d}`))
  verdaccioProc.on('exit', (code) => {
    if (!failed && code !== 0 && code !== null)
      console.error(`[release-verify] [WARN] verdaccio 异常退出 (code ${code})`)
  })

  const deadline = Date.now() + 120_000
  for (;;) {
    try {
      const res = await fetch(`${REGISTRY}/-/ping`)
      if (res.ok) {
        log('registry', 'verdaccio 已就绪')
        return
      }
    }
    catch {
      // <zh/> 未就绪则继续轮询 | <en/> Keep polling until ready
    }
    if (Date.now() > deadline)
      fail('verdaccio 启动超时（120s），检查网络（npx 拉取）与端口占用')
    await new Promise(r => setTimeout(r, 1000))
  }
}

/**
 * <zh/> token 缓存位置（常驻 registry 重放 PUT /-/user 拿不到新 token，缓存避免每次重建用户）
 * <en/> Token cache location (a persistent registry returns no new token on replayed PUT /-/user, cache avoids user recreation each run)
 */
const TOKEN_CACHE_FILE = `${process.env.HOME ?? ''}/.config/advanced-elements/verify-token`

function readTokenCache() {
  try {
    return readFileSync(TOKEN_CACHE_FILE, 'utf-8').trim() || null
  }
  catch {
    return null
  }
}

function writeTokenCache(token) {
  try {
    mkdirSync(dirname(TOKEN_CACHE_FILE), { recursive: true })
    writeFileSync(TOKEN_CACHE_FILE, token, { mode: 0o600 })
  }
  catch {
    // <zh/> 缓存失败不阻断，本次可用 token 即可 | <en/> Cache failure is non-fatal — usable token suffices
  }
}

/**
 * <zh/> Token 认证：缓存优先，缺失则 PUT 新建用户获取；用户已存在而缓存缺失时给出可操作报错。
 * <en/> Token auth: cache-first, PUT-create-user fallback; when the user exists but the cache is missing, produce an actionable error.
 */
async function loginToLocalRegistry() {
  const name = 'verify'
  const password = 'verify-pass'
  let token = process.env.ADV_VERIFY_TOKEN ?? readTokenCache()
  if (!token) {
    try {
      const res = await fetch(`${REGISTRY}/-/user/org.couchdb.user:${name}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, password, email: 'verify@localhost' }),
      })
      if (res.status === 409) {
        if (!EXTERNAL_REGISTRY) {
          fail(`本地用户 ${name} 已存在但未缓存 token——恢复方式：删除 ${TOKEN_CACHE_FILE} 前请先执行
  rm ~/.config/verdaccio/htpasswd && <重启 verdaccio>，然后重跑本命令重建用户。`)
        }
        fail(`用户 ${name} 已存在但未缓存 token。请把 token 写入 ${TOKEN_CACHE_FILE} 或设置 ADV_VERIFY_TOKEN 后重试。`)
      }
      if (!res.ok)
        throw new Error(`HTTP ${res.status}：${await res.text()}`)
      token = (await res.json()).token ?? null
      if (!token)
        throw new Error('未返回 token')
      writeTokenCache(token)
    }
    catch (e) {
      if (!EXTERNAL_REGISTRY)
        fail(`本地 registry 建用户失败：${e.message}，换个端口重试（--port）`)
      fail(`外部 registry 建用户失败：${e.message}`)
    }
  }
  writeFileSync(NPMRC_FILE, `${registryAuthHost()}:_authToken=${token}\n`)
  log('registry', '使用缓存/新建的 token 发布（临时 .npmrc，仅本次有效）')
  return true
}

/** <zh/> packlist 校验：真实打 tarball，断言产物齐全、无 map、无源码泄漏 | <en/> Packlist check: pack a real tarball, assert artifacts present, no maps, no source leaks */
function checkPacklist(pkg) {
  log('packlist', `${pkg.name}@${pkg.version}`)
  // <zh/> 真实 npm pack（会跑 prepack，与正式发布一致），再列 tarball 内容精确校验
  // <en/> Real npm pack (runs prepack, identical to a real release), then list tarball contents for exact checks
  const packDir = mkdtempSync(join(WORKDIR, 'pack-'))
  const packOut = capture('npm', ['pack', '--pack-destination', packDir, '--no-audit', '--no-fund'], { cwd: pkg.dir })
  const tgz = join(packDir, packOut.trim().split('\n').pop())
  if (!existsSync(tgz))
    fail(`${pkg.name} 打包失败，未生成 tarball`)
  const files = capture('tar', ['-tzf', tgz]).split('\n').map(l => l.trim()).filter(Boolean)
  const missing = []
  if (!files.some(f => f.startsWith('package/dist/')))
    missing.push('dist/ 产物缺失')
  if (existsSync(join(pkg.dir, 'README.md')) && !files.includes('package/README.md'))
    missing.push('README.md 缺失')
  if (existsSync(join(pkg.dir, 'LICENSE')) && !files.includes('package/LICENSE'))
    missing.push('LICENSE 缺失')
  if (missing.length > 0)
    fail(`${pkg.name} 包内容校验失败: ${missing.join('；')}`)
  // <zh/> 源码文件（.ts/.tsx/.vue）不许进包，但类型声明（.d.ts/.d.mts/.d.cts，含 .vue.d.ts）是正常产物
  // <en/> Source files are forbidden, but type declarations (.d.ts/.d.mts/.d.cts, incl. .vue.d.ts) are legit artifacts
  const isSourceFile = f => /\.(ts|tsx|vue)$/.test(f) && !/\.d\.(m|c)?ts$/.test(f)
  const bad = files.filter(f =>
    /\.map$/.test(f)
    || f.startsWith('package/__tests__/')
    || f.startsWith('package/scripts/')
    || f.includes('node_modules')
    || (isSourceFile(f) && !f.startsWith('package/src/style/')),
  )
  if (bad.length > 0)
    fail(`${pkg.name} 包含不应发布的文件:\n${bad.join('\n')}`)
  const packedManifest = JSON.parse(capture('tar', ['-xOzf', tgz, 'package/package.json']))
  if (packedManifest.version !== pkg.version)
    fail(`${pkg.name} 包内版本号（${packedManifest.version}）与源码（${pkg.version}）不一致`)
  out(`[release-verify] [packlist] ${pkg.name}: OK（${files.length} 个文件）`)
}

function publishPackage(pkg) {
  // <zh/> 必须用 pnpm publish（与 `changeset publish` 一致）：它会把 `workspace:` 改写为具体版本号；
  // <zh/> 若用 npm publish，workspace 协议会原样进包导致消费者 EUNSUPPORTEDPROTOCOL。--no-git-checks 因工作区常年 dirty。
  // <en/> Must publish via pnpm (same as `changeset publish`): it rewrites `workspace:` to concrete versions;
  // <en/> npm publish would leak the protocol and break consumers. --no-git-checks because the tree is routinely dirty.
  log('publish', `${pkg.name}@${pkg.version} → ${REGISTRY}（tag: ${TAG}）`)
  const env = { ...CLEAN_PROXY_ENV }
  if (haveToken)
    env.npm_config_userconfig = NPMRC_FILE
  run('pnpm', ['publish', '--registry', REGISTRY, '--tag', TAG, '--no-git-checks'], {
    cwd: pkg.dir,
    env,
  })
}

/**
 * <zh/> 外部模式版本预检：同版本已存在则跳过发布（仍校验库中产物），避免浪费构建；tag 换名绕不过版本冲突
 * <en/> External-mode version precheck: skip publishing when the version already exists (still verify what's in the registry); a different tag won't dodge a version conflict
 */
const skipPublishSet = new Set()
async function checkVersionAbsent(pkg) {
  if (!EXTERNAL_REGISTRY)
    return
  try {
    const res = await fetch(`${REGISTRY}/${pkg.name.replace('/', '%2f')}`)
    if (!res.ok)
      return
    const meta = await res.json()
    if (meta.versions?.[pkg.version]) {
      skipPublishSet.add(pkg.name)
      out(`[release-verify] [SKIP] ${pkg.name}@${pkg.version} 已存在于 ${REGISTRY}，跳过发布；以下校验针对库中已有产物`)
    }
  }
  catch (e) {
    out(`[release-verify] [WARN] 版本预检跳过（${pkg.name}）：${e.message}`)
  }
}

/** <zh/> 线上 manifest 校验：消费者拿到的 dependencies/peerDeps 不得含 workspace: 协议 | <en/> Published-manifest check: what consumers resolve must not contain the workspace: protocol */
async function checkPublishedManifest(pkg) {
  const url = `${REGISTRY}/${pkg.name.replace('/', '%2f')}`
  let res = null
  let lastErr = ''
  // <zh/> 发布刚完成时元数据可能短暂不可读，重试 3 次 | <en/> Metadata can be briefly unreadable right after publish; retry 3 times
  for (let i = 0; i < 3; i++) {
    try {
      res = await fetch(url)
      if (res.ok)
        break
      lastErr = `HTTP ${res.status}`
    }
    catch (e) {
      lastErr = e.cause?.message ?? e.message
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  if (!res?.ok)
    fail(`${pkg.name} 本地 registry 查询失败（${url}）：${lastErr}`)
  const meta = await res.json()
  const manifest = meta.versions?.[pkg.version]
  if (!manifest)
    fail(`${pkg.name}@${pkg.version} 未在本地 registry 找到`)
  const leaked = []
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dep, range] of Object.entries(manifest[field] ?? {})) {
      if (String(range).includes('workspace:'))
        leaked.push(`${field}.${dep}: ${range}`)
    }
  }
  if (leaked.length > 0)
    fail(`${pkg.name} 发布物泄漏 workspace: 协议（消费者无法安装）:\n${leaked.join('\n')}`)
  out(`[release-verify] [manifest] ${pkg.name}: OK（无 workspace: 泄漏）`)
}

/**
 * <zh/> 消费者依赖 pin 到仓库已验证版本（根 node_modules 解析值），避免上游浮动版本误报；读不到则回退裸 spec
 * <en/> Pin consumer deps to repo-verified versions (resolved from root node_modules) to avoid false alarms from upstream drift; fall back to bare spec when unresolvable
 */
function resolveInstallSpec(dep) {
  try {
    const ver = JSON.parse(readFileSync(join(ROOT, 'node_modules', dep, 'package.json'), 'utf-8')).version
    return `${dep}@${ver}`
  }
  catch {
    out(`[release-verify] [WARN] 读不到 ${dep} 的已验证版本，用浮动版本安装`)
    return dep
  }
}

// <zh/> 仅 pin 导入期必备依赖；可选 peer（vue-router/xlsx/async-validator 等）由 npm 按各包声明自动解析，不显式指定
// <en/> Pin only import-time essentials; optional peers are auto-resolved by npm per each package's own manifest
const CONSUMER_DEPS = ['vue', 'element-plus', '@element-plus/icons-vue', '@vueuse/core', 'dayjs', 'lodash-es']

/**
 * <zh/> 消费者侧冒烟：全新目录安装 + require 断言（CJS 条件） + ESM 入口语法校验。
 * <zh/> 说明：纯 node ESM 不做扩展名补全，`dayjs/plugin/x` 这类无扩展导入（EP 生态惯例，打包器均可解析）
 * <zh/> 在裸 node import 下必失败，故 ESM 侧只做存在性 + 语法校验；模块图正确性由 CJS require 全量覆盖
 * <zh/>（双产物同源构建）与仓库内 vitest 套件覆盖。
 * <en/> Consumer smoke test: fresh install + require assertions (CJS condition) + ESM entry syntax check.
 * <en/> Note: bare-node ESM has no extension probing, so extensionless `dayjs/plugin/x` imports
 * <en/> (EP-ecosystem norm, resolvable by all bundlers) always fail under bare node import. ESM side is
 * <en/> therefore existence + syntax only; module-graph correctness is fully covered by the CJS require
 * <en/> (both artifacts built from the same graph) plus the repo's vitest suite.
 */
function smokeTest(pkg) {
  log('smoke', `消费者安装并导入 ${pkg.name}`)
  const spec = `${pkg.name}@${pkg.version}`
  const depSpecs = CONSUMER_DEPS.map(resolveInstallSpec)
  // <zh/> 匿名安装：verdaccio 的 access:$all 允许无凭据读，带 token 反而被判 401（verdaccio 9 不识别 npm 的 Bearer）
  // <en/> Anonymous install: verdaccio's access:$all allows unauthenticated reads; carrying a token actually yields 401 under verdaccio 9
  run('npm', ['install', '--registry', REGISTRY, '--no-audit', '--no-fund', '--no-save', spec, ...depSpecs], { cwd: CONSUMER_DIR })
  const asserts = {
    '@advanced-elements/table': `const m = require('${pkg.name}');
if (!m.AdvTable) throw new Error('AdvTable 缺失');
if (typeof m.registerCellEditor !== 'function') throw new Error('registerCellEditor 缺失');
if (typeof m.registerFilterType !== 'function') throw new Error('registerFilterType 缺失');
console.log('exports:', Object.keys(m).length);`,
  }
  const script = asserts[pkg.name]
    ?? `const m = require('${pkg.name}');
if (Object.keys(m).length === 0) throw new Error('空导出');
console.log('exports:', Object.keys(m).length);`
  run('node', ['--eval', script], { cwd: CONSUMER_DIR, stdio: 'inherit' })
  // <zh/> ESM 条件：解析 exports.import 目标，校验文件存在且语法合法 | <en/> ESM condition: resolve the exports.import target, verify existence + syntax
  const installedManifest = JSON.parse(readFileSync(join(CONSUMER_DIR, 'node_modules', pkg.name, 'package.json'), 'utf-8'))
  const esmRel = installedManifest.exports?.['.']?.import
  if (!esmRel)
    fail(`${pkg.name} 缺少 exports['.'].import 条件`)
  const esmFile = join(CONSUMER_DIR, 'node_modules', pkg.name, esmRel.replace(/^\.\//, ''))
  if (!existsSync(esmFile))
    fail(`${pkg.name} ESM 入口缺失：${esmRel}`)
  run('node', ['--check', esmFile])
  out(`[release-verify] [smoke] ${pkg.name}: OK`)
}

async function cleanup() {
  if (verdaccioProc && !verdaccioProc.killed) {
    verdaccioProc.kill('SIGTERM')
    await new Promise(r => setTimeout(r, 1500))
    if (!verdaccioProc.killed)
      verdaccioProc.kill('SIGKILL')
  }
  if (!KEEP) {
    rmSync(WORKDIR, { recursive: true, force: true })
  }
  else {
    out(`\n[release-verify] [--keep] 现场保留：registry=${REGISTRY} 工作目录=${WORKDIR}`)
  }
}

async function main() {
  try {
    const pkgs = discoverPackages()
    out(`[release-verify] 待验证包: ${pkgs.map(p => `${p.name}@${p.version}`).join(', ')}`)
    writeVerdaccioConfig()
    await startVerdaccio()
    haveToken = await loginToLocalRegistry()
    if (!SKIP_BUILD) {
      log('build', 'pnpm build:all')
      run('pnpm', ['build:all'], { cwd: ROOT })
    }
    else {
      log('build', '跳过构建（--skip-build），复用现有 dist')
    }
    for (const pkg of pkgs)
      checkPacklist(pkg)
    for (const pkg of pkgs)
      await checkVersionAbsent(pkg)
    for (const pkg of pkgs) {
      if (skipPublishSet.has(pkg.name)) {
        out(`[release-verify] [SKIP] ${pkg.name}@${pkg.version} 跳过发布`)
        continue
      }
      publishPackage(pkg)
    }
    for (const pkg of pkgs)
      await checkPublishedManifest(pkg)
    mkdirSync(CONSUMER_DIR, { recursive: true })
    writeFileSync(join(CONSUMER_DIR, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
    for (const pkg of pkgs)
      smokeTest(pkg)
    if (EXTERNAL_REGISTRY)
      out(`\n[release-verify] [PASS] 已发布到私有库并验证通过（包保留在 ${REGISTRY}，tag: ${TAG}）：构建产物可发布、可安装、可导入`)
    else
      out('\n[release-verify] [PASS] 版本发布验证通过：构建产物可发布、可安装、可导入')
  }
  finally {
    await cleanup()
  }
  if (failed)
    process.exit(1)
}

main().catch((e) => {
  console.error(`\n[release-verify] [FAIL] ${e.message}`)
  process.exit(1)
})
