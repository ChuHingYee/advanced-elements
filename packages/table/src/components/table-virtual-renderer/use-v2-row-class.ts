/**
 * <zh/> virtual 渲染器行类名
 * <en/> Virtual-renderer row class
 *
 * @remarks
 * <zh/> 职责单一：合成 ElTableV2 的 `row-class` 回调——合计行标记、合成行（span 展开/分组头）
 * <zh/> 类名、斑马纹、当前行高亮与用户自定义 rowClassName 的叠加。
 * <zh/> 顺序即优先级：合计行 > 合成行 > (斑马纹 + 当前行) > 自定义。
 * <en/> Single responsibility: compose ElTableV2's `row-class` callback — total-row markers, synthetic
 * <en/> row (span detail / group header) classes, striping, current-row highlight and the user's
 * <en/> custom rowClassName. Order is priority: totals > synthetic > (stripe + current) > custom.
 */
import type { ComputedRef } from 'vue'
import type { VirtualRendererProps } from '../../types/renderer'
import { computed } from 'vue'
import { isGrandTotalRow, isGroupTotalRow } from '../../utils/total-rows'
import { isAppendRowData } from './append-row-helpers'

/** <zh/> 行类名依赖 | <en/> Row-class deps */
export interface UseV2RowClassDeps<T = any> {
  /** <zh/> 渲染器 props | <en/> renderer props */
  props: VirtualRendererProps
  /** <zh/> 当前行键 | <en/> current row key */
  currentRowKey: ComputedRef<string | number | null>
  /** <zh/> 行键函数 | <en/> row key function */
  rowKeyFn: ComputedRef<(row: T) => string>
  /** <zh/> 合成行类名解析（来自 useSpanStrategy） | <en/> synthetic row class resolver (from useSpanStrategy) */
  getSyntheticRowClass: (rowData: unknown) => string | undefined
  /**
   * <zh/> 业务行索引解析（EP 索引 → 业务域索引）——条纹按业务奇偶，避免顶部合计行前插导致翻转；
   * <zh/> 缺省时回退 EP 索引（保持旧行为）
   * <en/> Business-row index resolver (EP index → business index) — stripe by business parity;
   * <en/> falls back to the EP index when absent
   */
  resolveBusinessIndex?: (rowData: unknown, epRowIndex: number) => number | undefined
}

/**
 * <zh/> 创建行类名回调
 * <en/> Create the row-class callback
 *
 * @remarks
 * <zh/> 依赖 stripe / highlightCurrentRow / rowClassName / stripe-row 与当前行键，
 * <zh/> 确保切换时生成新函数引用以触发 ElTableV2 重新计算。
 * <en/> Tracks stripe / highlightCurrentRow / rowClassName / the current row key so a switch
 * <en/> produces a new function reference and makes ElTableV2 recompute.
 */
export function useV2RowClass<T = any>(deps: UseV2RowClassDeps<T>) {
  const { props, currentRowKey, rowKeyFn, getSyntheticRowClass, resolveBusinessIndex } = deps

  const currentRowClass = computed(() => {
    const stripeOn = !!props.stripe
    const highlightOn = props.highlightCurrentRow !== false
    const custom = props.rowClassName
    const curKey = currentRowKey.value
    const keyFn = rowKeyFn.value
    // <zh/> late-binding 快照：解析器在 SFC 装配后才就绪，此处按次调用不固化
    // <en/> Late-bound snapshot: the resolver is ready after SFC assembly, invoke per row
    const resolveBusiness = resolveBusinessIndex
    return ({ rowData, rowIndex }: { columns: any, rowData: T, rowIndex: number }): string => {
      if (isAppendRowData(rowData))
        return ''
      const classes: string[] = []

      // <zh/> 合计行（Grand/Group）——独立标记类，跳过 stripe/highlight（与 AG Grid 总计行视觉区分一致，合计行不可选中高亮）
      // <en/> Total rows (grand/group) — dedicated marker classes, skipping stripe/highlight (matches AG Grid total-row distinction; totals are not selectable)
      const isTotalRow = isGrandTotalRow(rowData) || isGroupTotalRow(rowData)
      if (isGrandTotalRow(rowData)) {
        const r = rowData as unknown as { __grandPosition: string, __sticky: boolean }
        classes.push(`adv-table__grand-total adv-table__grand-total--${r.__grandPosition}${r.__sticky ? ' adv-table__total--sticky' : ' adv-table__total--static'}`)
      }
      else if (isGroupTotalRow(rowData)) {
        const r = rowData as unknown as { __groupTotalPosition: string, __sticky: boolean }
        classes.push(`adv-table__group-total adv-table__group-total--${r.__groupTotalPosition}${r.__sticky ? ' adv-table__total--sticky' : ' adv-table__total--static'}`)
      }

      const syntheticClass = getSyntheticRowClass(rowData)
      if (syntheticClass) {
        classes.push(syntheticClass)
      }
      else if (!isTotalRow) {
        // <zh/> 条纹按业务域奇偶：顶部合计行前插时 EP 索引整体+1，用业务索引保持与 default 模式一致
        // <en/> Stripe by business parity so a leading total row does not flip the pattern vs default mode
        const stripeIndex = resolveBusiness?.(rowData, rowIndex) ?? rowIndex
        if (stripeOn && stripeIndex % 2 === 1)
          classes.push('adv-table-v2__stripe-row')
        if (highlightOn && curKey != null) {
          if (keyFn(rowData) === curKey)
            // <zh/> 自有当前行语义类——但 EP 实际高亮类是裸
            // <zh/> `current-row`（见 utils/ep-selectors.ts 注记），旧字面量仅因样式侧同名规则自洽才显效；
            // <zh/> 改为自有类后发类/样式同属本包，命名空间无关，且不再伪装成 EP 内部类。
            // <en/> Owned current-row semantic class — previously the `el-table__row--current` literal, but
            // <en/> EP's real highlight class is the bare `current-row` (see the utils/ep-selectors.ts note);
            // <en/> the old literal only worked because the style side styled the same name. With an owned
            // <en/> class both sides belong to this package: namespace-independent, no longer impersonating
            // <en/> an EP internal class.
            classes.push('adv-table__row--current')
        }
      }

      if (typeof custom === 'function') {
        const result = custom({ row: rowData, rowIndex })
        if (result)
          classes.push(result)
      }
      else if (typeof custom === 'string' && custom) {
        classes.push(custom)
      }

      return classes.join(' ')
    }
  })

  return { currentRowClass }
}
