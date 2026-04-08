import type { MaybeRefOrGetter, Ref } from 'vue'
import type { AdvColumn } from '../../types'
import type { TableContext, ToolbarConfig } from '../../types/config'
import type { Translator } from '../../types/translator'
import type { TableErrorHandler } from '../../utils/error-handler'
import type { ExportCsvOptions } from '../../utils/export-csv'
import type { ExportExcelOptions } from '../../utils/export-excel'
import type { NotifyFn } from '../../utils/notification'
import type { ColumnMode, DataMode } from '../../utils/scope-resolvers'
import { computed, ref, toValue } from 'vue'
import { exportCsv } from '../../utils/export-csv'
import { exportExcel } from '../../utils/export-excel'
import { createDefaultNotify } from '../../utils/notification'
import { abortOnPendingChanges } from '../../utils/pending-changes-guard'
import { resolveColumnsByMode, resolveDataByMode } from '../../utils/scope-resolvers'
import { createExportWrapper, showMessage } from './use-table-export-helpers'

export type { DataMode } from '../../utils/scope-resolvers'

export interface TableExportOptions<T = any> extends Partial<ExportExcelOptions<T>> {
  dataMode?: DataMode
}

export interface TableExportCsvOptions<T = any> extends Partial<ExportCsvOptions<T>> {
  dataMode?: DataMode
}

interface DoExportBaseOptions<T> {
  columns: MaybeRefOrGetter<AdvColumn<T>[]>
  allColumns: MaybeRefOrGetter<AdvColumn<T>[]>
  data: MaybeRefOrGetter<T[]>
  currentData: MaybeRefOrGetter<T[]>
  selectedRows: MaybeRefOrGetter<T[]>
  /** <zh/> 筛选/搜索后的全量数据——dataMode='filtered' 时导出该数据 | <en/> Full data after filter/search — exported when dataMode='filtered' */
  filteredData?: MaybeRefOrGetter<T[]>
  ctx: MaybeRefOrGetter<TableContext | null>
  filename?: MaybeRefOrGetter<string>
  columnMode?: MaybeRefOrGetter<ColumnMode>
  dataMode?: MaybeRefOrGetter<DataMode>
  t: Translator
  /** <zh/> 结构化错误处理器——导出失败时派发 TABLE_EXPORT_FAILED | <en/> Structured error handler — dispatches TABLE_EXPORT_FAILED on failure */
  handleError?: TableErrorHandler
  /** <zh/> 通知通道——未传入时使用默认实现 | <en/> Notification channel — defaults to default implementation */
  notify?: NotifyFn
  /** <zh/> 未提交编辑探测（缺省 = 不启用守卫） | <en/> Uncommitted-edit probe (absent = no guard) */
  hasUnsavedChanges?: () => boolean
}

async function doExportBase<T>(
  options: DoExportBaseOptions<T>,
  exportingRef: Ref<boolean>,
  overrideOptions: { columnMode?: ColumnMode, dataMode?: DataMode, data?: T[] } | undefined,
  executeExport: (params: { data: T[], columns: AdvColumn<T>[], filename: string, ctx: TableContext | null, columnMode: ColumnMode, restOptions: Record<string, any> }) => void | Promise<void>,
  successKey: string,
  failKey: string,
  notify: NotifyFn = createDefaultNotify(),
): Promise<boolean> {
  if (exportingRef.value)
    return false
  // <zh/> 未提交编辑守卫——取舍理由（为何中止而非放行）见 utils/pending-changes-guard
  // <en/> Uncommitted-edit guard — rationale (why abort instead of continue) lives in utils/pending-changes-guard
  const aborted = abortOnPendingChanges({
    hasUnsavedChanges: options.hasUnsavedChanges,
    notify,
    t: options.t,
    messageKey: 'table.export.pendingChanges',
    source: 'export',
  })
  if (aborted)
    return false
  exportingRef.value = true
  try {
    const columnPool = resolveColumnsByMode(
      overrideOptions?.columnMode ?? toValue(options.columnMode),
      options.columns,
      options.allColumns,
    )
    const resolvedData = resolveDataByMode(
      overrideOptions?.dataMode ?? toValue(options.dataMode),
      options.data,
      options.currentData,
      options.selectedRows,
      options.filteredData,
    )
    const finalData = overrideOptions?.data ?? resolvedData

    // <zh/> 从 overrideOptions 中剥离 data 字段，剩余作为透传选项
    // <en/> Strip the `data` field from overrideOptions; the remainder is passed through as rest options
    const restOptions: Record<string, any> = {}
    if (overrideOptions) {
      for (const key of Object.keys(overrideOptions)) {
        if (key !== 'data')
          restOptions[key] = (overrideOptions as Record<string, any>)[key]
      }
    }

    await executeExport({
      data: finalData,
      columns: columnPool,
      filename: toValue(options.filename) ?? 'export',
      ctx: toValue(options.ctx),
      columnMode: overrideOptions?.columnMode ?? toValue(options.columnMode) ?? 'visible',
      restOptions,
    })
    showMessage(notify, options.t, successKey, failKey, 'success')
    return true
  }
  catch (err: unknown) {
    const msg = err instanceof Error ? err.message : options.t(failKey)
    showMessage(notify, options.t, successKey, failKey, 'error', msg)
    options.handleError?.('TABLE_EXPORT_FAILED', { cause: err })
    throw err
  }
  finally {
    exportingRef.value = false
  }
}

async function doExportExcel<T>(
  options: DoExportBaseOptions<T> & { sheetName?: MaybeRefOrGetter<string> },
  exporting: Ref<boolean>,
  overrideOptions?: TableExportOptions<T>,
): Promise<boolean> {
  return doExportBase(options, exporting, overrideOptions, ({ data, columns, filename, ctx, columnMode, restOptions }) =>
    exportExcel<T>({
      data,
      columns,
      filename,
      sheetName: toValue(options.sheetName) ?? 'Sheet1',
      ctx,
      columnMode,
      ...restOptions,
    }), 'table.export.success', 'table.export.fail', options.notify)
}

async function doExportCsv<T>(
  options: DoExportBaseOptions<T>,
  exportingCsv: Ref<boolean>,
  overrideOptions?: TableExportCsvOptions<T>,
): Promise<boolean> {
  return doExportBase(options, exportingCsv, overrideOptions, ({ data, columns, filename, ctx, columnMode, restOptions }) =>
    // <zh/> 大数据由 exportCsv 内部自动切分片异步序列化（按行数阈值判定），小数据保持同步路径。
    // <en/> Large datasets are auto-chunked inside exportCsv (row-threshold decided); small data
    // <en/> stays on the synchronous path.
    exportCsv<T>({
      data,
      columns,
      filename,
      ctx,
      columnMode,
      ...restOptions,
    }), 'table.export.csvSuccess', 'table.export.csvFail', options.notify)
}

export interface UseTableExportOrchestrationOptions<T> {
  normalColumns: () => AdvColumn<T>[]
  allColumns: () => AdvColumn<T>[]
  tableData: Ref<T[]>
  visibleData: () => T[]
  selectedRows: () => T[]
  /** <zh/> 筛选/搜索后的全量数据 getter——dataMode='filtered' 时使用 | <en/> Full filtered data getter — used when dataMode='filtered' */
  filteredData?: () => T[]
  tableContext: TableContext
  exportOptions: () => ToolbarConfig['exportOptions']
  exportCsvOptions: () => ToolbarConfig['exportCsvOptions']
  t: Translator
  /** <zh/> 结构化错误处理器 | <en/> Structured error handler */
  handleError?: TableErrorHandler
  /** <zh/> 通知通道——未传入时使用默认实现 | <en/> Notification channel — defaults to default implementation */
  notify?: NotifyFn
  /** <zh/> 未提交编辑探测（缺省 = 不启用守卫） | <en/> Uncommitted-edit probe (absent = no guard) */
  hasUnsavedChanges?: () => boolean
}

export interface UseTableExportOrchestrationReturn<T = any> {
  exporting: Ref<boolean>
  /** <zh/> 与实现同形（必须显式对应 TableExportOptions，标注为 any 即掩盖对应关系）。true=成功，false=被拦截或失败 | <en/> Same shape as the implementation. true = success, false = intercepted or failed */
  exportExcel: (options?: TableExportOptions<T>) => Promise<boolean>
  exportingCsv: Ref<boolean>
  /** <zh/> 与实现同形 | <en/> Same shape as the implementation */
  exportCsv: (options?: TableExportCsvOptions<T>) => Promise<boolean>
}

/**
 * 表格导出编排 Composable——创建导出 Excel 和 CSV 的方法（自动合并 toolbar 默认选项）
 * @param options - 导出编排配置
 * @returns exporting/exportExcel/exportingCsv/exportCsv
 */
export function useTableExportOrchestration<T>(
  options: UseTableExportOrchestrationOptions<T>,
): UseTableExportOrchestrationReturn {
  const {
    normalColumns,
    allColumns,
    tableData,
    visibleData,
    selectedRows,
    filteredData,
    tableContext,
    exportOptions,
    exportCsvOptions,
    t,
    handleError,
    notify = createDefaultNotify(),
    hasUnsavedChanges,
  } = options

  const visibleDataRef = computed(() => visibleData())

  const exporting = ref(false)
  const exportingCsv = ref(false)

  const excelOptions = {
    columns: normalColumns,
    allColumns,
    data: tableData,
    currentData: visibleDataRef,
    selectedRows,
    filteredData,
    ctx: tableContext,
    filename: () => exportOptions()?.filename ?? 'export',
    sheetName: () => exportOptions()?.sheetName ?? 'Sheet1',
    columnMode: () => exportOptions()?.columnMode ?? 'visible',
    dataMode: () => exportOptions()?.dataMode ?? 'all',
    t,
    handleError,
    notify,
    hasUnsavedChanges,
  }

  const csvOptions = {
    columns: normalColumns,
    allColumns,
    data: tableData,
    currentData: visibleDataRef,
    selectedRows,
    filteredData,
    ctx: tableContext,
    filename: () => exportCsvOptions()?.filename ?? exportOptions()?.filename ?? 'export',
    columnMode: () => exportCsvOptions()?.columnMode ?? 'visible',
    dataMode: () => exportCsvOptions()?.dataMode ?? 'all',
    t,
    handleError,
    notify,
    hasUnsavedChanges,
  }

  const exportExcelFn = (overrideOptions?: TableExportOptions<T>) =>
    doExportExcel(excelOptions, exporting, overrideOptions)

  const exportCsvFn = (overrideOptions?: TableExportCsvOptions<T>) =>
    doExportCsv(csvOptions, exportingCsv, overrideOptions)

  const exportExcel = createExportWrapper(
    exportExcelFn,
    () => exportOptions()?.columns,
    (merged: any, options: any) => {
      if (exportOptions()?.xlsxOptions || options?.xlsxOptions) {
        merged!.xlsxOptions = {
          ...exportOptions()?.xlsxOptions,
          ...options?.xlsxOptions,
        }
      }
    },
  )

  const exportCsv = createExportWrapper(
    exportCsvFn,
    () => exportCsvOptions()?.columns,
  )

  return {
    exporting,
    exportExcel,
    exportingCsv,
    exportCsv,
  }
}
