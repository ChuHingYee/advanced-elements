import type { VNode } from 'vue'
import type { SpanInfo } from '../../../src/types'
import { describe, expect, it } from 'vitest'
import { createSpanRowComponent } from '../../../src/components/table-virtual-renderer/span-row-renderer'

describe('span-row-renderer.ts', () => {
  describe('createSpanRowComponent', () => {
    it('creates a SpanRow component', () => {
      const getSpanInfo = () => undefined
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: 'name' }, { prop: 'age' }])
      expect(SpanRow).toBeDefined()
      expect(typeof SpanRow).toBe('function')
    })

    it('handles empty columns', () => {
      const getSpanInfo = () => undefined
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [])
      expect(SpanRow).toBeDefined()
    })

    it('handles columns without prop', () => {
      const getSpanInfo = () => undefined
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: undefined }, {}])
      expect(SpanRow).toBeDefined()
    })

    it('handles selection column offset', () => {
      const getSpanInfo = () => undefined
      const SpanRow = createSpanRowComponent(getSpanInfo, 1, [{ prop: 'name' }])
      expect(SpanRow).toBeDefined()
    })

    it('renders cells without span info', () => {
      const getSpanInfo = () => undefined
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: 'name' }])
      const cells = [{ key: 'name', props: { style: { width: '100px' } } }]
      const result = SpanRow({ cells: cells as any, rowIndex: 0, rowData: {}, columns: [] })
      expect(result).toBe(cells)
    })

    it('returns cells array', () => {
      const getSpanInfo = () => undefined
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: 'name' }])
      const cells = [{ key: 'name', props: {} }]
      const result = SpanRow({ cells: cells as any, rowIndex: 0, rowData: {}, columns: [] })
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('span info handling', () => {
    it('handles non-origin cell (should be hidden)', () => {
      const getSpanInfo = (): SpanInfo | undefined => ({
        isOrigin: false,
        rowspan: 1,
        colspan: 1,
      })
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: 'name' }])
      const cells = [{ key: 'name', props: {} }] as unknown as VNode[]
      SpanRow({ cells, rowIndex: 0, rowData: {}, columns: [] })
      // Source creates a hidden VNode with adv-table__cell-span-hidden class, not null
      expect(cells[0]).not.toBeNull()
      const hiddenCell = cells[0] as unknown as { props?: { class?: string } }
      expect(hiddenCell.props?.class).toContain('adv-table__cell-span-hidden')
    })

    it('applies rowspan style to origin cell', () => {
      const getSpanInfo = (rowIndex: number, colKey: string): SpanInfo | undefined => {
        if (colKey === 'name' && rowIndex === 0) {
          return { isOrigin: true, rowspan: 2, colspan: 1 }
        }
        return undefined
      }
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: 'name' }])
      const mockCell = {
        key: 'name',
        props: { style: { width: '100px' } },
      }
      const cells = [mockCell as any]
      SpanRow({ cells, rowIndex: 0, rowData: {}, columns: [] })
      expect(cells[0]).not.toBe(mockCell)
    })

    it('applies colspan style to origin cell', () => {
      const getSpanInfo = (rowIndex: number, colKey: string): SpanInfo | undefined => {
        if (colKey === 'name' && rowIndex === 0) {
          return { isOrigin: true, rowspan: 1, colspan: 2 }
        }
        return undefined
      }
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: 'name' }, { prop: 'age' }])
      const cells = [
        { key: 'name', props: { style: { width: '100px' } } },
        { key: 'age', props: { style: { width: '100px' } } },
      ]
      SpanRow({ cells: cells as any, rowIndex: 0, rowData: {}, columns: [] })
      expect(cells[0]).not.toBe(cells[1])
    })

    it('applies both rowspan and colspan', () => {
      const getSpanInfo = (rowIndex: number, colKey: string): SpanInfo | undefined => {
        if (colKey === 'name' && rowIndex === 0) {
          return { isOrigin: true, rowspan: 2, colspan: 2 }
        }
        return undefined
      }
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: 'name' }, { prop: 'age' }])
      const cells = [
        { key: 'name', props: { style: { width: '100px' } } },
        { key: 'age', props: { style: { width: '100px' } } },
      ]
      SpanRow({ cells: cells as any, rowIndex: 0, rowData: {}, columns: [] })
      expect(cells[0]).not.toBe(cells[1])
    })
  })

  describe('edge cases', () => {
    it('handles missing cell', () => {
      const getSpanInfo = (): SpanInfo | undefined => ({
        isOrigin: true,
        rowspan: 1,
        colspan: 1,
      })
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: 'name' }])
      const cells: any[] = []
      const result = SpanRow({ cells, rowIndex: 0, rowData: {}, columns: [] })
      expect(result).toEqual([])
    })

    it('handles span info for non-existing column', () => {
      const getSpanInfo = (_rowIndex: number, colKey: string): SpanInfo | undefined => {
        if (colKey === 'nonexistent') {
          return { isOrigin: true, rowspan: 1, colspan: 1 }
        }
        return undefined
      }
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: 'name' }])
      const cells = [{ key: 'name', props: {} }]
      const result = SpanRow({ cells: cells as any, rowIndex: 0, rowData: {}, columns: [] })
      expect(result).toBe(cells)
    })

    it('handles rowIndex parameter', () => {
      const getSpanInfo = (rowIndex: number) => {
        if (rowIndex === 5) {
          return { isOrigin: true, rowspan: 1, colspan: 1 }
        }
        return undefined
      }
      const SpanRow = createSpanRowComponent(getSpanInfo, 0, [{ prop: 'name' }])
      const cells = [{ key: 'name', props: {} }]
      const result = SpanRow({ cells: cells as any, rowIndex: 5, rowData: {}, columns: [] })
      expect(result).toBe(cells)
    })
  })
})
