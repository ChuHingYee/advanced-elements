import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { useSearchOrchestrator } from '../../src/composables/features/use-search-orchestrator'

/**
 * <zh/> 搜索编排单测——真实子编排，覆盖查询/重置派发、远程拉取与失败兜底。
 * <en/> Search-orchestrator tests with real subs — query/reset dispatch, remote fetch and failure backstop.
 */
function setupOrchestrator(opts: {
  fetchImpl?: (reason: any) => Promise<void>
  searchEnabled?: boolean
} = {}) {
  const emit = vi.fn()
  const setCurrentPage = vi.fn()
  const fetchData = vi.fn(opts.fetchImpl ?? (async () => {}))
  const searchParams = shallowRef<Record<string, unknown>>({})
  const searchValuesModel = shallowRef<Record<string, unknown> | undefined>({})
  let api!: ReturnType<typeof useSearchOrchestrator>
  const wrapper = mount(defineComponent({
    setup() {
      api = useSearchOrchestrator({
        searchParams: searchParams as any,
        localColumns: { value: [{ prop: 'name', label: 'Name', search: { type: 'input' } }] } as any,
        rawColumns: () => [{ prop: 'name', label: 'Name', search: {} }] as any,
        searchConfig: () => undefined,
        defaultValues: () => undefined,
        searchEnabled: () => opts.searchEnabled ?? true,
        hasColumnSearch: () => false,
        translation: (k: string) => k,
        searchValuesModel: searchValuesModel as any,
        pagination: { setCurrentPage } as any,
        isUnmounted: () => false,
        fetchData: fetchData as any,
        emit: emit as any,
        tableId: { value: 't1' } as any,
      })
      return () => h('div')
    },
  }))
  return {
    api,
    wrapper,
    emit,
    setCurrentPage,
    fetchData,
    searchParams,
    searchValuesModel,
  }
}

async function flush(times = 4) {
  for (let i = 0; i < times; i++)
    await Promise.resolve()
  await new Promise(r => setTimeout(r, 0))
}

describe('useSearchOrchestrator', () => {
  it('detects search availability from columns', () => {
    const { api, wrapper } = setupOrchestrator()
    expect(api.hasSearch.value).toBe(true)
    expect(api.mergedSearchFields.value.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('dispatches query and refetches on search', async () => {
    const t = setupOrchestrator()
    t.api.handleSearch({ name: 'x' })
    await flush()
    expect(t.setCurrentPage).toHaveBeenCalledWith(1)
    const query = t.emit.mock.calls.find(c => c[0] === 'query')
    expect(query).toBeDefined()
    expect(query![query!.length - 1]).toBe('t1')
    expect(t.fetchData).toHaveBeenCalledWith({ reason: 'search' })
    t.wrapper.unmount()
  })

  it('dispatches reset and refetches on reset', async () => {
    const t = setupOrchestrator()
    t.api.handleReset()
    await flush()
    expect(t.setCurrentPage).toHaveBeenCalledWith(1)
    const reset = t.emit.mock.calls.find(c => c[0] === 'reset')
    expect(reset).toBeDefined()
    expect(t.fetchData).toHaveBeenCalledWith({ reason: 'reset' })
    t.wrapper.unmount()
  })

  it('emits structured error without rejection on fetch failure', async () => {
    const t = setupOrchestrator({ fetchImpl: async () => {
      throw new Error('net down')
    } })
    t.api.handleSearch({ name: 'x' })
    await flush()
    const err = t.emit.mock.calls.find(c => c[0] === 'error')
    expect(err).toBeDefined()
    expect(err![1]).toMatchObject({ code: 'TABLE_REQUEST_FAILED', severity: 'error' })
    t.wrapper.unmount()
  })

  it('reads and writes the query form model', async () => {
    const t = setupOrchestrator()
    t.api.setQueryFormModel({ name: 'y' })
    await flush()
    expect(t.api.getQueryFormModel()).toMatchObject({ name: 'y' })
    t.wrapper.unmount()
  })
})
