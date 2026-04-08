/**
 * <zh/> 数据源函数类型
 *
 * <zh/> 返回类型为 `Promise<unknown>`：
 * <zh/> 提供 `transformResponse` 时 `source` 可返回任意格式；
 * <zh/> 未提供时内部通过 `formatMaps` 解析 `{ data, total }` 结构。
 * <zh/> 类型参数 `T` 为行类型（加法式泛型，默认 `any`）——与同表的 `data?: T[]`
 * <zh/> 对齐，使两路数据源在类型层面一致；标准结构响应可直接收窄为 `ResponseData<T>`。
 *
 * @param params - <zh/> 请求参数 | <en/> request parameters
 * @param signal - <zh/> 用于取消进行中的请求的 AbortSignal | <en/> AbortSignal for canceling in-flight requests
 *
 * <en/> Data source function type
 *
 * <en/> Return type is `Promise<unknown>`:
 * <en/> When `transformResponse` is provided, `source` can return any format;
 * <en/> When not provided, `{ data, total }` structure is parsed internally via `formatMaps`.
 * <en/> `T` is the row type (additive generic, defaults to `any`).
 */
export type DataSource<T = any> = (params: Record<string, unknown>, signal?: AbortSignal) => Promise<ResponseData<T> | unknown>

/** <zh/> 标准响应结构 — data 为行数组，total 为符合条件的总条数 | <en/> Standard response structure — data is row array, total is count of matching records */
export interface ResponseData<T = any> {
  data: T[]
  total: number
}

/**
 * <zh/> 响应字段映射表
 * <zh/> 键为目标字段（data/total），值为后端响应中的源字段名。
 * <zh/> 如 { data: 'items', total: 'totalCount' } 表示从 response.items 读 data，response.totalCount 读 total。
 *
 * <en/> Response field mapping table
 * <en/> Keys are target fields (data/total), values are source field names in the backend response.
 * <en/> e.g. { data: 'items', total: 'totalCount' } means reading data from response.items and total from response.totalCount.
 */
export type FormatMaps = Partial<Record<keyof ResponseData, string>>
