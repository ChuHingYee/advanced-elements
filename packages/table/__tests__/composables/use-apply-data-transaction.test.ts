import type { DataTransactionOps } from '../../src/composables/data/use-apply-data-transaction'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useApplyDataTransaction } from '../../src/composables/data/use-apply-data-transaction'
import { useDataTransaction } from '../../src/composables/data/use-data-transaction'

/**
 * <zh/> AG 风格增量事务组装器测试——使用真实的 useDataTransaction 内核，
 * <zh/> 覆盖 add/update/remove 计数、键未命中 skipped、beforeDataChange 否决、写通道委托与回滚。
 *
 * <en/> Tests for the incremental transaction assembler — driven by the real useDataTransaction
 * <en/> kernel, covering add/update/remove counters, key-miss skips, beforeDataChange veto,
 * <en/> write-channel delegation and rollback.
 */
interface Row {
  id: string
  name: string
  qty?: number
}

function setup(data: Row[], options?: { vetoBefore?: boolean }) {
  const tableData = ref<Row[]>(data)
  const writes: Row[][] = []
  const emit = vi.fn((..._args: any[]) =>
    options?.vetoBefore ? false : undefined,
  ) as any

  const kernel = useDataTransaction({ tableId: 'test-tx', emit })
  const { applyTransaction } = useApplyDataTransaction<Row>({
    tableData,
    // <zh/> 写通道真实回写 tableData，使回滚语义可观察 | <en/> the write channel really writes back so rollback is observable
    writeFull: (next) => {
      writes.push(next)
      tableData.value = next
    },
    rowKeyFn: row => row.id,
    dataTransaction: kernel,
  })
  return { tableData, writes, emit, applyTransaction, rollbackLast: kernel.rollbackLast }
}

describe('useApplyDataTransaction', () => {
  it('applies add / update / remove against one snapshot and reports counters', async () => {
    const s = setup([
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
      { id: '3', name: 'c' },
    ])

    const op: DataTransactionOps<Row> = {
      update: [{ id: '2', name: 'B2', qty: 9 }],
      remove: ['1', { id: '3' } as Row],
      add: [{ id: '4', name: 'd' }],
    }
    const result = await s.applyTransaction(op)

    expect(result).toEqual({ added: 1, updated: 1, removed: 2, skipped: 0 })
    expect(s.writes[0]).toEqual([
      { id: '2', name: 'B2', qty: 9 },
      { id: '4', name: 'd' },
    ])
    expect(s.emit.mock.calls.map(c => c[0])).toEqual(['beforeDataChange', 'dataChange', 'afterDataChange'])
  })

  it('keeps original positions for updates and counts misses as skipped', async () => {
    const s = setup([{ id: '1', name: 'a' }, { id: '2', name: 'b' }])
    const result = await s.applyTransaction({
      update: [{ id: 'missing', name: 'x' }, { id: '2', name: 'B' }],
      remove: ['nope'],
    })

    expect(result).toEqual({ added: 0, updated: 1, removed: 0, skipped: 2 })
    expect(s.writes[0]).toEqual([{ id: '1', name: 'a' }, { id: '2', name: 'B' }])
  })

  it('is a no-op when every bucket is empty or absent', async () => {
    const s = setup([{ id: '1', name: 'a' }])
    const result = await s.applyTransaction({})
    expect(result).toEqual({ added: 0, updated: 0, removed: 0, skipped: 0 })
    expect(s.writes).toHaveLength(0)
    expect(s.emit).not.toHaveBeenCalled()
  })

  it('returns null and never writes when beforeDataChange vetoes', async () => {
    const s = setup([{ id: '1', name: 'a' }], { vetoBefore: true })

    const result = await s.applyTransaction({ add: [{ id: '9', name: 'z' }] })
    expect(result).toBeNull()
    expect(s.writes).toHaveLength(0)
    expect(s.tableData.value).toEqual([{ id: '1', name: 'a' }])
  })

  it('supports rollback through the underlying kernel after success', async () => {
    const s = setup([{ id: '1', name: 'a' }])
    await s.applyTransaction({ update: [{ id: '1', name: 'A1' }] })
    expect(s.tableData.value).toEqual([{ id: '1', name: 'A1' }])

    s.rollbackLast()
    expect(s.tableData.value).toEqual([{ id: '1', name: 'a' }])
  })
})
