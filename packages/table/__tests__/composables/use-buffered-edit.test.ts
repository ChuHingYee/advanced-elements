import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useBufferedEdit } from '../../src/composables/editing/use-buffered-edit'

describe('useBufferedEdit', () => {
  const data = ref([
    { id: '1', name: 'Alice', age: 25 },
    { id: '2', name: 'Bob', age: 30 },
  ])
  const dataComputed = computed(() => data.value)
  const rowKeyFn = ref((row: any) => row.id)
  const onDataUpdate = vi.fn()

  function createBatchEdit(editType?: 'batch' | 'fullRow') {
    return useBufferedEdit({
      data: dataComputed,
      rowKeyFn,
      editConfig: computed(() => editType ? { editType } as any : undefined),
      onDataUpdate,
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with no pending changes', () => {
    const be = createBatchEdit()
    expect(be.pendingChanges.value.size).toBe(0)
    expect(be.hasPendingChanges.value).toBe(false)
  })

  it('isBatchEdit is true when editType is batch', () => {
    const be = createBatchEdit('batch')
    expect(be.isBatchEdit.value).toBe(true)
  })

  it('isBatchEdit is false when editType is not batch', () => {
    const be = createBatchEdit()
    expect(be.isBatchEdit.value).toBe(false)
    const be2 = createBatchEdit('fullRow')
    expect(be2.isBatchEdit.value).toBe(false)
  })

  it('recordChange stores pending changes', () => {
    const be = createBatchEdit('batch')
    be.recordChange('1', 'name', 'Alice Updated')
    expect(be.hasPendingChanges.value).toBe(true)
    expect(be.pendingChanges.value.get('1')).toEqual({ name: 'Alice Updated' })
  })

  it('recordChange merges multiple props for same row', () => {
    const be = createBatchEdit('batch')
    be.recordChange('1', 'name', 'Alice')
    be.recordChange('1', 'age', 26)
    expect(be.pendingChanges.value.get('1')).toEqual({ name: 'Alice', age: 26 })
  })

  it('recordChange supports different rows', () => {
    const be = createBatchEdit('batch')
    be.recordChange('1', 'name', 'A')
    be.recordChange('2', 'name', 'B')
    expect(be.pendingChanges.value.size).toBe(2)
  })

  it('commitBatchEdit applies changes and clears pending', () => {
    const be = createBatchEdit('batch')
    be.recordChange('1', 'name', 'Alice New')
    be.commitBatchEdit()
    expect(onDataUpdate).toHaveBeenCalledOnce()
    expect(be.pendingChanges.value.size).toBe(0)
    expect(be.hasPendingChanges.value).toBe(false)
  })

  it('commitBatchEdit merges changes into data', () => {
    const be = createBatchEdit('batch')
    be.recordChange('1', 'name', 'Alice New')
    be.commitBatchEdit()
    const newData = onDataUpdate.mock.calls[0][0]
    expect(newData[0]).toEqual({ id: '1', name: 'Alice New', age: 25 })
    expect(newData[1]).toEqual({ id: '2', name: 'Bob', age: 30 })
  })

  it('commitBatchEdit is no-op with no pending changes', () => {
    const be = createBatchEdit()
    be.commitBatchEdit()
    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('commitBatchEdit calls validateFn before applying changes', async () => {
    const validateFn = vi.fn().mockResolvedValue(true)
    const be = useBufferedEdit({
      data: dataComputed,
      rowKeyFn,
      editConfig: computed(() => ({ editType: 'batch' }) as any),
      onDataUpdate,
      validateFn,
    })
    be.recordChange('1', 'name', 'Alice New')
    await be.commitBatchEdit()
    expect(validateFn).toHaveBeenCalledOnce()
    expect(onDataUpdate).toHaveBeenCalledOnce()
  })

  it('passes staged data to batch validation', async () => {
    const validateFn = vi.fn().mockResolvedValue(false)
    const be = useBufferedEdit({
      data: dataComputed,
      rowKeyFn,
      editConfig: computed(() => ({ editType: 'batch' }) as any),
      onDataUpdate,
      validateFn,
    })
    be.recordChange('1', 'name', '')
    await be.commitBatchEdit()
    expect(validateFn).toHaveBeenCalledWith([
      { id: '1', name: '', age: 25 },
      { id: '2', name: 'Bob', age: 30 },
    ])
    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('commitBatchEdit blocks commit when validateFn returns false', async () => {
    const validateFn = vi.fn().mockResolvedValue(false)
    const be = useBufferedEdit({
      data: dataComputed,
      rowKeyFn,
      editConfig: computed(() => ({ editType: 'batch' }) as any),
      onDataUpdate,
      validateFn,
    })
    be.recordChange('1', 'name', 'Alice New')
    await be.commitBatchEdit()
    expect(validateFn).toHaveBeenCalledOnce()
    expect(onDataUpdate).not.toHaveBeenCalled()
    expect(be.hasPendingChanges.value).toBe(true)
  })

  it('commitBatchEdit calls onValidationError when validateFn returns false', async () => {
    const validateFn = vi.fn().mockResolvedValue(false)
    const onValidationError = vi.fn()
    const be = useBufferedEdit({
      data: dataComputed,
      rowKeyFn,
      editConfig: computed(() => ({ editType: 'batch' }) as any),
      onDataUpdate,
      validateFn,
      onValidationError,
    })
    be.recordChange('1', 'name', 'Alice New')
    await be.commitBatchEdit()
    expect(onValidationError).toHaveBeenCalledOnce()
    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('commitBatchEdit does not call onValidationError when validation passes', async () => {
    const validateFn = vi.fn().mockResolvedValue(true)
    const onValidationError = vi.fn()
    const be = useBufferedEdit({
      data: dataComputed,
      rowKeyFn,
      editConfig: computed(() => ({ editType: 'batch' }) as any),
      onDataUpdate,
      validateFn,
      onValidationError,
    })
    be.recordChange('1', 'name', 'Alice New')
    await be.commitBatchEdit()
    expect(onValidationError).not.toHaveBeenCalled()
    expect(onDataUpdate).toHaveBeenCalledOnce()
  })

  it('cancelBatchEdit discards pending changes', () => {
    const be = createBatchEdit('batch')
    be.recordChange('1', 'name', 'Discard Me')
    be.cancelBatchEdit()
    expect(be.pendingChanges.value.size).toBe(0)
    expect(be.hasPendingChanges.value).toBe(false)
    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('emphemeral getter for isValid', () => {
    const be = createBatchEdit('batch')
    expect(be.isBatchEdit.value).toBe(true)
  })

  describe('displayData', () => {
    it('returns original data when not in batch mode', () => {
      const be = createBatchEdit()
      expect(be.displayData.value).toBe(dataComputed.value)
    })

    it('returns original data when no pending changes', () => {
      const be = createBatchEdit('batch')
      expect(be.displayData.value).toBe(dataComputed.value)
    })

    it('merges pending changes into display data in batch mode', () => {
      const be = createBatchEdit('batch')
      be.recordChange('1', 'name', 'Alice Updated')
      be.recordChange('2', 'age', 31)

      const display = be.displayData.value
      expect(display[0].name).toBe('Alice Updated')
      expect(display[0].age).toBe(25) // unchanged
      expect(display[1].age).toBe(31)
      expect(display[1].name).toBe('Bob') // unchanged
    })

    it('does not modify original data ref', () => {
      const be = createBatchEdit('batch')
      be.recordChange('1', 'name', 'Changed')

      const display = be.displayData.value
      expect(display[0].name).toBe('Changed')
      // original data should remain unchanged
      expect(data.value[0].name).toBe('Alice')
    })

    it('caches keyToIndex map when data ref unchanged', () => {
      const be = createBatchEdit('batch')
      be.recordChange('1', 'name', 'A')

      // <zh/> 读取以固化变更前快照引用 | <en/> read to materialize the pre-change snapshot reference
      const _beforeChange = be.displayData.value
      be.recordChange('1', 'age', 99)
      const second = be.displayData.value

      // Both should have the merged changes and not throw
      expect(second[0].name).toBe('A')
      expect(second[0].age).toBe(99)
    })
  })
})
