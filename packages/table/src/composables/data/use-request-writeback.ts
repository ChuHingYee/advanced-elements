import type { Ref, ShallowRef } from 'vue'
import type { DataSource } from '../../types'
import type { TableError } from '../../types/error'
import type { TableRequestPayload, TableRequestReason } from '../../types/request'
import type { DataTransactionReturn } from '../data/use-data-transaction'
import { watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { writeFullData } from '../data/use-data-update-bridge'

/**
 * <zh/> 回写路由依赖——守卫式回写、manual 回写复位与数据写入族（拖拽重排/源切换响应）
 * <en/> Write-back routing deps — guarded write-back, manual write-back reset and the data-write family (drag reorder / source-switch reaction)
 */
export interface UseRequestWritebackDeps<T> {
  isManual: Ref<boolean>
  isUnmounted: ShallowRef<boolean>
  hasSource: Ref<boolean>
  responseData: Ref<T[]>
  requestSource: () => DataSource<T> | undefined
  requestAuto: () => boolean
  defaultData?: () => T[]
  dataChangeCommit?: {
    dataTransaction: DataTransactionReturn<T>
    writeModel: (data: T[]) => void
  }
  emits: {
    request: (payload: TableRequestPayload) => Promise<T[]>
    updateData: (data: T[]) => void
    dataChange?: (params: { reason: string, data: T[], oldData?: T[] }) => void
    onError: (error: TableError) => void
  }
  setLoading: (val: boolean) => void
  setResponseData: (data: T[]) => void
  clearResponseData: () => void
  pagination: { setCurrentPage: (page: number) => unknown }
  fetchData: (options?: { append?: boolean, reason?: TableRequestReason }) => Promise<T[] | null>
  invalidateManualRequests: () => void
  getManualRequestId: () => number
}

/**
 * <zh/> 回写路由——useTableRequest 的数据写入子域：守卫式回写（requestId 竞态防护 + 写路由分流）、
 * <zh/> manual「父回写即结束加载」复位、拖拽重排的事务提交与数据源运行时切换响应。
 *
 * <zh/> 自 use-table-request.ts 原样迁出（经 use-request-engine.ts 中转，COMPLEXITY-PLAN 战线三，
 * <zh/> 刀法 C 域内子模块化）；函数体逐字未改。
 * <en/> Write-back routing — the data-write sub-domain of useTableRequest: guarded write-back
 * <en/> (requestId race protection + write-route dispatch), the manual "parent write-back ends
 * <en/> loading" reset, transactional drag-reorder commit and the runtime data-source-switch reaction.
 *
 * <en/> Migrated verbatim from use-table-request.ts (via use-request-engine.ts; COMPLEXITY-PLAN
 * <en/> battle line 3, knife C); function bodies unchanged.
 */
export function useRequestWriteback<T>(deps: UseRequestWritebackDeps<T>) {
  const {
    isManual,
    isUnmounted,
    hasSource,
    responseData,
    requestSource,
    requestAuto,
    defaultData,
    dataChangeCommit,
    emits,
    setLoading,
    setResponseData,
    clearResponseData,
    pagination,
    fetchData,
    invalidateManualRequests,
    getManualRequestId,
  } = deps

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
    if (isUnmounted.value)
      return
    if (isManual.value && requestId !== undefined && requestId !== getManualRequestId())
      return
    // <zh/> manual 无 requestId 回写——乱序时旧响应可覆盖新页，仅 dev 告警不断行（存量调用不断），请透传 request 事件的 requestId
    // <en/> Manual write-back without requestId — a stale response may overwrite the new page under reorder; dev-warn only (existing calls keep working), please forward the requestId from the request event
    if (isManual.value && requestId === undefined && getManualRequestId() > 0) {
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
      if (isManual.value && !isUnmounted.value)
        setLoading(false)
    })
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
   * <zh/> 数据源**运行时切换**（切换租户 / 门店 / 查询通道，或数据源异步就绪后由 undefined 变为函数）：
   * <zh/> 回到第 1 页并自动重取。
   *
   * <zh/> 跳过条件与首次加载保持一致：manual 模式由父组件驱动、`auto: false` 表示调用方自控请求时机。
   * <zh/> 置页码用**纯状态** setter（`pagination.setCurrentPage`），避免与本次 fetchData 叠加成两次请求。
   *
   * <en/> Runtime data-source switch (tenant / store / endpoint, or a source that becomes ready
   * <en/> asynchronously after being `undefined`): return to page 1 and refetch.
   *
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
      invalidateManualRequests()
      clearResponseData()
      setLoading(false)
      pagination.setCurrentPage(1)
      return
    }
    if (isUnmounted.value || isManual.value || !requestAuto())
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

  return { setResponseDataGuarded, reorderData }
}
