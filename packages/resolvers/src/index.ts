// @env node

/**
 * <zh/> unplugin-vue-components 的 resolver 类型定义（内联以避免 peer dep）
 * <en/> unplugin-vue-components resolver type (inlined to avoid peer dep)
 *
 * @remarks
 * <zh/> resolver 接收 PascalCase 组件名，返回导入信息或 undefined 以跳过
 * <en/> A resolver receives a PascalCase component name and returns import info or undefined to skip
 */
export interface ComponentInfo {
  name: string
  from: string
  as?: string
  sideEffects?: (ComponentInfo | string)[] | ComponentInfo | string
}

export type ComponentResolver = (name: string) => ComponentInfo | string | null | undefined | void

/**
 * <zh/> 内部组件注册表
 * <en/> Internal component registry
 *
 * @remarks
 * <zh/> 每个条目将 PascalCase 组件名映射到其直接包路径和外部（统一）包路径。
 * <zh/> 样式导入始终引用物理拥有样式文件的包（如 `@advanced-elements/table/style`），
 * <zh/> 因为跨包 `exports` 重定向（如 `@advanced-elements/elements/style` → `@advanced-elements/table/style`）在 monorepo 配置中无法被所有打包工具可靠解析。
 * <en/> Each entry maps a PascalCase component name to its direct package path and external (unified) package path.
 * <en/> Style imports always reference the package that physically owns the style files (e.g. `@advanced-elements/table/style`),
 * <en/> because cross-package `exports` redirects (e.g. `@advanced-elements/elements/style` → `@advanced-elements/table/style`)
 * <en/> are not reliably resolved by all bundlers in monorepo setups.
 */
const registry: Record<string, { direct: string, external: string, style?: string }> = {
  AdvTable: {
    direct: '@advanced-elements/table',
    external: '@advanced-elements/elements',
    style: '@advanced-elements/table/style',
  },
  AdvConfigProvider: {
    direct: '@advanced-elements/config-provider',
    external: '@advanced-elements/elements',
  },
}

export interface AdvancedElementsResolverOptions {
  /**
   * <zh/> 从独立包导入，而非统一包 `@advanced-elements/elements`
   * <en/> Import from individual packages instead of the unified `@advanced-elements/elements`
   *
   * @remarks
   * <zh/> 启用更精细的 tree-shaking，但增加导入语句数量
   * <en/> Enables finer tree-shaking at the cost of more import statements
   *
   * @default false
   */
  direct?: boolean

  /**
   * <zh/> 是否包含样式副作用（CSS 导入）
   * <en/> Include style side effects (CSS imports)
   *
   * @remarks
   * <zh/> 启用后，每个组件自动导入也会导入其样式
   * <en/> When enabled, each component auto-import will also import its styles
   *
   * @default true
   */
  sideEffects?: boolean
}

/**
 * <zh/> 为 `unplugin-vue-components` 创建组件 resolver
 * <en/> Creates a component resolver for `unplugin-vue-components`
 *
 * @remarks
 * <zh/> 使用前请确保已安装 `unplugin-vue-components`
 * <en/> Make sure `unplugin-vue-components` is installed before using
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import Components from 'unplugin-vue-components/vite'
 * import { AdvancedElementsResolver } from '@advanced-elements/resolvers'
 *
 * export default defineConfig({
 *   plugins: [
 *     Components({
 *       resolvers: [AdvancedElementsResolver()],
 *     }),
 *   ],
 * })
 * ```
 */
export function AdvancedElementsResolver(options: AdvancedElementsResolverOptions = {}): ComponentResolver {
  const { direct = false, sideEffects = true } = options

  return (name: string) => {
    const entry = registry[name]
    if (!entry)
      return undefined

    const from = direct ? entry.direct : entry.external
    const info: ComponentInfo = { name, from }

    if (sideEffects) {
      if (entry.style)
        info.sideEffects = [entry.style]
    }

    return info
  }
}
