import type { UseInterceptorReturn } from '../../src/composables/editing/use-interceptor'
import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useCellEdit } from '../../src/composables/editing/use-cell-edit'
import { useCellNavigation } from '../../src/composables/editing/use-cell-navigation'
import { useEditorResolver } from '../../src/composables/editing/use-editor-resolver'

/**
 * Helper: create editorResolver + navigation for given columns/data, then call useCellEdit
 * 同时返回 editorResolver 和 navigation，以便测试直接调用 getEditorSelectorParams / findFirstEditableCell 等
 */
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
  const edit = useCellEdit({
    data,
    columns,
    editConfig: editConfig ?? computed(() => undefined),
    onDataUpdate,
    navigation,
    editorResolver,
    ...extra,
  })
  return Object.assign(edit, { editorResolver, navigation })
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

function createInterceptor(handlers: Partial<Record<string, (p: any) => boolean | void>> = {}): UseInterceptorReturn {
  return {
    trigger: vi.fn((event: string, params: any) => {
      const handler = handlers[event]
      return handler ? (handler(params) === true) : false
    }),
  } as any
}

describe('useCellEdit phase4 — dirty cells', () => {
  it('isCellDirty returns false when showStatus is not enabled', () => {
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
      rowKeyFn: () => (r: any) => r.name,
    })
    expect(edit.isCellDirty(0, 'name')).toBe(false)
  })

  it('isCellDirty returns false when rowKey is not configured', () => {
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ showStatus: true })),
      onDataUpdate: vi.fn(),
    })
    expect(edit.isCellDirty(0, 'name')).toBe(false)
  })

  it('isCellDirty tracks dirty state during and after editing', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ showStatus: true })),
      onDataUpdate,
      rowKeyFn: () => (r: any) => r.name,
    })

    // Start editing and record original value
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.isCellDirty(0, 'name')).toBe(true)

    edit.editingValue.value = 'Alice Modified'
    await edit.commitEditing()

    // After commit, dirty cell should be cleared
    expect(edit.isCellDirty(0, 'name')).toBe(false)
  })

  it('isCellDirty returns false for non-existent row', () => {
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ showStatus: true })),
      onDataUpdate: vi.fn(),
      rowKeyFn: () => (r: any) => r.name,
    })
    expect(edit.isCellDirty(99, 'name')).toBe(false)
  })

  it('isCellDirty returns false when column has no prop', async () => {
    const cols: ProcessedColumn[] = [
      { key: 'noProp', label: 'No Prop', editable: true, cellEditor: 'el-input', hidden: false } as any,
    ]
    const edit = createCellEditHelper({
      data: computed(() => [{ name: 'Alice' }]),
      columns: computed(() => cols),
      editConfig: computed(() => ({ showStatus: true })),
      onDataUpdate: vi.fn(),
      rowKeyFn: () => (r: any) => r.name,
    })
    // Start editing to record original value
    await edit.startEditing({ rowIndex: 0, prop: '', columnKey: 'noProp', value: 'test' })
    // isCellDirty should return false for column without prop
    expect(edit.isCellDirty(0, 'noProp')).toBe(false)
  })

  it('hasUnsavedChanges returns true when editing', async () => {
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
      rowKeyFn: () => (r: any) => r.name,
    })
    expect(edit.hasUnsavedChanges()).toBe(false)
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.hasUnsavedChanges()).toBe(true)
  })

  it('dirtyCells cleanup when data rows are removed', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ showStatus: true })),
      onDataUpdate,
      rowKeyFn: () => (r: any) => r.name,
    })

    // Start editing to record original value
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Changed'
    await edit.commitEditing()

    // Now remove the row - dirty cells should be cleaned up
    localData.value = [baseData[1]]
    await nextTick()

    // isCellDirty should return false for removed row
    expect(edit.isCellDirty(0, 'name')).toBe(false)
  })

  it('dirtyCells cleanup when rowKey is not configured', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ showStatus: true })),
      onDataUpdate,
    })

    // Without rowKey, dirty tracking is disabled
    expect(edit.isCellDirty(0, 'name')).toBe(false)

    // Data change should not cause issues
    localData.value = [baseData[1]]
    await nextTick()
  })
})

describe('useCellEdit phase4 — batchCommitCells', () => {
  it('batchCommitCells commits multiple cells at once', async () => {
    const localData = ref([
      { name: 'Alice', age: 25, email: 'alice@test.com' },
      { name: 'Bob', age: 30, email: 'bob@test.com' },
    ])
    const onDataUpdate = vi.fn()
    const onCellValueChanged = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      onCellValueChanged,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.batchCommitCells([
      { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice2' },
      { rowIndex: 1, prop: 'age', columnKey: 'age', value: 31 },
    ])

    expect(onDataUpdate).toHaveBeenCalledTimes(1)
    expect(onCellValueChanged).toHaveBeenCalledTimes(2)
  })

  it('batchCommitCells skips unchanged values', async () => {
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.batchCommitCells([
      { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' },
    ])

    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('batchCommitCells handles empty cells array', async () => {
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
    })

    await edit.batchCommitCells([])
    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('batchCommitCells skips non-existent column', async () => {
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
    })

    await edit.batchCommitCells([
      { rowIndex: 0, prop: 'x', columnKey: 'nonexistent', value: 'test' },
    ])

    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('batchCommitCells skips non-existent row', async () => {
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
    })

    await edit.batchCommitCells([
      { rowIndex: 99, prop: 'name', columnKey: 'name', value: 'test' },
    ])

    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('batchCommitCells with interceptor blocking commit', async () => {
    const interceptor = createInterceptor({
      'edit.commit': () => true,
    })
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      interceptor,
    })

    await edit.batchCommitCells([
      { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice2' },
    ])

    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('batchCommitCells with validation failure', async () => {
    const validateFn = vi.fn(async () => false)
    const onDataUpdate = vi.fn()
    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', editorRules: { required: true }, hidden: false },
    ]
    const edit = createCellEditHelper({
      data: computed(() => [{ name: 'Alice' }]),
      columns: computed(() => cols),
      editConfig: computed(() => undefined),
      onDataUpdate,
      validateFn,
    })

    await edit.batchCommitCells([
      { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Bob' },
    ])

    // Validation failed, so the cell should be skipped
    expect(validateFn).toHaveBeenCalled()
  })

  it('batchCommitCells pushes undo entries', async () => {
    const pushUndo = vi.fn()
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      pushUndo,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.batchCommitCells([
      { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice2' },
    ])

    expect(pushUndo).toHaveBeenCalledWith(expect.objectContaining({
      type: 'cell',
      changes: [{ prop: 'name', oldValue: 'Alice', newValue: 'Alice2' }],
    }))
  })

  it('batchCommitCells fires column-level onCellValueChanged', async () => {
    const colOnChange = vi.fn()
    const onDataUpdate = vi.fn()
    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', onCellValueChanged: colOnChange, hidden: false } as any,
    ]
    const edit = createCellEditHelper({
      data: computed(() => [{ name: 'Alice' }]),
      columns: computed(() => cols),
      editConfig: computed(() => undefined),
      onDataUpdate,
    })

    await edit.batchCommitCells([
      { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Bob' },
    ])

    expect(colOnChange).toHaveBeenCalled()
  })
})

describe('useCellEdit phase4 — validateCurrentValue', () => {
  it('validateCurrentValue does nothing when not editing', async () => {
    const validateFn = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
      validateFn,
    })
    await edit.validateCurrentValue()
    expect(validateFn).not.toHaveBeenCalled()
  })

  it('validateCurrentValue does nothing without validateFn', async () => {
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    await edit.validateCurrentValue()
    // <zh/> 无校验函数：校验静默跳过，编辑态保持（不把用户踢出编辑）
    // <en/> No validator: validation silently skips, editing state holds (user is not kicked out)
    expect(edit.isEditing.value).toBe(true)
  })

  it('validateCurrentValue does nothing without editorRules', async () => {
    const validateFn = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
      validateFn,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    await edit.validateCurrentValue()
    // baseColumns[0] has no editorRules, so validateFn should not be called
    expect(validateFn).not.toHaveBeenCalled()
  })

  it('validateCurrentValue calls validateFn when editing with editorRules', async () => {
    const validateFn = vi.fn(async () => true)
    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', editorRules: { required: true }, hidden: false },
    ]
    const edit = createCellEditHelper({
      data: computed(() => [{ name: 'Alice' }]),
      columns: computed(() => cols),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
      validateFn,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    await edit.validateCurrentValue()
    expect(validateFn).toHaveBeenCalled()
  })
})

describe('useCellEdit phase4 — interceptor edit.start', () => {
  it('interceptor edit.start blocks editing', async () => {
    const interceptor = createInterceptor({
      'edit.start': () => true,
    })
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
      interceptor,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.isEditing.value).toBe(false)
  })

  it('interceptor edit.start returns false proceeds normally', async () => {
    const interceptor = createInterceptor({
      'edit.start': () => false,
    })
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      interceptor,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.isEditing.value).toBe(true)
  })
})

describe('useCellEdit phase4 — activeMethod', () => {
  it('activeMethod returning false prevents editing', async () => {
    const activeMethod = vi.fn(() => false)
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ activeMethod })),
      onDataUpdate: vi.fn(),
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.isEditing.value).toBe(false)
    expect(activeMethod).toHaveBeenCalled()
  })

  it('activeMethod returning true allows editing', async () => {
    const activeMethod = vi.fn(() => true)
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ activeMethod })),
      onDataUpdate: vi.fn(),
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.isEditing.value).toBe(true)
  })
})

describe('useCellEdit phase4 — validation blocked mode', () => {
  it('invalidEditValueMode block sets validationBlocked', async () => {
    const validateFn = vi.fn(async () => false)
    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', editorRules: { required: true }, hidden: false },
    ]
    const edit = createCellEditHelper({
      data: computed(() => [{ name: 'Alice' }]),
      columns: computed(() => cols),
      editConfig: computed(() => ({ invalidEditValueMode: 'block' })),
      onDataUpdate: vi.fn(),
      validateFn,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = ''
    await edit.commitEditing()
    expect(edit.validationBlocked.value).toBe(true)
    expect(edit.isEditing.value).toBe(true)
  })

  it('invalidEditValueMode revert cancels editing', async () => {
    const validateFn = vi.fn(async () => false)
    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', editorRules: { required: true }, hidden: false },
    ]
    const edit = createCellEditHelper({
      data: computed(() => [{ name: 'Alice' }]),
      columns: computed(() => cols),
      editConfig: computed(() => ({ invalidEditValueMode: 'revert' })),
      onDataUpdate: vi.fn(),
      validateFn,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = ''
    await edit.commitEditing()
    expect(edit.isEditing.value).toBe(false)
  })
})

describe('useCellEdit phase4 — onEditCancelled', () => {
  it('fires onEditCancelled when row is deleted during single cell editing', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const onEditCancelled = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      onEditCancelled,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    localData.value = [baseData[1]]
    await edit.commitEditing()
    expect(onEditCancelled).toHaveBeenCalledWith({ reason: 'row-deleted' })
  })

  it('fires onEditCancelled when row is deleted during fullRow editing', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const onEditCancelled = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate,
      onEditCancelled,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    localData.value = [baseData[1]]
    await edit.commitEditing()
    expect(onEditCancelled).toHaveBeenCalledWith({ reason: 'row-deleted' })
  })
})

describe('useCellEdit phase4 — stale index resolution', () => {
  it('resolves stale index when row moves in single cell edit', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Alice Modified'

    // Reorder data so Alice is now at index 1
    localData.value = [baseData[1], baseData[0]]
    await edit.commitEditing()

    // Should have updated the correct row
    expect(onDataUpdate).toHaveBeenCalled()
  })
})

describe('useCellEdit phase4 — pendingCommit', () => {
  it('startEditing waits for pendingCommit before starting new edit', async () => {
    const localData = ref([{ name: 'Alice', age: 25, email: 'a@t.com' }, { name: 'Bob', age: 30, email: 'b@t.com' }])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Alice2'

    // Trigger stopEditing (which starts a commit) then immediately start editing another cell
    edit.stopEditing('click', true)
    await edit.startEditing({ rowIndex: 1, prop: 'age', columnKey: 'age', value: 30 })

    // Both edits should have been applied
    expect(edit.isEditing.value).toBe(true)
  })

  it('starts a new cell directly (no stopEditing first) without self-deadlocking on its own pendingStart sentinel', async () => {
    const localData = ref([{ name: 'Alice', age: 25, email: 'a@t.com' }, { name: 'Bob', age: 30, email: 'b@t.com' }])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      // stopEditingWhenCellsLoseFocus: false（默认）——点击另一可编辑格不触发 stop
      editConfig: computed(() => undefined),
      onDataUpdate,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Alice2'

    // 直接 start 新格：prepareStartEditing 走 needsCommit → commitEditing 分支，
    // 此路径不得等待调用者自己的 pendingStart 哨兵（否则永久挂起）
    const outcome = await Promise.race([
      edit.startEditing({ rowIndex: 0, prop: 'age', columnKey: 'age', value: 25 }).then(() => 'settled' as const),
      new Promise<'timeout'>(resolve => setTimeout(resolve, 1000, 'timeout')),
    ])

    expect(outcome).toBe('settled')
    // 旧会话已提交
    expect(localData.value[0].name).toBe('Alice2')
    // 新会话已建立
    expect(edit.isEditing.value).toBe(true)
    expect(edit.editingCell.value?.columnKey).toBe('age')
  })
})

describe('useCellEdit phase4 — onEditingValueChange', () => {
  it('fires onEditingValueChange in fullRow mode', async () => {
    const onEditingValueChange = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate: vi.fn(),
      onEditingValueChange,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.updateCellEditingValue('name', 'Bob')
    // 6b8e 起载荷附带 rowData（供调用方清除校验错误定位行）——同步断言
    expect(onEditingValueChange).toHaveBeenCalledWith({ rowIndex: 0, columnKey: 'name', value: 'Bob', rowData: baseData[0] })
  })
})

describe('useCellEdit phase4 — pushUndo', () => {
  it('pushUndo called on single cell commit', async () => {
    const pushUndo = vi.fn()
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      pushUndo,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Bob'
    await edit.commitEditing()

    expect(pushUndo).toHaveBeenCalledWith(expect.objectContaining({
      type: 'cell',
      changes: [{ prop: 'name', oldValue: 'Alice', newValue: 'Bob' }],
    }))
  })

  it('pushUndo called on fullRow commit', async () => {
    const pushUndo = vi.fn()
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate,
      pushUndo,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValues.value = { ...edit.editingValues.value, name: 'Alice2' }
    await edit.commitEditing()

    expect(pushUndo).toHaveBeenCalledWith(expect.objectContaining({
      type: 'row',
    }))
  })
})

describe('useCellEdit phase4 — canStartEditing edge cases', () => {
  it('starting same cell twice is a no-op', async () => {
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    const cellBefore = edit.editingCell.value
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    // Should still be editing the same cell
    expect(edit.editingCell.value).toBe(cellBefore)
  })

  it('starting same row in fullRow mode is a no-op', async () => {
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate: vi.fn(),
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    const rowIndexBefore = edit.editingRowIndex.value
    await edit.startEditing({ rowIndex: 0, prop: 'age', columnKey: 'age', value: 25 })
    expect(edit.editingRowIndex.value).toBe(rowIndexBefore)
  })

  it('validationBlocked prevents starting new edit', async () => {
    const validateFn = vi.fn(async () => false)
    const cols: ProcessedColumn[] = [
      { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', editorRules: { required: true }, hidden: false },
    ]
    const edit = createCellEditHelper({
      data: computed(() => [{ name: 'Alice' }, { name: 'Bob' }]),
      columns: computed(() => cols),
      editConfig: computed(() => ({ invalidEditValueMode: 'block' })),
      onDataUpdate: vi.fn(),
      validateFn,
    })

    // Start editing and fail validation
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = ''
    await edit.commitEditing()
    expect(edit.validationBlocked.value).toBe(true)

    // Should not be able to start new edit while blocked
    await edit.startEditing({ rowIndex: 1, prop: 'name', columnKey: 'name', value: 'Bob' })
    expect(edit.isEditing.value).toBe(true)
    expect(edit.editingCell.value?.rowIndex).toBe(0) // Still on original cell
  })
})

describe('useCellEdit phase4 — findFirst/LastEditableCell', () => {
  it('findFirstEditableCell returns first editable cell', async () => {
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
    })
    const first = edit.navigation.findFirstEditableCell(0)
    expect(first).not.toBeNull()
    expect(first?.columnKey).toBe('name')
  })

  it('findLastEditableCell returns last editable cell', async () => {
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
    })
    const last = edit.navigation.findLastEditableCell(0)
    expect(last).not.toBeNull()
    expect(last?.columnKey).toBe('age')
  })
})

describe('useCellEdit phase4 — fullRow commit with interceptor', () => {
  it('fullRow commit interceptor blocks and cancels', async () => {
    const interceptor = createInterceptor({
      'edit.commit': () => true,
    })
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate,
      interceptor,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValues.value = { ...edit.editingValues.value, name: 'Alice2' }
    await edit.commitEditing()

    expect(edit.isEditing.value).toBe(false)
    expect(onDataUpdate).not.toHaveBeenCalled()
  })
})

describe('useCellEdit phase4 — fullRow with onCellValueChanged', () => {
  it('fullRow commit fires onCellValueChanged for each changed cell', async () => {
    const onCellValueChanged = vi.fn()
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate,
      onCellValueChanged,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValues.value = {
      ...edit.editingValues.value,
      name: 'Alice2',
      age: 26,
    }
    await edit.commitEditing()

    expect(onCellValueChanged).toHaveBeenCalledTimes(2)
  })

  it('fullRow commit fires onFullRowEditChanged', async () => {
    const onFullRowEditChanged = vi.fn()
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate,
      onFullRowEditChanged,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValues.value = { ...edit.editingValues.value, name: 'Alice2' }
    await edit.commitEditing()

    expect(onFullRowEditChanged).toHaveBeenCalledWith(expect.objectContaining({
      changes: expect.arrayContaining([expect.objectContaining({ prop: 'name' })]),
    }))
  })
})

describe('useCellEdit phase4 — cancelEditing with onCellEditingStopped (fullRow)', () => {
  it('cancelEditing in fullRow mode fires onCellEditingStopped for each editing cell', async () => {
    const onCellEditingStopped = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate: vi.fn(),
      onCellEditingStopped,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.cancelEditing('esc')

    expect(onCellEditingStopped).toHaveBeenCalled()
  })
})

describe('useCellEdit phase4 — isShallowEqual edge cases', () => {
  it('handles array values in commit', async () => {
    const cols: ProcessedColumn[] = [
      { prop: 'tags', label: 'Tags', editable: true, cellEditor: 'el-input', hidden: false } as any,
    ]
    const localData = ref([{ tags: ['a', 'b'] }])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => cols),
      editConfig: computed(() => undefined),
      onDataUpdate,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'tags', columnKey: 'tags', value: ['a', 'b'] })
    edit.editingValue.value = ['a', 'c']
    await edit.commitEditing()

    expect(onDataUpdate).toHaveBeenCalled()
  })

  it('handles object values in commit', async () => {
    const cols: ProcessedColumn[] = [
      { prop: 'meta', label: 'Meta', editable: true, cellEditor: 'el-input', hidden: false } as any,
    ]
    const localData = ref([{ meta: { a: 1 } }])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => cols),
      editConfig: computed(() => undefined),
      onDataUpdate,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'meta', columnKey: 'meta', value: { a: 1 } })
    edit.editingValue.value = { a: 2 }
    await edit.commitEditing()

    expect(onDataUpdate).toHaveBeenCalled()
  })

  it('handles null values in commit', async () => {
    const cols: ProcessedColumn[] = [
      { prop: 'val', label: 'Val', editable: true, cellEditor: 'el-input', hidden: false } as any,
    ]
    const localData = ref([{ val: null }])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => cols),
      editConfig: computed(() => undefined),
      onDataUpdate,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'val', columnKey: 'val', value: null })
    edit.editingValue.value = 'test'
    await edit.commitEditing()

    expect(onDataUpdate).toHaveBeenCalled()
  })
})

describe('useCellEdit phase4 — fullRow stale index', () => {
  it('fullRow commit resolves stale index', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValues.value = { ...edit.editingValues.value, name: 'Alice2' }

    localData.value = [baseData[1], baseData[0]]
    await edit.commitEditing()

    expect(onDataUpdate).toHaveBeenCalled()
  })

  it('fullRow commit handles row not found at stale index', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const onEditCancelled = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate,
      onEditCancelled,
      rowKeyFn: () => (r: any) => r.name,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    localData.value = []
    await edit.commitEditing()

    expect(onEditCancelled).toHaveBeenCalledWith({ reason: 'row-deleted' })
  })
})

describe('useCellEdit phase4 — getEditorSelectorParams', () => {
  it('returns undefined for non-editable column', () => {
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
    })
    const result = edit.editorResolver.getEditorSelectorParams(baseColumns[2])
    expect(result).toBeUndefined()
  })

  it('returns params for editable column with selector', () => {
    const selectorParams = { options: [{ label: 'A', value: 'a' }] }
    const selector = vi.fn(() => ({ component: 'el-select', params: selectorParams }))
    const col = { ...baseColumns[0], cellEditorSelector: selector } as any
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => [col]),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
    })
    const result = edit.editorResolver.getEditorSelectorParams(col, baseData[0], 0)
    expect(result).toBeDefined()
    expect(result).toEqual(selectorParams)
  })
})

describe('useCellEdit phase4 — readOnlyEdit onCellEditingStopped', () => {
  it('readOnlyEdit fires onCellEditRequest and onCellEditingStopped on commit', async () => {
    const onCellEditingStopped = vi.fn()
    const onCellEditRequest = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => ({ editType: 'readOnly' })),
      onDataUpdate: vi.fn(),
      onCellEditRequest,
      onCellEditingStopped,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Alice2'
    await edit.commitEditing()

    expect(onCellEditRequest).toHaveBeenCalled()
    expect(onCellEditingStopped).toHaveBeenCalled()
  })
})

/**
 * cutCell 行为测试：复制 + 通过编辑管线清空单元格值。
 * 验证 startEditing → updateCellEditingValue('') → commitEditing 管线能正确清空单元格，
 * 该管线同时被 clearCell 和 cutCell 复用。
 */
describe('useCellEdit phase4 — cutCell/clearCell edit pipeline', () => {
  it('clears cell value via edit pipeline (startEditing + updateCellEditingValue + commitEditing)', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
    })

    // 模拟 cutCell/clearCell 的编辑管线：startEditing → set empty → commit
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.updateCellEditingValue('name', '')
    await edit.commitEditing('contextMenu')

    expect(onDataUpdate).toHaveBeenCalled()
    const updatedData = onDataUpdate.mock.calls[0]![0] as any[]
    expect(updatedData[0].name).toBe('')
  })

  it('clears cell value for age column (numeric prop)', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'age', columnKey: 'age', value: 25 })
    edit.updateCellEditingValue('age', '')
    await edit.commitEditing('contextMenu')

    expect(onDataUpdate).toHaveBeenCalled()
    const updatedData = onDataUpdate.mock.calls[0]![0] as any[]
    expect(updatedData[0].age).toBe('')
  })

  it('fires onCellValueChanged when clearing cell value via edit pipeline', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const onCellValueChanged = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      onCellValueChanged,
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.updateCellEditingValue('name', '')
    await edit.commitEditing('contextMenu')

    expect(onCellValueChanged).toHaveBeenCalledWith(expect.objectContaining({
      prop: 'name',
      oldValue: 'Alice',
      newValue: '',
    }))
  })
})

/**
 * 未配置 rowKey 时 resolveStaleIndex 通过行引用比较检测索引过期。
 * 当 data 因排序/筛选/删除导致索引移位时，应返回 -1 取消编辑，避免写入错误行。
 */
describe('useCellEdit phase4 — stale index without rowKey', () => {
  it('cancels edit when row reference changes (data reordered) without rowKey', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn()
    const onEditCancelled = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      onEditCancelled,
      // 不配置 rowKeyFn —— 模拟未配置 rowKey 的场景
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Alice Modified'

    // 重新排序数据：Bob 移到 index 0，Alice 移到 index 1
    // 由于未配置 rowKey，resolveStaleIndex 无法通过 key 定位行
    localData.value = [baseData[1], baseData[0]]
    await edit.commitEditing()

    // 应取消编辑而非写入错误行
    expect(onEditCancelled).toHaveBeenCalledWith({ reason: 'row-deleted' })
    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('commits normally when data unchanged without rowKey', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      // 不配置 rowKeyFn
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Alice Modified'
    await edit.commitEditing()

    // 数据未变化，行引用一致，应正常提交
    expect(onDataUpdate).toHaveBeenCalled()
    const updatedData = onDataUpdate.mock.calls[0]![0] as any[]
    expect(updatedData[0].name).toBe('Alice Modified')
  })

  it('cancels edit when row is deleted without rowKey', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn()
    const onEditCancelled = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      onEditCancelled,
      // 不配置 rowKeyFn
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Alice Modified'

    // 删除正在编辑的行
    localData.value = [baseData[1]]
    await edit.commitEditing()

    // 行已不存在，应取消编辑
    expect(onEditCancelled).toHaveBeenCalledWith({ reason: 'row-deleted' })
    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('commits to correct row when same-position row replaced with new object (same data) without rowKey', async () => {
    const localData = ref([...baseData])
    const onDataUpdate = vi.fn((newData: any[]) => {
      localData.value = newData
    })
    const edit = createCellEditHelper({
      data: computed(() => localData.value),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      // 不配置 rowKeyFn
    })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Alice Modified'

    // 用新对象替换 row 0，但内容相同（引用不同）——浅相等视为同一行，保留编辑
    localData.value = [{ ...baseData[0] }, baseData[1]]
    await edit.commitEditing()

    // 浅拷同内容应保留编辑并提交到同一索引
    expect(onDataUpdate).toHaveBeenCalled()
    const updatedData = onDataUpdate.mock.calls[0]![0] as any[]
    expect(updatedData[0].name).toBe('Alice Modified')
  })
})
