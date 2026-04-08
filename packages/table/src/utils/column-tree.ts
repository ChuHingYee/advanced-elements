/**
 * <zh/> 列树处理工具：提供列树的递归查找、过滤、展平、遍历等操作，供 table-virtual-renderer.vue 和 normal-v2-column.tsx 共用。
 * <en/> Column-tree helpers: recursive lookup, filtering, flattending and traversal of the column tree, shared by table-virtual-renderer.vue and normal-v2-column.tsx.
 */
import type { ProcessedColumn } from '../types'
import type { TableColumnWarning } from '../types/error'
import { ADV_TABLE_INTERNAL_COLUMN_ID, ADV_TABLE_OPTION_COLUMN_KEY, ADV_TABLE_SELECTION_COLUMN_KEY } from '../constants'
import { getColumnKey, isAutoKeyedColumn, isGroupColumn } from './shared'

/** <zh/> 列默认宽度（像素） | <en/> Default column width (pixels) */
export const DEFAULT_COLUMN_WIDTH = 150

/**
 * <zh/> 校验列配置树，返回结构化警告列表（不抛异常、不静默渲染错乱 DOM）。
 * <en/> Validate the column config tree, returning a structured warning list (no exceptions thrown, no silently broken DOM).
 *
 * <zh/> 检测项：1. 缺失唯一标识：叶子列无 key/prop/property 时无法参与排序、筛选、编辑与列状态持久化，分组列允许无 key（按结构识别），故跳过该项检查。2. 重复 key：多列解析到相同 key 会导致状态互相覆盖、渲染错位。3. 非法宽度：width <= 0 的列渲染为死列并破坏列宽累加，运行时会被钳制到最小列宽。
 * <en/> Checks: 1. Missing unique identifier — leaf columns without key/prop/property cannot participate in sort/filter/edit/column-state persistence; group columns may omit key (identified by structure) so they are skipped. 2. Duplicate key — multiple columns resolving to the same key cause state to overwrite each other and render misalignment. 3. Invalid width — columns with width <= 0 render as dead columns and break width accumulation; they are clamped to the minimum column width at runtime.
 *
 * <zh/> 注意：须在 ensureColumnIds 之前对原始 columns 调用，否则内部合成 id 会掩盖缺失 key 的真实配置问题。
 * <en/> Note: call this on the raw columns before ensureColumnIds, otherwise the internally synthesized id masks the real missing-key config problem.
 *
 * @param columns - <zh/> 原始列配置树（可含分组列） | <en/> raw column config tree (may contain group columns)
 * @param parentPath - <zh/> 递归路径前缀，仅用于生成可读的 field 定位信息 | <en/> recursive path prefix, only for generating readable field location info
 * @returns <zh/> 结构化警告数组，无问题时返回空数组 | <en/> structured warning array, empty when no issues
 */
export function validateColumns(
  columns: Array<Record<string, any>>,
  parentPath = '',
): TableColumnWarning[] {
  const warnings: TableColumnWarning[] = []
  const seenKeys = new Set<string>()

  const visit = (cols: Array<Record<string, any>>, path: string): void => {
    cols.forEach((col, index) => {
      const currentPath = path ? `${path}.${index}` : `columns[${index}]`
      const key = getColumnKey(col)
      const label = (typeof col.label === 'string' ? col.label : '') || currentPath

      if (!key) {
        // <zh/> 分组列按结构识别、selection/option 列由 ensureColumnIds 自动赋内置 key，
        // <zh/> 三者缺 key 均属合法形态，豁免缺失键告警。
        // <en/> Group columns are identified structurally; selection/option columns receive
        // <en/> built-in keys from ensureColumnIds — all three are legal without a key and exempt.
        if (!isGroupColumn(col) && !isAutoKeyedColumn(col)) {
          warnings.push({
            code: 'TABLE_COLUMN_MISSING_KEY',
            field: label,
            suggestion: '为列配置 key 或 prop，否则无法参与排序/筛选/编辑/列状态持久化',
          })
        }
      }
      else if (seenKeys.has(key)) {
        warnings.push({
          code: 'TABLE_COLUMN_DUPLICATE_KEY',
          field: key,
          suggestion: `存在重复列 key "${key}"，将导致状态互相覆盖与渲染错位，请修正为唯一值`,
        })
      }
      else {
        seenKeys.add(key)
      }

      if (typeof col.width === 'number' && !(col.width > 0)) {
        warnings.push({
          code: 'TABLE_COLUMN_INVALID_WIDTH',
          field: label,
          suggestion: `列宽 width=${String(col.width)} 非法（须为正数），运行时将钳制到最小列宽，请修正为正数值`,
        })
      }

      if (isGroupColumn(col) && Array.isArray(col.children)) {
        visit(col.children as Array<Record<string, any>>, currentPath)
      }
    })
  }

  visit(columns, parentPath)
  return warnings
}

/**
 * <zh/> 根据折叠状态和 columnGroupShow 递归过滤列树，返回新树（不修改原对象）。
 * <en/> Recursively filter the column tree by collapse state and columnGroupShow, returning a new tree (no mutation).
 *
 * @param cols - <zh/> 待过滤的列树 | <en/> column tree to filter
 * @param isCollapsedFn - <zh/> 判断分组列是否折叠的回调，传入列 key，返回是否折叠 | <en/> callback deciding whether a group column is collapsed, given its key
 * @returns <zh/> 过滤后的新列树 | <en/> filtered new column tree
 */
export function buildFilteredTree(
  cols: ProcessedColumn[],
  isCollapsedFn?: (key: string) => boolean,
): ProcessedColumn[] {
  const result: ProcessedColumn[] = []
  /**
   * <zh/> 未变更追踪——所有节点均保持原引用时返回入参数组本身。
   * <zh/> 不变量：未变更时必须复用入参引用以命中上层"同引用快路径"，否则分组表每次 touchColumns
   * <zh/> （如宽度拖拽结束、applyColumnState）都会引发分类/渲染器 props 的全量级联失效。
   * <en/> Unchanged tracking — returns the INPUT array when every node kept its reference.
   * <en/> Invariant: reuse the input reference when unchanged to hit upstream same-reference fast paths;
   * <en/> otherwise grouped tables cascade full invalidation through classification/renderer props on every
   * <en/> touchColumns (e.g. resize end, applyColumnState).
   */
  let unchanged = true

  for (const col of cols) {
    if (isGroupColumn(col) && col.children?.length) {
      const key = getColumnKey(col)
      const collapsed = isCollapsedFn?.(key) ?? false

      const filteredChildren = col.children.filter((child) => {
        const gs = child.columnGroupShow
        if (gs === undefined || gs === null)
          return true
        if (collapsed)
          return gs === 'closed'
        return gs === 'open'
      })

      const childrenTree = buildFilteredTree(filteredChildren, isCollapsedFn)

      // <zh/> 子树身份保全——递归自身已保证未变层级复用原引用，
      // <zh/> 因此逐元素相等即整棵子树未变，直接复用原组节点而非克隆。
      // <en/> Subtree identity preservation — the recursion already reuses original references for
      // <en/> unchanged levels, so element-wise equality proves the whole subtree is unchanged;
      // <en/> reuse the original group node instead of cloning.
      const childrenUnchanged = childrenTree.length === col.children.length
        && childrenTree.every((child, i) => child === col.children[i])

      if (childrenTree.length > 0 || (!collapsed && filteredChildren.length === 0)) {
        if (childrenUnchanged) {
          result.push(col)
        }
        else {
          unchanged = false
          result.push({ ...col, children: childrenTree })
        }
      }
      else {
        const originalEmpty = col.children.length === 0
        if (!originalEmpty)
          unchanged = false
        result.push(originalEmpty ? col : { ...col, children: [] })
      }
    }
    else {
      result.push(col)
    }
  }

  return unchanged ? cols : result
}

/**
 * <zh/> 递归计算叶子列数量（零分配）。
 * <en/> Recursively count leaf columns (zero-allocation).
 *
 * @param cols - <zh/> 列树 | <en/> column tree
 * @returns <zh/> 叶子列总数 | <en/> total leaf column count
 */
export function getLeafCount(cols: ProcessedColumn[]): number {
  let count = 0
  for (const col of cols) {
    if (isGroupColumn(col) && col.children?.length) {
      count += getLeafCount(col.children)
    }
    else {
      count++
    }
  }
  return count
}

/**
 * <zh/> 从过滤后的列树提取叶子宽度。传入 getColumnWidth 时，优先使用该函数返回值（用于响应列宽调整状态）。
 * <en/> Extract leaf widths from the filtered column tree. When getColumnWidth is provided, its return value takes precedence (to react to column-resize state).
 *
 * @param cols - <zh/> 列树 | <en/> column tree
 * @param getColumnWidth - <zh/> 可选的自定义宽度获取函数，用于响应列宽调整状态 | <en/> optional custom width getter, used to react to column-resize state
 * @returns <zh/> 叶子宽度数组 | <en/> leaf width array
 */
export function extractLeafWidths(
  cols: ProcessedColumn[],
  getColumnWidth?: (col: ProcessedColumn) => number | undefined,
): number[] {
  const widths: number[] = []
  for (const col of cols) {
    if (isGroupColumn(col) && col.children?.length) {
      widths.push(...extractLeafWidths(col.children, getColumnWidth))
    }
    else {
      const width = getColumnWidth?.(col)
      widths.push(width ?? col.width ?? DEFAULT_COLUMN_WIDTH)
    }
  }
  return widths
}

/**
 * <zh/> 按 key 在列树中查找列（O(n) 递归搜索，深度优先、首个命中即返回）。
 * <en/> Find a column by key in the column tree (O(n) DFS, first match wins).
 *
 * @param cols - <zh/> 列数组（支持分组嵌套）| <en/> column array (group nesting supported)
 * @param targetKey - <zh/> 目标列 key | <en/> target column key
 * @param resolveKey - <zh/> key 解析器，默认 `getColumnKey`；仅当调用方需要注入自定义解析口径时传入
 *                   | <en/> key resolver, defaults to `getColumnKey`; pass one only when the caller needs an injected caliber
 * @returns <zh/> 命中列，未找到返回 undefined | <en/> matched column, undefined when absent
 *
 * @remarks
 * <zh/> 本函数与 `useColumnResizeKeyResolver` 的列查找为该逻辑的**单一实现**——后者通过
 * <zh/> `resolveKey` 注入其选项内的 `getColumnKey`（保持可替换的解析口径），不再自持一份 DFS。
 * <en/> This function is the **single implementation** of that lookup shared with
 * <en/> `useColumnResizeKeyResolver`, which injects its option-provided `getColumnKey` through
 * <en/> `resolveKey` (keeping the caliber swappable) instead of carrying its own DFS copy.
 */
export function findColumnByKey(
  cols: ProcessedColumn[],
  targetKey: string,
  resolveKey: (col: ProcessedColumn) => string = getColumnKey,
): ProcessedColumn | undefined {
  for (const col of cols) {
    if (resolveKey(col) === targetKey)
      return col
    if (isGroupColumn(col) && col.children) {
      const found = findColumnByKey(col.children, targetKey, resolveKey)
      if (found)
        return found
    }
  }
  return undefined
}

/**
 * <zh/> 按 key → 序号映射对列数组做**稳定重排**，并递归处理分组子列。
 *
 * <zh/> 未命中序号的列（例如持久化之后新增的列）按原始数组位置**插值**：
 * <zh/> 取最近的前/后已有序邻居的中点作为排序键，使新列落在其配置位置而不是被追加到末尾。
 * <zh/> 排序为稳定排序（`sortKey` 相同时按原始下标），保证同样输入产出同样顺序。
 *
 * <en/> Stable reorder of a column array by a key → order map, recursing into group children.
 * <en/> Columns missing from the map (e.g. added after persistence) are **interpolated** at their
 * <en/> original array position: the sort key is the midpoint of the nearest ordered predecessor /
 * <en/> successor, so new columns land at their configured position instead of being appended.
 * <en/> The sort is stable (ties break on the original index), so identical input yields identical order.
 *
 * @param cols - <zh/> 待重排的列数组 | <en/> columns to reorder
 * @param orderIndex - <zh/> key → 目标序号映射 | <en/> key → target order map
 * @returns <zh/> 重排后的新数组 | <en/> new reordered array
 *
 * @remarks
 * <zh/> 元素为原引用；分组子列通过就地赋值 `col.children` 写回，故调用方须传入可写的列对象
 * <zh/> （渲染态列树均满足）。此处刻意保留就地写回以维持既有语义。
 * <en/> Elements are the original references; group children are written back via in-place
 * <en/> `col.children` assignment, so callers must pass writable column objects (all render-state
 * <en/> column trees satisfy this). The in-place write-back is kept deliberately to preserve semantics.
 */
export function stableReorderByKey(
  cols: ProcessedColumn[],
  orderIndex: Map<string, number>,
): ProcessedColumn[] {
  // <zh/> 单趟预计算每个位置的最近已保存邻居序号 | <en/> Precompute nearest saved-neighbor orders per position in one pass each
  const prevSavedOrder: Array<number | undefined> = Array.from({ length: cols.length })
  const nextSavedOrder: Array<number | undefined> = Array.from({ length: cols.length })
  let runningPrev: number | undefined
  for (let i = 0; i < cols.length; i++) {
    const order = orderIndex.get(getColumnKey(cols[i]!))
    if (order !== undefined)
      runningPrev = order
    prevSavedOrder[i] = runningPrev
  }
  let runningNext: number | undefined
  for (let i = cols.length - 1; i >= 0; i--) {
    const order = orderIndex.get(getColumnKey(cols[i]!))
    if (order !== undefined)
      runningNext = order
    nextSavedOrder[i] = runningNext
  }

  const withSortKey = cols.map((col, i) => {
    const key = getColumnKey(col)
    const own = orderIndex.get(key)
    const sortKey = own
      ?? (prevSavedOrder[i] !== undefined && nextSavedOrder[i] !== undefined
        ? ((prevSavedOrder[i]! + nextSavedOrder[i]!) / 2)
        : prevSavedOrder[i] !== undefined
          ? prevSavedOrder[i]! + 1
          : nextSavedOrder[i] !== undefined
            ? nextSavedOrder[i]! - 1
            : i)
    return { col, sortKey, originalIndex: i }
  })

  withSortKey.sort((a, b) =>
    a.sortKey - b.sortKey || a.originalIndex - b.originalIndex)

  const result = withSortKey.map(e => e.col)
  // 递归重排分组子列 | Recursively reorder group children
  for (const col of result) {
    if (isGroupColumn(col) && Array.isArray(col.children) && col.children.length > 0) {
      col.children = stableReorderByKey(col.children as ProcessedColumn[], orderIndex) as ProcessedColumn[]
    }
  }
  return result
}

/**
 * <zh/> 为列树中缺少 prop/key 的列分配内部 ID，确保 getColumnKey 有稳定 key。
 * <en/> Assign internal IDs to columns missing prop/key in the column tree, ensuring getColumnKey has a stable key.
 */
export function ensureColumnIds(cols: ProcessedColumn[], parentPath = ''): ProcessedColumn[] {
  return cols.map((col, index) => {
    const cloned = { ...col }
    if (!cloned.prop && !cloned.key && !(cloned as Record<string, unknown>)[ADV_TABLE_INTERNAL_COLUMN_ID]) {
      // <zh/> 选择列（selection: true）赋内置 key，用户无需手动设置
      // <en/> Selection columns (selection: true) get a built-in key, no manual setup required
      if (cloned.selection === true) {
        ;(cloned as Record<string, unknown>)[ADV_TABLE_INTERNAL_COLUMN_ID] = ADV_TABLE_SELECTION_COLUMN_KEY
      }
      // <zh/> 操作列（valueType: 'option'）赋内置 key
      // <en/> Option/action columns (valueType: 'option') get a built-in key
      else if (cloned.valueType === 'option') {
        ;(cloned as Record<string, unknown>)[ADV_TABLE_INTERNAL_COLUMN_ID] = ADV_TABLE_OPTION_COLUMN_KEY
      }
      else {
        const label = (cloned as Record<string, unknown>).label || 'group'
        ;(cloned as Record<string, unknown>)[ADV_TABLE_INTERNAL_COLUMN_ID] = `${parentPath}${label}-${index}`
      }
    }
    if (isGroupColumn(cloned) && cloned.children) {
      const currentKey = getColumnKey(cloned)
      cloned.children = ensureColumnIds(cloned.children, `${currentKey}/`)
    }
    return cloned
  })
}

/**
 * <zh/> 列访问器回调类型。返回 false 可跳过当前节点的子节点遍历。
 * <en/> Column visitor callback type. Returning false skips traversal of the current node's children.
 */
export type ColumnVisitor<T = any>
  = (col: T, depth: number, parent?: T, index?: number) => false | void

/**
 * <zh/> 深度优先遍历列树。适用于任何带有可选 children 数组的列类型。
 * <en/> Depth-first traverse the column tree. Works for any column type with an optional children array.
 */
export function traverseColumnTree<T extends { children?: T[] }>(
  cols: T[],
  visitor: ColumnVisitor<T>,
  depth = 0,
  parent?: T,
): void {
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]
    const result = visitor(col, depth, parent, i)
    if (result !== false && isGroupColumn(col) && col.children?.length) {
      traverseColumnTree(col.children, visitor, depth + 1, col)
    }
  }
}

/**
 * <zh/> 仅遍历叶子列（非分组列）。
 * <en/> Traverse only leaf columns (non-group columns).
 */
export function traverseLeafColumns<T extends { children?: T[] }>(
  cols: T[],
  visitor: (col: T, depth: number, parent?: T) => void,
  depth = 0,
  parent?: T,
): void {
  traverseColumnTree(cols, (col, d, p) => {
    if (isGroupColumn(col)) {
      return
    }
    visitor(col, d, p)
  }, depth, parent)
}

/**
 * <zh/> 计算指定 key 在列树中的深度（根节点深度为 0）。
 *
 * <zh/> 与 utils/shared.ts 中的 getColumnDepth（计算整树最大深度）不同，此函数查找指定 key 所在的层级深度。
 *
 * <en/> Unlike getColumnDepth in utils/shared.ts (which computes the whole tree's max depth), this function finds the depth of the specific key.
 *
 * @param cols - <zh/> 列树 | <en/> column tree
 * @param targetKey - <zh/> 目标列 key | <en/> target column key
 * @param currentDepth - <zh/> 递归深度（内部使用） | <en/> recursive depth (internal)
 * @returns <zh/> 目标列的深度，未找到时返回 -1 | <en/> the target column's depth, -1 if not found
 */
export function findColumnDepth(cols: ProcessedColumn[], targetKey: string, currentDepth = 0): number {
  for (const col of cols) {
    if (getColumnKey(col) === targetKey)
      return currentDepth
    if (isGroupColumn(col) && col.children?.length) {
      const depth = findColumnDepth(col.children!, targetKey, currentDepth + 1)
      if (depth >= 0)
        return depth
    }
  }
  return -1
}

/**
 * <zh/> 按 prop（回退 key）在列树中查找列（单一源）——含分组子列。
 * <zh/> 编辑/校验/剪贴板/导出等“业务叶子列”链路必须经此查找，不得对列树顶层直接 `.find`，
 * <zh/> 否则分组子列被当成不存在（自定义 setter 不参与撤销、子列漏校验、复制出现空列）。
 * <en/> Single-source prop lookup across the column tree, including grouped sub-columns.
 */
export function findLeafColumnByProp<T extends { prop?: unknown, key?: unknown, children?: T[] }>(
  cols: readonly T[],
  prop: string,
): T | undefined {
  let found: T | undefined
  traverseColumnTree(cols as T[], (col) => {
    if (((col.prop as unknown) ?? (col.key as unknown)) === prop || (col.prop as unknown) === prop) {
      found = col
      return false
    }
  })
  return found
}

/**
 * <zh/> 列树展平为叶子列（单一源）——分组列本身无业务值（复制/剪切/粘贴/导航均以叶子列为准）。
 * <en/> Single-source column-tree flattening to leaf columns .
 */
export function flattenLeafColumns<T extends { children?: T[] }>(cols: readonly T[]): T[] {
  const leaves: T[] = []
  traverseLeafColumns(cols as T[], (col) => {
    leaves.push(col)
  })
  return leaves
}
