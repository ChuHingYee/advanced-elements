import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types/column'
import type { GroupAggregateColumnSpec, GroupHeaderRow, RowGroupApi, RowGroupConfig } from '../../types/config'
import type { GroupTotalRowOption, SuppressStickyTotalRow, TotalValueGetter } from '../../types/config-options'
import type { Translator } from '../../types/translator'
import { computed, isRef, shallowRef, toValue, watch } from 'vue'
import { computeGroupAggregates } from '../../utils/group-aggregates'
import { tf } from '../../utils/locale-fallback'
import { AUTO_KEY_NAME } from '../../utils/normalize-row-key'
import { computeRawAggregates } from '../../utils/summary-defaults'
import { isGroupHeaderRow as isSharedGroupHeaderRow } from '../../utils/synthetic-row'
import {
  buildGroupTotalRow,
  resolveGroupTotalPosition,
  resolveLabelProp,
  resolveTotalLabel,
  resolveTotalSticky,
} from '../../utils/total-rows'

/**
 * <zh/> 构造分组展开状态的复合 key——`(fieldIndex, field, value)` 三元组编码为字符串，
 * <zh/> 避免多字段分组时不同层级相同值互相联动（裸 value 共享的碰撞缺陷）。
 * <en/> Build a composite key for group expansion state — encodes the
 * <en/> (fieldIndex, field, value) triple, preventing cross-level collisions when
 * <en/> different fields share the same value (the bare-value sharing defect).
 */
function buildGroupKey(fieldIndex: number, field: string, value: unknown, parentKey = ''): string {
  const base = `${fieldIndex}__${field}__${String(value)}`
  return parentKey ? `${parentKey}⟩${base}` : base
}

export interface UseRowGroupOptions<T = any> {
  /** <zh/> 行分组配置 | <en/> Row group config */
  rowGroupConfig: MaybeRefOrGetter<RowGroupConfig | undefined>
  /** <zh/> 数据源 | <en/> Data source */
  data: MaybeRefOrGetter<T[]>
  /** <zh/> 外部受控的展开集合（用于 includeSynthetic=false 时共享状态） | <en/> External controlled expanded set (for includeSynthetic=false sharing) */
  expandedGroupValues?: ShallowRef<Set<string>>
  /**
   * <zh/> 聚合列集合（含 aggFunc）——对齐 AG Grid colDef.aggFunc，供分组小计行计算
   * <zh/> 未传时小计行仅渲染标签列（聚合值为空），组头 aggregates 仍按 aggregateColumns 计算
   * <en/> Aggregate columns (with aggFunc) — aligned with AG Grid colDef.aggFunc, for group total rows
   * <en/> When absent, total rows render the label only; header aggregates still follow aggregateColumns
   */
  columns?: MaybeRefOrGetter<readonly ProcessedColumn[] | undefined>
  /**
   * <zh/> 分组小计行——对齐 AG Grid groupTotalRow，字符串统一位置，回调按分组选择性返回
   * <en/> Group total rows — aligned with AG Grid groupTotalRow; string for uniform position, callback for selective per-group placement
   */
  groupTotalRow?: MaybeRefOrGetter<GroupTotalRowOption | undefined>
  /**
   * <zh/> 合计标签自定义——对齐 AG Grid totalValueGetter
   * <en/> Total label customization — aligned with AG Grid totalValueGetter
   */
  totalValueGetter?: MaybeRefOrGetter<TotalValueGetter | undefined>
  /**
   * <zh/> 合计标签回退文本（Grand 用 sumText，分组用 Sub Total）| <en/> Label fallback text
   */
  sumText?: MaybeRefOrGetter<string | undefined>
  /**
   * <zh/> 国际化翻译函数——用于 `sumText` 未设置时的合计标签回退（`table.summary`）。
   * <zh/> 未注入时回退内置中文。
   * <en/> i18n translator for the total-label fallback (`table.summary`) when `sumText` is unset.
   * <en/> When absent, historical behavior is preserved (built-in Chinese fallback).
   */
  t?: MaybeRefOrGetter<Translator | undefined>
  /**
   * <zh/> 粘性合计行抑制——对齐 AG Grid suppressStickyTotalRow
   * <en/> Sticky total suppression — aligned with AG Grid suppressStickyTotalRow
   */
  suppressStickyTotalRow?: MaybeRefOrGetter<SuppressStickyTotalRow | undefined>
  /**
   * <zh/> 保留组头聚合值——对齐 AG Grid groupSuppressBlankHeader，默认 false（有小计行时组头聚合置空）
   * <en/> Keep header aggregates — aligned with AG Grid groupSuppressBlankHeader, default false (blank header aggregates when a total row exists)
   */
  groupSuppressBlankHeader?: MaybeRefOrGetter<boolean | undefined>
}

export interface UseRowGroupReturn<T = any> {
  /** <zh/> 分组后的数据（含分组头行） | <en/> Grouped data (including group header rows) */
  groupedData: ComputedRef<T[]>
  /** <zh/> 行分组 API | <en/> Row group API */
  rowGroupApi: RowGroupApi
}

/**
 * <zh/> 读取可能为回调函数的选项——消除 MaybeRefOrGetter 与函数值的二义性：
 * <zh/> Ref 解包；无参函数视为 getter 调用；有参函数视为原始回调值
 * <zh/> （groupTotalRow/totalValueGetter 回调签名均带参，getter 均为无参）。
 * <en/> Read an option that may itself be a callback — resolves the MaybeRefOrGetter vs function-value ambiguity:
 * <en/> refs unwrap; zero-arg functions are invoked as getters; functions with params are kept as raw callbacks
 * <en/> (groupTotalRow/totalValueGetter callbacks take params, getters take none).
 */
function readFnOption<T>(src: MaybeRefOrGetter<T> | undefined): T | undefined {
  if (src == null)
    return undefined
  if (isRef(src))
    return (src as { value: T }).value
  if (typeof src === 'function')
    return (src as (...args: unknown[]) => unknown).length === 0 ? (src as () => T)() : (src as unknown as T)
  return src
}

/**
 * <zh/> 将数据按指定字段值分组，生成带分组头的行数组
 * <en/> Group data by specified field value, generating row array with group headers
 *
 * @remarks
 * <zh/> 分组头行作为 GroupHeaderRow 类型的特殊行插入到数据数组中，折叠的分组仅保留分组头行，展开的分组在分组头后紧跟数据行
 * <en/> Group header rows are inserted as special rows of type GroupHeaderRow into the data array, collapsed groups only keep the group header row, expanded groups have data rows following the group header
 *
 * @param options - <zh/> 分组配置和数据源 | <en/> group config and data source
 * @returns <zh/> 分组后的数据和行分组 API | <en/> grouped data and row group API
 */
export function useRowGroup<T = any>(options: UseRowGroupOptions<T>): UseRowGroupReturn<T> {
  const { rowGroupConfig, data } = options

  const groupEnabled = computed(() => toValue(rowGroupConfig) != null)
  const groupFields = computed<string[]>(() => {
    const config = toValue(rowGroupConfig)
    if (!config)
      return []
    return Array.isArray(config.field) ? config.field : [config.field]
  })

  const expandedGroupValues = options.expandedGroupValues ?? shallowRef<Set<string>>(new Set())

  function initExpandedGroups(config: RowGroupConfig, rows: T[]): Set<string> {
    if (config.defaultExpandAll !== false) {
      return collectAllGroupValues(rows, Array.isArray(config.field) ? config.field : [config.field])
    }
    /**
     * <zh/> 默认展开值归一化：外部传裸 value 数组，映射为复合 key。
     * <zh/> 多字段下对每个层级都尝试匹配该值（无法定位的层级跳过）。
     * <en/> Default-expand normalization: bare values are mapped to
     * <en/> composite keys, matched against every field level (unmatched levels skipped).
     */
    const defaults = config.defaultExpandedGroupValues ?? []
    if (defaults.length === 0)
      return new Set()
    const fields = Array.isArray(config.field) ? config.field : [config.field]
    const result = new Set<string>()
    for (const value of defaults) {
      for (let i = 0; i < fields.length; i++) {
        if (rows.some(row => (row as Record<string, unknown>)[fields[i]] === value)) {
          result.add(buildGroupKey(i, fields[i], value))
        }
      }
    }
    return result
  }

  watch(
    () => {
      const config = toValue(rowGroupConfig)
      if (!config)
        return null
      // 只追踪关键字段，避免因对象引用变化而重复初始化 | Track only key fields to avoid redundant re-initialization on object reference changes
      const fields = Array.isArray(config.field) ? config.field.join(',') : config.field
      return { fields, defaultExpandAll: config.defaultExpandAll, defaultExpanded: config.defaultExpandedGroupValues }
    },
    (tracked) => {
      if (!tracked)
        return
      const config = toValue(rowGroupConfig)!
      expandedGroupValues.value = initExpandedGroups(config, toValue(data))
    },
    { immediate: true },
  )

  function collectAllGroupValues(rows: T[], fields: string[], parentKey = '', fieldIndex = 0): Set<string> {
    if (fieldIndex >= fields.length)
      return new Set()
    const field = fields[fieldIndex]
    const groups = groupByField(rows, field)
    const result = new Set<string>()
    for (const [value, groupRows] of groups) {
      const key = buildGroupKey(fieldIndex, field, value, parentKey)
      result.add(key)
      // <zh/> 无 parent 前缀的短键同样收录——已持久化的展开状态可能为短键形态
      // <en/> Short keys without parent prefix are included too — persisted expanded state may use the short form
      result.add(buildGroupKey(fieldIndex, field, value))
      const childKeys = collectAllGroupValues(groupRows, fields, key, fieldIndex + 1)
      for (const k of childKeys)
        result.add(k)
    }
    return result
  }

  function groupByField(rows: T[], field: string): Map<unknown, T[]> {
    const groups = new Map<unknown, T[]>()
    for (const row of rows) {
      const value = (row as Record<string, unknown>)[field]
      if (!groups.has(value)) {
        groups.set(value, [])
      }
      groups.get(value)!.push(row)
    }
    return groups
  }

  /**
   * <zh/> 递归构建分组数据
   * <zh/> 多字段分组时，每个分组内部再按下一个字段分组
   * <zh/> 分组小计（AG Grid groupTotalRow）：展开的分组按决议位置在子级前/后插入合成小计行；
   * <zh/> 折叠分组仅保留组头（小计隐藏，组头聚合仍按 aggregateColumns 展示）。
   * <en/> Recursively build grouped data
   * <en/> For multi-field grouping, each group is further grouped by the next field
   * <en/> Group totals (AG Grid groupTotalRow): expanded groups insert a synthetic total row
   * <en/> before/after children per resolution; collapsed groups keep the header only.
   */
  function buildGroupedRows(
    rows: T[],
    fields: string[],
    fieldIndex: number,
    expandedValues: Set<string>,
    result: T[],
    parentKey = '',
    aggregateSpecs: GroupAggregateColumnSpec[] = [],
    totalCtx?: {
      columns: readonly ProcessedColumn[]
      groupTotalRow: GroupTotalRowOption | undefined
      totalValueGetter: TotalValueGetter | undefined
      sumText: string
      suppressSticky: SuppressStickyTotalRow | undefined
      keepHeaderAggregates: boolean
    },
  ): void {
    if (fieldIndex >= fields.length) {
      result.push(...rows)
      return
    }

    const field = fields[fieldIndex]
    const groups = groupByField(rows, field)

    for (const [groupValue, groupRows] of groups) {
      const flatKey = buildGroupKey(fieldIndex, field, groupValue)
      const hierarchicalKey = buildGroupKey(fieldIndex, field, groupValue, parentKey)
      const isExpanded = expandedValues.has(hierarchicalKey) || expandedValues.has(flatKey)
      const currentKey = `__group__${parentKey ? `${parentKey}⟩` : ''}${fieldIndex}_${field}__${String(groupValue)}`
      // <zh/> 聚合声明存在时对每组行集计算聚合（口径与汇总行一致，单趟 runSummaryPass 内核）
      // <en/> When aggregate specs exist, compute aggregates over the group's rows (summary-row caliber, single-pass runSummaryPass kernel)
      const aggregates = aggregateSpecs.length > 0
        ? computeGroupAggregates(groupRows as unknown as Record<string, unknown>[], aggregateSpecs)
        : undefined

      // <zh/> 小计位置决议——折叠分组不插入小计行（与 AG Grid 一致：折叠时仅组头可见）
      // <en/> Total position resolution — collapsed groups get no total row (matches AG Grid: header only when collapsed)
      let totalPosition: 'top' | 'bottom' | undefined
      if (totalCtx?.groupTotalRow && isExpanded) {
        totalPosition = resolveGroupTotalPosition(totalCtx.groupTotalRow, {
          level: fieldIndex,
          field,
          value: groupValue,
          key: hierarchicalKey,
          rowCount: groupRows.length,
        })
      }

      const headerRow: GroupHeaderRow<T> = {
        __isGroupHeader: true,
        __groupValue: groupValue,
        __groupCount: groupRows.length,
        __groupExpanded: isExpanded,
        __groupRows: groupRows,
        __groupField: field,
        __groupFieldIndex: fieldIndex,
        ...(aggregates !== undefined ? { __groupAggregates: aggregates } : {}),
        // <zh/> 小计可见性标记——供 headerRenderer / #groupHeader 插槽按需区分
        // <zh/> groupSuppressBlankHeader=false（默认）时组头聚合置空，避免与小计行重复
        // <en/> Total visibility flag for headerRenderer / #groupHeader slot consumers
        // <en/> groupSuppressBlankHeader=false (default) blanks header aggregates to avoid duplicating the total row
        ...(totalPosition ? { __groupTotalVisible: true } : {}),
        [AUTO_KEY_NAME]: currentKey,
      }
      if (totalPosition && !totalCtx!.keepHeaderAggregates && '__groupAggregates' in headerRow)
        delete (headerRow as Record<string, unknown>).__groupAggregates
      result.push(headerRow as unknown as T)

      if (isExpanded) {
        // <zh/> 小计行工厂——聚合口径与 Grand Total 一致（列 aggFunc，未设置回退 sum；合成行已排除，groupRows 为纯叶子）
        // <en/> Total row factory — same caliber as grand total (column aggFunc, 'sum' fallback; groupRows are pure leaves)
        const buildTotal = (): T | null => {
          if (!totalPosition || !totalCtx)
            return null
          const raw = computeRawAggregates(
            groupRows,
            totalCtx.columns.map(col => ({
              prop: (col as { prop?: string }).prop,
              aggFunc: (col as { aggFunc?: any }).aggFunc,
            })),
          )
          const label = resolveTotalLabel(
            { level: fieldIndex, value: groupValue, field, isGrandTotal: false },
            totalCtx.totalValueGetter,
            totalCtx.sumText,
          )
          return buildGroupTotalRow(raw, {
            position: totalPosition,
            field,
            value: groupValue,
            level: fieldIndex,
            groupKey: hierarchicalKey,
            label,
            sticky: resolveTotalSticky('group', totalCtx.suppressSticky),
            labelProp: resolveLabelProp(totalCtx.columns as readonly { prop?: string }[]),
            rowKey: `__groupTotal__${currentKey}__${totalPosition}`,
          }) as unknown as T
        }

        if (totalPosition === 'top') {
          const totalRow = buildTotal()
          if (totalRow)
            result.push(totalRow)
        }
        buildGroupedRows(groupRows, fields, fieldIndex + 1, expandedValues, result, currentKey, aggregateSpecs, totalCtx)
        if (totalPosition === 'bottom') {
          const totalRow = buildTotal()
          if (totalRow)
            result.push(totalRow)
        }
      }
    }
  }

  const groupedData = computed<T[]>((prev) => {
    const config = toValue(rowGroupConfig)
    const rows = toValue(data)

    if (!config || groupFields.value.length === 0) {
      if (prev && prev === rows)
        return prev
      return rows
    }

    // <zh/> 聚合声明在 computed 内读取——随配置响应式更新，经参数传入递归构建器
    // <en/> Aggregate specs are read inside the computed — reactive to config changes, passed into the recursive builder by parameter
    const aggregateSpecs = config.aggregateColumns ?? []
    const expanded = expandedGroupValues.value
    // <zh/> 小计上下文在 computed 内组装——列 aggFunc / groupTotalRow / totalValueGetter / sticky 均响应式追踪
    // <zh/> 回调型选项经 readFnOption 读取，避免 toValue 将回调误作 getter 调用
    // <en/> Total context assembled inside the computed — column aggFuncs / groupTotalRow / totalValueGetter / sticky all tracked reactively
    // <en/> Callback options go through readFnOption so toValue never invokes a callback as a getter
    const groupTotalOption = readFnOption(options.groupTotalRow)
    const totalCtx = groupTotalOption
      ? {
          columns: (toValue(options.columns) ?? []) as readonly ProcessedColumn[],
          groupTotalRow: groupTotalOption,
          totalValueGetter: readFnOption(options.totalValueGetter),
          sumText: toValue(options.sumText) ?? tf(toValue(options.t), 'table.summary', '合计'),
          suppressSticky: toValue(options.suppressStickyTotalRow),
          keepHeaderAggregates: toValue(options.groupSuppressBlankHeader) ?? false,
        }
      : undefined
    const result: T[] = []
    buildGroupedRows(rows, groupFields.value, 0, expanded, result, '', aggregateSpecs, totalCtx)

    if (prev && prev.length === result.length && prev.every((item, i) => item === result[i]))
      return prev
    return result
  })

  /**
   * <zh/> 切换分组展开/折叠。fieldIndex 用于多字段分组时唯一定位层级——
   * <zh/> 外部 API 单参调用时默认为第一级。
   * <en/> Toggle group expand/collapse. fieldIndex uniquely locates the level for
   * <en/> multi-field grouping — single-arg external calls default to the first level.
   */
  function toggleGroupExpand(groupValue: unknown, fieldIndex = 0): void {
    const fields = groupFields.value
    if (fieldIndex >= fields.length)
      return
    const key = buildGroupKey(fieldIndex, fields[fieldIndex], groupValue)
    const newSet = new Set(expandedGroupValues.value)
    if (newSet.has(key)) {
      newSet.delete(key)
    }
    else {
      newSet.add(key)
    }
    expandedGroupValues.value = newSet
  }

  function expandAllGroups(): void {
    const config = toValue(rowGroupConfig)
    if (!config)
      return
    expandedGroupValues.value = collectAllGroupValues(toValue(data), groupFields.value)
  }

  function collapseAllGroups(): void {
    expandedGroupValues.value = new Set()
  }

  const rowGroupApi: RowGroupApi = {
    groupEnabled,
    expandedGroupValues,
    toggleGroupExpand,
    expandAllGroups,
    collapseAllGroups,
    // <zh/> 判别逻辑收敛至 synthetic-row 唯一实现；此处仅保留 API 要求的类型谓词形态
    // <en/> Predicate logic converges in synthetic-row; only the API-required type-guard shape stays here
    isGroupHeaderRow: (row: unknown): row is GroupHeaderRow => isSharedGroupHeaderRow(row),
    groupFields,
  }

  return {
    groupedData,
    rowGroupApi,
  }
}
