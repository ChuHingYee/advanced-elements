import type { App, Plugin } from 'vue'

// --- 统一插件安装器 ---
// Unified plugin installer
// `app.use(AdvancedElements)` 一次性安装全部组件
// `app.use(AdvancedElements)` installs all components at once
import AdvConfigProviderPlugin from '@advanced-elements/config-provider'
import AdvTablePlugin from '@advanced-elements/table'

// 重新导出 config-provider（可选——用户也可单独安装）
// Re-export config-provider (optional — users can install it separately)
export { advConfigKey, provideAdvConfig, useAdvConfig } from '@advanced-elements/config-provider'
export type { AdvConfig, AdvTableConfig } from '@advanced-elements/config-provider'
export { default as AdvConfigProvider } from '@advanced-elements/config-provider'

// 将 table 默认导出（带 .install() 的 SFC）作为具名导出
// Re-export table's default (SFC with .install()) as named export
export { default as AdvTable } from '@advanced-elements/table'
// 重新导出 table 的全部具名导出（类型、工具、组合式函数、辅助函数）
// Re-export all named exports from table (types, utils, composables, helpers)
// 注意：table 也在本地导出了 advGlobalConfigKey / useAdvGlobalConfig
// Note: table also exports advGlobalConfigKey / useAdvGlobalConfig locally
export * from '@advanced-elements/table'

const plugin: Plugin = {
  install(app: App) {
    app.use(AdvConfigProviderPlugin)
    app.use(AdvTablePlugin)
  },
}

export default plugin
