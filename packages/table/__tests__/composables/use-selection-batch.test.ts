import { describe, expect, it, vi } from 'vitest'
import { useSelectionState } from '../../src/composables/selection/use-selection-state'

const createRow = (id: number) => ({ id, name: `User ${id}` })

/**
 * <zh/> batchSelectionUpdate 回归测试——反选等 N 行操作的事件风暴合并为一次通知，
 * <zh/> 状态演化与逐行调用完全一致。
 * <en/> batchSelectionUpdate regression tests — N-row operations (e.g. invert) collapse
 * <en/> their event storm into one notification with state evolution identical to sequential calls.
 */
describe('useSelectionState batchSelectionUpdate', () => {
  const rowKeyGetter = () => (row: { id: number }) => String(row.id)
  const allData = [createRow(1), createRow(2), createRow(3), createRow(4), createRow(5)]
  const rowMap = new Map(allData.map(row => [String(row.id), row]))

  function createWithSpies() {
    const onSelectionChange = vi.fn()
    const onSelect = vi.fn()
    const onRowSelected = vi.fn()
    const state = useSelectionState(
      { rowKey: rowKeyGetter, allData: () => allData, rowMap: () => rowMap },
      { onSelectionChange, onSelect, onRowSelected },
    )
    return { state, onSelectionChange, onSelect, onRowSelected }
  }

  it('collapses N toggles into a single selectionChange with identical final state', () => {
    const batched = createWithSpies()
    batched.state.batchSelectionUpdate(() => {
      for (const row of allData)
        batched.state.toggleRowSelection(row)
    })

    const sequential = createWithSpies()
    for (const row of allData)
      sequential.state.toggleRowSelection(row)

    // <zh/> 最终选中集一致 | <en/> Final selection sets agree
    expect([...batched.state.selectedKeys.value].sort()).toEqual(
      [...sequential.state.selectedKeys.value].sort(),
    )
    expect(batched.state.getSelectedRows()).toEqual(sequential.state.getSelectedRows())
    // <zh/> 批量只派发一次 selectionChange，且携带全量选中行 | <en/> Batch emits selectionChange once with full rows
    expect(batched.onSelectionChange).toHaveBeenCalledTimes(1)
    expect(batched.onSelectionChange.mock.calls[0]![0]).toHaveLength(allData.length)
    // <zh/> 逐行派发 N 次（风暴对照） | <en/> Sequential dispatches N times (storm baseline)
    expect(sequential.onSelectionChange).toHaveBeenCalledTimes(allData.length)
    // <zh/> 批量不派发逐行 select/rowSelected | <en/> Batch emits no per-row select/rowSelected
    expect(batched.onSelect).not.toHaveBeenCalled()
    expect(batched.onRowSelected).not.toHaveBeenCalled()
  })

  it('emits nothing when the batch attempts no dispatch', () => {
    const { state, onSelectionChange } = createWithSpies()
    // <zh/> 不可选行被跳过、无任何派发企图 | <en/> Non-selectable row skipped, no dispatch attempted
    const unselectable = useSelectionState(
      {
        rowKey: rowKeyGetter,
        allData: () => allData,
        rowMap: () => rowMap,
        selectableFn: () => () => false,
      },
      { onSelectionChange },
    )
    unselectable.batchSelectionUpdate(() => {
      for (const row of allData)
        unselectable.toggleRowSelection(row)
    })
    expect(onSelectionChange).not.toHaveBeenCalled()
    expect(state.selectedKeys.value.size).toBe(0)
  })

  it('still flushes the trailing notice when the batch body throws', () => {
    const { state, onSelectionChange } = createWithSpies()
    expect(() => {
      state.batchSelectionUpdate(() => {
        state.toggleRowSelection(allData[0]!)
        throw new Error('boom')
      })
    }).toThrow('boom')
    // <zh/> 部分状态已提交，通知不脱钩 | <en/> Partial state committed, notification still flushed
    expect(state.isSelected(allData[0]!)).toBe(true)
    expect(onSelectionChange).toHaveBeenCalledTimes(1)
  })

  it('clearVisibleRows skips synthetic rows, mirroring selectAll caliber', () => {
    // <zh/> 回归：clear 曾只用 selectableFn 判定，与 selectAll 的 isSelectableBusinessRow 口径分裂
    // <en/> Regression: clear used only selectableFn, split from selectAll's isSelectableBusinessRow caliber
    const { state } = createWithSpies()
    const synthetic = { __isGroupHeader: true } as any
    state.selectedKeys.value = new Set(['1', '2', 'ghost'])
    state.clearVisibleRows([...allData.slice(0, 2), synthetic])
    // <zh/> 业务行被清除；合成行从未进入选中集、其占位键不受影响 | <en/> Business rows cleared; synthetic rows never enter the set, placeholder keys untouched
    expect(state.selectedKeys.value.has('1')).toBe(false)
    expect(state.selectedKeys.value.has('2')).toBe(false)
    expect(state.selectedKeys.value.has('ghost')).toBe(true)
  })

  it('selectAll never admits synthetic rows into the selection set', () => {
    const { state } = createWithSpies()
    const synthetic = { __isGroupHeader: true } as any
    state.selectAll([...allData.slice(0, 1), synthetic])
    expect(state.selectedKeys.value.has('undefined')).toBe(false)
    expect(state.selectedKeys.value.has('1')).toBe(true)
  })
})
