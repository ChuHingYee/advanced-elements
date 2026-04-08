import ElementPlus, { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent } from 'vue'
import { AdvTable } from '../../../packages/table/src/index'
import { demoComponentName } from '../demo-name.mjs'
import 'element-plus/dist/index.css'
// 库自身样式（构建期直连 src scss，绕过 dist）：demo 是真实组件渲染，没样式就没有可看的表格
import '../../../packages/table/src/style/index.scss'
import '../styles/reset.scss'

/**
 * <zh/> `docs/examples` 下的每个 `.vue` 注册为全局异步组件，名字由 {@link demoComponentName} 从路径派生，
 * <zh/> 与 `:::demo` 容器插件（构建期写出的标签名）共用同一规则。异步加载保证未使用的 demo 不进首屏包。
 * <en/> Every `.vue` under `docs/examples` is registered as a global async component, named by
 * <en/> {@link demoComponentName} from its path — the same rule the `:::demo` container plugin relies on
 * <en/> when it emits tags at build time. Lazy loading keeps unused demos out of the initial bundle.
 */
const demos = Object.fromEntries(
  Object.entries(import.meta.glob('../../examples/**/*.vue'))
    .map(([path, load]) => [demoComponentName(path), defineAsyncComponent(load)]),
)

export default {
  ...DefaultTheme,
  enhanceApp({ app, router, siteData }) {
    app.provide(ID_INJECTION_KEY, {
      prefix: 100,
      current: 0,
    })
    app.provide(ZINDEX_INJECTION_KEY, {
      current: 0,
    })
    app.use(ElementPlus)
    app.use(AdvTable)
    for (const [name, component] of Object.entries(demos))
      app.component(name, component)
  },
}