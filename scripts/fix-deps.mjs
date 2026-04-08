#!/usr/bin/env node
/**
 * <zh/> 修复 pnpm 模块目录「状态文件与产物不一致」的问题。
 *
 * <zh/> 典型症状（本脚本要解决的那一个）：
 * <zh/>   · `node_modules/.bin` 目录整体缺失（或只有部分条目）；
 * <zh/>   · husky pre-commit 报 `Command "lint-staged" not found`
 * <zh/>     （pnpm 侧表现为 `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`）；
 * <zh/>   · 而 `pnpm install` 秒回 `Already up to date`，换 `--force` 也一样。
 *
 * <zh/> 根因：pnpm 以 `node_modules/.pnpm-workspace-state.json` 等状态文件判定「无需安装」，
 * <zh/> 该判定**不校验 `.bin` 链接层**。node_modules 若被「不带符号链接地复制/恢复」过
 * <zh/> （zip、部分备份工具、跨盘复制等），链接层会整体丢失，而状态文件还在，
 * <zh/> 于是 pnpm 永远认为一切正常，`.bin` 永远不会被重建。
 *
 * <zh/> 处理流程（逐级升级，能轻则轻）：
 * <zh/>   1. 删除 pnpm 状态文件 → `pnpm install`（多数情况即可重建 `.bin`）；
 * <zh/>   2. 仍无 `.bin` → 删除整个 `node_modules` → 重新 `pnpm install`（确定性兜底）；
 * <zh/>   3. 校验关键二进制是否可用，并给出明确结论与后续建议。
 *
 * <en/> Repair a pnpm modules directory whose state files disagree with its artifacts.
 *
 * <en/> Symptoms this script addresses:
 * <en/>   · `node_modules/.bin` is missing entirely (or partially);
 * <en/>   · the husky pre-commit hook fails with `Command "lint-staged" not found`
 * <en/>     (pnpm reports `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`);
 * <en/>   · yet `pnpm install` answers `Already up to date` instantly, `--force` included.
 *
 * <en/> Root cause: pnpm decides "nothing to install" from state files such as
 * <en/> `node_modules/.pnpm-workspace-state.json`, and that decision **does not verify the `.bin` link
 * <en/> layer**. If `node_modules` was ever copied/restored without symlink support (zip, some backup
 * <en/> tools, cross-volume copies), the link layer is lost while the state files survive, so pnpm keeps
 * <en/> believing everything is fine and `.bin` is never rebuilt.
 *
 * <en/> Flow (escalating, cheapest first):
 * <en/>   1. drop pnpm state files → `pnpm install` (enough in most cases);
 * <en/>   2. still no `.bin` → remove `node_modules` entirely → `pnpm install` (deterministic fallback);
 * <en/>   3. verify the critical binaries and print a clear verdict plus next steps.
 *
 * @remarks
 * <zh/> 刻意写成 `.mjs` 并用 `node` 运行（`pnpm deps:fix`），因为本脚本的修复对象正是
 * <zh/> `node_modules/.bin`——不能用 `esno` / `vitest` 等经 `.bin` 解析的工具来引导自己。
 * <en/> Deliberately a `.mjs` run by `node` (`pnpm deps:fix`): the very thing being repaired is
 * <en/> `node_modules/.bin`, so the script must not bootstrap itself through `.bin`-resolved tools
 * <en/> such as `esno` or `vitest`.
 *
 * @param --hard - <zh/> 跳过健康检查与第 1 级，直接删除 `node_modules` 全量重装——用于 `.bin` 完好但依赖包内容残缺的情况 | <en/> skip the health check and step 1, removing `node_modules` for a full reinstall — for when `.bin` is intact but package contents are incomplete
 * @param --dry-run - <zh/> 只体检并打印将要执行的动作，不做任何修改 | <en/> inspect and print the planned actions only, changing nothing
 * @returns <zh/> 进程退出码：0 修复成功 / 1 修复失败 | <en/> exit code: 0 repaired, 1 unrepaired
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const MODULES_DIR = join(ROOT, 'node_modules')

/**
 * <zh/> pnpm 用于判定「无需安装」的状态文件——只要它们还在，缺失的 `.bin` 就不会被修复。
 * <en/> State files pnpm uses to decide "nothing to install" — while they exist, a missing `.bin`
 * <en/> is never repaired.
 */
const PNPM_STATE_FILES = [
  '.pnpm-workspace-state.json',
  '.modules.yaml',
  join('.pnpm', 'lock.yaml'),
]

/** <zh/> 修复后必须可用的关键二进制（缺任一即认为未修好） | <en/> Binaries that must work afterwards */
const CRITICAL_BINS = ['lint-staged', 'vitest', 'eslint', 'vue-tsc', 'turbo']

const hardMode = process.argv.includes('--hard')
const dryRun = process.argv.includes('--dry-run')

/**
 * <zh/> Windows 下必须 `shell: true`——Node 自安全修复（CVE-2024-27980）起，
 * <zh/> `spawn` 直接执行 `.cmd`/`.bat` 会抛 `EINVAL`；因此这里以 shell 方式调用 `pnpm.cmd`。
 * <en/> `shell: true` is required on Windows — since Node's security fix (CVE-2024-27980),
 * <en/> spawning a `.cmd`/`.bat` directly throws `EINVAL`, so `pnpm.cmd` is invoked through a shell.
 */
const IS_WINDOWS = process.platform === 'win32'
/** <zh/> 可用 `PNPM=<绝对路径>` 覆盖（pnpm 不在 PATH 时） | <en/> overridable via `PNPM=<absolute path>` when pnpm is not on PATH */
const PNPM_COMMAND = process.env.PNPM ?? (IS_WINDOWS ? 'pnpm.cmd' : 'pnpm')

/** <zh/> 统一日志前缀，便于与 pnpm 自身输出区分 | <en/> Unified log prefix to stand out from pnpm's own output */
function log(message) {
  process.stdout.write(`\n[deps:fix] ${message}\n`)
}

/** <zh/> 运行 pnpm，返回退出码 | <en/> Run pnpm, returning its exit code */
function runPnpm(args) {
  return spawnSync(PNPM_COMMAND, args, { cwd: ROOT, stdio: 'inherit', shell: IS_WINDOWS }).status ?? 1
}

/**
 * <zh/> pnpm 预检——必须在任何破坏性动作（删 `node_modules`）之前完成：
 * <zh/> 经 shell 调用时「命令不存在」不会产生 ENOENT，而是一个非 0 退出码，
 * <zh/> 若不预检就会把「pnpm 没装」误判为「安装失败」，进而执行删除。
 *
 * <en/> pnpm preflight — must run before any destructive step (removing `node_modules`): when invoked
 * <en/> through a shell, "command not found" yields no ENOENT but a non-zero exit code, so without this
 * <en/> check "pnpm is not installed" would be misread as "install failed" and trigger the deletion.
 *
 * @returns <zh/> 版本号字符串；不可用时返回 null | <en/> the version string, or null when unusable
 */
function resolvePnpmVersion() {
  const result = spawnSync(PNPM_COMMAND, ['--version'], { cwd: ROOT, shell: IS_WINDOWS, encoding: 'utf8' })
  if (result.error || result.status !== 0)
    return null
  return String(result.stdout ?? '').trim() || null
}

/**
 * <zh/> 删除 `node_modules`——**优先系统原生命令**。
 *
 * <zh/> 理由有两条：① 递归删除数十万小文件，原生命令远快于 Node；② 部分宿主（如 IDE 沙箱）
 * <zh/> 会把 Node 的 `fs.rmSync` 接管为"移入回收站"的安全删除实现，大目录直接 `ETIMEDOUT`
 * <zh/> （实测本仓库即在第 2 级删除处失败）。两种方式都失败时打印明确指引而非抛栈。
 *
 * <en/> Remove `node_modules` — **native shell command first**.
 *
 * <en/> Two reasons: (1) deleting hundreds of thousands of small files is far faster natively; (2) some hosts
 * <en/> (IDE sandboxes) wrap Node's `fs.rmSync` with a "move to trash" safe-delete implementation that times
 * <en/> out (`ETIMEDOUT`) on large trees — observed failing at this very step in this repository. When both
 * <en/> paths fail, print actionable guidance instead of a stack trace.
 */
function removeModulesDir() {
  const command = IS_WINDOWS ? 'cmd' : 'rm'
  const args = IS_WINDOWS
    ? ['/d', '/s', '/c', 'rmdir', '/s', '/q', 'node_modules']
    : ['-rf', 'node_modules']
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' })
  if (result.status === 0 && !existsSync(MODULES_DIR))
    return
  try {
    rmSync(MODULES_DIR, { recursive: true, force: true })
  }
  catch {
    // 交由调用方在后续安装失败时报错
  }
  if (existsSync(MODULES_DIR)) {
    log('删除 node_modules 失败（可能被安全删除机制拦截）。请手动执行后重跑本命令：')
    log(IS_WINDOWS ? '  Remove-Item -Recurse -Force node_modules' : '  rm -rf node_modules')
  }
}

/** <zh/> 删除 pnpm 状态文件，返回被删除的相对路径 | <en/> Remove pnpm state files, returning the removed relative paths */
function removeStateFiles() {
  const removed = []
  for (const file of PNPM_STATE_FILES) {
    const absolute = join(MODULES_DIR, file)
    if (!existsSync(absolute))
      continue
    rmSync(absolute, { force: true })
    removed.push(relative(ROOT, absolute).split('\\').join('/'))
  }
  return removed
}

/** <zh/> 检查 `.bin` 链接层，返回条目数与缺失的关键二进制 | <en/> Inspect the `.bin` link layer, returning entry count and missing critical binaries */
function inspectBin() {
  const binDir = join(MODULES_DIR, '.bin')
  if (!existsSync(binDir))
    return { exists: false, count: 0, missing: CRITICAL_BINS }
  const entries = readdirSync(binDir)
  const missing = CRITICAL_BINS.filter(
    bin => !entries.some(entry => entry === bin || entry === `${bin}.cmd` || entry === `${bin}.ps1`),
  )
  return { exists: true, count: entries.length, missing }
}

log('检查 node_modules 现状 …')
const before = inspectBin()
log(before.exists
  ? `node_modules/.bin 存在，共 ${before.count} 个条目，缺失关键二进制：${before.missing.join(', ') || '无'}`
  : 'node_modules/.bin 不存在 —— 与 husky pre-commit 报 "Command not found" 的症状一致')

/**
 * <zh/> 健康检查提前返回——**`--hard` 必须绕过**：损坏未必体现在 `.bin` 上
 * <zh/> （实例：`node_modules/@vueuse/core` 缺 `dist`、per-package 链接缺失，而 `.bin` 完好），
 * <zh/> 此时唯一可靠的修法就是全量重装，不能被"看起来没事"挡住。
 * <en/> Health-check early return — **`--hard` must bypass it**: damage is not always visible in `.bin`
 * <en/> (real case: `node_modules/@vueuse/core` missing its `dist` and per-package links missing, while `.bin`
 * <en/> was complete), where a full reinstall is the only reliable repair and must not be blocked.
 */
if (before.exists && before.missing.length === 0 && !hardMode) {
  log('链接层看起来是完好的，无需修复。若仍有个别命令找不到，请贴出具体报错。')
  process.exit(0)
}
if (hardMode && before.exists && before.missing.length === 0) {
  log('链接层完好，但 --hard 指定全量重装（损坏可能位于依赖包内容而非 .bin）。')
}

const pnpmVersion = resolvePnpmVersion()
if (pnpmVersion == null) {
  log(`找不到可用的 pnpm（尝试的命令：${PNPM_COMMAND}）。`)
  log('  请先安装/启用 pnpm（corepack enable pnpm），或用 PNPM=<pnpm 绝对路径> 重新运行。')
  log(`pnpm is unavailable (tried "${PNPM_COMMAND}"). Install/enable pnpm first (corepack enable pnpm), or rerun with PNPM=<absolute path to pnpm>.`)
  process.exit(1)
}
log(`pnpm 版本：${pnpmVersion}`)

if (dryRun) {
  const present = PNPM_STATE_FILES
    .filter(file => existsSync(join(MODULES_DIR, file)))
    .map(file => `node_modules/${file.split('\\').join('/')}`)
  log('--dry-run：仅体检，不做任何修改。将要执行的动作：')
  log(`  1. 删除 pnpm 状态文件：${present.join(', ') || '（无可删）'}`)
  log('  2. pnpm install --frozen-lockfile --prefer-offline')
  log('  3. 若 .bin 仍不完整 → 删除 node_modules 后再次 pnpm install')
  log(`当前缺失的关键二进制：${before.missing.join(', ') || '无'}`)
  process.exit(0)
}

if (hardMode) {
  log('--hard：跳过状态文件清理，直接删除 node_modules 重装。')
}
else {
  const removed = removeStateFiles()
  log(removed.length > 0
    ? `已删除 pnpm 状态文件：${removed.join(', ')}（pnpm 正是凭它们短路，导致 .bin 不被重建）`
    : '未发现 pnpm 状态文件（可能已清理过）')
}

log('第 1 级：pnpm install --frozen-lockfile --prefer-offline')
let status = 0
if (!hardMode) {
  status = runPnpm(['install', '--frozen-lockfile', '--prefer-offline'])
  const afterLight = inspectBin()
  if (status === 0 && afterLight.exists && afterLight.missing.length === 0) {
    log(`修复完成：node_modules/.bin 已重建（${afterLight.count} 个条目），关键二进制齐全。`)
    process.exit(0)
  }
  /**
   * <zh/> 安装本身失败（网络/registry/权限）时**不升级**到删除动作——那只会把
   * <zh/> 「链接层损坏」变成「连 node_modules 都没有」，让排查更难。
   * <en/> When the install itself failed (network/registry/permissions) do **not** escalate to the
   * <en/> destructive step: that would turn a "broken link layer" into "no node_modules at all".
   */
  if (status !== 0) {
    log(`第 1 级安装失败（pnpm 退出码 ${status}）。已停止，未删除 node_modules。`)
    log('  请先按上方 pnpm 输出排查（网络/registry 可达性、磁盘权限），再重新运行本命令。')
    log(`  Level 1 install failed (pnpm exit code ${status}); nothing was deleted. Fix the pnpm error above first.`)
    process.exit(1)
  }
  log(`第 1 级未修好（pnpm 退出码 0 但 .bin ${afterLight.exists ? `仅 ${afterLight.count} 个条目` : '仍不存在'}），升级到第 2 级。`)
}

log('第 2 级：删除 node_modules 后重装（确定性兜底，耗时更长）')
if (existsSync(MODULES_DIR)) {
  removeModulesDir()
  log('已删除 node_modules')
}
status = runPnpm(['install', '--frozen-lockfile', '--prefer-offline'])

const after = inspectBin()
if (status === 0 && after.exists && after.missing.length === 0) {
  log(`修复完成：node_modules 已全新安装，.bin 共 ${after.count} 个条目，关键二进制齐全。`)
  process.exit(0)
}

log('修复失败。请依次排查：')
log(`  1. pnpm 退出码：${status}（非 0 说明安装本身失败，请先看上方 pnpm 输出）`)
log(`  2. .bin 状态：${after.exists ? `${after.count} 个条目，缺失 ${after.missing.join(', ')}` : '不存在'}`)
log('  3. 网络/registry 是否可达；必要时改用 pnpm install --frozen-lockfile（去掉 --prefer-offline）')
process.exit(1)
