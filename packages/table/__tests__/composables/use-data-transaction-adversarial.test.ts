import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDataTransaction } from '../../src/composables/data/use-data-transaction'
import { resetDevWarnCacheForTests } from '../../src/utils/dev-warn'

/**
 * <zh/> 事务内核对抗用例——并发事务竞态、否决时序、writeFn 异常与 rollbackLast 边界。
 * <zh/> 目标是找出问题：数据丢失、双写、幽灵回滚即暴露缺陷。
 * <en/> Transaction-kernel adversarial cases — concurrent-transaction races, veto timing,
 * <en/> writeFn exceptions and rollbackLast boundaries. Data loss / double writes / ghost
 * <en/> rollbacks expose defects.
 */

afterEach(() => {
  resetDevWarnCacheForTests()
  vi.restoreAllMocks()
})

function setup(overrides: Record<string, unknown> = {}) {
  const emit = vi.fn()
  const beforeHook = vi.fn()
  const afterHook = vi.fn()
  const api = useDataTransaction<any>({
    emit: emit as any,
    beforeHook: beforeHook as any,
    afterHook: afterHook as any,
    ...overrides,
  })
  return { api, emit, beforeHook, afterHook }
}

describe('useDataTransaction (adversarial)', () => {
  it('a newer transaction starting mid-flight staleness-drops the older one (no double write)', async () => {
    // <zh/> 竞态契约：beforeHook await 期间有新事务开始（tid 推进）→ 旧事务放行后
    // <zh/> 在写入前的竞态检查点被丢弃——writeFn 不得执行，否则旧快照覆写新数据
    // <en/> race contract: a newer transaction (tid bump) starting during A's beforeHook await
    // <en/> staleness-drops A at the pre-write checkpoint — writeA must not run, or the stale
    // <en/> snapshot clobbers newer data
    const { api, beforeHook } = setup()
    const writeA = vi.fn()
    const writeB = vi.fn()

    let releaseBefore: (() => void) | null = null
    // <zh/> 仅第一次调用（A）挂起；B 直接放行 | <en/> only the FIRST call (A) parks; B passes through
    beforeHook.mockImplementationOnce(() => new Promise<void>((r) => {
      releaseBefore = r
    })).mockResolvedValue(undefined)

    const txA = api.executeTransaction('drag', [{ id: 'a' }], [{ id: 'a2' }], writeA)
    // <zh/> B 在 A 挂起期间完整跑完（tid 推进） | <en/> B runs to completion while A parks (tid bump)
    const okB = await api.executeTransaction('drag', [{ id: 'b' }], [{ id: 'b2' }], writeB)
    expect(okB).toBe(true)
    expect(writeB).toHaveBeenCalledTimes(1)

    releaseBefore!()
    const okA = await txA
    // <zh/> A 过期丢弃：writeA 未执行 | <en/> A stale-dropped: writeA never ran
    expect(okA).toBe(false)
    expect(writeA).not.toHaveBeenCalled()
  })

  it('beforeHook veto returns false, skips writeFn, and leaves NO rollback target', async () => {
    const { api, beforeHook } = setup()
    beforeHook.mockResolvedValue(false)
    const writeFn = vi.fn()
    const ok = await api.executeTransaction('drag', [{ id: '1' }], [{ id: '2' }], writeFn)
    expect(ok).toBe(false)
    expect(writeFn).not.toHaveBeenCalled()
    // <zh/> 否决不留下回滚目标：rollbackLast 无事可做 | <en/> a veto leaves no rollback target
    expect(api.rollbackLast()).toBe(false)
  })

  it('writeFn throwing triggers a best-effort restore through the SAME write route (ok=false)', async () => {
    // <zh/> writeFn 抛异常：内核 catch → 用 oldData **再走一次 writeFn**（部分写入防护，
    // <zh/> 路由一致）→ devWarn → 返回 false（不 reject、不留半提交、无回滚目标）
    // <en/> a throwing writeFn: the kernel catches → re-runs writeFn with oldData (partial-write
    // <en/> protection, same route) → devWarn → returns false (no reject, no half-commit, no
    // <en/> rollback target)
    const { api } = setup()
    const writeFn = vi.fn()
      .mockImplementationOnce(() => {
        throw new Error('storage full')
      })
      .mockImplementationOnce(() => {})
    const ok = await api.executeTransaction('drag', [{ id: '1' }], [{ id: '2' }], writeFn)
    expect(ok).toBe(false)
    // <zh/> 两次调用：newData（抛错）+ oldData（内核还原） | <en/> two calls: newData (threw) + oldData (kernel restore)
    expect(writeFn).toHaveBeenCalledTimes(2)
    expect(writeFn.mock.calls[1]?.[0]).toEqual([{ id: '1' }])
    expect(api.rollbackLast()).toBe(false)
  })

  it('rollbackLast restores the most recent committed snapshot exactly once (second call is a no-op)', async () => {
    const { api } = setup()
    const writes: any[][] = []
    await api.executeTransaction('drag', [{ id: '1', v: 1 }], [{ id: '1', v: 2 }], (d) => {
      writes.push(d)
    })
    await api.executeTransaction('drag', [{ id: '1', v: 2 }], [{ id: '1', v: 3 }], (d) => {
      writes.push(d)
    })
    // <zh/> 两次提交后回滚 → 用 oldData（v2 快照）**重走 writeFn**（路由一致）→ 共 3 次调用
    // <en/> after two commits, rollback re-runs writeFn with the oldData (v2 snapshot) → 3 calls total
    expect(api.rollbackLast()).toBe(true)
    expect(writes).toHaveLength(3)
    expect(writes[2]).toEqual([{ id: '1', v: 2 }])
    // <zh/> 第二次回滚无目标（单槽已消费） | <en/> the single slot is consumed
    expect(api.rollbackLast()).toBe(false)
    expect(writes).toHaveLength(3)
  })

  it('silentMiddle skips before/after hooks AND forfeits the veto (documented trade-off)', async () => {
    const { api, beforeHook, afterHook, emit } = setup()
    const writeFn = vi.fn()
    const ok = await api.executeTransaction('drag', [{ id: '1' }], [{ id: '2' }], writeFn, { silentMiddle: true })
    expect(ok).toBe(true)
    expect(writeFn).toHaveBeenCalledTimes(1)
    // <zh/> silentMiddle：before/after 均跳过，仅 dataChange 单发
    // <en/> silentMiddle: before/after skipped, dataChange fired alone
    expect(beforeHook).not.toHaveBeenCalled()
    expect(afterHook).not.toHaveBeenCalled()
    const dataChangeCalls = emit.mock.calls.filter(c => c[0] === 'dataChange')
    expect(dataChangeCalls).toHaveLength(1)
    // <zh/> 即便 emit 返回 false 也无法否决（放弃中止能力的代价，已文档化）
    // <en/> even a false-returning emit cannot veto (the documented forfeit)
    const emitVeto = setup({ emit: vi.fn(() => false) })
    const okVeto = await emitVeto.api.executeTransaction('drag', [{ id: '1' }], [{ id: '2' }], vi.fn(), { silentMiddle: true })
    expect(okVeto).toBe(true)
  })

  it('emit-return-false veto works on the default path with a legacy-mock compat devWarn', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { api, emit } = setup()
    emit.mockImplementation((event: string) => (event === 'beforeDataChange' ? false : undefined))
    const writeFn = vi.fn()
    const ok = await api.executeTransaction('drag', [{ id: '1' }], [{ id: '2' }], writeFn)
    expect(ok).toBe(false)
    expect(writeFn).not.toHaveBeenCalled()
  })
})
