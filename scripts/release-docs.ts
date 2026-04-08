import { execSync as exec } from 'node:child_process'
import { join } from 'node:path'
import process from 'node:process'
import chalk from 'chalk'
import { docsRoot } from './paths'

const filesPath = join(docsRoot, '.vitepress', 'dist')
const { log } = console

// <zh/> 部署远端可用 DOCS_DEPLOY_REMOTE 覆盖（默认仓库作者 SSH 地址）；fork 或无 SSH 凭证时设为
// <zh/> 自己的远端（HTTPS PAT / ssh 均可），推送目标分支仍为 gh-pages。
// <en/> Override the deploy remote via DOCS_DEPLOY_REMOTE (defaults to the author's SSH URL);
// <en/> forks or SSH-less environments set their own remote; the target branch stays gh-pages.
const DEPLOY_REMOTE = process.env.DOCS_DEPLOY_REMOTE ?? 'git@github.com:ChuHingYee/advanced-elements.git'

function buildFile() {
  log(chalk`{bgCyan Building Files}`)
  exec('pnpm docs:build')
}

// <zh/> 暂存区是否有内容——内容不变时 `git commit` 会非零退出，须先跳过
// <en/> Whether anything is staged — `git commit` exits non-zero on no changes, skip it then
function hasStagedChanges(): boolean {
  try {
    exec('git diff --cached --quiet', { cwd: filesPath })
    return false
  }
  catch {
    return true
  }
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
  if (!hasStagedChanges()) {
    log(chalk`{yellow No changes to deploy — skip commit}`)
    return
  }
  exec('git commit -m deploy', {
    stdio: 'inherit',
    cwd: filesPath,
  })
}

async function publish() {
  log(chalk`{bgCyan Publish Changes}`)
  exec(
    `git push -f ${DEPLOY_REMOTE} HEAD:gh-pages`,
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
