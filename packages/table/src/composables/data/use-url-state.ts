/** <zh/> vue-router 为可选 peer dependency。静态 import 会在未安装时抛出 MODULE_NOT_FOUND，因此从 Vue app 的 globalProperties 获取 | <en/> vue-router is an optional peer dependency. Static import would throw MODULE_NOT_FOUND when not installed, so it's obtained from Vue app's globalProperties */
import type { Ref } from 'vue'
import { computed, getCurrentInstance, getCurrentScope, onScopeDispose, toValue } from 'vue'

export interface UseUrlStateOptions {
  enabled?: boolean | Ref<boolean> | (() => boolean)
  pageKey?: string | Ref<string> | (() => string)
  sizeKey?: string | Ref<string> | (() => string)
}

export interface UseUrlStateReturn {
  setPageLog: (page: number, size: number) => void
  initFromUrl: () => { page?: number, size?: number }
}

interface RouterLike {
  replace: (to: { path: string, query: Record<string, string> }) => void | Promise<unknown>
}

interface RouteLike {
  path: string
  query: Record<string, any>
}

function tryGetRouter(
  injected?: { router: RouterLike, route: RouteLike },
): { router: RouterLike | undefined, route: RouteLike | undefined } {
  if (injected)
    return injected

  const instance = getCurrentInstance()
  if (!instance)
    return { router: undefined, route: undefined }

  const router = instance.appContext.config.globalProperties.$router as RouterLike | undefined
  const route = instance.appContext.config.globalProperties.$route as RouteLike | undefined

  return { router: router ?? undefined, route: route ?? undefined }
}

/**
 * <zh/> URL 状态同步 composable — 将分页参数同步到路由 query，支持前进/后退恢复状态。
 *
 * <zh/> **竞态防护**：连续 setPageLog 调用通过微任务去抖合并，仅最后一次写入 router.replace。
 * <zh/> 避免 router.replace 异步未完成时下一次调用同步读取过期 route.query，从而丢失并发 query 参数。
 * <zh/> initFromUrl 期间设置 isInitializing 守卫，阻止初始化触发的副作用反向覆盖刚从 URL 读取的状态。
 *
 * @param options - URL 状态配置
 * @param isManual - 是否为手动请求模式
 * @param routerContext - 路由上下文（可选）
 * @param routerContext.router - 路由实例，用于 replace 同步 query
 * @param routerContext.route - 当前路由，用于读取 path 与 query
 * @returns URL 读写方法
 *
 * <en/> URL state sync composable — syncs pagination params to route query, supports back/forward state restoration.
 *
 * <en/> **Race condition guard**: consecutive setPageLog calls are debounced via microtask, only the last one triggers router.replace.
 * <en/> This prevents the next call from synchronously reading stale route.query while router.replace is in-flight, which could lose concurrent query params.
 * <en/> isInitializing guard is set during initFromUrl to prevent initialization side-effects from overwriting state just read from URL.
 */
export function useUrlState(
  options: UseUrlStateOptions,
  isManual: Ref<boolean>,
  routerContext?: { router: RouterLike, route: RouteLike },
): UseUrlStateReturn {
  const resolvedConfig = computed(() => ({
    enabled: toValue(options.enabled) ?? false,
    pageKey: toValue(options.pageKey) ?? 'p',
    sizeKey: toValue(options.sizeKey) ?? 's',
  }))

  /**
   * <zh/> 初始化守卫：initFromUrl 期间置为 true，阻止并发 setPageLog 覆盖刚读取的 URL 状态
   * <en/> Initialization guard: set to true during initFromUrl to prevent concurrent setPageLog from overwriting state just read from URL
   */
  let isInitializing = false
  /** <zh/> 初始化读取到的值——仅跳过等于它的回声写入，手动变更照常落 URL | <en/> Values read during init — only echoes of these are skipped */
  let initPage: number | undefined
  let initSize: number | undefined

  /**
   * <zh/> 待提交的分页状态（微任务去抖缓存）
   * <en/> Pending pagination state (microtask debounce cache)
   */
  let pendingPage: number | null = null
  let pendingSize: number | null = null
  /** <zh/> 微任务调度标志，确保同一微任务周期内只调度一次 | <en/> Microtask scheduling flag, ensures only one schedule per microtask cycle */
  let microtaskScheduled = false

  function flushPendingUpdate(): void {
    microtaskScheduled = false
    if (pendingPage === null || pendingSize === null)
      return

    const page = pendingPage
    const size = pendingSize
    pendingPage = null
    pendingSize = null

    const urlStateConfig = resolvedConfig.value
    if (!urlStateConfig.enabled || isManual.value)
      return
    const { router, route } = tryGetRouter(routerContext)
    if (!router || !route)
      return
    const { path, query } = route
    const result = router.replace({
      path,
      query: {
        ...query,
        [urlStateConfig.pageKey]: String(page),
        [urlStateConfig.sizeKey]: String(size),
      },
    })
    /**
     * <zh/> vue-router 的 replace 返回失败/取消时 reject——未捕获即 unhandled rejection；
     * <zh/> 类型上 RouterLike 允许 void（非 router 场景），Promise 仅在可用时捕获。
     * <en/> vue-router's replace rejects on failure/navigation cancel — unware it becomes an
     * <en/> unhandled rejection; RouterLike permits void (non-router hosts), so catch only
     * <en/> when a Promise is returned.
     */
    if (result && typeof (result as Promise<unknown>).catch === 'function')
      (result as Promise<unknown>).catch(() => { /* 导航被取消/重复：URL 已与期望一致或被更新的导航覆盖，静默收敛 */ })
  }

  function scheduleFlush(): void {
    if (microtaskScheduled)
      return
    microtaskScheduled = true
    /**
     * <zh/> 使用 Promise.resolve.then 调度微任务，合并同一事件循环内的连续 setPageLog 调用
     * <en/> Schedule microtask via Promise.resolve.then, merging consecutive setPageLog calls within the same event loop
     */
    Promise.resolve().then(flushPendingUpdate)
  }

  function setPageLog(page: number, size: number) {
    /**
     * <zh/> 初始化期间跳过写入：避免 initFromUrl 触发的副作用反向覆盖 URL 中刚读取的初始状态
     * <en/> Skip write during initialization: avoid initFromUrl side-effects overwriting the initial state just read from URL
     */
    // <zh/> 初始化窗口内的回声写入（watcher 对 pagination 赋值的反应）与 URL 现值一致，跳过；
    // <zh/> 与初始化值不同的写入视为用户手动变更，照常入队——不再用布尔守卫整体吞掉。
    // <en/> In the init window, echo writes (watchers reacting to pagination assignment) matching
    // <en/> the URL values are skipped; anything differing is a genuine user change and is queued —
    // <en/> the boolean guard no longer swallows those.
    if (isInitializing && page === initPage && size === initSize)
      return
    pendingPage = page
    pendingSize = size
    scheduleFlush()
  }

  function initFromUrl(): { page?: number, size?: number } {
    const urlStateConfig = resolvedConfig.value
    if (!urlStateConfig.enabled || isManual.value)
      return {}
    const { route } = tryGetRouter(routerContext)
    if (!route)
      return {}
    const { [urlStateConfig.pageKey]: p, [urlStateConfig.sizeKey]: s } = route.query

    function parsePositiveInt(value: unknown): number | undefined {
      const num = Number(value)
      return Number.isFinite(num) && num > 0 && Number.isInteger(num) ? num : undefined
    }

    /**
     * <zh/> 初始化守卫：清空待提交缓存并标记初始化中，避免初始化触发的副作用覆盖刚读取的 URL 状态
     * <en/> Initialization guard: clear pending cache and mark initializing, avoid init-triggered side-effects overwriting URL state just read
     */
    pendingPage = null
    pendingSize = null
    microtaskScheduled = false
    isInitializing = true
    const parsedPage = parsePositiveInt(p)
    const parsedSize = parsePositiveInt(s)
    initPage = parsedPage
    initSize = parsedSize
    /**
     * <zh/> 微任务解除守卫：当前同步代码路径内的所有副作用（如 pagination.currentPage 赋值触发的 watch）完成后解除
     * <en/> Release guard via microtask: released after all side-effects from synchronous code path (e.g., watches triggered by pagination.currentPage assignment) complete
     */
    Promise.resolve().then(() => {
      isInitializing = false
    })

    return {
      page: parsedPage,
      size: parsedSize,
    }
  }

  /**
   * <zh/> 组件销毁时清理待提交状态，避免卸载后微任务触发 router.replace
   * <en/> Clean up pending state on scope dispose, avoid router.replace triggered by microtask after unmount
   */
  const scope = getCurrentScope()
  if (scope) {
    onScopeDispose(() => {
      pendingPage = null
      pendingSize = null
      microtaskScheduled = false
      isInitializing = false
    })
  }

  return { setPageLog, initFromUrl }
}
