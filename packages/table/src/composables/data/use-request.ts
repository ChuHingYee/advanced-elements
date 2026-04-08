import type { Ref } from 'vue'
import type { DataSource, FormatMaps, ResponseData } from '../../types'
import { computed, getCurrentInstance, getCurrentScope, onActivated, onBeforeUnmount, onDeactivated, onScopeDispose, shallowRef } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { parseResponseData } from '../../utils/format-response'
import { sanitizeDataArray } from '../../utils/security'

/**
 * <zh/> 请求模式
 * <en/> Request mode
 * @remarks
 * <zh/> - 'paginated': 带分页的请求
 * <zh/> - 'simple': 简单请求
 * <en/> - 'paginated': paginated request
 * <en/> - 'simple': simple request
 */
export type RequestMode = 'paginated' | 'simple'

export type TransformResponseResult<T = any> = ResponseData<T> | T[]

/**
 * <zh/> 判断错误是否为请求取消——兼容原生 fetch（DOMException AbortError）、
 * <zh/> axios（CanceledError / ERR_CANCELED）以及业务侧自定义封装的取消异常。
 * <zh/> 不能仅凭 signal.aborted 判断：超时路径同样会 abort，但必须以真实错误抛出。
 * <en/> Whether an error is a cancellation — covers native fetch (DOMException AbortError),
 * <en/> axios (CanceledError / ERR_CANCELED), and custom cancel wrappers.
 * <en/> Cannot decide by signal.aborted alone: the timeout path also aborts but must surface as a real error.
 */
function isCancelledError(error: unknown): boolean {
  if (!error || typeof error !== 'object')
    return false
  const err = error as { name?: string, code?: string }
  return err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED'
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    let id: ReturnType<typeof setTimeout>
    const onAbort = () => {
      clearTimeout(id)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * <zh/> 超时错误——与取消错误区分：超时 abort 共享 signal 后仍可重试，取消则直接抛出
 * <en/> Timeout error — distinct from cancellation: a timed-out attempt remains retryable
 */
function createTimeoutError(timeout: number): Error {
  const err = new Error(`[AdvTable] Request timed out after ${timeout}ms`)
  ;(err as unknown as { code: string, name: string }).code = 'TIMEOUT'
  ;(err as unknown as { name: string }).name = 'TimeoutError'
  return err
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object')
    return false
  const err = error as { code?: string, name?: string }
  return err.code === 'TIMEOUT' || err.name === 'TimeoutError'
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

function normalizeRetryConfig(opts: UseRequestOptions<any>): UseRequestRetryOptions & { count: number, delay: number, backoffFactor: number, maxDelay: number } {
  const raw = opts.retries
  const count = typeof raw === 'number' ? raw : (raw?.count ?? 0)
  const delayRaw = typeof raw === 'number' ? (opts.retryDelay ?? 300) : (raw?.delay ?? opts.retryDelay ?? 300)
  const backoffRaw = typeof raw === 'number' ? (opts.retryBackoffFactor ?? 2) : (raw?.backoffFactor ?? opts.retryBackoffFactor ?? 2)
  const maxDelayRaw = typeof raw === 'number' ? (opts.retryMaxDelay ?? 5000) : (raw?.maxDelay ?? opts.retryMaxDelay ?? 5000)
  const retryOn = typeof raw === 'number' ? (opts.retryOn) : (raw?.retryOn ?? opts.retryOn)
  return {
    count: Math.max(0, Math.floor(normalizePositiveNumber(count, 0))),
    delay: normalizePositiveNumber(delayRaw, 300),
    // <zh/> backoffFactor 允许 0（固定零间隔）——不得再用 `|| 2` 吞掉合法的 0
    // <en/> backoffFactor may legitimately be 0 (fixed zero delay) — do NOT swallow it with `|| 2`
    backoffFactor: normalizePositiveNumber(backoffRaw, 2),
    maxDelay: normalizePositiveNumber(maxDelayRaw, 5000),
    retryOn,
  }
}

/**
 * <zh/> useRequest 的配置选项
 * <en/> useRequest configuration options
 */
export interface UseRequestRetryOptions {
  /** <zh/> 重试次数（默认 0 不重试） | <en/> Retry count (default 0) */
  count?: number
  /** <zh/> 基础延迟（毫秒），默认 300 | <en/> Base delay in ms, default 300 */
  delay?: number
  /** <zh/> 指数退避因子（默认 2，delay * factor^attempt） | <en/> Exponential backoff factor (default 2) */
  backoffFactor?: number
  /** <zh/> 最大延迟（毫秒），默认 5000 | <en/> Max delay in ms, default 5000 */
  maxDelay?: number
  /** <zh/> 是否重试判定（默认仅重试非取消错误） | <en/> Whether to retry predicate (default: non-cancelled errors only) */
  retryOn?: (error: unknown) => boolean
}

export interface UseRequestOptions<T = any> {
  /** <zh/> 数据源函数，接收请求参数和 AbortSignal，返回 Promise | <en/> Data source function, receives request params and AbortSignal, returns Promise */
  dataSource?: DataSource<T>
  /** <zh/> 是否在组件挂载时自动发起首次请求，默认为 true | <en/> Whether to auto-send initial request on mount, defaults to true */
  auto?: boolean
  /** <zh/> 请求模式，'paginated' 表示分页请求，'simple' 表示简单请求 | <en/> Request mode, 'paginated' for paginated request, 'simple' for simple request */
  requestMode?: RequestMode
  /** <zh/> 响应数据格式化映射 | <en/> Response data format mapping */
  formatMaps?: FormatMaps
  /** <zh/> 分页参数字段名映射 | <en/> Pagination param field name mapping */
  paramKeys?: { page?: string, size?: string }
  /** <zh/> 请求参数转换函数，在发送请求前对参数做自定义处理 | <en/> Request param transform function, custom processing before sending request */
  transformRequest?: (
    page: number,
    size: number,
    params: Record<string, unknown>,
  ) => Record<string, unknown>
  /** <zh/> 响应数据转换函数，将原始响应转换为标准格式 | <en/> Response data transform function, converts raw response to standard format */
  transformResponse?: (response: unknown) => TransformResponseResult<T>
  /** <zh/> 请求出错时的回调函数 | <en/> Callback on request error */
  onError?: (error: Error) => void
  /**
   * <zh/> 响应畸形回调——后端字段与 formatMaps 对不上、按空表处理时调用，调用方据此派发 TABLE_RESPONSE_MALFORMED
   * <en/> Malformed-response hook — called when backend fields mismatch formatMaps and are treated as empty
   */
  onMalformed?: (info: { dataKey: string, hasDataKey: boolean, isDataArray: boolean }) => void
  /** <zh/> 请求超时时间（毫秒），0 表示不设置超时 | <en/> Request timeout in milliseconds, 0 means no timeout */
  timeout?: number
  /** <zh/> 重试次数或完整重试配置 | <en/> Retry count or full retry config */
  retries?: number | UseRequestRetryOptions
  /** <zh/> 重试基础延迟（当 retries 为 number 时生效，默认 300） | <en/> Base retry delay when retries is a number, default 300 */
  retryDelay?: number
  /** <zh/> 指数退避因子（默认 2） | <en/> Exponential backoff factor (default 2) */
  retryBackoffFactor?: number
  /** <zh/> 最大重试延迟（默认 5000） | <en/> Max retry delay (default 5000) */
  retryMaxDelay?: number
  /** <zh/> 是否重试判定 | <en/> Retry predicate */
  retryOn?: (error: unknown) => boolean
}

/**
 * <zh/> useRequest 的返回值 | <en/> useRequest return value
 */
export interface UseRequestReturn<T = any> {
  data: Ref<T[]>
  loading: Ref<boolean>
  total: Ref<number>
  hasSource: Ref<boolean>
  /**
   * <zh/> 请求数据 | <en/> Request data
   * @param page - <zh/> 页码 | <en/> page number
   * @param size - <zh/> 每页条数 | <en/> page size
   * @param append - <zh/> 是否追加数据 | <en/> whether to append data
   * @param params - <zh/> 额外参数 | <en/> extra parameters
   * @returns <zh/> 数据数组；请求被取消/被更新请求取代时返回 null | <en/> data array, or null when the request is cancelled/superseded
   */
  request: (
    page: number,
    size: number,
    append?: boolean,
    params?: Record<string, unknown>,
  ) => Promise<T[] | null>
  /** <zh/> 刷新数据（等价 `request(page, size, false, params)`） | <en/> Refresh — alias of `request(page, size, false, params)` */
  refresh: (page: number, size: number, params?: Record<string, unknown>) => Promise<T[] | null>
  /**
   * <zh/> 设置加载状态 | <en/> Set loading state
   * @param flag - <zh/> 加载标志 | <en/> loading flag
   */
  setLoading: (flag: boolean) => void
  /** <zh/> 直接设置数据（用于拖拽重排等外部更新） | <en/> Set data directly (for external updates like drag reorder) */
  setData: (newData: T[]) => void
  clearData: () => void
  /**
   * <zh/> 获取当前请求的 AbortSignal | <en/> Get the AbortSignal of the current request
   * @returns <zh/> 当前 AbortController 的 signal，无活跃请求时返回 undefined | <en/> current AbortController's signal, or undefined if no active request
   */
  getSignal: () => AbortSignal | undefined
}

/**
 * <zh/> 请求管理 composable | <en/> Request management composable
 *
 * <zh/> 封装数据获取、AbortController 取消、超时与响应格式化 | <en/> Encapsulates data fetching, AbortController cancellation, timeout, and response formatting
 *
 * @param options - <zh/> 请求配置 | <en/> request configuration
 * @returns <zh/> 请求状态、数据引用与控制方法 | <en/> request state, data refs, and control methods
 */
export function useRequest<T = any>(
  options: UseRequestOptions<T> | (() => UseRequestOptions<T>),
): UseRequestReturn<T> {
  const opts = computed<UseRequestOptions<T>>((prev) => {
    const resolvedOptions = typeof options === 'function' ? options() : options
    if (prev
      && prev.dataSource === resolvedOptions.dataSource
      && prev.auto === resolvedOptions.auto
      && prev.requestMode === resolvedOptions.requestMode
      && prev.formatMaps === resolvedOptions.formatMaps
      && prev.paramKeys === resolvedOptions.paramKeys
      && prev.transformRequest === resolvedOptions.transformRequest
      && prev.transformResponse === resolvedOptions.transformResponse
      && prev.onError === resolvedOptions.onError
      && prev.onMalformed === resolvedOptions.onMalformed
      && prev.timeout === resolvedOptions.timeout
      && prev.retries === resolvedOptions.retries
      && prev.retryDelay === resolvedOptions.retryDelay
      && prev.retryBackoffFactor === resolvedOptions.retryBackoffFactor
      && prev.retryMaxDelay === resolvedOptions.retryMaxDelay
      && prev.retryOn === resolvedOptions.retryOn) {
      return prev
    }
    return resolvedOptions
  })

  const data = shallowRef<T[]>([]) as Ref<T[]>
  const loading = shallowRef(false)
  const total = shallowRef(0)
  const hasSource = computed(() => !!opts.value.dataSource)

  let disposed = false
  let active = true
  let latestRequestId = 0
  let abortController: AbortController | null = null
  let inFlightPromise: Promise<unknown> | null = null

  /**
   * <zh/> 活跃的超时定时器集合——新请求开始或数据被外部覆写时统一清扫。
   * <zh/> 防止过期定时器在闭包中长期悬挂并引用已失效的 AbortController。
   * <en/> Set of armed timeout timers — swept when a new request begins or data is overwritten externally.
   * <en/> Prevents stale timers from dangling in closures holding defunct AbortControllers.
   */
  const pendingTimeoutIds = new Set<ReturnType<typeof setTimeout>>()

  function disarmTimeout(id: ReturnType<typeof setTimeout> | null): void {
    if (id != null) {
      clearTimeout(id)
      pendingTimeoutIds.delete(id)
    }
  }

  /**
   * <zh/> 清扫所有未触发的超时定时器（请求已被取代时调用，定时器即使触发也只会
   * <zh/> 中止各自捕获的旧控制器并拒绝已被隔离的 promise，清扫仅为及时释放句柄）。
   * <en/> Sweep all unarmed timers (called when requests are superseded). A fired timer would only
   * <en/> abort its own captured controller and reject an already-quarantined promise;
   * <en/> sweeping merely releases handles promptly.
   */
  function sweepTimeouts(): void {
    for (const id of pendingTimeoutIds)
      clearTimeout(id)
    pendingTimeoutIds.clear()
  }

  function setLoading(flag: boolean) {
    loading.value = flag
  }

  function cancelRequest() {
    latestRequestId += 1
    const controller = abortController
    abortController = null
    sweepTimeouts()
    if (inFlightPromise) {
      inFlightPromise.catch(() => {})
      inFlightPromise = null
    }
    setLoading(false)
    controller?.abort()
  }

  function beginRequest() {
    cancelRequest()
    abortController = new AbortController()
    setLoading(true)
    return latestRequestId
  }

  function isRequestCancelled(requestId: number): boolean {
    return requestId !== latestRequestId
  }

  function finishRequest(requestId: number) {
    if (requestId === latestRequestId) {
      setLoading(false)
    }
  }

  async function request(
    page: number,
    size: number,
    append = false,
    params: Record<string, unknown> = {},
  ): Promise<T[] | null> {
    if (disposed || !active)
      return null
    const dataSource = opts.value.dataSource
    if (!dataSource) {
      return []
    }

    const requestId = beginRequest()
    const currentOpts = opts.value
    /**
     * <zh/> 不变量：捕获本次请求"自己的"控制器。
     * <zh/> 超时回调禁止读取模块级可变变量 abortController——若本次请求挂起期间又发起新请求
     * <zh/>（beginRequest 已替换该变量），过期定时器会错误中止"新"请求的控制器，
     * <zh/> 新请求被归类为 cancelled 而静默吞掉（无数据、无错误、loading 复位）。
     * <en/> Invariant: capture THIS request's own controller. The timeout callback must not read the
     * <en/> module-level mutable `abortController` — if a newer request begins while this one is
     * <en/> pending (beginRequest replaces it), the stale timer aborts the NEW controller, and the
     * <en/> new request is silently swallowed as "cancelled" (no data, no error, loading resolved).
     */
    const ownController = abortController!
    const signal = ownController.signal
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const retryCfg = normalizeRetryConfig(currentOpts)

    try {
      const currentMode: RequestMode = opts.value.requestMode ?? 'paginated'
      // <zh/> 分页键为框架保留命名空间——searchParams 同名键视为冲突，分页值优先并告警（而非静默覆盖任一边）
      // <en/> Pagination keys are framework-reserved — same-named searchParams keys collide, pagination wins with a warning (instead of silently overriding either side)
      const pageKey = currentOpts.paramKeys?.page ?? 'page'
      const sizeKey = currentOpts.paramKeys?.size ?? 'size'
      if (currentMode === 'paginated' && (pageKey in params || sizeKey in params)) {
        devWarn(
          `[AdvTable] searchParams key "${pageKey in params ? pageKey : sizeKey}" collides with pagination paramKeys — pagination values take precedence. Rename the search field. | `
          + `searchParams 中的键与分页参数键冲突，已按分页值优先处理。请重命名搜索字段。`,
        )
      }
      const reqParams = currentOpts.transformRequest
        ? currentOpts.transformRequest(page, size, params)
        : currentMode === 'paginated'
          ? { ...params, [pageKey]: page, [sizeKey]: size }
          : { ...params }

      let attempt = 0
      while (true) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }
        // <zh/> 单次尝试（含超时） | <en/> Single attempt (with timeout)
        let res: unknown
        try {
          const resPromise = dataSource(reqParams, signal)
          const timeout = currentOpts.timeout ?? 0
          const isPromise = resPromise != null && typeof (resPromise as unknown as Promise<unknown>).then === 'function'
          const wrappedPromise = (timeout > 0 && isPromise)
            ? Promise.race([
                resPromise as Promise<unknown>,
                new Promise<never>((_resolve, reject) => {
                  timeoutId = setTimeout(() => {
                    // <zh/> 先拒绝后 abort：race 由首个拒绝赢，超时 Error 必须先入队，否则 abort 触发的
                    // <zh/> AbortError 会抢赢竞态，超时被误判为取消而静默吞掉（回归测试：aborts...fires）
                    // <zh/> 还有重试次数时不 abort 共享 signal（否则 signal 永久 aborted，下次循环即判取消）
                    // <en/> Reject-then-abort: the race is won by the first rejection, so the timeout
                    // <en/> error must enqueue first; abort only when no retries remain
                    const timeoutErr = createTimeoutError(timeout)
                    reject(timeoutErr)
                    if (attempt >= retryCfg.count)
                      ownController.abort()
                  }, timeout)
                  pendingTimeoutIds.add(timeoutId)
                }),
              ])
            : resPromise

          if (wrappedPromise && typeof (wrappedPromise as unknown as Promise<unknown>).then === 'function') {
            inFlightPromise = wrappedPromise as Promise<unknown>
          }
          res = await Promise.resolve(wrappedPromise)
          disarmTimeout(timeoutId)
          timeoutId = null
          if (!isRequestCancelled(requestId))
            inFlightPromise = null
        }
        catch (err) {
          disarmTimeout(timeoutId)
          timeoutId = null
          if (!isRequestCancelled(requestId))
            inFlightPromise = null
          // <zh/> 超时错误走重试通道（即使共享 signal 已被最终次 abort，也不按取消吞掉）
          // <en/> Timeout errors go through the retry channel even if the shared signal was aborted
          const timeoutErr = isTimeoutError(err)
          // <zh/> 取消错误不重试 | <en/> Cancelled errors are not retried
          if (!timeoutErr && (isCancelledError(err) || isRequestCancelled(requestId) || signal.aborted)) {
            throw err
          }
          const shouldRetry = retryCfg.retryOn ? retryCfg.retryOn(err) : true
          if (attempt >= retryCfg.count || !shouldRetry) {
            throw err
          }
          const delay = Math.min(retryCfg.delay * retryCfg.backoffFactor ** attempt, retryCfg.maxDelay)
          attempt++
          await sleep(delay, signal)
          continue
        }

        if (isRequestCancelled(requestId) || signal.aborted)
          return null

        // <zh/> 成功分支：解析响应 | <en/> Success path: parse response
        // <zh/> 非法响应生产可观测——未用 transformResponse 且源非空、目标键缺失/非数组时经 onMalformed 上报（调用方映射为 TABLE_RESPONSE_MALFORMED）
        // <en/> observable malformed responses — without transformResponse, a non-empty source with a missing/non-array key reports via onMalformed.
        if (!currentOpts.transformResponse && res != null && typeof res === 'object' && !Array.isArray(res)) {
          const dataKey = currentOpts.formatMaps?.data ?? 'data'
          const raw = (res as Record<string, unknown>)[dataKey]
          if ((!(dataKey in (res as Record<string, unknown>)) || !Array.isArray(raw)) && Object.keys(res as Record<string, unknown>).length > 0) {
            try {
              currentOpts.onMalformed?.({ dataKey, hasDataKey: dataKey in (res as Record<string, unknown>), isDataArray: Array.isArray(raw) })
            }
            catch {
              // <zh/> 上报通道异常不影响数据链路 | <en/> Report-channel errors must not break the data path
            }
          }
        }
        const transformedResponse: TransformResponseResult<T> = currentOpts.transformResponse
          ? currentOpts.transformResponse(res)
          : parseResponseData(
              res as Record<string, unknown>,
              currentOpts.formatMaps ?? { data: 'data', total: 'total' },
            )
        const fmt: ResponseData<T> = Array.isArray(transformedResponse)
          ? { data: transformedResponse, total: transformedResponse.length }
          : transformedResponse

        if (isRequestCancelled(requestId)) {
          return null
        }

        const safeData = sanitizeDataArray(fmt.data as unknown as Record<string, unknown>[]) as unknown as T[]

        total.value = fmt.total
        data.value = append ? [...data.value, ...safeData] : safeData
        return data.value
      }
    }
    catch (error) {
      disarmTimeout(timeoutId)
      timeoutId = null
      if (isCancelledError(error)) {
        return null
      }
      if (!isRequestCancelled(requestId)) {
        currentOpts.onError?.(error as Error)
        throw error
      }
      return null
    }
    finally {
      disarmTimeout(timeoutId)
      finishRequest(requestId)
    }
  }

  async function refresh(
    page: number,
    size: number,
    params: Record<string, unknown> = {},
  ): Promise<T[] | null> {
    return request(page, size, false, params)
  }

  function setData(newData: T[]) {
    cancelRequest()
    // <zh/> 中止进行中的请求后必须重置 loading，否则 setData 在请求进行中调用时 loading 永久卡死
    // <en/> Reset loading after aborting the in-flight request, otherwise setData during a request leaves loading stuck forever
    loading.value = false
    data.value = newData
  }

  function clearData() {
    /**
     * <zh/> 与 `setData` 对齐：中止进行中的请求后再清空。
     * <zh/> 约束：仅递增 requestId 并清扫超时定时器而不 abort 控制器时，
     * <zh/> 清空数据后网络请求仍在飞行，其响应虽被 requestId 隔离丢弃，
     * <zh/> 但连接与回调会悬挂到请求自然结束，造成无谓的资源占用。
     * <en/> Aligned with `setData`: abort the in-flight request before clearing.
     * <en/> Invariant: incrementing only the requestId and sweeping timers without aborting the
     * <en/> controller leaves the request flying after the data is cleared. Its response is still
     * <en/> discarded via the requestId guard, but the connection and callback linger until the
     * <en/> request finishes naturally, wasting resources.
     */
    cancelRequest()
    data.value = []
    total.value = 0
  }

  function dispose() {
    if (disposed)
      return
    disposed = true
    active = false
    cancelRequest()
  }

  if (getCurrentScope())
    onScopeDispose(dispose)

  if (getCurrentInstance()) {
    onBeforeUnmount(dispose)
    onDeactivated(() => {
      active = false
      cancelRequest()
    })
    onActivated(() => {
      if (!disposed)
        active = true
    })
  }

  function getSignal(): AbortSignal | undefined {
    return abortController?.signal
  }

  return {
    data,
    loading,
    total,
    hasSource,
    request,
    refresh,
    setLoading,
    setData,
    clearData,
    getSignal,
  }
}
