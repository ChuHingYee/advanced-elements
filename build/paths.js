const path = require('path')
const projRoot = path.resolve(__dirname, '..')
const pkgRoot = path.resolve(projRoot, 'packages')
const docsRoot = path.resolve(projRoot, 'docs')

module.exports = {
  projRoot,
  pkgRoot,
  docsRoot,
}
