import { describe, expect, it, vi } from 'vitest'
import { createDragGuardSession, runBeforeDragGuard } from '../../src/composables/interaction/row-drag-guard'

function makeCtx() {
  const rows = [{ id: 'a' }, { id: 'b' }]
  return {
    rows,
    ctx: { sourceRow: rows[0]!, sourceIndex: 0, targetRow: rows[1]!, targetIndex: 1, fullData: rows },
  }
}

describe('row-drag-guard', () => {
  it('commits when beforeDrag passes', async () => {
    const { rows, ctx } = makeCtx()
    const onCommit = vi.fn()
    const onReject = vi.fn()
    runBeforeDragGuard({
      session: createDragGuardSession(),
      beforeDrag: () => true,
      ctx,
      getCurrentData: () => rows,
      onCommit,
      onReject,
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onReject).not.toHaveBeenCalled()
  })

  it('rejects without committing when beforeDrag returns false', async () => {
    const { rows, ctx } = makeCtx()
    const onCommit = vi.fn()
    const onReject = vi.fn()
    runBeforeDragGuard({
      session: createDragGuardSession(),
      beforeDrag: () => false,
      ctx,
      getCurrentData: () => rows,
      onCommit,
      onReject,
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(onReject).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('drops the commit when the session version moved (late onEnd after abort)', async () => {
    const { rows, ctx } = makeCtx()
    const session = createDragGuardSession()
    const onCommit = vi.fn()
    runBeforeDragGuard({
      session,
      beforeDrag: () => true,
      ctx,
      getCurrentData: () => rows,
      onCommit,
    })
    session.version++
    await Promise.resolve()
    await Promise.resolve()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('rejects on stale snapshots when data was replaced mid-guard', async () => {
    const { ctx } = makeCtx()
    const onCommit = vi.fn()
    const onReject = vi.fn()
    runBeforeDragGuard({
      session: createDragGuardSession(),
      beforeDrag: () => true,
      ctx,
      getCurrentData: () => [{ id: 'a' }, { id: 'b' }],
      onCommit,
      onReject,
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(onReject).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('surfaces sync throws via onError and resets the commit flag', async () => {
    const { rows, ctx } = makeCtx()
    const session = createDragGuardSession()
    const onError = vi.fn()
    const onCommit = vi.fn()
    runBeforeDragGuard({
      session,
      beforeDrag: () => { throw new Error('boom') },
      ctx,
      getCurrentData: () => rows,
      onCommit,
      onError,
      useCommitFlag: true,
    })
    expect(session.committing).toBe(false)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('routes an async rejection through onReject and onError after clearing the commit flag', async () => {
    const { rows, ctx } = makeCtx()
    const session = createDragGuardSession()
    const error = new Error('async guard failed')
    let rejectGuard!: (reason: unknown) => void
    const pending = new Promise<boolean>((_resolve, reject) => {
      rejectGuard = reject
    })
    const onCommit = vi.fn()
    const onReject = vi.fn(() => {
      expect(session.committing).toBe(false)
    })
    const onError = vi.fn(() => {
      expect(session.committing).toBe(false)
      expect(onReject).toHaveBeenCalledTimes(1)
    })
    runBeforeDragGuard({
      session,
      beforeDrag: () => pending,
      ctx,
      getCurrentData: () => rows,
      onCommit,
      onReject,
      onError,
      useCommitFlag: true,
    })
    expect(session.committing).toBe(true)
    expect(onReject).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    rejectGuard(error)
    await Promise.resolve()
    await Promise.resolve()
    expect(session.committing).toBe(false)
    expect(onReject).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, 'beforeDrag')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('toggles the commit flag around an async pass', async () => {
    const { rows, ctx } = makeCtx()
    const session = createDragGuardSession()
    const seen: boolean[] = []
    runBeforeDragGuard({
      session,
      beforeDrag: () => true,
      ctx,
      getCurrentData: () => rows,
      onCommit: () => { seen.push(session.committing) },
      useCommitFlag: true,
    })
    expect(session.committing).toBe(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(session.committing).toBe(false)
    expect(seen).toEqual([false])
  })
})
