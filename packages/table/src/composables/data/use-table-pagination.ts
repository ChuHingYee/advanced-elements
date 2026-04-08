import type { ElPagination } from 'element-plus'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowRef, toValue, watch } from 'vue'
import { DEFAULT_PAGE_SIZES, DEFAULT_ROW_HEIGHT } from '../../constants'
import { rafSchedule } from '../../utils/raf'

/**
 * <zh/> 管理 Observer 的 setup/cleanup 生命周期，自动处理 onMounted/onActivated 延迟 setup、onDeactivated/onBeforeUnmount cleanup
 * <en/> Manage Observer setup/cleanup lifecycle, automatically handling onMounted/onActivated deferred setup, onDeactivated/onBeforeUnmount cleanup
 */
function useObserverLifecycle(
  setup: () => void,
  cleanup: () => void,
  isUnmountedGetter: () => boolean,
) {
  function safeSetup() {
    if (isUnmountedGetter())
      return
    nextTick(() => {
      if (!isUnmountedGetter())
        setup()
    })
  }

  onMounted(safeSetup)
  onActivated(safeSetup)
  onDeactivated(cleanup)
  onBeforeUnmount(cleanup)
}
/**
 * <zh/> 默认分页布局
 * <en/> Default pagination layout
 */
const DEFAULT_LAYOUT = 'total, sizes, prev, pager, next, jumper'

/**
 * <zh/> 表格分页配置选项（纯配置，无回调）
 * <en/> Table pagination configuration options (config only, no callbacks)
 */
export interface UseTablePaginationOptions {
  enabled?: MaybeRefOrGetter<boolean>
  /**
   * <zh/> 分页模式
   * <zh/> - 'page': 分页模式
   * <zh/> - 'manual': 手动加载模式
   * <zh/> - 'client': 前端分页
   * <en/> Pagination mode
   * <en/> - 'page': pagination mode
   * <en/> - 'manual': manual load mode
   * <en/> - 'client': client-side pagination
   */
  mode?: MaybeRefOrGetter<'page' | 'manual' | 'client'>
  sticky?: MaybeRefOrGetter<boolean>
  /** 分页容器高度（用于判断粘性和 autoPageSize 计算） */
  containerHeight?: MaybeRefOrGetter<number>
  /**
   * 根据容器高度自动计算每页条数。
   * 启用后 pageSize = Math.floor(containerHeight / rowHeight)。
   */
  autoPageSize?: MaybeRefOrGetter<boolean>
  /** 用于 autoPageSize 计算的行高（像素，默认 48） */
  rowHeight?: MaybeRefOrGetter<number>
  pageSize?: MaybeRefOrGetter<number>
  pageSizes?: MaybeRefOrGetter<number[]>
  /** 数据总条数（由 useRequest 返回；仅服务端模式写入，client 模式改读 clientTotal） */
  total: Ref<number>
  /**
   * <zh/> 客户端数据长度（client 模式的真相源，由分页校正写入；与服务端 total 分离，单 owner）
   * <en/> Client data length (single owner for client mode, written by the correction watcher)
   */
  clientTotal?: MaybeRefOrGetter<number>
  /** 外部传入的总条数（备用，如 manual 模式下由 props 传入） */
  propsTotal?: MaybeRefOrGetter<number | undefined>
  /** 分页布局（透传 ElPagination 的 layout 属性） */
  layout?: MaybeRefOrGetter<string | undefined>
  paginationRef: Ref<InstanceType<typeof ElPagination> | null>
  isManual: Ref<boolean>
}

/** <zh/> 页码/条数变更后的结果，供父组件执行副作用 | <en/> Result of a page/page-size change, letting the parent component run side effects */
export interface PaginationChangeResult {
  page: number
  size: number
  reason: 'pageChange' | 'pageSizeChange' | 'loadMore'
  /** 是否为 client 模式（client 模式不需要发起请求） */
  isClient: boolean
  /** 是否需要重置数据（pageSizeChange 时为 true） */
  needsReset: boolean
}

interface ResolvedPaginationConfig {
  enabled: boolean
  mode: 'page' | 'manual' | 'client'
  sticky: boolean
  containerHeight: number
  autoPageSize: boolean
  rowHeight: number
  pageSize: number
  propsTotal: number
}

/**
 * 表格分页 Composable
 * @param options - 分页配置选项（纯配置，无回调）
 */
export function useTablePagination(options: UseTablePaginationOptions) {
  const resolvedConfig = computed<ResolvedPaginationConfig>((prev) => {
    const next = {
      enabled: toValue(options.enabled) ?? true,
      mode: toValue(options.mode) ?? 'page',
      sticky: toValue(options.sticky) ?? true,
      containerHeight: toValue(options.containerHeight) ?? 450,
      autoPageSize: toValue(options.autoPageSize) ?? false,
      rowHeight: toValue(options.rowHeight) ?? DEFAULT_ROW_HEIGHT,
      pageSize: toValue(options.pageSize) ?? 10,
      propsTotal: toValue(options.propsTotal) ?? 0,
    }
    if (prev
      && prev.enabled === next.enabled
      && prev.mode === next.mode
      && prev.sticky === next.sticky
      && prev.containerHeight === next.containerHeight
      && prev.autoPageSize === next.autoPageSize
      && prev.rowHeight === next.rowHeight
      && prev.pageSize === next.pageSize
      && prev.propsTotal === next.propsTotal) {
      return prev
    }
    return next
  })

  /**
   * Independent computed: recalculates only when pageSizes source changes
   * 独立 computed：仅 pageSizes 源变化时才重算，避免无关配置变化触发 ElPagination 重渲染
   */
  const resolvedPageSizes = computed<number[]>((prev) => {
    const next = toValue(options.pageSizes) ?? DEFAULT_PAGE_SIZES
    if (prev && prev.length === next.length && prev.every((v, i) => v === next[i]))
      return prev
    return next
  })

  const { total, paginationRef, isManual } = options

  const isClient = computed(() => resolvedConfig.value.mode === 'client')

  const localPageLayout = computed(() => toValue(options.layout) || DEFAULT_LAYOUT)
  const currentPage = shallowRef(1)
  const localPageSize = shallowRef(resolvedConfig.value.pageSize)
  const isSticky = shallowRef(false)

  /** 外部 pageSize 变化时同步到内部状态（支持 v-model:page-size） */
  watch(() => resolvedConfig.value.pageSize, (newSize) => {
    if (newSize !== localPageSize.value) {
      localPageSize.value = newSize
    }
  })

  let autoPageResizeObserver: ResizeObserver | null = null

  function recalcAutoPageSize() {
    if (!resolvedConfig.value.autoPageSize)
      return
    const el = paginationRef.value?.$el?.parentElement
    if (!el)
      return
    // <zh/> 动态测量分页条高度，替代硬编码 40px | <en/> Dynamically measure pagination bar height, replacing hardcoded 40px
    const paginationBarHeight = paginationRef.value?.$el?.offsetHeight ?? 40
    const height = el.clientHeight - paginationBarHeight
    if (height > 0) {
      const newSize = Math.max(1, Math.floor(height / resolvedConfig.value.rowHeight))
      if (newSize !== localPageSize.value) {
        localPageSize.value = newSize
      }
    }
  }

  /**
   * <zh/> rAF 缓冲调度（共享工具）：合并多次 ResizeObserver 回调到同一帧，避免同步读取 clientHeight 触发 Layout Thrashing。
   * <en/> rAF-coalesced scheduling (shared util): merges multiple ResizeObserver callbacks into one frame,
   * <en/> avoiding layout thrashing from synchronous clientHeight reads.
   */
  const autoPageCalcHandle = rafSchedule(recalcAutoPageSize)

  function scheduleAutoPageCalc() {
    autoPageCalcHandle.schedule()
  }

  function setupAutoPageObserver() {
    if (typeof window === 'undefined' || !resolvedConfig.value.autoPageSize)
      return
    // <zh/> 无 ResizeObserver 环境（旧浏览器/JSDOM 无 polyfill）降级：跳过自动页长观测，
    // <zh/> 避免 ReferenceError；recalc 仍可由外部显式触发。
    // <en/> No-ResizeObserver environments (legacy browsers / JSDOM without polyfill) degrade gracefully:
    // <en/> skip auto-page-size observation to avoid ReferenceError; recalc stays explicitly triggerable.
    if (typeof ResizeObserver === 'undefined')
      return
    cleanupAutoPageObserver()
    const el = paginationRef.value?.$el?.parentElement
    if (!el)
      return
    autoPageResizeObserver = new ResizeObserver(scheduleAutoPageCalc)
    autoPageResizeObserver.observe(el)
    recalcAutoPageSize()
  }

  function cleanupAutoPageObserver() {
    autoPageCalcHandle.cancel()
    if (autoPageResizeObserver) {
      autoPageResizeObserver.disconnect()
      autoPageResizeObserver = null
    }
  }

  /**
   * Actual total count used
   * 实际使用的总条数
   * 单 owner 口径：manual→propsTotal；client→clientTotal（校正写入）；server→total（请求写入）。
   * Single-owner caliber: manual→propsTotal; client→clientTotal; server→total.
   */
  const paginationTotal = computed(() => {
    if (isManual.value) {
      const external = toValue(options.propsTotal)
      if (external !== undefined)
        return external
    }
    if (isClient.value) {
      const clientLen = toValue(options.clientTotal)
      if (clientLen !== undefined)
        return clientLen
    }
    return total.value ?? 0
  })

  /**
   * Whether there is more data (meaningful only in manual mode)
   * 是否还有更多数据（仅 manual 模式有意义）
   */
  const hasMore = computed(() => {
    const currentTotal = paginationTotal.value
    if (currentTotal <= 0)
      return false
    return currentPage.value * localPageSize.value < currentTotal
  })

  const paginationClass = computed(() => {
    const cls: string[] = []
    if (isSticky.value)
      cls.push('adv-table__page--sticky')
    if (isManual.value)
      cls.push('adv-table__page--manual')
    return cls.join(' ')
  })

  /**
   * <zh/> 页码规范化——NaN 防御（NaN 会流入请求参数与 URL query）+ 下界 1 + 上界 maxPage。
   * <zh/> 上界约束：在状态入口统一收敛；否则 server/manual 模式在数据收缩后
   * <zh/> 停留在空页（仅 client 模式有外部 watcher 校正不足以覆盖全链路）。
   * <en/> Page normalization — NaN defense (NaN would leak into request params and URL query),
   * <en/> lower bound of 1, and upper bound of maxPage. Invariant: normalize uniformly at the
   * <en/> state entry point; otherwise server/manual modes stay on empty pages after data
   * <en/> shrinkage (an external watcher in client mode alone cannot cover the chain).
   */
  function normalizePage(val: number): number {
    if (!Number.isFinite(val))
      return 1
    const page = Math.max(1, Math.floor(val))
    /**
     * <zh/> 上界仅在"已知总量"时生效——total=0 表示尚未加载或空集：
     * <zh/> 此时钳到 1 会误拦首次导航与 URL 页码恢复；数据收缩后的越界
     * <zh/> 由外部校正 watcher（client）与本入口的后续调用共同兜底。
     * <en/> Upper clamp applies only when the total is KNOWN — total=0 means not-yet-loaded
     * <en/> or empty: clamping to 1 would wrongly block first navigation and URL page restore.
     * <en/> Post-load shrinkage is covered by the client-side correction watcher plus
     * <en/> subsequent calls through this normalized entry.
     */
    const total = paginationTotal.value
    if (!(total > 0))
      return page
    const safeSize = Number.isFinite(localPageSize.value) && localPageSize.value >= 1 ? Math.floor(localPageSize.value) : 1
    const maxPage = Math.max(1, Math.ceil(total / safeSize))
    return Math.min(page, maxPage)
  }

  /**
   * <zh/> 设置当前页码（纯状态变更，返回变更信息供父组件执行副作用）
   * <en/> Set current page (pure state change, returns change info for parent to execute side effects)
   */
  function setCurrentPage(val: number): PaginationChangeResult {
    // manual(loadMore) 模式 total 表示"已加载数"而非全量，钳制上界会阻断加载更多——跳过上界
    // In manual (load-more) mode `total` means loaded count, not the full set — skip the upper clamp
    const page = isManual.value ? Math.max(1, Number.isFinite(val) ? Math.floor(val) : 1) : normalizePage(val)
    currentPage.value = page
    return {
      page,
      size: localPageSize.value,
      reason: 'pageChange',
      isClient: isClient.value,
      needsReset: false,
    }
  }

  /**
   * <zh/> 设置每页条数（纯状态变更，返回变更信息供父组件执行副作用）
   * <zh/> 会自动将页码重置为 1
   * <en/> Set page size (pure state change, returns change info for parent to execute side effects)
   * <en/> Automatically resets page to 1
   */
  function setPageSize(val: number): PaginationChangeResult {
    const size = Math.max(1, Number.isFinite(val) ? Math.floor(val) : 1)
    localPageSize.value = size
    currentPage.value = 1
    return {
      page: 1,
      size,
      reason: 'pageSizeChange',
      isClient: isClient.value,
      needsReset: isManual.value,
    }
  }

  /**
   * <zh/> 手动加载模式下的加载更多（纯状态变更，返回变更信息供父组件执行副作用）
   * <en/> Load more in manual load mode (pure state change, returns change info for parent to execute side effects)
   */
  function loadMore(): PaginationChangeResult | null {
    if (!hasMore.value)
      return null
    const nextPage = currentPage.value + 1
    currentPage.value = nextPage
    return {
      page: nextPage,
      size: localPageSize.value,
      reason: 'loadMore',
      isClient: false,
      needsReset: false,
    }
  }

  /**
   * Check if pagination bar needs sticky positioning using IntersectionObserver
   * 使用 IntersectionObserver 检查分页栏是否需要粘性定位
   */
  let stickyObserver: IntersectionObserver | null = null
  /** 缓存上次 rootMargin，避免相同值时重建 Observer */
  let lastStickyRootMargin: string | null = null
  /** 组件卸载标志——防止 nextTick 回调在 unmount 后创建 Observer */
  let isUnmounted = false

  function buildStickyRootMargin(): string {
    return `0px 0px -${resolvedConfig.value.containerHeight ?? 0}px 0px`
  }

  function setupStickyObserver() {
    if (typeof window === 'undefined' || !resolvedConfig.value.sticky)
      return

    const el = paginationRef.value?.$el
    if (!el)
      return

    const rootMargin = buildStickyRootMargin()
    /** rootMargin 未变化时跳过重建 */
    if (stickyObserver && rootMargin === lastStickyRootMargin)
      return

    cleanupStickyObserver()

    stickyObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          isSticky.value = !entry.isIntersecting
        }
      },
      {
        threshold: 0,
        rootMargin,
      },
    )
    lastStickyRootMargin = rootMargin
    stickyObserver.observe(el)
  }

  function cleanupStickyObserver() {
    if (stickyObserver) {
      stickyObserver.disconnect()
      stickyObserver = null
      lastStickyRootMargin = null
    }
  }

  watch(() => resolvedConfig.value.containerHeight, (_val, _old, onCleanup) => {
    if (resolvedConfig.value.sticky) {
      setupStickyObserver()
    }
    // 将 Observer 回收绑定到 watch 生命周期（重触发/停止即断开），替代依赖组件卸载延迟清理 | Bind Observer cleanup to watch lifecycle (re-trigger/stop disconnects), replacing delayed cleanup via component unmount
    onCleanup(cleanupStickyObserver)
  }, { flush: 'post' })

  /**
   * <zh/> paginationRef 异步挂载时（如 footer 延迟渲染），重新绑定 ResizeObserver
   * <en/> Re-bind ResizeObserver when paginationRef becomes available asynchronously
   * <en/> (e.g., footer lazy-rendered after mount).
   */
  watch(() => paginationRef.value, (val, _old, onCleanup) => {
    if (val && resolvedConfig.value.autoPageSize && !isUnmounted) {
      nextTick(() => {
        if (!isUnmounted) {
          setupAutoPageObserver()
        }
      })
    }
    // 将 Observer 回收绑定到 watch 生命周期（重触发/停止即断开），替代依赖组件卸载延迟清理 | Bind Observer cleanup to watch lifecycle (re-trigger/stop disconnects), replacing delayed cleanup via component unmount
    onCleanup(cleanupAutoPageObserver)
  })

  // <zh/> 使用 useObserverLifecycle 统一管理两组 Observer 的 setup/cleanup，消除重复的 nextTick + isUnmounted 检查样板 | <en/> Use useObserverLifecycle to unify setup/cleanup for both Observer groups, eliminating repeated nextTick + isUnmounted boilerplate
  useObserverLifecycle(
    () => {
      if (resolvedConfig.value.sticky)
        setupStickyObserver()
      if (resolvedConfig.value.autoPageSize)
        setupAutoPageObserver()
    },
    () => {
      cleanupStickyObserver()
      cleanupAutoPageObserver()
    },
    () => isUnmounted,
  )

  onBeforeUnmount(() => {
    isUnmounted = true
    // <zh/> useObserverLifecycle 已注册 onBeforeUnmount(cleanup)，此处仅需设置标志 | <en/> useObserverLifecycle already registers onBeforeUnmount(cleanup), here only sets the flag
  })

  return {
    currentPage,
    pageSize: localPageSize,
    isSticky,
    isClient,
    pageSizes: resolvedPageSizes,
    hasMore,
    paginationClass,
    paginationTotal,
    localPageLayout,
    setCurrentPage,
    setPageSize,
    loadMore,
  }
}

/**
 * <zh/> 客户端分页校正依赖——本模块拥有 total/分页状态，调用方仅传入展示数据长度
 * <zh/> 约束：禁止跨域读写 pagination/total；所有权归属本模块
 * <en/> Client-pagination correction deps — this module owns total/pagination state; callers only pass the display-data length
 * <en/> Invariant: no cross-domain pagination/total mutation; ownership stays in this module
 */
export interface ClientPaginationCorrectionDeps {
  /** <zh/> 展示数据长度（调用方 computed，如 finalDisplayData.length，仅监听长度避免全量 diff） | <en/> Display-data length (caller computed, e.g. finalDisplayData.length; length-only to avoid full diff) */
  displayLength: () => number
  /** <zh/> 是否客户端分页 | <en/> Whether client-side pagination is active */
  isClient: Ref<boolean>
  /**
   * <zh/> 数据总条数（服务端 owner，client 校正禁止再写；保留字段以兼容旧调用方，运行时忽略）
   * <en/> Response total (server-owned; ignored by the client correction; kept for compat)
   */
  total?: Ref<number>
  /**
   * <zh/> 客户端长度目标（pagination-owned，单 owner 写入口；未传时回退写 total 以兼容旧调用方）
   * <en/> Client-length target (pagination-owned single-writer; falls back to total for compat)
   */
  clientTotal?: Ref<number>
  /** <zh/> 每页条数 | <en/> Page size */
  pageSize: Ref<number>
  /** <zh/> 当前页码 | <en/> Current page */
  currentPage: Ref<number>
  /** <zh/> 设置当前页 | <en/> Set current page */
  setCurrentPage: (page: number) => unknown
}

/**
 * <zh/> 客户端分页校正——数据长度变化时同步 client 长度并钳制越界页码（不再写服务端 total，单 owner）
 * <zh/> guard: 仅客户端分页且有数据时校正，避免初始化异步数据未就绪时的多余触发；纯函数式装配，同输入同行为
 * <en/> Client-pagination correction — syncs the client length and clamps out-of-range pages (never touches the server total)
 * <en/> guard: only corrects under client pagination with data present, avoiding premature triggers while async data initializes; purely wiring, same input same behavior
 */
export function watchClientPaginationCorrection(deps: ClientPaginationCorrectionDeps): void {
  watch(
    () => deps.displayLength(),
    (len) => {
      if (!deps.isClient.value || len === 0)
        return
      const target = deps.clientTotal ?? deps.total
      if (target)
        target.value = len
      const safeSize = Number.isFinite(deps.pageSize.value) && deps.pageSize.value >= 1 ? Math.floor(deps.pageSize.value) : 1
      const maxPage = Math.max(1, Math.ceil(len / safeSize))
      if (deps.currentPage.value > maxPage) {
        deps.setCurrentPage(maxPage)
      }
    },
    { immediate: true },
  )
}
