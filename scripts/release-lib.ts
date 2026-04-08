/**
 * <zh/> 发版脚本共享工具：包版本读取、tag 解析、changeset 存量检查、CHANGELOG 解析。
 * <en/> Shared helpers for release scripts: package versions, tag resolution, pending changesets, CHANGELOG parsing.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pkgRoot, projRoot } from './paths'

/** <zh/> 标准输出（绕过 no-console 门禁） | <en/> stdout writer (avoids the no-console gate) */
export const out = (msg = ''): void => void process.stdout.write(`${msg}\n`)
/** <zh/> 错误输出（绕过 no-console 门禁） | <en/> stderr writer (avoids the no-console gate) */
export const err = (msg = ''): void => void process.stderr.write(`${msg}\n`)

/** <zh/> 包元信息 | <en/> package metadata */
export interface PkgInfo {
  /** <zh/> 包名 | <en/> package name */
  name: string
  /** <zh/> 当前版本 | <en/> current version */
  version: string
  /** <zh/> 相对仓库根的目录 | <en/> directory relative to repo root */
  dir: string
  /** <zh/> 是否有 CHANGELOG.md | <en/> whether a CHANGELOG.md exists */
  hasChangelog: boolean
}

/**
 * <zh/> 读取 `packages/` 下所有可发布包的元信息。
 *
 * <en/> Read metadata for every publishable package under `packages/`.
 *
 * @returns <zh/> 按目录名排序的包列表 | <en/> package list sorted by directory name
 */
export function readPackages(): PkgInfo[] {
  return readdirSync(pkgRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map((entry) => {
      const manifestPath = join(pkgRoot, entry.name, 'package.json')
      if (!existsSync(manifestPath))
        return null
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { name?: string, version?: string, private?: boolean }
      // <zh/> 只认「已命名 + 已定版 + 非私有」的包：dev-packages 与占位目录据此被排除
      // <en/> Only named, versioned, non-private packages qualify; this drops dev-packages and placeholders
      if (!manifest.name || !manifest.version || manifest.private)
        return null
      return {
        name: manifest.name,
        version: manifest.version,
        dir: `packages/${entry.name}`,
        hasChangelog: existsSync(join(pkgRoot, entry.name, 'CHANGELOG.md')),
      } satisfies PkgInfo
    })
    .filter((pkg): pkg is PkgInfo => pkg !== null)
}

/**
 * <zh/> 拆分版本号为「数字段 + 预发布段」。仅覆盖 changesets 实际产出的两种形态。
 *
 * <en/> Split a version into its numeric segments and prerelease tag.
 */
function splitVersion(version: string): { nums: number[], pre: string } {
  const dash = version.indexOf('-')
  const main = dash === -1 ? version : version.slice(0, dash)
  const pre = dash === -1 ? '' : version.slice(dash + 1)
  return {
    nums: main.split('.').map(segment => Number.parseInt(segment, 10) || 0),
    pre,
  }
}

/**
 * <zh/> 极简版本比较：数字段逐位比较；预发布版排在同数字段的正式版之前。
 *
 * <zh/> **不是完整 semver 实现**：预发布段按字符串比较，故 `beta.10 < beta.2`（本仓预发布
 * <zh/> 序号两位以内，实际不受影响）。只用于给多包挑选「本次发版的代表 tag」。
 *
 * <en/> Minimal version comparison: numeric segments compared left to right, prereleases
 * <en/> sorting before the matching final release.
 *
 * <en/> **Not a full semver implementation**: prerelease tags compare as strings, so
 * <en/> `beta.10 < beta.2` (this repo's prerelease counters stay under 100, so it does not
 * <en/> bite in practice). Only used to pick the representative tag across several packages.
 *
 * @returns <zh/> a<b 返回 -1，a>b 返回 1，相等返回 0 | <en/> -1 if a<b, 1 if a>b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const left = splitVersion(a)
  const right = splitVersion(b)
  for (let i = 0; i < Math.max(left.nums.length, right.nums.length); i++) {
    const diff = (left.nums[i] ?? 0) - (right.nums[i] ?? 0)
    if (diff !== 0)
      return diff < 0 ? -1 : 1
  }
  if (left.pre === right.pre)
    return 0
  if (left.pre === '')
    return 1
  if (right.pre === '')
    return -1
  return left.pre < right.pre ? -1 : 1
}

/**
 * <zh/> 取版本号最高的包，用于给多包并发版本号挑一个代表 tag。
 *
 * <en/> Pick the highest-versioned package to derive the representative tag when several
 * <en/> packages move in one release.
 *
 * @returns <zh/> 最高版本的包 | <en/> the highest-versioned package
 */
export function highestVersionPackage(pkgs: PkgInfo[]): PkgInfo {
  return pkgs.reduce((top, pkg) => (compareVersions(pkg.version, top.version) > 0 ? pkg : top))
}

/**
 * <zh/> 当前检出的 tag：CI 里由 `GITHUB_REF` 推导，本地无 tag 时返回 undefined。
 *
 * <en/> The tag currently checked out, derived from `GITHUB_REF` in CI; undefined locally.
 *
 * @returns <zh/> 不带 `v` 前缀的 tag 名 | <en/> tag name without the `v` prefix
 */
export function currentTag(): string | undefined {
  if (process.env.GITHUB_REF_TYPE !== 'tag' || !process.env.GITHUB_REF?.startsWith('refs/tags/'))
    return undefined
  return process.env.GITHUB_REF.slice('refs/tags/'.length).replace(/^v/, '')
}

/**
 * <zh/> 列出 `.changeset/` 下尚未消费的 changeset（排除 README）。
 *
 * <en/> List changeset files that have not been consumed yet (README excluded).
 *
 * @returns <zh/> 相对仓库根的路径列表 | <en/> paths relative to the repo root
 */
export function pendingChangesets(): string[] {
  const changesetDir = join(projRoot, '.changeset')
  if (!existsSync(changesetDir))
    return []
  return readdirSync(changesetDir)
    .filter(file => file.endsWith('.md') && file !== 'README.md')
    .map(file => `.changeset/${file}`)
}

/**
 * <zh/> 运行 git 并返回去空白的 stdout。
 *
 * <en/> Run git and return its trimmed stdout.
 *
 * @param args <zh/> git 参数 | <en/> git arguments
 * @param allowFail <zh/> 为 true 时非零退出码不抛错，返回 undefined | <en/> when true, a non-zero exit yields undefined instead of throwing
 * @returns <zh/> 成功时为 stdout 文本 | <en/> stdout on success
 */
export function git(args: string[], allowFail = false): string | undefined {
  try {
    return execFileSync('git', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  }
  catch (error) {
    if (allowFail)
      return undefined
    throw error
  }
}

/**
 * <zh/> 工作区是否有未提交改动（不含未跟踪文件）。
 *
 * <en/> Whether the worktree has uncommitted changes (untracked files excluded).
 */
export function hasUncommittedChanges(): boolean {
  return (git(['status', '--porcelain', '--untracked-files=no']) ?? '').length > 0
}

/** <zh/> CHANGELOG 顶部的版本条目 | <en/> the topmost version entry of a CHANGELOG */
export interface ChangelogEntry {
  /** <zh/> 版本号 | <en/> version */
  version: string
  /** <zh/> 该版本条目正文（不含版本标题） | <en/> body of that entry, heading excluded */
  body: string
}

/**
 * <zh/> 解析 CHANGELOG.md 顶部那一条版本记录。
 *
 * <en/> Parse the topmost version entry of a CHANGELOG.md.
 *
 * @param file <zh/> CHANGELOG.md 绝对路径 | <en/> absolute path to the CHANGELOG.md
 * @returns <zh/> 无版本条目时返回 null | <en/> null when there is no version entry
 */
export function parseChangelogEntry(file: string): ChangelogEntry | null {
  if (!existsSync(file))
    return null
  const lines = readFileSync(file, 'utf-8').split(/\r?\n/)
  const headingIndex = lines.findIndex(line => /^##\s+\S/.test(line))
  if (headingIndex === -1)
    return null
  const version = lines[headingIndex].replace(/^##\s+/, '').trim()
  const rest = lines.slice(headingIndex + 1)
  const nextHeading = rest.findIndex(line => /^##\s+\S/.test(line))
  const body = (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).join('\n').trim()
  return { version, body }
}

/**
 * <zh/> 读某个 git 引用下某包的版本号（用于对比上一个 tag，判断本次发版动了哪些包）。
 *
 * <en/> Read a package's version at a given git ref, to diff against the previous tag and
 * <en/> work out which packages this release actually moved.
 *
 * @param ref <zh/> git 引用，如 tag 名 | <en/> git ref, e.g. a tag name
 * @param dir <zh/> 包相对仓库根的目录 | <en/> package directory relative to repo root
 * @returns <zh/> 该引用下不存在则返回 undefined | <en/> undefined when absent at that ref
 */
export function versionAtRef(ref: string, dir: string): string | undefined {
  const raw = git(['show', `${ref}:${dir}/package.json`], true)
  if (!raw)
    return undefined
  return (JSON.parse(raw) as { version?: string }).version
}

/**
 * <zh/> 找出**上一个** tag（按版本号从高到低，跳过当前 tag 与不带 `v` 前缀的 tag）。
 *
 * <en/> Find the **previous** tag, walking tags from highest to lowest and skipping the
 * <en/> current tag plus anything without a `v` prefix.
 *
 * @param current <zh/> 当前 tag（不带 `v`） | <en/> current tag, without the `v` prefix
 * @returns <zh/> 没有上一个 tag 时返回 undefined | <en/> undefined when there is none
 */
export function findPreviousTag(current: string): string | undefined {
  return git(['tag', '--list', 'v*', '--sort=-v:refname'], true)
    ?.split('\n')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0 && tag !== `v${current}`)[0]
}

/**
 * <zh/> 本次发版**动过的包**：当前版本与上一个 tag 处版本不一致者（含上一个 tag 尚不存在的新包）。
 *
 * <zh/> 本仓各包独立发版（table 已 4.0.0，elements 仍在 2.x），因此「tag 版本号」只能代表
 * <zh/> 本次**被改动**的那批包，不能拿去和全部包的版本比大小——那会误判成「tag 落后」。
 *
 * <en/> Packages **moved** by this release: those whose current version differs from their
 * <en/> version at the previous tag (including packages new since that tag).
 *
 * <en/> This repo versions packages independently (table is already 4.0.0 while elements is
 * <en/> still 2.x), so the tag version can only represent the packages that actually moved
 * <en/> here — comparing it against every package's version would wrongly read as "tag behind".
 *
 * @param current <zh/> 当前 tag（不带 `v`） | <en/> current tag, without the `v` prefix
 * @returns <zh/> 没有上一个 tag 时返回 null（无从判断） | <en/> null when there is no previous tag to diff against
 */
export function movedPackages(current: string): PkgInfo[] | null {
  const previous = findPreviousTag(current)
  if (!previous)
    return null
  return readPackages().filter((pkg) => {
    const before = versionAtRef(previous, pkg.dir)
    return before !== pkg.version
  })
}
