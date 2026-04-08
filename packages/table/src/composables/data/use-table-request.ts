import type { Ref } from 'vue'
import type { DataSource, FormatMaps, RowKeyMeta } from '../../types'
import type { TableError } from '../../types/error'
import type { TableRequestPayload, TableRequestReason } from '../../types/request'
import type { SortOrder } from '../../types/sort'
import type { DataTransactionReturn } from '../data/use-data-transaction'
import type { RequestMode, UseRequestOptions, UseRequestRetryOptions } from '../data/use-request'
import type { UseTablePaginationOptions } from '../data/use-table-pagination'
import { computed, nextTick, onActivated, onBeforeMount, onDeactivated, onMounted, onScopeDispose, onUnmounted, shallowRef, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { writeFullData } from '../data/use-data-update-bridge'
import { useRequest } from '../data/use-request'
import { useTablePagination } from '../data/use-table-pagination'
import { useUrlState } from '../data/use-url-state'
import { createPaginationEffects } from './pagination-effects'

export interface UseTableRequestOptions<T> {
  requestSource: () => DataSource<T> | undefined
  requestAuto: () => boolean
  requestMode: () => RequestMode
  formatMaps: () => FormatMaps | undefined
  paramKeys: () => { page?: string, size?: string } | undefined
  transformRequest: () => UseRequestOptions<T>['transformRequest']
  transformResponse: () => UseRequestOptions<T>['transformResponse']

  urlStateEnabled: () => boolean
  urlStatePageKey: () => string
  urlStateSizeKey: () => string

  paginationOptions: UseTablePaginationOptions

  searchParams: () => Record<string, any>

  rowKeyFn: () => (row: T) => string

  isManual: Ref<boolean>

  requestTimeout?: () => number
  requestRetries?: () => number | UseRequestRetryOptions | undefined
  requestRetryDelay?: () => number | undefined
  requestRetryBackoffFactor?: () => number | undefined
  requestRetryMaxDelay?: () => number | undefined
  requestRetryOn?: () => ((error: unknown) => boolean) | undefined

  /**
   * Consolidated emit callbacks — grouped into a single object for stability.
   * Merged from 8 individual callbacks to reduce the options surface and
   * make it easier to pass a stable reference from table.vue.
   * 合并的 emit 回调 — 归组为单一对象以提升稳定性。
   * 从8个独立回调合并而来，减少选项表面积，便于 table.vue 传递稳定引用。
   */
  emits: {
    pageChange: (page: number, size: number) => void
    updateLoading: (loading: boolean) => void
    request: (payload: TableRequestPayload) => Promise<T[]>
    refresh: () => void
    updateData: (data: T[]) => void
    /**
     * <zh/> 数据变更回调（非事务装配的直写路径）——仅当未提供 `dataChangeCommit` 时 reorderData 调用；
     * <zh/> 生产装配一律提供 `dataChangeCommit` 走事务内核，本回调供单测与自定义装配使用
     * <en/> Data-change callback (direct-write path for non-transaction assembly) — called by reorderData
     * <en/> only when `dataChangeCommit` is absent; production assembly always provides `dataChangeCommit`
     * <en/> for the transaction kernel, this callback serves unit tests and custom assemblies
     */
    dataChange?: (params: { reason: string, data: T[], oldData?: T[] }) => void
    /** 接口请求失败的结构化错误派发（替代纯字符串 console.error） */
    onError: (error: TableError) => void
  }

  /**
   * <zh/> 数据变更提交通道——提供后 reorderData 经事务内核提交
   * <zh/> （beforeDataChange 可否决 → writeFullData 写入 → 内核单发 dataChange），
   * <zh/> 写路由与桥接 'full' 分支同源，不再需要调用方的晚绑定 holder
   * <en/> Data-change commit channel — when provided, reorderData commits via the transaction kernel
   * <en/> (vetoable beforeDataChange → writeFullData write → kernel-emitted dataChange),
   * <en/> sharing the write route with the bridge 'full' branch; no caller-side late-bound holder needed
   */
  dataChangeCommit?: {
    dataTransaction: DataTransactionReturn<T>
    writeModel: (data: T[]) => void
  }

  defaultPageSize?: () => number | undefined

  /**
   * Default data when no request.source is provided (e.g. props.data).
   * 无 request.source 时的默认数据（如 props.data）。
   */
  defaultData?: () => T[]

  /** 树形子节点字段名，启用时 rowKeyMeta 会递归遍历子节点 */
  childrenKey?: () => string | undefined

  /**
   * <zh/> request.autoParams 配置（undefined = 关闭自动注入） | <en/> request.autoParams config (undefined = auto-attach disabled)
   */
  autoParamsConfig?: () => boolean | { sortKey?: string, filterKey?: string } | undefined

  /**
   * <zh/> 当前排序状态（预创建共享引用，请求域与管线直连） | <en/> Current sort state (pre-created shared ref, request domain and pipeline wired directly)
   */
  autoSortState?: () => Array<{ prop: string, columnKey?: string, order: SortOrder }>

  /**
   * <zh/> 当前列筛选状态（预创建共享引用） | <en/> Current column filter state (pre-created shared ref)
   */
  autoFilterState?: () => Record<string, any>
}

export interface UseTableRequestReturn<T> {
  responseData: Ref<T[]>
  /** 加载状态（即内部 localLoading ref） */
  loading: Ref<boolean>
  total: Ref<number>
  hasSource: Ref<boolean>
  isPolling: Ref<boolean>
  pagination: ReturnType<typeof useTablePagination>
  tableData: Ref<T[]>
  rowKeyMeta: Ref<RowKeyMeta<T>>

  refresh: () => Promise<void>
  fetchData: (options?: { append?: boolean, reason?: TableRequestReason }) => Promise<T[] | null>
  setLoading: (val: boolean) => void
  setResponseData: (data: T[], requestId?: number) => void
  /** 当前 manual 请求序号（供父回显 requestId，无 manual 请求时为 0） */
  getManualRequestId: () => number
  /** manual 序号是否仍有效（未被更新请求取代且未卸载） */
  isManualRequestSettled: (requestId: number) => boolean
  clearResponseData: () => void
  stopPolling: () => void
  setIsPolling: (val: boolean) => void
  reorderData: (rows: T[]) => void
  handleCurrentPageChange: (val: number) => void
  handlePageSizeChange: (val: number) => void
  handleLoadMore: () => void
  getPagination: () => { currentPage: number, pageSize: number, total: number }
  /**
   * <zh/> 置页并触发副作用（分页 effects：remote 重取 / manual 通知 / client 纠偏）。
   * <zh/> 与 `pagination.setCurrentPage`（纯状态）同名异义是 double-fetch 的病因，
   * <zh/> 故此处显式命名。仅需改状态时用 `pagination.setCurrentPage`。
   * <en/> Set page and fire side effects (pagination effects: remote refetch / manual
   * <en/> notify / client correction). Named explicitly because sharing a name with the
   * <en/> pure-state `pagination.setCurrentPage` caused double-fetch bugs.
   * <en/> Use `pagination.setCurrentPage` when only the state needs changing.
   */
  setCurrentPageAndRefetch: (page: number) => void
  /**
   * <zh/> 置每页条数并触发副作用（同 setCurrentPageAndRefetch；与纯状态
   * <zh/> `pagination.setPageSize` 区分命名，防 double-fetch 误调）。
   * <en/> Set page size and fire side effects (same as setCurrentPageAndRefetch;
   * <en/> named distinctly from the pure-state `pagination.setPageSize` to prevent
   * <en/> double-fetch misuse).
   */
  setPageSizeAndRefetch: (size: number) => void
  getFullData: () => T[]
}

/**
 * <zh/> 已做重复 rowKey 检查的数据引用——同一数组仅告警一次，避免翻页/排序触发重复刷屏。
 * <en/> Data references already checked for duplicate rowKeys — each array warns at most once,
 * <en/> avoiding repeated spam on pagination/sort.
 */
const duplicateCheckedData = new WeakSet<object>()

/**
 * <zh/> 重复 rowKey 抽查上限——dev 下避免万级数据全量扫描阻塞 computed。
 * <en/> Duplicate-rowKey sampling cap — avoids blocking the computed with a full scan on huge data in dev.
 */
const DUPLICATE_ROW_KEY_SAMPLE_LIMIT = 2000

/**
 * <zh/> dev 下抽查重复 rowKey——行键重复时选择/编辑/树级联静默错乱，此处一次性指出。
 *
 * <zh/> 仅扫描前 N 个顶层行（含其子树，共享同一预算）；生产零开销（`isDev` 短路 + 同一引用只查一次）。
 * <en/> Dev-only sampled duplicate-rowKey check — duplicated keys silently corrupt selection/editing/
 * <en/> tree cascade, so point it out once here.
 *
 * <en/> Scans only the first N top-level rows (including their subtrees, sharing one budget);
 * <en/> zero production cost (`isDev` short-circuit + once per reference).
 */
function warnOnDuplicateRowKeys<T>(data: T[], keyFn: (row: T) => string, childrenKey?: string): void {
  if (!isDev || data.length < 2 || duplicateCheckedData.has(data as unknown as object))
    return
  duplicateCheckedData.add(data as unknown as object)
  const seen = new Set<string>()
  let scanned = 0
  let duplicate: string | null = null
  const visit = (row: T): boolean => {
    if (scanned >= DUPLICATE_ROW_KEY_SAMPLE_LIMIT)
      return true
    scanned++
    const key = keyFn(row)
    if (seen.has(key)) {
      duplicate = key
      return true
    }
    seen.add(key)
    if (childrenKey) {
      const children = (row as Record<string, unknown>)[childrenKey]
      if (Array.isArray(children)) {
        for (const child of children as T[]) {
          if (visit(child))
            return true
        }
      }
    }
    return false
  }
  for (const row of data) {
    if (visit(row))
      break
  }
  if (duplicate !== null) {
    devWarn(
      `[AdvTable] duplicate rowKey "${duplicate}" detected in table data `
      + `(first ${scanned} row(s) sampled). Duplicate keys silently corrupt selection, tree cascade, `
      + 'dirty tracking and drag targeting — please ensure rowKey uniqueness. | '
      + `检测到重复 rowKey"${duplicate}"（已抽查前 ${scanned} 行），重复行键会导致选择/树级联/脏跟踪/拖拽静默错乱，请保证 rowKey 唯一。`,
    )
  }
}

/**
 * 表格请求编排 composable — 整合 useRequest、useTablePagination、useUrlState，
 * 统一管理数据加载、分页切换与 URL 同步。
 *
 * @param options - 请求编排配置
 * @returns 请求数据、分页状态与操作方法
 */
export function useTableRequest<T>(options: UseTableRequestOptions<T>): UseTableRequestReturn<T> {
  const {
    requestSource,
    requestAuto,
    requestMode,
    formatMaps,
    paramKeys,
    transformRequest,
    transformResponse,
    requestTimeout,
    urlStateEnabled,
    urlStatePageKey,
    urlStateSizeKey,
    paginationOptions,
    searchParams,
    rowKeyFn,
    isManual,
    emits,
    defaultPageSize,
    defaultData,
    childrenKey,
    autoParamsConfig,
    autoSortState,
    autoFilterState,
    dataChangeCommit,
  } = options

  const isPolling = shallowRef(false)
  /** 组件卸载标志，防止 nextTick 回调在卸载后执行 */
  let isUnmounted = false

  /**
   * <zh/> manual 模式的独立 AbortController + 请求序号守卫。
   * <zh/> 自动模式由 useRequest 内部维护；manual 模式组件侧自建，快速翻页/筛选时
   * <zh/> abort 上一个请求并递增序号，防止旧响应覆盖新数据。
   * <en/> Manual-mode AbortController + request-id guard.
   * <en/> Auto mode keeps its own inside useRequest; manual mode builds one here so rapid
   * <en/> page/filter changes abort the previous request and stale responses are dropped.
   */
  let manualAbortController: AbortController | null = null
  let manualLatestRequestId = 0

  /**
   * <zh/> 非法响应映射为生产可见结构化码（显式错配即上报，按空表处理不断行）
   * <en/> Map malformed responses to a production-visible structured code (report on explicit mismatch, still treat as empty without breaking).
   */
  function handleResponseMalformed(info: { dataKey: string, hasDataKey: boolean, isDataArray: boolean }): void {
    try {
      emits.onError({
        code: 'TABLE_RESPONSE_MALFORMED',
        severity: 'warn',
        cause: info,
      })
    }
    catch {
      // <zh/> 上报通道异常不影响数据链路 | <en/> Report-channel errors must not break the data path
    }
  }
  // <zh/> 字段级引用稳定由 useRequest 内部的 opts computed（prev 逐字段比较）保证，此处不再重复守卫
  // <en/> Field-level reference stability is guaranteed by the opts computed inside useRequest
  // <en/> (prev field-by-field comparison); no duplicate guard here
  const requestOptions = computed((): UseRequestOptions<T> => {
    return {
      dataSource: requestSource(),
      auto: requestAuto(),
      requestMode: requestMode(),
      formatMaps: formatMaps(),
      paramKeys: paramKeys(),
      transformRequest: transformRequest(),
      transformResponse: transformResponse(),
      timeout: requestTimeout?.() ?? 0,
      retries: options.requestRetries?.(),
      retryDelay: options.requestRetryDelay?.(),
      retryBackoffFactor: options.requestRetryBackoffFactor?.(),
      retryMaxDelay: options.requestRetryMaxDelay?.(),
      retryOn: options.requestRetryOn?.(),
      onMalformed: handleResponseMalformed,
    }
  })

  const {
    data: responseData,
    loading: localLoading,
    total,
    hasSource,
    request,
    refresh: refreshRequest,
    setLoading,
    setData: setResponseData,
    clearData: clearResponseData,
  } = useRequest(() => requestOptions.value)

  // <zh/> 脏行剔除与 rowKeyMeta 双 Map 构建在同一趟遍历内完成，热路径保持单趟 O(n)；
  // <zh/> 无脏行且结构未变时复用 prev（引用稳定）；同引用原地 push/splice/reverse 会改变
  // <zh/> 长度/索引/行身份，必须重算并产出新引用，否则下游虚拟表（仅监听引用变化 reset）
  // <zh/> 与 rowKeyMeta 会保留旧索引。注意：early-return 必须在追踪数组内容之后，
  // <zh/> 否则 computed 永远订阅不到数组内部变更。
  // <en/> the dirty-row sweep and the rowKeyMeta dual-Map build happen in a single traversal, keeping the
  // <en/> hot path at one O(n) pass; when clean, `cleaned` reuses the original array reference so downstream
  // <en/> computeds stay reference-stable. The tree branch (childrenKey) recurses to build the maps in the
  // <en/> same pass, but `cleaned` collects top-level rows only — flattening is owned by the downstream
  // <en/> useTreeData, so a flattened array here would double-flatten (duplicate rows).
  const cleanedAndMeta = computed<{ cleaned: T[], meta: RowKeyMeta<T> }>((prev) => {
    const raw = hasSource.value
      ? responseData.value
      : (defaultData?.() ?? [])
    const arr = Array.isArray(raw) ? raw : []
    const keyFn = rowKeyFn()
    const cKey = childrenKey?.()
    // <zh/> 先订阅数组结构：长度 + 每一项引用。原地 push/splice/reverse 都会使本 computed 失效重算。
    // <en/> Subscribe to the array structure first so in-place mutations invalidate this computed.
    const arrLength = arr.length
    const prevCache = prev as unknown as { rawRef?: unknown, keyFn?: unknown, cKey?: unknown, arrLength?: number } | undefined
    const canFastPath = !!prev
      && prevCache?.rawRef === arr
      && prevCache?.keyFn === keyFn
      && prevCache?.cKey === cKey
      && prevCache?.arrLength === arrLength
    if (canFastPath) {
      // <zh/> 同引用且长度不变仍需验证行身份/顺序（reverse/sort/同长度替换场景），
      // <zh/> 逐项比对引用：全等才可复用 prev，否则落入下方全量重建。
      // <en/> Same reference + same length still needs identity/order verification:
      // <en/> reuse prev only when every element matches, otherwise fall through to the full rebuild.
      const prevMeta = (prev as unknown as { meta: RowKeyMeta<T> }).meta
      let identical = true
      if (cKey) {
        // <zh/> 树形场景做轻量校验：顶层引用序列一致即复用，深层变更由展平层处理
        // <en/> Tree case verifies only the top-level reference sequence; deeper changes belong to the flattening layer
        const prevRows = prevMeta.dataRef
        if (prevRows.length !== arrLength) {
          identical = false
        }
        else {
          for (let i = 0; i < arrLength; i++) {
            if ((prevRows[i] as unknown) !== (arr[i] as unknown)) {
              identical = false
              break
            }
          }
        }
      }
      else {
        const prevRows = (prev as unknown as { cleaned: T[] }).cleaned
        if (prevRows.length !== arrLength) {
          identical = false
        }
        else {
          for (let i = 0; i < arrLength; i++) {
            if ((prevRows[i] as unknown) !== (arr[i] as unknown)) {
              identical = false
              break
            }
          }
        }
      }
      if (identical)
        return prev
    }
    const keyToRow = new Map<string, T>()
    const keyToIndex = new Map<string, number>()
    let dirtyCount = 0
    // <zh/> 惰性建 cleaned：首个空洞前零分配，全程无洞则保持 `arr` 原引用（下游引用稳定）。
    // <en/> Lazy cleaned: zero allocation before the first hole; stays `arr` when no hole exists (stable ref downstream).
    let cleaned: T[] | null = null
    if (cKey) {
      let rowIndex = 0
      // <zh/> 顶层空洞计入脏行并移出 cleaned；嵌套空洞仅跳过（保留在子数组中，属既有不支持形态，不计入告警）
      // <en/> Top-level holes count as dirty and leave cleaned; nested holes are only skipped (kept in the child
      // <en/> array — a pre-existing unsupported shape — and deliberately not counted in the warning).
      const walk = (items: unknown[], topLevel: boolean) => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item === null || item === undefined) {
            if (topLevel) {
              dirtyCount++
              if (cleaned === null)
                cleaned = items.slice(0, i) as T[]
            }
            continue
          }
          const row = item as T
          if (topLevel) {
            const acc = cleaned
            if (acc !== null)
              acc.push(row)
          }
          const key = keyFn(row)
          keyToRow.set(key, row)
          keyToIndex.set(key, rowIndex++)
          const children = (row as Record<string, unknown>)[cKey]
          if (Array.isArray(children))
            walk(children, false)
        }
      }
      walk(arr as unknown[], true)
    }
    else {
      for (let i = 0; i < arr.length; i++) {
        const row = arr[i]
        if (row === null || row === undefined) {
          dirtyCount++
          if (cleaned === null)
            cleaned = arr.slice(0, i) as T[]
          continue
        }
        const acc = cleaned
        if (acc !== null)
          acc.push(row as T)
        const key = keyFn(row as T)
        keyToRow.set(key, row as T)
        // <zh/> 无空洞时索引即原位置，有空洞后即 cleaned 内位置 | <en/> index is the original position until a hole, then the position within cleaned
        keyToIndex.set(key, acc === null ? i : acc.length - 1)
      }
    }
    let cleanedRows: T[] = cleaned ?? (arr as T[])
    // <zh/> 同引用原地变更走到这里说明结构已变：必须产出新数组引用，否则下游
    // <zh/> tableData（prev === next 短路）与 EP V2（仅引用变化 reset）都感知不到。
    // <en/> Reaching here with the same reference means the structure changed: a new array
    // <en/> reference is required, otherwise tableData (prev === next short-circuit) and
    // <en/> EP V2 (reset on reference change only) never observe the change.
    if (cleaned === null && prevCache?.rawRef === arr)
      cleanedRows = (arr as T[]).slice()
    if (dirtyCount > 0) {
      devWarn(
        `[AdvTable] Dropped ${dirtyCount} null/undefined row(s) from table data. `
        + 'Rows must be objects; null entries cannot be keyed, selected, or rendered.',
      )
    }
    warnOnDuplicateRowKeys(cleanedRows, keyFn, cKey)
    const meta: RowKeyMeta<T> = { keyToRow, keyToIndex, keyFn, dataRef: cleanedRows }
    const next = { cleaned: cleanedRows, meta } as unknown as { cleaned: T[], meta: RowKeyMeta<T>, rawRef: unknown, keyFn: unknown, cKey: unknown, arrLength: number }
    next.rawRef = arr
    next.keyFn = keyFn
    next.cKey = cKey
    next.arrLength = arrLength
    return next as unknown as { cleaned: T[], meta: RowKeyMeta<T> }
  })

  const tableData = computed<T[]>((prev) => {
    /**
     * <zh/> manual 模式下也读 responseData——消费者通过 setResponseData/v-model 回流写入，
     * <zh/> 此处读取它使数据写回链路闭合。
     * <en/> Read responseData in manual mode too — consumers write back via setResponseData/v-model;
     * <en/> reading it here closes the data write-back loop.
     */
    const next = cleanedAndMeta.value.cleaned
    if (prev && prev === next)
      return prev
    return next
  })

  // <zh/> 行键元信息——与 tableData 同源，由 cleanedAndMeta 单趟产出；prev 守卫覆盖 rawRef/keyFn/cKey，
  // <zh/> 且 cleaned 复用原数组引用使 tableData 保持稳定，故无需按数组引用的二级缓存。
  // <en/> Row-key meta — produced by the same single pass as tableData via cleanedAndMeta; the prev guard
  // <en/> covers rawRef/keyFn/cKey and cleaned reuses the original array reference, so no array-ref
  // <en/> secondary cache is needed.
  const rowKeyMeta = computed<RowKeyMeta<T>>((prev) => {
    const next = cleanedAndMeta.value.meta
    if (prev && prev === next)
      return prev
    return next
  })

  /**
   * <zh/> localLoading → emit('update:loading') 桥接 watch 的工厂函数。
   * <zh/> 抽取为独立函数消除 onActivated 中重复创建的样板代码。
   * <en/> Factory for the localLoading → emit('update:loading') bridge watch.
   * <zh/> Extracted to eliminate the boilerplate of re-creating it in onActivated.
   */
  function createLoadingWatch(): (() => void) {
    return watch(localLoading, (val) => {
      emits.updateLoading(val)
    })
  }

  /**
   * <zh/> 当前活跃的 loading watch 停止函数——由 createLoadingWatch 返回。
   * <zh/> KeepAlive 兼容：deactivated 时停止 watch，避免后台请求完成触发父组件 loading 状态变更；
   * <zh/> reactivated 时重新启动 watch 并同步当前 loading 状态（避免漏 emit）。
   * <en/> Active loading watch stop function — returned by createLoadingWatch.
   * <en/> KeepAlive-compatible: stopped on deactivate to prevent background-request completions from
   * <en/> toggling the parent loading state; restarted on reactivate with a sync to avoid missed emits.
   */
  let stopLoadingWatch: (() => void) | null = createLoadingWatch()

  onDeactivated(() => {
    stopLoadingWatch?.()
    stopLoadingWatch = null
    // <zh/> manual 后台请求随停靠 abort 并推进序号——deactivated 期间完成的旧响应即 stale，
    // <zh/> 经 manualRequestSettled 丢弃，不再写数据（auto 路径已有 cancelRequest 对称处理）。
    // <en/> Abort manual in-flight requests on deactivate and bump the sequence — responses
    // <en/> completing while deactivated are stale via manualRequestSettled and dropped.
    manualAbortController?.abort()
    manualAbortController = null
    manualLatestRequestId++
  })

  onActivated(() => {
    /** <zh/> 重新启动 watch 并同步当前 loading 状态，确保父组件收到最新的 loading 值 | <en/> Restart watch and sync current loading state */
    stopLoadingWatch = createLoadingWatch()
    emits.updateLoading(localLoading.value)

    // <zh/> KeepAlive 重新激活时重读 URL 状态，确保路由前进/后退后分页参数同步。
    // <zh/> 注意走 resync（带副作用扇出）而非静默写入——此时表格已挂过数据，
    // <zh/> 静默改页码会使页码与服务端数据脱节（页变了但未重取）。
    // <en/> Re-read URL state on KeepAlive reactivation, ensuring pagination params sync after route
    // <en/> forward/back. Uses resync (with effect fan-out) instead of silent writes — the table has
    // <en/> already loaded data, and silently changing the page would desync it from server data.
    if (!isUnmounted) {
      resyncPaginationFromUrl()
    }
  })

  /**
   * <zh/> 统一生命周期清理——用 onScopeDispose 兜底，确保 scope 停止时 watch 被回收。
   * <zh/> onUnmounted 仍保留用于 abort 手动请求控制器和设置卸载标志。
   * <en/> Unified lifecycle cleanup — onScopeDispose as a safety net, ensuring the watch is reclaimed when the scope stops.
   * <en/> onUnmounted retained for aborting the manual-request controller and setting the unmount flag.
   */
  onScopeDispose(() => {
    stopLoadingWatch?.()
    stopLoadingWatch = null
  })

  onUnmounted(() => {
    stopLoadingWatch?.()
    stopLoadingWatch = null
    manualAbortController?.abort()
    isUnmounted = true
  })

  const { setPageLog, initFromUrl } = useUrlState(
    {
      enabled: urlStateEnabled,
      pageKey: urlStatePageKey,
      sizeKey: urlStateSizeKey,
    },
    isManual,
  )

  const pagination = useTablePagination(paginationOptions)

  // <zh/> 分页副作用归集至 ./pagination-effects。
  // <en/> Pagination effects live in ./pagination-effects; hoisted declarations make this reference safe.
  const {
    applyPaginationEffects,
    handleCurrentPageChange,
    handlePageSizeChange,
    handleLoadMore,
    dispose: disposePaginationEffects,
  } = createPaginationEffects<T>({
    pagination,
    responseData,
    total,
    hasSource,
    isManual,
    paginationOptions,
    setPageLog,
    emits,
    stopPolling,
    clearResponseData,
    fetchData,
    correctPage: setCurrentPageAndRefetch,
  })
  // <zh/> 裸调/无 scope 单测下 setup 自动释放不生效，显式接线 dispose | <en/> Explicit dispose for scopeless/manual usage where setup auto-disposal doesn't apply
  onScopeDispose(() => disposePaginationEffects(), true)

  /**
   * <zh/> 合并基础查询参数与自动注入的排序/筛选状态。
   * <zh/> request.autoParams 关闭（默认）时恒返回 searchParams 原样——零行为变化；
   * <zh/> 开启后附加 sort（[{ prop, order: 'asc'|'desc' }]，空态省略键）与 filter（原样透出，空对象省略键）。
   * <en/> Merge base query params with auto-attached sort/filter state.
   * <en/> When request.autoParams is off (default) returns searchParams as-is — zero behavior change;
   * <en/> when on, attaches `sort` ([{ prop, order: 'asc'|'desc' }], key omitted when empty)
   * <en/> and `filter` (raw state, key omitted when empty).
   */
  function buildRequestParams(): Record<string, unknown> {
    const base = { ...searchParams() }
    const cfg = autoParamsConfig?.()
    if (!cfg)
      return base

    const { sortKey = 'sort', filterKey = 'filter' } = typeof cfg === 'object' ? cfg : {}
    const sorts = (autoSortState?.() ?? [])
      .filter(s => s.order != null)
      .map((s) => {
        if (s.order === 'descending')
          return { prop: s.prop, order: 'desc' as const }
        if (s.order === 'ascending')
          return { prop: s.prop, order: 'asc' as const }
        devWarn(
          `[AdvTable] unknown sort order "${String(s.order)}" for column "${s.prop}" — falling back to 'asc'. | 未知排序方向"${String(s.order)}"，已回退为升序。`,
        )
        return { prop: s.prop, order: 'asc' as const }
      })
    if (sorts.length > 0)
      base[sortKey] = sorts

    const filters = autoFilterState?.()
    if (filters && Object.keys(filters).length > 0)
      base[filterKey] = filters

    return base
  }

  /**
   * <zh/> manual 模式请求：abort 旧请求、递增序号，并返回可等待的完成信号
   * <en/> Manual-mode request: abort previous, bump sequence, return an awaitable completion signal
   */
  function manualRequest(
    opts: { append: boolean, reason: TableRequestReason },
  ): { requestId: number, promise: Promise<T[]> } {
    manualAbortController?.abort()
    manualAbortController = new AbortController()
    const requestId = ++manualLatestRequestId
    const signal = manualAbortController.signal
    // <zh/> manual 下点亮 loading：回写/清空/卸载时复位，父忽略 signal 时仍有视觉反馈
    // <en/> Light up loading in manual mode; it resets on write-back / clear / unmount, so the UI still
    // <en/> reacts even when the parent ignores the abort signal
    setLoading(true)
    const promise = Promise.resolve(emits.request({
      page: pagination.currentPage.value,
      size: pagination.pageSize.value,
      params: buildRequestParams(),
      append: opts.append,
      reason: opts.reason,
      signal,
      requestId,
    }))
    return { requestId, promise }
  }

  /** <zh/> manual 模式请求完成守卫——旧序号响应直接丢弃 | <en/> Manual-mode completion guard — drop stale responses */
  function manualRequestSettled(requestId: number): boolean {
    return !isUnmounted && requestId === manualLatestRequestId
  }

  /**
   * <zh/> 数据回写守卫——remote/manual 回写应携带 requestId（旧序号直接丢弃，先发后到不覆盖新页）；
   * <zh/> 内部写回（拖拽重排/桥接）不带 requestId，直接生效。接受写入后复位 loading。
   *
   * <zh/> 写入路由与 `writeFullData` 同源：有 `request.source` 时写 responseData，无 source 时写
   * <zh/> `v-model:data` 模型——否则无 source 装配下写入 responseData 不会被 tableData 读取（静默丢失）。
   * <en/> Guarded data write-back — remote/manual write-backs should carry their requestId (stale ids
   * <en/> are dropped); internal write-backs (drag reorder/bridge) carry none and apply directly.
   * <en/> Resets loading when accepted.
   *
   * <en/> The write route matches `writeFullData`: with a `request.source` it writes responseData,
   * <en/> otherwise it writes the `v-model:data` model — writing responseData without a source would be
   * <en/> silently ignored by tableData.
   */
  function setResponseDataGuarded(newData: T[], requestId?: number): void {
    if (isUnmounted)
      return
    if (isManual.value && requestId !== undefined && requestId !== manualLatestRequestId)
      return
    // <zh/> manual 无 requestId 回写——乱序时旧响应可覆盖新页，仅 dev 告警不断行（存量调用不断），请透传 request 事件的 requestId
    // <en/> Manual write-back without requestId — a stale response may overwrite the new page under reorder; dev-warn only (existing calls keep working), please forward the requestId from the request event
    if (isManual.value && requestId === undefined && manualLatestRequestId > 0) {
      devWarn(
        '[AdvTable] setResponseData called without requestId in manual mode — stale responses may overwrite the new page under rapid paging. '
        + 'Please forward the requestId from the `request` event (getManualRequestId/isManualRequestSettled are exposed). | '
        + 'manual 模式 setResponseData 未传 requestId——快速翻页时旧响应可覆盖新页。请透传 `request` 事件的 requestId（已暴露 getManualRequestId/isManualRequestSettled）。',
      )
    }
    if (hasSource.value) {
      setResponseData(newData)
      return
    }
    emits.updateData(newData)
    if (isManual.value)
      setLoading(false)
  }

  /**
   * <zh/> manual 模式「父回写即结束加载」——manual 请求只通知不回流（见 use-data-domain 的 request 通道），
   * <zh/> 故消费侧复位点必须覆盖 `v-model:data` 通路：父组件按契约回写数据后即结束 loading。
   * <zh/> 缺少该复位时，infiniteScroll 的 loading 防重入守卫会永久早退（第二页永不加载）。
   *
   * <en/> Manual mode "parent write-back ends loading" — a manual request only notifies (see the request
   * <en/> channel in use-data-domain), so the consumer-side reset must also cover the `v-model:data` path:
   * <en/> loading ends as soon as the parent writes data back.
   * <en/> Without this reset the infinite-scroll re-entry guard short-circuits forever (page 2 never loads).
   */
  if (defaultData) {
    watch(defaultData, () => {
      if (isManual.value && !isUnmounted)
        setLoading(false)
    })
  }

  function fetchData(
    opts: {
      append?: boolean
      reason?: TableRequestReason
    } = {},
  ): Promise<T[] | null> {
    const append = opts.append ?? false
    const reason = opts.reason ?? 'refresh'

    if (isManual.value) {
      const { requestId, promise } = manualRequest({ append, reason })
      return promise
        .then((data) => {
          // <zh/> 过期响应返回 null 哨兵（与 useRequest 自动模式协议一致），
          // <zh/> 供调用方区分"被更新请求淘汰"与"服务端返回空页"。
          // <en/> Stale responses resolve with the null sentinel (same protocol as useRequest's auto mode),
          // <en/> letting callers distinguish "superseded by a newer request" from "genuinely empty page".
          if (!manualRequestSettled(requestId))
            return null
          return data
        })
        // <zh/> 失败只 rethrow、不上报——所有调用方（分页/搜索/排序筛选 refetch/初始加载）
        // <zh/> 均已自带 TABLE_REQUEST_FAILED 上报，此处再发即双发（同一错误两个 error 事件）。
        // <zh/> stale（被更新请求取代/停靠后 abort）的失败与成功路径对称，静默为 null 哨兵，
        // <zh/> 避免被取代请求的失败冒给调用方误报。
        // <en/> Failures only rethrow without reporting — every caller (pagination/search/
        // <en/> sort-filter refetch/initial load) already reports TABLE_REQUEST_FAILED itself;
        // <en/> emitting here dispatched the same error twice.
        // <en/> Stale failures (superseded, or aborted on deactivate) resolve to the null
        // <en/> sentinel like the success path, so superseded failures never false-report.
        .catch((err: unknown) => {
          if (!manualRequestSettled(requestId))
            return null
          throw err
        })
    }

    return request(
      pagination.currentPage.value,
      pagination.pageSize.value,
      append,
      buildRequestParams(),
    )
  }

  async function refresh(): Promise<void> {
    emits.refresh()
    if (isManual.value) {
      const { requestId, promise } = manualRequest({ append: false, reason: 'refresh' })
      try {
        await promise
      }
      catch (err) {
        // <zh/> 真实失败：此处统一上报（api.refresh 为 fire-and-forget 契约，调用方无 catch，
        // <zh/> rethrow 会变成 unhandled rejection 且无上报路径）。
        // <en/> Real failure: report here — api.refresh is fire-and-forget (callers don't catch),
        // <en/> rethrowing would produce an unhandled rejection with no reporting path.
        if (manualRequestSettled(requestId)) {
          emits.onError({
            code: 'TABLE_REQUEST_FAILED',
            severity: 'error',
            field: 'refresh',
            cause: err,
          })
        }
        return
      }
      // <zh/> 竞态失败（已被更新请求取代）静默返回——抛 AbortError 会成为 unhandled rejection
      // <en/> Stale (superseded by a newer request) — return silently; throwing AbortError
      // <en/> produces an unhandled rejection
      if (!manualRequestSettled(requestId))
        return
      // <zh/> manual 模式只走 request 事件通知 + 手动回写，不再落到自动 refreshRequest，
      // <zh/> 否则一次 refresh 同时触发父级请求与自动 source 请求（双发）。
      // <en/> Manual mode only emits the request event and waits for write-back; falling through to
      // <en/> refreshRequest would make one refresh fire both the parent request and the source request.
      return
    }
    /**
     * <zh/> 自动模式失败必须在此上报：`api.refresh` 为 fire-and-forget（调用方不 catch），底层
     * <zh/> `request` 在非取消/非被取代分支 rethrow，而本链路未注入 `onError`——不上报即
     * <zh/> 0 个 error 事件 + unhandled rejection（手动分支已在上方对称上报）。
     * <zh/> 无需区分取消：取消与被取代路径（use-request 的 return null 分支）不抛错。
     * <en/> Auto-mode failures must be reported here: `api.refresh` is fire-and-forget (callers do not
     * <en/> catch), the underlying `request` rethrows on non-cancelled / non-superseded failures, and this
     * <en/> chain injects no `onError` — otherwise the failure yields zero events plus an unhandled
     * <en/> rejection (the manual branch above already reports symmetrically).
     * <en/> No cancellation branch is needed: cancelled and superseded paths resolve null instead of throwing.
     */
    try {
      await refreshRequest(pagination.currentPage.value, pagination.pageSize.value, buildRequestParams())
    }
    catch (err) {
      emits.onError({
        code: 'TABLE_REQUEST_FAILED',
        severity: 'error',
        field: 'refresh',
        cause: err,
      })
    }
  }

  function stopPolling() {
    isPolling.value = false
  }

  function setIsPolling(val: boolean) {
    isPolling.value = val
  }

  function reorderData(rows: T[]) {
    // <zh/> 先快照旧数据再交给事务——"先写后发"使 dataChange 处理器读到的
    // <zh/> models.data 已是新数组（oldData === newData），rollbackLast 回滚无效、
    // <zh/> beforeDataChange/afterDataChange 拿到的旧数据失真。写入动作移交事务 writeFn，
    // <zh/> beforeDataChange 否决才能真正回滚。
    // <en/> Snapshot old data BEFORE handing off to the transaction — the
    // <en/> "write-then-emit" order makes models.data already point at the new array when the
    // <en/> dataChange handler reads it (oldData === newData), so rollbackLast is a no-op and
    // <en/> beforeDataChange/afterDataChange receive a distorted snapshot. The write itself
    // <en/> moves into the transaction's writeFn so a beforeDataChange veto genuinely rolls back.
    const oldData = hasSource.value
      ? [...(responseData.value ?? [])]
      : [...(defaultData?.() ?? [])]
    // <zh/> 内建事务提交（生产装配）：写路由与桥接 'full' 分支同源，无晚绑定 holder
    // <en/> Built-in transaction commit (production assembly): shares the write route with the bridge 'full' branch, no late-bound holder
    if (dataChangeCommit) {
      const { dataTransaction, writeModel } = dataChangeCommit
      void dataTransaction.executeTransaction(
        'drag',
        oldData,
        rows,
        (newData) => {
          writeFullData(
            {
              hasSource: () => hasSource.value,
              setResponseData,
              writeModel,
            },
            newData,
          )
        },
      )
      return
    }
    emits.dataChange?.({ reason: 'drag', data: rows, oldData })
  }

  /**
   * <zh/> 从 URL 状态同步分页参数的公共函数——消除 onBeforeMount 与 onActivated 中的重复 | <en/> Common function to sync pagination params from URL state — eliminates duplication between onBeforeMount and onActivated
   *
   * <zh/> 静默写入，仅用于 onBeforeMount 初始同步——首请求在 onMounted 统一发起，
   * <zh/> 此处若走副作用扇出会与初始请求重复（双发 fetch / 双发 pageChange）。
   * <en/> Silent write, only for the onBeforeMount initial sync — the first request fires once in
   * <en/> onMounted; fanning out effects here would duplicate it (double fetch / double pageChange).
   */
  function syncPaginationFromUrl(): void {
    const { page: p, size: s } = initFromUrl()
    if (p)
      pagination.currentPage.value = p
    if (s)
      pagination.pageSize.value = s
  }

  /**
   * <zh/> KeepAlive 重新激活时的 URL 分页同步——带副作用扇出。
   * <zh/> page/size 任一变化时合成一次分页变更结果走 applyPaginationEffects
   * <zh/>（URL 记录 + pageChange 事件 + 服务端重取）；两者同变仅扇出一次，避免双发请求；
   * <zh/> 均无变化时零操作，不产生多余请求与事件。
   * <en/> URL pagination sync on KeepAlive reactivation — with effect fan-out.
   * <en/> When page and/or size changed, synthesizes one pagination-change result through
   * <en/> applyPaginationEffects (URL log + pageChange emit + server refetch); simultaneous
   * <en/> page+size changes fan out exactly once to avoid double requests; no change means no-op.
   */
  function resyncPaginationFromUrl(): void {
    const { page: p, size: s } = initFromUrl()
    const sizeChanged = !!s && s !== pagination.pageSize.value
    const pageChanged = !!p && p !== pagination.currentPage.value
    if (!sizeChanged && !pageChanged)
      return
    if (sizeChanged)
      pagination.pageSize.value = s
    if (pageChanged)
      pagination.currentPage.value = p
    applyPaginationEffects({
      page: pagination.currentPage.value,
      size: pagination.pageSize.value,
      reason: 'pageChange',
      isClient: pagination.isClient.value,
      needsReset: sizeChanged,
    })
  }

  onBeforeMount(() => {
    const defaultSize = defaultPageSize?.()
    if (defaultSize)
      pagination.pageSize.value = defaultSize
    syncPaginationFromUrl()
  })

  onMounted(() => {
    if (hasSource.value && requestAuto() && !isManual.value) {
      nextTick(() => {
        if (isUnmounted)
          return
        fetchData({ reason: 'initial' })
          .catch((err: unknown) => {
            emits.onError({
              code: 'TABLE_REQUEST_FAILED',
              severity: 'error',
              field: 'initial',
              cause: err,
            })
          })
      })
    }
  })

  /**
   * <zh/> 数据源**运行时切换**（切换租户 / 门店 / 查询通道，或数据源异步就绪后由 undefined 变为函数）：
   * <zh/> 回到第 1 页并自动重取。
   *
   * <zh/> 跳过条件与首次加载保持一致：manual 模式由父组件驱动、`auto: false` 表示调用方自控请求时机。
   * <zh/> 置页码用**纯状态** setter（`pagination.setCurrentPage`），避免与本次 fetchData 叠加成两次请求。
   *
   * <en/> Runtime data-source switch (tenant / store / endpoint, or a source that becomes ready
   * <en/> asynchronously after being `undefined`): return to page 1 and refetch.
   *
   * <en/> Previously only the mount-time `onMounted` load existed, so after switching `request.source`
   * <en/> the table kept showing the old source's rows (and the page number could be out of range for the
   * <en/> new result set); an asynchronously-ready source was never loaded at all.
   * <en/> Skip conditions mirror the initial load: manual mode is parent-driven and `auto: false` means
   * <en/> the caller controls request timing. The page reset uses the **pure state** setter
   * <en/> (`pagination.setCurrentPage`) so it does not stack a second request on top of this fetchData.
   */
  watch(requestSource, (next, prev) => {
    if (next === prev)
      return
    // <zh/> 数据源移除：中止飞行请求并清空残留旧数据，避免显示旧源行
    // <en/> Data source removed: abort the in-flight request and clear leftover rows so no stale source renders
    if (next == null) {
      manualAbortController?.abort()
      manualAbortController = null
      manualLatestRequestId++
      clearResponseData()
      setLoading(false)
      pagination.setCurrentPage(1)
      return
    }
    if (isUnmounted || isManual.value || !requestAuto())
      return
    pagination.setCurrentPage(1)
    void fetchData({ reason: 'sourceChange' })
      .catch((err: unknown) => {
        emits.onError({
          code: 'TABLE_REQUEST_FAILED',
          severity: 'error',
          field: 'sourceChange',
          cause: err,
        })
      })
  })

  function getPagination() {
    return {
      currentPage: pagination.currentPage.value,
      pageSize: pagination.pageSize.value,
      total: pagination.paginationTotal.value,
    }
  }

  function getFullData(): T[] {
    return [...tableData.value]
  }

  function setCurrentPageAndRefetch(page: number) {
    const result = pagination.setCurrentPage(page)
    applyPaginationEffects(result)
  }

  function setPageSizeAndRefetch(size: number) {
    const result = pagination.setPageSize(size)
    applyPaginationEffects(result)
  }

  return {
    responseData,
    loading: localLoading,
    total,
    hasSource,
    isPolling,
    pagination,
    tableData,
    rowKeyMeta,

    refresh,
    fetchData,
    setLoading,
    setResponseData: setResponseDataGuarded,
    getManualRequestId: () => manualLatestRequestId,
    isManualRequestSettled: manualRequestSettled,
    clearResponseData,
    stopPolling,
    setIsPolling,
    reorderData,
    handleCurrentPageChange,
    handlePageSizeChange,
    handleLoadMore,
    getPagination,
    setCurrentPageAndRefetch,
    setPageSizeAndRefetch,
    getFullData,
  }
}
