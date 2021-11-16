import { join } from 'path'
import execa from 'execa'
import { existsSync } from 'fs'
import chalk from 'chalk'
import yargs from 'yargs-parser'
const paths = require('../build/paths')
const { log } = console

const clean = async function (cwd, packageName, shortName) {
  log(chalk`{cyan Cleaning ${packageName}} from {grey packages/${shortName}}\n`)
  await execa('rimraf', [join(cwd, 'es')], { stdio: 'inherit' })
  await execa('rimraf', [join(cwd, 'lib')], { stdio: 'inherit' })
}

const build = function (packageName, shortName) {
  log(chalk`{cyan Building ${packageName}} from {grey packages/${shortName}}\n`)
  execa(
    'rollup',
    [
      '-c',
      '-w',
      '--environment',
      [`PKG:${shortName}`].filter(Boolean).join(','),
    ],
    { stdio: 'inherit' }
  )
}

;(async () => {
  try {
    const argv = yargs(process.argv.slice(2))
    const packageNames = argv.pkgs
    if (!packageNames) {
      throw new RangeError(
        'pkgs must be specified via --pkgs packageA,packageB.'
      )
    }
    const packageNamesArr = packageNames.split(',')
    packageNamesArr.forEach(async (packageName) => {
      const shortName = packageName.replace(/^@.+\//, '')
      const cwd = join(paths.pkgRoot, shortName)
      if (cwd && existsSync(cwd)) {
        await clean(cwd, packageName, shortName)
        await build(packageName, shortName)
      }
    })
  } catch (e) {
    log(e)
    process.exit(1)
  }
})()
