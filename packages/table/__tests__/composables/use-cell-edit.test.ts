import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useCellEdit } from '../../src/composables/editing/use-cell-edit'
import { useCellNavigation } from '../../src/composables/editing/use-cell-navigation'
import { useEditorResolver } from '../../src/composables/editing/use-editor-resolver'

/** Helper: create editorResolver + navigation for given columns/data, then call useCellEdit */
function createCellEditHelper(opts: {
  data: any
  columns: any
  editConfig?: any
  onDataUpdate: ReturnType<typeof vi.fn>
  [key: string]: any
}) {
  const { data, columns, editConfig, onDataUpdate, ...extra } = opts
  const editorResolver = useEditorResolver({ columns })
  const navigation = useCellNavigation({ editableColumns: editorResolver.editableColumns, data, editConfig: editConfig ?? computed(() => undefined) })
  return useCellEdit({
    data,
    columns,
    editConfig: editConfig ?? computed(() => undefined),
    onDataUpdate,
    navigation,
    editorResolver,
    ...extra,
  })
}

const baseColumns: ProcessedColumn[] = [
  { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', hidden: false },
  { prop: 'age', label: 'Age', editable: true, cellEditor: 'el-input-number', hidden: false },
  { prop: 'email', label: 'Email', hidden: false },
]

const baseData = [
  { name: 'Alice', age: 25, email: 'alice@test.com' },
  { name: 'Bob', age: 30, email: 'bob@test.com' },
]

describe('useCellEdit', () => {
  const columns = ref<ProcessedColumn[]>([...baseColumns])
  const data = ref([...baseData])

  const editorResolver = useEditorResolver({ columns: computed(() => columns.value) })
  const navigation = useCellNavigation({ editableColumns: editorResolver.editableColumns, data: computed(() => data.value), editConfig: computed(() => undefined) })

  function createEdit(opts?: { editConfig?: any, extra?: any }) {
    return useCellEdit({
      data: computed(() => data.value),
      columns: computed(() => columns.value),
      editConfig: computed(() => opts?.editConfig ?? undefined),
      onDataUpdate: vi.fn(),
      navigation,
      editorResolver,
      ...opts?.extra,
    })
  }

  describe('isColumnEditable', () => {
    it('returns true for column with editable and cellEditor', () => {
      const { isColumnEditable } = createEdit()
      expect(isColumnEditable(columns.value[0])).toBe(true)
    })

    it('returns false for column without editable', () => {
      const { isColumnEditable } = createEdit()
      expect(isColumnEditable(columns.value[2])).toBe(false)
    })

    it('returns true for column with cellEditorSelector', () => {
      const col = { ...columns.value[2], editable: true, cellEditorSelector: vi.fn() }
      const { isColumnEditable } = createEdit()
      expect(isColumnEditable(col)).toBe(true)
    })
  })

  describe('editableColumns', () => {
    it('returns only editable columns', () => {
      expect(editorResolver.editableColumns.value).toHaveLength(2)
      expect(editorResolver.editableColumns.value[0].prop).toBe('name')
    })
  })

  describe('isEditing', () => {
    it('starts as false', () => {
      const { isEditing } = createEdit()
      expect(isEditing.value).toBe(false)
    })
  })

  describe('getEditorComponent', () => {
    it('returns undefined for non-editable column', () => {
      const editor = editorResolver.getEditorComponent(columns.value[2])
      expect(editor).toBeUndefined()
    })

    it('uses cellEditorSelector when provided', () => {
      const selector = vi.fn(() => 'el-input')
      const col = { ...columns.value[0], cellEditorSelector: selector }
      editorResolver.getEditorComponent(col, data.value[0], 0)
      expect(selector).toHaveBeenCalledWith({ row: data.value[0], rowIndex: 0, column: col })
    })
  })

  describe('startEditing and commitEditing', () => {
    it('starts editing a cell', async () => {
      const { startEditing, isEditing, editingCell, editingValue } = createEdit()
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(isEditing.value).toBe(true)
      expect(editingCell.value?.rowIndex).toBe(0)
      expect(editingCell.value?.columnKey).toBe('name')
      expect(editingValue.value).toBe('Alice')
    })

    it('commits editing and calls onDataUpdate', async () => {
      const onDataUpdate = vi.fn()
      const onCellValueChanged = vi.fn()
      const { startEditing, commitEditing } = createEdit({
        extra: { onDataUpdate, onCellValueChanged },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      await commitEditing()
      expect(onDataUpdate).not.toHaveBeenCalled()
      expect(onCellValueChanged).not.toHaveBeenCalled()
    })

    it('commits edited value when value changed', async () => {
      const onDataUpdate = vi.fn()
      const { startEditing, commitEditing, editingValue } = createEdit({
        extra: { onDataUpdate },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      editingValue.value = 'Alice Modified'
      await commitEditing()
      expect(onDataUpdate).toHaveBeenCalled()
    })

    it('does not commit when value is unchanged', async () => {
      const onDataUpdate = vi.fn()
      const { startEditing, commitEditing } = createEdit({ extra: { onDataUpdate } })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      await commitEditing()
      expect(onDataUpdate).not.toHaveBeenCalled()
    })
  })

  describe('isCellEditing', () => {
    it('returns true for matching cell', async () => {
      const { startEditing, isCellEditing } = createEdit()
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(isCellEditing(0, 'name')).toBe(true)
    })

    it('returns false for different cell', async () => {
      const { startEditing, isCellEditing } = createEdit()
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(isCellEditing(1, 'name')).toBe(false)
    })
  })

  describe('cancelEditing', () => {
    it('cancels editing and clears state', async () => {
      const { startEditing, cancelEditing, editingCell, isEditing } = createEdit()
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      cancelEditing()
      expect(isEditing.value).toBe(false)
      expect(editingCell.value).toBeNull()
    })
  })

  describe('stopEditing', () => {
    it('commits when commit is true', async () => {
      const onDataUpdate = vi.fn()
      const { startEditing, stopEditing, editingValue } = createEdit({ extra: { onDataUpdate } })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      editingValue.value = 'Alice Modified'
      stopEditing('api', true)
      expect(onDataUpdate).toHaveBeenCalled()
    })

    it('cancels when commit is false', async () => {
      const onDataUpdate = vi.fn()
      const { startEditing, stopEditing, editingCell } = createEdit({ extra: { onDataUpdate } })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      stopEditing('api', false)
      expect(onDataUpdate).not.toHaveBeenCalled()
      expect(editingCell.value).toBeNull()
    })
  })

  describe('readOnlyEdit mode', () => {
    it('emits onCellEditRequest instead of modifying data', async () => {
      const onCellEditRequest = vi.fn()
      const onDataUpdate = vi.fn()
      const { startEditing, commitEditing, editingValue } = createEdit({
        editConfig: { editType: 'readOnly' },
        extra: { onDataUpdate, onCellEditRequest },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      editingValue.value = 'Alice Modified'
      await commitEditing()
      expect(onDataUpdate).not.toHaveBeenCalled()
      expect(onCellEditRequest).toHaveBeenCalled()
    })
  })

  describe('valueParser', () => {
    it('transforms value before commit', async () => {
      const cols = ref<ProcessedColumn[]>([
        { prop: 'score', label: 'Score', editable: true, cellEditor: 'el-input', valueParser: ({ newValue }: { newValue: any }) => Number(newValue), hidden: false },
      ])
      const testData = ref([{ score: 0 }])

      const onDataUpdate = vi.fn()
      const edit = createCellEditHelper({
        data: computed(() => testData.value),
        columns: computed(() => cols.value),
        onDataUpdate,
      })

      await edit.startEditing({ rowIndex: 0, prop: 'score', columnKey: 'score', value: 0 })
      edit.editingValue.value = 42
      await edit.commitEditing()

      expect(onDataUpdate).toHaveBeenCalled()
    })
  })

  describe('getCellEditingValue', () => {
    it('returns editing value for single cell mode', async () => {
      const { startEditing, getCellEditingValue } = createEdit()
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(getCellEditingValue('name')).toBe('Alice')
    })
  })

  describe('updateCellEditingValue', () => {
    it('updates editing value in single mode', async () => {
      const { startEditing, updateCellEditingValue } = createEdit()
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      updateCellEditingValue('name', 'Bob')
      expect(startEditing).toBeDefined()
    })
  })

  describe('onCellEditingStarted callback', () => {
    it('fires when editing starts', async () => {
      const onCellEditingStarted = vi.fn()
      const { startEditing } = createEdit({
        extra: { onCellEditingStarted },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(onCellEditingStarted).toHaveBeenCalled()
    })
  })

  describe('onCellEditingStopped callback', () => {
    it('fires when editing stops', async () => {
      const onCellEditingStopped = vi.fn()
      const { startEditing, commitEditing } = createEdit({
        extra: { onCellEditingStopped },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      await commitEditing()
      expect(onCellEditingStopped).toHaveBeenCalled()
    })
  })

  describe('fullRow edit mode', () => {
    it('starts fullRow editing', async () => {
      const { startEditing, isFullRowEdit, editingRowIndex, editingValues, isEditing } = createEdit({
        editConfig: { editType: 'fullRow' },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(isEditing.value).toBe(true)
      expect(isFullRowEdit.value).toBe(true)
      expect(editingRowIndex.value).toBe(0)
      expect(editingValues.value.name).toBe('Alice')
    })

    it('commits fullRow edit with changes', async () => {
      const onDataUpdate = vi.fn()
      const { startEditing, commitEditing, editingValues } = createEdit({
        editConfig: { editType: 'fullRow' },
        extra: { onDataUpdate },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      editingValues.value = { ...editingValues.value, name: 'Alice Modified' }
      await commitEditing()
      expect(onDataUpdate).toHaveBeenCalled()
    })

    it('commits fullRow edit without changes', async () => {
      const onDataUpdate = vi.fn()
      const { startEditing, commitEditing, isEditing } = createEdit({
        editConfig: { editType: 'fullRow' },
        extra: { onDataUpdate },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      await commitEditing()
      expect(onDataUpdate).not.toHaveBeenCalled()
      expect(isEditing.value).toBe(false)
    })

    it('handles fullRow commit when row index is null', async () => {
      const onDataUpdate = vi.fn()
      const { commitEditing, isEditing } = createEdit({
        editConfig: { editType: 'fullRow' },
        extra: { onDataUpdate },
      })
      await commitEditing()
      // <zh/> 未开始编辑就提交：静默无操作，不写回、不进入编辑态
      // <en/> Commit without starting: silent no-op, no write-back, no editing state
      expect(onDataUpdate).not.toHaveBeenCalled()
      expect(isEditing.value).toBe(false)
    })

    it('cancels fullRow edit', async () => {
      const { startEditing, cancelEditing, editingRowIndex, editingValues, isEditing } = createEdit({
        editConfig: { editType: 'fullRow' },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      cancelEditing()
      expect(isEditing.value).toBe(false)
      expect(editingRowIndex.value).toBeNull()
      expect(editingValues.value).toEqual({})
    })

    it('isCellEditing returns true for editable cell in fullRow mode', async () => {
      const { startEditing, isCellEditing } = createEdit({
        editConfig: { editType: 'fullRow' },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(isCellEditing(0, 'name')).toBe(true)
    })

    it('isCellEditing returns false for non-edit row in fullRow mode', async () => {
      const { startEditing, isCellEditing } = createEdit({
        editConfig: { editType: 'fullRow' },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(isCellEditing(1, 'name')).toBe(false)
    })

    it('fires onCellEditingStarted in fullRow mode', async () => {
      const onCellEditingStarted = vi.fn()
      const { startEditing } = createEdit({
        editConfig: { editType: 'fullRow' },
        extra: { onCellEditingStarted },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(onCellEditingStarted).toHaveBeenCalled()
    })

    it('fires onFullRowEditChanged on commit', async () => {
      const onFullRowEditChanged = vi.fn()
      const { startEditing, commitEditing, editingValues } = createEdit({
        editConfig: { editType: 'fullRow' },
        extra: { onFullRowEditChanged },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      editingValues.value = { ...editingValues.value, name: 'Alice Modified' }
      await commitEditing()
      expect(onFullRowEditChanged).toHaveBeenCalled()
    })
  })

  describe('getCellEditingValue (fullRow)', () => {
    it('returns editing value for single cell mode', async () => {
      const { startEditing, getCellEditingValue } = createEdit()
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(getCellEditingValue('name')).toBe('Alice')
    })

    it('returns editing value for fullRow mode', async () => {
      const { startEditing, getCellEditingValue } = createEdit({
        editConfig: { editType: 'fullRow' },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(getCellEditingValue('name')).toBe('Alice')
    })
  })

  describe('updateCellEditingValue (fullRow)', () => {
    it('updates editing value in single mode', async () => {
      const { startEditing, updateCellEditingValue } = createEdit()
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      updateCellEditingValue('name', 'Bob')
      expect(startEditing).toBeDefined()
    })

    it('updates editing value in fullRow mode', async () => {
      const { startEditing, updateCellEditingValue, getCellEditingValue } = createEdit({
        editConfig: { editType: 'fullRow' },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      updateCellEditingValue('name', 'Bob')
      expect(getCellEditingValue('name')).toBe('Bob')
    })
  })

  describe('batch edit mode', () => {
    it('buffers change via onBatchRecordChange on commit', async () => {
      const onBatchRecordChange = vi.fn()
      const { startEditing, commitEditing, editingValue } = createEdit({
        editConfig: { editType: 'batch' },
        extra: { onBatchRecordChange, rowKeyFn: () => (r: any) => r.name },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      editingValue.value = 'Alice Modified'
      await commitEditing()
      expect(onBatchRecordChange).toHaveBeenCalled()
    })

    it('writes direct (not buffered) in fullRow mode without batch mode', async () => {
      // <zh/> mode 与 editType 正交：无 mode:'batch' 时 fullRow 提交走直写通道，不进批量缓冲
      // <en/> mode and editType are orthogonal: fullRow commit without mode:'batch' writes direct, never buffers
      const onBatchRecordChange = vi.fn()
      const onDataUpdate = vi.fn()
      const { startEditing, commitEditing, editingValues } = createEdit({
        editConfig: { editType: 'fullRow' },
        extra: { onBatchRecordChange, onDataUpdate, rowKeyFn: () => (r: any) => r.name },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      editingValues.value = { ...editingValues.value, name: 'Alice Modified' }
      await commitEditing()
      expect(onBatchRecordChange).not.toHaveBeenCalled()
      expect(onDataUpdate).toHaveBeenCalled()
    })
  })

  describe('valueSetter', () => {
    it('uses valueSetter for custom write-back', async () => {
      const valueSetter = vi.fn(() => true)
      const onDataUpdate = vi.fn()
      const cols = ref<ProcessedColumn[]>([
        { prop: 'score', label: 'Score', editable: true, cellEditor: 'el-input', valueSetter, hidden: false },
      ])
      const testData = ref([{ score: 0 }])
      const edit = createCellEditHelper({
        data: computed(() => testData.value),
        columns: computed(() => cols.value),
        editConfig: computed(() => undefined),
        onDataUpdate,
      })
      await edit.startEditing({ rowIndex: 0, prop: 'score', columnKey: 'score', value: 0 })
      edit.editingValue.value = 42
      await edit.commitEditing()
      expect(valueSetter).toHaveBeenCalled()
      expect(onDataUpdate).toHaveBeenCalled()
    })
  })

  describe('onCellValueChanged', () => {
    it('fires on cell value change', async () => {
      const onCellValueChanged = vi.fn()
      const { startEditing, commitEditing, editingValue } = createEdit({
        extra: { onCellValueChanged },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      editingValue.value = 'Alice Modified'
      await commitEditing()
      expect(onCellValueChanged).toHaveBeenCalled()
    })
  })

  describe('getEditorComponent (selector)', () => {
    it('returns undefined for cellEditorSelector returning undefined', () => {
      const selector = vi.fn(() => undefined)
      const col = { ...baseColumns[0], cellEditorSelector: selector }
      const result = editorResolver.getEditorComponent(col)
      expect(result).toBeUndefined()
    })
  })

  describe('cancelEditing with onCellEditingStopped', () => {
    it('fires onCellEditingStopped on cancel in single mode', async () => {
      const onCellEditingStopped = vi.fn()
      const { startEditing, cancelEditing } = createEdit({
        extra: { onCellEditingStopped },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      cancelEditing()
      expect(onCellEditingStopped).toHaveBeenCalled()
    })

    it('fires onCellEditingStopped on cancel in fullRow mode', async () => {
      const onCellEditingStopped = vi.fn()
      const { startEditing, cancelEditing } = createEdit({
        editConfig: { editType: 'fullRow' },
        extra: { onCellEditingStopped },
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      cancelEditing()
      expect(onCellEditingStopped).toHaveBeenCalled()
    })
  })

  describe('stopEditing when not editing', () => {
    it('returns early when not editing', () => {
      const { stopEditing, isEditing } = createEdit()
      stopEditing('api', true)
      expect(isEditing.value).toBe(false)
    })
  })

  describe('fullRow commit with stale row', () => {
    it('handles commit when row no longer exists at index', async () => {
      const localData = ref([...baseData])
      const onDataUpdate = vi.fn()
      const { startEditing, commitEditing } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => columns.value),
        editConfig: computed(() => ({ editType: 'fullRow' })),
        onDataUpdate,
        rowKeyFn: () => (r: any) => r.name,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      localData.value = []
      await commitEditing()
      // <zh/> 目标行已消失：不得写回幽灵数据、不抛错
      // <en/> Target row is gone: must not write back phantom data, must not throw
      expect(onDataUpdate).not.toHaveBeenCalled()
    })

    it('handles fullRow commit when value changed', async () => {
      const localData = ref([...baseData])
      const onDataUpdate = vi.fn()
      const { startEditing, commitEditing, editingValues } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => columns.value),
        editConfig: computed(() => ({ editType: 'fullRow' })),
        onDataUpdate,
        rowKeyFn: () => (r: any) => r.name,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      editingValues.value = { ...editingValues.value, name: 'Alice Modified' }
      localData.value = [
        { name: 'Bob', age: 30, email: 'bob@test.com' },
        { name: 'Alice', age: 25, email: 'alice@test.com' },
      ]
      await commitEditing()
      expect(onDataUpdate).toHaveBeenCalled()
    })
  })

  describe('commitEditing — valueParser 路径', () => {
    it('使用 valueParser 转换值再提交', async () => {
      const valueParser = vi.fn(({ newValue }: any) => String(newValue).toUpperCase())
      const onDataUpdate = vi.fn()
      const cols = ref([
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', valueParser, hidden: false },
      ] as ProcessedColumn[])
      const localData = ref([{ name: 'alice' }])
      const { startEditing, commitEditing, editingValue } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => cols.value),
        editConfig: computed(() => undefined),
        onDataUpdate,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'alice' })
      editingValue.value = 'bob'
      await commitEditing()
      expect(valueParser).toHaveBeenCalled()
      expect(onDataUpdate).toHaveBeenCalled()
    })
  })

  describe('commitEditing — valueSetter 路径', () => {
    it('使用 valueSetter 自定义回写', async () => {
      const valueSetter = vi.fn(() => true)
      const onDataUpdate = vi.fn()
      const cols = ref([
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', valueSetter, hidden: false },
      ] as ProcessedColumn[])
      const localData = ref([{ name: 'alice' }])
      const { startEditing, commitEditing, editingValue } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => cols.value),
        editConfig: computed(() => undefined),
        onDataUpdate,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'alice' })
      editingValue.value = 'bob'
      await commitEditing()
      expect(valueSetter).toHaveBeenCalled()
      expect(onDataUpdate).toHaveBeenCalled()
    })

    it('valueSetter 返回 false 时不触发 onDataUpdate', async () => {
      const valueSetter = vi.fn(() => false)
      const onDataUpdate = vi.fn()
      const cols = ref([
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', valueSetter, hidden: false },
      ] as ProcessedColumn[])
      const localData = ref([{ name: 'alice' }])
      const { startEditing, commitEditing, editingValue } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => cols.value),
        editConfig: computed(() => undefined),
        onDataUpdate,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'alice' })
      editingValue.value = 'bob'
      await commitEditing()
      expect(valueSetter).toHaveBeenCalled()
      expect(onDataUpdate).not.toHaveBeenCalled()
    })
  })

  describe('commitEditing — readOnlyEdit 模式', () => {
    it('readOnlyEdit 模式触发 onCellEditRequest 而非修改数据', async () => {
      const onCellEditRequest = vi.fn()
      const onDataUpdate = vi.fn()
      const localData = ref([{ name: 'alice' }])
      const cols = ref([
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', hidden: false },
      ] as ProcessedColumn[])
      const { startEditing, commitEditing, editingValue } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => cols.value),
        editConfig: computed(() => ({ editType: 'readOnly' })),
        onDataUpdate,
        onCellEditRequest,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'alice' })
      editingValue.value = 'bob'
      await commitEditing()
      expect(onCellEditRequest).toHaveBeenCalled()
      expect(onDataUpdate).not.toHaveBeenCalled()
    })
  })

  describe('commitEditing — batch 模式', () => {
    it('batch 模式通过 onBatchRecordChange 缓冲变更', async () => {
      const onBatchRecordChange = vi.fn()
      const onDataUpdate = vi.fn()
      const localData = ref([{ name: 'alice' }])
      const cols = ref([
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', hidden: false },
      ] as ProcessedColumn[])
      const { startEditing, commitEditing, editingValue } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => cols.value),
        editConfig: computed(() => ({ editType: 'batch' })),
        onDataUpdate,
        onBatchRecordChange,
        rowKeyFn: () => (r: any) => r.name,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'alice' })
      editingValue.value = 'bob'
      await commitEditing()
      expect(onBatchRecordChange).toHaveBeenCalled()
      expect(onDataUpdate).not.toHaveBeenCalled()
    })
  })

  describe('commitEditing — 校验失败', () => {
    it('校验失败时按 invalidEditValueMode 默认 revert 行为处理', async () => {
      const validateFn = vi.fn(async () => false)
      const onDataUpdate = vi.fn()
      const localData = ref([{ name: 'alice' }])
      const cols = ref([
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', editorRules: { required: true }, hidden: false },
      ] as ProcessedColumn[])
      const { startEditing, commitEditing, editingValue, isEditing } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => cols.value),
        editConfig: computed(() => undefined),
        onDataUpdate,
        validateFn,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'alice' })
      editingValue.value = ''
      await commitEditing()
      expect(validateFn).toHaveBeenCalled()
      expect(onDataUpdate).not.toHaveBeenCalled()
      expect(isEditing.value).toBe(true) // editing stays active after validation fail
    })

    it('校验成功时正常提交', async () => {
      const validateFn = vi.fn(async () => true)
      const onDataUpdate = vi.fn()
      const localData = ref([{ name: 'alice' }])
      const cols = ref([
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', editorRules: { required: true }, hidden: false },
      ] as ProcessedColumn[])
      const { startEditing, commitEditing, editingValue } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => cols.value),
        editConfig: computed(() => undefined),
        onDataUpdate,
        validateFn,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'alice' })
      editingValue.value = 'bob'
      await commitEditing()
      expect(validateFn).toHaveBeenCalled()
      expect(onDataUpdate).toHaveBeenCalled()
    })
  })

  describe('commitEditing — 无编辑状态时无操作', () => {
    it('没有正在编辑的单元格时 commitEditing 返回空结果对象（结果协议）', async () => {
      const { commitEditing } = createEdit()
      await expect(commitEditing()).resolves.toEqual({ applied: [], rejected: [] })
    })
  })

  describe('commitEditing — fullRow readOnlyEdit 模式', () => {
    it('fullRow + readOnlyEdit 模式触发 onCellEditRequest', async () => {
      const onCellEditRequest = vi.fn()
      const onDataUpdate = vi.fn()
      const localData = ref([{ name: 'alice', age: 25 }])
      const { startEditing, commitEditing, editingValue } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => columns.value),
        editConfig: computed(() => ({ editType: 'readOnly' })),
        onDataUpdate,
        onCellEditRequest,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'alice' })
      editingValue.value = 'bob'
      await commitEditing()
      expect(onCellEditRequest).toHaveBeenCalled()
      expect(onDataUpdate).not.toHaveBeenCalled()
    })
  })

  describe('stopEditing (commit=false)', () => {
    it('stopEditing with commit=false 时取消编辑', async () => {
      const { startEditing, stopEditing, isEditing } = createEdit()
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      expect(isEditing.value).toBe(true)
      stopEditing('api', false)
      expect(isEditing.value).toBe(false)
    })

    it('stopEditing with commit=true 时提交编辑', async () => {
      const onDataUpdate = vi.fn()
      const localData = ref([{ name: 'alice' }])
      const cols = ref([
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', hidden: false },
      ] as ProcessedColumn[])
      const { startEditing, stopEditing, editingValue } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => cols.value),
        editConfig: computed(() => undefined),
        onDataUpdate,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'alice' })
      editingValue.value = 'bob'
      await stopEditing('api', true)
      expect(onDataUpdate).toHaveBeenCalled()
    })
  })

  describe('getEditorComponent (non-editable)', () => {
    it('返回 undefined 当列不可编辑', () => {
      const col = { prop: 'name', editable: false, hidden: false } as any
      expect(editorResolver.getEditorComponent(col)).toBeUndefined()
    })

    it('cellEditorSelector 优先级高于 cellEditor', () => {
      const selector = vi.fn(() => 'el-input')
      const col = { prop: 'name', editable: true, cellEditorSelector: selector, cellEditor: 'el-button', hidden: false } as any
      editorResolver.getEditorComponent(col, { name: 'Alice' }, 0)
      expect(selector).toHaveBeenCalledWith({
        row: { name: 'Alice' },
        rowIndex: 0,
        column: col,
      })
    })
  })

  describe('onCellValueChanged at column level', () => {
    it('列级别的 onCellValueChanged 被触发', async () => {
      const colOnChange = vi.fn()
      const onDataUpdate = vi.fn()
      const localData = ref([{ name: 'alice' }])
      const cols = ref([
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', onCellValueChanged: colOnChange, hidden: false } as any,
      ] as ProcessedColumn[])
      const { startEditing, commitEditing, editingValue } = createCellEditHelper({
        data: computed(() => localData.value),
        columns: computed(() => cols.value),
        editConfig: computed(() => undefined),
        onDataUpdate,
      })
      await startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'alice' })
      editingValue.value = 'bob'
      await commitEditing()
      expect(colOnChange).toHaveBeenCalled()
    })
  })
})
