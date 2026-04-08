import type {
  DefaultRegimeDeps,
  PerformVirtualReorderArgs,
  SortableEndEvent,
  SuppressMoveRegimeDeps,
  VirtualRegimeDeps,
} from '../../src/composables/interaction/row-drag-regimes'
import { describe, expect, it, vi } from 'vitest'
import { createDragGuardSession } from '../../src/composables/interaction/row-drag-guard'
import {
  checkDropValidity,
  createDragGestureState,
  endDefaultDrag,
  endSuppressMoveDrag,
  endVirtualDrag,
  performVirtualReorder,
} from '../../src/composables/interaction/row-drag-regimes'

interface Row {
  id: string
}

function makeRows(): Row[] {
  return [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
}

function deferredGuard() {
  let resolve!: (value: boolean) => void
  const promise = new Promise<boolean>((done) => {
    resolve = done
  })
  return { resolve, beforeDrag: vi.fn(() => promise) }
}

function baseArgs(overrides: Partial<PerformVirtualReorderArgs<Row>> = {}): PerformVirtualReorderArgs<Row> {
  const currentFullData = makeRows()
  return {
    session: createDragGuardSession(),
    getRowMap: () => new Map(currentFullData.map(r => [r.id, r])),
    sourceKey: 'a',
    targetKey: 'b',
    currentFullData,
    getLiveData: () => currentFullData,
    getKeyFn: row => row.id,
    targetSemantics: 'after',
    dragRefs: { container: null, item: null },
    rollbackDomOrder: vi.fn(),
    onDataReorder: vi.fn(),
    markReordered: vi.fn(),
    ...overrides,
  }
}

function makeRegime(fullData = makeRows()) {
  let liveData = fullData
  const from = document.createElement('div')
  const elements = ['a', 'b', 'c'].map((key) => {
    const el = document.createElement('div')
    el.dataset.key = key
    return el
  })
  from.append(...elements)
  const item = elements[0]!
  from.appendChild(item)
  const getDomKeys = () => Array.from(from.children, el => el.getAttribute('data-key'))
  const gesture = createDragGestureState()
  gesture.originalKeys = ['a', 'b', 'c']
  gesture.lastTargetKey = 'c'
  gesture.dragContainerEl = from
  gesture.dragItemEl = item
  const evt: SortableEndEvent = { from, item, oldIndex: 0, newIndex: 2 }
  const deps: DefaultRegimeDeps<Row> & SuppressMoveRegimeDeps<Row> & VirtualRegimeDeps<Row> = {
    gesture,
    session: createDragGuardSession(),
    getLiveData: () => liveData,
    getKeyFn: () => row => row.id,
    getRowMap: () => new Map(liveData.map(row => [row.id, row])),
    getCurrentRowKeys: vi.fn(() => Array.from(from.children, el => el.getAttribute('data-key')!)),
    onDataReorder: vi.fn((rows) => { liveData = rows }),
    onRowDragEnd: vi.fn(),
    onDragError: vi.fn(),
    clearAllDragClasses: vi.fn(),
    isSuppressMove: () => false,
    detachTransientListeners: vi.fn(),
    convergeDragEnd: vi.fn(),
    cancelVisibleRowRefresh: vi.fn(),
  }
  const replaceData = (rows: Row[]) => {
    liveData = rows
  }
  return { deps, evt, fullData, getDomKeys, replaceData }
}

describe('row-drag-regimes', () => {
  it('moves the source after the target without a guard', () => {
    const args = baseArgs()
    expect(performVirtualReorder(args)).toBe(true)
    expect(args.onDataReorder).toHaveBeenCalledExactlyOnceWith([
      args.currentFullData[1],
      args.currentFullData[0],
      args.currentFullData[2],
    ])
    expect(args.currentFullData.map(row => row.id)).toEqual(['a', 'b', 'c'])
    expect(args.markReordered).not.toHaveBeenCalled()
  })

  it.each([
    { targetKey: '' },
    { targetKey: 'a' },
    { targetKey: 'zz' },
    { sourceKey: 'zz' },
  ])('rejects invalid virtual moves: %j', (overrides) => {
    const args = baseArgs(overrides)
    expect(performVirtualReorder(args)).toBe(false)
    expect(args.onDataReorder).not.toHaveBeenCalled()
    expect(args.markReordered).not.toHaveBeenCalled()
  })

  it('runs the virtual guard and rolls back the DOM on rejection', async () => {
    const container = document.createElement('div')
    const item = document.createElement('div')
    const onRowDragEnd = vi.fn()
    const args = baseArgs({
      beforeDrag: () => false,
      dragRefs: { container, item },
      onRowDragEnd,
    })
    expect(performVirtualReorder(args)).toBe(true)
    expect(args.markReordered).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    await Promise.resolve()
    expect(args.rollbackDomOrder).toHaveBeenCalledExactlyOnceWith({ from: container, item }, 0)
    expect(args.onDataReorder).not.toHaveBeenCalled()
    expect(onRowDragEnd).not.toHaveBeenCalled()
  })

  it.each([false, true])('emits virtual drag end after commit (guarded: %s)', async (guarded) => {
    const guard = deferredGuard()
    const args = baseArgs({ beforeDrag: guarded ? guard.beforeDrag : undefined })
    let liveData = args.currentFullData
    const expected = [
      liveData[1],
      liveData[0],
      liveData[2],
    ]
    args.getLiveData = () => liveData
    args.onDataReorder = vi.fn((rows) => {
      liveData = rows
    })
    args.dragEvent = new MouseEvent('mouseup')
    args.onRowDragEnd = vi.fn(() => {
      expect(args.onDataReorder).toHaveBeenCalledExactlyOnceWith(expected)
      expect(liveData).toEqual(expected)
    })
    expect(performVirtualReorder(args)).toBe(true)
    if (guarded) {
      expect(args.markReordered).toHaveBeenCalledTimes(1)
      expect(args.session.committing).toBe(false)
      expect(args.onDataReorder).not.toHaveBeenCalled()
      expect(args.onRowDragEnd).not.toHaveBeenCalled()
      expect(guard.beforeDrag).toHaveBeenCalledExactlyOnceWith({
        sourceRow: args.currentFullData[0],
        sourceIndex: 0,
        targetRow: args.currentFullData[1],
        targetIndex: 1,
        fullData: args.currentFullData,
      })
      guard.resolve(true)
      await Promise.resolve()
      await Promise.resolve()
    }
    expect(args.onDataReorder).toHaveBeenCalledTimes(1)
    expect(args.onRowDragEnd).toHaveBeenCalledExactlyOnceWith({
      sourceRow: args.currentFullData[0],
      sourceIndex: 0,
      targetRow: args.currentFullData[1],
      targetIndex: 1,
      event: args.dragEvent,
    })
  })

  it('commits a virtual move with a nullable target missing only from the row map', () => {
    const beforeDrag = vi.fn(() => true)
    const args = baseArgs({ beforeDrag })
    args.getRowMap = () => new Map([['a', args.currentFullData[0]!]])
    args.onRowDragEnd = vi.fn(() => {
      expect(args.onDataReorder).toHaveBeenCalledTimes(1)
    })
    expect(performVirtualReorder(args)).toBe(true)
    expect(beforeDrag).not.toHaveBeenCalled()
    expect(args.markReordered).not.toHaveBeenCalled()
    expect(args.onDataReorder).toHaveBeenCalledExactlyOnceWith([
      args.currentFullData[1],
      args.currentFullData[0],
      args.currentFullData[2],
    ])
    expect(args.onRowDragEnd).toHaveBeenCalledExactlyOnceWith({
      sourceRow: args.currentFullData[0],
      sourceIndex: 0,
      targetRow: null,
      targetIndex: 1,
      event: undefined,
    })
  })

  it('rejects stale virtual data after an async guard using live rollback refs', async () => {
    const guard = deferredGuard()
    const args = baseArgs({ beforeDrag: guard.beforeDrag, onRowDragEnd: vi.fn() })
    let liveData = args.currentFullData
    args.getLiveData = () => liveData
    expect(performVirtualReorder(args)).toBe(true)
    const replacement = makeRows()
    liveData = replacement
    const container = document.createElement('div')
    const item = document.createElement('div')
    args.dragRefs.container = container
    args.dragRefs.item = item
    guard.resolve(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(args.onDataReorder).not.toHaveBeenCalled()
    expect(args.onRowDragEnd).not.toHaveBeenCalled()
    expect(args.rollbackDomOrder).toHaveBeenCalledExactlyOnceWith({ from: container, item }, 0)
    expect(liveData).toBe(replacement)
  })

  it.each([false, true])('snapshots default visible order before rollback and emits before commit (guarded: %s)', async (guarded) => {
    const hidden = { id: 'hidden' }
    const rows = makeRows()
    const { deps, evt, fullData, getDomKeys } = makeRegime([rows[0]!, hidden, rows[1]!, rows[2]!])
    const guard = deferredGuard()
    deps.beforeDrag = guarded ? guard.beforeDrag : undefined
    deps.onRowDragEnd = vi.fn(() => {
      expect(getDomKeys()).toEqual(['a', 'b', 'c'])
      expect(deps.getLiveData()).toBe(fullData)
      expect(deps.onDataReorder).not.toHaveBeenCalled()
    })
    expect(getDomKeys()).toEqual(['b', 'c', 'a'])
    endDefaultDrag(evt, deps)
    expect(getDomKeys()).toEqual(['a', 'b', 'c'])
    expect(deps.gesture.lastTargetKey).toBe('')
    expect(deps.getCurrentRowKeys).toHaveBeenCalledTimes(1)
    if (guarded) {
      expect(deps.session.committing).toBe(true)
      expect(deps.onDataReorder).not.toHaveBeenCalled()
      expect(deps.onRowDragEnd).not.toHaveBeenCalled()
      expect(guard.beforeDrag).toHaveBeenCalledExactlyOnceWith({
        sourceRow: rows[0],
        sourceIndex: 0,
        targetRow: rows[2],
        targetIndex: 2,
        fullData,
      })
      guard.resolve(true)
      await Promise.resolve()
      await Promise.resolve()
    }
    expect(deps.session.committing).toBe(false)
    expect(deps.onRowDragEnd).toHaveBeenCalledExactlyOnceWith({
      sourceRow: rows[0],
      sourceIndex: 0,
      targetRow: rows[2],
      targetIndex: 2,
      event: evt,
    })
    expect(deps.onDataReorder).toHaveBeenCalledExactlyOnceWith([rows[1], hidden, rows[2], rows[0]])
    expect(deps.getLiveData()[1]).toBe(hidden)
    expect(fullData).toEqual([rows[0], hidden, rows[1], rows[2]])
    expect(deps.onDragError).not.toHaveBeenCalled()
  })

  it.each(['out-of-range', 'missing-row', 'same-source'] as const)('emits a null default target without guarding or committing: %s', (reason) => {
    const { deps, evt, fullData, getDomKeys } = makeRegime()
    const beforeDrag = vi.fn(() => true)
    deps.beforeDrag = beforeDrag
    if (reason === 'out-of-range')
      evt.newIndex = 10
    else if (reason === 'missing-row')
      deps.getRowMap = () => new Map([['a', fullData[0]!], ['b', fullData[1]!]])
    else
      deps.gesture.originalKeys[2] = 'a'
    deps.onRowDragEnd = vi.fn(() => {
      expect(getDomKeys()).toEqual(['a', 'b', 'c'])
    })
    endDefaultDrag(evt, deps)
    expect(beforeDrag).not.toHaveBeenCalled()
    expect(deps.onDataReorder).not.toHaveBeenCalled()
    expect(deps.getLiveData()).toBe(fullData)
    expect(deps.session.committing).toBe(false)
    expect(deps.gesture.lastTargetKey).toBe('')
    expect(deps.onRowDragEnd).toHaveBeenCalledExactlyOnceWith({
      sourceRow: fullData[0],
      sourceIndex: 0,
      targetRow: null,
      targetIndex: evt.newIndex,
      event: evt,
    })
  })

  it('does not overwrite replacement data when the default async guard accepts a stale snapshot', async () => {
    const { deps, evt, fullData, getDomKeys, replaceData } = makeRegime()
    const guard = deferredGuard()
    deps.beforeDrag = guard.beforeDrag
    endDefaultDrag(evt, deps)
    expect(deps.session.committing).toBe(true)
    expect(getDomKeys()).toEqual(['a', 'b', 'c'])
    expect(deps.onDataReorder).not.toHaveBeenCalled()
    const replacement = fullData.slice()
    replaceData(replacement)
    guard.resolve(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(deps.session.committing).toBe(false)
    expect(deps.onDataReorder).not.toHaveBeenCalled()
    expect(deps.onRowDragEnd).not.toHaveBeenCalled()
    expect(deps.onDragError).not.toHaveBeenCalled()
    expect(deps.getLiveData()).toBe(replacement)
    expect(getDomKeys()).toEqual(['a', 'b', 'c'])
  })

  it.each([
    { position: 'before' as const, expected: ['b', 'a', 'c'] },
    { position: 'after' as const, expected: ['b', 'c', 'a'] },
  ])('suppressMove commits $position the target after rollback and event emission', ({ position, expected }) => {
    const { deps, evt, fullData, getDomKeys } = makeRegime()
    deps.gesture.dropPosition = position
    deps.dropValidator = vi.fn(() => {
      expect(getDomKeys()).toEqual(['a', 'b', 'c'])
      expect(deps.clearAllDragClasses).toHaveBeenCalledTimes(1)
      return true
    })
    deps.onRowDragEnd = vi.fn(() => {
      expect(deps.getLiveData()).toBe(fullData)
      expect(deps.onDataReorder).not.toHaveBeenCalled()
    })
    endSuppressMoveDrag(evt, deps)
    expect(deps.dropValidator).toHaveBeenCalledExactlyOnceWith({ sourceRow: fullData[0], targetRow: fullData[2], position })
    expect(deps.onRowDragEnd).toHaveBeenCalledExactlyOnceWith({
      sourceRow: fullData[0],
      sourceIndex: 0,
      targetRow: fullData[2],
      targetIndex: 2,
      event: evt,
    })
    expect(deps.onDataReorder).toHaveBeenCalledTimes(1)
    expect(deps.getLiveData().map(row => row.id)).toEqual(expected)
    expect(deps.gesture.lastTargetKey).toBe('')
    expect(getDomKeys()).toEqual(['a', 'b', 'c'])
  })

  it.each([
    { initial: 'before' as const, live: 'after' as const, expected: ['b', 'c', 'a'] },
    { initial: 'after' as const, live: 'before' as const, expected: ['b', 'a', 'c'] },
  ])('suppressMove validates $initial but reads live $live position after its async guard', async ({ initial, live, expected }) => {
    const { deps, evt, fullData, getDomKeys } = makeRegime()
    const guard = deferredGuard()
    deps.beforeDrag = guard.beforeDrag
    deps.gesture.dropPosition = initial
    deps.dropValidator = vi.fn(() => true)
    deps.onRowDragEnd = vi.fn(() => {
      expect(deps.session.committing).toBe(false)
      expect(deps.onDataReorder).not.toHaveBeenCalled()
      expect(deps.getLiveData()).toBe(fullData)
    })
    endSuppressMoveDrag(evt, deps)
    expect(deps.dropValidator).toHaveBeenCalledExactlyOnceWith({ sourceRow: fullData[0], targetRow: fullData[2], position: initial })
    expect(guard.beforeDrag).toHaveBeenCalledExactlyOnceWith({
      sourceRow: fullData[0],
      sourceIndex: 0,
      targetRow: fullData[2],
      targetIndex: 2,
      fullData,
    })
    expect(deps.session.committing).toBe(true)
    expect(deps.onDataReorder).not.toHaveBeenCalled()
    expect(deps.onRowDragEnd).not.toHaveBeenCalled()
    expect(getDomKeys()).toEqual(['a', 'b', 'c'])
    deps.gesture.dropPosition = live
    guard.resolve(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(deps.session.committing).toBe(false)
    expect(deps.onRowDragEnd).toHaveBeenCalledExactlyOnceWith({
      sourceRow: fullData[0],
      sourceIndex: 0,
      targetRow: fullData[2],
      targetIndex: 2,
      event: evt,
    })
    expect(deps.onDataReorder).toHaveBeenCalledTimes(1)
    expect(deps.getLiveData().map(row => row.id)).toEqual(expected)
    expect(deps.dropValidator).toHaveBeenCalledTimes(1)
    expect(deps.onDragError).not.toHaveBeenCalled()
  })

  it('ends a virtual drag with one commit and clears transient gesture state', () => {
    const { deps, evt, fullData, getDomKeys } = makeRegime()
    deps.gesture.cachedVisibleRows = [evt.item]
    deps.gesture.virtualDragSourceKey = 'a'
    deps.onRowDragEnd = vi.fn(() => {
      expect(deps.onDataReorder).toHaveBeenCalledTimes(1)
      expect(deps.getLiveData()).toEqual([fullData[1], fullData[2], fullData[0]])
    })
    endVirtualDrag(evt, deps)
    expect(deps.onRowDragEnd).toHaveBeenCalledExactlyOnceWith({
      sourceRow: fullData[0],
      sourceIndex: 0,
      targetRow: fullData[2],
      targetIndex: 2,
      event: evt,
    })
    expect(getDomKeys()).toEqual(['a', 'b', 'c'])
    expect(deps.clearAllDragClasses).toHaveBeenCalledTimes(1)
    expect(deps.detachTransientListeners).toHaveBeenCalledTimes(1)
    expect(deps.convergeDragEnd).toHaveBeenCalledTimes(1)
    expect(deps.cancelVisibleRowRefresh).toHaveBeenCalledTimes(1)
    expect(deps.gesture.reorderProcessed).toBe(true)
    expect(deps.gesture.cachedVisibleRows).toBeNull()
    expect(deps.gesture.virtualDragSourceKey).toBe('')
    expect(deps.gesture.lastTargetKey).toBe('')
    deps.gesture.lastTargetKey = 'b'
    endVirtualDrag(evt, deps)
    expect(deps.onDataReorder).toHaveBeenCalledTimes(1)
    expect(deps.onRowDragEnd).toHaveBeenCalledTimes(1)
  })

  it('checkDropValidity abstains without validator or rows', () => {
    expect(checkDropValidity(undefined, undefined, 'a', 'b', 'before')).toBe(true)
    const map = new Map([['a', { id: 'a' }]])
    const validator = vi.fn(() => false)
    expect(checkDropValidity(validator, undefined, 'a', 'b', 'before')).toBe(true)
    expect(checkDropValidity(validator, () => map, 'a', 'zz', 'before')).toBe(true)
    expect(validator).not.toHaveBeenCalled()
    expect(checkDropValidity(validator, () => map, 'a', 'a', 'before')).toBe(false)
    expect(validator).toHaveBeenCalledExactlyOnceWith({ sourceRow: map.get('a'), targetRow: map.get('a'), position: 'before' })
    expect(checkDropValidity(
      ({ position }) => position === 'before',
      () => map,
      'a',
      'a',
      'after',
    )).toBe(false)
  })
})
