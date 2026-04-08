import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useTableExportOrchestration } from '../../src/composables/features/use-table-export'
import { mockColumn } from '../helpers'

function createExport(options?: {
  columns?: ProcessedColumn[]
  data?: any[]
  getSelectedRows?: () => any[]
  exportAllData?: () => any[]
}) {
  const columns = ref(options?.columns ?? [
    { ...mockColumn({ prop: 'name', hidden: false }) },
    { ...mockColumn({ prop: 'age', hidden: false }) },
  ] as ProcessedColumn[])
  const data = ref(options?.data ?? [
    { id: '1', name: 'Alice', age: 25 },
    { id: '2', name: 'Bob', age: 30 },
    { id: '3', name: 'Charlie', age: 35 },
  ])

  return useTableExportOrchestration({
    effectiveColumns: columns as any as any,
    visibleData: data as any,
    getSelectedRows: options?.getSelectedRows ?? (() => []),
    exportAllData: options?.exportAllData ?? (() => data.value),
    exportMethod: computed(() => 'excel'),
    showMessage: vi.fn(),
    exportExcel: vi.fn(),
    exportCsv: vi.fn(),
  } as any)
}

describe('useTableExportOrchestration', () => {
  it('returns exporting state', () => {
    const { exporting } = createExport()
    expect(exporting.value).toBe(false)
  })

  it('returns exportingCsv state', () => {
    const { exportingCsv } = createExport()
    expect(exportingCsv.value).toBe(false)
  })

  it('has exportExcel function', () => {
    const { exportExcel } = createExport()
    expect(typeof exportExcel).toBe('function')
  })

  it('has exportCsv function', () => {
    const { exportCsv } = createExport()
    expect(typeof exportCsv).toBe('function')
  })
})
