import type { UseSelectionStateEmits } from '../../src/composables/selection/selection-types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  createSafeEmits,
  createSelectionMutationGuard,
  safeNotify,
} from '../../src/composables/selection/selection-mutation-guard'
import { useSelectionState } from '../../src/composables/selection/use-selection-state'

/**
 * <zh/> 选中变更守卫的回归测试。
 *
 * <zh/> 重点锁定一处**重入缺陷**：守卫原先用布尔标志，批量入口
 * <zh/> （`batchSelectionUpdate` → 内层 `toggleRowSelection`）嵌套调用时，内层 `finally`
 * <zh/> 会把标志提前复位为 false，导致批量操作**从第 2 行起守卫静默失效**。
 * <zh/> 现改为深度计数，本文件断言「内层退出不得清除外层作用域」。
 *
 * <en/> Regression tests for the selection-mutation guard.
 *
 * <en/> Locks down a **fixed re-entrancy defect**: the guard once used a boolean flag, so when a
 * <en/> batch entry point (`batchSelectionUpdate` → inner `toggleRowSelection`) nested its calls,
 * <en/> the inner `finally` reset the flag early and the guard silently stopped protecting from
 * <en/> the second row onward. It is now a depth counter; this file asserts that an inner exit
 * <en/> never clears the outer scope.
 */
describe('createSelectionMutationGuard', () => {
  it('returns the wrapped function value unchanged', () => {
    const { withSelectionGuard } = createSelectionMutationGuard()
    expect(withSelectionGuard(() => 42)).toBe(42)
    expect(withSelectionGuard(() => ({ a: 1 }))).toEqual({ a: 1 })
  })

  it('reports mutating only inside the guarded scope', () => {
    const { withSelectionGuard, isMutating } = createSelectionMutationGuard()
    expect(isMutating()).toBe(false)
    withSelectionGuard(() => {
      expect(isMutating()).toBe(true)
    })
    expect(isMutating()).toBe(false)
  })

  it('keeps the guard active in the outer scope after a nested call returns', () => {
    const { withSelectionGuard, isMutating } = createSelectionMutationGuard()
    const observed: boolean[] = []

    withSelectionGuard(() => {
      observed.push(isMutating())
      // <zh/> 内层守卫作用域（等价于批量循环内的单行 toggleRowSelection）| <en/> Inner guard scope (a per-row toggleRowSelection inside the batch loop)
      withSelectionGuard(() => {
        observed.push(isMutating())
      })
      // <zh/> 关键断言：内层已退出，但外层作用域必须仍然生效
      // <en/> Key assertion: the inner scope has exited, yet the outer scope must stay active
      observed.push(isMutating())
    })

    expect(observed).toEqual([true, true, true])
    expect(isMutating()).toBe(false)
  })

  it('tracks nesting depth across many sibling inner calls', () => {
    const { withSelectionGuard, isMutating } = createSelectionMutationGuard()
    const innerStates: boolean[] = []

    withSelectionGuard(() => {
      for (let i = 0; i < 5; i++) {
        withSelectionGuard(() => {
          innerStates.push(isMutating())
        })
        innerStates.push(isMutating())
      }
    })

    // <zh/> 每次内层进出后外层都仍为 true（布尔实现只会得到第一个 true）
    // <en/> The outer scope stays true after every inner enter/exit (a boolean impl would only yield the first true)
    expect(innerStates).toEqual([true, true, true, true, true, true, true, true, true, true])
  })

  it('restores the previous depth when the guarded function throws', () => {
    const { withSelectionGuard, isMutating } = createSelectionMutationGuard()

    expect(() => withSelectionGuard(() => {
      throw new Error('boom')
    })).toThrow('boom')
    expect(isMutating()).toBe(false)

    // <zh/> 外层抛错时，内层已完成的作用域不得泄漏到外层之后
    // <en/> When the outer throws, an already-exited inner scope must not leak past it
    expect(() => withSelectionGuard(() => {
      withSelectionGuard(() => {})
      throw new Error('boom-inner')
    })).toThrow('boom-inner')
    expect(isMutating()).toBe(false)
  })

  it('keeps guard instances independent', () => {
    const a = createSelectionMutationGuard()
    const b = createSelectionMutationGuard()

    a.withSelectionGuard(() => {
      expect(a.isMutating()).toBe(true)
      expect(b.isMutating()).toBe(false)
    })
  })
})

describe('safeNotify', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('invokes the callback and returns nothing', () => {
    const fn = vi.fn()
    expect(safeNotify(fn, 'selectionGuard.test.invoke')).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when the callback is undefined', () => {
    expect(() => safeNotify(undefined, 'selectionGuard.test.undefined')).not.toThrow()
  })

  it('swallows a throwing callback instead of rethrowing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => safeNotify(() => {
      throw new Error('listener blew up')
    }, 'onSelectionChange')).not.toThrow()
  })

  it('keeps dispatching later callbacks after an earlier one throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const later = vi.fn()

    expect(() => safeNotify(() => {
      throw new Error('first listener threw')
    }, 'onSelectionChange')).not.toThrow()
    safeNotify(later, 'selectionGuard.test.later')

    expect(later).toHaveBeenCalledTimes(1)
  })
})

describe('createSafeEmits', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards every payload to its listener', () => {
    const emits: UseSelectionStateEmits<any> = {
      onSelectionChange: vi.fn(),
      onSelect: vi.fn(),
      onSelectAll: vi.fn(),
      onRowSelected: vi.fn(),
    }
    const safe = createSafeEmits(emits)

    const rows = [{ id: 1 }]
    const meta = { keys: ['1'], count: 1 }
    safe.onSelectionChange?.(rows, meta)
    safe.onSelect?.({ selection: rows, row: rows[0] })
    safe.onSelectAll?.(rows)
    safe.onRowSelected?.({ row: rows[0], selected: true })

    expect(emits.onSelectionChange).toHaveBeenCalledWith(rows, meta)
    expect(emits.onSelect).toHaveBeenCalledWith({ selection: rows, row: rows[0] })
    expect(emits.onSelectAll).toHaveBeenCalledWith(rows)
    expect(emits.onRowSelected).toHaveBeenCalledWith({ row: rows[0], selected: true })
  })

  it('isolates a throwing listener so later listeners still fire', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onSelect = vi.fn()
    const safe = createSafeEmits({
      onSelectionChange: () => {
        throw new Error('onSelectionChange threw')
      },
      onSelect,
    })

    expect(() => safe.onSelectionChange?.([], {} as any)).not.toThrow()
    expect(() => safe.onSelect?.({} as any)).not.toThrow()

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('tolerates a missing listener without throwing', () => {
    const safe = createSafeEmits({})
    expect(() => safe.onSelectionChange?.([], { keys: [], count: 0 })).not.toThrow()
    expect(() => safe.onSelectAll?.([])).not.toThrow()
    expect(() => safe.onRowSelected?.({ row: {}, selected: false })).not.toThrow()
  })
})

/**
 * <zh/> 守卫与 rowMap 剪除 watcher 的联动回归——`use-selection-core` 的剪除 watcher 是
 * <zh/> `flush: 'sync'`，因此批量期间父级同步替换 `rowMap` 会**立即**触发剪除。
 * <zh/> 布尔守卫下内层 `finally` 已复位标志，剪除会穿透到批量中途；深度计数下必须全程抑制。
 *
 * <en/> Guard ↔ rowMap-pruning watcher integration regression — the pruning watcher in
 * <en/> `use-selection-core` uses `flush: 'sync'`, so a synchronous `rowMap` swap by the parent
 * <en/> during a batch triggers pruning **immediately**. With a boolean guard the inner `finally`
 * <en/> has already reset the flag, letting pruning through mid-batch; a depth counter must
 * <en/> suppress it for the whole batch.
 */
describe('selection guard during batchSelectionUpdate', () => {
  it('suppresses rowMap pruning for the entire batch, not just the first row', () => {
    const rows = [1, 2, 3].map(id => ({ id, name: `User ${id}` }))
    const fullMap = new Map(rows.map(row => [String(row.id), row]))
    const mapRef = ref(fullMap)
    const onSelectionChange = vi.fn()

    const state = useSelectionState(
      { rowKey: () => (row: { id: number }) => String(row.id), allData: () => rows, rowMap: () => mapRef.value },
      { onSelectionChange },
    )

    // <zh/> 预置选中 {1, 3}（批量外，不受守卫影响）
    // <en/> Pre-select {1, 3} (outside any batch, unaffected by the guard)
    state.setSelection([rows[0], rows[2]])
    expect([...state.selectedKeys.value].sort()).toEqual(['1', '3'])
    onSelectionChange.mockClear()

    state.batchSelectionUpdate(() => {
      // <zh/> 第 1 行取消选中 → 选中集变为 {'3'}
      // <en/> Deselect row 1 → selection becomes {'3'}
      state.toggleRowSelection(rows[0], false)

      /**
       * <zh/> 父级在批量中途同步刷新 rowMap，且新表**不含** key '3'。
       * <zh/> 剪除 watcher 为 sync，此时若守卫已失效就会立刻把 '3' 剪掉。
       * <en/> The parent synchronously swaps rowMap mid-batch, and the new map **lacks** key '3'.
       * <en/> The pruning watcher is sync, so a lapsed guard would prune '3' right here.
       */
      mapRef.value = new Map([['1', rows[0]]])
    })

    /**
     * <zh/> 首断言即判别点：守卫失效时剪除会把 '3' 摘掉（newMap 无 '3' 且 oldMap 有 → 判为失效键），
     * <zh/> 得到空集；守卫生效则原样保留。
     * <en/> The first assertion is the discriminator: a lapsed guard would prune '3'
     * <en/> (absent from newMap but present in oldMap → treated as stale), yielding an empty set;
     * <en/> an effective guard preserves it untouched.
     */
    expect([...state.selectedKeys.value]).toEqual(['3'])
    expect(state.getSelectedCount()).toBe(1)

    /**
     * <zh/> 恰好一次通知 = 批量自身收口的那次（reason='init'）。
     * <zh/> 若守卫失效，剪除会在批量中途再派发一次，此处将变为 2 次。
     * <en/> Exactly one notification = the batch's own collapsed emit (reason='init').
     * <en/> A lapsed guard would add a second mid-batch pruning emit, making this 2.
     */
    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    expect(onSelectionChange).toHaveBeenCalledWith([], { keys: ['3'], count: 1 })
  })
})
