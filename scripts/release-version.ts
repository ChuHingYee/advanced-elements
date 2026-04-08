/**
 * <zh/> 发版第一步：消费 changeset → 写版本号/CHANGELOG → 打单个发版提交。tag 必须打在此提交上。
 * <en/> Release step one: consume changesets → write versions/CHANGELOGs → one release commit. Tag must point at it.
 *
 * <zh/> 用法：`pnpm release:version [-- --allow-dirty]`
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { err, git, hasUncommittedChanges, highestVersionPackage, out, pendingChangesets, readPackages } from './release-lib'

const ALLOW_DIRTY = process.argv.slice(2).includes('--allow-dirty')

function fail(message: string): never {
  err(`\n[release:version] ${message}\n`)
  process.exit(1)
}

/**
 * <zh/> 记录版本号**变动前**的快照，供发版提交信息与 tag 建议使用。
 * <en/> Snapshot versions **before** the bump, for the commit message and tag suggestion.
 */
function snapshotVersions(): Map<string, string> {
  return new Map(readPackages().map(pkg => [pkg.name, pkg.version]))
}

/** <zh/> 跑 pnpm 脚本，失败即抛 | <en/> Run a pnpm script, throwing on failure */
function pnpm(args: string[]): void {
  execFileSync('pnpm', args, { stdio: 'inherit' })
}

;(async () => {
  out('发版第一步：消费 changeset 并落版本号 / Release step 1: consume changesets and write versions')

  // <zh/> --- 前置检查 ---
  const pending = pendingChangesets()
  if (pending.length === 0)
    fail('没有待发 changeset。用 `pnpm changeset` 先声明本次发版内容。')

  if (hasUncommittedChanges() && !ALLOW_DIRTY) {
    fail([
      '工作区有未提交改动，发版提交会把它一起卷进去。先提交或 stash，',
      '确实要带着改动发版就加 --allow-dirty。',
    ].join('\n'))
  }

  const before = snapshotVersions()

  // <zh/> --- 消费 changeset ---
  // <zh/> 先导出发布计划：`changeset version` 会删掉 changeset 文件，计划只能提前抓
  const planDir = mkdtempSync(join(tmpdir(), 'release-plan-'))
  const planFile = join(planDir, 'plan.json')
  try {
    pnpm(['changeset', 'status', '--output', planFile])
    out('')
    pnpm(['changeset', 'version'])
  }
  catch (error) {
    rmSync(planDir, { recursive: true, force: true })
    fail(`changeset 失败，版本号未改动：\n${error instanceof Error ? error.message : String(error)}`)
  }
  rmSync(planDir, { recursive: true, force: true })

  const after = readPackages()
  const bumped = after.filter(pkg => before.get(pkg.name) !== pkg.version)
  if (bumped.length === 0)
    fail('changeset version 未改动任何包版本，请检查 changeset 声明的包名。')

  // <zh/> --- 单个发版提交 ---
  const summary = bumped.map(pkg => `${pkg.name}@${pkg.version}`).join(', ')
  git(['add', '--', '.changeset', 'packages'])
  git(['commit', '-m', `chore(release): ${summary}`])

  const head = highestVersionPackage(bumped)
  const tag = `v${head.version}`

  out('')
  out('版本号已落定 / Versions written:')
  for (const pkg of bumped)
    out(`  ${pkg.name}: ${before.get(pkg.name)} → ${pkg.version}`)

  out('')
  out('下一步 / Next:')
  out(`  git push origin HEAD`)
  out(`  git tag ${tag} && git push origin ${tag}`)
  out('')
  out(`tag ${tag} 会触发 release workflow（构建 → 测试 → 发布 → 建 GitHub Release）。`)
  out(`Tag ${tag} triggers the release workflow (build → test → publish → GitHub Release).`)
})()
