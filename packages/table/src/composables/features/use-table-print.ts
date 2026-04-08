import type { Ref } from 'vue'
import type { AdvColumn } from '../../types'
import type { PrintConfig, TableContext, ToolbarConfig } from '../../types/config'
import type { Translator } from '../../types/translator'
import type { TableErrorHandler } from '../../utils/error-handler'
import type { NotifyFn } from '../../utils/notification'
import { computed, ref } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { createDefaultNotify } from '../../utils/notification'
import { abortOnPendingChanges } from '../../utils/pending-changes-guard'
import { printTable } from '../../utils/print'
import { resolveColumnsByMode, resolveDataByMode } from '../../utils/scope-resolvers'

/** <zh/> 大数据打印 dev 提示阈值（行） | <en/> Large-data dev-warning threshold (rows) */
const PRINT_LARGE_DATA_WARN_THRESHOLD = 10_000

export interface UseTablePrintOrchestrationOptions<T> {
  normalColumns: () => AdvColumn<T>[]
  allColumns: () => AdvColumn<T>[]
  tableData: Ref<T[]>
  visibleData: () => T[]
  selectedRows: () => T[]
  /** <zh/> 筛选/搜索后的全量数据 getter——dataMode='filtered' 时使用 | <en/> Full filtered data getter — used when dataMode='filtered' */
  filteredData?: () => T[]
  tableContext: TableContext
  printOptions: () => ToolbarConfig['printOptions']
  t: Translator
  /** <zh/> 结构化错误处理器——打印失败时派发 TABLE_PRINT_FAILED | <en/> Structured error handler — dispatches TABLE_PRINT_FAILED on failure */
  handleError?: TableErrorHandler
  /** <zh/> 通知通道——未传入时使用默认实现 | <en/> Notification channel — defaults to default implementation */
  notify?: NotifyFn
  /** <zh/> 未提交编辑探测（缺省 = 不启用守卫） | <en/> Uncommitted-edit probe (absent = no guard) */
  hasUnsavedChanges?: () => boolean
}

export interface UseTablePrintOrchestrationReturn {
  printing: Ref<boolean>
  print: (options?: Partial<PrintConfig>) => Promise<void>
}

/**
 * 表格打印编排 Composable——创建打印方法（自动合并 toolbar 默认选项）
 *
 * - `printing` 为 ref<boolean>，打印期间为 true，用于按钮 loading 状态
 * - `print` 为 async 函数，内部调用 prepareExportData 管线复用导出逻辑
 * - 并发保护：printing 为 true 时忽略后续调用
 * @example
 * ```ts
 * const { printing, print } = useTablePrintOrchestration({ ... })
 * // 基本打印
 * print
 * // 覆盖选项
 * print({ pageOrientation: 'landscape' })
 * ```
 */
export function useTablePrintOrchestration<T>(
  options: UseTablePrintOrchestrationOptions<T>,
): UseTablePrintOrchestrationReturn {
  const {
    normalColumns,
    allColumns,
    tableData,
    visibleData,
    selectedRows,
    filteredData,
    tableContext,
    printOptions,
    t,
    handleError,
    notify = createDefaultNotify(),
    hasUnsavedChanges,
  } = options

  const visibleDataRef = computed(() => visibleData())
  const printing = ref(false)

  async function doPrint(overrideOptions?: Partial<PrintConfig>): Promise<void> {
    if (printing.value)
      return
    // <zh/> 未提交编辑守卫——与导出共用同一实现（含"为何中止而非放行"的取舍理由）
    // <en/> Uncommitted-edit guard — shared with the export path (including the abort-vs-continue rationale)
    if (abortOnPendingChanges({
      hasUnsavedChanges,
      notify,
      t,
      messageKey: 'table.print.pendingChanges',
      source: 'print',
    })) {
      return
    }
    printing.value = true

    try {
      const config = printOptions()
      const merged = { ...config, ...overrideOptions }

      const columnPool = resolveColumnsByMode(
        merged.columnMode,
        normalColumns,
        allColumns,
      )
      const data = resolveDataByMode(
        merged.dataMode,
        tableData,
        visibleDataRef,
        selectedRows,
        filteredData,
      )

      // <zh/> 大数据打印提示——全量 HTML 字符串 O(n×m) 驻留内存，万级行会卡主线程。
      // <zh/> 此处先给出一次性 dev 提示，引导 rowsPerPage 分片或先筛选/分页再打印。
      // <en/> Large-data print hint — the full HTML string stays resident at O(n×m), blocking the
      // <en/> main thread for tens of thousands of rows. Warn once in dev, steering toward
      // <en/> rowsPerPage slicing or filtering/paging first.
      if (isDev && data.length > PRINT_LARGE_DATA_WARN_THRESHOLD) {
        devWarn(
          '[AdvTable] Printing a large dataset ('
          + `${data.length} rows) builds a full HTML document in memory and may block the page. `
          + 'Set printOptions.rowsPerPage to slice it, or narrow the data (filter/paginate) first. | '
          + '打印大数据集（'
          + `${data.length} 行）会一次性构建整个 HTML 文档驻留内存并可能阻塞页面。`
          + '请配置 printOptions.rowsPerPage 分片，或先筛选/分页缩小数据范围。',
        )
      }

      const result = await printTable<T>({
        data,
        columns: columnPool,
        sheetName: merged.sheetName ?? '',
        ctx: tableContext,
        columnMode: merged.columnMode ?? 'visible',
        // Note: PrintConfig.columns is AdvColumn[] (non-generic), cast to AdvColumn<T>[] for printTable
        overrideColumns: merged.columns as AdvColumn<T>[] | undefined,
        pageOrientation: merged.pageOrientation ?? 'portrait',
        paperSize: merged.paperSize ?? 'A4',
        rowsPerPage: merged.rowsPerPage ?? 0,
        style: merged.style,
        headerHtml: merged.headerHtml,
        footerHtml: merged.footerHtml,
        beforePrint: merged.beforePrint,
        afterPrint: merged.afterPrint,
        showRowIndex: merged.showRowIndex ?? false,
        rowIndexLabel: t('table.print.rowIndex'),
      })

      // <zh/> beforePrint 取消时不弹成功提示，避免"取消仍报成功"误报。
      // <en/> Skip the success toast when cancelled by beforePrint — a cancelled print is not a success.
      if (result.cancelled)
        return

      try {
        notify('success', t('table.print.success'), 'print')
      }
      catch {
        devWarn(`[AdvTable] ${t('table.print.success')}`)
      }
    }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('table.print.fail')
      try {
        notify('error', msg, 'print')
      }
      catch {
        // <zh/> 通知通道异常时的降级——走统一 dev 通道，结构化错误仍经 TABLE_PRINT_FAILED 透出
        // <en/> Fallback when notify throws — via unified dev channel; structured error still via TABLE_PRINT_FAILED
        devWarn(msg)
      }
      handleError?.('TABLE_PRINT_FAILED', { cause: err })
    }
    finally {
      printing.value = false
    }
  }

  return {
    printing,
    print: doPrint,
  }
}
