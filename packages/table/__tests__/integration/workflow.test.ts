import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useUrlState } from '../../src/composables/data/use-url-state'
import { useCellEdit } from '../../src/composables/editing/use-cell-edit'
import { useInterceptor } from '../../src/composables/editing/use-interceptor'
import { useSelectionState } from '../../src/composables/selection/use-selection-state'
import { getCellValue, getRowsValues, getRowValues } from '../../src/utils/context-menu-clipboard'
import { parseResponseData } from '../../src/utils/format-response'
import { resolveCellValue } from '../../src/utils/value-pipeline'
import { mockColumn } from '../helpers'

/** <zh/> 创建编辑器解析器 mock | <en/> Create editor resolver mock */
function createEditorResolverMock(columns: ProcessedColumn[]) {
  return {
    getEditorComponent: vi.fn(() => undefined),
    getEditorSelectorParams: vi.fn(() => undefined),
    isColumnEditable: vi.fn((col: ProcessedColumn) => Boolean(col.editable)),
    editableColumns: computed(() => columns.filter(c => c.editable)),
  }
}

describe('edit Workflow', () => {
  it('single cell edit commits data via onDataUpdate', async () => {
    const data = ref([{ id: '1', name: 'Alice', age: 25 }])
    const columns = ref([
      { ...mockColumn({ prop: 'name', editable: true, cellEditor: 'text', hidden: false }) },
    ] as ProcessedColumn[])
    const onDataUpdate = vi.fn()

    const edit = useCellEdit({ data: data as any, columns: columns as any, editConfig: computed(() => ({})), rowKeyFn: () => (row: any) => row.id, onDataUpdate, editorResolver: createEditorResolverMock(columns.value) as any })

    /**
     * <zh/> startEditing 为异步契约（竞态防护 pendingStart 链）——必须 await 进入执行相位后
     * <zh/> 再断言/提交；commitEditing 内部亦会排队等待 pendingStart，双保险。
     * <en/> startEditing is an async contract (race-protection pendingStart chain) — await it before
     * <en/> asserting/committing; commitEditing additionally queues behind pendingStart as a second guard.
     */
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'AliceUpdated'
    await edit.commitEditing()

    expect(onDataUpdate).toHaveBeenCalled()
    const newData = onDataUpdate.mock.calls[0][0]
    expect(newData[0].name).toBe('AliceUpdated')
  })

  it('full row edit emits fullRowEdit event', async () => {
    const data = ref([{ id: '1', name: 'Alice', age: 25 }])
    const columns = ref([
      { ...mockColumn({ prop: 'name', editable: true, cellEditor: 'text', hidden: false }) },
      { ...mockColumn({ prop: 'age', editable: true, cellEditor: 'number', hidden: false }) },
    ] as ProcessedColumn[])
    const onFullRowEditChanged = vi.fn()
    const onDataUpdate = vi.fn()

    const edit = useCellEdit({ data: data as any, columns: columns as any, editConfig: computed(() => ({ editType: 'fullRow' })), rowKeyFn: () => (row: any) => row.id, onDataUpdate, onFullRowEditChanged, editorResolver: createEditorResolverMock(columns.value) as any })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.editingRowIndex.value).toBe(0)
    edit.updateCellEditingValue('name', 'AliceFullRow')
    edit.updateCellEditingValue('age', 30)
    await edit.commitEditing()

    expect(onFullRowEditChanged).toHaveBeenCalled()
    expect(onDataUpdate).toHaveBeenCalled()
  })

  it('batch edit accumulates changes and commits', async () => {
    const data = ref([
      { id: '1', name: 'Alice', age: 25 },
      { id: '2', name: 'Bob', age: 30 },
    ])
    const columns = ref([
      { ...mockColumn({ prop: 'name', editable: true, cellEditor: 'text', hidden: false }) },
    ] as ProcessedColumn[])
    const onBatchRecordChange = vi.fn()
    const onDataUpdate = vi.fn()

    const edit = useCellEdit({ data: data as any, columns: columns as any, editConfig: computed(() => ({ editType: 'batch' })), rowKeyFn: () => (row: any) => row.id, onDataUpdate, onBatchRecordChange, editorResolver: createEditorResolverMock(columns.value) as any })

    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'BatchAlice'
    await edit.commitEditing()

    // <zh/> 契约载荷包含 oldValue（见 UseCellEditOptions.onBatchRecordChange 类型）
    // <en/> Contract payload includes oldValue (see UseCellEditOptions.onBatchRecordChange type)
    expect(onBatchRecordChange).toHaveBeenCalledWith({
      rowKey: '1',
      prop: 'name',
      newValue: 'BatchAlice',
      oldValue: 'Alice',
    })
  })

  it('batch cancel does not change data', async () => {
    const data = ref([{ id: '1', name: 'Alice', age: 25 }])
    const columns = ref([
      { ...mockColumn({ prop: 'name', editable: true, cellEditor: 'text', hidden: false }) },
    ] as ProcessedColumn[])
    const onDataUpdate = vi.fn()

    const edit = useCellEdit({ data: data as any, columns: columns as any, editConfig: computed(() => ({ editType: 'batch' })), rowKeyFn: () => (row: any) => row.id, onDataUpdate, editorResolver: createEditorResolverMock(columns.value) as any })

    edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    edit.editingValue.value = 'NewName'
    edit.cancelEditing()
    await nextTick()

    expect(onDataUpdate).not.toHaveBeenCalled()
    expect(data.value[0].name).toBe('Alice')
  })
})

describe('selection + Pagination', () => {
  it('selection preserved across pages', () => {
    const data = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' },
    ]
    const rowKey = (r: any) => r.id
    const rowMap = new Map(data.map(r => [rowKey(r), r]))

    const state = useSelectionState({
      rowKey: () => rowKey,
      allData: () => data,
      rowMap: () => rowMap,
    })

    const page1 = [data[0], data[1]]
    state.selectAll(page1)
    expect(state.isSelectedByKey('1')).toBe(true)
    expect(state.isSelectedByKey('2')).toBe(true)

    // Switch to page 2 - selection preserved
    const page2 = [data[2]]
    expect(state.isSelectedByKey('3')).toBe(false)

    state.selectAll(page2)
    expect(state.isSelectedByKey('3')).toBe(true)
  })

  it('clearSelection works', () => {
    const data = [{ id: '1', name: 'Alice' }]
    const rowKey = (r: any) => r.id
    const rowMap = new Map(data.map(r => [rowKey(r), r]))

    const state = useSelectionState({
      rowKey: () => rowKey,
      allData: () => data,
      rowMap: () => rowMap,
    })

    state.initSelectionByKeys(['1'])
    expect(state.getSelectedCount()).toBe(1)

    state.clearSelection()
    expect(state.getSelectedCount()).toBe(0)
  })
})

describe('utility Integration', () => {
  it('value pipeline with format-response', () => {
    const row = { id: 1, name: 'Alice', score: 85 }
    const col = { prop: 'score', hidden: false } as any
    const rawValue = resolveCellValue(row, col, 0)
    expect(rawValue).toBe(85)
  })

  it('context-menu clipboard helpers', () => {
    const columns = [
      { prop: 'name', label: 'Name', hidden: false },
      { prop: 'score', label: 'Score', hidden: false },
    ] as ProcessedColumn[]
    const row = { name: 'Alice', score: 95 }

    const cellValue = getCellValue({ row, column: columns[0] })
    expect(cellValue).toBe('Alice')

    const rowValues = getRowValues({ row, columns })
    expect(rowValues).toBe('Alice\t95')

    const rowsValues = getRowsValues({ rows: [row], columns, includeHeaders: true })
    expect(rowsValues).toBe('Name\tScore\nAlice\t95')
  })

  it('format-response parses various formats', () => {
    const result = parseResponseData(
      { items: [{ id: 1 }], count: '30' },
      { data: 'items', total: 'count' },
    )
    expect(result.data).toEqual([{ id: 1 }])
    expect(result.total).toBe(30)
  })

  it('interceptor chain with useCellEdit', async () => {
    const interceptor = useInterceptor({
      interceptorConfig: () => ({}),
    })
    const data = ref([{ id: '1', name: 'Alice' }])
    const columns = ref([
      { ...mockColumn({ prop: 'name', editable: true, cellEditor: 'text', hidden: false }) },
    ] as ProcessedColumn[])
    const onDataUpdate = vi.fn()

    const edit = useCellEdit({ data: data as any, columns: columns as any, editConfig: computed(() => ({})), rowKeyFn: () => (row: any) => row.id, onDataUpdate, interceptor, editorResolver: createEditorResolverMock(columns.value) as any })

    // Interceptor allows editing by default
    await edit.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    expect(edit.isEditing.value).toBe(true)

    edit.editingValue.value = 'Updated'
    await edit.commitEditing()
    expect(onDataUpdate).toHaveBeenCalled()
  })

  it('urlState with custom config', async () => {
    const router = { replace: vi.fn() }
    const route = { path: '/test', query: { pageNo: '2', pageSize: '20' } }
    const isManual = ref(false)

    const { initFromUrl, setPageLog } = useUrlState(
      { enabled: true, pageKey: 'pageNo', sizeKey: 'pageSize' },
      isManual,
      { router, route },
    )

    const fromUrl = initFromUrl()
    expect(fromUrl).toEqual({ page: 2, size: 20 })

    // initFromUrl sets isInitializing=true and releases via microtask; await it first
    await Promise.resolve()

    setPageLog(3, 50)
    // setPageLog debounces via microtask (Promise.resolve().then(flushPendingUpdate))
    await Promise.resolve()
    expect(router.replace).toHaveBeenCalledWith({
      path: '/test',
      query: { pageNo: '3', pageSize: '50' },
    })
  })
})
