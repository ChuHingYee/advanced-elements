import { describe, expect, it, vi } from 'vitest'
import { useDataTransaction } from '../../src/composables/data/use-data-transaction'

/**
 * 事务 hook 增强——oldData 真实快照语义 + 写入失败回滚 + rollbackLast()
 */
describe('useDataTransaction — snapshot & rollback', () => {
  function makeTx(emit = vi.fn()) {
    return { tx: useDataTransaction<any>({ tableId: 't1', emit }), emit }
  }

  it('write failure rolls back to old data and returns false', async () => {
    const { tx } = makeTx()
    const current = [{ id: 1 }]
    // 写入新数据时抛错；回写旧数据（restore）成功
    const writeFn = vi.fn((data: any[]) => {
      if (data !== current)
        throw new Error('disk full')
    })

    const ok = await tx.executeTransaction('edit', current, [{ id: 2 }], writeFn)

    expect(ok).toBe(false)
    // 首次写入（新数据）失败 + 失败后回写（旧数据）
    expect(writeFn).toHaveBeenCalledTimes(2)
    expect(writeFn).toHaveBeenNthCalledWith(2, current)
  })

  it('rollbackLast re-applies old data of the last committed transaction', async () => {
    const { tx } = makeTx()
    const applied: any[][] = []
    const writeFn = vi.fn((data: any[]) => applied.push(data))

    await tx.executeTransaction('edit', [{ v: 1 }], [{ v: 2 }], writeFn)
    expect(applied).toEqual([[{ v: 2 }]])

    expect(tx.rollbackLast()).toBe(true)
    expect(applied.at(-1)).toEqual([{ v: 1 }])
    // 已消费——二次回滚返回 false
    expect(tx.rollbackLast()).toBe(false)
  })

  it('beforeDataChange veto skips writes and leaves no rollback target', async () => {
    const emit = vi.fn((_evt: string, _p: unknown, _tid?: string) => false)
    const { tx } = makeTx(emit as any)
    const writeFn = vi.fn()

    const ok = await tx.executeTransaction('edit', [], [{ v: 1 }], writeFn)

    expect(ok).toBe(false)
    expect(writeFn).not.toHaveBeenCalled()
    expect(tx.rollbackLast()).toBe(false)
  })

  it('silentMiddle skips before/after and emits dataChange only', async () => {
    const seen: string[] = []
    const emit = vi.fn((evt: string) => {
      seen.push(evt)
    })
    const { tx } = makeTx(emit as any)
    const writeFn = vi.fn()

    const ok = await tx.executeTransaction('batch', [{ v: 1 }], [{ v: 2 }], writeFn, { silentMiddle: true })

    expect(ok).toBe(true)
    expect(writeFn).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['dataChange'])
  })

  it('default mode still fires before/dataChange/after in order', async () => {
    const seen: string[] = []
    const emit = vi.fn((evt: string) => {
      seen.push(evt)
    })
    const { tx } = makeTx(emit as any)

    await tx.executeTransaction('edit', [{ v: 1 }], [{ v: 2 }], vi.fn())

    expect(seen).toEqual(['beforeDataChange', 'dataChange', 'afterDataChange'])
  })
})
