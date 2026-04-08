import type { App, Plugin } from 'vue'

import AdvConfigProviderPlugin from '@advanced-elements/config-provider'
import AdvTablePlugin from '@advanced-elements/table'

export { advConfigKey, provideAdvConfig, useAdvConfig } from '@advanced-elements/config-provider'
export type { AdvConfig, AdvTableConfig } from '@advanced-elements/config-provider'
export { default as AdvConfigProvider } from '@advanced-elements/config-provider'

export { default as AdvTable } from '@advanced-elements/table'
export * from '@advanced-elements/table'

const plugin: Plugin = {
  install(app: App) {
    app.use(AdvConfigProviderPlugin)
    app.use(AdvTablePlugin)
  },
}

export default plugin
