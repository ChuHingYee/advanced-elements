/**
 * <zh/> xlsx 库统一类型定义与按需加载器
 * <en/> Unified xlsx library type definitions and on-demand loader
 *
 * @remarks
 * <zh/> export-excel.ts 和 import-helpers.ts 各自维护了一份 xlsx 动态 import + 类型声明 + 错误处理，
 * <zh/> 此模块将两者合并为统一的类型定义和加载器，消除重复代码。
 * <zh/> xlsx 通过动态 import 按需加载，不使用导出/导入功能时零体积增长。
 * <en/> export-excel.ts and import-helpers.ts each maintained their own xlsx dynamic import + type declaration + error handling.
 * <en/> This module merges them into a unified type definition and loader, eliminating code duplication.
 * <en/> xlsx is loaded on demand via dynamic import, adding zero bundle size when export/import is unused.
 */

/**
 * <zh/> xlsx 工作簿类型 | <en/> xlsx workbook type
 */
export interface XlsxWorkbook {
  /** <zh/> 工作表名称数组 | <en/> Array of sheet names */
  SheetNames: string[]
  /** <zh/> 工作表对象映射 | <en/> Map of sheet name to worksheet object */
  Sheets: Record<string, unknown>
}

/**
 * <zh/> xlsx 库统一类型定义——合并导出和导入所需的 API 接口
 * <en/> Unified xlsx library type definition — merges API interfaces needed by both export and import
 */
export interface XlsxLib {
  /** <zh/> 工具方法命名空间 | <en/> Utility methods namespace */
  utils: {
    /** <zh/> 将二维数组转为工作表 | <en/> Convert 2D array to worksheet */
    aoa_to_sheet: (aoa: unknown[][]) => unknown
    /** <zh/> 创建新工作簿 | <en/> Create new workbook */
    book_new: () => unknown
    /** <zh/> 向工作簿追加工作表 | <en/> Append worksheet to workbook */
    book_append_sheet: (wb: unknown, ws: unknown, name: string) => void
    /** <zh/> 将工作表转为 JSON 二维数组 | <en/> Convert worksheet to JSON 2D array */
    sheet_to_json: (ws: unknown, opts?: Record<string, any>) => unknown[][]
    /** <zh/> 编码单元格坐标为 A4 样式 | <en/> Encode cell coordinates to A4 style */
    encode_cell: (cell: { r: number, c: number }) => string
  }
  /** <zh/> 读取二进制数据为工作簿 | <en/> Read binary data as workbook */
  read: (data: unknown, opts?: Record<string, any>) => XlsxWorkbook
  /** <zh/> 将工作簿写入文件并触发下载 | <en/> Write workbook to file and trigger download */
  writeFile: (workbook: unknown, filename: string, opts?: Record<string, any>) => void
}

/**
 * <zh/> 按需加载 xlsx 库——统一错误处理 + 超时保护
 * <en/> On-demand load xlsx library — unified error handling + timeout protection
 *
 * @remarks
 * <zh/> 通过动态 import 加载 xlsx，未安装时抛出包含安装指引的友好错误。
 * <zh/> 替代 export-excel.ts 和 import-helpers.ts 中各自的重复实现。
 * <zh/> 超时保护：动态 import 超过 10s 时中止，避免 CDN 不可用或网络超时时 UI 无限等待。
 * <en/> Loads xlsx via dynamic import, throws a friendly error with installation instructions when not installed.
 * <en/> Replaces the duplicated implementations in export-excel.ts and import-helpers.ts.
 * <en/> Timeout protection: aborts if dynamic import exceeds 10s, preventing infinite UI wait on CDN unavailability or network timeout.
 *
 * @param context - <zh/> 调用上下文描述，用于错误消息区分来源 | <en/> Call context description, used in error message to identify source
 * @returns <zh/> xlsx 库实例 | <en/> xlsx library instance
 * @throws {Error} <zh/> 当 xlsx 库未安装或加载超时时抛出 | <en/> thrown when xlsx library is not installed or load times out
 */
export async function ensureXlsx(context: 'export' | 'import' = 'export'): Promise<XlsxLib> {
  const action = context === 'import' ? 'import' : 'export'
  /** <zh/> 动态导入超时时间（ms） | <en/> Dynamic import timeout in milliseconds */
  const LOAD_TIMEOUT = 10_000

  try {
    const importPromise = import('xlsx')
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT)
    })
    try {
      const mod = await Promise.race([importPromise, timeoutPromise])
      return mod as unknown as XlsxLib
    }
    finally {
      // <zh/> 竞速结束必须立即解除兜底定时器，否则成功路径悬挂 10s 句柄
      // <en/> Disarm the fallback timer as soon as the race settles — the success path must not
      // <en/> leave a dangling 10s handle
      if (timeoutId != null)
        clearTimeout(timeoutId)
    }
  }
  catch (error) {
    if (error instanceof Error && error.message === 'timeout') {
      throw new Error(
        `[AdvTable] xlsx load timed out after ${LOAD_TIMEOUT}ms for Excel ${action}. `
        + 'Check network connectivity or bundle xlsx locally instead of using a CDN.',
      )
    }
    throw new Error(
      `[AdvTable] xlsx is required for Excel ${action}. `
      // <zh/> npm registry 的 xlsx 末版为 0.18.5；修复版自 0.19.x 起由 SheetJS 官方 CDN 分发
      // <en/> npm's last xlsx is 0.18.5; patched releases 0.19.x+ ship from the SheetJS CDN
      + 'Install from npm (0.18.5, advisories apply) or a patched build from the SheetJS CDN: '
      + 'https://docs.sheetjs.com/docs/getting-started/installation/nodejs '
      + '(e.g. pnpm add https://cdn.sheetjs.com/xlsx-latest.tgz). '
      + 'Import isolation plus the built-in sanitizeDataArray guard remain the fallback.',
    )
  }
}
