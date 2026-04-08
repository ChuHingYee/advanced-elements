import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useEditingBatch } from '../../src/composables/editing/use-editing-batch'

/**
 * <zh/> 批量提交 → 撤销聚合接缝对抗用例——use-editing-batch 的 onBatchCommitted 把
 * <zh/> 跨行跨字段变更按行聚合为每行一条撤销记录。目标是找出问题：聚合错位、
 * <zh/> 字段丢失、重复提交即暴露缺陷。
 * <en/> Batch-commit → undo aggregation seam adversarial cases — use-editing-batch's
 * <en/> onBatchCommitted groups cross-row/cross-field changes into ONE undo entry per row.
 * <en/> Mis-grouping, lost fields or double commits expose defects.
 */

function makeCols(keys: string[]): ProcessedColumn[] {
  return keys.map(k => ({ key: k, prop: k, label: k, editable: true })) as unknown as ProcessedColumn[]
}

function setup(rows: Record<string, any>[]) {
  const localColumns = ref(makeCols(['name', 'age']))
  const renderData = computed(() => rows)
  const tableEmit = vi.fn()
  const pushUndo = vi.fn()
  const handleCellValueChanged = vi.fn()
  const onDataUpdate = vi.fn()

  const api = useEditingBatch<any>({
    editConfig: ref({ editType: 'batch' }) as any,
    effectiveColumns: localColumns,
    renderData,
    // <zh/> deps 类型是 ComputedRef——直接读 .value，裸 getter 会静默变 undefined
    // <en/> the dep is a ComputedRef (read via .value); a bare getter silently degrades to undefined
    rowKeyFn: computed(() => (r: any) => r.id),
    tableEmit: tableEmit as any,
    validateApi: {
      errors: ref([]),
      validateAll: vi.fn(async () => true),
      clearCellError: vi.fn(),
      clearRowCrossFieldErrors: vi.fn(),
    } as any,
    onDataUpdate: onDataUpdate as any,
    handleCellValueChanged,
    pushUndo,
  })

  return { api, pushUndo, handleCellValueChanged, tableEmit }
}

describe('useEditingBatch → undo aggregation seam (adversarial)', () => {
  it('a batch commit spanning 2 rows × 2 props aggregates into ONE undo entry per row', async () => {
    // <zh/> 撤销粒度 = 每行一次批量提交：同行的全部字段变更聚合为一条记录，
    // <zh/> 字段不丢、行不错位
    // <en/> undo granularity = one entry per row: all field changes of a row aggregate into one
    // <en/> record — no lost fields, no cross-row mis-grouping
    const rows = [
      { id: 'r1', name: 'n1', age: 1 },
      { id: 'r2', name: 'n2', age: 2 },
    ]
    const { api, pushUndo, handleCellValueChanged } = setup(rows)
    api.batchRecordChange('r1', 'name', 'N1', 'n1')
    api.batchRecordChange('r1', 'age', 11, 1)
    api.batchRecordChange('r2', 'name', 'N2', 'n2')

    await api.commitBatchEdit()
    expect(pushUndo).toHaveBeenCalledTimes(2)

    const [first, second] = pushUndo.mock.calls.map(c => c[0]!)
    expect(first.rowKey).toBe('r1')
    expect(first.changes).toEqual([
      { prop: 'name', oldValue: 'n1', newValue: 'N1' },
      { prop: 'age', oldValue: 1, newValue: 11 },
    ])
    expect(second.rowKey).toBe('r2')
    expect(second.changes).toEqual([{ prop: 'name', oldValue: 'n2', newValue: 'N2' }])
    // <zh/> 正向路径同时派发 cellValueChanged（与单格编辑对齐）
    // <en/> the forward path also emits cellValueChanged (aligned with single-cell edits)
    expect(handleCellValueChanged).toHaveBeenCalledTimes(3)
  })

  it('staging edits in batch mode merges them into displayData (renderer contract)', () => {
    // <zh/> 批量模式：displayData 合并暂存变更——渲染器即时呈现未提交编辑
    // <en/> batch mode: displayData merges staged changes — the renderer shows uncommitted edits
    const rows = [{ id: 'r1', name: 'n1' }]
    const { api } = setup(rows)
    api.batchRecordChange('r1', 'name', 'M1', 'n1')
    expect(api.batchDisplayData.value[0]!.name).toBe('M1')
    // <zh/> 原始数据未被污染（缓冲语义：提交前不写数据源）
    // <en/> the raw data stays clean (buffer semantics: nothing written before commit)
    expect(rows[0]!.name).toBe('n1')
    api.cancelBatchEdit()
    expect(api.batchDisplayData.value[0]!.name).toBe('n1')
  })

  it('committing with no staged changes is a no-op (no undo entries, no events)', async () => {
    const { api, pushUndo, tableEmit } = setup([{ id: 'r1', name: 'n1' }])
    await api.commitBatchEdit()
    expect(pushUndo).not.toHaveBeenCalled()
    expect(tableEmit.mock.calls.filter(c => c[0] === 'error')).toHaveLength(0)
  })

  it('staging the SAME cell twice keeps the latest value (map semantics, not append)', () => {
    const rows = [{ id: 'r1', name: 'n1' }]
    const { api } = setup(rows)
    api.batchRecordChange('r1', 'name', 'M1', 'n1')
    api.batchRecordChange('r1', 'name', 'M2', 'n1')
    // <zh/> pendingChanges 存 prop → newValue（纯值）；旧值在内核的并行快照里（first-wins）
    // <en/> pendingChanges stores prop → newValue (bare value); old values live in the kernel's
    // <en/> parallel first-wins snapshot
    const pending = api.batchPendingChanges.value.get('r1')!
    expect(pending.name).toBe('M2')
  })

  it('cancelBatchEdit clears staged changes without firing dataChange or undo pushes', async () => {
    const rows = [{ id: 'r1', name: 'n1' }]
    const { api, pushUndo, handleCellValueChanged } = setup(rows)
    api.batchRecordChange('r1', 'name', 'M1', 'n1')
    expect(api.hasPendingChanges.value).toBe(true)

    api.cancelBatchEdit()
    expect(api.hasPendingChanges.value).toBe(false)
    expect(api.batchPendingChanges.value.size).toBe(0)
    expect(pushUndo).not.toHaveBeenCalled()
    expect(handleCellValueChanged).not.toHaveBeenCalled()
    void nextTick
  })
})
