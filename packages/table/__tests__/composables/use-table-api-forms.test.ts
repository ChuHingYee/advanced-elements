import { describe, expect, it, vi } from 'vitest'
import { useTableApi } from '../../src/composables/api/use-table-api'

/**
 * <zh/> TableExpose 大版本规范形态——对象式 toggleRowSelection、单形态 startEditing、
 * <zh/> 精确导出选项、编辑值读写暴露（v3.0 旧形态已移除）
 * <en/> TableExpose major-version canonical forms — object-form toggleRowSelection, single-form
 * <en/> startEditing, precise export options, edit-value accessors (legacy forms removed in v3.0)
 */
function createApi() {
  const toggleRowSelection = vi.fn()
  const startEditing = vi.fn()
  const updateCellEditingValue = vi.fn()
  const getCellEditingValue = vi.fn(() => 'Alice')
  const exportExcel = vi.fn(async () => {})
  const exportCsv = vi.fn(async () => {})
  const api = useTableApi({
    dataColumns: {
      treeApi: {},
      rowExpandApi: {},
      rowGroupApi: {},
      rowPinApi: {},
    },
    selection: { selectionState: { toggleRowSelection } },
    features: { exportExcel, exportCsv },
    sharedEditing: { startEditing, updateCellEditingValue, getCellEditingValue },
    contextMenu: {},
    getRowKey: (row: any) => String(row.id),
    setQuickFilter: () => {},
    getQuickFilter: () => '',
  } as any)
  return { api, toggleRowSelection, startEditing, updateCellEditingValue, getCellEditingValue, exportExcel, exportCsv }
}

describe('tableExpose canonical forms', () => {
  it('toggleRowSelection object form destructures onto the internal path', () => {
    const { api, toggleRowSelection } = createApi()
    const row = { id: '1' }
    api.toggleRowSelection(row, { selected: true, ignoreSelectable: true, ctrlKey: true })
    expect(toggleRowSelection).toHaveBeenCalledTimes(1)
    expect(toggleRowSelection).toHaveBeenCalledWith(row, true, true, { ctrlKey: true })
  })

  it('toggleRowSelection bare call toggles with undefined fields', () => {
    const { api, toggleRowSelection } = createApi()
    const row = { id: '1' }
    api.toggleRowSelection(row)
    expect(toggleRowSelection).toHaveBeenCalledWith(row, undefined, undefined, {})
  })

  it('startEditing object form reaches edit.startEditing directly', () => {
    const { api, startEditing } = createApi()
    const params = { rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' }
    api.startEditing(params)
    expect(startEditing).toHaveBeenCalledTimes(1)
    expect(startEditing).toHaveBeenCalledWith(params)
  })

  it('updateCellEditingValue/getCellEditingValue forward to the editing chain', () => {
    const { api, updateCellEditingValue, getCellEditingValue } = createApi()
    api.updateCellEditingValue('name', 'Alicia')
    expect(updateCellEditingValue).toHaveBeenCalledWith('name', 'Alicia')
    expect(api.getCellEditingValue('name')).toBe('Alice')
    expect(getCellEditingValue).toHaveBeenCalledWith('name')
  })

  it('exportExcel/exportCsv forward precise options including extra keys', async () => {
    const { api, exportExcel, exportCsv } = createApi()
    await api.exportExcel({ filename: 'report', customPassthrough: 1 })
    expect(exportExcel).toHaveBeenCalledWith({ filename: 'report', customPassthrough: 1 })
    await api.exportCsv({ filename: 'report' })
    expect(exportCsv).toHaveBeenCalledWith({ filename: 'report' })
  })
})
