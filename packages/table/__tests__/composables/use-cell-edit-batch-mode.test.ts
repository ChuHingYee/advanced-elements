import type { ProcessedColumn } from '../../src/types/column'
import type { EditConfig } from '../../src/types/edit'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useCellEdit } from '../../src/composables/editing/use-cell-edit'
import { useCellNavigation } from '../../src/composables/editing/use-cell-navigation'
import { useEditorResolver } from '../../src/composables/editing/use-editor-resolver'
import { mockColumn } from '../helpers'

function createCellEdit(options?: {
  editConfig?: EditConfig
  data?: any[]
  columns?: ProcessedColumn[]
  interceptor?: { trigger: (...args: any[]) => boolean }
  validateFn?: (params: any) => Promise<boolean>
  onCellEditRequest?: (...args: any[]) => void
  onBatchRecordChange?: (...args: any[]) => void
  onCellValueChanged?: (...args: any[]) => void
  onCellEditingStarted?: (...args: any[]) => void
  onFullRowEditChanged?: (...args: any[]) => void
}) {
  const data = ref(options?.data ?? [
    { id: '1', name: 'Alice', age: 25 },
    { id: '2', name: 'Bob', age: 30 },
  ])
  const columns = ref(options?.columns ?? [
    { ...mockColumn({ prop: 'name', editable: true, cellEditor: 'text', hidden: false }) },
    { ...mockColumn({ prop: 'age', editable: true, cellEditor: 'number', hidden: false }) },
  ] as ProcessedColumn[])
  const editConfig = ref(options?.editConfig ?? {})

  const onDataUpdate = vi.fn()
  const onCellValueChanged = options?.onCellValueChanged ?? vi.fn()
  const onBatchRecordChange = options?.onBatchRecordChange ?? vi.fn()
  const onCellEditRequest = options?.onCellEditRequest ?? vi.fn()
  const onCellEditingStarted = options?.onCellEditingStarted ?? vi.fn()
  const onFullRowEditChanged = options?.onFullRowEditChanged ?? vi.fn()

  const editorResolver = useEditorResolver({ columns: columns as any })
  const navigation = useCellNavigation({ editableColumns: editorResolver.editableColumns, data: data as any, editConfig: editConfig as any })

  const result = useCellEdit({
    data: data as any,
    columns: columns as any,
    editConfig: editConfig as any,
    rowKeyFn: () => (row: any) => row.id,
    onDataUpdate,
    onCellValueChanged,
    onBatchRecordChange,
    onCellEditRequest,
    onCellEditingStarted,
    onFullRowEditChanged,
    interceptor: options?.interceptor as any,
    validateFn: options?.validateFn,
    navigation,
    editorResolver,
  })

  return { ...result, onDataUpdate, data, columns, editConfig }
}

describe('useCellEdit - batch mode', () => {
  it('starts editing in batch mode', async () => {
    const edit = createCellEdit({ editConfig: { editType: 'batch' } })
    await await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.isEditing.value).toBe(true)
    expect(edit.editingCell.value).not.toBeNull()
    expect(edit.editingCell.value?.rowIndex).toBe(0)
  })

  it('accumulates changes without committing', async () => {
    const onBatchRecordChange = vi.fn()
    const edit = createCellEdit({
      editConfig: { editType: 'batch' },
      onBatchRecordChange,
    })
    await await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'AliceUpdated'
    await edit.commitEditing()
    expect(onBatchRecordChange).toHaveBeenCalledWith({
      rowKey: '1',
      prop: 'name',
      oldValue: 'Alice',
      newValue: 'AliceUpdated',
    })
  })

  it('clears accumulated changes after cancel', async () => {
    const edit = createCellEdit({ editConfig: { editType: 'batch' } })
    await await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.isEditing.value).toBe(true)
    edit.cancelEditing()
    expect(edit.isEditing.value).toBe(false)
    expect(edit.editingCell.value).toBeNull()
  })

  it('preserves previous pending changes when re-editing', async () => {
    const edit = createCellEdit({ editConfig: { editType: 'batch' } })
    await await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'AliceV1'
    edit.cancelEditing()
    await await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.editingValue.value).toBe('Alice')
  })
})

describe('useCellEdit - readOnlyEdit mode', () => {
  it('emits cellEditRequest instead of writing data', async () => {
    const onCellEditRequest = vi.fn()
    const edit = createCellEdit({
      editConfig: { editType: 'readOnly' },
      onCellEditRequest,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'NewName'
    await edit.commitEditing()
    expect(onCellEditRequest).toHaveBeenCalled()
    expect(onCellEditRequest.mock.calls[0][0].oldValue).toBe('Alice')
    expect(onCellEditRequest.mock.calls[0][0].newValue).toBe('NewName')
    expect(edit.onDataUpdate).not.toHaveBeenCalled()
  })

  it('passes correct oldValue/newValue in cellEditRequest', async () => {
    const onCellEditRequest = vi.fn()
    const edit = createCellEdit({
      editConfig: { editType: 'readOnly' },
      onCellEditRequest,
    })
    await edit.startEditing({ rowIndex: 1, prop: 'name', columnKey: 'name', value: 'Bob' })
    edit.editingValue.value = 'Bobby'
    await edit.commitEditing()
    expect(onCellEditRequest).toHaveBeenCalledWith({
      row: { id: '2', name: 'Bob', age: 30 },
      rowIndex: 1,
      prop: 'name',
      column: expect.objectContaining({ prop: 'name', hidden: false }),
      oldValue: 'Bob',
      newValue: 'Bobby',
      reason: 'api',
    })
  })
})

describe('useCellEdit - interceptor integration', () => {
  it('aborts change when interceptor returns true for edit.start', async () => {
    const interceptor = { trigger: vi.fn(() => true) }
    const onCellEditingStarted = vi.fn()
    const edit = createCellEdit({ interceptor, onCellEditingStarted })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(interceptor.trigger).toHaveBeenCalledWith('edit.start', expect.any(Object))
    expect(edit.isEditing.value).toBe(false)
  })

  it('aborts change when interceptor returns true for edit.commit', async () => {
    const interceptor = { trigger: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true) }
    const edit = createCellEdit({ interceptor })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'NewName'
    await edit.commitEditing()
    expect(interceptor.trigger).toHaveBeenCalledWith('edit.commit', expect.any(Object))
    expect(edit.onDataUpdate).not.toHaveBeenCalled()
  })

  it('passes params through interceptor chain', async () => {
    const interceptor = { trigger: vi.fn(() => true) }
    const edit = createCellEdit({ interceptor })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(interceptor.trigger).toHaveBeenCalledWith('edit.start', expect.objectContaining({
      rowIndex: 0,
      prop: 'name',
    }))
  })

  it('interceptor return false allows edit to proceed', async () => {
    const interceptor = { trigger: vi.fn(() => false) }
    const edit = createCellEdit({ interceptor })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.isEditing.value).toBe(true)
  })
})

describe('useCellEdit - invalidEditValueMode', () => {
  const colsWithRules = [
    { ...mockColumn({ prop: 'name', editable: true, cellEditor: 'text', editorRules: true, hidden: false }) },
    { ...mockColumn({ prop: 'age', editable: true, cellEditor: 'number', editorRules: true, hidden: false }) },
  ] as ProcessedColumn[]

  it('reverts on failure when mode is revert', async () => {
    const validateFn = vi.fn().mockResolvedValue(false)
    const edit = createCellEdit({
      editConfig: { invalidEditValueMode: 'revert' },
      validateFn,
      columns: colsWithRules,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Invalid'
    await edit.commitEditing()
    expect(edit.isEditing.value).toBe(false)
    expect(edit.editingCell.value).toBeNull()
  })

  it('blocks editor close when mode is block', async () => {
    const validateFn = vi.fn().mockResolvedValue(false)
    const edit = createCellEdit({
      editConfig: { invalidEditValueMode: 'block' },
      validateFn,
      columns: colsWithRules,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Invalid'
    await edit.commitEditing()
    expect(edit.validationBlocked.value).toBe(true)
    expect(edit.isEditing.value).toBe(true)
  })

  it('allows close but notifies when mode is notify', async () => {
    const validateFn = vi.fn().mockResolvedValue(false)
    const edit = createCellEdit({
      editConfig: { invalidEditValueMode: 'notify' },
      validateFn,
      columns: colsWithRules,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Invalid'
    await edit.commitEditing()
    expect(edit.validationBlocked.value).toBe(false)
  })
})

describe('useCellEdit - validator integration', () => {
  const colsWithRules = [
    { ...mockColumn({ prop: 'name', editable: true, cellEditor: 'text', editorRules: true, hidden: false }) },
  ] as ProcessedColumn[]

  it('calls validateFn before committing', async () => {
    const validateFn = vi.fn().mockResolvedValue(true)
    const edit = createCellEdit({
      editConfig: { editType: 'single' as any },
      validateFn,
      columns: colsWithRules,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'ValidName'
    await edit.commitEditing()
    expect(validateFn).toHaveBeenCalled()
  })

  it('aborts commit when validateFn returns false', async () => {
    const validateFn = vi.fn().mockResolvedValue(false)
    const edit = createCellEdit({
      editConfig: { editType: 'single' as any, invalidEditValueMode: 'revert' },
      validateFn,
      columns: colsWithRules,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Invalid'
    await edit.commitEditing()
    expect(edit.isEditing.value).toBe(false)
  })
})

describe('useCellEdit - validator integration (phase2)', () => {
  it('calls validateFn before committing', async () => {
    const validateFn = vi.fn().mockResolvedValue(true)
    const edit = createCellEdit({
      editConfig: { editType: 'single' as any },
      validateFn,
      columns: [
        { ...mockColumn({ prop: 'name', editable: true, cellEditor: 'text', editorRules: true, hidden: false }) },
      ] as ProcessedColumn[],
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'ValidName'
    await edit.commitEditing()
    expect(validateFn).toHaveBeenCalled()
  })

  it('aborts commit when validateFn returns false', async () => {
    const validateFn = vi.fn().mockResolvedValue(false)
    const edit = createCellEdit({
      editConfig: { editType: 'single' as any, invalidEditValueMode: 'revert' },
      validateFn,
      columns: [
        { ...mockColumn({ prop: 'name', editable: true, cellEditor: 'text', editorRules: true, hidden: false }) },
      ] as ProcessedColumn[],
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Invalid'
    await edit.commitEditing()
    expect(edit.isEditing.value).toBe(false)
  })
})
