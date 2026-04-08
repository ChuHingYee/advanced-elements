import type { ValueEnum } from '../../../src/types/column'
import { describe, expect, it } from 'vitest'
import {
  getEnumOptions,
  renderEnumCell,
} from '../../../src/components/cell-renderers/value-enum'

describe('value-enum', () => {
  describe('renderEnumCell', () => {
    it('should return empty string when value is undefined', () => {
      const valueEnum: ValueEnum = { 1: 'Active' }
      expect(renderEnumCell(undefined, valueEnum)).toBe('')
    })

    it('should return value as string when key not in valueEnum', () => {
      const valueEnum: ValueEnum = { 1: 'Active' }
      const result = renderEnumCell(999, valueEnum)
      expect(result).toBe('999')
    })

    it('should render string value', () => {
      const valueEnum: ValueEnum = { 1: 'Active', 2: 'Inactive' }
      const result = renderEnumCell('1', valueEnum)
      expect(result).toBeDefined()
    })

    it('should render object value', () => {
      const valueEnum: ValueEnum = {
        1: { text: 'Active', status: 'success' },
        2: { text: 'Inactive', status: 'danger' },
      }
      const result = renderEnumCell('1', valueEnum)
      expect(result).toBeDefined()
    })

    it('should use default status', () => {
      const valueEnum: ValueEnum = { 1: 'Active' }
      const result = renderEnumCell('1', valueEnum)
      expect(result).toBeDefined()
    })

    it('should return empty string when value is null', () => {
      const valueEnum: ValueEnum = { 1: 'Active' }
      const result = renderEnumCell(null, valueEnum)
      expect(result).toBe('')
    })

    it('should return string for missing key with null value', () => {
      const valueEnum: ValueEnum = { 1: 'Active' }
      const result = renderEnumCell(null, valueEnum)
      expect(result).toBe('')
    })

    it('should handle numeric value', () => {
      const valueEnum: ValueEnum = { 1: 'Active' }
      const result = renderEnumCell(1, valueEnum)
      expect(result).toBeDefined()
    })

    it('should handle empty valueEnum', () => {
      const valueEnum: ValueEnum = {}
      const result = renderEnumCell('test', valueEnum)
      expect(result).toBe('test')
    })
  })

  describe('getEnumOptions', () => {
    it('should convert valueEnum to options', () => {
      const valueEnum: ValueEnum = { 1: 'Active', 2: 'Inactive' }
      const options = getEnumOptions(valueEnum)

      expect(options).toHaveLength(2)
      expect(options[0]).toEqual({ label: 'Active', value: '1' })
      expect(options[1]).toEqual({ label: 'Inactive', value: '2' })
    })

    it('should handle object valueEnum', () => {
      const valueEnum: ValueEnum = {
        1: { text: 'Active', status: 'success' },
        2: { text: 'Inactive', status: 'danger' },
      }
      const options = getEnumOptions(valueEnum)

      expect(options).toHaveLength(2)
      expect(options[0]).toEqual({ label: 'Active', value: '1' })
    })

    it('should handle empty valueEnum', () => {
      const valueEnum: ValueEnum = {}
      const options = getEnumOptions(valueEnum)
      expect(options).toHaveLength(0)
    })

    it('should normalize string items to include default status', () => {
      const valueEnum: ValueEnum = { 1: 'Active' }
      const options = getEnumOptions(valueEnum)
      expect(options[0].label).toBe('Active')
    })
  })
})
