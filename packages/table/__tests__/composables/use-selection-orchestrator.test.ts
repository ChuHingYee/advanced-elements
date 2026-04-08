import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useSelectionOrchestrator } from '../../src/composables/selection/use-selection-orchestrator'
import { DEFAULT_RENDERER_CAPS } from '../../src/types/renderer-caps'

/**
 * <zh/> 选择编排器单测——真实子 composable，覆盖事件契约、反选与当前行。
 * <en/> Selection-orchestrator tests with real sub-composables — event contract, invert and currentRow.
 */
interface Row {
  id: number
  name: string
}

const rows: Row[] = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
]

function setupOrchestrator(opts: {
  rowSelection?: 'single' | 'multiple'
  keepSelectionAcrossPages?: boolean
  selectedRowKeys?: () => any
  selectable?: (row: Row) => boolean
} = {}) {
  const emit = vi.fn()
  const tableData = ref<Row[]>([...rows])
  const keyToRow = new Map(tableData.value.map(r => [String(r.id), r]))
  const keyToIndex = new Map(tableData.value.map((r, i) => [String(r.id), i]))
  const rowKeyMeta = ref({ keyToRow, keyToIndex })
  const api = useSelectionOrchestrator<Row>({
    rowKeyFn: computed(() => (row: Row) => String(row.id)),
    tableData: tableData as any,
    rowKeyMeta: rowKeyMeta as any,
    selectableFn: computed(() => (opts.selectable ? (row: Row) => opts.selectable!(row) : undefined)),
    mergedRowConfig: computed(() => ({
      rowSelection: opts.rowSelection ?? 'multiple',
      keepSelectionAcrossPages: opts.keepSelectionAcrossPages ?? false,
    }) as any),
    selectedRowKeys: opts.selectedRowKeys ?? (() => undefined),
    visibleData: () => tableData.value,
    finalDisplayData: () => tableData.value,
    caps: DEFAULT_RENDERER_CAPS,
    treeApi: { treeEnabled: computed(() => false), checkStrictly: computed(() => false) } as any,
    tableId: computed(() => 't1'),
    emit: emit as any,
  })
  return { api, emit, tableData }
}

describe('useSelectionOrchestrator wiring', () => {
  it('exposes selection state and batch helpers', () => {
    const { api } = setupOrchestrator()
    expect(api.selectionState).toBeDefined()
    for (const fn of [api.toggleAllSelection, api.selectAll, api.invertSelection, api.refreshSelection] as const)
      expect(typeof fn).toBe('function')
    expect(api.getCurrentRow()).toBeNull()
  })

  it('owns the currentRow single source of truth', () => {
    const { api } = setupOrchestrator()
    api.setCurrentRow(rows[1])
    expect(api.getCurrentRow()).toBe(rows[1])
    expect(api.currentRowRef.value).toBe(rows[1])
  })

  it('appends tableId as the trailing event arg', () => {
    const { api, emit } = setupOrchestrator()
    api.selectionState.toggleRowSelection(rows[0], true)
    const call = emit.mock.calls.find(c => c[0] === 'selectionChange')
    expect(call).toBeDefined()
    expect(call![call!.length - 1]).toBe('t1')
  })

  it('inverts visible selection', () => {
    const { api } = setupOrchestrator()
    api.selectionState.toggleRowSelection(rows[0], true)
    expect([...api.selectionState.selectedKeys.value].sort()).toEqual(['1'])
    api.invertSelection()
    expect([...api.selectionState.selectedKeys.value].sort()).toEqual(['2', '3'])
  })

  it('invertSelection respects the selectable predicate', () => {
    const { api } = setupOrchestrator({ selectable: row => row.id !== 2 })
    api.invertSelection()
    expect([...api.selectionState.selectedKeys.value].sort()).toEqual(['1', '3'])
  })

  it('selectAll selects every visible row', () => {
    const { api } = setupOrchestrator()
    api.selectAll()
    expect([...api.selectionState.selectedKeys.value].sort()).toEqual(['1', '2', '3'])
  })

  it('refreshSelection syncs external keys inward', () => {
    const { api } = setupOrchestrator({ selectedRowKeys: () => ['2'] })
    api.refreshSelection()
    expect([...api.selectionState.selectedKeys.value]).toEqual(['2'])
  })
})
