import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { SortState } from '../../types/sort'
import type { SortPlan } from './sort-plan'
import { getCurrentScope, onScopeDispose, shallowRef, toValue } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { createSortWorkerFromBlob } from '../../utils/worker-blob'

export interface SortWorkerSchedulerDeps<T> {
  data: MaybeRefOrGetter<T[]>
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  sortState: Ref<SortState[]>
  getDataVersion: () => number
  sortWorkerThreshold: number
  sortWorkerMinEntries: number
  sortWorkerTimeout: number
  onSortWorkerError?: (error: Error) => void
  buildSortEntries: (
    sorts: SortState[],
    cols: ProcessedColumn[],
    prebuiltColMap?: Map<string, ProcessedColumn>,
  ) => SortPlan<T>
  computeSortedData: () => { data: T[], isSorted: boolean }
}

export interface SortWorkerSchedulerReturn<T = any> {
  workerResult: ShallowRef<{ data: T[], isSorted: boolean } | null>
  getWorkerResult: () => { data: T[], isSorted: boolean } | null
  isWorkerSorting: ShallowRef<boolean>
  isWorkerAvailable: () => boolean
  requestWorkerSort: (prebuiltColMap?: Map<string, ProcessedColumn>, prebuiltPlan?: SortPlan<T>) => void
  shouldUseWorker: (prebuiltColMap?: Map<string, ProcessedColumn>, prebuiltPlan?: SortPlan<T>) => boolean
  abortInFlight: () => void
  /**
   * <zh/> 挂起在飞请求但保留 Worker 实例（KeepAlive deactivate 用；恢复时可直接复用）
   * <en/> Suspend in-flight work but keep the Worker instance (for KeepAlive deactivate; reusable on activate)
   */
  suspend: () => void
  dispose: () => void
}

/**
 * <zh/> 排序 Worker 调度器工厂——按数据量阈值将排序卸载到 Web Worker，含请求代次、超时降级与结果复用，Worker 不可用时回退主线程。
 * <en/> Sort worker scheduler factory — offloads sorting to a Web Worker above size thresholds with request
 * <en/> generation, timeout fallback and result reuse; degrades to main-thread sorting when the worker is unavailable.
 *
 * @param deps - <zh/> 数据/列/排序状态与主线程排序回退依赖 | <en/> Deps on data/columns/sort state and the main-thread sort fallback
 * @returns <zh/> Worker 排序结果、状态与请求/中止/释放方法 | <en/> Worker sort result, status and request/abort/dispose methods
 */
export function createSortWorkerScheduler<T>(deps: SortWorkerSchedulerDeps<T>): SortWorkerSchedulerReturn<T> {
  let sortWorker: Worker | null = null
  let sortRequestId = 0
  let workerAvailable = true
  let sortTimeoutId: ReturnType<typeof setTimeout> | null = null
  let workerInFlight = false
  let workerDataVersion = -1
  let workerSource: T[] | null = null
  let resultSource: T[] | null = null
  let resultVersion = -1
  const workerResult = shallowRef<{ data: T[], isSorted: boolean } | null>(null)
  const isWorkerSorting = shallowRef(false)

  function clearTimer() {
    if (sortTimeoutId != null) {
      clearTimeout(sortTimeoutId)
      sortTimeoutId = null
    }
  }

  function terminateWorker() {
    if (sortWorker) {
      sortWorker.onmessage = null
      sortWorker.onerror = null
      sortWorker.terminate()
      sortWorker = null
    }
  }

  function abortInFlight() {
    clearTimer()
    sortRequestId++
    workerInFlight = false
    workerDataVersion = -1
    workerSource = null
    resultSource = null
    resultVersion = -1
    workerResult.value = null
    isWorkerSorting.value = false
  }

  function fail(error?: Error) {
    abortInFlight()
    terminateWorker()
    deps.onSortWorkerError?.(error ?? new Error('Sort worker failed'))
  }

  function initWorker(): Worker | null {
    if (sortWorker)
      return sortWorker
    try {
      sortWorker = createSortWorkerFromBlob()
    }
    catch (error) {
      workerAvailable = false
      fail(error instanceof Error ? error : new Error('Sort worker creation failed (Blob rejected)'))
      if (isDev) {
        devWarn('[AdvTable] Sort Worker creation failed (Blob rejected). Falling back to main-thread synchronous sorting.')
      }
      return null
    }
    const worker = sortWorker
    worker.onmessage = (e: MessageEvent<{ sortedIndices: number[], requestId: number }>) => {
      const { sortedIndices, requestId } = e.data
      if (worker !== sortWorker || !workerInFlight || requestId !== sortRequestId)
        return
      clearTimer()
      workerInFlight = false
      const rows = toValue(deps.data)
      if (workerDataVersion !== deps.getDataVersion() || workerSource !== rows) {
        workerSource = null
        if (shouldUseWorker())
          requestWorkerSort()
        else
          abortInFlight()
        return
      }
      if (sortedIndices.length !== rows.length
        || sortedIndices.some(i => !Number.isInteger(i) || i < 0 || i >= rows.length)) {
        fail(new Error('Sort worker returned invalid indices'))
        return
      }
      resultSource = rows
      resultVersion = workerDataVersion
      workerSource = null
      workerResult.value = { data: sortedIndices.map(i => rows[i]), isSorted: true }
      isWorkerSorting.value = false
    }
    worker.onerror = (e: ErrorEvent) => {
      if (worker === sortWorker)
        fail(new Error(`Sort worker runtime error: ${e.message || 'unknown'}`))
    }
    return worker
  }

  function requestWorkerSort(prebuiltColMap?: Map<string, ProcessedColumn>, prebuiltPlan?: SortPlan<T>): void {
    // <zh/> 在飞期间收到新请求：立即取消旧请求（旧结果经 requestId 丢弃）并发出最新请求，
    // <zh/> 同时清空 workerResult 避免重排期间返回陈旧结果；Worker 内部消息排队串行，旧消息处理完后
    // <zh/> 新消息即刻开始。
    // <en/> A new request while one is in flight: abort the old one (its result is dropped via
    // <en/> requestId) and issue the latest immediately; workerResult is cleared so re-sorting
    // <en/> never serves a stale result. The worker queues messages serially, so the new one
    // <en/> starts as soon as the old finishes.
    if (workerInFlight)
      abortInFlight()
    const rows = toValue(deps.data)
    const plan = prebuiltPlan ?? deps.buildSortEntries(deps.sortState.value, toValue(deps.columns), prebuiltColMap)
    if (!shouldUseWorker(prebuiltColMap, plan)) {
      abortInFlight()
      return
    }
    const worker = initWorker()
    if (!worker)
      return
    const { sortEntries } = plan
    // 2: 统一发键数组——不再全量 post rows（结构化克隆数百ms，
    // 10 万行可超 sortWorkerTimeout=5000 致“超时→terminate→主线程重排”双倍成本）。
    // 一律发 keys: rows.map(accessor)，worker 侧仅消费 keys（keys-only 协议）。
    const entries = sortEntries.map(entry => ({
      keys: rows.map((row, index) => entry.accessor(row, index)),
      multiplier: entry.multiplier,
      hasCustomSortMethod: false,
    }))
    workerDataVersion = deps.getDataVersion()
    workerSource = rows
    const requestId = ++sortRequestId
    workerInFlight = true
    isWorkerSorting.value = true
    clearTimer()
    sortTimeoutId = setTimeout(() => {
      if (requestId === sortRequestId && workerInFlight)
        fail(new Error('Sort worker timed out'))
    }, deps.sortWorkerTimeout)
    try {
      worker.postMessage({
        entries,
        totalRows: rows.length,
        requestId,
      })
    }
    catch (error) {
      fail(error instanceof Error ? error : new Error('Sort worker postMessage failed'))
    }
  }

  function shouldUseWorker(prebuiltColMap?: Map<string, ProcessedColumn>, prebuiltPlan?: SortPlan<T>): boolean {
    if (!workerAvailable)
      return false
    const rows = toValue(deps.data)
    if (rows.length <= deps.sortWorkerThreshold)
      return false
    const plan = prebuiltPlan ?? deps.buildSortEntries(deps.sortState.value, toValue(deps.columns), prebuiltColMap)
    return !plan.isServerSort && !plan.hasCustomSortMethod && plan.sortEntries.length > 0
      && plan.sortEntries.length * rows.length >= deps.sortWorkerMinEntries
  }

  /**
   * <zh/> 挂起：仅中止在飞请求与计时器，保留 Worker 实例与可用性标记。
   * <zh/> KeepAlive deactivate 路径用 suspend（恢复可复用）；最终销毁才用 dispose。
   * <en/> Suspend: abort in-flight work only, keep the Worker instance for reuse.
   */
  function suspend() {
    abortInFlight()
  }

  function dispose() {
    abortInFlight()
    terminateWorker()
  }

  // <zh/> 卸载兜底：上层忘记调 dispose 时作用域销毁自动回收 Worker 与超时器；非 setup 上下文直调时跳过（测试/SSR），由调用方负责 dispose
  // <en/> Unmount fallback: auto-reclaim the Worker and timer on scope disposal when the caller forgets dispose(); skipped outside setup (tests/SSR), where the caller owns dispose
  if (getCurrentScope())
    onScopeDispose(() => dispose())

  return {
    workerResult,
    getWorkerResult: () => {
      const rows = toValue(deps.data)
      // <zh/> 重排期间（在飞或结果版本 ≠ 当前版本）不提供旧结果；仅已完成且版本一致才提供。
      // <en/> During re-sorting (in-flight or result version ≠ current version) serve nothing;
      // <en/> only a completed result whose version matches is served.
      if (resultSource !== rows || isWorkerSorting.value)
        return null
      return resultVersion === deps.getDataVersion() ? workerResult.value : null
    },
    isWorkerSorting,
    isWorkerAvailable: () => workerAvailable,
    requestWorkerSort,
    shouldUseWorker,
    abortInFlight,
    suspend,
    dispose,
  }
}
