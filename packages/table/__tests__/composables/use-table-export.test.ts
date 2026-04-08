import type { NotifyFn } from '../../src/utils/notification'
import { ElMessage } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTableExportOrchestration } from '../../src/composables/features/use-table-export'

// ─── Mocks ───

const mockExportExcel = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockExportCsv = vi.hoisted(() => vi.fn())

vi.mock('../../src/utils/export-excel', () => ({
  exportExcel: mockExportExcel,
}))

vi.mock('../../src/utils/export-csv', () => ({
  exportCsv: mockExportCsv,
}))

vi.mock('../../src/utils/resolve-cell-text', () => ({
  resolveCellText: vi.fn().mockReturnValue('test'),
}))

vi.mock('element-plus', () => ({
  ElMessage: vi.fn(),
}))

const mockElMessage = vi.mocked(ElMessage)

// <zh/> 创建 mock notify 函数 | <en/> Create mock notify function
const mockNotify = vi.fn() as NotifyFn

// ─── Shared fixtures ───

const mockColumns = [
  { prop: 'name', label: 'Name', hidden: false },
  { prop: 'age', label: 'Age', hidden: false },
] as any

const mockAllColumns = [
  { prop: 'name', label: 'Name', hidden: false },
  { prop: 'age', label: 'Age', hidden: false },
  { prop: 'hidden', label: 'Hidden', hidden: false },
] as any

const mockData = [
  { name: 'John', age: 30 },
  { name: 'Jane', age: 25 },
]

const mockCurrentData = [{ name: 'John', age: 30 }]
const mockSelectedRows = [{ name: 'John', age: 30 }]
const t = (key: string) => key

function createOrchestration(overrides: Record<string, any> = {}) {
  const tableData = ref(mockData)

  return useTableExportOrchestration({
    normalColumns: () => mockColumns,
    allColumns: () => mockAllColumns,
    tableData,
    visibleData: () => mockCurrentData,
    selectedRows: () => mockSelectedRows,
    tableCtx: {} as any,
    exportOptions: () => ({}),
    exportCsvOptions: () => ({}),
    t,
    notify: mockNotify,
    ...overrides,
  })
}

// ─── Tests ───

describe('use-table-export', () => {
  beforeEach(() => {
    mockElMessage.mockClear()
    mockNotify.mockClear()
    mockExportExcel.mockReset().mockResolvedValue(undefined)
    mockExportCsv.mockReset().mockImplementation(() => { })
  })

  // ─── Base logic (resolveExportData / resolveExportColumns / showMessage) ───

  describe('resolveExportData (via orchestration)', () => {
    it('exports all data by default', async () => {
      const { exportExcel } = createOrchestration({
        exportOptions: () => ({ dataMode: 'all' }),
      })

      await exportExcel()

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({ data: mockData }),
      )
    })

    it('exports current page data when dataMode is current', async () => {
      const { exportExcel } = createOrchestration({
        exportOptions: () => ({ dataMode: 'current' }),
      })

      await exportExcel()

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({ data: mockCurrentData }),
      )
    })

    it('exports selected rows when dataMode is selected', async () => {
      const { exportExcel } = createOrchestration({
        exportOptions: () => ({ dataMode: 'selected' }),
      })

      await exportExcel()

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({ data: mockSelectedRows }),
      )
    })
  })

  describe('resolveExportColumns (via orchestration)', () => {
    it('exports visible columns by default', async () => {
      const { exportExcel } = createOrchestration({
        exportOptions: () => ({ columnMode: 'visible' }),
      })

      await exportExcel()

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({ columns: mockColumns }),
      )
    })

    it('exports all columns when columnMode is all', async () => {
      const { exportExcel } = createOrchestration({
        exportOptions: () => ({ columnMode: 'all' }),
      })

      await exportExcel()

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({ columns: mockAllColumns }),
      )
    })
  })

  describe('showMessage', () => {
    it('calls notify with success on Excel export', async () => {
      const { exportExcel } = createOrchestration()
      await exportExcel()
      expect(mockNotify).toHaveBeenCalledWith('success', 'table.export.success', 'export')
    })

    it('calls notify with success on CSV export', async () => {
      const { exportCsv } = createOrchestration()
      await exportCsv()
      expect(mockNotify).toHaveBeenCalledWith('success', 'table.export.csvSuccess', 'export')
    })

    it('calls notify with error on Excel export failure', async () => {
      mockExportExcel.mockRejectedValueOnce(new Error('Export failed'))

      const { exportExcel } = createOrchestration()
      // <zh/> 契约：工具栏按钮 fire-and-forget——已上报失败在此处吞掉避免 unhandledrejection，不 rethrow
      // <en/> contract: toolbar buttons are fire-and-forget — reported failures are swallowed here, never rethrown
      await exportExcel()
      expect(mockNotify).toHaveBeenCalledWith('error', 'Export failed', 'export')
    })

    it('calls notify with error on CSV export failure', async () => {
      const csvError = new Error('CSV Error')
      mockExportCsv.mockImplementation(() => {
        throw csvError
      })

      const { exportCsv } = createOrchestration()
      // <zh/> 契约：同上，已上报即吞掉 | <en/> contract: same as above — reported errors resolve
      await exportCsv()
      expect(mockNotify).toHaveBeenCalledWith('error', 'CSV Error', 'export')
    })
  })

  // ─── Excel export ───

  describe('excel export', () => {
    it('initializes with exporting false', () => {
      const { exporting } = createOrchestration()
      expect(exporting.value).toBe(false)
    })

    it('prevents concurrent exports', async () => {
      const { exportExcel, exporting } = createOrchestration()

      const first = exportExcel()
      expect(exporting.value).toBe(true)

      const second = exportExcel()
      await Promise.all([first, second])

      expect(exporting.value).toBe(false)
    })

    it('uses custom filename from exportOptions', async () => {
      const { exportExcel } = createOrchestration({
        exportOptions: () => ({ filename: 'custom-file' }),
      })

      await exportExcel()

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'custom-file' }),
      )
    })

    it('uses custom sheetName from exportOptions', async () => {
      const { exportExcel } = createOrchestration({
        exportOptions: () => ({ sheetName: 'Custom Sheet' }),
      })

      await exportExcel()

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({ sheetName: 'Custom Sheet' }),
      )
    })

    it('exports empty data (only headers)', async () => {
      const { exportExcel } = createOrchestration({
        normalColumns: () => mockColumns,
        allColumns: () => mockAllColumns,
        tableData: ref([]),
        visibleData: () => [],
        selectedRows: () => [],
      })

      await exportExcel()

      expect(mockNotify).toHaveBeenCalledWith('success', 'table.export.success', 'export')
    })

    it('passes custom data in export options', async () => {
      const { exportExcel } = createOrchestration()

      await exportExcel({ data: [{ name: 'Override', age: 99 }] })

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ name: 'Override', age: 99 }] }),
      )
    })
  })

  // ─── CSV export ───

  describe('csv export', () => {
    it('initializes with exportingCsv false', () => {
      const { exportingCsv } = createOrchestration()
      expect(exportingCsv.value).toBe(false)
    })

    it('exports CSV successfully', async () => {
      const { exportCsv } = createOrchestration()

      await exportCsv()

      expect(mockExportCsv).toHaveBeenCalled()
      expect(mockNotify).toHaveBeenCalledWith('success', 'table.export.csvSuccess', 'export')
    })

    it('sets exportingCsv to false after export completes', async () => {
      const { exportCsv, exportingCsv } = createOrchestration()

      await exportCsv()

      expect(exportingCsv.value).toBe(false)
    })

    it('passes override options to exportCsv', async () => {
      const { exportCsv } = createOrchestration({
        exportCsvOptions: () => ({ filename: 'report' }),
      })

      await exportCsv({ bom: false, filename: 'custom' })

      expect(mockExportCsv).toHaveBeenCalledWith(
        expect.objectContaining({ bom: false, filename: 'custom' }),
      )
    })
  })

  // ─── Orchestration ───

  describe('useTableExportOrchestration', () => {
    it('merges toolbar columns into export options', async () => {
      const { exportExcel } = createOrchestration({
        exportOptions: () => ({
          filename: 'report',
          columns: [{ prop: 'extra', hidden: false }] as any,
        }),
      })

      await exportExcel()

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({
          overrideColumns: [{ prop: 'extra', hidden: false }],
        }),
      )
    })

    it('merges xlsxOptions correctly', async () => {
      const { exportExcel } = createOrchestration({
        exportOptions: () => ({
          xlsxOptions: { type: 'base64' },
        }),
      })

      await exportExcel({ xlsxOptions: { bookType: 'xlsb' } })

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({
          xlsxOptions: { type: 'base64', bookType: 'xlsb' },
        }),
      )
    })

    it('uses exportOptions defaults for Excel', async () => {
      const { exportExcel } = createOrchestration({
        exportOptions: () => ({
          filename: 'report',
          sheetName: 'Data',
          columnMode: 'all',
          dataMode: 'current',
        }),
      })

      await exportExcel()

      expect(mockExportExcel).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'report',
          sheetName: 'Data',
        }),
      )
    })

    it('uses exportCsvOptions defaults for CSV', async () => {
      const { exportCsv } = createOrchestration({
        exportCsvOptions: () => ({
          filename: 'csv-report',
          columnMode: 'all',
          dataMode: 'selected',
        }),
      })

      await exportCsv()

      expect(mockExportCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'csv-report',
        }),
      )
    })

    it('falls back to exportOptions filename for CSV when exportCsvOptions has none', async () => {
      const { exportCsv } = createOrchestration({
        exportOptions: () => ({ filename: 'shared-name' }),
        exportCsvOptions: () => ({}),
      })

      await exportCsv()

      expect(mockExportCsv).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'shared-name' }),
      )
    })

    it('merges toolbar columns into CSV export options', async () => {
      const { exportCsv } = createOrchestration({
        exportCsvOptions: () => ({
          columns: [{ prop: 'csv-extra', hidden: false }] as any,
        }),
      })

      await exportCsv()

      expect(mockExportCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          overrideColumns: [{ prop: 'csv-extra', hidden: false }],
        }),
      )
    })
  })
})
