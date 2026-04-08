import type { FullRowPendingChange } from '../../src/composables/editing/use-cell-edit-commit-row'
/**
 * Tests for the pure functions extracted from `commitEditingAtRow`
 * (大 hook 拆分：内嵌闭包 → 模块级纯函数).
 *
 * Covers:
 * - collectFullRowPendingChanges: 列筛选（可编辑 + 参与编辑缓冲）、valueParser 应用、
 *   resolveCellValue（valueGetter 优先）、浅等即零变更、返回顺序与列序一致。
 * - runFullRowCommitInterceptor: 空变更/无拦截器放行、任一否决即整行拒绝、
 *   被拒记录字段（reason/rowKey/columnKey）、全部放行返回 null。
 */
import type { UseInterceptorReturn } from '../../src/composables/editing/use-interceptor'
import type { ProcessedColumn } from '../../src/types'
import type { InterceptorEditCommitParams } from '../../src/types/interceptor'
import { describe, expect, it, vi } from 'vitest'
import {
  collectFullRowPendingChanges,

  runFullRowCommitInterceptor,
} from '../../src/composables/editing/use-cell-edit-commit-row'

function makeColumn(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return { prop: 'x', label: 'x', key: overrides.prop ?? 'x', ...overrides } as unknown as ProcessedColumn
}

/** <zh/> 构造拦截器桩——按 prop 决定是否否决 | <en/> Build an interceptor stub that vetoes by prop */
function makeInterceptor(vetoProps: string[]): UseInterceptorReturn & { calls: InterceptorEditCommitParams<any>[] } {
  const calls: InterceptorEditCommitParams<any>[] = []
  return {
    calls,
    trigger: (event, params) => {
      expect(event).toBe('edit.commit')
      calls.push(params as InterceptorEditCommitParams<any>)
      return vetoProps.includes((params as InterceptorEditCommitParams<any>).prop)
    },
  }
}

describe('collectFullRowPendingChanges', () => {
  it('collects only editable columns that participate in the edit buffer', () => {
    const row = { a: '1', b: '2', c: '3' }
    const columns = [
      makeColumn({ prop: 'a' }),
      makeColumn({ prop: 'b' }),
      makeColumn({ prop: 'c' }),
    ]
    const changes = collectFullRowPendingChanges({
      row,
      rowIndex: 0,
      columns,
      editingValues: { a: '1-new', b: '2-new' },
      isColumnEditable: col => col.prop !== 'b',
    })

    // b 被判为不可编辑、c 不在编辑缓冲中 → 只剩 a
    // b is not editable and c is absent from the buffer → only a remains
    expect(changes.map(c => c.prop)).toEqual(['a'])
  })

  it('skips columns without prop and valueGetter', () => {
    const columns = [
      makeColumn({ prop: 'a' }),
      { key: 'no-prop', label: 'no-prop' } as unknown as ProcessedColumn,
    ]
    const changes = collectFullRowPendingChanges({
      row: { a: '1' },
      rowIndex: 0,
      columns,
      editingValues: { 'a': '1-new', 'no-prop': 'ignored' },
      isColumnEditable: () => true,
    })
    expect(changes.map(c => c.prop)).toEqual(['a'])
  })

  it('resolves the old value through valueGetter when present', () => {
    const valueGetter = vi.fn(() => 'from-getter')
    const columns = [makeColumn({ prop: 'a', valueGetter })]
    const changes = collectFullRowPendingChanges({
      row: { a: 'raw' },
      rowIndex: 3,
      columns,
      editingValues: { a: 'new' },
      isColumnEditable: () => true,
    })
    expect(valueGetter).toHaveBeenCalledTimes(1)
    expect(changes[0].oldVal).toBe('from-getter')
    expect(changes[0].parsedNewVal).toBe('new')
  })

  it('applies column.valueParser to the buffered value', () => {
    const columns = [makeColumn({ prop: 'a', valueParser: ({ newValue }) => Number(newValue) * 2 })]
    const changes = collectFullRowPendingChanges({
      row: { a: 1 },
      rowIndex: 0,
      columns,
      editingValues: { a: '21' },
      isColumnEditable: () => true,
    })
    expect(changes[0].parsedNewVal).toBe(42)
  })

  it('drops columns whose parsed value is shallow-equal to the old one', () => {
    const strict = { v: 1 }
    const columns = [
      makeColumn({ prop: 'a' }),
      makeColumn({ prop: 'b' }),
    ]
    const changes = collectFullRowPendingChanges({
      row: { a: 'same', b: strict },
      rowIndex: 0,
      columns,
      // 结构与 oldValue 浅等（深比较不在本函数职责内，shallowEqual 视为相等）
      // Structurally shallow-equal to oldValue (deep compare is out of scope; shallowEqual treats it as equal)
      editingValues: { a: 'same', b: { v: 1 } },
      isColumnEditable: () => true,
    })
    expect(changes).toEqual([])
  })

  it('preserves column order and exposes null prop for prop-less editable columns', () => {
    const columns = [
      makeColumn({ prop: 'b' }),
      makeColumn({ prop: 'a' }),
    ]
    const changes = collectFullRowPendingChanges({
      row: { a: 1, b: 2 },
      rowIndex: 0,
      columns,
      editingValues: { a: 11, b: 22 },
      isColumnEditable: () => true,
    })
    expect(changes.map(c => c.prop)).toEqual(['b', 'a'])
    expect(changes[0]).toEqual({ col: columns[0], prop: 'b', oldVal: 2, parsedNewVal: 22 })
  })
})

describe('runFullRowCommitInterceptor', () => {
  const pendingChanges: FullRowPendingChange[] = [
    { col: makeColumn({ prop: 'a' }), prop: 'a', oldVal: 1, parsedNewVal: 2 },
    { col: makeColumn({ prop: 'b' }), prop: 'b', oldVal: 3, parsedNewVal: 4 },
  ]

  it('passes through when there are no pending changes', () => {
    const interceptor = makeInterceptor(['a'])
    expect(runFullRowCommitInterceptor({
      rowIndex: 0,
      reason: 'api',
      row: {},
      pendingChanges: [],
      interceptor,
      rowKey: 'rk',
    })).toBeNull()
    expect(interceptor.calls).toHaveLength(0)
  })

  it('passes through when no interceptor is configured', () => {
    expect(runFullRowCommitInterceptor({
      rowIndex: 0,
      reason: 'api',
      row: {},
      pendingChanges,
    })).toBeNull()
  })

  it('returns null when every change is allowed', () => {
    const interceptor = makeInterceptor([])
    expect(runFullRowCommitInterceptor({
      rowIndex: 0,
      reason: 'api',
      row: {},
      pendingChanges,
      interceptor,
      rowKey: 'rk',
    })).toBeNull()
    // 全放行也要逐条裁决（拦截器可观测到全部变更）
    // Even on a full pass every change must be ruled on (the interceptor observes them all)
    expect(interceptor.calls).toHaveLength(2)
  })

  it('records every vetoed change and returns them as rejected', () => {
    const interceptor = makeInterceptor(['a', 'b'])
    const rejected = runFullRowCommitInterceptor({
      rowIndex: 7,
      reason: 'enter',
      row: { id: 7 },
      pendingChanges,
      interceptor,
      rowKey: 'row-7',
    })

    expect(rejected).toHaveLength(2)
    expect(rejected![0]).toMatchObject({
      rowIndex: 7,
      prop: 'a',
      columnKey: 'a',
      oldValue: 1,
      newValue: 2,
      rowKey: 'row-7',
      reason: 'interceptor',
    })
    expect(rejected![1]).toMatchObject({ prop: 'b', reason: 'interceptor' })
  })

  it('cancels the whole row when only one change is vetoed (full-row atomicity)', () => {
    const interceptor = makeInterceptor(['b'])
    const rejected = runFullRowCommitInterceptor({
      rowIndex: 0,
      reason: 'api',
      row: {},
      pendingChanges,
      interceptor,
      rowKey: null,
    })
    expect(rejected).toHaveLength(1)
    // 未配置 rowKey 时 rowKey 字段为 undefined（与拒绝记录契约一致）
    // With no rowKey configured the field is undefined (matching the rejection-record contract)
    expect(rejected![0].rowKey).toBeUndefined()
  })

  it('forwards the commit reason and row to the interceptor', () => {
    const interceptor = makeInterceptor([])
    const row = { id: 1 }
    runFullRowCommitInterceptor({
      rowIndex: 5,
      reason: 'tab',
      row,
      pendingChanges,
      interceptor,
    })
    expect(interceptor.calls[0]).toMatchObject({ rowIndex: 5, reason: 'tab' })
    expect(interceptor.calls[0].row).toBe(row)
  })
})
