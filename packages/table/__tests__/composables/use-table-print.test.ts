/**
 * @file Tests for useTablePrintOrchestration — 打印编排 Composable 测试
 */
import type { AdvColumn } from '../../src/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTablePrintOrchestration } from '../../src/composables/features/use-table-print'

import { printTable } from '../../src/utils/print'

// Mock printTable to avoid actual iframe/print operations
vi.mock('../../src/utils/print', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/utils/print')>()
  return {
    ...original,
    printTable: vi.fn().mockResolvedValue({ cancelled: false }),
  }
})

describe('useTablePrintOrchestration', () => {
  const mockNotify = vi.fn()

  const baseOptions = () => ({
    normalColumns: () => [{ prop: 'name', label: 'Name', hidden: false }] as AdvColumn<{ name: string, age: number }>[],
    allColumns: () => [
      { prop: 'name', label: 'Name', hidden: false },
      { prop: 'age', label: 'Age', hidden: true },
    ] as AdvColumn<{ name: string, age: number }>[],
    tableData: ref([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]),
    visibleData: () => [{ name: 'Alice', age: 30 }],
    selectedRows: () => [{ name: 'Alice', age: 30 }],
    tableCtx: null as any,
    printOptions: () => ({
      sheetName: 'Test Report',
      columnMode: 'visible' as const,
      dataMode: 'all' as const,
      pageOrientation: 'portrait' as const,
      paperSize: 'A4' as const,
      rowsPerPage: 0,
      showRowIndex: false,
    }),
    t: (key: string) => key,
    notify: mockNotify,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockNotify.mockReset()
  })

  describe('printing state', () => {
    it('starts with printing = false', () => {
      const { printing } = useTablePrintOrchestration(baseOptions())
      expect(printing.value).toBe(false)
    })

    it('sets printing to true during print and false after', async () => {
      const { printing, print } = useTablePrintOrchestration(baseOptions())
      const promise = print()
      expect(printing.value).toBe(true)
      await promise
      expect(printing.value).toBe(false)
    })
  })

  describe('print() — data mode resolution', () => {
    it('prints all data by default', async () => {
      const { print } = useTablePrintOrchestration(baseOptions())
      await print()
      expect(printTable).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }],
        }),
      )
    })

    it('prints current data when dataMode is "current"', async () => {
      const { print } = useTablePrintOrchestration(baseOptions())
      await print({ dataMode: 'current' })
      expect(printTable).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ name: 'Alice', age: 30 }],
        }),
      )
    })

    it('prints selected rows when dataMode is "selected"', async () => {
      const { print } = useTablePrintOrchestration(baseOptions())
      await print({ dataMode: 'selected' })
      expect(printTable).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ name: 'Alice', age: 30 }],
        }),
      )
    })
  })

  describe('print() — column mode resolution', () => {
    it('prints visible columns by default', async () => {
      const { print } = useTablePrintOrchestration(baseOptions())
      await print()
      expect(printTable).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: [{ prop: 'name', label: 'Name', hidden: false }],
        }),
      )
    })

    it('prints all columns when columnMode is "all"', async () => {
      const { print } = useTablePrintOrchestration(baseOptions())
      await print({ columnMode: 'all' })
      expect(printTable).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: expect.arrayContaining([
            expect.objectContaining({ prop: 'name', hidden: false }),
            expect.objectContaining({ prop: 'age', hidden: true }),
          ]),
        }),
      )
    })
  })

  describe('print() — option merging', () => {
    it('merges override options with defaults', async () => {
      const { print } = useTablePrintOrchestration(baseOptions())
      await print({ sheetName: 'Override', pageOrientation: 'landscape' })
      expect(printTable).toHaveBeenCalledWith(
        expect.objectContaining({
          sheetName: 'Override',
          pageOrientation: 'landscape',
          paperSize: 'A4',
        }),
      )
    })

    it('uses default sheetName when not provided', async () => {
      const { print } = useTablePrintOrchestration({
        ...baseOptions(),
        printOptions: () => ({
          sheetName: 'Default Sheet',
          columnMode: 'visible' as const,
          dataMode: 'all' as const,
        }),
      })
      await print()
      expect(printTable).toHaveBeenCalledWith(
        expect.objectContaining({ sheetName: 'Default Sheet' }),
      )
    })

    it('uses empty string as default sheetName in printTable call', async () => {
      const { print } = useTablePrintOrchestration({
        ...baseOptions(),
        printOptions: () => ({}) as any,
      })
      await print()
      expect(printTable).toHaveBeenCalledWith(
        expect.objectContaining({ sheetName: '' }),
      )
    })
  })

  describe('concurrency protection', () => {
    it('ignores subsequent print calls while already printing', async () => {
      const { print } = useTablePrintOrchestration(baseOptions())
      // Call print twice; second should be ignored
      const p1 = print()
      const p2 = print()
      await Promise.all([p1, p2])
      expect(printTable).toHaveBeenCalledTimes(1)
    })

    it('resets printing state even if printTable throws', async () => {
      vi.mocked(printTable).mockRejectedValueOnce(new Error('Print failed'))
      const { printing, print } = useTablePrintOrchestration(baseOptions())
      await expect(print()).resolves.toBeUndefined()
      expect(printing.value).toBe(false)
    })
  })

  describe('error handling via notify', () => {
    it('calls notify with error when printTable fails', async () => {
      vi.mocked(printTable).mockRejectedValueOnce(new Error('Network error'))
      const { print } = useTablePrintOrchestration(baseOptions())
      await print()
      expect(mockNotify).toHaveBeenCalledWith('error', 'Network error', 'print')
    })

    it('calls notify with success on successful print', async () => {
      const { print } = useTablePrintOrchestration(baseOptions())
      await print()
      expect(mockNotify).toHaveBeenCalledWith('success', expect.any(String), 'print')
    })
  })
})
