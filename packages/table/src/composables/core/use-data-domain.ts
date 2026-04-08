/**
 * <zh/> 数据域装配器——数据请求（第 2 节）+ 数据管线（第 3 节）+ 更新桥接/事务（第 6 节）+ 合并方法（第 7 节）
 * <en/> Data-domain assembler — data request (section 2) + data pipeline (section 3) + update bridge/transaction (section 6) + span method (section 7)
 *
 * @remarks
 * <zh/> 上帝对象物理拆分产物：与 use-column-domain.ts 的列装配器配对，
 * <zh/> 由 use-adv-table-data-columns 直接调用；列侧输入经显式参数交接。
 * <en/> Product of the god-object physical split: pairs with the column assemblers in use-column-domain.ts,
 * <en/> called directly by use-adv-table-data-columns; column-side inputs arrive via explicit parameters.
 */
import type { Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { TableError } from '../../types/error'
import type { TableRequestPayload } from '../../types/request'
import type { SortState } from '../../types/sort'
import type { UseRequestRetryOptions } from '../data/use-request'
import type { UseAdvTableDataColumnsOptions } from './use-adv-table-data-columns'
import { computed, ref, shallowRef, toValue } from 'vue'
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZES, DEFAULT_ROW_HEIGHT } from '../../constants'
import { pickSpanPart } from '../../utils/span-config-helpers'
import { createTableEmitter } from '../../utils/table-emitter'
import { useApplyDataTransaction } from '../data/use-apply-data-transaction'
import { createMergedSpanMethod } from '../data/use-cell-span'
import { useDataUpdateBridge } from '../data/use-data-update-bridge'
import { useTableDataPipeline } from '../data/use-table-data-pipeline'
import { useTableRequest } from '../data/use-table-request'

/**
 * <zh/> 数据域装配依赖——第 2/3/6/7 节所需的窄切片 + 列侧交接的 effectiveColumns
 * <en/> Data-domain assembly deps — narrow slices needed by sections 2/3/6/7 + effectiveColumns handed over from the column side
 */
export interface DataCoreDeps<T> extends Pick<
  UseAdvTableDataColumnsOptions<T>,
  | 'urlState'
  | 'fallbackData'
  | 'treeConfig'
  | 'propsLoading'
  | 'spanConfig'
  | 'spanMethod'
  | 'externalFilter'
  | 'rowGroupConfig'
  | 'rowExpandConfig'
  | 'rowPinConfig'
  | 'pagination'
  | 'filterConfig'
  | 'sortConfig'
  | 'dataPipeline'
  | 'emit'
  | 'models'
  | 'core'
> {
  /** <zh/> 有效列（列域装配产物） | <en/> Effective columns (column-domain assembly product) */
  effectiveColumns: Ref<ProcessedColumn[]>
}

/**
 * <zh/> 数据域装配——数据请求 + 数据管线 + 更新桥接/事务 + 合并方法
 * <en/> Data-domain assembly — data request + data pipeline + update bridge/transaction + span method
 */
export function buildDataCore<T>(deps: DataCoreDeps<T>) {
  const {
    urlState: urlStateInput,
    fallbackData,
    treeConfig: treeConfigInput,
    propsLoading,
    spanConfig: spanConfigInput,
    spanMethod: spanMethodInput,
    externalFilter: externalFilterInput,
    rowGroupConfig: rowGroupConfigInput,
    rowExpandConfig: rowExpandConfigInput,
    rowPinConfig: rowPinConfigInput,
    pagination: paginationInput,
    filterConfig: filterConfigInput,
    sortConfig: sortConfigInput,
    dataPipeline: dataPipelineInput,
    emit: emitFn,
    models,
    core,
    effectiveColumns,
  } = deps
  const tableEmit = createTableEmitter(emitFn, core.tableId)

  //  2. 数据请求（无列依赖）| Data request (no column deps)

  /**
   * <zh/> 排序/筛选状态预创建——请求域（本节）与管线（第 3 节）直连同一引用，
   * <zh/> 管线 noop 存根与懒升级的真实 composable 共用，升级前后标识稳定，无晚绑定回填
   * <en/> Pre-created sort/filter state — the request domain (this section) and the pipeline
   * <en/> (section 3) share direct references; pipeline noop stubs and lazily-upgraded real
   * <en/> composables share them, keeping identity stable across upgrades with no late-bound backfill
   */
  const sharedSortState = shallowRef<SortState[]>([])
  const sharedFilterState = shallowRef<Record<string, any>>({})

  // <zh/> 客户端长度单 owner ref：校正写入、分页读取；与服务端 total（请求写入）分离
  // <en/> Client-length single-owner ref: written by correction, read by pagination; separate from the server total
  const paginationClientTotal = ref(0)

  const tableRequestResult = useTableRequest<T>({
    requestSource: () => core.mergedRequest.value.source,
    requestAuto: () => core.mergedRequest.value.auto ?? true,
    requestMode: () => core.requestMode.value,
    formatMaps: () => core.mergedRequest.value.formatMaps,
    paramKeys: () => core.mergedRequest.value.paramKeys,
    transformRequest: () => core.mergedRequest.value.transformRequest,
    transformResponse: () => core.mergedRequest.value.transformResponse,
    requestTimeout: () => core.mergedRequest.value.timeout ?? 0,
    requestRetries: () => core.mergedRequest.value.retries as number | UseRequestRetryOptions | undefined,
    requestRetryDelay: () => core.mergedRequest.value.retryDelay,
    requestRetryBackoffFactor: () => core.mergedRequest.value.retryBackoffFactor,
    requestRetryMaxDelay: () => core.mergedRequest.value.retryMaxDelay,
    requestRetryOn: () => core.mergedRequest.value.retryOn,
    urlStateEnabled: () => toValue(urlStateInput)?.enabled ?? core.globalTableConfig.value.urlState?.enabled ?? false,
    urlStatePageKey: () => toValue(urlStateInput)?.pageKey ?? core.globalTableConfig.value.urlState?.pageKey ?? 'p',
    urlStateSizeKey: () => toValue(urlStateInput)?.sizeKey ?? core.globalTableConfig.value.urlState?.sizeKey ?? 's',
    paginationOptions: {
      enabled: () => core.mergedPagination.value.enabled ?? true,
      mode: () => core.mergedPagination.value.mode ?? 'page',
      sticky: () => core.mergedPagination.value.sticky ?? true,
      containerHeight: () => core.mergedPagination.value.containerHeight ?? 450,
      autoPageSize: () => core.mergedPagination.value.autoPageSize ?? false,
      rowHeight: () => core.mergedPagination.value.rowHeight ?? DEFAULT_ROW_HEIGHT,
      pageSize: () => core.mergedPagination.value.pageSize ?? DEFAULT_PAGE_SIZE,
      pageSizes: () => core.mergedPagination.value.pageSizes ?? DEFAULT_PAGE_SIZES,
      total: ref(0),
      clientTotal: paginationClientTotal,
      propsTotal: () => core.mergedPagination.value.total ?? 0,
      layout: () => core.mergedPagination.value.layout ?? 'total, sizes, prev, pager, next, jumper',
      paginationRef: core.paginationRef,
      isManual: core.isManual,
    },
    searchParams: () => core.searchParams.value,
    autoParamsConfig: () => core.mergedRequest.value.autoParams,
    autoSortState: () => sharedSortState.value,
    autoFilterState: () => sharedFilterState.value,
    rowKeyFn: () => core.rowKeyFn.value,
    isManual: core.isManual,
    emits: {
      pageChange: (page, size) => tableEmit('pageChange', page, size),
      updateLoading: (val) => { models.loading.value = val },
      /**
       * <zh/> manual 模式的数据请求事件——**只负责通知，不回流数据**。
       * <zh/> `createTableEmitter` 不转发底层 emit 结果（`TableEmitter` 签名为 `=> void`），
       * <zh/> 故恒定解析为空数组。受支持的数据回写通道是父组件调用 `setResponseData()` 或 `v-model:data`。
       *
       * <en/> The manual-mode data-request event — **notification only, no data return path**.
       * <en/> `createTableEmitter` does not forward the underlying emit result (its `TableEmitter`
       * <en/> signature is `=> void`), so this always resolves to an empty array. The supported write-back
       * <en/> channel is the parent calling `setResponseData()` or using `v-model:data`.
       */
      request: (payload: TableRequestPayload): Promise<T[]> => {
        tableEmit('request', payload)
        return Promise.resolve([])
      },
      refresh: () => tableEmit('refresh'),
      updateData: (val: T[]) => { models.data.value = val },
      onError: (err: TableError) => { tableEmit('error', err) },
    },
    // <zh/> 数据变更经事务内核提交（见 useTableRequest.dataChangeCommit），写路由收敛到 writeFullData
    // <en/> Data changes commit via the transaction kernel (see useTableRequest.dataChangeCommit), with writes converged on writeFullData
    dataChangeCommit: {
      dataTransaction: core.dataTransaction,
      writeModel: (data) => {
        models.data.value = data
      },
    },
    defaultPageSize: () => core.mergedPagination.value.pageSize,
    // <zh/> 优先读取 dataModel（defineModel）——单程 :data 绑定时编辑写回 dataModel，
    // <zh/> 若不读取则 tableData 永远停留在 props.data 原始引用，编辑结果丢失（表现为"还原"）。
    // <zh/> v-model 场景下 dataModel 由 defineModel 与 prop 同步，读取 dataModel 与读取 props.data 等价。
    // <en/> Prefer the dataModel (defineModel) ref — with one-way :data binding edits write back to dataModel;
    // <en/> without this, tableData stays pinned to the original props.data reference and edits are lost (revert-like behavior).
    // <en/> In v-model scenarios defineModel keeps dataModel in sync with the prop, so reading dataModel is equivalent.
    defaultData: () => models.data.value ?? toValue(fallbackData) ?? [],
    childrenKey: () => toValue(treeConfigInput)?.children,
  })

  const {
    total,
    hasSource,
    isPolling,
    pagination,
    tableData,
    rowKeyMeta,
    loading: localLoading,
    refresh,
    fetchData,
    setLoading,
    setResponseData,
    setIsPolling,
    reorderData,
    handleCurrentPageChange,
    handlePageSizeChange,
    handleLoadMore,
    getPagination,
    setCurrentPageAndRefetch,
    setPageSizeAndRefetch,
    getFullData,
  } = tableRequestResult

  // <zh/> 双通道优先级：外部 props.loading 与内部请求态 OR 合并——任一为真即 loading；外部强制骨架屏时以 props 为准，请求期以内部为准
  // <en/> Dual-channel priority: external props.loading OR internal request state — either true means loading
  const mergedLoading = computed(() => Boolean(toValue(propsLoading) || localLoading.value))

  //  3. 数据管线（依赖列+请求）| Data pipeline (needs columns + request)
  const {
    columnClassification,
    hasActiveFilter,
    setFilter,
    resetColumnFilter,
    resetAllFilters,
    getFilterValue,
    isColumnFiltered,
    getEnumOptions,
    filterState,
    sortState,
    toggleSort,
    setSort,
    clearSort,
    setSorts,
    getSortOrder,
    getSortIndex,
    finalDisplayData,
    prePaginationExpandedData,
    visibleData,
    selectableData,
    spanMethod,
    getSpanInfo,
    spanEnabled,
    hasActiveQuickFilter,
    invalidateQuickFilterRowCache,
    invalidateQuickFilterRowCacheBatch,
    // <zh/> 管线 getter 代理导出的列筛按行失效 API——供编辑/undo 链路清除陈旧筛选缓存
    // <en/> Column-filter per-row cache invalidation exported via pipeline getter proxy —
    // <en/> consumed by the edit/undo chain to purge stale filter caches
    invalidateRowCache: invalidateColumnFilterRowCacheApi,
    treeApi,
    rowGroupApi,
    rowExpandApi,
    rowPinApi,
    renderData,
  } = useTableDataPipeline<T>({
    localColumns: effectiveColumns,
    pipelineData: tableData,
    tableData,
    // <zh/> 预创建状态直连——与请求域 autoSortState/autoFilterState 同一引用 | <en/> Pre-created state wired directly — same references as the request domain's autoSortState/autoFilterState
    sortState: sharedSortState,
    filterState: sharedFilterState,
    selectableFn: core.selectableFn,
    isClientPagination: pagination.isClient,
    currentPage: pagination.currentPage,
    pageSize: pagination.pageSize,
    rowSpanCells: computed(() => pickSpanPart(toValue(spanConfigInput), 'rows')),
    colSpanCells: computed(() => pickSpanPart(toValue(spanConfigInput), 'cols')),
    ranges: computed(() => pickSpanPart(toValue(spanConfigInput), 'ranges')),
    userSpanMethod: computed(() => toValue(spanMethodInput)),
    quickFilterText: core.quickFilterText,
    externalFilter: () => toValue(externalFilterInput),
    treeConfig: () => toValue(treeConfigInput),
    rowGroupConfig: () => toValue(rowGroupConfigInput),
    rowExpandConfig: () => toValue(rowExpandConfigInput),
    rowPinConfig: () => toValue(rowPinConfigInput),
    includeSynthetic: computed(() => (toValue(paginationInput) as { includeSynthetic?: boolean } | undefined)?.includeSynthetic ?? true),
    rowKeyFn: () => core.rowKeyFn.value,
    // <zh/> AG Grid 对齐：分组小计配置由 mergedUiConfig 透传管线（props ?? 全局已在 useTableConfig 合并）
    // <en/> AG Grid parity: group total config flows from mergedUiConfig into the pipeline (props ?? global merged in useTableConfig)
    groupTotalRow: computed(() => core.mergedUiConfig.value.groupTotalRow),
    totalValueGetter: computed(() => core.mergedUiConfig.value.totalValueGetter),
    sumText: computed(() => core.mergedUiConfig.value.sumText),
    // <zh/> 国际化翻译函数——供行分组的合计标签回退（table.summary），未配置 i18n 时回退内置中文
    // <en/> i18n translator for the row-group total-label fallback (table.summary); falls back to built-in Chinese without i18n
    t: () => core.t,
    suppressStickyTotalRow: computed(() => core.mergedUiConfig.value.suppressStickyTotalRow),
    groupSuppressBlankHeader: computed(() => core.mergedUiConfig.value.groupSuppressBlankHeader),
    debug: core.debug,
    onSortWorkerError: (err: unknown) => core.handleError('TABLE_SORT_WORKER_FAILED', { cause: err }),
    onSpanLimitExceeded: (info) => {
      core.handleError('TABLE_SPAN_LIMIT_EXCEEDED', {
        cause: {
          estimatedOps: info.estimatedOps,
          limit: info.limit,
          source: info.source,
        },
      })
    },
    onPinLimitExceeded: (info) => {
      core.handleError('TABLE_PIN_LIMIT_EXCEEDED', {
        cause: {
          total: info.total,
          limit: info.limit,
          truncatedTop: info.truncatedTop,
          truncatedBottom: info.truncatedBottom,
        },
      })
    },
    onRowExpandStorageError: (info) => {
      core.handleError('TABLE_ROW_EXPAND_STORAGE_FAILED', {
        cause: info.cause,
        field: info.persistenceKey,
      })
    },
    // <zh/> 统一两种模式下 rowExpand/rowCollapse 事件触发
    // <en/> Unify rowExpand/rowCollapse event triggering across both modes
    onRowExpand: (row, rowKey) => tableEmit('rowExpand', { row, rowKey, expanded: true }),
    onRowCollapse: (row, rowKey) => tableEmit('rowCollapse', { row, rowKey }),
    quickFilterCacheSize: toValue(filterConfigInput)?.quickFilterCacheSize,
    maxSortColumns: toValue(sortConfigInput)?.maxSortColumns,
    pipelineOrder: computed(() => toValue(dataPipelineInput)?.order),
    devWarn: core.handleError.devWarn,
  })

  //  6. 数据更新桥接 | Data update bridge
  const dataUpdateBridge = useDataUpdateBridge<T>({
    tableData,
    hasSource,
    setResponseData,
    dataModel: models.data,
    rowKeyFn: core.rowKeyFn,
  })
  const { handleDataUpdate } = dataUpdateBridge

  // <zh/> AG 风格增量事务（add/update/remove）——组装于 update 桥 + 数据事务内核之上，
  // <zh/> 写路径与既有 handleDataUpdate 完全同源，不引入第二套写通道。
  // <en/> AG-style incremental transactions (add/update/remove) — assembled atop the update bridge
  // <en/> and the data-transaction kernel; the write path is exactly the existing handleDataUpdate,
  // <en/> introducing no second write channel.
  const { applyTransaction } = useApplyDataTransaction<T>({
    tableData,
    writeFull: data => handleDataUpdate(data, 'full'),
    rowKeyFn: core.rowKeyFn.value,
    dataTransaction: core.dataTransaction,
  })

  //  7. 合并 spanMethod | Merged spanMethod
  // <zh/> 双模式合并语义见 createMergedSpanMethod（use-cell-span），此处仅接线 | <en/> Dual-mode span semantics live in createMergedSpanMethod (use-cell-span); wired here only
  const mergedSpanMethod = createMergedSpanMethod({
    userSpanMethod: spanMethodInput,
    internalSpanMethod: spanMethod,
  })

  return {
    tableData,
    total,
    hasSource,
    isPolling,
    pagination,
    localLoading,
    refresh,
    fetchData,
    setLoading,
    setResponseData,
    setIsPolling,
    reorderData,
    handleCurrentPageChange,
    handlePageSizeChange,
    handleLoadMore,
    getPagination,
    setCurrentPageAndRefetch,
    setPageSizeAndRefetch,
    getFullData,
    mergedLoading,
    columnClassification,
    hasActiveFilter,
    setFilter,
    resetColumnFilter,
    resetAllFilters,
    getFilterValue,
    isColumnFiltered,
    getEnumOptions,
    filterState,
    sortState,
    toggleSort,
    setSort,
    clearSort,
    setSorts,
    getSortOrder,
    getSortIndex,
    finalDisplayData,
    prePaginationExpandedData,
    visibleData,
    selectableData,
    spanMethod,
    getSpanInfo,
    spanEnabled,
    hasActiveQuickFilter,
    invalidateQuickFilterRowCache,
    invalidateQuickFilterRowCacheBatch,
    invalidateColumnFilterRowCache: invalidateColumnFilterRowCacheApi,
    treeApi,
    rowGroupApi,
    rowExpandApi,
    rowPinApi,
    renderData,
    handleDataUpdate,
    dataUpdateBridge,
    applyTransaction,
    mergedSpanMethod,
    rowKeyMeta,
    paginationClientTotal,
  }
}

/** <zh/> 数据域装配结果 | <en/> Data-domain assembly result */
export type DataCoreResult<T = any> = ReturnType<typeof buildDataCore<T>>
