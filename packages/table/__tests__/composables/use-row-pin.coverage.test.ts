import { describe, expect, it } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useRowPin } from '../../src/composables/data/use-row-pin'

/**
 * <zh/> useRowPin 覆盖补齐——pin/unpin 上下侧、isRowPinned、clearPinnedRows、
 * <zh/> 已配置键的 pin 分支（运行时记录清理、无重复）与配置追平时的 prune 清理。
 * <en/> useRowPin coverage supplement — pin/unpin on both sides, isRowPinned,
 * <en/> clearPinnedRows, the already-configured pin branch (runtime-record cleanup,
 * <en/> no duplicates) and prune cleanup when config catches up.
 */

interface PinRow {
  id: number
}

function makeRows(): PinRow[] {
  return [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
}

function setupPin(config: any = { topRowKeys: [], bottomRowKeys: [] }) {
  const rowPinConfig = ref(config)
  const visibleData = ref<PinRow[]>(makeRows())
  const rowKeyFn = computed(() => (row: PinRow) => String(row.id))
  const api = useRowPin({ rowPinConfig, visibleData, rowKeyFn } as any)
  return { api, rowPinConfig, visibleData }
}

function ids(rows: PinRow[]): number[] {
  return rows.map(r => r.id)
}

describe('useRowPin coverage', () => {
  it('pinTop sets isRowPinned true and exposes the top row', () => {
    // <zh/> 顶部 pin 后可查询、可渲染 | <en/> Top pin is queryable and rendered
    const { api } = setupPin()
    expect(api.rowPinApi.isRowPinned('1')).toBe(false)
    api.rowPinApi.pinRow('1', 'top')
    expect(api.rowPinApi.isRowPinned('1')).toBe(true)
    expect(api.rowPinApi.isRowPinned('2')).toBe(false)
    expect(ids(api.topPinnedRows.value as PinRow[])).toEqual([1])
    expect(api.bottomPinnedRows.value).toHaveLength(0)
    expect(api.pinEnabled.value).toBe(true)
  })

  it('pinBottom sets isRowPinned true and exposes the bottom row', () => {
    // <zh/> 底部 pin 后可查询、可渲染 | <en/> Bottom pin is queryable and rendered
    const { api } = setupPin()
    api.rowPinApi.pinRow('4', 'bottom')
    expect(api.rowPinApi.isRowPinned('4')).toBe(true)
    expect(ids(api.bottomPinnedRows.value as PinRow[])).toEqual([4])
    expect(api.topPinnedRows.value).toHaveLength(0)
    expect(ids(api.unpinnedData.value as PinRow[])).toEqual([1, 2, 3])
  })

  it('unpin clears isRowPinned on both sides', () => {
    // <zh/> 双侧 unpin 后均不可查询 | <en/> Unpin on both sides clears the pinned state
    const { api } = setupPin()
    api.rowPinApi.pinRow('1', 'top')
    api.rowPinApi.pinRow('4', 'bottom')
    expect(api.rowPinApi.isRowPinned('1')).toBe(true)
    expect(api.rowPinApi.isRowPinned('4')).toBe(true)
    api.rowPinApi.unpinRow('1')
    expect(api.rowPinApi.isRowPinned('1')).toBe(false)
    expect(api.topPinnedRows.value).toHaveLength(0)
    expect(api.rowPinApi.isRowPinned('4')).toBe(true)
    api.rowPinApi.unpinRow('4')
    expect(api.rowPinApi.isRowPinned('4')).toBe(false)
    expect(api.bottomPinnedRows.value).toHaveLength(0)
    expect(api.pinEnabled.value).toBe(false)
    expect(ids(api.unpinnedData.value as PinRow[])).toEqual([1, 2, 3, 4])
  })

  it('clearPinnedRows empties top and bottom', () => {
    // <zh/> 清空后固定区为空、滚动区恢复全量 | <en/> After clear both strips are empty and scroll area is full
    const { api } = setupPin()
    api.rowPinApi.pinRow('1', 'top')
    api.rowPinApi.pinRow('2', 'top')
    api.rowPinApi.pinRow('4', 'bottom')
    expect(api.topPinnedRows.value).toHaveLength(2)
    expect(api.bottomPinnedRows.value).toHaveLength(1)
    api.rowPinApi.clearPinnedRows()
    expect(api.topPinnedRows.value).toHaveLength(0)
    expect(api.bottomPinnedRows.value).toHaveLength(0)
    expect(api.rowPinApi.isRowPinned('1')).toBe(false)
    expect(api.rowPinApi.isRowPinned('4')).toBe(false)
    expect(api.pinEnabled.value).toBe(false)
    expect(api.unpinnedData.value).toHaveLength(4)
  })

  it('clearPinnedRows also empties config-driven pins', () => {
    // <zh/> 配置来源的固定行同样可被清空 | <en/> Config-driven pins are cleared too
    const { api } = setupPin({ topRowKeys: ['1'], bottomRowKeys: ['4'] })
    expect(api.topPinnedRows.value).toHaveLength(1)
    expect(api.bottomPinnedRows.value).toHaveLength(1)
    api.rowPinApi.clearPinnedRows()
    expect(api.topPinnedRows.value).toHaveLength(0)
    expect(api.bottomPinnedRows.value).toHaveLength(0)
    expect(api.rowPinApi.isRowPinned('1')).toBe(false)
    expect(api.unpinnedData.value).toHaveLength(4)
  })

  it('pin on an already-configured key keeps a single pinned row', () => {
    // <zh/> 同侧已配置时 pin 不产生重复行 | <en/> Pinning an already-configured key yields no duplicate row
    const { api } = setupPin({ topRowKeys: ['1'], bottomRowKeys: ['4'] })
    api.rowPinApi.pinRow('1', 'top')
    api.rowPinApi.pinRow('4', 'bottom')
    expect(api.rowPinApi.isRowPinned('1')).toBe(true)
    expect(api.rowPinApi.isRowPinned('4')).toBe(true)
    expect(ids(api.topPinnedRows.value as PinRow[])).toEqual([1])
    expect(ids(api.bottomPinnedRows.value as PinRow[])).toEqual([4])
    expect(ids(api.unpinnedData.value as PinRow[])).toEqual([2, 3])
  })

  it('pin with a numeric key matching numeric config stays deduplicated', () => {
    // <zh/> 数字 key 与数字配置匹配时同样去重 | <en/> Numeric keys matching numeric config are deduped too
    const { api } = setupPin({ topRowKeys: [1], bottomRowKeys: [4] })
    api.rowPinApi.pinRow(1, 'top')
    api.rowPinApi.pinRow(4, 'bottom')
    expect(api.rowPinApi.isRowPinned(1)).toBe(true)
    expect(api.rowPinApi.isRowPinned(4)).toBe(true)
    expect(ids(api.topPinnedRows.value as PinRow[])).toEqual([1])
    expect(ids(api.bottomPinnedRows.value as PinRow[])).toEqual([4])
  })

  it('runtime pin followed by matching config prunes without duplicates', async () => {
    // <zh/> 运行时 pin 后配置追平：prune 清理运行时记录，固定区不翻倍
    // <en/> Runtime pin then config catch-up: prune drops the runtime record, no doubled rows
    const { api, rowPinConfig } = setupPin()
    api.rowPinApi.pinRow('2', 'top')
    api.rowPinApi.pinRow('3', 'bottom')
    expect(ids(api.topPinnedRows.value as PinRow[])).toEqual([2])
    expect(ids(api.bottomPinnedRows.value as PinRow[])).toEqual([3])
    rowPinConfig.value = { topRowKeys: ['2'], bottomRowKeys: ['3'] }
    await nextTick()
    await nextTick()
    // <zh/> 配置追平后仍各一行，未翻倍 | <en/> After config catch-up there is still exactly one row per side
    expect(ids(api.topPinnedRows.value as PinRow[])).toEqual([2])
    expect(ids(api.bottomPinnedRows.value as PinRow[])).toEqual([3])
    expect(api.rowPinApi.isRowPinned('2')).toBe(true)
    expect(api.rowPinApi.isRowPinned('3')).toBe(true)
    // <zh/> 同侧再次 pin 命中已配置分支，不产生重复 | <en/> Re-pinning hits the configured branch, no duplicate
    api.rowPinApi.pinRow('2', 'top')
    api.rowPinApi.pinRow('3', 'bottom')
    expect(api.topPinnedRows.value).toHaveLength(1)
    expect(api.bottomPinnedRows.value).toHaveLength(1)
    expect(ids(api.unpinnedData.value as PinRow[])).toEqual([1, 4])
  })
})
