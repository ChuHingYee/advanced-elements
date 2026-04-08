import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { useEditingOrchestrator } from '../../src/composables/editing/use-editing-orchestrator'

/**
 * <zh/> 编辑编排单测——真实子编排，覆盖单格编辑提交/取消与未保存探测。
 * <en/> Editing-orchestrator tests with real subs — cell edit commit/cancel and unsaved probe.
 */
const rows = [{ id: 1, name: 'A' }]

function setupOrchestrator(
  editConfig: Record<string, any> = { editType: 'cell' },
  columns: any[] = [{ key: 'name', prop: 'name', label: 'Name', editable: true, cellEditor: 'input' }],
) {
  const emit = vi.fn()
  const handleDataUpdate = vi.fn()
  const invalidateQuickFilterRowCache = vi.fn()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const tableData = ref(rows.map(r => ({ ...r })))
  let api!: ReturnType<typeof useEditingOrchestrator>
  const wrapper = mount(defineComponent({
    setup() {
      api = useEditingOrchestrator({
        editConfig,
        globalTableConfig: computed(() => ({})),
        effectiveColumns: ref(columns),
        renderData: computed(() => tableData.value),
        tableData: tableData as any,
        rowKeyFn: computed(() => (row: any) => String(row.id)),
        tableId: computed(() => 't-edit'),
        invalidateQuickFilterRowCache,
        sharedTooltipApi: { forceHide: vi.fn() } as any,
        isCellInRangeSelection: () => false,
        dataUpdateBridge: { handleDataUpdate } as any,
        containerRef: ref<HTMLElement | null>(container),
        notify: vi.fn(),
        emit: emit as any,
      })
      return () => h('div')
    },
  }), { attachTo: document.body })
  return { api, wrapper, emit, handleDataUpdate, invalidateQuickFilterRowCache, container, tableData }
}

describe('useEditingOrchestrator', () => {
  it('exposes edit apis', () => {
    const t = setupOrchestrator()
    expect(t.api.editApi).toBeDefined()
    expect(t.api.interceptor).toBeDefined()
    expect(typeof t.api.commitEditing).toBe('function')
    expect(t.api.hasUnsavedChanges()).toBe(false)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('commits a cell edit through to data update', async () => {
    const t = setupOrchestrator()
    await t.api.editApi.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'A' })
    expect(t.api.hasUnsavedChanges()).toBe(true)
    t.api.editApi.updateCellEditingValue('name', 'B')
    await t.api.commitEditing()
    expect(t.handleDataUpdate).toHaveBeenCalled()
    const changed = t.emit.mock.calls.find(c => c[0] === 'cellValueChanged')
    expect(changed).toBeDefined()
    expect(t.invalidateQuickFilterRowCache).toHaveBeenCalledWith('1')
    t.wrapper.unmount()
    t.container.remove()
  })

  it('cancels an edit without data update', async () => {
    const t = setupOrchestrator()
    await t.api.editApi.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'A' })
    t.api.editApi.updateCellEditingValue('name', 'B')
    await t.api.cancelEditing()
    expect(t.handleDataUpdate).not.toHaveBeenCalled()
    expect(t.api.hasUnsavedChanges()).toBe(false)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('warns when crossFieldValidator is set in batch mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const t = setupOrchestrator({ editType: 'batch', crossFieldValidator: () => true })
    await Promise.resolve()
    expect(warn).toHaveBeenCalled()
    t.wrapper.unmount()
    t.container.remove()
  })

  it('commits a full-row edit through row validation', async () => {
    const t = setupOrchestrator({ editType: 'fullRow' })
    await t.api.editApi.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'A' })
    t.api.editApi.updateCellEditingValue('name', 'C')
    await t.api.commitEditing()
    expect(t.handleDataUpdate).toHaveBeenCalled()
    t.wrapper.unmount()
    t.container.remove()
  })

  it('undoes and redoes a batch-committed edit', async () => {
    const t = setupOrchestrator({ editType: 'batch' })
    await t.api.editApi.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'A' })
    t.api.editApi.updateCellEditingValue('name', 'B')
    await t.api.commitEditing()
    await t.api.commitBatchEdit()
    expect(t.api.canUndo.value).toBe(true)
    expect(t.api.undo()).toBe(true)
    expect(t.api.canRedo.value).toBe(true)
    expect(t.api.redo()).toBe(true)
    t.wrapper.unmount()
    t.container.remove()
  })

  it('stages and batch-commits edits', async () => {
    const t = setupOrchestrator({ editType: 'batch' })
    await t.api.editApi.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'A' })
    t.api.editApi.updateCellEditingValue('name', 'D')
    await t.api.commitEditing()
    expect(t.api.hasPendingChanges.value).toBe(true)
    await t.api.commitBatchEdit()
    expect(t.handleDataUpdate).toHaveBeenCalled()
    t.wrapper.unmount()
    t.container.remove()
  })

  it('rejects cell commits that fail validation', async () => {
    const t = setupOrchestrator(
      { editType: 'cell' },
      [{ key: 'name', prop: 'name', label: 'Name', editable: true, cellEditor: 'input', editorRules: { required: true, message: 'required' } }],
    )
    await t.api.editApi.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'A' })
    t.api.editApi.updateCellEditingValue('name', '')
    await t.api.commitEditing()
    expect(t.handleDataUpdate).not.toHaveBeenCalled()
    t.wrapper.unmount()
    t.container.remove()
  })

  it('emits cross-field errors on full-row validation failure', async () => {
    const t = setupOrchestrator({ editType: 'fullRow', crossFieldValidator: () => ['cross bad'] })
    await t.api.editApi.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'A' })
    t.api.editApi.updateCellEditingValue('name', 'C')
    await t.api.commitEditing()
    const err = t.emit.mock.calls.find(c => c[0] === 'crossFieldValidateError')
    expect(err).toBeDefined()
    expect(t.handleDataUpdate).not.toHaveBeenCalled()
    t.wrapper.unmount()
    t.container.remove()
  })

  it('emits structured error when batch validation fails', async () => {
    const editConfig = ref<any>({ editType: 'batch' })
    const t = setupOrchestrator(editConfig as any)
    await t.api.editApi.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'A' })
    t.api.editApi.updateCellEditingValue('name', 'D')
    await t.api.commitEditing()
    expect(t.api.hasPendingChanges.value).toBe(true)
    editConfig.value = { editType: 'batch', crossFieldValidator: () => ['batch cross bad'] }
    await t.api.commitBatchEdit()
    const err = t.emit.mock.calls.find(c => c[0] === 'error')
    expect(err).toBeDefined()
    expect(err![1]).toMatchObject({ code: 'TABLE_EDIT_VALIDATION_FAILED' })
    t.wrapper.unmount()
    t.container.remove()
  })
})
