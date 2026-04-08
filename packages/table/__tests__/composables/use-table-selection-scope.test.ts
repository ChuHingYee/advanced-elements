import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useTableSelection } from '../../src/composables/selection/use-table-selection'
import { DEFAULT_RENDERER_CAPS, VIRTUAL_RENDERER_CAPS } from '../../src/types/renderer-caps'

/**
 * <zh/> 真实链路（不 mock useSelectionState）——验证 Shift 范围与全选/checkStatus 同作用域，
 * <zh/> 且 selectionChange 的 rows/meta 双载荷端到端贯通。
 * <en/> Real chain (no useSelectionState mock) — Shift ranges share the select-all/checkStatus
 * <en/> scope, and selectionChange rows/meta flow end to end.
 */
function createReal(caps: typeof DEFAULT_RENDERER_CAPS = DEFAULT_RENDERER_CAPS) {
  const all = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }]
  // <zh/> default 下可见集即当页（过滤视图），virtual 下为全量筛选结果 | <en/> Visible set is the current page under default, the full filtered set under virtual
  const visible = caps.selectionScope === 'filtered' ? all : [all[0]!, all[2]!, all[4]!]
  const rowKey = computed(() => (row: any) => String(row.id))
  const rowKeyMeta = ref({
    keyToRow: new Map(all.map(r => [r.id, r] as const)),
    keyToIndex: new Map(all.map((r, i) => [r.id, i] as const)),
  })
  const onSelectionChange = vi.fn()
  const sel = useTableSelection({
    rowKey,
    allData: ref(all),
    rowKeyMeta,
    selectableFn: computed(() => undefined),
    selectionMode: computed(() => 'multiple' as const),
    rowMultiSelectWithClick: computed(() => true),
    selectedRowKeys: () => undefined,
    visibleData: () => visible,
    finalDisplayData: () => all,
    caps,
    onSelectionChange,
    onSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onRowSelected: vi.fn(),
  })
  return { sel, all, visible, onSelectionChange }
}

describe('useTableSelection shift scope (real chain)', () => {
  it('default mode shift-click stays within the current page', () => {
    const { sel, visible, onSelectionChange } = createReal(DEFAULT_RENDERER_CAPS)
    sel.selectionState.toggleRowSelection(visible[0]!, true, false, {})
    sel.selectionState.toggleRowSelection(visible[2]!, true, false, { shiftKey: true })

    expect([...sel.selectionState.getSelectedKeys()].sort()).toEqual(['1', '3', '5'])
    // <zh/> rows/meta 双载荷贯通 | <en/> rows/meta payloads flow through
    const lastCall = onSelectionChange.mock.calls.at(-1)!
    expect(lastCall[0].map((r: any) => r.id).sort()).toEqual(['1', '3', '5'])
    expect(lastCall[1]).toEqual({ keys: ['1', '3', '5'], count: 3 })
  })

  it('virtual mode shift-click spans the whole filtered set', () => {
    const { sel } = createReal(VIRTUAL_RENDERER_CAPS)
    sel.selectionState.toggleRowSelection(sel.getCurrentPageData()[0]!, true, false, {})
    const all = sel.getCurrentPageData()
    sel.selectionState.toggleRowSelection(all[all.length - 1]!, true, false, { shiftKey: true })

    expect([...sel.selectionState.getSelectedKeys()].sort()).toEqual(['1', '2', '3', '4', '5'])
  })
})
