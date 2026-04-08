import type { AdvColumn } from '../types/column'
import type { TableContext } from '../types/config'
import type { ColumnMode } from '../types/scope'
import type { PreparedExportData } from './export-helpers'
import { prepareExportData } from './export-helpers'

/**
 * <zh/> 打印选项参数
 * <en/> Print options
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface PrintOptions<T = any> {
  /** <zh/> 要打印的数据行数组 | <en/> Data rows to print */
  data: T[]
  /** <zh/> 列配置，用于生成表头和格式化单元格值 | <en/> Column config, used to generate headers and format cell values */
  columns: AdvColumn<T>[]
  /** <zh/> 打印页标题，默认空 | <en/> Print page title, defaults to empty */
  sheetName?: string
  /** <zh/> 表格上下文，用于解析 valueType 自定义格式化 | <en/> Table context, used to resolve valueType custom formatting */
  ctx?: TableContext | null
  /** <zh/> 列模式：'visible' 仅打印可视列，'all' 打印全部可打印列（含隐藏列），默认 'visible' | <en/> Column mode: 'visible' only prints visible columns, 'all' prints all printable columns (including hidden), defaults to 'visible' */
  columnMode?: ColumnMode
  /** <zh/> 覆盖列配置，优先级高于 columns 参数 | <en/> Override column config, takes priority over columns param */
  overrideColumns?: AdvColumn<T>[]
  /** <zh/> 页面方向，默认 'portrait' | <en/> Page orientation, defaults to 'portrait' */
  pageOrientation?: 'portrait' | 'landscape'
  /** <zh/> 纸张大小，默认 'A4' | <en/> Paper size, defaults to 'A4' */
  paperSize?: 'A4' | 'A3' | 'letter'
  /** <zh/> 每页行数（0 = 不分页，浏览器自动分页），默认 0 | <en/> Rows per page (0 = no pagination, browser auto-pagination), defaults to 0 */
  rowsPerPage?: number
  /** <zh/> 自定义打印样式（CSS 字符串） | <en/> Custom print styles (CSS string) */
  style?: string
  /**
   * <zh/> 自定义页眉 HTML 或函数（视为可信 HTML 原文拼接，不可直传用户输入）
   * <en/> Custom header HTML or function (treated as trusted HTML, never pass raw user input)
   *
   * @example
   * ```ts
   * printTable({ data, columns, headerHtml: '<div>Report</div>' })
   * ```
   */
  headerHtml?: string | ((params: { currentPage: number, totalPages: number, sheetName: string }) => string)
  /**
   * <zh/> 自定义页脚 HTML 或函数（视为可信 HTML 原文拼接，不可直传用户输入）
   * <en/> Custom footer HTML or function (treated as trusted HTML, never pass raw user input)
   *
   * @example
   * ```ts
   * printTable({ data, columns, footerHtml: ({ currentPage }) => `<div>${currentPage}</div>` })
   * ```
   */
  footerHtml?: string | ((params: { currentPage: number, totalPages: number, sheetName: string }) => string)
  /** <zh/> 打印前回调，返回 false 取消打印 | <en/> Callback before printing; returning false cancels */
  beforePrint?: (params: { data: T[], columns: AdvColumn<T>[] }) => boolean | Promise<boolean>
  /** <zh/> 打印完成回调 | <en/> Callback after printing */
  afterPrint?: () => void
  /** <zh/> 是否显示行号列，默认 false | <en/> Whether to show the row-number column, default false */
  showRowIndex?: boolean
  /** <zh/> 行号列表头文案，默认 '序号' | <en/> Row-number column header text, default '序号' */
  rowIndexLabel?: string
}

/** <zh/> 纸张尺寸映射（mm） | <en/> Paper-size map (mm) */
const PAPER_SIZES: Record<string, { width: number, height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  letter: { width: 215.9, height: 279.4 },
}

/**
 * 生成默认打印样式表
 * @param paperSize - 纸张大小
 * @param orientation - 页面方向
 * @param customStyle - 用户自定义样式
 * @internal
 */
export function buildPrintStyle(
  paperSize: string,
  orientation: string,
  customStyle?: string,
): string {
  const size = PAPER_SIZES[paperSize] ?? PAPER_SIZES.A4
  const isLandscape = orientation === 'landscape'
  const pageWidth = isLandscape ? size.height : size.width
  const pageHeight = isLandscape ? size.width : size.height

  return `
@page {
  size: ${pageWidth}mm ${pageHeight}mm;
  margin: 10mm;
}
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 12px;
  color: var(--el-text-color-primary, #303133);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.adv-table-print-title {
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  padding: 10px 0 16px;
}
.adv-table-print-page-break {
  page-break-after: always;
}
.adv-table-print-page-break:last-child {
  page-break-after: auto;
}
.adv-table-print-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
}
.adv-table-print-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
  border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
  margin-top: 8px;
}
.adv-table-print-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}
.adv-table-print-cell {
  border: 1px solid var(--el-border-color-light, #dcdfe6);
  padding: 6px 8px;
  text-align: left;
  word-break: break-word;
  overflow-wrap: break-word;
}
.adv-table-print-cell--header {
  background-color: var(--el-fill-color-light, #f5f7fa);
  font-weight: 600;
  color: var(--el-text-color-regular, #606266);
  white-space: nowrap;
}
.adv-table-print-cell--body {
  color: var(--el-text-color-primary, #303133);
}
.adv-table-print-cell--row-index {
  text-align: center;
  color: var(--el-text-color-placeholder, #c0c4cc);
  width: 40px;
  min-width: 40px;
}
.adv-table-print-row {
  page-break-inside: avoid;
}
${customStyle ? sanitizePrintStyle(customStyle) : ''}
`
}

/** <zh/> 可逃逸 style 标签的载荷模式（模块级预编译，避免每次调用重建） | <en/> Style-tag breakout pattern (module-level precompiled, avoid per-call recompilation) */
const STYLE_BREAKOUT_RE = /<\/style/gi

/**
 * <zh/> 清理用户自定义打印样式——剔除可逃逸 `</style>` 的载荷（大小写不敏感），
 * <zh/> 防止样式字符串闭合 style 标签后注入任意 HTML/脚本。其余样式原文保留。
 * <en/> Sanitize user print styles — strip payloads that can break out of `</style>`
 * <en/> (case-insensitive), preventing style strings from closing the style tag to inject
 * <en/> arbitrary HTML/script. All other styles pass through untouched.
 */
function sanitizePrintStyle(style: string): string {
  STYLE_BREAKOUT_RE.lastIndex = 0
  return style.replace(STYLE_BREAKOUT_RE, '')
}

/**
 * 解析页眉/页脚 HTML
 * @param template - HTML 字符串或函数
 * @param params - 页码参数
 * @param params.currentPage - 当前页码
 * @param params.totalPages - 总页数
 * @param params.sheetName - 工作表名称
 * @internal
 */
export function resolvePageTemplate(
  template: string | ((params: { currentPage: number, totalPages: number, sheetName: string }) => string) | undefined,
  params: { currentPage: number, totalPages: number, sheetName: string },
): string {
  if (!template)
    return ''
  if (typeof template === 'function')
    return template(params)
  return template
}

/**
 * 将数据分页
 * @param rows - 数据行（字符串二维数组）
 * @param rowsPerPage - 每页行数，0 表示不分页
 * @internal
 */
export function paginateRows(rows: string[][], rowsPerPage: number): string[][][] {
  if (rowsPerPage <= 0 || rowsPerPage >= rows.length)
    return [rows]
  const pages: string[][][] = []
  for (let i = 0; i < rows.length; i += rowsPerPage) {
    pages.push(rows.slice(i, i + rowsPerPage))
  }
  return pages
}

/**
 * 构建打印 HTML 内容
 * @param prepared - 预处理后的导出数据
 * @param options - 打印选项
 * @internal
 */
export function buildPrintHtml<T>(prepared: PreparedExportData<T>, options: PrintOptions<T>): string {
  const {
    sheetName = '',
    pageOrientation = 'portrait',
    paperSize = 'A4',
    rowsPerPage = 0,
    style: customStyle,
    headerHtml,
    footerHtml,
    showRowIndex = false,
    rowIndexLabel = '序号',
  } = options

  const { headers, rows } = prepared

  /** <zh/> 带行号的表头 | <en/> Headers including the row-index column */
  const fullHeaders = showRowIndex ? [rowIndexLabel, ...headers] : headers

  /** <zh/> 带行号的数据行 | <en/> Data rows including row-index cells */
  const fullRows = rows.map((row, rowIndex) =>
    showRowIndex ? [String(rowIndex + 1), ...row] : row,
  )

  const pages = paginateRows(fullRows, rowsPerPage)
  const totalPages = pages.length

  const style = buildPrintStyle(paperSize, pageOrientation, customStyle)

  let html = ''

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const currentPage = pageIdx + 1
    const pageRows = pages[pageIdx]
    const pageParams = { currentPage, totalPages, sheetName }

    const headerContent = resolvePageTemplate(headerHtml, pageParams)
    const footerContent = resolvePageTemplate(footerHtml, pageParams)

    html += `<div class="adv-table-print-page-break">`

    /** <zh/> 标题 | <en/> Title */
    if (sheetName) {
      html += `<div class="adv-table-print-title">${escapeHtml(sheetName)}</div>`
    }

    /** <zh/> 页眉 | <en/> Page header */
    if (headerContent) {
      html += `<div class="adv-table-print-header">${headerContent}</div>`
    }

    /** <zh/> 表格 | <en/> Table */
    html += `<table class="adv-table-print-table">`
    html += `<thead><tr>`
    for (const header of fullHeaders) {
      html += `<th class="adv-table-print-cell adv-table-print-cell--header">${escapeHtml(header)}</th>`
    }
    html += `</tr></thead>`
    html += `<tbody>`
    for (const row of pageRows) {
      html += `<tr class="adv-table-print-row">`
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cellClass = showRowIndex && colIdx === 0
          ? 'adv-table-print-cell adv-table-print-cell--row-index'
          : 'adv-table-print-cell adv-table-print-cell--body'
        // 数据行单元格内容需转义 HTML，防止注入风险
        // Data row cell content must be HTML-escaped to prevent injection
        html += `<td class="${cellClass}">${escapeHtml(String(row[colIdx] ?? ''))}</td>`
      }
      html += `</tr>`
    }
    html += `</tbody></table>`

    /** <zh/> 页脚 | <en/> Page footer */
    if (footerContent) {
      html += `<div class="adv-table-print-footer">${footerContent}</div>`
    }

    html += `</div>`
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${style}</style></head><body>${html}</body></html>`
}

// HTML 特殊字符转义正则
// Regex for escaping special HTML characters
const ESCAPE_AMP_RE = /&/g
const ESCAPE_LT_RE = /</g
const ESCAPE_GT_RE = />/g
const ESCAPE_QUOT_RE = /"/g

/**
 * HTML 特殊字符转义
 * @internal
 */
export function escapeHtml(text: string): string {
  return text
    .replace(ESCAPE_AMP_RE, '&amp;')
    .replace(ESCAPE_LT_RE, '&lt;')
    .replace(ESCAPE_GT_RE, '&gt;')
    .replace(ESCAPE_QUOT_RE, '&quot;')
}

/**
 * 创建隐藏的打印 iframe 并执行打印
 * @param printHtml - 完整的打印 HTML 文档
 * @param afterPrint - 打印完成回调
 * @internal
 */
export function createPrintIframe(printHtml: string, afterPrint?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    // SSR 环境无 document，显式拒绝而非 ReferenceError
    // Without document in SSR, reject explicitly instead of ReferenceError
    if (typeof document === 'undefined') {
      reject(new Error('[AdvTable] TABLE_SSR_GUARD: createPrintIframe requires a browser environment'))
      return
    }
    const iframe = document.createElement('iframe')
    // <zh/> 沙箱隔离打印文档：禁用内嵌脚本执行，仅允许打印对话框与同源文档写入；
    // <zh/> 数据单元格已全量转义，此为纵深兜底。
    // <en/> Sandbox the print document: no embedded script execution, only print dialogs
    // <en/> and same-origin document writes; data cells are already escaped, this is defense in depth.
    iframe.setAttribute('sandbox', 'allow-modals allow-same-origin')
    iframe.style.position = 'absolute'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.left = '-9999px'
    iframe.style.top = '-9999px'
    iframe.style.border = 'none'
    document.body.appendChild(iframe)

    const frameDoc = iframe.contentWindow?.document
    if (!frameDoc) {
      document.body.removeChild(iframe)
      reject(new Error('[AdvTable] Failed to access iframe document'))
      return
    }

    frameDoc.open()
    frameDoc.write(printHtml)
    frameDoc.close()

    /** <zh/> 等待内容加载完成后打印 | <en/> Wait for content to finish loading before printing */
    /**
     * <zh/> onload 超时兜底——CSP 拦截/边缘环境下 onload 永不触发时 10s 拒绝，避免上层 printing 状态卡死；
     * <zh/> onload 正常触发即清除，不悬挂句柄（复用 ensure-xlsx 超时模式）。
     * <en/> onload timeout guard — rejects after 10s when onload never fires (CSP/edge cases), so upper
     * <en/> printing state never sticks; cleared on normal onload with no dangling handle (same pattern as ensure-xlsx).
     */
    let onloadFired = false
    const onloadTimerId = setTimeout(() => {
      if (!onloadFired) {
        try {
          document.body.removeChild(iframe)
        }
        catch {
          // ignore
        }
        reject(new Error('[AdvTable] Print iframe load timed out'))
      }
    }, 10_000)

    iframe.onload = () => {
      onloadFired = true
      clearTimeout(onloadTimerId)
      try {
        const contentWindow = iframe.contentWindow
        if (!contentWindow) {
          throw new Error('[AdvTable] Failed to access iframe contentWindow')
        }

        /** 5 秒兜底定时器引用——afterprint 触发后需清理 | 5s fallback timer reference — must be cleared after afterprint fires */
        let fallbackTimerId: ReturnType<typeof setTimeout> | null = null
        // 显式获取 contentWindow 引用，避免后续闭包中 TS 无法保持非空收窄
        // Explicitly capture contentWindow reference to avoid TS losing non-null narrowing inside closures
        const cw = contentWindow

        /** 清理打印相关资源：移除事件监听、移除 iframe、清理定时器 | Cleanup print resources: remove event listener, remove iframe, clear timer */
        const cleanupPrintResources = () => {
          if (fallbackTimerId != null) {
            clearTimeout(fallbackTimerId)
            fallbackTimerId = null
          }
          cw.removeEventListener('afterprint', afterPrintHandler)
          if (iframe.parentNode) {
            try {
              document.body.removeChild(iframe)
            }
            catch {
              // 兜底：iframe 可能已被移除
              // Fallback: the iframe may have been removed already
            }
          }
        }

        /** 监听打印对话框关闭——函数声明式定义以便 cleanupPrintResources 前向引用（声明提升） | Listen for the print dialog close — declared as a function so cleanupPrintResources may reference it (hoisting) */
        function afterPrintHandler() {
          cleanupPrintResources()
          afterPrint?.()
          resolve()
        }
        cw.addEventListener('afterprint', afterPrintHandler)

        cw.focus()
        cw.print()

        /**
         * 超时兜底：某些浏览器不触发 afterprint 事件
         * 5 秒后自动清理 iframe（并清理 afterprint 监听）
         */
        fallbackTimerId = setTimeout(() => {
          fallbackTimerId = null
          cleanupPrintResources()
          resolve()
        }, 5000)
      }
      catch (err) {
        try {
          document.body.removeChild(iframe)
        }
        catch {
          // ignore
        }
        reject(err)
      }
    }
  })
}

/**
 * <zh/> 打印结果——`beforePrint` 返回 false 时为取消，不弹成功提示。
 * <en/> Print result — cancelled when `beforePrint` returns false; no success toast then.
 */
export interface PrintTableResult {
  /** <zh/> 是否被 beforePrint 取消 | <en/> Whether cancelled by beforePrint */
  cancelled: boolean
}

/**
 * 打印表格数据 — 通过 iframe 调用浏览器打印对话框
 *
 * 内部流程：
 * 1. 调用 prepareExportData 预处理数据（格式化单元格值、筛选列）
 * 2. 构建打印 HTML（含分页、页眉页脚、样式）
 * 3. 创建隐藏 iframe 写入 HTML
 * 4. 调用 iframe.contentWindow.print 触发打印
 * 5. 打印完成后清理 iframe
 *
 * @param options - 打印选项，见 {@link PrintOptions}
 * @returns 是否取消（cancelled=true 时调用方不得弹成功提示）
 * @throws {Error} 当无可打印列时抛出
 * @example
 * // 基本用法 (Basic usage)
 * await printTable({ data: rows, columns })
 * @example
 * // 自定义标题和横向打印 (Custom title and landscape)
 * await printTable({ data: rows, columns, sheetName: '报表', pageOrientation: 'landscape' })
 */
export async function printTable<T = any>(options: PrintOptions<T>): Promise<PrintTableResult> {
  const {
    data,
    columns,
    ctx = null,
    columnMode = 'visible',
    overrideColumns,
    beforePrint,
  } = options

  const prepared = prepareExportData({ data, columns, columnMode, overrideColumns, ctx })

  /** <zh/> 打印前回调 | <en/> Callback before printing */
  if (beforePrint) {
    const shouldContinue = await beforePrint({ data, columns: prepared.exportableCols })
    if (shouldContinue === false)
      return { cancelled: true }
  }

  const printHtml = buildPrintHtml(prepared, options)
  await createPrintIframe(printHtml, options.afterPrint)
  return { cancelled: false }
}
