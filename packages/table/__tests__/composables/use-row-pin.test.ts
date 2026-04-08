import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useRowPin } from '../../src/composables/data/use-row-pin'

/**
 * <zh/> 行固定单测——覆盖配置/运行时 pin、上下移动、上限截断与回退。
 * <en/> Row-pin tests — config/runtime pinning, cross-side moves, limit truncation and fallbacks.
 */
const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]

function setupPin(config: any = { topRowKeys: ['1'], bottomRowKeys: ['4'] }) {
  const api = useRowPin({
    rowPinConfig: ref(config),
    visibleData: ref(rows.map(r => ({ ...r }))),
    rowKeyFn: computed(() => (row: any) => String(row.id)),
    onPinLimitExceeded: vi.fn(),
  } as any)
  return api
}

describe('useRowPin', () => {
  it('splits configured top/bottom pins from unpinned', () => {
    const api = setupPin()
    expect(api.topPinnedRows.value.map((r: any) => r.id)).toEqual([1])
    expect(api.bottomPinnedRows.value.map((r: any) => r.id)).toEqual([4])
    expect(api.unpinnedData.value.map((r: any) => r.id)).toEqual([2, 3])
  })

  it('pins and unpins rows at runtime', () => {
    const api = setupPin({ topRowKeys: [], bottomRowKeys: [] })
    api.rowPinApi.pinRow('2', 'top')
    expect(api.topPinnedRows.value.map((r: any) => r.id)).toEqual([2])
    api.rowPinApi.pinRow('2', 'bottom')
    expect(api.topPinnedRows.value).toEqual([])
    expect(api.bottomPinnedRows.value.map((r: any) => r.id)).toEqual([2])
    api.rowPinApi.unpinRow('2')
    expect(api.bottomPinnedRows.value).toEqual([])
    expect(api.unpinnedData.value.map((r: any) => r.id)).toContain(2)
  })

  it('truncates beyond the pin limit keeping top priority', () => {
    const onPinLimitExceeded = vi.fn()
    const api = useRowPin({
      rowPinConfig: ref({ topRowKeys: ['1', '2', '3'], bottomRowKeys: ['4'], maxPinnedRows: 2 }),
      visibleData: ref(rows.map(r => ({ ...r }))),
      rowKeyFn: computed(() => (row: any) => String(row.id)),
      onPinLimitExceeded,
    } as any)
    const total = api.topPinnedRows.value.length + api.bottomPinnedRows.value.length
    expect(total).toBeLessThanOrEqual(2)
    expect(onPinLimitExceeded).toHaveBeenCalled()
    // <zh/> 被截断的行回到可滚动区，不消失 | <en/> truncated rows return to the scroll area, never vanish
    expect(api.unpinnedData.value.length).toBeGreaterThan(0)
  })

  it('falls back on illegal maxPinnedRows', () => {
    const api = setupPin({ topRowKeys: ['1'], bottomRowKeys: [], maxPinnedRows: -5 })
    expect(api.topPinnedRows.value.map((r: any) => r.id)).toEqual([1])
  })

  it('handles missing config without crashing', () => {
    const api = useRowPin({
      rowPinConfig: ref(undefined),
      visibleData: ref(rows.map(r => ({ ...r }))),
      rowKeyFn: computed(() => (row: any) => String(row.id)),
    } as any)
    expect(api.unpinnedData.value).toHaveLength(4)
    api.rowPinApi.pinRow('1', 'top')
    expect(api.topPinnedRows.value.map((r: any) => r.id)).toEqual([1])
  })
})
