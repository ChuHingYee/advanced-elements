/**
 * 自定义命名空间样式按需加载（幂等）。
 *
 * SASS 重编产物（EP 全量 + 本包全量，demo 前缀）只在切到 demo 前缀时加载一次，
 * 默认 el 下零成本。重复调用复用同一份加载 Promise。
 */
let loading: Promise<unknown> | null = null

export function ensureNamespaceStyles(): Promise<unknown> {
  if (!loading)
    loading = import('../styles/namespace-demo.scss')
  return loading
}
