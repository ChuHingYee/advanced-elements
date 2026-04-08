import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useColumnDrag } from '../../src/composables/columns/use-column-drag'
import { createDragImpl } from '../../src/composables/interaction/drag-impl'
import { useRowDrag } from '../../src/composables/interaction/use-row-drag'

vi.mock('../../src/composables/interaction/use-row-drag', () => ({
  useRowDrag: vi.fn(() => ({ isRowDragging: ref(false), destroyRowDrag: vi.fn(), syncDrags: vi.fn() })),
}))

vi.mock('../../src/composables/columns/use-column-drag', () => ({
  useColumnDrag: vi.fn(() => ({ destroy: vi.fn(), suspend: vi.fn(), resume: vi.fn() })),
}))

/**
 * <zh/> drag-impl 全闭包覆盖——捕获传给 mock 的 options 并逐个调用每个 getter/回调。
 * <en/> Full-closure coverage for drag-impl — capture the options handed to the mocks and invoke every getter/callback.
 */

const mockedRowDrag = vi.mocked(useRowDrag)
const mockedColumnDrag = vi.mocked(useColumnDrag)

const TABLE_ID = 'drag-impl-coverage-table'

function buildOptions(overrides: Record<string, any> = {}) {
  return {
    caps: ref({ rowIndexDomain: 'composed' }),
    dom: {},
    tableId: computed(() => TABLE_ID),
    mergedRowConfig: computed(() => ({})),
    mergedColumnConfig: computed(() => ({})),
    tableData: ref([]),
    rowKeyFn: computed(() => (row: any) => String(row.id)),
    rowKeyMeta: ref({ keyToRow: new Map() }),
    reorderData: vi.fn(),
    localColumns: ref([]),
    setColumns: vi.fn(),
    activeRenderer: computed(() => null),
    emit: vi.fn(),
    dragLocator: computed(() => ({})),
    ...overrides,
  } as any
}

function lastRowDragOptions(): any {
  const calls = mockedRowDrag.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1]![0]
}

function lastColumnDragOptions(): any {
  const calls = mockedColumnDrag.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1]![0]
}

function lastRowDragResult(): any {
  const results = mockedRowDrag.mock.results
  expect(results.length).toBeGreaterThan(0)
  return results[results.length - 1]!.value
}

function lastColumnDragResult(): any {
  const results = mockedColumnDrag.mock.results
  expect(results.length).toBeGreaterThan(0)
  return results[results.length - 1]!.value
}

describe('drag-impl coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rowDraggable defaults to false and follows config / <zh/> rowDraggable 缺省 false 并跟随配置', () => {
    const mergedRowConfig = ref<Record<string, any>>({})
    createDragImpl(buildOptions({ mergedRowConfig: computed(() => mergedRowConfig.value) }))
    const opts = lastRowDragOptions()
    expect(opts.rowDraggable()).toBe(false)
    mergedRowConfig.value = { rowDraggable: true }
    expect(opts.rowDraggable()).toBe(true)
  })

  it('rowDragHandle defaults to empty string and follows config / <zh/> rowDragHandle 缺省空串并跟随配置', () => {
    const mergedRowConfig = ref<Record<string, any>>({})
    createDragImpl(buildOptions({ mergedRowConfig: computed(() => mergedRowConfig.value) }))
    const opts = lastRowDragOptions()
    expect(opts.rowDragHandle()).toBe('')
    mergedRowConfig.value = { rowDragHandle: '.drag-handle' }
    expect(opts.rowDragHandle()).toBe('.drag-handle')
  })

  it('getRowMap returns keyToRow / <zh/> getRowMap 返回 keyToRow 映射', () => {
    const keyToRow = new Map([['1', { id: 1 }]])
    createDragImpl(buildOptions({ rowKeyMeta: ref({ keyToRow }) }))
    const rowMap = lastRowDragOptions().getRowMap()
    expect(rowMap.get('1')).toEqual({ id: 1 })
    expect([...rowMap.keys()]).toEqual([...keyToRow.keys()])
  })

  it('suppressMoveWhenRowDragging defaults to false and follows config / <zh/> suppressMoveWhenRowDragging 缺省 false 并跟随配置', () => {
    const mergedRowConfig = ref<Record<string, any>>({})
    createDragImpl(buildOptions({ mergedRowConfig: computed(() => mergedRowConfig.value) }))
    const opts = lastRowDragOptions()
    expect(opts.suppressMoveWhenRowDragging()).toBe(false)
    mergedRowConfig.value = { suppressMoveWhenRowDragging: true }
    expect(opts.suppressMoveWhenRowDragging()).toBe(true)
  })

  it('isRowValidDropPosition getter follows config at call time / <zh/> isRowValidDropPosition 调用时读取最新配置', () => {
    const first = () => true
    const second = () => false
    const mergedRowConfig = ref<Record<string, any>>({ isRowValidDropPosition: first })
    createDragImpl(buildOptions({ mergedRowConfig: computed(() => mergedRowConfig.value) }))
    const opts = lastRowDragOptions()
    expect(opts.isRowValidDropPosition()).toBe(first)
    mergedRowConfig.value = { isRowValidDropPosition: second }
    expect(opts.isRowValidDropPosition()).toBe(second)
  })

  it('beforeDrag getter follows config at call time / <zh/> beforeDrag 调用时读取最新配置', () => {
    const first = () => true
    const second = () => false
    const mergedRowConfig = ref<Record<string, any>>({ beforeDrag: first })
    createDragImpl(buildOptions({ mergedRowConfig: computed(() => mergedRowConfig.value) }))
    const opts = lastRowDragOptions()
    expect(opts.beforeDrag()).toBe(first)
    mergedRowConfig.value = { beforeDrag: second }
    expect(opts.beforeDrag()).toBe(second)
  })

  it('onRowDragStart forwards via tableEmit / <zh/> onRowDragStart 经 tableEmit 转发', () => {
    const emit = vi.fn()
    createDragImpl(buildOptions({ emit }))
    const context = { row: { id: 1 } }
    lastRowDragOptions().onRowDragStart(context)
    expect(emit).toHaveBeenCalledWith('rowDragStart', context, TABLE_ID)
  })

  it('onRowDragEnd forwards via tableEmit / <zh/> onRowDragEnd 经 tableEmit 转发', () => {
    const emit = vi.fn()
    createDragImpl(buildOptions({ emit }))
    const context = { row: { id: 2 } }
    lastRowDragOptions().onRowDragEnd(context)
    expect(emit).toHaveBeenCalledWith('rowDragEnd', context, TABLE_ID)
  })

  it('onDragError emits TABLE_ROW_DRAG_FAILED / <zh/> onDragError 上报 TABLE_ROW_DRAG_FAILED', () => {
    const emit = vi.fn()
    createDragImpl(buildOptions({ emit }))
    const cause = new Error('drag boom')
    lastRowDragOptions().onDragError(cause, 'move')
    expect(emit).toHaveBeenCalledWith(
      'error',
      { code: 'TABLE_ROW_DRAG_FAILED', severity: 'warn', cause },
      TABLE_ID,
    )
  })

  it('column onColumnsReordered calls setColumns / <zh/> 列重排回调调用 setColumns', () => {
    const setColumns = vi.fn()
    createDragImpl(buildOptions({ setColumns }))
    const next = [{ key: 'b' }, { key: 'a' }]
    lastColumnDragOptions().onColumnsReordered(next)
    expect(setColumns).toHaveBeenCalledWith(next)
  })

  it('column getters fall back with null renderer / <zh/> 渲染器为空时列 getter 取缺省值', () => {
    createDragImpl(buildOptions({ activeRenderer: computed(() => null) }))
    const opts = lastColumnDragOptions()
    expect(opts.getColumnDragContainer()).toBe(null)
    expect(opts.getRenderedColumnKeys()).toEqual([])
    expect(opts.getDefaultColumnDragHandle()).toBe('.cell')
    expect(opts.getColumnDraggableSelector()).toBe('th')
  })

  it('column getters delegate to activeRenderer / <zh/> 列 getter 委托给 activeRenderer', () => {
    const container = {}
    const keys = ['a', 'b']
    const activeRenderer = computed(() => ({
      getColumnDragContainer: () => container,
      getRenderedColumnKeys: () => keys,
      getDefaultColumnDragHandle: () => '.custom-handle',
      getColumnDraggableSelector: () => 'td.custom',
    }))
    createDragImpl(buildOptions({ activeRenderer }))
    const opts = lastColumnDragOptions()
    expect(opts.getColumnDragContainer()).toBe(container)
    expect(opts.getRenderedColumnKeys()).toBe(keys)
    expect(opts.getDefaultColumnDragHandle()).toBe('.custom-handle')
    expect(opts.getColumnDraggableSelector()).toBe('td.custom')
  })

  it('column getters fall back when renderer methods are missing / <zh/> 渲染器方法缺失时列 getter 回退缺省值', () => {
    createDragImpl(buildOptions({ activeRenderer: computed(() => ({})) }))
    const opts = lastColumnDragOptions()
    expect(opts.getColumnDragContainer()).toBe(null)
    expect(opts.getRenderedColumnKeys()).toEqual([])
    expect(opts.getDefaultColumnDragHandle()).toBe('.cell')
    expect(opts.getColumnDraggableSelector()).toBe('th')
  })

  it('destroy dispatches to both mocks / <zh/> destroy 转发给行列两侧', () => {
    const impl = createDragImpl(buildOptions({}))
    impl.destroy()
    expect(lastRowDragResult().destroyRowDrag).toHaveBeenCalledTimes(1)
    expect(lastColumnDragResult().destroy).toHaveBeenCalledTimes(1)
  })

  it('suspend destroys row drag and suspends column drag / <zh/> suspend 销毁行拖并挂起列拖', () => {
    const impl = createDragImpl(buildOptions({}))
    impl.suspend()
    expect(lastRowDragResult().destroyRowDrag).toHaveBeenCalledTimes(1)
    expect(lastColumnDragResult().suspend).toHaveBeenCalledTimes(1)
  })

  it('resume syncs row drags and resumes column drag / <zh/> resume 同步行拖并恢复列拖', () => {
    const impl = createDragImpl(buildOptions({}))
    impl.resume()
    expect(lastRowDragResult().syncDrags).toHaveBeenCalledTimes(1)
    expect(lastColumnDragResult().resume).toHaveBeenCalledTimes(1)
  })

  it('isRowDragging is the mocked row-drag ref identity / <zh/> isRowDragging 与行拖 mock 同一引用', () => {
    const impl = createDragImpl(buildOptions({}))
    expect(impl.isRowDragging).toBe(lastRowDragResult().isRowDragging)
  })
})
