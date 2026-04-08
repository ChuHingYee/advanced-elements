import type { ComputedRef, Ref } from 'vue'
import type { DefaultSummaryColumnLike } from '../../utils/summary-defaults'
import { computed, getCurrentScope, onScopeDispose, shallowRef, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { idleSchedule } from '../../utils/raf'
import { computeRawAggregates as computeRaws, shouldDeferSummary } from '../../utils/summary-defaults'
import { filterLeafDataRows } from '../../utils/total-rows'

export interface UseDeferredAggregatesOptions<T = any> {
  /** <zh/> 待聚合行（含合成行，内部自动过滤叶子行） | <en/> Rows to aggregate (incl. synthetics; leaf-filtered internally) */
  rows: () => readonly T[]
  /** <zh/> 聚合列描述 | <en/> Aggregate column descriptors */
  columns: () => ReadonlyArray<DefaultSummaryColumnLike & { prop?: string }>
  /** <zh/> 异步阈值（行×列），缺省 SUMMARY_ASYNC_THRESHOLD | <en/> Async threshold (rows×cols), defaults to SUMMARY_ASYNC_THRESHOLD */
  threshold?: number
  /** <zh/> 是否启用异步推迟（测试可强制关闭） | <en/> Whether async deferral is enabled (tests may force off) */
  enabled?: () => boolean
  /**
   * <zh/> 异步聚合失败回调——缺省仅保留旧值并复位 isCalculating，不静默归零。
   * <en/> Async-aggregation failure callback — by default keeps the previous value and resets
   * <en/> isCalculating instead of silently zeroing.
   */
  onError?: (err: unknown) => void
}

export interface UseDeferredAggregatesReturn {
  /** <zh/> 原始聚合（prop 键控；推迟计算完成前为空对象） | <en/> Raw aggregates (prop-keyed; empty until a deferred pass settles) */
  aggregates: ComputedRef<Record<string, unknown>> | Ref<Record<string, unknown>>
  /** <zh/> 是否正在后台计算（调用方可渲染 loading 占位） | <en/> Whether a background pass is pending (callers may render a loading placeholder) */
  isCalculating: Ref<boolean>
}

type IdleCancel = () => void

/**
 * <zh/> 收敛：空闲调度经 utils/raf 唯一出口（与 use-cell-span 同源）
 * <en/> convergence: idle scheduling via the single utils/raf outlet (same source as use-cell-span).
 */
function requestIdle(fn: () => void): IdleCancel {
  return idleSchedule(fn, 100)
}

function cancelIdle(cancel: IdleCancel): void {
  cancel()
}

/**
 * <zh/> 推迟的大数据汇总——行×列超阈值时经 requestIdleCallback 异步化，避免阻塞首帧。
 * <zh/> 小数据保持同步 computed（零行为变化）；大数据先返回空聚合 + isCalculating=true，
 * <zh/> 空闲回调完成后回填结果。作用域销毁时取消待执行回调。
 * <en/> Deferred large-data summary — rows×cols above the threshold go through
 * <en/> requestIdleCallback to avoid blocking the first frame. Small data stays a sync
 * <en/> computed; large data returns empty aggregates +
 * <en/> isCalculating=true first, backfilled when the idle callback settles.
 * <en/> Pending callbacks are cancelled on scope disposal.
 */
export function useDeferredRawAggregates<T = any>(
  options: UseDeferredAggregatesOptions<T>,
): UseDeferredAggregatesReturn {
  const threshold = options.threshold
  const isEnabled = () => options.enabled?.() ?? true

  const fastPath = computed<Record<string, unknown>>(() => {
    const rows = options.rows() ?? []
    const cols = options.columns() ?? []
    if (!isEnabled() || !shouldDeferSummary(rows.length, cols.length, threshold))
      return computeRaws(filterLeafDataRows(rows as unknown[]), cols)
    return {}
  })

  const deferred = shallowRef<Record<string, unknown>>({})
  const isCalculating = shallowRef(false)
  let pending: IdleCancel | null = null
  let generation = 0

  function cancelPending(): void {
    generation++
    if (pending != null) {
      cancelIdle(pending)
      pending = null
    }
    isCalculating.value = false
  }

  watch(
    [() => options.rows(), () => options.columns(), isEnabled],
    ([rows, cols]) => {
      cancelPending()
      const list = (rows ?? []) as readonly T[]
      const columns = (cols ?? []) as ReadonlyArray<DefaultSummaryColumnLike & { prop?: string }>
      if (!isEnabled() || !shouldDeferSummary(list.length, columns.length, threshold)) {
        if (isCalculating.value)
          isCalculating.value = false
        return
      }
      isCalculating.value = true
      const snapshotRows = [...list]
      const snapshotCols = [...columns]
      const gen = generation
      pending = requestIdle(() => {
        if (gen !== generation)
          return
        pending = null
        try {
          const result = computeRaws(
            filterLeafDataRows(snapshotRows as unknown[]),
            snapshotCols,
          )
          if (gen === generation)
            deferred.value = result
        }
        catch (err: unknown) {
          // <zh/> 失败保留旧值（不归零）并上报，isCalculating 照常复位。
          // <zh/> 缺省走 dev 通道（调用方可经 onError 接结构化错误）；静默归零会误导为"合计为 0"。
          // <en/> Keep the previous value on failure (never zero it), report, and still reset isCalculating.
          // <en/> Defaults to the dev channel (callers may hook structured errors via onError); silently
          // <en/> zeroing would misread as "total is 0".
          if (gen === generation) {
            if (options.onError)
              options.onError(err)
            else
              devWarn('Async summary aggregation failed, keeping previous aggregates.', err)
          }
        }
        finally {
          if (gen === generation)
            isCalculating.value = false
        }
      })
    },
    { immediate: true },
  )

  if (getCurrentScope())
    onScopeDispose(cancelPending)

  const aggregates = computed<Record<string, unknown>>(() => {
    const rows = options.rows() ?? []
    const cols = options.columns() ?? []
    if (!isEnabled() || !shouldDeferSummary(rows.length, cols.length, threshold))
      return fastPath.value
    return deferred.value
  })

  return { aggregates, isCalculating }
}
