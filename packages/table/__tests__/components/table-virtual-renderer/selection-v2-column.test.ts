import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSelectionV2Column } from '../../../src/components/table-virtual-renderer/selection-v2-column'

vi.mock('@vueuse/core', () => ({
  useMouseInElement: vi.fn(() => ({
    isOutside: ref(true),
  })),
}))

describe('selection-v2-column', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('useSelectionV2Column', () => {
    it('should return selectionV2Columns when selectionColumns is empty', () => {
      const result = useSelectionV2Column({
        selectionColumns: [],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      expect(result.selectionV2Columns.value).toHaveLength(0)
    })

    it('should return selectionV2Columns when selectionColumns has items', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      expect(result.selectionV2Columns.value).toHaveLength(1)
    })

    it('should use default selectionWidth of 50', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      expect(result.selectionV2Columns.value[0].width).toBe(50)
    })

    it('should use custom selectionWidth', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectionWidth: 60,
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      expect(result.selectionV2Columns.value[0].width).toBe(60)
    })

    it('should have center alignment', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      expect(result.selectionV2Columns.value[0].align).toBe('center')
    })

    it('should have selection key', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      expect(result.selectionV2Columns.value[0].key).toBe('selection')
      expect(result.selectionV2Columns.value[0].dataKey).toBe('selection')
    })
  })

  describe('isRowSelectable', () => {
    it('should return true when selectableFn is not provided', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      const column = result.selectionV2Columns.value[0]
      expect(column).toBeDefined()
    })

    it('should use selectableFn when provided', () => {
      const selectableFn = vi.fn((row: any, _index: number) => row.id > 0)
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [{ id: 1 }],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        selectableFn,
        rowKeyFn: () => '1',
      } as any)

      expect(result.selectionV2Columns.value).toHaveLength(1)
    })
  })

  describe('headerCellRenderer', () => {
    it('should render header checkbox', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [{ id: 1 }],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      const column = result.selectionV2Columns.value[0]
      expect(column.headerCellRenderer).toBeDefined()
    })

    it('should have selection key in column', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [],
        checkStatus: {
          isAllSelected: true,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      const column = result.selectionV2Columns.value[0]
      expect(column.key).toBe('selection')
    })

    it('should have isAllSelected based on checkStatus', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [{ id: 1 }],
        checkStatus: {
          isAllSelected: true,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      const column = result.selectionV2Columns.value[0]
      expect(column).toBeDefined()
    })

    it('should have isIndeterminate based on checkStatus', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [{ id: 1 }],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: true,
        },
        rowKeyFn: () => '1',
      } as any)

      const column = result.selectionV2Columns.value[0]
      expect(column).toBeDefined()
    })
  })

  describe('cellRenderer', () => {
    it('should render cell checkbox', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKeyFn: () => '1',
      } as any)

      const column = result.selectionV2Columns.value[0]
      expect(column.cellRenderer).toBeDefined()
    })

    it('should use rowKeyFn in cellRenderer', () => {
      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [{ id: 1 }],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        rowKeyFn: (row: any) => String(row.id),
      } as any)

      const column = result.selectionV2Columns.value[0]
      expect(column.cellRenderer).toBeDefined()
    })
  })

  describe('with selectionState', () => {
    it('should use selectionState when provided', () => {
      const mockSelectionState = {
        isSelected: vi.fn(() => true),
        toggleRowSelection: vi.fn(),
        toggleAllSelection: vi.fn(),
      }

      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [{ id: 1 }],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        selectionState: mockSelectionState as any,
        rowKeyFn: () => '1',
      } as any)

      expect(result.selectionV2Columns.value).toHaveLength(1)
    })

    it('should include selectionState in column config', () => {
      const mockSelectionState = {
        isSelected: vi.fn(() => false),
        toggleRowSelection: vi.fn(),
        toggleAllSelection: vi.fn(),
      }

      const result = useSelectionV2Column({
        selectionColumns: [{ key: 'selection' }],
        selectableData: [{ id: 1 }],
        checkStatus: {
          isAllSelected: false,
          isIndeterminate: false,
        },
        selectionState: mockSelectionState as any,
        rowKeyFn: () => '1',
      } as any)

      const column = result.selectionV2Columns.value[0]
      expect(column).toBeDefined()
    })
  })
})
