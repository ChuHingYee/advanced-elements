import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useCellEdit } from '../../src/composables/editing/use-cell-edit'
import { useCellNavigation } from '../../src/composables/editing/use-cell-navigation'
import { useEditorResolver } from '../../src/composables/editing/use-editor-resolver'

/**
 * 编辑悲观协议与结果对象专项测试：
 * 1. saveCells 悲观协议——成功入撤销栈 / 失败还原快照派发回滚
 * 2. CommitResult 三类拒绝来源（拦截器/校验/setter 拒写）
 * 3. batchCommitCells 返回结果对象
 */
describe('pessimistic save & CommitResult', () => {
  const baseColumns: ProcessedColumn[] = [
    { prop: 'name', label: 'Name', editable: true, cellEditor: 'el-input', hidden: false },
    { prop: 'age', label: 'Age', editable: true, cellEditor: 'el-input-number', hidden: false },
  ] as unknown as ProcessedColumn[]

  function makeData() {
    return [
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 30 },
    ]
  }

  function createEdit(opts: {
    data?: any
    editConfig?: any
    onDataUpdate?: any
    pushUndo?: any
    onCellValueChanged?: any
    onRollback?: any
    interceptor?: any
    validateFn?: any
  }) {
    const editorResolver = useEditorResolver({ columns: computed(() => baseColumns) })
    const navigation = useCellNavigation({
      editableColumns: editorResolver.editableColumns,
      data: opts.data ?? computed(() => makeData()),
      editConfig: computed(() => undefined),
    })
    return useCellEdit({
      data: opts.data ?? computed(() => makeData()),
      columns: computed(() => baseColumns),
      editConfig: computed(() => opts.editConfig),
      onDataUpdate: opts.onDataUpdate ?? vi.fn(),
      navigation,
      editorResolver,
      pushUndo: opts.pushUndo,
      onCellValueChanged: opts.onCellValueChanged,
      onRollback: opts.onRollback,
      interceptor: opts.interceptor,
      validateFn: opts.validateFn,
    })
  }

  describe('saveCells — optimistic passthrough (no persist hook)', () => {
    it('applies changes immediately and pushes undo entries', async () => {
      const dataRef = ref(makeData())
      const onDataUpdate = vi.fn((newData: any[]) => {
        dataRef.value = newData
      })
      const pushUndo = vi.fn()
      const edit = createEdit({ data: computed(() => dataRef.value), onDataUpdate, pushUndo })

      const result = await edit.saveCells([
        { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice2' },
        { rowIndex: 1, prop: 'age', columnKey: 'age', value: 31 },
        // 未变化的单元格不计入任何一侧
        { rowIndex: 0, prop: 'age', columnKey: 'age', value: 25 },
      ])

      expect(result.applied).toHaveLength(2)
      expect(result.rejected).toHaveLength(0)
      expect(onDataUpdate).toHaveBeenCalledTimes(1)
      expect(pushUndo).toHaveBeenCalledTimes(2)
      expect(dataRef.value[0].name).toBe('Alice2')
      expect(dataRef.value[1].age).toBe(31)
    })
  })

  describe('saveCells — pessimistic protocol', () => {
    it('persists then pushes undo on success', async () => {
      const dataRef = ref(makeData())
      const onDataUpdate = vi.fn((newData: any[]) => {
        dataRef.value = newData
      })
      const pushUndo = vi.fn()
      const persist = vi.fn(async () => {})
      const edit = createEdit({ data: computed(() => dataRef.value), onDataUpdate, pushUndo })

      const result = await edit.saveCells(
        [{ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice2' }],
        { persist },
      )

      expect(persist).toHaveBeenCalledTimes(1)
      expect(persist.mock.calls[0][0]).toMatchObject({
        changes: [{ prop: 'name', oldValue: 'Alice', newValue: 'Alice2', rowIndex: 0 }],
      })
      expect(result.applied).toHaveLength(1)
      expect(result.rejected).toHaveLength(0)
      expect(pushUndo).toHaveBeenCalledTimes(1)
      expect(dataRef.value[0].name).toBe('Alice2')
    })

    it('restores the snapshot and dispatches rollback when persist throws', async () => {
      const original = makeData()
      const dataRef = ref(original.map(r => ({ ...r })))
      const onDataUpdate = vi.fn((newData: any[]) => {
        dataRef.value = newData
      })
      const pushUndo = vi.fn()
      const onRollback = vi.fn()
      const edit = createEdit({
        data: computed(() => dataRef.value),
        onDataUpdate,
        pushUndo,
        onRollback,
      })

      const boom = new Error('network down')
      const result = await edit.saveCells(
        [{ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice2' }],
        { persist: async () => { throw boom } },
      )

      // 数据已还原为提交前状态（引用与内容均一致）
      expect(dataRef.value).toEqual(original)
      expect(dataRef.value[0].name).toBe('Alice')
      // 回滚通知已派发
      expect(onRollback).toHaveBeenCalledWith({ cause: boom })
      // 变更计入 rejected（persist-failed），不入撤销栈
      expect(result.applied).toHaveLength(0)
      expect(result.rejected).toHaveLength(1)
      expect(result.rejected[0]).toMatchObject({ reason: 'persist-failed', prop: 'name', newValue: 'Alice2' })
      expect(pushUndo).not.toHaveBeenCalled()
    })

    it('treats resolve(false) as a failure', async () => {
      const dataRef = ref(makeData())
      const onDataUpdate = vi.fn((newData: any[]) => {
        dataRef.value = newData
      })
      const edit = createEdit({ data: computed(() => dataRef.value), onDataUpdate, onRollback: vi.fn() })

      const result = await edit.saveCells(
        [{ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice2' }],
        { persist: async () => false },
      )

      expect(result.rejected[0]?.reason).toBe('persist-failed')
      expect(dataRef.value[0].name).toBe('Alice')
    })

    it('uses editConfig.onPersist when no per-call hook is given', async () => {
      const persist = vi.fn(async () => {})
      const edit = createEdit({ editConfig: { onPersist: persist }, onDataUpdate: vi.fn(), pushUndo: vi.fn() })

      await edit.saveCells([{ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice2' }])
      expect(persist).toHaveBeenCalledTimes(1)
    })
  })

  describe('commitResult from batchCommitCells', () => {
    it('classifies interceptor vetoes into rejected', async () => {
      const interceptor = { trigger: vi.fn(() => true) }
      const edit = createEdit({ interceptor, onDataUpdate: vi.fn(), pushUndo: vi.fn() })

      const result = await edit.batchCommitCells([
        { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'X' },
      ])

      expect(result.applied).toHaveLength(0)
      expect(result.rejected[0]).toMatchObject({ reason: 'interceptor', prop: 'name' })
    })

    it('classifies validation failures into rejected', async () => {
      const validateFn = vi.fn(async () => false)
      const failingCol: ProcessedColumn[] = [
        { prop: 'name', label: 'Name', editable: true, hidden: false, editorRules: [{ required: true }] },
      ] as unknown as ProcessedColumn[]
      const editorResolver = useEditorResolver({ columns: computed(() => failingCol) })
      const navigation = useCellNavigation({
        editableColumns: editorResolver.editableColumns,
        data: computed(() => makeData()),
        editConfig: computed(() => undefined),
      })
      const edit = useCellEdit({
        data: computed(() => makeData()),
        columns: computed(() => failingCol),
        editConfig: computed(() => undefined),
        onDataUpdate: vi.fn(),
        navigation,
        editorResolver,
        validateFn,
      })

      const result = await edit.batchCommitCells([
        { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Changed' },
      ])

      expect(validateFn).toHaveBeenCalled()
      expect(result.applied).toHaveLength(0)
      expect(result.rejected[0]).toMatchObject({ reason: 'validation', prop: 'name' })
    })

    it('classifies setter rejections into rejected without emitting or pushing undo', async () => {
      const rejectingSetterCols: ProcessedColumn[] = [
        { prop: 'name', label: 'Name', editable: true, hidden: false, valueSetter: () => false },
      ] as unknown as ProcessedColumn[]
      const editorResolver = useEditorResolver({ columns: computed(() => rejectingSetterCols) })
      const navigation = useCellNavigation({
        editableColumns: editorResolver.editableColumns,
        data: computed(() => makeData()),
        editConfig: computed(() => undefined),
      })
      const pushUndo = vi.fn()
      const onCellValueChanged = vi.fn()
      const edit = useCellEdit({
        data: computed(() => makeData()),
        columns: computed(() => rejectingSetterCols),
        editConfig: computed(() => undefined),
        onDataUpdate: vi.fn(),
        navigation,
        editorResolver,
        pushUndo,
        onCellValueChanged,
      })

      const result = await edit.batchCommitCells([
        { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Changed' },
      ])

      expect(result.applied).toHaveLength(0)
      expect(result.rejected[0]).toMatchObject({ reason: 'setter-rejected' })
      expect(onCellValueChanged).not.toHaveBeenCalled()
      expect(pushUndo).not.toHaveBeenCalled()
    })
  })

  describe('commitEditing returns CommitResult', () => {
    it('returns an applied record for a successful single-cell commit', async () => {
      const dataRef = ref(makeData())
      const onDataUpdate = vi.fn((newData: any[]) => {
        dataRef.value = newData
      })
      const pushUndo = vi.fn()
      const edit = createEdit({ data: computed(() => dataRef.value), onDataUpdate, pushUndo })

      await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      edit.editingValue.value = 'Alice2'
      const result = await edit.commitEditing()

      expect(result.applied).toEqual([expect.objectContaining({
        rowIndex: 0,
        prop: 'name',
        oldValue: 'Alice',
        newValue: 'Alice2',
      })])
      expect(result.rejected).toHaveLength(0)
    })

    it('returns a rejected record with reason interceptor on veto', async () => {
      // 仅否决 edit.commit——放行 edit.start，否则编辑无法开始
      const interceptor = { trigger: vi.fn((event: string) => event === 'edit.commit') }
      const edit = createEdit({ interceptor })

      await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
      edit.editingValue.value = 'Bob'
      const result = await edit.commitEditing()

      expect(result.applied).toHaveLength(0)
      expect(result.rejected).toHaveLength(1)
      expect(result.rejected[0].reason).toBe('interceptor')
    })
  })
})
