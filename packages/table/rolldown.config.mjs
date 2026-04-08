import { readFileSync } from 'node:fs'
import process from 'node:process'
import { createRolldownConfig } from '@advanced-elements/rolldown-config'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

const config = createRolldownConfig(pkg, {
  input: 'src/index.ts',
  // <zh/> EP 样式副作用入口（描述符与 ElementPlusResolver 一致，按 resolved id 去重）
  // <en/> EP style side-effect entry (specifiers match ElementPlusResolver for resolved-id dedupe)
  elementPlusStyleEntry: 'style/element-plus.js',
  // NOTE: no `externals` needed — peer/regular deps (e.g. async-validator) are externalized
  // automatically by generateExternal from package.json fields; only undeclared transitive
  // deps reached solely via dynamic import belong here.
})

// <zh/> 按需可视化：仅 ANALYZE=1 时注入 visualizer（treemap + gzip），默认/CI 构建零开销、零产物
// <en/> Opt-in visualization: inject visualizer (treemap + gzip) only with ANALYZE=1; default/CI builds stay clean and fast
if (process.env.ANALYZE) {
  const { visualizer } = await import('rollup-plugin-visualizer')
  config.plugins.push(visualizer({
    filename: 'dist/stats.html',
    title: `${pkg.name} v${pkg.version} — Bundle Visualizer`,
    template: 'treemap',
    gzipSize: true,
  }))
}

export default config
