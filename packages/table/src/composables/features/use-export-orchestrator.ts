import type { ComputedRef, Ref } from 'vue'
import type { AdvTableEmitFn, ProcessedColumn } from '../../types'
import type { TableContext, ToolbarConfig } from '../../types/config'
import type { TableErrorHandler } from '../../utils/error-handler'
import type { NotifyFn } from '../../utils/notification'
import type { ColumnClassification } from '../data/use-table-data-pipeline'
import type { UseTableExportOrchestrationReturn } from '../features/use-table-export'
import type { UseTableImportReturn } from '../features/use-table-import'
import type { UseTablePrintOrchestrationReturn } from '../features/use-table-print'
import type { UseSelectionStateReturn } from '../selection/use-selection-state'
import { onBeforeUnmount, ref } from 'vue'
import { createAsyncLoader } from '../../utils/async-feature'
import { createFilePicker, DEFAULT_ACCEPT } from './import-file-picker'

/** <zh/> 导出/导入/打印编排器输入 | <en/> Export/Import/Print orchestrator input */
export interface UseExportOrchestratorOptions<T> {
  /** <zh/> 列分类（来自数据管线） | <en/> Column classification (from data pipeline) */
  columnClassification: ComputedRef<ColumnClassification>
  /** <zh/> 本地列（含用户调整） | <en/> Local columns (with user adjustments) */
  localColumns: Ref<ProcessedColumn[]>
  /** <zh/> 全量数据 | <en/> Full data */
  tableData: Ref<T[]>
  /** <zh/> 可见数据 | <en/> Visible data */
  visibleData: ComputedRef<T[]>
  /** <zh/> 筛选/搜索后的全量数据（dataMode='filtered' 的导出/打印数据源） | <en/> Full data after filter/search (data source for dataMode='filtered' export/print) */
  filteredData: ComputedRef<T[]>
  /** <zh/> 选择状态 | <en/> Selection state */
  selectionState: UseSelectionStateReturn<T>
  /** <zh/> 表格上下文 | <en/> Table context */
  tableContext: TableContext
  /** <zh/> 有效列 | <en/> Effective columns */
  effectiveColumns: Ref<ProcessedColumn[]>
  /** <zh/> 工具栏导出选项 getter | <en/> Toolbar export options getter */
  exportOptions: () => ToolbarConfig['exportOptions']
  exportCsvOptions: () => ToolbarConfig['exportCsvOptions']
  printOptions: () => ToolbarConfig['printOptions']
  importOptions: () => ToolbarConfig['importOptions']
  /** <zh/> 翻译函数 | <en/> Translation function */
  t: (key: string, ...args: any[]) => string
  /** <zh/> 数据更新回调（导入数据时） | <en/> Data update callback (when importing data) */
  onDataUpdate: (data: T[], mode: 'append' | 'replace') => void
  /** <zh/> 数据导入事件回调 | <en/> Data import event callback */
  onDataImport: (rows: T[], mode: 'append' | 'replace') => void
  /**
   * <zh/> 错误派发函数——导入/导出/打印失败时通过此函数派发结构化错误
   * <en/> Error emit function — used to dispatch structured errors when import/export/print fails
   */
  emit?: AdvTableEmitFn
  /**
   * <zh/> 结构化错误处理器——统一错误处理入口
   * <en/> Structured error handler — unified error handling entry point
   */
  handleError?: TableErrorHandler
  /** <zh/> 通知通道——未传入时使用默认实现 | <en/> Notification channel — defaults to default implementation */
  notify?: NotifyFn
  /**
   * <zh/> 未提交编辑探测——透传至导出编排，返回 true 时中止导出并提示（缺省不启用守卫）
   * <en/> Uncommitted-edit probe — forwarded to the export orchestration; aborts with a notification
   * <en/> when true (no guard by default)
   */
  hasUnsavedChanges?: () => boolean
}

/**
 * <zh/> 导出/导入/打印编排——统一管理 Excel 导出、CSV 导出、打印、数据导入。
 * <zh/> 同步壳：setup 期返回同形契约（状态 ref + 方法），重量实现首调用动态加载。
 * <en/> Export/Import/Print orchestration — unified management of
 * <en/> Excel export, CSV export, printing, and data import.
 * <en/> Sync shell: setup returns the same-shaped contract (status refs + methods),
 * <en/> the heavy implementation loads on first call.
 */
export interface UseExportOrchestratorReturn<T = any> {
  exporting: UseTableExportOrchestrationReturn<T>['exporting']
  exportExcel: UseTableExportOrchestrationReturn<T>['exportExcel']
  exportingCsv: UseTableExportOrchestrationReturn<T>['exportingCsv']
  exportCsv: UseTableExportOrchestrationReturn<T>['exportCsv']
  printing: UseTablePrintOrchestrationReturn['printing']
  doPrint: UseTablePrintOrchestrationReturn['print']
  importing: UseTableImportReturn['importing']
  triggerImport: UseTableImportReturn['triggerImport']
}

export function useExportOrchestrator<T>(options: UseExportOrchestratorOptions<T>): UseExportOrchestratorReturn<T> {
  const exporting = ref(false)
  const exportingCsv = ref(false)
  const printing = ref(false)
  const importing = ref(false)

  const loader = createAsyncLoader(() => import('./export-impl').then(m => m.createExportImpl(options)))

  const exportExcel: UseExportOrchestratorReturn<T>['exportExcel'] = (overrideOptions) => {
    if (exporting.value)
      return Promise.resolve(false)
    exporting.value = true
    return loader.load().then(
      impl => impl.exportExcel(overrideOptions).finally(() => {
        exporting.value = false
      }),
      (err: unknown) => {
        exporting.value = false
        throw err
      },
    )
  }

  const exportCsv: UseExportOrchestratorReturn<T>['exportCsv'] = (overrideOptions) => {
    if (exportingCsv.value)
      return Promise.resolve(false)
    exportingCsv.value = true
    return loader.load().then(
      impl => impl.exportCsv(overrideOptions).finally(() => {
        exportingCsv.value = false
      }),
      (err: unknown) => {
        exportingCsv.value = false
        throw err
      },
    )
  }

  const doPrint: UseExportOrchestratorReturn<T>['doPrint'] = (overrideOptions) => {
    if (printing.value)
      return Promise.resolve()
    printing.value = true
    return loader.load().then(
      impl => impl.doPrint(overrideOptions).finally(() => {
        printing.value = false
      }),
      (err: unknown) => {
        printing.value = false
        throw err
      },
    )
  }

  // <zh/> 选择框单例归壳所有（同步打开保手势链）；选中后等待实现加载，走同一错误上报路径
  // <en/> The shell owns the picker singleton (sync open keeps the user-gesture chain);
  // <en/> picked files wait for implementation load through the same error-reporting path
  const picker = createFilePicker({
    accept: () => options.importOptions()?.accept ?? DEFAULT_ACCEPT,
    onFile: (file) => {
      void handlePickedFile(file)
    },
  })

  function triggerImport(): void {
    picker.open()
  }

  async function handlePickedFile(file: File): Promise<void> {
    if (importing.value)
      return
    importing.value = true
    try {
      const impl = await loader.load()
      await impl.handleFileSelected(file)
    }
    finally {
      importing.value = false
    }
  }

  onBeforeUnmount(() => picker.destroy())

  return {
    exporting,
    exportExcel,
    exportingCsv,
    exportCsv,
    printing,
    doPrint,
    importing,
    triggerImport,
  }
}
