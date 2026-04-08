import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createStopEditingHandler,
  mapEditorReasonToStopReason,
} from '../../src/utils/edit-helpers'

describe('edit-helpers', () => {
  describe('mapEditorReasonToStopReason', () => {
    it('undefined 映射为 click', () => {
      expect(mapEditorReasonToStopReason(undefined)).toBe('click')
    })

    it('空字符串映射为 click', () => {
      expect(mapEditorReasonToStopReason('')).toBe('click')
    })

    it('tab 映射为 tab', () => {
      expect(mapEditorReasonToStopReason('tab')).toBe('tab')
    })

    it('shift-tab 映射为 tab', () => {
      expect(mapEditorReasonToStopReason('shift-tab')).toBe('tab')
    })

    it('enter 映射为 enter', () => {
      expect(mapEditorReasonToStopReason('enter')).toBe('enter')
    })

    it('escape 映射为 escape', () => {
      expect(mapEditorReasonToStopReason('escape')).toBe('escape')
    })

    it('未知 reason 映射为 click', () => {
      expect(mapEditorReasonToStopReason('unknown')).toBe('click')
      expect(mapEditorReasonToStopReason('home')).toBe('click')
      expect(mapEditorReasonToStopReason('end')).toBe('click')
    })
  })

  describe('createStopEditingHandler', () => {
    const defaultEditApi = {
      stopEditing: vi.fn(),
      findNextEditableCell: vi.fn(),
      findFirstEditableCell: vi.fn(),
      findLastEditableCell: vi.fn(),
      startEditing: vi.fn(),
      editingRowIndex: { value: null },
    }

    const defaultParams = {
      editApi: { ...defaultEditApi },
      editConfig: undefined,
      rowIndex: 0,
      columnKey: 'name',
      row: { name: 'Alice', age: 30 },
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('全行编辑模式下返回 undefined', () => {
      const handler = createStopEditingHandler({
        ...defaultParams,
        editApi: { ...defaultEditApi, editingRowIndex: { value: 1 } },
      })
      expect(handler).toBeUndefined()
    })

    it('正常模式下返回停止编辑回调函数', () => {
      const handler = createStopEditingHandler(defaultParams)
      expect(typeof handler).toBe('function')
    })

    describe('返回的回调函数', () => {
      it('commit=false 时调用 stopEditing 但不触发导航', () => {
        const handler = createStopEditingHandler(defaultParams)!
        handler(false, 'tab')

        expect(defaultParams.editApi.stopEditing).toHaveBeenCalledWith('tab', false)
        expect(defaultParams.editApi.findNextEditableCell).not.toHaveBeenCalled()
        expect(defaultParams.editApi.startEditing).not.toHaveBeenCalled()
      })

      it('commit=true + tab + tabToNextCell 时导航到下一个可编辑单元格', () => {
        const params = {
          ...defaultParams,
          editConfig: { tabToNextCell: true },
          editApi: {
            ...defaultEditApi,
            findNextEditableCell: vi.fn(() => ({
              rowIndex: 0,
              columnKey: 'age',
              prop: 'age',
            })),
          },
        }
        const handler = createStopEditingHandler(params)!
        handler(true, 'tab')

        expect(params.editApi.stopEditing).toHaveBeenCalledWith('tab', true)
        expect(params.editApi.findNextEditableCell).toHaveBeenCalledWith(
          0,
          'name',
          'next',
          false,
        )
        expect(params.editApi.startEditing).toHaveBeenCalledWith({
          rowIndex: 0,
          prop: 'age',
          columnKey: 'age',
          value: 30,
        })
      })

      it('shift-tab 导航到上一个单元格', () => {
        const params = {
          ...defaultParams,
          editConfig: { tabToNextCell: true },
          editApi: {
            ...defaultEditApi,
            findNextEditableCell: vi.fn(() => ({
              rowIndex: 0,
              columnKey: 'age',
              prop: 'age',
            })),
          },
        }
        const handler = createStopEditingHandler(params)!
        handler(true, 'shift-tab')

        expect(params.editApi.findNextEditableCell).toHaveBeenCalledWith(
          0,
          'name',
          'previous',
          false,
        )
      })

      it('tabToNextCell 为 false 时不触发 tab 导航', () => {
        const handler = createStopEditingHandler(defaultParams)!
        handler(true, 'tab')

        expect(defaultParams.editApi.stopEditing).toHaveBeenCalledWith('tab', true)
        expect(defaultParams.editApi.findNextEditableCell).not.toHaveBeenCalled()
      })

      it('enter + enterMovesDownAfterEdit 时垂直导航到下一行', () => {
        const params = {
          ...defaultParams,
          editConfig: { enterMovesDownAfterEdit: true },
          editApi: {
            ...defaultEditApi,
            findNextEditableCell: vi.fn(() => ({
              rowIndex: 1,
              columnKey: 'name',
              prop: 'name',
            })),
          },
        }
        const handler = createStopEditingHandler(params)!
        handler(true, 'enter')

        expect(params.editApi.findNextEditableCell).toHaveBeenCalledWith(
          0,
          'name',
          'next',
          true,
        )
        expect(params.editApi.startEditing).toHaveBeenCalledWith({
          rowIndex: 1,
          prop: 'name',
          columnKey: 'name',
          value: 'Alice',
        })
      })

      it('enterMovesDownAfterEdit 为 false 时不触发 enter 导航', () => {
        const handler = createStopEditingHandler(defaultParams)!
        handler(true, 'enter')

        expect(defaultParams.editApi.findNextEditableCell).not.toHaveBeenCalled()
      })

      it('home 导航到当前行第一个可编辑单元格', () => {
        const params = {
          ...defaultParams,
          editApi: {
            ...defaultEditApi,
            findFirstEditableCell: vi.fn(() => ({
              rowIndex: 0,
              columnKey: 'name',
              prop: 'name',
            })),
          },
        }
        const handler = createStopEditingHandler(params)!
        handler(true, 'home')

        expect(params.editApi.findFirstEditableCell).toHaveBeenCalledWith(0)
        expect(params.editApi.startEditing).toHaveBeenCalledWith({
          rowIndex: 0,
          prop: 'name',
          columnKey: 'name',
          value: 'Alice',
        })
      })

      it('end 导航到当前行最后一个可编辑单元格', () => {
        const params = {
          ...defaultParams,
          editApi: {
            ...defaultEditApi,
            findLastEditableCell: vi.fn(() => ({
              rowIndex: 0,
              columnKey: 'age',
              prop: 'age',
            })),
          },
        }
        const handler = createStopEditingHandler(params)!
        handler(true, 'end')

        expect(params.editApi.findLastEditableCell).toHaveBeenCalledWith(0)
        expect(params.editApi.startEditing).toHaveBeenCalledWith({
          rowIndex: 0,
          prop: 'age',
          columnKey: 'age',
          value: 30,
        })
      })

      it('home 时 findFirstEditableCell 返回 null 不触发 startEditing', () => {
        const params = {
          ...defaultParams,
          editApi: {
            ...defaultEditApi,
            findFirstEditableCell: vi.fn(() => null),
          },
        }
        const handler = createStopEditingHandler(params)!
        handler(true, 'home')

        expect(params.editApi.startEditing).not.toHaveBeenCalled()
      })

      it('end 时 findLastEditableCell 返回 null 不触发 startEditing', () => {
        const params = {
          ...defaultParams,
          editApi: {
            ...defaultEditApi,
            findLastEditableCell: vi.fn(() => null),
          },
        }
        const handler = createStopEditingHandler(params)!
        handler(true, 'end')

        expect(params.editApi.startEditing).not.toHaveBeenCalled()
      })

      it('tab 时 findNextEditableCell 返回 null 不触发 startEditing', () => {
        const params = {
          ...defaultParams,
          editConfig: { tabToNextCell: true },
          editApi: {
            ...defaultEditApi,
            findNextEditableCell: vi.fn(() => null),
          },
        }
        const handler = createStopEditingHandler(params)!
        handler(true, 'tab')

        expect(params.editApi.startEditing).not.toHaveBeenCalled()
      })

      it('enter 时 findNextEditableCell 返回 null 不触发 startEditing', () => {
        const params = {
          ...defaultParams,
          editConfig: { enterMovesDownAfterEdit: true },
          editApi: {
            ...defaultEditApi,
            findNextEditableCell: vi.fn(() => null),
          },
        }
        const handler = createStopEditingHandler(params)!
        handler(true, 'enter')

        expect(params.editApi.startEditing).not.toHaveBeenCalled()
      })
    })
  })
})
