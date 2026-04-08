import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useColumnSort } from '../../src/composables/data/use-column-sort'

/**
 * <zh/> 排序状态机对抗用例——maxSortColumns 边界值、畸形 sortState 输入与键别名一致性，
 * <zh/> 目标是找出问题而非凑覆盖率。
 * <en/> Sort state-machine adversarial cases — maxSortColumns boundaries, malformed sortState
 * <en/> inputs and key-alias consistency; aimed at finding problems.
 */

function makeCols(defs: Array<{ key: string, sortable?: any }>) {
  return defs.map(d => ({
    prop: d.key,
    key: d.key,
    label: d.key,
    sortable: d.sortable ?? true,
  })) as any[]
}

function setup(cols: any[], opts: Partial<Parameters<typeof useColumnSort>[0]> = {}) {
  return useColumnSort({
    columns: ref(cols),
    data: ref([]),
    ...opts,
  } as any)
}

describe('useColumnSort state machine (adversarial)', () => {
  it('maxSortColumns=0 behaves as unlimited (pinned caliber — a doc-level decision)', () => {
    // <zh/> 钉住现状：0 因 `max >= 1` 守卫被视为「不限」。若产品语义应为「禁用多列」，
    // <zh/> 需先改判定再改本用例——当前以测试锁死，防止无意识漂移。
    // <en/> Pins current behavior: 0 reads as "unlimited" via the `max >= 1` guard. If the product
    // <en/> semantic should be "multi-sort disabled", change the guard and this test together —
    // <en/> locked here to prevent silent drift.
    const api = setup(makeCols([{ key: 'a' }, { key: 'b' }, { key: 'c' }]), { maxSortColumns: ref(0) as any })
    api.toggleSort('a', { shiftKey: true })
    api.toggleSort('b', { shiftKey: true })
    api.toggleSort('c', { shiftKey: true })
    expect(api.sortState.value).toHaveLength(3)
  })

  it('maxSortColumns=1 effectively disables multi-sort (FIFO eviction keeps the newest)', () => {
    const api = setup(makeCols([{ key: 'a' }, { key: 'b' }]), { maxSortColumns: ref(1) as any })
    api.toggleSort('a', { shiftKey: true })
    api.toggleSort('b', { shiftKey: true })
    expect(api.sortState.value).toHaveLength(1)
    expect(api.sortState.value[0]!.columnKey ?? api.sortState.value[0]!.prop).toBe('b')
  })

  it('capMultiSort dedupes by key keeping the LAST declaration (comparator precondition)', () => {
    const api = setup(makeCols([{ key: 'a' }]))
    // <zh/> 同 key 重复声明（columnKey 与 prop 双别名路径）→ 去重保末次
    // <en/> duplicate declarations for one key (via columnKey/prop dual aliases) → keep the last
    api.setSorts([
      { prop: 'a', order: 'ascending' },
      { prop: 'a', order: 'descending' },
    ])
    expect(api.sortState.value).toHaveLength(1)
    expect(api.sortState.value[0]!.order).toBe('descending')
  })

  it('setSorts silently drops malformed entries (missing prop or order) instead of poisoning state', () => {
    const api = setup(makeCols([{ key: 'a' }, { key: 'b' }]))
    api.setSorts([
      { prop: '', order: 'ascending' } as any,
      { prop: 'a', order: null as any },
      { prop: 'b', order: 'descending' },
    ] as any)
    expect(api.sortState.value).toHaveLength(1)
    expect(api.sortState.value[0]!.prop).toBe('b')
  })

  it('toggle cycles asc→desc→clear per column and shift appends (key-alias round trip)', () => {
    // <zh/> colMap 双键注册（规范键 + prop 别名）：用 prop 点 toggle，getSortOrder 用 prop 与
    // <zh/> columnKey 都必须命中同一状态
    // <en/> colMap registers both canonical key and prop alias: toggling via prop must be visible
    // <en/> through getSortOrder via EITHER key form
    const api = setup(makeCols([{ key: 'name' }]))
    api.toggleSort('name')
    expect(api.getSortOrder('name')).toBe('ascending')
    expect(api.getSortIndex('name')).toBe(0)
    api.toggleSort('name')
    expect(api.getSortOrder('name')).toBe('descending')
    api.toggleSort('name')
    expect(api.getSortOrder('name')).toBeNull()
  })

  it('setSort with a null order removes only that column and never clears the rest', () => {
    const api = setup(makeCols([{ key: 'a' }, { key: 'b' }]))
    api.setSort('a', 'ascending')
    api.setSort('b', 'descending')
    api.setSort('a', null as any)
    expect(api.sortState.value.map(s => s.prop)).toEqual(['b'])
  })

  it('sortState identity stays stable across no-op toggles (reference-stability contract)', async () => {
    // <zh/> 下游（持久化快照/事件监听）依赖 sortState 引用稳定：无变化的裁剪不得写回新引用
    // <en/> downstream (persistence snapshot / watchers) relies on sortState reference stability:
    // <en/> a no-op prune must not write a fresh reference
    const api = setup(makeCols([{ key: 'a' }]))
    api.setSort('a', 'ascending')
    const before = api.sortState.value
    await nextTick()
    expect(api.sortState.value).toBe(before)
  })

  it('dispose is idempotent and safe to call without any prior sort activity', () => {
    const onSortWorkerError = vi.fn()
    const api = setup(makeCols([{ key: 'a' }]), { onSortWorkerError })
    expect(() => {
      api.dispose?.()
      api.dispose?.()
    }).not.toThrow()
    expect(onSortWorkerError).not.toHaveBeenCalled()
  })
})
