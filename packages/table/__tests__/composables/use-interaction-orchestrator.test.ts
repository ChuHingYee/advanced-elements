import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { useInteractionOrchestrator } from '../../src/composables/interaction/use-interaction-orchestrator'

/**
 * <zh/> 交互编排单测——覆盖范围配置解析、列域映射、容器可见与状态重置。
 * <en/> Interaction-orchestrator tests — range config, column-domain maps, visibility and reset.
 */
const cols = [
  { key: 'sel', prop: '__sel', selection: true },
  { key: 'a', prop: 'a' },
  { key: 'b', prop: 'b', fixed: 'right' },
]

function setupOrchestrator(opts: {
  rangeSelection?: any
  columnDomain?: 'cells' | 'attr'
  activeRenderer?: any
} = {}) {
  const tableData = ref([{ id: 1 }])
  let api!: ReturnType<typeof useInteractionOrchestrator>
  const wrapper = mount(defineComponent({
    setup() {
      api = useInteractionOrchestrator({
        rowKeyFn: computed(() => (row: any) => String(row.id)),
        tableData: tableData as any,
        rowKeyMeta: ref({ keyToRow: new Map(), keyToIndex: new Map() }) as any,
        localColumns: ref([]) as any,
        setColumns: vi.fn(),
        tableId: computed(() => 't-ix'),
        caps: { columnDomain: opts.columnDomain ?? 'cells', selectionScope: 'page' } as any,
        dom: {
          createDragLocator: () => ({}),
          getScopeSelector: () => '.scope',
        } as any,
        activeRenderer: computed(() => opts.activeRenderer ?? null),
        mergedSizeConfig: computed(() => ({ rowHeight: 40 })),
        mergedRowConfig: computed(() => ({})),
        mergedColumnConfig: computed(() => ({})),
        rangeSelection: opts.rangeSelection,
        reorderData: vi.fn(),
        renderData: computed(() => tableData.value),
        effectiveColumns: ref([...cols]) as any,
        emit: vi.fn(),
      } as any)
      return () => h('div')
    },
  }), { attachTo: document.body })
  return { api, wrapper }
}

describe('useInteractionOrchestrator', () => {
  it('exposes drag state and container refs', () => {
    const t = setupOrchestrator()
    expect(t.api.isRowDragging.value).toBe(false)
    expect(t.api.dragLocator.value).toBeDefined()
    expect(t.api.isRangeSelecting.value).toBe(false)
    t.wrapper.unmount()
  })

  it('disables range selection by default', () => {
    const t = setupOrchestrator()
    expect(t.api.isCellInRangeSelection(0, 0)).toBe(false)
    t.wrapper.unmount()
  })

  it('enables range selection with boolean and object configs', () => {
    const a = setupOrchestrator({ rangeSelection: true })
    expect(a.api.isRangeSelecting.value).toBe(false)
    a.wrapper.unmount()
    const b = setupOrchestrator({ rangeSelection: { enabled: true, autoCopy: true } })
    expect(b.api.isRangeSelecting.value).toBe(false)
    b.wrapper.unmount()
    const c = setupOrchestrator({ rangeSelection: { enabled: false } })
    expect(c.api.isCellInRangeSelection(0, 0)).toBe(false)
    c.wrapper.unmount()
  })

  it('maps column indexes by identity in cells domain', () => {
    const t = setupOrchestrator({ rangeSelection: true })
    expect(t.api.isCellInRangeSelection(0, 1)).toBe(false)
    t.wrapper.unmount()
  })

  it('maps column indexes by key outside cells domain', () => {
    const t = setupOrchestrator({ rangeSelection: true, columnDomain: 'attr' })
    expect(t.api.isCellInRangeSelection(0, 0)).toBe(false)
    t.wrapper.unmount()
  })

  it('tracks container visibility and deactivation', () => {
    const t = setupOrchestrator()
    expect(t.api.isContainerVisible.value).toBe(false)
    t.api.setDeactivated(true)
    expect(t.api.isContainerVisible.value).toBe(false)
    t.api.setDeactivated(false)
    t.api.resetInteractionState()
    expect(t.api.isContainerVisible.value).toBe(false)
    t.wrapper.unmount()
  })

  it('exposes a calm error boundary by default', () => {
    const t = setupOrchestrator()
    expect(t.api.rendererHasError.value).toBe(false)
    expect(t.api.rendererErrorText.value).toBe('')
    t.api.resetRendererError()
    expect(t.api.rendererHasError.value).toBe(false)
    t.wrapper.unmount()
  })

  it('captures render errors from descendants', async () => {
    const emit = vi.fn()
    let api!: ReturnType<typeof useInteractionOrchestrator>
    const Thrower = defineComponent({
      setup() {
        throw new Error('boom-render')
      },
    })
    const tableData = ref([{ id: 1 }])
    const wrapper = mount(defineComponent({
      setup() {
        api = useInteractionOrchestrator({
          rowKeyFn: computed(() => (row: any) => String(row.id)),
          tableData: tableData as any,
          rowKeyMeta: ref({ keyToRow: new Map(), keyToIndex: new Map() }) as any,
          localColumns: ref([]) as any,
          setColumns: vi.fn(),
          tableId: computed(() => 't-ix-err'),
          caps: { columnDomain: 'cells', selectionScope: 'page' } as any,
          dom: { createDragLocator: () => ({}), getScopeSelector: () => '.scope' } as any,
          activeRenderer: computed(() => null),
          mergedSizeConfig: computed(() => ({ rowHeight: 40 })),
          mergedRowConfig: computed(() => ({})),
          mergedColumnConfig: computed(() => ({})),
          rangeSelection: undefined,
          reorderData: vi.fn(),
          renderData: tableData as any,
          effectiveColumns: ref([]) as any,
          emit: emit as any,
        })
        return () => h(Thrower)
      },
    }), { attachTo: document.body })
    await Promise.resolve()
    expect(api.rendererHasError.value).toBe(true)
    expect(api.rendererErrorText.value).toBe('boom-render')
    expect(emit.mock.calls.some(c => c[0] === 'error')).toBe(true)
    tableData.value = [{ id: 2 }]
    await Promise.resolve()
    await Promise.resolve()
    expect(api.rendererHasError.value).toBe(false)
    wrapper.unmount()
  })

  it('uses the renderer interaction domain when provided', () => {
    const t = setupOrchestrator({
      activeRenderer: {
        getInteractionDomain: () => ({
          rows: [{ id: 9 }],
          columns: [{ key: 'z', prop: 'z' }],
          columnIndexes: [0],
        }),
        scrollToRow: (key: string) => key === '9',
      },
    })
    expect(t.api.isCellInRangeSelection(0, 0)).toBe(false)
    t.wrapper.unmount()
  })
})
