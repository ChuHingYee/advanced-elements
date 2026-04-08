import { describe, expect, it, vi } from 'vitest'
import { useCellEditSession } from '@/composables/editing/use-cell-edit-session'

describe('2-5 useCellEditSession (phase 2 split)', () => {
  it('exposes empty session refs initially', () => {
    const s = useCellEditSession()
    expect(s.editingCell.value).toBeNull()
    expect(s.editingValue.value).toBeNull()
    expect(s.editingRowIndex.value).toBeNull()
    expect(s.editingValues.value).toEqual({})
    expect(s.validationBlocked.value).toBe(false)
    expect(s.editingRowKey.value).toBeNull()
    expect(s.editingRowRef.value).toBeNull()
  })

  it('resetEditingState clears every field without notifying', () => {
    const onEditCancelled = vi.fn()
    const s = useCellEditSession({ onEditCancelled })
    s.editingCell.value = { rowIndex: 1, columnKey: 'k' } as any
    s.editingValue.value = 'x'
    s.editingRowIndex.value = 1
    s.editingValues.value = { k: 'x' }
    s.validationBlocked.value = true
    s.editingRowKey.value = 'r1'
    s.editingRowRef.value = { id: 1 } as any
    s.resetEditingState()
    expect(s.editingCell.value).toBeNull()
    expect(s.editingValue.value).toBeNull()
    expect(s.editingRowIndex.value).toBeNull()
    expect(s.editingValues.value).toEqual({})
    expect(s.validationBlocked.value).toBe(false)
    expect(s.editingRowKey.value).toBeNull()
    expect(s.editingRowRef.value).toBeNull()
    expect(onEditCancelled).not.toHaveBeenCalled()
  })

  it('forced cancels reset state and notify with the right reason', () => {
    const onEditCancelled = vi.fn()
    const s = useCellEditSession({ onEditCancelled })
    s.editingValue.value = 'dirty'
    s.cancelDueToRowDeleted()
    expect(s.editingValue.value).toBeNull()
    expect(onEditCancelled).toHaveBeenCalledTimes(1)
    expect(onEditCancelled).toHaveBeenCalledWith({ reason: 'row-deleted' })
    s.editingValue.value = 'dirty'
    s.cancelDueToDataChanged()
    expect(s.editingValue.value).toBeNull()
    expect(onEditCancelled).toHaveBeenCalledWith({ reason: 'data-changed' })
  })
})
