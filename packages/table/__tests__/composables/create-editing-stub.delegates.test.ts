import type { UseEditingOrchestratorOptions } from '../../src/composables/editing/use-editing-orchestrator'
import type { ProcessedColumn } from '../../src/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, shallowRef } from 'vue'
import { createEditingAdapter } from '../../src/composables/editing/create-editing-stub'
import { useEditingOrchestrator } from '../../src/composables/editing/use-editing-orchestrator'

vi.mock('../../src/composables/editing/use-editing-orchestrator', () => ({
  useEditingOrchestrator: vi.fn(),
}))

describe('createEditingAdapter stub delegates', () => {
  /**
   * <zh/> 存根模式委托默认值——editConfig 缺失时所有委托降级为 noop/常量，不加载真实链
   * <en/> Stub-mode delegate defaults — with editConfig absent all delegates degrade to noop/constants without loading the real chain
   */
  it('returns noop defaults for every delegate in stub mode', async () => {
    interface Row { id: string }
    const editConfig = shallowRef(undefined)
    const rows = shallowRef<Row[]>([{ id: 'stub' }])
    const renderData = computed(() => rows.value)
    const columns = shallowRef<ProcessedColumn[]>([])
    const rowKeyFn = computed(() => (row: Row) => row.id)

    let api!: ReturnType<typeof createEditingAdapter<Row>>
    const wrapper = mount(defineComponent({
      setup() {
        api = createEditingAdapter<Row>(
          { editConfig } as unknown as UseEditingOrchestratorOptions<Row>,
          renderData,
          columns,
          rowKeyFn,
          () => false,
        )
        return () => h('div')
      },
    }))

    try {
      // <zh/> 未加载真实链 | <en/> Real chain is not loaded
      expect(vi.mocked(useEditingOrchestrator)).not.toHaveBeenCalled()

      // <zh/> 渲染源透传 renderData | <en/> Render source passes through renderData
      expect(api.renderRows.value).toBe(rows.value)
      // <zh/> 错误为空 | <en/> Errors are empty
      expect(api.validateApi.errors.value).toEqual([])

      // <zh/> 响应式标志默认值 | <en/> Reactive flag defaults
      expect(api.hasPendingChanges.value).toBe(false)
      expect(api.batchHasPending.value).toBe(false)
      expect(api.canUndo.value).toBe(false)
      expect(api.canRedo.value).toBe(false)
      // <zh/> 挂起变更为空 Map | <en/> Pending changes are an empty Map
      expect(api.batchPendingChanges.value).toBeInstanceOf(Map)
      expect(api.batchPendingChanges.value.size).toBe(0)
      // <zh/> 可编辑列为空 | <en/> Editable columns are empty
      expect(api.editorResolverApi.editableColumns.value).toEqual([])

      const anyApi = api as any

      // <zh/> editApi——Promise 委托 | <en/> editApi — promise delegates
      await expect(anyApi.editApi.startEditing(0, 0)).resolves.toBeUndefined()
      await expect(anyApi.editApi.validateCurrentValue()).resolves.toBeUndefined()
      // <zh/> editApi——同步 undefined 委托 | <en/> editApi — sync undefined delegates
      expect(anyApi.editApi.stopEditing()).toBeUndefined()
      expect(anyApi.editApi.getEditorComponent({} as never)).toBeUndefined()
      expect(anyApi.editApi.getEditorSelectorParams({} as never)).toBeUndefined()
      expect(anyApi.editApi.getCellEditingValue(0, 'id')).toBeUndefined()
      expect(anyApi.editApi.updateCellEditingValue(0, 'id', 'v')).toBeUndefined()
      expect(anyApi.editApi.updateEditingValue('v')).toBeUndefined()
      // <zh/> editApi——false 委托 | <en/> editApi — false delegates
      expect(anyApi.editApi.isColumnEditable({} as never)).toBe(false)
      expect(anyApi.editApi.isCellEditing(0, 0)).toBe(false)
      expect(anyApi.editApi.isCellDirty(0, 'id')).toBe(false)
      // <zh/> editApi——null 委托 | <en/> editApi — null delegates
      expect(anyApi.editApi.findNextEditableCell(0, 0)).toBeNull()
      expect(anyApi.editApi.findFirstEditableCell()).toBeNull()
      expect(anyApi.editApi.findLastEditableCell()).toBeNull()

      // <zh/> validateApi——resolve true 委托 | <en/> validateApi — resolve-true delegates
      await expect(anyApi.validateApi.validateCell(0, 'id', 'v')).resolves.toBe(true)
      await expect(anyApi.validateApi.validateRow(0, {})).resolves.toBe(true)
      await expect(anyApi.validateApi.validateAll()).resolves.toBe(true)
      await expect(anyApi.validateApi.validateCrossField(0, {})).resolves.toBe(true)
      // <zh/> validateApi——undefined 委托 | <en/> validateApi — undefined delegates
      expect(anyApi.validateApi.clearErrors()).toBeUndefined()
      expect(anyApi.validateApi.getCellError(0, 'id')).toBeUndefined()
      expect(anyApi.validateApi.clearRowCrossFieldErrors(0)).toBeUndefined()
      expect(anyApi.validateApi.clearRowErrors(0)).toBeUndefined()
      expect(anyApi.validateApi.clearCellError(0, 'id')).toBeUndefined()

      // <zh/> interceptor——false 委托 | <en/> interceptor — false delegate
      expect(anyApi.interceptor.trigger('beforeCommit' as never, {} as never)).toBe(false)

      // <zh/> editorResolverApi 委托 | <en/> editorResolverApi delegates
      expect(anyApi.editorResolverApi.getEditorComponent({} as never)).toBeUndefined()
      expect(anyApi.editorResolverApi.getEditorSelectorParams({} as never)).toBeUndefined()
      expect(anyApi.editorResolverApi.isColumnEditable({} as never)).toBe(false)

      // <zh/> cellNavigationApi 委托 | <en/> cellNavigationApi delegates
      expect(anyApi.cellNavigationApi.findNextEditableCell(0, 0)).toBeUndefined()
      expect(anyApi.cellNavigationApi.findFirstEditableCell()).toBeUndefined()
      expect(anyApi.cellNavigationApi.findLastEditableCell()).toBeUndefined()

      // <zh/> 提交类——resolve 空结果 | <en/> Commit-style — resolve empty results
      await expect(anyApi.commitEditing()).resolves.toEqual({ applied: [], rejected: [] })
      await expect(anyApi.batchCommitCells([])).resolves.toEqual({ applied: [], rejected: [] })
      await expect(anyApi.saveCells([])).resolves.toEqual({ applied: [], rejected: [] })
      // <zh/> 取消/丢弃类——undefined 委托 | <en/> Cancel/discard-style — undefined delegates
      expect(anyApi.cancelEditing()).toBeUndefined()
      expect(anyApi.discardEdit()).toBeUndefined()
      expect(anyApi.cancelBatchEdit()).toBeUndefined()
      // <zh/> submitEdit——resolve undefined | <en/> submitEdit — resolves undefined
      await expect(anyApi.submitEdit()).resolves.toBeUndefined()
      // <zh/> commitBatchEdit——resolve undefined | <en/> commitBatchEdit — resolves undefined
      await expect(anyApi.commitBatchEdit()).resolves.toBeUndefined()

      // <zh/> 状态查询与撤销重做 | <en/> Status queries and undo/redo
      expect(anyApi.hasUnsavedChanges()).toBe(false)
      expect(anyApi.undo()).toBe(false)
      expect(anyApi.redo()).toBe(false)

      // <zh/> 存根期间仍未加载真实链 | <en/> Real chain still not loaded during stub
      expect(vi.mocked(useEditingOrchestrator)).not.toHaveBeenCalled()
    }
    finally {
      wrapper.unmount()
    }
  })
})
