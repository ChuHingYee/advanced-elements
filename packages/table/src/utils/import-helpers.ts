import type { XlsxLib } from './ensure-xlsx'
import { ensureXlsx } from './ensure-xlsx'

const EXCEL_FILE_RE = /\.xlsx?$/i
const CSV_FILE_RE = /\.csv$/i

export interface ParseResult {
  columns: string[]
  rows: Record<string, unknown>[]
}

/**
 * <zh/> 将 CSV 文本解析为结构化结果。
 * <en/> Parse CSV text into a structured result.
 *
 * <zh/> CSV 规范：双引号包裹字段、双引号转义为两个双引号、支持换行。
 * <en/> CSV spec: double-quote-wrapped fields, double-quote escaped as two double quotes, new-lines supported.
 *
 * @example
 * parseCsvText('a,b\n1,2')
 * // => { columns: ['a', 'b'], rows: [{ a: '1', b: '2' }] }
 */
export function parseCsvText(
  text: string,
  options?: { delimiter?: string, headerRow?: boolean },
): ParseResult {
  const delimiter = options?.delimiter ?? ','
  if (typeof delimiter !== 'string' || delimiter.length !== 1) {
    throw new Error('[AdvTable] parseCsvText: delimiter must be a single character')
  }
  const headerRow = options?.headerRow ?? true

  /**
   * <zh/> 剥离 UTF-8 BOM——导出 CSV 默认带 BOM（\uFEFF），若不清除它会成为首个表头的
   * <zh/> 前缀导致列名错位（导入回环）。Excel 等工具导出 CSV 同样可能带 BOM。
   * <en/> Strip UTF-8 BOM — exported CSV carries a BOM (\uFEFF) by default; without stripping
   * <en/> it becomes a prefix of the first header, breaking the import/export round-trip.
   * <en/> CSVs exported by Excel and other tools may carry a BOM too.
   */
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1)
  }

  const records = parseCsvRecords(text, delimiter)

  if (records.length === 0)
    return { columns: [], rows: [] }

  const columns = headerRow ? records[0].map(String) : records[0].map((_, i) => `col_${i}`)
  const dataStart = headerRow ? 1 : 0
  const rows: Record<string, unknown>[] = []

  for (let i = dataStart; i < records.length; i++) {
    const record = records[i]
    const row: Record<string, unknown> = {}
    for (let j = 0; j < columns.length; j++) {
      row[columns[j]] = record[j] ?? ''
    }
    rows.push(row)
  }

  return { columns, rows }
}

/**
 * <zh/> 符合 RFC 4180 的 CSV 记录解析器，处理引号包裹、双引号转义、引号内换行。
 * <en/> RFC 4180 compliant CSV record parser, handling quote wrapping, double-quote escaping and in-quote new-lines.
 */
function parseCsvRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let currentRecord: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      currentField += char
      i++
    }
    else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      }
      if (char === delimiter) {
        currentRecord.push(currentField)
        currentField = ''
        i++
        continue
      }
      if (char === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n')
          i++
        currentRecord.push(currentField)
        currentField = ''
        records.push(currentRecord)
        currentRecord = []
        i++
        continue
      }
      if (char === '\n') {
        currentRecord.push(currentField)
        currentField = ''
        records.push(currentRecord)
        currentRecord = []
        i++
        continue
      }
      currentField += char
      i++
    }
  }

  if (currentField !== '' || currentRecord.length > 0) {
    currentRecord.push(currentField)
    records.push(currentRecord)
  }

  return records
}

/**
 * <zh/> 使用 xlsx（通过 ensureXlsx 按需加载）将 Excel ArrayBuffer 解析为结构化结果。不使用导入功能时零体积增长。
 * <en/> Parse an Excel ArrayBuffer into a structured result using xlsx (loaded on demand via ensureXlsx). Adds zero bundle size when import is unused.
 *
 * @example
 * const result = await parseExcelBuffer(buffer, { sheetName: 'Sheet1' })
 * // => { columns: ['a', 'b'], rows: [{ a: '1', b: '2' }] }
 */
export async function parseExcelBuffer(
  buffer: ArrayBuffer,
  options?: { sheetName?: string, headerRow?: boolean },
): Promise<ParseResult> {
  const headerRow = options?.headerRow ?? true

  const XLSX: XlsxLib = await ensureXlsx('import')

  // cellDates: true — 将 Excel 日期序列号解析为 Date 对象，而非数字 | cellDates: true — parse Excel date serial numbers as Date objects instead of numbers
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = options?.sheetName ?? workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  if (!worksheet)
    return { columns: [], rows: [] }

  const aoa: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

  if (aoa.length === 0)
    return { columns: [], rows: [] }

  const columns = headerRow
    ? (aoa[0] as unknown[]).map(v => String(v ?? ''))
    : (aoa[0] as unknown[]).map((_, i) => `col_${i}`)

  const dataStart = headerRow ? 1 : 0
  const rows: Record<string, unknown>[] = []

  for (let i = dataStart; i < aoa.length; i++) {
    const record = aoa[i] as unknown[]
    if (!record || record.length === 0)
      continue
    const row: Record<string, unknown> = {}
    for (let j = 0; j < columns.length; j++) {
      row[columns[j]] = record[j] ?? ''
    }
    rows.push(row)
  }

  return { columns, rows }
}

/**
 * <zh/> 以文本形式读取 File 对象的内容，使用 FileReader 异步读取，编码默认 utf-8。
 * <en/> Read a File's content as text via FileReader asynchronously, default encoding utf-8.
 *
 * @param file - <zh/> 要读取的文件 | <en/> file to read
 * @param encoding - <zh/> 文本编码，默认 'utf-8' | <en/> text encoding, default 'utf-8'
 * @returns <zh/> 文件内容的字符串 | <en/> the file content string
 */
export function readFileAsText(file: File, encoding?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsText(file, encoding ?? 'utf-8')
  })
}

/**
 * <zh/> 以 ArrayBuffer 形式读取 File 对象的内容，用于读取 Excel 等二进制文件。
 * <en/> Read a File's content as an ArrayBuffer, used for binary files such as Excel.
 *
 * @param file - <zh/> 要读取的文件 | <en/> file to read
 * @returns <zh/> 文件的 ArrayBuffer 数据 | <en/> the file's ArrayBuffer data
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * <zh/> 判断文件名是否为 Excel 文件（xlsx / xls）。
 * <en/> Whether a file name is an Excel file (xlsx / xls).
 *
 * @param filename - <zh/> 文件名 | <en/> file name
 * @returns <zh/> 是否为 Excel 文件 | <en/> whether it is an Excel file
 */
export function isExcelFile(filename: string): boolean {
  return EXCEL_FILE_RE.test(filename.trim())
}

/**
 * <zh/> 判断文件名是否为 CSV 文件。
 * <en/> Whether a file name is a CSV file.
 *
 * @param filename - <zh/> 文件名 | <en/> file name
 * @returns <zh/> 是否为 CSV 文件 | <en/> whether it is a CSV file
 */
export function isCsvFile(filename: string): boolean {
  return CSV_FILE_RE.test(filename.trim())
}
