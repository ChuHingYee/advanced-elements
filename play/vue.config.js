const paths = require('../build/paths')
module.exports = {
  chainWebpack: (config) => {
    config.resolve.alias.set('@advanced-element', paths.pkgRoot)
  },
}
