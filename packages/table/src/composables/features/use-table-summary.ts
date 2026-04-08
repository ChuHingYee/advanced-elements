import type { MaybeRefOrGetter, VNode } from 'vue'
import type { ProcessedColumn } from '../../types'
import { computed, toValue } from 'vue'
import { mapsShallowEqual } from '../../utils/equality'
import { tf } from '../../utils/locale-fallback'
import { getColumnKey, resolveColumnProp } from '../../utils/shared'
import { buildDefaultSummaryRow, formatRawAggregatesToFooter } from '../../utils/summary-defaults'

/**
 * <zh/> useTableSummary 选项
 * <en/> useTableSummary options
 */
export interface UseTableSummaryOptions<T = any> {
  /**
   * <zh/> 当前渲染的数据（如已分页/筛选的数据）
   * <en/> Current rendered data (e.g. after pagination/filtering)
   */
  data: MaybeRefOrGetter<T[]>
  /**
   * <zh/> 所有列（含 selection 列），用于 summaryMethod 和默认计算
   * <en/> All columns (including selection), used for summaryMethod and default calculation
   */
  columns: MaybeRefOrGetter<ProcessedColumn[]>
  /**
   * Whether to show summary row
   * 是否显示合计行
   */
  showSummary: MaybeRefOrGetter<boolean>
  /**
   * Text displayed in first column of summary row
   * 合计行第一列显示的文本
   */
  sumText?: MaybeRefOrGetter<string>
  /** 国际化翻译函数，sumText 未提供时使用 t('table.summary') 作为 fallback */
  t?: (path: string) => string
  summaryMethod?: (params: { columns: ProcessedColumn[], data: T[] }) => (string | VNode)[]
  /**
   * <zh/> 共享原始聚合（单趟化：调用方已算好的 Grand 聚合，表尾直接格式化复用，零重算）。
   * <zh/> 仅在无自定义 summaryMethod 时生效；提供后默认合计不再遍历数据。
   * <en/> Shared raw aggregates (single-pass: caller-provided grand aggregates reused
   * <en/> by the footer via formatting, zero recomputation). Only applies without a custom
   * <en/> summaryMethod; the default path no longer traverses data when provided.
   */
  sharedAggregates?: MaybeRefOrGetter<Record<string, unknown> | null | undefined>
}

/**
 * 合计行 composable — 根据列配置和数据计算合计值，支持自定义合计方法。
 *
 * @param options - 合计配置
 * @returns 合计数据响应式引用
 */
export function useTableSummary<T>(options: UseTableSummaryOptions<T>) {
  const { data, columns, showSummary, sumText, summaryMethod, t, sharedAggregates } = options

  /**
   * <zh/> summaryData 按 col.prop 存储每列的合计值。
   * <zh/> 无 prop 的列（如 selection）不参与存储，但其索引位置在 summaryMethod 中保持对齐。
   * <en/> summaryData stores each column's summary value by col.prop.
   * <en/> Columns without prop (e.g. selection) are excluded from storage, but their index positions remain aligned in summaryMethod.
   */
  const summaryData = computed<Record<string, string | VNode>>((prev) => {
    const shouldShow = toValue(showSummary)
    if (!shouldShow) {
      if (prev && Object.keys(prev).length === 0)
        return prev
      return {}
    }

    const currentData = toValue(data)
    const currentColumns = toValue(columns)

    if (summaryMethod) {
      /**
       * <zh/> ElTable 内部列对象有 .property 字段（等同于 .prop），
       * <zh/> 但 ProcessedColumn 只有 .prop。补上 .property 别名。
       * <zh/> summaryMethod 返回数组索引对应全部列（含 selection），
       * <zh/> 用 col.prop 存储结果保证值对齐到正确的数据列。
       * <en/> ElTable's internal column object has .property field (equivalent to .prop),
       * <en/> but ProcessedColumn only has .prop. Add .property alias.
       * <en/> summaryMethod return array indices correspond to all columns (including selection),
       * <en/> storing results by col.prop ensures values align to the correct data columns.
       */
      const columnsWithProperty = currentColumns.map(col => ({
        ...col,
        // <zh/> 数据字段域优先，无 prop 的 key-only 列（如 selection）回退列键，保证索引对齐
        // <en/> Data-field domain first; key-only columns without prop (e.g. selection) fall back to column key to keep index alignment
        property: resolveColumnProp(col as unknown as Record<string, any>) ?? getColumnKey(col as unknown as Record<string, any>),
      }))
      const result = summaryMethod({ columns: columnsWithProperty, data: currentData })
      const summaryMap: Record<string, string | VNode> = {}
      currentColumns.forEach((col, index) => {
        if (result[index] === undefined)
          return
        // 有 prop 用 prop，无 prop（如 selection 列）用 column key | Use prop if available, otherwise use column key (e.g. for selection column without prop)
        const key = resolveColumnProp(col as unknown as Record<string, any>) ?? getColumnKey(col as unknown as Record<string, any>)
        if (key)
          summaryMap[key] = result[index]
      })
      if (prev && Object.keys(summaryMap).every(k => prev[k] === summaryMap[k]) && Object.keys(prev).length === Object.keys(summaryMap).length)
        return prev
      return summaryMap
    }

    const summaryMap: Record<string, string | VNode> = {}

    // <zh/> 默认合计——有共享原始聚合时直接格式化复用（与 Grand 合并为单趟，零重算）；
    // <zh/> 无共享时回退单趟 buildDefaultSummaryRow（与 default 模式 summaryMethod 兜底同实现，
    // <zh/> 保证两模式同名配置口径一致）。映射为最小列描述以对齐工具入参形状（含 aggFunc，AG Grid 对齐）。
    // <en/> Default summary — formats shared raw aggregates when available (merged
    // <en/> with grand into one pass, zero recomputation); otherwise falls back to single-pass
    // <en/> buildDefaultSummaryRow (same implementation as the default-mode summaryMethod
    // <en/> fallback, keeping both modes' caliber identical).
    const label = toValue(sumText) ?? tf(t, 'table.summary', '合计')
    const shared = sharedAggregates ? toValue(sharedAggregates) : undefined
    const sums = (!summaryMethod && shared)
      ? formatRawAggregatesToFooter(
          shared,
          currentColumns.map(col => ({ prop: col.prop, aggFunc: (col as { aggFunc?: any }).aggFunc })),
          label,
        )
      : buildDefaultSummaryRow(
          currentColumns.map(col => ({ prop: col.prop, aggFunc: (col as { aggFunc?: any }).aggFunc })),
          currentData,
          label,
        )
    currentColumns.forEach((col, index) => {
      // <zh/> 空串是合法合计值（该列无有效数字）——必须落键，不能用真值判断跳过，
      // <zh/> 约束：跳过落键即导致消费方读取 summaryData[col.prop] 得到 undefined 而非 ''。
      // <en/> Empty string IS a legitimate summary value (column had no valid numbers) — the key
      // <en/> must be written; constraint: skipping the write makes consumers read undefined instead
      // <en/> of ''.
      if (col.prop && sums[index] != null)
        summaryMap[col.prop] = sums[index]
    })

    if (prev && Object.keys(summaryMap).every(k => prev[k] === summaryMap[k]) && Object.keys(prev).length === Object.keys(summaryMap).length)
      return prev
    return summaryMap
  })

  /**
   * <zh/> summaryValueMap 按 column key 存储，供 getSummaryValue 按 V2 列 key 查找。
   * <zh/> 查找时先试 col.prop（summaryData 的 key），再回退到 column key。
   * <en/> summaryValueMap stores by column key, for getSummaryValue to look up by V2 column key.
   * <en/> Lookup first tries col.prop (summaryData's key), then falls back to column key.
   */
  const summaryValueMap = computed<Map<string, string | VNode>>((prev) => {
    const map = new Map<string, string | VNode>()
    const data = summaryData.value
    const cols = toValue(columns)
    for (const col of cols) {
      const key = getColumnKey(col)
      const prop = col.prop
      const value = (prop && data[prop]) ?? (key && data[key])
      if (value !== undefined) {
        map.set(key, value)
      }
    }
    if (prev && mapsShallowEqual(prev, map))
      return prev
    return map
  })

  /**
   * <zh/> 根据列对象获取合计值
   * @param col - <zh/> 列配置（支持 ProcessedColumn 和 EP Column 等任意含 key/prop 的对象） | <en/> column config (supports ProcessedColumn and EP Column etc., any object with key/prop)
   */
  function getSummaryValue(col: Record<string, any>): string | VNode | undefined {
    const key = getColumnKey(col)
    return summaryValueMap.value.get(key)
  }

  return {
    summaryData,
    getSummaryValue,
  }
}
