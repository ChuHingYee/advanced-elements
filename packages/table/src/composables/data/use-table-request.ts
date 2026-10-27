import type { UseTableRequestOptions, UseTableRequestReturn } from './use-table-request-types'
import { nextTick, onBeforeMount, onMounted, onScopeDispose, onUnmounted, shallowRef } from 'vue'
import { useRequest } from '../data/use-request'
import { useTablePagination } from '../data/use-table-pagination'
import { useUrlState } from '../data/use-url-state'
import { createPaginationEffects } from './pagination-effects'
import { useRequestDataCleaning } from './use-request-data-cleaning'
import { useRequestEngine } from './use-request-engine'
import { useRequestLoadingBridge } from './use-request-loading-bridge'
import { createRequestOptions } from './use-request-options'
import { createRequestUrlSync } from './use-request-url-sync'
import { useRequestWriteback } from './use-request-writeback'

// <zh/> 契约类型自 use-table-request-types.ts 拆出（刀法 C），re-export 保既有导入路径零变化
// <en/> Contract types split into use-table-request-types.ts (knife C); re-export keeps every existing import path unchanged
export type { UseTableRequestOptions, UseTableRequestReturn } from './use-table-request-types'

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
  /** <zh/> 组件卸载标志（shallowRef 供引擎模块跨文件共享），防止 nextTick 回调在卸载后执行 | <en/> unmount flag (a shallowRef shared with the engine module) */
  const isUnmounted = shallowRef(false)

  // <zh/> requestOptions 装配自 use-request-options.ts 拆出（刀法 C） | <en/> requestOptions assembly split into use-request-options.ts (knife C)
  const { requestOptions } = createRequestOptions<T>(options)

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

  // <zh/> 数据清洗（脏行剔除 + rowKeyMeta 单趟构建）自 use-request-data-cleaning.ts 拆出（刀法 C）
  // <en/> Data cleaning (dirty-row sweep + rowKeyMeta single pass) split into use-request-data-cleaning.ts (knife C)
  const { tableData, rowKeyMeta } = useRequestDataCleaning<T>({
    hasSource,
    responseData,
    defaultData,
    rowKeyFn,
    childrenKey,
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

  // <zh/> 取数引擎（manual 竞态守卫/参数装配/取数/守卫回写/重排/源切换响应）自 use-request-engine.ts 拆出（刀法 C）
  // <en/> Fetch engine (manual race guard / param assembly / fetch / guarded write-back / reorder / source-switch reaction) split into use-request-engine.ts (knife C)
  const {
    fetchData,
    refresh,
    getManualRequestId,
    isManualRequestSettled,
    invalidateManualRequests,
  } = useRequestEngine<T>({
    isManual,
    isUnmounted,
    searchParams,
    autoParamsConfig,
    autoSortState,
    autoFilterState,
    emits,
    request,
    refreshRequest,
    setLoading,
    pagination,
  })

  // <zh/> 回写路由（守卫式回写/重排/源切换响应）自 use-request-writeback.ts 拆出（刀法 C）
  // <en/> Write-back routing (guarded write-back / reorder / source-switch reaction) split into use-request-writeback.ts (knife C)
  const { setResponseDataGuarded, reorderData } = useRequestWriteback<T>({
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
  })

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

  // <zh/> URL↔分页同步自 use-request-url-sync.ts 拆出（刀法 C）
  // <en/> URL↔pagination sync split into use-request-url-sync.ts (knife C)
  const { syncPaginationFromUrl, resyncPaginationFromUrl } = createRequestUrlSync({
    initFromUrl,
    pagination,
    applyPaginationEffects,
  })

  // <zh/> loading 桥接（KeepAlive 兼容）自 use-request-loading-bridge.ts 拆出（刀法 C）；
  // <zh/> 停靠时失效 manual 请求、重激活时重同步 URL 分页为注入的附加副作用
  // <en/> Loading bridge (KeepAlive-compatible) split into use-request-loading-bridge.ts (knife C);
  // <en/> manual-request invalidation on deactivate and URL-pagination resync on reactivate are injected extras
  useRequestLoadingBridge({
    localLoading,
    updateLoading: emits.updateLoading,
    onDeactivate: invalidateManualRequests,
    onReactivate: resyncPaginationFromUrl,
    isUnmounted,
  })

  onUnmounted(() => {
    invalidateManualRequests()
    isUnmounted.value = true
  })

  function stopPolling() {
    isPolling.value = false
  }

  function setIsPolling(val: boolean) {
    isPolling.value = val
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
        if (isUnmounted.value)
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
    getManualRequestId,
    isManualRequestSettled,
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
