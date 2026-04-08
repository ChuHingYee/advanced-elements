import type { FormatMaps, ResponseData } from '../types'
import { devWarn } from './dev-warn'

/**
 * <zh/> 工具函数：从接口响应数据中解析表格所需的 data 和 total。
 * <en/> Helper: parse the data and total the table needs from an API response.
 *
 * <zh/> 后端返回字段名与表格预期的 data/total 可能不同，通过 maps 映射完成字段转换。
 * <en/> The backend's field names may differ from the expected data/total; maps bridge the field conversion.
 *
 * @param source - <zh/> 后端原始响应对象；直接返回数组时按全量数据处理（total 取数组长度） | <en/> raw backend response object; a bare array is treated as the full dataset (total = length)
 * @param maps - <zh/> 字段映射表，键为目标字段（data/total），值为源字段名（如 { data: 'items', total: 'totalCount' } 表示从 source.items 读 data、source.totalCount 读 total） | <en/> field map, keyed by target field (data/total) with source field name as value
 * @returns <zh/> 表格标准数据 { data: unknown[], total: number } | <en/> standard table data { data: unknown[], total: number }
 *
 * @example
 * parseResponseData({ items: [1, 2], totalCount: 10 }, { data: 'items', total: 'totalCount' })
 * // => { data: [1, 2], total: 10 }
 */
export function parseResponseData(source: Record<string, unknown> | unknown[], maps: FormatMaps): ResponseData {
  // <zh/> 直接数组响应：无需映射即为全量数据 | <en/> Bare-array responses need no mapping
  if (Array.isArray(source)) {
    return {
      data: source as unknown[],
      total: source.length,
    }
  }
  const result: ResponseData = {
    data: [],
    total: 0,
  }
  // maps 语义：{ 目标字段: 源字段名 }
  // maps semantics: { targetField: sourceFieldName }
  // data 字段：从 source[maps.data] 读取数组
  // data field: read the array from source[maps.data]
  const dataKey = maps.data ?? 'data'
  const rawData = source[dataKey]
  // <zh/> 非法响应不再静默空表——缺键/非数组时 dev 提示一次（生产可见码由请求层经 TABLE_RESPONSE_MALFORMED 派发）
  // <en/> malformed responses are no longer silent — dev hint on missing/non-array keys (production code dispatched by the request layer).
  if (!(dataKey in source) || !Array.isArray(rawData)) {
    // <zh/> 空对象（如 `{}`）多为初始/占位响应，不刷屏；仅非空源提示
    // <en/> Empty objects (e.g. `{}`) are usually initial/placeholder responses — hint only on non-empty sources
    if (Object.keys(source).length > 0) {
      devWarn(
        `[AdvTable] Response field "${dataKey}" is missing or not an array — treated as empty. `
        + 'Check request.formatMaps or adapt via transformResponse. | '
        + `后端响应缺少数组字段"${dataKey}"，已按空表处理。请检查 request.formatMaps 或用 transformResponse 适配。`,
      )
    }
  }
  result.data = Array.isArray(rawData) ? rawData as unknown[] : []

  // total 字段：从 source[maps.total] 读取数值
  // total field: read the number from source[maps.total]
  const totalKey = maps.total ?? 'total'
  const rawTotal = source[totalKey]
  result.total = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal) || 0

  return result
}
