/**
 * <zh/> 为 GitHub Release 生成正文：拼接各包 CHANGELOG 顶部条目。按上一个 tag 过滤本次改动包。
 * <en/> Build the GitHub Release body from each package's topmost CHANGELOG entry, filtered to moved packages.
 *
 * <zh/> 用法：`pnpm release:notes -- --out=RELEASE_NOTES.md`（省略 `--out` 打到 stdout）
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { projRoot } from './paths'
import { currentTag, err, movedPackages, out, parseChangelogEntry, readPackages } from './release-lib'

/** <zh/> 组装正文 | <en/> Assemble the body */
function buildNotes(): string {
  const current = currentTag()
  const moved = current ? movedPackages(current) : null
  const sections: string[] = []

  if (current) {
    sections.push('本节内容由 `changeset version` 生成的 CHANGELOG 汇总。')
    sections.push('_Assembled from the CHANGELOGs written by `changeset version`._')
    sections.push('')
  }
  if (current && !moved)
    sections.push('> 未找到上一个 tag，以下为各包 CHANGELOG 顶部条目。')

  for (const pkg of readPackages()) {
    if (!pkg.hasChangelog)
      continue
    if (moved && !moved.some(entry => entry.name === pkg.name))
      continue

    const entry = parseChangelogEntry(join(projRoot, pkg.dir, 'CHANGELOG.md'))
    if (!entry)
      continue

    sections.push(`## ${pkg.name} ${entry.version}`)
    sections.push('')
    sections.push(entry.body)
    sections.push('')
  }

  if (!sections.some(section => section.startsWith('## ')))
    return '本次发版未改动任何包版本。\n\n_No package versions changed in this release._\n'

  return `${sections.join('\n').trim()}\n`
}

;(async () => {
  const outFlag = process.argv.slice(2).find(arg => arg.startsWith('--out='))
  const notes = buildNotes()

  if (!outFlag) {
    process.stdout.write(notes)
    return
  }

  const target = outFlag.slice('--out='.length)
  writeFileSync(target, notes, 'utf-8')
  out(`[release:notes] 已写入 ${target}`)
})().catch((error) => {
  err(`\n[release:notes] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
