import type { GroupAggregateColumnSpec, GroupAggregates } from '../types/config-tree'
import type { SummaryWorkItem } from './summary-defaults'
import { runSummaryPass } from './summary-defaults'

/**
 * <zh/> 生成聚合结果的稳定键：`${field}:${agg}`——供 __groupAggregates、headerRenderer
 * <zh/> 与 #groupHeader 插槽三方使用同一命名约定。自定义函数 agg 以其函数名落键，
 * <zh/> 匿名函数回退 'custom'。
 *
 * <en/> Build the stable aggregate result key `${field}:${agg}` — the single naming convention
 * <en/> shared by __groupAggregates, headerRenderer and the #groupHeader slot. Custom-function
 * <en/> aggs key by their function name, anonymous functions fall back to 'custom'.
 */
export function getGroupAggregateKey(field: string, agg: string | ((values: unknown[], rows: any[]) => unknown)): string {
  const suffix = typeof agg === 'function' ? (agg.name || 'custom') : agg
  return `${field}:${suffix}`
}

/**
 * <zh/> 对一组数据行按声明计算聚合值（纯函数），单趟委托 summary-defaults 的 runSummaryPass。
 *
 * <zh/> - sum: 有效数值求和；avg: 有效数值均值（分母为有效个数，非总行数）
 * <zh/> - min/max: 有效数值的最小/最大
 * <zh/> - count: 行数（rows.length，与 summary/AG Grid count 同口径）
 * <zh/> - first/last: 首个/末个 !== undefined 的单元格值（含 null），全 undefined 时 null
 * <zh/> - 自定义函数：透传 (values, rows)，异常时 null
 * <zh/> - 组内无可数值时结果为 null（区别于合法的 0；count 除外）
 * <zh/> - 字段缺失/undefined 视为非数值，不参与统计
 * <zh/> - 数值口径与汇总行同一标准：仅 typeof 'number' 且非 NaN 的单元格参与 sum/avg/min/max
 *
 * <en/> Compute declared aggregates over a group's rows (pure function), delegating in one
 * <en/> pass to runSummaryPass in summary-defaults.
 *
 * <en/> - sum: sums valid numbers; avg: mean over VALID count (not total row count)
 * <en/> - min/max: smallest/largest among valid numbers
 * <en/> - count: row count (rows.length, same caliber as summary/AG Grid count)
 * <en/> - first/last: first/last !== undefined cell value (null included), null when all undefined
 * <en/> - custom fn: passthrough (values, rows), null on exception
 * <en/> - null when the group has no valid numbers (distinct from a legitimate 0; except count)
 * <en/> - missing fields/undefined count as non-numeric and are skipped
 * <en/> - numeric caliber identical to summary rows: only typeof 'number' non-NaN cells feed sum/avg/min/max
 */
export function computeGroupAggregates<T extends Record<string, unknown>>(
  rows: readonly T[],
  specs: readonly GroupAggregateColumnSpec[],
): GroupAggregates {
  const aggregates: GroupAggregates = {}
  if (specs.length === 0 || rows.length === 0)
    return aggregates

  // <zh/> 单趟聚合——与逐列取值 + computeColumnAggregate 等价，sum/avg/min/max 数值不变；
  // <zh/> count 免取值（get 传 null，O(1)），自定义列由内核物化值数组。
  // <en/> Single-pass aggregation — equivalent to per-column extraction + computeColumnAggregate
  // <en/> with identical sum/avg/min/max numbers; count skips extraction (null get, O(1)),
  // <en/> custom columns materialize value arrays inside the kernel.
  const items: SummaryWorkItem<T>[] = specs.map((spec) => {
    if (spec.agg === 'count')
      return { get: null, agg: 'count' }
    return { get: row => row[spec.field], agg: spec.agg as SummaryWorkItem<T>['agg'] }
  })
  const raws = runSummaryPass(rows, items)

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!
    aggregates[getGroupAggregateKey(spec.field, spec.agg as string)] = raws[i]
  }

  return aggregates
}
