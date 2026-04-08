import type { EditUndoEntry } from '../../src/composables/editing/use-edit-undo'
import { describe, expect, it, vi } from 'vitest'
/**
 * @file use-edit-undo 撤销/重做栈 Composable 测试
 */
import { computed, ref } from 'vue'
import { useEditUndo } from '../../src/composables/editing/use-edit-undo'

describe('useEditUndo', () => {
  const baseData = [
    { id: 1, name: 'Alice', age: 25 },
    { id: 2, name: 'Bob', age: 30 },
  ]

  it('returns initial state with empty stacks', () => {
    const data = ref(baseData)
    const onDataUpdate = vi.fn()
    const { undoStack, redoStack, canUndo, canRedo, pushUndo, undo, redo, clear } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
    })

    expect(undoStack.value).toEqual([])
    expect(redoStack.value).toEqual([])
    expect(canUndo.value).toBe(false)
    expect(canRedo.value).toBe(false)
    expect(typeof pushUndo).toBe('function')
    expect(typeof undo).toBe('function')
    expect(typeof redo).toBe('function')
    expect(typeof clear).toBe('function')
  })

  it('pushUndo adds entry and clears redoStack', () => {
    const data = ref(baseData)
    const onDataUpdate = vi.fn()
    const { pushUndo, undoStack, redoStack, canUndo } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
    })

    const entry: EditUndoEntry = {
      type: 'cell',
      rowIndex: 0,
      changes: [{ prop: 'name', oldValue: 'Alice', newValue: 'Alice Modified' }],
      timestamp: Date.now(),
    }

    pushUndo(entry)
    expect(undoStack.value).toHaveLength(1)
    expect(redoStack.value).toEqual([])
    expect(canUndo.value).toBe(true)
  })

  it('undo applies oldValue and moves entry to redoStack', () => {
    const data = ref([...baseData])
    const onDataUpdate = vi.fn()
    const { pushUndo, undo, canUndo, canRedo, redoStack } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
    })

    pushUndo({
      type: 'cell',
      rowIndex: 0,
      changes: [{ prop: 'name', oldValue: 'Alice', newValue: 'Alice Modified' }],
      timestamp: Date.now(),
    })

    const result = undo()
    // <zh/> T4：undo 返回被应用的条目（真值语义与旧 boolean 兼容），供编排器补发事件
    // <en/> T4: undo returns the applied entry (truthiness matches the legacy boolean), letting
    // <en/> the orchestrator emit change events
    expect(result).toBeTruthy()
    expect(result?.changes[0]).toEqual({ prop: 'name', oldValue: 'Alice', newValue: 'Alice Modified' })
    expect(onDataUpdate).toHaveBeenCalledTimes(1)
    const newData = onDataUpdate.mock.calls[0][0]
    expect(newData[0].name).toBe('Alice')
    expect(canUndo.value).toBe(false)
    expect(canRedo.value).toBe(true)
    expect(redoStack.value).toHaveLength(1)
  })

  it('redo applies newValue and moves entry back to undoStack', () => {
    const data = ref([...baseData])
    const onDataUpdate = vi.fn()
    const { pushUndo, undo, redo, canUndo, canRedo, undoStack } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
    })

    pushUndo({
      type: 'cell',
      rowIndex: 0,
      changes: [{ prop: 'name', oldValue: 'Alice', newValue: 'Alice Modified' }],
      timestamp: Date.now(),
    })

    undo()
    onDataUpdate.mockClear()

    const result = redo()
    expect(result).toBeTruthy()
    expect(onDataUpdate).toHaveBeenCalledTimes(1)
    const newData = onDataUpdate.mock.calls[0][0]
    expect(newData[0].name).toBe('Alice Modified')
    expect(canUndo.value).toBe(true)
    expect(canRedo.value).toBe(false)
    expect(undoStack.value).toHaveLength(1)
  })

  it('undo returns false when undoStack is empty', () => {
    const data = ref(baseData)
    const onDataUpdate = vi.fn()
    const { undo } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
    })

    expect(undo()).toBeNull()
    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('redo returns false when redoStack is empty', () => {
    const data = ref(baseData)
    const onDataUpdate = vi.fn()
    const { redo } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
    })

    expect(redo()).toBeNull()
    expect(onDataUpdate).not.toHaveBeenCalled()
  })

  it('clear empties both stacks', () => {
    const data = ref(baseData)
    const onDataUpdate = vi.fn()
    const { pushUndo, clear, undoStack, redoStack, canUndo, canRedo } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
    })

    pushUndo({
      type: 'cell',
      rowIndex: 0,
      changes: [{ prop: 'name', oldValue: 'Alice', newValue: 'Alice Modified' }],
      timestamp: Date.now(),
    })

    expect(canUndo.value).toBe(true)
    clear()
    expect(undoStack.value).toEqual([])
    expect(redoStack.value).toEqual([])
    expect(canUndo.value).toBe(false)
    expect(canRedo.value).toBe(false)
  })

  it('respects maxStackSize by shifting oldest entries', () => {
    const data = ref(baseData)
    const onDataUpdate = vi.fn()
    const { pushUndo, undoStack } = useEditUndo({
      maxStackSize: 2,
      onDataUpdate,
      data: computed(() => data.value),
    })

    pushUndo({ type: 'cell', rowIndex: 0, changes: [{ prop: 'name', oldValue: 'A', newValue: 'B' }], timestamp: 1 })
    pushUndo({ type: 'cell', rowIndex: 0, changes: [{ prop: 'name', oldValue: 'B', newValue: 'C' }], timestamp: 2 })
    expect(undoStack.value).toHaveLength(2)

    pushUndo({ type: 'cell', rowIndex: 0, changes: [{ prop: 'name', oldValue: 'C', newValue: 'D' }], timestamp: 3 })
    expect(undoStack.value).toHaveLength(2)
    expect(undoStack.value[0].changes[0].oldValue).toBe('B')
  })

  it('undo with rowKeyFn locates row by key', () => {
    const data = ref(baseData)
    const onDataUpdate = vi.fn()
    const rowKeyFn = ref((row: any) => row.id)
    const { pushUndo, undo } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
      rowKeyFn,
    })

    pushUndo({
      type: 'cell',
      rowIndex: 100, // wrong index, but rowKey='2' should locate Bob
      rowKey: 2,
      changes: [{ prop: 'name', oldValue: 'Bob', newValue: 'Bob Modified' }],
      timestamp: Date.now(),
    })

    undo()
    expect(onDataUpdate).toHaveBeenCalledTimes(1)
    const newData = onDataUpdate.mock.calls[0][0]
    expect(newData[1].name).toBe('Bob')
  })

  it('undo without rowKeyFn uses rowIndex fallback', () => {
    const data = ref(baseData)
    const onDataUpdate = vi.fn()
    const { pushUndo, undo } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
      // no rowKeyFn provided
    })

    pushUndo({
      type: 'cell',
      rowIndex: 0,
      changes: [{ prop: 'name', oldValue: 'Alice', newValue: 'Alice Modified' }],
      timestamp: Date.now(),
    })

    undo()
    expect(onDataUpdate).toHaveBeenCalledTimes(1)
  })

  it('handles rowKey lookup when rowKeyFn is a ref', () => {
    const data = ref(baseData)
    const onDataUpdate = vi.fn()
    const rowKeyFn = ref((row: any) => row.id)
    const { pushUndo, undo } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
      rowKeyFn,
    })

    pushUndo({
      type: 'cell',
      rowIndex: 0,
      rowKey: 1,
      changes: [{ prop: 'name', oldValue: 'Alice', newValue: 'Alice Modified' }],
      timestamp: Date.now(),
    })

    undo()
    expect(onDataUpdate).toHaveBeenCalledTimes(1)
    expect(onDataUpdate.mock.calls[0][0][0].name).toBe('Alice')
  })

  it('skip apply when targetIndex is out of bounds', () => {
    const data = ref(baseData)
    const onDataUpdate = vi.fn()
    const rowKeyFn = ref((row: any) => row.id)
    const { pushUndo, undo } = useEditUndo({
      maxStackSize: 50,
      onDataUpdate,
      data: computed(() => data.value),
      rowKeyFn,
    })

    pushUndo({
      type: 'cell',
      rowIndex: 999, // out of bounds
      rowKey: 999, // not found by rowKey
      changes: [{ prop: 'name', oldValue: 'X', newValue: 'Y' }],
      timestamp: Date.now(),
    })

    const result = undo()
    // rowKey configured but not found → return false, do not call onDataUpdate (no data change needed)
    // This prevents writing to the wrong row when rowKey lookup fails
    expect(result).toBeNull()
    expect(onDataUpdate).not.toHaveBeenCalled()
  })
})
