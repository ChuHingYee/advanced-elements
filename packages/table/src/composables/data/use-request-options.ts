import type { TableError } from '../../types/error'
import type { UseRequestOptions } from '../data/use-request'
import type { UseTableRequestOptions } from './use-table-request-types'
import { computed } from 'vue'

/**
 * <zh/> requestOptions 装配入参——UseTableRequestOptions 的请求相关子集 + onError 通道
 * <en/> requestOptions assembly input — the request-related subset of UseTableRequestOptions plus the onError channel
 */
export type CreateRequestOptionsInput<T>
  = Pick<
    UseTableRequestOptions<T>,
    | 'requestSource'
    | 'requestAuto'
    | 'requestMode'
    | 'formatMaps'
    | 'paramKeys'
    | 'transformRequest'
    | 'transformResponse'
    | 'requestTimeout'
    | 'requestRetries'
    | 'requestRetryDelay'
    | 'requestRetryBackoffFactor'
    | 'requestRetryMaxDelay'
    | 'requestRetryOn'
  > & { emits: { onError: (error: TableError) => void } }

/**
 * <zh/> requestOptions 装配——useRequest 的选项 computed 与非法响应上报。
 *
 * <zh/> 自 use-table-request.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C 域内子模块化），
 * <zh/> 函数体逐字未改。
 * <en/> requestOptions assembly — the options computed for useRequest plus malformed-response reporting.
 *
 * <en/> Migrated verbatim from use-table-request.ts (COMPLEXITY-PLAN battle line 3, knife C:
 * <en/> in-domain sub-modules); function bodies unchanged.
 */
export function createRequestOptions<T>(options: CreateRequestOptionsInput<T>) {
  const {
    requestSource,
    requestAuto,
    requestMode,
    formatMaps,
    paramKeys,
    transformRequest,
    transformResponse,
    requestTimeout,
    emits,
  } = options

  /**
   * <zh/> 非法响应映射为生产可见结构化码（显式错配即上报，按空表处理不断行）
   * <en/> Map malformed responses to a production-visible structured code (report on explicit mismatch, still treat as empty without breaking).
   */
  function handleResponseMalformed(info: { dataKey: string, hasDataKey: boolean, isDataArray: boolean }): void {
    try {
      emits.onError({
        code: 'TABLE_RESPONSE_MALFORMED',
        severity: 'warn',
        cause: info,
      })
    }
    catch {
      // <zh/> 上报通道异常不影响数据链路 | <en/> Report-channel errors must not break the data path
    }
  }

  // <zh/> 字段级引用稳定由 useRequest 内部的 opts computed（prev 逐字段比较）保证，此处不再重复守卫
  // <en/> Field-level reference stability is guaranteed by the opts computed inside useRequest
  // <en/> (prev field-by-field comparison); no duplicate guard here
  const requestOptions = computed((): UseRequestOptions<T> => {
    return {
      dataSource: requestSource(),
      auto: requestAuto(),
      requestMode: requestMode(),
      formatMaps: formatMaps(),
      paramKeys: paramKeys(),
      transformRequest: transformRequest(),
      transformResponse: transformResponse(),
      timeout: requestTimeout?.() ?? 0,
      retries: options.requestRetries?.(),
      retryDelay: options.requestRetryDelay?.(),
      retryBackoffFactor: options.requestRetryBackoffFactor?.(),
      retryMaxDelay: options.requestRetryMaxDelay?.(),
      retryOn: options.requestRetryOn?.(),
      onMalformed: handleResponseMalformed,
    }
  })

  return { requestOptions }
}
