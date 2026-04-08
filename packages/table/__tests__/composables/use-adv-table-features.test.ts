import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref, shallowRef } from 'vue'
import { useAdvTableFeatures } from '../../src/composables/core/use-adv-table-features'

/**
 * <zh/> 功能域子编排单测——上游桩 + 真实三编排，覆盖搜索/导出/侧边栏装配与 tableContext。
 * <en/> Features sub-orchestrator tests with stubbed upstreams and real tri-orchestration — assembly and tableContext.
 */
function setupFeatures() {
  const emit = vi.fn()
  const searchValues = shallowRef<Record<string, unknown> | undefined>({})
  const searchParams = shallowRef<Record<string, unknown>>({})
  const tableData = ref<any[]>([{ id: 1 }])
  const localColumns = ref<any[]>([{ prop: 'name', label: 'Name', search: {} }])
  const core = {
    locale: computed(() => ({})),
    mergedUiConfig: computed(() => ({})),
    namespace: computed(() => 'el'),
    dayjsLocaleName: computed(() => 'zh-cn'),
    mergedSearch: computed(() => ({ enabled: true })),
    hasColumnSearch: computed(() => false),
    t: (k: string) => k,
    searchParams,
    mergedFilterConfig: computed(() => ({})),
    mergedColumnConfig: computed(() => ({})),
    tableId: computed(() => 't-feat'),
    isUnmounted: ref(false),
    handleError: vi.fn(),
    notify: vi.fn(),
  }
  const dataColumns = {
    refresh: vi.fn(),
    mergedLoading: ref(false),
    rowKeyMeta: ref({ keyToRow: new Map(), keyToIndex: new Map() }),
    rowExpandApi: {},
    localColumns,
    tableData,
    visibleData: computed(() => tableData.value),
    finalDisplayData: computed(() => tableData.value),
    effectiveColumns: computed(() => localColumns.value),
    pagination: { setCurrentPage: vi.fn() },
    fetchData: vi.fn(async () => {}),
    handleDataUpdate: vi.fn(),
    filterPanelApi: {},
    columnGroupApi: {},
    columnClassification: computed(() => ({ normal: [] })),
  }
  let api!: ReturnType<typeof useAdvTableFeatures>
  const wrapper = mount(defineComponent({
    setup() {
      api = useAdvTableFeatures({
        columns: [],
        search: undefined,
        toolbar: undefined,
        emit: emit as any,
        models: { searchValues } as any,
        core: core as any,
        dataColumns: dataColumns as any,
        selection: { selectionState: { getSelectedRows: () => [] } } as any,
        interaction: { containerWidth: ref(800), isContainerVisible: ref(true) } as any,
      })
      return () => h('div')
    },
  }), { attachTo: document.body })
  return { api, wrapper, emit, core, dataColumns }
}

describe('useAdvTableFeatures', () => {
  it('assembles search/export/side-panel and tableContext', () => {
    const { api, wrapper } = setupFeatures()
    expect(api.hasSearch.value).toBe(true)
    expect(api.exporting.value).toBe(false)
    expect(api.importing.value).toBe(false)
    expect(api.tableContext).toBeDefined()
    expect(api.tableContext.namespace.value).toBe('el')
    expect(typeof api.handleSearch).toBe('function')
    expect(typeof api.triggerImport).toBe('function')
    expect(typeof api.togglePanel).toBe('function')
    wrapper.unmount()
  })

  it('routes search through to fetch', async () => {
    const { api, wrapper, dataColumns, emit } = setupFeatures()
    api.handleSearch({ name: 'x' })
    await new Promise(r => setTimeout(r, 10))
    expect(dataColumns.fetchData).toHaveBeenCalledWith({ reason: 'search' })
    expect(emit.mock.calls.some(c => c[0] === 'query')).toBe(true)
    wrapper.unmount()
  })

  it('toggles side panels', () => {
    const { api, wrapper } = setupFeatures()
    api.togglePanel('filter' as any)
    expect(api.activePanel.value).toBe('filter')
    api.togglePanel('filter' as any)
    expect(api.activePanel.value).toBeNull()
    wrapper.unmount()
  })

  it('builds tableContext with currency and logical index', () => {
    const { api, wrapper } = setupFeatures()
    expect(api.tableContext.currency.value).toEqual({ symbol: '¥', locale: 'zh-CN' })
    expect(api.tableContext.getLogicalIndex({ id: 1 })).toBeUndefined()
    wrapper.unmount()
  })
})
