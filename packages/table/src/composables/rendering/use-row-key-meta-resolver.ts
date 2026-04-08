/**
 * <zh/> 行键元数据解析器 — 优先使用注入的 rowKeyMeta，缺失时从 data 构建 fallback Map
 *
 * <zh/> 行索引域说明：当 data（渲染数据）可用时，keyToIndex 基于渲染数据构建，
 * <zh/> 而非 rowKeyMeta.keyToIndex（全量 tableData 域）。
 * <zh/> 这确保 hoverRowIndex 始终在渲染数据域内，与 row 事件 handler 的 fallbackIndex 一致。
 * <zh/> 在客户端分页 / 树形折叠场景下，全量索引与渲染数据索引产生分叉。
 *
 * <en/> Row key meta resolver — uses injected rowKeyMeta when available,
 * <en/> builds fallback Maps from data when missing.
 *
 * <en/> Row index domain: when data (render data) is available, keyToIndex is built from render data,
 * <en/> NOT from rowKeyMeta.keyToIndex (full tableData domain).
 * <en/> This ensures hoverRowIndex is always in the render-data domain, consistent with row event handlers' fallbackIndex.
 * <en/> Under client pagination / collapsed trees, the full-data index diverges from the render-data index.
 *
 * @remarks
 * <zh/> 从 use-hover-layer.ts 拆分，收敛 rowKeyMeta / rowKey / data 三者的 fallback 逻辑。
 * <zh/> 当 rowKeyMeta 未注入时，从 data + rowKey 构建 keyToRow / keyToIndex Map，
 * <zh/> 并通过引用比较跳过未变化 data 的 O(n) Map 重建。
 *
 * <en/> Extracted from use-hover-layer.ts, consolidating the fallback logic for
 * <en/> rowKeyMeta / rowKey / data. When rowKeyMeta is not injected, builds keyToRow / keyToIndex
 * <en/> Maps from data + rowKey, skipping O(n) Map rebuild via reference comparison when data is unchanged.
 */
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { RowKeyMeta } from '../../types/row-rect'
import { computed, toValue } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { normalizeRowKey } from '../../utils/normalize-row-key'

export interface UseRowKeyMetaResolverOptions {
  /** <zh/> 行键元数据（从 table.vue inject） | <en/> Row key metadata (injected from table.vue) */
  rowKeyMeta?: MaybeRefOrGetter<RowKeyMeta>
  /** <zh/> 行数据（rowKeyMeta 缺失时用于构建 fallback Map） | <en/> Row data (used to build fallback Map when rowKeyMeta is missing) */
  data?: MaybeRefOrGetter<readonly any[]>
  /** <zh/> 行键函数 | <en/> Row key function */
  rowKey?: MaybeRefOrGetter<(row: any) => string>
}

export interface UseRowKeyMetaResolverReturn {
  rowKeyToIndex: ComputedRef<Map<string, number>>
  keyToRow: ComputedRef<Map<string, any>>
  effectiveRowKey: ComputedRef<(row: any) => string>
}

/**
 * <zh/> 大数据量时跳过 fallback Map 构建的阈值 | <en/> Threshold for skipping fallback Map build on large data
 */
export const ROW_KEY_FALLBACK_LIMIT = 100_000

/**
 * <zh/> 创建行键元数据解析器
 *
 * <en/> Create the row key meta resolver.
 */
export function useRowKeyMetaResolver(options: UseRowKeyMetaResolverOptions): UseRowKeyMetaResolverReturn {
  const { rowKeyMeta: providedRowKeyMeta, data: providedData, rowKey: providedRowKey } = options

  // 运行时断言：确保 rowKeyMeta 被传入，避免 fallback Map 重建
  // Runtime assertion: ensure rowKeyMeta is provided, avoid fallback Map rebuild
  if (isDev && !providedRowKeyMeta) {
    devWarn(
      '[AdvTable] rowKeyMeta not provided to useHoverLayer — '
      + 'fallback map will be rebuilt on every data change.',
    )
  }

  const fallbackKeyFn = normalizeRowKey()

  /**
   * 缓存上一次 data 引用，用于 computed prev 复用判断。
   * 当 data 引用未变时跳过 Map 重建，避免 O(n) 开销。
   */
  let lastFallbackDataRef: readonly any[] | null = null

  const rowKeyMetaFallback = computed<{ keyToRow: Map<string, any>, keyToIndex: Map<string, number> }>((prev) => {
    const meta = toValue(providedRowKeyMeta)
    if (meta) {
      lastFallbackDataRef = null
      if (prev && prev.keyToRow === meta.keyToRow && prev.keyToIndex === meta.keyToIndex)
        return prev
      return { keyToRow: meta.keyToRow, keyToIndex: meta.keyToIndex }
    }
    const rowData = toValue(providedData)
    // data 引用未变时直接复用 prev，跳过 O(n) Map 重建 | Reuse prev when data reference unchanged, skip O(n) Map rebuild
    if (prev && lastFallbackDataRef === rowData) {
      return prev
    }
    lastFallbackDataRef = rowData ?? null

    const keyToRow = new Map<string, any>()
    const keyToIndex = new Map<string, number>()
    const rowKeyFn = toValue(providedRowKey) ?? fallbackKeyFn
    if (rowData) {
      if (rowData.length > ROW_KEY_FALLBACK_LIMIT) {
        if (isDev && typeof console !== 'undefined') {
          devWarn(
            `[AdvTable] Row key fallback map skipped: ${rowData.length} rows exceed limit (${ROW_KEY_FALLBACK_LIMIT}).`
            + ` Provide rowKeyMeta via table context for better performance.`,
          )
        }
      }
      else {
        for (let i = 0; i < rowData.length; i++) {
          const key = String(rowKeyFn(rowData[i]))
          keyToRow.set(key, rowData[i])
          keyToIndex.set(key, i)
        }
      }
    }
    return { keyToRow, keyToIndex }
  })

  const effectiveRowKey = computed<(row: any) => string>(() => {
    const rowKeyFn = toValue(providedRowKey)
    if (rowKeyFn)
      return rowKeyFn
    const meta = toValue(providedRowKeyMeta)
    if (meta?.keyFn)
      return meta.keyFn
    return fallbackKeyFn
  })

  /**
   * <zh/> 基于渲染数据构建的 keyToIndex/keyToRow Map（渲染数据域）。
   * <zh/> 单趟遍历同时构建两张 Map，供 dataKeyToIndex/dataKeyToRow 复用，
   * <zh/> 取代原先两个独立 O(n) computed。
   * <zh/> 使用 prev 引用短路：data 引用未变时复用上一次结果，跳过 O(n) Map 重建。
   *
   * <en/> keyToIndex/keyToRow Maps built from render data (render-data domain).
   * <en/> Single traversal builds both Maps, shared by dataKeyToIndex/dataKeyToRow,
   * <en/> replacing the two independent O(n) computeds.
   * <en/> Uses prev reference short-circuit: reuses last result when data reference is unchanged, skipping O(n) Map rebuild.
   */
  let lastDataKeyMetaRef: readonly any[] | null = null
  const dataKeyMeta = computed<{ keyToRow: Map<string, any>, keyToIndex: Map<string, number> }>((prev) => {
    const rowData = toValue(providedData)
    if (!rowData) {
      lastDataKeyMetaRef = null
      return prev ?? { keyToRow: new Map(), keyToIndex: new Map() }
    }
    if (prev && lastDataKeyMetaRef === rowData)
      return prev
    lastDataKeyMetaRef = rowData
    const rk = effectiveRowKey.value
    const keyToIndex = new Map<string, number>()
    const keyToRow = new Map<string, any>()
    if (rowData.length <= ROW_KEY_FALLBACK_LIMIT) {
      for (let i = 0; i < rowData.length; i++) {
        const key = String(rk(rowData[i]))
        keyToIndex.set(key, i)
        keyToRow.set(key, rowData[i])
      }
    }
    else if (isDev && typeof console !== 'undefined') {
      // <zh/> 渲染域索引超阈值降级——hover 层/事件 rowIndex 可能不可用，明确告警而非静默
      // <en/> Render-domain index degraded beyond threshold — hover/event rowIndex may be unavailable; warn explicitly
      devWarn(
        `[AdvTable] Render-domain row key index skipped: ${rowData.length} rows exceed limit (${ROW_KEY_FALLBACK_LIMIT}).`
        + ' hover/cell event rowIndex may be unavailable; provide rowKeyMeta or enable pagination.',
      )
    }
    return { keyToIndex, keyToRow }
  })

  const dataKeyToIndex = computed<Map<string, number>>(() => dataKeyMeta.value.keyToIndex)

  /**
   * <zh/> 基于渲染数据构建的 keyToRow Map（渲染数据域）
   * <zh/> 与 dataKeyToIndex 同源，复用同一趟遍历结果
   *
   * <en/> keyToRow Map built from render data (render-data domain)
   * <en/> Same source as dataKeyToIndex, reuses the same traversal result
   */
  const dataKeyToRow = computed<Map<string, any>>(() => dataKeyMeta.value.keyToRow)

  const rowKeyToIndex = computed(() => {
    // <zh/> 当 data（渲染数据）可用时，优先使用基于渲染数据构建的 keyToIndex，
    // <zh/> 而非 rowKeyMeta.keyToIndex（全量 tableData 域）。
    // <zh/> 这确保 hoverRowIndex 在渲染数据域内，与 row 事件 handler 的 fallbackIndex 一致。
    // <en/> When data (render data) is available, prefer keyToIndex built from render data,
    // <en/> NOT from rowKeyMeta.keyToIndex (full tableData domain).
    // <en/> This ensures hoverRowIndex is in the render-data domain, consistent with row event handlers' fallbackIndex.
    const data = toValue(providedData)
    if (data) {
      return dataKeyToIndex.value
    }
    const meta = toValue(providedRowKeyMeta)
    return meta ? meta.keyToIndex : rowKeyMetaFallback.value.keyToIndex
  })

  const keyToRow = computed(() => {
    // <zh/> 同 rowKeyToIndex：data 可用时优先使用渲染数据域的 keyToRow
    // <en/> Same as rowKeyToIndex: prefer render-data-domain keyToRow when data is available
    const data = toValue(providedData)
    if (data) {
      return dataKeyToRow.value
    }
    const meta = toValue(providedRowKeyMeta)
    return meta ? meta.keyToRow : rowKeyMetaFallback.value.keyToRow
  })

  return { rowKeyToIndex, keyToRow, effectiveRowKey }
}
