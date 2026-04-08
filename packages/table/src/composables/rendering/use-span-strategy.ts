/**
 * <zh/> 合并单元格策略 composable — 统一两种渲染器（default / virtual）的合成行 span 逻辑
 *
 * <zh/> 两种渲染器通过同一组函数获取合成行的 span 值和类名，避免重复实现。
 *
 * <en/> Span strategy composable — unifies synthetic-row span logic across both renderers (default / virtual)
 *
 * <en/> Both renderers obtain span values and class names through the same functions, avoiding duplicated logic.
 */
import type { MaybeRefOrGetter } from 'vue'
import type { RowExpandApi, RowGroupApi } from '../../types/config'
import { toValue } from 'vue'

/** <zh/> 合并单元格返回值 | <en/> Span method return value */
export interface SpanResult {
  rowspan: number
  colspan: number
}

/** <zh/> 合成行类型标识 | <en/> Synthetic row type identifier */
export type SyntheticRowType = 'detail' | 'groupHeader' | null

export interface UseSpanStrategyOptions {
  /** <zh/> 行展开 API | <en/> Row expand API */
  rowExpandApi?: RowExpandApi | undefined
  /** <zh/> 行分组 API | <en/> Row group API */
  rowGroupApi?: RowGroupApi | undefined
  /** <zh/> selection 列数量 | <en/> Number of selection columns */
  selectionColumnCount: MaybeRefOrGetter<number>
  /** <zh/> 普通列数量 | <en/> Number of normal columns */
  normalColumnCount: MaybeRefOrGetter<number>
}

export type UserSpanMethod = (params: { row: any, column: any, rowIndex: number, columnIndex: number }) => SpanResult | undefined
export type UserRowClassName = ((params: { row: any, rowIndex: number }) => string) | string | undefined

export interface UseSpanStrategyReturn {
  /**
   * <zh/> 判断行是否为合成行（展开行或分组头行）
   * <en/> Determine if a row is synthetic (detail expand row or group header row)
   */
  getSyntheticRowType: (row: any) => SyntheticRowType
  /**
   * <zh/> 获取合成行的 span 值。非合成行返回 undefined，由调用方回退到用户 spanMethod
   * <en/> Get span values for a synthetic row. Returns undefined for regular rows, caller falls back to user spanMethod
   */
  getSyntheticRowSpan: (row: any, columnIndex: number) => SpanResult | undefined
  /**
   * <zh/> 获取合成行的 CSS 类名
   * <en/> Get CSS class name for a synthetic row
   */
  getSyntheticRowClass: (row: any) => string
  /**
   * <zh/> 合并后的 span-method（供 ElTable 的 span-method 属性直接使用）
   * <zh/> 先检查合成行，再回退到用户自定义 spanMethod
   * <en/> Merged span method (for ElTable's span-method prop)
   * <en/> Checks synthetic rows first, then falls back to user's custom spanMethod
   */
  mergedSpanMethod: (params: { row: any, column: any, rowIndex: number, columnIndex: number }) => SpanResult
  /**
   * <zh/> 合并后的行类名（供 ElTable 的 row-class-name 或 ElTableV2 的 row-class 使用）
   * <zh/> 先添加合成行类名，再合并用户自定义 rowClassName
   * <en/> Merged row class name (for ElTable's row-class-name or ElTableV2's row-class)
   * <en/> Adds synthetic row class first, then merges user's custom rowClassName
   */
  mergedRowClassName: (params: { row: any, rowIndex: number }) => string
}

/**
 * <zh/> 创建合并单元格策略
 *
 * <zh/> 两种渲染器共用此策略：
 * <zh/> - **default 模式**：`mergedSpanMethod` 直接传给 ElTable 的 `span-method`，`mergedRowClassName` 传给 `row-class-name`
 * <zh/> - **virtual 模式**：`getSyntheticRowType` / `getSyntheticRowSpan` 用于 SpanRow 组件的 VNode 改写决策，
 * <zh/>   `getSyntheticRowClass` 用于 `currentRowClass` 行类名函数
 *
 * <en/> Create span strategy
 *
 * <en/> Both renderers share this strategy:
 * <en/> - **default mode**: `mergedSpanMethod` is passed directly to ElTable's `span-method`, `mergedRowClassName` to `row-class-name`
 * <en/> - **virtual mode**: `getSyntheticRowType` / `getSyntheticRowSpan` are used by the SpanRow component's VNode rewrite decisions,
 * <en/>   `getSyntheticRowClass` is used by the `currentRowClass` row-class function
 */
export function useSpanStrategy(
  options: UseSpanStrategyOptions,
  userSpanMethod?: () => UserSpanMethod | undefined,
  userRowClassName?: () => UserRowClassName,
): UseSpanStrategyReturn {
  const { rowExpandApi, rowGroupApi, selectionColumnCount, normalColumnCount } = options

  function getSyntheticRowType(row: any): SyntheticRowType {
    if (rowExpandApi?.expandEnabled.value && rowExpandApi.isDetailRow(row))
      return 'detail'
    if (rowGroupApi?.groupEnabled.value && rowGroupApi.isGroupHeaderRow(row))
      return 'groupHeader'
    return null
  }

  function getSyntheticRowSpan(row: any, columnIndex: number): SpanResult | undefined {
    const rowType = getSyntheticRowType(row)
    if (rowType === null)
      return undefined

    if (rowType === 'detail') {
      // 展开行：合并所有列（含 selection 列）
      // Expand row: merge all columns (including the selection column)
      const totalCols = toValue(selectionColumnCount) + toValue(normalColumnCount)
      if (columnIndex === 0)
        return { rowspan: 1, colspan: totalCols }
      return { rowspan: 0, colspan: 0 }
    }

    // 分组头行：selection 列保持独立，normal 列合并
    // Group header row: keep the selection column independent, merge normal columns
    const selCount = toValue(selectionColumnCount)
    const normalCount = toValue(normalColumnCount)
    if (columnIndex === selCount)
      return { rowspan: 1, colspan: normalCount }
    if (columnIndex > selCount)
      return { rowspan: 0, colspan: 0 }
    return { rowspan: 1, colspan: 1 }
  }

  function getSyntheticRowClass(row: any): string {
    const rowType = getSyntheticRowType(row)
    if (rowType === 'detail')
      return 'adv-table__detail-row'
    if (rowType === 'groupHeader')
      return 'adv-table__group-header-row'
    return ''
  }

  function mergedSpanMethod(params: { row: any, column: any, rowIndex: number, columnIndex: number }): SpanResult {
    const syntheticSpan = getSyntheticRowSpan(params.row, params.columnIndex)
    if (syntheticSpan !== undefined)
      return syntheticSpan
    const spanMethod = userSpanMethod?.()
    return spanMethod?.(params) ?? { rowspan: 1, colspan: 1 }
  }

  function mergedRowClassName(params: { row: any, rowIndex: number }): string {
    const classes: string[] = []
    const syntheticClass = getSyntheticRowClass(params.row)
    if (syntheticClass)
      classes.push(syntheticClass)

    // 合并用户自定义 rowClassName
    // Merge user-defined rowClassName
    const custom = userRowClassName?.()
    if (typeof custom === 'function') {
      const result = custom({ row: params.row, rowIndex: params.rowIndex })
      if (result)
        classes.push(result)
    }
    else if (typeof custom === 'string' && custom) {
      classes.push(custom)
    }

    return classes.join(' ')
  }

  return {
    getSyntheticRowType,
    getSyntheticRowSpan,
    getSyntheticRowClass,
    mergedSpanMethod,
    mergedRowClassName,
  }
}
