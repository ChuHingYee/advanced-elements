/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { deriveCheckStatus } from '../../src/utils/checkbox-state'

describe('checkbox-state', () => {
  describe('deriveCheckStatus', () => {
    it('returns all selected when selectedCount equals total', () => {
      const result = deriveCheckStatus(4, 4)
      expect(result.isAllSelected).toBe(true)
      expect(result.isIndeterminate).toBe(false)
    })

    it('returns indeterminate when partially selected', () => {
      const result = deriveCheckStatus(2, 4)
      expect(result.isAllSelected).toBe(false)
      expect(result.isIndeterminate).toBe(true)
    })

    it('returns none when nothing selected', () => {
      const result = deriveCheckStatus(0, 4)
      expect(result.isAllSelected).toBe(false)
      expect(result.isIndeterminate).toBe(false)
    })

    it('returns none when total is 0', () => {
      const result = deriveCheckStatus(0, 0)
      expect(result.isAllSelected).toBe(false)
      expect(result.isIndeterminate).toBe(false)
    })

    it('returns indeterminate when selectedCount equals total but total is 0', () => {
      // Edge case: 0/0 should not be all selected
      const result = deriveCheckStatus(0, 0)
      expect(result.isAllSelected).toBe(false)
    })
  })
})
