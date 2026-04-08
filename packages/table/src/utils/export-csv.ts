import type { AdvColumn } from '../types/column'
import type { TableContext } from '../types/config'
import type { ColumnMode } from '../types/scope'
import { prepareExportData } from './export-helpers'
import { idleSchedule } from './raf'
import { neutralizeFormulaInjection } from './security'

const CSV_QUOTE_RE = /"/g

/**
 * <zh/> CSV 分片异步化的行数阈值——超过该行数时序列化拆片并经 idleSchedule 让出主线程，
 * <zh/> 避免万级行全量 join/escape 阻塞页面。取值与 SUMMARY_ASYNC_THRESHOLD 同量级策略（万级）。
 * <en/> Row threshold for CSV chunking — above this the serialization splits into chunks that yield
 * <en/> via idleSchedule, avoiding a page-blocking full-matrix join/escape for tens of thousands of
 * <en/> rows. Same order-of-magnitude policy as SUMMARY_ASYNC_THRESHOLD.
 */
const CSV_CHUNK_ASYNC_THRESHOLD = 10_000

/**
 * <zh/> CSV 导出选项。
 * <en/> CSV export options.
 *
 * <zh/> 注意：`types/config-toolbar.ts` 另有同名非泛型 `ExportCsvOptions`（工具栏配置侧）。
 * <zh/> 本接口为底层导出函数入参；引用时优先使用别名 `ExportCsvUtilOptions` 以避免导错包。
 *
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface ExportCsvOptions<T = any> {
  /** <zh/> 要导出的原始数据 | <en/> raw data to export */
  data: T[]
  /** <zh/> 列配置 | <en/> column configs */
  columns: AdvColumn<T>[]
  /**
   * <zh/> 导出文件名（不含扩展名），默认与 `table.export.filename` 一致（'export'）
   * <en/> Export file name (without extension), defaults to `table.export.filename` ('export')
   */
  filename?: string
  /** <zh/> 表格上下文，用于自定义单元格文本解析 | <en/> table context for custom cell-text parsing */
  ctx?: TableContext | null
  /** <zh/> 列模式：'visible' 仅导出可视列，'all' 导出所有列（含隐藏），默认 'visible' | <en/> column mode: 'visible' exports only visible columns, 'all' exports all (incl. hidden), default 'visible' */
  columnMode?: ColumnMode
  /** <zh/> 覆盖列配置，用于自定义导出列的字段/顺序 | <en/> override column configs to customize exported fields/order */
  overrideColumns?: AdvColumn<T>[]
  /** <zh/> 是否添加 BOM（\uFEFF），让 Excel 正确识别 UTF-8 中文，默认 true | <en/> whether to add a BOM (\uFEFF) so Excel recognizes UTF-8 Chinese, default true */
  bom?: boolean
}

/**
 * <zh/> 底层 CSV 导出选项别名——与工具栏配置侧 `types/config-toolbar.ts` 的同名接口区分。
 * <en/> Alias for the low-level CSV export options — disambiguated from the same-named toolbar-config interface.
 */
export type ExportCsvUtilOptions<T = any> = ExportCsvOptions<T>

/**
 * <zh/> 转义 CSV 字段值：包含逗号/引号/换行时使用双引号包裹并转义内部引号。
 * <zh/> 同时防御公式注入：以 = + - @ \t \r 开头的值前置单引号，强制 Excel 以文本解析。
 * <en/> Escape a CSV field value: wrap in double quotes and escape inner quotes when it contains comma/quote/newline.
 * <en/> Also mitigates formula injection: values starting with = + - @ \t \r are prefixed with a single quote to force Excel text parsing.
 */
function escapeCsvValue(value: string): string {
  if (value == null)
    return ''
  // <zh/> 公式注入防御（纯数字豁免，避免负数被误伤为文本）——判定语义统一收敛至
  // <zh/> security.ts，与剪贴板复制/粘贴共用同一实现，避免"导出安全但复制不安全"的缺口。
  // <en/> Formula injection defense (numeric values exempted) — the decision semantics now live in
  // <en/> security.ts and are shared with clipboard copy/paste, closing the "export safe but copy
  // <en/> unsafe" gap.
  const str = neutralizeFormulaInjection(String(value))
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(CSV_QUOTE_RE, '""')}"`
  }
  return str
}

/**
 * <zh/> 导出 CSV 的公共入口——内部按 CSV_CHUNK_ASYNC_THRESHOLD 行数自动切换：
 * <zh/> 大数据走 {@linkcode exportCsvChunked}（分片异步序列化，避免阻塞主线程）；
 * <zh/> 小数据保持同步路径（单次 join 是全量最快形态，且保持既有同步签名行为）。
 *
 * <en/> CSV export entry — internally switches by CSV_CHUNK_ASYNC_THRESHOLD:
 * <en/> large data routes to {@linkcode exportCsvChunked} (chunked async serialization, no
 * <en/> main-thread block); small data keeps the synchronous path (single join is the fastest
 * <en/> form and preserves the historical synchronous signature behavior).
 *
 * @param options - <zh/> CSV 导出选项 | <en/> CSV export options
 * @returns <zh/> 大数据时为 Promise（分片异步完成），小数据时同步完成返回 void | <en/> a Promise for large datasets (async chunking), void (synchronous) for small ones
 * @throws {Error} <zh/> 当无可导出列时抛出 | <en/> thrown when there are no exportable columns
 * @example
 * exportCsv({ data: rows, columns })
 */
export function exportCsv<T = any>(options: ExportCsvOptions<T>): void | Promise<void> {
  const parts = buildCsvParts(options)
  if (parts.rows.length > CSV_CHUNK_ASYNC_THRESHOLD)
    return exportCsvChunked(options, parts)
  exportCsvSync(options, parts)
}

/**
 * <zh/> 同步导出 CSV（小数据路径）——单次 join + escape，全量路径最快的形态。
 * @param options - <zh/> CSV 导出选项 | <en/> CSV export options
 */
export function exportCsvSync<T = any>(options: ExportCsvOptions<T>, prebuilt?: CsvParts): void {
  const { headers, rows, bom = true } = prebuilt ?? buildCsvParts(options)

  // SSR 环境无 document，显式抛守卫错误而非 ReferenceError
  // Without document in SSR, throw an explicit guard error instead of ReferenceError
  if (typeof document === 'undefined')
    throw new Error('[AdvTable] TABLE_SSR_GUARD: exportCsv requires a browser environment')
  const bomChar = bom ? '\uFEFF' : ''
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => escapeCsvValue(cell)).join(','))
    .join('\r\n')
  const blob = new Blob([bomChar + csvContent], { type: 'text/csv;charset=utf-8;' })
  triggerCsvDownload(blob, options.filename ?? 'export')
}

/**
 * <zh/> 分片异步导出——按 CSV_CHUNK_ASYNC_THRESHOLD 行以上时把序列化拆为多片，
 * <zh/> 片间经 idleSchedule 让出主线程，避免万级行全量 join/escape 长时间阻塞。
 * <en/> Chunked async export — above CSV_CHUNK_ASYNC_THRESHOLD rows the serialization is split
 * <en/> into chunks that yield the main thread via idleSchedule, avoiding a long-blocking
 * <en/> full-matrix join/escape for tens of thousands of rows.
 */
export async function exportCsvChunked<T = any>(options: ExportCsvOptions<T>, prebuilt?: CsvParts): Promise<void> {
  const { headers, rows, bom = true } = prebuilt ?? buildCsvParts(options)

  if (typeof document === 'undefined')
    throw new Error('[AdvTable] TABLE_SSR_GUARD: exportCsvChunked requires a browser environment')

  // <zh/> 小数据不退化为多片：单次 join 是全量路径最快的形态 | <en/> No degradation for small data — a single join is the fastest form of the full path
  const parts: string[] = []
  if (rows.length > CSV_CHUNK_ASYNC_THRESHOLD) {
    const chunkSize = CSV_CHUNK_ASYNC_THRESHOLD
    for (let start = 0; start < rows.length; start += chunkSize) {
      const slice = rows.slice(start, start + chunkSize)
        .map(row => row.map(cell => escapeCsvValue(cell)).join(','))
        .join('\r\n')
      parts.push(slice)
      // <zh/> 片间让出主线程——idleSchedule 的入参即回调、返回值为 cancel，切勿把返回值当回调调用
      // <en/> Yields the main thread between chunks — idleSchedule's ARGUMENT is the callback and its
      // <en/> RETURN VALUE is the canceler; never call the return value as if it were the callback
      await new Promise<void>(resolve => idleSchedule(resolve, 100))
    }
  }
  else {
    parts.push(rows.map(row => row.map(cell => escapeCsvValue(cell)).join(',')).join('\r\n'))
  }

  const bomChar = bom ? '\uFEFF' : ''
  const headerLine = `${headers.map(cell => escapeCsvValue(cell)).join(',')}\r\n`
  const blob = new Blob([bomChar + headerLine, ...parts], {
    type: 'text/csv;charset=utf-8;',
  })
  triggerCsvDownload(blob, options.filename ?? 'export')
}

/** <zh/> 触发 CSV Blob 下载并在结束后释放 URL | <en/> Trigger a CSV Blob download and release the URL afterwards */
function triggerCsvDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  // <zh/> click 抛错也必须释放 Blob URL，否则泄漏 | <en/> The Blob URL must be released even when click throws, or it leaks
  try {
    link.click()
  }
  finally {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * <zh/> CSV 部件（表头 + 二维单元格矩阵）——序列化与下载共用的纯组装步骤。
 * <en/> CSV parts (header + 2D cell matrix) — the shared pure assembly step for serialization and download.
 */
interface CsvParts {
  headers: string[]
  rows: string[][]
  bom?: boolean
}

/** <zh/> 构造 CSV 部件（调用方传入可避免重复组装） | <en/> Build CSV parts (pass the prebuilt value to avoid re-assembly) */
function buildCsvParts<T>(options: ExportCsvOptions<T>): CsvParts {
  const { data, columns, ctx = null, columnMode = 'visible', overrideColumns, bom = true } = options
  const { headers, rows } = prepareExportData({ data, columns, columnMode, overrideColumns, ctx })
  return { headers, rows, bom }
}
