import type { ProcessedColumn } from '../types'
import { markRaw } from 'vue'
import { ADV_TABLE_INTERNAL_COLUMN_ID } from '../constants'
import { devWarnRepeat } from './dev-warn'

/**
 * <zh/> 保留原始类型签名的 markRaw——运行时行为与 vue 的 markRaw 完全一致，
 * 仅将返回类型从 `Raw<T>` 收敛为 `T`。
 * <en/> markRaw preserving the original type signature — runtime behavior identical
 * to vue's markRaw, but the return type is narrowed from `Raw<T>` to `T`.
 *
 * <zh/> 动机：vue 3.5 的 `Raw<T>` 结构含未导出的 unique symbol（RawSymbol），
 * 组件库生成 .d.ts 时若公开 API 类型链中包含 `Raw<T>` 会触发 TS4058
 * （cannot be named）。因此公开链路上的 markRaw 一律使用本函数。
 * <en/> Why: vue 3.5's `Raw<T>` contains an unexported unique symbol (RawSymbol);
 * including `Raw<T>` in public API type chains breaks .d.ts generation (TS4058).
 * Use this function for all markRaw calls on public type paths.
 */
export function markRawTyped<T extends object>(value: T): T {
  return markRaw(value) as T
}

/**
 * <zh/> 判断列是否为"免配置 key"的内置自动键列——选择列（selection:true）与
 * <zh/> 操作列（valueType:'option'）由 ensureColumnIds 赋予内置 key
 * <zh/> （ADV_TABLE_SELECTION_COLUMN_KEY / ADV_TABLE_OPTION_COLUMN_KEY），
 * <zh/> 用户无需手动设置 key/prop。校验与告警逻辑应豁免这两类列，
 * <zh/> 避免对官方文档明确支持的合法写法产生误报。
 * <en/> Whether a column is a sanctioned auto-keyed column — selection columns
 * <en/> (selection: true) and option/action columns (valueType: 'option') receive built-in
 * <en/> keys from ensureColumnIds (ADV_TABLE_SELECTION_COLUMN_KEY / ADV_TABLE_OPTION_COLUMN_KEY),
 * <en/> so users never need to set key/prop manually. Validation and warning logic must exempt
 * <en/> these two shapes to avoid false positives on documented, legal configurations.
 */
export function isAutoKeyedColumn(col: Record<string, any>): boolean {
  return col.selection === true || col.valueType === 'option'
}

/**
 * <zh/> 从列配置中获取列键（纯读函数，无副作用）。
 * <en/> Get the column key from column config (pure read, no side effects).
 *
 * <zh/> 查找优先级：col.key → col.prop → col.property → col[ADV_TABLE_INTERNAL_COLUMN_ID]。
 * <zh/> 正常流程中 ensureColumnIds 在 use-columns.ts 中首先执行，确保所有列在进入渲染前都已有稳定 key。
 * <zh/> 若列缺少 key/prop 且未被 ensureColumnIds 预处理，开发模式下会输出警告。
 * <zh/> col.property 为 ElTable 内部列对象的属性名，用于事件回调中获取列标识。
 * <en/> Lookup priority: col.key → col.prop → col.property → col[ADV_TABLE_INTERNAL_COLUMN_ID].
 * <en/> In normal flow ensureColumnIds runs first in use-columns.ts, so every column already has a stable key before rendering.
 * <en/> If a column lacks key/prop and was not pre-processed by ensureColumnIds, a warning is logged in dev mode.
 * <en/> col.property is the property name on ElTable's internal column object, used to identify the column in event callbacks.
 */
export function getColumnKey(col: Record<string, any>): string {
  const columnKey = getColumnKeySilent(col)
  if (columnKey === '') {
    // <zh/> 自动键列（selection/option）在 ensureColumnIds 之前的原始配置阶段必然无 key，
    // <zh/> 属合法形态，不告警；其余无 key 列仍保持 dev 警告。
    // <en/> Auto-keyed columns (selection/option) legitimately lack keys before ensureColumnIds
    // <en/> no warning; other keyless columns keep the dev warning.
    if (!isAutoKeyedColumn(col)) {
      devWarnRepeat('Column missing unique key/prop. Ensure ensureColumnIds() is called before rendering.', col)
    }
  }
  return columnKey
}

/**
 * <zh/> 静默版列键解析——与 getColumnKey 同一优先级（key → prop → property → 内部 ID），
 * <zh/> 但缺键时直接返回 '' 而不触发 dev 警告。供签名/缓存等高频路径使用，避免刷屏。
 * <en/> Silent column-key resolution — same priority as getColumnKey
 * <en/> (key → prop → property → internal ID), but returns '' without a dev warning
 * <en/> when missing. For high-frequency paths (signatures/caches) to avoid log spam.
 */
export function getColumnKeySilent(col: Record<string, any>): string {
  const columnKey = col.key ?? col.prop ?? col.property ?? col[ADV_TABLE_INTERNAL_COLUMN_ID]
  if (columnKey === undefined || columnKey === '')
    return ''
  return typeof columnKey === 'string' ? columnKey : String(columnKey)
}

/**
 * <zh/> 数据字段解析（prop 域）——优先级 prop → property，用于读取行数据/合计/合并等
 * <zh/> 按数据字段键控的场景。与 getColumnKey（key → prop → property，按列身份键控）显式区分：
 * <zh/> 身份查找走 getColumnKey，数据读取走 resolveColumnProp，二者不可混用。
 * <en/> Data-field resolution (prop domain) — priority prop → property, for reading row data /
 * <en/> summaries / spans keyed by data field. Explicitly distinct from getColumnKey
 * <en/> (key → prop → property, keyed by column identity): identity lookups use getColumnKey,
 * <en/> data reads use resolveColumnProp; do not mix them.
 */
export function resolveColumnProp(col: Record<string, any>): string | undefined {
  const prop = col.prop ?? col.property
  if (prop === undefined || prop === '')
    return undefined
  return typeof prop === 'string' ? prop : String(prop)
}

/**
 * <zh/> 构建列键 → 列配置 的双键查找 Map（规范键 + prop 别名），供排序/筛选等
 * <zh/> 需要将用户输入的 prop/columnKey 解析为规范键的场景做 O(1) 查表。
 *
 * <zh/> **首见优先语义**：当多列共享同一 prop 或别名冲突时，以遍历顺序中首次注册者为准——
 * <zh/> 与渲染层"首个同名列生效"的行为一致。此函数由 use-column-sort 与 use-column-filter
 * <zh/> 共用（冗余收编），两侧解析行为由此保证一致。
 *
 * <en/> Build a two-key lookup Map (canonical key + prop alias) from column configs, giving
 * <en/> sort/filter an O(1) resolution from user-supplied prop/columnKey to the canonical key.
 *
 * <en/> **First-match-wins**: when columns share a prop or aliases collide, the first registration
 * <en/> in traversal order prevails — consistent with rendering where the first same-named column wins.
 * <en/> Shared by use-column-sort and use-column-filter (dedup), guaranteeing identical resolution.
 */
export function buildColumnKeyMap<T extends Record<string, any>>(cols: readonly T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const col of cols) {
    const canonical = getColumnKey(col)
    if (!map.has(canonical))
      map.set(canonical, col)
    if (col.prop && col.prop !== canonical && !map.has(col.prop))
      map.set(col.prop, col)
  }
  return map
}

/**
 * <zh/> 列固定分组——`left | normal | right`。
 * <en/> Column fixed group — `left | normal | right`.
 */
export type ColumnFixedGroup = 'left' | 'normal' | 'right'

/**
 * <zh/> 列所属固定侧（left/normal/right）——全仓唯一口径。
 * <zh/> `fixed: true` 等价左固定（与 Element Plus 语义一致）；列拖拽跨侧守卫、列设置面板分组、
 * <zh/> 组更新过滤三处必须同口径，否则固定列会被分到错误分组或绕过跨侧守卫。
 * <en/> Which fixed side a column belongs to (left/normal/right) — the single caliber repo-wide.
 * <en/> `fixed: true` equals left-fixed (consistent with Element Plus); the column-drag cross-side
 * <en/> guard, the column-setting panel grouping and the group-update filter must share this caliber,
 * <en/> or fixed columns land in the wrong group / bypass the cross-side guard.
 *
 * @param col - <zh/> 列配置对象 | <en/> column config object
 * @returns <zh/> 固定分组 | <en/> fixed group
 */
export function getColumnFixedGroup(col: ProcessedColumn): ColumnFixedGroup {
  // <zh/> fixed:true 等价左固定（与 use-columns/use-column-state 口径一致），否则跨侧守卫对其失效
  // <en/> fixed:true equals left-fixed (consistent with use-columns/use-column-state); otherwise cross-side guards miss it
  if (col.fixed === true || col.fixed === 'left')
    return 'left'
  if (col.fixed === 'right')
    return 'right'
  return 'normal'
}

/**
 * <zh/> 判断列是否为分组列（包含子列）。
 * <en/> Whether a column is a group column (has child columns).
 *
 * @typeParam T - <zh/> 列配置类型 | <en/> column config type
 * @param col - <zh/> 列配置对象 | <en/> column config object
 * @returns <zh/> 当列存在非空 children 数组时返回 true，类型收窄为包含 children 的列类型 | <en/> true when the column has a non-empty children array; narrows the type to a column with children
 */
export function isGroupColumn<T extends Record<string, any>>(
  col: T,
): col is T & { children: Exclude<T['children'], undefined> } {
  return Array.isArray(col.children) && col.children.length > 0
}

/**
 * <zh/> 将嵌套的列树展平为叶子列数组——**实现不在本文件**。
 * <en/> Flatten a nested column tree into a leaf-column array — **not implemented here**.
 *
 * <zh/> 单一真相在 `utils/column-tree.ts`（建立的收敛点：列树的查找/过滤/遍历/展平同源）。
 * <zh/> 本文件此前自带一份同语义实现；两份各自演化即成漂移源，而列展平同时服务虚拟列装配
 * <zh/> （`use-virtual-columns`）与快捷筛选（`use-quick-filter`），漂移会表现为
 * <zh/> 「两个功能看到的叶子列不一致」这类难查故障。消费方请一律从 `utils/column-tree` 导入。
 * <zh/> 刻意**不**在此 re-export：column-tree 反向依赖本文件的 `isGroupColumn`，转出即成循环依赖。
 * <zh/>
 * <zh/> **The single source is `utils/column-tree.ts`** (the convergence point shared by
 * <zh/> column-tree lookup/filter/traverse/flatten). This file used to carry its own equivalent
 * <zh/> implementation; two copies drift independently, and since flattening feeds both the virtual
 * <zh/> column assembly (`use-virtual-columns`) and quick filtering (`use-quick-filter`), drift shows up
 * <zh/> as hard-to-diagnose "these two features see different leaf columns" bugs. Import from
 * <zh/> `utils/column-tree` everywhere. Deliberately **not** re-exported here: column-tree imports
 * <zh/> `isGroupColumn` from this file, so re-exporting would create an import cycle.
 *
 * @typeParam T - <zh/> 列配置类型 | <en/> column config type
 * @param columns - <zh/> 可能包含分组列的列数组 | <en/> column array that may contain group columns
 * @returns <zh/> 仅包含叶子列的一维数组 | <en/> a flat array containing only leaf columns
 */

/**
 * <zh/> 构建统一列索引域顺序：selection + normal(非 fixed) + normal(fixed)。
 * <zh/> 与 ElTableV2 列数组（[...selectionV2, ...normalV2, ...fixedV2]）顺序保持一致，
 * <zh/> 使 default / virtual 两种渲染模式下事件 payload 的 columnIndex 语义一致。
 * <en/> Build the unified column index domain order: selection + normal(non-fixed) + normal(fixed).
 * <en/> Matches the ElTableV2 column array ([...selectionV2, ...normalV2, ...fixedV2]) so that
 * <en/> columnIndex in event payloads is consistent across default / virtual renderers.
 *
 * @typeParam T - <zh/> 列配置类型 | <en/> column config type
 * @param selection - <zh/> selection 列数组 | <en/> selection column array
 * @param normal - <zh/> normal 列数组（含 hover 操作列） | <en/> normal column array (including hover option columns)
 * @returns <zh/> 按统一索引域排序的列数组 | <en/> columns ordered by the unified index domain
 */
export function buildColumnIndexOrder<T>(selection: T[], normal: T[]): T[] {
  const nonFixed: T[] = []
  const fixed: T[] = []
  for (const col of normal) {
    if ((col as { fixed?: unknown }).fixed)
      fixed.push(col)
    else
      nonFixed.push(col)
  }
  return [...selection, ...nonFixed, ...fixed]
}

/** <zh/> 解析 cellClassRules 为空格分隔的 class 字符串 | <en/> Resolve cellClassRules into a space-separated class string */
export function resolveCellClassRules(
  rules: Record<string, (params: any) => boolean> | undefined,
  params: any,
): string {
  if (!rules)
    return ''
  const classes: string[] = []
  for (const [className, predicate] of Object.entries(rules)) {
    if (predicate(params))
      classes.push(className)
  }
  return classes.join(' ')
}

/**
 * <zh/> 获取列树的最大深度。
 * <en/> Get the maximum depth of the column tree.
 *
 * <zh/> 扁平列数组返回 1，一级分组返回 2，嵌套分组递归计算最大深度；空数组返回 0。
 * <en/> A flat column array returns 1, one-level grouping returns 2, nested grouping recurses for the max depth; an empty array returns 0.
 *
 * @typeParam T - <zh/> 列配置类型 | <en/> column config type
 * @param columns - <zh/> 列配置数组（可能包含分组） | <en/> column array (may contain groups)
 * @returns <zh/> 列树最大层级深度 | <en/> maximum column-tree depth
 */
export function getColumnDepth<T extends Record<string, any>>(columns: T[]): number {
  if (columns.length === 0)
    return 0
  let max = 1
  for (const col of columns) {
    if (isGroupColumn(col)) {
      max = Math.max(max, 1 + getColumnDepth(col.children as T[]))
    }
  }
  return max
}

/**
 * <zh/> 构建列 **key** 签名——将列数组映射为逗号分隔的 key 字符串，用于缓存 key 生成。
 * <zh/> 统一使用 getColumnKey 作为列标识来源，消除 `c.prop ?? ''` 与 `c.key ?? c.prop` 的分歧。
 * <en/> Build a column **key** signature — maps a column array to a comma-separated key string for cache key generation.
 * <en/> Uses getColumnKey as the unified column identifier source, eliminating divergence between `c.prop ?? ''` and `c.key ?? c.prop`.
 *
 * @remarks
 * <zh/> 命名与列域内部的 `buildColumnStateSignature`（含 hidden/fixed/width/format/childrenCount）
 * <zh/> 显式区分：本函数**只**比较 key 集合，不反映列状态变化。
 * <en/> Name explicitly distinguishes it from the column-domain `buildColumnStateSignature`
 * <en/> (which includes hidden/fixed/width/format/childrenCount): this one compares **only** keys.
 *
 * @param columns - <zh/> 列配置数组 | <en/> column config array
 * @returns <zh/> 逗号分隔的列 key 签名字符串 | <en/> comma-separated column key signature string
 */
export function buildColumnKeySignature(columns: Record<string, any>[]): string {
  // 使用静默版列键解析——selection 列等自动生成列可能没有 prop/key，此时用列索引兜底
  // Use the silent column-key resolution — auto-generated columns like selection may lack
  // prop/key, fall back to index
  return columns
    .map((c, i) => {
      const key = getColumnKeySilent(c)
      if (key === '')
        return `col-${i}`
      return key
    })
    .join(',')
}

/** <zh/> 空行对象常量——冻结避免每次创建新对象，供 RowActionBar 渲染兜底使用 | <en/> Frozen empty-row constant reused as a render fallback for RowActionBar */
export const EMPTY_ROW: Record<string, unknown> = Object.freeze({})

/**
 * <zh/> 判断列是否可筛选——统一筛选列判定逻辑，消除 filter-panel.vue 与 use-adv-table.ts 中的重复代码
 * <en/> Determine whether a column is filterable — unifies filterable-column logic, eliminating duplication across filter-panel.vue and use-adv-table.ts
 *
 * @remarks
 * <zh/> 排除条件：filter 显式为 false、选择列、option 类型列（hover 操作列）
 * <en/> Exclusion conditions: filter explicitly false, selection column, option-type column (hover action column)
 *
 * @param col - <zh/> 列配置对象 | <en/> column config object
 * @returns <zh/> 可筛选返回 true，否则 false | <en/> true if filterable, false otherwise
 */
export function isColumnFilterable(col: Record<string, any>): boolean {
  if (col.filter === false || col.selection || col.valueType === 'option')
    return false
  return true
}

/**
 * <zh/> 从列配置中提取 teleport hover 操作列的 zIndex。
 * <en/> Extract the zIndex of the teleport hover-action column from column config.
 *
 * <zh/> 查找 valueType='option' 且 hoverActions.teleport 为 true 的列，返回其 hoverActions.zIndex 值，供两种渲染器共用。
 * <en/> Find the column where valueType='option' and hoverActions.teleport is true, return its hoverActions.zIndex; shared by both renderers.
 *
 * @param columns - <zh/> 列配置数组 | <en/> column config array
 * @returns <zh/> zIndex 值，未配置时返回 undefined | <en/> zIndex value, undefined when not configured
 */
export function getHoverOptionZIndex(columns: Record<string, any>[]): number | string | undefined {
  const col = columns.find(
    c => c.valueType === 'option'
      && c.hoverActions
      && typeof c.hoverActions === 'object'
      && c.hoverActions.teleport,
  )
  const hoverActions = col?.hoverActions
  if (hoverActions && typeof hoverActions === 'object' && 'zIndex' in hoverActions)
    return hoverActions.zIndex as number | string | undefined
  return undefined
}

//  Row helpers

/**
 * <zh/> 判断行是否可选。若未传入 selectableFn，默认行可选。
 * <en/> Whether a row is selectable. When selectableFn is omitted, the row is selectable by default.
 *
 * @param row - <zh/> 行数据 | <en/> row data
 * @param index - <zh/> 行索引 | <en/> row index
 * @param selectableFn - <zh/> 可选性判断函数 | <en/> selectability predicate
 * @returns <zh/> 行是否可选 | <en/> whether the row is selectable
 */
export function isRowSelectable(
  row: unknown,
  index: number,
  selectableFn?: (row: unknown, index: number) => boolean,
): boolean {
  if (!selectableFn)
    return true
  return selectableFn(row, index)
}

/**
 * <zh/> 构建 key→index Map，用于 O(1) 查找行索引。
 * <en/> Build a key→index map for O(1) row-index lookup.
 *
 * @example
 * const map = buildKeyToIndexMap(rows, r => r.id)
 * map.get('3') // => 2
 */
export function buildKeyToIndexMap<T>(data: readonly T[], getKey: (row: T) => string | number): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < data.length; i++) {
    map.set(String(getKey(data[i])), i)
  }
  return map
}
