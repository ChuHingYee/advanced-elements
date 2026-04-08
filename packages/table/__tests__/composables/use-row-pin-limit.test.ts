import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useRowPin } from '../../src/composables/data/use-row-pin'

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: `row${i}` }))
}

function setup(topCount: number, bottomCount: number, options: Record<string, any> = {}) {
  const total = topCount + bottomCount
  const rows = ref(makeRows(total + 10))
  const rowPinConfig = ref<any>({
    topRowKeys: rows.value.slice(0, topCount).map(r => r.id),
    bottomRowKeys: rows.value.slice(topCount, total).map(r => r.id),
    ...(options.rowPinConfig ?? {}),
  })
  const onPinLimitExceeded = vi.fn()
  const scope = effectScope(true)
  let api!: ReturnType<typeof useRowPin>
  scope.run(() => {
    api = useRowPin({
      rowPinConfig,
      visibleData: rows,
      rowKeyFn: () => (row: any) => String(row.id),
      onPinLimitExceeded,
      ...(options.deps ?? {}),
    })
  })
  return { rows, rowPinConfig, onPinLimitExceeded, api, dispose: () => scope.stop() }
}

describe('useRowPin maxPinnedRows enforcement', () => {
  it('keeps everything and stays silent under the limit', async () => {
    const s = setup(2, 1)
    await nextTick()
    expect(s.api.topPinnedRows.value).toHaveLength(2)
    expect(s.api.bottomPinnedRows.value).toHaveLength(1)
    expect(s.onPinLimitExceeded).not.toHaveBeenCalled()
    s.dispose()
  })

  it('truncates bottom-first past the default limit of 50 and returns extras to unpinned', async () => {
    const s = setup(40, 20)
    await nextTick()
    // <zh/> 顶部优先保留 40，底部保留 10，被截 10 行回到滚动区而非消失
    // <en/> Top wins all 40, bottom keeps 10; the 10 dropped rows fall back to the scroll area
    expect(s.api.topPinnedRows.value).toHaveLength(40)
    expect(s.api.bottomPinnedRows.value).toHaveLength(10)
    const pinnedIds = new Set([
      ...s.api.topPinnedRows.value.map(r => r.id),
      ...s.api.bottomPinnedRows.value.map(r => r.id),
    ])
    expect(pinnedIds.size).toBe(50)
    // <zh/> 20 行数据：10 行被截 + 10 行从未 pin，unpinned 共 20 行，无丢失
    // <en/> 20 data rows: 10 truncated + 10 never pinned = 20 unpinned rows, nothing lost
    expect(s.api.unpinnedData.value).toHaveLength(20)
    expect(s.onPinLimitExceeded).toHaveBeenCalledTimes(1)
    expect(s.onPinLimitExceeded).toHaveBeenCalledWith({
      total: 60,
      limit: 50,
      truncatedTop: 0,
      truncatedBottom: 10,
    })
    s.dispose()
  })

  it('honors a custom maxPinnedRows and invalid values fall back to default', async () => {
    const s = setup(2, 2, { rowPinConfig: { maxPinnedRows: 3 } })
    await nextTick()
    expect(s.api.topPinnedRows.value).toHaveLength(2)
    expect(s.api.bottomPinnedRows.value).toHaveLength(1)
    expect(s.onPinLimitExceeded).toHaveBeenCalledWith({
      total: 4,
      limit: 3,
      truncatedTop: 0,
      truncatedBottom: 1,
    })
    s.dispose()

    const bad = setup(2, 2, { rowPinConfig: { maxPinnedRows: 0 } })
    await nextTick()
    expect(bad.api.topPinnedRows.value).toHaveLength(2)
    expect(bad.api.bottomPinnedRows.value).toHaveLength(2)
    expect(bad.onPinLimitExceeded).not.toHaveBeenCalled()
    bad.dispose()
  })

  it('works without the callback (no throw)', async () => {
    const s = setup(40, 20, { deps: { onPinLimitExceeded: undefined } })
    await nextTick()
    expect(s.api.topPinnedRows.value).toHaveLength(40)
    expect(s.api.bottomPinnedRows.value).toHaveLength(10)
    s.dispose()
  })
})
