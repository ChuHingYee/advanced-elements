import path from 'path'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import vue from 'rollup-plugin-vue'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'
import commonjs from '@rollup/plugin-commonjs'
import postcss from 'rollup-plugin-postcss'
const paths = require('./build/paths')

if (!process.env.PKG) {
  throw new Error('pkg package must be specified via --environment flag.')
}
const packageDir = path.resolve(paths.pkgRoot, process.env.PKG)
const resolve = (p) => path.resolve(packageDir, p)
const pkg = require(path.resolve(packageDir, 'package.json'))
const { name, version } = pkg
const isDev = process.env.NODE_ENV !== 'production'

const plugins = [
  vue({
    css: true,
    compileTemplate: true,
  }),
  postcss({
    plugins: [require('autoprefixer')],
    minimize: !isDev,
  }),
  babel({
    babelHelpers: 'runtime',
    presets: [
      [
        '@babel/preset-env',
        {
          targets: {
            chrome: '58',
            ie: '11',
          },
        },
      ],
      '@vue/babel-preset-jsx',
    ],
    plugins: [
      [
        '@babel/plugin-transform-runtime',
        {
          corejs: 3,
        },
      ],
    ],
    exclude: '**/node_modules/**',
  }),
  nodeResolve(),
  commonjs(),
  !isDev && terser({ toplevel: true }),
]
const banner = `/*! Advanced Elements ${name}-v${version} */\n`
const config = {
  input: resolve('src/index.js'),
  output: [
    {
      name,
      file: resolve('es/index.js'),
      format: 'es',
      sourcemap: isDev,
      globals: {
        vue: 'vue',
        'element-ui': 'element-ui',
      },
      banner,
    },
    {
      name,
      file: resolve('lib/index.js'),
      format: 'umd',
      sourcemap: isDev,
      exports: 'named',
      globals: {
        vue: 'vue',
        'element-ui': 'element-ui',
      },
      banner,
    },
  ],
  external: ['vue', 'element-ui'],
  plugins,
}

export default config
