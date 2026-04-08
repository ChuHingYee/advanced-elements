import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { AdvColumn, AdvTableEmitFn, ProcessedColumn } from '../../types'
import type { SearchConfig } from '../../types/config'
import type { Translator } from '../../types/translator'
import type { UseTableRequestReturn } from '../data/use-table-request'
import { nextTick } from 'vue'
import { createTableEmitter } from '../../utils/table-emitter'
import { useSearchSync } from '../features/use-search-sync'
import { useTableSearch } from '../features/use-table-search'

/** <zh/> 搜索编排器输入 | <en/> Search orchestrator input */
export interface UseSearchOrchestratorOptions<T> {
  /** <zh/> 搜索参数引用（由外部创建，数据请求层也需要） | <en/> Search params ref (created externally, needed by data request layer) */
  searchParams: ShallowRef<Record<string, unknown>>
  localColumns: Ref<ProcessedColumn[]>
  rawColumns: () => AdvColumn<T>[]
  /** <zh/> 搜索配置（等价既往 `props.search`，调用方 useAdvTableFeatures 由窄切片转交） | <en/> Search config (equivalent to the former `props.search`, forwarded by useAdvTableFeatures from its narrow slice) */
  searchConfig: () => SearchConfig | undefined
  defaultValues: () => Record<string, unknown> | undefined
  searchEnabled: () => boolean | undefined
  hasColumnSearch: () => boolean
  /** <zh/> 翻译函数（统一 Translator 形态，支持 `{key}` 插值） | <en/> Translate function (unified Translator shape with `{key}` interpolation) */
  translation: Translator
  searchValuesModel: Ref<Record<string, unknown> | undefined>
  pagination: UseTableRequestReturn<T>['pagination']
  isUnmounted: () => boolean
  /** <zh/> 触发数据获取（等价 useTableRequest.fetchData，调用方直传） | <en/> Trigger data fetch (equivalent to useTableRequest.fetchData, passed through by the caller) */
  fetchData: UseTableRequestReturn<T>['fetchData']
  emit: AdvTableEmitFn
  /** <zh/> 表格实例 ID（ComputedRef），附加到事件末位参数 | <en/> Table instance ID (ComputedRef), appended as trailing arg of events */
  tableId: ComputedRef<string>
}

/**
 * <zh/> 搜索编排——统一管理搜索表单状态、字段合并、查询/重置。
 *
 * <en/> Search orchestration — unified management of
 * <en/> search form state, field merging, query/reset.
 */
export function useSearchOrchestrator<T>(options: UseSearchOrchestratorOptions<T>) {
  const {
    searchParams,
    localColumns,
    rawColumns,
    searchConfig,
    defaultValues,
    searchEnabled,
    hasColumnSearch,
    translation,
    searchValuesModel,
    pagination,
    isUnmounted,
    fetchData,
    emit,
    tableId,
  } = options

  const tableEmit = createTableEmitter(emit, tableId)

  /**
   * <zh/> 搜索/重置触发的远程请求错误兜底——与排序/筛选/分页路径对齐，
   * <zh/> 请求失败派发结构化 TABLE_REQUEST_FAILED 错误事件且无未处理 Promise rejection。
   * <en/> Error backstop for search/reset-triggered remote requests — aligns with the sort/filter/pagination
   * <en/> paths: a failed request dispatches the structured TABLE_REQUEST_FAILED error event
   * <en/> without an unhandled promise rejection.
   */
  function handleFetchError(err: unknown): void {
    emit('error', {
      code: 'TABLE_REQUEST_FAILED',
      severity: 'error' as const,
      cause: err,
    }, tableId.value)
  }

  useSearchSync(searchParams, searchValuesModel)

  const {
    tableSearchRef,
    hasSearch,
    mergedSearchFields,
    handleSearch,
    getQueryFormModel,
    setQueryFormModel,
    handleReset,
  } = useTableSearch({
    columns: () => localColumns.value ?? [],
    rawColumns,
    searchConfig,
    defaultValues,
    searchEnabled,
    hasColumnSearch,
    translation,
    searchParamsRef: searchParams,
    onSearch: (params) => {
      pagination.setCurrentPage(1)
      tableEmit('query', { ...params })
      nextTick(() => {
        if (!isUnmounted())
          fetchData({ reason: 'search' }).catch(handleFetchError)
      })
    },
    onReset: () => {
      pagination.setCurrentPage(1)
      tableEmit('reset')
      fetchData({ reason: 'reset' }).catch(handleFetchError)
    },
  })

  return {
    searchParams,
    tableSearchRef,
    hasSearch,
    mergedSearchFields,
    handleSearch,
    getQueryFormModel,
    setQueryFormModel,
    handleReset,
  }
}
