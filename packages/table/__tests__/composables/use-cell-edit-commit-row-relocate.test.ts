import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useCellEditCommitRow } from '../../src/composables/editing/use-cell-edit-commit-row'
import { useCellEditLocation } from '../../src/composables/editing/use-cell-edit-location'
import { createEditRaceProtection } from '../../src/utils/edit-race-protection'

function makeDeps(overrides: Record<string, any> = {}) {
  const rows = ref([
    { id: 'r1', name: 'a' },
    { id: 'r2', name: 'b' },
  ])
  const columns = computed(() => [
    { key: 'name', prop: 'name', label: 'Name' },
  ])
  const editingRowKey = ref<string | null>('r1')
  const editingRowRef = ref<any>(rows.value[0])
  const rowKey = computed(() => (row: any) => String(row.id))
  const { resolveStaleIndex } = useCellEditLocation<any>({
    rowKey,
    editingRowKey,
    editingRowRef,
  })
  return {
    rows,
    editingRowKey,
    editingRowRef,
    deps: {
      data: computed(() => rows.value),
      columns,
      session: {
        editingValues: ref<Record<string, any>>({ name: 'a2' }),
        editingRowKey,
        editingRowRef,
        resetEditingState: vi.fn(),
        cancelDueToDataChanged: vi.fn(),
      },
      isReadOnlyEdit: computed(() => false),
      isBatchEdit: computed(() => false),
      isColumnEditable: () => true,
      validation: { handleValidationFailure: vi.fn(() => false) },
      events: { emitCellValueChanged: vi.fn(), emitRowCellsStopped: vi.fn() },
      apply: { applyChange: vi.fn(() => ({ status: 'unhandled', handled: false, applied: false })) },
      dirty: { clearDirtyCell: vi.fn() },
      cancelEditing: vi.fn(),
      raceProtection: createEditRaceProtection({ dataRef: rows }),
      resolveStaleIndex,
      validateFn: vi.fn(async () => true),
      onDataUpdate: vi.fn((next: any[]) => { rows.value = next }),
      ...overrides,
    } as any,
  }
}

describe('useCellEditCommitRow post-await relocation', () => {
  it('relocates by rowKey when rows are reordered in place during async validation', async () => {
    const { rows, deps } = makeDeps()
    let resolveValidate!: (v: boolean) => void
    deps.validateFn = vi.fn(() => new Promise<boolean>(resolve => resolveValidate = resolve))

    const { commitEditingAtRow } = useCellEditCommitRow(deps)
    const promise = commitEditingAtRow(0, 'api')
    // <zh/> 同引用原地重排（引用/长度/版本均不变），提交必须跟随逻辑行而非调用时索引 | <en/> Same-reference in-place reorder (ref/length/version unchanged); the commit must follow the logical row, not the call-time index
    const [first, second] = rows.value
    rows.value.splice(0, 2, second!, first!)
    resolveValidate(true)
    const result = await promise

    // <zh/> r1 已移到下标 1，写入必须跟随逻辑行而非旧索引 | <en/> r1 moved to index 1; the write must follow the logical row, not the stale index
    expect(deps.session.cancelDueToDataChanged).not.toHaveBeenCalled()
    expect(deps.onDataUpdate).toHaveBeenCalledTimes(1)
    expect(result.applied).toHaveLength(1)
    expect(rows.value[1]).toMatchObject({ id: 'r1', name: 'a2' })
    expect(rows.value[0]).toMatchObject({ id: 'r2', name: 'b' })
  })

  it('cancels with host notice when the row no longer matches without a rowKey', async () => {
    const { rows, deps } = makeDeps({
      // <zh/> 无 rowKey：location 退化为引用一致性校验 | <en/> No rowKey: location degrades to reference-identity check
    })
    deps.session.editingRowKey.value = null
    // <zh/> 重建无键定位器（editingRowKey null → 引用校验分支） | <en/> Rebuild keyless locator (null editingRowKey → reference-check branch)
    const { resolveStaleIndex } = useCellEditLocation<any>({
      rowKey: computed(() => null),
      editingRowKey: deps.session.editingRowKey,
      editingRowRef: deps.session.editingRowRef,
    })
    deps.resolveStaleIndex = resolveStaleIndex
    let resolveValidate!: (v: boolean) => void
    deps.validateFn = vi.fn(() => new Promise<boolean>(resolve => resolveValidate = resolve))

    const { commitEditingAtRow } = useCellEditCommitRow(deps)
    const promise = commitEditingAtRow(0, 'api')
    const [first, second] = rows.value
    rows.value.splice(0, 2, second!, first!)
    resolveValidate(true)
    const result = await promise

    // <zh/> 下标 0 已是另一行：取消并通知，不写错行 | <en/> Index 0 now holds another row: cancel with notice, never mis-write
    expect(result).toEqual({ applied: [], rejected: [] })
    expect(deps.session.cancelDueToDataChanged).toHaveBeenCalledTimes(1)
    expect(deps.onDataUpdate).not.toHaveBeenCalled()
    expect(rows.value[0]).toMatchObject({ id: 'r2', name: 'b' })
  })

  it('commits normally when data is untouched during validation', async () => {
    const { rows, deps } = makeDeps()
    const { commitEditingAtRow } = useCellEditCommitRow(deps)
    const result = await commitEditingAtRow(0, 'api')

    expect(deps.session.cancelDueToDataChanged).not.toHaveBeenCalled()
    expect(deps.onDataUpdate).toHaveBeenCalledTimes(1)
    expect(result.applied).toHaveLength(1)
    expect(rows.value[0]).toMatchObject({ id: 'r1', name: 'a2' })
  })
})
