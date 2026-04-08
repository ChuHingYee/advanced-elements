/** <zh/> 触发请求的原因 | <en/> Reason that triggers the request */
export type TableRequestReason
  = | 'pageChange' // 页码变化 | page change
    | 'pageSizeChange' // 每页条数变化 | page size change
    | 'search' // 搜索 | search
    | 'reset' // 重置 | reset
    | 'refresh' // 刷新 | refresh
    | 'loadMore' // 加载更多 | load more
    | 'initial' // 初始加载 | initial load
    | 'sort' // 远程排序 | remote sort
    | 'filter' // 远程筛选 | remote filter
    | 'sourceChange' // 数据源运行时切换 | data source switched at runtime

/** <zh/> 表格请求参数 | <en/> Table request payload */
export interface TableRequestPayload {
  /** <zh/> 当前页码（从 1 开始） | <en/> Current page number (starts from 1) */
  page: number
  /** <zh/> 每页条数 | <en/> Page size */
  size: number
  /** <zh/> 查询参数 | <en/> Query params */
  params: Record<string, any>
  /** <zh/> 是否追加到现有数据（用于加载更多场景） | <en/> Whether to append to existing data (used for load-more) */
  append: boolean
  /** <zh/> 触发请求的原因 | <en/> Reason that triggers the request */
  reason: TableRequestReason
  /**
   * <zh/> AbortSignal，用于取消正在进行的请求。
   * <en/> AbortSignal, used to cancel the in-flight request.
   *
   * <zh/> 手动请求模式下，快速翻页/筛选时旧请求可被取消，防止数据竞态。
   * 仅 isManual=true 时有效；自动请求模式内部已使用 AbortController
   * <en/> In manual request mode, rapid page/filter changes cancel the previous request, preventing data races.
   * Only effective when isManual=true; auto request mode already uses AbortController internally.
   */
  signal?: AbortSignal
  /**
   * <zh/> manual 模式请求序号——父远程回写 `api.setResponseData(data, requestId)` 时必须回显，
   * <zh/> 旧序号写回直接丢弃，防止先发后到覆盖新页；内部写回（拖拽/桥接）不经过此字段。
   * <en/> Manual-mode request id — parent remote write-backs must echo it via
   * <en/> `api.setResponseData(data, requestId)`; stale ids are dropped. Internal write-backs
   * <en/> (drag/bridge) do not use this field.
   */
  requestId?: number
}
