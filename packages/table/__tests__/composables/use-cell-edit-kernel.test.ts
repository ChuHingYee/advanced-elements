import { describe, expect, it } from 'vitest'
import {
  captureCommitBaseline,
  checkCommitBaselineFresh,
  detectSpreadConflicts,
} from '../../src/composables/editing/use-cell-edit-kernel'

describe('use-cell-edit-kernel pure guards', () => {
  it('captureCommitBaseline snapshots ref+length+version', () => {
    const data = [{ a: 1 }]
    const b = captureCommitBaseline(data, 7)
    expect(b.dataRef).toBe(data)
    expect(b.length).toBe(1)
    expect(b.version).toBe(7)
  })

  it('checkCommitBaselineFresh fail-fast reasons', () => {
    const data = [{ a: 1 }]
    const base = captureCommitBaseline(data, 1)
    expect(checkCommitBaselineFresh(base, data, 1, false)).toBeNull()
    expect(checkCommitBaselineFresh(base, data, 1, true)).toBe('unmounted')
    expect(checkCommitBaselineFresh(base, data, 2, false)).toBe('epoch-stale')
    expect(checkCommitBaselineFresh(base, [...data, { a: 2 }], 1, false)).toBe('length-mismatch')
  })

  it('detectSpreadConflicts only diffs pending props', () => {
    const conflicts = detectSpreadConflicts({
      baselineRow: { a: 1, b: 2 },
      currentRow: { a: 1, b: 3 },
      pendingProps: ['b'],
    })
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.prop).toBe('b')
    expect(detectSpreadConflicts({
      baselineRow: { a: 1, b: 3 },
      currentRow: { a: 9, b: 3 },
      pendingProps: ['b'],
    })).toEqual([])
  })
})
