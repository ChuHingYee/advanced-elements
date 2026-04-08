import { execSync as exec } from 'node:child_process'
import process from 'node:process'
import chalk from 'chalk'

const { log } = console

function build() {
  log(chalk`{bgCyan Building Files}\n`)
  exec('pnpm build:all', { stdio: 'inherit' })
}

function publish() {
  // <zh/> beta 发布：RELEASE_TAG=beta pnpm release → 以 beta dist-tag 发布，默认 latest 保持稳定链路不变
  // <en/> Beta release: RELEASE_TAG=beta pnpm release → publish under the beta dist-tag; default latest keeps the stable flow unchanged
  const tag = process.env.RELEASE_TAG ?? 'latest'
  log(chalk`{bgCyan Publishing with tag ${tag}}\n`)
  exec(`pnpm changeset publish --tag ${tag}`, { stdio: 'inherit' })
}

;(async () => {
  try {
    log(chalk`{bgYellow Releasing\n}`)
    log(chalk`{bgCyan Generating Changelog}\n`)
    exec('pnpm changeset version', { stdio: 'inherit' })
  }
  catch (e) {
    log(chalk`{bgRed changeset version failed}\n`)
    log(e)
    process.exit(1)
  }

  try {
    build()
    publish()
  }
  catch (e) {
    log(chalk`{bgRed Error occurred, reverting version changes}\n`)
    exec('git checkout -- packages/*/package.json packages/*/CHANGELOG.md', { stdio: 'inherit' })
    log(e)
    process.exit(1)
  }
})()
