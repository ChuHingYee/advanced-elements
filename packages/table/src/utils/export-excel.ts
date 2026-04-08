import type { AdvColumn } from '../types/column'
import type { TableContext } from '../types/config'
import type { ColumnMode } from '../types/scope'
import type { XlsxLib } from './ensure-xlsx'
import { ensureXlsx } from './ensure-xlsx'
import { prepareExportData, resolveColumnHeader } from './export-helpers'

/**
 * <zh/> 导出 Excel 的选项参数
 * <en/> Export Excel options
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface ExportExcelOptions<T = any> {
  /** <zh/> 要导出的数据行数组 | <en/> Data rows to export */
  data: T[]
  /** <zh/> 列配置，用于生成表头和格式化单元格值 | <en/> Column configs, used to build headers and format cell values */
  columns: AdvColumn<T>[]
  /** <zh/> 导出文件名（不含扩展名），默认 'export' | <en/> Export file name (without extension), default 'export' */
  filename?: string
  /** <zh/> Excel 工作表名称，默认 'Sheet1' | <en/> Excel worksheet name, default 'Sheet1' */
  sheetName?: string
  /** <zh/> 表格上下文，用于解析 valueType 自定义格式化 | <en/> Table context, used to resolve valueType custom formatting */
  ctx?: TableContext | null
  /** <zh/> 列模式：'visible' 仅导出可视列，'all' 导出全部可导出列（含隐藏列），默认 'visible' | <en/> Column mode: 'visible' exports only visible columns, 'all' exports all exportable columns (incl. hidden), default 'visible' */
  columnMode?: ColumnMode
  /** <zh/> 覆盖列配置，优先级高于 columns 参数 | <en/> Override column configs, higher priority than columns */
  overrideColumns?: AdvColumn<T>[]
  /** <zh/> 冻结窗格：xSplit 列数 / ySplit 行数，对应 worksheet['!freeze'] | <en/> Freeze pane: xSplit cols / ySplit rows → worksheet['!freeze'] */
  freezePane?: { xSplit?: number, ySplit?: number }
  /** <zh/> 合并单元格：worksheet['!merges']，如 [{s:{r:0,c:0},e:{r:0,c:1}}] | <en/> Merged cells: worksheet['!merges'] e.g. [{s:{r:0,c:0},e:{r:0,c:1}}] */
  merges?: Array<{ s: { r: number, c: number }, e: { r: number, c: number } }>
  /** <zh/> 透传给 xlsx.writeFile 的额外选项（如 bookType、password 等） | <en/> Extra options passed to xlsx.writeFile (e.g. bookType, password) */
  xlsxOptions?: Record<string, any>
}

/**
 * <zh/> 清洗工作表中的公式单元格，防御公式注入
 * <en/> Sanitize formula cells in a worksheet to defend against formula injection
 *
 * @remarks
 * <zh/> xlsx 的 aoa_to_sheet 会将以 `=` 开头的字符串值解释为公式单元格（cell.t === 'f'）。
 * <zh/> 攻击者可构造恶意数据在用户导出并打开 xlsx 时执行任意公式。
 * <zh/> 此函数遍历所有单元格，将公式单元格还原为字符串类型，保留原始文本以供查看。
 * <en/> xlsx's aoa_to_sheet interprets string values starting with `=` as formula cells (cell.t === 'f').
 * <en/> Attackers can craft malicious data that executes arbitrary formulas when the xlsx is exported and opened.
 * <en/> This function iterates all cells and reverts formula cells to string type, preserving the original text for viewing.
 */
function sanitizeWorksheetFormulas(worksheet: unknown): void {
  const ws = worksheet as Record<string, unknown>
  if (!ws || typeof ws !== 'object')
    return
  for (const key of Object.keys(ws)) {
    if (key.startsWith('!'))
      continue
    const cell = ws[key] as Record<string, unknown> | undefined
    // cell.t === 'f' 表示公式单元格；将其转回字符串类型，值保留原始公式文本
    if (cell && cell.t === 'f') {
      const formulaText = cell.f != null ? `=${String(cell.f)}` : (cell.v ?? '')
      ws[key] = { t: 's', v: String(formulaText) }
    }
  }
}

/**
 * <zh/> 导出数据为 Excel 文件并触发浏览器下载
 * <en/> Export data as Excel file and trigger browser download
 *
 * @remarks
 * <zh/> 内部流程：
 * <zh/> 1. 动态 import 加载 xlsx 库，未安装时抛出友好提示
 * <zh/> 2. 调用 prepareExportData 预处理数据（格式化单元格值、筛选列）
 * <zh/> 3. 构建二维数组（首行为表头，后续为数据行）
 * <zh/> 4. 调用 XLSX.utils.aoa_to_sheet 生成工作表
 * <zh/> 5. 根据表头与列内容自动计算列宽，设置 !cols 属性
 * <zh/> 6. 创建工作簿并追加工作表，最终调用 XLSX.writeFile 触发下载
 * <en/> Internal flow:
 * <en/> 1. Dynamically imports xlsx library, throws friendly error if not installed
 * <en/> 2. Calls prepareExportData to preprocess data (format cell values, filter columns)
 * <en/> 3. Builds 2D array (first row is header, subsequent rows are data)
 * <en/> 4. Calls XLSX.utils.aoa_to_sheet to create worksheet
 * <en/> 5. Auto-calculates column widths based on headers and content, sets !cols property
 * <en/> 6. Creates workbook, appends worksheet, calls XLSX.writeFile to trigger download
 *
 * <zh/> xlsx 库通过动态 import 按需加载，确保不使用导出功能时零体积增长。若 xlsx 未安装，抛出友好错误提示
 * <en/> xlsx library is loaded on demand via dynamic import, ensuring zero bundle size increase when export is not used. Throws friendly error if xlsx is not installed
 *
 * @param options - <zh/> 导出选项 | <en/> export options
 * @throws {Error} <zh/> 当 xlsx 库未安装时抛出 | <en/> thrown when xlsx library is not installed
 * @throws {Error} <zh/> 当无可导出列时抛出 | <en/> thrown when there are no exportable columns
 * @example
 * // 基本用法 (Basic usage)
 * await exportExcel({ data: rows, columns })
 * @example
 * // 自定义文件名与工作表名 (Custom file name and sheet name)
 * await exportExcel({ data: rows, columns, filename: '报表', sheetName: '数据' })
 */
export async function exportExcel<T = any>(options: ExportExcelOptions<T>): Promise<void> {
  const {
    data,
    columns,
    filename = 'export',
    sheetName = 'Sheet1',
    ctx = null,
    columnMode = 'visible',
    overrideColumns,
    xlsxOptions,
  } = options

  const XLSX: XlsxLib = await ensureXlsx('export')

  const { headers, rows, exportableCols } = prepareExportData({ data, columns, columnMode, overrideColumns, ctx })

  const aoa: string[][] = [headers, ...rows]

  const worksheet = XLSX.utils.aoa_to_sheet(aoa)
  // 公式注入防御：将 aoa_to_sheet 误解释为公式的单元格还原为字符串类型
  // Formula injection defense: revert cells misinterpreted as formulas by aoa_to_sheet to string type
  sanitizeWorksheetFormulas(worksheet)

  /** <zh/> 导出列宽最大字符数上限 | <en/> Max column width in characters */
  const MAX_WCH = 80
  /**
   * <zh/> 列宽采样行数上限——超过此阈值时仅采样前 N 行估算列宽，避免 O(n*m) 全量遍历阻塞主线程 |
   * <en/> Column width sampling row limit — when rows exceed this threshold, only the first N rows are sampled
   * <en/> to estimate column widths, avoiding O(n*m) full traversal blocking the main thread
   */
  const COL_WIDTH_SAMPLE_LIMIT = 1000
  const sampledRows = rows.length > COL_WIDTH_SAMPLE_LIMIT ? rows.slice(0, COL_WIDTH_SAMPLE_LIMIT) : rows
  const colWidths = exportableCols.map((col, colIndex) => {
    const headerLen = resolveColumnHeader(col).length
    let maxLen = headerLen
    // <zh/> 考虑数据内容宽度，取表头与数据的最大长度（采样模式避免大数据量阻塞） |
    // <en/> Consider data content width, use the max of header and data lengths (sampling avoids blocking on large data)
    for (const row of sampledRows) {
      const cellValue = row[colIndex]
      if (cellValue != null) {
        const cellLen = String(cellValue).length
        if (cellLen > maxLen)
          maxLen = cellLen
      }
    }
    return { wch: Math.min(Math.max(maxLen * 2, 10), MAX_WCH) }
  })
  // XLSX 工作表有运行时的 !cols 属性，类型定义中未声明 | XLSX worksheet has runtime !cols property not in type defs
  ;(worksheet as Record<string, unknown>)['!cols'] = colWidths

  // <zh/> 冻结窗格与合并单元格（!freeze/!merges）——按需设置，零开销透传
  // <en/> Freeze pane and merged cells (!freeze/!merges) — set on demand, zero-overhead passthrough
  if (options.freezePane && (options.freezePane.xSplit || options.freezePane.ySplit)) {
    const xSplit = options.freezePane.xSplit ?? 0
    const ySplit = options.freezePane.ySplit ?? 0
    const topLeftCell = XLSX.utils.encode_cell({ r: ySplit, c: xSplit })
    ;(worksheet as Record<string, unknown>)['!freeze'] = { xSplit, ySplit, topLeftCell, activePane: 'bottomRight' }
    ;(worksheet as Record<string, unknown>)['!pane'] = { xSplit, ySplit, topLeftCell, activePane: 'bottomRight', state: 'frozen' }
  }
  if (options.merges?.length) {
    ;(worksheet as Record<string, unknown>)['!merges'] = options.merges
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  XLSX.writeFile(workbook, `${filename}.xlsx`, xlsxOptions)
}
