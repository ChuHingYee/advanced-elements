import { describe, expect, it } from 'vitest'
import { ADV_TABLE_COLUMN_KEY_ATTR, ADV_TABLE_INTERNAL_COLUMN_ID, ADV_TABLE_ROW_KEY_ATTR, ensureInternalColumnId, getMarkedChildKeys } from '../../src/utils/table-drag'

describe('table-drag utils', () => {
  describe('ensureInternalColumnId', () => {
    it('should return column unchanged if key exists', () => {
      const col = { key: 'test-key', prop: 'test', label: 'Test', hidden: false } as any
      const result = ensureInternalColumnId(col, 'fallback-key')
      expect(result).toBe(col)
    })

    it('should return column unchanged if prop exists', () => {
      const col = { prop: 'test-prop', label: 'Test', hidden: false } as any
      const result = ensureInternalColumnId(col, 'fallback-key')
      expect(result).toBe(col)
    })

    it('should return column unchanged if internal id exists', () => {
      const col = { [ADV_TABLE_INTERNAL_COLUMN_ID]: 'existing-id', label: 'Test' } as any
      const result = ensureInternalColumnId(col, 'fallback-key')
      expect(result).toBe(col)
    })

    it('should add internal id if neither key, prop, nor internal id exists', () => {
      const col = { label: 'Test' } as any
      const result = ensureInternalColumnId(col, 'fallback-key')
      expect(result[ADV_TABLE_INTERNAL_COLUMN_ID]).toBe('fallback-key')
    })

    it('should add internal id with fallback key', () => {
      const col = { width: 100 } as any
      const result = ensureInternalColumnId(col, 'my-fallback-key')
      expect(result[ADV_TABLE_INTERNAL_COLUMN_ID]).toBe('my-fallback-key')
    })
  })

  describe('getMarkedChildKeys', () => {
    it('should return empty array for null container', () => {
      const result = getMarkedChildKeys(null, 'data-test')
      expect(result).toEqual([])
    })

    it('should return keys from marked children', () => {
      const container = document.createElement('div')
      const child1 = document.createElement('div')
      const marker1 = document.createElement('span')
      marker1.setAttribute('data-test', 'key1')
      child1.appendChild(marker1)
      container.appendChild(child1)

      const child2 = document.createElement('div')
      const marker2 = document.createElement('span')
      marker2.setAttribute('data-test', 'key2')
      child2.appendChild(marker2)
      container.appendChild(child2)

      const result = getMarkedChildKeys(container, 'data-test')
      expect(result).toContain('key1')
      expect(result).toContain('key2')
    })

    it('should filter out empty keys', () => {
      const container = document.createElement('div')
      const child1 = document.createElement('div')
      const marker1 = document.createElement('span')
      marker1.setAttribute('data-test', 'key1')
      child1.appendChild(marker1)
      container.appendChild(child1)

      const child2 = document.createElement('div')
      container.appendChild(child2)

      const result = getMarkedChildKeys(container, 'data-test')
      expect(result).toContain('key1')
      expect(result).not.toContain('')
    })

    it('should return empty array when no markers found', () => {
      const container = document.createElement('div')
      container.innerHTML = '<div>no marker here</div>'
      const result = getMarkedChildKeys(container, 'data-test')
      expect(result).toEqual([])
    })
  })

  describe('constants', () => {
    it('should export correct constant values', () => {
      expect(ADV_TABLE_INTERNAL_COLUMN_ID).toBe('__advTableColumnId')
      expect(ADV_TABLE_COLUMN_KEY_ATTR).toBe('data-adv-table-column-key')
      expect(ADV_TABLE_ROW_KEY_ATTR).toBe('data-adv-table-row-key')
    })
  })
})
