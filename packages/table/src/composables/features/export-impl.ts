/**
 * <zh/> 导出/导入/打印实现——useExportOrchestrator 的重量体，仅首调用动态加载。
 * <en/> Export/Import/Print implementation — the heavy body of useExportOrchestrator, loaded on first call.
 *
 * @remarks
 * <zh/> 本模块由壳动态 import；壳自持同步状态 ref（驱动模板 loading）与选择框单例，
 * <zh/> 此处叶子自建的状态 ref 不对外可见。`autoLifecycle: false` 关闭自注册，清理归壳。
 * <en/> Dynamically imported by the shell; the shell owns sync status refs (driving template loading)
 * <en/> and the picker singleton, while leaf-internal status refs stay invisible.
 * <en/> `autoLifecycle: false` disables self-registration, cleanup owned by the shell.
 */
import type { AdvColumn } from '../../types/column'
import type { UseExportOrchestratorOptions } from './use-export-orchestrator'
import { flattenLeafColumns } from '../../utils/column-tree'
import { useTableExportOrchestration } from './use-table-export'
import { useTableImport } from './use-table-import'
import { useTablePrintOrchestration } from './use-table-print'

/**
 * <zh/> 创建导出/导入/打印实现 | <en/> Create the export/import/print implementation
 *
 * @param options - <zh/> 与 useExportOrchestrator 同形 | <en/> Same shape as useExportOrchestrator
 * @returns <zh/> 导出/打印/导入状态与方法（含文件选中处理，供壳转调） | <en/> export/print/import states, methods and file-picked handling (for shell delegation)
 */
export function createExportImpl<T>(options: UseExportOrchestratorOptions<T>) {
  const {
    columnClassification,
    localColumns,
    tableData,
    visibleData,
    filteredData,
    selectionState,
    tableContext,
    effectiveColumns,
    exportOptions,
    exportCsvOptions,
    printOptions,
    importOptions,
    t,
    onDataUpdate,
    onDataImport,
    emit,
    handleError,
    notify,
    hasUnsavedChanges,
  } = options

  const {
    exporting,
    exportExcel,
    exportingCsv,
    exportCsv,
  } = useTableExportOrchestration<T>({
    normalColumns: () => columnClassification.value.normal as unknown as AdvColumn<T>[],
    allColumns: () => localColumns.value as unknown as AdvColumn<T>[],
    tableData,
    visibleData: () => visibleData.value,
    selectedRows: () => selectionState.getSelectedRows(),
    filteredData: () => filteredData.value,
    tableContext,
    exportOptions,
    exportCsvOptions,
    t,
    handleError,
    notify,
    hasUnsavedChanges,
  })

  const {
    printing,
    print: doPrint,
  } = useTablePrintOrchestration<T>({
    normalColumns: () => columnClassification.value.normal as unknown as AdvColumn<T>[],
    allColumns: () => localColumns.value as unknown as AdvColumn<T>[],
    tableData,
    visibleData: () => visibleData.value,
    selectedRows: () => selectionState.getSelectedRows(),
    filteredData: () => filteredData.value,
    tableContext,
    printOptions,
    t,
    handleError,
    notify,
    hasUnsavedChanges,
  })

  const {
    importing,
    triggerImport,
    handleFileSelected,
  } = useTableImport<T>({
    importOptions,
    t,
    // 展平分组列树：子列 label 必须可映射回 prop，否则导入表头映射遗漏子列（单一 flatten 实现）
    // Flatten the group column tree: child labels must map back to prop or header mapping misses them (single flatten implementation)
    columns: () => flattenLeafColumns(effectiveColumns.value as Array<Record<string, unknown>>)
      .map(c => ({ prop: c.prop as string | undefined, label: c.label as string | undefined })),
    onImportedRows: (rows, mode) => {
      onDataUpdate(rows, mode)
      onDataImport(rows, mode)
    },
    emit,
    handleError,
    notify,
    // <zh/> 清理由壳经共享选择框接管，此处不自注册卸载钩子 | <en/> Cleanup owned by the shell via the shared picker; no self-registration here
    autoLifecycle: false,
  })

  return {
    exporting,
    exportExcel,
    exportingCsv,
    exportCsv,
    printing,
    doPrint,
    importing,
    triggerImport,
    handleFileSelected,
  }
}
