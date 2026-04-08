import type { App, Component, Plugin } from 'vue'
import type { AdvConfig } from './types'
import { computed } from 'vue'
import AdvConfigProvider from './config-provider.vue'
import { advConfigKey } from './context'

export { advConfigKey, provideAdvConfig, useAdvConfig } from './context'
export type { AdvConfig, AdvTableConfig } from './types'

export type SFCWithInstall<T> = T & Plugin

/**
 * <zh/> 全局安装选项——免去包裹组件，应用级一次性注入
 * <en/> Global install options — inject once at app level without wrapping components
 */
export interface AdvConfigProviderInstallOptions {
  /**
   * <zh/> 应用级全局配置，等价于顶层 `<AdvConfigProvider :config>`，可被后代 Provider 覆盖
   * <en/> App-level global config, equivalent to a top-level `<AdvConfigProvider :config>`, overridable by descendant providers
   */
  config?: AdvConfig
}

const AdvConfigProviderWithInstall = AdvConfigProvider as unknown as SFCWithInstall<typeof AdvConfigProvider>
AdvConfigProviderWithInstall.install = (
  app: App,
  options?: AdvConfigProviderInstallOptions,
): void => {
  app.component(
    /* v8 ignore next */
    AdvConfigProvider.name ?? 'AdvConfigProvider',
    AdvConfigProvider as Component,
  )
  // <zh/> 应用级注入：组件树外逻辑亦可 inject；后代 Provider 仍可覆盖。与组件路径一致提供只读 computed
  // <en/> App-level provision: logic outside the tree can inject too; descendant providers still override. Provides a readonly computed like the component path
  if (options?.config !== undefined)
    app.provide(advConfigKey, computed(() => options?.config ?? {}))
}

export default AdvConfigProviderWithInstall
