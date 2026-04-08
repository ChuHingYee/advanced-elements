/**
 * <zh/> 发版第二步：校验 tag/版本自洽 → 构建 → `changeset publish`。不改版本号。
 * <en/> Release step two: verify tag/version agreement → build → `changeset publish`. Never mutates versions.
 *
 * <zh/> OTP 走 `NPM_CONFIG_OTP` env（changesets 自读并 strip 后显式传 `--otp`），勿改 CLI flag。
 * <en/> OTP travels via `NPM_CONFIG_OTP` env (changesets reads & strips it, passes `--otp` explicitly); do not use a CLI flag.
 *
 * <zh/> 用法：`pnpm release:publish`（CI）；`RELEASE_TAG=beta pnpm release:publish` 走预发
 */

import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { currentTag, err, highestVersionPackage, movedPackages, out, pendingChangesets, readPackages } from './release-lib'

function fail(message: string): never {
  err(`\n[release:publish] ${message}\n`)
  process.exit(1)
}

/**
 * <zh/> 门禁：tag 与已落定的版本号必须自洽。
 *
 * <zh/> 三条不变量，任一不成立即说明版本号没在打 tag 之前落定：
 * <zh/> 1. 不得有未消费的 changeset——`changeset version` 是唯一消费方，它没跑就必然有存量；
 * <zh/> 2. tag 版本号必须等于某个包的当前版本（tag 与产物同源）；
 * <zh/> 3. tag 版本号必须等于**本次被改动**那批包的最高版本。
 *
 * <zh/> 注意第 3 条只看「被改动的包」：本仓各包独立发版（table 已 4.0.0、elements 仍在 2.x），
 * <zh/> 未改动的包版本号高于 tag 是正常的，拿全部包比大小会误报成「tag 落后」。
 *
 * <en/> Gate: the tag and the written versions must agree. Three invariants, any of which
 * <en/> failing means versions were not written before tagging:
 * <en/> 1. no unconsumed changeset — `changeset version` is the only consumer, so leftovers mean it never ran;
 * <en/> 2. the tag version equals some package's current version (tag and artifacts share a source);
 * <en/> 3. the tag version equals the highest version among the packages this release **moved**.
 *
 * <en/> Note that check 3 only considers moved packages: this repo versions packages
 * <en/> independently (table is 4.0.0 while elements is 2.x), so an untouched package sitting
 * <en/> above the tag is normal and comparing against every package would false-alarm.
 */
function assertTagMatchesVersions(tag: string): void {
  const pkgs = readPackages()
  const pending = pendingChangesets()

  if (pending.length > 0) {
    fail([
      `tag v${tag} 上仍有未消费的 changeset（${pending.length} 个）：${pending.join(', ')}`,
      '',
      '版本号必须先在本地落定、打进 tag，再由 CI 发布。请改走：',
      '  pnpm release:version   # 消费 changeset、写版本号与 CHANGELOG、打发版提交',
      `  git push origin HEAD && git tag v${tag} && git push origin v${tag}`,
    ].join('\n'))
  }

  if (!pkgs.some(pkg => pkg.version === tag)) {
    const top = highestVersionPackage(pkgs)
    fail([
      `tag 版本 v${tag} 与仓库内任何包的版本都对不上（最高的是 ${top.name}@${top.version}）。`,
      '这通常意味着 tag 打在版本 bump 之前——已 checkout 的代码里版本号还是旧的。',
      '请改走：pnpm release:version → push → 再打 tag。',
    ].join('\n'))
  }

  const moved = movedPackages(tag)
  // <zh/> moved 为 null = 首次发版（无上一个 tag）；moved 为空数组 = 无包改动，两种情况都跳过
  // <zh/> 第 3 条门禁：没上一个 tag 时无法判断「本次改动了哪些包」，门禁 1/2 已足够
  // <en/> moved === null = first release (no previous tag); moved === [] = nothing moved.
  // <en/> Either way, skip gate 3 — without a previous tag there's no "moved set" to validate.
  if (moved && moved.length > 0) {
    const expected = highestVersionPackage(moved)
    if (expected.version !== tag) {
      fail([
        `tag v${tag} 与本次实际改动的包对不上。`,
        `  本次改动：${moved.map(pkg => `${pkg.name}@${pkg.version}`).join(', ')}`,
        `  应打的 tag：v${expected.version}`,
        '漏推了某个已升版的包，或 tag 打早了——两者都会让 npm 上的版本与 tag 不自洽。',
      ].join('\n'))
    }
  }
}

/** <zh/> 跑 pnpm 脚本，失败即抛 | <en/> Run a pnpm script, throwing on failure */
function pnpm(args: string[]): void {
  execFileSync('pnpm', args, { stdio: 'inherit' })
}

;(async () => {
  // <zh/> beta 预发：以 beta dist-tag 发布，latest 保持稳定链路不变
  // <en/> Beta prerelease: publish under the beta dist-tag, leaving latest on the stable line
  const distTag = process.env.RELEASE_TAG ?? 'latest'
  const tag = currentTag()

  out(`发布 / Publishing (dist-tag: ${distTag})`)

  if (tag)
    assertTagMatchesVersions(tag)
  else
    out('  ⚠️ 非 tag 触发（本地手动发布）：跳过 tag/版本一致性门禁，请自行确认版本号。')

  out('')
  pnpm(['build:all'])

  out('')
  if (!process.env.NPM_CONFIG_OTP && !process.env.npm_config_otp)
    out('  ℹ️ 未设置 NPM_CONFIG_OTP：走 OIDC Trusted Publishing 或长期 token 发布。')
  pnpm(['changeset', 'publish', '--tag', distTag])

  out('')
  out(`已发布 / Published (${distTag}):`)
  for (const pkg of readPackages())
    out(`  ${pkg.name}@${pkg.version}`)
})()
