import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { useCellEdit } from '../../src/composables/editing/use-cell-edit'
import { useCellNavigation } from '../../src/composables/editing/use-cell-navigation'
import { useEditorResolver } from '../../src/composables/editing/use-editor-resolver'

/**
 * Helper: create editorResolver + navigation for given columns/data, then call useCellEdit
 * 同时返回 editorResolver 和 navigation，以便测试直接调用 editableColumns 等
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

describe('useCellEdit phase3', () => {
  it('commitEditing interceptor edit.commit blocks commit', async () => {
    const trigger = vi.fn((event: string) => event === 'edit.commit')
    const interceptor = { trigger } as any
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
      interceptor,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Alice Modified'
    await edit.commitEditing()
    expect(trigger).toHaveBeenCalledWith('edit.commit', expect.any(Object))
    expect(edit.isEditing.value).toBe(false)
  })

  it('commitEditing interceptor edit.commit returns false proceeds normally', async () => {
    const trigger = vi.fn(() => false)
    const interceptor = { trigger } as any
    const onDataUpdate = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate,
      interceptor,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'Alice Modified'
    await edit.commitEditing()
    expect(onDataUpdate).toHaveBeenCalled()
  })

  it('cancelEditing interceptor edit.stop blocks cancel', async () => {
    const trigger = vi.fn((event: string) => event === 'edit.stop')
    const interceptor = { trigger } as any
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
      interceptor,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.isEditing.value).toBe(true)
    edit.cancelEditing()
    expect(trigger).toHaveBeenCalledWith('edit.stop', expect.any(Object))
    expect(edit.isEditing.value).toBe(false)
  })

  it('cancelEditing interceptor edit.stop returns false proceeds normally', async () => {
    const trigger = vi.fn(() => false)
    const interceptor = { trigger } as any
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => baseColumns),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
      interceptor,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.cancelEditing()
    expect(edit.isEditing.value).toBe(false)
  })

  it('cancelEditing fullRow skips columns not in editingValues', async () => {
    const onCellEditingStopped = vi.fn()
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => [
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', hidden: false },
        { prop: 'age', label: 'Age', editable: true, cellEditor: 'el-input-number', hidden: false },
      ] as unknown as ProcessedColumn[]),
      editConfig: computed(() => ({ editType: 'fullRow' })),
      onDataUpdate: vi.fn(),
      onCellEditingStopped,
    })
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    delete edit.editingValues.value.age
    edit.cancelEditing()
    expect(onCellEditingStopped).toHaveBeenCalledTimes(1)
  })

  it('editableColumns warns for editable column without cellEditor in dev', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const edit = createCellEditHelper({
      data: computed(() => baseData),
      columns: computed(() => [
        { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', hidden: false },
        { prop: 'noeditor', label: 'No Editor', editable: true, hidden: false },
      ] as unknown as ProcessedColumn[]),
      editConfig: computed(() => undefined),
      onDataUpdate: vi.fn(),
    })
    void edit.editorResolver.editableColumns.value
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('editable=true but no cellEditor'),
    )
    warnSpy.mockRestore()
  })
})
