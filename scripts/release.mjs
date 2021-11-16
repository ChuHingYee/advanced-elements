import 'source-map-support/register.js'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import parser from 'conventional-commits-parser'
import chalk from 'chalk'
import execa from 'execa'
import semver from 'semver'
import writePackage from 'write-pkg'
import yargs from 'yargs-parser'
const paths = require('../build/paths')
/**
 * fork = require( https://github.com/rollup/plugins/blob/master/scripts/release.ts ）
 */
const { log } = console
const parserOptions = {
  noteKeywords: ['BREAKING CHANGE', 'Breaking Change'],
}
const reBreaking = new RegExp(`(${parserOptions.noteKeywords.join(')|(')})`)
const dryRun = process.argv.includes('--dry')
const noPublish = process.argv.includes('--no-publish')
const noTag = process.argv.includes('--no-tag')

const buildFile = async (packageName) => {
  log(chalk`{blue Building Files}`)
  await execa('pnpm', ['build', '--', '--pkg', packageName])
}

const commitChanges = async (cwd, shortName, version) => {
  if (dryRun) {
    log(chalk`{yellow Skipping Git Commit}`)
    return
  }

  log(chalk`{blue Committing} CHANGELOG.md, package.json`)
  let params = ['add', cwd]
  await execa('git', params)

  params = ['commit', '--m', `chore(release): ${shortName} v${version}`]
  await execa('git', params)
}

const getCommits = async (shortName) => {
  log(chalk`{blue Gathering Commits}`)

  let params = ['tag', '--list', `${shortName}-v*`, '--sort', '-v:refname']
  const { stdout: tags } = await execa('git', params)
  const [latestTag] = tags.split('\n')

  log(chalk`{blue Last Release Tag}: ${latestTag || '<none>'}`)

  params = [
    '--no-pager',
    'log',
    `${latestTag}..HEAD`,
    '--format=%B%n-hash-%n%H🐒💨🙊',
  ]
  const rePlugin = new RegExp(
    `^[\\w\\!]+\\(([\\w,-]+)?${shortName}([\\w,-]+)?\\)`,
    'i'
  )
  let { stdout } = await execa('git', params)
  if (!stdout) {
    if (latestTag) params.splice(2, 1, `${latestTag}`)
    else params.splice(2, 1, 'HEAD')
    ;({ stdout } = await execa('git', params))
  }
  const commits = stdout
    .split('🐒💨🙊')
    .filter((commit) => {
      const chunk = commit.trim()
      return chunk && rePlugin.test(chunk)
    })
    .map((commit) => {
      const node = parser.sync(commit)
      const body = node.body || node.footer
      if (!node.type)
        node.type = parser.sync(
          node.header?.replace(/\(.+\)!?:/, ':') || ''
        ).type

      node.breaking = reBreaking.test(body) || /!:/.test(node.header)

      return node
    })
  return commits
}

const getNewVersion = (version, commits) => {
  log(chalk`{blue Determining New Version}`)
  const intersection = process.argv.filter((arg) =>
    ['--major', '--minor', '--patch'].includes(arg)
  )
  if (intersection.length) {
    return semver.inc(version, intersection[0].substring(2))
  }

  const types = new Set(commits.map(({ type }) => type))
  const breaking = commits.some((commit) => !!commit.breaking)
  const level = breaking
    ? 'major'
    : types.has('feat') || types.has('feature')
    ? 'minor'
    : 'patch'

  return semver.inc(version, level)
}

const publish = async (cwd) => {
  if (dryRun || noPublish) {
    log(chalk`{yellow Skipping Publish}`)
    return
  }

  log(chalk`\n{cyan Publishing to pnpm}`)

  await execa('pnpm', ['publish', '--access', 'public', '--no-git-checks'], {
    cwd,
    stdio: 'inherit',
  })
}

const tag = async (cwd, shortName, version) => {
  if (dryRun || noTag) {
    log(chalk`{yellow Skipping Git Tag}`)
    return
  }

  const tagName = `${shortName}-v${version}`
  log(chalk`\n{blue Tagging} {grey ${tagName}}`)
  await execa('git', ['tag', tagName], { cwd, stdio: 'inherit' })
}

const updateChangelog = (commits, cwd, shortName, version) => {
  log(chalk`{blue Gathering Changes}`)

  const title = `# @advanced-elements/${shortName} ChangeLog`
  const [date] = new Date().toISOString().split('T')
  const logPath = join(cwd, 'CHANGELOG.md')
  const logFile = existsSync(logPath) ? readFileSync(logPath, 'utf-8') : ''
  const oldNotes = logFile.startsWith(title)
    ? logFile.slice(title.length).trim()
    : logFile
  const notes = {
    breaking: [],
    features: [],
    fixes: [],
    updates: [],
    UI: [],
    chore: [],
  }

  for (const commit of commits) {
    const { breaking, hash, header, type } = commit
    const ref = /\(#\d+\)/.test(header) ? '' : ` (${hash?.substring(0, 7)})`
    const message = header?.trim().replace(/\(.+\)!?:/, ':') + ref

    if (breaking) {
      notes.breaking.push(message)
    } else if (type === 'fix') {
      notes.fixes.push(message)
    } else if (type === 'feat' || type === 'feature') {
      notes.features.push(message)
    } else if (type === 'UI') {
      notes.UI.push(message)
    } else if (type === 'chore') {
      notes.docs.push(message)
    } else {
      notes.updates.push(message)
    }
  }

  const parts = [
    `## v${version}`,
    `_${date}_`,
    notes.breaking.length
      ? `### Breaking Changes\n\n- ${notes.breaking.join('\n- ')}`.trim()
      : '',
    notes.fixes.length
      ? `### Bugfixes\n\n- ${notes.fixes.join('\n- ')}`.trim()
      : '',
    notes.features.length
      ? `### Features\n\n- ${notes.features.join('\n- ')}`.trim()
      : '',
    notes.updates.length
      ? `### Updates\n\n- ${notes.updates.join('\n- ')}`.trim()
      : '',
  ].filter(Boolean)

  const newLog = parts.join('\n\n')

  if (dryRun) {
    log(chalk`{blue New ChangeLog}:\n${newLog}`)
    return
  }

  log(chalk`{blue Updating} CHANGELOG.md`)
  let content = [title, newLog, oldNotes].filter(Boolean).join('\n\n')
  if (!content.endsWith('\n')) content += '\n'
  writeFileSync(logPath, content, 'utf-8')
}

const updatePackage = async (cwd, pkg, version) => {
  if (dryRun) {
    log(chalk`{yellow Skipping package.json Update}`)
    return
  }

  log(chalk`{blue Updating} package.json`)
  // eslint-disable-next-line no-param-reassign
  pkg.version = version
  await writePackage(cwd, pkg)
}

;(async () => {
  try {
    const argv = yargs(process.argv.slice(2))
    const packageName = argv.pkg
    if (!packageName) {
      throw new RangeError('pkg must be specified via --pkg packageName.')
    }
    const shortName = packageName.replace(/^@.+\//, '')
    const cwd = join(paths.pkgRoot, shortName)
    if (!cwd || !existsSync(cwd)) {
      throw new RangeError(
        `Could not find directory for package: ${packageName}`
      )
    }
    const pkg = require(join(cwd, 'package.json'))
    if (dryRun) {
      log(chalk`{magenta DRY RUN}: No files will be modified`)
    }

    log(
      chalk`{cyan Releasing \`${packageName}\`} from {grey packages/${shortName}}\n`
    )

    await buildFile(packageName)

    const commits = await getCommits(shortName)

    if (!commits.length) {
      log(
        chalk`\n{red No Commits Found}. Did you mean to publish ${packageName}?`
      )
      process.exit(1)
    }

    log(chalk`{blue Found} {bold ${commits.length}} Commits\n`)

    const newVersion = getNewVersion(pkg.version, commits)

    log(chalk`{blue New Version}: ${newVersion}\n`)

    await updatePackage(cwd, pkg, newVersion)
    updateChangelog(commits, cwd, shortName, newVersion)
    await commitChanges(cwd, shortName, newVersion)
    await publish(cwd)
    await tag(cwd, shortName, newVersion)
  } catch (e) {
    log(e)
    process.exit(1)
  }
})()
