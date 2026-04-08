import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useTableRequest } from '../../src/composables/data/use-table-request'
import { resetDevWarnCacheForTests } from '../../src/utils/dev-warn'

function createRequest(data: any[]) {
  const isManual = ref(false)
  return useTableRequest({
    requestSource: () => undefined,
    requestAuto: () => false,
    requestMode: () => 'paginated',
    formatMaps: () => undefined,
    paramKeys: () => undefined,
    transformRequest: () => undefined,
    transformResponse: () => undefined,
    urlStateEnabled: () => false,
    urlStatePageKey: () => 'p',
    urlStateSizeKey: () => 's',
    paginationOptions: {
      total: ref(0),
      paginationRef: ref(null),
      isManual,
    },
    searchParams: () => ({}),
    rowKeyFn: () => (r: any) => String(r.id),
    isManual,
    defaultData: () => data,
    emits: {
      pageChange: vi.fn(),
      updateLoading: vi.fn(),
      request: vi.fn() as any,
      refresh: vi.fn(),
      updateData: vi.fn(),
      dataChange: vi.fn(),
      onError: vi.fn(),
    },
  })
}

/**
 * <zh/> 重复 rowKey dev 检测回归测试——重复键使选择/树级联/编辑定位静默错乱，需一次性指出。
 * <en/> Duplicate-rowKey dev-check regression tests — duplicated keys silently corrupt
 * <en/> selection/tree-cascade/edit targeting and must be flagged once.
 */
describe('useTableRequest duplicate rowKey dev check', () => {
  it('warns once on duplicate rowKeys', () => {
    resetDevWarnCacheForTests()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = createRequest([{ id: 1 }, { id: 2 }, { id: 1 }])
      // <zh/> 触发 rowKeyMeta computed | <en/> Trigger the rowKeyMeta computed
      expect(result.rowKeyMeta.value.keyToRow.size).toBe(2)
      const messages = warnSpy.mock.calls.map(args => String(args[0]))
      expect(messages.some(m => m.includes('duplicate rowKey') && m.includes('"1"'))).toBe(true)
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  it('stays silent for unique rowKeys', () => {
    resetDevWarnCacheForTests()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = createRequest([{ id: 1 }, { id: 2 }, { id: 3 }])
      expect(result.rowKeyMeta.value.keyToRow.size).toBe(3)
      const messages = warnSpy.mock.calls.map(args => String(args[0]))
      expect(messages.some(m => m.includes('duplicate rowKey'))).toBe(false)
    }
    finally {
      warnSpy.mockRestore()
    }
  })
})
