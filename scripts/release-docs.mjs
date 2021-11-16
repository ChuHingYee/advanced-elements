import chalk from 'chalk'
import { join } from 'path'
import execa from 'execa'
const paths = require('../build/paths')
const filesPath = join(paths.docsRoot, '.vuepress', 'dist')
const { log } = console

const buildFile = async () => {
  log(chalk`{blue Building Files}`)
  await execa('pnpm', ['docs:build'])
}

const commitChanges = async () => {
  log(chalk`{blue Commit Changes}`)
  await execa('git', ['init'], {
    stdio: 'inherit',
    cwd: filesPath,
  })
  await execa('git', ['add', '-A'], {
    stdio: 'inherit',
    cwd: filesPath,
  })
  await execa('git', ['commit', '-m', 'deploy'], {
    stdio: 'inherit',
    cwd: filesPath,
  })
}

const publish = async () => {
  log(chalk`{blue Publish Changes}`)
  await execa(
    'git',
    [
      'push',
      '-f',
      'git@github.com:ChuHingYee/advanced-elements.git',
      'master:gh-pages',
    ],
    {
      stdio: 'inherit',
      cwd: filesPath,
    }
  )
}

;(async () => {
  try {
    log(chalk`{cyan Releasing Docs\n}`)
    await buildFile()
    await commitChanges()
    await publish()
  } catch (e) {
    log(e)
    process.exit(1)
  }
})()
