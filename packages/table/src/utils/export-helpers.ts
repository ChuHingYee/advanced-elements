import type { AdvColumn } from '../types/column'
import type { ColumnMode } from '../types/scope'
import { flattenLeafColumns } from './column-tree'
import { devWarn } from './dev-warn'
import { resolveCellText } from './resolve-cell-text'
import { stripSensitiveColumns } from './security'
import { isGroupHeaderRow } from './synthetic-row'

/**
 * <zh/> 筛选可导出的可视列（排除 hidden / selection / option 列）。
 * <en/> Filter exportable visible columns (excluding hidden / selection / option columns).
 */
export function filterVisibleExportableColumns<T>(columns: AdvColumn<T>[]): AdvColumn<T>[] {
  const out: AdvColumn<T>[] = []
  function visit(col: AdvColumn<T>): void {
    const children = (col as unknown as { children?: unknown }).children
    if (Array.isArray(children) && children.length > 0) {
      for (const child of children) {
        if (child && typeof child === 'object')
          visit(child as AdvColumn<T>)
      }
      return
    }
    if (col.hidden)
      return
    if (col.selection)
      return
    if (col.valueType === 'option')
      return
    out.push(col)
  }
  for (const col of columns)
    visit(col)
  return out
}

/**
 * <zh/> 筛选全部可导出的列（仅排除 selection / option 列，含隐藏列）。
 * <en/> Filter all exportable columns (only excluding selection / option columns, incl. hidden).
 */
export function filterAllExportableColumns<T>(columns: AdvColumn<T>[]): AdvColumn<T>[] {
  // columnMode:'all' 必须展平分组列树：组头无 prop，导出会产生空列并遗漏子列。
  // 递归收集叶子列后再过滤，保证子列参与导出。
  const out: AdvColumn<T>[] = []
  function visit(col: AdvColumn<T>): void {
    const children = (col as unknown as { children?: unknown }).children
    if (Array.isArray(children) && children.length > 0) {
      for (const child of children) {
        if (child && typeof child === 'object')
          visit(child as AdvColumn<T>)
      }
      return
    }
    if ((col as AdvColumn<T>).selection)
      return
    if ((col as AdvColumn<T>).valueType === 'option')
      return
    out.push(col)
  }
  for (const col of columns)
    visit(col)
  return out
}

/**
 * <zh/> 根据 columnMode 和 overrideColumns 解析可导出列。
 * <zh/> 安全契约：无论何种模式（含用户显式指定的 overrideColumns），标记 `sensitive: true`
 * <zh/> 的列一律被剥离——导出/打印共用本函数作为"数据出表"的单一安全咽喉。
 * <en/> Resolve exportable columns from columnMode and overrideColumns.
 * <en/> Security contract: columns marked `sensitive: true` are ALWAYS stripped regardless of
 * <en/> mode (including user-specified overrideColumns) — this function is the single security
 * <en/> choke point shared by export and print.
 *
 * @param columns - <zh/> 当前列配置 | <en/> current column configs
 * @param columnMode - <zh/> 列导出模式（'visible' | 'all'） | <en/> column export mode ('visible' | 'all')
 * @param overrideColumns - <zh/> 用户指定的覆盖列 | <en/> user-specified override columns
 * @returns <zh/> 可导出的列数组（已剔除敏感列） | <en/> exportable column array (sensitive stripped)
 */
export function resolveExportableColumns<T>(
  columns: AdvColumn<T>[],
  columnMode: ColumnMode | undefined,
  overrideColumns?: AdvColumn<T>[],
): AdvColumn<T>[] {
  // 用户 overrideColumns 同样展平为叶子列（与 columnMode 分支同口径），
  // 并剔除 selection / option 列；此前未展平会导致空列 + 遗漏子列。
  const resolved = overrideColumns && overrideColumns.length > 0
    ? flattenLeafColumns(overrideColumns).filter(col => !col.selection && col.valueType !== 'option')
    : columnMode === 'all'
      ? filterAllExportableColumns(columns)
      : filterVisibleExportableColumns(columns)

  // 敏感列剥离 + dev 告警（生产静默，仅提示开发者敏感列不会出现在导出文件中）
  // Sensitive-column stripping + dev warning (silent in production, informs devs that sensitive columns never reach exported files)
  const { safeColumns, strippedProps } = stripSensitiveColumns(resolved)
  if (strippedProps.length === 0) {
    // 零变更快路径——保留原引用，调用方的身份比较 / 测试断言不受影响
    // Zero-change fast path — preserve original reference so caller identity checks/tests are unaffected
    return resolved as AdvColumn<T>[]
  }
  devWarn(
    `${strippedProps.length} sensitive column(s) excluded from export/print: ${strippedProps.join(', ')}`,
  )
  return safeColumns as AdvColumn<T>[]
}

/**
 * <zh/> 解析列的导出表头文本。
 * <en/> Resolve a column's export header text.
 */
export function resolveColumnHeader<T = any>(col: AdvColumn<T>): string {
  return col.label ?? (typeof col.prop === 'string' ? col.prop : '')
}

/**
 * <zh/> 导出数据准备选项。
 * <en/> Export data preparation options.
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface PrepareExportDataOptions<T> {
  /** <zh/> 原始数据数组 | <en/> raw data array */
  data: T[]
  /** <zh/> 全部列配置 | <en/> all column configs */
  columns: AdvColumn<T>[]
  /** <zh/> 列导出模式：'visible' 仅导出可视列，'all' 包含隐藏列，默认 'visible' | <en/> column export mode: 'visible' exports only visible columns, 'all' includes hidden, default 'visible' */
  columnMode?: ColumnMode
  /** <zh/> 用户指定的覆盖列，优先级高于 columnMode | <en/> user-specified override columns, higher priority than columnMode */
  overrideColumns?: AdvColumn<T>[]
  /** <zh/> 表格上下文（可选），用于格式化时访问全局配置 | <en/> table context (optional), used to access global configs during formatting */
  ctx?: import('../types/config').TableContext | null
}

/**
 * <zh/> 导出数据准备结果。
 * <en/> Export data preparation result.
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface PreparedExportData<T = any> {
  /** <zh/> 表头文本数组 | <en/> header text array */
  headers: string[]
  /** <zh/> 二维字符串数组，每行对应一条记录，每列对应导出列 | <en/> 2D string array, each row a record, each column an export column */
  rows: string[][]
  /** <zh/> 实际参与导出的列配置数组 | <en/> column configs actually exported */
  exportableCols: import('../types/column').AdvColumn<T>[]
}

/**
 * <zh/> 准备导出数据 —— 根据列模式和覆盖配置筛选列，计算每行每列的展示文本。流程：解析可导出列 → 生成表头 → 遍历数据逐格调用 resolveCellText 得到字符串矩阵。若无可导出列则抛出错误。
 * <en/> Prepare export data — filter columns by mode and override config, then compute each cell's display text. Flow: resolve exportable columns → build headers → walk data calling resolveCellText per cell to get the string matrix. Throws if no exportable columns.
 *
 * @param options - <zh/> 导出数据准备选项 | <en/> export data preparation options
 * @returns <zh/> 包含表头、行数据矩阵及导出列配置的结构化结果 | <en/> structured result with headers, row matrix and exported column configs
 * @throws {Error} <zh/> 当无可导出列时抛出 'No exportable columns found.' | <en/> thrown when there are no exportable columns: 'No exportable columns found.'
 */
export function prepareExportData<T>(options: PrepareExportDataOptions<T>): PreparedExportData<T> {
  const { data, columns, columnMode = 'visible', overrideColumns, ctx = null } = options

  if (!Array.isArray(data)) {
    throw new TypeError('[AdvTable] prepareExportData: data must be an array')
  }
  if (!Array.isArray(columns)) {
    throw new TypeError('[AdvTable] prepareExportData: columns must be an array')
  }

  const exportableCols = resolveExportableColumns(columns, columnMode, overrideColumns)

  if (exportableCols.length === 0) {
    throw new Error('[AdvTable] No exportable columns found.')
  }

  // <zh/> 剔除分组头合成行——GroupHeaderRow 是渲染层的跨全列占位行，混入导出会产生
  // <zh/> 只有组名/计数的垃圾行。判定走 synthetic-row 共享谓词，
  // <zh/> 不依赖 rowGroupApi，保持本函数为纯函数。
  // <en/> Strip group-header synthetic rows — a GroupHeaderRow is a render-layer full-width
  // <en/> placeholder; leaking it into exports produces junk rows holding only the group
  // <en/> name/count. Detection uses the shared synthetic-row predicate without needing
  // <en/> rowGroupApi, keeping this function pure.
  const exportRows = (data as unknown[]).filter(row => !isGroupHeaderRow(row)) as T[]

  const headers: string[] = exportableCols.map(resolveColumnHeader)

  const rows: string[][] = exportRows.map((row, rowIndex) =>
    exportableCols.map((col, colIndex) => {
      const cellData = col.prop ? (row as Record<string, unknown>)[col.prop as string] : undefined
      return resolveCellText({
        cellData,
        row: row as Record<string, unknown>,
        column: col as import('../types/column').AdvColumn,
        columns: exportableCols as import('../types/column').AdvColumn[],
        index: rowIndex,
        columnIndex: colIndex,
        ctx,
      })
    }),
  )

  return { headers, rows, exportableCols }
}
