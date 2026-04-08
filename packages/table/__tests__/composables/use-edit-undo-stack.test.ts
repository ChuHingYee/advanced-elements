import type { EditUndoEntry } from '../../src/composables/editing/use-edit-undo'
import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import { useEditUndo } from '../../src/composables/editing/use-edit-undo'

/**
 * 撤销栈专项测试：
 * 1. 失败条目策略——默认 'skip' 修复 rowKey 未命中条目永久阻塞栈顶的缺陷；'block' 保留旧行为
 * 2. valueSetter 通道——撤销/重做写入经由列 setter，与正向编辑数据流一致
 */
describe('useEditUndo', () => {
  function makeRows() {
    return [
      { id: 'a', name: 'Alice', age: 25 },
      { id: 'b', name: 'Bob', age: 30 },
      { id: 'c', name: 'Carol', age: 35 },
    ]
  }

  function makeEntry(overrides: Partial<EditUndoEntry> = {}): EditUndoEntry {
    return {
      type: 'cell',
      rowIndex: 0,
      rowKey: 'a',
      changes: [{ prop: 'name', oldValue: 'Alice', newValue: 'Alice2' }],
      timestamp: Date.now(),
      ...overrides,
    }
  }

  it('default strategy \'skip\' drops a dead entry and keeps undoing (stack-top stall fixed)', () => {
    const data = shallowRef(makeRows())
    const onDataUpdate = vi.fn((newData: any[]) => {
      data.value = newData
    })
    const undo = useEditUndo<any>({
      data,
      onDataUpdate,
      rowKeyFn: () => (row: any) => row.id,
      // failureStrategy omitted — defaults to 'skip'
    })

    // 死条目（rowKey 已不存在）压栈后再压一条有效条目
    undo.pushUndo(makeEntry({ rowKey: 'dead-row', changes: [{ prop: 'name', oldValue: 'X', newValue: 'Y' }] }))
    undo.pushUndo(makeEntry({}))

    expect(undo.undo()).toBeTruthy()
    // 有效条目被应用：a 行回退为 oldValue
    expect(data.value[0].name).toBe('Alice')
    // 有效条目已弹出，死条目仍在下方（下一次 undo 时被跳过）
    expect(undo.redoStack.value).toHaveLength(1)
    // 第二次 undo：命中死条目 → 跳过丢弃 → 栈空返回 false，不再永久阻塞
    expect(undo.undo()).toBeNull()
    expect(undo.undoStack.value).toHaveLength(0)
  })

  it('\'block\' keeps the dead entry and aborts the call', () => {
    const data = shallowRef(makeRows())
    const undo = useEditUndo<any>({
      data,
      onDataUpdate: vi.fn(),
      rowKeyFn: () => (row: any) => row.id,
      failureStrategy: 'block',
    })

    undo.pushUndo(makeEntry({ rowKey: 'dead-row' }))
    undo.pushUndo(makeEntry({}))

    expect(undo.undo()).toBeTruthy()
    // 第二次 undo 命中死条目——block 策略保留它并返回 false
    expect(undo.undo()).toBeNull()
    expect(undo.undoStack.value).toHaveLength(1)
    expect(undo.undoStack.value[0].rowKey).toBe('dead-row')
  })

  it('skip also applies on redo side and drops dead redo entries', () => {
    const data = shallowRef(makeRows())
    const onDataUpdate = vi.fn((newData: any[]) => {
      data.value = newData
    })
    const undo = useEditUndo<any>({
      data,
      onDataUpdate,
      rowKeyFn: () => (row: any) => row.id,
    })

    undo.pushUndo(makeEntry({}))
    expect(undo.undo()).toBeTruthy()
    // 重做栈顶换为死条目后 redo 应跳过它
    undo.redoStack.value = [{ ...makeEntry({ rowKey: 'ghost' }), timestamp: Date.now() }]
    expect(undo.redo()).toBeNull()
    expect(undo.redoStack.value).toHaveLength(0)
  })

  it('routes writes through column valueSetter when provided', () => {
    const data = shallowRef(makeRows())
    const onDataUpdate = vi.fn((newData: any[]) => {
      data.value = newData
    })
    const setterCalls: Array<{ newValue: any, rowIndex: number }> = []
    const columns = computed<ProcessedColumn[]>(() => [
      {
        prop: 'name',
        label: 'Name',
        editable: true,
        hidden: false,
        valueSetter: ({ newValue, rowIndex }) => {
          setterCalls.push({ newValue, rowIndex })
          return true
        },
      } as unknown as ProcessedColumn,
    ])

    const undo = useEditUndo<any>({
      data,
      onDataUpdate,
      rowKeyFn: () => (row: any) => row.id,
      columns,
    })
    undo.pushUndo(makeEntry({}))
    expect(undo.undo()).toBeTruthy()
    expect(setterCalls).toEqual([{ newValue: 'Alice', rowIndex: 0 }])
    // 数据行引用已替换且值由 setter 通道落地（本 mock 直接放行，值仍需写回）
    expect(onDataUpdate).toHaveBeenCalledWith(expect.any(Array), 'full')
  })

  it('setter rejection follows failureStrategy (skipped by default)', () => {
    const data = shallowRef(makeRows())
    const onDataUpdate = vi.fn()
    const columns = computed<ProcessedColumn[]>(() => [
      {
        prop: 'name',
        label: 'Name',
        editable: true,
        hidden: false,
        valueSetter: () => false,
      } as unknown as ProcessedColumn,
    ])

    const undo = useEditUndo<any>({
      data,
      onDataUpdate,
      rowKeyFn: () => (row: any) => row.id,
      columns,
    })
    undo.pushUndo(makeEntry({}))
    expect(undo.undo()).toBeNull()
    // skip：死条目被丢弃，不污染数据
    expect(undo.undoStack.value).toHaveLength(0)
    expect(onDataUpdate).not.toHaveBeenCalled()

    // block：保留条目
    const blocking = useEditUndo<any>({
      data,
      onDataUpdate,
      rowKeyFn: () => (row: any) => row.id,
      columns,
      failureStrategy: 'block',
    })
    blocking.pushUndo(makeEntry({}))
    expect(blocking.undo()).toBeNull()
    expect(blocking.undoStack.value).toHaveLength(1)
  })

  it('removes the legacy self-onDataUpdate roundtrip for out-of-bounds targets', () => {
    const data = shallowRef(makeRows())
    const onDataUpdate = vi.fn()
    const undo = useEditUndo<any>({
      data,
      onDataUpdate,
      rowKeyFn: () => (row: any) => row.id,
    })
    // rowIndex 越界 + 无 rowKey 回退路径
    undo.pushUndo(makeEntry({ rowKey: undefined as any, rowIndex: 99 }))
    expect(undo.undo()).toBeNull()
    expect(onDataUpdate).not.toHaveBeenCalled()
  })
})
