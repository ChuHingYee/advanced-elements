import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useBatchCommit } from '../../src/composables/editing/use-batch-commit'

function makeDeps(overrides: Record<string, any> = {}) {
  const rows = ref([
    { id: 'r1', name: 'a' },
    { id: 'r2', name: 'b' },
  ])
  const columns = computed(() => [
    { key: 'name', prop: 'name', label: 'Name', editorRules: { required: true } },
  ])
  return {
    rows,
    deps: {
      data: computed(() => rows.value),
      columns,
      validateFn: vi.fn(async () => true),
      applyChange: vi.fn(() => ({ status: 'unhandled', handled: false, applied: false })),
      clearDirtyCell: vi.fn(),
      pushUndo: vi.fn(),
      rowKey: computed(() => (row: any) => String(row.id)),
      onCellValueChanged: vi.fn(),
      onEditCancelled: vi.fn(),
      isUnmounted: () => false,
      onDataUpdate: vi.fn(),
      ...overrides,
    } as any,
  }
}

describe('useBatchCommit Phase-B data-replacement guard', () => {
  it('aborts the batch and notifies when data is replaced during async validation', async () => {
    const { rows, deps } = makeDeps()
    let resolveValidate!: (v: boolean) => void
    deps.validateFn = vi.fn(() => new Promise<boolean>(resolve => resolveValidate = resolve))

    const { batchCommitCells } = useBatchCommit(deps)
    const promise = batchCommitCells([
      { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'a2' },
    ])
    // <zh/> 校验挂起期间模拟翻页/刷新整体替换数据 | <en/> Simulate page change wholesale-replacing data while validation is pending
    rows.value = [
      { id: 'r1', name: 'server-new-a' },
      { id: 'r2', name: 'server-new-b' },
    ]
    resolveValidate(true)
    const result = await promise

    // <zh/> 与 unmount 分支同协议：空结果 + data-changed 通知，不写数据
    // <en/> Same protocol as the unmount branch: empty result + data-changed notice, no write
    expect(result).toEqual({ applied: [], rejected: [] })
    expect(deps.onEditCancelled).toHaveBeenCalledTimes(1)
    expect(deps.onEditCancelled).toHaveBeenCalledWith({ reason: 'data-changed' })
    expect(deps.onDataUpdate).not.toHaveBeenCalled()
    expect(rows.value[0]).toEqual({ id: 'r1', name: 'server-new-a' })
  })

  it('commits normally when data is untouched during validation', async () => {
    const { rows, deps } = makeDeps()
    const { batchCommitCells } = useBatchCommit(deps)
    const result = await batchCommitCells([
      { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'a2' },
    ])

    expect(deps.onEditCancelled).not.toHaveBeenCalled()
    expect(deps.onDataUpdate).toHaveBeenCalledTimes(1)
    expect(result.applied).toHaveLength(1)
    expect(rows.value).toHaveLength(2)
  })

  it('also aborts on same-identity length change (in-place splice)', async () => {
    const { rows, deps } = makeDeps()
    let resolveValidate!: (v: boolean) => void
    deps.validateFn = vi.fn(() => new Promise<boolean>(resolve => resolveValidate = resolve))

    const { batchCommitCells } = useBatchCommit(deps)
    const promise = batchCommitCells([
      { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'a2' },
    ])
    rows.value.splice(0, 1)
    resolveValidate(true)
    const result = await promise

    expect(result).toEqual({ applied: [], rejected: [] })
    expect(deps.onEditCancelled).toHaveBeenCalledWith({ reason: 'data-changed' })
    expect(deps.onDataUpdate).not.toHaveBeenCalled()
  })
})
