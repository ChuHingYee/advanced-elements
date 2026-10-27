import type { Ref } from 'vue'
import type { DataSource, FormatMaps, RowKeyMeta } from '../../types'
import type { TableError } from '../../types/error'
import type { TableRequestPayload, TableRequestReason } from '../../types/request'
import type { SortOrder } from '../../types/sort'
import type { DataTransactionReturn } from '../data/use-data-transaction'
import type { RequestMode, UseRequestOptions, UseRequestRetryOptions } from '../data/use-request'
import type { useTablePagination, UseTablePaginationOptions } from '../data/use-table-pagination'

/**
 * <zh/> `useTableRequest` 的选项与返回契约——自 use-table-request.ts 拆出（COMPLEXITY-PLAN 战线三，
 * <zh/> 刀法 C 域内子模块化）；use-table-request.ts re-export 本文件，既有导入路径零变化。
 * <en/> Options and return contracts of `useTableRequest` — split out of use-table-request.ts
 * <en/> (COMPLEXITY-PLAN battle line 3, knife C: in-domain sub-modules); use-table-request.ts
 * <en/> re-exports this file, keeping every existing import path unchanged.
 */
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
