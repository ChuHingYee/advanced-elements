import type { UseEditingOrchestratorOptions } from '../../src/composables/editing/use-editing-orchestrator'
import type { CellState, RowViewModel } from '../../src/composables/view-model/use-row-view-model'
import type { ProcessedColumn } from '../../src/types'
import type { EditConfig, ValidateError } from '../../src/types/edit'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, inject, isProxy, nextTick, onScopeDispose, shallowRef } from 'vue'
import { createEditingAdapter } from '../../src/composables/editing/create-editing-stub'
import { useEditingOrchestrator } from '../../src/composables/editing/use-editing-orchestrator'
import { advTableEditKey } from '../../src/types/injection-keys'

vi.mock('../../src/composables/editing/use-editing-orchestrator', () => ({
  useEditingOrchestrator: vi.fn(),
}))

function createChain() {
  return {
    validateApi: { errors: shallowRef<ValidateError[]>([]) },
    tableRowViewModels: shallowRef<RowViewModel[]>([]),
    rowViewModelMap: shallowRef(new Map<string, readonly CellState[]>()),
    rendererData: shallowRef([{ id: 'initial' }]),
    editorResolverApi: { editableColumns: shallowRef<ProcessedColumn[]>([]) },
    hasPendingChanges: shallowRef(false),
    batchHasPending: shallowRef(false),
    batchPendingChanges: shallowRef(new Map()),
    canUndo: shallowRef(false),
    canRedo: shallowRef(false),
    editApi: { editingValue: shallowRef<unknown>(null) },
  }
}

describe('createEditingAdapter runtime activation', () => {
  /**
   * <zh/> 等待编辑链就绪——动态 import 在 vite-node 下需宏任务推进（与 mount-table harness 同款策略）
   * <en/> Wait for the editing chain — dynamic imports need macrotask pumping under vite-node (same strategy as the mount-table harness)
   */
  async function waitForChain(chains: unknown[], count: number) {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25))
      await nextTick()
      if (chains.length >= count)
        break
    }
    await nextTick()
  }

  it('reconnects all live bridges and computed delegates after off/on/off/on without deep proxies', async () => {
    const editConfig = shallowRef<EditConfig>()
    const rows = shallowRef([{ id: 'stub' }])
    const renderData = computed(() => rows.value)
    const columns = shallowRef<ProcessedColumn[]>([])
    const rowKeyFn = computed(() => (row: { id: string }) => row.id)
    const chains: ReturnType<typeof createChain>[] = []
    const dispose = vi.fn()
    vi.mocked(useEditingOrchestrator).mockImplementation(() => {
      const chain = createChain()
      chains.push(chain)
      onScopeDispose(dispose)
      return chain as unknown as ReturnType<typeof useEditingOrchestrator>
    })
    let api!: ReturnType<typeof createEditingAdapter<{ id: string }>>
    const wrapper = mount(defineComponent({
      setup() {
        api = createEditingAdapter(
          { editConfig } as UseEditingOrchestratorOptions<{ id: string }>,
          renderData,
          columns,
          rowKeyFn,
          () => false,
        )
        return () => h('div')
      },
    }))
    try {
      for (let cycle = 0; cycle < 2; cycle++) {
        expect(api.renderRows.value).toBe(rows.value)
        expect(api.hasPendingChanges.value).toBe(false)
        expect(api.batchHasPending.value).toBe(false)
        expect(api.batchPendingChanges.value.size).toBe(0)
        expect(api.canUndo.value).toBe(false)
        expect(api.canRedo.value).toBe(false)
        expect(api.editorResolverApi.editableColumns.value).toEqual([])
        editConfig.value = {}
        await waitForChain(chains, cycle + 1)
        const chain = chains[cycle]!
        chain.rendererData.value = [{ id: `live-${cycle}` }]
        chain.validateApi.errors.value = [{ message: 'invalid' } as ValidateError]
        chain.tableRowViewModels.value = [{ rowKey: 'live' } as unknown as RowViewModel]
        chain.rowViewModelMap.value = new Map([['live', []]])
        chain.editorResolverApi.editableColumns.value = [{ prop: 'id' } as ProcessedColumn]
        chain.hasPendingChanges.value = true
        chain.batchHasPending.value = true
        chain.batchPendingChanges.value = new Map([['live', { id: 'changed' }]])
        chain.canUndo.value = true
        chain.canRedo.value = true
        await nextTick()
        expect(api.renderRows.value).toBe(chain.rendererData.value)
        expect(api.validateApi.errors.value).toBe(chain.validateApi.errors.value)
        expect(api.tableRowViewModels.value).toBe(chain.tableRowViewModels.value)
        expect(api.rowViewModelMap.value).toBe(chain.rowViewModelMap.value)
        expect(api.editorResolverApi.editableColumns.value).toBe(chain.editorResolverApi.editableColumns.value)
        expect(api.hasPendingChanges.value).toBe(true)
        expect(api.batchHasPending.value).toBe(true)
        expect(api.batchPendingChanges.value).toBe(chain.batchPendingChanges.value)
        expect(api.canUndo.value).toBe(true)
        expect(api.canRedo.value).toBe(true)
        expect(api.editApi.editingValue).toBe(chain.editApi.editingValue)
        expect(isProxy(api.renderRows.value)).toBe(false)
        editConfig.value = undefined
        await nextTick()
        expect(dispose).toHaveBeenCalledTimes(cycle + 1)
        expect(api.validateApi.errors.value).toEqual([])
        chain.rendererData.value = [{ id: 'stale' }]
        await nextTick()
        expect(api.renderRows.value).toBe(rows.value)
      }
      editConfig.value = {}
      await waitForChain(chains, 3)
    }
    finally {
      wrapper.unmount()
    }
    expect(dispose).toHaveBeenCalledTimes(3)
  })

  /**
   * <zh/> 生产接线回归：渲染层（render-helpers.ts 的 injectRendererContext）经
   * <zh/> `inject(advTableEditKey)` 解析编辑器组件；该 provide 曾在重构中丢失，
   * <zh/> 导致 Default/Virtual 两种模式的编辑器全部静默不渲染（单测显式 provide 而从未暴露）。
   * <en/> Production-wiring regression: the render layer (render-helpers.ts injectRendererContext)
   * <en/> resolves editor components via `inject(advTableEditKey)`; that provide was lost in a
   * <en/> refactor and silently broke editors in BOTH modes (unit tests provided it explicitly).
   */
  it('provides advTableEditKey so descendant renderers can resolve editor components', async () => {
    const editConfig = shallowRef<EditConfig>({})
    const rows = shallowRef([{ id: 'stub' }])
    const renderData = computed(() => rows.value)
    const columns = shallowRef<ProcessedColumn[]>([])
    const rowKeyFn = computed(() => (row: { id: string }) => row.id)
    vi.mocked(useEditingOrchestrator).mockImplementation(() => createChain() as unknown as ReturnType<typeof useEditingOrchestrator>)
    let injectedEditApi: unknown
    const wrapper = mount(defineComponent({
      setup() {
        createEditingAdapter(
          { editConfig } as UseEditingOrchestratorOptions<{ id: string }>,
          renderData,
          columns,
          rowKeyFn,
          () => false,
        )
        return () => h(defineComponent({
          setup() {
            injectedEditApi = inject(advTableEditKey, undefined)
            return () => h('div')
          },
        }))
      },
    }))
    try {
      await waitForChain([], 0)
      await nextTick()
      expect(injectedEditApi).toBeDefined()
      expect(typeof (injectedEditApi as { getEditorComponent?: unknown }).getEditorComponent).toBe('function')
    }
    finally {
      wrapper.unmount()
    }
  })
})
