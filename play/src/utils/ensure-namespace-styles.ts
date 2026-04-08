/**
 * <zh/> 自定义命名空间样式按需加载（幂等）
 * <en/> On-demand loader for custom namespace styles (idempotent)
 *
 * <zh/> SASS 重编产物（EP 全量 + 本包全量，demo 前缀）只在切到 demo 前缀时加载一次，
 * <zh/> 默认 el 下零成本。重复调用复用同一份加载 Promise。
 * <en/> SASS recompiled output (full EP + full package, demo prefix) loads once when switching
 * <en/> to the demo prefix; the default el namespace has zero cost. Repeat calls reuse the same Promise.
 */
let loading: Promise<unknown> | null = null

export function ensureNamespaceStyles(): Promise<unknown> {
  if (!loading)
    loading = import('../styles/namespace-demo.scss')
  return loading
}
