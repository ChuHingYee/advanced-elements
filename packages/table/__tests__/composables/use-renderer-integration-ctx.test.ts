import { describe, expect, it, vi } from 'vitest'
import { buildEditCtx, buildPipelineCtx, buildSelectionCtx } from '../../src/composables/core/use-renderer-integration'

/**
 * <zh/> 渲染器集成域构建单测——纯函数装配。
 * <en/> Renderer-integration ctx builder tests — pure assembly.
 */
describe('buildSelectionCtx', () => {
  it('forwards selection narrow slice', () => {
    const state = { getSelectedRows: () => [] }
    const ctx = buildSelectionCtx({
      selectionState: state as any,
      hasSelectionColumn: () => true,
      suppressRowClickSelection: () => false,
      rowClickSelect: () => true,
    })
    expect(ctx.selectionState).toBe(state as any)
    expect(ctx.hasSelection()).toBe(true)
    expect(ctx.suppressRowClickSelection()).toBe(false)
    expect(ctx.rowClickSelect()).toBe(true)
  })
})

describe('buildEditCtx', () => {
  it('forwards edit narrow slice', () => {
    const startEditing = vi.fn()
    const ctx = buildEditCtx({
      editConfig: () => ({}),
      isColumnEditable: () => true,
      isCellEditing: () => false,
      startEditing,
      updateCellEditingValue: vi.fn(),
      commitEditing: vi.fn(),
      batchCommitCells: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: () => false,
      canRedo: () => true,
    } as any)
    expect(ctx.isColumnEditable({} as any)).toBe(true)
    expect(ctx.canRedo()).toBe(true)
    ctx.startEditing({} as any)
    expect(startEditing).toHaveBeenCalled()
  })
})

describe('buildPipelineCtx', () => {
  it('forwards pipeline narrow slice', () => {
    const toggleSort = vi.fn()
    const ctx = buildPipelineCtx({
      effectiveColumns: () => [],
      columnByKey: () => new Map(),
      visibleData: () => [{ id: 1 }],
      rowKeyFn: () => (row: any) => String(row.id),
      rowKeyMeta: () => ({ keyToRow: new Map(), keyToIndex: new Map() }),
      toggleSort,
      shiftKeyPressed: { value: false },
      toggleCollapse: vi.fn(),
    } as any)
    expect(ctx.visibleData()).toEqual([{ id: 1 }])
    ctx.toggleSort('name')
    expect(toggleSort).toHaveBeenCalledWith('name')
  })
})
