import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createExportImpl } from '../../src/composables/features/export-impl'

/**
 * <zh/> 导出实现装配单测——子编排 mock，覆盖接线：列分类透传、分组展平、导入回写扇出。
 * <en/> Export-impl wiring tests with mocked sub-orchestrations — classification pass-through, group flatten, import fan-out.
 */
const exportState = {
  exporting: ref(false),
  exportExcel: vi.fn(),
  exportingCsv: ref(false),
  exportCsv: vi.fn(),
}
const printState = {
  printing: ref(false),
  print: vi.fn(),
}
const importState = {
  importing: ref(false),
  triggerImport: vi.fn(),
  handleFileSelected: vi.fn(),
}

vi.mock('../../src/composables/features/use-table-export', () => ({
  useTableExportOrchestration: vi.fn(() => exportState),
}))

vi.mock('../../src/composables/features/use-table-print', () => ({
  useTablePrintOrchestration: vi.fn(() => printState),
}))

vi.mock('../../src/composables/features/use-table-import', () => ({
  useTableImport: vi.fn(() => importState),
}))

async function getCalls() {
  const { useTableExportOrchestration } = await import('../../src/composables/features/use-table-export')
  const { useTablePrintOrchestration } = await import('../../src/composables/features/use-table-print')
  const { useTableImport } = await import('../../src/composables/features/use-table-import')
  return {
    exportMock: vi.mocked(useTableExportOrchestration),
    printMock: vi.mocked(useTablePrintOrchestration),
    importMock: vi.mocked(useTableImport),
  }
}

function setupImpl() {
  const selectionState = { getSelectedRows: () => [{ id: 1 }] }
  const onDataUpdate = vi.fn()
  const onDataImport = vi.fn()
  const impl = createExportImpl({
    columnClassification: { value: { normal: [{ prop: 'a' }] } },
    localColumns: { value: [{ prop: 'a' }] },
    tableData: [],
    visibleData: ref([]),
    filteredData: ref([]),
    selectionState,
    tableContext: {},
    effectiveColumns: ref([{ label: 'Group', children: [{ prop: 'a', label: 'A' }, { prop: 'b', label: 'B' }] }]),
    exportOptions: { fileName: 'x' },
    exportCsvOptions: {},
    printOptions: {},
    importOptions: {},
    t: (k: string) => k,
    onDataUpdate,
    onDataImport,
    emit: vi.fn(),
    handleError: vi.fn(),
    notify: vi.fn(),
    hasUnsavedChanges: () => false,
  } as any)
  return { impl, onDataUpdate, onDataImport, selectionState }
}

describe('createExportImpl', () => {
  it('exposes export/print/import handles', () => {
    const { impl } = setupImpl()
    expect(impl.exportExcel).toBe(exportState.exportExcel)
    expect(impl.exportCsv).toBe(exportState.exportCsv)
    expect(impl.doPrint).toBe(printState.print)
    expect(impl.triggerImport).toBe(importState.triggerImport)
    expect(impl.handleFileSelected).toBe(importState.handleFileSelected)
    expect(impl.exporting).toBe(exportState.exporting)
    expect(impl.printing).toBe(printState.printing)
    expect(impl.importing).toBe(importState.importing)
  })

  it('passes classification and selection through to export orchestration', async () => {
    setupImpl()
    const { exportMock } = await getCalls()
    const opts = exportMock.mock.calls[0][0] as any
    expect(opts.normalColumns()).toEqual([{ prop: 'a' }])
    expect(opts.allColumns()).toEqual([{ prop: 'a' }])
    expect(opts.selectedRows()).toEqual([{ id: 1 }])
    expect(opts.hasUnsavedChanges).toBeDefined()
  })

  it('flattens grouped columns for import header mapping', async () => {
    setupImpl()
    const { importMock } = await getCalls()
    const opts = importMock.mock.calls[0][0] as any
    expect(opts.autoLifecycle).toBe(false)
    expect(opts.columns()).toEqual([{ prop: 'a', label: 'A' }, { prop: 'b', label: 'B' }])
  })

  it('fans imported rows out to data-update and data-import', async () => {
    const { onDataUpdate, onDataImport } = setupImpl()
    const { importMock } = await getCalls()
    const opts = importMock.mock.calls[0][0] as any
    opts.onImportedRows([{ id: 1 }], 'replace')
    expect(onDataUpdate).toHaveBeenCalledWith([{ id: 1 }], 'replace')
    expect(onDataImport).toHaveBeenCalledWith([{ id: 1 }], 'replace')
  })

  it('wires print orchestration with the same column scope', async () => {
    setupImpl()
    const { printMock } = await getCalls()
    const opts = printMock.mock.calls[0][0] as any
    expect(opts.normalColumns()).toEqual([{ prop: 'a' }])
    expect(opts.allColumns()).toEqual([{ prop: 'a' }])
    expect(opts.selectedRows()).toEqual([{ id: 1 }])
  })

  it('resolves live data getters for export and print', async () => {
    const { impl } = setupImpl()
    void impl
    const { exportMock, printMock } = await getCalls()
    const exportOpts = exportMock.mock.calls[0][0] as any
    expect(exportOpts.visibleData()).toEqual([])
    expect(exportOpts.filteredData()).toEqual([])
    const printOpts = printMock.mock.calls[0][0] as any
    expect(printOpts.visibleData()).toEqual([])
    expect(printOpts.filteredData()).toEqual([])
  })
})
