/**
 * @file summary-defaults.ts
 * @description
 * <zh/> 默认合计行算法——default（ElTable summaryMethod）与 virtual（useTableSummary）
 * <zh/> 两种渲染模式共享的单一真相实现，保证同名配置在两模式下汇总口径一致。
 *
 * <zh/> 语义（与 use-table-summary 同口径）：
 * <zh/> - 第一个含 prop 的列显示 sumText；
 * <zh/> - 其余含 prop 的列对数据做数值求和（仅 typeof === 'number' 且非 NaN 参与累计），
 * <zh/>   整列无有效数字时输出空串；
 * <zh/> - 不含 prop 的列（如选择列）输出空串。
 *
 * <en/> Default summary-row algorithm — single source of truth shared by the default
 * <en/> (ElTable summaryMethod) and virtual (useTableSummary) render modes so that the same
 * <en/> config yields an identical aggregation caliber in both modes.
 *
 * <en/> Semantics (aligned with the historical use-table-summary behavior):
 * <en/> - The first column bearing a prop renders `sumText`;
 * <en/> - Every other prop-bearing column sums numeric cells (only typeof === 'number' and
 * <en/>   non-NaN values accumulate); a column with no valid number yields an empty string;
 * <en/> - Columns without a prop (e.g. selection) yield an empty string.
 */

/** <zh/> 参与合计的列描述（仅需 prop 标识） | <en/> Column descriptor participating in summarization (only prop identity is needed) */
export interface DefaultSummaryColumnLike {
  prop?: string
  /**
   * <zh/> 列聚合函数——对齐 AG Grid colDef.aggFunc，未设置时回退 'sum'
   * <en/> Column aggregate function — aligned with AG Grid colDef.aggFunc, falls back to 'sum' when unset
   */
  aggFunc?: AggFuncLike
  /**
   * <zh/> 自定义取值——存在时优先于 prop 取值（如 valueGetter 列）
   * <en/> Custom value accessor — wins over prop lookup when present (e.g. valueGetter columns)
   */
  getValue?: (row: any, rowIndex: number) => unknown
}

/**
 * <zh/> 聚合函数名——对齐 AG Grid 内置 aggFunc
 * <en/> Aggregate function names — aligned with AG Grid built-in aggFuncs
 */
export type AggFuncName = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last'

/**
 * <zh/> 聚合函数——内置名或自定义归约 (values, rows) => 结果
 * <zh/> rows 取可变 `any[]` 而非 readonly：调用方持 readonly 源，断言为单点收敛（computeColumnAggregate 内两处）；
 * <zh/> 若收窄为 readonly，已有用户自定义函数 `(v, r: any[]) => x` 将因逆变失效，属破坏性变更，故保持。
 * <en/> Aggregate function — built-in name or custom reducer (values, rows) => result
 * <en/> rows stays mutable `any[]` instead of readonly: callers hold readonly sources with assertions converged
 * <en/> at the two call sites inside computeColumnAggregate; narrowing to readonly would break existing user
 * <en/> functions via contravariance, so it stays.
 */
export type AggFuncLike = AggFuncName | ((values: unknown[], rows: any[]) => unknown)

/**
 * <zh/> 对单列值数组执行聚合——数值口径规范（仅 typeof number 且非 NaN 参与 sum/avg/min/max）
 * <zh/> - sum：有效数值求和，无有效数值时返回 null（调用方转空串）
 * <zh/> - avg：有效数值均值（分母为有效个数），无有效数值时 null
 * <zh/> - min/max：有效数值最小/最大，无有效数值时 null
 * <zh/> - count：行数（rows.length，与 AG Grid count 语义对齐）
 * <zh/> - first/last：首个/末个 !== undefined 的单元格值（含 null），全 undefined 时 null
 * <zh/> - 自定义函数：透传 (values, rows)，捕获异常时返回 null（避免单列失败污染整行）
 * <en/> Aggregate one column's values — numeric caliber is canonical (only typeof number non-NaN for sum/avg/min/max)
 * <en/> - sum: sum of valid numbers, null when none (caller maps to '')
 * <en/> - avg: mean over valid count, null when none
 * <en/> - min/max: smallest/largest valid number, null when none
 * <en/> - count: row count (rows.length, aligned with AG Grid count)
 * <en/> - first/last: first/last !== undefined cell value (null included), null when all undefined
 * <en/> - custom fn: passthrough (values, rows), exceptions caught to null (one bad column must not poison the row)
 */
export function computeColumnAggregate(values: readonly unknown[], rows: readonly any[], agg: AggFuncLike | undefined): unknown {
  const func: AggFuncLike = agg ?? 'sum'
  if (typeof func === 'function') {
    try {
      return func(values as unknown[], rows as any[])
    }
    catch {
      return null
    }
  }
  switch (func) {
    case 'count':
      return rows.length
    case 'first': {
      for (const v of values) {
        if (v !== undefined)
          return v
      }
      return null
    }
    case 'last': {
      for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] !== undefined)
          return values[i]
      }
      return null
    }
    case 'avg': {
      let sum = 0
      let count = 0
      for (const v of values) {
        if (typeof v === 'number' && !Number.isNaN(v)) {
          sum += v
          count++
        }
      }
      return count === 0 ? null : sum / count
    }
    case 'min': {
      let min = Number.POSITIVE_INFINITY
      let found = false
      for (const v of values) {
        if (typeof v === 'number' && !Number.isNaN(v)) {
          if (v < min)
            min = v
          found = true
        }
      }
      return found ? min : null
    }
    case 'max': {
      let max = Number.NEGATIVE_INFINITY
      let found = false
      for (const v of values) {
        if (typeof v === 'number' && !Number.isNaN(v)) {
          if (v > max)
            max = v
          found = true
        }
      }
      return found ? max : null
    }
    case 'sum':
    default: {
      let sum = 0
      let found = false
      for (const v of values) {
        if (typeof v === 'number' && !Number.isNaN(v)) {
          sum += v
          found = true
        }
      }
      return found ? sum : null
    }
  }
}

/**
 * <zh/> 读取单列在行集上的原始值数组——优先 getValue，其次 prop；缺失 prop 且无 getValue 时返回空数组
 * <en/> Read one column's raw values over a row set — getValue first, then prop; empty array when neither exists
 */
export function readColumnValues<T>(rows: readonly T[], col: DefaultSummaryColumnLike, prop: string | undefined): unknown[] {
  if (col.getValue) {
    const out: unknown[] = []
    for (let i = 0; i < rows.length; i++) {
      try {
        out.push(col.getValue(rows[i], i))
      }
      catch {
        out.push(undefined)
      }
    }
    return out
  }
  if (!prop)
    return []
  const out: unknown[] = []
  for (const row of rows as readonly Record<string, unknown>[]) {
    out.push((row as Record<string, unknown> | null | undefined)?.[prop])
  }
  return out
}

/**
 * <zh/> 将聚合原始值格式化为表尾字符串——null/undefined 转空串，其余 String(value)
 * <en/> Format a raw aggregate into a footer string — null/undefined to '', others via String(value)
 */
export function formatAggregateValue(value: unknown): string {
  if (value == null)
    return ''
  return String(value)
}

/**
 * <zh/> 单趟聚合工作项——调用方先按自身跳过规则过滤列，再委托 runSummaryPass。
 * <en/> Single-pass aggregation work item — callers filter columns by their own skip rules first,
 * <en/> then delegate to runSummaryPass.
 */
export interface SummaryWorkItem<T = any> {
  /**
   * <zh/> 逐行取值器（语义与 readColumnValues 逐元素一致，含 getValue 的 try/catch）。
   * <zh/> 内置 'count' 列传 null（免取值，O(1)）。
   * <en/> Per-row value accessor (element-wise identical to readColumnValues, including getValue try/catch).
   * <en/> Built-in 'count' columns pass null (no extraction, O(1)).
   */
  get: ((row: T, rowIndex: number) => unknown) | null
  /** <zh/> 聚合函数，未设置回退 'sum' | <en/> Aggregate function, falls back to 'sum' when unset */
  agg: AggFuncLike | undefined
}

/**
 * <zh/> 标量列增量累加器——sum/avg/min/max/first/last 可在一次遍历中同步维护，
 * <zh/> 无需为每列物化值数组。
 * <en/> Incremental accumulator for scalar columns — sum/avg/min/max/first/last can be
 * <en/> maintained in one traversal without materializing per-column value arrays.
 */
interface ScalarAccumulator {
  sum: number
  validCount: number
  min: number
  max: number
  hasNumber: boolean
  first: unknown
  hasFirst: boolean
  last: unknown
  hasLast: boolean
}

function createScalarAccumulator(): ScalarAccumulator {
  return {
    sum: 0,
    validCount: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    hasNumber: false,
    first: undefined,
    hasFirst: false,
    last: undefined,
    hasLast: false,
  }
}

/** <zh/> 自定义函数列的值槽——单趟中唯一需要物化值数组的情形 | <en/> Value slot for custom-function columns — the only case materializing a value array in one pass */
interface CustomSlot {
  values: unknown[]
  func: (values: unknown[], rows: any[]) => unknown
}

/**
 * <zh/> 单趟聚合内核——一次遍历产出各列原始聚合值。
 * <zh/> 与逐列 readColumnValues + computeColumnAggregate 等价，但只有一次行循环、
 * <zh/> 零逐列中间数组；内置 'count' 免取值；仅自定义函数列物化值数组。
 * <en/> Single-pass aggregation kernel — produces each column's raw aggregate in one traversal.
 * <en/> Equivalent to per-column readColumnValues + computeColumnAggregate, but with a single row
 * <en/> loop and zero per-column intermediate arrays; built-in 'count' skips extraction;
 * <en/> only custom-function columns materialize value arrays.
 *
 * @param rows - <zh/> 行集 | <en/> row set
 * @param items - <zh/> 与返回值索引对齐的工作项 | <en/> work items aligned with the return indices
 * @returns <zh/> 每列原始聚合值（口径与 computeColumnAggregate 一致；get 为 null 且非 count 时为 undefined）
 * <en/> raw aggregate per column (same caliber as computeColumnAggregate; undefined when get is null and agg is not count)
 */
export function runSummaryPass<T>(
  rows: readonly T[],
  items: ReadonlyArray<SummaryWorkItem<T>>,
): unknown[] {
  const raws: unknown[] = []
  const scalars: (ScalarAccumulator | null)[] = []
  const customs: (CustomSlot | null)[] = []
  let hasWork = false

  for (let i = 0; i < items.length; i++) {
    const agg = items[i]!.agg ?? 'sum'
    if (typeof agg === 'function') {
      customs.push({ values: [], func: agg })
      scalars.push(null)
      raws.push(undefined)
      hasWork = true
    }
    else if (agg === 'count') {
      // <zh/> count 只需行数，无需逐行取值 | <en/> count needs only the row count, no per-row extraction
      raws.push(rows.length)
      scalars.push(null)
      customs.push(null)
    }
    else {
      scalars.push(createScalarAccumulator())
      customs.push(null)
      raws.push(undefined)
      hasWork = true
    }
  }

  if (hasWork) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      for (let i = 0; i < items.length; i++) {
        const acc = scalars[i]
        const custom = customs[i]
        if (!acc && !custom)
          continue
        const get = items[i]!.get
        let v: unknown
        if (get) {
          try {
            v = get(row, r)
          }
          catch {
            v = undefined
          }
        }
        else {
          v = undefined
        }
        if (custom)
          custom.values.push(v)
        if (acc) {
          if (typeof v === 'number' && !Number.isNaN(v)) {
            acc.sum += v
            acc.validCount++
            if (v < acc.min)
              acc.min = v
            if (v > acc.max)
              acc.max = v
            acc.hasNumber = true
          }
          if (v !== undefined) {
            if (!acc.hasFirst) {
              acc.first = v
              acc.hasFirst = true
            }
            acc.last = v
            acc.hasLast = true
          }
        }
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const acc = scalars[i]
    if (acc) {
      const agg = items[i]!.agg ?? 'sum'
      raws[i] = agg === 'avg'
        ? (acc.validCount === 0 ? null : acc.sum / acc.validCount)
        : agg === 'min'
          ? (acc.hasNumber ? acc.min : null)
          : agg === 'max'
            ? (acc.hasNumber ? acc.max : null)
            : agg === 'first'
              ? (acc.hasFirst ? acc.first : null)
              : agg === 'last'
                ? (acc.hasLast ? acc.last : null)
                : (acc.hasNumber ? acc.sum : null)
      continue
    }
    const custom = customs[i]
    if (custom) {
      try {
        raws[i] = custom.func(custom.values, rows as any[])
      }
      catch {
        raws[i] = null
      }
    }
  }
  return raws
}

/**
 * <zh/> 构建默认合计行数组——返回值按传入列顺序索引对齐，可直接作为
 * <zh/> ElTable summaryMethod 的返回值使用。
 * <zh/> 聚合口径：未设置 aggFunc 的列回退 'sum'；
 * <zh/> 设置 aggFunc 的列按 sum/avg/min/max/count/first/last/自定义归约。
 * <en/> Build the default summary row array — index-aligned with the input columns, directly
 * <en/> usable as the return value of an ElTable summaryMethod.
 * <en/> Aggregation caliber: columns without aggFunc fall back to 'sum';
 * <en/> columns with aggFunc reduce via sum/avg/min/max/count/first/last/custom.
 */
export function buildDefaultSummaryRow<T, C extends DefaultSummaryColumnLike>(
  columns: readonly C[],
  data: readonly T[],
  sumText: string,
): string[] {
  // <zh/> 保留泛型 Array 构造——unicorn 的 Array.from 改写会丢失元素类型（TS2322）
  // <en/> Keep the generic Array ctor — unicorn's Array.from rewrite erases the element type (TS2322)
  // eslint-disable-next-line unicorn/no-new-array
  const sums = new Array<string>(columns.length).fill('')

  let firstPropIndex = -1
  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci]
    if (col?.prop || col?.getValue) {
      if (firstPropIndex === -1)
        firstPropIndex = ci
    }
  }

  // <zh/> 单趟聚合——与上逐列 readColumnValues + computeColumnAggregate 等价，
  // <zh/> 跳过规则（无 prop 无 getValue、首 prop 占位）与原来逐项一致。
  // <en/> Single-pass aggregation — equivalent to the per-column readColumnValues +
  // <en/> computeColumnAggregate above; skip rules (propless/getValueless, first-prop
  // <en/> placeholder) match the canonical item-by-item behavior.
  const items: SummaryWorkItem<T>[] = columns.map((col, ci) => {
    const prop = col?.prop
    // <zh/> 无 prop 且无 getValue 的列（如选择列）输出空串
    // <en/> Columns without prop nor getValue (e.g. selection) yield ''
    if (!col || (!prop && !col.getValue))
      return { get: null, agg: undefined }
    // <zh/> 首 prop 列固定显示 sumText 占位（含其自身有数值的场景——占位优先于自合计）
    // <en/> First prop column always shows sumText placeholder (placeholder wins over its own total)
    if (ci === firstPropIndex)
      return { get: null, agg: undefined }
    if (col.getValue) {
      const getValue = col.getValue
      return { get: (row: T, rowIndex: number) => getValue(row, rowIndex), agg: col.aggFunc }
    }
    return { get: row => (row as Record<string, unknown> | null | undefined)?.[prop as string], agg: col.aggFunc }
  })
  const raws = runSummaryPass(data, items)
  for (let ci = 0; ci < columns.length; ci++) {
    if (ci === firstPropIndex)
      continue
    sums[ci] = formatAggregateValue(raws[ci])
  }

  // <zh/> 首 prop 列固定显示 sumText 占位；无有效数字的列保持空串。
  // <en/> First prop column shows sumText placeholder; columns without valid aggregates stay blank.
  if (firstPropIndex !== -1)
    sums[firstPropIndex] = sumText

  return sums
}

/**
 * <zh/> 计算行集在各列上的原始聚合值——供分组小计/Grand Total 合成行使用
 * <zh/> 返回按 prop 键控的原始值表（含 null，无有效值时为 null；无 prop 的列跳过）。
 * <en/> Compute raw aggregates per column over a row set — for group-total / grand-total synthetic rows
 * <en/> Returns a prop-keyed raw value map (null when no valid value; prop-less columns skipped).
 */
export function computeRawAggregates<T, C extends DefaultSummaryColumnLike>(
  rows: readonly T[],
  columns: readonly C[],
): Record<string, unknown> {
  // <zh/> 单趟聚合——与上逐列版本等价：跳过无 prop 无 getValue 的列，
  // <zh/> 有 getValue 无 prop 的列无法键控落键同样跳过。
  // <en/> Single-pass aggregation — equivalent to the per-column version above: columns with
  // <en/> neither prop nor getValue are skipped, as are getValue-without-prop columns (unkeyable).
  const actives: { prop: string, item: SummaryWorkItem<T> }[] = []
  for (const col of columns) {
    const prop = col?.prop
    if (!prop && !col?.getValue)
      continue
    // <zh/> 有 getValue 无 prop 的列无法键控落键，跳过（footer 数组形态仍可通过 buildDefaultSummaryRow 覆盖）
    // <en/> Columns with getValue but no prop cannot be keyed — skipped (footer array form still covers them via buildDefaultSummaryRow)
    if (!prop)
      continue
    if (col.getValue) {
      const getValue = col.getValue
      actives.push({ prop, item: { get: (row: T, rowIndex: number) => getValue(row, rowIndex), agg: col.aggFunc } })
    }
    else {
      actives.push({ prop, item: { get: row => (row as Record<string, unknown> | null | undefined)?.[prop], agg: col.aggFunc } })
    }
  }
  const raws = runSummaryPass(rows, actives.map(a => a.item))
  const out: Record<string, unknown> = {}
  for (let i = 0; i < actives.length; i++)
    out[actives[i]!.prop] = raws[i]
  return out
}

/**
 * <zh/> 汇总异步化阈值（行数 × 列数）——超过时将聚合推迟到空闲回调，避免阻塞首帧。
 * <zh/> 默认 50 万（如 10 万行 × 5 列，或 2.5 万行 × 20 列），调用方可按设备档位覆盖。
 * <en/> Summary async threshold (rows × columns) — aggregates above it are deferred to an
 * <en/> idle callback to avoid blocking the first frame. Defaults to 500k
 * <en/> (e.g. 100k rows × 5 cols, or 25k rows × 20 cols); callers may override per device tier.
 */
export const SUMMARY_ASYNC_THRESHOLD = 500_000

/**
 * <zh/> 是否应推迟汇总计算——行×列**达到**阈值即返回 true（含边界）。
 *
 * <zh/> 边界用 `>=` 而非 `>`：阈值 50 万正是本项目验收规模 10,000 行 × 50 列，
 * <zh/> 用严格大于会把「最坏假设」本身留在同步路径上——恰好在最需要的场景不生效。
 *
 * <en/> Whether summary computation should be deferred — true once rows×cols **reaches** the threshold
 * <en/> (boundary inclusive).
 *
 * <en/> The boundary is `>=`, not `>`: the 500k threshold is exactly this project's acceptance scale
 * <en/> (10,000 rows × 50 columns), and a strict `>` leaves that worst case on the synchronous path —
 * <en/> the deferral would be inactive precisely where it is needed most.
 */
export function shouldDeferSummary(
  rowCount: number,
  colCount: number,
  threshold: number = SUMMARY_ASYNC_THRESHOLD,
): boolean {
  if (!Number.isFinite(rowCount) || !Number.isFinite(colCount))
    return false
  if (rowCount <= 0 || colCount <= 0)
    return false
  return rowCount * colCount >= threshold
}

/**
 * <zh/> 由共享原始聚合派生表尾字符串——与 buildDefaultSummaryRow 同口径，零重算。
 * <zh/> 规则：首个含 prop（或 getValue）列固定 sumText 占位；其余含 prop 列按原始值格式化；
 * <zh/> 无 prop 无 getValue 列输出空串；原始值缺键（getValue 无 prop 等）同样空串。
 * <en/> Derive footer strings from shared raw aggregates — same caliber as
 * <en/> buildDefaultSummaryRow, zero recomputation. Rules: the first prop-bearing (or
 * <en/> getValue) column shows the sumText placeholder; other prop columns format the raw
 * <en/> value; prop-less/getValue-less columns yield ''; missing raw keys yield '' too.
 */
export function formatRawAggregatesToFooter<C extends DefaultSummaryColumnLike>(
  aggregates: Readonly<Record<string, unknown>>,
  columns: readonly C[],
  sumText: string,
): string[] {
  // eslint-disable-next-line unicorn/no-new-array
  const sums = new Array<string>(columns.length).fill('')
  let firstPropIndex = -1
  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci]
    if (col?.prop || col?.getValue) {
      if (firstPropIndex === -1)
        firstPropIndex = ci
    }
  }
  for (let ci = 0; ci < columns.length; ci++) {
    if (ci === firstPropIndex)
      continue
    const prop = columns[ci]?.prop
    if (!prop)
      continue
    if (!(prop in aggregates))
      continue
    sums[ci] = formatAggregateValue(aggregates[prop])
  }
  if (firstPropIndex !== -1)
    sums[firstPropIndex] = sumText
  return sums
}
