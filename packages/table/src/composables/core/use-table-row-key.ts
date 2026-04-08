/**
 * <zh/> 行 key 与样式子 composable | <en/> Row key & styles sub-composable
 *
 * <zh/> 从 useAdvTableCore 拆分，管理行键函数、CSS 变量、可选行判断。
 * <en/> Extracted from useAdvTableCore, manages row key function, CSS variables, and row selectability.
 */
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { AdvColumn } from '../../types/column'
import type { RowConfig } from '../../types/config'
import { computed, toValue } from 'vue'
import { normalizeRowKey } from '../../utils/normalize-row-key'

export interface UseTableRowKeyReturn {
  rowKeyFn: ComputedRef<(row: any) => string>
  /**
   * <zh/> 显式字段型 rowKey 的字段名：string/number/symbol 输入时原样透出，
   * <zh/> 供 virtual 渲染器直接传给 EP `:row-key`（EP 按属性名读取，冻结行无需写入 AUTO_KEY）。
   * <zh/> 函数/auto 输入时为 undefined，EP 回退 AUTO_KEY_NAME（冻结行仅 dev 告警）。
   * <en/> Field name of an explicit field-style rowKey: string/number/symbol inputs pass through as-is,
   * <en/> for the virtual renderer to hand directly to EP `:row-key` (EP reads by property name; frozen rows need no AUTO_KEY writes).
   * <en/> Function/auto inputs yield undefined and EP falls back to AUTO_KEY_NAME (frozen rows only warn in dev).
   */
  rowKeyField: ComputedRef<string | number | symbol | undefined>
  sizeCssVars: ComputedRef<Record<string, string>>
  selectableFn: ComputedRef<((row: any, index: number) => boolean) | undefined>
}

/**
 * <zh/> 行 key 输入——窄切片，替代既往 `props: AdvTableProps` 全量透传（ISP 试点）
 * <zh/> 仅声明本模块实际读取的两个字段：rowKey 配置与列集合
 * <en/> Narrow row-key input — replaces the former `props: AdvTableProps` passthrough (ISP pilot)
 * <en/> Declares only the two fields this module actually reads: the rowKey config and the column list
 */
export interface UseTableRowKeyOptions<T> {
  /** <zh/> 行 key 配置（等价既往 `props.rowConfig?.rowKey`） | <en/> Row key config (equivalent to the former `props.rowConfig?.rowKey`) */
  rowKeyInput: MaybeRefOrGetter<RowConfig<T>['rowKey']>
  /** <zh/> 列集合（等价既往 `props.columns`，用于定位 selection 列的 selectable） | <en/> Column list (equivalent to the former `props.columns`, used to locate the selection column's selectable) */
  columns: MaybeRefOrGetter<AdvColumn<T>[] | undefined>
  /** <zh/> 来自 useTableErrorHandler 的 devWarn | <en/> devWarn from useTableErrorHandler */
  devWarn: ReturnType<typeof import('../../utils/error-handler')['createTableErrorHandler']>['devWarn']
  /** <zh/> 来自 useTableConfig 的 mergedSizeConfig | <en/> mergedSizeConfig from useTableConfig */
  mergedSizeConfig: ComputedRef<{
    headerCellHeight: number
    cellPadding: string
    headerCellPadding: string
    floatingFilterHeight: number
    cellFontSize: string
    rowHeight: number
    summaryRowHeight: number
  }>
}

export function useTableRowKey<T>(options: UseTableRowKeyOptions<T>): UseTableRowKeyReturn {
  const { rowKeyInput, columns, devWarn, mergedSizeConfig } = options

  const rowKeyFn = computed(() => normalizeRowKey(toValue(rowKeyInput), devWarn))

  const rowKeyField = computed(() => {
    const input = toValue(rowKeyInput)
    return typeof input === 'string' || typeof input === 'number' || typeof input === 'symbol'
      ? input
      : undefined
  })

  const sizeCssVars = computed(() => ({
    '--adv-table-header-cell-height': `${mergedSizeConfig.value.headerCellHeight}px`,
    '--adv-table-cell-padding': mergedSizeConfig.value.cellPadding,
    '--adv-table-header-cell-padding': mergedSizeConfig.value.headerCellPadding,
    '--adv-table-floating-filter-height': `${mergedSizeConfig.value.floatingFilterHeight}px`,
    '--adv-table-cell-font-size': mergedSizeConfig.value.cellFontSize,
    '--adv-table-row-height': `${mergedSizeConfig.value.rowHeight}px`,
    '--adv-table-summary-row-height': `${mergedSizeConfig.value.summaryRowHeight}px`,
  }))

  const selectableFn = computed(() => {
    const col = toValue(columns)?.find(c => c.selection)
    return col?.selectable
  })

  return { rowKeyFn, rowKeyField, sizeCssVars, selectableFn }
}
