import { execSync as exec } from 'node:child_process'
import { join } from 'node:path'
import process from 'node:process'
import chalk from 'chalk'
import { docsRoot } from './paths'

const filesPath = join(docsRoot, '.vitepress', 'dist')
const { log } = console

function buildFile() {
  log(chalk`{bgCyan Building Files}`)
  exec('pnpm docs:build')
}

function commit() {
  log(chalk`{bgCyan Committing}`)
  exec('git init', {
    stdio: 'inherit',
    cwd: filesPath,
  })
  exec('git add -A', {
    stdio: 'inherit',
    cwd: filesPath,
  })
  exec('git commit -m deploy', {
    stdio: 'inherit',
    cwd: filesPath,
  })
}

async function publish() {
  log(chalk`{bgCyan Publish Changes}`)
  exec(
    'git push -f git@github.com:ChuHingYee/advanced-elements.git HEAD:gh-pages',
    {
      stdio: 'inherit',
      cwd: filesPath,
    },
  )
}

;(async () => {
  try {
    log(chalk`{bgYellow Releasing Docs\n}`)
    buildFile()
    commit()
    publish()
  }
  catch (e) {
    log(e)
    process.exit(1)
  }
})()
