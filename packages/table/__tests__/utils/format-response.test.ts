import type { FormatMaps } from '../../src/types/response'
import { describe, expect, it } from 'vitest'
import { parseResponseData } from '../../src/utils/format-response'

describe('format-response utils', () => {
  describe('parseResponseData', () => {
    it('should parse standard response with data and total', () => {
      const source = {
        data: [{ id: 1 }, { id: 2 }],
        total: 10,
      }
      const maps: FormatMaps = { data: 'data', total: 'total' }

      const result = parseResponseData(source, maps)

      expect(result.data).toEqual([{ id: 1 }, { id: 2 }])
      expect(result.total).toBe(10)
    })

    it('should handle missing data', () => {
      const source = { total: 10 }
      const maps: FormatMaps = { data: 'data', total: 'total' }

      const result = parseResponseData(source, maps)

      expect(result.data).toEqual([])
      expect(result.total).toBe(10)
    })

    it('should handle missing total', () => {
      const source = { data: [{ id: 1 }] }
      const maps: FormatMaps = { data: 'data', total: 'total' }

      const result = parseResponseData(source, maps)

      expect(result.data).toEqual([{ id: 1 }])
      expect(result.total).toBe(0)
    })

    it('should handle empty source', () => {
      const source = {}
      const maps: FormatMaps = { data: 'data', total: 'total' }

      const result = parseResponseData(source, maps)

      expect(result.data).toEqual([])
      expect(result.total).toBe(0)
    })

    it('should handle data as non-array', () => {
      const source = { data: 'not an array', total: 10 }
      const maps: FormatMaps = { data: 'data', total: 'total' }

      const result = parseResponseData(source, maps)

      expect(result.data).toEqual([])
      expect(result.total).toBe(10)
    })

    it('should support direct array responses', () => {
      const result = parseResponseData([{ id: 1 }, { id: 2 }], { data: 'data', total: 'total' })

      expect(result.data).toEqual([{ id: 1 }, { id: 2 }])
      expect(result.total).toBe(2)
    })
  })
})
